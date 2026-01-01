// Order Utility Functions
// Handles item ordering, pricing, and crafting time calculations

import { Item, ItemCost, Order } from '../models/types';
import type { CurrencyConfig } from '../models/currency-config.js';
import { multiplyCurrency } from '../calculators/currency';
import { IRandomizer } from '../interfaces/IRandomizer';

interface CraftingTimeConfig {
	min: number;
	max: number;
	dice: string;
	multiplier?: number;
}

interface CraftingTimesYAML {
	defaultTimes: Record<string, CraftingTimeConfig>;
	craftingTimes: Record<string, Record<string, CraftingTimeConfig>>;
	orderMarkup: number;
	orderMarkupDescription: string;
}

let craftingTimesCache: CraftingTimesYAML | null = null;

/**
 * Load crafting times configuration from YAML
 * NOTE: This function currently returns defaults only
 * TODO: Move config loading to adapter layer
 */
function loadCraftingTimesConfig(): CraftingTimesYAML {
	if (craftingTimesCache) {
		return craftingTimesCache;
	}

	// TODO: Load from file system via adapter
	// For now, return default config
	craftingTimesCache = {
		defaultTimes: {
			common: { min: 1, max: 4, dice: '1d4' },
			uncommon: { min: 7, max: 28, dice: '1d4', multiplier: 7 },
			rare: { min: 30, max: 180, dice: '1d6', multiplier: 30 },
			'very-rare': { min: 60, max: 240, dice: '1d8', multiplier: 30 },
			legendary: { min: 90, max: 360, dice: '1d12', multiplier: 30 }
		},
		craftingTimes: {},
		orderMarkup: 0.50,
		orderMarkupDescription: 'Special orders include a 50% markup'
	};

	return craftingTimesCache;
}

/**
 * Parse dice notation and roll a random value
 * @param randomizer Randomizer implementation for dice rolls
 * @param diceStr Dice notation like "1d4", "2d6", or "1"
 * @returns Random rolled value
 */
function rollDice(randomizer: IRandomizer, diceStr: string): number {
	if (diceStr === '1' || !diceStr.includes('d')) {
		return parseInt(diceStr);
	}

	// Use randomizer's rollDice method if available
	if (randomizer.rollDice) {
		return randomizer.rollDice(diceStr).total;
	}

	// Otherwise parse manually
	const [countStr, sidesStr] = diceStr.split('d');
	const count = parseInt(countStr);
	const sides = parseInt(sidesStr);

	let total = 0;
	for (let i = 0; i < count; i++) {
		total += randomizer.randomInt(1, sides);
	}
	return total;
}

/**
 * Calculate order price with 50% markup
 * @param item Item to order
 * @param currencyConfig Currency configuration for proper denomination conversions
 * @returns Price with markup applied
 */
export function calculateOrderPrice(item: Item, currencyConfig: CurrencyConfig): ItemCost {
	const config = loadCraftingTimesConfig();
	const markup = 1 + config.orderMarkup; // 1.5 for 50% markup
	return multiplyCurrency(item.cost, markup, currencyConfig);
}

/**
 * Calculate crafting time in days for an item
 * Uses item type and rarity to determine appropriate crafting duration
 * @param randomizer Randomizer implementation for dice rolls
 * @param item Item to craft
 * @returns Number of days until order completion
 */
export function calculateCraftingTime(randomizer: IRandomizer, item: Item): number {
	const config = loadCraftingTimesConfig();
	const itemType = item.type.toLowerCase();
	const rarity = item.rarity.toLowerCase();

	// Try to find specific crafting time for item type and rarity
	let timeConfig: CraftingTimeConfig | undefined;

	if (config.craftingTimes[itemType] && config.craftingTimes[itemType][rarity]) {
		timeConfig = config.craftingTimes[itemType][rarity];
	} else if (config.defaultTimes[rarity]) {
		timeConfig = config.defaultTimes[rarity];
	}

	if (!timeConfig) {
		// Fallback: common items take 1d4 days, higher rarities take longer
		const fallbackDays: Record<string, number> = {
			common: 2,
			uncommon: 14,
			rare: 90,
			'very-rare': 180,
			legendary: 270
		};
		return fallbackDays[rarity] || 7;
	}

	// Roll the dice
	const rolled = rollDice(randomizer, timeConfig.dice);
	const multiplier = timeConfig.multiplier || 1;
	return rolled * multiplier;
}

/**
 * Calculate the completion date for an order
 * @param daysFromNow Number of days until completion
 * @returns ISO date string for completion date
 */
export function formatOrderDate(daysFromNow: number): string {
	const completionDate = new Date();
	completionDate.setDate(completionDate.getDate() + daysFromNow);
	return completionDate.toISOString();
}

/**
 * Get a human-readable description of crafting time
 * @param days Number of days
 * @returns Formatted string like "2 days", "3 weeks", "2 months"
 */
export function formatCraftingTime(days: number): string {
	if (days === 1) {
		return '1 day';
	} else if (days < 7) {
		return `${days} days`;
	} else if (days < 30) {
		const weeks = Math.floor(days / 7);
		const remainingDays = days % 7;
		if (remainingDays === 0) {
			return weeks === 1 ? '1 week' : `${weeks} weeks`;
		}
		return `${weeks} week${weeks > 1 ? 's' : ''} and ${remainingDays} day${remainingDays > 1 ? 's' : ''}`;
	} else {
		const months = Math.floor(days / 30);
		const remainingDays = days % 30;
		if (remainingDays === 0) {
			return months === 1 ? '1 month' : `${months} months`;
		}
		const weeks = Math.floor(remainingDays / 7);
		const daysAfterWeeks = remainingDays % 7;
		if (weeks > 0 && daysAfterWeeks > 0) {
			return `${months} month${months > 1 ? 's' : ''} and ${weeks} week${weeks > 1 ? 's' : ''} and ${daysAfterWeeks} day${daysAfterWeeks > 1 ? 's' : ''}`;
		} else if (weeks > 0) {
			return `${months} month${months > 1 ? 's' : ''} and ${weeks} week${weeks > 1 ? 's' : ''}`;
		}
		return `${months} month${months > 1 ? 's' : ''} and ${remainingDays} day${remainingDays > 1 ? 's' : ''}`;
	}
}

/**
 * Create an order object for an item
 * @param randomizer Randomizer implementation for crafting time calculation
 * @param item Item to order
 * @param shopName Name of the shop placing order
 * @param currencyConfig Currency configuration for proper denomination conversions
 * @param shopkeeper Name of shopkeeper (optional)
 * @returns Order object
 */
export function createOrder(
	randomizer: IRandomizer,
	item: Item,
	shopName: string,
	currencyConfig: CurrencyConfig,
	shopkeeper?: string
): Order {
	const craftingDays = calculateCraftingTime(randomizer, item);
	const orderDate = new Date().toISOString();
	const completionDate = formatOrderDate(craftingDays);
	const price = calculateOrderPrice(item, currencyConfig);

	return {
		item: item,
		itemName: item.name,
		shopName: shopName,
		shopkeeper: shopkeeper,
		price: price,
		orderDate: orderDate,
		completionDate: completionDate,
		craftingDays: craftingDays,
		status: 'pending'
	};
}

/**
 * Check if an order is ready for pickup
 * @param order Order to check
 * @returns true if order is ready, false if still pending
 */
export function isOrderReady(order: Order): boolean {
	const now = new Date();
	const completion = new Date(order.completionDate);
	return now >= completion;
}

/**
 * Get orders that are ready for pickup
 * @param orders Array of orders
 * @returns Filtered array of ready orders
 */
export function getReadyOrders(orders: Order[]): Order[] {
	return orders.filter(order => order.status === 'pending' && isOrderReady(order));
}

/**
 * Get orders that are still in progress
 * @param orders Array of orders
 * @returns Filtered array of pending orders
 */
export function getPendingOrders(orders: Order[]): Order[] {
	return orders.filter(order => order.status === 'pending' && !isOrderReady(order));
}

/**
 * Mark an order as completed
 * @param order Order to complete
 */
export function completeOrder(order: Order): void {
	order.status = 'completed';
}
