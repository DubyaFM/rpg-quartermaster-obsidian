/**
 * StrongholdHirelingService - Business logic for stronghold hireling management
 * Platform-agnostic service for managing hirelings assigned to strongholds
 * Separate from the general HirelingManager which handles employment tracking
 */

import { Hireling, PaymentResult } from '../models/stronghold';

export class StrongholdHirelingService {
	/**
	 * Create a new hireling record
	 */
	createHireling(
		name: string,
		role: string,
		paymentSchedule: 'none' | 'manual' | 'daily' | 'weekly',
		paymentAmount: { gold: number; silver: number; copper: number },
		options?: {
			statBlock?: string;
			personalityNotes?: string;
			moraleValue?: number;
			moraleScale?: { min: number; max: number; labels?: { [threshold: number]: string } };
			paymentType?: 'mercenary' | 'stronghold_staff';
		}
	): Hireling {
		const now = new Date().toISOString();

		// Default morale scale: 0-20
		const moraleScale = options?.moraleScale || {
			min: 0,
			max: 20,
			labels: {
				0: 'Hostile',
				5: 'Unfriendly',
				10: 'Neutral',
				15: 'Friendly',
				20: 'Loyal'
			}
		};

		return {
			id: `hireling-${Date.now()}-${Math.random().toString(36).substring(7)}`,
			identity: {
				name,
				role,
				status: 'at_stronghold'
			},
			mechanics: {
				statBlock: options?.statBlock,
				personalityNotes: options?.personalityNotes
			},
			morale: {
				value: options?.moraleValue !== undefined ? options.moraleValue : moraleScale.max / 2,
				scale: moraleScale,
				notes: undefined
			},
			payment: {
				type: options?.paymentType || 'stronghold_staff',
				schedule: paymentSchedule,
				amount: paymentAmount
			},
			assignedStrongholdId: undefined,
			assignedFacilityId: undefined,
			lastPaymentDay: undefined,
			metadata: {
				createdDate: now,
				lastModified: now
			}
		};
	}

	/**
	 * Assign a hireling to a stronghold
	 */
	assignToStronghold(hireling: Hireling, strongholdId: string): void {
		hireling.assignedStrongholdId = strongholdId;
		hireling.assignedFacilityId = undefined; // Clear facility assignment
		hireling.metadata.lastModified = new Date().toISOString();
	}

	/**
	 * Assign a hireling to a specific facility within a stronghold
	 */
	assignToFacility(hireling: Hireling, strongholdId: string, facilityId: string): void {
		hireling.assignedStrongholdId = strongholdId;
		hireling.assignedFacilityId = facilityId;
		hireling.metadata.lastModified = new Date().toISOString();
	}

	/**
	 * Unassign a hireling from all assignments
	 */
	unassign(hireling: Hireling): void {
		hireling.assignedStrongholdId = undefined;
		hireling.assignedFacilityId = undefined;
		hireling.metadata.lastModified = new Date().toISOString();
	}

	/**
	 * Update hireling morale
	 */
	updateMorale(hireling: Hireling, change: number): void {
		const newValue = hireling.morale.value + change;

		// Clamp to scale range
		hireling.morale.value = Math.max(
			hireling.morale.scale.min,
			Math.min(hireling.morale.scale.max, newValue)
		);

		hireling.metadata.lastModified = new Date().toISOString();
	}

	/**
	 * Set hireling morale to a specific value
	 */
	setMorale(hireling: Hireling, value: number): void {
		hireling.morale.value = Math.max(
			hireling.morale.scale.min,
			Math.min(hireling.morale.scale.max, value)
		);

		hireling.metadata.lastModified = new Date().toISOString();
	}

	/**
	 * Get morale label for current morale value
	 */
	getMoraleLabel(hireling: Hireling): string {
		if (!hireling.morale.scale.labels) {
			return 'Unknown';
		}

		const labels = hireling.morale.scale.labels;
		const thresholds = Object.keys(labels)
			.map(Number)
			.sort((a, b) => b - a); // Sort descending

		for (const threshold of thresholds) {
			if (hireling.morale.value >= threshold) {
				return labels[threshold];
			}
		}

		return 'Unknown';
	}

	/**
	 * Set hireling status
	 */
	setStatus(hireling: Hireling, status: 'at_stronghold' | 'missing' | 'deceased'): void {
		hireling.identity.status = status;
		hireling.metadata.lastModified = new Date().toISOString();

		// If missing or deceased, unassign from facilities
		if (status === 'missing' || status === 'deceased') {
			hireling.assignedFacilityId = undefined;
		}
	}

	/**
	 * Check if hireling needs payment
	 */
	needsPayment(hireling: Hireling, currentDay: number): boolean {
		// No payment schedule = no payment needed
		if (hireling.payment.schedule === 'none' || hireling.payment.schedule === 'manual') {
			return false;
		}

		// Not assigned = no payment needed
		if (!hireling.assignedStrongholdId) {
			return false;
		}

		// Check if payment is due based on schedule
		if (hireling.lastPaymentDay === undefined) {
			// Never paid - payment due
			return true;
		}

		const daysSincePayment = currentDay - hireling.lastPaymentDay;

		switch (hireling.payment.schedule) {
			case 'daily':
				return daysSincePayment >= 1;
			case 'weekly':
				return daysSincePayment >= 7;
			default:
				return false;
		}
	}

	/**
	 * Process payment for a hireling
	 * Returns the payment amount
	 */
	processPayment(hireling: Hireling, currentDay: number): {
		gold: number;
		silver: number;
		copper: number;
	} {
		hireling.lastPaymentDay = currentDay;
		hireling.metadata.lastModified = new Date().toISOString();

		return { ...hireling.payment.amount };
	}

	/**
	 * Process payments for all hirelings in a list
	 * Returns list of payment results
	 */
	processPayments(
		hirelings: Hireling[],
		currentDay: number
	): PaymentResult[] {
		const results: PaymentResult[] = [];

		for (const hireling of hirelings) {
			if (this.needsPayment(hireling, currentDay)) {
				const amount = this.processPayment(hireling, currentDay);

				results.push({
					hirelingId: hireling.id,
					hirelingName: hireling.identity.name,
					paid: true,
					amount
				});
			}
		}

		return results;
	}

	/**
	 * Get all hirelings assigned to a stronghold
	 */
	getHirelingsForStronghold(hirelings: Hireling[], strongholdId: string): Hireling[] {
		return hirelings.filter(h => h.assignedStrongholdId === strongholdId);
	}

	/**
	 * Get all hirelings assigned to a specific facility
	 */
	getHirelingsForFacility(hirelings: Hireling[], facilityId: string): Hireling[] {
		return hirelings.filter(h => h.assignedFacilityId === facilityId);
	}

	/**
	 * Get all unassigned hirelings
	 */
	getUnassignedHirelings(hirelings: Hireling[]): Hireling[] {
		return hirelings.filter(h => !h.assignedStrongholdId);
	}

	/**
	 * Get all hirelings at stronghold (status: at_stronghold)
	 */
	getAvailableHirelings(hirelings: Hireling[]): Hireling[] {
		return hirelings.filter(h => h.identity.status === 'at_stronghold');
	}

	/**
	 * Check if a hireling is assigned to a facility
	 */
	isAssignedToFacility(hireling: Hireling): boolean {
		return hireling.assignedFacilityId !== undefined;
	}

	/**
	 * Check if a hireling is assigned to any stronghold
	 */
	isAssignedToStronghold(hireling: Hireling): boolean {
		return hireling.assignedStrongholdId !== undefined;
	}

	/**
	 * Update hireling payment details
	 */
	updatePayment(
		hireling: Hireling,
		schedule: 'none' | 'manual' | 'daily' | 'weekly',
		amount: { gold: number; silver: number; copper: number }
	): void {
		hireling.payment.schedule = schedule;
		hireling.payment.amount = amount;
		hireling.metadata.lastModified = new Date().toISOString();
	}

	/**
	 * Update hireling identity
	 */
	updateIdentity(
		hireling: Hireling,
		updates: Partial<{ name: string; role: string }>
	): void {
		if (updates.name !== undefined) {
			hireling.identity.name = updates.name;
		}
		if (updates.role !== undefined) {
			hireling.identity.role = updates.role;
		}
		hireling.metadata.lastModified = new Date().toISOString();
	}

	/**
	 * Update hireling mechanics
	 */
	updateMechanics(
		hireling: Hireling,
		updates: Partial<{ statBlock: string; personalityNotes: string }>
	): void {
		if (updates.statBlock !== undefined) {
			hireling.mechanics.statBlock = updates.statBlock;
		}
		if (updates.personalityNotes !== undefined) {
			hireling.mechanics.personalityNotes = updates.personalityNotes;
		}
		hireling.metadata.lastModified = new Date().toISOString();
	}

	/**
	 * Update morale notes
	 */
	updateMoraleNotes(hireling: Hireling, notes: string): void {
		hireling.morale.notes = notes;
		hireling.metadata.lastModified = new Date().toISOString();
	}

	/**
	 * Validate hireling structure
	 */
	validateHireling(hireling: Hireling): { valid: boolean; errors: string[] } {
		const errors: string[] = [];

		if (!hireling.identity.name || hireling.identity.name.trim() === '') {
			errors.push('Hireling name is required');
		}

		if (!hireling.identity.role || hireling.identity.role.trim() === '') {
			errors.push('Hireling role is required');
		}

		if (hireling.morale.value < hireling.morale.scale.min || hireling.morale.value > hireling.morale.scale.max) {
			errors.push('Morale value must be within scale range');
		}

		if (hireling.morale.scale.min >= hireling.morale.scale.max) {
			errors.push('Morale scale minimum must be less than maximum');
		}

		if (hireling.payment.amount.gold < 0 || hireling.payment.amount.silver < 0 || hireling.payment.amount.copper < 0) {
			errors.push('Payment amounts cannot be negative');
		}

		return {
			valid: errors.length === 0,
			errors
		};
	}

	/**
	 * Calculate total weekly payment cost for all hirelings
	 */
	calculateWeeklyCost(hirelings: Hireling[]): { gold: number; silver: number; copper: number } {
		let totalGold = 0;
		let totalSilver = 0;
		let totalCopper = 0;

		for (const hireling of hirelings) {
			if (hireling.identity.status !== 'at_stronghold' || !hireling.assignedStrongholdId) {
				continue;
			}

			const { gold, silver, copper } = hireling.payment.amount;

			switch (hireling.payment.schedule) {
				case 'daily':
					totalGold += gold * 7;
					totalSilver += silver * 7;
					totalCopper += copper * 7;
					break;
				case 'weekly':
					totalGold += gold;
					totalSilver += silver;
					totalCopper += copper;
					break;
				// none and manual don't contribute to automated costs
			}
		}

		return { gold: totalGold, silver: totalSilver, copper: totalCopper };
	}
}
