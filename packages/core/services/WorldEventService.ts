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
	EffectRegistry,
	ChainEventState
} from '../models/eventTypes';
import { ChainStateVector, WorldState, ModuleToggle } from '../models/worldStateTypes';

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

	/** Configuration */
	private config: Required<WorldEventServiceConfig>;

	/** Initialization state */
	private initialized: boolean = false;

	/** Current day for tracking (used for cache management) */
	private currentDay: number = 0;

	constructor(
		driver: CalendarDriver,
		rngFactory: IRngFactory,
		config?: WorldEventServiceConfig
	) {
		this.driver = driver;
		this.rngFactory = rngFactory;
		this.config = {
			bufferSize: config?.bufferSize ?? 30,
			maxSimulationDays: config?.maxSimulationDays ?? 365
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
	 *
	 * @param day Absolute day counter
	 * @param context Optional event context for filtering
	 * @returns Effect registry with resolved effects
	 */
	getEffectRegistry(day: number, context?: EventContext): EffectRegistry {
		const activeEvents = this.getActiveEvents(day, context);

		// Aggregate effects from all active events
		const effects: Record<string, any> = {};

		for (const event of activeEvents) {
			// Merge effects based on priority and resolution rules
			for (const [key, value] of Object.entries(event.effects)) {
				if (effects[key] === undefined) {
					effects[key] = value;
				} else {
					// Basic conflict resolution (can be enhanced later)
					// Higher priority event's effect wins
					const existingEvent = activeEvents.find(e =>
						Object.keys(e.effects).includes(key) && e !== event
					);
					if (!existingEvent || event.priority > existingEvent.priority) {
						effects[key] = value;
					}
				}
			}
		}

		return {
			day,
			timeOfDay: this.driver.getTimeOfDay(),
			context: context || {},
			activeEvents,
			effects,
			computedAt: Date.now()
		};
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
	 * @param newDay New current day
	 */
	advanceToDay(newDay: number): void {
		const previousDay = this.currentDay;
		this.currentDay = newDay;

		// Process chain events for each day in the range
		for (let day = previousDay + 1; day <= newDay; day++) {
			this.advanceChainEvents(day);
		}

		// Trim old cache entries outside buffer window
		this.trimCache();

		// Pre-populate buffer for new window
		this.precomputeBuffer(newDay);
	}

	/**
	 * Get the CalendarDriver instance
	 */
	getCalendarDriver(): CalendarDriver {
		return this.driver;
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
					this.conditionalEvents.push(def as ConditionalEvent);
					break;
			}
		}

		// Sort conditional events by tier for proper phase ordering
		this.conditionalEvents.sort((a, b) => a.tier - b.tier);
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

			if (useMinutes) {
				// Sub-day interval: use total minutes from epoch
				// Each day has 1440 minutes (24 * 60)
				const timeOfDay = this.driver.getTimeOfDay();
				const totalMinutes = day * 1440 + timeOfDay;

				matches = (totalMinutes + offset) % interval === 0;
			} else {
				// Day-based interval: standard modulo math
				matches = (day + offset) % interval === 0;
			}

			if (matches) {
				const duration = event.duration || 1;
				activeEvents.push(this.createActiveEvent(event, day, duration));
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

			// Check if we need to transition to a new state
			if (day > runtime.stateEndDay) {
				this.transitionChainState(runtime, def, day);
			}

			// Get current state
			const currentState = def.states.find(s => s.name === runtime.currentStateName);
			if (!currentState) continue;

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
				source: 'definition',
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
	 */
	private evaluateCondition(condition: string, activeEvents: ActiveEvent[]): boolean {
		// Build event lookup map
		const eventsMap: Record<string, { active: boolean; state: string }> = {};

		for (const event of activeEvents) {
			eventsMap[event.eventId] = {
				active: true,
				state: event.state
			};
		}

		// Simple condition parsing
		// Supports: events['id'].active, events['id'].state == 'State'
		try {
			// Replace events['id'] references with actual values
			let evalCondition = condition;

			// Pattern: events['eventId'].active
			const activePattern = /events\['([^']+)'\]\.active/g;
			evalCondition = evalCondition.replace(activePattern, (_, eventId) => {
				return eventsMap[eventId]?.active ? 'true' : 'false';
			});

			// Pattern: events['eventId'].state == 'StateName'
			const statePattern = /events\['([^']+)'\]\.state\s*==\s*'([^']+)'/g;
			evalCondition = evalCondition.replace(statePattern, (_, eventId, stateName) => {
				return eventsMap[eventId]?.state === stateName ? 'true' : 'false';
			});

			// Pattern: events['eventId'].state != 'StateName'
			const stateNotPattern = /events\['([^']+)'\]\.state\s*!=\s*'([^']+)'/g;
			evalCondition = evalCondition.replace(stateNotPattern, (_, eventId, stateName) => {
				return eventsMap[eventId]?.state !== stateName ? 'true' : 'false';
			});

			// Replace logical operators
			evalCondition = evalCondition.replace(/&&/g, ' && ');
			evalCondition = evalCondition.replace(/\|\|/g, ' || ');
			evalCondition = evalCondition.replace(/!/g, '!');

			// Evaluate the boolean expression
			// Using Function constructor for safe evaluation (no access to scope)
			const fn = new Function(`return ${evalCondition};`);
			return fn();
		} catch (error) {
			console.warn(`Failed to evaluate condition: ${condition}`, error);
			return false;
		}
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
	 * Advance chain events when time progresses
	 */
	private advanceChainEvents(day: number): void {
		for (const [eventId, runtime] of this.chainRuntimes) {
			const def = this.eventRegistry.get(eventId) as ChainEvent;
			if (!def) continue;

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
	 * Supports:
	 * - Fixed: "5 days", "3 weeks"
	 * - Dice: "2d6 days", "1d4 weeks"
	 */
	private parseDuration(durationStr: string, rng: ISeededRandomizer): number {
		const normalized = durationStr.toLowerCase().trim();

		// Pattern: "Nd[M] [unit]" or "N [unit]"
		const dicePattern = /^(\d+)d(\d+)\s*(days?|weeks?|months?)?$/i;
		const fixedPattern = /^(\d+)\s*(days?|weeks?|months?)?$/i;

		let baseDays = 1;

		const diceMatch = normalized.match(dicePattern);
		if (diceMatch) {
			const count = parseInt(diceMatch[1], 10);
			const sides = parseInt(diceMatch[2], 10);
			const unit = diceMatch[3] || 'days';

			// Roll dice
			let total = 0;
			for (let i = 0; i < count; i++) {
				total += Math.floor(rng.randomFloat() * sides) + 1;
			}

			baseDays = this.convertTodays(total, unit);
			return baseDays;
		}

		const fixedMatch = normalized.match(fixedPattern);
		if (fixedMatch) {
			const value = parseInt(fixedMatch[1], 10);
			const unit = fixedMatch[2] || 'days';

			baseDays = this.convertTodays(value, unit);
			return baseDays;
		}

		// Default to 1 day if pattern not recognized
		return 1;
	}

	/**
	 * Convert a value in various units to days
	 */
	private convertTodays(value: number, unit: string): number {
		switch (unit.toLowerCase()) {
			case 'day':
			case 'days':
				return value;
			case 'week':
			case 'weeks':
				return value * 7;
			case 'month':
			case 'months':
				// Use average month length from calendar or default to 30
				const avgMonthDays = this.driver.getTotalDaysInYear() / 12 || 30;
				return Math.round(value * avgMonthDays);
			default:
				return value;
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
	 */
	private filterByContext(events: ActiveEvent[], context?: EventContext): ActiveEvent[] {
		if (!context) return events;

		return events.filter(event => {
			const def = event.definition;

			// Location filter
			if (context.location && def.locations && def.locations.length > 0) {
				if (!def.locations.includes(context.location)) {
					return false;
				}
			}

			// Faction filter
			if (context.faction && def.factions && def.factions.length > 0) {
				if (!def.factions.includes(context.faction)) {
					return false;
				}
			}

			// Season filter
			if (context.season && def.seasons && def.seasons.length > 0) {
				if (!def.seasons.includes(context.season)) {
					return false;
				}
			}

			// Region filter
			if (context.region && def.regions && def.regions.length > 0) {
				if (!def.regions.includes(context.region)) {
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
}
