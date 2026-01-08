// Event System Types for Calendar & World Events
// Defines all event trigger patterns and runtime state tracking

/**
 * Event Context - Filtering parameters for location/faction-specific events
 * Used by consumers to request only relevant events
 */
export interface EventContext {
	/** Location identifier (e.g., "waterdeep", "neverwinter") */
	location?: string;
	/** Faction identifier (e.g., "harpers", "zhentarim") */
	faction?: string;
	/** Season name for seasonal event filtering */
	season?: string;
	/** Region for regional solar/weather overrides */
	region?: string;
	/** Additional tags for custom filtering */
	tags?: string[];
}

/**
 * Base Event Definition - Common fields for all event types
 * Uses discriminated union on 'type' field
 */
export interface EventDefinition {
	/** Unique identifier for this event */
	id: string;
	/** Display name */
	name: string;
	/** Event trigger type (discriminator) */
	type: 'fixed' | 'interval' | 'chain' | 'conditional';
	/** Priority for conflict resolution (higher = wins) */
	priority: number;
	/** Effect definitions applied when event is active */
	effects: Record<string, any>;  // Typed more specifically in effectTypes.ts
	/** Optional description for GM reference */
	description?: string;
	/** Location filters (event only active in these locations) */
	locations?: string[];
	/** Faction filters (event only active for these factions) */
	factions?: string[];
	/** Season filters (event only active in these seasons) */
	seasons?: string[];
	/** Region filters (event only active in these regions) */
	regions?: string[];
	/** Tags for custom categorization */
	tags?: string[];
}

/**
 * Type A: Fixed Date Event
 * Triggers on specific calendar dates (holidays, anniversaries)
 */
export interface FixedDateEvent extends EventDefinition {
	type: 'fixed';
	/** Date specification */
	date: {
		/** 0-indexed month (0 = first month) */
		month: number;
		/** 1-indexed day of month */
		day: number;
		/** Optional year for one-time events (omit for annual recurring) */
		year?: number;
		/** Optional intercalary day name (e.g., "Midwinter", "Shieldmeet") */
		intercalaryName?: string;
	};
	/** Duration in days (default: 1 for single-day holiday) */
	duration?: number;
}

/**
 * Type B: Interval Event
 * Triggers on strict repeating cycles using modulo math
 * Formula: (currentDay + offset) % interval === 0
 */
export interface IntervalEvent extends EventDefinition {
	type: 'interval';
	/** Interval in days (or minutes for sub-day events) */
	interval: number;
	/** Offset for phase alignment (default: 0) */
	offset?: number;
	/** Duration in days (default: 1) */
	duration?: number;
	/** Use minutes instead of days for sub-day intervals (default: false) */
	useMinutes?: boolean;
}

/**
 * Chain Event State - Individual state in a state machine
 */
export interface ChainEventState {
	/** State name (e.g., "Clear", "Blizzard", "Full Moon") */
	name: string;
	/** Weight for weighted random selection (higher = more likely) */
	weight: number;
	/** Duration string using dice notation (e.g., "2d6 days", "1d4 weeks") */
	duration: string;
	/** Effects applied when in this state */
	effects: Record<string, any>;
	/** Optional description */
	description?: string;
}

/**
 * Type C: Chain Event (State Machine)
 * Deterministic state machine using seeded RNG
 * Used for weather, moons, economy simulation
 */
export interface ChainEvent extends EventDefinition {
	type: 'chain';
	/** Seed for deterministic random number generation */
	seed: number;
	/** Available states with weights and durations */
	states: ChainEventState[];
	/** Initial state name (optional, defaults to first weighted selection) */
	initialState?: string;
}

/**
 * Type D: Conditional Event
 * Activates based on logical conditions referencing other events
 */
export interface ConditionalEvent extends EventDefinition {
	type: 'conditional';
	/** Condition expression (e.g., "events['moon'].state == 'Full'") */
	condition: string;
	/** Execution tier (1 or 2) for phase ordering */
	tier: 1 | 2;
	/** Duration in days when condition becomes true (default: 1) */
	duration?: number;
}

/**
 * Union type of all event definitions
 * Enables type-safe discriminated union pattern
 */
export type AnyEventDefinition = FixedDateEvent | IntervalEvent | ChainEvent | ConditionalEvent;

/**
 * Active Event - Runtime state of an active event
 * Represents an event that is currently "happening" on a given day
 */
export interface ActiveEvent {
	/** Reference to source event definition */
	eventId: string;
	/** Display name (copied from definition) */
	name: string;
	/** Event type (copied from definition) */
	type: 'fixed' | 'interval' | 'chain' | 'conditional';
	/** Current state name (for chain events) or event name (for others) */
	state: string;
	/** Priority (copied from definition) */
	priority: number;
	/** Resolved effects for this active instance */
	effects: Record<string, any>;
	/** Day this event instance started */
	startDay: number;
	/** Day this event instance ends (inclusive) */
	endDay: number;
	/** Days remaining until this event ends */
	remainingDays: number;
	/** Source of this event (definition, override, etc.) */
	source: 'definition' | 'override' | 'gm_forced';
	/** Original event definition (for reference) */
	definition: AnyEventDefinition;
}

/**
 * Effect Registry - Collection of all active effects for a given day/context
 * Broadcast by WorldEventService, consumed by ShopService, UI, etc.
 */
export interface EffectRegistry {
	/** Absolute day this registry is for */
	day: number;
	/** Time of day in minutes from midnight (optional) */
	timeOfDay?: number;
	/** Context filters applied */
	context: EventContext;
	/** All active events contributing to this registry */
	activeEvents: ActiveEvent[];
	/** Resolved effects (after conflict resolution) */
	effects: Record<string, any>;  // Typed more specifically in effectTypes.ts
	/** Timestamp when registry was computed */
	computedAt: number;
}
