/**
 * EffectRegistry Tests (TKT-CAL-031)
 *
 * Comprehensive tests for Effect Registry - Effect Aggregation System
 *
 * Tests cover:
 * - Effect collection from active events
 * - Source attribution tracking (which event caused which effect)
 * - Conflict resolution strategies:
 *   - Multiplicative: price_mult_global, price_mult_tag (stack by multiplying)
 *   - Boolean Any-True: shop_closed, restock_block (any true = true)
 *   - Ordinal Min: light_level (darkest wins)
 *   - Last Wins: ui_banner, ui_theme, season_set (highest priority)
 * - Context filtering (location, faction, season, region, tags)
 * - Competing effects metadata for UI tooltips
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EffectRegistry, EffectSource } from '../services/EffectRegistry';
import { ActiveEvent, EventContext } from '../models/eventTypes';
import { ResolvedEffects } from '../models/effectTypes';

// ==========================================================================
// Test Fixtures - Active Events
// ==========================================================================

/**
 * Helper function to create mock active events
 */
function createMockActiveEvent(
	id: string,
	name: string,
	priority: number,
	effects: Record<string, any>,
	locationFilter?: string[],
	factionFilter?: string[]
): ActiveEvent {
	return {
		eventId: id,
		name,
		type: 'fixed',
		state: name,
		priority,
		effects,
		startDay: 0,
		endDay: 1,
		remainingDays: 1,
		source: 'definition',
		definition: {
			id,
			name,
			type: 'fixed',
			priority,
			effects,
			date: { month: 0, day: 1 },
			locations: locationFilter,
			factions: factionFilter
		}
	};
}

// ==========================================================================
// Basic Effect Aggregation Tests
// ==========================================================================

describe('EffectRegistry - Basic Aggregation', () => {
	let registry: EffectRegistry;

	beforeEach(() => {
		registry = new EffectRegistry();
	});

	it('should aggregate effects from a single event', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('market-day', 'Market Day', 1, {
				price_mult_global: 0.9,
				ui_banner: 'Market Day - All prices reduced!'
			})
		];

		const resolved = registry.getResolvedEffects(0, events);

		expect(resolved.price_mult_global).toBe(0.9);
		expect(resolved.ui_banner).toBe('Market Day - All prices reduced!');
		expect(resolved.resolvedDay).toBe(0);
	});

	it('should aggregate effects from multiple events', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('market-day', 'Market Day', 1, {
				price_mult_global: 0.9,
				ui_banner: 'Market Day'
			}),
			createMockActiveEvent('festival', 'Festival', 2, {
				shop_closed: true,
				ui_banner: 'Festival of the Moon'
			})
		];

		const resolved = registry.getResolvedEffects(0, events);

		expect(resolved.price_mult_global).toBe(0.9);
		expect(resolved.shop_closed).toBe(true);
		expect(resolved.ui_banner).toBe('Festival of the Moon'); // Higher priority wins
	});

	it('should handle events with no effects', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('empty-event', 'Empty Event', 1, {})
		];

		const resolved = registry.getResolvedEffects(0, events);

		expect(resolved.price_mult_global).toBeUndefined();
		expect(resolved.shop_closed).toBeUndefined();
	});

	it('should handle empty event list', () => {
		const resolved = registry.getResolvedEffects(0, []);

		expect(resolved.price_mult_global).toBeUndefined();
		expect(resolved.shop_closed).toBeUndefined();
		expect(resolved.resolvedDay).toBe(0);
	});
});

// ==========================================================================
// Multiplicative Effect Tests
// ==========================================================================

describe('EffectRegistry - Multiplicative Effects', () => {
	let registry: EffectRegistry;

	beforeEach(() => {
		registry = new EffectRegistry();
	});

	it('should multiply price_mult_global from multiple events', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('inflation', 'Inflation', 1, {
				price_mult_global: 1.5 // +50%
			}),
			createMockActiveEvent('discount', 'Discount Day', 2, {
				price_mult_global: 0.8 // -20%
			})
		];

		const resolved = registry.getResolvedEffects(0, events);

		// 1.5 × 0.8 = 1.2 (+20% net)
		expect(resolved.price_mult_global).toBeCloseTo(1.2, 5);
		expect(resolved.resolutionStrategies?.price_mult_global).toBe('multiply');
	});

	it('should multiply price_mult_tag across multiple events and tags', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('weapon-shortage', 'Weapon Shortage', 1, {
				price_mult_tag: { weapon: 1.5, armor: 1.2 }
			}),
			createMockActiveEvent('blacksmith-sale', 'Blacksmith Sale', 2, {
				price_mult_tag: { weapon: 0.9, tool: 0.8 }
			})
		];

		const resolved = registry.getResolvedEffects(0, events);

		// weapon: 1.5 × 0.9 = 1.35
		// armor: 1.2 (no other multipliers)
		// tool: 0.8 (no other multipliers)
		expect(resolved.price_mult_tag?.weapon).toBeCloseTo(1.35, 5);
		expect(resolved.price_mult_tag?.armor).toBeCloseTo(1.2, 5);
		expect(resolved.price_mult_tag?.tool).toBeCloseTo(0.8, 5);
		expect(resolved.resolutionStrategies?.price_mult_tag).toBe('multiply');
	});

	it('should handle single price_mult_global', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('inflation', 'Inflation', 1, {
				price_mult_global: 1.5
			})
		];

		const resolved = registry.getResolvedEffects(0, events);

		expect(resolved.price_mult_global).toBe(1.5);
	});
});

// ==========================================================================
// Boolean Any-True Effect Tests
// ==========================================================================

describe('EffectRegistry - Boolean Any-True Effects', () => {
	let registry: EffectRegistry;

	beforeEach(() => {
		registry = new EffectRegistry();
	});

	it('should resolve shop_closed as true if any event sets it', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('open-event', 'Open Event', 1, {
				shop_closed: false
			}),
			createMockActiveEvent('holiday', 'Holiday', 2, {
				shop_closed: true
			})
		];

		const resolved = registry.getResolvedEffects(0, events);

		expect(resolved.shop_closed).toBe(true);
		expect(resolved.resolutionStrategies?.shop_closed).toBe('any_true');
	});

	it('should resolve restock_block as true if any event sets it', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('normal-day', 'Normal Day', 1, {
				restock_block: false
			}),
			createMockActiveEvent('siege', 'Siege', 2, {
				restock_block: true
			})
		];

		const resolved = registry.getResolvedEffects(0, events);

		expect(resolved.restock_block).toBe(true);
		expect(resolved.resolutionStrategies?.restock_block).toBe('any_true');
	});

	it('should resolve shop_closed as false if all events set it to false', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('open-event-1', 'Open Event 1', 1, {
				shop_closed: false
			}),
			createMockActiveEvent('open-event-2', 'Open Event 2', 2, {
				shop_closed: false
			})
		];

		const resolved = registry.getResolvedEffects(0, events);

		expect(resolved.shop_closed).toBe(false);
	});
});

// ==========================================================================
// Ordinal Min Effect Tests
// ==========================================================================

describe('EffectRegistry - Ordinal Min Effects', () => {
	let registry: EffectRegistry;

	beforeEach(() => {
		registry = new EffectRegistry();
	});

	it('should resolve light_level to darkest level', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('day', 'Daytime', 1, {
				light_level: 'bright'
			}),
			createMockActiveEvent('overcast', 'Overcast', 2, {
				light_level: 'dim'
			}),
			createMockActiveEvent('eclipse', 'Eclipse', 3, {
				light_level: 'dark'
			})
		];

		const resolved = registry.getResolvedEffects(0, events);

		expect(resolved.light_level).toBe('dark');
		expect(resolved.resolutionStrategies?.light_level).toBe('ordinal_min');
	});

	it('should handle light_level with only dim and bright', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('day', 'Daytime', 1, {
				light_level: 'bright'
			}),
			createMockActiveEvent('fog', 'Fog', 2, {
				light_level: 'dim'
			})
		];

		const resolved = registry.getResolvedEffects(0, events);

		expect(resolved.light_level).toBe('dim');
	});

	it('should handle single light_level', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('day', 'Daytime', 1, {
				light_level: 'bright'
			})
		];

		const resolved = registry.getResolvedEffects(0, events);

		expect(resolved.light_level).toBe('bright');
	});
});

// ==========================================================================
// Last-Wins Effect Tests
// ==========================================================================

describe('EffectRegistry - Last-Wins Effects', () => {
	let registry: EffectRegistry;

	beforeEach(() => {
		registry = new EffectRegistry();
	});

	it('should resolve ui_banner to highest priority event', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('low-priority', 'Low Priority', 1, {
				ui_banner: 'Low Priority Banner'
			}),
			createMockActiveEvent('high-priority', 'High Priority', 10, {
				ui_banner: 'High Priority Banner'
			}),
			createMockActiveEvent('mid-priority', 'Mid Priority', 5, {
				ui_banner: 'Mid Priority Banner'
			})
		];

		const resolved = registry.getResolvedEffects(0, events);

		expect(resolved.ui_banner).toBe('High Priority Banner');
		expect(resolved.resolutionStrategies?.ui_banner).toBe('last_wins');
	});

	it('should resolve ui_theme to highest priority event', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('normal', 'Normal', 1, {
				ui_theme: 'default'
			}),
			createMockActiveEvent('spooky', 'Spooky Event', 5, {
				ui_theme: 'spooky'
			})
		];

		const resolved = registry.getResolvedEffects(0, events);

		expect(resolved.ui_theme).toBe('spooky');
		expect(resolved.resolutionStrategies?.ui_theme).toBe('last_wins');
	});

	it('should resolve season_set to highest priority event', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('natural-season', 'Natural Season', 1, {
				season_set: 'summer'
			}),
			createMockActiveEvent('eternal-winter', 'Eternal Winter', 10, {
				season_set: 'winter'
			})
		];

		const resolved = registry.getResolvedEffects(0, events);

		expect(resolved.season_set).toBe('winter');
		expect(resolved.resolutionStrategies?.season_set).toBe('last_wins');
	});

	it('should use event ID as tie-breaker for equal priorities', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('event-b', 'Event B', 5, {
				ui_banner: 'Banner B'
			}),
			createMockActiveEvent('event-a', 'Event A', 5, {
				ui_banner: 'Banner A'
			})
		];

		const resolved = registry.getResolvedEffects(0, events);

		// event-a comes before event-b alphabetically
		expect(resolved.ui_banner).toBe('Banner A');
	});
});

// ==========================================================================
// Source Attribution Tests
// ==========================================================================

describe('EffectRegistry - Source Attribution', () => {
	let registry: EffectRegistry;

	beforeEach(() => {
		registry = new EffectRegistry();
	});

	it('should track source attribution in competing effects map', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('event-1', 'Event 1', 1, {
				price_mult_global: 1.5,
				shop_closed: true
			}),
			createMockActiveEvent('event-2', 'Event 2', 2, {
				price_mult_global: 0.8,
				ui_banner: 'Banner'
			})
		];

		const resolved = registry.getResolvedEffects(0, events);

		expect(resolved.competingEffects).toBeDefined();
		expect(resolved.competingEffects?.price_mult_global).toContain('event-1');
		expect(resolved.competingEffects?.price_mult_global).toContain('event-2');
		expect(resolved.competingEffects?.shop_closed).toContain('event-1');
		expect(resolved.competingEffects?.ui_banner).toContain('event-2');
	});

	it('should include resolution strategies in resolved effects', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('event-1', 'Event 1', 1, {
				price_mult_global: 1.5,
				shop_closed: true,
				light_level: 'dim',
				ui_banner: 'Banner'
			})
		];

		const resolved = registry.getResolvedEffects(0, events);

		expect(resolved.resolutionStrategies).toBeDefined();
		expect(resolved.resolutionStrategies?.price_mult_global).toBe('multiply');
		expect(resolved.resolutionStrategies?.shop_closed).toBe('any_true');
		expect(resolved.resolutionStrategies?.light_level).toBe('ordinal_min');
		expect(resolved.resolutionStrategies?.ui_banner).toBe('last_wins');
	});
});

// ==========================================================================
// Context Filtering Tests
// ==========================================================================

describe('EffectRegistry - Context Filtering', () => {
	let registry: EffectRegistry;

	beforeEach(() => {
		registry = new EffectRegistry();
	});

	it('should filter events by location', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('waterdeep-event', 'Waterdeep Event', 1, {
				price_mult_global: 1.5
			}, ['waterdeep']),
			createMockActiveEvent('neverwinter-event', 'Neverwinter Event', 2, {
				price_mult_global: 0.8
			}, ['neverwinter'])
		];

		const context: EventContext = { location: 'waterdeep' };
		const resolved = registry.getResolvedEffects(0, events, context);

		// Only waterdeep event should apply
		expect(resolved.price_mult_global).toBe(1.5);
	});

	it('should filter events by faction', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('harpers-event', 'Harpers Event', 1, {
				shop_closed: true
			}, undefined, ['harpers']),
			createMockActiveEvent('zhentarim-event', 'Zhentarim Event', 2, {
				shop_closed: false
			}, undefined, ['zhentarim'])
		];

		const context: EventContext = { faction: 'harpers' };
		const resolved = registry.getResolvedEffects(0, events, context);

		// Only harpers event should apply
		expect(resolved.shop_closed).toBe(true);
	});

	it('should include events with no location filter when filtering by location', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('global-event', 'Global Event', 1, {
				price_mult_global: 1.5
			}), // No location filter
			createMockActiveEvent('waterdeep-event', 'Waterdeep Event', 2, {
				price_mult_global: 0.8
			}, ['waterdeep'])
		];

		const context: EventContext = { location: 'waterdeep' };
		const resolved = registry.getResolvedEffects(0, events, context);

		// Both events should apply: 1.5 × 0.8 = 1.2
		expect(resolved.price_mult_global).toBeCloseTo(1.2, 5);
	});

	it('should handle multiple context filters', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('specific-event', 'Specific Event', 1, {
				ui_banner: 'Specific'
			}, ['waterdeep'], ['harpers']),
			createMockActiveEvent('wrong-location', 'Wrong Location', 2, {
				ui_banner: 'Wrong'
			}, ['neverwinter'], ['harpers']),
			createMockActiveEvent('wrong-faction', 'Wrong Faction', 3, {
				ui_banner: 'Wrong'
			}, ['waterdeep'], ['zhentarim'])
		];

		const context: EventContext = { location: 'waterdeep', faction: 'harpers' };
		const resolved = registry.getResolvedEffects(0, events, context);

		// Only specific-event should apply
		expect(resolved.ui_banner).toBe('Specific');
	});

	it('should not filter when no context provided', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('event-1', 'Event 1', 1, {
				price_mult_global: 1.5
			}, ['waterdeep']),
			createMockActiveEvent('event-2', 'Event 2', 2, {
				price_mult_global: 0.8
			}, ['neverwinter'])
		];

		const resolved = registry.getResolvedEffects(0, events);

		// Both events should apply: 1.5 × 0.8 = 1.2
		expect(resolved.price_mult_global).toBeCloseTo(1.2, 5);
	});
});

// ==========================================================================
// Complex Integration Tests
// ==========================================================================

describe('EffectRegistry - Complex Integration', () => {
	let registry: EffectRegistry;

	beforeEach(() => {
		registry = new EffectRegistry();
	});

	it('should handle complex multi-effect scenario', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('market-day', 'Market Day', 5, {
				price_mult_global: 0.9,
				price_mult_tag: { food: 0.7, weapon: 1.1 },
				ui_banner: 'Market Day!'
			}),
			createMockActiveEvent('storm', 'Storm', 3, {
				light_level: 'dark',
				restock_block: true,
				price_mult_tag: { food: 1.5 } // Food spoilage
			}),
			createMockActiveEvent('festival', 'Festival', 10, {
				shop_closed: true,
				ui_banner: 'Festival of the Moon',
				ui_theme: 'festive'
			})
		];

		const resolved = registry.getResolvedEffects(0, events);

		// Multiplicative effects
		expect(resolved.price_mult_global).toBe(0.9);
		expect(resolved.price_mult_tag?.food).toBeCloseTo(1.05, 5); // 0.7 × 1.5
		expect(resolved.price_mult_tag?.weapon).toBeCloseTo(1.1, 5);

		// Boolean effects
		expect(resolved.shop_closed).toBe(true);
		expect(resolved.restock_block).toBe(true);

		// Ordinal effects
		expect(resolved.light_level).toBe('dark');

		// Last-wins effects
		expect(resolved.ui_banner).toBe('Festival of the Moon'); // Highest priority
		expect(resolved.ui_theme).toBe('festive');

		// Metadata
		expect(resolved.resolvedDay).toBe(0);
		expect(resolved.competingEffects).toBeDefined();
		expect(resolved.resolutionStrategies).toBeDefined();
	});

	it('should maintain source attribution in complex scenario', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('event-a', 'Event A', 1, {
				price_mult_global: 1.2,
				shop_closed: false
			}),
			createMockActiveEvent('event-b', 'Event B', 2, {
				price_mult_global: 0.9,
				shop_closed: true
			}),
			createMockActiveEvent('event-c', 'Event C', 3, {
				price_mult_global: 1.1,
				light_level: 'dim'
			})
		];

		const resolved = registry.getResolvedEffects(0, events);

		// All three events contribute to price_mult_global
		expect(resolved.competingEffects?.price_mult_global).toHaveLength(3);
		expect(resolved.competingEffects?.price_mult_global).toContain('event-a');
		expect(resolved.competingEffects?.price_mult_global).toContain('event-b');
		expect(resolved.competingEffects?.price_mult_global).toContain('event-c');

		// Both event-a and event-b contribute to shop_closed
		expect(resolved.competingEffects?.shop_closed).toHaveLength(2);

		// Only event-c contributes to light_level
		expect(resolved.competingEffects?.light_level).toHaveLength(1);
		expect(resolved.competingEffects?.light_level).toContain('event-c');
	});
});

// ==========================================================================
// Priority Override Tests (TKT-CAL-032)
// ==========================================================================

describe('EffectRegistry - Priority Override', () => {
	let registry: EffectRegistry;

	beforeEach(() => {
		registry = new EffectRegistry();
	});

	it('should prioritize higher priority events for last-wins effects', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('low-priority', 'Low Priority', 1, {
				ui_banner: 'Low Priority Banner',
				ui_theme: 'default'
			}),
			createMockActiveEvent('high-priority', 'High Priority', 100, {
				ui_banner: 'High Priority Banner',
				ui_theme: 'special'
			}),
			createMockActiveEvent('mid-priority', 'Mid Priority', 50, {
				ui_banner: 'Mid Priority Banner'
			})
		];

		const resolved = registry.getResolvedEffects(0, events);

		// Highest priority should win
		expect(resolved.ui_banner).toBe('High Priority Banner');
		expect(resolved.ui_theme).toBe('special');
	});

	it('should not use priority for multiplicative effects (all stack)', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('low-priority', 'Low Priority', 1, {
				price_mult_global: 1.5
			}),
			createMockActiveEvent('high-priority', 'High Priority', 100, {
				price_mult_global: 0.8
			})
		];

		const resolved = registry.getResolvedEffects(0, events);

		// Both should multiply together regardless of priority
		expect(resolved.price_mult_global).toBeCloseTo(1.2, 5);
	});

	it('should not use priority for boolean any-true effects', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('low-priority', 'Low Priority', 1, {
				shop_closed: true
			}),
			createMockActiveEvent('high-priority', 'High Priority', 100, {
				shop_closed: false
			})
		];

		const resolved = registry.getResolvedEffects(0, events);

		// Any true should win regardless of priority
		expect(resolved.shop_closed).toBe(true);
	});

	it('should not use priority for ordinal min effects', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('low-priority', 'Low Priority', 1, {
				light_level: 'dark'
			}),
			createMockActiveEvent('high-priority', 'High Priority', 100, {
				light_level: 'bright'
			})
		];

		const resolved = registry.getResolvedEffects(0, events);

		// Darkest should win regardless of priority
		expect(resolved.light_level).toBe('dark');
	});

	it('should use event ID as tie-breaker for equal priorities', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('event-zebra', 'Event Zebra', 10, {
				ui_banner: 'Zebra Banner'
			}),
			createMockActiveEvent('event-alpha', 'Event Alpha', 10, {
				ui_banner: 'Alpha Banner'
			}),
			createMockActiveEvent('event-mike', 'Event Mike', 10, {
				ui_banner: 'Mike Banner'
			})
		];

		const resolved = registry.getResolvedEffects(0, events);

		// event-alpha comes first alphabetically
		expect(resolved.ui_banner).toBe('Alpha Banner');
	});
});

// ==========================================================================
// Solar Baseline Light Level Tests (TKT-CAL-038)
// ==========================================================================

describe('EffectRegistry - Solar Baseline Light Level', () => {
	let registry: EffectRegistry;

	beforeEach(() => {
		registry = new EffectRegistry();
	});

	it('should use solar baseline when no events provide light_level', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('market-day', 'Market Day', 1, {
				price_mult_global: 0.9
			})
		];

		// Mock solar baseline: bright during day
		const resolved = registry.getResolvedEffects(0, events, undefined, 720, 'bright');

		// No event effects, should use solar baseline
		expect(resolved.light_level).toBe('bright');
		expect(resolved.resolutionStrategies?.light_level).toBe('ordinal_min');
	});

	it('should merge solar baseline with event light_level (darkest wins)', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('fog', 'Fog', 1, {
				light_level: 'dim'
			})
		];

		// Solar baseline: bright (day)
		const resolved = registry.getResolvedEffects(0, events, undefined, 720, 'bright');

		// Event is darker than solar, event wins: dim
		expect(resolved.light_level).toBe('dim');
	});

	it('should use solar baseline when it is darker than events', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('magical-light', 'Magical Light', 1, {
				light_level: 'bright'
			})
		];

		// Solar baseline: dark (night)
		const resolved = registry.getResolvedEffects(0, events, undefined, 0, 'dark');

		// Solar is darker than event, solar wins: dark
		expect(resolved.light_level).toBe('dark');
	});

	it('should handle solar baseline with multiple events', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('overcast', 'Overcast', 1, {
				light_level: 'dim'
			}),
			createMockActiveEvent('fog', 'Fog', 2, {
				light_level: 'dim'
			})
		];

		// Solar baseline: bright (day)
		const resolved = registry.getResolvedEffects(0, events, undefined, 720, 'bright');

		// Multiple events at dim, solar at bright, darkest wins: dim
		expect(resolved.light_level).toBe('dim');
	});

	it('should handle eclipse scenario (event darker than night)', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('eclipse', 'Solar Eclipse', 1, {
				light_level: 'dark'
			})
		];

		// Solar baseline: bright (midday)
		const resolved = registry.getResolvedEffects(0, events, undefined, 720, 'bright');

		// Eclipse overrides bright day: dark
		expect(resolved.light_level).toBe('dark');
	});

	it('should handle twilight with dim event', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('fog', 'Fog', 1, {
				light_level: 'dim'
			})
		];

		// Solar baseline: dim (dusk)
		const resolved = registry.getResolvedEffects(0, events, undefined, 1140, 'dim');

		// Both solar and event are dim: dim
		expect(resolved.light_level).toBe('dim');
	});
});

// ==========================================================================
// Helper Methods Tests (TKT-CAL-035, TKT-CAL-036)
// ==========================================================================

describe('EffectRegistry - Helper Methods', () => {
	let registry: EffectRegistry;

	beforeEach(() => {
		registry = new EffectRegistry();
	});

	describe('Restock Block Helpers', () => {
		it('should return true when restock is blocked', () => {
			const events: ActiveEvent[] = [
				createMockActiveEvent('siege', 'Siege', 1, {
					restock_block: true
				})
			];

			const resolved = registry.getResolvedEffects(0, events);

			expect(registry.isRestockBlocked(resolved)).toBe(true);
		});

		it('should return false when restock is not blocked', () => {
			const events: ActiveEvent[] = [
				createMockActiveEvent('normal-day', 'Normal Day', 1, {
					restock_block: false
				})
			];

			const resolved = registry.getResolvedEffects(0, events);

			expect(registry.isRestockBlocked(resolved)).toBe(false);
		});

		it('should return false when restock_block effect is not present', () => {
			const events: ActiveEvent[] = [
				createMockActiveEvent('market-day', 'Market Day', 1, {
					price_mult_global: 0.9
				})
			];

			const resolved = registry.getResolvedEffects(0, events);

			expect(registry.isRestockBlocked(resolved)).toBe(false);
		});

		it('should return event IDs that are blocking restock', () => {
			const events: ActiveEvent[] = [
				createMockActiveEvent('siege', 'Siege', 1, {
					restock_block: true
				}),
				createMockActiveEvent('blockade', 'Blockade', 2, {
					restock_block: true
				})
			];

			const resolved = registry.getResolvedEffects(0, events);
			const blockingEvents = registry.getRestockBlockingEventNames(resolved);

			expect(blockingEvents).toHaveLength(2);
			expect(blockingEvents).toContain('siege');
			expect(blockingEvents).toContain('blockade');
		});

		it('should return empty array when no events block restock', () => {
			const events: ActiveEvent[] = [
				createMockActiveEvent('market-day', 'Market Day', 1, {
					price_mult_global: 0.9
				})
			];

			const resolved = registry.getResolvedEffects(0, events);
			const blockingEvents = registry.getRestockBlockingEventNames(resolved);

			expect(blockingEvents).toHaveLength(0);
		});
	});

	describe('Shop Closed Helpers', () => {
		it('should return true when shop is closed', () => {
			const events: ActiveEvent[] = [
				createMockActiveEvent('holiday', 'Holiday', 1, {
					shop_closed: true
				})
			];

			const resolved = registry.getResolvedEffects(0, events);

			expect(registry.isShopClosed(resolved)).toBe(true);
		});

		it('should return false when shop is open', () => {
			const events: ActiveEvent[] = [
				createMockActiveEvent('normal-day', 'Normal Day', 1, {
					shop_closed: false
				})
			];

			const resolved = registry.getResolvedEffects(0, events);

			expect(registry.isShopClosed(resolved)).toBe(false);
		});

		it('should return false when shop_closed effect is not present', () => {
			const events: ActiveEvent[] = [
				createMockActiveEvent('market-day', 'Market Day', 1, {
					price_mult_global: 0.9
				})
			];

			const resolved = registry.getResolvedEffects(0, events);

			expect(registry.isShopClosed(resolved)).toBe(false);
		});

		it('should return event IDs that are closing the shop', () => {
			const events: ActiveEvent[] = [
				createMockActiveEvent('holiday', 'Holiday', 1, {
					shop_closed: true
				}),
				createMockActiveEvent('curfew', 'Curfew', 2, {
					shop_closed: true
				})
			];

			const resolved = registry.getResolvedEffects(0, events);
			const closingEvents = registry.getShopClosingEventNames(resolved);

			expect(closingEvents).toHaveLength(2);
			expect(closingEvents).toContain('holiday');
			expect(closingEvents).toContain('curfew');
		});

		it('should return empty array when no events close the shop', () => {
			const events: ActiveEvent[] = [
				createMockActiveEvent('market-day', 'Market Day', 1, {
					price_mult_global: 0.9
				})
			];

			const resolved = registry.getResolvedEffects(0, events);
			const closingEvents = registry.getShopClosingEventNames(resolved);

			expect(closingEvents).toHaveLength(0);
		});

		it('should return true if any event closes shop (any_true strategy)', () => {
			const events: ActiveEvent[] = [
				createMockActiveEvent('normal-day', 'Normal Day', 1, {
					shop_closed: false
				}),
				createMockActiveEvent('holiday', 'Holiday', 2, {
					shop_closed: true
				}),
				createMockActiveEvent('another-day', 'Another Day', 3, {
					shop_closed: false
				})
			];

			const resolved = registry.getResolvedEffects(0, events);

			expect(registry.isShopClosed(resolved)).toBe(true);
			expect(resolved.resolutionStrategies?.shop_closed).toBe('any_true');
		});

		it('should include all contributing events in metadata', () => {
			const events: ActiveEvent[] = [
				createMockActiveEvent('holiday', 'Holiday', 1, {
					shop_closed: true
				}),
				createMockActiveEvent('normal-day', 'Normal Day', 2, {
					shop_closed: false
				})
			];

			const resolved = registry.getResolvedEffects(0, events);
			const closingEvents = registry.getShopClosingEventNames(resolved);

			// Both events contributed to shop_closed (even though only true matters)
			expect(closingEvents).toHaveLength(2);
		});
	});
});

// ==========================================================================
// Edge Cases
// ==========================================================================

describe('EffectRegistry - Edge Cases', () => {
	let registry: EffectRegistry;

	beforeEach(() => {
		registry = new EffectRegistry();
	});

	it('should handle undefined effect values gracefully', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('event-1', 'Event 1', 1, {
				price_mult_global: undefined,
				shop_closed: null
			})
		];

		const resolved = registry.getResolvedEffects(0, events);

		// Undefined values should not be resolved
		expect(resolved.price_mult_global).toBeUndefined();
		// Null values pass through (for unknown effects using last_wins)
		expect(resolved.shop_closed).toBeNull();
	});

	it('should handle zero price multipliers', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('free-day', 'Free Day', 1, {
				price_mult_global: 0
			})
		];

		const resolved = registry.getResolvedEffects(0, events);

		expect(resolved.price_mult_global).toBe(0);
	});

	it('should handle negative price multipliers', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('refund-day', 'Refund Day', 1, {
				price_mult_global: -1.5 // Players get paid to take items?
			})
		];

		const resolved = registry.getResolvedEffects(0, events);

		expect(resolved.price_mult_global).toBe(-1.5);
	});

	it('should include time of day in resolved effects', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('event-1', 'Event 1', 1, {
				light_level: 'bright'
			})
		];

		const resolved = registry.getResolvedEffects(0, events, undefined, 720); // Noon

		expect(resolved.resolvedTimeOfDay).toBe(720);
	});

	it('should include context in resolved effects', () => {
		const events: ActiveEvent[] = [
			createMockActiveEvent('event-1', 'Event 1', 1, {
				price_mult_global: 1.5
			})
		];

		const context: EventContext = { location: 'waterdeep', faction: 'harpers' };
		const resolved = registry.getResolvedEffects(0, events, context);

		expect(resolved.resolvedContext).toEqual(context);
	});
});
