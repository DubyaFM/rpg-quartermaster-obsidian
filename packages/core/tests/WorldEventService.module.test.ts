import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorldEventService } from '../services/WorldEventService';
import { CalendarDriver } from '../services/CalendarDriver';
import { IRngFactory } from '../interfaces/IRngFactory';
import { ISeededRandomizer } from '../interfaces/ISeededRandomizer';
import { IEventDefinitionAdapter } from '../interfaces/IEventDefinitionAdapter';
import {
	CalendarDefinition,
	AnyEventDefinition,
	FixedDateEvent,
	IntervalEvent,
	ChainEvent,
	ConditionalEvent
} from '../models/types';

// ==========================================================================
// Test Fixtures - Calendar Definition
// ==========================================================================

const TEST_CALENDAR: CalendarDefinition = {
	id: 'test-calendar',
	name: 'Test Calendar',
	description: 'Calendar for unit testing',
	weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
	months: [
		{ name: 'January', days: 30, order: 0 },
		{ name: 'February', days: 28, order: 1 },
		{ name: 'March', days: 30, order: 2 },
		{ name: 'April', days: 30, order: 3 },
		{ name: 'May', days: 30, order: 4 },
		{ name: 'June', days: 30, order: 5 },
		{ name: 'July', days: 30, order: 6 },
		{ name: 'August', days: 30, order: 7 },
		{ name: 'September', days: 30, order: 8 },
		{ name: 'October', days: 30, order: 9 },
		{ name: 'November', days: 30, order: 10 },
		{ name: 'December', days: 32, order: 11 } // 360 days total
	],
	holidays: [],
	startingYear: 1000,
	yearSuffix: 'TE'
};

// ==========================================================================
// Test Fixtures - Module-Tagged Event Definitions
// ==========================================================================

const BLIZZARD_EVENT: FixedDateEvent = {
	id: 'blizzard-event',
	name: 'Harsh Blizzard',
	type: 'fixed',
	priority: 10,
	effects: {
		weather: 'blizzard',
		travel_speed_mult: 0.25
	},
	date: {
		month: 0,
		day: 15
	},
	tags: ['hardcore-weather']
};

const MILD_WEATHER: FixedDateEvent = {
	id: 'mild-weather',
	name: 'Pleasant Spring Day',
	type: 'fixed',
	priority: 5,
	effects: {
		weather: 'clear'
	},
	date: {
		month: 2,
		day: 1
	}
	// No tags - not part of a module
};

const MARKET_CRASH: IntervalEvent = {
	id: 'market-crash',
	name: 'Economic Downturn',
	type: 'interval',
	priority: 8,
	effects: {
		price_mult_global: 0.5
	},
	interval: 30,
	tags: ['economy']
};

const FULL_MOON: ChainEvent = {
	id: 'full-moon',
	name: 'Lunar Cycle',
	type: 'chain',
	priority: 5,
	effects: {},
	seed: 12345,
	states: [
		{
			name: 'New Moon',
			weight: 1,
			duration: '7 days',
			effects: { moon_phase: 'new' }
		},
		{
			name: 'Full Moon',
			weight: 1,
			duration: '3 days',
			effects: { moon_phase: 'full', werewolf_activity: true }
		}
	],
	tags: ['moons']
};

const LYCANTHROPY_SURGE: ConditionalEvent = {
	id: 'lycanthropy-surge',
	name: 'Lycanthropy Outbreak',
	type: 'conditional',
	priority: 10,
	effects: {
		werewolf_attacks: true
	},
	condition: "events['full-moon'].state == 'Full Moon'",
	tier: 1,
	tags: ['moons']
};

// ==========================================================================
// Mock Implementations
// ==========================================================================

class MockSeededRandomizer implements ISeededRandomizer {
	private state: number;

	constructor(seed: number) {
		this.state = seed;
	}

	randomFloat(): number {
		// Simple LCG for testing
		this.state = (this.state * 1664525 + 1013904223) % 4294967296;
		return this.state / 4294967296;
	}

	randomInt(min: number, max: number): number {
		return Math.floor(this.randomFloat() * (max - min + 1)) + min;
	}

	reseed(seed: number): void {
		this.state = seed;
	}

	getState(): number {
		return this.state;
	}
}

class MockRngFactory implements IRngFactory {
	create(seed: number): ISeededRandomizer {
		return new MockSeededRandomizer(seed);
	}
}

class MockEventAdapter implements IEventDefinitionAdapter {
	private events: AnyEventDefinition[];

	constructor(events: AnyEventDefinition[]) {
		this.events = events;
	}

	async loadEventDefinitions(): Promise<AnyEventDefinition[]> {
		return this.events;
	}
}

// ==========================================================================
// Module Toggle System Tests
// ==========================================================================

describe('WorldEventService - Module Toggle System', () => {
	let driver: CalendarDriver;
	let rngFactory: MockRngFactory;
	let service: WorldEventService;

	beforeEach(() => {
		driver = new CalendarDriver(TEST_CALENDAR);
		rngFactory = new MockRngFactory();
		service = new WorldEventService(driver, rngFactory);
	});

	describe('toggleModule()', () => {
		it('should enable and disable modules', async () => {
			const adapter = new MockEventAdapter([BLIZZARD_EVENT, MILD_WEATHER]);
			await service.initialize(adapter, 0);

			// Initially, all modules are enabled by default
			expect(service.isModuleEnabled('hardcore-weather')).toBe(true);

			// Disable the module
			service.toggleModule('hardcore-weather', false);
			expect(service.isModuleEnabled('hardcore-weather')).toBe(false);

			// Re-enable the module
			service.toggleModule('hardcore-weather', true);
			expect(service.isModuleEnabled('hardcore-weather')).toBe(true);
		});

		it('should invalidate cache when module is toggled', async () => {
			const adapter = new MockEventAdapter([BLIZZARD_EVENT]);
			await service.initialize(adapter, 0);

			// Day 15 (Jan 15) should have blizzard event
			const day15 = 14; // 0-indexed absolute day
			const events1 = service.getActiveEvents(day15);
			expect(events1).toHaveLength(1);
			expect(events1[0].eventId).toBe('blizzard-event');

			// Disable hardcore-weather module
			service.toggleModule('hardcore-weather', false);

			// Day 15 should now have no events (cache invalidated)
			const events2 = service.getActiveEvents(day15);
			expect(events2).toHaveLength(0);
		});

		it('should handle multiple module toggles', async () => {
			const adapter = new MockEventAdapter([
				BLIZZARD_EVENT,
				MARKET_CRASH,
				MILD_WEATHER
			]);
			await service.initialize(adapter, 0);

			// Disable both modules
			service.toggleModule('hardcore-weather', false);
			service.toggleModule('economy', false);

			expect(service.isModuleEnabled('hardcore-weather')).toBe(false);
			expect(service.isModuleEnabled('economy')).toBe(false);

			// Re-enable one module
			service.toggleModule('hardcore-weather', true);

			expect(service.isModuleEnabled('hardcore-weather')).toBe(true);
			expect(service.isModuleEnabled('economy')).toBe(false);
		});
	});

	describe('isModuleEnabled()', () => {
		it('should return true for modules that have never been toggled (default)', async () => {
			const adapter = new MockEventAdapter([]);
			await service.initialize(adapter, 0);

			expect(service.isModuleEnabled('any-module')).toBe(true);
		});

		it('should return false for explicitly disabled modules', async () => {
			const adapter = new MockEventAdapter([]);
			await service.initialize(adapter, 0);

			service.toggleModule('test-module', false);
			expect(service.isModuleEnabled('test-module')).toBe(false);
		});

		it('should return true for explicitly enabled modules', async () => {
			const adapter = new MockEventAdapter([]);
			await service.initialize(adapter, 0);

			service.toggleModule('test-module', true);
			expect(service.isModuleEnabled('test-module')).toBe(true);
		});
	});

	describe('getModuleToggles()', () => {
		it('should return empty object when no modules have been toggled', async () => {
			const adapter = new MockEventAdapter([]);
			await service.initialize(adapter, 0);

			const toggles = service.getModuleToggles();
			expect(toggles).toEqual({});
		});

		it('should return all toggled module states', async () => {
			const adapter = new MockEventAdapter([]);
			await service.initialize(adapter, 0);

			service.toggleModule('hardcore-weather', false);
			service.toggleModule('economy', true);
			service.toggleModule('moons', false);

			const toggles = service.getModuleToggles();
			expect(toggles).toEqual({
				'hardcore-weather': false,
				economy: true,
				moons: false
			});
		});
	});

	describe('setModuleToggles()', () => {
		it('should set multiple module states at once', async () => {
			const adapter = new MockEventAdapter([]);
			await service.initialize(adapter, 0);

			service.setModuleToggles({
				'hardcore-weather': false,
				economy: true,
				moons: false
			});

			expect(service.isModuleEnabled('hardcore-weather')).toBe(false);
			expect(service.isModuleEnabled('economy')).toBe(true);
			expect(service.isModuleEnabled('moons')).toBe(false);
		});

		it('should clear previous toggles when setting new state', async () => {
			const adapter = new MockEventAdapter([]);
			await service.initialize(adapter, 0);

			service.toggleModule('old-module', false);
			service.setModuleToggles({
				'new-module': false
			});

			// Old module should revert to default (enabled)
			expect(service.isModuleEnabled('old-module')).toBe(true);
			// New module should be disabled
			expect(service.isModuleEnabled('new-module')).toBe(false);
		});

		it('should invalidate cache when toggles are set', async () => {
			const adapter = new MockEventAdapter([BLIZZARD_EVENT]);
			await service.initialize(adapter, 0);

			const day15 = 14; // 0-indexed absolute day

			// Event should be active initially
			const events1 = service.getActiveEvents(day15);
			expect(events1).toHaveLength(1);

			// Set module toggles to disable hardcore-weather
			service.setModuleToggles({
				'hardcore-weather': false
			});

			// Event should be inactive (cache invalidated)
			const events2 = service.getActiveEvents(day15);
			expect(events2).toHaveLength(0);
		});
	});

	describe('Event Filtering by Module State', () => {
		it('should hide fixed date events when their module is disabled', async () => {
			const adapter = new MockEventAdapter([BLIZZARD_EVENT, MILD_WEATHER]);
			await service.initialize(adapter, 0);

			// Jan 15 = day 14 (0-indexed, 14 days from Jan 1)
			// Mar 1 = Jan(30) + Feb(28) = 58 (day 0 = Jan 1)
			const day15 = 14; // Jan 15
			const day61 = 58; // Mar 1

			// Initially, both events should be active on their respective days
			expect(service.getActiveEvents(day15)).toHaveLength(1);
			expect(service.getActiveEvents(day61)).toHaveLength(1);

			// Disable hardcore-weather module
			service.toggleModule('hardcore-weather', false);

			// Blizzard event should be hidden, mild weather should still be active
			expect(service.getActiveEvents(day15)).toHaveLength(0);
			expect(service.getActiveEvents(day61)).toHaveLength(1);
			expect(service.getActiveEvents(day61)[0].eventId).toBe('mild-weather');
		});

		it('should hide interval events when their module is disabled', async () => {
			const adapter = new MockEventAdapter([MARKET_CRASH]);
			await service.initialize(adapter, 0);

			const day0 = 0; // Day 0 (interval matches)
			const day30 = 30; // Day 30 (interval matches)

			// Initially, events should trigger on interval
			expect(service.getActiveEvents(day0)).toHaveLength(1);
			expect(service.getActiveEvents(day30)).toHaveLength(1);

			// Disable economy module
			service.toggleModule('economy', false);

			// Market crash should be hidden on both days
			expect(service.getActiveEvents(day0)).toHaveLength(0);
			expect(service.getActiveEvents(day30)).toHaveLength(0);
		});

		it('should hide chain events when their module is disabled', async () => {
			const adapter = new MockEventAdapter([FULL_MOON]);
			await service.initialize(adapter, 0);

			// Chain events should always be active (in some state)
			const eventsDay0 = service.getActiveEvents(0);
			expect(eventsDay0).toHaveLength(1);
			expect(eventsDay0[0].eventId).toBe('full-moon');

			// Disable moons module
			service.toggleModule('moons', false);

			// Moon event should be hidden
			const eventsAfterToggle = service.getActiveEvents(0);
			expect(eventsAfterToggle).toHaveLength(0);
		});

		it('should hide conditional events when their module is disabled', async () => {
			const adapter = new MockEventAdapter([FULL_MOON, LYCANTHROPY_SURGE]);
			await service.initialize(adapter, 0);

			// Advance to a day where moon is in Full Moon state
			// This requires checking the chain state
			let fullMoonDay = -1;
			for (let day = 0; day < 30; day++) {
				const events = service.getActiveEvents(day);
				const moonEvent = events.find(e => e.eventId === 'full-moon');
				if (moonEvent?.state === 'Full Moon') {
					fullMoonDay = day;
					break;
				}
			}

			// If we found a full moon day, check conditional event
			if (fullMoonDay >= 0) {
				const events = service.getActiveEvents(fullMoonDay);
				const lycanEvent = events.find(e => e.eventId === 'lycanthropy-surge');
				expect(lycanEvent).toBeDefined();

				// Disable moons module
				service.toggleModule('moons', false);

				// Both moon and lycanthropy events should be hidden
				const eventsAfterToggle = service.getActiveEvents(fullMoonDay);
				expect(eventsAfterToggle.find(e => e.eventId === 'full-moon')).toBeUndefined();
				expect(eventsAfterToggle.find(e => e.eventId === 'lycanthropy-surge')).toBeUndefined();
			}
		});

		it('should only filter events with matching module tags', async () => {
			const adapter = new MockEventAdapter([
				BLIZZARD_EVENT,     // tagged: hardcore-weather, Jan 15
				MARKET_CRASH,       // tagged: economy, interval 30 (days 0, 30, 60, 90, etc.)
				MILD_WEATHER        // no tags, Mar 1
			]);
			await service.initialize(adapter, 0);

			// Disable hardcore-weather only
			service.toggleModule('hardcore-weather', false);

			// Check day 0 (market crash should be active)
			const events0 = service.getActiveEvents(0);
			expect(events0).toHaveLength(1);
			expect(events0[0].eventId).toBe('market-crash');

			// Check day 14 (blizzard should be hidden)
			const events14 = service.getActiveEvents(14);
			expect(events14).toHaveLength(0);

			// Check day 58 (mild weather should be active - no tags, Mar 1)
			const events58 = service.getActiveEvents(58);
			expect(events58).toHaveLength(1);
			expect(events58[0].eventId).toBe('mild-weather');
		});

		it('should hide events with multiple tags if any tag is disabled', async () => {
			const multiTagEvent: FixedDateEvent = {
				id: 'special-event',
				name: 'Special Combined Event',
				type: 'fixed',
				priority: 10,
				effects: {},
				date: { month: 5, day: 1 }, // June 1 (month 5 = 6th month)
				tags: ['hardcore-weather', 'economy']
			};

			const adapter = new MockEventAdapter([multiTagEvent]);
			await service.initialize(adapter, 0);

			// June 1 = Jan(30) + Feb(28) + Mar(30) + Apr(30) + May(30) = 148 days
			const targetDay = 148;

			// Initially active
			expect(service.getActiveEvents(targetDay)).toHaveLength(1);

			// Disable one of the tags
			service.toggleModule('hardcore-weather', false);

			// Event should be hidden (any disabled tag hides the event)
			expect(service.getActiveEvents(targetDay)).toHaveLength(0);
		});
	});

	describe('Module State Persistence', () => {
		it('should support saving and restoring module toggle state', async () => {
			const adapter = new MockEventAdapter([]);
			await service.initialize(adapter, 0);

			// Set some module states
			service.toggleModule('hardcore-weather', false);
			service.toggleModule('economy', true);

			// Get module toggles for persistence
			const savedToggles = service.getModuleToggles();
			expect(savedToggles).toEqual({
				'hardcore-weather': false,
				economy: true
			});

			// Create new service instance and restore state
			const service2 = new WorldEventService(driver, rngFactory);
			await service2.initialize(adapter, 0);
			service2.setModuleToggles(savedToggles);

			// Verify state was restored
			expect(service2.isModuleEnabled('hardcore-weather')).toBe(false);
			expect(service2.isModuleEnabled('economy')).toBe(true);
		});
	});

	describe('getAvailableModules()', () => {
		it('should return empty array when no events have tags', async () => {
			const adapter = new MockEventAdapter([MILD_WEATHER]);
			await service.initialize(adapter, 0);

			const modules = service.getAvailableModules();
			expect(modules).toEqual([]);
		});

		it('should return sorted list of unique module IDs from event tags', async () => {
			const adapter = new MockEventAdapter([
				BLIZZARD_EVENT,     // tags: ['hardcore-weather']
				MARKET_CRASH,       // tags: ['economy']
				FULL_MOON,          // tags: ['moons']
				LYCANTHROPY_SURGE,  // tags: ['moons']
				MILD_WEATHER        // no tags
			]);
			await service.initialize(adapter, 0);

			const modules = service.getAvailableModules();
			expect(modules).toEqual(['economy', 'hardcore-weather', 'moons']);
		});

		it('should handle events with multiple tags', async () => {
			const multiTagEvent: FixedDateEvent = {
				id: 'multi-tag',
				name: 'Multi Tag Event',
				type: 'fixed',
				priority: 5,
				effects: {},
				date: { month: 0, day: 1 },
				tags: ['weather', 'seasonal', 'regional']
			};

			const adapter = new MockEventAdapter([
				multiTagEvent,
				BLIZZARD_EVENT  // tags: ['hardcore-weather']
			]);
			await service.initialize(adapter, 0);

			const modules = service.getAvailableModules();
			expect(modules).toEqual(['hardcore-weather', 'regional', 'seasonal', 'weather']);
		});

		it('should deduplicate module IDs across multiple events', async () => {
			const event1: FixedDateEvent = {
				id: 'event1',
				name: 'Event 1',
				type: 'fixed',
				priority: 5,
				effects: {},
				date: { month: 0, day: 1 },
				tags: ['weather', 'moons']
			};

			const event2: FixedDateEvent = {
				id: 'event2',
				name: 'Event 2',
				type: 'fixed',
				priority: 5,
				effects: {},
				date: { month: 0, day: 2 },
				tags: ['weather', 'economy']
			};

			const adapter = new MockEventAdapter([event1, event2]);
			await service.initialize(adapter, 0);

			const modules = service.getAvailableModules();
			expect(modules).toEqual(['economy', 'moons', 'weather']);
		});
	});

	describe('Module State in Effect Registry', () => {
		it('should exclude disabled module events from effect registry', async () => {
			const adapter = new MockEventAdapter([BLIZZARD_EVENT]);
			await service.initialize(adapter, 0);

			const day15 = 14;

			// Initially, blizzard effects should be in registry
			const registry1 = service.getEffectRegistry(day15);
			expect(registry1.effects.weather).toBe('blizzard');
			expect(registry1.effects.travel_speed_mult).toBe(0.25);

			// Disable hardcore-weather module
			service.toggleModule('hardcore-weather', false);

			// Effects should no longer be in registry
			const registry2 = service.getEffectRegistry(day15);
			expect(registry2.effects.weather).toBeUndefined();
			expect(registry2.effects.travel_speed_mult).toBeUndefined();
		});
	});

	describe('Module Toggle Edge Cases', () => {
		it('should handle toggling non-existent modules gracefully', async () => {
			const adapter = new MockEventAdapter([]);
			await service.initialize(adapter, 0);

			// Should not throw
			expect(() => {
				service.toggleModule('non-existent-module', false);
			}).not.toThrow();

			expect(service.isModuleEnabled('non-existent-module')).toBe(false);
		});

		it('should handle events with empty tags array', async () => {
			const emptyTagEvent: FixedDateEvent = {
				id: 'empty-tag-event',
				name: 'Event with Empty Tags',
				type: 'fixed',
				priority: 5,
				effects: {},
				date: { month: 0, day: 1 },
				tags: []
			};

			const adapter = new MockEventAdapter([emptyTagEvent]);
			await service.initialize(adapter, 0);

			// Event should be active (no tags = always visible)
			expect(service.getActiveEvents(0)).toHaveLength(1);

			// Disabling a module shouldn't affect it
			service.toggleModule('any-module', false);
			expect(service.getActiveEvents(0)).toHaveLength(1);
		});

		it('should handle events with undefined tags', async () => {
			const noTagEvent: FixedDateEvent = {
				id: 'no-tag-event',
				name: 'Event without Tags',
				type: 'fixed',
				priority: 5,
				effects: {},
				date: { month: 0, day: 1 }
				// No tags field at all
			};

			const adapter = new MockEventAdapter([noTagEvent]);
			await service.initialize(adapter, 0);

			// Event should be active (no tags = always visible)
			expect(service.getActiveEvents(0)).toHaveLength(1);

			// Disabling a module shouldn't affect it
			service.toggleModule('any-module', false);
			expect(service.getActiveEvents(0)).toHaveLength(1);
		});
	});
});
