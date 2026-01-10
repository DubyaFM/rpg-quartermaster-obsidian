// Shop Restocking Utility
// Handles shop inventory restocking with retention logic for rare items
// Based on D&D 5e economy principles with wealth-based retention chances

import { Shop, ShopItem, Item } from '../models/types';
import type { CurrencyConfig } from '../models/currency-config';
import { createShopItem, rerollItem } from '../generators/inventory';
import { IRandomizer } from '../interfaces/IRandomizer';
import { ResolvedEffects } from '../models/effectTypes';

/**
 * Configuration for restock retention chances
 * Determines how likely rare+ items are to remain after restocking
 */
export interface RestockConfig {
	retentionChance: number; // Percentage (0-100)
	description: string;
}

/**
 * Get restock configuration based on wealth level
 * Rural/poor areas: Higher retention (items stay longer)
 * Urban/wealthy areas: Lower retention (faster turnover)
 *
 * @param wealthLevel Shop wealth level
 * @returns Restock configuration with retention percentage
 */
export function getRestockConfig(wealthLevel: 'poor' | 'modest' | 'comfortable' | 'wealthy' | 'aristocratic'): RestockConfig {
	const configs: Record<string, RestockConfig> = {
		poor: {
			retentionChance: 75,
			description: 'Rural poor areas have slow inventory turnover'
		},
		modest: {
			retentionChance: 65,
			description: 'Modest areas have moderate inventory turnover'
		},
		comfortable: {
			retentionChance: 50,
			description: 'Comfortable areas have balanced inventory turnover'
		},
		wealthy: {
			retentionChance: 35,
			description: 'Wealthy areas have faster inventory turnover'
		},
		aristocratic: {
			retentionChance: 25,
			description: 'Aristocratic areas have rapid inventory turnover'
		}
	};

	return configs[wealthLevel] || configs.comfortable;
}

/**
 * Calculate retention chance for a rare+ item based on wealth level and rarity
 * Items with remaining stock have a chance to stay in inventory
 *
 * @param wealthLevel Shop wealth level
 * @param rarity Item rarity
 * @returns Retention chance as decimal (0-1)
 */
export function calculateRetentionChance(
	wealthLevel: 'poor' | 'modest' | 'comfortable' | 'wealthy' | 'aristocratic',
	rarity: string
): number {
	const config = getRestockConfig(wealthLevel);
	return config.retentionChance / 100;
}

/**
 * Check if an item is considered rare or higher
 * Used to determine restock behavior
 */
function isRareOrHigher(rarity: string): boolean {
	const rareLevels = ['rare', 'very-rare', 'legendary'];
	return rareLevels.includes(rarity.toLowerCase());
}

/**
 * Restock shop inventory with wealth-based retention logic
 * - Common/Uncommon items: Always refill to original stock levels (10-20)
 * - Rare+ items with remaining stock: Roll retention chance
 *   - If retained: Keep item with full stock
 *   - If not retained: Re-roll to different item of same rarity
 * - Rare+ items with 0 stock: Always re-roll
 *
 * @param randomizer Randomizer implementation for all random rolls
 * @param shop Current shop state
 * @param allItems Complete pool of items to choose from
 * @param config Currency configuration for variant pricing calculations
 * @param effectContext Optional: resolved effects from WorldEventService for restock blocking
 * @returns Updated shop with restocked inventory and statistics, or error if blocked
 */
export function restockShopInventory(
	randomizer: IRandomizer,
	shop: Shop,
	allItems: Item[],
	config: CurrencyConfig,
	effectContext?: ResolvedEffects | null
): { shop: Shop; stats: RestockStats; blocked?: boolean; blockingEvents?: string[] } {
	// Check if restocking is blocked by active effects
	if (effectContext?.restock_block === true) {
		// Return early with blocked status
		return {
			shop,
			stats: {
				commonRefilled: 0,
				uncommonRefilled: 0,
				rareKept: 0,
				rareReplaced: 0,
				totalItems: 0
			},
			blocked: true,
			blockingEvents: effectContext.competingEffects?.restock_block || []
		};
	}

	const stats: RestockStats = {
		commonRefilled: 0,
		uncommonRefilled: 0,
		rareKept: 0,
		rareReplaced: 0,
		totalItems: 0
	};

	const restockConfig = getRestockConfig(shop.wealthLevel);
	const newInventory: ShopItem[] = [];

	for (const shopItem of shop.inventory) {
		const rarity = shopItem.rarity.toLowerCase();
		const isRare = isRareOrHigher(rarity);

		// Common and Uncommon: Always refill stock
		if (!isRare) {
			const refilled: ShopItem = {
				...shopItem,
				stock: getOriginalStockQuantity(randomizer, shopItem)
			};
			newInventory.push(refilled);

			if (rarity === 'common' || rarity === 'none') {
				stats.commonRefilled++;
			} else if (rarity === 'uncommon') {
				stats.uncommonRefilled++;
			}
		}
		// Rare+ items: Check retention logic
		else {
			// Item sold out: Always re-roll
			if (shopItem.stock === 0) {
				const replacement = rerollItem(randomizer, shopItem, allItems, config);
				if (replacement) {
					const newShopItem = createShopItem(randomizer, replacement);
					// Preserve cost override if it exists
					if (shopItem.costOverride) {
						newShopItem.costOverride = shopItem.costOverride;
					}
					newInventory.push(newShopItem);
					stats.rareReplaced++;
				}
			}
			// Item has remaining stock: Roll for retention
			else {
				const retentionChance = calculateRetentionChance(shop.wealthLevel, rarity);
				const roll = randomizer.randomFloat();

				if (roll < retentionChance) {
					// Item retained: Refill stock
					const refilled: ShopItem = {
						...shopItem,
						stock: getOriginalStockQuantity(randomizer, shopItem)
					};
					newInventory.push(refilled);
					stats.rareKept++;
				} else {
					// Item not retained: Re-roll
					const replacement = rerollItem(randomizer, shopItem, allItems, config);
					if (replacement) {
						const newShopItem = createShopItem(randomizer, replacement);
						// Preserve cost override if it exists
						if (shopItem.costOverride) {
							newShopItem.costOverride = shopItem.costOverride;
						}
						newInventory.push(newShopItem);
						stats.rareReplaced++;
					}
				}
			}
		}
	}

	stats.totalItems = newInventory.length;

	return {
		shop: {
			...shop,
			inventory: newInventory
		},
		stats,
		blocked: false
	};
}

/**
 * Get original stock quantity for an item based on rarity and type
 * Matches the logic from itemUtils.ts determineStockQuantity
 * @param randomizer Randomizer implementation for stock quantity rolls
 * @param item Item to get stock quantity for
 */
function getOriginalStockQuantity(randomizer: IRandomizer, item: ShopItem): number {
	const rarity = item.rarity.toLowerCase();
	const isConsumable = item.type === 'potion' || item.type === 'scroll';

	// Common and uncommon items: 10-20 stock
	if (rarity === 'common' || rarity === 'none' || rarity === 'uncommon') {
		return randomizer.randomInt(10, 20);
	}

	// Rare consumables: 1-5 stock
	if (rarity === 'rare' && isConsumable) {
		return randomizer.randomInt(1, 5);
	}

	// All other magic items (rare, very-rare, legendary non-consumables): 1 stock
	return 1;
}

/**
 * Statistics from a restock operation
 */
export interface RestockStats {
	commonRefilled: number;
	uncommonRefilled: number;
	rareKept: number;
	rareReplaced: number;
	totalItems: number;
}

/**
 * Format restock statistics as a readable message
 */
export function formatRestockStats(stats: RestockStats): string {
	const parts: string[] = [];

	if (stats.commonRefilled > 0) {
		parts.push(`${stats.commonRefilled} common items refilled`);
	}

	if (stats.uncommonRefilled > 0) {
		parts.push(`${stats.uncommonRefilled} uncommon items refilled`);
	}

	if (stats.rareKept > 0) {
		parts.push(`${stats.rareKept} rare+ items kept`);
	}

	if (stats.rareReplaced > 0) {
		parts.push(`${stats.rareReplaced} rare+ items replaced`);
	}

	return `Restocked ${stats.totalItems} items: ${parts.join(', ')}`;
}
