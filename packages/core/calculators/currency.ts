// Currency parsing and conversion utilities
import { ItemCost, Currency } from '../models/types';
import type { CurrencyConfig } from '../models/currency-config';
import CurrencyManager from '../services/CurrencyManager.js'; // Used in convertFromBaseUnit

/**
 * Parse a cost string like "25 gp", "1 pp 5 gp 3 sp", "50 gold", etc.
 * Dynamically generates regex patterns based on the provided currency configuration.
 * Returns null for invalid input including negative amounts.
 *
 * @param costStr - The cost string to parse
 * @param config - Currency configuration defining denominations and their abbreviations
 * @returns Parsed cost object, or null if input is invalid
 *
 * @example
 * // D&D 5e config
 * const config: CurrencyConfig = { ... };
 * const cost = parseCostString('25 gp', config);  // { pp: 0, gp: 25, sp: 0, cp: 0 }
 * const cost2 = parseCostString('1 platinum 5 gold', config);  // { pp: 1, gp: 5, sp: 0, cp: 0 }
 */
export function parseCostString(costStr: string, config: CurrencyConfig): ItemCost | null {
	if (!costStr || costStr.trim() === '' || costStr.includes('-')) {
		return null;  // Reject empty or negative amounts
	}

	const manager = new CurrencyManager(config);
	const cost = manager.createZeroedCost();
	let hasValidCost = false;

	// Generate patterns dynamically from config
	const system = config.systems[config.defaultSystem];
	if (!system) {
		console.error(`Currency system "${config.defaultSystem}" not found in configuration`);
		return null;
	}

	const patterns = system.denominations.map(denom => {
		// Create regex pattern matching abbreviation and full id (case-insensitive)
		// Example: for { id: "gold", abbreviation: "gp" } → /(\d+)\s*(gp|gold)/gi
		const pattern = new RegExp(`(\\d+)\\s*(${denom.abbreviation}|${denom.id})`, 'gi');
		return {
			regex: pattern,
			abbreviation: denom.abbreviation
		};
	});

	// Match and accumulate amounts for each denomination
	for (const pattern of patterns) {
		const matches = [...costStr.matchAll(pattern.regex)];
		for (const match of matches) {
			const amount = parseInt(match[1]);
			if (!isNaN(amount) && amount >= 0) {
				cost[pattern.abbreviation as keyof ItemCost] += amount;
				hasValidCost = true;
			}
		}
	}

	// If no specific currency found, try to parse as just a number and assume base unit
	if (!hasValidCost) {
		const numberMatch = costStr.match(/(\d+)/);
		if (numberMatch) {
			const amount = parseInt(numberMatch[1]);
			if (!isNaN(amount) && amount >= 0) {
				const baseUnit = manager.getBaseUnit();
				cost[baseUnit as keyof ItemCost] = amount;
				hasValidCost = true;
			}
		}
	}

	// Validate and clean the result
	const validated = manager.validate(hasValidCost ? cost : null);
	return hasValidCost ? validated : null;
}

/**
 * Convert any currency amount to the base unit using dynamic denomination configuration.
 * Loops through configured denominations and multiplies each by its conversion rate.
 * This replaces the hardcoded convertToCopper function to support any currency system.
 *
 * @param cost - Currency amount in multiple denominations
 * @param config - Currency configuration containing denomination conversion rates
 * @returns Total amount in base units (e.g., copper for D&D 5e)
 * @throws Error if currency system is not found in configuration
 *
 * @example
 * const config: CurrencyConfig = {
 *   systems: {
 *     'dnd5e': {
 *       denominations: [
 *         { abbreviation: 'pp', conversionRate: 1000, ... },
 *         { abbreviation: 'gp', conversionRate: 100, ... },
 *         { abbreviation: 'sp', conversionRate: 10, ... },
 *         { abbreviation: 'cp', conversionRate: 1, ... }
 *       ],
 *       ...
 *     }
 *   },
 *   defaultSystem: 'dnd5e'
 * };
 * const baseAmount = convertToBaseUnit({ pp: 1, gp: 50, sp: 0, cp: 5 }, config);  // 1050 (in copper)
 */
export function convertToBaseUnit(cost: ItemCost, config: CurrencyConfig): number {
	const system = config.systems[config.defaultSystem];
	if (!system) {
		throw new Error(`Currency system "${config.defaultSystem}" not found in configuration`);
	}

	let total = 0;
	for (const denomination of system.denominations) {
		const abbreviation = denomination.abbreviation;
		const amount = cost[abbreviation] || 0;
		total += amount * denomination.conversionRate;
	}

	return total;
}

/**
 * Convert a base unit amount back to a multi-denomination currency object.
 * Uses the configured denominations sorted by order (highest value first).
 * Distributes the amount across denominations from highest to lowest.
 * This replaces the hardcoded convertFromCopper function to support any currency system.
 *
 * Uses Math.floor for conversions, which truncates fractional amounts.
 * Example: 2.5 copper becomes 2 copper (rounds down).
 *
 * @param baseAmount - Total amount in base units (e.g., copper for D&D 5e)
 * @param config - Currency configuration containing denomination conversion rates
 * @returns ItemCost object with amounts distributed across denominations
 * @throws Error if currency system is not found in configuration
 *
 * @example
 * const config: CurrencyConfig = { ... }; // See convertToBaseUnit example
 * const cost = convertFromBaseUnit(1050, config);  // { pp: 1, gp: 5, sp: 0, cp: 0 }
 */
export function convertFromBaseUnit(baseAmount: number, config: CurrencyConfig): ItemCost {
	const manager = new CurrencyManager(config);
	const result = manager.createZeroedCost();
	const denominations = manager.getSortedDenominations();

	let remaining = baseAmount;

	// Distribute from highest to lowest denomination
	for (const denomination of denominations) {
		const abbreviation = denomination.abbreviation;
		const conversionRate = denomination.conversionRate;

		result[abbreviation] = Math.floor(remaining / conversionRate);
		remaining %= conversionRate;
	}

	return manager.validate(result);
}

/**
 * @deprecated Use convertToBaseUnit instead. This function is hardcoded for D&D 5e.
 * Kept for backward compatibility during transition to dynamic currency systems.
 *
 * @param cost - Currency amount in D&D 5e denominations (cp, sp, gp, pp)
 * @returns Total amount in copper pieces
 */
export function convertToCopper(cost: ItemCost): number {
	return cost.cp + (cost.sp * 10) + (cost.gp * 100) + (cost.pp * 1000);
}

/**
 * @deprecated Use convertFromBaseUnit instead. This function is hardcoded for D&D 5e.
 * Kept for backward compatibility during transition to dynamic currency systems.
 *
 * @param copperAmount - Total amount in copper pieces
 * @returns ItemCost object with amounts in D&D 5e denominations (cp, sp, gp, pp)
 */
export function convertFromCopper(copperAmount: number): ItemCost {
	const result: ItemCost = { cp: 0, sp: 0, gp: 0, pp: 0 };

	result.pp = Math.floor(copperAmount / 1000);
	copperAmount %= 1000;

	result.gp = Math.floor(copperAmount / 100);
	copperAmount %= 100;

	result.sp = Math.floor(copperAmount / 10);
	result.cp = copperAmount % 10;

	return result;
}

/**
 * Format a currency object as a readable string using configuration-driven rules.
 * Dynamically formats based on the active currency system's denominations and formatting rules.
 *
 * @param cost - The currency amount to format (keys should match denomination abbreviations)
 * @param config - Currency configuration defining the active system and formatting rules
 * @returns Formatted currency string
 *
 * @example
 * // D&D 5e style (suffix, comma-separated, no zeros)
 * formatCurrency({ cp: 3, sp: 15, gp: 2, pp: 0 }, dnd5eConfig)
 * // Returns: "2 pp, 15 gp, 3 sp"
 *
 * @example
 * // Credits style (suffix, single denomination)
 * formatCurrency({ cr: 500 }, creditsConfig)
 * // Returns: "500 cr"
 *
 * @example
 * // Dollar style (prefix symbol)
 * formatCurrency({ usd: 250 }, dollarConfig)
 * // Returns: "$250"
 *
 * @example
 * // All zeros returns base unit
 * formatCurrency({ cp: 0, sp: 0, gp: 0, pp: 0 }, dnd5eConfig)
 * // Returns: "0 cp"
 */
export function formatCurrency(cost: ItemCost, config: CurrencyConfig): string {
	const system = config.systems[config.defaultSystem];
	if (!system) {
		throw new Error(`Currency system "${config.defaultSystem}" not found in config`);
	}

	const fmt = system.formatting;
	const parts: string[] = [];

	// Sort denominations by order (ascending, so lowest order appears first)
	const sortedDenominations = [...system.denominations].sort(
		(a, b) => a.order - b.order
	);

	for (const denom of sortedDenominations) {
		const amount = cost[denom.abbreviation] || 0;

		// Include if amount > 0, or if it's the only denomination and showZero is true
		if (amount > 0 || (amount === 0 && fmt.showZero && sortedDenominations.length === 1)) {
			// Use symbol if provided, otherwise use abbreviation
			const displayLabel = denom.symbol || denom.abbreviation;

			// Format based on symbol position
			let displayStr: string;
			if (fmt.symbolPosition === 'prefix') {
				displayStr = `${displayLabel}${amount}`;
			} else {
				// suffix
				displayStr = `${amount} ${displayLabel}`;
			}

			parts.push(displayStr);
		}
	}

	// If no parts, return "0 {baseUnit}"
	if (parts.length === 0) {
		const baseUnitDenom = system.denominations.find(d => d.abbreviation === system.baseUnit);
		if (baseUnitDenom) {
			const displayLabel = baseUnitDenom.symbol || baseUnitDenom.abbreviation;
			if (fmt.symbolPosition === 'prefix') {
				return `${displayLabel}0`;
			} else {
				return `0 ${displayLabel}`;
			}
		}
		// Fallback if base unit not found
		return '0';
	}

	return parts.join(fmt.separator);
}

/**
 * Add two currency amounts together using configuration-driven conversion
 * Converts both amounts to base units, adds them, then converts back to multi-denomination format.
 *
 * @param a - First currency amount
 * @param b - Second currency amount
 * @param config - Currency configuration defining conversion rates and denominations
 * @returns Sum of both currency amounts in multi-denomination format
 * @throws Error if currency system is not found in configuration
 *
 * @example
 * const config: CurrencyConfig = { ... }; // D&D 5e or custom config
 * const cost1 = { pp: 1, gp: 50, sp: 0, cp: 0 };
 * const cost2 = { pp: 0, gp: 25, sp: 5, cp: 0 };
 * const total = addCurrency(cost1, cost2, config);  // { pp: 1, gp: 75, sp: 5, cp: 0 }
 */
export function addCurrency(a: ItemCost, b: ItemCost, config: CurrencyConfig): ItemCost {
	const totalBase = convertToBaseUnit(a, config) + convertToBaseUnit(b, config);
	return convertFromBaseUnit(totalBase, config);
}

/**
 * Multiply a currency amount by a quantity using configuration-driven conversion.
 * Converts to base units, multiplies, then converts back with rounding.
 * Uses Math.round on the base unit total, which rounds to nearest integer.
 *
 * @param cost - The base currency amount
 * @param quantity - The multiplier (can be fractional)
 * @param config - Currency configuration defining conversion rates and denominations
 * @returns ItemCost object with multiplied amount
 * @throws Error if currency system is not found in configuration
 *
 * @example
 * const config: CurrencyConfig = { ... }; // D&D 5e or custom config
 * const cost = { pp: 1, gp: 50, sp: 0, cp: 0 };
 * const doubled = multiplyCurrency(cost, 2, config);  // { pp: 3, gp: 0, sp: 0, cp: 0 }
 * const partial = multiplyCurrency(cost, 1.5, config);  // Handles fractional multipliers
 */
export function multiplyCurrency(cost: ItemCost, quantity: number, config: CurrencyConfig): ItemCost {
	const totalInBase = Math.round(convertToBaseUnit(cost, config) * quantity);
	return convertFromBaseUnit(totalInBase, config);
}

/**
 * Subtract currency b from currency a using configuration-driven conversion.
 * Converts both amounts to base units, subtracts, then converts back.
 * Returns 0 if result would be negative (no negative currency), with a flag indicating underflow.
 *
 * @param a - Currency amount to subtract from
 * @param b - Currency amount to subtract
 * @param config - Currency configuration defining conversion rates and denominations
 * @returns Object containing the result and a flag indicating if the operation underflowed
 * @throws Error if currency system is not found in configuration
 *
 * @example
 * const config: CurrencyConfig = { ... }; // D&D 5e or custom config
 * const cost1 = { pp: 2, gp: 75, sp: 5, cp: 0 };
 * const cost2 = { pp: 1, gp: 50, sp: 0, cp: 0 };
 * const result = subtractCurrency(cost1, cost2, config);
 * // { result: { pp: 1, gp: 25, sp: 5, cp: 0 }, isNegative: false }
 */
export function subtractCurrency(a: ItemCost, b: ItemCost, config: CurrencyConfig): { result: ItemCost, isNegative: boolean } {
	const aInBase = convertToBaseUnit(a, config);
	const bInBase = convertToBaseUnit(b, config);
	const difference = aInBase - bInBase;

	return {
		result: difference >= 0 ? convertFromBaseUnit(difference, config) : convertFromBaseUnit(0, config),
		isNegative: difference < 0
	};
}

/**
 * Compare two currency amounts using configuration-driven conversion.
 * Converts both to base units and compares their numeric values.
 *
 * @param a - First currency amount to compare
 * @param b - Second currency amount to compare
 * @param config - Currency configuration defining conversion rates and denominations
 * @returns -1 if a < b, 0 if a === b, 1 if a > b
 * @throws Error if currency system is not found in configuration
 *
 * @example
 * const config: CurrencyConfig = { ... }; // D&D 5e or custom config
 * const cost1 = { pp: 1, gp: 50, sp: 0, cp: 0 };
 * const cost2 = { pp: 0, gp: 100, sp: 0, cp: 0 };
 * compareCurrency(cost1, cost2, config);  // -1 (cost1 < cost2)
 * compareCurrency(cost2, cost1, config);  // 1 (cost2 > cost1)
 * compareCurrency(cost1, { pp: 1, gp: 50, sp: 0, cp: 0 }, config);  // 0 (equal)
 */
export function compareCurrency(a: ItemCost, b: ItemCost, config: CurrencyConfig): number {
	const aInBase = convertToBaseUnit(a, config);
	const bInBase = convertToBaseUnit(b, config);

	if (aInBase < bInBase) return -1;
	if (aInBase > bInBase) return 1;
	return 0;
}

/**
 * Apply a discount percentage with smart rounding using configuration-driven logic.
 *
 * Dynamically determines rounding based on the highest non-zero denomination in the original cost.
 * For example, if price is in platinum (highest denomination), round to next lower denomination (gold).
 * If price is in the lowest denomination, use that denomination's conversion rate.
 *
 * Algorithm:
 * 1. Convert cost to base units
 * 2. Calculate discounted amount
 * 3. Find the highest non-zero denomination in the original cost
 * 4. Find the next lower denomination in the sorted denomination list
 * 5. Use that denomination's conversion rate as the rounding denominator
 * 6. Round down to the nearest denomination multiple
 * 7. Ensure minimum price of 1 base unit
 *
 * @param cost - Original cost
 * @param discountPercent - Discount percentage (e.g., 0.15 for 15%)
 * @param config - Currency configuration defining denominations and conversion rates
 * @returns Discounted cost with dynamic smart rounding
 * @throws Error if currency system is not found in configuration
 *
 * @example D&D 5e scenario
 * const config: CurrencyConfig = { ... }; // D&D 5e config
 * const cost = { pp: 1, gp: 0, sp: 0, cp: 0 };  // 1000 copper
 * const discounted = applySmartDiscount(cost, 0.15, config);
 * // Discounted: 850 copper → 8.5 gold
 * // Highest non-zero: platinum, next lower: gold (100 copper)
 * // Rounded: floor(850 / 100) * 100 = 800 copper = 8 gold
 * // Returns: { pp: 0, gp: 8, sp: 0, cp: 0 }
 */
export function applySmartDiscount(cost: ItemCost, discountPercent: number, config: CurrencyConfig): ItemCost {
	// Handle 0% discount - return original cost unchanged
	if (discountPercent === 0) {
		return cost;
	}

	const baseAmount = convertToBaseUnit(cost, config);
	const discountedBase = Math.floor(baseAmount * (1 - discountPercent));

	// Get sorted denominations (highest to lowest value/order)
	const manager = new CurrencyManager(config);
	const sortedDenominations = manager.getSortedDenominations();

	// Find the highest non-zero denomination in the original cost
	let highestDenomIndex = -1;
	for (let i = 0; i < sortedDenominations.length; i++) {
		const denom = sortedDenominations[i];
		if ((cost[denom.abbreviation] || 0) > 0) {
			highestDenomIndex = i;
			break;
		}
	}

	// Determine rounding denominator
	let roundingDenominator = 1; // Default to base unit (no rounding)

	// If we found a highest denomination and it's not the last (lowest) one, use the next lower
	if (highestDenomIndex >= 0 && highestDenomIndex < sortedDenominations.length - 1) {
		// Get the next lower denomination
		const nextLowerDenom = sortedDenominations[highestDenomIndex + 1];
		roundingDenominator = nextLowerDenom.conversionRate;
	}

	// Round down to the nearest denomination
	const roundedBase = Math.floor(discountedBase / roundingDenominator) * roundingDenominator;

	// Ensure at least 1 base unit
	return convertFromBaseUnit(Math.max(1, roundedBase), config);
}

/**
 * Calculates the total weight of currency based on the active currency system
 *
 * Supports two weight strategies:
 * - constant: All coins weigh the same (e.g., 0.02 lbs for D&D 5e = 50 coins/lb)
 * - variable: Each denomination has its own weight (e.g., heavy gold bars vs light copper)
 *
 * @param cost - Currency amount to weigh
 * @param config - Active currency configuration
 * @returns Total weight in the configured unit (e.g., "lbs", "kg")
 * @throws Error if currency system is not found in configuration
 *
 * @example D&D 5e (constant weight)
 * // 100 coins at 0.02 lbs each = 2 lbs total
 * calculateCurrencyWeight({ pp: 10, gp: 50, sp: 30, cp: 10 }, config) // 2.0
 *
 * @example Variable weight system
 * // Heavy bars (1.5 kg) and light coins (0.05 kg)
 * calculateCurrencyWeight({ bar: 10, coin: 100 }, config) // 20 kg
 */
export function calculateCurrencyWeight(cost: ItemCost, config: CurrencyConfig): number {
	const system = config.systems[config.defaultSystem];
	if (!system) {
		throw new Error(`Currency system "${config.defaultSystem}" not found in configuration`);
	}

	let totalWeight = 0;

	for (const denomination of system.denominations) {
		const abbreviation = denomination.abbreviation;
		const amount = cost[abbreviation] || 0;

		let weightPerUnit = 0;

		if (system.weightSettings.strategy === 'constant') {
			// All coins weigh the same value
			weightPerUnit = system.weightSettings.constantValue || 0;
		} else if (system.weightSettings.strategy === 'variable') {
			// Each denomination has its own weight
			weightPerUnit = denomination.weight || 0;
		}

		totalWeight += amount * weightPerUnit;
	}

	return totalWeight;
}

/**
 * Consolidates currency by converting lower denominations to higher ones
 *
 * Example: 1000 cp -> 10 gp (in D&D 5e where 100cp = 1gp)
 *
 * Algorithm:
 * 1. Convert entire amount to base units (copper for D&D 5e)
 * 2. Sort denominations from highest to lowest value (by order field)
 * 3. Distribute base units back, starting with highest denomination
 * 4. Remainder stays in base unit
 *
 * @param cost - Currency to consolidate
 * @param config - Active currency configuration
 * @returns Consolidated currency with highest denominations prioritized
 * @throws Error if currency system is not found in configuration
 *
 * @example D&D 5e consolidation
 * // Input: 1000 copper
 * consolidateCurrency({ cp: 1000, sp: 0, gp: 0, pp: 0 }, config)
 * // Output: { pp: 0, gp: 10, sp: 0, cp: 0 }
 *
 * @example With remainder
 * // Input: 1055 copper
 * consolidateCurrency({ cp: 1055, sp: 0, gp: 0, pp: 0 }, config)
 * // Output: { pp: 1, gp: 0, sp: 5, cp: 5 }
 *
 * @example Mixed denominations
 * // Input: 2 pp, 15 gp, 3 sp (= 2153 copper)
 * consolidateCurrency({ cp: 0, sp: 3, gp: 15, pp: 2 }, config)
 * // Output: { pp: 2, gp: 15, sp: 3, cp: 0 } (already consolidated)
 */
export function consolidateCurrency(cost: ItemCost, config: CurrencyConfig): ItemCost {
	// Convert to base unit (copper for D&D 5e)
	const totalBase = convertToBaseUnit(cost, config);

	// Create a manager to get sorted denominations and validate
	const manager = new CurrencyManager(config);
	const newCost = manager.createZeroedCost();

	// Get denominations sorted by conversion rate (highest first)
	const sortedDenominations = manager.getSortedDenominations();

	let remaining = totalBase;

	// Distribute from highest to lowest denomination
	for (const denom of sortedDenominations) {
		const abbreviation = denom.abbreviation;
		const conversionRate = denom.conversionRate;

		const amount = Math.floor(remaining / conversionRate);
		if (amount > 0) {
			newCost[abbreviation] = amount;
			remaining -= amount * conversionRate;
		}
	}

	// Validate and return
	return manager.validate(newCost);
}
