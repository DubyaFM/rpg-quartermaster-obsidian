/**
 * StrongholdTurnManager - Event Listener for Stronghold Turn Processing
 *
 * Automatically updates stronghold state when time advances:
 * - Updates neglect counters based on turns passed
 * - Completes facility orders that are due
 * - Processes turn-based effects
 *
 * Event Consumer: Subscribes to 'TimeAdvanced' events from EventBus
 */

import { EventBus } from '../EventBus';
import { StrongholdService } from '../StrongholdService';
import { FacilityService } from '../FacilityService';
import { OrderService } from '../OrderService';
import { TimeAdvancedEvent } from '../../models/types';
import { Stronghold } from '../../models/stronghold';
import { SYSTEM_EVENTS } from '../../models/events';
import { calculateTurnsPassed, calculateNeglectPenalty } from '../../calculators/strongholdTurnCalculator';
import type { CurrencyConfig } from '../../models/currency-config';

export interface StrongholdTurnManagerOptions {
	turnInterval?: number;  // Days per turn (default: 7)
	pcLevel?: number;       // Party level for grace period calculation (default: 1)
	enabled?: boolean;      // Whether turn processing is enabled (default: true)
}

export class StrongholdTurnManager {
	private unsubscribe: (() => void) | null = null;
	private options: Required<StrongholdTurnManagerOptions>;
	private activityLogService?: any;

	constructor(
		private eventBus: EventBus,
		private strongholdService: StrongholdService,
		private facilityService: FacilityService,
		private orderService: OrderService,
		private getStrongholds: () => Promise<Stronghold[]>,
		private saveStronghold: (stronghold: Stronghold) => Promise<void>,
		private config: CurrencyConfig,
		options?: StrongholdTurnManagerOptions
	) {
		// Set defaults
		this.options = {
			turnInterval: options?.turnInterval ?? 7,
			pcLevel: options?.pcLevel ?? 1,
			enabled: options?.enabled ?? true
		};
	}

	/**
	 * Set activity log service for logging order completion
	 */
	setActivityLogService(activityLogService: any): void {
		this.activityLogService = activityLogService;
	}

	/**
	 * Start listening for TimeAdvanced events
	 */
	enable(): void {
		if (this.unsubscribe) {
			return;  // Already enabled
		}

		this.unsubscribe = this.eventBus.subscribe<TimeAdvancedEvent>(
			SYSTEM_EVENTS.TIME_ADVANCED,
			this.handleTimeAdvanced.bind(this)
		);
	}

	/**
	 * Stop listening for TimeAdvanced events
	 */
	disable(): void {
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = null;
		}
	}

	/**
	 * Update party level for grace period calculations
	 */
	setPcLevel(level: number): void {
		this.options.pcLevel = level;
	}

	/**
	 * Update turn interval
	 */
	setTurnInterval(days: number): void {
		this.options.turnInterval = days;
	}

	/**
	 * Check if manager is enabled
	 */
	isEnabled(): boolean {
		return this.unsubscribe !== null;
	}

	/**
	 * Handle time advancement
	 * Called automatically when TimeAdvanced event fires
	 */
	private async handleTimeAdvanced(event: TimeAdvancedEvent): Promise<void> {
		if (!this.options.enabled) {
			return;
		}

		try {
			const strongholds = await this.getStrongholds();

			for (const stronghold of strongholds) {
				await this.processStrongholdTurn(stronghold, event.newDay);
			}
		} catch (error) {
			console.error('[StrongholdTurnManager] Error processing stronghold turns:', error);
		}
	}

	/**
	 * Process turn updates for a single stronghold
	 */
	private async processStrongholdTurn(stronghold: Stronghold, currentDay: number): Promise<void> {
		let modified = false;

		// Update calendar day in metadata
		if (stronghold.metadata.calendarDay !== currentDay) {
			stronghold.metadata.calendarDay = currentDay;
			modified = true;
		}

		// Process neglect if lastTurnDay is set
		if (stronghold.lastTurnDay !== undefined) {
			const turnsPassed = calculateTurnsPassed(
				currentDay,
				stronghold.lastTurnDay,
				this.config,
				this.options.turnInterval
			);

			if (turnsPassed > 0) {
				// Update neglect counter
				this.strongholdService.updateNeglect(stronghold, this.options.pcLevel, turnsPassed);
				modified = true;
			}
		}

		// Complete any facility orders that are due
		for (const facility of stronghold.facilities) {
			if (facility.status === 'busy' && facility.busyUntilDay !== undefined) {
				if (currentDay >= facility.busyUntilDay) {
					// Log order completion to activity log
					// Note: We don't have the original order details stored, so we log with basic info
					if (this.activityLogService) {
						const daysSpent = facility.busyUntilDay - (stronghold.lastTurnDay || 0);
						await this.activityLogService.logStrongholdOrderCompleted({
							strongholdName: stronghold.name,
							strongholdId: stronghold.id,
							orderName: 'Facility Order',  // Generic name since we don't store original order
							orderId: facility.id,  // Use facility ID as fallback
							orderType: 'facility' as const,
							facilityName: facility.name,
							daysSpent: daysSpent > 0 ? daysSpent : 1,
							results: [{
								type: 'item' as const,
								description: 'Order completed (details available in stronghold)'
							}]
						});
					}

					this.orderService.completeFacilityOrder(facility);
					modified = true;
				}
			}
		}

		// Expire any buffs that are past their expiration date
		const expiredBuffs = stronghold.activeBuffs.filter(
			buff => buff.expiresOnDay !== undefined && currentDay >= buff.expiresOnDay
		);

		if (expiredBuffs.length > 0) {
			this.strongholdService.expireBuffs(stronghold, currentDay);
			modified = true;
		}

		// Save if modified
		if (modified) {
			await this.saveStronghold(stronghold);
		}
	}

	/**
	 * Manually process all strongholds for current day
	 * Useful for initialization or manual triggers
	 */
	async processAllStrongholds(currentDay: number): Promise<void> {
		const strongholds = await this.getStrongholds();

		for (const stronghold of strongholds) {
			await this.processStrongholdTurn(stronghold, currentDay);
		}
	}
}
