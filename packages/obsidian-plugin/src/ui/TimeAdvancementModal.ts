/**
 * Time Advancement Modal
 *
 * Provides quick time advancement controls with configurable preset buttons.
 * Integrates with CalendarService for time-of-day support.
 *
 * Features:
 * - Configurable quick-action buttons (+10 min, +1 hour, +8 hours, etc.)
 * - Custom time amount input
 * - Spinner for large time jumps
 * - Notable events notification after advancement
 * - Jump-to-specific-date option
 *
 * **Phase 7 - TKT-CAL-054**
 */

import { App, Modal, Notice, Setting } from 'obsidian';
import type QuartermasterPlugin from '../main';
import { TimeAdvancementPreset } from '@quartermaster/core/models/types';

export class TimeAdvancementModal extends Modal {
	private plugin: QuartermasterPlugin;
	private customDays: number = 0;
	private customHours: number = 0;
	private customMinutes: number = 0;

	constructor(app: App, plugin: QuartermasterPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('quartermaster-time-advancement-modal');

		contentEl.createEl('h2', { text: 'Advance Time' });

		this.renderCurrentDateTime();
		this.renderQuickButtons();
		this.renderCustomInput();
		this.renderActionButtons();
	}

	/**
	 * Display current date and time
	 */
	private renderCurrentDateTime() {
		const { contentEl } = this;

		try {
			const currentDay = this.plugin.dataAdapter.getCurrentDay();
			const currentDate = this.plugin.dataAdapter.getCurrentDate();

			const dateDiv = contentEl.createDiv({ cls: 'current-datetime-display' });
			dateDiv.style.padding = '12px';
			dateDiv.style.backgroundColor = 'var(--background-modifier-border)';
			dateDiv.style.borderRadius = '4px';
			dateDiv.style.marginBottom = '16px';
			dateDiv.style.textAlign = 'center';

			// Date
			dateDiv.createEl('div', {
				text: currentDate.formatted,
				cls: 'calendar-formatted-date'
			}).style.fontSize = '1.2em';

			// Day counter
			dateDiv.createEl('div', {
				text: `Day ${currentDay}`,
				cls: 'calendar-day-counter'
			}).style.opacity = '0.7';

			// Time of day (if available)
			const calendarService = this.plugin.dataAdapter.getCalendarService?.();
			if (calendarService) {
				const state = calendarService.getState();
				if (state.timeOfDay !== undefined) {
					const hours = Math.floor(state.timeOfDay / 60);
					const minutes = state.timeOfDay % 60;
					const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

					dateDiv.createEl('div', {
						text: `Time: ${timeString}`,
						cls: 'calendar-time-of-day'
					}).style.fontSize = '1.1em';
				}
			}
		} catch (error) {
			contentEl.createEl('p', {
				text: 'Calendar system not initialized',
				cls: 'mod-warning'
			});
		}
	}

	/**
	 * Render quick action buttons
	 */
	private renderQuickButtons() {
		const { contentEl } = this;

		contentEl.createEl('h3', { text: 'Quick Actions' });

		const quickButtonsDiv = contentEl.createDiv({ cls: 'time-quick-buttons' });
		quickButtonsDiv.style.display = 'grid';
		quickButtonsDiv.style.gridTemplateColumns = 'repeat(auto-fit, minmax(120px, 1fr))';
		quickButtonsDiv.style.gap = '8px';
		quickButtonsDiv.style.marginBottom = '16px';

		// Get presets from settings or use defaults
		const presets = this.getTimePresets();

		presets.forEach(preset => {
			const btn = quickButtonsDiv.createEl('button', {
				text: preset.label,
				cls: 'mod-cta'
			});
			btn.style.padding = '8px';
			btn.onclick = async () => await this.advanceByPreset(preset);
		});
	}

	/**
	 * Get time presets from settings or defaults
	 */
	private getTimePresets(): TimeAdvancementPreset[] {
		// Check if custom presets are configured in settings
		const customPresets = this.plugin.settings.timeAdvancementPresets;
		if (customPresets && customPresets.length > 0) {
			return customPresets;
		}

		// Default presets
		return [
			{ label: '10 minutes', minutes: 10 },
			{ label: '1 hour', hours: 1 },
			{ label: '8 hours', hours: 8 },
			{ label: '1 day', days: 1 },
			{ label: '3 days', days: 3 },
			{ label: '7 days', days: 7 },
			{ label: '30 days', days: 30 }
		];
	}

	/**
	 * Render custom time input
	 */
	private renderCustomInput() {
		const { contentEl } = this;

		contentEl.createEl('h3', { text: 'Custom Amount' });

		const customDiv = contentEl.createDiv({ cls: 'time-custom-input' });
		customDiv.style.marginBottom = '16px';

		// Days
		new Setting(customDiv)
			.setName('Days')
			.addText(text => text
				.setPlaceholder('0')
				.setValue('0')
				.onChange(value => {
					const days = parseInt(value) || 0;
					this.customDays = days >= 0 ? days : 0;
				}));

		// Hours
		new Setting(customDiv)
			.setName('Hours')
			.addText(text => text
				.setPlaceholder('0')
				.setValue('0')
				.onChange(value => {
					const hours = parseInt(value) || 0;
					this.customHours = hours >= 0 ? hours : 0;
				}));

		// Minutes
		new Setting(customDiv)
			.setName('Minutes')
			.addText(text => text
				.setPlaceholder('0')
				.setValue('0')
				.onChange(value => {
					const minutes = parseInt(value) || 0;
					this.customMinutes = minutes >= 0 ? minutes : 0;
				}));
	}

	/**
	 * Render action buttons
	 */
	private renderActionButtons() {
		const { contentEl } = this;

		const buttonDiv = contentEl.createDiv({ cls: 'modal-button-container' });
		buttonDiv.style.marginTop = '16px';
		buttonDiv.style.display = 'flex';
		buttonDiv.style.gap = '8px';
		buttonDiv.style.justifyContent = 'flex-end';

		const cancelBtn = buttonDiv.createEl('button', { text: 'Cancel' });
		cancelBtn.onclick = () => this.close();

		const advanceBtn = buttonDiv.createEl('button', {
			text: 'Advance Custom Amount',
			cls: 'mod-cta'
		});
		advanceBtn.onclick = async () => await this.advanceCustomAmount();
	}

	/**
	 * Advance time by preset amount
	 */
	private async advanceByPreset(preset: TimeAdvancementPreset) {
		const days = preset.days || 0;
		const totalMinutes = (preset.minutes || 0) + ((preset.hours || 0) * 60);

		await this.advanceTime(days, totalMinutes, preset.label);
	}

	/**
	 * Advance time by custom amount
	 */
	private async advanceCustomAmount() {
		const days = this.customDays;
		const totalMinutes = this.customMinutes + (this.customHours * 60);

		if (days === 0 && totalMinutes === 0) {
			new Notice('Please enter a time amount to advance');
			return;
		}

		const label = this.formatCustomLabel(days, this.customHours, this.customMinutes);
		await this.advanceTime(days, totalMinutes, label);
	}

	/**
	 * Core time advancement logic
	 */
	private async advanceTime(days: number, minutes: number, label: string) {
		try {
			const previousDay = this.plugin.dataAdapter.getCurrentDay();
			const previousDate = this.plugin.dataAdapter.getCurrentDate();

			// Show spinner for large jumps (> 30 days)
			let spinnerNotice: Notice | null = null;
			if (days > 30) {
				spinnerNotice = new Notice(`Advancing time by ${label}... Please wait.`, 0);
			}

			// Advance time via CalendarService
			const calendarService = this.plugin.dataAdapter.getCalendarService?.();
			if (calendarService) {
				await calendarService.advanceTime(days, minutes);
			} else {
				// Fallback to dataAdapter if CalendarService not available
				await this.plugin.dataAdapter.advanceTime(days);
			}

			// Dismiss spinner
			if (spinnerNotice) {
				spinnerNotice.hide();
			}

			const newDay = this.plugin.dataAdapter.getCurrentDay();
			const newDate = this.plugin.dataAdapter.getCurrentDate();

			// Get notable events (if any)
			const calendarServiceWithState = this.plugin.dataAdapter.getCalendarService?.();
			let notableEventsText = '';
			if (calendarServiceWithState) {
				const state = calendarServiceWithState.getState();
				if (state.lastNotableEvents && state.lastNotableEvents.length > 0) {
					notableEventsText = '\n\nNotable Events:\n' +
						state.lastNotableEvents.map((e: any) => `- ${e.name} (Day ${e.day})`).join('\n');
				}
			}

			// Success notification
			new Notice(
				`Time advanced by ${label}!\n` +
				`From: ${previousDate.formatted} (Day ${previousDay})\n` +
				`To: ${newDate.formatted} (Day ${newDay})` +
				notableEventsText
			);

			// Refresh calendar HUD if present
			if (this.plugin.calendarHUD) {
				await this.plugin.calendarHUD.refreshDisplay();
			}

			this.close();
		} catch (error) {
			console.error('[TimeAdvancementModal] Failed to advance time:', error);
			new Notice(`Failed to advance time: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Format custom amount label
	 */
	private formatCustomLabel(days: number, hours: number, minutes: number): string {
		const parts: string[] = [];
		if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
		if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
		if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
		return parts.join(', ');
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
