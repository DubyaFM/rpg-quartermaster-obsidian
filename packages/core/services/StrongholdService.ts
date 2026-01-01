/**
 * StrongholdService - Business logic for stronghold management
 * Platform-agnostic service for managing strongholds, buffs, and defenders
 */

import {
	Stronghold,
	StrongholdFacility,
	StrongholdBuff,
	SpecialDefender,
	Ownership
} from '../models/stronghold';
import { calculateNeglectPenalty } from '../calculators/strongholdTurnCalculator';
import type { CurrencyConfig } from '../models/currency-config';

export class StrongholdService {
	private config: CurrencyConfig;

	constructor(config: CurrencyConfig) {
		this.config = config;
	}
	/**
	 * Create a new stronghold
	 * @param currentDay Optional current calendar day for initialization
	 */
	createStronghold(
		name: string,
		ownership: Ownership,
		location?: string,
		initialDefenders?: { basic: number; special: SpecialDefender[] },
		currentDay?: number
	): Stronghold {
		const now = new Date().toISOString();

		return {
			id: `stronghold-${Date.now()}-${Math.random().toString(36).substring(7)}`,
			name,
			ownership,
			location,
			defenders: {
				basic: {
					current: initialDefenders?.basic || 0,
					maximum: initialDefenders?.basic || 0  // Maximum equals initial count
				},
				special: initialDefenders?.special || []
			},
			stashInventoryFile: `${name}-Stash.md`.replace(/[^a-zA-Z0-9-]/g, '_'),
			facilities: [],
			activeBuffs: [],
			neglectCounter: 0,
			lastTurnDay: currentDay,  // Initialize to current day if provided
			metadata: {
				createdDate: now,
				lastModified: now,
				calendarDay: currentDay
			}
		};
	}

	/**
	 * Add a facility to a stronghold
	 * Prevents duplicate facility IDs
	 */
	addFacility(stronghold: Stronghold, facility: StrongholdFacility): void {
		// Check if facility with same ID already exists
		const exists = stronghold.facilities.some(f => f.id === facility.id);
		if (exists) {
			return; // Don't add duplicates
		}

		stronghold.facilities.push(facility);
		stronghold.metadata.lastModified = new Date().toISOString();
	}

	/**
	 * Remove a facility from a stronghold
	 */
	removeFacility(stronghold: Stronghold, facilityId: string): boolean {
		const index = stronghold.facilities.findIndex(f => f.id === facilityId);
		if (index === -1) {
			return false;
		}

		stronghold.facilities.splice(index, 1);
		stronghold.metadata.lastModified = new Date().toISOString();
		return true;
	}

	/**
	 * Get a facility by ID
	 */
	getFacility(stronghold: Stronghold, facilityId: string): StrongholdFacility | undefined {
		return stronghold.facilities.find(f => f.id === facilityId);
	}

	/**
	 * Apply a buff to a stronghold
	 */
	applyBuff(stronghold: Stronghold, buff: StrongholdBuff): void {
		stronghold.activeBuffs.push(buff);
		stronghold.metadata.lastModified = new Date().toISOString();
	}

	/**
	 * Remove a buff from a stronghold
	 */
	removeBuff(stronghold: Stronghold, buffId: string): boolean {
		const index = stronghold.activeBuffs.findIndex(b => b.id === buffId);
		if (index === -1) {
			return false;
		}

		stronghold.activeBuffs.splice(index, 1);
		stronghold.metadata.lastModified = new Date().toISOString();
		return true;
	}

	/**
	 * Expire buffs that have reached their expiration day
	 */
	expireBuffs(stronghold: Stronghold, currentDay: number): StrongholdBuff[] {
		const expiredBuffs: StrongholdBuff[] = [];

		stronghold.activeBuffs = stronghold.activeBuffs.filter(buff => {
			if (buff.expiresOnDay !== undefined && currentDay >= buff.expiresOnDay) {
				expiredBuffs.push(buff);
				return false;
			}
			return true;
		});

		if (expiredBuffs.length > 0) {
			stronghold.metadata.lastModified = new Date().toISOString();
		}

		return expiredBuffs;
	}

	/**
	 * Add basic defenders to a stronghold
	 * Increases both current count and maximum capacity
	 */
	addDefenders(stronghold: Stronghold, count: number): void {
		stronghold.defenders.basic.current += count;
		stronghold.defenders.basic.maximum += count;
		stronghold.metadata.lastModified = new Date().toISOString();
	}

	/**
	 * Remove basic defenders from a stronghold
	 * Decreases both current count and maximum capacity
	 */
	removeDefenders(stronghold: Stronghold, count: number): void {
		stronghold.defenders.basic.current = Math.max(
			stronghold.defenders.basic.current - count,
			0
		);
		stronghold.defenders.basic.maximum = Math.max(
			stronghold.defenders.basic.maximum - count,
			0
		);
		stronghold.metadata.lastModified = new Date().toISOString();
	}

	/**
	 * Set the maximum defender capacity
	 */
	setMaxDefenders(stronghold: Stronghold, maximum: number): void {
		stronghold.defenders.basic.maximum = maximum;
		// Adjust current if it exceeds new maximum
		if (stronghold.defenders.basic.current > maximum) {
			stronghold.defenders.basic.current = maximum;
		}
		stronghold.metadata.lastModified = new Date().toISOString();
	}

	/**
	 * Add a special defender to a stronghold
	 */
	addSpecialDefender(stronghold: Stronghold, defender: SpecialDefender): void {
		stronghold.defenders.special.push(defender);
		stronghold.metadata.lastModified = new Date().toISOString();
	}

	/**
	 * Update a special defender
	 */
	updateSpecialDefender(
		stronghold: Stronghold,
		defenderId: string,
		updates: Partial<Omit<SpecialDefender, 'id'>>
	): boolean {
		const defender = stronghold.defenders.special.find(d => d.id === defenderId);
		if (!defender) {
			return false;
		}

		Object.assign(defender, updates);
		stronghold.metadata.lastModified = new Date().toISOString();
		return true;
	}

	/**
	 * Remove a special defender from a stronghold
	 */
	removeSpecialDefender(stronghold: Stronghold, defenderId: string): boolean {
		const index = stronghold.defenders.special.findIndex(d => d.id === defenderId);
		if (index === -1) {
			return false;
		}

		stronghold.defenders.special.splice(index, 1);
		stronghold.metadata.lastModified = new Date().toISOString();
		return true;
	}

	/**
	 * Get a special defender by ID
	 */
	getSpecialDefender(stronghold: Stronghold, defenderId: string): SpecialDefender | undefined {
		return stronghold.defenders.special.find(d => d.id === defenderId);
	}

	/**
	 * Update the neglect counter based on turns passed
	 */
	updateNeglect(stronghold: Stronghold, pcLevel: number, turnsPassed: number): void {
		if (turnsPassed <= 0) {
			return;
		}

		const penalty = calculateNeglectPenalty(turnsPassed, pcLevel, this.config);
		stronghold.neglectCounter += penalty;
		stronghold.metadata.lastModified = new Date().toISOString();
	}

	/**
	 * Reset the neglect counter (called when orders are given)
	 */
	resetNeglect(stronghold: Stronghold): void {
		stronghold.neglectCounter = 0;
		stronghold.metadata.lastModified = new Date().toISOString();
	}

	/**
	 * Update the last turn day (called when orders are given)
	 */
	updateLastTurnDay(stronghold: Stronghold, currentDay: number): void {
		stronghold.lastTurnDay = currentDay;
		stronghold.metadata.calendarDay = currentDay;
		stronghold.metadata.lastModified = new Date().toISOString();
	}

	/**
	 * Get all idle facilities
	 */
	getIdleFacilities(stronghold: Stronghold): StrongholdFacility[] {
		return stronghold.facilities.filter(f => f.status === 'idle');
	}

	/**
	 * Get all busy facilities
	 */
	getBusyFacilities(stronghold: Stronghold): StrongholdFacility[] {
		return stronghold.facilities.filter(f => f.status === 'busy');
	}

	/**
	 * Get all inoperable facilities
	 */
	getInoperableFacilities(stronghold: Stronghold): StrongholdFacility[] {
		return stronghold.facilities.filter(f => f.status === 'inoperable');
	}

	/**
	 * Get facilities that will complete on or before a specific day
	 */
	getCompletingFacilities(stronghold: Stronghold, currentDay: number): StrongholdFacility[] {
		return stronghold.facilities.filter(
			f => f.status === 'busy' && f.busyUntilDay !== undefined && f.busyUntilDay <= currentDay
		);
	}

	/**
	 * Check if a stronghold is neglected (neglect counter above threshold)
	 */
	isNeglected(stronghold: Stronghold, threshold: number = 3): boolean {
		return stronghold.neglectCounter >= threshold;
	}

	/**
	 * Get all active (non-deceased) special defenders
	 */
	getActiveSpecialDefenders(stronghold: Stronghold): SpecialDefender[] {
		return stronghold.defenders.special.filter(d => d.status !== 'deceased');
	}

	/**
	 * Get total defender count (basic + special)
	 */
	getTotalDefenderCount(stronghold: Stronghold): number {
		const activeSpecial = this.getActiveSpecialDefenders(stronghold).length;
		return stronghold.defenders.basic.current + activeSpecial;
	}

	/**
	 * Update stronghold ownership
	 */
	updateOwnership(stronghold: Stronghold, ownership: Ownership): void {
		stronghold.ownership = ownership;
		stronghold.metadata.lastModified = new Date().toISOString();
	}

	/**
	 * Update stronghold location
	 */
	updateLocation(stronghold: Stronghold, location?: string): void {
		stronghold.location = location;
		stronghold.metadata.lastModified = new Date().toISOString();
	}

	/**
	 * Update stronghold name
	 */
	updateName(stronghold: Stronghold, name: string): void {
		stronghold.name = name;
		stronghold.metadata.lastModified = new Date().toISOString();
	}

	/**
	 * Validate stronghold structure
	 */
	validateStronghold(stronghold: Stronghold): { valid: boolean; errors: string[] } {
		const errors: string[] = [];

		if (!stronghold.name || stronghold.name.trim() === '') {
			errors.push('Stronghold name is required');
		}

		if (!stronghold.ownership) {
			errors.push('Stronghold ownership is required');
		} else if (stronghold.ownership.type === 'individual' && !stronghold.ownership.ownerName) {
			errors.push('Owner name is required for individually-owned strongholds');
		}

		if (stronghold.defenders.basic.current < 0) {
			errors.push('Basic defender count cannot be negative');
		}

		if (stronghold.defenders.basic.current > stronghold.defenders.basic.maximum) {
			errors.push('Basic defender count exceeds maximum');
		}

		if (stronghold.neglectCounter < 0) {
			errors.push('Neglect counter cannot be negative');
		}

		return {
			valid: errors.length === 0,
			errors
		};
	}
}
