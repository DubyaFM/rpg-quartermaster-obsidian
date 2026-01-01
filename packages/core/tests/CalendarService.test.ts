import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CalendarService } from '../services/CalendarService';
import { EventBus } from '../services/EventBus';
import { CalendarDefinitionManager } from '../services/CalendarDefinitionManager';
import { DateFormatter } from '../services/DateFormatter';
import { ICalendarStateAdapter } from '../interfaces/ICalendarStateAdapter';
import { CalendarState, CalendarDefinition, FormattedDate, TimeAdvancedEvent } from '../models/types';
import { SYSTEM_EVENTS } from '../models/events';

// Mock state adapter
class MockCalendarStateAdapter implements ICalendarStateAdapter {
	private state: CalendarState | null = null;

	async loadState(): Promise<CalendarState | null> {
		return this.state;
	}

	async saveState(state: CalendarState): Promise<void> {
		this.state = state;
	}

	async resetState(): Promise<void> {
		this.state = {
			currentDay: 0,
			activeCalendarId: 'simple-counter',
			originDate: undefined,
			lastAdvanced: undefined,
			totalAdvancementCount: 0
		};
	}

	// Helper for tests
	getInternalState(): CalendarState | null {
		return this.state;
	}
}

// Test calendar definition
const TEST_CALENDAR: CalendarDefinition = {
	id: 'test-calendar',
	name: 'Test Calendar',
	description: 'For testing',
	weekdays: ['Day1', 'Day2', 'Day3'],
	months: [
		{ name: 'Month1', days: 30, order: 0 },
		{ name: 'Month2', days: 30, order: 1 }
	],
	holidays: [],
	startingYear: 2024,
	yearSuffix: 'TC'
};

describe('CalendarService', () => {
	let service: CalendarService;
	let eventBus: EventBus;
	let defManager: CalendarDefinitionManager;
	let dateFormatter: DateFormatter;
	let stateAdapter: MockCalendarStateAdapter;

	beforeEach(async () => {
		eventBus = new EventBus();
		stateAdapter = new MockCalendarStateAdapter();
		dateFormatter = new DateFormatter();

		// Mock CalendarDefinitionManager
		defManager = {
			loadDefinitions: vi.fn(async () => {}),
			getDefinition: vi.fn((id: string) => {
				if (id === 'test-calendar') return TEST_CALENDAR;
				return null;
			}),
			getAllDefinitions: vi.fn(() => [TEST_CALENDAR]),
			getDefaultCalendar: vi.fn(() => ({
				id: 'simple-counter',
				name: 'Simple Counter',
				description: '',
				weekdays: [],
				months: [],
				holidays: []
			})),
			validateDefinition: vi.fn(() => true),
			addDefinition: vi.fn(),
			isLoaded: vi.fn(() => true)
		} as any;

		service = new CalendarService(eventBus, defManager, dateFormatter, stateAdapter);
	});

	describe('initialization', () => {
		it('should initialize with default state if no saved state', async () => {
			await service.initialize();

			expect(service.isInitialized()).toBe(true);
			expect(service.getCurrentDay()).toBe(0);
		});

		it('should load saved state if exists', async () => {
			// Pre-save state
			await stateAdapter.saveState({
				currentDay: 100,
				activeCalendarId: 'test-calendar',
				totalAdvancementCount: 5
			});

			await service.initialize();

			expect(service.getCurrentDay()).toBe(100);
		});

		it('should load calendar definitions on initialize', async () => {
			await service.initialize();

			expect(defManager.loadDefinitions).toHaveBeenCalled();
		});

		it('should not re-initialize if already initialized', async () => {
			await service.initialize();
			await service.initialize();

			// loadDefinitions should only be called once
			expect(defManager.loadDefinitions).toHaveBeenCalledTimes(1);
		});
	});

	describe('advanceTime', () => {
		beforeEach(async () => {
			await service.initialize();
		});

		it('should advance time by specified days', async () => {
			await service.advanceTime(7);

			expect(service.getCurrentDay()).toBe(7);
		});

		it('should emit TimeAdvanced event', async () => {
			let emittedEvent: TimeAdvancedEvent | null = null;

			eventBus.subscribe(SYSTEM_EVENTS.TIME_ADVANCED, (event) => {
				emittedEvent = event;
			});

			await service.advanceTime(5);

			expect(emittedEvent).not.toBeNull();
			expect(emittedEvent?.previousDay).toBe(0);
			expect(emittedEvent?.newDay).toBe(5);
			expect(emittedEvent?.daysPassed).toBe(5);
		});

		it('should persist state after advancing', async () => {
			await service.advanceTime(10);

			const savedState = stateAdapter.getInternalState();
			expect(savedState?.currentDay).toBe(10);
		});

		it('should update totalAdvancementCount', async () => {
			await service.advanceTime(1);
			await service.advanceTime(1);
			await service.advanceTime(1);

			const state = service.getState();
			expect(state.totalAdvancementCount).toBe(3);
		});

		it('should throw error if days is negative', async () => {
			await expect(service.advanceTime(-5)).rejects.toThrow('negative');
		});

		it('should throw error if not initialized', async () => {
			const uninitializedService = new CalendarService(
				eventBus,
				defManager,
				dateFormatter,
				new MockCalendarStateAdapter()
			);

			await expect(uninitializedService.advanceTime(1)).rejects.toThrow('not initialized');
		});

		it('should handle zero days (no-op)', async () => {
			await service.advanceTime(0);

			expect(service.getCurrentDay()).toBe(0);
		});

		it('should set lastAdvanced timestamp', async () => {
			await service.advanceTime(1);

			const state = service.getState();
			expect(state.lastAdvanced).toBeDefined();
			expect(typeof state.lastAdvanced).toBe('string');
		});
	});

	describe('setCurrentDay', () => {
		beforeEach(async () => {
			await service.initialize();
			await service.advanceTime(50);
		});

		it('should set day forward without allowBackwards', async () => {
			await service.setCurrentDay(100);

			expect(service.getCurrentDay()).toBe(100);
		});

		it('should throw error when going backwards without flag', async () => {
			await expect(service.setCurrentDay(25)).rejects.toThrow('backwards');
		});

		it('should allow going backwards with allowBackwards flag', async () => {
			await service.setCurrentDay(25, true);

			expect(service.getCurrentDay()).toBe(25);
		});

		it('should emit TimeAdvanced event when day changes', async () => {
			let emittedEvent: TimeAdvancedEvent | null = null;

			eventBus.subscribe(SYSTEM_EVENTS.TIME_ADVANCED, (event) => {
				emittedEvent = event;
			});

			await service.setCurrentDay(75);

			expect(emittedEvent).not.toBeNull();
			expect(emittedEvent?.previousDay).toBe(50);
			expect(emittedEvent?.newDay).toBe(75);
			expect(emittedEvent?.daysPassed).toBe(25);
		});

		it('should throw error if day is negative', async () => {
			await expect(service.setCurrentDay(-10, true)).rejects.toThrow('negative');
		});
	});

	describe('getCurrentDate', () => {
		beforeEach(async () => {
			await service.initialize();
			await service.setActiveCalendar('test-calendar');
		});

		it('should return formatted date from active calendar', () => {
			const date = service.getCurrentDate();

			expect(date).toBeDefined();
			expect(date.absoluteDay).toBe(0);
			expect(typeof date.formatted).toBe('string');
		});

		it('should fallback to simple counter if calendar not found', async () => {
			// Directly set state to have nonexistent calendar (bypass setActiveCalendar validation)
			const state = service.getState();
			state.activeCalendarId = 'nonexistent';
			await stateAdapter.saveState(state);

			// Re-initialize to load the state with nonexistent calendar
			const newService = new CalendarService(eventBus, defManager, dateFormatter, stateAdapter);
			await newService.initialize();

			const date = newService.getCurrentDate();

			expect(date.formatted).toContain('Day 0');
		});
	});

	describe('setActiveCalendar', () => {
		beforeEach(async () => {
			await service.initialize();
		});

		it('should set active calendar if exists', async () => {
			await service.setActiveCalendar('test-calendar');

			const state = service.getState();
			expect(state.activeCalendarId).toBe('test-calendar');
		});

		it('should throw error if calendar not found', async () => {
			await expect(service.setActiveCalendar('nonexistent')).rejects.toThrow('not found');
		});

		it('should persist state after setting calendar', async () => {
			await service.setActiveCalendar('test-calendar');

			const savedState = stateAdapter.getInternalState();
			expect(savedState?.activeCalendarId).toBe('test-calendar');
		});
	});

	describe('setOriginDate', () => {
		beforeEach(async () => {
			await service.initialize();
		});

		it('should set origin date', async () => {
			const origin = { year: 1492, month: 0, day: 1 };
			await service.setOriginDate(origin);

			const state = service.getState();
			expect(state.originDate).toEqual(origin);
		});

		it('should allow clearing origin date', async () => {
			await service.setOriginDate({ year: 1492, month: 0, day: 1 });
			await service.setOriginDate(undefined);

			const state = service.getState();
			expect(state.originDate).toBeUndefined();
		});

		it('should persist origin date', async () => {
			const origin = { year: 2024, month: 6, day: 15 };
			await service.setOriginDate(origin);

			const savedState = stateAdapter.getInternalState();
			expect(savedState?.originDate).toEqual(origin);
		});
	});

	describe('getState', () => {
		beforeEach(async () => {
			await service.initialize();
		});

		it('should return copy of state to prevent mutation', async () => {
			const state1 = service.getState();
			const state2 = service.getState();

			expect(state1).not.toBe(state2);  // Different objects
			expect(state1).toEqual(state2);  // Same values
		});
	});

	describe('reset', () => {
		beforeEach(async () => {
			await service.initialize();
			await service.advanceTime(100);
		});

		it('should reset to Day 0', async () => {
			await service.reset();

			expect(service.getCurrentDay()).toBe(0);
		});

		it('should reset totalAdvancementCount', async () => {
			await service.reset();

			const state = service.getState();
			expect(state.totalAdvancementCount).toBe(0);
		});

		it('should reset to simple-counter calendar', async () => {
			await service.setActiveCalendar('test-calendar');
			await service.reset();

			const state = service.getState();
			expect(state.activeCalendarId).toBe('simple-counter');
		});
	});

	describe('event bus integration', () => {
		beforeEach(async () => {
			await service.initialize();
		});

		it('should emit events with formatted date', async () => {
			await service.setActiveCalendar('test-calendar');

			let emittedEvent: TimeAdvancedEvent | null = null;

			eventBus.subscribe(SYSTEM_EVENTS.TIME_ADVANCED, (event) => {
				emittedEvent = event;
			});

			await service.advanceTime(7);

			expect(emittedEvent?.formattedDate).toBeDefined();
			expect(emittedEvent?.formattedDate?.absoluteDay).toBe(7);
		});

		it('should allow multiple listeners', async () => {
			const results: number[] = [];

			eventBus.subscribe(SYSTEM_EVENTS.TIME_ADVANCED, (event) => {
				results.push(event.newDay);
			});

			eventBus.subscribe(SYSTEM_EVENTS.TIME_ADVANCED, (event) => {
				results.push(event.newDay * 2);
			});

			await service.advanceTime(5);

			expect(results).toEqual([5, 10]);
		});
	});
});
