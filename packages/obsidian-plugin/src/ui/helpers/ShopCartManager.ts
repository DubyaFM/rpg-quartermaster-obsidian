// Manages shopping cart operations
import { PurchasedItem, ShopItem, ItemCost } from '@quartermaster/core/models/types';
import { multiplyCurrency, formatCurrency, addCurrency, convertToCopper } from '@quartermaster/core/calculators/currency';
import type { CurrencyConfig } from '@quartermaster/core/models/currency-config';
import { DEFAULT_CURRENCY_CONFIG } from '@quartermaster/core/data/defaultCurrencyConfig';

export class ShopCartManager {
	cart: PurchasedItem[] = [];

	addToCart(item: ShopItem, quantity: number, purchasedBy?: string, isSale: boolean = false): void {
		const existingItem = this.cart.find(i => i.name === item.name && i.purchasedBy === purchasedBy && i.isSale === isSale);

		if (existingItem) {
			existingItem.quantity += quantity;
			existingItem.totalCost = multiplyCurrency(existingItem.cost, existingItem.quantity, DEFAULT_CURRENCY_CONFIG);
		} else {
			const totalCost = multiplyCurrency(item.cost, quantity, DEFAULT_CURRENCY_CONFIG);
			this.cart.push({
				...item,
				quantity,
				totalCost,
				purchasedBy,
				isSale
			});
		}
	}

	removeFromCart(item: PurchasedItem): void {
		this.cart = this.cart.filter(i => i !== item);
	}

	clearCart(): void {
		this.cart = [];
	}

	getCartTotal(): ItemCost {
		return this.cart.reduce((total, item) => {
			if (item.isSale) {
				// Subtract sales (negative cost)
				const itemCopper = -convertToCopper(item.totalCost);
				return addCurrency(total, { copper: itemCopper, silver: 0, gold: 0, platinum: 0 }, DEFAULT_CURRENCY_CONFIG);
			} else {
				return addCurrency(total, item.totalCost, DEFAULT_CURRENCY_CONFIG);
			}
		}, { copper: 0, silver: 0, gold: 0, platinum: 0 });
	}

	getCartTotalInCopper(): number {
		const total = this.getCartTotal();
		return convertToCopper(total);
	}

	getCartItems(): PurchasedItem[] {
		return [...this.cart];
	}

	getCartItemCount(): number {
		return this.cart.reduce((sum, item) => sum + item.quantity, 0);
	}

	hasItems(): boolean {
		return this.cart.length > 0;
	}
}
