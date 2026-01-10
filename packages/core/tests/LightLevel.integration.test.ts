/**
 * Light Level Integration Tests (TKT-CAL-038)
 *
 * Tests the complete light level system:
 * - Solar baseline from CalendarDriver (Layer 0)
 * - Event effects from WorldEventService (Layer 1+)
 * - Darkest wins merge strategy
 * - Full integration through effect registry
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WorldEventService } from '../services/WorldEventService';
import { CalendarDriver } from '../services/CalendarDriver';
import { IEventDefinitionAdapter } from '../interfaces/IEventDefinitionAdapter';
import { IRngFactory } from '../interfaces/IRngFactory';
import { ISeededRandomizer } from '../interfaces/ISeededRandomizer';
import { CalendarDefinition, Season } from '../models/types';
import { FixedDateEvent, IntervalEvent, AnyEventDefinition, EventContext } from '../models/eventTypes';

/**
 * Mock seeded randomizer for testing
 */
class MockSeededRandomizer implements ISeededRandomizer {
	private state: number;

	constructor(seed: number) {
		this.state = seed;
	}

	getState(): number {
		return this.state;
	}

	reseed(seed: number): void {
		this.state = seed;
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

/**
 * Mock RNG factory for testing
 */
class MockRngFactory implements IRngFactory {
	create(seed: number): ISeededRandomizer {
		return new MockSeededRandomizer(seed);
	}
}

/**
 * Simple mock adapter for testing
 */
class MockEventDefinitionAdapter implements IEventDefinitionAdapter {
	constructor(private events: AnyEventDefinition[] = []) {}

	addEvent(event: AnyEventDefinition): void {
		this.events.push(event);
	}

	async loadEventDefinitions(_context?: EventContext): Promise<AnyEventDefinition[]> {
		return this.events;
	}

	async loadEventDefinitionsByIds(ids: string[]): Promise<(AnyEventDefinition | null)[]> {
		return ids.map(id => this.events.find(e => e.id === id) ?? null);
	}
}

/**
 * Create test calendar with day/night cycle
 */
function createTestCalendar(): CalendarDefinition {
	const seasons: Season[] = [
		{
			name: 'Summer',
			startMonth: 0,
			startDay: 1,
			sunrise: 360,  // 6:00 AM
			sunset: 1080   // 6:00 PM
		}
	];

	return {
		name: 'Test Calendar',
		months: [
			{ name: 'Month 1', days: 30 },
			{ name: 'Month 2', days: 30 },
			{ name: 'Month 3', days: 30 }
		],
		weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
		seasons,
		startingYear: 1,
		yearSuffix: 'TE'
	};
}

describe('Light Level Integration', () => {
	let driver: CalendarDriver;
	let service: WorldEventService;
	let adapter: MockEventDefinitionAdapter;
	let rngFactory: IRngFactory;

	beforeEach(async () => {
		const calendar = createTestCalendar();
		driver = new CalendarDriver(calendar);
		rngFactory = new MockRngFactory();
		adapter = new MockEventDefinitionAdapter();
		service = new WorldEventService(driver, rngFactory);
	});

	describe('Solar Baseline Only', () => {
		it('should return bright light during daytime', async () => {
			await service.initialize(adapter, 0);

			// Set time to noon
			driver.setTimeOfDay(720); // 12:00 PM

			const effectRegistry = service.getEffectRegistry(0);

			expect(effectRegistry.effects.light_level).toBe('bright');
		});

		it('should return dark light during nighttime', async () => {
			await service.initialize(adapter, 0);

			// Set time to midnight
			driver.setTimeOfDay(0); // 12:00 AM

			const effectRegistry = service.getEffectRegistry(0);

			expect(effectRegistry.effects.light_level).toBe('dark');
		});

		it('should return dim light during twilight (dawn)', async () => {
			await service.initialize(adapter, 0);

			// Set time to just after sunrise (within twilight window)
			driver.setTimeOfDay(365); // 6:05 AM (sunrise at 6:00)

			const effectRegistry = service.getEffectRegistry(0);

			expect(effectRegistry.effects.light_level).toBe('dim');
		});

		it('should return dim light during twilight (dusk)', async () => {
			await service.initialize(adapter, 0);

			// Set time to just after sunset (within twilight window)
			driver.setTimeOfDay(1085); // 6:05 PM (sunset at 6:00)

			const effectRegistry = service.getEffectRegistry(0);

			expect(effectRegistry.effects.light_level).toBe('dim');
		});
	});

	describe('Solar Baseline + Event Effects', () => {
		it('should darken bright day with fog event', async () => {
			// Add fog event
			const fogEvent: IntervalEvent = {
				id: 'fog',
				name: 'Morning Fog',
				type: 'interval',
				priority: 5,
				interval: 1, // Every day
				effects: {
					light_level: 'dim'
				}
			};

			adapter.addEvent(fogEvent);
			await service.initialize(adapter, 0);

			// Set time to noon (would normally be bright)
			driver.setTimeOfDay(720);

			const effectRegistry = service.getEffectRegistry(0);

			// Fog makes it dim even during bright day
			expect(effectRegistry.effects.light_level).toBe('dim');
		});

		it('should not brighten dark night with magical light event', async () => {
			// Add magical light event
			const lightEvent: FixedDateEvent = {
				id: 'magical-light',
				name: 'Magical Lights',
				type: 'fixed',
				priority: 5,
				date: { month: 0, day: 1 },
				effects: {
					light_level: 'bright'
				}
			};

			adapter.addEvent(lightEvent);
			await service.initialize(adapter, 0);

			// Set time to midnight (dark night)
			driver.setTimeOfDay(0);

			const effectRegistry = service.getEffectRegistry(0);

			// Solar baseline is darker (dark), so it wins over bright event
			expect(effectRegistry.effects.light_level).toBe('dark');
		});

		it('should handle eclipse during daytime', async () => {
			// Add solar eclipse event
			const eclipseEvent: FixedDateEvent = {
				id: 'solar-eclipse',
				name: 'Solar Eclipse',
				type: 'fixed',
				priority: 10,
				date: { month: 0, day: 15 },
				effects: {
					light_level: 'dark'
				}
			};

			adapter.addEvent(eclipseEvent);
			await service.initialize(adapter, 0);

			// Set time to noon on day 15
			driver.setTimeOfDay(720);

			// Day 15 = Month 0, Day 15
			const effectRegistry = service.getEffectRegistry(14); // 0-indexed

			// Eclipse makes bright day dark
			expect(effectRegistry.effects.light_level).toBe('dark');
		});

		it('should handle multiple overlapping light effects', async () => {
			// Add multiple weather events
			const overcastEvent: IntervalEvent = {
				id: 'overcast',
				name: 'Overcast Sky',
				type: 'interval',
				priority: 5,
				interval: 2, // Every other day
				effects: {
					light_level: 'dim'
				}
			};

			const stormEvent: IntervalEvent = {
				id: 'storm',
				name: 'Thunderstorm',
				type: 'interval',
				priority: 7,
				interval: 5, // Every 5 days
				effects: {
					light_level: 'dark'
				}
			};

			adapter.addEvent(overcastEvent);
			adapter.addEvent(stormEvent);
			await service.initialize(adapter, 0);

			// Set time to noon
			driver.setTimeOfDay(720);

			// Day 0 matches both interval events (0 % 2 === 0 and 0 % 5 === 0)
			const effectRegistry = service.getEffectRegistry(0);

			// Storm (dark) is darkest, should win
			expect(effectRegistry.effects.light_level).toBe('dark');
		});

		it('should handle fog during twilight', async () => {
			// Add fog event
			const fogEvent: IntervalEvent = {
				id: 'fog',
				name: 'Dense Fog',
				type: 'interval',
				priority: 5,
				interval: 1,
				effects: {
					light_level: 'dim'
				}
			};

			adapter.addEvent(fogEvent);
			await service.initialize(adapter, 0);

			// Set time to dusk (dim twilight)
			driver.setTimeOfDay(1085);

			const effectRegistry = service.getEffectRegistry(0);

			// Both solar and event are dim, result is dim
			expect(effectRegistry.effects.light_level).toBe('dim');
		});
	});

	describe('Light Level Throughout Day', () => {
		it('should transition from dark to dim to bright to dim to dark', async () => {
			await service.initialize(adapter, 0);

			// Sunrise at 360 (6:00 AM), sunset at 1080 (6:00 PM)
			// Twilight window is 30 minutes before/after: [sunrise-30, sunrise+30) and [sunset-30, sunset+30)
			// Dawn: [330, 390), Day: [390, 1050), Dusk: [1050, 1110), Night: [1110, 330)
			const times = [
				{ time: 0, expected: 'dark' as const, label: 'Midnight' },
				{ time: 330, expected: 'dim' as const, label: 'Dawn Start (5:30 AM)' }, // Dawn starts at sunrise-30
				{ time: 360, expected: 'dim' as const, label: 'Sunrise (6:00 AM)' }, // Still in dawn period
				{ time: 390, expected: 'bright' as const, label: 'Morning (6:30 AM)' }, // Day starts after dawn ends
				{ time: 720, expected: 'bright' as const, label: 'Noon' },
				{ time: 1050, expected: 'dim' as const, label: 'Dusk Start (5:30 PM)' }, // Dusk starts at sunset-30
				{ time: 1080, expected: 'dim' as const, label: 'Sunset (6:00 PM)' }, // Still in dusk period
				{ time: 1109, expected: 'dim' as const, label: 'Dusk End-1 (6:29 PM)' }, // Last minute of dusk
				{ time: 1110, expected: 'dark' as const, label: 'Night Start (6:30 PM)' }, // Night starts after dusk ends
				{ time: 1320, expected: 'dark' as const, label: 'Night (10:00 PM)' }
			];

			for (const { time, expected, label } of times) {
				driver.setTimeOfDay(time);
				const effectRegistry = service.getEffectRegistry(0);
				expect(effectRegistry.effects.light_level, `${label} (${time} min)`).toBe(expected);
			}
		});

		it('should show effect priority over solar baseline', async () => {
			// Add all-day fog
			const fogEvent: IntervalEvent = {
				id: 'all-day-fog',
				name: 'All Day Fog',
				type: 'interval',
				priority: 5,
				interval: 1,
				effects: {
					light_level: 'dim'
				}
			};

			adapter.addEvent(fogEvent);
			await service.initialize(adapter, 0);

			const times = [
				{ time: 0, expected: 'dark' as const }, // Night is darker than fog
				{ time: 720, expected: 'dim' as const }, // Fog dims the day
				{ time: 1320, expected: 'dark' as const } // Night is darker than fog
			];

			for (const { time, expected } of times) {
				driver.setTimeOfDay(time);
				const effectRegistry = service.getEffectRegistry(0);
				expect(effectRegistry.effects.light_level, `Time: ${time}`).toBe(expected);
			}
		});
	});
});
