/**
 * Currency System Models - World-level currency definitions
 *
 * Defines currency systems at the world level that can be inherited by campaigns.
 * This provides a simpler, more focused model compared to currency-config.ts,
 * specifically designed for world-level configuration in the campaign switching system.
 *
 * Key differences from currency-config.ts:
 * - Focused on world-level presets and basic denomination structure
 * - Simpler model without formatting rules or weight strategies
 * - Designed for campaign inheritance via world.currencySystemId
 * - Used by World entities to define their monetary systems
 */

/**
 * Currency denomination definition
 *
 * Represents a single currency type (e.g., gold piece, silver piece)
 * with its basic properties and conversion rate to the base unit.
 */
export interface CurrencyDenomination {
	/** Short code for this denomination (e.g., "gp", "sp", "cp") */
	code: string;

	/** Human-readable name (e.g., "Gold Piece", "Silver Piece") */
	name: string;

	/**
	 * Conversion rate relative to the base denomination
	 * Base denomination has value 1, others are multiples or fractions
	 * Examples in D&D 5e (base = gp):
	 * - pp: 10 (1 platinum = 10 gold)
	 * - gp: 1 (base)
	 * - ep: 0.5 (1 electrum = 0.5 gold)
	 * - sp: 0.1 (1 silver = 0.1 gold)
	 * - cp: 0.01 (1 copper = 0.01 gold)
	 */
	valueInBase: number;

	/**
	 * Weight of a single coin in pounds
	 * Standard D&D 5e weight is 0.02 lbs per coin (50 coins = 1 lb)
	 */
	weight: number;
}

/**
 * Currency system definition
 *
 * Represents a complete monetary system with multiple denominations.
 * Used at the world level to define the currency standard for that setting.
 */
export interface CurrencySystem {
	/**
	 * Unique identifier for this currency system
	 * Examples: "dnd5e-standard", "star-wars-credits", "pathfinder-standard"
	 */
	id: string;

	/**
	 * Human-readable name for this currency system
	 * Examples: "D&D 5e Standard", "Star Wars Credits", "Pathfinder Standard"
	 */
	name: string;

	/**
	 * Array of denominations in this currency system
	 * Should be ordered from highest to lowest value by convention
	 */
	denominations: CurrencyDenomination[];

	/**
	 * Code of the default/base denomination
	 * This is the denomination used for pricing and base conversions
	 * Examples: "gp" (D&D gold standard), "cr" (credits), "sp" (silver standard)
	 */
	defaultDenomination: string;
}

/**
 * Preset currency systems shipped with the application
 *
 * These are official currency presets that come pre-configured
 * for common game systems. Users can also create custom currency systems.
 */
export const PRESET_CURRENCY_SYSTEMS: CurrencySystem[] = [
	{
		id: 'dnd5e-standard',
		name: 'D&D 5e Standard',
		denominations: [
			{ code: 'pp', name: 'Platinum', valueInBase: 10, weight: 0.02 },
			{ code: 'gp', name: 'Gold', valueInBase: 1, weight: 0.02 },
			{ code: 'ep', name: 'Electrum', valueInBase: 0.5, weight: 0.02 },
			{ code: 'sp', name: 'Silver', valueInBase: 0.1, weight: 0.02 },
			{ code: 'cp', name: 'Copper', valueInBase: 0.01, weight: 0.02 }
		],
		defaultDenomination: 'gp'
	},
	{
		id: 'dnd5e-silver-standard',
		name: 'D&D 5e Silver Standard',
		denominations: [
			{ code: 'pp', name: 'Platinum', valueInBase: 100, weight: 0.02 },
			{ code: 'gp', name: 'Gold', valueInBase: 10, weight: 0.02 },
			{ code: 'ep', name: 'Electrum', valueInBase: 5, weight: 0.02 },
			{ code: 'sp', name: 'Silver', valueInBase: 1, weight: 0.02 },
			{ code: 'cp', name: 'Copper', valueInBase: 0.1, weight: 0.02 }
		],
		defaultDenomination: 'sp'
	},
	{
		id: 'pathfinder-standard',
		name: 'Pathfinder Standard',
		denominations: [
			{ code: 'pp', name: 'Platinum', valueInBase: 10, weight: 0.02 },
			{ code: 'gp', name: 'Gold', valueInBase: 1, weight: 0.02 },
			{ code: 'sp', name: 'Silver', valueInBase: 0.1, weight: 0.02 },
			{ code: 'cp', name: 'Copper', valueInBase: 0.01, weight: 0.02 }
		],
		defaultDenomination: 'gp'
	},
	{
		id: 'star-wars-credits',
		name: 'Star Wars Credits',
		denominations: [
			{ code: 'cr', name: 'Credit', valueInBase: 1, weight: 0 }
		],
		defaultDenomination: 'cr'
	},
	{
		id: 'modern-usd',
		name: 'Modern USD',
		denominations: [
			{ code: 'dollar', name: 'Dollar', valueInBase: 1, weight: 0 },
			{ code: 'cent', name: 'Cent', valueInBase: 0.01, weight: 0 }
		],
		defaultDenomination: 'dollar'
	}
];
