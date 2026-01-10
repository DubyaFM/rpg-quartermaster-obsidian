/**
 * EffectRegistry - Effect Aggregation and Conflict Resolution
 *
 * Aggregates effects from all active events and resolves conflicts using
 * effect-specific resolution strategies.
 *
 * Architecture:
 * - Collects effects from active events
 * - Tracks source attribution (which event caused which effect)
 * - Applies resolution strategies per effect type
 * - Supports context filtering
 * - Registry is rebuilt on each calculation (no cross-call caching)
 *
 * Resolution Strategies:
 * - Multiplicative: price_mult_global, price_mult_tag (stack by multiplying)
 * - Boolean Any-True: shop_closed, restock_block (any true = true)
 * - Ordinal Min: light_level (darkest wins)
 * - Last Wins: ui_banner, ui_theme, season_set (highest priority event)
 *
 * Design Notes:
 * - Registry is stateless - each call to getResolvedEffects() recalculates
 * - Source attribution allows UI tooltips to show "why" effects are active
 * - Context filtering happens before effect aggregation
 */

import { ActiveEvent, EventContext } from '../models/eventTypes';
import { ResolvedEffects, CombinedEffects } from '../models/effectTypes';

/**
 * Effect source attribution
 * Tracks which events contributed to each effect
 */
export interface EffectSource {
	/** Effect key (e.g., "price_mult_global") */
	effectKey: string;
	/** Event ID that contributed this effect */
	eventId: string;
	/** Event name for display */
	eventName: string;
	/** Event priority (for conflict resolution) */
	eventPriority: number;
	/** Original effect value from event */
	originalValue: any;
	/** Whether this effect "won" the conflict resolution */
	applied: boolean;
}

/**
 * Effect aggregation result
 * Contains resolved effects and metadata about how they were resolved
 */
export interface EffectAggregationResult {
	/** Resolved effects after conflict resolution */
	effects: CombinedEffects;
	/** Source attribution for each effect */
	sources: EffectSource[];
	/** Resolution strategies applied */
	strategies: Record<string, string>;
}

/**
 * EffectRegistry - Aggregates and resolves effects from active events
 */
export class EffectRegistry {
	/**
	 * Get resolved effects for a given set of active events
	 *
	 * Performs full effect aggregation with conflict resolution and source tracking.
	 *
	 * @param day Absolute day counter
	 * @param activeEvents Active events to aggregate
	 * @param context Optional event context for filtering
	 * @param timeOfDay Optional time of day in minutes (for solar calculations)
	 * @param solarLightLevel Optional solar baseline light level (Layer 0)
	 * @returns Resolved effects with source attribution
	 */
	getResolvedEffects(
		day: number,
		activeEvents: ActiveEvent[],
		context?: EventContext,
		timeOfDay?: number,
		solarLightLevel?: 'bright' | 'dim' | 'dark'
	): ResolvedEffects {
		// Events are already filtered by WorldEventService's getActiveEvents()
		// which supports hierarchical location matching and other advanced filtering.
		// No need to filter again here - just aggregate the provided events.
		const aggregation = this.aggregateEffects(activeEvents, solarLightLevel);

		// Build resolved effects object
		const resolvedEffects: ResolvedEffects = {
			...aggregation.effects,
			resolvedDay: day,
			resolvedTimeOfDay: timeOfDay,
			resolvedContext: context,
			competingEffects: this.buildCompetingEffectsMap(aggregation.sources),
			resolutionStrategies: aggregation.strategies,
		};

		return resolvedEffects;
	}

	/**
	 * Aggregate effects from active events with conflict resolution
	 *
	 * Applies resolution strategies based on effect type:
	 * - Multiplicative: price_mult_global, price_mult_tag
	 * - Boolean Any-True: shop_closed, restock_block
	 * - Ordinal Min: light_level (with solar baseline as Layer 0)
	 * - Last Wins: ui_banner, ui_theme, season_set
	 *
	 * @param events Active events to aggregate
	 * @param solarLightLevel Optional solar baseline light level (Layer 0)
	 * @returns Aggregation result with resolved effects and source tracking
	 */
	private aggregateEffects(events: ActiveEvent[], solarLightLevel?: 'bright' | 'dim' | 'dark'): EffectAggregationResult {
		const sources: EffectSource[] = [];
		const effects: CombinedEffects = {};
		const strategies: Record<string, string> = {};

		// Collect all effects with source attribution
		for (const event of events) {
			for (const [key, value] of Object.entries(event.effects)) {
				sources.push({
					effectKey: key,
					eventId: event.eventId,
					eventName: event.name,
					eventPriority: event.priority,
					originalValue: value,
					applied: false, // Will be updated during resolution
				});
			}
		}

		// Resolve effects by type
		this.resolveMultiplicativeEffects(effects, sources, strategies);
		this.resolveBooleanAnyTrueEffects(effects, sources, strategies);
		this.resolveOrdinalMinEffects(effects, sources, strategies, solarLightLevel);
		this.resolveLastWinsEffects(effects, sources, strategies);
		this.resolveUnknownEffects(effects, sources, strategies); // Catch-all for custom effects

		return { effects, sources, strategies };
	}

	/**
	 * Resolve multiplicative effects (stack by multiplying)
	 *
	 * Effects: price_mult_global, price_mult_tag
	 * Strategy: Multiply all values together
	 * Example: 1.5 × 0.8 = 1.2 (50% increase then 20% discount = 20% increase)
	 */
	private resolveMultiplicativeEffects(
		effects: CombinedEffects,
		sources: EffectSource[],
		strategies: Record<string, string>
	): void {
		// price_mult_global
		const globalMultSources = sources.filter(
			s => s.effectKey === 'price_mult_global' &&
			typeof s.originalValue === 'number' &&
			!isNaN(s.originalValue)
		);
		if (globalMultSources.length > 0) {
			let multiplier = 1.0;
			for (const source of globalMultSources) {
				multiplier *= source.originalValue;
				source.applied = true;
			}
			effects.price_mult_global = multiplier;
			strategies.price_mult_global = 'multiply';
		}

		// price_mult_tag
		const tagMultSources = sources.filter(
			s => s.effectKey === 'price_mult_tag' &&
			s.originalValue &&
			typeof s.originalValue === 'object'
		);
		if (tagMultSources.length > 0) {
			const tagMultipliers: Record<string, number> = {};

			for (const source of tagMultSources) {
				const tagMap = source.originalValue as Record<string, number>;
				for (const [tag, mult] of Object.entries(tagMap)) {
					if (typeof mult === 'number' && !isNaN(mult)) {
						if (!tagMultipliers[tag]) {
							tagMultipliers[tag] = 1.0;
						}
						tagMultipliers[tag] *= mult;
					}
				}
				source.applied = true;
			}

			effects.price_mult_tag = tagMultipliers;
			strategies.price_mult_tag = 'multiply';
		}
	}

	/**
	 * Resolve boolean any-true effects (any true = true)
	 *
	 * Effects: shop_closed, restock_block
	 * Strategy: If any event sets true, result is true
	 */
	private resolveBooleanAnyTrueEffects(
		effects: CombinedEffects,
		sources: EffectSource[],
		strategies: Record<string, string>
	): void {
		const booleanKeys = ['shop_closed', 'restock_block'];

		for (const key of booleanKeys) {
			const keySources = sources.filter(
				s => s.effectKey === key &&
				typeof s.originalValue === 'boolean'
			);
			if (keySources.length > 0) {
				const anyTrue = keySources.some(s => s.originalValue === true);
				(effects as any)[key] = anyTrue;
				strategies[key] = 'any_true';

				// Mark sources as applied
				for (const source of keySources) {
					source.applied = source.originalValue === true;
				}
			}
		}
	}

	/**
	 * Resolve ordinal min effects (darkest/lowest wins)
	 *
	 * Effects: light_level
	 * Strategy: 'dark' > 'dim' > 'bright' (ordinal ranking)
	 *
	 * Light Level Layers:
	 * - Layer 0: Solar baseline (from CalendarDriver.getLightLevel)
	 * - Layer 1+: Event effects (eclipses, weather, magical darkness)
	 * - Merge: Math.min(solar, ...eventEffects) - darkest wins
	 *
	 * @param solarLightLevel Optional solar baseline (Layer 0)
	 */
	private resolveOrdinalMinEffects(
		effects: CombinedEffects,
		sources: EffectSource[],
		strategies: Record<string, string>,
		solarLightLevel?: 'bright' | 'dim' | 'dark'
	): void {
		const lightLevelSources = sources.filter(s => s.effectKey === 'light_level');
		const ordinalMap = { bright: 3, dim: 2, dark: 1 };

		// Start with solar baseline (Layer 0) if provided
		let darkestLevel: 'bright' | 'dim' | 'dark' = solarLightLevel || 'bright';
		let darkestRank = ordinalMap[darkestLevel];
		let winningSource: EffectSource | null = null;

		// Compare with event effects (Layer 1+)
		for (const source of lightLevelSources) {
			const level = source.originalValue as 'bright' | 'dim' | 'dark';
			const rank = ordinalMap[level] || ordinalMap.bright;
			if (rank < darkestRank) {
				darkestRank = rank;
				darkestLevel = level;
				winningSource = source;
			}
		}

		// Only set light_level if we have solar baseline or event effects
		if (solarLightLevel || lightLevelSources.length > 0) {
			effects.light_level = darkestLevel;
			strategies.light_level = 'ordinal_min';

			// Mark winning source as applied (if an event won, not solar baseline)
			if (winningSource) {
				winningSource.applied = true;
			}
		}
	}

	/**
	 * Resolve last-wins effects (highest priority event wins)
	 *
	 * Effects: ui_banner, ui_theme, season_set
	 * Strategy: Highest priority event wins, ties broken by event ID
	 */
	private resolveLastWinsEffects(
		effects: CombinedEffects,
		sources: EffectSource[],
		strategies: Record<string, string>
	): void {
		const lastWinsKeys = ['ui_banner', 'ui_theme', 'season_set'];

		for (const key of lastWinsKeys) {
			const keySources = sources.filter(s => s.effectKey === key);
			if (keySources.length > 0) {
				// Sort by priority (descending), then by event ID (ascending) for determinism
				keySources.sort((a, b) => {
					if (a.eventPriority !== b.eventPriority) {
						return b.eventPriority - a.eventPriority; // Higher priority first
					}
					return a.eventId.localeCompare(b.eventId); // Tie-breaker
				});

				const winner = keySources[0];
				(effects as any)[key] = winner.originalValue;
				strategies[key] = 'last_wins';
				winner.applied = true;
			}
		}
	}

	/**
	 * Filter active events by context
	 *
	 * Applies location, faction, season, region, and tag filters.
	 *
	 * @param events Active events to filter
	 * @param context Context filters
	 * @returns Filtered events
	 */
	private filterByContext(events: ActiveEvent[], context: EventContext): ActiveEvent[] {
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

			// Tag filter
			if (context.tags && context.tags.length > 0 && def.tags && def.tags.length > 0) {
				// Event must have at least one matching tag
				const hasMatchingTag = context.tags.some(tag => def.tags!.includes(tag));
				if (!hasMatchingTag) {
					return false;
				}
			}

			return true;
		});
	}

	/**
	 * Build competing effects map for UI tooltips
	 *
	 * Groups sources by effect key for display purposes.
	 *
	 * @param sources Effect sources
	 * @returns Map of effect key to contributing event IDs
	 */
	private buildCompetingEffectsMap(sources: EffectSource[]): Record<string, string[]> {
		const map: Record<string, string[]> = {};

		for (const source of sources) {
			if (!map[source.effectKey]) {
				map[source.effectKey] = [];
			}
			map[source.effectKey].push(source.eventId);
		}

		return map;
	}

	/**
	 * Get source attribution for a specific effect
	 *
	 * Useful for debugging or displaying detailed effect information.
	 *
	 * @param sources Effect sources
	 * @param effectKey Effect key to query
	 * @returns Array of sources for this effect
	 */
	getEffectSources(sources: EffectSource[], effectKey: string): EffectSource[] {
		return sources.filter(s => s.effectKey === effectKey);
	}

	/**
	 * Get applied sources (sources that contributed to final effects)
	 *
	 * @param sources Effect sources
	 * @returns Array of applied sources
	 */
	getAppliedSources(sources: EffectSource[]): EffectSource[] {
		return sources.filter(s => s.applied);
	}

	/**
	 * Get overridden sources (sources that were overridden by higher priority)
	 *
	 * @param sources Effect sources
	 * @returns Array of overridden sources
	 */
	getOverriddenSources(sources: EffectSource[]): EffectSource[] {
		return sources.filter(s => !s.applied);
	}

	/**
	 * Check if restocking is blocked by active effects
	 *
	 * Convenience method for UI layers to check if restock_block is active.
	 *
	 * @param effects Resolved effects
	 * @returns true if restocking is blocked, false otherwise
	 */
	isRestockBlocked(effects: ResolvedEffects): boolean {
		return effects.restock_block === true;
	}

	/**
	 * Get names of events that are blocking restock
	 *
	 * Useful for UI tooltips to explain why restocking is blocked.
	 *
	 * @param effects Resolved effects with source attribution
	 * @returns Array of event names that are blocking restock
	 */
	getRestockBlockingEventNames(effects: ResolvedEffects): string[] {
		if (!effects.competingEffects?.restock_block) {
			return [];
		}

		// Get all event IDs that contributed to restock_block
		const eventIds = effects.competingEffects.restock_block;

		// For any_true resolution, we only care about events that set restock_block to true
		// We need to find the event names for these IDs
		// Note: competingEffects contains all events that contributed to the effect,
		// but for any_true, only those that set true actually "apply"
		// We'll return all event IDs since the UI can filter if needed
		return eventIds;
	}

	/**
	 * Check if shop is closed by active effects
	 *
	 * Convenience method for UI layers to check if shop_closed is active.
	 *
	 * @param effects Resolved effects
	 * @returns true if shop is closed, false otherwise
	 */
	isShopClosed(effects: ResolvedEffects): boolean {
		return effects.shop_closed === true;
	}

	/**
	 * Get names of events that are closing the shop
	 *
	 * Useful for UI tooltips to explain why the shop is closed.
	 *
	 * @param effects Resolved effects with source attribution
	 * @returns Array of event IDs that are closing the shop
	 */
	getShopClosingEventNames(effects: ResolvedEffects): string[] {
		if (!effects.competingEffects?.shop_closed) {
			return [];
		}

		// Get all event IDs that contributed to shop_closed
		const eventIds = effects.competingEffects.shop_closed;

		// For any_true resolution, we only care about events that set shop_closed to true
		// We need to find the event names for these IDs
		// Note: competingEffects contains all events that contributed to the effect,
		// but for any_true, only those that set true actually "apply"
		// We'll return all event IDs since the UI can filter if needed
		return eventIds;
	}

	/**
	 * Resolve unknown/custom effects (not in predefined categories)
	 *
	 * Strategy: last_wins (highest priority event wins)
	 * This catches all custom effects that aren't handled by specific resolvers
	 */
	private resolveUnknownEffects(
		effects: CombinedEffects,
		sources: EffectSource[],
		strategies: Record<string, string>
	): void {
		// Get all effect keys that have already been resolved
		const resolvedKeys = new Set(Object.keys(strategies));

		// Find all unique effect keys from sources
		const allKeys = new Set(sources.map(s => s.effectKey));

		// Resolve any keys that haven't been handled yet
		for (const key of allKeys) {
			if (!resolvedKeys.has(key)) {
				const keySources = sources.filter(s => s.effectKey === key);

				// Sort by priority (descending), then by event ID (ascending) for determinism
				keySources.sort((a, b) => {
					if (a.eventPriority !== b.eventPriority) {
						return b.eventPriority - a.eventPriority; // Higher priority first
					}
					return a.eventId.localeCompare(b.eventId); // Tie-breaker
				});

				const winner = keySources[0];
				(effects as any)[key] = winner.originalValue;
				strategies[key] = 'last_wins';
				winner.applied = true;
			}
		}
	}
}
