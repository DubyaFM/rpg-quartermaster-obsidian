// Handles loading YAML configuration files
import { App, Plugin } from 'obsidian';
import * as yaml from 'js-yaml';
import { ShopGenerationConfig, Faction, RPGShopkeepSettings } from '@quartermaster/core/models/types';
import type { CurrencyConfig } from '@quartermaster/core/models/currency-config';
import { RawBaseStockConfig } from '@quartermaster/core/interfaces/IConfigAdapter';
import { Service, LootTable } from '@quartermaster/core/interfaces/IDataAdapter';
import { calculateEffectiveConfig } from '@quartermaster/core/services/templateManager';
import { getPartyLevelBaseChances } from '@quartermaster/core/data/partyLevelTable';

export class ConfigLoader {
	constructor(private app: App, private plugin?: Plugin) {}

	/**
	 * Calculate effective magic item chances based on party level and wealth modifiers
	 * @param config Shop configuration with magic item settings
	 * @param partyLevel Party level (1-20)
	 * @param wealthModifier Wealth-based multiplier (0.1 for poor, 1.0 for aristocratic)
	 * @returns Effective magic item chances for each rarity
	 */
	private calculateEffectiveMagicChances(
		config: ShopGenerationConfig,
		partyLevel: number,
		wealthModifier: number
	): Record<string, number> {
		// If override exists, return those values directly (no modifications)
		if (config.overrideMagicItemChances) {
			return {
				common: config.overrideMagicItemChances.common ?? 0,
				uncommon: config.overrideMagicItemChances.uncommon ?? 0,
				rare: config.overrideMagicItemChances.rare ?? 0,
				veryRare: config.overrideMagicItemChances.veryRare ?? 0,
				legendary: config.overrideMagicItemChances.legendary ?? 0
			};
		}

		// Otherwise, calculate from base values
		const baseChances = getPartyLevelBaseChances(partyLevel);
		const defaultModifier = config.defaultMagicItemModifier ?? 1.0;

		// Apply formula: baseChance * defaultMagicItemModifier * wealthModifier
		return {
			common: Math.min(100, baseChances.common * defaultModifier * wealthModifier),
			uncommon: Math.min(100, baseChances.uncommon * defaultModifier * wealthModifier),
			rare: Math.min(100, baseChances.rare * defaultModifier * wealthModifier),
			veryRare: Math.min(100, baseChances.veryRare * defaultModifier * wealthModifier),
			legendary: Math.min(100, baseChances.legendary * defaultModifier * wealthModifier)
		};
	}

	async getShopConfig(type: string, wealthLevel: string): Promise<ShopGenerationConfig> {
		const config = await this.loadYamlFile('shopConfig.yaml');

		if (!config) {
			console.error('ConfigLoader: shopConfig.yaml returned null/undefined');
			throw new Error('Shop configuration file could not be loaded. Check that config/shopConfig.yaml exists.');
		}

		if (!config.shops) {
			console.error('ConfigLoader: config loaded but has no "shops" property. Config keys:', Object.keys(config));
			throw new Error('Shop configuration file is invalid - missing "shops" section');
		}

		// Navigate nested structure: shops.type.wealthLevel
		const shopTypeConfig = config.shops[type];
		if (!shopTypeConfig) {
			console.error(`ConfigLoader: No config for shop type "${type}". Available types:`, Object.keys(config.shops));
			throw new Error(`No configuration found for shop type: ${type}`);
		}

		const wealthConfig = shopTypeConfig[wealthLevel];
		if (!wealthConfig) {
			console.error(`ConfigLoader: No config for wealth level "${wealthLevel}". Available levels for ${type}:`, Object.keys(shopTypeConfig));
			throw new Error(`No configuration found for ${type} at ${wealthLevel} wealth level`);
		}

		// Build the base configuration
		const shopConfig: ShopGenerationConfig = {
			type,
			wealthLevel: wealthLevel as any,
			// Support both old structure (maxItems/rarityChances) and new structure (basicItemTypes/magicItemCountWeights)
			maxItems: wealthConfig.maxItems,
			rarityChances: wealthConfig.rarityChances,
			basicItemTypes: wealthConfig.basicItemTypes || {},
			magicItemCountWeights: wealthConfig.magicItemCountWeights || {},
			defaultMagicItemModifier: wealthConfig.defaultMagicItemModifier ?? 1.0,
			overrideMagicItemChances: wealthConfig.overrideMagicItemChances,
			fundsOnHandDice: wealthConfig.goldOnHand,  // Map from YAML 'goldOnHand' to type 'fundsOnHandDice'
			specificItems: wealthConfig.specificItems,
			totalItemRange: wealthConfig.totalItemRange
		};

		// Calculate effective magic item chances if plugin and settings are available
		if (this.plugin) {
			const settings = (this.plugin as any).settings as RPGShopkeepSettings;
			if (settings) {
				const partyLevel = settings.partyLevel ?? 5;
				const wealthModifier = settings.magicItemRarityModifiers?.[wealthLevel as keyof typeof settings.magicItemRarityModifiers] ?? 1.0;

				// Calculate and attach effective magic chances
				const effectiveChances = this.calculateEffectiveMagicChances(shopConfig, partyLevel, wealthModifier);
				(shopConfig as any).effectiveMagicItemChances = effectiveChances;
			}
		}

		return shopConfig;
	}

	/**
	 * Get shop configuration with custom template applied (if exists)
	 * This is the primary method to use for shop generation
	 *
	 * @param type Shop type (blacksmith, alchemist, etc.)
	 * @param wealthLevel Wealth level (poor, modest, etc.)
	 * @param customTemplatePath Optional path to custom template file (defaults to config/customShopTemplates.yaml)
	 * @returns Merged configuration (custom template + defaults)
	 */
	async getShopConfigWithTemplate(
		type: string,
		wealthLevel: string,
		customTemplatePath?: string
	): Promise<ShopGenerationConfig> {
		// Get default configuration (includes effectiveMagicItemChances)
		const defaultConfig = await this.getShopConfig(type, wealthLevel);

		// Try to load custom template
		const customConfig = await this.getCustomTemplate(type, wealthLevel, customTemplatePath);

		// Merge configurations
		const mergedConfig = calculateEffectiveConfig(defaultConfig, customConfig);

		// Re-calculate effective magic chances after merge if plugin and settings are available
		// This ensures custom template changes to defaultMagicItemModifier or overrideMagicItemChances are applied
		if (this.plugin) {
			const settings = (this.plugin as any).settings as RPGShopkeepSettings;
			if (settings) {
				const partyLevel = settings.partyLevel ?? 5;
				const wealthModifier = settings.magicItemRarityModifiers?.[wealthLevel as keyof typeof settings.magicItemRarityModifiers] ?? 1.0;

				// Re-calculate and attach effective magic chances with merged config
				const effectiveChances = this.calculateEffectiveMagicChances(mergedConfig, partyLevel, wealthModifier);
				(mergedConfig as any).effectiveMagicItemChances = effectiveChances;
			}
		}

		return mergedConfig;
	}

	/**
	 * Get custom template for a specific shop type and wealth level
	 *
	 * @param type Shop type
	 * @param wealthLevel Wealth level
	 * @param customTemplatePath Optional path to custom template file
	 * @returns Partial config from custom template, or null if not found
	 */
	async getCustomTemplate(
		type: string,
		wealthLevel: string,
		customTemplatePath?: string
	): Promise<Partial<ShopGenerationConfig> | null> {
		const filename = customTemplatePath || 'customShopTemplates.yaml';
		const config = await this.loadYamlFile(filename);

		if (!config || !config.templates) {
			return null;
		}

		// Navigate: templates.type.wealthLevel
		const shopTypeTemplates = config.templates[type];
		if (!shopTypeTemplates) {
			return null;
		}

		const template = shopTypeTemplates[wealthLevel];
		if (!template) {
			return null;
		}

		// Map YAML goldOnHand to type fundsOnHandDice if present
		if (template.goldOnHand) {
			template.fundsOnHandDice = template.goldOnHand;
			delete template.goldOnHand;
		}

		return template;
	}

	/**
	 * Get all custom templates from file
	 *
	 * @param customTemplatePath Optional path to custom template file
	 * @returns Object with all templates: { [type]: { [wealthLevel]: Partial<Config> } }
	 */
	async getAllCustomTemplates(
		customTemplatePath?: string
	): Promise<Record<string, Record<string, Partial<ShopGenerationConfig>>>> {
		const filename = customTemplatePath || 'customShopTemplates.yaml';
		const config = await this.loadYamlFile(filename);

		if (!config || !config.templates) {
			return {};
		}

		// Map goldOnHand to fundsOnHandDice for all templates
		const templates = config.templates;
		for (const type of Object.keys(templates)) {
			for (const wealthLevel of Object.keys(templates[type])) {
				const template = templates[type][wealthLevel];
				if (template.goldOnHand) {
					template.fundsOnHandDice = template.goldOnHand;
					delete template.goldOnHand;
				}
			}
		}

		return templates;
	}

	/**
	 * Save or update a custom template
	 * Note: This writes to the file system, so it's Obsidian-specific
	 *
	 * @param type Shop type
	 * @param wealthLevel Wealth level
	 * @param config Partial configuration to save
	 * @param customTemplatePath Optional path to custom template file
	 */
	async saveCustomTemplate(
		type: string,
		wealthLevel: string,
		config: Partial<ShopGenerationConfig>,
		customTemplatePath?: string
	): Promise<void> {
		const filename = customTemplatePath || 'customShopTemplates.yaml';

		// Load existing templates or create new structure
		let allTemplates = await this.getAllCustomTemplates(customTemplatePath);

		// Ensure structure exists
		if (!allTemplates[type]) {
			allTemplates[type] = {};
		}

		// Map fundsOnHandDice to goldOnHand for YAML
		const yamlConfig = { ...config };
		if (yamlConfig.fundsOnHandDice) {
			(yamlConfig as any).goldOnHand = yamlConfig.fundsOnHandDice;
			delete yamlConfig.fundsOnHandDice;
		}

		// Update template
		allTemplates[type][wealthLevel] = yamlConfig;

		// Write back to file
		const yamlContent = yaml.dump({ templates: allTemplates }, { indent: 2, lineWidth: -1 });

		const adapter = this.app.vault.adapter;
		const pluginDir = this.plugin?.manifest.dir || '';
		const fullPath = `${pluginDir}/config/${filename}`;

		await adapter.write(fullPath, yamlContent);
	}

	/**
	 * Delete a custom template
	 *
	 * @param type Shop type
	 * @param wealthLevel Wealth level
	 * @param customTemplatePath Optional path to custom template file
	 */
	async deleteCustomTemplate(
		type: string,
		wealthLevel: string,
		customTemplatePath?: string
	): Promise<void> {
		const filename = customTemplatePath || 'customShopTemplates.yaml';

		// Load existing templates
		let allTemplates = await this.getAllCustomTemplates(customTemplatePath);

		// Remove the template
		if (allTemplates[type] && allTemplates[type][wealthLevel]) {
			delete allTemplates[type][wealthLevel];

			// Remove type key if empty
			if (Object.keys(allTemplates[type]).length === 0) {
				delete allTemplates[type];
			}
		}

		// Write back to file
		const yamlContent = yaml.dump({ templates: allTemplates }, { indent: 2, lineWidth: -1 });

		const adapter = this.app.vault.adapter;
		const pluginDir = this.plugin?.manifest.dir || '';
		const fullPath = `${pluginDir}/config/${filename}`;

		await adapter.write(fullPath, yamlContent);
	}

	async getServices(shopType: string): Promise<Service[]> {
		const config = await this.loadYamlFile('services.yaml');
		return config?.[shopType] || [];
	}

	async getFactions(): Promise<Faction[]> {
		const config = await this.loadYamlFile('factions.yaml');
		return config?.factions || [];
	}

	async getLootTables(): Promise<LootTable[]> {
		const config = await this.loadYamlFile('lootTables.yaml');
		return config?.tables || [];
	}

	/**
	 * Load base stock configuration from baseStockConfig.yaml
	 * @returns RawBaseStockConfig object organized by shop type -> wealth level -> items[]
	 */
	async getBaseStockConfig(): Promise<RawBaseStockConfig> {
		const config = await this.loadYamlFile('baseStockConfig.yaml');

		if (!config) {
			console.warn('ConfigLoader: baseStockConfig.yaml not found, returning empty config');
			return {};
		}

		// Validate structure
		if (typeof config !== 'object') {
			console.error('ConfigLoader: baseStockConfig.yaml is not a valid object');
			return {};
		}

		console.log('ConfigLoader: Base stock configuration loaded successfully');
		return config as RawBaseStockConfig;
	}

	/**
	 * Loads currency configuration from currencies.yaml
	 *
	 * @returns Parsed CurrencyConfig object with all currency systems and default system
	 * @throws Error if currencies.yaml not found or parsing fails
	 *
	 * @example
	 * const config = await loader.loadCurrencyConfig();
	 * const activeSystem = config.systems[config.defaultSystem];
	 * console.log(activeSystem.name); // "D&D 5e Standard"
	 */
	async loadCurrencyConfig(): Promise<CurrencyConfig> {
		const config = await this.loadYamlFile('currencies.yaml');

		if (!config) {
			console.error('ConfigLoader: currencies.yaml could not be loaded');
			throw new Error('Currency configuration file could not be loaded. Check that config/currencies.yaml exists.');
		}

		// Validate that defaultSystem exists in systems
		if (!config.defaultSystem || !config.systems || !config.systems[config.defaultSystem]) {
			console.error('ConfigLoader: Invalid currency config structure. defaultSystem:', config.defaultSystem, 'Available systems:', config.systems ? Object.keys(config.systems) : 'none');
			throw new Error(`Invalid currency config: defaultSystem "${config.defaultSystem}" not found in systems`);
		}

		console.log('ConfigLoader: Currency configuration loaded successfully');
		return config as CurrencyConfig;
	}

	private async loadYamlFile(filename: string): Promise<any> {
		try {
			if (!this.plugin) {
				console.error('ConfigLoader: No plugin instance provided');
				return null;
			}

			// Use the plugin's adapter to read files from the plugin directory
			const configPath = `config/${filename}`;

			// Read file from plugin directory using the adapter
			const adapter = this.app.vault.adapter;
			const pluginDir = `${this.plugin.manifest.dir}`;
			const fullPath = `${pluginDir}/${configPath}`;

			console.log(`ConfigLoader: Attempting to load ${fullPath}`);

			// Check if file exists
			const exists = await adapter.exists(fullPath);
			if (!exists) {
				console.error(`ConfigLoader: File not found at ${fullPath}`);
				console.error(`ConfigLoader: pluginDir="${pluginDir}", configPath="${configPath}"`);
				return null;
			}

			console.log(`ConfigLoader: File exists, reading content...`);
			const content = await adapter.read(fullPath);
			console.log(`ConfigLoader: Content read (${content.length} bytes), parsing YAML...`);

			const parsed = yaml.load(content);
			console.log(`ConfigLoader: YAML parsed successfully for ${filename}`);
			return parsed;
		} catch (error) {
			console.error(`ConfigLoader: Error loading ${filename}:`, error);
			console.error(`ConfigLoader: Error details:`, error.message, error.stack);
			return null;
		}
	}
}
