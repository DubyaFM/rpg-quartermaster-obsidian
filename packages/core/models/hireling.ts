/**
 * Hireling employment tracking data models
 * Tracks NPCs hired by the party or individual party members
 */

import { Currency } from './types';

/**
 * HirelingType defines the skill level and wage tier
 */
export type HirelingType = 'unskilled' | 'skilled' | 'expert';

/**
 * PaymentSchedule defines how often wages are paid
 */
export type PaymentSchedule = 'daily' | 'weekly' | 'monthly';

/**
 * Morale level affects loyalty changes and probability of leaving
 */
export type Morale = 'low' | 'stable' | 'high';

/**
 * Availability status for the hireling
 */
export type Availability = 'available' | 'unavailable' | 'on-leave';

/**
 * HirelingEmployment tracks all employment details for a hired NPC
 * Stored in a separate tracking file (Hirelings/Active Hirelings.md)
 */
export interface HirelingEmployment {
	/** Unique ID for this employment record */
	hirelingId: string;

	/** Link to NPC file in [[Wikilink]] format */
	npc: string;

	/** UUID: "npc-abc123..." */
	npcId?: string;

	/** Cached NPC data (loaded at runtime, NOT saved to file) */
	npcData?: any;

	/** Employment type/tier */
	type: HirelingType;

	/** Who employs this hireling ("party" or specific player name) */
	employer: string;

	/** Date hired (ISO 8601 format) */
	hireDate: string;

	/** Wage amount per payment period */
	wages: Currency;

	/** How often wages are paid */
	paymentSchedule: PaymentSchedule;

	/** Last payment date (ISO 8601 format) */
	lastPaid: string;

	/** Next scheduled payment date (ISO 8601 format) */
	nextPayment: string;

	/** Assigned duties and responsibilities */
	duties: string[];

	/** Things the hireling refuses to do */
	restrictions?: string[];

	/** Loyalty score (0-100, affects morale and leaving probability) */
	loyalty: number;

	/** Current morale level */
	morale: Morale;

	/** What the hireling is currently doing */
	currentActivity?: string;

	/** Whether hireling is available for tasks */
	availability: Availability;

	// Expert hireling fields
	/** Character level (for expert hirelings) */
	level?: number;

	/** Special abilities (for expert hirelings) */
	specialAbilities?: string[];

	/** Equipment provided to hireling */
	equipment?: string[];

	/** Employment status */
	status: 'active' | 'dismissed' | 'resigned' | 'deceased';
}

/**
 * HirelingsTrackingFile represents the structure of the hirelings tracking file
 * Stored as: Hirelings/Active Hirelings.md
 */
export interface HirelingsTrackingFile {
	/** List of all active hireling employment records */
	hirelings: HirelingEmployment[];
}

/**
 * Wage rates for different hireling types (D&D 5e standard)
 */
export const DEFAULT_WAGES: Record<HirelingType, Currency> = {
	unskilled: { cp: 0, sp: 2, gp: 0, pp: 0 }, // 2 sp/day
	skilled: { cp: 0, sp: 0, gp: 2, pp: 0 },    // 2 gp/day
	expert: { cp: 0, sp: 0, gp: 5, pp: 0 }      // 5 gp/day minimum
};

/**
 * Loyalty thresholds for morale calculation
 */
export const LOYALTY_THRESHOLDS = {
	LOW: 30,    // Loyalty < 30 = low morale
	STABLE: 70  // Loyalty 30-70 = stable morale, >70 = high morale
};

/**
 * Morale effects on loyalty changes
 */
export const MORALE_LOYALTY_MODIFIERS = {
	low: -2,      // Low morale: -2 loyalty per week
	stable: 0,    // Stable morale: no change
	high: 1       // High morale: +1 loyalty per week
};
