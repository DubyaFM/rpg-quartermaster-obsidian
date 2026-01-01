// Order Manager Helper
// Handles special order placement and tracking
// Kept under 150 lines for maintainability

import { Item, Order, ItemCost } from '@quartermaster/core/models/types';
import {
	createOrder,
	calculateOrderPrice,
	calculateCraftingTime,
	formatCraftingTime,
	isOrderReady,
	getReadyOrders,
	getPendingOrders
} from '@quartermaster/core/calculators/orders';
import { IRandomizer } from '@quartermaster/core/interfaces/IRandomizer';
import type { CurrencyConfig } from '@quartermaster/core/models/currency-config';
import { DEFAULT_CURRENCY_CONFIG } from '@quartermaster/core/data/defaultCurrencyConfig';

export class OrderManager {
	private orders: Order[] = [];

	/**
	 * Place a new order
	 * @param randomizer Randomizer for crafting time rolls
	 * @param item Item to order
	 * @param shopName Shop placing the order
	 * @param shopkeeper Optional shopkeeper name
	 * @returns Created order
	 */
	placeOrder(
		randomizer: IRandomizer,
		item: Item,
		shopName: string,
		shopkeeper?: string
	): Order {
		const order = createOrder(randomizer, item, shopName, DEFAULT_CURRENCY_CONFIG, shopkeeper);
		this.orders.push(order);
		return order;
	}

	/**
	 * Get all orders
	 */
	getAllOrders(): Order[] {
		return this.orders;
	}

	/**
	 * Get orders that are ready for pickup
	 */
	getReadyOrders(): Order[] {
		return getReadyOrders(this.orders);
	}

	/**
	 * Get orders still being crafted
	 */
	getPendingOrders(): Order[] {
		return getPendingOrders(this.orders);
	}

	/**
	 * Mark an order as completed/picked up
	 */
	completeOrder(orderIndex: number): void {
		if (this.orders[orderIndex]) {
			this.orders[orderIndex].status = 'completed';
		}
	}

	/**
	 * Remove an order (cancel it)
	 */
	cancelOrder(orderIndex: number): void {
		this.orders.splice(orderIndex, 1);
	}

	/**
	 * Check if a specific order is ready
	 */
	isOrderReady(order: Order): boolean {
		return isOrderReady(order);
	}

	/**
	 * Get formatted time remaining for an order
	 */
	getTimeRemaining(order: Order): string {
		const now = new Date();
		const completion = new Date(order.completionDate);
		const diff = completion.getTime() - now.getTime();

		if (diff <= 0) {
			return 'Ready for pickup!';
		}

		const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
		return formatCraftingTime(days);
	}

	/**
	 * Calculate order price (50% markup)
	 */
	calculatePrice(item: Item): ItemCost {
		return calculateOrderPrice(item, DEFAULT_CURRENCY_CONFIG);
	}

	/**
	 * Calculate crafting time for preview
	 */
	previewCraftingTime(randomizer: IRandomizer, item: Item): string {
		const days = calculateCraftingTime(randomizer, item);
		return formatCraftingTime(days);
	}

	/**
	 * Get count of ready orders
	 */
	getReadyCount(): number {
		return this.getReadyOrders().length;
	}

	/**
	 * Get count of pending orders
	 */
	getPendingCount(): number {
		return this.getPendingOrders().length;
	}

	/**
	 * Clear all completed orders
	 */
	clearCompleted(): void {
		this.orders = this.orders.filter(order => order.status !== 'completed');
	}
}
