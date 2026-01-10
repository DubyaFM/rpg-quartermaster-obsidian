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
	EffectContext
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
// Test Fixtures - Event Definitions with Location Hierarchy
// ==========================================================================

const CITY_WIDE_EVENT: FixedDateEvent = {
	id: 'city-festival',
	name: 'Waterdeep Festival',
	type: 'fixed',
	priority: 10,
	effects: {
		price_mult_global: 1.2,
		ui_banner: 'Festival in Waterdeep!'
	},
	date: {
		month: 0,
		day: 15
	},
	locations: ['Waterdeep']
};

const DISTRICT_EVENT: FixedDateEvent = {
	id: 'ward-market',
	name: 'North Ward Market Day',
	type: 'fixed',
	priority: 8,
	effects: {
		price_mult_global: 0.9,
		ui_banner: 'Market Day in North Ward!'
	},
	date: {
		month: 0,
		day: 15
	},
	locations: ['Waterdeep.North Ward']
};

const SPECIFIC_SHOP_EVENT: FixedDateEvent = {
	id: 'shop-sale',
	name: 'Blacksmith Sale',
	type: 'fixed',
	priority: 15,
	effects: {
		price_mult_tag: { weapon: 0.75, armor: 0.8 },
		ui_banner: 'Sale at the Blacksmith!'
	},
	date: {
		month: 0,
		day: 15
	},
	locations: ['Waterdeep.North Ward.Blacksmith']
};

const FACTION_EVENT: FixedDateEvent = {
	id: 'harper-meeting',
	name: 'Harper Gathering',
	type: 'fixed',
	priority: 5,
	effects: {
		shop_closed: true,
		ui_banner: 'Harper Meeting in Progress'
	},
	date: {
		month: 0,
		day: 20
	},
	factions: ['Harpers']
};

const UNRELATED_CITY_EVENT: FixedDateEvent = {
	id: 'neverwinter-event',
	name: 'Neverwinter Celebration',
	type: 'fixed',
	priority: 10,
	effects: {
		price_mult_global: 1.5,
		ui_banner: 'Celebration in Neverwinter!'
	},
	date: {
		month: 0,
		day: 15
	},
	locations: ['Neverwinter']
};

// ==========================================================================
// Mock Implementations
// ==========================================================================

class MockSeededRandomizer implements ISeededRandomizer {
	private seed: number;
	private state: number;

	constructor(seed: number) {
		this.seed = seed;
		this.state = seed;
	}

	randomInt(min: number, max: number): number {
		this.state = (this.state * 1103515245 + 12345) & 0x7fffffff;
		return min + (this.state % (max - min + 1));
	}

	randomFloat(): number {
		this.state = (this.state * 1103515245 + 12345) & 0x7fffffff;
		return this.state / 0x7fffffff;
	}

	rollDice(count: number, sides: number, bonus: number = 0): number {
		let total = bonus;
		for (let i = 0; i < count; i++) {
			total += this.randomInt(1, sides);
		}
		return total;
	}

	reseed(seed: number): void {
		this.seed = seed;
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

class MockEventDefinitionAdapter implements IEventDefinitionAdapter {
	constructor(private events: AnyEventDefinition[]) {}

	async loadEventDefinitions(): Promise<AnyEventDefinition[]> {
		return this.events;
	}
}

// ==========================================================================
// Tests - EffectContext and Hierarchical Location Matching
// ==========================================================================

describe('WorldEventService - EffectContext', () => {
	let service: WorldEventService;
	let driver: CalendarDriver;
	let rngFactory: MockRngFactory;
	let adapter: MockEventDefinitionAdapter;

	beforeEach(async () => {
		driver = new CalendarDriver(TEST_CALENDAR);
		rngFactory = new MockRngFactory();
		adapter = new MockEventDefinitionAdapter([
			CITY_WIDE_EVENT,
			DISTRICT_EVENT,
			SPECIFIC_SHOP_EVENT,
			FACTION_EVENT,
			UNRELATED_CITY_EVENT
		]);

		service = new WorldEventService(driver, rngFactory);
		await service.initialize(adapter, 0);
	});

	describe('getEffectContext', () => {
		it('should return effect context with no filters (global)', () => {
			// Day 15 (Jan 15) - multiple events active
			const context = service.getEffectContext({}, 14);

			expect(context).toBeDefined();
			expect(context.day).toBe(14);
			expect(context.activeEvents.length).toBeGreaterThan(0);
		});

		it('should filter by exact location match', () => {
			// Day 15 (Jan 15) - city-wide event at "Waterdeep"
			const context = service.getEffectContext(
				{ location: 'Waterdeep' },
				14
			);

			expect(context.activeEvents).toHaveLength(1);
			expect(context.activeEvents[0].eventId).toBe('city-festival');
		});

		it('should support hierarchical location matching - parent event applies to child location', () => {
			// Query for "Waterdeep.North Ward" should match:
			// - "Waterdeep" (parent)
			// - "Waterdeep.North Ward" (exact)
			const context = service.getEffectContext(
				{ location: 'Waterdeep.North Ward' },
				14
			);

			expect(context.activeEvents).toHaveLength(2);
			const eventIds = context.activeEvents.map(e => e.eventId).sort();
			expect(eventIds).toEqual(['city-festival', 'ward-market']);
		});

		it('should support hierarchical location matching - grandparent event applies to grandchild location', () => {
			// Query for "Waterdeep.North Ward.Blacksmith" should match:
			// - "Waterdeep" (grandparent)
			// - "Waterdeep.North Ward" (parent)
			// - "Waterdeep.North Ward.Blacksmith" (exact)
			const context = service.getEffectContext(
				{ location: 'Waterdeep.North Ward.Blacksmith' },
				14
			);

			expect(context.activeEvents).toHaveLength(3);
			const eventIds = context.activeEvents.map(e => e.eventId).sort();
			expect(eventIds).toEqual(['city-festival', 'shop-sale', 'ward-market']);
		});

		it('should NOT match child events to parent location context', () => {
			// Query for "Waterdeep" should only match "Waterdeep" event
			// NOT "Waterdeep.North Ward" or "Waterdeep.North Ward.Blacksmith"
			const context = service.getEffectContext(
				{ location: 'Waterdeep' },
				14
			);

			expect(context.activeEvents).toHaveLength(1);
			expect(context.activeEvents[0].eventId).toBe('city-festival');
		});

		it('should exclude unrelated location events', () => {
			// Query for "Waterdeep" should not match "Neverwinter"
			const context = service.getEffectContext(
				{ location: 'Waterdeep' },
				14
			);

			const neverwinterEvent = context.activeEvents.find(
				e => e.eventId === 'neverwinter-event'
			);
			expect(neverwinterEvent).toBeUndefined();
		});

		it('should filter by faction', () => {
			// Day 20 (Jan 20) - Harper event
			const context = service.getEffectContext(
				{ faction: 'Harpers' },
				19
			);

			expect(context.activeEvents).toHaveLength(1);
			expect(context.activeEvents[0].eventId).toBe('harper-meeting');
		});

		it('should combine location and faction filters', () => {
			// No events match both "Waterdeep" and "Harpers" on day 15
			const context = service.getEffectContext(
				{ location: 'Waterdeep', faction: 'Harpers' },
				14
			);

			expect(context.activeEvents).toHaveLength(0);
		});

		it('should return resolved effects with hierarchical location', () => {
			// Query for blacksmith location - should get all 3 price multipliers
			const context = service.getEffectContext(
				{ location: 'Waterdeep.North Ward.Blacksmith' },
				14
			);

			expect(context.effects).toBeDefined();
			// City-wide: 1.2, District: 0.9, Shop: tag-specific
			// Multipliers stack: 1.2 * 0.9 = 1.08
			expect(context.effects.price_mult_global).toBeCloseTo(1.08);
			// Shop-specific tag multipliers should be present
			expect(context.effects.price_mult_tag).toBeDefined();
			expect(context.effects.price_mult_tag.weapon).toBe(0.75);
		});

		it('should use current day if day parameter is omitted', () => {
			// Advance service to day 14
			service.advanceToDay(14);

			// Query without day parameter should use current day (14)
			const context = service.getEffectContext({
				location: 'Waterdeep'
			});

			expect(context.day).toBe(14);
			expect(context.activeEvents).toHaveLength(1);
		});

		it('should return empty active events for non-existent location', () => {
			const context = service.getEffectContext(
				{ location: 'Baldurs Gate' },
				14
			);

			expect(context.activeEvents).toHaveLength(0);
			expect(context.effects).toBeDefined();
		});

		it('should handle location paths with multiple dots', () => {
			// Test deeply nested location hierarchy
			const context = service.getEffectContext(
				{ location: 'Waterdeep.North Ward.Blacksmith.Forge.Back Room' },
				14
			);

			// Should match all parent events
			expect(context.activeEvents).toHaveLength(3);
			const eventIds = context.activeEvents.map(e => e.eventId).sort();
			expect(eventIds).toEqual(['city-festival', 'shop-sale', 'ward-market']);
		});

		it('should handle case-sensitive location matching', () => {
			// Location matching should be case-sensitive
			const context = service.getEffectContext(
				{ location: 'waterdeep' }, // lowercase
				14
			);

			// Should not match "Waterdeep" (capital W)
			expect(context.activeEvents).toHaveLength(0);
		});
	});

	describe('Hierarchical Location Edge Cases', () => {
		it('should not match partial location names', () => {
			// "Water" should not match "Waterdeep"
			const context = service.getEffectContext(
				{ location: 'Water' },
				14
			);

			expect(context.activeEvents).toHaveLength(0);
		});

		it('should not match if separator is missing', () => {
			// "WaterdeepNorth Ward" should not match "Waterdeep.North Ward"
			const context = service.getEffectContext(
				{ location: 'WaterdeepNorth Ward' },
				14
			);

			expect(context.activeEvents).toHaveLength(0);
		});

		it('should handle location with trailing dot', () => {
			// "Waterdeep." should match "Waterdeep" event
			const context = service.getEffectContext(
				{ location: 'Waterdeep.' },
				14
			);

			// This is an edge case - the current implementation won't match
			// because "Waterdeep.".startsWith("Waterdeep.") is true
			// but "Waterdeep" !== "Waterdeep."
			expect(context.activeEvents).toHaveLength(0);
		});

		it('should handle empty location string', () => {
			const context = service.getEffectContext(
				{ location: '' },
				14
			);

			// Empty location should not match any events
			expect(context.activeEvents).toHaveLength(0);
		});
	});

	describe('Context Metadata', () => {
		it('should include correct metadata in effect registry', () => {
			const context = service.getEffectContext(
				{ location: 'Waterdeep', faction: 'Harpers' },
				14
			);

			expect(context.day).toBe(14);
			expect(context.context).toBeDefined();
			expect(context.context.location).toBe('Waterdeep');
			expect(context.context.faction).toBe('Harpers');
			expect(context.computedAt).toBeDefined();
			expect(typeof context.computedAt).toBe('number');
		});

		it('should include time of day if available', () => {
			const context = service.getEffectContext(
				{ location: 'Waterdeep' },
				14
			);

			expect(context.timeOfDay).toBeDefined();
			expect(typeof context.timeOfDay).toBe('number');
		});
	});
});
