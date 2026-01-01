// Base Item Prices from D&D 5e Player's Handbook
// These are fallback prices when base items aren't found in the vault

import { ItemCost } from '../models/types';
import { parseCostString } from '../calculators/currency';
import { DEFAULT_CURRENCY_CONFIG } from './defaultCurrencyConfig';

// Price lookup table (prices in gold pieces for easy reference)
const BASE_PRICES_GP: Record<string, number> = {
	// Light Armor
	"Padded": 5,
	"Padded Armor": 5,
	"Leather": 10,
	"Leather Armor": 10,
	"Studded Leather": 45,
	"Studded Leather Armor": 45,

	// Medium Armor
	"Hide": 10,
	"Hide Armor": 10,
	"Chain Shirt": 50,
	"Scale Mail": 50,
	"Breastplate": 400,
	"Half Plate": 750,
	"Half Plate Armor": 750,

	// Heavy Armor
	"Ring Mail": 30,
	"Chain Mail": 75,
	"Splint": 200,
	"Splint Armor": 200,
	"Plate": 1500,
	"Plate Armor": 1500,

	// Shields
	"Shield": 10,

	// Simple Melee Weapons
	"Club": 0.1,
	"Dagger": 2,
	"Greatclub": 0.2,
	"Handaxe": 5,
	"Javelin": 0.5,
	"Light Hammer": 2,
	"Mace": 5,
	"Quarterstaff": 0.2,
	"Sickle": 1,
	"Spear": 1,

	// Simple Ranged Weapons
	"Light Crossbow": 25,
	"Dart": 0.05,
	"Shortbow": 25,
	"Sling": 0.1,

	// Martial Melee Weapons
	"Battleaxe": 10,
	"Flail": 10,
	"Glaive": 20,
	"Greataxe": 30,
	"Greatsword": 50,
	"Halberd": 20,
	"Lance": 10,
	"Longsword": 15,
	"Maul": 10,
	"Morningstar": 15,
	"Pike": 5,
	"Rapier": 25,
	"Scimitar": 25,
	"Shortsword": 10,
	"Trident": 5,
	"War Pick": 5,
	"Warhammer": 15,
	"Whip": 2,

	// Martial Ranged Weapons
	"Blowgun": 10,
	"Hand Crossbow": 75,
	"Heavy Crossbow": 50,
	"Longbow": 50,
	"Net": 1,

	// Other common base items
	"Ring": 5,  // Generic ring
	"Amulet": 5,  // Generic amulet
	"Cloak": 1,  // Generic cloak
	"Robe": 1,  // Generic robe
	"Staff": 5,  // Generic staff
	"Wand": 10,  // Generic wand
	"Rod": 10,  // Generic rod
	"Belt": 1,  // Generic belt
	"Boots": 1,  // Generic boots
	"Gloves": 1,  // Generic gloves
	"Helm": 5,  // Generic helm
	"Bracers": 1,  // Generic bracers
};

/**
 * Get the base price for a standard PHB item
 * @param itemName - The name of the item
 * @returns ItemCost object, or null if item not found
 */
export function getBasePHBPrice(itemName: string): ItemCost | null {
	// Normalize the item name
	const normalized = itemName.trim();

	// Try exact match first
	if (normalized in BASE_PRICES_GP) {
		return parseCostString(`${BASE_PRICES_GP[normalized]} gp`, DEFAULT_CURRENCY_CONFIG);
	}

	// Try case-insensitive match
	const lowerName = normalized.toLowerCase();
	for (const [key, value] of Object.entries(BASE_PRICES_GP)) {
		if (key.toLowerCase() === lowerName) {
			return parseCostString(`${value} gp`, DEFAULT_CURRENCY_CONFIG);
		}
	}

	return null;
}

/**
 * Extract the base item name from a magic item variant name
 * E.g., "Chain Mail of Cold Resistance" -> "Chain Mail"
 *       "+2 Longsword" -> "Longsword"
 *       "Adamantine Breastplate" -> "Breastplate"
 *       "+1 Hooked Shortspear" -> "Hooked Shortspear" (non-PHB item)
 *
 * @param variantName - The full name of the magic item variant
 * @returns The extracted base item name, or null if extraction failed
 */
export function extractBaseItemName(variantName: string): string | null {
	// Remove common magic item prefixes and suffixes
	let cleaned = variantName.trim();

	// Remove numeric bonuses (+1, +2, +3, etc.)
	cleaned = cleaned.replace(/^\+\d+\s+/, '');

	// Remove "of [descriptor]" suffixes (e.g., "of Cold Resistance")
	cleaned = cleaned.replace(/\s+of\s+.+$/i, '');

	// Remove common magic material prefixes
	const magicPrefixes = [
		'Adamantine',
		'Mithral',
		'Silvered',
		'Enspelled',
		'Enchanted'
	];

	for (const prefix of magicPrefixes) {
		const regex = new RegExp(`^${prefix}\\s+`, 'i');
		cleaned = cleaned.replace(regex, '');
	}

	// Trim and return
	cleaned = cleaned.trim();

	// Return the extracted name even if not in PHB table
	// (findBaseItemCost will search vault for non-PHB items)
	if (cleaned.length === 0) {
		return null;
	}

	return cleaned;
}

/**
 * Check if an item name is likely a base (non-magical) item
 * @param itemName - The item name to check
 * @returns True if this appears to be a base item
 */
export function isBaseItem(itemName: string): boolean {
	return getBasePHBPrice(itemName) !== null;
}
