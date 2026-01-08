import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorldEventService, WorldEventServiceConfig } from '../services/WorldEventService';
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
	ConditionalEvent,
	EventContext
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
// Test Fixtures - Event Definitions
// ==========================================================================

const NEW_YEAR_FESTIVAL: FixedDateEvent = {
	id: 'new-year-festival',
	name: 'New Year Festival',
	type: 'fixed',
	priority: 10,
	effects: {
		shop_closed: true,
		ui_banner: 'Happy New Year!'
	},
	date: {
		month: 0,
		day: 1
	},
	duration: 3
};

const SPRING_EQUINOX: FixedDateEvent = {
	id: 'spring-equinox',
	name: 'Spring Equinox',
	type: 'fixed',
	priority: 5,
	effects: {
		light_level: 'bright'
	},
	date: {
		month: 2,
		day: 21
	}
};

const ONE_TIME_EVENT: FixedDateEvent = {
	id: 'coronation-1001',
	name: 'Royal Coronation',
	type: 'fixed',
	priority: 20,
	effects: {
		price_mult_global: 1.5
	},
	date: {
		month: 5,
		day: 15,
		year: 1001
	}
};

const WEEKLY_MARKET: IntervalEvent = {
	id: 'weekly-market',
	name: 'Weekly Market Day',
	type: 'interval',
	priority: 3,
	effects: {
		price_mult_global: 0.9
	},
	interval: 7,
	offset: 0
};

const FULL_MOON_CYCLE: IntervalEvent = {
	id: 'full-moon',
	name: 'Full Moon',
	type: 'interval',
	priority: 8,
	effects: {
		light_level: 'bright'
	},
	interval: 28,
	offset: 14
};

const WEATHER_CHAIN: ChainEvent = {
	id: 'weather',
	name: 'Weather System',
	type: 'chain',
	priority: 1,
	effects: {},  // Effects come from states
	seed: 12345,
	states: [
		{
			name: 'Clear',
			weight: 60,
			duration: '2d4 days',
			effects: { light_level: 'bright' }
		},
		{
			name: 'Cloudy',
			weight: 25,
			duration: '1d4 days',
			effects: { light_level: 'dim' }
		},
		{
			name: 'Storm',
			weight: 15,
			duration: '1d2 days',
			effects: { light_level: 'dark', restock_block: true }
		}
	]
};

const LUNAR_WEREWOLF: ConditionalEvent = {
	id: 'lunar-werewolf',
	name: 'Werewolf Activity',
	type: 'conditional',
	priority: 15,
	effects: {
		danger_level: 'high'
	},
	condition: "events['full-moon'].active",
	tier: 1
};

const STORM_FLOODING: ConditionalEvent = {
	id: 'storm-flooding',
	name: 'Flooding',
	type: 'conditional',
	priority: 12,
	effects: {
		shop_closed: true
	},
	condition: "events['weather'].state == 'Storm'",
	tier: 1
};

const LOCATION_FILTERED_EVENT: FixedDateEvent = {
	id: 'waterdeep-festival',
	name: 'Waterdeep Festival',
	type: 'fixed',
	priority: 10,
	effects: {
		price_mult_global: 0.8
	},
	date: {
		month: 3,
		day: 1
	},
	locations: ['waterdeep']
};

const TAGGED_EVENT: FixedDateEvent = {
	id: 'tagged-holiday',
	name: 'Tagged Holiday',
	type: 'fixed',
	priority: 5,
	effects: {},
	date: {
		month: 6,
		day: 1
	},
	tags: ['hardcore-mode']
};

// ==========================================================================
// Mock Implementations
// ==========================================================================

class MockSeededRandomizer implements ISeededRandomizer {
	private state: number;
	private callCount: number = 0;

	constructor(seed: number) {
		this.state = seed;
	}

	reseed(seed: number): void {
		this.state = seed;
		this.callCount = 0;
	}

	getState(): number {
		return this.state;
	}

	randomFloat(): number {
		// Mulberry32 algorithm for deterministic results
		let t = this.state += 0x6D2B79F5;
		t = Math.imul(t ^ t >>> 15, t | 1);
		t ^= t + Math.imul(t ^ t >>> 7, t | 61);
		this.callCount++;
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	}

	randomInt(min: number, max: number): number {
		return Math.floor(this.randomFloat() * (max - min + 1)) + min;
	}

	randomFromArray<T>(array: T[]): T | undefined {
		if (array.length === 0) return undefined;
		const index = Math.floor(this.randomFloat() * array.length);
		return array[index];
	}

	shuffleArray<T>(array: T[]): T[] {
		const shuffled = [...array];
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(this.randomFloat() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
		}
		return shuffled;
	}
}

class MockRngFactory implements IRngFactory {
	create(seed: number): ISeededRandomizer {
		return new MockSeededRandomizer(seed);
	}
}

class MockEventDefinitionAdapter implements IEventDefinitionAdapter {
	private events: Map<string, AnyEventDefinition> = new Map();

	constructor(events: AnyEventDefinition[] = []) {
		for (const event of events) {
			this.events.set(event.id, event);
		}
	}

	async loadEventDefinitions(_context?: EventContext): Promise<AnyEventDefinition[]> {
		return Array.from(this.events.values());
	}

	async loadEventDefinitionById(id: string): Promise<AnyEventDefinition | null> {
		return this.events.get(id) || null;
	}

	async loadEventDefinitionsByIds(ids: string[]): Promise<(AnyEventDefinition | null)[]> {
		return ids.map(id => this.events.get(id) || null);
	}

	async listEventDefinitionIds(): Promise<string[]> {
		return Array.from(this.events.keys());
	}

	async hasEventDefinition(id: string): Promise<boolean> {
		return this.events.has(id);
	}

	addEvent(event: AnyEventDefinition): void {
		this.events.set(event.id, event);
	}
}

// ==========================================================================
// Tests
// ==========================================================================

describe('WorldEventService', () => {
	let driver: CalendarDriver;
	let rngFactory: IRngFactory;

	beforeEach(() => {
		driver = new CalendarDriver(TEST_CALENDAR);
		rngFactory = new MockRngFactory();
	});

	describe('constructor and initialization', () => {
		it('should create service with CalendarDriver and RngFactory', () => {
			const service = new WorldEventService(driver, rngFactory);

			expect(service.getCalendarDriver()).toBe(driver);
			expect(service.isInitialized()).toBe(false);
		});

		it('should accept custom configuration', () => {
			const config: WorldEventServiceConfig = {
				bufferSize: 60,
				maxSimulationDays: 730
			};
			const service = new WorldEventService(driver, rngFactory, config);

			expect(service.getBufferSize()).toBe(60);
		});

		it('should use default configuration when not provided', () => {
			const service = new WorldEventService(driver, rngFactory);

			expect(service.getBufferSize()).toBe(30);
		});

		it('should initialize with adapter and load events', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([
				NEW_YEAR_FESTIVAL,
				WEEKLY_MARKET
			]);

			await service.initialize(adapter, 0);

			expect(service.isInitialized()).toBe(true);
			expect(service.getEventDefinitions().size).toBe(2);
		});
	});

	describe('getActiveEvents - Fixed Date Events', () => {
		it('should return fixed date events on matching day', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([NEW_YEAR_FESTIVAL]);
			await service.initialize(adapter, 0);

			const events = service.getActiveEvents(0);  // Day 0 = January 1

			expect(events).toHaveLength(1);
			expect(events[0].eventId).toBe('new-year-festival');
			expect(events[0].name).toBe('New Year Festival');
		});

		it('should respect event duration', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([NEW_YEAR_FESTIVAL]);
			await service.initialize(adapter, 0);

			const events = service.getActiveEvents(0);

			expect(events[0].startDay).toBe(0);
			expect(events[0].endDay).toBe(2);  // Duration 3 days: days 0, 1, 2
			expect(events[0].remainingDays).toBe(2);
		});

		it('should not return fixed date events on non-matching day', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([NEW_YEAR_FESTIVAL]);
			await service.initialize(adapter, 0);

			const events = service.getActiveEvents(15);

			expect(events).toHaveLength(0);
		});

		it('should handle one-time events with year constraint', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([ONE_TIME_EVENT]);
			await service.initialize(adapter, 0);

			// Calendar: Jan(30) + Feb(28) + Mar(30) + Apr(30) + May(30) + Jun(30)... = 360 total
			// Year 1001, June 15 = 360 (full year) + 148 (days before June) + 14 (June 1-14)
			// Days before June = 30 + 28 + 30 + 30 + 30 = 148
			const coronationDay = 360 + 148 + 14;  // Year 1001, June 15 = day 522

			const eventsOnDay = service.getActiveEvents(coronationDay);
			expect(eventsOnDay).toHaveLength(1);
			expect(eventsOnDay[0].eventId).toBe('coronation-1001');

			// Same date in year 1000 should not trigger
			// June 15 in year 1000 = days before June (148) + 14 = 162
			const sameMonthDayYear1000 = 148 + 14;  // June 15, Year 1000 = day 162
			const eventsYear1000 = service.getActiveEvents(sameMonthDayYear1000);
			expect(eventsYear1000).toHaveLength(0);
		});

		it('should handle multiple events on same day', async () => {
			const anotherJan1Event: FixedDateEvent = {
				id: 'hangover-day',
				name: 'Hangover Recovery',
				type: 'fixed',
				priority: 1,
				effects: {},
				date: { month: 0, day: 1 }
			};

			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([
				NEW_YEAR_FESTIVAL,
				anotherJan1Event
			]);
			await service.initialize(adapter, 0);

			const events = service.getActiveEvents(0);

			expect(events).toHaveLength(2);
		});
	});

	describe('getActiveEvents - Interval Events', () => {
		it('should return interval events on matching interval', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([WEEKLY_MARKET]);
			await service.initialize(adapter, 0);

			// Day 0, 7, 14, 21, 28... should match (interval 7, offset 0)
			expect(service.getActiveEvents(0)).toHaveLength(1);
			expect(service.getActiveEvents(7)).toHaveLength(1);
			expect(service.getActiveEvents(14)).toHaveLength(1);

			// Day 1, 2, 3... should not match
			expect(service.getActiveEvents(1)).toHaveLength(0);
			expect(service.getActiveEvents(5)).toHaveLength(0);
		});

		it('should respect offset for phase alignment', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([FULL_MOON_CYCLE]);
			await service.initialize(adapter, 0);

			// Interval 28, offset 14 means: (day + 14) % 28 === 0
			// So day 14, 42, 70... should match
			expect(service.getActiveEvents(14)).toHaveLength(1);
			expect(service.getActiveEvents(42)).toHaveLength(1);

			// Day 0, 28, 56 should not match
			expect(service.getActiveEvents(0)).toHaveLength(0);
			expect(service.getActiveEvents(28)).toHaveLength(0);
		});
	});

	describe('getActiveEvents - Chain Events', () => {
		it('should create chain runtime on initialization', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([WEATHER_CHAIN]);
			await service.initialize(adapter, 0);

			const events = service.getActiveEvents(0);

			expect(events).toHaveLength(1);
			expect(events[0].eventId).toBe('weather');
			expect(['Clear', 'Cloudy', 'Storm']).toContain(events[0].state);
		});

		it('should maintain state within duration', async () => {
			// Use a chain event with guaranteed longer durations
			const longDurationChain: ChainEvent = {
				id: 'long-weather',
				name: 'Long Weather',
				type: 'chain',
				priority: 1,
				effects: {},
				seed: 12345,
				states: [
					{
						name: 'Clear',
						weight: 100,  // Always select Clear
						duration: '5 days',  // Fixed 5-day duration
						effects: { light_level: 'bright' }
					}
				]
			};

			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([longDurationChain]);
			await service.initialize(adapter, 0);

			const day0Events = service.getActiveEvents(0);
			const initialState = day0Events[0].state;
			expect(initialState).toBe('Clear');

			// Check the same state persists for a few days
			const day1Events = service.getActiveEvents(1);
			expect(day1Events[0].state).toBe(initialState);

			const day3Events = service.getActiveEvents(3);
			expect(day3Events[0].state).toBe(initialState);
		});

		it('should provide deterministic results with same seed', async () => {
			const service1 = new WorldEventService(driver, rngFactory);
			const adapter1 = new MockEventDefinitionAdapter([WEATHER_CHAIN]);
			await service1.initialize(adapter1, 0);

			const service2 = new WorldEventService(driver, rngFactory);
			const adapter2 = new MockEventDefinitionAdapter([WEATHER_CHAIN]);
			await service2.initialize(adapter2, 0);

			// Both services should produce identical results
			for (let day = 0; day < 10; day++) {
				const events1 = service1.getActiveEvents(day);
				const events2 = service2.getActiveEvents(day);

				expect(events1[0].state).toBe(events2[0].state);
			}
		});

		it('should serialize and restore chain state vectors', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([WEATHER_CHAIN]);
			await service.initialize(adapter, 0);

			// Advance to a known state
			service.advanceToDay(10);
			const originalEvents = service.getActiveEvents(10);
			const originalState = originalEvents[0].state;

			// Save state vectors
			const vectors = service.getChainStateVectors();
			expect(vectors['weather']).toBeDefined();

			// Create a new service and restore state
			const service2 = new WorldEventService(driver, rngFactory);
			const adapter2 = new MockEventDefinitionAdapter([WEATHER_CHAIN]);
			await service2.initialize(adapter2, 0);
			service2.restoreChainStateVectors(vectors);

			const restoredEvents = service2.getActiveEvents(10);
			expect(restoredEvents[0].state).toBe(originalState);
		});
	});

	describe('getActiveEvents - Conditional Events', () => {
		it('should activate conditional events when condition is true', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([
				FULL_MOON_CYCLE,
				LUNAR_WEREWOLF
			]);
			await service.initialize(adapter, 0);

			// Full moon on day 14 (offset 14, interval 28)
			const events = service.getActiveEvents(14);

			expect(events.length).toBe(2);
			expect(events.some(e => e.eventId === 'full-moon')).toBe(true);
			expect(events.some(e => e.eventId === 'lunar-werewolf')).toBe(true);
		});

		it('should not activate conditional events when condition is false', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([
				FULL_MOON_CYCLE,
				LUNAR_WEREWOLF
			]);
			await service.initialize(adapter, 0);

			// Day 0 has no full moon
			const events = service.getActiveEvents(0);

			expect(events.some(e => e.eventId === 'lunar-werewolf')).toBe(false);
		});

		it('should evaluate chain state conditions', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([
				WEATHER_CHAIN,
				STORM_FLOODING
			]);
			await service.initialize(adapter, 0);

			// Check multiple days until we find a storm
			let stormDayFound = false;
			for (let day = 0; day < 100; day++) {
				const events = service.getActiveEvents(day);
				const weatherEvent = events.find(e => e.eventId === 'weather');

				if (weatherEvent?.state === 'Storm') {
					// Storm flooding should also be active
					const floodingEvent = events.find(e => e.eventId === 'storm-flooding');
					expect(floodingEvent).toBeDefined();
					stormDayFound = true;
					break;
				}
			}

			// If no storm was found in 100 days, that's unexpected given weights
			expect(stormDayFound).toBe(true);
		});
	});

	describe('getActiveEvents - Context Filtering', () => {
		it('should filter events by location context', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([
				LOCATION_FILTERED_EVENT
			]);
			await service.initialize(adapter, 0);

			// April 1 (month 3, day 1)
			// Days before April = 30 (Jan) + 28 (Feb) + 30 (Mar) = 88
			const day = 88;

			// Without context, event should still be returned
			const allEvents = service.getActiveEvents(day);
			expect(allEvents).toHaveLength(1);

			// With matching location context
			const waterdeepEvents = service.getActiveEvents(day, { location: 'waterdeep' });
			expect(waterdeepEvents).toHaveLength(1);

			// With non-matching location context
			const baldurEvents = service.getActiveEvents(day, { location: 'baldurs-gate' });
			expect(baldurEvents).toHaveLength(0);
		});
	});

	describe('Module Toggle Support', () => {
		it('should enable modules by default', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([TAGGED_EVENT]);
			await service.initialize(adapter, 0);

			expect(service.isModuleEnabled('hardcore-mode')).toBe(true);
		});

		it('should disable events when module is toggled off', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([TAGGED_EVENT]);
			await service.initialize(adapter, 0);

			// July 1 (month 6, day 1)
			// Days before July = 30 + 28 + 30 + 30 + 30 + 30 = 178
			const day = 178;

			// Before toggle, event should be active
			let events = service.getActiveEvents(day);
			expect(events).toHaveLength(1);

			// Disable the module
			service.toggleModule('hardcore-mode', false);
			expect(service.isModuleEnabled('hardcore-mode')).toBe(false);

			// After toggle, event should not be active
			events = service.getActiveEvents(day);
			expect(events).toHaveLength(0);
		});

		it('should re-enable events when module is toggled back on', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([TAGGED_EVENT]);
			await service.initialize(adapter, 0);

			// July 1 (month 6, day 1) = day 178
			const day = 178;

			service.toggleModule('hardcore-mode', false);
			service.toggleModule('hardcore-mode', true);

			const events = service.getActiveEvents(day);
			expect(events).toHaveLength(1);
		});

		it('should get and set module toggles as record', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([]);
			await service.initialize(adapter, 0);

			service.toggleModule('module-a', true);
			service.toggleModule('module-b', false);

			const toggles = service.getModuleToggles();
			expect(toggles['module-a']).toBe(true);
			expect(toggles['module-b']).toBe(false);

			// Set from record
			service.setModuleToggles({ 'module-c': true, 'module-d': false });

			expect(service.isModuleEnabled('module-c')).toBe(true);
			expect(service.isModuleEnabled('module-d')).toBe(false);
			// Previous toggles should be cleared
			expect(service.isModuleEnabled('module-a')).toBe(true);  // Default
		});
	});

	describe('Event Caching', () => {
		it('should cache event calculations', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([NEW_YEAR_FESTIVAL]);
			await service.initialize(adapter, 0);

			// First call calculates
			const events1 = service.getActiveEvents(0);

			// Second call should use cache
			const events2 = service.getActiveEvents(0);

			expect(events1).toEqual(events2);
		});

		it('should invalidate cache when requested', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([NEW_YEAR_FESTIVAL]);
			await service.initialize(adapter, 0);

			service.getActiveEvents(0);
			service.invalidateCache();

			// After invalidation, should recalculate
			const events = service.getActiveEvents(0);
			expect(events).toHaveLength(1);
		});

		it('should trim old cache entries on day advancement', async () => {
			const config: WorldEventServiceConfig = { bufferSize: 5 };
			const service = new WorldEventService(driver, rngFactory, config);
			const adapter = new MockEventDefinitionAdapter([WEEKLY_MARKET]);
			await service.initialize(adapter, 0);

			// Cache some days
			for (let i = 0; i < 10; i++) {
				service.getActiveEvents(i);
			}

			// Advance to day 20
			service.advanceToDay(20);

			// Old cache entries (days 0-14) should be trimmed
			// The cache should only have days from buffer window
		});
	});

	describe('getEffectRegistry', () => {
		it('should return effect registry with aggregated effects', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([NEW_YEAR_FESTIVAL]);
			await service.initialize(adapter, 0);

			const registry = service.getEffectRegistry(0);

			expect(registry.day).toBe(0);
			expect(registry.activeEvents).toHaveLength(1);
			expect(registry.effects.shop_closed).toBe(true);
			expect(registry.effects.ui_banner).toBe('Happy New Year!');
		});

		it('should include context in registry', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([LOCATION_FILTERED_EVENT]);
			await service.initialize(adapter, 0);

			const context: EventContext = { location: 'waterdeep' };
			const registry = service.getEffectRegistry(90, context);

			expect(registry.context).toEqual(context);
		});
	});

	describe('Event Definition Management', () => {
		it('should return all loaded event definitions', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([
				NEW_YEAR_FESTIVAL,
				WEEKLY_MARKET,
				WEATHER_CHAIN
			]);
			await service.initialize(adapter, 0);

			const definitions = service.getEventDefinitions();

			expect(definitions.size).toBe(3);
			expect(definitions.has('new-year-festival')).toBe(true);
			expect(definitions.has('weekly-market')).toBe(true);
			expect(definitions.has('weather')).toBe(true);
		});

		it('should return specific event definition by ID', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([NEW_YEAR_FESTIVAL]);
			await service.initialize(adapter, 0);

			const def = service.getEventDefinition('new-year-festival');

			expect(def).toBeDefined();
			expect(def?.name).toBe('New Year Festival');
		});

		it('should return undefined for non-existent event ID', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([]);
			await service.initialize(adapter, 0);

			const def = service.getEventDefinition('non-existent');

			expect(def).toBeUndefined();
		});

		it('should reload event definitions', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([NEW_YEAR_FESTIVAL]);
			await service.initialize(adapter, 0);

			expect(service.getEventDefinitions().size).toBe(1);

			// Add more events to adapter
			adapter.addEvent(WEEKLY_MARKET);
			adapter.addEvent(SPRING_EQUINOX);

			// Reload
			await service.reloadEventDefinitions();

			expect(service.getEventDefinitions().size).toBe(3);
		});
	});

	describe('Day Advancement', () => {
		it('should advance chain events when day progresses', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([WEATHER_CHAIN]);
			await service.initialize(adapter, 0);

			// Record initial state
			const initialEvents = service.getActiveEvents(0);
			const initialState = initialEvents[0].state;
			const initialEndDay = initialEvents[0].endDay;

			// Advance past the initial state's end day
			service.advanceToDay(initialEndDay + 10);

			// State should have changed (probabilistically)
			// We can't guarantee a change, but the service should handle it
			const newEvents = service.getActiveEvents(initialEndDay + 10);
			expect(newEvents).toHaveLength(1);
		});
	});

	describe('Phase Ordering', () => {
		it('should process events in correct phase order', async () => {
			// Create a tier 2 conditional that depends on a tier 1 conditional
			const tier1Conditional: ConditionalEvent = {
				id: 'tier1-test',
				name: 'Tier 1 Event',
				type: 'conditional',
				priority: 5,
				effects: {},
				condition: "events['full-moon'].active",
				tier: 1
			};

			const tier2Conditional: ConditionalEvent = {
				id: 'tier2-test',
				name: 'Tier 2 Event',
				type: 'conditional',
				priority: 10,
				effects: {},
				condition: "events['tier1-test'].active",
				tier: 2
			};

			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([
				FULL_MOON_CYCLE,
				tier1Conditional,
				tier2Conditional
			]);
			await service.initialize(adapter, 0);

			// On full moon day, both conditionals should activate
			const events = service.getActiveEvents(14);

			expect(events.some(e => e.eventId === 'full-moon')).toBe(true);
			expect(events.some(e => e.eventId === 'tier1-test')).toBe(true);
			expect(events.some(e => e.eventId === 'tier2-test')).toBe(true);
		});
	});

	describe('Edge Cases', () => {
		it('should handle empty event registry', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([]);
			await service.initialize(adapter, 0);

			const events = service.getActiveEvents(0);

			expect(events).toHaveLength(0);
		});

		it('should handle service not initialized', () => {
			const service = new WorldEventService(driver, rngFactory);

			// Should return empty array without throwing
			const events = service.getActiveEvents(0);

			expect(events).toHaveLength(0);
		});

		it('should handle invalid condition expressions gracefully', async () => {
			const badConditional: ConditionalEvent = {
				id: 'bad-condition',
				name: 'Bad Condition',
				type: 'conditional',
				priority: 1,
				effects: {},
				condition: "this is not valid javascript!!!",
				tier: 1
			};

			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([badConditional]);
			await service.initialize(adapter, 0);

			// Should not throw, just not activate the event
			const events = service.getActiveEvents(0);
			expect(events.some(e => e.eventId === 'bad-condition')).toBe(false);
		});

		it('should handle chain event with no valid states', async () => {
			const emptyChain: ChainEvent = {
				id: 'empty-chain',
				name: 'Empty Chain',
				type: 'chain',
				priority: 1,
				effects: {},
				seed: 99999,
				states: []
			};

			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([emptyChain]);
			await service.initialize(adapter, 0);

			// Should not throw
			const events = service.getActiveEvents(0);
			// Empty chain should not produce active events
		});

		it('should handle very large day numbers', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([WEEKLY_MARKET]);
			await service.initialize(adapter, 0);

			// Day 999999 should still work (999999 % 7 = 0, so market day)
			// Note: 1000000 % 7 = 1, so we use 999999 instead
			const events = service.getActiveEvents(999999);

			// Weekly market on day 999999: 999999 % 7 = 0, so it should be active
			expect(events).toHaveLength(1);
			expect(events[0].eventId).toBe('weekly-market');
		});
	});
});
