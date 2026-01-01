// Config Adapter Interface
// Abstracts configuration file I/O operations for platform independence

import { ShopGenerationConfig, Faction } from '../models/types';
import { Service, LootTable } from './IDataAdapter';

/**
 * Raw YAML configuration data structures
 * These are the unprocessed configs directly from YAML files
 */
export interface RawShopConfig {
	shops: {
		[shopType: string]: {
			[wealthLevel: string]: any;
		};
	};
}

export interface RawServicesConfig {
	[shopType: string]: Service[];
}

export interface RawFactionsConfig {
	factions: Faction[];
}

export interface RawLootTablesConfig {
	tables?: LootTable[];
	individual?: any;
	hoard?: any;
	rewards?: any;
	special?: any;
}

/**
 * Named custom template structure (new format)
 * Each template is stored in a separate YAML file
 */
export interface CustomTemplate {
	name: string;  // User-defined template name
	shopType: string;  // Which shop type this template applies to
	description?: string;  // Optional description
	wealthLevels: {
		[wealthLevel: string]: Partial<ShopGenerationConfig>;
	};
}

/**
 * @deprecated Old custom templates format - kept for reference only
 * New system uses individual CustomTemplate files
 */
export interface RawCustomTemplatesConfig {
	templates: {
		[shopType: string]: {
			[wealthLevel: string]: Partial<ShopGenerationConfig>;
		};
	};
}

export interface RawShopkeepConfig {
	names: {
		male: string[];
		female: string[];
		neutral: string[];
	};
	surnames: string[];
	genders: string[];
	species: {
		tier1: Array<{ name: string; weight: number }>;
		tier2: Array<{ name: string; weight: number }>;
		tier3: Array<{ name: string; weight: number }>;
		tier4: Array<{ name: string; weight: number }>;
	};
	dispositions: Array<{
		type: string;
		weight: number;
		description: string;
		dc: number;
	}>;
	quirks: string[];
	motivations: string[];
}

export interface BaseStockItem {
	item: string;
	minStock: number;
	maxStock: number;
	spawnChance: number;
}

export interface RawBaseStockConfig {
	[shopType: string]: {
		[wealthLevel: string]: BaseStockItem[];
	};
}

/**
 * Raw calendar configuration from YAML (Phase 3+)
 */
export interface RawCalendarConfig {
	calendars: import('../models/types').CalendarDefinition[];
}

/**
 * Interface for configuration file I/O operations
 * Implementations handle reading/writing YAML configs from different sources
 *
 * Implementations:
 * - ObsidianConfigAdapter: Reads from plugin directory (Phase 1)
 * - FileSystemConfigAdapter: Reads from filesystem (Phase 2+)
 * - DatabaseConfigAdapter: Reads from database (Phase 6+)
 */
export interface IConfigAdapter {
	/**
	 * Load shop configuration YAML
	 * @returns Parsed shop config or null if not found
	 */
	loadShopConfig(): Promise<RawShopConfig | null>;

	/**
	 * Load services configuration YAML
	 * @returns Parsed services config or null if not found
	 */
	loadServicesConfig(): Promise<RawServicesConfig | null>;

	/**
	 * Load factions configuration YAML
	 * @returns Parsed factions config or null if not found
	 */
	loadFactionsConfig(): Promise<RawFactionsConfig | null>;

	/**
	 * Load loot tables configuration YAML
	 * @returns Parsed loot tables config or null if not found
	 */
	loadLootTablesConfig(): Promise<RawLootTablesConfig | null>;

	/**
	 * @deprecated Use loadTemplateByName() instead
	 * Load custom shop templates YAML (old format)
	 * @returns Parsed templates config or null if not found
	 */
	loadCustomTemplates(): Promise<RawCustomTemplatesConfig | null>;

	/**
	 * Load a specific named template by name
	 * @param name Template name (filename without .yaml extension)
	 * @returns Parsed template or null if not found
	 */
	loadTemplateByName(name: string): Promise<CustomTemplate | null>;

	/**
	 * Get all available custom templates
	 * @returns Array of all custom templates
	 */
	getAvailableTemplates(): Promise<CustomTemplate[]>;

	/**
	 * Save a named custom template to YAML
	 * @param template Template data to save
	 */
	saveNamedTemplate(template: CustomTemplate): Promise<void>;

	/**
	 * Delete a named custom template
	 * @param name Template name to delete
	 */
	deleteNamedTemplate(name: string): Promise<void>;

	/**
	 * Load shopkeeper configuration YAML (Phase 4)
	 * @returns Parsed shopkeep config or null if not found
	 */
	loadShopkeepConfig(): Promise<RawShopkeepConfig | null>;

	/**
	 * Load base stock configuration YAML
	 * @returns Parsed base stock config or null if not found
	 */
	loadBaseStockConfig(): Promise<RawBaseStockConfig | null>;

	/**
	 * Load calendar definitions from config files (Phase 3+)
	 * @returns Calendar definitions config or null if not found
	 */
	loadCalendarDefinitions(): Promise<RawCalendarConfig | null>;

	/**
	 * Load lifestyle costs configuration (D&D 5e upkeep costs) (Phase 4+)
	 * @returns Lifestyle costs config or null if not found
	 */
	loadLifestyleCosts(): Promise<import('../models/types').UpkeepCostConfig | null>;

	/**
	 * @deprecated Use saveNamedTemplate() instead
	 * Save custom shop templates to YAML (old format)
	 * @param templates Templates data to save
	 */
	saveCustomTemplates(templates: RawCustomTemplatesConfig): Promise<void>;

	/**
	 * Check if a config file exists
	 * @param filename Config filename (e.g., 'shopConfig.yaml')
	 * @returns True if file exists
	 */
	configExists(filename: string): Promise<boolean>;

	/**
	 * Get the base path for configuration files
	 * Used for auto-copy operations
	 * @returns Path to config directory
	 */
	getConfigPath(): string;
}
