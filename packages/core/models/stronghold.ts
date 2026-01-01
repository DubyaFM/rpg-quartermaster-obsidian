/**
 * Stronghold system data models for D&D 5e campaign management
 * Platform-agnostic core types for player-owned bases with facilities, orders, and hirelings
 */

import type { ItemCost } from './types';

/**
 * Ownership can be party-wide or assigned to individual players
 */
export interface Ownership {
	type: 'party' | 'individual';
	ownerName?: string;
	ownerLinkedFile?: string;
}

/**
 * SpecialDefender represents a named defender with unique characteristics
 * Unlike basic defenders (simple count), these have individual tracking
 */
export interface SpecialDefender {
	id: string;
	/** Optional link to NPC profile (npcId from NPC system) */
	npcId?: string;
	name: string;
	role?: string;
	characteristics?: string;
	statBlock?: string;
	status: 'active' | 'injured' | 'deceased';
}

/**
 * Defenders protect the stronghold from threats
 * Two types: basic (integer count) and special (named entities)
 */
export interface Defenders {
	basic: {
		current: number;
		maximum: number;
	};
	special: SpecialDefender[];
}

/**
 * StrongholdBuff represents temporary or permanent benefits applied to a stronghold
 * Can come from order results, events, or manual DM actions
 */
export interface StrongholdBuff {
	id: string;
	name: string;
	description: string;
	appliedOnDay: number;
	durationInDays?: number;        // Undefined = permanent
	expiresOnDay?: number;
	effects: string;                // Freeform text describing mechanical effects
}

/**
 * StrongholdFacility represents an instance of a facility built in a stronghold
 * Based on a FacilityTemplate but with runtime state and assignments
 */
export interface StrongholdFacility {
	id: string;
	templateId: string;
	name: string;
	ownership: Ownership;
	status: 'idle' | 'busy' | 'inoperable';
	busyUntilDay?: number;
	assignedHirelings: string[];  // Array of hireling IDs
	notes?: string;               // DM or player notes about this facility
}

/**
 * Stronghold represents a player-owned base with facilities and defenders
 * Core entity for the stronghold system
 */
export interface Stronghold {
	id: string;
	name: string;
	ownership: Ownership;
	location?: string;           // Optional freeform text
	defenders: Defenders;
	stashInventoryFile: string;  // Path to inventory file for this stronghold's stash
	facilities: StrongholdFacility[];
	activeBuffs: StrongholdBuff[];
	neglectCounter: number;      // Tracks turns missed without giving orders
	lastTurnDay?: number;        // Last calendar day when orders were given
	metadata: {
		createdDate: string;
		lastModified: string;
		calendarDay?: number;
	};
}

/**
 * FacilityTemplate defines the blueprint for constructing facilities
 * Stored as YAML files in config/facilities/
 */
export interface FacilityTemplate {
	id: string;
	name: string;
	tier: number;                    // 1-3, higher tiers are upgrades
	baseFacilityId?: string;         // For upgrades: the base facility this upgrades from
	type: 'basic' | 'special';
	description: string;
	unlockLevel?: number;            // PC level requirement to build
	prerequisites: string;           // Freeform text describing requirements
	size: {
		category: 'cramped' | 'roomy' | 'vast' | 'other';
		areaSquares: number;
	};
	hirelingsRequired: number;       // Number of hirelings needed to operate
	buildCost: ItemCost & {
		timeInDays: number;
	};
	upgradeCost?: ItemCost & {       // Cost to upgrade from base facility
		timeInDays: number;
	};
	associatedOrderIds: string[];    // Orders that can be performed at this facility
	passiveBenefits: string;         // Freeform text describing passive benefits
	metadata: {
		createdDate: string;
		lastModified: string;
	};
}

/**
 * OrderResult defines what happens when an order completes
 * Multiple results can be configured per order
 */
export interface OrderResult {
	id: string;
	type: 'item' | 'currency' | 'defender' | 'buff' | 'event' | 'morale';
	config: {
		// Type-specific configurations
		itemPrompt?: string;           // For type: 'item' - prompt user for item name
		currencyAmount?: number;        // For type: 'currency' - amount to add to stash
		defenderCount?: number;         // For type: 'defender' - basic defenders to add
		buffId?: string;                // For type: 'buff' - buff to apply
		eventTableId?: string;          // For type: 'event' - event table to roll on
		moraleChange?: number;          // For type: 'morale' - morale adjustment
	};
}

/**
 * CustomOrder defines an action that can be performed at a facility or stronghold
 * Stored as YAML files in config/orders/
 */
export interface CustomOrder {
	id: string;
	name: string;
	description: string;
	orderType: 'facility' | 'stronghold';
	associatedFacilityIds?: string[];  // Facilities that can perform this order
	timeRequired: number;              // Days to complete
	goldCost: {
		type: 'none' | 'constant' | 'variable';
		amount?: number;                // For constant cost
		prompt?: string;                // For variable cost, prompt user
	};
	results: OrderResult[];
	metadata: {
		createdDate: string;
		lastModified: string;
	};
}

/**
 * Hireling represents an NPC assigned to a stronghold or facility
 * Enhanced from basic employment tracking with morale and stronghold integration
 */
export interface Hireling {
	id: string;
	/** Optional link to NPC profile (npcId from NPC system) */
	npcId?: string;
	identity: {
		name: string;
		role: string;
		status: 'at_stronghold' | 'missing' | 'deceased';
	};
	mechanics: {
		statBlock?: string;            // Link to stat block or creature type
		personalityNotes?: string;
	};
	morale: {
		value: number;                 // Current morale value
		scale: {
			min: number;               // Minimum morale value
			max: number;               // Maximum morale value
			labels?: { [threshold: number]: string };  // Optional labels like {0: "Hostile", 10: "Neutral", 20: "Loyal"}
		};
		notes?: string;                // Freeform notes about morale factors
	};
	payment: {
		type: 'mercenary' | 'stronghold_staff';
		schedule: 'none' | 'manual' | 'daily' | 'weekly';
		amount: {
			gold: number;
			silver: number;
			copper: number;
		};
	};
	assignedStrongholdId?: string;
	assignedFacilityId?: string;
	lastPaymentDay?: number;           // Calendar day of last payment
	metadata: {
		createdDate: string;
		lastModified: string;
	};
}

/**
 * EventTableEntry represents a single entry in an event table
 * Maps roll ranges to narrative or cascading events
 */
export interface EventTableEntry {
	id: string;
	rollRange: {
		min: number;
		max: number;
	};
	eventName: string;
	description: string;
	resultType: 'narrative' | 'trigger_event';
	nestedTableId?: string;            // Only for resultType: 'trigger_event'
}

/**
 * CustomEventTable defines a random event table for stronghold events
 * Supports single-level chaining and standard dice types
 * Compatible with Javalent Dice Roller plugin format
 */
export interface CustomEventTable {
	id: string;
	name: string;
	description?: string;
	diceType: 'd100' | 'd20' | 'd12' | 'd10' | 'd8' | 'd6' | 'd4';
	events: EventTableEntry[];
	metadata: {
		createdDate: string;
		lastModified: string;
	};
}

/**
 * ValidationResult for service operations
 */
export interface ValidationResult {
	valid: boolean;
	errors: string[];
	warnings?: string[];
}

/**
 * ExecutionResult for order execution
 */
export interface ExecutionResult {
	success: boolean;
	completionDay?: number;
	errors?: string[];
	results?: any[];
}

/**
 * PaymentResult for hireling payment processing
 */
export interface PaymentResult {
	hirelingId: string;
	hirelingName: string;
	paid: boolean;
	amount?: {
		gold: number;
		silver: number;
		copper: number;
	};
	error?: string;
}
