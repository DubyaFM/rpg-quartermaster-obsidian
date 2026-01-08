// World State Persistence Types for Calendar & World Event System
// Defines types for persisting world state including current time, chain event states, and GM overrides

import { CalendarClock } from './types';

/**
 * Chain State Vector - Serializes current state of a chain event (state machine)
 * Used to persist/restore chain event position for deterministic replay
 */
export interface ChainStateVector {
	/** Current state name (e.g., "Clear", "Blizzard", "Full Moon") */
	currentStateName: string;
	/** Day when this state was entered */
	stateEnteredDay: number;
	/** Total duration of this state in days (resolved from dice roll) */
	stateDurationDays: number;
	/** RNG state for this chain (for deterministic progression) */
	rngState: number;
	/** Day when this state will end (inclusive) */
	stateEndDay: number;
}

/**
 * GM Override Type - Manual event state changes by the Game Master
 * Allows GMs to force specific event states for narrative purposes
 */
export interface GMOverride {
	/** Unique identifier for this override */
	id: string;
	/** Event ID this override applies to */
	eventId: string;
	/** Override type */
	type: 'force_state' | 'disable_event' | 'extend_duration' | 'trigger_now';

	// For 'force_state' overrides
	/** Force event to specific state (for chain events) */
	forcedStateName?: string;
	/** Duration in days to maintain forced state */
	forcedDuration?: number;

	// For 'extend_duration' overrides
	/** Days to add to current event duration */
	durationExtension?: number;

	// For 'trigger_now' overrides
	/** Force event to trigger immediately regardless of conditions */
	triggerImmediately?: boolean;

	// Temporal scope
	/** Day when override was applied */
	appliedDay: number;
	/** Day when override expires (undefined = permanent until removed) */
	expiresDay?: number;

	// Metadata
	/** GM notes explaining why override was applied */
	notes?: string;
	/** When override was created (ISO 8601 timestamp) */
	createdAt: string;
}

/**
 * Module Toggle - Enable/disable specific event modules
 * Used for debugging or selectively disabling event categories
 */
export interface ModuleToggle {
	/** Module identifier (e.g., "weather", "economy", "moons") */
	moduleId: string;
	/** Whether module is enabled */
	enabled: boolean;
	/** When toggle was last changed */
	lastChanged?: string;
}

/**
 * World State - Complete persisted state of the world event system
 * This is the primary save/load structure for all calendar/event runtime state
 */
export interface WorldState {
	/** Current time (absolute day + time-of-day offset) */
	clock: CalendarClock;

	/** State vectors for all active chain events (keyed by event ID) */
	chainStates: Record<string, ChainStateVector>;

	/** Active GM overrides */
	overrides: GMOverride[];

	/** Module enable/disable toggles */
	moduleToggles: Record<string, boolean>;

	/** Schema version for migration support */
	version: number;

	/** Last time world state was persisted (ISO 8601 timestamp) */
	lastSaved?: string;

	/** Active calendar definition ID */
	activeCalendarId: string;

	/** History gap tracking (for emergency brake time jumps) */
	historyGap?: {
		/** Day when gap started */
		gapStartDay: number;
		/** Day when gap ended */
		gapEndDay: number;
		/** Reason for gap (e.g., "Emergency brake: 1000 year jump") */
		reason: string;
		/** When gap was created */
		createdAt: string;
	};
}

/**
 * World State Storage Path Patterns
 * Platform-specific path conventions for storing world state
 */
export const WorldStateStoragePaths = {
	/** Obsidian: Store as JSON in vault root or config folder */
	obsidian: {
		/** Primary location: .quartermaster/world-state.json */
		primary: '.quartermaster/world-state.json',
		/** Backup location: .quartermaster/world-state.backup.json */
		backup: '.quartermaster/world-state.backup.json',
		/** Legacy location (pre-v2): quartermaster-world-state.json */
		legacy: 'quartermaster-world-state.json'
	},

	/** Web: Store in SQLite database */
	web: {
		/** Table name for world state */
		table: 'world_state',
		/** Key for current state row */
		key: 'current'
	},

	/** Mobile: Store in AsyncStorage (React Native) */
	mobile: {
		/** AsyncStorage key */
		key: '@quartermaster/world_state'
	}
} as const;

/**
 * Migration Notes for World State Persistence
 *
 * Pre-Beta Status: No migration needed
 *
 * The Calendar & World Event System is a new feature being introduced in this phase.
 * No existing installations have world state data to migrate.
 *
 * Initial Schema Version: 1
 *
 * Future Migration Strategy:
 * - WorldState.version field will track schema version
 * - Breaking changes will increment version number
 * - Migration adapters will handle version upgrades on load
 * - Example: v1 → v2 might add new fields with defaults
 *
 * Backward Compatibility:
 * - CalendarState (existing) will be integrated into WorldState.clock
 * - Existing calendarState in settings will be migrated on first load
 * - Migration path: settings.calendarState → WorldState.clock
 *
 * Forward Compatibility:
 * - Unknown fields in loaded state will be preserved (not stripped)
 * - Enables graceful degradation if user downgrades plugin version
 *
 * Platform-Specific Notes:
 * - Obsidian: Use file-based JSON for easy manual editing/debugging
 * - Web: Use SQLite JSONB column for efficient queries
 * - Mobile: Use AsyncStorage with JSON serialization
 */
