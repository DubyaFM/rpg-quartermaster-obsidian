import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorldEventService, WorldEventServiceConfig } from '../services/WorldEventService';
import { CalendarDriver } from '../services/CalendarDriver';
import { IRngFactory } from '../interfaces/IRngFactory';
import { ISeededRandomizer } from '../interfaces/ISeededRandomizer';
import { IEventDefinitionAdapter } from '../interfaces/IEventDefinitionAdapter';
import {
	CalendarDefinition,
	AnyEventDefinition,
	ChainEvent
} from '../models/types';
import { GMOverride } from '../models/worldStateTypes';

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
		{ name: 'December', days: 32, order: 11 }
	],
	holidays: [],
	startingYear: 1000,
	yearSuffix: 'TE'
};

// ==========================================================================
// Test Fixtures - Event Definitions
// ==========================================================================

const WEATHER_CHAIN: ChainEvent = {
	id: 'weather',
	name: 'Weather System',
	type: 'chain',
	priority: 1,
	effects: {},
	seed: 12345,
	states: [
		{
			name: 'Clear',
			weight: 60,
			duration: '3 days',
			effects: { light_level: 'bright' }
		},
		{
			name: 'Cloudy',
			weight: 25,
			duration: '2 days',
			effects: { light_level: 'dim' }
		},
		{
			name: 'Storm',
			weight: 15,
			duration: '1 day',
			effects: { light_level: 'dark', restock_block: true }
		}
	]
};

const MOON_PHASES: ChainEvent = {
	id: 'moon-phases',
	name: 'Lunar Phases',
	type: 'chain',
	priority: 5,
	effects: {},
	seed: 67890,
	states: [
		{
			name: 'New Moon',
			weight: 25,
			duration: '7 days',
			effects: { light_level: 'dark' }
		},
		{
			name: 'Crescent',
			weight: 25,
			duration: '7 days',
			effects: { light_level: 'dim' }
		},
		{
			name: 'Full Moon',
			weight: 25,
			duration: '7 days',
			effects: { light_level: 'bright', werewolf_active: true }
		},
		{
			name: 'Waning',
			weight: 25,
			duration: '7 days',
			effects: { light_level: 'dim' }
		}
	]
};

// ==========================================================================
// Mock Implementations
// ==========================================================================

class MockSeededRandomizer implements ISeededRandomizer {
	private state: number;

	constructor(seed: number) {
		this.state = seed;
	}

	random(): number {
		// Simple LCG
		this.state = (this.state * 1103515245 + 12345) & 0x7fffffff;
		return this.state / 0x7fffffff;
	}

	randomInt(min: number, max: number): number {
		return Math.floor(this.random() * (max - min + 1)) + min;
	}

	randomFloat(): number {
		return this.random();
	}

	getState(): number {
		return this.state;
	}

	reseed(seed: number): void {
		this.state = seed;
	}

	clone(): ISeededRandomizer {
		const cloned = new MockSeededRandomizer(this.state);
		return cloned;
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

	setEvents(events: AnyEventDefinition[]): void {
		this.events = events;
	}
}

// ==========================================================================
// Tests - GM Override System
// ==========================================================================

describe('WorldEventService - GM Override System', () => {
	let driver: CalendarDriver;
	let rngFactory: IRngFactory;
	let adapter: MockEventAdapter;
	let service: WorldEventService;
	let onEventDefinitionUpdate: ReturnType<typeof vi.fn>;

	beforeEach(async () => {
		driver = new CalendarDriver(TEST_CALENDAR);
		rngFactory = new MockRngFactory();
		adapter = new MockEventAdapter([WEATHER_CHAIN, MOON_PHASES]);

		// Mock callback for permanent updates
		onEventDefinitionUpdate = vi.fn().mockResolvedValue(undefined);

		const config: WorldEventServiceConfig = {
			bufferSize: 10,
			maxSimulationDays: 100,
			onEventDefinitionUpdate
		};

		service = new WorldEventService(driver, rngFactory, config);
		await service.initialize(adapter, 0);
	});

	describe('setEventState - One-off Override', () => {
		it('should create a temporary override that expires', async () => {
			// Force weather to Storm state (one-off)
			const overrideId = await service.setEventState('weather', 'Storm', false, 'Testing storm override');

			expect(overrideId).toBeDefined();
			expect(typeof overrideId).toBe('string');

			// Check that override was created
			const overrides = service.getOverrides();
			expect(overrides).toHaveLength(1);
			expect(overrides[0].eventId).toBe('weather');
			expect(overrides[0].forcedStateName).toBe('Storm');
			expect(overrides[0].scope).toBe('one_off');
			expect(overrides[0].expiresDay).toBeDefined();

			// Check event is in Storm state
			const activeEvents = service.getActiveEvents(0);
			const weatherEvent = activeEvents.find(e => e.eventId === 'weather');
			expect(weatherEvent).toBeDefined();
			expect(weatherEvent!.state).toBe('Storm');
			expect(weatherEvent!.source).toBe('gm_forced');
		});

		it('should expire override on next natural transition', async () => {
			// Force weather to Storm (1 day duration)
			const overrideId = await service.setEventState('weather', 'Storm', false);

			// Get the override to check expiration day
			const override = service.getOverrides()[0];
			const expiresDay = override.expiresDay!;

			// Advance time past expiration
			service.advanceToDay(expiresDay + 1);

			// Check that override was removed
			const overrides = service.getOverrides();
			expect(overrides).toHaveLength(0);
		});

		it('should allow multiple one-off overrides for different events', async () => {
			await service.setEventState('weather', 'Storm', false);
			await service.setEventState('moon-phases', 'Full Moon', false);

			const overrides = service.getOverrides();
			expect(overrides).toHaveLength(2);

			const weatherOverride = overrides.find(o => o.eventId === 'weather');
			const moonOverride = overrides.find(o => o.eventId === 'moon-phases');

			expect(weatherOverride).toBeDefined();
			expect(moonOverride).toBeDefined();
		});

		it('should include GM notes in override', async () => {
			const notes = 'Forcing storm for dramatic effect during battle';
			await service.setEventState('weather', 'Storm', false, notes);

			const overrides = service.getOverrides();
			expect(overrides[0].notes).toBe(notes);
		});

		it('should prevent natural state transitions while override is active', async () => {
			// Force to Storm
			await service.setEventState('weather', 'Storm', false);

			const initialState = service.getActiveEvents(0).find(e => e.eventId === 'weather')!.state;

			// Advance 1 day (still within Storm override)
			service.advanceToDay(1);

			const afterAdvance = service.getActiveEvents(1).find(e => e.eventId === 'weather')!.state;
			expect(afterAdvance).toBe(initialState); // Should still be Storm
		});
	});

	describe('setEventState - Permanent Override', () => {
		it('should update event definition permanently', async () => {
			const result = await service.setEventState('weather', 'Cloudy', true, 'Starting campaign in cloudy weather');

			// No override ID for permanent changes
			expect(result).toBeUndefined();

			// Check that callback was called
			expect(onEventDefinitionUpdate).toHaveBeenCalledOnce();
			expect(onEventDefinitionUpdate).toHaveBeenCalledWith('weather', expect.objectContaining({
				id: 'weather',
				initialState: 'Cloudy'
			}));

			// Check that no override was created
			const overrides = service.getOverrides();
			expect(overrides).toHaveLength(0);

			// Check that event is in Cloudy state
			const activeEvents = service.getActiveEvents(0);
			const weatherEvent = activeEvents.find(e => e.eventId === 'weather');
			expect(weatherEvent!.state).toBe('Cloudy');
			expect(weatherEvent!.source).toBe('definition'); // Not gm_forced
		});

		it('should update in-memory registry', async () => {
			await service.setEventState('weather', 'Storm', true);

			const def = service.getEventDefinition('weather') as ChainEvent;
			expect(def.initialState).toBe('Storm');
		});

		it('should throw error if no update callback configured', async () => {
			// Create service without callback
			const serviceWithoutCallback = new WorldEventService(driver, rngFactory, { bufferSize: 10 });
			await serviceWithoutCallback.initialize(adapter, 0);

			await expect(
				serviceWithoutCallback.setEventState('weather', 'Storm', true)
			).rejects.toThrow('Cannot apply permanent override: no definition update callback configured');
		});
	});

	describe('Override Validation', () => {
		it('should throw error for non-existent event', async () => {
			await expect(
				service.setEventState('fake-event', 'Storm', false)
			).rejects.toThrow("Event 'fake-event' not found");
		});

		it('should throw error for non-chain event', async () => {
			// Add a fixed event
			const fixedEvent = {
				id: 'new-year',
				name: 'New Year',
				type: 'fixed' as const,
				priority: 10,
				effects: {},
				date: { month: 0, day: 1 }
			};

			adapter.setEvents([WEATHER_CHAIN, MOON_PHASES, fixedEvent]);
			await service.reloadEventDefinitions();

			await expect(
				service.setEventState('new-year', 'Active', false)
			).rejects.toThrow("Event 'new-year' is not a chain event");
		});

		it('should throw error for invalid state name', async () => {
			await expect(
				service.setEventState('weather', 'InvalidState', false)
			).rejects.toThrow("State 'InvalidState' not found in event 'weather'");
		});
	});

	describe('Override Management', () => {
		it('should list all active overrides', async () => {
			await service.setEventState('weather', 'Storm', false);
			await service.setEventState('moon-phases', 'Full Moon', false);

			const overrides = service.getOverrides();
			expect(overrides).toHaveLength(2);
		});

		it('should get overrides for specific event', async () => {
			await service.setEventState('weather', 'Storm', false);
			await service.setEventState('moon-phases', 'Full Moon', false);

			const weatherOverrides = service.getEventOverrides('weather');
			expect(weatherOverrides).toHaveLength(1);
			expect(weatherOverrides[0].eventId).toBe('weather');
		});

		it('should remove specific override', async () => {
			const overrideId = await service.setEventState('weather', 'Storm', false);

			const removed = service.removeOverride(overrideId!);
			expect(removed).toBe(true);

			const overrides = service.getOverrides();
			expect(overrides).toHaveLength(0);
		});

		it('should return false when removing non-existent override', () => {
			const removed = service.removeOverride('fake-override-id');
			expect(removed).toBe(false);
		});

		it('should clear all overrides', async () => {
			await service.setEventState('weather', 'Storm', false);
			await service.setEventState('moon-phases', 'Full Moon', false);

			service.clearAllOverrides();

			const overrides = service.getOverrides();
			expect(overrides).toHaveLength(0);
		});

		it('should restore overrides from saved state', async () => {
			const savedOverrides: GMOverride[] = [
				{
					id: 'override-1',
					eventId: 'weather',
					scope: 'one_off',
					forcedStateName: 'Storm',
					forcedDuration: 1,
					appliedDay: 0,
					expiresDay: 1,
					createdAt: new Date().toISOString()
				},
				{
					id: 'override-2',
					eventId: 'moon-phases',
					scope: 'one_off',
					forcedStateName: 'Full Moon',
					forcedDuration: 7,
					appliedDay: 0,
					expiresDay: 7,
					createdAt: new Date().toISOString()
				}
			];

			service.restoreOverrides(savedOverrides);

			const overrides = service.getOverrides();
			expect(overrides).toHaveLength(2);
		});
	});

	describe('Cache Invalidation', () => {
		it('should invalidate cache when override is applied', async () => {
			// Pre-populate cache
			service.getActiveEvents(0);
			service.getActiveEvents(1);
			service.getActiveEvents(2);

			// Apply override
			await service.setEventState('weather', 'Storm', false);

			// Cache should be cleared, so next query recalculates
			const activeEvents = service.getActiveEvents(0);
			const weatherEvent = activeEvents.find(e => e.eventId === 'weather');
			expect(weatherEvent!.state).toBe('Storm');
		});

		it('should invalidate cache when override is removed', async () => {
			const overrideId = await service.setEventState('weather', 'Storm', false);

			// Verify override is active
			let weatherEvent = service.getActiveEvents(0).find(e => e.eventId === 'weather');
			expect(weatherEvent!.state).toBe('Storm');

			// Remove override
			service.removeOverride(overrideId!);

			// Cache should be cleared, weather should return to natural state
			weatherEvent = service.getActiveEvents(0).find(e => e.eventId === 'weather');
			expect(weatherEvent!.source).toBe('definition');
		});
	});

	describe('Effect Registry Integration', () => {
		it('should show override source in effect registry', async () => {
			await service.setEventState('weather', 'Storm', false);

			const registry = service.getEffectRegistry(0);
			const weatherEvent = registry.activeEvents.find(e => e.eventId === 'weather');

			expect(weatherEvent).toBeDefined();
			expect(weatherEvent!.source).toBe('gm_forced');
			expect(weatherEvent!.state).toBe('Storm');
		});

		it('should apply overridden event effects to registry', async () => {
			await service.setEventState('weather', 'Storm', false);

			const registry = service.getEffectRegistry(0);

			// Storm state has restock_block effect
			expect(registry.effects.restock_block).toBe(true);
		});
	});

	describe('Time Progression with Overrides', () => {
		it('should clean expired overrides during time advance', async () => {
			// Create short-duration override
			await service.setEventState('weather', 'Storm', false); // 1 day duration

			const override = service.getOverrides()[0];
			const expiresDay = override.expiresDay!;

			// Advance past expiration
			service.advanceToDay(expiresDay + 1);

			// Override should be cleaned up
			const overrides = service.getOverrides();
			expect(overrides).toHaveLength(0);
		});

		it('should resume natural transitions after override expires', async () => {
			// Force to Storm (1 day)
			await service.setEventState('weather', 'Storm', false);

			const override = service.getOverrides()[0];
			const expiresDay = override.expiresDay!;

			// Advance to expiration
			service.advanceToDay(expiresDay);

			// Should still be in Storm on expiration day
			let weatherEvent = service.getActiveEvents(expiresDay).find(e => e.eventId === 'weather');
			expect(weatherEvent!.state).toBe('Storm');

			// Advance past expiration
			service.advanceToDay(expiresDay + 1);

			// Should transition to natural state
			weatherEvent = service.getActiveEvents(expiresDay + 1).find(e => e.eventId === 'weather');
			expect(weatherEvent!.source).toBe('definition'); // Back to natural
		});
	});
});
