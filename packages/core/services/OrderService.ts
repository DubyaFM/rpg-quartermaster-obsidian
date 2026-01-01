/**
 * OrderService - Business logic for custom order management
 * Platform-agnostic service for managing orders, execution, and results
 */

import {
	CustomOrder,
	OrderResult,
	Stronghold,
	StrongholdFacility,
	ValidationResult,
	ExecutionResult,
	StrongholdBuff
} from '../models/stronghold';
import { calculateOrderCost, calculateCompletionDay } from '../calculators/strongholdCalculators';
import type { CurrencyConfig } from '../models/currency-config';

export class OrderService {
	private orders: Map<string, CustomOrder> = new Map();
	private activityLogService?: any;
	private config: CurrencyConfig;

	constructor(config: CurrencyConfig) {
		this.config = config;
	}

	/**
	 * Set activity log service for logging order events
	 */
	setActivityLogService(activityLogService: any): void {
		this.activityLogService = activityLogService;
	}

	/**
	 * Load custom orders from provided array
	 * Typically called by adapter layer after reading YAML files
	 */
	loadOrders(orders: CustomOrder[]): void {
		this.orders.clear();
		for (const order of orders) {
			this.orders.set(order.id, order);
		}
	}

	/**
	 * Get an order by ID
	 */
	getOrder(orderId: string): CustomOrder | undefined {
		return this.orders.get(orderId);
	}

	/**
	 * Get all loaded orders
	 */
	getAllOrders(): CustomOrder[] {
		return Array.from(this.orders.values());
	}

	/**
	 * Get orders by type
	 */
	getOrdersByType(orderType: 'facility' | 'stronghold'): CustomOrder[] {
		return Array.from(this.orders.values()).filter(o => o.orderType === orderType);
	}

	/**
	 * Get orders available for a specific facility
	 * Returns orders that either have no facility restriction or include this facility ID
	 */
	getOrdersForFacility(facilityTemplateId: string): CustomOrder[] {
		return Array.from(this.orders.values()).filter(o => {
			// Stronghold-level orders are not facility-specific
			if (o.orderType === 'stronghold') {
				return false;
			}

			// If no associated facilities, order is available to all facilities
			if (!o.associatedFacilityIds || o.associatedFacilityIds.length === 0) {
				return true;
			}

			// Check if facility template is in the list
			return o.associatedFacilityIds.includes(facilityTemplateId);
		});
	}

	/**
	 * Validate order execution
	 */
	validateExecution(
		order: CustomOrder,
		facility: StrongholdFacility | null,
		stronghold: Stronghold,
		goldAvailable: number,
		variableAmount?: number
	): ValidationResult {
		const errors: string[] = [];

		// Check facility-specific orders
		if (order.orderType === 'facility' && !facility) {
			errors.push('Facility order requires a facility');
		}

		if (facility) {
			// Check facility status
			if (facility.status !== 'idle') {
				errors.push('Facility must be idle to execute orders');
			}

			// Check facility operational status
			// This would require facility service, so we skip detailed check here
			// Caller should validate this before calling
		}

		// Check gold cost
		const cost = calculateOrderCost(order, this.config, variableAmount);
		if (cost > goldAvailable) {
			errors.push(`Insufficient gold (need ${cost} gp, have ${goldAvailable} gp)`);
		}

		// Check variable cost has amount
		if (order.goldCost.type === 'variable' && variableAmount === undefined) {
			errors.push('Variable gold amount is required');
		}

		// Check neglect
		if (stronghold.neglectCounter >= 5) {
			errors.push('Stronghold is too neglected to execute orders (reduce neglect first)');
		}

		return {
			valid: errors.length === 0,
			errors
		};
	}

	/**
	 * Execute an order
	 * Returns execution result with completion day
	 */
	async executeOrder(
		order: CustomOrder,
		facility: StrongholdFacility | null,
		stronghold: Stronghold,
		currentDay: number,
		variableInputs?: Map<string, any>
	): Promise<ExecutionResult> {
		// Calculate completion day
		const completionDay = calculateCompletionDay(currentDay, order.timeRequired, this.config);

		// Calculate gold cost
		const goldCost = calculateOrderCost(order, this.config, variableInputs?.get('goldAmount'));

		// Update facility status if applicable
		if (facility) {
			facility.status = 'busy';
			facility.busyUntilDay = completionDay;
		}

		// Update stronghold last turn day
		stronghold.lastTurnDay = currentDay;

		// Log to activity log
		if (this.activityLogService) {
			await this.activityLogService.logStrongholdOrderGiven({
				strongholdName: stronghold.name,
				strongholdId: stronghold.id,
				orderName: order.name,
				orderId: order.id,
				orderType: order.orderType,
				facilityName: facility?.name,
				timeRequired: order.timeRequired,
				completionDay: completionDay,
				goldCost: `${goldCost} gp`,
			});
		}

		return {
			success: true,
			completionDay,
			results: order.results
		};
	}

	/**
	 * Process order results
	 * This is called when an order completes
	 * Returns processed results for the caller to handle
	 */
	processResults(
		results: OrderResult[],
		stronghold: Stronghold,
		currentDay: number,
		variableInputs?: Map<string, any>
	): Array<{
		type: string;
		description: string;
		data: any;
	}> {
		const processed: Array<{ type: string; description: string; data: any }> = [];

		for (const result of results) {
			switch (result.type) {
				case 'item':
					processed.push({
						type: 'item',
						description: `Add item to stash: ${result.config.itemPrompt || 'item'}`,
						data: {
							itemName: variableInputs?.get(`item_${result.id}`) || result.config.itemPrompt
						}
					});
					break;

				case 'currency':
					processed.push({
						type: 'currency',
						description: `Add ${result.config.currencyAmount} gp to stash`,
						data: {
							amount: result.config.currencyAmount || 0
						}
					});
					break;

				case 'defender':
					processed.push({
						type: 'defender',
						description: `Add ${result.config.defenderCount} defenders`,
						data: {
							count: result.config.defenderCount || 0
						}
					});
					break;

				case 'buff':
					processed.push({
						type: 'buff',
						description: `Apply buff: ${result.config.buffId}`,
						data: {
							buffId: result.config.buffId
						}
					});
					break;

				case 'event':
					processed.push({
						type: 'event',
						description: `Roll on event table: ${result.config.eventTableId}`,
						data: {
							eventTableId: result.config.eventTableId
						}
					});
					break;

				case 'morale':
					processed.push({
						type: 'morale',
						description: `Morale change: ${result.config.moraleChange}`,
						data: {
							change: result.config.moraleChange || 0
						}
					});
					break;
			}
		}

		return processed;
	}

	/**
	 * Complete an order for a facility
	 * Sets facility back to idle
	 */
	completeFacilityOrder(facility: StrongholdFacility): void {
		facility.status = 'idle';
		facility.busyUntilDay = undefined;
	}

	/**
	 * Cancel a facility order (set back to idle without completion)
	 * Note: This feature was removed from the plan, but included for completeness
	 */
	cancelFacilityOrder(facility: StrongholdFacility): void {
		facility.status = 'idle';
		facility.busyUntilDay = undefined;
	}

	/**
	 * Search orders by name
	 */
	searchOrders(query: string): CustomOrder[] {
		const lowerQuery = query.toLowerCase();
		return Array.from(this.orders.values()).filter(o =>
			o.name.toLowerCase().includes(lowerQuery) ||
			o.description.toLowerCase().includes(lowerQuery)
		);
	}

	/**
	 * Get orders by cost type
	 */
	getOrdersByCostType(costType: 'none' | 'constant' | 'variable'): CustomOrder[] {
		return Array.from(this.orders.values()).filter(o => o.goldCost.type === costType);
	}

	/**
	 * Get orders with specific result types
	 */
	getOrdersByResultType(resultType: OrderResult['type']): CustomOrder[] {
		return Array.from(this.orders.values()).filter(o =>
			o.results.some(r => r.type === resultType)
		);
	}

	/**
	 * Add or update an order
	 */
	addOrder(order: CustomOrder): void {
		this.orders.set(order.id, order);
	}

	/**
	 * Remove an order
	 */
	removeOrder(orderId: string): boolean {
		return this.orders.delete(orderId);
	}

	/**
	 * Check if an order exists
	 */
	hasOrder(orderId: string): boolean {
		return this.orders.has(orderId);
	}

	/**
	 * Get order count
	 */
	getOrderCount(): number {
		return this.orders.size;
	}

	/**
	 * Clear all orders
	 */
	clearOrders(): void {
		this.orders.clear();
	}

	/**
	 * Validate order structure
	 */
	validateOrder(order: CustomOrder): ValidationResult {
		const errors: string[] = [];

		if (!order.id || order.id.trim() === '') {
			errors.push('Order ID is required');
		}

		if (!order.name || order.name.trim() === '') {
			errors.push('Order name is required');
		}

		if (order.timeRequired < 0) {
			errors.push('Time required cannot be negative');
		}

		// Validate cost
		if (order.goldCost.type === 'constant' && (order.goldCost.amount === undefined || order.goldCost.amount < 0)) {
			errors.push('Constant cost must be a non-negative number');
		}

		if (order.goldCost.type === 'variable' && !order.goldCost.prompt) {
			errors.push('Variable cost requires a prompt');
		}

		// Validate results
		if (!order.results || order.results.length === 0) {
			errors.push('Order must have at least one result');
		}

		// Validate each result
		for (const result of order.results) {
			const resultErrors = this.validateOrderResult(result);
			errors.push(...resultErrors);
		}

		return {
			valid: errors.length === 0,
			errors
		};
	}

	/**
	 * Validate a single order result
	 */
	private validateOrderResult(result: OrderResult): string[] {
		const errors: string[] = [];

		if (!result.id) {
			errors.push('Result ID is required');
		}

		switch (result.type) {
			case 'item':
				if (!result.config.itemPrompt) {
					errors.push('Item result requires itemPrompt');
				}
				break;

			case 'currency':
				if (result.config.currencyAmount === undefined || result.config.currencyAmount < 0) {
					errors.push('Currency result requires non-negative currencyAmount');
				}
				break;

			case 'defender':
				if (result.config.defenderCount === undefined || result.config.defenderCount < 0) {
					errors.push('Defender result requires non-negative defenderCount');
				}
				break;

			case 'buff':
				if (!result.config.buffId) {
					errors.push('Buff result requires buffId');
				}
				break;

			case 'event':
				if (!result.config.eventTableId) {
					errors.push('Event result requires eventTableId');
				}
				break;

			case 'morale':
				if (result.config.moraleChange === undefined) {
					errors.push('Morale result requires moraleChange value');
				}
				break;
		}

		return errors;
	}

	/**
	 * Get estimated completion time for an order
	 */
	getEstimatedCompletion(order: CustomOrder, currentDay: number): number {
		return calculateCompletionDay(currentDay, order.timeRequired, this.config);
	}

	/**
	 * Check if an order is available for the current PC level
	 * This is a helper for UI filtering
	 */
	isOrderAvailableForLevel(order: CustomOrder, pcLevel: number): boolean {
		// Orders don't have level requirements in the current design
		// This is here for potential future use
		return true;
	}
}
