// Obsidian Config Adapter
// Implements IConfigAdapter for reading/writing YAML configs from Obsidian plugin directory

import { App, Plugin } from 'obsidian';
import * as yaml from 'js-yaml';
import {
	IConfigAdapter,
	RawShopConfig,
	RawServicesConfig,
	RawFactionsConfig,
	RawLootTablesConfig,
	RawCustomTemplatesConfig,
	RawShopkeepConfig,
	CustomTemplate,
	RawCalendarConfig
} from '@quartermaster/core/interfaces/IConfigAdapter';
import { UpkeepCostConfig } from '@quartermaster/core/models/types';

/**
 * Obsidian implementation of config adapter
 * Reads YAML configuration files from plugin directory
 */
export class ObsidianConfigAdapter implements IConfigAdapter {
	private configCache: Map<string, any> = new Map();

	constructor(
		private app: App,
		private plugin: Plugin
	) {}

	/**
	 * Load shop configuration from plugin directory
	 */
	async loadShopConfig(): Promise<RawShopConfig | null> {
		// Check cache first
		const cacheKey = 'shopConfig';
		if (this.configCache.has(cacheKey)) {
			return this.configCache.get(cacheKey);
		}

		// Load from file
		const config = await this.loadYamlFile('shopConfig.yaml');

		// Cache the result (even if null)
		this.configCache.set(cacheKey, config);

		return config;
	}

	/**
	 * Load services configuration from plugin directory
	 */
	async loadServicesConfig(): Promise<RawServicesConfig | null> {
		// Check cache first
		const cacheKey = 'servicesConfig';
		if (this.configCache.has(cacheKey)) {
			return this.configCache.get(cacheKey);
		}

		// Load from file
		const config = await this.loadYamlFile('services.yaml');

		// Cache the result (even if null)
		this.configCache.set(cacheKey, config);

		return config;
	}

	/**
	 * Load factions configuration from plugin directory
	 */
	async loadFactionsConfig(): Promise<RawFactionsConfig | null> {
		// Check cache first
		const cacheKey = 'factionsConfig';
		if (this.configCache.has(cacheKey)) {
			return this.configCache.get(cacheKey);
		}

		// Load from file
		const config = await this.loadYamlFile('factions.yaml');

		// Cache the result (even if null)
		this.configCache.set(cacheKey, config);

		return config;
	}

	/**
	 * Load loot tables configuration from plugin directory
	 */
	async loadLootTablesConfig(): Promise<RawLootTablesConfig | null> {
		// Check cache first
		const cacheKey = 'lootTablesConfig';
		if (this.configCache.has(cacheKey)) {
			return this.configCache.get(cacheKey);
		}

		// Load from file
		const config = await this.loadYamlFile('lootTables.yaml');

		// Cache the result (even if null)
		this.configCache.set(cacheKey, config);

		return config;
	}

	/**
	 * Load custom shop templates from plugin directory
	 */
	async loadCustomTemplates(): Promise<RawCustomTemplatesConfig | null> {
		// Check cache first
		const cacheKey = 'customTemplates';
		if (this.configCache.has(cacheKey)) {
			return this.configCache.get(cacheKey);
		}

		// Load from file
		const config = await this.loadYamlFile('customShopTemplates.yaml');

		// Cache the result (even if null)
		this.configCache.set(cacheKey, config);

		return config;
	}

	/**
	 * Load shopkeeper configuration from plugin directory (Phase 4)
	 */
	async loadShopkeepConfig(): Promise<RawShopkeepConfig | null> {
		// Check cache first
		const cacheKey = 'shopkeepConfig';
		if (this.configCache.has(cacheKey)) {
			return this.configCache.get(cacheKey);
		}

		// Load from file
		const config = await this.loadYamlFile('shopkeepConfig.yaml');

		// Cache the result (even if null)
		this.configCache.set(cacheKey, config);

		return config;
	}

	/**
	 * Load calendar definitions from plugin directory
	 * Used by CalendarDefinitionManager for time tracking
	 */
	async loadCalendarDefinitions(): Promise<RawCalendarConfig | null> {
		// Check cache first
		const cacheKey = 'calendarDefinitions';
		if (this.configCache.has(cacheKey)) {
			return this.configCache.get(cacheKey);
		}

		// Load from file
		const config = await this.loadYamlFile('calendars.yaml');

		// Cache the result (even if null)
		this.configCache.set(cacheKey, config);

		return config;
	}

	/**
	 * Load lifestyle costs configuration from plugin directory
	 * Used by UpkeepManager for daily party upkeep calculations
	 */
	async loadLifestyleCosts(): Promise<UpkeepCostConfig | null> {
		// Check cache first
		const cacheKey = 'lifestyleCosts';
		if (this.configCache.has(cacheKey)) {
			return this.configCache.get(cacheKey);
		}

		// Load from file
		const config = await this.loadYamlFile('lifestyleCosts.yaml');

		// Cache the result (even if null)
		this.configCache.set(cacheKey, config);

		return config;
	}

	/**
	 * Load currency configuration from plugin directory
	 * Used for currency conversion and formatting throughout the app
	 */
	async loadCurrencyConfig(): Promise<import('@quartermaster/core/models/currency-config').CurrencyConfig | null> {
		// Check cache first
		const cacheKey = 'currencyConfig';
		if (this.configCache.has(cacheKey)) {
			return this.configCache.get(cacheKey);
		}

		// Load from file
		const config = await this.loadYamlFile('currencies.yaml');

		if (!config) {
			this.configCache.set(cacheKey, null);
			return null;
		}

		// Validate that defaultSystem exists in systems
		if (!config.defaultSystem || !config.systems || !config.systems[config.defaultSystem]) {
			console.error('ObsidianConfigAdapter: Invalid currency config structure. defaultSystem:', config.defaultSystem, 'Available systems:', config.systems ? Object.keys(config.systems) : 'none');
			this.configCache.set(cacheKey, null);
			return null;
		}

		// Cache the result
		this.configCache.set(cacheKey, config);

		return config;
	}

	/**
	 * Load renown ladders configuration from plugin directory
	 * Used by renown system for rank progression
	 */
	async loadRenownLadders(): Promise<any> {
		// Check cache first
		const cacheKey = 'renownLadders';
		if (this.configCache.has(cacheKey)) {
			return this.configCache.get(cacheKey);
		}

		// Load from file
		const config = await this.loadYamlFile('renownLadders.yaml');

		// Cache the result (even if null)
		this.configCache.set(cacheKey, config);

		return config;
	}

	/**
	 * Load base stock configuration from plugin directory
	 */
	async loadBaseStockConfig(): Promise<any> {
		// Check cache first
		const cacheKey = 'baseStockConfig';
		if (this.configCache.has(cacheKey)) {
			return this.configCache.get(cacheKey);
		}

		// Load from file
		const config = await this.loadYamlFile('baseStockConfig.yaml');

		// Cache the result (even if null)
		this.configCache.set(cacheKey, config);

		return config;
	}

	/**
	 * Load a specific named template by name
	 * Templates are stored in /config/templates/{name}.yaml
	 */
	async loadTemplateByName(name: string): Promise<CustomTemplate | null> {
		return await this.loadYamlFile(`templates/${name}.yaml`);
	}

	/**
	 * Get all available custom templates
	 * Scans /config/templates/ directory for .yaml files
	 */
	async getAvailableTemplates(): Promise<CustomTemplate[]> {
		try {
			const templatesDir = `${this.plugin.manifest.dir}/config/templates`;

			// Check if templates directory exists
			const exists = await this.app.vault.adapter.exists(templatesDir);
			if (!exists) {
				// Create templates directory if it doesn't exist
				await this.app.vault.adapter.mkdir(templatesDir);
				return [];
			}

			// List all files in templates directory
			const files = await this.app.vault.adapter.list(templatesDir);

			// Filter for .yaml files and load them
			const templates: CustomTemplate[] = [];
			for (const file of files.files) {
				if (file.endsWith('.yaml')) {
					const filename = file.split('/').pop()?.replace('.yaml', '') || '';
					const template = await this.loadTemplateByName(filename);
					if (template) {
						templates.push(template);
					}
				}
			}

			return templates;
		} catch (error) {
			console.error('ObsidianConfigAdapter: Error listing templates:', error);
			return [];
		}
	}

	/**
	 * Save a named custom template to /config/templates/{name}.yaml
	 */
	async saveNamedTemplate(template: CustomTemplate): Promise<void> {
		try {
			// Ensure templates directory exists
			const templatesDir = `${this.plugin.manifest.dir}/config/templates`;
			const exists = await this.app.vault.adapter.exists(templatesDir);
			if (!exists) {
				await this.app.vault.adapter.mkdir(templatesDir);
			}

			// Save template
			const yamlContent = yaml.dump(template, { indent: 2, lineWidth: -1 });
			const fullPath = `${templatesDir}/${template.name}.yaml`;
			await this.app.vault.adapter.write(fullPath, yamlContent);
		} catch (error) {
			console.error(`ObsidianConfigAdapter: Error saving template ${template.name}:`, error);
			throw error;
		}
	}

	/**
	 * Delete a named custom template
	 */
	async deleteNamedTemplate(name: string): Promise<void> {
		try {
			const fullPath = `${this.plugin.manifest.dir}/config/templates/${name}.yaml`;
			const exists = await this.app.vault.adapter.exists(fullPath);
			if (exists) {
				await this.app.vault.adapter.remove(fullPath);
			}
		} catch (error) {
			console.error(`ObsidianConfigAdapter: Error deleting template ${name}:`, error);
			throw error;
		}
	}

	/**
	 * @deprecated Use saveNamedTemplate() instead
	 * Save custom shop templates to plugin directory
	 * @param templates Templates data to save
	 */
	async saveCustomTemplates(templates: RawCustomTemplatesConfig): Promise<void> {
		const yamlContent = yaml.dump(templates, { indent: 2, lineWidth: -1 });
		const fullPath = this.getFullPath('customShopTemplates.yaml');
		await this.app.vault.adapter.write(fullPath, yamlContent);
	}

	/**
	 * Check if a config file exists in the plugin directory
	 * @param filename Config filename
	 */
	async configExists(filename: string): Promise<boolean> {
		const fullPath = this.getFullPath(filename);
		return await this.app.vault.adapter.exists(fullPath);
	}

	/**
	 * Get the base path for configuration files
	 * @returns Path to plugin's config directory
	 */
	getConfigPath(): string {
		return `${this.plugin.manifest.dir}/config`;
	}

	/**
	 * Load and parse a YAML file from the plugin's config directory
	 * @private
	 * @param filename Name of the config file (e.g., 'shopConfig.yaml')
	 * @returns Parsed YAML content or null if file not found/error
	 */
	private async loadYamlFile(filename: string): Promise<any> {
		try {
			const fullPath = this.getFullPath(filename);

			// Check if file exists
			const exists = await this.app.vault.adapter.exists(fullPath);
			if (!exists) {
				// Don't log error for missing files - they might be optional
				// Caller can decide how to handle null return
				return null;
			}

			// Read file content
			const content = await this.app.vault.adapter.read(fullPath);

			// Parse YAML
			const parsed = yaml.load(content);
			return parsed;
		} catch (error) {
			console.error(`ObsidianConfigAdapter: Error loading ${filename}:`, error);
			return null;
		}
	}

	/**
	 * Get full path to a config file
	 * @private
	 * @param filename Config filename
	 * @returns Full path in plugin directory
	 */
	private getFullPath(filename: string): string {
		const pluginDir = this.plugin.manifest.dir;
		return `${pluginDir}/config/${filename}`;
	}

	/**
	 * Teardown adapter resources for campaign switching
	 * Clears config cache to ensure fresh configs are loaded for new campaign
	 */
	async teardown(): Promise<void> {
		console.log('[ObsidianConfigAdapter] Beginning teardown...');
		this.configCache.clear();
		console.log('[ObsidianConfigAdapter] Config cache cleared, teardown complete');
	}
}
