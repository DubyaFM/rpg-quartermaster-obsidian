/**
 * Event Type Constants
 *
 * All system events used by the EventBus.
 * Use these constants instead of string literals to prevent typos.
 *
 * @example
 * eventBus.emit(SYSTEM_EVENTS.TIME_ADVANCED, payload);
 */

// Re-export TimeAdvancedEvent from types for consumers importing from events
export type { TimeAdvancedEvent } from './types';

/**
 * System event names
 */
export const SYSTEM_EVENTS = {
	/**
	 * Fired when time is advanced via CalendarService.advanceTime()
	 * Payload: TimeAdvancedEvent
	 */
	TIME_ADVANCED: 'TimeAdvanced',

	/**
	 * Fired when the active calendar definition is changed
	 * Payload: { newCalendarId: string, previousCalendarId: string }
	 */
	CALENDAR_CHANGED: 'CalendarChanged',

	/**
	 * Fired when a transaction is created (future feature)
	 * Payload: TransactionContext
	 */
	TRANSACTION_CREATED: 'TransactionCreated'
} as const;

/**
 * Type-safe event names
 */
export type SystemEvent = typeof SYSTEM_EVENTS[keyof typeof SYSTEM_EVENTS];
