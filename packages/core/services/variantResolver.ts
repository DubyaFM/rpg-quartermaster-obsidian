// Variant Resolver - Resolves generic variant items into specific variants with calculated costs
import { Item, ItemCost } from '../models/types';
import type { CurrencyConfig } from '../models/currency-config';
import { calculateMagicItemCost, getMagicItemBaseCraftingCost } from '../calculators/magicItemPricing';
import { extractBaseItemName, getBasePHBPrice } from '../data/baseItemPrices';

/**
 * Resolve a generic variant item into a specific variant with calculated cost
 *
 * @param parentItem - The generic variant item (e.g., "Armor of Cold Resistance")
 * @param variantAlias - The specific variant to resolve to (e.g., "Chain Mail of Cold Resistance")
 * @param allItems - All items from the vault (to search for base items)
 * @param config - Currency configuration for pricing calculations
 * @returns A new Item with the resolved variant name and calculated cost, or null if resolution failed
 */
export function resolveVariant(
	parentItem: Item,
	variantAlias: string,
	allItems: Item[],
	config: CurrencyConfig
): Item | null {
	// If parent item already has a cost assigned, use it as-is (don't calculate)
	const hasAssignedCost = parentItem.cost.cp > 0 ||
		parentItem.cost.sp > 0 ||
		parentItem.cost.gp > 0 ||
		parentItem.cost.pp > 0;

	if (hasAssignedCost) {
		// Return item with variant name but original cost
		return {
			...parentItem,
			name: variantAlias,
			baseItemName: extractBaseItemName(variantAlias) || undefined
		};
	}

	// Extract the base item name from the variant alias
	const baseItemName = extractBaseItemName(variantAlias);
	if (!baseItemName) {
		console.warn(`Could not extract base item name from variant: ${variantAlias}`);
		return null;
	}

	// Try to find the base item cost
	const baseItemCost = findBaseItemCost(baseItemName, allItems);

	let calculatedCost: ItemCost;

	if (baseItemCost) {
		// Base item found - calculate using base cost + rarity modifier
		calculatedCost = calculateMagicItemCost(
			baseItemCost,
			parentItem.rarity,
			parentItem.isConsumable || false,
			config
		);
	} else {
		// Base item not found - use rarity-based pricing directly
		// This handles unique magic items without mundane equivalents (e.g., Hoopak, Musket)
		console.log(`Base item "${baseItemName}" not found, using rarity-based pricing for ${variantAlias}`);
		const rarityBasedCost = getMagicItemBaseCraftingCost(
			parentItem.rarity,
			parentItem.isConsumable || false,
			config
		);

		if (!rarityBasedCost) {
			console.warn(`Could not determine cost for variant: ${variantAlias} (invalid rarity: ${parentItem.rarity})`);
			return null;
		}

		calculatedCost = rarityBasedCost;
	}

	// Return resolved variant
	return {
		...parentItem,
		name: variantAlias,
		cost: calculatedCost,
		baseItemName
	};
}

/**
 * Expand a generic variant item into all possible resolved variants
 *
 * @param parentItem - The generic variant item
 * @param allItems - All items from the vault
 * @param config - Currency configuration for pricing calculations
 * @returns Array of resolved variant items
 */
export function getAllResolvedVariants(
	parentItem: Item,
	allItems: Item[],
	config: CurrencyConfig
): Item[] {
	if (!parentItem.isVariant || !parentItem.variantAliases) {
		return [parentItem];  // Not a variant, return as-is
	}

	const resolvedVariants: Item[] = [];

	for (const alias of parentItem.variantAliases) {
		// Skip the parent item name itself if it's in the aliases
		if (alias === parentItem.name) {
			continue;
		}

		const resolved = resolveVariant(parentItem, alias, allItems, config);
		if (resolved) {
			resolvedVariants.push(resolved);
		}
	}

	// If no variants were resolved successfully, return the parent item
	if (resolvedVariants.length === 0) {
		return [parentItem];
	}

	return resolvedVariants;
}

/**
 * Find the cost of a base (non-magical) item
 * Searches the vault first, then falls back to PHB prices
 *
 * @param baseItemName - Name of the base item (e.g., "Chain Mail", "Hooked Shortspear")
 * @param allItems - All items from the vault
 * @returns The base item cost, or null if not found
 */
function findBaseItemCost(baseItemName: string, allItems: Item[]): ItemCost | null {
	// Search vault for the base item
	// Base items should not be variants and should be non-magical (common/none rarity or no rarity)
	const baseItem = allItems.find(item => {
		// Match by name (case-insensitive)
		if (item.name.toLowerCase() === baseItemName.toLowerCase()) {
			// Make sure it's not a variant item
			if (item.isVariant) {
				return false;
			}
			// Accept items with 'common', 'none', empty, or undefined rarity (all non-magical)
			const rarity = item.rarity?.toLowerCase() || 'none';
			if (rarity === 'common' || rarity === 'none' || rarity === '') {
				return true;
			}
		}
		return false;
	});

	if (baseItem) {
		return baseItem.cost;
	}

	// Fallback to PHB prices (works for standard PHB items only)
	return getBasePHBPrice(baseItemName);
}

/**
 * Expand all variant items in an array into their resolved variants
 * Non-variant items are passed through unchanged
 *
 * @param items - Array of items that may contain variants
 * @param config - Currency configuration for pricing calculations
 * @returns New array with all variants expanded
 */
export function expandVariantItems(items: Item[], config: CurrencyConfig): Item[] {
	const expanded: Item[] = [];

	for (const item of items) {
		if (item.isVariant && item.variantAliases && item.variantAliases.length > 0) {
			// This is a variant item - expand it
			const resolvedVariants = getAllResolvedVariants(item, items, config);
			expanded.push(...resolvedVariants);
		} else {
			// Regular item - keep as-is
			expanded.push(item);
		}
	}

	return expanded;
}

/**
 * Check if an item name matches a variant alias pattern
 * Used to determine if an item is one of the possible variants
 *
 * @param itemName - The item name to check
 * @param parentItemName - The parent variant item name
 * @returns True if the name appears to be a variant of the parent
 */
export function isVariantOf(itemName: string, parentItemName: string): boolean {
	// Simple check: does the item name contain key words from the parent name?
	// E.g., "Chain Mail of Cold Resistance" contains "of Cold Resistance"

	const parentWords = parentItemName.toLowerCase().split(/\s+/);
	const itemWords = itemName.toLowerCase().split(/\s+/);

	// Check if at least 2 significant words from parent appear in item name
	let matchCount = 0;
	for (const word of parentWords) {
		if (word.length > 2 && itemWords.includes(word)) {
			matchCount++;
		}
	}

	return matchCount >= 2;
}
