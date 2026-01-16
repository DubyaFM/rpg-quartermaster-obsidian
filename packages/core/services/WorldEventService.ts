/**
 * WorldEventService - Event Simulation Engine
 *
 * The "content layer" that calculates active events for a given day and context.
 * Works in conjunction with CalendarDriver (time physics) to provide a complete
 * calendar and event system.
 *
 * Architecture:
 * - CalendarDriver: Pure time math (no events)
 * - WorldEventService: Event state engine (no time math)
 *
 * Event Types Supported:
 * - Type A: Fixed Date Events (holidays, anniversaries)
 * - Type B: Interval Events (strict repeating cycles)
 * - Type C: Chain Events (state machines with seeded RNG)
 * - Type D: Conditional Events (depend on other events)
 *
 * Design Notes:
 * - Events are loaded via IEventDefinitionAdapter
 * - Chain events use isolated seeded RNG instances for determinism
 * - Event caching uses buffer window for performance
 * - Module toggles allow enabling/disabling event packs per campaign
 */

import { CalendarDriver } from './CalendarDriver';
import { IRngFactory } from '../interfaces/IRngFactory';
import { ISeededRandomizer } from '../interfaces/ISeededRandomizer';
import { IEventDefinitionAdapter } from '../interfaces/IEventDefinitionAdapter';
import {
	EventContext,
	AnyEventDefinition,
	FixedDateEvent,
	IntervalEvent,
	ChainEvent,
	ConditionalEvent,
	ActiveEvent,
	EffectRegistry as EffectRegistryType,
	ChainEventState
} from '../models/eventTypes';
import { ChainStateVector, WorldState, ModuleToggle, GMOverride } from '../models/worldStateTypes';
import { parseDuration as parseDurationUtil, DurationUnitConfig } from '../utils/DurationParser';
import {
	evaluateCondition as evaluateConditionUtil,
	extractEventReferences,
	validateCondition,
	EventStateMap
} from '../utils/ConditionParser';
import { EffectRegistry } from './EffectRegistry';

/**
 * Cached event data for a specific day
 */
interface DayEventCache {
	day: number;
	activeEvents: ActiveEvent[];
	computedAt: number;
}

/**
 * Internal state for chain event tracking
 */
interface ChainEventRuntime {
	eventId: string;
	rng: ISeededRandomizer;
	currentStateName: string;
	stateEnteredDay: number;
	stateDurationDays: number;
	stateEndDay: number;
}

/**
 * Configuration for WorldEventService
 */
export interface WorldEventServiceConfig {
	/** Buffer window size in days (default: 30) */
	bufferSize?: number;
	/** Maximum simulation threshold in days for time jumps (default: 365) */
	maxSimulationDays?: number;
	/** Callback for permanent event definition updates */
	onEventDefinitionUpdate?: (eventId: string, newDefinition: AnyEventDefinition) => Promise<void>;
	/** Progress callback for time jump operations (reports 0-1 progress) */
	onTimeJumpProgress?: (progress: number, mode: 'simulation' | 'anchor_reset') => void;
}

/**
 * Time Jump Result
 * Metadata returned from advanceToDay indicating what happened
 */
export interface TimeJumpResult {
	/** Mode used for the jump */
	mode: 'simulation' | 'anchor_reset';
	/** Starting day */
	fromDay: number;
	/** Ending day */
	toDay: number;
	/** Total days advanced */
	daysAdvanced: number;
	/** Whether a history gap was created (Anchor Reset mode) */
	hasHistoryGap: boolean;
	/** Performance metrics */
	elapsedMs: number;
}

/**
 * WorldEventService - Event simulation engine
 *
 * Calculates active events for a given day and context using the four event
 * trigger patterns: Fixed, Interval, Chain, and Conditional.
 */
export class WorldEventService {
	private driver: CalendarDriver;
	private rngFactory: IRngFactory;
	private adapter: IEventDefinitionAdapter | null = null;

	/** All loaded event definitions (keyed by ID) */
	private eventRegistry: Map<string, AnyEventDefinition> = new Map();

	/** Fixed date event index: "month-day" or "intercalary-name" -> event IDs */
	private fixedDateIndex: Map<string, string[]> = new Map();

	/** Interval event list (checked via modulo math) */
	private intervalEvents: IntervalEvent[] = [];

	/** Chain event runtime states (keyed by event ID) */
	private chainRuntimes: Map<string, ChainEventRuntime> = new Map();

	/** Conditional event list (processed in phase order) */
	private conditionalEvents: ConditionalEvent[] = [];

	/** Day event cache (buffer window) */
	private dayCache: Map<number, DayEventCache> = new Map();

	/** Module toggles (keyed by module ID) */
	private moduleToggles: Map<string, boolean> = new Map();

	/** Active GM overrides (keyed by override ID) */
	private overrides: Map<string, GMOverride> = new Map();

	/** Configuration */
	private config: WorldEventServiceConfig & { bufferSize: number; maxSimulationDays: number };

	/** Initialization state */
	private initialized: boolean = false;

	/** Current day for tracking (used for cache management) */
	private currentDay: number = 0;

	/** Effect registry for effect aggregation */
	private effectRegistry: EffectRegistry = new EffectRegistry();

	constructor(
		driver: CalendarDriver,
		rngFactory: IRngFactory,
		config?: WorldEventServiceConfig
	) {
		this.driver = driver;
		this.rngFactory = rngFactory;
		this.config = {
			bufferSize: config?.bufferSize ?? 30,
			maxSimulationDays: config?.maxSimulationDays ?? 365,
			onEventDefinitionUpdate: config?.onEventDefinitionUpdate
		};
	}

	/**
	 * Initialize the service with an event definition adapter
	 *
	 * @param adapter Event definition adapter for loading events
	 * @param currentDay Current absolute day for initial buffer population
	 * @returns Promise resolving when initialization is complete
	 */
	async initialize(adapter: IEventDefinitionAdapter, currentDay: number = 0): Promise<void> {
		this.adapter = adapter;
		this.currentDay = currentDay;

		// Load all event definitions
		await this.loadEventDefinitions();

		// Build indexes for fast lookups
		this.buildEventIndexes();

		// Initialize chain event runtimes
		this.initializeChainRuntimes(currentDay);

		// Pre-populate buffer window
		this.precomputeBuffer(currentDay);

		this.initialized = true;
	}

	/**
	 * Check if the service has been initialized
	 */
	isInitialized(): boolean {
		return this.initialized;
	}

	/**
	 * Get all active events for a specific day and context
	 *
	 * This is the primary method for querying active events. It executes events
	 * in strict phase order to prevent circular dependencies.
	 *
	 * Phase Order:
	 * - Phase 1: Type A (Fixed) & Type B (Interval) events - depend only on Time
	 * - Phase 2: Type C (Chain) events - depend on Time + Phase 1
	 * - Phase 3: Type D Tier 1 (Conditional) - depend on Phases 1 & 2
	 * - Phase 4: Type D Tier 2 (Conditional) - depend on Phases 1-3
	 *
	 * @param day Absolute day counter
	 * @param context Optional event context for filtering
	 * @returns Array of active events
	 */
	getActiveEvents(day: number, context?: EventContext): ActiveEvent[] {
		// Check cache first
		const cached = this.dayCache.get(day);
		if (cached) {
			// Apply context filtering to cached results
			return this.filterByContext(cached.activeEvents, context);
		}

		// Calculate active events in phase order
		const activeEvents: ActiveEvent[] = [];

		// Phase 1: Fixed date and interval events (depend only on Time)
		const phase1Events = [
			...this.evaluateFixedDateEvents(day),
			...this.evaluateIntervalEvents(day)
		];
		activeEvents.push(...phase1Events);

		// Phase 2: Chain events (depend on Time + Phase 1)
		const phase2Events = this.evaluateChainEvents(day, phase1Events);
		activeEvents.push(...phase2Events);

		// Phase 3: Conditional events Tier 1 (depend on Phases 1 & 2)
		const phase12Events = [...phase1Events, ...phase2Events];
		const phase3Events = this.evaluateConditionalEvents(day, phase12Events, 1);
		activeEvents.push(...phase3Events);

		// Phase 4: Conditional events Tier 2 (depend on Phases 1-3)
		const phase123Events = [...phase12Events, ...phase3Events];
		const phase4Events = this.evaluateConditionalEvents(day, phase123Events, 2);
		activeEvents.push(...phase4Events);

		// Cache results (without context filtering)
		this.dayCache.set(day, {
			day,
			activeEvents,
			computedAt: Date.now()
		});

		// Apply context filtering
		return this.filterByContext(activeEvents, context);
	}

	/**
	 * Get the effect registry for a specific day and context
	 *
	 * Aggregates all effects from active events and returns a resolved registry.
	 * Uses EffectRegistry for sophisticated conflict resolution and source tracking.
	 *
	 * Solar Baseline Integration:
	 * - Calculates solar light level from CalendarDriver (Layer 0)
	 * - Merges with event light_level effects (Layer 1+)
	 * - Darkest wins strategy applies across all layers
	 *
	 * @param day Absolute day counter
	 * @param context Optional event context for filtering
	 * @returns Effect registry with resolved effects
	 */
	getEffectRegistry(day: number, context?: EventContext): EffectRegistryType {
		const activeEvents = this.getActiveEvents(day, context);
		const timeOfDay = this.driver.getTimeOfDay();

		// Calculate solar baseline light level (Layer 0)
		const solarLightLevel = this.driver.getLightLevel(day, timeOfDay);

		// Use EffectRegistry for sophisticated effect aggregation
		const resolvedEffects = this.effectRegistry.getResolvedEffects(
			day,
			activeEvents,
			context,
			timeOfDay,
			solarLightLevel
		);

		// Extract the effect values from ResolvedEffects (which includes metadata fields)
		// and create a plain object for the effects field
		const effectsOnly: Record<string, any> = {};
		const metadataKeys = ['resolvedDay', 'resolvedTimeOfDay', 'resolvedContext', 'competingEffects', 'resolutionStrategies'];

		for (const [key, value] of Object.entries(resolvedEffects)) {
			if (!metadataKeys.includes(key)) {
				effectsOnly[key] = value;
			}
		}

		// Convert ResolvedEffects to EffectRegistry type for compatibility
		return {
			day,
			timeOfDay,
			context: context || {},
			activeEvents,
			effects: effectsOnly,
			computedAt: Date.now()
		};
	}

	/**
	 * Get effect context for a specific day with filters
	 *
	 * This is the primary method for consumers (shops, UI, etc.) to query active effects.
	 * It creates an EffectContext from the provided filters and returns the resolved effects.
	 *
	 * Design Flow:
	 * 1. Consumer calls getEffectContext with filters (location, faction, npc, tags)
	 * 2. Service converts filters to EventContext
	 * 3. Service queries active events with context
	 * 4. Service resolves effects with conflict resolution
	 * 5. Consumer receives resolved effects for their specific context
	 *
	 * Hierarchical Location Matching:
	 * - Supports dot-separated location paths (e.g., "Waterdeep.North Ward")
	 * - Events at parent locations apply to child locations
	 * - Example: Event tagged "Waterdeep" affects "Waterdeep.North Ward.Shop"
	 *
	 * @param filters Effect context filters (location, faction, npc, tags)
	 * @param day Optional day counter (defaults to current day from driver)
	 * @returns Effect registry with resolved effects for the given context
	 */
	getEffectContext(
		filters: {
			location?: string;
			faction?: string;
			npc?: string;
			tags?: string[];
		},
		day?: number
	): EffectRegistryType {
		const effectiveDay = day ?? this.currentDay;

		// Convert EffectContext filters to EventContext
		// EventContext uses location, faction, season, region, tags
		// EffectContext uses location, faction, npc, tags
		const eventContext: EventContext = {
			location: filters.location,
			faction: filters.faction,
			tags: filters.tags
		};

		// Get the effect registry with the constructed context
		return this.getEffectRegistry(effectiveDay, eventContext);
	}

	/**
	 * Toggle a module on or off
	 *
	 * When a module is disabled, its events immediately stop being active.
	 *
	 * @param moduleId Module identifier
	 * @param enabled Whether the module is enabled
	 */
	toggleModule(moduleId: string, enabled: boolean): void {
		this.moduleToggles.set(moduleId, enabled);

		// Invalidate cache when module toggle changes
		this.dayCache.clear();
	}

	/**
	 * Get the current enabled state of a module
	 *
	 * @param moduleId Module identifier
	 * @returns true if enabled (default), false if explicitly disabled
	 */
	isModuleEnabled(moduleId: string): boolean {
		return this.moduleToggles.get(moduleId) ?? true;
	}

	/**
	 * Get all module toggle states
	 *
	 * @returns Record of module ID to enabled state
	 */
	getModuleToggles(): Record<string, boolean> {
		const toggles: Record<string, boolean> = {};
		for (const [id, enabled] of this.moduleToggles) {
			toggles[id] = enabled;
		}
		return toggles;
	}

	/**
	 * Get list of all available modules from loaded events
	 *
	 * Scans all event definitions and extracts unique tags that can be used
	 * as module identifiers for the settings UI.
	 *
	 * @returns Array of module IDs (event tags)
	 */
	getAvailableModules(): string[] {
		const modules = new Set<string>();

		for (const [_id, event] of this.eventRegistry) {
			if (event.tags && event.tags.length > 0) {
				for (const tag of event.tags) {
					modules.add(tag);
				}
			}
		}

		return Array.from(modules).sort();
	}

	/**
	 * Set module toggles from saved state
	 *
	 * @param toggles Record of module ID to enabled state
	 */
	setModuleToggles(toggles: Record<string, boolean>): void {
		this.moduleToggles.clear();
		for (const [id, enabled] of Object.entries(toggles)) {
			this.moduleToggles.set(id, enabled);
		}

		// Invalidate cache when toggles change
		this.dayCache.clear();
	}

	/**
	 * Get the current chain state vectors for persistence
	 *
	 * @returns Record of event ID to chain state vector
	 */
	getChainStateVectors(): Record<string, ChainStateVector> {
		const vectors: Record<string, ChainStateVector> = {};

		for (const [eventId, runtime] of this.chainRuntimes) {
			vectors[eventId] = {
				currentStateName: runtime.currentStateName,
				stateEnteredDay: runtime.stateEnteredDay,
				stateDurationDays: runtime.stateDurationDays,
				rngState: runtime.rng.getState(),
				stateEndDay: runtime.stateEndDay
			};
		}

		return vectors;
	}

	/**
	 * Restore chain state vectors from saved state
	 *
	 * @param vectors Record of event ID to chain state vector
	 */
	restoreChainStateVectors(vectors: Record<string, ChainStateVector>): void {
		for (const [eventId, vector] of Object.entries(vectors)) {
			const runtime = this.chainRuntimes.get(eventId);
			if (runtime) {
				runtime.currentStateName = vector.currentStateName;
				runtime.stateEnteredDay = vector.stateEnteredDay;
				runtime.stateDurationDays = vector.stateDurationDays;
				runtime.stateEndDay = vector.stateEndDay;
				runtime.rng.reseed(vector.rngState);
			}
		}

		// Invalidate cache after restoring state
		this.dayCache.clear();
	}

	/**
	 * Get the buffer window size in days
	 */
	getBufferSize(): number {
		return this.config.bufferSize;
	}

	/**
	 * Get all registered event definitions
	 */
	getEventDefinitions(): Map<string, AnyEventDefinition> {
		return new Map(this.eventRegistry);
	}

	/**
	 * Get a specific event definition by ID
	 *
	 * @param eventId Event identifier
	 * @returns Event definition or undefined if not found
	 */
	getEventDefinition(eventId: string): AnyEventDefinition | undefined {
		return this.eventRegistry.get(eventId);
	}

	/**
	 * Reload event definitions from the adapter
	 *
	 * Useful when event packs have been modified.
	 *
	 * @returns Promise resolving when reload is complete
	 */
	async reloadEventDefinitions(): Promise<void> {
		if (!this.adapter) {
			throw new Error('WorldEventService not initialized with adapter');
		}

		// Clear existing data
		this.eventRegistry.clear();
		this.fixedDateIndex.clear();
		this.intervalEvents = [];
		this.conditionalEvents = [];
		this.dayCache.clear();

		// Reload definitions
		await this.loadEventDefinitions();

		// Rebuild indexes
		this.buildEventIndexes();

		// Re-initialize chain runtimes (preserves existing state where possible)
		this.initializeChainRuntimes(this.currentDay);
	}

	/**
	 * Invalidate the event cache
	 *
	 * Call this when events or chain states change externally.
	 */
	invalidateCache(): void {
		this.dayCache.clear();
	}

	/**
	 * Advance the current day and update buffer window
	 *
	 * Supports two modes:
	 * - **Simulation Mode** (< maxSimulationDays): Day-by-day iteration with full state tracking
	 * - **Anchor Reset Mode** (>= maxSimulationDays): O(1) jump to target state, intermediate history gap
	 *
	 * @param newDay New current day
	 * @returns Metadata about the time jump
	 */
	advanceToDay(newDay: number): TimeJumpResult {
		const startTime = performance.now();
		const previousDay = this.currentDay;
		const daysAdvanced = newDay - previousDay;

		// Handle edge case: no advancement
		if (daysAdvanced === 0) {
			return {
				mode: 'simulation',
				fromDay: previousDay,
				toDay: newDay,
				daysAdvanced: 0,
				hasHistoryGap: false,
				elapsedMs: 0
			};
		}

		// Determine mode based on jump distance
		const useAnchorReset = daysAdvanced > this.config.maxSimulationDays;
		const mode: 'simulation' | 'anchor_reset' = useAnchorReset ? 'anchor_reset' : 'simulation';

		// Clean expired overrides
		this.cleanExpiredOverrides(newDay);

		if (useAnchorReset) {
			// Anchor Reset Mode: O(1) jump to target state
			this.performAnchorReset(previousDay, newDay);
		} else {
			// Simulation Mode: Day-by-day iteration
			this.performDayByDaySimulation(previousDay, newDay);
		}

		// Trim old cache entries outside buffer window
		this.trimCache();

		// Pre-populate buffer for new window
		this.precomputeBuffer(newDay);

		const endTime = performance.now();

		return {
			mode,
			fromDay: previousDay,
			toDay: newDay,
			daysAdvanced,
			hasHistoryGap: useAnchorReset,
			elapsedMs: endTime - startTime
		};
	}

	/**
	 * Get the CalendarDriver instance
	 */
	getCalendarDriver(): CalendarDriver {
		return this.driver;
	}

	/**
	 * Get notable events for a time period
	 *
	 * Collects significant events that should be surfaced to the UI during time advancement.
	 * "Notable" events are defined as:
	 * - Fixed date events (holidays, special occasions)
	 * - Chain events that just transitioned to a new state
	 * - Conditional events that just became active
	 *
	 * @param fromDay Starting day (exclusive)
	 * @param toDay Ending day (inclusive)
	 * @returns Array of notable event summaries
	 */
	getNotableEvents(fromDay: number, toDay: number): Array<{
		eventId: string;
		name: string;
		type: 'fixed' | 'interval' | 'chain' | 'conditional';
		day: number;
		state?: string;
		description?: string;
	}> {
		const notableEvents: Array<{
			eventId: string;
			name: string;
			type: 'fixed' | 'interval' | 'chain' | 'conditional';
			day: number;
			state?: string;
			description?: string;
		}> = [];

		// Check each day in the range
		for (let day = fromDay + 1; day <= toDay; day++) {
			const activeEvents = this.getActiveEvents(day);

			for (const event of activeEvents) {
				// Only include fixed date events (holidays, etc.)
				// Chain events are too frequent to be "notable"
				// Conditional events might be notable if they just started
				if (event.type === 'fixed') {
					// Check if this is the first day of the event
					if (event.startDay === day) {
						notableEvents.push({
							eventId: event.eventId,
							name: event.name,
							type: event.type,
							day,
							description: event.definition.description
						});
					}
				}
			}
		}

		return notableEvents;
	}

	/**
	 * Set event state with GM override
	 *
	 * Allows GMs to manually override event states for narrative control.
	 *
	 * @param eventId Event identifier to override
	 * @param stateName State to force the event into (for chain events)
	 * @param permanent If true, updates the event definition; if false, creates temporary override
	 * @param notes Optional GM notes explaining the override
	 * @returns Override ID for tracking, or undefined if permanent
	 */
	async setEventState(
		eventId: string,
		stateName: string,
		permanent: boolean,
		notes?: string
	): Promise<string | undefined> {
		const eventDef = this.eventRegistry.get(eventId);
		if (!eventDef) {
			throw new Error(`Event '${eventId}' not found`);
		}

		// Only chain events support state changes
		if (eventDef.type !== 'chain') {
			throw new Error(`Event '${eventId}' is not a chain event and does not support state changes`);
		}

		const chainDef = eventDef as ChainEvent;
		const targetState = chainDef.states.find(s => s.name === stateName);
		if (!targetState) {
			throw new Error(`State '${stateName}' not found in event '${eventId}'`);
		}

		if (permanent) {
			// Permanent: Update the event definition via callback
			if (!this.config.onEventDefinitionUpdate) {
				throw new Error('Cannot apply permanent override: no definition update callback configured');
			}

			// Update the initial state in the definition
			const updatedDef: ChainEvent = {
				...chainDef,
				initialState: stateName
			};

			// Call the adapter to persist the change
			await this.config.onEventDefinitionUpdate(eventId, updatedDef);

			// Update in-memory registry
			this.eventRegistry.set(eventId, updatedDef);

			// Reset the chain runtime to use the new initial state
			const runtime = this.chainRuntimes.get(eventId);
			if (runtime) {
				// Create new RNG with same seed
				const newRng = this.rngFactory.create(chainDef.seed);
				runtime.rng = newRng;
				runtime.currentStateName = stateName;
				runtime.stateEnteredDay = this.currentDay;

				// Calculate new duration
				const duration = this.parseDuration(targetState.duration, newRng);
				runtime.stateDurationDays = duration;
				runtime.stateEndDay = this.currentDay + duration - 1;
			}

			// Invalidate cache for the affected event
			this.invalidateCacheForEvent(eventId);

			return undefined; // No override ID for permanent changes
		} else {
			// One-off: Create temporary override
			const runtime = this.chainRuntimes.get(eventId);
			if (!runtime) {
				throw new Error(`Chain runtime not found for event '${eventId}'`);
			}

			// Calculate duration for the forced state
			const duration = this.parseDuration(targetState.duration, runtime.rng);
			const expiresDay = this.currentDay + duration;

			// Create override record
			const overrideId = `override-${eventId}-${Date.now()}`;
			const override: GMOverride = {
				id: overrideId,
				eventId,
				scope: 'one_off',
				forcedStateName: stateName,
				forcedDuration: duration,
				appliedDay: this.currentDay,
				expiresDay,
				notes,
				createdAt: new Date().toISOString()
			};

			this.overrides.set(overrideId, override);

			// Update runtime immediately
			runtime.currentStateName = stateName;
			runtime.stateEnteredDay = this.currentDay;
			runtime.stateDurationDays = duration;
			runtime.stateEndDay = expiresDay - 1;

			// Invalidate cache for the affected event
			this.invalidateCacheForEvent(eventId);

			return overrideId;
		}
	}

	/**
	 * Get all active GM overrides
	 *
	 * @returns Array of all active overrides
	 */
	getOverrides(): GMOverride[] {
		return Array.from(this.overrides.values());
	}

	/**
	 * Get overrides for a specific event
	 *
	 * @param eventId Event identifier
	 * @returns Array of overrides for this event
	 */
	getEventOverrides(eventId: string): GMOverride[] {
		return Array.from(this.overrides.values()).filter(o => o.eventId === eventId);
	}

	/**
	 * Remove a specific GM override
	 *
	 * @param overrideId Override identifier to remove
	 * @returns true if override was found and removed
	 */
	removeOverride(overrideId: string): boolean {
		const override = this.overrides.get(overrideId);
		if (!override) {
			return false;
		}

		this.overrides.delete(overrideId);

		// Invalidate cache for the affected event
		this.invalidateCacheForEvent(override.eventId);

		return true;
	}

	/**
	 * Clear all GM overrides
	 */
	clearAllOverrides(): void {
		this.overrides.clear();
		this.dayCache.clear();
	}

	/**
	 * Restore GM overrides from saved state
	 *
	 * @param overrides Array of override records to restore
	 */
	restoreOverrides(overrides: GMOverride[]): void {
		this.overrides.clear();
		for (const override of overrides) {
			this.overrides.set(override.id, override);
		}

		// Invalidate cache after restoring overrides
		this.dayCache.clear();
	}

	// =========================================================================
	// Private Methods - Event Loading
	// =========================================================================

	/**
	 * Load all event definitions from the adapter
	 */
	private async loadEventDefinitions(): Promise<void> {
		if (!this.adapter) {
			return;
		}

		const definitions = await this.adapter.loadEventDefinitions();

		for (const def of definitions) {
			this.eventRegistry.set(def.id, def);
		}
	}

	/**
	 * Build lookup indexes for efficient event evaluation
	 */
	private buildEventIndexes(): void {
		this.fixedDateIndex.clear();
		this.intervalEvents = [];
		this.conditionalEvents = [];

		// Build set of valid event IDs for reference validation
		const validEventIds = new Set<string>(this.eventRegistry.keys());

		for (const [id, def] of this.eventRegistry) {
			switch (def.type) {
				case 'fixed':
					this.indexFixedDateEvent(def as FixedDateEvent);
					break;
				case 'interval':
					this.intervalEvents.push(def as IntervalEvent);
					break;
				case 'chain':
					// Chain events are handled by runtime, no index needed
					break;
				case 'conditional':
					// Validate condition at load time
					this.validateAndAddConditionalEvent(def as ConditionalEvent, validEventIds);
					break;
			}
		}

		// Sort conditional events by tier for proper phase ordering
		this.conditionalEvents.sort((a, b) => a.tier - b.tier);
	}

	/**
	 * Validate and add a conditional event to the index
	 *
	 * Validates that:
	 * - The condition can be parsed
	 * - All referenced events exist in the registry
	 * - Referenced events are from earlier phases (enforced by tier)
	 *
	 * Logs warnings for invalid conditions but still adds the event
	 * (graceful degradation - condition will return false at runtime)
	 */
	private validateAndAddConditionalEvent(
		event: ConditionalEvent,
		validEventIds: Set<string>
	): void {
		// Validate the condition syntax and references
		const validation = validateCondition(event.condition, validEventIds);

		if (!validation.isValid) {
			for (const error of validation.errors) {
				console.warn(
					`Conditional event '${event.id}' has invalid condition: ${error}`
				);
			}
		}

		// Check for forward references (conditionals can only reference earlier phases)
		// Tier 1 can reference: fixed, interval, chain events
		// Tier 2 can reference: fixed, interval, chain, and tier 1 conditional events
		const refs = extractEventReferences(event.condition);
		if (refs) {
			for (const refId of refs) {
				const refDef = this.eventRegistry.get(refId);
				if (refDef?.type === 'conditional') {
					const refTier = (refDef as ConditionalEvent).tier;
					if (refTier >= event.tier) {
						console.warn(
							`Conditional event '${event.id}' (tier ${event.tier}) references ` +
							`conditional event '${refId}' (tier ${refTier}). ` +
							`Conditionals can only reference events from earlier phases.`
						);
					}
				}
			}
		}

		// Add to list (even if invalid - will gracefully fail at runtime)
		this.conditionalEvents.push(event);
	}

	/**
	 * Index a fixed date event for O(1) lookup
	 */
	private indexFixedDateEvent(event: FixedDateEvent): void {
		let key: string;

		if (event.date.intercalaryName) {
			// Intercalary day lookup
			key = `intercalary-${event.date.intercalaryName}`;
		} else {
			// Standard date lookup
			key = `${event.date.month}-${event.date.day}`;
		}

		const existing = this.fixedDateIndex.get(key) || [];
		existing.push(event.id);
		this.fixedDateIndex.set(key, existing);
	}

	/**
	 * Initialize chain event runtimes with seeded RNG
	 */
	private initializeChainRuntimes(currentDay: number): void {
		for (const [id, def] of this.eventRegistry) {
			if (def.type === 'chain') {
				const chainDef = def as ChainEvent;

				// Skip if runtime already exists
				if (this.chainRuntimes.has(id)) {
					continue;
				}

				// Create isolated RNG for this chain
				const rng = this.rngFactory.create(chainDef.seed);

				// Select initial state
				const initialState = chainDef.initialState
					? chainDef.states.find(s => s.name === chainDef.initialState)
					: this.selectWeightedState(chainDef.states, rng);

				if (!initialState) {
					console.warn(`Chain event ${id} has no valid initial state`);
					continue;
				}

				// Calculate initial duration
				const duration = this.parseDuration(initialState.duration, rng);

				this.chainRuntimes.set(id, {
					eventId: id,
					rng,
					currentStateName: initialState.name,
					stateEnteredDay: 0,
					stateDurationDays: duration,
					stateEndDay: duration - 1
				});
			}
		}
	}

	// =========================================================================
	// Private Methods - Event Evaluation
	// =========================================================================

	/**
	 * Evaluate fixed date events for a given day
	 */
	private evaluateFixedDateEvents(day: number): ActiveEvent[] {
		const activeEvents: ActiveEvent[] = [];
		const date = this.driver.getDate(day);

		// Check standard date
		const dateKey = `${date.monthIndex}-${date.dayOfMonth}`;
		const dateEventIds = this.fixedDateIndex.get(dateKey) || [];

		for (const eventId of dateEventIds) {
			const event = this.eventRegistry.get(eventId) as FixedDateEvent;
			if (!event) continue;

			// Check if module is enabled
			if (!this.isEventModuleEnabled(event)) continue;

			// Check year constraint (for one-time events)
			if (event.date.year !== undefined && event.date.year !== date.year) {
				continue;
			}

			const duration = event.duration || 1;
			activeEvents.push(this.createActiveEvent(event, day, duration));
		}

		// Check intercalary day
		if (date.isIntercalary) {
			const intercalaryKey = `intercalary-${date.monthName}`;
			const intercalaryEventIds = this.fixedDateIndex.get(intercalaryKey) || [];

			for (const eventId of intercalaryEventIds) {
				const event = this.eventRegistry.get(eventId) as FixedDateEvent;
				if (!event) continue;

				if (!this.isEventModuleEnabled(event)) continue;

				const duration = event.duration || 1;
				activeEvents.push(this.createActiveEvent(event, day, duration));
			}
		}

		return activeEvents;
	}

	/**
	 * Evaluate interval events for a given day
	 *
	 * For daily intervals: (day + offset) % interval === 0
	 * For sub-day intervals: (totalMinutes + offset) % interval === 0
	 *
	 * Sub-day intervals use total minutes from epoch, where each day = 1440 minutes
	 */
	private evaluateIntervalEvents(day: number): ActiveEvent[] {
		const activeEvents: ActiveEvent[] = [];

		for (const event of this.intervalEvents) {
			if (!this.isEventModuleEnabled(event)) continue;

			const offset = event.offset || 0;
			const interval = event.interval;
			const useMinutes = event.useMinutes || false;

			let matches = false;
			const duration = event.duration || 1;

			if (useMinutes) {
				// Sub-day interval: use total minutes from epoch
				// Each day has 1440 minutes (24 * 60)
				const timeOfDay = this.driver.getTimeOfDay();
				const totalMinutes = day * 1440 + timeOfDay;

				// Check if we're within any active period
				const positionInInterval = ((totalMinutes - offset) % interval + interval) % interval;
				matches = positionInInterval < duration;
			} else {
				// Day-based interval: check if day falls within any active period
				// For an event with offset O and duration D, active periods are:
				// [O, O+D-1], [O+I, O+I+D-1], [O+2I, O+2I+D-1], ...
				const positionInInterval = ((day - offset) % interval + interval) % interval;
				matches = positionInInterval < duration;
			}

			if (matches) {
				// Calculate correct start day for this occurrence
				const positionInInterval = ((day - offset) % interval + interval) % interval;
				const startDay = day - positionInInterval;
				activeEvents.push(this.createActiveEvent(event, startDay, duration));
			}
		}

		return activeEvents;
	}

	/**
	 * Evaluate chain events for a given day
	 */
	private evaluateChainEvents(day: number, _phase1Events: ActiveEvent[]): ActiveEvent[] {
		const activeEvents: ActiveEvent[] = [];

		for (const [eventId, runtime] of this.chainRuntimes) {
			const def = this.eventRegistry.get(eventId) as ChainEvent;
			if (!def) continue;

			if (!this.isEventModuleEnabled(def)) continue;

			// Check for active override
			const override = this.getActiveOverride(eventId, day);

			// Check if we need to transition to a new state (only if not overridden)
			if (!override && day > runtime.stateEndDay) {
				this.transitionChainState(runtime, def, day);
			}

			// Get current state
			const currentState = def.states.find(s => s.name === runtime.currentStateName);
			if (!currentState) continue;

			// Determine source attribution
			const source: 'definition' | 'override' | 'gm_forced' = override ? 'gm_forced' : 'definition';

			// Create active event with current state's effects
			activeEvents.push({
				eventId: def.id,
				name: def.name,
				type: 'chain',
				state: runtime.currentStateName,
				priority: def.priority,
				effects: currentState.effects,
				startDay: runtime.stateEnteredDay,
				endDay: runtime.stateEndDay,
				remainingDays: Math.max(0, runtime.stateEndDay - day),
				source,
				definition: def
			});
		}

		return activeEvents;
	}

	/**
	 * Evaluate conditional events for a given day and tier
	 */
	private evaluateConditionalEvents(
		day: number,
		previousPhaseEvents: ActiveEvent[],
		tier: 1 | 2
	): ActiveEvent[] {
		const activeEvents: ActiveEvent[] = [];

		for (const event of this.conditionalEvents) {
			if (event.tier !== tier) continue;
			if (!this.isEventModuleEnabled(event)) continue;

			// Evaluate condition
			if (this.evaluateCondition(event.condition, previousPhaseEvents)) {
				const duration = event.duration || 1;
				activeEvents.push(this.createActiveEvent(event, day, duration));
			}
		}

		return activeEvents;
	}

	/**
	 * Evaluate a condition expression against active events
	 *
	 * Uses the secure ConditionParser utility which:
	 * - Parses conditions into an AST (no eval())
	 * - Supports logical operators: &&, ||, !
	 * - Supports comparisons: ==, !=, <, >, <=, >=
	 * - Gracefully handles missing event references
	 *
	 * @param condition - Condition expression string
	 * @param activeEvents - Currently active events from earlier phases
	 * @returns true if condition is satisfied, false otherwise
	 */
	private evaluateCondition(condition: string, activeEvents: ActiveEvent[]): boolean {
		// Build event state map for ConditionParser
		const eventsMap: EventStateMap = {};

		for (const event of activeEvents) {
			eventsMap[event.eventId] = {
				active: true,
				state: event.state,
				effects: event.effects
			};
		}

		// Use secure parser to evaluate condition
		const result = evaluateConditionUtil(condition, eventsMap);

		if (!result.success) {
			console.warn(`Failed to evaluate condition: ${condition}`, result.error);
			return false;
		}

		// Log warning for missing event references (graceful degradation)
		if (result.missingEventIds && result.missingEventIds.length > 0) {
			console.warn(
				`Condition "${condition}" references missing events: ${result.missingEventIds.join(', ')}`
			);
		}

		return result.value;
	}

	// =========================================================================
	// Private Methods - Chain Event State Management
	// =========================================================================

	/**
	 * Transition a chain event to a new state
	 */
	private transitionChainState(
		runtime: ChainEventRuntime,
		def: ChainEvent,
		currentDay: number
	): void {
		// Select next state using weighted random
		const nextState = this.selectWeightedState(def.states, runtime.rng);
		if (!nextState) return;

		// Calculate duration for new state
		const duration = this.parseDuration(nextState.duration, runtime.rng);

		// Update runtime
		runtime.currentStateName = nextState.name;
		runtime.stateEnteredDay = currentDay;
		runtime.stateDurationDays = duration;
		runtime.stateEndDay = currentDay + duration - 1;
	}

	/**
	 * Perform day-by-day simulation for moderate time jumps
	 *
	 * Iterates through each day, advancing chain states and reporting progress.
	 * Used when jump distance is below maxSimulationDays threshold.
	 *
	 * @param fromDay Starting day (exclusive)
	 * @param toDay Ending day (inclusive)
	 */
	private performDayByDaySimulation(fromDay: number, toDay: number): void {
		const totalDays = toDay - fromDay;
		let lastReportedProgress = 0;

		for (let day = fromDay + 1; day <= toDay; day++) {
			// Advance chain states for this day
			this.advanceChainEvents(day);

			// Report progress callback (throttled to avoid excessive UI updates)
			if (this.config.onTimeJumpProgress) {
				const progress = (day - fromDay) / totalDays;
				// Report every 5% or on final day
				if (progress >= lastReportedProgress + 0.05 || day === toDay) {
					this.config.onTimeJumpProgress(progress, 'simulation');
					lastReportedProgress = progress;
				}
			}
		}

		// Update current day
		this.currentDay = toDay;
	}

	/**
	 * Perform Anchor Reset for extreme time jumps
	 *
	 * Calculates target state directly without intermediate simulation.
	 * Used when jump distance exceeds maxSimulationDays threshold.
	 *
	 * Trade-off: O(1) performance vs. lost intermediate history.
	 *
	 * Algorithm:
	 * 1. Calculate how many full state cycles would occur
	 * 2. Fast-forward RNG state by running dummy transitions
	 * 3. Select final state for target day
	 * 4. Update chain runtimes with final state
	 *
	 * @param fromDay Starting day
	 * @param toDay Ending day
	 */
	private performAnchorReset(fromDay: number, toDay: number): void {
		const daysAdvanced = toDay - fromDay;

		// Report initial progress
		if (this.config.onTimeJumpProgress) {
			this.config.onTimeJumpProgress(0.1, 'anchor_reset');
		}

		// For each chain event, calculate target state
		for (const [eventId, runtime] of this.chainRuntimes) {
			const def = this.eventRegistry.get(eventId) as ChainEvent;
			if (!def) continue;

			// Fast-forward through state transitions
			let currentDay = fromDay;
			while (currentDay < toDay) {
				// Check if we need to transition (currentDay > runtime.stateEndDay)
				if (currentDay > runtime.stateEndDay) {
					// Select next state using weighted random
					const nextState = this.selectWeightedState(def.states, runtime.rng);
					if (!nextState) break;

					// Calculate duration for new state
					const duration = this.parseDuration(nextState.duration, runtime.rng);

					// Update runtime (but don't track intermediate history)
					runtime.currentStateName = nextState.name;
					runtime.stateEnteredDay = currentDay;
					runtime.stateDurationDays = duration;
					runtime.stateEndDay = currentDay + duration - 1;
				}

				// Jump to next transition point or target day
				const nextTransitionDay = runtime.stateEndDay + 1;
				currentDay = Math.min(nextTransitionDay, toDay);
			}
		}

		// Update current day
		this.currentDay = toDay;

		// Report completion
		if (this.config.onTimeJumpProgress) {
			this.config.onTimeJumpProgress(1.0, 'anchor_reset');
		}
	}

	/**
	 * Advance chain events when time progresses
	 */
	private advanceChainEvents(day: number): void {
		for (const [eventId, runtime] of this.chainRuntimes) {
			const def = this.eventRegistry.get(eventId) as ChainEvent;
			if (!def) continue;

			// Check for active override - don't transition if overridden
			const override = this.getActiveOverride(eventId, day);
			if (override) {
				continue; // Skip transition, let override control state
			}

			// Check if we need to transition
			if (day > runtime.stateEndDay) {
				this.transitionChainState(runtime, def, day);
			}
		}
	}

	/**
	 * Select a state using weighted random selection
	 */
	private selectWeightedState(
		states: ChainEventState[],
		rng: ISeededRandomizer
	): ChainEventState | undefined {
		if (states.length === 0) return undefined;

		const totalWeight = states.reduce((sum, s) => sum + s.weight, 0);
		if (totalWeight === 0) return states[0];

		const roll = rng.randomFloat() * totalWeight;
		let cumulative = 0;

		for (const state of states) {
			cumulative += state.weight;
			if (roll < cumulative) {
				return state;
			}
		}

		return states[states.length - 1];
	}

	/**
	 * Parse a duration string to days
	 *
	 * Uses the full DurationParser utility which supports:
	 * - Fixed: "5 days", "3 weeks", "2 months"
	 * - Dice: "2d6 days", "1d4 weeks", "1d3+2 days"
	 * - Compound: "1 week + 2d4 days", "2d6 days - 4 hours"
	 * - All units: minutes, hours, days, weeks, months, years
	 *
	 * Returns the duration in days (converted from minutes).
	 *
	 * @param durationStr - Duration notation string
	 * @param rng - Seeded randomizer for dice rolls
	 * @returns Duration in days (rounded)
	 */
	private parseDuration(durationStr: string, rng: ISeededRandomizer): number {
		// Build calendar-aware configuration
		const totalDaysInYear = this.driver.getTotalDaysInYear();
		const avgMonthDays = totalDaysInYear / 12 || 30;

		const config: DurationUnitConfig = {
			minutesPerHour: 60,
			hoursPerDay: 24,
			daysPerWeek: 7,
			daysPerMonth: avgMonthDays,
			daysPerYear: totalDaysInYear || 365
		};

		try {
			// Parse duration to minutes using DurationParser
			const totalMinutes = parseDurationUtil(durationStr, rng, config);

			// Convert minutes to days (1440 minutes per day with 24-hour days)
			const minutesPerDay = config.hoursPerDay * config.minutesPerHour;
			const days = Math.max(1, Math.round(totalMinutes / minutesPerDay));

			return days;
		} catch (error) {
			// Fallback to 1 day if parsing fails
			console.warn(`Failed to parse duration "${durationStr}": ${error}`);
			return 1;
		}
	}

	// =========================================================================
	// Private Methods - Helpers
	// =========================================================================

	/**
	 * Create an ActiveEvent from a definition
	 */
	private createActiveEvent(
		def: AnyEventDefinition,
		startDay: number,
		duration: number
	): ActiveEvent {
		return {
			eventId: def.id,
			name: def.name,
			type: def.type,
			state: def.name,  // For non-chain events, state = event name
			priority: def.priority,
			effects: def.effects,
			startDay,
			endDay: startDay + duration - 1,
			remainingDays: duration - 1,
			source: 'definition',
			definition: def
		};
	}

	/**
	 * Check if an event's module is enabled
	 */
	private isEventModuleEnabled(event: AnyEventDefinition): boolean {
		// Events with tags can be associated with modules
		if (event.tags && event.tags.length > 0) {
			for (const tag of event.tags) {
				// Check if any tag matches a disabled module
				if (this.moduleToggles.has(tag) && !this.moduleToggles.get(tag)) {
					return false;
				}
			}
		}
		return true;
	}

	/**
	 * Filter active events by context
	 *
	 * Supports hierarchical location matching:
	 * - Location paths use dot notation (e.g., "Waterdeep.North Ward.Shop")
	 * - Events tagged with parent locations apply to child locations
	 * - Example: Event at "Waterdeep" matches context "Waterdeep.North Ward"
	 *
	 * Filter Logic:
	 * - If context has a filter and event has that filter defined, they must match
	 * - If event doesn't define a filter (undefined/empty), it matches any context (global event)
	 * - Empty string filters are treated as "no filter" to avoid edge cases
	 */
	private filterByContext(events: ActiveEvent[], context?: EventContext): ActiveEvent[] {
		if (!context) return events;

		return events.filter(event => {
			const def = event.definition;

			// Location filter with hierarchical matching
			if (context.location !== undefined && context.location !== null) {
				// Empty location string matches nothing (special case)
				if (context.location === '') {
					return false;
				}

				// If context specifies a location, only match events that have locations
				if (!def.locations || def.locations.length === 0) {
					// Event has no location filter, exclude it when context specifies a location
					return false;
				}

				// Check if any event location matches the context location
				// Supports hierarchical matching:
				// - Exact match: "Waterdeep" === "Waterdeep"
				// - Parent match: "Waterdeep" applies to "Waterdeep.North Ward"
				// - Child match: "Waterdeep.North Ward" does NOT apply to "Waterdeep"
				const hasMatch = def.locations.some(eventLocation => {
					// Exact match
					if (eventLocation === context.location) {
						return true;
					}

					// Check if event location is a parent of context location
					// "Waterdeep" should match "Waterdeep.North Ward"
					// But NOT "Waterdeep." (trailing dot with no child)
					const parentPrefix = eventLocation + '.';
					if (context.location?.startsWith(parentPrefix) && context.location.length > parentPrefix.length) {
						return true;
					}

					return false;
				});

				if (!hasMatch) {
					return false;
				}
			}

			// Faction filter
			if (context.faction !== undefined && context.faction !== null && context.faction !== '') {
				// If context specifies a faction, only match events that have that faction
				if (!def.factions || def.factions.length === 0 || !def.factions.includes(context.faction)) {
					return false;
				}
			}

			// Season filter
			if (context.season !== undefined && context.season !== null && context.season !== '') {
				// If context specifies a season, only match events that have that season
				if (!def.seasons || def.seasons.length === 0 || !def.seasons.includes(context.season)) {
					return false;
				}
			}

			// Region filter
			if (context.region !== undefined && context.region !== null && context.region !== '') {
				// If context specifies a region, only match events that have that region
				if (!def.regions || def.regions.length === 0 || !def.regions.includes(context.region)) {
					return false;
				}
			}

			return true;
		});
	}

	/**
	 * Pre-compute buffer window for current day
	 */
	private precomputeBuffer(currentDay: number): void {
		const bufferStart = currentDay;
		const bufferEnd = currentDay + this.config.bufferSize;

		for (let day = bufferStart; day <= bufferEnd; day++) {
			if (!this.dayCache.has(day)) {
				// Force calculation by calling getActiveEvents
				this.getActiveEvents(day);
			}
		}
	}

	/**
	 * Trim cache entries outside the buffer window
	 */
	private trimCache(): void {
		const bufferStart = this.currentDay - this.config.bufferSize;

		for (const [day] of this.dayCache) {
			if (day < bufferStart) {
				this.dayCache.delete(day);
			}
		}
	}

	/**
	 * Invalidate cache entries that include a specific event
	 *
	 * Used when overrides are applied or removed to ensure affected days are recalculated
	 */
	private invalidateCacheForEvent(eventId: string): void {
		// Simple approach: Clear entire cache
		// Could be optimized to only clear days that include this event
		this.dayCache.clear();
	}

	/**
	 * Clean up expired one-off overrides
	 *
	 * Should be called during time progression to remove overrides that have expired
	 */
	private cleanExpiredOverrides(currentDay: number): void {
		const expiredOverrides: string[] = [];

		for (const [id, override] of this.overrides) {
			if (override.scope === 'one_off' && override.expiresDay !== undefined) {
				if (currentDay > override.expiresDay) {
					expiredOverrides.push(id);
				}
			}
		}

		// Remove expired overrides
		for (const id of expiredOverrides) {
			this.overrides.delete(id);
		}

		// Invalidate cache if any overrides were removed
		if (expiredOverrides.length > 0) {
			this.dayCache.clear();
		}
	}

	/**
	 * Check if an event has an active override for the current day
	 *
	 * @param eventId Event identifier
	 * @param currentDay Current day to check
	 * @returns Active override or undefined
	 */
	private getActiveOverride(eventId: string, currentDay: number): GMOverride | undefined {
		for (const override of this.overrides.values()) {
			if (override.eventId !== eventId) continue;

			// Check if override is active on this day
			if (override.scope === 'one_off') {
				// One-off overrides are active until expiration
				if (override.expiresDay === undefined || currentDay <= override.expiresDay) {
					return override;
				}
			} else if (override.scope === 'permanent') {
				// Permanent overrides are always active (but shouldn't be in the map)
				return override;
			}
		}

		return undefined;
	}
}
