// Sell Calculation Utility
// Handles sell price calculations with disposition-based modifiers
// Platform-agnostic - no Obsidian dependencies

import { Item, ItemCost } from '../models/types';
import type { CurrencyConfig } from '../models/currency-config.js';
import { convertToBaseUnit, convertFromBaseUnit, compareCurrency, subtractCurrency, addCurrency } from './currency';
import CurrencyManager from '../services/CurrencyManager.js';

/**
 * Interface for sellable items
 * Extends Item with sell-specific properties
 */
export interface SellItem extends Item {
	sellPrice: ItemCost;      // Calculated sell price (50% base + disposition modifier)
	ownedQuantity: number;    // How many the party owns
	baseSellPrice: ItemCost;  // Base 50% value before disposition modifier
}

/**
 * Calculate sell price for an item based on shopkeeper disposition
 * Uses INVERSE bargaining logic - hostile shopkeeps offer LESS, helpful offer MORE
 *
 * Base: 50% of item value
 * - Hostile: 40% (player gets 10% less)
 * - Unfriendly: 45% (player gets 5% less)
 * - Neutral: 50% (base value)
 * - Friendly: 55% (player gets 5% more)
 * - Helpful: 60% (player gets 10% more)
 *
 * @param item The item to calculate sell price for
 * @param disposition Shopkeeper disposition
 * @param config Currency configuration for proper denomination conversions
 * @returns Object with baseSellPrice and modifiedSellPrice
 */
export function calculateSellPrice(
	item: Item,
	disposition: 'hostile' | 'unfriendly' | 'neutral' | 'friendly' | 'helpful',
	config: CurrencyConfig
): { baseSellPrice: ItemCost; modifiedSellPrice: ItemCost } {
	// Base sell price is 50% of item value
	const itemValueInBase = convertToBaseUnit(item.cost, config);
	const baseSellValueInBase = Math.floor(itemValueInBase * 0.5);
	const baseSellPrice = convertFromBaseUnit(baseSellValueInBase, config);

	// Disposition modifiers (INVERSE of purchase bargaining)
	// These are applied to the BASE item value, not the sell price
	const dispositionModifiers: Record<string, number> = {
		hostile: 0.40,      // Player gets 40% of item value
		unfriendly: 0.45,   // Player gets 45% of item value
		neutral: 0.50,      // Player gets 50% of item value (base)
		friendly: 0.55,     // Player gets 55% of item value
		helpful: 0.60       // Player gets 60% of item value
	};

	const modifier = dispositionModifiers[disposition] || 0.50;
	const modifiedSellValueInBase = Math.floor(itemValueInBase * modifier);
	const modifiedSellPrice = convertFromBaseUnit(Math.max(1, modifiedSellValueInBase), config); // Minimum 1 base unit

	return {
		baseSellPrice,
		modifiedSellPrice
	};
}

/**
 * Get shop type interest filter
 * Determines which item types a shop is interested in buying
 *
 * @param shopType The type of shop
 * @returns Array of allowed item types, or empty array for all types
 */
export function getShopInterestFilter(shopType: string): string[] {
	const interestFilters: Record<string, string[]> = {
		blacksmith: ['weapon', 'armor'],
		alchemist: ['potion', 'scroll', 'poison'],
		magic: ['scroll', 'wand', 'ring', 'rod', 'staff', 'wonderous item', 'wondrous item'],
		general: [], // Buys everything
		tavern: ['food', 'drink', 'adventuring gear'],
		marketplace: [] // Buys everything
	};

	return interestFilters[shopType.toLowerCase()] || [];
}

/**
 * Check if a shop is interested in buying an item
 *
 * @param item The item to check
 * @param shopType The type of shop
 * @returns true if shop is interested, false otherwise
 */
export function isShopInterestedInItem(item: Item, shopType: string): boolean {
	const allowedTypes = getShopInterestFilter(shopType);

	// Empty array means shop buys everything (general store)
	if (allowedTypes.length === 0) {
		return true;
	}

	// Check if item type matches any allowed type (case-insensitive)
	const itemTypeLower = item.type.toLowerCase();
	return allowedTypes.some(allowedType =>
		itemTypeLower.includes(allowedType.toLowerCase()) ||
		allowedType.toLowerCase().includes(itemTypeLower)
	);
}

/**
 * Filter items by shop type interest
 * Only returns items the shop would be interested in buying
 *
 * @param items All party inventory items
 * @param shopType The type of shop
 * @returns Filtered array of items the shop wants to buy
 */
export function filterSellableItems(items: Item[], shopType: string): Item[] {
	return items.filter(item => isShopInterestedInItem(item, shopType));
}

/**
 * Create a SellItem from an Item and disposition
 *
 * @param item The base item
 * @param quantity How many the party owns
 * @param disposition Shopkeeper disposition
 * @param config Currency configuration for proper denomination conversions
 * @returns SellItem with calculated sell prices
 */
export function createSellItem(
	item: Item,
	quantity: number,
	disposition: 'hostile' | 'unfriendly' | 'neutral' | 'friendly' | 'helpful',
	config: CurrencyConfig
): SellItem {
	const { baseSellPrice, modifiedSellPrice } = calculateSellPrice(item, disposition, config);

	return {
		...item,
		sellPrice: modifiedSellPrice,
		baseSellPrice: baseSellPrice,
		ownedQuantity: quantity
	};
}

/**
 * Check if shop has enough funds to afford a purchase from players
 *
 * @param shopFunds Current shop funds on hand
 * @param sellTotal Total value of items being sold to shop
 * @param config Currency configuration for proper denomination conversions
 * @returns true if shop can afford the purchase, false otherwise
 */
export function canShopAffordPurchase(shopFunds: ItemCost, sellTotal: ItemCost, config: CurrencyConfig): boolean {
	// Shop can afford if shopFunds >= sellTotal
	return compareCurrency(shopFunds, sellTotal, config) >= 0;
}

/**
 * Calculate maximum affordable quantity of an item given shop's funds
 *
 * @param shopFunds Current shop funds on hand
 * @param itemCost Cost per unit of the item
 * @param requestedQty Quantity player wants to sell
 * @param config Currency configuration for proper denomination conversions
 * @returns Maximum quantity shop can afford (may be less than requested)
 */
export function getMaxAffordableQuantity(
	shopFunds: ItemCost,
	itemCost: ItemCost,
	requestedQty: number,
	config: CurrencyConfig
): number {
	// Convert to base unit for easy calculation
	const shopFundsBase = convertToBaseUnit(shopFunds, config);
	const itemCostBase = convertToBaseUnit(itemCost, config);

	// If item costs nothing or shop has no funds, return 0
	if (itemCostBase === 0) return requestedQty;
	if (shopFundsBase === 0) return 0;

	// Calculate max affordable (floor division)
	const maxAffordable = Math.floor(shopFundsBase / itemCostBase);

	// Return minimum of what shop can afford and what player requested
	return Math.min(maxAffordable, requestedQty);
}

/**
 * Update shop funds after a transaction
 * Shop gains funds when selling to players (purchases)
 * Shop loses funds when buying from players (sales)
 *
 * @param shopFunds Current shop funds on hand
 * @param purchases Total value of items shop sold to players (add to funds)
 * @param sales Total value of items shop bought from players (subtract from funds)
 * @param config Currency configuration for proper denomination conversions
 * @returns Updated shop funds after transaction
 */
export function updateShopGoldAfterTransaction(
	shopFunds: ItemCost,
	purchases: ItemCost,
	sales: ItemCost,
	config: CurrencyConfig
): ItemCost {
	// Add purchases (shop sold items, gains funds)
	let updatedFunds = addCurrency(shopFunds, purchases, config);

	// Subtract sales (shop bought items, loses funds)
	const subtractResult = subtractCurrency(updatedFunds, sales, config);

	// Warn if transaction would go negative (shouldn't happen with proper validation)
	if (subtractResult.isNegative) {
		console.warn('Shop funds went negative after transaction, resetting to zero');
		const manager = new CurrencyManager(config);
		return manager.createZeroedCost();
	}

	return subtractResult.result;
}
