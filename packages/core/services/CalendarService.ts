/**
 * CalendarService - Core Calendar Module
 *
 * Manages calendar state, advances time, and emits events.
 * This is the single source of truth for the current day counter.
 *
 * Responsibilities:
 * - Load and save calendar state
 * - Advance time and emit TimeAdvanced events
 * - Provide current day and formatted date
 * - Allow manual date setting with validation
 *
 * Event Producer: Emits 'TimeAdvanced' events via EventBus
 *
 * Refactored (Phase 2): Uses CalendarDriver for all date calculations
 */

import { EventBus } from './EventBus';
import { CalendarDefinitionManager } from './CalendarDefinitionManager';
import { DateFormatter } from './DateFormatter';
import { CalendarDriver } from './CalendarDriver';
import { ICalendarStateAdapter } from '../interfaces/ICalendarStateAdapter';
import { CalendarState, FormattedDate, TimeAdvancedEvent, CalendarOrigin } from '../models/types';
import { SYSTEM_EVENTS } from '../models/events';

export class CalendarService {
	private state: CalendarState;
	private initialized: boolean = false;
	private driver: CalendarDriver | null = null;

	constructor(
		private eventBus: EventBus,
		private calendarDefinitionManager: CalendarDefinitionManager,
		private dateFormatter: DateFormatter,
		private stateAdapter: ICalendarStateAdapter
	) {
		// Default state (will be overwritten by initialize())
		this.state = {
			currentDay: 0,
			activeCalendarId: 'simple-counter',
			totalAdvancementCount: 0
		};
	}

	/**
	 * Initialize calendar service
	 * Loads calendar definitions and state from persistence
	 * Creates CalendarDriver instance for date calculations
	 */
	async initialize(): Promise<void> {
		if (this.initialized) {
			return;
		}

		// Load calendar definitions
		await this.calendarDefinitionManager.loadDefinitions();

		// Load persisted state
		const loadedState = await this.stateAdapter.loadState();

		if (loadedState) {
			this.state = loadedState;
		} else {
			// No saved state - use default and persist it
			await this.stateAdapter.saveState(this.state);
		}

		// Initialize CalendarDriver with active calendar
		this.updateDriver();

		this.initialized = true;
	}

	/**
	 * Update CalendarDriver instance when calendar or origin changes
	 * @private
	 */
	private updateDriver(): void {
		const calendar = this.calendarDefinitionManager.getDefinition(this.state.activeCalendarId);
		if (calendar) {
			this.driver = new CalendarDriver(calendar, this.state.originDate);
			// Sync time-of-day from state to driver
			if (this.state.timeOfDay !== undefined) {
				this.driver.setTimeOfDay(this.state.timeOfDay);
			}
		}
	}

	/**
	 * Advance time by a number of days
	 *
	 * @param days Number of days to advance (must be positive)
	 * @param minutes Optional minutes to advance (for time-of-day support)
	 * @throws Error if days is negative or service not initialized
	 */
	async advanceTime(days: number, minutes?: number): Promise<void> {
		if (!this.initialized) {
			throw new Error('[CalendarService] Service not initialized. Call initialize() first.');
		}

		if (days < 0) {
			throw new Error('[CalendarService] Cannot advance time by negative days. Use setCurrentDay() to go backwards.');
		}

		if (days === 0 && !minutes) {
			return;  // No-op
		}

		const previousDay = this.state.currentDay;
		let totalDaysToAdvance = days;

		// Handle time-of-day advancement if driver available
		if (minutes && this.driver) {
			const daysRolledOver = this.driver.advanceTime(minutes);
			totalDaysToAdvance += daysRolledOver;
			this.state.timeOfDay = this.driver.getTimeOfDay();
		}

		const newDay = previousDay + totalDaysToAdvance;

		// Update state
		this.state.currentDay = newDay;
		this.state.lastAdvanced = new Date().toISOString();
		this.state.totalAdvancementCount = (this.state.totalAdvancementCount || 0) + 1;

		// Persist state
		await this.stateAdapter.saveState(this.state);

		// Emit TimeAdvanced event
		const event: TimeAdvancedEvent = {
			previousDay,
			newDay,
			daysPassed: totalDaysToAdvance,
			formattedDate: this.getCurrentDate()
		};

		this.eventBus.emit(SYSTEM_EVENTS.TIME_ADVANCED, event);
	}

	/**
	 * Set current day to a specific value (manual override)
	 *
	 * @param day Day to set (0-indexed)
	 * @param allowBackwards If true, allows going backwards in time
	 * @throws Error if day is negative or going backwards without allowBackwards
	 */
	async setCurrentDay(day: number, allowBackwards: boolean = false): Promise<void> {
		if (!this.initialized) {
			throw new Error('[CalendarService] Service not initialized. Call initialize() first.');
		}

		if (day < 0) {
			throw new Error('[CalendarService] Day cannot be negative.');
		}

		if (day < this.state.currentDay && !allowBackwards) {
			throw new Error('[CalendarService] Cannot go backwards in time without allowBackwards flag.');
		}

		const previousDay = this.state.currentDay;
		this.state.currentDay = day;
		this.state.lastAdvanced = new Date().toISOString();

		// Persist state
		await this.stateAdapter.saveState(this.state);

		// Emit event if day changed
		if (day !== previousDay) {
			const event: TimeAdvancedEvent = {
				previousDay,
				newDay: day,
				daysPassed: day - previousDay,
				formattedDate: this.getCurrentDate()
			};

			this.eventBus.emit(SYSTEM_EVENTS.TIME_ADVANCED, event);
		}
	}

	/**
	 * Get current day counter
	 *
	 * @returns Current day (0-indexed)
	 */
	getCurrentDay(): number {
		return this.state.currentDay;
	}

	/**
	 * Get current formatted date
	 * Uses CalendarDriver for calculation, delegates formatting to DateFormatter
	 *
	 * @returns Formatted date object
	 */
	getCurrentDate(): FormattedDate {
		const calendar = this.calendarDefinitionManager.getDefinition(this.state.activeCalendarId);

		if (!calendar) {
			// Fallback to simple counter
			return {
				dayOfWeek: '',
				dayOfMonth: 0,
				monthName: '',
				year: 0,
				yearSuffix: '',
				formatted: `Day ${this.state.currentDay}`,
				compact: `Day ${this.state.currentDay}`,
				absoluteDay: this.state.currentDay
			};
		}

		// Use DateFormatter which now delegates to CalendarDriver
		return this.dateFormatter.format(
			this.state.currentDay,
			calendar,
			this.state.originDate
		);
	}

	/**
	 * Set active calendar definition
	 * Recreates CalendarDriver with new calendar
	 *
	 * @param calendarId Calendar ID to activate
	 * @throws Error if calendar not found
	 */
	async setActiveCalendar(calendarId: string): Promise<void> {
		if (!this.initialized) {
			throw new Error('[CalendarService] Service not initialized. Call initialize() first.');
		}

		const calendar = this.calendarDefinitionManager.getDefinition(calendarId);

		if (!calendar) {
			throw new Error(`[CalendarService] Calendar not found: ${calendarId}`);
		}

		this.state.activeCalendarId = calendarId;
		this.updateDriver();  // Recreate driver with new calendar
		await this.stateAdapter.saveState(this.state);
	}

	/**
	 * Set origin date (maps Day 0 to a calendar date)
	 * Recreates CalendarDriver with new origin
	 *
	 * @param origin Origin date or undefined to clear
	 */
	async setOriginDate(origin: CalendarOrigin | undefined): Promise<void> {
		if (!this.initialized) {
			throw new Error('[CalendarService] Service not initialized. Call initialize() first.');
		}

		this.state.originDate = origin;
		this.updateDriver();  // Recreate driver with new origin
		await this.stateAdapter.saveState(this.state);
	}

	/**
	 * Get current calendar state (for debugging/UI)
	 *
	 * @returns Current calendar state
	 */
	getState(): CalendarState {
		return { ...this.state };  // Return copy to prevent mutation
	}

	/**
	 * Reset calendar to Day 0
	 */
	async reset(): Promise<void> {
		if (!this.initialized) {
			throw new Error('[CalendarService] Service not initialized. Call initialize() first.');
		}

		await this.stateAdapter.resetState();
		this.state = await this.stateAdapter.loadState() || {
			currentDay: 0,
			activeCalendarId: 'simple-counter',
			totalAdvancementCount: 0
		};
	}

	/**
	 * Check if service is initialized
	 *
	 * @returns True if initialized
	 */
	isInitialized(): boolean {
		return this.initialized;
	}
}
