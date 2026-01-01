/**
 * Currency Configuration System
 * Defines TypeScript types for a flexible, configuration-driven currency system
 * that supports multiple currency systems (D&D 5e standard, custom worlds, etc.)
 */

/**
 * WeightStrategy determines how weight is assigned to currency denominations
 * - 'constant': All coins have the same weight (specified in weightSettings.constantValue)
 * - 'variable': Each denomination has its own weight (specified in CurrencyDenomination.weight)
 */
export type WeightStrategy = 'constant' | 'variable';

/**
 * SymbolPosition determines where the currency symbol appears in formatted output
 * - 'prefix': Currency symbol appears before the amount (e.g., "$10")
 * - 'suffix': Currency symbol appears after the amount (e.g., "10 gp")
 */
export type SymbolPosition = 'prefix' | 'suffix';

/**
 * CurrencyFormatting defines how currency values are displayed to the user
 * Controls separator, symbol placement, and zero value handling
 */
export interface CurrencyFormatting {
	/** Separator between denominations (e.g., ", " for "10 gp, 5 sp") */
	separator: string;

	/** Whether to show zero-valued denominations in output */
	showZero: boolean;

	/** Where the currency symbol appears relative to the amount */
	symbolPosition: SymbolPosition;
}

/**
 * CurrencyWeightConfig defines weight calculations for all denominations
 * Supports both uniform weight per coin and per-denomination weight variance
 */
export interface CurrencyWeightConfig {
	/** Weight calculation strategy: constant (all same) or variable (per denomination) */
	strategy: WeightStrategy;

	/**
	 * If strategy is 'constant', the weight in specified units per coin
	 * (e.g., 0.02 lbs per coin in D&D 5e standard)
	 * Ignored if strategy is 'variable'
	 */
	constantValue?: number;

	/** Display unit for weight (e.g., "lbs", "kg", "oz") */
	unit: string;
}

/**
 * CurrencyDenomination represents a single currency type within a system
 * Each denomination has a conversion rate relative to the base unit
 */
export interface CurrencyDenomination {
	/** Unique identifier for this denomination within its system (e.g., "gold", "credit") */
	id: string;

	/** Short abbreviation displayed in currency output (e.g., "gp", "sp", "cr") */
	abbreviation: string;

	/**
	 * Conversion multiplier to the base unit
	 * Base unit (typically copper or lowest denomination) = 1
	 * Examples in D&D 5e: cp=1, sp=10, gp=100, pp=1000
	 */
	conversionRate: number;

	/**
	 * Optional display symbol that may differ from abbreviation
	 * Examples: "$" for U.S. Dollar, "₤" for Pound, "Credits" for sci-fi currency
	 * If not provided, abbreviation is used for display
	 */
	symbol?: string;

	/**
	 * Sort order for display purposes
	 * Lower numbers appear first in formatted output
	 * Typically ordered from highest to lowest value (0=highest)
	 */
	order: number;

	/**
	 * Weight per coin if using variable weight strategy
	 * Specified in the unit defined in CurrencyWeightConfig
	 * Only used if CurrencyWeightConfig.strategy === 'variable'
	 */
	weight?: number;
}

/**
 * CurrencySystem represents a complete currency system with multiple denominations
 * Examples: D&D 5e standard (copper, silver, gold, platinum), custom fantasy world, sci-fi credits
 */
export interface CurrencySystem {
	/** Display name of the currency system (e.g., "D&D 5e Standard") */
	name: string;

	/** Formatting rules for displaying currency values */
	formatting: CurrencyFormatting;

	/** Weight calculation configuration for all denominations */
	weightSettings: CurrencyWeightConfig;

	/** Array of denominations in this system, should be ordered by value (highest first) */
	denominations: CurrencyDenomination[];

	/**
	 * Abbreviation of the base denomination (lowest value)
	 * Used for internal calculations and conversions
	 * Examples: "cp" (copper in D&D), "cr" (credit in sci-fi system)
	 */
	baseUnit: string;
}

/**
 * CurrencyConfig is the root configuration object for the entire currency system
 * Defines all available currency systems and which one is currently active
 */
export interface CurrencyConfig {
	/**
	 * Map of system ID to system definition
	 * Allows multiple currency systems to be defined and swapped
	 * Examples: { "dnd5e": {...}, "custom-world": {...}, "sci-fi": {...} }
	 */
	systems: Record<string, CurrencySystem>;

	/**
	 * Active currency system key
	 * Must be a key that exists in the systems Record
	 * Examples: "dnd5e", "custom-world"
	 */
	defaultSystem: string;
}
