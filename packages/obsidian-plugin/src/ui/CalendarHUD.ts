/**
 * Calendar HUD Component
 *
 * Status bar widget for calendar display in Obsidian.
 * Displays current date and provides quick access to:
 * - Current formatted date
 * - Season and time of day information
 * - Click to open detailed view (World View Dashboard)
 *
 * **Phase 7 - TKT-CAL-052**
 */

import { App, Notice } from 'obsidian';
import type QuartermasterPlugin from '../main';

export class CalendarHUD {
	private statusBarItem: HTMLElement;
	private updateInterval: number | null = null;

	constructor(
		private app: App,
		private plugin: QuartermasterPlugin
	) {
		this.statusBarItem = plugin.addStatusBarItem();
		this.statusBarItem.addClass('quartermaster-calendar-hud');

		// Initialize display
		this.refreshDisplay();

		// Set up periodic refresh (every 30 seconds for time-of-day updates)
		this.updateInterval = window.setInterval(() => {
			this.refreshDisplay();
		}, 30000);

		// Register click handler to open detailed view
		this.statusBarItem.onclick = (event: MouseEvent) => {
			this.openDetailedView();
		};

		// Listen for calendar changes (time advancement)
		this.plugin.registerEvent(
			this.app.workspace.on('quartermaster:campaign-changed' as any, () => {
				this.refreshDisplay();
			})
		);
	}

	/**
	 * Refresh the status bar display with current calendar info
	 */
	async refreshDisplay(): Promise<void> {
		try {
			// Check if calendar system is initialized
			if (!this.plugin.dataAdapter.getCurrentDay || !this.plugin.dataAdapter.getCurrentDate) {
				this.renderStatusBar('Calendar N/A', 'Calendar system not initialized');
				return;
			}

			const currentDay = this.plugin.dataAdapter.getCurrentDay();
			const currentDate = this.plugin.dataAdapter.getCurrentDate();

			// Get time of day if available (from CalendarService state)
			let timeInfo = '';
			const calendarService = this.plugin.dataAdapter.getCalendarService?.();
			if (calendarService) {
				const state = calendarService.getState();
				if (state.timeOfDay !== undefined) {
					const hours = Math.floor(state.timeOfDay / 60);
					const minutes = state.timeOfDay % 60;
					timeInfo = ` ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
				}
			}

			// Format display text
			const displayText = `${currentDate.formatted}${timeInfo}`;
			const tooltip = `Calendar Day ${currentDay}\nClick for detailed view`;

			this.renderStatusBar(displayText, tooltip);
		} catch (error) {
			console.error('[CalendarHUD] Error refreshing display:', error);
			this.renderStatusBar('Calendar Error', 'Failed to load calendar data');
		}
	}

	/**
	 * Render the status bar item
	 * @private
	 */
	private renderStatusBar(text: string, tooltip: string): void {
		this.statusBarItem.empty();

		// Icon
		const icon = this.statusBarItem.createSpan({ cls: 'quartermaster-calendar-hud-icon' });
		icon.setText('📅');

		// Calendar date
		const dateText = this.statusBarItem.createSpan({ cls: 'quartermaster-calendar-hud-text' });
		dateText.setText(text);

		// Tooltip
		this.statusBarItem.setAttribute('aria-label', tooltip);
		this.statusBarItem.setAttribute('title', tooltip);
	}

	/**
	 * Open detailed calendar view (World View Dashboard)
	 * @private
	 */
	private async openDetailedView(): Promise<void> {
		try {
			// Dynamic import to avoid circular dependencies
			const { WorldViewDashboard } = await import('./WorldViewDashboard');
			new WorldViewDashboard(this.app, this.plugin).open();
		} catch (error) {
			console.error('[CalendarHUD] Failed to open detailed view:', error);
			new Notice('Failed to open calendar view');
		}
	}

	/**
	 * Cleanup when HUD is destroyed
	 */
	destroy(): void {
		if (this.updateInterval !== null) {
			window.clearInterval(this.updateInterval);
			this.updateInterval = null;
		}
		this.statusBarItem.remove();
	}
}
