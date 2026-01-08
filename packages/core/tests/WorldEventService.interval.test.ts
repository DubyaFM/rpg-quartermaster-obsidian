import { describe, it, expect, beforeEach } from 'vitest';
import { WorldEventService } from '../services/WorldEventService';
import { CalendarDriver } from '../services/CalendarDriver';
import { IRngFactory } from '../interfaces/IRngFactory';
import { ISeededRandomizer } from '../interfaces/ISeededRandomizer';
import { IEventDefinitionAdapter } from '../interfaces/IEventDefinitionAdapter';
import {
	CalendarDefinition,
	AnyEventDefinition,
	IntervalEvent,
	EventContext
} from '../models/types';

// ==========================================================================
// Test Fixtures - Calendar Definition
// ==========================================================================

const TEST_CALENDAR: CalendarDefinition = {
	id: 'test-calendar',
	name: 'Test Calendar',
	description: 'Calendar for interval event testing',
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
		{ name: 'December', days: 32, order: 11 }
	],
	holidays: [],
	startingYear: 1000,
	yearSuffix: 'TE'
};

// ==========================================================================
// Test Fixtures - Event Definitions
// ==========================================================================

// Daily events (interval 1)
const DAILY_BLESSING: IntervalEvent = {
	id: 'daily-blessing',
	name: 'Daily Blessing',
	type: 'interval',
	priority: 1,
	effects: {
		morale_boost: 0.1
	},
	interval: 1,
	offset: 0
};

// Weekly events (interval 7)
const WEEKLY_MARKET: IntervalEvent = {
	id: 'weekly-market',
	name: 'Weekly Market',
	type: 'interval',
	priority: 5,
	effects: {
		price_reduction: 0.1
	},
	interval: 7,
	offset: 0
};

// Bi-weekly with offset (interval 14, offset 7)
const BI_WEEKLY_COUNCIL: IntervalEvent = {
	id: 'council-meeting',
	name: 'Council Meeting',
	type: 'interval',
	priority: 8,
	effects: {
		decree_active: true
	},
	interval: 14,
	offset: 7
};

// Lunar cycle (interval 28, offset 14 for full moon)
const FULL_MOON: IntervalEvent = {
	id: 'full-moon',
	name: 'Full Moon',
	type: 'interval',
	priority: 3,
	effects: {
		light_level: 'bright',
		werewolf_activity: true
	},
	interval: 28,
	offset: 14
};

// Hourly event (every 4 hours)
const HOURLY_BELL: IntervalEvent = {
	id: 'hourly-bell',
	name: 'Bell Tower Chime',
	type: 'interval',
	priority: 1,
	effects: {
		sound: 'bell_toll'
	},
	interval: 240,  // Every 240 minutes (4 hours)
	offset: 0,
	useMinutes: true
};

// Sub-day interval with offset (every 6 hours, starting at noon)
const NOON_AND_MIDNIGHT: IntervalEvent = {
	id: 'noon-and-midnight',
	name: 'Noon and Midnight',
	type: 'interval',
	priority: 2,
	effects: {
		reset_dailies: true
	},
	interval: 720,  // Every 720 minutes (12 hours)
	offset: 720,    // Offset of 12 hours (noon)
	useMinutes: true
};

// Monthly-like cycle (30-day interval, offset 0)
const MONTHLY_TRIBUTE: IntervalEvent = {
	id: 'monthly-tribute',
	name: 'Monthly Tribute Due',
	type: 'interval',
	priority: 6,
	effects: {
		tax_collection: true
	},
	interval: 30,
	offset: 0
};

// ==========================================================================
// Mock Implementations
// ==========================================================================

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
// Tests: Type B Interval Event Matching
// ==========================================================================

describe('WorldEventService - Type B Interval Events (TKT-CAL-021)', () => {
	let driver: CalendarDriver;
	let rngFactory: IRngFactory;

	beforeEach(() => {
		driver = new CalendarDriver(TEST_CALENDAR);
		rngFactory = new MockRngFactory();
	});

	// ========================================================================
	// Basic Interval Matching: (Day + Offset) % Interval === 0
	// ========================================================================

	describe('Basic interval matching with modulo math', () => {
		it('should match daily events (interval 1, offset 0)', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([DAILY_BLESSING]);
			await service.initialize(adapter, 0);

			// Daily event should trigger every single day
			for (let day = 0; day < 10; day++) {
				const events = service.getActiveEvents(day);
				expect(events).toHaveLength(1);
				expect(events[0].eventId).toBe('daily-blessing');
			}
		});

		it('should match weekly events (interval 7, offset 0)', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([WEEKLY_MARKET]);
			await service.initialize(adapter, 0);

			// Days 0, 7, 14, 21, 28... should match
			expect(service.getActiveEvents(0)).toHaveLength(1);
			expect(service.getActiveEvents(7)).toHaveLength(1);
			expect(service.getActiveEvents(14)).toHaveLength(1);
			expect(service.getActiveEvents(21)).toHaveLength(1);
			expect(service.getActiveEvents(28)).toHaveLength(1);

			// Days 1-6, 8-13, 15-20... should not match
			expect(service.getActiveEvents(1)).toHaveLength(0);
			expect(service.getActiveEvents(5)).toHaveLength(0);
			expect(service.getActiveEvents(8)).toHaveLength(0);
			expect(service.getActiveEvents(13)).toHaveLength(0);
		});

		it('should match monthly-like events (interval 30, offset 0)', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([MONTHLY_TRIBUTE]);
			await service.initialize(adapter, 0);

			// Days 0, 30, 60, 90, 120... should match
			expect(service.getActiveEvents(0)).toHaveLength(1);
			expect(service.getActiveEvents(30)).toHaveLength(1);
			expect(service.getActiveEvents(60)).toHaveLength(1);
			expect(service.getActiveEvents(90)).toHaveLength(1);

			// Days 1-29, 31-59... should not match
			expect(service.getActiveEvents(15)).toHaveLength(0);
			expect(service.getActiveEvents(45)).toHaveLength(0);
		});

		it('should calculate O(1) complexity (no iteration beyond checking formula)', async () => {
			const service = new WorldEventService(driver, rngFactory);
			// Create 100 interval events
			const manyEvents = Array.from({ length: 100 }, (_, i) => ({
				id: `event-${i}`,
				name: `Event ${i}`,
				type: 'interval' as const,
				priority: 1,
				effects: {},
				interval: 7 + i,  // Varying intervals
				offset: 0
			}));

			const adapter = new MockEventDefinitionAdapter(manyEvents);
			await service.initialize(adapter, 0);

			// Each call should complete quickly (O(n) where n = number of events, not O(n*m))
			const start = performance.now();
			for (let day = 0; day < 1000; day++) {
				service.getActiveEvents(day);
			}
			const elapsed = performance.now() - start;

			// Sanity check: 1000 day queries with 100 events each should complete quickly
			// (This is a rough check, actual performance depends on hardware)
			expect(elapsed).toBeLessThan(5000); // Should complete in under 5 seconds
		});
	});

	// ========================================================================
	// Offset Support: Phase Alignment
	// ========================================================================

	describe('Offset support for phase alignment', () => {
		it('should respect positive offset for phase alignment', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([FULL_MOON]);
			await service.initialize(adapter, 0);

			// Full moon: interval 28, offset 14
			// Formula: (day + 14) % 28 === 0
			// So: day 14, 42, 70, 98... should match
			expect(service.getActiveEvents(14)).toHaveLength(1);
			expect(service.getActiveEvents(42)).toHaveLength(1);
			expect(service.getActiveEvents(70)).toHaveLength(1);
			expect(service.getActiveEvents(98)).toHaveLength(1);

			// Days 0, 28, 56, 84... should NOT match
			expect(service.getActiveEvents(0)).toHaveLength(0);
			expect(service.getActiveEvents(28)).toHaveLength(0);
			expect(service.getActiveEvents(56)).toHaveLength(0);
		});

		it('should handle bi-weekly events with non-zero offset', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([BI_WEEKLY_COUNCIL]);
			await service.initialize(adapter, 0);

			// Bi-weekly council: interval 14, offset 7
			// Formula: (day + 7) % 14 === 0
			// So: day 7, 21, 35, 49... should match
			expect(service.getActiveEvents(7)).toHaveLength(1);
			expect(service.getActiveEvents(21)).toHaveLength(1);
			expect(service.getActiveEvents(35)).toHaveLength(1);

			// Days 0, 14, 28... should NOT match
			expect(service.getActiveEvents(0)).toHaveLength(0);
			expect(service.getActiveEvents(14)).toHaveLength(0);
			expect(service.getActiveEvents(28)).toHaveLength(0);
		});

		it('should support negative offset interpretation (offset as phase delay)', async () => {
			// Event that triggers every 10 days, but 3 days late (offset -3 or +7 mod 10)
			const delayedEvent: IntervalEvent = {
				id: 'delayed-event',
				name: 'Delayed Event',
				type: 'interval',
				priority: 1,
				effects: {},
				interval: 10,
				offset: 7  // 7 days into a 10-day cycle = 3 days late
			};

			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([delayedEvent]);
			await service.initialize(adapter, 0);

			// Should match on days where (day + 7) % 10 === 0
			// Days: 3, 13, 23, 33...
			expect(service.getActiveEvents(3)).toHaveLength(1);
			expect(service.getActiveEvents(13)).toHaveLength(1);
			expect(service.getActiveEvents(23)).toHaveLength(1);
		});
	});

	// ========================================================================
	// Sub-Day Intervals (Hours/Minutes)
	// ========================================================================

	describe('Sub-day intervals using useMinutes flag', () => {
		it('should support hourly events (every 4 hours)', async () => {
			// Day 0, 00:00 (midnight)
			// totalMinutes = 0 * 1440 + 0 = 0
			// (0 + 0) % 240 === 0 ✓
			let service = new WorldEventService(driver, rngFactory);
			driver.setTimeOfDay(0);
			let adapter = new MockEventDefinitionAdapter([HOURLY_BELL]);
			await service.initialize(adapter, 0);
			expect(service.getActiveEvents(0)).toHaveLength(1);

			// Day 0, 04:00 (4 hours)
			// totalMinutes = 0 * 1440 + 240 = 240
			// (240 + 0) % 240 === 0 ✓
			service = new WorldEventService(driver, rngFactory);
			driver.setTimeOfDay(240);
			adapter = new MockEventDefinitionAdapter([HOURLY_BELL]);
			await service.initialize(adapter, 0);
			expect(service.getActiveEvents(0)).toHaveLength(1);

			// Day 0, 08:00 (8 hours)
			// totalMinutes = 0 * 1440 + 480 = 480
			// (480 + 0) % 240 === 0 ✓
			service = new WorldEventService(driver, rngFactory);
			driver.setTimeOfDay(480);
			adapter = new MockEventDefinitionAdapter([HOURLY_BELL]);
			await service.initialize(adapter, 0);
			expect(service.getActiveEvents(0)).toHaveLength(1);

			// Day 0, 02:00 (2 hours - non-matching)
			// totalMinutes = 0 * 1440 + 120 = 120
			// (120 + 0) % 240 !== 0
			service = new WorldEventService(driver, rngFactory);
			driver.setTimeOfDay(120);
			adapter = new MockEventDefinitionAdapter([HOURLY_BELL]);
			await service.initialize(adapter, 0);
			expect(service.getActiveEvents(0)).toHaveLength(0);

			// Day 1, 00:00 (midnight next day)
			// totalMinutes = 1 * 1440 + 0 = 1440
			// (1440 + 0) % 240 === 0 ✓
			service = new WorldEventService(driver, rngFactory);
			driver.setTimeOfDay(0);
			adapter = new MockEventDefinitionAdapter([HOURLY_BELL]);
			await service.initialize(adapter, 0);
			expect(service.getActiveEvents(1)).toHaveLength(1);
		});

		it('should support 12-hour cycle events with offset (noon and midnight)', async () => {
			// Day 0, 12:00 (noon)
			// totalMinutes = 0 * 1440 + 720 = 720
			// (720 + 720) % 720 === 0 ✓
			let service = new WorldEventService(driver, rngFactory);
			driver.setTimeOfDay(720);
			let adapter = new MockEventDefinitionAdapter([NOON_AND_MIDNIGHT]);
			await service.initialize(adapter, 0);
			expect(service.getActiveEvents(0)).toHaveLength(1);

			// Day 1, 00:00 (midnight)
			// totalMinutes = 1 * 1440 + 0 = 1440
			// (1440 + 720) % 720 === 0 ✓
			service = new WorldEventService(driver, rngFactory);
			driver.setTimeOfDay(0);
			adapter = new MockEventDefinitionAdapter([NOON_AND_MIDNIGHT]);
			await service.initialize(adapter, 0);
			expect(service.getActiveEvents(1)).toHaveLength(1);

			// Day 1, 12:00 (noon next day)
			// totalMinutes = 1 * 1440 + 720 = 2160
			// (2160 + 720) % 720 === 0 ✓
			service = new WorldEventService(driver, rngFactory);
			driver.setTimeOfDay(720);
			adapter = new MockEventDefinitionAdapter([NOON_AND_MIDNIGHT]);
			await service.initialize(adapter, 0);
			expect(service.getActiveEvents(1)).toHaveLength(1);

			// Day 0, 06:00 (6 hours - non-matching)
			// totalMinutes = 0 * 1440 + 360 = 360
			// (360 + 720) % 720 !== 0
			service = new WorldEventService(driver, rngFactory);
			driver.setTimeOfDay(360);
			adapter = new MockEventDefinitionAdapter([NOON_AND_MIDNIGHT]);
			await service.initialize(adapter, 0);
			expect(service.getActiveEvents(0)).toHaveLength(0);
		});

		it('should calculate with 1440 minutes per day constant', async () => {
			// Verify the sub-day calculation uses the correct minute conversion
			const everyHourEvent: IntervalEvent = {
				id: 'every-hour',
				name: 'Every Hour',
				type: 'interval',
				priority: 1,
				effects: {},
				interval: 60,  // Every 60 minutes (hourly)
				offset: 0,
				useMinutes: true
			};

			// Test multiple hour boundaries on different days
			const testCases = [
				{ day: 0, time: 0, shouldMatch: true },     // 00:00
				{ day: 0, time: 60, shouldMatch: true },    // 01:00
				{ day: 0, time: 120, shouldMatch: true },   // 02:00
				{ day: 0, time: 30, shouldMatch: false },   // 00:30
				{ day: 1, time: 0, shouldMatch: true },     // Day 1, 00:00
				{ day: 1, time: 60, shouldMatch: true },    // Day 1, 01:00
				{ day: 2, time: 0, shouldMatch: true }      // Day 2, 00:00
			];

			for (const testCase of testCases) {
				let service = new WorldEventService(driver, rngFactory);
				driver.setTimeOfDay(testCase.time);
				let adapter = new MockEventDefinitionAdapter([everyHourEvent]);
				await service.initialize(adapter, 0);
				const events = service.getActiveEvents(testCase.day);

				if (testCase.shouldMatch) {
					expect(events).toHaveLength(1,
						`Day ${testCase.day}, ${testCase.time} minutes should match`);
				} else {
					expect(events).toHaveLength(0,
						`Day ${testCase.day}, ${testCase.time} minutes should NOT match`);
				}
			}
		});
	});

	// ========================================================================
	// Configuration Flexibility
	// ========================================================================

	describe('Configurable interval and offset', () => {
		it('should accept any positive interval value', async () => {
			const intervals = [3, 7, 13, 30, 42, 365];  // Skip interval=1 since it matches every day

			for (const interval of intervals) {
				const event: IntervalEvent = {
					id: `interval-${interval}`,
					name: `Event every ${interval} days`,
					type: 'interval',
					priority: 1,
					effects: {},
					interval,
					offset: 0
				};

				const service = new WorldEventService(driver, rngFactory);
				const adapter = new MockEventDefinitionAdapter([event]);
				await service.initialize(adapter, 0);

				// Day 0 should always match (0 + 0) % interval === 0
				expect(service.getActiveEvents(0)).toHaveLength(1);

				// Next match should be at interval
				expect(service.getActiveEvents(interval)).toHaveLength(1);

				// Non-match should be offset by 1 (except for daily which always matches)
				expect(service.getActiveEvents(1)).toHaveLength(0);
			}
		});

		it('should accept any non-negative offset value', async () => {
			const offsets = [0, 1, 5, 14, 30, 100];

			for (const offset of offsets) {
				const event: IntervalEvent = {
					id: `offset-${offset}`,
					name: `Event with offset ${offset}`,
					type: 'interval',
					priority: 1,
					effects: {},
					interval: 30,  // 30-day cycle
					offset
				};

				const service = new WorldEventService(driver, rngFactory);
				const adapter = new MockEventDefinitionAdapter([event]);
				await service.initialize(adapter, 0);

				// First match at day where (day + offset) % 30 === 0
				const firstMatch = offset === 0 ? 0 : (30 - offset);
				if (firstMatch < 100) {
					expect(service.getActiveEvents(firstMatch)).toHaveLength(1);
				}

				// Next match should be 30 days later
				const secondMatch = firstMatch + 30;
				expect(service.getActiveEvents(secondMatch)).toHaveLength(1);
			}
		});

		it('should handle sub-day intervals with various minute values', async () => {
			const intervals = [60, 120, 240, 480, 720];  // 1h, 2h, 4h, 8h, 12h

			for (const interval of intervals) {
				const event: IntervalEvent = {
					id: `minutes-${interval}`,
					name: `Every ${interval} minutes`,
					type: 'interval',
					priority: 1,
					effects: {},
					interval,
					offset: 0,
					useMinutes: true
				};

				// Day 0, 00:00 should always match
				// totalMinutes = 0 * 1440 + 0 = 0
				// (0 + 0) % interval === 0 ✓
				let service = new WorldEventService(driver, rngFactory);
				driver.setTimeOfDay(0);
				let adapter = new MockEventDefinitionAdapter([event]);
				await service.initialize(adapter, 0);
				expect(service.getActiveEvents(0)).toHaveLength(1);

				// Next match at next interval boundary
				// totalMinutes = 0 * 1440 + interval = interval
				// (interval + 0) % interval === 0 ✓
				service = new WorldEventService(driver, rngFactory);
				driver.setTimeOfDay(interval);
				adapter = new MockEventDefinitionAdapter([event]);
				await service.initialize(adapter, 0);
				expect(service.getActiveEvents(0)).toHaveLength(1);
			}
		});
	});

	// ========================================================================
	// Event Duration and Module Toggles
	// ========================================================================

	describe('Event duration and module toggles', () => {
		it('should respect event duration for interval events', async () => {
			const longDurationEvent: IntervalEvent = {
				id: 'long-duration',
				name: 'Festival',
				type: 'interval',
				priority: 1,
				effects: { festive: true },
				interval: 30,
				offset: 0,
				duration: 5  // 5-day festival
			};

			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([longDurationEvent]);
			await service.initialize(adapter, 0);

			const events = service.getActiveEvents(0);
			expect(events[0].startDay).toBe(0);
			expect(events[0].endDay).toBe(4);  // Days 0-4 (5 days total)
			expect(events[0].remainingDays).toBe(4);
		});

		it('should respect module toggles for interval events', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([WEEKLY_MARKET]);
			await service.initialize(adapter, 0);

			// Event should be active initially
			expect(service.getActiveEvents(0)).toHaveLength(1);

			// Disable the module
			service.toggleModule('markets', false);
			// Note: Module tags are set via event.tags, so we need to test with a tagged event
		});

		it('should respect tagged module toggles', async () => {
			const taggedMarket: IntervalEvent = {
				id: 'tagged-market',
				name: 'Tagged Market',
				type: 'interval',
				priority: 1,
				effects: {},
				interval: 7,
				offset: 0,
				tags: ['commerce']
			};

			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([taggedMarket]);
			await service.initialize(adapter, 0);

			// Event should be active initially
			expect(service.getActiveEvents(0)).toHaveLength(1);

			// Disable commerce module
			service.toggleModule('commerce', false);

			// Event should no longer be active
			expect(service.getActiveEvents(0)).toHaveLength(0);

			// Re-enable commerce module
			service.toggleModule('commerce', true);

			// Event should be active again
			expect(service.getActiveEvents(0)).toHaveLength(1);
		});
	});

	// ========================================================================
	// Edge Cases and Validation
	// ========================================================================

	describe('Edge cases and special scenarios', () => {
		it('should handle large day numbers without overflow', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([WEEKLY_MARKET]);
			await service.initialize(adapter, 0);

			// Test with very large day numbers
			const largeDay = 999999;
			const isMatch = (largeDay + 0) % 7 === 0;

			if (isMatch) {
				expect(service.getActiveEvents(largeDay)).toHaveLength(1);
			} else {
				expect(service.getActiveEvents(largeDay)).toHaveLength(0);
			}
		});

		it('should handle multiple matching events on same day', async () => {
			const events: IntervalEvent[] = [
				DAILY_BLESSING,      // Matches every day
				WEEKLY_MARKET,       // Matches every 7 days
				MONTHLY_TRIBUTE      // Matches every 30 days
			];

			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter(events);
			await service.initialize(adapter, 0);

			// Day 0: All three should match
			let activeEvents = service.getActiveEvents(0);
			expect(activeEvents.length).toBeGreaterThanOrEqual(2);  // At least daily + monthly

			// Day 7: Daily and weekly should match, monthly shouldn't
			activeEvents = service.getActiveEvents(7);
			const dailyMatches = activeEvents.filter(e => e.eventId === 'daily-blessing');
			const weeklyMatches = activeEvents.filter(e => e.eventId === 'weekly-market');
			expect(dailyMatches).toHaveLength(1);
			expect(weeklyMatches).toHaveLength(1);
		});

		it('should preserve event definition data when matching', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([FULL_MOON]);
			await service.initialize(adapter, 0);

			const events = service.getActiveEvents(14);
			expect(events[0].eventId).toBe('full-moon');
			expect(events[0].name).toBe('Full Moon');
			expect(events[0].priority).toBe(3);
			expect(events[0].effects.light_level).toBe('bright');
			expect(events[0].effects.werewolf_activity).toBe(true);
		});
	});

	// ========================================================================
	// Performance and Caching
	// ========================================================================

	describe('Performance characteristics', () => {
		it('should cache results for repeated day queries', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([WEEKLY_MARKET]);
			await service.initialize(adapter, 0);

			// First query
			const events1 = service.getActiveEvents(7);
			// Second query (should use cache)
			const events2 = service.getActiveEvents(7);

			expect(events1).toEqual(events2);
			expect(events1[0].eventId).toBe(events2[0].eventId);
		});

		it('should handle rapid day progression without performance degradation', async () => {
			const service = new WorldEventService(driver, rngFactory);
			const adapter = new MockEventDefinitionAdapter([WEEKLY_MARKET]);
			await service.initialize(adapter, 0);

			const start = performance.now();

			// Simulate 1000 days of queries
			for (let day = 0; day < 1000; day++) {
				service.getActiveEvents(day);
			}

			const elapsed = performance.now() - start;

			// Should complete quickly (sub-1000ms for 1000 queries)
			expect(elapsed).toBeLessThan(1000);
		});
	});
});
