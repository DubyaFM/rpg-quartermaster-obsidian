/**
 * CurrencyManager - Gatekeeper for currency operations
 *
 * Validates currency objects against the active currency configuration,
 * ensuring only valid denomination keys can enter the system.
 *
 * @example
 * // Create manager from config
 * const config: CurrencyConfig = {
 *   systems: {
 *     'dnd5e': {
 *       name: 'D&D 5e Standard',
 *       baseUnit: 'cp',
 *       denominations: [
 *         { id: 'platinum', abbreviation: 'pp', conversionRate: 1000, order: 0 },
 *         { id: 'gold', abbreviation: 'gp', conversionRate: 100, order: 1 },
 *         { id: 'silver', abbreviation: 'sp', conversionRate: 10, order: 2 },
 *         { id: 'copper', abbreviation: 'cp', conversionRate: 1, order: 3 },
 *       ],
 *       formatting: { separator: ', ', showZero: false, symbolPosition: 'suffix' },
 *       weightSettings: { strategy: 'constant', constantValue: 0.02, unit: 'lbs' }
 *     }
 *   },
 *   defaultSystem: 'dnd5e'
 * };
 *
 * const manager = new CurrencyManager(config);
 *
 * // Validate and clean cost object
 * const cost = { pp: 1, gp: 50, sp: 0, cp: 5, invalid: 999 };
 * const cleaned = manager.validate(cost);  // { pp: 1, gp: 50, sp: 0, cp: 5 }
 *
 * // Get valid denomination keys
 * const keys = manager.getDenominationKeys();  // ['pp', 'gp', 'sp', 'cp']
 *
 * // Get base unit (for copper conversions)
 * const base = manager.getBaseUnit();  // 'cp'
 *
 * // Create zeroed cost object
 * const zero = manager.createZeroedCost();  // { pp: 0, gp: 0, sp: 0, cp: 0 }
 */

import { CurrencyConfig, CurrencySystem, CurrencyDenomination } from '../models/currency-config.js';
import { ItemCost } from '../models/types.js';

export class CurrencyManager {
	private system: CurrencySystem;

	/**
	 * Initializes the CurrencyManager with a configuration
	 *
	 * @param config The currency configuration containing system definitions
	 * @throws Error if defaultSystem does not exist in systems
	 */
	constructor(private config: CurrencyConfig) {
		const system = config.systems[config.defaultSystem];
		if (!system) {
			throw new Error(`Currency system "${config.defaultSystem}" not found in configuration`);
		}
		this.system = system;
	}

	/**
	 * Returns array of valid denomination abbreviations
	 *
	 * Extracts abbreviations from the configured denominations
	 * and returns them in the order defined.
	 *
	 * @returns Array of valid abbreviations (e.g., ['pp', 'gp', 'sp', 'cp'])
	 *
	 * @example
	 * manager.getDenominationKeys();  // ['pp', 'gp', 'sp', 'cp']
	 */
	getDenominationKeys(): string[] {
		return this.system.denominations.map(d => d.abbreviation);
	}

	/**
	 * Returns array of denominations sorted by order (highest value first)
	 *
	 * Creates a copy of denominations sorted by their order field.
	 * Lower order values appear first (typically highest currency value first).
	 *
	 * @returns Sorted copy of denominations
	 *
	 * @example
	 * manager.getSortedDenominations();
	 * // Returns: [
	 * //   { id: 'platinum', abbreviation: 'pp', order: 0, ... },
	 * //   { id: 'gold', abbreviation: 'gp', order: 1, ... },
	 * //   ...
	 * // ]
	 */
	getSortedDenominations(): CurrencyDenomination[] {
		return [...this.system.denominations].sort((a, b) => a.order - b.order);
	}

	/**
	 * Validates cost object and returns cleaned version with only valid keys
	 *
	 * Strips any invalid keys from the cost object that don't match
	 * the configured denominations. Logs warnings for stripped keys.
	 * Handles null/undefined by returning a zeroed cost object.
	 *
	 * @param cost The cost object to validate
	 * @returns Cleaned cost object with only valid denomination keys
	 *
	 * @example
	 * const cost = { pp: 1, gp: 50, invalid: 999 };
	 * const cleaned = manager.validate(cost);
	 * // Returns: { pp: 1, gp: 50, sp: 0, cp: 0 }
	 * // Logs: "Invalid currency key removed: invalid"
	 */
	validate(cost: ItemCost | null | undefined): ItemCost {
		// Handle null/undefined cost
		if (!cost) {
			return this.createZeroedCost();
		}

		const validKeys = this.getDenominationKeys();
		const cleaned: ItemCost = {} as ItemCost;

		// Process each key in the input cost
		for (const key in cost) {
			if (validKeys.includes(key)) {
				// Keep valid keys
				cleaned[key as keyof ItemCost] = cost[key as keyof ItemCost];
			} else {
				// Log warning for invalid keys
				console.warn(`[CurrencyManager] Invalid currency key removed: "${key}"`);
			}
		}

		// Ensure all valid keys are present (fill missing with 0)
		for (const key of validKeys) {
			if (!(key in cleaned)) {
				cleaned[key as keyof ItemCost] = 0;
			}
		}

		return cleaned;
	}

	/**
	 * Creates a zeroed cost object with all valid denominations set to 0
	 *
	 * Useful for initializing empty cost objects or resetting costs
	 * to match the current currency system configuration.
	 *
	 * @returns Cost object with all denominations set to 0
	 *
	 * @example
	 * manager.createZeroedCost();  // { pp: 0, gp: 0, sp: 0, cp: 0 }
	 */
	createZeroedCost(): ItemCost {
		const zeroed: ItemCost = {} as ItemCost;
		for (const key of this.getDenominationKeys()) {
			zeroed[key as keyof ItemCost] = 0;
		}
		return zeroed;
	}

	/**
	 * Gets the base unit abbreviation
	 *
	 * The base unit is the lowest denomination used for internal
	 * calculations and conversions (e.g., "cp" for copper in D&D 5e).
	 *
	 * @returns Base unit abbreviation (e.g., "cp")
	 *
	 * @example
	 * manager.getBaseUnit();  // 'cp'
	 */
	getBaseUnit(): string {
		return this.system.baseUnit;
	}

	/**
	 * Gets the currency system being managed
	 *
	 * Returns the active CurrencySystem object with all configuration
	 * including denominations, formatting, and weight settings.
	 *
	 * @returns The active currency system
	 *
	 * @example
	 * const system = manager.getSystem();
	 * console.log(system.name);  // 'D&D 5e Standard'
	 * console.log(system.denominations.length);  // 4
	 */
	getSystem(): CurrencySystem {
		return this.system;
	}
}

export default CurrencyManager;
