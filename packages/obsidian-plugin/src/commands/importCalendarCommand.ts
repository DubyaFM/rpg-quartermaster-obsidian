/**
 * Import Fantasy-Calendar.com Command
 *
 * Obsidian command for importing calendar definitions from Fantasy-Calendar.com JSON exports.
 *
 * Workflow:
 * 1. User selects JSON file from vault
 * 2. Parse and validate JSON
 * 3. Show preview modal with warnings/errors
 * 4. User confirms import
 * 5. Save to config/calendars/{name}.yaml
 */

import { App, Modal, Notice, TFile } from 'obsidian';
import { FantasyCalendarImporter, ImportResult } from '@quartermaster/core/import/index';
import QuartermasterPlugin from '../main';

/**
 * Import Calendar Preview Modal
 *
 * Shows parsed calendar details, warnings, and errors before saving.
 */
class ImportCalendarPreviewModal extends Modal {
	constructor(
		app: App,
		private plugin: QuartermasterPlugin,
		private result: ImportResult
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Import Calendar Preview' });

		if (this.result.success) {
			this.renderSuccessPreview(contentEl);
		} else {
			this.renderErrorPreview(contentEl);
		}
	}

	private renderSuccessPreview(container: HTMLElement) {
		const { result } = this;
		const calendar = result.calendar!;

		// Calendar info
		const infoSection = container.createDiv({ cls: 'import-preview-info' });
		infoSection.createEl('h3', { text: 'Calendar Information' });
		infoSection.createEl('p', { text: `Name: ${calendar.name}` });
		infoSection.createEl('p', { text: `ID: ${calendar.id}` });
		if (calendar.description) {
			infoSection.createEl('p', { text: `Description: ${calendar.description}` });
		}

		// Statistics
		const statsSection = container.createDiv({ cls: 'import-preview-stats' });
		statsSection.createEl('h3', { text: 'Statistics' });
		statsSection.createEl('p', { text: `Months: ${calendar.months.length}` });
		statsSection.createEl('p', { text: `Weekdays: ${calendar.weekdays.length}` });
		statsSection.createEl('p', { text: `Holidays: ${calendar.holidays.length}` });
		if (calendar.leapRules) {
			statsSection.createEl('p', { text: `Leap Rules: ${calendar.leapRules.length}` });
		}
		if (calendar.seasons) {
			statsSection.createEl('p', { text: `Seasons: ${calendar.seasons.length}` });
		}
		if (calendar.eras) {
			statsSection.createEl('p', { text: `Eras: ${calendar.eras.length}` });
		}

		// Parse warnings
		if (result.parseWarnings.length > 0) {
			const warningsSection = container.createDiv({ cls: 'import-preview-warnings' });
			warningsSection.createEl('h3', { text: 'Parse Warnings' });
			const warningsList = warningsSection.createEl('ul');
			result.parseWarnings.forEach(warning => {
				warningsList.createEl('li', { text: warning });
			});
		}

		// Validation warnings
		if (result.validationWarnings.length > 0) {
			const warningsSection = container.createDiv({ cls: 'import-preview-warnings' });
			warningsSection.createEl('h3', { text: 'Validation Warnings' });
			const warningsList = warningsSection.createEl('ul');
			result.validationWarnings.forEach(warning => {
				warningsList.createEl('li', { text: `${warning.field}: ${warning.message}` });
			});
		}

		// Buttons
		const buttonContainer = container.createDiv({ cls: 'modal-button-container' });

		const confirmBtn = buttonContainer.createEl('button', {
			text: 'Import Calendar',
			cls: 'mod-cta'
		});
		confirmBtn.addEventListener('click', async () => {
			await this.saveCalendar();
			this.close();
		});

		const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => this.close());
	}

	private renderErrorPreview(container: HTMLElement) {
		const { result } = this;

		// Error message
		const errorSection = container.createDiv({ cls: 'import-preview-error' });
		errorSection.createEl('h3', { text: 'Import Failed', cls: 'import-error-title' });
		errorSection.createEl('p', { text: result.error || 'Unknown error' });

		// Validation errors
		if (result.validationErrors.length > 0) {
			const errorsSection = container.createDiv({ cls: 'import-validation-errors' });
			errorsSection.createEl('h4', { text: 'Validation Errors' });
			const errorsList = errorsSection.createEl('ul');
			result.validationErrors.forEach(error => {
				const li = errorsList.createEl('li');
				li.createSpan({ text: `${error.field}: ${error.message}` });
				if (error.suggestion) {
					li.createEl('br');
					li.createSpan({ text: `Suggestion: ${error.suggestion}`, cls: 'import-suggestion' });
				}
			});
		}

		// Parse warnings (if any)
		if (result.parseWarnings.length > 0) {
			const warningsSection = container.createDiv({ cls: 'import-parse-warnings' });
			warningsSection.createEl('h4', { text: 'Parse Warnings' });
			const warningsList = warningsSection.createEl('ul');
			result.parseWarnings.forEach(warning => {
				warningsList.createEl('li', { text: warning });
			});
		}

		// Close button
		const buttonContainer = container.createDiv({ cls: 'modal-button-container' });
		const closeBtn = buttonContainer.createEl('button', { text: 'Close' });
		closeBtn.addEventListener('click', () => this.close());
	}

	private async saveCalendar() {
		const { result } = this;
		if (!result.success || !result.calendar) {
			new Notice('Cannot save: calendar validation failed');
			return;
		}

		try {
			const calendar = result.calendar;

			// Save to config/calendars/{id}.yaml
			const calendarPath = `${this.plugin.manifest.dir}/config/calendars/${calendar.id}.yaml`;

			// Convert calendar to YAML
			const yaml = this.calendarToYAML(calendar);

			// Check if file exists
			const existingFile = this.app.vault.getAbstractFileByPath(calendarPath);
			if (existingFile instanceof TFile) {
				// Overwrite existing file
				await this.app.vault.modify(existingFile, yaml);
				new Notice(`Calendar "${calendar.name}" updated successfully`);
			} else {
				// Create new file (create directories if needed)
				const dirPath = calendarPath.substring(0, calendarPath.lastIndexOf('/'));
				const dirExists = this.app.vault.getAbstractFileByPath(dirPath);
				if (!dirExists) {
					await this.app.vault.createFolder(dirPath);
				}

				await this.app.vault.create(calendarPath, yaml);
				new Notice(`Calendar "${calendar.name}" imported successfully`);
			}

		} catch (error) {
			console.error('[Import Calendar] Save failed:', error);
			new Notice(`Failed to save calendar: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	private calendarToYAML(calendar: any): string {
		// Simple YAML serialization
		// In production, use a proper YAML library like js-yaml
		const lines: string[] = [];

		lines.push(`id: ${calendar.id}`);
		lines.push(`name: ${calendar.name}`);
		if (calendar.description) {
			lines.push(`description: ${calendar.description}`);
		}
		if (calendar.startingYear !== undefined) {
			lines.push(`startingYear: ${calendar.startingYear}`);
		}

		// Weekdays
		lines.push('weekdays:');
		calendar.weekdays.forEach((day: string) => {
			lines.push(`  - ${day}`);
		});

		// Months
		lines.push('months:');
		calendar.months.forEach((month: any) => {
			lines.push(`  - name: ${month.name}`);
			lines.push(`    days: ${month.days}`);
			if (month.type) {
				lines.push(`    type: ${month.type}`);
			}
		});

		// Holidays
		if (calendar.holidays.length > 0) {
			lines.push('holidays:');
			calendar.holidays.forEach((holiday: any) => {
				lines.push(`  - name: ${holiday.name}`);
				if (holiday.description) {
					lines.push(`    description: ${holiday.description}`);
				}
				if (holiday.month !== undefined) {
					lines.push(`    month: ${holiday.month}`);
					lines.push(`    day: ${holiday.day}`);
				} else if (holiday.dayOfYear !== undefined) {
					lines.push(`    dayOfYear: ${holiday.dayOfYear}`);
				}
				if (holiday.notifyOnArrival) {
					lines.push(`    notifyOnArrival: true`);
				}
			});
		}

		// Leap rules (complex, skip for now - would need proper YAML serialization)
		// Seasons (skip for now - would need proper YAML serialization)
		// Eras (skip for now - would need proper YAML serialization)

		return lines.join('\n');
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

/**
 * Import Calendar Command
 *
 * Opens file picker to select Fantasy-Calendar.com JSON file,
 * then shows preview modal with import results.
 */
export async function importCalendarCommand(app: App, plugin: QuartermasterPlugin) {
	// Get all JSON files in vault
	const files = app.vault.getFiles().filter(file => file.extension === 'json');

	if (files.length === 0) {
		new Notice('No JSON files found in vault. Please add a Fantasy-Calendar.com export first.');
		return;
	}

	// For now, just use the first JSON file found
	// In production, would show a file picker modal
	const file = files[0];

	try {
		// Read JSON file
		const jsonContent = await app.vault.read(file);

		// Import calendar
		const importer = new FantasyCalendarImporter();
		const result = importer.import(jsonContent);

		// Show preview modal
		const preview = new ImportCalendarPreviewModal(app, plugin, result);
		preview.open();

	} catch (error) {
		console.error('[Import Calendar] Failed:', error);
		new Notice(`Failed to import calendar: ${error instanceof Error ? error.message : String(error)}`);
	}
}
