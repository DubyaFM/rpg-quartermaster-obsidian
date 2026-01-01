// Config Service - Platform-agnostic configuration business logic
// Handles config processing, caching, party-level calculations, and template merging

import { IConfigAdapter, RawShopConfig, RawCustomTemplatesConfig, RawShopkeepConfig, CustomTemplate, RawBaseStockConfig } from '../interfaces/IConfigAdapter';
import { ISettingsAdapter } from '../interfaces/ISettingsAdapter';
import { ShopGenerationConfig, Faction } from '../models/types';
import { Service, LootTable } from '../interfaces/IDataAdapter';
import { getPartyLevelBaseChances } from '../data/partyLevelTable';
import { calculateEffectiveConfig } from './templateManager';

/**
 * Configuration Service
 * Platform-agnostic business logic for configuration management
 *
 * Responsibilities:
 * - Calculate party-level magic item chances
 * - Merge custom templates with defaults
 * - Cache configurations for performance
 * - Resolve paths (default vs custom configs)
 *
 * Does NOT:
 * - Perform file I/O (delegated to IConfigAdapter)
 * - Manage settings persistence (delegated to ISettingsAdapter)
 */
export class ConfigService {
	// Config caches
	private shopConfigCache: RawShopConfig | null = null;
	private servicesCache: any = null;
	private factionsCache: any = null;
	private lootTablesCache: any = null;
	private customTemplatesCache: RawCustomTemplatesConfig | null = null;  // @deprecated - old format
	private namedTemplatesCache: CustomTemplate[] | null = null;  // New named templates cache
	private shopkeepConfigCache: RawShopkeepConfig | null = null;
	private lifestyleCostsCache: import('../models/types').UpkeepCostConfig | null = null;  // Phase 4+
	private baseStockConfigCache: RawBaseStockConfig | null = null;

	constructor(
		private configAdapter: IConfigAdapter,
		private settingsAdapter: ISettingsAdapter
	) {}

	/**
	 * Get shop configuration with party-level calculations applied
	 *
	 * @param type Shop type (blacksmith, alchemist, etc.)
	 * @param wealthLevel Wealth level (poor, modest, comfortable, wealthy, aristocratic)
	 * @returns Shop configuration with effective magic chances calculated
	 */
	async getShopConfig(type: string, wealthLevel: string): Promise<ShopGenerationConfig> {
		// Load shop config (cached)
		if (!this.shopConfigCache) {
			this.shopConfigCache = await this.configAdapter.loadShopConfig();
		}

		const config = this.shopConfigCache;

		if (!config) {
			throw new Error('Shop configuration file could not be loaded');
		}

		if (!config.shops) {
			throw new Error('Shop configuration file is invalid - missing "shops" section');
		}

		// Navigate nested structure: shops.type.wealthLevel
		const shopTypeConfig = config.shops[type];
		if (!shopTypeConfig) {
			throw new Error(`No configuration found for shop type: ${type}`);
		}

		const wealthConfig = shopTypeConfig[wealthLevel];
		if (!wealthConfig) {
			throw new Error(`No configuration found for ${type} at ${wealthLevel} wealth level`);
		}

		// Build the base configuration
		const shopConfig: ShopGenerationConfig = {
			type,
			wealthLevel: wealthLevel as any,
			maxItems: wealthConfig.maxItems,
			rarityChances: wealthConfig.rarityChances,
			basicItemTypes: wealthConfig.basicItemTypes || {},
			magicItemCountWeights: wealthConfig.magicItemCountWeights || {},
			defaultMagicItemModifier: wealthConfig.defaultMagicItemModifier ?? 1.0,
			overrideMagicItemChances: wealthConfig.overrideMagicItemChances,
			fundsOnHandDice: wealthConfig.goldOnHand,
			specificItems: wealthConfig.specificItems,
			totalItemRange: wealthConfig.totalItemRange
		};

		// Calculate effective magic item chances using settings
		const settings = this.settingsAdapter.getSettings();
		const partyLevel = settings.partyLevel ?? 5;
		const wealthModifier = settings.magicItemRarityModifiers?.[wealthLevel as keyof typeof settings.magicItemRarityModifiers] ?? 1.0;

		const effectiveChances = this.calculateEffectiveMagicChances(shopConfig, partyLevel, wealthModifier);
		(shopConfig as any).effectiveMagicItemChances = effectiveChances;

		return shopConfig;
	}

	/**
	 * Get shop configuration with custom template applied
	 * This is the primary method for shop generation
	 *
	 * @param type Shop type
	 * @param wealthLevel Wealth level
	 * @returns Merged configuration (custom template + defaults)
	 */
	async getShopConfigWithTemplate(
		type: string,
		wealthLevel: string
	): Promise<ShopGenerationConfig> {
		// Get default configuration (includes effectiveMagicItemChances)
		const defaultConfig = await this.getShopConfig(type, wealthLevel);

		// Check settings to see if custom template should be used
		const settings = this.settingsAdapter.getSettings();
		const templatePreferences = settings.shopTemplatePreferences || {};
		const selectedTemplate = templatePreferences[type] || 'default';

		let customConfig: Partial<ShopGenerationConfig> | null = null;

		// Only load custom template if one is selected and it's not "default"
		if (selectedTemplate !== 'default') {
			customConfig = await this.getCustomTemplateByName(selectedTemplate, wealthLevel);
		}

		// Merge configurations
		const mergedConfig = calculateEffectiveConfig(defaultConfig, customConfig);

		// Re-calculate effective magic chances after merge
		const partyLevel = settings.partyLevel ?? 5;
		const wealthModifier = settings.magicItemRarityModifiers?.[wealthLevel as keyof typeof settings.magicItemRarityModifiers] ?? 1.0;

		const effectiveChances = this.calculateEffectiveMagicChances(mergedConfig, partyLevel, wealthModifier);
		(mergedConfig as any).effectiveMagicItemChances = effectiveChances;

		return mergedConfig;
	}

	/**
	 * Calculate effective magic item chances based on party level and wealth
	 *
	 * @param config Shop configuration
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

	/**
	 * Get custom template for a specific shop type and wealth level
	 *
	 * @param type Shop type
	 * @param wealthLevel Wealth level
	 * @returns Partial config from custom template, or null if not found
	 */
	async getCustomTemplate(
		type: string,
		wealthLevel: string
	): Promise<Partial<ShopGenerationConfig> | null> {
		// Load custom templates (cached)
		if (!this.customTemplatesCache) {
			this.customTemplatesCache = await this.configAdapter.loadCustomTemplates();
		}

		const config = this.customTemplatesCache;

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
		if ((template as any).goldOnHand) {
			template.fundsOnHandDice = (template as any).goldOnHand;
			delete (template as any).goldOnHand;
		}

		return template;
	}

	/**
	 * Get custom template configuration by name for a specific wealth level
	 * This is the NEW method that respects named templates
	 *
	 * @param templateName Name of the template to load
	 * @param wealthLevel Wealth level to get config for
	 * @returns Partial config for the wealth level, or null if not found
	 */
	async getCustomTemplateByName(
		templateName: string,
		wealthLevel: string
	): Promise<Partial<ShopGenerationConfig> | null> {
		const template = await this.configAdapter.loadTemplateByName(templateName);

		if (!template || !template.wealthLevels) {
			return null;
		}

		const wealthConfig = template.wealthLevels[wealthLevel];
		if (!wealthConfig) {
			return null;
		}

		// Map YAML goldOnHand to type fundsOnHandDice if present
		if ((wealthConfig as any).goldOnHand) {
			wealthConfig.fundsOnHandDice = (wealthConfig as any).goldOnHand;
			delete (wealthConfig as any).goldOnHand;
		}

		return wealthConfig;
	}

	/**
	 * Get all available templates for a specific shop type
	 *
	 * @param shopType Shop type to filter templates by
	 * @returns Array of template names
	 */
	async getAvailableTemplatesForType(shopType: string): Promise<string[]> {
		// Load all templates (cached)
		if (!this.namedTemplatesCache) {
			this.namedTemplatesCache = await this.configAdapter.getAvailableTemplates();
		}

		return this.namedTemplatesCache
			.filter(t => t.shopType === shopType)
			.map(t => t.name);
	}

	/**
	 * Get which wealth levels are available in a named template
	 *
	 * @param templateName Name of the template
	 * @returns Array of wealth level strings (e.g., ['modest', 'wealthy'])
	 */
	async getTemplateAvailableWealthLevels(templateName: string): Promise<string[]> {
		const template = await this.configAdapter.loadTemplateByName(templateName);

		if (!template || !template.wealthLevels) {
			return [];
		}

		return Object.keys(template.wealthLevels);
	}

	/**
	 * Save a named custom template
	 *
	 * @param template CustomTemplate object to save
	 */
	async saveNamedTemplate(template: CustomTemplate): Promise<void> {
		// Map fundsOnHandDice to goldOnHand for YAML in all wealth levels
		const yamlTemplate = { ...template };
		if (yamlTemplate.wealthLevels) {
			for (const wealthLevel of Object.keys(yamlTemplate.wealthLevels)) {
				const config = yamlTemplate.wealthLevels[wealthLevel];
				if (config.fundsOnHandDice) {
					(config as any).goldOnHand = config.fundsOnHandDice;
					delete config.fundsOnHandDice;
				}
			}
		}

		await this.configAdapter.saveNamedTemplate(yamlTemplate);

		// Clear cache to force reload
		this.namedTemplatesCache = null;
	}

	/**
	 * Delete a named custom template
	 *
	 * @param templateName Name of template to delete
	 */
	async deleteNamedTemplate(templateName: string): Promise<void> {
		await this.configAdapter.deleteNamedTemplate(templateName);

		// Clear cache to force reload
		this.namedTemplatesCache = null;
	}

	/**
	 * @deprecated Use getAvailableTemplatesForType() instead
	 * Get all custom templates
	 * @returns All custom templates organized by type and wealth level
	 */
	async getAllCustomTemplates(): Promise<Record<string, Record<string, Partial<ShopGenerationConfig>>>> {
		if (!this.customTemplatesCache) {
			this.customTemplatesCache = await this.configAdapter.loadCustomTemplates();
		}

		const config = this.customTemplatesCache;

		if (!config || !config.templates) {
			return {};
		}

		// Map goldOnHand to fundsOnHandDice for all templates
		const templates = config.templates;
		for (const type of Object.keys(templates)) {
			for (const wealthLevel of Object.keys(templates[type])) {
				const template = templates[type][wealthLevel];
				if ((template as any).goldOnHand) {
					template.fundsOnHandDice = (template as any).goldOnHand;
					delete (template as any).goldOnHand;
				}
			}
		}

		return templates;
	}

	/**
	 * Save or update a custom template
	 *
	 * @param type Shop type
	 * @param wealthLevel Wealth level
	 * @param config Partial configuration to save
	 */
	async saveCustomTemplate(
		type: string,
		wealthLevel: string,
		config: Partial<ShopGenerationConfig>
	): Promise<void> {
		// Load existing templates
		let allTemplates = await this.getAllCustomTemplates();

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

		// Save via adapter
		await this.configAdapter.saveCustomTemplates({ templates: allTemplates });

		// Invalidate cache
		this.customTemplatesCache = null;
	}

	/**
	 * Delete a custom template
	 *
	 * @param type Shop type
	 * @param wealthLevel Wealth level
	 */
	async deleteCustomTemplate(type: string, wealthLevel: string): Promise<void> {
		// Load existing templates
		let allTemplates = await this.getAllCustomTemplates();

		// Remove the template
		if (allTemplates[type] && allTemplates[type][wealthLevel]) {
			delete allTemplates[type][wealthLevel];

			// Remove type key if empty
			if (Object.keys(allTemplates[type]).length === 0) {
				delete allTemplates[type];
			}
		}

		// Save via adapter
		await this.configAdapter.saveCustomTemplates({ templates: allTemplates });

		// Invalidate cache
		this.customTemplatesCache = null;
	}

	/**
	 * Get services for a specific shop type
	 * @param shopType Shop type
	 * @returns Array of services available for this shop type
	 */
	async getServices(shopType: string): Promise<Service[]> {
		if (!this.servicesCache) {
			this.servicesCache = await this.configAdapter.loadServicesConfig();
		}

		return this.servicesCache?.[shopType] || [];
	}

	/**
	 * Get all factions
	 * @returns Array of all available factions
	 */
	async getFactions(): Promise<Faction[]> {
		if (!this.factionsCache) {
			this.factionsCache = await this.configAdapter.loadFactionsConfig();
		}

		return this.factionsCache?.factions || [];
	}

	/**
	 * Get loot tables
	 * @returns Array of loot tables
	 */
	async getLootTables(): Promise<LootTable[]> {
		if (!this.lootTablesCache) {
			this.lootTablesCache = await this.configAdapter.loadLootTablesConfig();
		}

		return this.lootTablesCache?.tables || [];
	}

	/**
	 * Get shopkeeper configuration
	 * @returns Shopkeeper config with names, species, dispositions, etc.
	 */
	async getShopkeepConfig(): Promise<RawShopkeepConfig | null> {
		if (!this.shopkeepConfigCache) {
			this.shopkeepConfigCache = await this.configAdapter.loadShopkeepConfig();
		}

		return this.shopkeepConfigCache;
	}

	/**
	 * Get lifestyle costs configuration (D&D 5e upkeep costs)
	 * Used by UpkeepManager to calculate daily party expenses
	 * @returns Lifestyle costs config with rations and lifestyle level costs
	 */
	async getLifestyleCosts(): Promise<import('../models/types').UpkeepCostConfig> {
		if (!this.lifestyleCostsCache) {
			this.lifestyleCostsCache = await this.configAdapter.loadLifestyleCosts();
		}

		if (!this.lifestyleCostsCache) {
			throw new Error('Lifestyle costs configuration not found');
		}

		return this.lifestyleCostsCache;
	}

	/**
	 * Get base stock configuration
	 * @returns Base stock config organized by shop type and wealth level
	 */
	async getBaseStockConfig(): Promise<RawBaseStockConfig | null> {
		if (!this.baseStockConfigCache) {
			this.baseStockConfigCache = await this.configAdapter.loadBaseStockConfig();
		}

		return this.baseStockConfigCache;
	}

	/**
	 * Clear all caches
	 * Call this when configs are reloaded or settings change
	 */
	clearCache(): void {
		this.shopConfigCache = null;
		this.servicesCache = null;
		this.factionsCache = null;
		this.lootTablesCache = null;
		this.customTemplatesCache = null;
		this.namedTemplatesCache = null;
		this.shopkeepConfigCache = null;
		this.lifestyleCostsCache = null;
		this.baseStockConfigCache = null;
	}
}
