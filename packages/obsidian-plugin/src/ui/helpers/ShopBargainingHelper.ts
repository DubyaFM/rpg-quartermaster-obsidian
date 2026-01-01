// Handles bargaining logic and discount calculations
import { ShopItem, Shopkeep, ItemCost } from '@quartermaster/core/models/types';
import { CurrencyConfig } from '@quartermaster/core/models/currency-config';
import { applySmartDiscount } from '@quartermaster/core/calculators/currency';

export class ShopBargainingHelper {
	private bargainApplied: boolean = false;
	private config: CurrencyConfig;

	constructor(config: CurrencyConfig) {
		this.config = config;
	}

	applyBargainDiscount(item: ShopItem, shopkeep: Shopkeep, discountPercent: number): void {
		if (this.bargainApplied) return;

		item.costOverride = applySmartDiscount(item.cost, discountPercent, this.config);
		this.bargainApplied = true;
	}

	getBulkDiscount(disposition: string): number {
		const discounts: Record<string, number> = {
			hostile: 5,
			unfriendly: 8,
			neutral: 10,
			friendly: 15,
			helpful: 20
		};
		return discounts[disposition] || 10;
	}

	applyBulkDiscount(item: ShopItem, quantity: number, disposition: string): ItemCost {
		if (quantity < 3) return item.costOverride || item.cost;

		const discount = this.getBulkDiscount(disposition);
		return applySmartDiscount(item.costOverride || item.cost, discount, this.config);
	}

	getBargainDiscountPercent(dc: number): number {
		const discountMap: Record<number, number> = {
			5: 25,
			10: 20,
			15: 15,
			18: 10,
			20: 5
		};
		return discountMap[dc] || 10;
	}

	isBargainApplied(): boolean {
		return this.bargainApplied;
	}

	resetBargain(): void {
		this.bargainApplied = false;
	}
}
