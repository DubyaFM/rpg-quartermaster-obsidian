/**
 * Default weights by item type (Tier 4 fallback)
 * Based on D&D 5e equipment guidelines
 *
 * These are used when:
 * 1. Item has no explicit weight field
 * 2. Item not found in specific weights config
 * 3. Item not found in SRD database
 */
export const DEFAULT_ITEM_WEIGHTS: Record<string, number> = {
	// Weapons
	'simple melee weapons': 2,
	'simple ranged weapons': 2,
	'martial melee weapons': 3,
	'martial ranged weapons': 2,

	// Armor
	'light armor': 10,
	'medium armor': 20,
	'heavy armor': 40,
	'shield': 6,

	// Adventuring gear
	'ammunition': 0.05,  // Per arrow/bolt
	'potion': 0.5,
	'scroll': 0.1,
	'wand': 1,
	'rod': 2,
	'staff': 4,
	'ring': 0.1,
	'amulet': 0.5,
	'cloak': 1,
	'boots': 1,
	'gloves': 0.5,
	'belt': 0.5,
	'hat': 0.5,

	// Tools & kits
	'tool': 5,
	'artisan tools': 5,
	"artisan's tools": 5,
	'gaming set': 1,
	'musical instrument': 3,

	// Containers (empty)
	'backpack': 5,
	'bag': 0.5,
	'barrel': 70,
	'basket': 2,
	'chest': 25,
	'pouch': 1,

	// Books & papers
	'book': 5,
	'spellbook': 3,
	'scroll case': 1,

	// Food & drink
	'rations': 2,
	'waterskin': 5,  // Full
	'ale': 1,  // Per pint
	'wine': 1,

	// Common weapon types (lowercase for matching)
	'weapon': 3,
	'simple weapon': 2,
	'martial weapon': 3,

	// Common armor types (lowercase for matching)
	'armor': 20,
};
