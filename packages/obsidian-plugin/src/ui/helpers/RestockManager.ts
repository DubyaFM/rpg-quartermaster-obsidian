// Restock Manager Helper
// Handles shop inventory restocking operations
// Kept under 150 lines for maintainability

import { Shop, Item } from '@quartermaster/core/models/types';
import type { CurrencyConfig } from '@quartermaster/core/models/currency-config';
import { restockShopInventory, RestockStats } from '@quartermaster/core/calculators/restock';
import { IRandomizer } from '@quartermaster/core/interfaces/IRandomizer';

export class RestockManager {
	/**
	 * Trigger a restock operation for a shop
	 * @param randomizer Randomizer for restock rolls
	 * @param shop Current shop state
	 * @param allItems Available items pool
	 * @param currencyConfig Currency configuration for variant pricing calculations
	 * @returns Updated shop and restock statistics
	 */
	async restock(
		randomizer: IRandomizer,
		shop: Shop,
		allItems: Item[],
		currencyConfig: CurrencyConfig
	): Promise<{ shop: Shop; stats: RestockStats }> {
		return restockShopInventory(randomizer, shop, allItems, currencyConfig);
	}

	/**
	 * Format restock statistics for display
	 * @param stats Restock statistics
	 * @returns Human-readable string
	 */
	formatStats(stats: RestockStats): string {
		const parts: string[] = [];

		if (stats.commonRefilled > 0) {
			parts.push(`${stats.commonRefilled} common items refilled`);
		}

		if (stats.uncommonRefilled > 0) {
			parts.push(`${stats.uncommonRefilled} uncommon items refilled`);
		}

		if (stats.rareKept > 0) {
			parts.push(`${stats.rareKept} rare+ items kept in stock`);
		}

		if (stats.rareReplaced > 0) {
			parts.push(`${stats.rareReplaced} rare+ items replaced with new inventory`);
		}

		if (parts.length === 0) {
			return 'No items restocked';
		}

		return `Shop Restocked - ${parts.join(', ')}. Total items: ${stats.totalItems}`;
	}

	/**
	 * Get detailed breakdown of restock stats
	 * @param stats Restock statistics
	 * @returns Array of formatted stat lines
	 */
	getStatsBreakdown(stats: RestockStats): string[] {
		const breakdown: string[] = [];

		breakdown.push(`Total Items: ${stats.totalItems}`);
		breakdown.push(`Common Items Refilled: ${stats.commonRefilled}`);
		breakdown.push(`Uncommon Items Refilled: ${stats.uncommonRefilled}`);
		breakdown.push(`Rare+ Items Retained: ${stats.rareKept}`);
		breakdown.push(`Rare+ Items Replaced: ${stats.rareReplaced}`);

		return breakdown;
	}

	/**
	 * Calculate percentage of rare items that were retained
	 * @param stats Restock statistics
	 * @returns Percentage (0-100) or null if no rare items
	 */
	getRetentionRate(stats: RestockStats): number | null {
		const totalRareItems = stats.rareKept + stats.rareReplaced;
		if (totalRareItems === 0) {
			return null;
		}

		return Math.round((stats.rareKept / totalRareItems) * 100);
	}
}
