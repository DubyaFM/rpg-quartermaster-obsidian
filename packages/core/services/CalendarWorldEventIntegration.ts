/**
 * CalendarWorldEventIntegration - Coordinates Calendar and World Event Systems
 *
 * This integration layer ensures CalendarService and WorldEventService stay synchronized
 * and that TimeAdvanced events include notable event information for UI consumption.
 *
 * Responsibilities:
 * - Listen for TimeAdvanced events and advance WorldEventService
 * - Provide notable events collector callback to CalendarService
 * - Coordinate state between calendar time and world events
 *
 * Architecture:
 * - CalendarService calls notableEventsCollector before emitting TimeAdvanced
 * - Integration advances WorldEventService and returns notable events
 * - CalendarService includes notable events in TimeAdvanced event
 * - UI layers receive complete event information in one event
 */

import { EventBus } from './EventBus';
import { CalendarService } from './CalendarService';
import { WorldEventService } from './WorldEventService';
import { TimeAdvancedEvent, NotableEventSummary } from '../models/types';
import { SYSTEM_EVENTS } from '../models/events';

export class CalendarWorldEventIntegration {
	private unsubscribe: (() => void) | null = null;

	constructor(
		private eventBus: EventBus,
		private calendarService: CalendarService,
		private worldEventService: WorldEventService | null
	) {}

	/**
	 * Initialize the integration
	 * Sets up collectors and event listeners
	 */
	initialize(): void {
		// Register notable events collector with CalendarService
		// This callback is called synchronously during time advancement
		this.calendarService.setNotableEventsCollector(
			this.collectNotableEvents.bind(this)
		);

		// Subscribe to TimeAdvanced events to keep WorldEventService in sync
		this.unsubscribe = this.eventBus.subscribe<TimeAdvancedEvent>(
			SYSTEM_EVENTS.TIME_ADVANCED,
			this.handleTimeAdvanced.bind(this)
		);
	}

	/**
	 * Cleanup integration
	 * Unsubscribes from events and removes collectors
	 */
	dispose(): void {
		// Remove collector from CalendarService
		this.calendarService.setNotableEventsCollector(null);

		// Unsubscribe from events
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = null;
		}
	}

	/**
	 * Collect notable events for time advancement
	 * Called by CalendarService before emitting TimeAdvanced event
	 *
	 * @param fromDay Starting day (exclusive)
	 * @param toDay Ending day (inclusive)
	 * @returns Array of notable events
	 */
	private collectNotableEvents(fromDay: number, toDay: number): NotableEventSummary[] {
		// If WorldEventService is not available, return empty array
		if (!this.worldEventService) {
			return [];
		}

		try {
			// Advance WorldEventService to target day FIRST
			// This ensures event states are up-to-date before collecting
			this.worldEventService.advanceToDay(toDay);

			// Collect notable events for the time period
			const notableEvents = this.worldEventService.getNotableEvents(fromDay, toDay);

			return notableEvents as NotableEventSummary[];
		} catch (error) {
			console.error('[CalendarWorldEventIntegration] Error collecting notable events:', error);
			return [];
		}
	}

	/**
	 * Handle TimeAdvanced event from CalendarService
	 * Note: WorldEventService was already advanced in collectNotableEvents
	 * This handler is for any additional post-advancement logic
	 */
	private handleTimeAdvanced(event: TimeAdvancedEvent): void {
		// WorldEventService is already synchronized via collectNotableEvents
		// This handler exists for future extensibility (e.g., UI notifications, logging)

		// Optional: Log notable events for debugging
		if (event.notableEvents && event.notableEvents.length > 0) {
			console.log(
				`[CalendarWorldEventIntegration] ${event.notableEvents.length} notable events during advancement:`,
				event.notableEvents.map(e => e.name).join(', ')
			);
		}
	}

	/**
	 * Set the WorldEventService instance
	 * Useful for lazy initialization or service replacement
	 */
	setWorldEventService(service: WorldEventService | null): void {
		this.worldEventService = service;
	}
}
