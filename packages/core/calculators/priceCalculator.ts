// Price Calculator - Apply price multipliers from world events
// Handles dynamic pricing based on EffectContext from WorldEventService

import { ItemCost, Item } from '../models/types';
import { ResolvedEffects } from '../models/effectTypes';
import { convertToBaseUnit, convertFromBaseUnit } from './currency';
import type { CurrencyConfig } from '../models/currency-config';

/**
 * Price Calculation Result
 * Contains the final price with multiplier breakdown for UI tooltips
 */
export interface PriceCalculationResult {
	/** Final calculated price after all multipliers */
	finalPrice: ItemCost;
	/** Global price multiplier applied (e.g., 1.5 for 50% increase) */
	globalMultiplier: number;
	/** Tag-specific multipliers applied (empty if none) */
	tagMultipliers: Record<string, number>;
	/** Combined effective multiplier (global × tag) */
	effectiveMultiplier: number;
	/** Whether any multipliers were applied */
	hasModifiers: boolean;
}

/**
 * Calculate final price for an item based on effect context
 *
 * Applies price multipliers from active world events:
 * 1. Global multiplier (price_mult_global) - affects all items
 * 2. Tag multipliers (price_mult_tag) - affects items matching tags
 * 3. Combined: finalPrice = basePrice × globalMult × tagMult
 *
 * CRITICAL: Never modifies the base price - always returns a new ItemCost object.
 * This prevents "price drift" where prices get permanently modified.
 *
 * @param basePrice - Original unmodified item price
 * @param item - Item to calculate price for (used for tag matching)
 * @param effectContext - Resolved effects from WorldEventService (optional)
 * @param currencyConfig - Currency configuration for conversion
 * @returns Price calculation result with final price and multiplier breakdown
 *
 * @example
 * // No effects - returns base price
 * const result = calculateFinalPrice(basePrice, item, null, config);
 * // result.finalPrice === basePrice
 * // result.effectiveMultiplier === 1.0
 *
 * @example
 * // With global multiplier (market day discount)
 * const effects = { price_mult_global: 0.8 }; // 20% discount
 * const result = calculateFinalPrice(basePrice, item, effects, config);
 * // result.finalPrice === basePrice * 0.8
 * // result.globalMultiplier === 0.8
 *
 * @example
 * // With tag multiplier (food price increase during famine)
 * const effects = { price_mult_tag: { food: 2.0 } };
 * const foodItem = { ...item, category: 'food' };
 * const result = calculateFinalPrice(basePrice, foodItem, effects, config);
 * // result.finalPrice === basePrice * 2.0
 * // result.tagMultipliers.food === 2.0
 *
 * @example
 * // Combined multipliers (global 1.2x increase + weapon 1.5x surcharge)
 * const effects = { price_mult_global: 1.2, price_mult_tag: { weapon: 1.5 } };
 * const weaponItem = { ...item, type: 'weapon' };
 * const result = calculateFinalPrice(basePrice, weaponItem, effects, config);
 * // result.finalPrice === basePrice * 1.2 * 1.5 = basePrice * 1.8
 * // result.effectiveMultiplier === 1.8
 */
export function calculateFinalPrice(
	basePrice: ItemCost,
	item: Item,
	effectContext: ResolvedEffects | null,
	currencyConfig: CurrencyConfig
): PriceCalculationResult {
	// Initialize result with no modifications
	let globalMultiplier = 1.0;
	const tagMultipliers: Record<string, number> = {};
	let effectiveMultiplier = 1.0;

	// Extract price multipliers from effect context
	if (effectContext) {
		// Apply global multiplier if present
		if (effectContext.price_mult_global !== undefined) {
			globalMultiplier = effectContext.price_mult_global;
			effectiveMultiplier *= globalMultiplier;
		}

		// Apply tag multipliers if present
		if (effectContext.price_mult_tag) {
			// Check item tags (type, category, rarity, custom tags)
			const itemTags = getItemTags(item);

			for (const tag of itemTags) {
				const tagMult = effectContext.price_mult_tag[tag];
				if (tagMult !== undefined) {
					tagMultipliers[tag] = tagMult;
					effectiveMultiplier *= tagMult;
				}
			}
		}
	}

	// Calculate final price (never modify base price)
	const finalPrice = multiplyItemCost(basePrice, effectiveMultiplier, currencyConfig);

	return {
		finalPrice,
		globalMultiplier,
		tagMultipliers,
		effectiveMultiplier,
		hasModifiers: effectiveMultiplier !== 1.0
	};
}

/**
 * Get all tags for an item that can be used for price multiplier matching
 *
 * Tags are extracted from:
 * - item.type (e.g., "weapon", "armor", "potion")
 * - item.category (e.g., "adventuring-gear", "food")
 * - item.rarity (e.g., "common", "rare", "legendary")
 * - item.tags (custom tags array if present)
 *
 * All tags are normalized to lowercase for case-insensitive matching.
 *
 * @param item - Item to extract tags from
 * @returns Array of normalized tag strings
 *
 * @example
 * const item = { type: 'weapon', category: 'martial', rarity: 'rare' };
 * const tags = getItemTags(item);
 * // ['weapon', 'martial', 'rare']
 */
export function getItemTags(item: Item): string[] {
	const tags: string[] = [];

	// Add type tag (always present)
	if (item.type) {
		tags.push(item.type.toLowerCase());
	}

	// Add category tag (if present)
	if (item.category) {
		tags.push(item.category.toLowerCase());
	}

	// Add rarity tag (if present)
	if (item.rarity) {
		tags.push(item.rarity.toLowerCase());
	}

	// Add custom tags (if present)
	if ((item as any).tags && Array.isArray((item as any).tags)) {
		for (const tag of (item as any).tags) {
			if (typeof tag === 'string') {
				tags.push(tag.toLowerCase());
			}
		}
	}

	return tags;
}

/**
 * Multiply an ItemCost by a multiplier
 *
 * Converts to base units, multiplies, then converts back to maintain precision.
 * Uses CurrencyManager for currency system abstraction.
 *
 * @param cost - Original cost to multiply
 * @param multiplier - Price multiplier (e.g., 1.5 for 50% increase, 0.8 for 20% discount)
 * @param config - Currency configuration
 * @returns New ItemCost object with multiplied value
 *
 * @example
 * // 100 gp × 1.5 = 150 gp
 * const cost = { cp: 0, sp: 0, gp: 100, pp: 0 };
 * const result = multiplyItemCost(cost, 1.5, config);
 * // result = { cp: 0, sp: 0, gp: 150, pp: 0 }
 */
export function multiplyItemCost(
	cost: ItemCost,
	multiplier: number,
	config: CurrencyConfig
): ItemCost {
	// Convert to base units
	const baseUnits = convertToBaseUnit(cost, config);

	// Multiply and round to nearest whole unit
	const multipliedUnits = Math.round(baseUnits * multiplier);

	// Convert back to currency denominations
	return convertFromBaseUnit(multipliedUnits, config);
}

/**
 * Get price display color based on multiplier
 *
 * Returns CSS color class for UI:
 * - 'price-increase' (red) for multipliers > 1.0
 * - 'price-decrease' (green) for multipliers < 1.0
 * - 'price-normal' (default) for multiplier === 1.0
 *
 * @param multiplier - Effective price multiplier
 * @returns CSS color class name
 *
 * @example
 * getPriceDisplayColor(1.5); // 'price-increase' (red)
 * getPriceDisplayColor(0.8); // 'price-decrease' (green)
 * getPriceDisplayColor(1.0); // 'price-normal' (default)
 */
export function getPriceDisplayColor(multiplier: number): 'price-increase' | 'price-decrease' | 'price-normal' {
	if (multiplier > 1.0) return 'price-increase';
	if (multiplier < 1.0) return 'price-decrease';
	return 'price-normal';
}

/**
 * Format price modifier for display
 *
 * Converts multiplier to human-readable percentage:
 * - 1.5 → "+50%"
 * - 0.8 → "-20%"
 * - 1.0 → "" (no modifier)
 *
 * @param multiplier - Price multiplier
 * @returns Formatted percentage string or empty string if no change
 *
 * @example
 * formatPriceModifier(1.5); // "+50%"
 * formatPriceModifier(0.8); // "-20%"
 * formatPriceModifier(1.0); // ""
 */
export function formatPriceModifier(multiplier: number): string {
	if (multiplier === 1.0) return '';

	const percentChange = Math.round((multiplier - 1.0) * 100);
	const sign = percentChange > 0 ? '+' : '';
	return `${sign}${percentChange}%`;
}
