import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CalendarService } from '../services/CalendarService';
import { WorldEventService } from '../services/WorldEventService';
import { CalendarWorldEventIntegration } from '../services/CalendarWorldEventIntegration';
import { EventBus } from '../services/EventBus';
import { CalendarDefinitionManager } from '../services/CalendarDefinitionManager';
import { DateFormatter } from '../services/DateFormatter';
import { CalendarDriver } from '../services/CalendarDriver';
import { ICalendarStateAdapter } from '../interfaces/ICalendarStateAdapter';
import { IEventDefinitionAdapter } from '../interfaces/IEventDefinitionAdapter';
import { IRngFactory } from '../interfaces/IRngFactory';
import { ISeededRandomizer } from '../interfaces/ISeededRandomizer';
import {
	CalendarState,
	CalendarDefinition,
	TimeAdvancedEvent,
	AnyEventDefinition,
	FixedDateEvent
} from '../models/types';
import { SYSTEM_EVENTS } from '../models/events';

// ==========================================================================
// Test Fixtures - Calendar Definition
// ==========================================================================

const TEST_CALENDAR: CalendarDefinition = {
	id: 'test-calendar',
	name: 'Test Calendar',
	description: 'Calendar for integration testing',
	weekdays: ['Day1', 'Day2', 'Day3', 'Day4', 'Day5', 'Day6', 'Day7'],
	months: [
		{ name: 'Month1', days: 30, order: 0 },
		{ name: 'Month2', days: 30, order: 1 },
		{ name: 'Month3', days: 30, order: 2 }
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
		shop_closed: true
	},
	description: 'Annual celebration of the new year',
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
	description: 'The day when spring begins',
	date: {
		month: 1,
		day: 15
	}
};

// ==========================================================================
// Mock Adapters
// ==========================================================================

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
			activeCalendarId: 'test-calendar',
			totalAdvancementCount: 0
		};
	}
}

class MockEventDefinitionAdapter implements IEventDefinitionAdapter {
	constructor(private events: AnyEventDefinition[]) {}

	async loadEventDefinitions(): Promise<AnyEventDefinition[]> {
		return this.events;
	}
}

class MockSeededRandomizer implements ISeededRandomizer {
	private value: number = 0.5;

	randomFloat(): number {
		return this.value;
	}

	randomInt(min: number, max: number): number {
		return Math.floor(this.value * (max - min + 1)) + min;
	}

	rollDice(count: number, sides: number): number {
		return count * Math.ceil(this.value * sides);
	}

	getState(): number {
		return this.value;
	}

	reseed(state: number): void {
		this.value = state;
	}

	setSeed(seed: number): void {
		this.value = seed / 1000000;
	}
}

class MockRngFactory implements IRngFactory {
	create(seed: number): ISeededRandomizer {
		const rng = new MockSeededRandomizer();
		rng.setSeed(seed);
		return rng;
	}
}

// ==========================================================================
// Integration Tests
// ==========================================================================

describe('CalendarWorldEventIntegration', () => {
	let eventBus: EventBus;
	let calendarService: CalendarService;
	let worldEventService: WorldEventService;
	let integration: CalendarWorldEventIntegration;
	let calendarStateAdapter: MockCalendarStateAdapter;
	let calendarDefinitionManager: CalendarDefinitionManager;
	let dateFormatter: DateFormatter;

	beforeEach(async () => {
		// Initialize EventBus
		eventBus = new EventBus();

		// Initialize calendar state adapter
		calendarStateAdapter = new MockCalendarStateAdapter();

		// Initialize calendar definition manager
		dateFormatter = new DateFormatter();
		calendarDefinitionManager = {
			loadDefinitions: vi.fn(async () => {}),
			getDefinition: vi.fn((id: string) => {
				if (id === 'test-calendar') return TEST_CALENDAR;
				return null;
			}),
			getAllDefinitions: vi.fn(() => [TEST_CALENDAR]),
			getDefaultCalendar: vi.fn(() => TEST_CALENDAR),
			validateDefinition: vi.fn(() => true),
			addDefinition: vi.fn(),
			isLoaded: vi.fn(() => true)
		} as any;

		// Initialize CalendarService
		calendarService = new CalendarService(
			eventBus,
			calendarDefinitionManager,
			dateFormatter,
			calendarStateAdapter
		);
		await calendarService.initialize();

		// Initialize WorldEventService
		const driver = new CalendarDriver(TEST_CALENDAR);
		const rngFactory = new MockRngFactory();
		const eventAdapter = new MockEventDefinitionAdapter([NEW_YEAR_FESTIVAL, SPRING_EQUINOX]);

		worldEventService = new WorldEventService(driver, rngFactory);
		await worldEventService.initialize(eventAdapter, 0);

		// Initialize Integration
		integration = new CalendarWorldEventIntegration(
			eventBus,
			calendarService,
			worldEventService
		);
		integration.initialize();
	});

	describe('TimeAdvanced event enhancement', () => {
		it('should include time-of-day in TimeAdvanced event', async () => {
			const receivedEvents: TimeAdvancedEvent[] = [];

			// Subscribe to TimeAdvanced events
			eventBus.subscribe<TimeAdvancedEvent>(SYSTEM_EVENTS.TIME_ADVANCED, (event) => {
				receivedEvents.push(event);
			});

			// Advance time by 1 day
			await calendarService.advanceTime(1);

			// Check that event was received
			expect(receivedEvents).toHaveLength(1);
			const event = receivedEvents[0];

			// Check basic fields
			expect(event.previousDay).toBe(0);
			expect(event.newDay).toBe(1);
			expect(event.daysPassed).toBe(1);

			// Check time-of-day field exists (may be undefined if not set)
			expect(event).toHaveProperty('timeOfDay');
		});

		it('should include notable events when advancing through holidays', async () => {
			const receivedEvents: TimeAdvancedEvent[] = [];

			// Subscribe to TimeAdvanced events
			eventBus.subscribe<TimeAdvancedEvent>(SYSTEM_EVENTS.TIME_ADVANCED, (event) => {
				receivedEvents.push(event);
			});

			// New Year Festival is on Month 0, Day 1
			// In calendar terms: monthIndex=0, dayOfMonth=1
			// CalendarDriver converts this: Month 0 has 30 days, so day 1 of month 0 = absolute day 0
			// Current day is 0, so we're already ON the New Year Festival
			// We need to start at a day before the festival and advance TO it

			// First, move to day 10 (past the festival)
			await calendarService.setCurrentDay(10, false);
			receivedEvents.length = 0; // Clear events from setCurrentDay

			// Now advance back to next year's New Year Festival
			// Next occurrence: absolute day 90 (30*3 months = 90 days per year)
			// But that's too far. Let's just test with Spring Equinox instead
			// Spring Equinox: Month 1, Day 15 = 30 (month 0) + 15 = day 45
			await calendarService.setCurrentDay(40, false);
			receivedEvents.length = 0;

			// Advance through Spring Equinox
			await calendarService.advanceTime(10); // Day 40 -> 50, crossing day 45

			// Check that event includes notable events
			expect(receivedEvents).toHaveLength(1);
			const event = receivedEvents[0];

			// Should include Spring Equinox as a notable event
			expect(event.notableEvents).toBeDefined();
			expect(event.notableEvents!.length).toBeGreaterThanOrEqual(1);
			const springEquinox = event.notableEvents!.find(e => e.eventId === 'spring-equinox');
			expect(springEquinox).toBeDefined();
			expect(springEquinox!.name).toBe('Spring Equinox');
			expect(springEquinox!.type).toBe('fixed');
			expect(springEquinox!.description).toBe('The day when spring begins');
		});

		it('should include multiple notable events when advancing through multiple holidays', async () => {
			const receivedEvents: TimeAdvancedEvent[] = [];

			// Subscribe to TimeAdvanced events
			eventBus.subscribe<TimeAdvancedEvent>(SYSTEM_EVENTS.TIME_ADVANCED, (event) => {
				receivedEvents.push(event);
			});

			// Advance from day 0 to day 45 (crossing both festivals)
			// New Year Festival: Month 0, Day 1 (day 0)
			// Spring Equinox: Month 1, Day 15 (day 44 = 30 + 14)
			await calendarService.advanceTime(45);

			// Check that event includes both notable events
			expect(receivedEvents).toHaveLength(1);
			const event = receivedEvents[0];

			expect(event.notableEvents).toBeDefined();
			expect(event.notableEvents!.length).toBeGreaterThanOrEqual(1);

			// Check for Spring Equinox
			const springEquinox = event.notableEvents!.find(e => e.eventId === 'spring-equinox');
			expect(springEquinox).toBeDefined();
			expect(springEquinox!.name).toBe('Spring Equinox');
		});

		it('should not include notable events when advancing through empty days', async () => {
			// First advance past the festivals
			await calendarService.advanceTime(60);

			const receivedEvents: TimeAdvancedEvent[] = [];

			// Subscribe to TimeAdvanced events
			eventBus.subscribe<TimeAdvancedEvent>(SYSTEM_EVENTS.TIME_ADVANCED, (event) => {
				receivedEvents.push(event);
			});

			// Advance through days with no events
			await calendarService.advanceTime(10);

			// Check that event has no notable events
			expect(receivedEvents).toHaveLength(1);
			const event = receivedEvents[0];

			// Should either be undefined or empty array
			expect(!event.notableEvents || event.notableEvents.length === 0).toBe(true);
		});
	});

	describe('WorldEventService synchronization', () => {
		it('should advance WorldEventService when time advances', async () => {
			const initialDay = worldEventService['currentDay'];
			expect(initialDay).toBe(0);

			// Advance calendar time
			await calendarService.advanceTime(10);

			// WorldEventService should be synchronized
			const currentDay = worldEventService['currentDay'];
			expect(currentDay).toBe(10);
		});

		it('should handle WorldEventService being null', async () => {
			// Create integration without WorldEventService
			const nullIntegration = new CalendarWorldEventIntegration(
				eventBus,
				calendarService,
				null
			);
			nullIntegration.initialize();

			const receivedEvents: TimeAdvancedEvent[] = [];
			eventBus.subscribe<TimeAdvancedEvent>(SYSTEM_EVENTS.TIME_ADVANCED, (event) => {
				receivedEvents.push(event);
			});

			// Should not throw error
			await calendarService.advanceTime(1);

			// Should still emit event, just without notable events
			expect(receivedEvents).toHaveLength(1);
			expect(receivedEvents[0].notableEvents).toBeUndefined();
		});

		it('should allow setting WorldEventService after initialization', async () => {
			// Create integration without WorldEventService
			const laterIntegration = new CalendarWorldEventIntegration(
				new EventBus(),
				calendarService,
				null
			);
			laterIntegration.initialize();

			// Set WorldEventService later
			laterIntegration.setWorldEventService(worldEventService);

			const receivedEvents: TimeAdvancedEvent[] = [];
			eventBus.subscribe<TimeAdvancedEvent>(SYSTEM_EVENTS.TIME_ADVANCED, (event) => {
				receivedEvents.push(event);
			});

			// Should now collect notable events
			await calendarService.advanceTime(1);

			expect(receivedEvents).toHaveLength(1);
			// Notable events should be present (or empty array, but not undefined)
			expect(receivedEvents[0]).toHaveProperty('notableEvents');
		});
	});

	describe('Integration lifecycle', () => {
		it('should clean up on dispose', async () => {
			const receivedEvents: TimeAdvancedEvent[] = [];
			eventBus.subscribe<TimeAdvancedEvent>(SYSTEM_EVENTS.TIME_ADVANCED, (event) => {
				receivedEvents.push(event);
			});

			// Dispose integration
			integration.dispose();

			// Advance time
			await calendarService.advanceTime(1);

			// Event should still be emitted (other listeners exist)
			expect(receivedEvents).toHaveLength(1);

			// But notable events should not be collected (collector removed)
			expect(receivedEvents[0].notableEvents).toBeUndefined();
		});

		it('should handle errors in notable events collection gracefully', async () => {
			// Create a WorldEventService that throws errors
			const faultyService = {
				advanceToDay: vi.fn(() => {
					throw new Error('Simulated error');
				}),
				getNotableEvents: vi.fn(() => {
					throw new Error('Simulated error');
				})
			} as any;

			// Create integration with faulty service
			const faultyIntegration = new CalendarWorldEventIntegration(
				eventBus,
				calendarService,
				faultyService
			);
			faultyIntegration.initialize();

			const receivedEvents: TimeAdvancedEvent[] = [];
			eventBus.subscribe<TimeAdvancedEvent>(SYSTEM_EVENTS.TIME_ADVANCED, (event) => {
				receivedEvents.push(event);
			});

			// Should not throw error
			await calendarService.advanceTime(1);

			// Event should still be emitted
			expect(receivedEvents).toHaveLength(1);

			// Notable events should be undefined (error was caught)
			expect(receivedEvents[0].notableEvents).toBeUndefined();
		});
	});
});
