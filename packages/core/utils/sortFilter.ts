// Sorting and Filtering Utility
// Handles shop inventory sorting and filtering
// Platform-agnostic - no Obsidian dependencies

import { ShopItem } from '../models/types';
import { convertToCopper } from '../calculators/currency';

/**
 * Sort options for inventory display
 */
export type SortCriteria = 'price' | 'rarity' | 'type' | 'category' | 'name';
export type SortDirection = 'asc' | 'desc';

export interface SortOptions {
	criteria: SortCriteria;
	direction: SortDirection;
}

/**
 * Rarity tier ordering (lower number = more common)
 */
const RARITY_ORDER: Record<string, number> = {
	'common': 0,
	'none': 0,
	'uncommon': 1,
	'rare': 2,
	'very-rare': 3,
	'very rare': 3,
	'legendary': 4
};

/**
 * Sort inventory items by price
 * @param items Array of shop items
 * @param direction Sort direction (asc = cheapest first, desc = most expensive first)
 * @returns Sorted array
 */
export function sortInventoryByPrice(items: ShopItem[], direction: SortDirection = 'asc'): ShopItem[] {
	const sorted = [...items];
	sorted.sort((a, b) => {
		const costA = convertToCopper(a.costOverride || a.cost);
		const costB = convertToCopper(b.costOverride || b.cost);
		return direction === 'asc' ? costA - costB : costB - costA;
	});
	return sorted;
}

/**
 * Sort inventory items by rarity tier
 * @param items Array of shop items
 * @param direction Sort direction (asc = common first, desc = legendary first)
 * @returns Sorted array
 */
export function sortInventoryByRarity(items: ShopItem[], direction: SortDirection = 'asc'): ShopItem[] {
	const sorted = [...items];
	sorted.sort((a, b) => {
		const rarityA = RARITY_ORDER[a.rarity.toLowerCase()] ?? 0;
		const rarityB = RARITY_ORDER[b.rarity.toLowerCase()] ?? 0;

		if (rarityA === rarityB) {
			// Secondary sort by name if rarity is the same
			return a.name.localeCompare(b.name);
		}

		return direction === 'asc' ? rarityA - rarityB : rarityB - rarityA;
	});
	return sorted;
}

/**
 * Sort inventory items by type
 * @param items Array of shop items
 * @param direction Sort direction
 * @returns Sorted array
 */
export function sortInventoryByType(items: ShopItem[], direction: SortDirection = 'asc'): ShopItem[] {
	const sorted = [...items];
	sorted.sort((a, b) => {
		const typeCompare = a.type.localeCompare(b.type);
		if (typeCompare === 0) {
			// Secondary sort by name if type is the same
			return a.name.localeCompare(b.name);
		}
		return direction === 'asc' ? typeCompare : -typeCompare;
	});
	return sorted;
}

/**
 * Sort inventory items by category
 * @param items Array of shop items
 * @param direction Sort direction
 * @returns Sorted array
 */
export function sortInventoryByCategory(items: ShopItem[], direction: SortDirection = 'asc'): ShopItem[] {
	const sorted = [...items];
	sorted.sort((a, b) => {
		const categoryCompare = a.category.localeCompare(b.category);
		if (categoryCompare === 0) {
			// Secondary sort by name if category is the same
			return a.name.localeCompare(b.name);
		}
		return direction === 'asc' ? categoryCompare : -categoryCompare;
	});
	return sorted;
}

/**
 * Sort inventory items by name
 * @param items Array of shop items
 * @param direction Sort direction
 * @returns Sorted array
 */
export function sortInventoryByName(items: ShopItem[], direction: SortDirection = 'asc'): ShopItem[] {
	const sorted = [...items];
	sorted.sort((a, b) => {
		const nameCompare = a.name.localeCompare(b.name);
		return direction === 'asc' ? nameCompare : -nameCompare;
	});
	return sorted;
}

/**
 * Filter inventory by search query
 * Searches item name, description, type, and rarity
 * @param items Array of shop items
 * @param query Search query string
 * @returns Filtered array
 */
export function filterInventoryBySearch(items: ShopItem[], query: string): ShopItem[] {
	if (!query || query.trim() === '') {
		return items;
	}

	const searchTerm = query.toLowerCase().trim();

	return items.filter(item => {
		// Search in name
		if (item.name.toLowerCase().includes(searchTerm)) {
			return true;
		}

		// Search in description
		if (item.description && item.description.toLowerCase().includes(searchTerm)) {
			return true;
		}

		// Search in type
		if (item.type.toLowerCase().includes(searchTerm)) {
			return true;
		}

		// Search in rarity
		if (item.rarity.toLowerCase().includes(searchTerm)) {
			return true;
		}

		// Search in category
		if (item.category && item.category.toLowerCase().includes(searchTerm)) {
			return true;
		}

		// Search in source
		if (item.source) {
			const sourceStr = Array.isArray(item.source)
				? item.source.join(' ').toLowerCase()
				: item.source.toLowerCase();
			if (sourceStr.includes(searchTerm)) {
				return true;
			}
		}

		return false;
	});
}

/**
 * Apply multiple sort and filter criteria to inventory
 * @param items Array of shop items
 * @param sortOptions Sort options
 * @param searchQuery Optional search query
 * @returns Sorted and filtered array
 */
export function applyMultiSort(
	items: ShopItem[],
	sortOptions: SortOptions,
	searchQuery?: string
): ShopItem[] {
	// First apply search filter if provided
	let processed = searchQuery ? filterInventoryBySearch(items, searchQuery) : [...items];

	// Then apply sorting
	switch (sortOptions.criteria) {
		case 'price':
			processed = sortInventoryByPrice(processed, sortOptions.direction);
			break;
		case 'rarity':
			processed = sortInventoryByRarity(processed, sortOptions.direction);
			break;
		case 'type':
			processed = sortInventoryByType(processed, sortOptions.direction);
			break;
		case 'category':
			processed = sortInventoryByCategory(processed, sortOptions.direction);
			break;
		case 'name':
			processed = sortInventoryByName(processed, sortOptions.direction);
			break;
		default:
			// Default: sort by category then name
			processed = sortInventoryByCategory(processed, 'asc');
	}

	return processed;
}

/**
 * Get count of items in each rarity tier
 * @param items Array of shop items
 * @returns Map of rarity to count
 */
export function getRarityBreakdown(items: ShopItem[]): Map<string, number> {
	const breakdown = new Map<string, number>();

	items.forEach(item => {
		const rarity = item.rarity.toLowerCase();
		breakdown.set(rarity, (breakdown.get(rarity) || 0) + 1);
	});

	return breakdown;
}

/**
 * Get count of items in each type
 * @param items Array of shop items
 * @returns Map of type to count
 */
export function getTypeBreakdown(items: ShopItem[]): Map<string, number> {
	const breakdown = new Map<string, number>();

	items.forEach(item => {
		const type = item.type;
		breakdown.set(type, (breakdown.get(type) || 0) + 1);
	});

	return breakdown;
}

/**
 * Calculate total value of inventory in copper
 * @param items Array of shop items
 * @returns Total value in copper pieces
 */
export function calculateInventoryValue(items: ShopItem[]): number {
	return items.reduce((total, item) => {
		const itemCost = convertToCopper(item.costOverride || item.cost);
		return total + (itemCost * item.stock);
	}, 0);
}
