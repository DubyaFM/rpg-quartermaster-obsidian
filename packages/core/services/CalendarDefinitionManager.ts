/**
 * CalendarDefinitionManager Service
 *
 * Manages calendar definitions loaded from configuration files.
 * Provides access to calendar data (months, weekdays, holidays) and
 * validates calendar definitions.
 *
 * Calendar definitions are loaded from config/calendars.yaml via IConfigAdapter.
 */

import { CalendarDefinition } from '../models/types';
import { IConfigAdapter } from '../interfaces/IConfigAdapter';

/**
 * Default fallback calendar (simple day counter)
 */
const DEFAULT_CALENDAR: CalendarDefinition = {
	id: 'simple-counter',
	name: 'Simple Day Counter',
	description: 'Basic counting from Day 0',
	weekdays: [],
	months: [],
	holidays: []
};

export class CalendarDefinitionManager {
	private definitions: Map<string, CalendarDefinition> = new Map();
	private configAdapter: IConfigAdapter;
	private loaded: boolean = false;

	constructor(configAdapter: IConfigAdapter) {
		this.configAdapter = configAdapter;
	}

	/**
	 * Load all calendar definitions from config
	 * Loads from IConfigAdapter.loadCalendarDefinitions()
	 */
	async loadDefinitions(): Promise<void> {
		if (this.loaded) {
			return;  // Already loaded
		}

		try {
			const config = await this.configAdapter.loadCalendarDefinitions();

			if (config && config.calendars) {
				for (const calendar of config.calendars) {
					if (this.validateDefinition(calendar)) {
						this.definitions.set(calendar.id, calendar);
					} else {
						console.warn(`[CalendarDefinitionManager] Invalid calendar definition: ${calendar.id}`);
					}
				}
			}

			// Always include fallback
			if (!this.definitions.has('simple-counter')) {
				this.definitions.set('simple-counter', DEFAULT_CALENDAR);
			}

			this.loaded = true;
		} catch (error) {
			console.error('[CalendarDefinitionManager] Failed to load calendar definitions:', error);

			// Ensure fallback is available
			this.definitions.set('simple-counter', DEFAULT_CALENDAR);
			this.loaded = true;
		}
	}

	/**
	 * Get a calendar definition by ID
	 *
	 * @param id Calendar ID (e.g., "harptos", "gregorian")
	 * @returns Calendar definition or null if not found
	 */
	getDefinition(id: string): CalendarDefinition | null {
		if (!this.loaded) {
			console.warn('[CalendarDefinitionManager] Definitions not loaded. Call loadDefinitions() first.');
			return null;
		}
		return this.definitions.get(id) || null;
	}

	/**
	 * Get all available calendar definitions
	 *
	 * @returns Array of all calendar definitions
	 */
	getAllDefinitions(): CalendarDefinition[] {
		if (!this.loaded) {
			console.warn('[CalendarDefinitionManager] Definitions not loaded. Call loadDefinitions() first.');
			return [];
		}
		return Array.from(this.definitions.values());
	}

	/**
	 * Get the default calendar (fallback if no calendar set)
	 *
	 * @returns Default simple counter calendar
	 */
	getDefaultCalendar(): CalendarDefinition {
		return DEFAULT_CALENDAR;
	}

	/**
	 * Validate a calendar definition
	 *
	 * @param calendar Calendar definition to validate
	 * @returns True if valid, false otherwise
	 */
	validateDefinition(calendar: CalendarDefinition): boolean {
		// Required fields
		if (!calendar.id || !calendar.name) {
			console.error('[CalendarDefinitionManager] Calendar missing required fields (id, name)');
			return false;
		}

		// Weekdays must be an array
		if (!Array.isArray(calendar.weekdays)) {
			console.error(`[CalendarDefinitionManager] Calendar ${calendar.id} has invalid weekdays`);
			return false;
		}

		// Months must be an array
		if (!Array.isArray(calendar.months)) {
			console.error(`[CalendarDefinitionManager] Calendar ${calendar.id} has invalid months`);
			return false;
		}

		// Validate months
		for (const month of calendar.months) {
			if (!month.name || typeof month.days !== 'number' || month.days <= 0) {
				console.error(`[CalendarDefinitionManager] Calendar ${calendar.id} has invalid month: ${month.name}`);
				return false;
			}

			if (typeof month.order !== 'number' || month.order < 0) {
				console.error(`[CalendarDefinitionManager] Calendar ${calendar.id} month ${month.name} has invalid order`);
				return false;
			}
		}

		// Validate holidays (if present)
		if (calendar.holidays && Array.isArray(calendar.holidays)) {
			for (const holiday of calendar.holidays) {
				if (!holiday.name) {
					console.error(`[CalendarDefinitionManager] Calendar ${calendar.id} has holiday with no name`);
					return false;
				}

				// Must have either dayOfYear OR (month AND day)
				const hasDayOfYear = typeof holiday.dayOfYear === 'number';
				const hasMonthAndDay = typeof holiday.month === 'number' && typeof holiday.day === 'number';

				if (!hasDayOfYear && !hasMonthAndDay) {
					console.error(`[CalendarDefinitionManager] Holiday ${holiday.name} in calendar ${calendar.id} has no valid date`);
					return false;
				}
			}
		}

		return true;
	}

	/**
	 * Add a custom calendar definition at runtime
	 *
	 * @param calendar Calendar definition to add
	 */
	addDefinition(calendar: CalendarDefinition): void {
		if (this.validateDefinition(calendar)) {
			this.definitions.set(calendar.id, calendar);
		} else {
			throw new Error(`Invalid calendar definition: ${calendar.id}`);
		}
	}

	/**
	 * Check if definitions have been loaded
	 *
	 * @returns True if definitions are loaded
	 */
	isLoaded(): boolean {
		return this.loaded;
	}
}
