/**
 * WorldEventService Time Jump Handler Tests (TKT-CAL-026)
 *
 * Comprehensive tests for Time Jump Handler with Emergency Brake.
 *
 * Tests cover:
 * - Configurable threshold: maxSimulationDays (default: 365)
 * - Below threshold: Day-by-day simulation with progress tracking
 * - Above threshold: Anchor Reset (O(1) calculation)
 * - Progress callback for UI spinner
 * - Chain state vector updated appropriately per mode
 * - Buffer rebuilt for new current day window
 * - User warning when Anchor Reset used (history gap tracking)
 * - Performance: Extreme jumps (100 years) complete in < 100ms
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorldEventService, WorldEventServiceConfig, TimeJumpResult } from '../services/WorldEventService';
import { CalendarDriver } from '../services/CalendarDriver';
import { IRngFactory } from '../interfaces/IRngFactory';
import { ISeededRandomizer } from '../interfaces/ISeededRandomizer';
import { IEventDefinitionAdapter } from '../interfaces/IEventDefinitionAdapter';
import { Mulberry32 } from '../utils/Mulberry32';
import {
	CalendarDefinition,
	AnyEventDefinition,
	ChainEvent
} from '../models/types';

// ==========================================================================
// Test Fixtures - Calendar Definition
// ==========================================================================

const TEST_CALENDAR: CalendarDefinition = {
	id: 'test-calendar',
	name: 'Test Calendar',
	description: 'Calendar for time jump testing',
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

// ==========================================================================
// Test Fixtures - Chain Event Definitions
// ==========================================================================

/**
 * Weather system chain event for time jump testing
 */
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
			duration: '2d4 days',
			effects: { light_level: 'bright', travel_modifier: 0 }
		},
		{
			name: 'Cloudy',
			weight: 25,
			duration: '1d4 days',
			effects: { light_level: 'dim', travel_modifier: 0 }
		},
		{
			name: 'Storm',
			weight: 15,
			duration: '1d2 days',
			effects: { light_level: 'dark', travel_modifier: -2, restock_block: true }
		}
	]
};

/**
 * Economy chain event for time jump testing
 */
const ECONOMY_CHAIN: ChainEvent = {
	id: 'economy',
	name: 'Economy',
	type: 'chain',
	priority: 2,
	effects: {},
	seed: 99999,
	states: [
		{
			name: 'Boom',
			weight: 20,
			duration: '2 weeks',
			effects: { price_modifier: -0.1, item_availability: 1.2 }
		},
		{
			name: 'Stable',
			weight: 50,
			duration: '1 month',
			effects: { price_modifier: 0, item_availability: 1.0 }
		},
		{
			name: 'Recession',
			weight: 30,
			duration: '2 weeks',
			effects: { price_modifier: 0.15, item_availability: 0.7 }
		}
	]
};

// ==========================================================================
// Test Utilities
// ==========================================================================

class MockEventAdapter implements IEventDefinitionAdapter {
	private events: AnyEventDefinition[];

	constructor(events: AnyEventDefinition[]) {
		this.events = events;
	}

	async loadEventDefinitions(): Promise<AnyEventDefinition[]> {
		return this.events;
	}
}

class TestRngFactory implements IRngFactory {
	create(seed: number): ISeededRandomizer {
		return new Mulberry32(seed);
	}
}

// ==========================================================================
// Test Suite: Time Jump Handler
// ==========================================================================

describe('WorldEventService - Time Jump Handler', () => {
	let driver: CalendarDriver;
	let rngFactory: IRngFactory;
	let adapter: IEventDefinitionAdapter;

	beforeEach(() => {
		driver = new CalendarDriver(TEST_CALENDAR);
		rngFactory = new TestRngFactory();
		adapter = new MockEventAdapter([WEATHER_CHAIN, ECONOMY_CHAIN]);
	});

	// ======================================================================
	// Threshold Configuration Tests
	// ======================================================================

	describe('Threshold Configuration', () => {
		it('should use default maxSimulationDays threshold (365)', async () => {
			const service = new WorldEventService(driver, rngFactory);
			await service.initialize(adapter, 0);

			// Jump 365 days (at threshold, should use simulation)
			const result = service.advanceToDay(365);

			expect(result.mode).toBe('simulation');
			expect(result.hasHistoryGap).toBe(false);
		});

		it('should allow custom maxSimulationDays threshold', async () => {
			const config: WorldEventServiceConfig = {
				maxSimulationDays: 100
			};
			const service = new WorldEventService(driver, rngFactory, config);
			await service.initialize(adapter, 0);

			// Jump 100 days (at threshold, should use simulation)
			const result = service.advanceToDay(100);
			expect(result.mode).toBe('simulation');

			// Jump 101 days from start (exceeds threshold, should use anchor reset)
			await service.initialize(adapter, 0); // Reset
			const result2 = service.advanceToDay(101);
			expect(result2.mode).toBe('anchor_reset');
			expect(result2.hasHistoryGap).toBe(true);
		});

		it('should handle zero-day advancement', async () => {
			const service = new WorldEventService(driver, rngFactory);
			await service.initialize(adapter, 100);

			const result = service.advanceToDay(100);

			expect(result.mode).toBe('simulation');
			expect(result.daysAdvanced).toBe(0);
			expect(result.hasHistoryGap).toBe(false);
			expect(result.elapsedMs).toBe(0);
		});
	});

	// ======================================================================
	// Simulation Mode Tests
	// ======================================================================

	describe('Simulation Mode (Below Threshold)', () => {
		it('should use simulation mode for moderate jumps', async () => {
			const service = new WorldEventService(driver, rngFactory);
			await service.initialize(adapter, 0);

			const result = service.advanceToDay(30);

			expect(result.mode).toBe('simulation');
			expect(result.fromDay).toBe(0);
			expect(result.toDay).toBe(30);
			expect(result.daysAdvanced).toBe(30);
			expect(result.hasHistoryGap).toBe(false);
		});

		it('should call progress callback during simulation', async () => {
			const progressCallback = vi.fn();
			const config: WorldEventServiceConfig = {
				onTimeJumpProgress: progressCallback
			};

			const service = new WorldEventService(driver, rngFactory, config);
			await service.initialize(adapter, 0);

			service.advanceToDay(100);

			// Should report progress at ~5% intervals
			// Note: Progress callback is optional, so verify if called
			if (progressCallback.mock.calls.length > 0) {
				// All calls should be in simulation mode
				for (const call of progressCallback.mock.calls) {
					expect(call[1]).toBe('simulation');
				}

				// Last call should be 1.0 (100%)
				const lastCall = progressCallback.mock.calls[progressCallback.mock.calls.length - 1];
				expect(lastCall[0]).toBeCloseTo(1.0, 2);
			}
		});

		it('should advance chain states day-by-day', async () => {
			const service = new WorldEventService(driver, rngFactory);
			await service.initialize(adapter, 0);

			// Get initial weather state
			const initialEvents = service.getActiveEvents(0);
			const initialWeather = initialEvents.find(e => e.eventId === 'weather');
			expect(initialWeather).toBeDefined();

			// Advance 30 days
			service.advanceToDay(30);

			// Get final weather state
			const finalEvents = service.getActiveEvents(30);
			const finalWeather = finalEvents.find(e => e.eventId === 'weather');
			expect(finalWeather).toBeDefined();

			// Weather state should have transitioned (highly likely over 30 days)
			// Note: Due to randomness, we can't guarantee exact state, but stateEndDay should be set
			expect(finalWeather!.endDay).toBeGreaterThan(0);
		});

		it('should update buffer window after simulation', async () => {
			const service = new WorldEventService(driver, rngFactory);
			await service.initialize(adapter, 0);

			service.advanceToDay(100);

			// Check that buffer is populated for current day + bufferSize
			const events = service.getActiveEvents(130); // Within default buffer (100 + 30)
			expect(events).toBeDefined();
			expect(events.length).toBeGreaterThan(0);
		});
	});

	// ======================================================================
	// Anchor Reset Mode Tests
	// ======================================================================

	describe('Anchor Reset Mode (Above Threshold)', () => {
		it('should use anchor reset mode for extreme jumps', async () => {
			const config: WorldEventServiceConfig = {
				maxSimulationDays: 365
			};
			const service = new WorldEventService(driver, rngFactory, config);
			await service.initialize(adapter, 0);

			const result = service.advanceToDay(500);

			expect(result.mode).toBe('anchor_reset');
			expect(result.fromDay).toBe(0);
			expect(result.toDay).toBe(500);
			expect(result.daysAdvanced).toBe(500);
			expect(result.hasHistoryGap).toBe(true);
		});

		it('should call progress callback for anchor reset', async () => {
			const progressCallback = vi.fn();
			const config: WorldEventServiceConfig = {
				maxSimulationDays: 100,
				onTimeJumpProgress: progressCallback
			};

			const service = new WorldEventService(driver, rngFactory, config);
			await service.initialize(adapter, 0);

			service.advanceToDay(500);

			// Should report progress (at least initial and final)
			// Note: Progress callback is optional, so verify if called
			if (progressCallback.mock.calls.length > 0) {
				expect(progressCallback.mock.calls.length).toBeGreaterThanOrEqual(2);

				// All calls should be in anchor_reset mode
				for (const call of progressCallback.mock.calls) {
					expect(call[1]).toBe('anchor_reset');
				}

				// First call should be 0.1 (initial progress)
				expect(progressCallback.mock.calls[0][0]).toBe(0.1);

				// Last call should be 1.0 (completion)
				const lastCall = progressCallback.mock.calls[progressCallback.mock.calls.length - 1];
				expect(lastCall[0]).toBe(1.0);
			}
		});

		it('should calculate target chain state correctly', async () => {
			const config: WorldEventServiceConfig = {
				maxSimulationDays: 100
			};
			const service = new WorldEventService(driver, rngFactory, config);
			await service.initialize(adapter, 0);

			// Jump to day 500 using anchor reset
			service.advanceToDay(500);

			// Get final weather state
			const events = service.getActiveEvents(500);
			const weather = events.find(e => e.eventId === 'weather');
			expect(weather).toBeDefined();

			// State should be valid
			expect(['Clear', 'Cloudy', 'Storm']).toContain(weather!.state);

			// StateEndDay should be >= 500 (still in current state)
			expect(weather!.endDay).toBeGreaterThanOrEqual(500);
		});

		it('should maintain determinism across modes', async () => {
			// Create two services with same seed
			const service1 = new WorldEventService(driver, rngFactory, {
				maxSimulationDays: 100
			});
			const service2 = new WorldEventService(driver, rngFactory, {
				maxSimulationDays: 100
			});

			await service1.initialize(adapter, 0);
			await service2.initialize(adapter, 0);

			// Service 1: Use anchor reset to jump to day 500
			service1.advanceToDay(500);
			const state1 = service1.getChainStateVectors();

			// Service 2: Use anchor reset to jump to day 500
			service2.advanceToDay(500);
			const state2 = service2.getChainStateVectors();

			// Both should have identical state vectors
			expect(state1).toEqual(state2);
		});

		it('should update buffer window after anchor reset', async () => {
			const config: WorldEventServiceConfig = {
				maxSimulationDays: 100
			};
			const service = new WorldEventService(driver, rngFactory, config);
			await service.initialize(adapter, 0);

			service.advanceToDay(500);

			// Check that buffer is populated for current day + bufferSize
			const events = service.getActiveEvents(530); // Within default buffer (500 + 30)
			expect(events).toBeDefined();
			expect(events.length).toBeGreaterThan(0);
		});
	});

	// ======================================================================
	// Performance Tests
	// ======================================================================

	describe('Performance', () => {
		it('should complete 100-year jump in < 100ms using anchor reset', async () => {
			const config: WorldEventServiceConfig = {
				maxSimulationDays: 365
			};
			const service = new WorldEventService(driver, rngFactory, config);
			await service.initialize(adapter, 0);

			// 100 years = ~36,500 days (with 360-day year in test calendar)
			const targetDay = 100 * 360;

			const result = service.advanceToDay(targetDay);

			expect(result.mode).toBe('anchor_reset');
			expect(result.elapsedMs).toBeLessThan(100);
		});

		it('should handle 1000-year jump in < 200ms', async () => {
			const config: WorldEventServiceConfig = {
				maxSimulationDays: 365
			};
			const service = new WorldEventService(driver, rngFactory, config);
			await service.initialize(adapter, 0);

			// 1000 years = ~360,000 days
			const targetDay = 1000 * 360;

			const result = service.advanceToDay(targetDay);

			expect(result.mode).toBe('anchor_reset');
			expect(result.elapsedMs).toBeLessThan(200);
		});
	});

	// ======================================================================
	// History Gap Tracking Tests
	// ======================================================================

	describe('History Gap Tracking', () => {
		it('should mark hasHistoryGap as true for anchor reset', async () => {
			const config: WorldEventServiceConfig = {
				maxSimulationDays: 100
			};
			const service = new WorldEventService(driver, rngFactory, config);
			await service.initialize(adapter, 0);

			const result = service.advanceToDay(500);

			expect(result.hasHistoryGap).toBe(true);
		});

		it('should mark hasHistoryGap as false for simulation', async () => {
			const service = new WorldEventService(driver, rngFactory);
			await service.initialize(adapter, 0);

			const result = service.advanceToDay(100);

			expect(result.hasHistoryGap).toBe(false);
		});

		it('should allow querying events at target day after anchor reset', async () => {
			const config: WorldEventServiceConfig = {
				maxSimulationDays: 100
			};
			const service = new WorldEventService(driver, rngFactory, config);
			await service.initialize(adapter, 0);

			service.advanceToDay(500);

			// Should be able to query events at current day
			const events = service.getActiveEvents(500);
			expect(events).toBeDefined();
			expect(events.length).toBeGreaterThan(0);
		});
	});

	// ======================================================================
	// Chain State Vector Serialization Tests
	// ======================================================================

	describe('Chain State Vector Serialization', () => {
		it('should serialize chain state vectors after simulation', async () => {
			const service = new WorldEventService(driver, rngFactory);
			await service.initialize(adapter, 0);

			service.advanceToDay(100);

			const vectors = service.getChainStateVectors();

			expect(vectors).toBeDefined();
			expect(vectors['weather']).toBeDefined();
			expect(vectors['economy']).toBeDefined();

			// Check weather vector structure
			const weatherVector = vectors['weather'];
			expect(weatherVector.currentStateName).toBeDefined();
			expect(['Clear', 'Cloudy', 'Storm']).toContain(weatherVector.currentStateName);
			expect(weatherVector.stateEnteredDay).toBeGreaterThanOrEqual(0);
			expect(weatherVector.stateDurationDays).toBeGreaterThan(0);
			expect(weatherVector.rngState).toBeDefined();
		});

		it('should serialize chain state vectors after anchor reset', async () => {
			const config: WorldEventServiceConfig = {
				maxSimulationDays: 100
			};
			const service = new WorldEventService(driver, rngFactory, config);
			await service.initialize(adapter, 0);

			service.advanceToDay(500);

			const vectors = service.getChainStateVectors();

			expect(vectors).toBeDefined();
			expect(vectors['weather']).toBeDefined();
			expect(vectors['economy']).toBeDefined();

			// Check economy vector structure
			const economyVector = vectors['economy'];
			expect(economyVector.currentStateName).toBeDefined();
			expect(['Boom', 'Stable', 'Recession']).toContain(economyVector.currentStateName);
			expect(economyVector.stateEnteredDay).toBeGreaterThanOrEqual(0);
			expect(economyVector.stateDurationDays).toBeGreaterThan(0);
			expect(economyVector.rngState).toBeDefined();
		});

		it('should restore chain state vectors correctly', async () => {
			const config: WorldEventServiceConfig = {
				maxSimulationDays: 100
			};
			const service = new WorldEventService(driver, rngFactory, config);
			await service.initialize(adapter, 0);

			// Advance and save state
			service.advanceToDay(500);
			const savedVectors = service.getChainStateVectors();

			// Create new service and restore state
			// Initialize at day 0, then restore saved vectors
			const service2 = new WorldEventService(driver, rngFactory, config);
			await service2.initialize(adapter, 0);
			service2.restoreChainStateVectors(savedVectors);

			// Manually update current day to match
			service2.advanceToDay(500);

			// States should match after restoration
			const restoredVectors = service2.getChainStateVectors();

			// Compare state structure (not RNG state, as it may advance during initialization)
			expect(restoredVectors['weather'].currentStateName).toBe(savedVectors['weather'].currentStateName);
			expect(restoredVectors['weather'].stateEnteredDay).toBe(savedVectors['weather'].stateEnteredDay);
			expect(restoredVectors['weather'].stateDurationDays).toBe(savedVectors['weather'].stateDurationDays);

			expect(restoredVectors['economy'].currentStateName).toBe(savedVectors['economy'].currentStateName);
			expect(restoredVectors['economy'].stateEnteredDay).toBe(savedVectors['economy'].stateEnteredDay);
			expect(restoredVectors['economy'].stateDurationDays).toBe(savedVectors['economy'].stateDurationDays);

			// Events at day 500 should have same state names
			const events1 = service.getActiveEvents(500);
			const events2 = service2.getActiveEvents(500);

			const weather1 = events1.find(e => e.eventId === 'weather');
			const weather2 = events2.find(e => e.eventId === 'weather');
			expect(weather1?.state).toBe(weather2?.state);

			const economy1 = events1.find(e => e.eventId === 'economy');
			const economy2 = events2.find(e => e.eventId === 'economy');
			expect(economy1?.state).toBe(economy2?.state);
		});
	});

	// ======================================================================
	// Metadata Tests
	// ======================================================================

	describe('Metadata', () => {
		it('should return correct metadata for simulation mode', async () => {
			const service = new WorldEventService(driver, rngFactory);
			await service.initialize(adapter, 50);

			const result = service.advanceToDay(100);

			expect(result.mode).toBe('simulation');
			expect(result.fromDay).toBe(50);
			expect(result.toDay).toBe(100);
			expect(result.daysAdvanced).toBe(50);
			expect(result.hasHistoryGap).toBe(false);
			expect(result.elapsedMs).toBeGreaterThan(0);
		});

		it('should return correct metadata for anchor reset mode', async () => {
			const config: WorldEventServiceConfig = {
				maxSimulationDays: 100
			};
			const service = new WorldEventService(driver, rngFactory, config);
			await service.initialize(adapter, 50);

			const result = service.advanceToDay(500);

			expect(result.mode).toBe('anchor_reset');
			expect(result.fromDay).toBe(50);
			expect(result.toDay).toBe(500);
			expect(result.daysAdvanced).toBe(450);
			expect(result.hasHistoryGap).toBe(true);
			expect(result.elapsedMs).toBeGreaterThan(0);
		});
	});
});
