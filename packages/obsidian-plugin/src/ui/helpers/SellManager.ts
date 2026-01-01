// Sell Cart Manager Helper
// Manages items being sold to shops
// Kept under 150 lines for maintainability

import { SellItem } from '@quartermaster/core/calculators/sell';
import { Item, ItemCost } from '@quartermaster/core/models/types';
import { addCurrency, multiplyCurrency, convertToCopper } from '@quartermaster/core/calculators/currency';
import type { CurrencyConfig } from '@quartermaster/core/models/currency-config';
import { DEFAULT_CURRENCY_CONFIG } from '@quartermaster/core/data/defaultCurrencyConfig';

export interface SellCartItem {
	sellItem: SellItem;
	quantityToSell: number;
	totalPrice: ItemCost;
}

export class SellManager {
	private sellCart: SellCartItem[] = [];

	/**
	 * Get all items in sell cart
	 */
	getCart(): SellCartItem[] {
		return this.sellCart;
	}

	/**
	 * Add item to sell cart or update quantity if already present
	 */
	addToCart(sellItem: SellItem, quantity: number): void {
		const existing = this.sellCart.find(item => item.sellItem.name === sellItem.name);

		if (existing) {
			// Update existing item
			existing.quantityToSell += quantity;
			existing.totalPrice = multiplyCurrency(sellItem.sellPrice, existing.quantityToSell, DEFAULT_CURRENCY_CONFIG);
		} else {
			// Add new item
			this.sellCart.push({
				sellItem,
				quantityToSell: quantity,
				totalPrice: multiplyCurrency(sellItem.sellPrice, quantity, DEFAULT_CURRENCY_CONFIG)
			});
		}
	}

	/**
	 * Remove item from sell cart
	 */
	removeFromCart(itemName: string): void {
		this.sellCart = this.sellCart.filter(item => item.sellItem.name !== itemName);
	}

	/**
	 * Update quantity for an item in cart
	 */
	updateQuantity(itemName: string, newQuantity: number): void {
		const item = this.sellCart.find(i => i.sellItem.name === itemName);
		if (item) {
			if (newQuantity <= 0) {
				this.removeFromCart(itemName);
			} else {
				item.quantityToSell = newQuantity;
				item.totalPrice = multiplyCurrency(item.sellItem.sellPrice, newQuantity, DEFAULT_CURRENCY_CONFIG);
			}
		}
	}

	/**
	 * Calculate total value of all items in sell cart
	 */
	calculateTotal(): ItemCost {
		return this.sellCart.reduce(
			(total, item) => addCurrency(total, item.totalPrice, DEFAULT_CURRENCY_CONFIG),
			{ copper: 0, silver: 0, gold: 0, platinum: 0 }
		);
	}

	/**
	 * Get total number of items in cart
	 */
	getItemCount(): number {
		return this.sellCart.reduce((sum, item) => sum + item.quantityToSell, 0);
	}

	/**
	 * Clear all items from sell cart
	 */
	clearCart(): void {
		this.sellCart = [];
	}

	/**
	 * Check if cart is empty
	 */
	isEmpty(): boolean {
		return this.sellCart.length === 0;
	}

	/**
	 * Validate cart against party inventory
	 * Returns true if all quantities are valid
	 */
	validate(): { valid: boolean; errors: string[] } {
		const errors: string[] = [];

		for (const item of this.sellCart) {
			if (item.quantityToSell > item.sellItem.ownedQuantity) {
				errors.push(`Cannot sell ${item.quantityToSell} ${item.sellItem.name} - only ${item.sellItem.ownedQuantity} owned`);
			}
			if (item.quantityToSell <= 0) {
				errors.push(`Invalid quantity for ${item.sellItem.name}`);
			}
		}

		return {
			valid: errors.length === 0,
			errors
		};
	}

	/**
	 * Get items grouped by rarity for display
	 */
	getCartByRarity(): Map<string, SellCartItem[]> {
		const grouped = new Map<string, SellCartItem[]>();

		for (const item of this.sellCart) {
			const rarity = item.sellItem.rarity.toLowerCase();
			if (!grouped.has(rarity)) {
				grouped.set(rarity, []);
			}
			grouped.get(rarity)!.push(item);
		}

		return grouped;
	}

	/**
	 * Calculate total value in copper (useful for comparisons)
	 */
	getTotalValueInCopper(): number {
		const total = this.calculateTotal();
		return convertToCopper(total);
	}
}
