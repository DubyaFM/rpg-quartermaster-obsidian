/**
 * HirelingManager - Business logic for hireling employment tracking
 * Platform-agnostic service for managing hirelings
 */

import {
	HirelingEmployment,
	HirelingType,
	PaymentSchedule,
	Morale,
	DEFAULT_WAGES,
	LOYALTY_THRESHOLDS,
	MORALE_LOYALTY_MODIFIERS
} from '../models/hireling';
import { Currency } from '../models/types';
import type { CurrencyConfig } from '../models/currency-config.js';
import { addCurrency, multiplyCurrency } from '../calculators/currency';

export class HirelingManager {
	private config: CurrencyConfig;

	/**
	 * Initialize HirelingManager with currency configuration
	 * @param config Currency configuration defining denominations and conversion rates
	 */
	constructor(config: CurrencyConfig) {
		this.config = config;
	}
	/**
	 * Calculate next payment date based on payment schedule
	 */
	calculateNextPayment(lastPaid: string, schedule: PaymentSchedule): string {
		const lastPaidDate = new Date(lastPaid);

		switch (schedule) {
			case 'daily':
				lastPaidDate.setDate(lastPaidDate.getDate() + 1);
				break;
			case 'weekly':
				lastPaidDate.setDate(lastPaidDate.getDate() + 7);
				break;
			case 'monthly':
				lastPaidDate.setMonth(lastPaidDate.getMonth() + 1);
				break;
		}

		return lastPaidDate.toISOString();
	}

	/**
	 * Calculate total wages owed based on days since last payment
	 * @param dailyWage Daily wage amount (in active currency system)
	 * @param lastPaid ISO date string of last payment
	 * @param currentDate ISO date string for calculation (default: today)
	 * @returns Wages owed amount and number of days elapsed
	 */
	calculateWagesOwed(
		dailyWage: Currency,
		lastPaid: string,
		currentDate: string = new Date().toISOString()
	): { amount: Currency; daysPassed: number } {
		const lastPaidDate = new Date(lastPaid);
		const current = new Date(currentDate);

		const daysPassed = Math.floor(
			(current.getTime() - lastPaidDate.getTime()) / (1000 * 60 * 60 * 24)
		);

		const amount = multiplyCurrency(dailyWage, daysPassed, this.config);

		return { amount, daysPassed };
	}

	/**
	 * Process payment for a hireling
	 */
	processPayment(hireling: HirelingEmployment, currentDate: string = new Date().toISOString()): {
		hireling: HirelingEmployment;
		amountPaid: Currency;
		loyaltyChange: number;
	} {
		const dailyWage = this.getDailyWage(hireling.wages, hireling.paymentSchedule);
		const { amount, daysPassed } = this.calculateWagesOwed(dailyWage, hireling.lastPaid, currentDate);

		// Update payment dates
		hireling.lastPaid = currentDate;
		hireling.nextPayment = this.calculateNextPayment(currentDate, hireling.paymentSchedule);

		// Calculate loyalty impact
		let loyaltyChange = 0;

		// Paid on time: +2 loyalty
		const onTime = new Date(currentDate) <= new Date(hireling.nextPayment);
		if (onTime) {
			loyaltyChange += 2;
		} else {
			// Late payment: -5 loyalty per week late
			const weeksLate = Math.floor(daysPassed / 7);
			loyaltyChange -= weeksLate * 5;
		}

		// Update loyalty
		hireling.loyalty = Math.max(0, Math.min(100, hireling.loyalty + loyaltyChange));

		// Update morale based on new loyalty
		hireling.morale = this.calculateMorale(hireling.loyalty);

		return {
			hireling,
			amountPaid: amount,
			loyaltyChange
		};
	}

	/**
	 * Get daily wage from wage amount and payment schedule
	 */
	getDailyWage(wages: Currency, schedule: PaymentSchedule): Currency {
		switch (schedule) {
			case 'daily':
				return wages;
			case 'weekly':
				// Divide by 7
				return {
					copper: Math.floor(wages.copper / 7),
					silver: Math.floor(wages.silver / 7),
					gold: Math.floor(wages.gold / 7),
					platinum: Math.floor(wages.platinum / 7)
				};
			case 'monthly':
				// Divide by 30
				return {
					copper: Math.floor(wages.copper / 30),
					silver: Math.floor(wages.silver / 30),
					gold: Math.floor(wages.gold / 30),
					platinum: Math.floor(wages.platinum / 30)
				};
		}
	}

	/**
	 * Calculate morale from loyalty score
	 */
	calculateMorale(loyalty: number): Morale {
		if (loyalty < LOYALTY_THRESHOLDS.LOW) {
			return 'low';
		} else if (loyalty > LOYALTY_THRESHOLDS.STABLE) {
			return 'high';
		}
		return 'stable';
	}

	/**
	 * Update loyalty based on morale (weekly decay/growth)
	 */
	updateLoyaltyFromMorale(hireling: HirelingEmployment): number {
		const change = MORALE_LOYALTY_MODIFIERS[hireling.morale];
		hireling.loyalty = Math.max(0, Math.min(100, hireling.loyalty + change));
		hireling.morale = this.calculateMorale(hireling.loyalty);
		return change;
	}

	/**
	 * Check if hireling should resign based on loyalty and morale
	 */
	shouldResign(hireling: HirelingEmployment): boolean {
		// Very low loyalty: high chance of resignation
		if (hireling.loyalty < 10) {
			return Math.random() < 0.5; // 50% chance
		}

		// Low morale and low loyalty
		if (hireling.morale === 'low' && hireling.loyalty < 20) {
			return Math.random() < 0.25; // 25% chance
		}

		return false;
	}

	/**
	 * Apply loyalty modifier (for events, gifts, mistreatment, etc.)
	 */
	modifyLoyalty(hireling: HirelingEmployment, change: number, reason?: string): {
		hireling: HirelingEmployment;
		previousLoyalty: number;
		newLoyalty: number;
	} {
		const previousLoyalty = hireling.loyalty;
		hireling.loyalty = Math.max(0, Math.min(100, hireling.loyalty + change));
		hireling.morale = this.calculateMorale(hireling.loyalty);

		return {
			hireling,
			previousLoyalty,
			newLoyalty: hireling.loyalty
		};
	}

	/**
	 * Get all hirelings that need payment today
	 */
	getHirelingsDuePayment(hirelings: HirelingEmployment[], currentDate: string = new Date().toISOString()): HirelingEmployment[] {
		const current = new Date(currentDate);
		current.setHours(0, 0, 0, 0); // Normalize to start of day

		return hirelings.filter(h => {
			if (h.status !== 'active') return false;

			const nextPayment = new Date(h.nextPayment);
			nextPayment.setHours(0, 0, 0, 0);

			return nextPayment <= current;
		});
	}

	/**
	 * Calculate total weekly cost for all hirelings
	 * @param hirelings List of hirelings to sum wages for
	 * @returns Total weekly cost in active currency system
	 */
	calculateWeeklyCost(hirelings: HirelingEmployment[]): Currency {
		let total: Currency = { cp: 0, sp: 0, gp: 0, pp: 0 };

		for (const hireling of hirelings) {
			if (hireling.status !== 'active') continue;

			const dailyWage = this.getDailyWage(hireling.wages, hireling.paymentSchedule);
			const weeklyCost = multiplyCurrency(dailyWage, 7, this.config);
			total = addCurrency(total, weeklyCost, this.config);
		}

		return total;
	}

	/**
	 * Get default wages for a hireling type
	 * @param type The type of hireling (e.g., 'soldier', 'guide')
	 * @param schedule Payment frequency (daily, weekly, monthly)
	 * @returns Default wage for the type adjusted for payment schedule
	 */
	getDefaultWages(type: HirelingType, schedule: PaymentSchedule): Currency {
		const daily = DEFAULT_WAGES[type];

		switch (schedule) {
			case 'daily':
				return daily;
			case 'weekly':
				return multiplyCurrency(daily, 7, this.config);
			case 'monthly':
				return multiplyCurrency(daily, 30, this.config);
		}
	}

	/**
	 * Create a new hireling employment record
	 */
	createHirelingRecord(
		npcLink: string,
		type: HirelingType,
		employer: string,
		options?: {
			wages?: Currency;
			paymentSchedule?: PaymentSchedule;
			duties?: string[];
			restrictions?: string[];
			startingLoyalty?: number;
		}
	): HirelingEmployment {
		const schedule = options?.paymentSchedule || 'weekly';
		const wages = options?.wages || this.getDefaultWages(type, schedule);
		const hireDate = new Date().toISOString();

		return {
			hirelingId: `hire-${Date.now()}-${Math.random().toString(36).substring(7)}`,
			npc: npcLink,
			type,
			employer,
			hireDate,
			wages,
			paymentSchedule: schedule,
			lastPaid: hireDate,
			nextPayment: this.calculateNextPayment(hireDate, schedule),
			duties: options?.duties || [],
			restrictions: options?.restrictions,
			loyalty: options?.startingLoyalty || 50,
			morale: 'stable',
			availability: 'available',
			status: 'active'
		};
	}
}
