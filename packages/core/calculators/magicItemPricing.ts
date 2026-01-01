// Magic Item Pricing Calculator
// Based on D&D 5e crafting costs from Xanathar's Guide to Everything
// Calculates shop prices using formula: crafting cost * (1 + markup%)

import { Item, ItemCost } from '../models/types';
import type { CurrencyConfig } from '../models/currency-config';
import { convertToCopper, convertFromCopper, convertToBaseUnit, convertFromBaseUnit } from './currency';

/**
 * Base crafting costs for magic items by rarity (in base currency units)
 * For D&D 5e: 1 gp = 100 cp, so values below are in copper pieces
 * Source: Xanathar's Guide to Everything
 * Note: Only ONE "very rare" entry - no duplicates
 *
 * @remarks
 * These values represent the minimum crafting cost for a magic item of a given rarity.
 * They are currency-agnostic and stored in the base unit (lowest denomination) of the active currency system.
 * Convert using baseUnitsToItemCost() when displaying prices.
 */
export const MAGIC_ITEM_CRAFTING_COSTS_BASE_UNITS: Record<string, number> = {
	common: 5000,        // 50 gp in D&D 5e
	uncommon: 20000,     // 200 gp in D&D 5e
	rare: 200000,        // 2000 gp in D&D 5e
	'very rare': 2000000,    // 20000 gp in D&D 5e
	legendary: 10000000      // 100000 gp in D&D 5e
};

/**
 * Crafting costs for spell scrolls by spell level (in base currency units)
 * For D&D 5e: 1 gp = 100 cp, so values below are in copper pieces
 * Source: Xanathar's Guide to Everything
 *
 * @remarks
 * These values are currency-agnostic and stored in the base unit of the active currency system.
 * Convert using baseUnitsToItemCost() when displaying prices.
 */
export const SCROLL_CRAFTING_COSTS_BASE_UNITS: Record<number, number> = {
	0: 1500,     // Cantrip: 15 gp in D&D 5e
	1: 2500,     // 1st level: 25 gp
	2: 10000,    // 2nd level: 100 gp
	3: 15000,    // 3rd level: 150 gp
	4: 100000,   // 4th level: 1000 gp
	5: 150000,   // 5th level: 1500 gp
	6: 1000000,  // 6th level: 10000 gp
	7: 1250000,  // 7th level: 12500 gp
	8: 1500000,  // 8th level: 15000 gp
	9: 5000000   // 9th level: 50000 gp
};

/**
 * Backward compatibility constant for D&D 5e (gold pieces)
 * @deprecated Use MAGIC_ITEM_CRAFTING_COSTS_BASE_UNITS instead
 * These assume D&D 5e gold (multiply by 100 to get copper base units)
 */
export const MAGIC_ITEM_CRAFTING_COSTS = MAGIC_ITEM_CRAFTING_COSTS_BASE_UNITS;

/**
 * Backward compatibility constant for D&D 5e (gold pieces)
 * @deprecated Use SCROLL_CRAFTING_COSTS_BASE_UNITS instead
 * These assume D&D 5e gold (multiply by 100 to get copper base units)
 */
export const SCROLL_CRAFTING_COSTS = SCROLL_CRAFTING_COSTS_BASE_UNITS;

/**
 * Rarity aliases for normalization
 * Handles variations in rarity naming conventions
 */
export const RARITY_ALIASES: Record<string, string> = {
	'common': 'common',
	'uncommon': 'uncommon',
	'rare': 'rare',
	'very rare': 'very rare',
	'veryrare': 'very rare',
	'very-rare': 'very rare',
	'legendary': 'legendary'
};

/**
 * Convert a base unit amount to an ItemCost object for the active currency system
 * @param baseAmount - Amount in base currency units (e.g., copper for D&D 5e)
 * @param config - Currency configuration defining denomination conversion rates
 * @returns ItemCost object with amounts distributed across denominations
 *
 * @example
 * // Convert 5000 base units (50 gp) to ItemCost in D&D 5e
 * const cost = baseUnitsToItemCost(5000, currencyConfig);
 * // Returns: { cp: 0, sp: 0, gp: 50, pp: 0 }
 */
export function baseUnitsToItemCost(baseAmount: number, config: CurrencyConfig): ItemCost {
	return convertFromBaseUnit(baseAmount, config);
}

/**
 * Check if an item is a magic item
 * @param item - The item to check (must have rarity, optionally type)
 * @returns True if the item is magical, false if non-magical
 *
 * Semantics:
 * - rarity='none' or empty = non-magical item
 * - rarity='common' + type in ['weapon', 'armor', 'tool', 'food', 'gear'] = non-magical basic equipment
 * - rarity='common' + type in ['potion', 'scroll', 'misc', 'wondrous'] = magical item
 * - rarity='uncommon'+ = always magical
 */
export function isMagicItem(item: { rarity?: string; type?: string }): boolean {
	if (!item.rarity) return false;
	const normalized = item.rarity.toLowerCase().trim();

	// Items with rarity 'none' or empty are non-magical
	if (normalized === 'none' || normalized === '') return false;

	// Common rarity items can be magical or non-magical depending on type
	if (normalized === 'common') {
		const type = item.type?.toLowerCase() || '';
		// Basic equipment types are non-magical even with common rarity
		const nonMagicTypes = ['weapon', 'armor', 'tool', 'food', 'gear'];
		return !nonMagicTypes.includes(type);
	}

	// Uncommon+ rarity items are always magical
	return true;
}

/**
 * Extract spell level from item name using regex patterns
 * Matches patterns like: "level 3", "3rd level", "(3rd Level)", "1st-level"
 *
 * @param itemName - The name of the spell scroll or item
 * @returns Spell level (0-9) or null if not found
 *
 * @example
 * extractSpellLevel("Spell Scroll (3rd Level)") // returns 3
 * extractSpellLevel("Scroll of Fireball (level 3)") // returns 3
 * extractSpellLevel("Cantrip Scroll") // returns 0 (if explicitly cantrip)
 */
export function extractSpellLevel(itemName: string): number | null {
	if (!itemName) return null;

	// Match patterns: "level X", "Xst/nd/rd/th level", with optional parentheses
	const levelPattern = /(level\s+(\d+)|(\d+)(?:st|nd|rd|th)\s*[-\s]*level)/i;
	const match = itemName.match(levelPattern);

	if (match) {
		// Extract the numeric part (group 2 or 3)
		const level = parseInt(match[2] || match[3]);
		if (!isNaN(level) && level >= 0 && level <= 9) {
			return level;
		}
	}

	// Check for explicit "cantrip" mention
	if (/cantrip/i.test(itemName)) {
		return 0;
	}

	return null;
}

/**
 * Normalize rarity string to canonical form
 * @param rarity - Raw rarity string from item data
 * @returns Normalized rarity string or original if no match
 */
function normalizeRarity(rarity: string): string {
	if (!rarity) return '';
	const normalized = rarity.toLowerCase().trim();
	return RARITY_ALIASES[normalized] || normalized;
}

/**
 * Get the base crafting cost for a magic item
 * For consumables (non-scrolls), the crafting cost is already halved
 *
 * @param rarity - The rarity tier of the magic item
 * @param isConsumable - Whether this is a consumable item (potions, etc.)
 * @param config - Currency configuration for converting base units to ItemCost
 * @returns Base crafting cost as ItemCost, or null if rarity is invalid
 *
 * @remarks
 * This function converts base unit costs to the active currency system's denominations.
 * For D&D 5e, base units are copper pieces.
 */
export function getMagicItemBaseCraftingCost(
	rarity: string,
	isConsumable: boolean,
	config: CurrencyConfig
): ItemCost | null {
	const normalizedRarity = normalizeRarity(rarity);
	const baseCostUnits = MAGIC_ITEM_CRAFTING_COSTS_BASE_UNITS[normalizedRarity];

	if (baseCostUnits === undefined) {
		return null; // Invalid rarity
	}

	// For consumables (non-scrolls), halve the crafting cost
	const craftingCostUnits = isConsumable ? Math.floor(baseCostUnits / 2) : baseCostUnits;

	// Convert to ItemCost using the active currency system
	return convertFromBaseUnit(craftingCostUnits, config);
}

/**
 * Get the crafting cost for a spell scroll
 * Returns the cost as-is from the scroll table (no modifications)
 *
 * @param spellLevel - The level of the spell (0-9, where 0 = cantrip)
 * @param config - Currency configuration for converting base units to ItemCost
 * @returns Crafting cost as ItemCost, or null if spell level is invalid
 *
 * @remarks
 * This function converts base unit costs to the active currency system's denominations.
 * For D&D 5e, base units are copper pieces.
 */
export function getScrollCraftingCost(spellLevel: number, config: CurrencyConfig): ItemCost | null {
	const costUnits = SCROLL_CRAFTING_COSTS_BASE_UNITS[spellLevel];

	if (costUnits === undefined) {
		return null; // Invalid spell level
	}

	// Convert to ItemCost using the active currency system
	return convertFromBaseUnit(costUnits, config);
}

/**
 * Calculate the final shop price for a magic item
 * Formula: baseCraftingCost * (1 + markupPercent/100)
 *
 * @param item - The magic item to price
 * @param markupPercent - The shop's markup percentage (e.g., 50 for 50%)
 * @param config - Currency configuration for base unit conversions
 * @returns Calculated shop price as ItemCost
 *
 * @remarks
 * - For scrolls: Uses scroll crafting table, then applies markup
 * - For consumables (non-scrolls): Base cost is already halved, then applies markup
 * - For other magic items: Uses standard crafting cost, then applies markup
 * - If item type or rarity is invalid, returns 0 cost
 * - Conversions use the active currency system's base unit and denominations
 *
 * @example
 * // Scroll of Fireball (3rd level): base 150 gp, 50% markup = 225 gp
 * calculateMagicItemPrice(scrollItem, 50, config)
 *
 * // Potion of Healing (common consumable): base 25 gp (50/2), 50% markup = 37.5 gp
 * calculateMagicItemPrice(potionItem, 50, config)
 *
 * // +1 Longsword (uncommon): base 200 gp, 50% markup = 300 gp
 * calculateMagicItemPrice(swordItem, 50, config)
 */
export function calculateMagicItemPrice(item: Item, markupPercent: number, config: CurrencyConfig): ItemCost {
	let baseCost: ItemCost | null = null;

	// Handle scrolls specially - extract spell level from name
	if (item.type === 'scroll' || item.type === 'Scroll') {
		const spellLevel = extractSpellLevel(item.name);
		if (spellLevel !== null) {
			baseCost = getScrollCraftingCost(spellLevel, config);
		}
	}

	// If not a scroll (or scroll level not found), use standard magic item pricing
	if (!baseCost) {
		const isConsumable = item.isConsumable || false;
		baseCost = getMagicItemBaseCraftingCost(item.rarity, isConsumable, config);
	}

	// If we couldn't determine a base cost, return zero cost
	if (!baseCost) {
		// Create a zeroed cost matching the active currency system
		const zeroedCost: ItemCost = {};
		const system = config.systems[config.defaultSystem];
		if (system) {
			for (const denom of system.denominations) {
				zeroedCost[denom.abbreviation] = 0;
			}
		}
		return zeroedCost;
	}

	// Apply markup: shopPrice = baseCost * (1 + markupPercent/100)
	const baseCostBaseUnits = convertToBaseUnit(baseCost, config);
	const markupMultiplier = 1 + (markupPercent / 100);
	const finalCostBaseUnits = Math.floor(baseCostBaseUnits * markupMultiplier);

	return convertFromBaseUnit(finalCostBaseUnits, config);
}

/**
 * Calculate the cost of a magic item by applying rarity modifier to base item cost
 * Adds the base item cost to the rarity-based crafting cost
 *
 * @param baseItemCost - The cost of the non-magical base item
 * @param rarity - The rarity of the magic item
 * @param isConsumable - Whether this is a consumable item
 * @param config - Currency configuration for base unit conversions
 * @returns The calculated magic item cost
 *
 * @remarks
 * This is primarily used by the variant resolver to calculate costs for
 * magic item variants based on their base item cost plus a rarity modifier.
 */
export function calculateMagicItemCost(
	baseItemCost: ItemCost,
	rarity: string,
	isConsumable: boolean = false,
	config: CurrencyConfig
): ItemCost {
	// Get the rarity modifier
	const modifierCost = getMagicItemBaseCraftingCost(rarity, isConsumable, config);
	if (!modifierCost) {
		// Invalid rarity - return base cost unchanged
		return baseItemCost;
	}

	// Add base cost + modifier cost using base unit conversion
	const baseUnits = convertToBaseUnit(baseItemCost, config);
	const modifierUnits = convertToBaseUnit(modifierCost, config);
	const totalUnits = baseUnits + modifierUnits;

	return convertFromBaseUnit(totalUnits, config);
}
