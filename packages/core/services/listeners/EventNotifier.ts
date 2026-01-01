/**
 * EventNotifier - Generalized event notification service
 *
 * Listens to TimeAdvanced events and notifies about:
 * - Calendar holidays (from calendar definitions)
 * - Custom user events/reminders
 *
 * Can also be called directly by other functions to emit custom notifications.
 *
 * Event Listener: Subscribes to TimeAdvanced events via EventBus
 */

import { EventBus } from '../EventBus';
import { CalendarDefinitionManager } from '../CalendarDefinitionManager';
import { DateFormatter } from '../DateFormatter';
import { TimeAdvancedEvent, CalendarHoliday } from '../../models/types';
import { SYSTEM_EVENTS } from '../../models/events';

/**
 * Custom Event Definition
 * User-defined events and reminders
 */
export interface CustomEvent {
	id: string;
	name: string;
	description?: string;

	// Event can be one-time or recurring
	type: 'one-time' | 'recurring';

	// For one-time events
	dayOfYear?: number;  // Absolute day when event occurs

	// For recurring events
	interval?: number;  // Days between occurrences (e.g., 7 for weekly)
	startDay?: number;  // Day when recurring starts (0-indexed)

	notifyOnArrival?: boolean;
	enabled?: boolean;
}

/**
 * Event that occurred (holiday or custom)
 */
export interface OccurredEvent {
	name: string;
	description?: string;
	type: 'holiday' | 'custom';
	source?: string;  // Calendar ID for holidays, 'custom' for user events
}

export class EventNotifier {
	private enabled: boolean = false;
	private unsubscribe?: () => void;
	private customEvents: CustomEvent[] = [];

	constructor(
		private eventBus: EventBus,
		private calendarDefinitionManager: CalendarDefinitionManager,
		private dateFormatter: DateFormatter,
		private notifyCallback: (message: string, title: string) => void
	) {}

	/**
	 * Enable event listener (subscribe to TimeAdvanced)
	 */
	enable(): void {
		if (this.enabled) {
			return;
		}

		this.unsubscribe = this.eventBus.subscribe<TimeAdvancedEvent>(
			SYSTEM_EVENTS.TIME_ADVANCED,
			this.handleTimeAdvanced.bind(this)
		);

		this.enabled = true;
	}

	/**
	 * Disable event listener (unsubscribe from TimeAdvanced)
	 */
	disable(): void {
		if (!this.enabled) {
			return;
		}

		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = undefined;
		}

		this.enabled = false;
	}

	/**
	 * Add custom events to monitor
	 *
	 * @param events Array of custom events
	 */
	setCustomEvents(events: CustomEvent[]): void {
		this.customEvents = events.filter(e => e.enabled !== false);
	}

	/**
	 * Manually trigger a notification
	 * Can be called by other functions to create custom notifications
	 *
	 * @param title Notification title
	 * @param message Notification message
	 */
	notify(title: string, message: string): void {
		this.notifyCallback(message, title);
	}

	/**
	 * Check for events on a specific day
	 * Returns all holidays and custom events that occur on this day
	 *
	 * @param day Absolute day counter
	 * @param calendarId Active calendar ID
	 * @returns Array of events occurring on this day
	 */
	checkEventsForDay(day: number, calendarId: string): OccurredEvent[] {
		const events: OccurredEvent[] = [];

		// Check for holidays from calendar definition
		const calendar = this.calendarDefinitionManager.getDefinition(calendarId);

		if (calendar && calendar.holidays) {
			const holidays = this.dateFormatter.getHolidaysForDay(day, calendar);

			for (const holiday of holidays) {
				if (holiday.notifyOnArrival !== false) {
					events.push({
						name: holiday.name,
						description: holiday.description,
						type: 'holiday',
						source: calendarId
					});
				}
			}
		}

		// Check for custom events
		for (const customEvent of this.customEvents) {
			if (!customEvent.notifyOnArrival) {
				continue;
			}

			if (this.isEventOnDay(customEvent, day)) {
				events.push({
					name: customEvent.name,
					description: customEvent.description,
					type: 'custom',
					source: 'custom'
				});
			}
		}

		return events;
	}

	/**
	 * Check if a custom event occurs on a specific day
	 *
	 * @param event Custom event
	 * @param day Absolute day counter
	 * @returns True if event occurs on this day
	 */
	private isEventOnDay(event: CustomEvent, day: number): boolean {
		if (event.type === 'one-time') {
			return event.dayOfYear === day;
		}

		if (event.type === 'recurring') {
			if (event.interval === undefined || event.startDay === undefined) {
				return false;
			}

			if (day < event.startDay) {
				return false;
			}

			const daysSinceStart = day - event.startDay;
			return daysSinceStart % event.interval === 0;
		}

		return false;
	}

	/**
	 * Handle TimeAdvanced event
	 * Checks for holidays and custom events, sends notifications
	 *
	 * @param event TimeAdvanced event payload
	 */
	private handleTimeAdvanced(event: TimeAdvancedEvent): void {
		// Get calendar from formatted date
		const calendarId = event.formattedDate ? 'active' : 'simple-counter';

		// Check events for each day that passed
		for (let i = 0; i < event.daysPassed; i++) {
			const checkDay = event.previousDay + i + 1;
			const eventsOnDay = this.checkEventsForDay(checkDay, calendarId);

			// Notify for each event
			for (const occurredEvent of eventsOnDay) {
				const title = occurredEvent.type === 'holiday' ? '🎉 Holiday' : '📅 Event Reminder';
				const message = occurredEvent.description
					? `${occurredEvent.name}: ${occurredEvent.description}`
					: occurredEvent.name;

				this.notify(title, message);
			}
		}
	}

	/**
	 * Check if listener is enabled
	 *
	 * @returns True if enabled
	 */
	isEnabled(): boolean {
		return this.enabled;
	}

	/**
	 * Get custom events
	 *
	 * @returns Array of custom events
	 */
	getCustomEvents(): CustomEvent[] {
		return [...this.customEvents];
	}
}
