import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorldEventService } from '../services/WorldEventService';
import { CalendarDriver } from '../services/CalendarDriver';
import { IRngFactory } from '../interfaces/IRngFactory';
import { ISeededRandomizer } from '../interfaces/ISeededRandomizer';
import { IEventDefinitionAdapter } from '../interfaces/IEventDefinitionAdapter';
import {
	CalendarDefinition,
	AnyEventDefinition,
	IntervalEvent,
	ChainEvent,
	ConditionalEvent,
	EventContext
} from '../models/types';

// =============================================================================
// Test Suite: WorldEventService Type D Conditional Events (TKT-CAL-023)
// =============================================================================

// Test Calendar Definition
const TEST_CALENDAR: CalendarDefinition = {
	id: 'test-calendar',
	name: 'Test Calendar',
	description: 'Calendar for conditional event testing',
	weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
	months: [
		{ name: 'January', days: 30, order: 0 },
		{ name: 'February', days: 30, order: 1 },
		{ name: 'March', days: 30, order: 2 },
		{ name: 'April', days: 30, order: 3 },
		{ name: 'May', days: 30, order: 4 },
		{ name: 'June', days: 30, order: 5 },
		{ name: 'July', days: 30, order: 6 },
		{ name: 'August', days: 30, order: 7 },
		{ name: 'September', days: 30, order: 8 },
		{ name: 'October', days: 30, order: 9 },
		{ name: 'November', days: 30, order: 10 },
		{ name: 'December', days: 30, order: 11 }
	],
	holidays: [],
	startingYear: 1000,
	yearSuffix: 'TE'
};

// =============================================================================
// Event Definitions
// =============================================================================

// Type B: Full Moon (interval event)
const FULL_MOON: IntervalEvent = {
	id: 'full-moon',
	name: 'Full Moon',
	type: 'interval',
	priority: 5,
	effects: { light_level: 'bright' },
	interval: 28,
	offset: 14
};

// Type B: New Moon (interval event)
const NEW_MOON: IntervalEvent = {
	id: 'new-moon',
	name: 'New Moon',
	type: 'interval',
	priority: 5,
	effects: { light_level: 'dark' },
	interval: 28,
	offset: 0
};

// Type B: Weekly Market
const WEEKLY_MARKET: IntervalEvent = {
	id: 'weekly-market',
	name: 'Weekly Market',
	type: 'interval',
	priority: 3,
	effects: { commerce_bonus: 0.1 },
	interval: 7,
	offset: 0
};

// Type C: Weather Chain Event
const WEATHER_CHAIN: ChainEvent = {
	id: 'weather',
	name: 'Weather System',
	type: 'chain',
	priority: 2,
	effects: {},
	seed: 12345,
	states: [
		{ name: 'Clear', weight: 50, duration: '3 days', effects: { visibility: 'good' } },
		{ name: 'Cloudy', weight: 30, duration: '2 days', effects: { visibility: 'fair' } },
		{ name: 'Storm', weight: 20, duration: '1 days', effects: { visibility: 'poor', travel_speed: 0.5 } }
	]
};

// Deterministic weather for testing (always Clear)
const DETERMINISTIC_WEATHER: ChainEvent = {
	id: 'weather',
	name: 'Weather System',
	type: 'chain',
	priority: 2,
	effects: {},
	seed: 12345,
	initialState: 'Storm',  // Force Storm state
	states: [
		{ name: 'Clear', weight: 0, duration: '100 days', effects: { visibility: 'good' } },
		{ name: 'Storm', weight: 100, duration: '100 days', effects: { visibility: 'poor', travel_speed: 0.5 } }
	]
};

// Type D Tier 1: Werewolf Activity (depends on full-moon)
const WEREWOLF_ACTIVITY: ConditionalEvent = {
	id: 'werewolf-activity',
	name: 'Werewolf Activity',
	type: 'conditional',
	priority: 10,
	effects: { danger_level: 'high' },
	condition: "events['full-moon'].active",
	tier: 1
};

// Type D Tier 1: Storm Flooding (depends on weather state)
const STORM_FLOODING: ConditionalEvent = {
	id: 'storm-flooding',
	name: 'Storm Flooding',
	type: 'conditional',
	priority: 8,
	effects: { travel_blocked: true },
	condition: "events['weather'].state == 'Storm'",
	tier: 1
};

// Type D Tier 1: Compound condition (full moon AND market)
const MIDNIGHT_MARKET: ConditionalEvent = {
	id: 'midnight-market',
	name: 'Midnight Market',
	type: 'conditional',
	priority: 15,
	effects: { special_vendor: true },
	condition: "events['full-moon'].active && events['weekly-market'].active",
	tier: 1
};

// Type D Tier 1: OR condition
const LUNAR_EVENT: ConditionalEvent = {
	id: 'lunar-event',
	name: 'Lunar Event',
	type: 'conditional',
	priority: 7,
	effects: { lunar_activity: true },
	condition: "events['full-moon'].active || events['new-moon'].active",
	tier: 1
};

// Type D Tier 1: NOT condition
const DARK_NIGHT: ConditionalEvent = {
	id: 'dark-night',
	name: 'Dark Night',
	type: 'conditional',
	priority: 6,
	effects: { stealth_bonus: 0.2 },
	condition: "!events['full-moon'].active",
	tier: 1
};

// Type D Tier 2: Depends on Tier 1 conditional (werewolf-activity)
const WEREWOLF_HUNT: ConditionalEvent = {
	id: 'werewolf-hunt',
	name: 'Werewolf Hunt',
	type: 'conditional',
	priority: 12,
	effects: { bounty_available: true },
	condition: "events['werewolf-activity'].active",
	tier: 2
};

// Type D Tier 2: Complex dependency chain
const DANGEROUS_FLOOD: ConditionalEvent = {
	id: 'dangerous-flood',
	name: 'Dangerous Flood',
	type: 'conditional',
	priority: 11,
	effects: { evacuation_needed: true },
	condition: "events['storm-flooding'].active && events['lunar-event'].active",
	tier: 2
};

// Invalid Tier 1 referencing non-existent event
const INVALID_REFERENCE: ConditionalEvent = {
	id: 'invalid-reference',
	name: 'Invalid Reference',
	type: 'conditional',
	priority: 1,
	effects: {},
	condition: "events['nonexistent'].active",
	tier: 1
};

// =============================================================================
// Mock Implementations
// =============================================================================

class MockSeededRandomizer implements ISeededRandomizer {
	private state: number;

	constructor(seed: number) {
		this.state = seed;
	}

	reseed(seed: number): void {
		this.state = seed;
	}

	getState(): number {
		return this.state;
	}

	randomFloat(): number {
		let t = this.state += 0x6D2B79F5;
		t = Math.imul(t ^ t >>> 15, t | 1);
		t ^= t + Math.imul(t ^ t >>> 7, t | 61);
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	}

	randomInt(min: number, max: number): number {
		return Math.floor(this.randomFloat() * (max - min + 1)) + min;
	}

	randomFromArray<T>(array: T[]): T | undefined {
		if (array.length === 0) return undefined;
		return array[Math.floor(this.randomFloat() * array.length)];
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
}

// =============================================================================
// Tests
// =============================================================================

describe('WorldEventService - Type D Conditional Events (TKT-CAL-023)', () => {
	let driver: CalendarDriver;
	let rngFactory: IRngFactory;

	beforeEach(() => {
		driver = new CalendarDriver(TEST_CALENDAR);
		rngFactory = new MockRngFactory();
	});

	// =========================================================================
	// Single Condition Tests
	// =========================================================================

	describe('Single condition evaluation', () => {

		it('should activate conditional when interval event is active', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([
				FULL_MOON,
				WEREWOLF_ACTIVITY
			]);
			await service.initialize(adapter, 0);

			// Day 14: Full moon is active (interval 28, offset 14)
			const events = service.getActiveEvents(14);

			expect(events.some(e => e.eventId === 'full-moon')).toBe(true);
			expect(events.some(e => e.eventId === 'werewolf-activity')).toBe(true);
		});

		it('should not activate conditional when interval event is inactive', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([
				FULL_MOON,
				WEREWOLF_ACTIVITY
			]);
			await service.initialize(adapter, 0);

			// Day 0: Full moon is NOT active
			const events = service.getActiveEvents(0);

			expect(events.some(e => e.eventId === 'full-moon')).toBe(false);
			expect(events.some(e => e.eventId === 'werewolf-activity')).toBe(false);
		});

		it('should evaluate state comparison against chain event', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([
				DETERMINISTIC_WEATHER,
				STORM_FLOODING
			]);
			await service.initialize(adapter, 0);

			// Weather is forced to Storm state
			const events = service.getActiveEvents(0);

			const weatherEvent = events.find(e => e.eventId === 'weather');
			expect(weatherEvent).toBeDefined();
			expect(weatherEvent?.state).toBe('Storm');
			expect(events.some(e => e.eventId === 'storm-flooding')).toBe(true);
		});

		it('should not activate when state comparison fails', async () => {
			// Create weather that starts in Clear state
			const clearWeather: ChainEvent = {
				id: 'weather',
				name: 'Weather',
				type: 'chain',
				priority: 2,
				effects: {},
				seed: 99999,
				initialState: 'Clear',
				states: [
					{ name: 'Clear', weight: 100, duration: '100 days', effects: {} },
					{ name: 'Storm', weight: 0, duration: '1 days', effects: {} }
				]
			};

			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([
				clearWeather,
				STORM_FLOODING
			]);
			await service.initialize(adapter, 0);

			const events = service.getActiveEvents(0);

			expect(events.find(e => e.eventId === 'weather')?.state).toBe('Clear');
			expect(events.some(e => e.eventId === 'storm-flooding')).toBe(false);
		});
	});

	// =========================================================================
	// Compound Condition Tests (AND, OR, NOT)
	// =========================================================================

	describe('Compound condition evaluation', () => {

		describe('AND operator (&&)', () => {

			it('should activate when both conditions are true', async () => {
				const service = new WorldEventService(driver, rngFactory);
				const adapter = new MockEventDefinitionAdapter([
					FULL_MOON,
					WEEKLY_MARKET,
					MIDNIGHT_MARKET
				]);
				await service.initialize(adapter, 0);

				// Day 14: Full moon active (28, offset 14), Weekly market active (7, offset 0)
				// 14 % 7 === 0, so both are active
				const events = service.getActiveEvents(14);

				expect(events.some(e => e.eventId === 'full-moon')).toBe(true);
				expect(events.some(e => e.eventId === 'weekly-market')).toBe(true);
				expect(events.some(e => e.eventId === 'midnight-market')).toBe(true);
			});

			it('should not activate when left condition is false', async () => {
				const service = new WorldEventService(driver, rngFactory);
				const adapter = new MockEventDefinitionAdapter([
					FULL_MOON,
					WEEKLY_MARKET,
					MIDNIGHT_MARKET
				]);
				await service.initialize(adapter, 0);

				// Day 7: Full moon NOT active, Weekly market active
				const events = service.getActiveEvents(7);

				expect(events.some(e => e.eventId === 'full-moon')).toBe(false);
				expect(events.some(e => e.eventId === 'weekly-market')).toBe(true);
				expect(events.some(e => e.eventId === 'midnight-market')).toBe(false);
			});

			it('should not activate when right condition is false', async () => {
				const service = new WorldEventService(driver, rngFactory);
				const adapter = new MockEventDefinitionAdapter([
					FULL_MOON,
					WEEKLY_MARKET,
					MIDNIGHT_MARKET
				]);
				await service.initialize(adapter, 0);

				// Day 42: Full moon active (42+14=56, 56%28=0), Weekly market active (42%7=0)
				// Actually, let's find a day where full moon is active but market is not
				// Full moon on day 14, 42, 70...
				// Market on day 0, 7, 14, 21, 28, 35, 42...
				// Day 14: both active. We need to test the case where right is false differently.
				// Let's check a day where full moon would be "almost" active
				// Actually day 14 has both. Let's create a scenario with custom events.

				const customFullMoon: IntervalEvent = {
					id: 'full-moon',
					name: 'Full Moon',
					type: 'interval',
					priority: 5,
					effects: {},
					interval: 10,
					offset: 3  // Active on days 7, 17, 27...
				};

				const customMarket: IntervalEvent = {
					id: 'weekly-market',
					name: 'Weekly Market',
					type: 'interval',
					priority: 3,
					effects: {},
					interval: 10,
					offset: 5  // Active on days 5, 15, 25...
				};

				const service2 = new WorldEventService(driver, rngFactory);
				const adapter2 = new MockEventDefinitionAdapter([
					customFullMoon,
					customMarket,
					MIDNIGHT_MARKET
				]);
				await service2.initialize(adapter2, 0);

				// Day 7: Full moon active, market NOT active
				const events2 = service2.getActiveEvents(7);
				expect(events2.some(e => e.eventId === 'full-moon')).toBe(true);
				expect(events2.some(e => e.eventId === 'weekly-market')).toBe(false);
				expect(events2.some(e => e.eventId === 'midnight-market')).toBe(false);
			});
		});

		describe('OR operator (||)', () => {

			it('should activate when both conditions are true', async () => {
				// This is a special case - both full moon and new moon can't be active together
				// but let's test with different intervals
				const bothActive: ConditionalEvent = {
					id: 'both-moons',
					name: 'Both Moons',
					type: 'conditional',
					priority: 7,
					effects: {},
					condition: "events['weekly-market'].active || events['full-moon'].active",
					tier: 1
				};

				const service = new WorldEventService(driver, rngFactory);
				const adapter = new MockEventDefinitionAdapter([
					FULL_MOON,
					WEEKLY_MARKET,
					bothActive
				]);
				await service.initialize(adapter, 0);

				// Day 14: both active
				const events = service.getActiveEvents(14);
				expect(events.some(e => e.eventId === 'both-moons')).toBe(true);
			});

			it('should activate when only left condition is true', async () => {
				const service = new WorldEventService(driver, rngFactory);
				const adapter = new MockEventDefinitionAdapter([
					FULL_MOON,
					NEW_MOON,
					LUNAR_EVENT
				]);
				await service.initialize(adapter, 0);

				// Day 14: Full moon active, new moon NOT active
				const events = service.getActiveEvents(14);

				expect(events.some(e => e.eventId === 'full-moon')).toBe(true);
				expect(events.some(e => e.eventId === 'new-moon')).toBe(false);
				expect(events.some(e => e.eventId === 'lunar-event')).toBe(true);
			});

			it('should activate when only right condition is true', async () => {
				const service = new WorldEventService(driver, rngFactory);
				const adapter = new MockEventDefinitionAdapter([
					FULL_MOON,
					NEW_MOON,
					LUNAR_EVENT
				]);
				await service.initialize(adapter, 0);

				// Day 0: New moon active (interval 28, offset 0), full moon NOT active
				const events = service.getActiveEvents(0);

				expect(events.some(e => e.eventId === 'full-moon')).toBe(false);
				expect(events.some(e => e.eventId === 'new-moon')).toBe(true);
				expect(events.some(e => e.eventId === 'lunar-event')).toBe(true);
			});

			it('should not activate when both conditions are false', async () => {
				const service = new WorldEventService(driver, rngFactory);
				const adapter = new MockEventDefinitionAdapter([
					FULL_MOON,
					NEW_MOON,
					LUNAR_EVENT
				]);
				await service.initialize(adapter, 0);

				// Day 7: Neither full moon nor new moon is active
				const events = service.getActiveEvents(7);

				expect(events.some(e => e.eventId === 'full-moon')).toBe(false);
				expect(events.some(e => e.eventId === 'new-moon')).toBe(false);
				expect(events.some(e => e.eventId === 'lunar-event')).toBe(false);
			});
		});

		describe('NOT operator (!)', () => {

			it('should activate when negated condition is false', async () => {
				const service = new WorldEventService(driver, rngFactory);
				const adapter = new MockEventDefinitionAdapter([
					FULL_MOON,
					DARK_NIGHT
				]);
				await service.initialize(adapter, 0);

				// Day 0: Full moon NOT active, so !full-moon is true
				const events = service.getActiveEvents(0);

				expect(events.some(e => e.eventId === 'full-moon')).toBe(false);
				expect(events.some(e => e.eventId === 'dark-night')).toBe(true);
			});

			it('should not activate when negated condition is true', async () => {
				const service = new WorldEventService(driver, rngFactory);
				const adapter = new MockEventDefinitionAdapter([
					FULL_MOON,
					DARK_NIGHT
				]);
				await service.initialize(adapter, 0);

				// Day 14: Full moon IS active, so !full-moon is false
				const events = service.getActiveEvents(14);

				expect(events.some(e => e.eventId === 'full-moon')).toBe(true);
				expect(events.some(e => e.eventId === 'dark-night')).toBe(false);
			});
		});
	});

	// =========================================================================
	// Phase Order Enforcement Tests
	// =========================================================================

	describe('Phase order enforcement', () => {

		it('should execute Type A/B events before Type D Tier 1', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([
				FULL_MOON,      // Type B
				WEREWOLF_ACTIVITY  // Type D Tier 1
			]);
			await service.initialize(adapter, 0);

			// On day 14, full moon should be processed before werewolf
			const events = service.getActiveEvents(14);

			// Both should be active (werewolf depends on full moon)
			expect(events.some(e => e.eventId === 'full-moon')).toBe(true);
			expect(events.some(e => e.eventId === 'werewolf-activity')).toBe(true);
		});

		it('should execute Type C events before Type D Tier 1', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([
				DETERMINISTIC_WEATHER,  // Type C (Storm state)
				STORM_FLOODING          // Type D Tier 1
			]);
			await service.initialize(adapter, 0);

			const events = service.getActiveEvents(0);

			// Weather (chain) should be processed before flooding (conditional)
			expect(events.some(e => e.eventId === 'weather')).toBe(true);
			expect(events.some(e => e.eventId === 'storm-flooding')).toBe(true);
		});

		it('should execute Type D Tier 1 before Type D Tier 2', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([
				FULL_MOON,          // Type B
				WEREWOLF_ACTIVITY,  // Type D Tier 1
				WEREWOLF_HUNT       // Type D Tier 2 (depends on Tier 1)
			]);
			await service.initialize(adapter, 0);

			// Day 14: Full moon active -> werewolf active -> hunt active
			const events = service.getActiveEvents(14);

			expect(events.some(e => e.eventId === 'full-moon')).toBe(true);
			expect(events.some(e => e.eventId === 'werewolf-activity')).toBe(true);
			expect(events.some(e => e.eventId === 'werewolf-hunt')).toBe(true);
		});

		it('should not activate Tier 2 when Tier 1 dependency is inactive', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([
				FULL_MOON,
				WEREWOLF_ACTIVITY,
				WEREWOLF_HUNT
			]);
			await service.initialize(adapter, 0);

			// Day 0: No full moon -> no werewolf -> no hunt
			const events = service.getActiveEvents(0);

			expect(events.some(e => e.eventId === 'full-moon')).toBe(false);
			expect(events.some(e => e.eventId === 'werewolf-activity')).toBe(false);
			expect(events.some(e => e.eventId === 'werewolf-hunt')).toBe(false);
		});

		it('should handle complex Tier 2 dependencies', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([
				FULL_MOON,
				NEW_MOON,
				DETERMINISTIC_WEATHER,
				STORM_FLOODING,       // Tier 1: depends on weather == Storm
				LUNAR_EVENT,          // Tier 1: depends on full OR new moon
				DANGEROUS_FLOOD       // Tier 2: depends on storm-flooding AND lunar-event
			]);
			await service.initialize(adapter, 0);

			// Day 0: New moon (offset 0) + Storm weather
			// storm-flooding: true (Storm), lunar-event: true (new moon)
			// dangerous-flood: true && true = true
			const events = service.getActiveEvents(0);

			expect(events.some(e => e.eventId === 'new-moon')).toBe(true);
			expect(events.some(e => e.eventId === 'storm-flooding')).toBe(true);
			expect(events.some(e => e.eventId === 'lunar-event')).toBe(true);
			expect(events.some(e => e.eventId === 'dangerous-flood')).toBe(true);
		});

		it('should log warning for forward reference (conditional referencing same tier)', async () => {
			// Create conditional that references another conditional in same tier
			const forwardRef: ConditionalEvent = {
				id: 'forward-ref',
				name: 'Forward Reference',
				type: 'conditional',
				priority: 1,
				effects: {},
				condition: "events['same-tier'].active",  // References same tier
				tier: 1
			};

			const sameTier: ConditionalEvent = {
				id: 'same-tier',
				name: 'Same Tier',
				type: 'conditional',
				priority: 1,
				effects: {},
				condition: "true",
				tier: 1
			};

			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([forwardRef, sameTier]);
			await service.initialize(adapter, 0);

			// Should log a warning about forward reference
			expect(consoleSpy).toHaveBeenCalled();
			const warningMessage = consoleSpy.mock.calls.find(
				call => call[0].includes('forward-ref') || call[0].includes('same-tier')
			);
			expect(warningMessage).toBeDefined();

			consoleSpy.mockRestore();
		});
	});

	// =========================================================================
	// Missing Reference Graceful Failure Tests
	// =========================================================================

	describe('Graceful failure for missing event references', () => {

		it('should not activate conditional when referenced event does not exist', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([INVALID_REFERENCE]);
			await service.initialize(adapter, 0);

			const events = service.getActiveEvents(0);

			// Should not throw, just not activate
			expect(events.some(e => e.eventId === 'invalid-reference')).toBe(false);
		});

		it('should log warning for missing event reference', async () => {
			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([INVALID_REFERENCE]);
			await service.initialize(adapter, 0);

			service.getActiveEvents(0);

			expect(consoleSpy).toHaveBeenCalled();
			// Check that warning mentions 'nonexistent'
			const warningAboutMissing = consoleSpy.mock.calls.find(
				call => call[0].includes('nonexistent') || call[0].includes('missing')
			);
			expect(warningAboutMissing).toBeDefined();

			consoleSpy.mockRestore();
		});

		it('should handle partial missing references in compound condition', async () => {
			const partialMissing: ConditionalEvent = {
				id: 'partial-missing',
				name: 'Partial Missing',
				type: 'conditional',
				priority: 1,
				effects: {},
				condition: "events['full-moon'].active && events['nonexistent'].active",
				tier: 1
			};

			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([FULL_MOON, partialMissing]);
			await service.initialize(adapter, 0);

			// Day 14: full-moon is true, nonexistent is false (missing)
			// true && false = false
			const events = service.getActiveEvents(14);

			expect(events.some(e => e.eventId === 'full-moon')).toBe(true);
			expect(events.some(e => e.eventId === 'partial-missing')).toBe(false);
		});

		it('should activate conditional when missing reference is in OR with true value', async () => {
			const orWithMissing: ConditionalEvent = {
				id: 'or-with-missing',
				name: 'Or With Missing',
				type: 'conditional',
				priority: 1,
				effects: {},
				condition: "events['full-moon'].active || events['nonexistent'].active",
				tier: 1
			};

			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([FULL_MOON, orWithMissing]);
			await service.initialize(adapter, 0);

			// Day 14: full-moon is true, nonexistent is false (missing)
			// true || false = true
			const events = service.getActiveEvents(14);

			expect(events.some(e => e.eventId === 'full-moon')).toBe(true);
			expect(events.some(e => e.eventId === 'or-with-missing')).toBe(true);
		});

		it('should not throw on invalid condition syntax', async () => {
			const invalidSyntax: ConditionalEvent = {
				id: 'invalid-syntax',
				name: 'Invalid Syntax',
				type: 'conditional',
				priority: 1,
				effects: {},
				condition: "this is not valid &&& condition",
				tier: 1
			};

			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([invalidSyntax]);
			await service.initialize(adapter, 0);

			// Should not throw
			const events = service.getActiveEvents(0);

			// Invalid syntax event should not be active
			expect(events.some(e => e.eventId === 'invalid-syntax')).toBe(false);

			consoleSpy.mockRestore();
		});
	});

	// =========================================================================
	// Priority Tiers for Conditional Ordering Tests
	// =========================================================================

	describe('Priority tiers for conditional ordering', () => {

		it('should sort conditional events by tier', async () => {
			// Create multiple conditionals with different tiers
			const tier2First: ConditionalEvent = {
				id: 'tier2-first',
				name: 'Tier 2 First',
				type: 'conditional',
				priority: 100,  // High priority but tier 2
				effects: {},
				condition: "events['tier1-second'].active",
				tier: 2
			};

			const tier1Second: ConditionalEvent = {
				id: 'tier1-second',
				name: 'Tier 1 Second',
				type: 'conditional',
				priority: 1,  // Low priority but tier 1
				effects: {},
				condition: "events['full-moon'].active",
				tier: 1
			};

			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([
				FULL_MOON,
				tier2First,
				tier1Second
			]);
			await service.initialize(adapter, 0);

			// Day 14: full-moon -> tier1-second -> tier2-first
			const events = service.getActiveEvents(14);

			expect(events.some(e => e.eventId === 'full-moon')).toBe(true);
			expect(events.some(e => e.eventId === 'tier1-second')).toBe(true);
			expect(events.some(e => e.eventId === 'tier2-first')).toBe(true);
		});

		it('should handle multiple tier 1 conditionals independently', async () => {
			const tier1A: ConditionalEvent = {
				id: 'tier1-a',
				name: 'Tier 1 A',
				type: 'conditional',
				priority: 5,
				effects: { effect_a: true },
				condition: "events['full-moon'].active",
				tier: 1
			};

			const tier1B: ConditionalEvent = {
				id: 'tier1-b',
				name: 'Tier 1 B',
				type: 'conditional',
				priority: 10,
				effects: { effect_b: true },
				condition: "events['weekly-market'].active",
				tier: 1
			};

			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([
				FULL_MOON,
				WEEKLY_MARKET,
				tier1A,
				tier1B
			]);
			await service.initialize(adapter, 0);

			// Day 14: Both full moon and market are active
			const events = service.getActiveEvents(14);

			expect(events.some(e => e.eventId === 'tier1-a')).toBe(true);
			expect(events.some(e => e.eventId === 'tier1-b')).toBe(true);
		});

		it('should handle multiple tier 2 conditionals independently', async () => {
			const tier1Base: ConditionalEvent = {
				id: 'tier1-base',
				name: 'Tier 1 Base',
				type: 'conditional',
				priority: 1,
				effects: {},
				condition: "events['full-moon'].active",
				tier: 1
			};

			const tier2A: ConditionalEvent = {
				id: 'tier2-a',
				name: 'Tier 2 A',
				type: 'conditional',
				priority: 5,
				effects: {},
				condition: "events['tier1-base'].active",
				tier: 2
			};

			const tier2B: ConditionalEvent = {
				id: 'tier2-b',
				name: 'Tier 2 B',
				type: 'conditional',
				priority: 10,
				effects: {},
				condition: "events['tier1-base'].active",
				tier: 2
			};

			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([
				FULL_MOON,
				tier1Base,
				tier2A,
				tier2B
			]);
			await service.initialize(adapter, 0);

			// Day 14: full-moon -> tier1-base -> tier2-a, tier2-b
			const events = service.getActiveEvents(14);

			expect(events.some(e => e.eventId === 'tier2-a')).toBe(true);
			expect(events.some(e => e.eventId === 'tier2-b')).toBe(true);
		});
	});

	// =========================================================================
	// Integration Tests
	// =========================================================================

	describe('Integration scenarios', () => {

		it('should handle complex multi-layer dependency chains', async () => {
			// Chain: full-moon -> werewolf -> hunt
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([
				FULL_MOON,
				WEREWOLF_ACTIVITY,
				WEREWOLF_HUNT
			]);
			await service.initialize(adapter, 0);

			// Verify the chain on day 14
			const events = service.getActiveEvents(14);

			const fullMoon = events.find(e => e.eventId === 'full-moon');
			const werewolf = events.find(e => e.eventId === 'werewolf-activity');
			const hunt = events.find(e => e.eventId === 'werewolf-hunt');

			expect(fullMoon).toBeDefined();
			expect(werewolf).toBeDefined();
			expect(hunt).toBeDefined();

			// Verify priorities
			expect(werewolf!.priority).toBeGreaterThan(fullMoon!.priority);
			expect(hunt!.priority).toBeGreaterThan(werewolf!.priority);
		});

		it('should properly aggregate effects from conditional events', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([
				FULL_MOON,
				WEREWOLF_ACTIVITY,
				DARK_NIGHT
			]);
			await service.initialize(adapter, 0);

			// Day 0: No full moon -> dark night active
			const day0Registry = service.getEffectRegistry(0);
			expect(day0Registry.effects.stealth_bonus).toBe(0.2);

			// Day 14: Full moon -> werewolf active, dark night inactive
			const day14Registry = service.getEffectRegistry(14);
			expect(day14Registry.effects.danger_level).toBe('high');
			expect(day14Registry.effects.stealth_bonus).toBeUndefined();
		});

		it('should handle conditional events with module toggles', async () => {
			const taggedWerewolf: ConditionalEvent = {
				...WEREWOLF_ACTIVITY,
				id: 'tagged-werewolf',
				tags: ['horror-mode']
			};

			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([
				FULL_MOON,
				taggedWerewolf
			]);
			await service.initialize(adapter, 0);

			// Initially active
			expect(service.getActiveEvents(14).some(e => e.eventId === 'tagged-werewolf')).toBe(true);

			// Disable horror-mode
			service.toggleModule('horror-mode', false);
			expect(service.getActiveEvents(14).some(e => e.eventId === 'tagged-werewolf')).toBe(false);

			// Re-enable
			service.toggleModule('horror-mode', true);
			expect(service.getActiveEvents(14).some(e => e.eventId === 'tagged-werewolf')).toBe(true);
		});

		it('should cache conditional event results', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([
				FULL_MOON,
				WEREWOLF_ACTIVITY
			]);
			await service.initialize(adapter, 0);

			// First call
			const events1 = service.getActiveEvents(14);
			// Second call (should use cache)
			const events2 = service.getActiveEvents(14);

			expect(events1).toEqual(events2);
		});
	});
});
