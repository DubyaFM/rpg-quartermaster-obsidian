import { Item } from '../models/types';

/**
 * Item Weight Configuration
 * Loaded from config/itemWeights.yaml
 */
export interface ItemWeightConfig {
	specificWeights?: Record<string, number>;  // Exact item name -> weight
	typeDefaults?: Record<string, number>;  // Item type -> default weight
}

/**
 * Get item weight using 4-tier fallback strategy:
 * 1. Item frontmatter `weight` field
 * 2. Config file specific weights (itemWeights.yaml)
 * 3. SRD database lookup
 * 4. Type-based defaults
 * 5. Final fallback: 1 lb
 *
 * @param item - The item to calculate weight for
 * @param config - Weight configuration from YAML
 * @param srdWeights - Map of SRD item weights (name -> weight)
 * @returns Weight in pounds
 */
export function getItemWeight(
	item: Item,
	config: ItemWeightConfig,
	srdWeights: Map<string, number>
): number {
	// Tier 1: Item has explicit weight
	if (item.weight !== undefined && item.weight !== null) {
		return item.weight;
	}

	// Tier 2: Config file specific weights
	const configWeight = config.specificWeights?.[item.name.toLowerCase()];
	if (configWeight !== undefined) {
		return configWeight;
	}

	// Tier 3: SRD database lookup
	const srdWeight = srdWeights.get(item.name.toLowerCase());
	if (srdWeight !== undefined) {
		return srdWeight;
	}

	// Tier 4: Type-based defaults
	const typeWeight = getDefaultWeightByType(item.type, item.category, config);
	if (typeWeight !== undefined) {
		return typeWeight;
	}

	// Tier 5: Final fallback
	return 1;
}

/**
 * Resolve weight for variant items (inherits from base item)
 *
 * @param variantItem - The variant item to resolve weight for
 * @param baseItems - Array of all items to search for base item
 * @param config - Weight configuration from YAML
 * @param srdWeights - Map of SRD item weights
 * @returns Weight in pounds
 */
export function resolveVariantWeight(
	variantItem: Item,
	baseItems: Item[],
	config: ItemWeightConfig,
	srdWeights: Map<string, number>
): number {
	// If variant has explicit weight, use it
	if (variantItem.weight !== undefined) {
		return variantItem.weight;
	}

	// Find base item and use its weight
	const baseItemName = extractBaseItemName(variantItem.name);
	const baseItem = baseItems.find(item =>
		item.name.toLowerCase() === baseItemName.toLowerCase()
	);

	if (baseItem) {
		return getItemWeight(baseItem, config, srdWeights);
	}

	// Fallback to standard weight calculation
	return getItemWeight(variantItem, config, srdWeights);
}

/**
 * Get default weight based on item type/category
 *
 * @param type - Item type
 * @param category - Item category
 * @param config - Weight configuration from YAML
 * @returns Weight in pounds or undefined if no default found
 */
function getDefaultWeightByType(
	type: string | undefined,
	category: string | undefined,
	config: ItemWeightConfig
): number | undefined {
	if (!type) return undefined;

	// Try exact type match first
	const typeKey = type.toLowerCase();
	const exactMatch = config.typeDefaults?.[typeKey];
	if (exactMatch !== undefined) {
		return exactMatch;
	}

	// Try category match if available
	if (category) {
		const categoryKey = category.toLowerCase();
		const categoryMatch = config.typeDefaults?.[categoryKey];
		if (categoryMatch !== undefined) {
			return categoryMatch;
		}
	}

	return undefined;
}

/**
 * Extract base item name from variant (e.g., "Longsword +1" -> "Longsword")
 *
 * @param variantName - Name of the variant item
 * @returns Base item name without modifiers
 */
function extractBaseItemName(variantName: string): string {
	// Remove common suffixes: +1, +2, +3, of [something]
	return variantName
		.replace(/\s*\+\d+\s*$/, '')  // Remove +1, +2, etc.
		.replace(/\s*of\s+.+$/i, '')  // Remove "of [something]"
		.trim();
}

/**
 * Build SRD weights map from SRD items array
 *
 * @param srdItems - Array of SRD items
 * @returns Map of item name (lowercase) to weight
 */
export function buildSRDWeightsMap(srdItems: Item[]): Map<string, number> {
	const map = new Map<string, number>();

	for (const item of srdItems) {
		if (item.weight !== undefined && item.weight !== null) {
			map.set(item.name.toLowerCase(), item.weight);
		}
	}

	return map;
}
