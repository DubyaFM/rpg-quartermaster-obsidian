/**
 * ICalendarStateAdapter - Calendar state persistence abstraction
 *
 * Abstracts how calendar state (day counter, active calendar, origin date)
 * is persisted. Implementations can store in settings, files, or databases.
 *
 * Platform-specific implementations:
 * - ObsidianCalendarStateAdapter: Stores in plugin settings (data.json)
 * - FileCalendarStateAdapter: Stores in standalone JSON file
 * - DatabaseCalendarStateAdapter: Stores in database
 */

import { CalendarState } from '../models/types';

export interface ICalendarStateAdapter {
	/**
	 * Load calendar state from persistence
	 * @returns Calendar state or null if not found
	 */
	loadState(): Promise<CalendarState | null>;

	/**
	 * Save calendar state to persistence
	 * @param state Calendar state to save
	 */
	saveState(state: CalendarState): Promise<void>;

	/**
	 * Reset state to default (Day 0)
	 */
	resetState(): Promise<void>;
}
