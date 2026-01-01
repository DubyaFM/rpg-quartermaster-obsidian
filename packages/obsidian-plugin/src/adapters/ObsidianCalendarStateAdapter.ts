/**
 * ObsidianCalendarStateAdapter
 *
 * Stores calendar state in plugin settings (data.json).
 * Implements ICalendarStateAdapter for platform-agnostic calendar services.
 */

import { ICalendarStateAdapter } from '@quartermaster/core/interfaces/ICalendarStateAdapter';
import { ISettingsAdapter } from '@quartermaster/core/interfaces/ISettingsAdapter';
import { CalendarState } from '@quartermaster/core/models/types';

export class ObsidianCalendarStateAdapter implements ICalendarStateAdapter {
	constructor(
		private settingsAdapter: ISettingsAdapter
	) {}

	/**
	 * Load calendar state from plugin settings
	 * @returns Calendar state or null if not found
	 */
	async loadState(): Promise<CalendarState | null> {
		const settings = this.settingsAdapter.getSettings();
		return settings.calendarState || null;
	}

	/**
	 * Save calendar state to plugin settings
	 * @param state Calendar state to save
	 */
	async saveState(state: CalendarState): Promise<void> {
		const settings = this.settingsAdapter.getSettings();
		settings.calendarState = state;
		await this.settingsAdapter.saveSettings(settings);
	}

	/**
	 * Reset state to default (Day 0)
	 */
	async resetState(): Promise<void> {
		await this.saveState({
			currentDay: 0,
			activeCalendarId: 'simple-counter',
			originDate: undefined,  // User must set origin manually in settings
			lastAdvanced: undefined,
			totalAdvancementCount: 0
		});
	}
}
