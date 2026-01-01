// Item Metadata Parser
// Extracts item types, rarities, and builds type/rarity matrices from item collections
// Platform-agnostic - no external dependencies

import { Item } from '../models/types';

/**
 * Extract all unique item types from a collection of items
 * @param items Array of items to analyze
 * @returns Array of unique item type strings (sorted alphabetically)
 *
 * @example
 * const types = extractItemTypes(allItems);
 * // Returns: ["armor", "potion", "scroll", "weapon", "wondrous item"]
 */
export function extractItemTypes(items: Item[]): string[] {
	const typeSet = new Set<string>();

	for (const item of items) {
		if (item.type) {
			// Normalize to lowercase for consistency
			typeSet.add(item.type.toLowerCase());
		}
	}

	// Convert to sorted array
	return Array.from(typeSet).sort();
}

/**
 * Extract all unique rarities from a collection of items
 * @param items Array of items to analyze
 * @returns Array of unique rarity strings (sorted by D&D 5e order)
 *
 * @example
 * const rarities = extractRarities(allItems);
 * // Returns: ["common", "uncommon", "rare", "very-rare", "legendary"]
 */
export function extractRarities(items: Item[]): string[] {
	const raritySet = new Set<string>();

	for (const item of items) {
		if (item.rarity) {
			// Normalize to lowercase for consistency
			const normalizedRarity = item.rarity.toLowerCase();
			// Handle 'none' as 'common'
			raritySet.add(normalizedRarity === 'none' ? 'common' : normalizedRarity);
		}
	}

	// Define D&D 5e rarity order (handle multiple formats)
	const rarityOrder = ['common', 'uncommon', 'rare', 'very rare', 'very-rare', 'veryrare', 'legendary'];

	// Sort by D&D order
	return Array.from(raritySet).sort((a, b) => {
		const indexA = rarityOrder.indexOf(a);
		const indexB = rarityOrder.indexOf(b);
		return indexA - indexB;
	});
}

/**
 * Build a type/rarity matrix showing item count distribution
 * Useful for understanding what combinations exist in the vault
 *
 * @param items Array of items to analyze
 * @returns Nested object: { [type]: { [rarity]: count } }
 *
 * @example
 * const matrix = buildTypeRarityMatrix(allItems);
 * // Returns: {
 * //   "weapon": { "common": 45, "uncommon": 23, "rare": 12 },
 * //   "armor": { "common": 30, "uncommon": 15, "rare": 8 },
 * //   "potion": { "common": 20, "uncommon": 15, "rare": 5 }
 * // }
 *
 * console.log(matrix["weapon"]["common"]); // 45
 */
export function buildTypeRarityMatrix(items: Item[]): Record<string, Record<string, number>> {
	const matrix: Record<string, Record<string, number>> = {};

	for (const item of items) {
		if (!item.type || !item.rarity) continue;

		const type = item.type.toLowerCase();
		const rarity = item.rarity.toLowerCase() === 'none' ? 'common' : item.rarity.toLowerCase();

		// Initialize type if not exists
		if (!matrix[type]) {
			matrix[type] = {};
		}

		// Initialize rarity count if not exists
		if (!matrix[type][rarity]) {
			matrix[type][rarity] = 0;
		}

		// Increment count
		matrix[type][rarity]++;
	}

	return matrix;
}

/**
 * Get summary statistics about item metadata
 * Useful for debugging and displaying vault info to users
 *
 * @param items Array of items to analyze
 * @returns Object with counts and lists
 */
export function getItemMetadataSummary(items: Item[]): {
	totalItems: number;
	types: string[];
	typeCount: number;
	rarities: string[];
	rarityCount: number;
	matrix: Record<string, Record<string, number>>;
} {
	const types = extractItemTypes(items);
	const rarities = extractRarities(items);
	const matrix = buildTypeRarityMatrix(items);

	return {
		totalItems: items.length,
		types,
		typeCount: types.length,
		rarities,
		rarityCount: rarities.length,
		matrix
	};
}
