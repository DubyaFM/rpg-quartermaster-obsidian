/**
 * Export Player Job Board Modal
 *
 * Modal for exporting player-visible job board to markdown file
 * Allows GM to configure export options before generating
 *
 * @module ExportPlayerJobBoardModal
 */

import { Modal, App, Setting, Notice } from 'obsidian';
import { PlayerJobBoardExporter, ExportOptions } from '@quartermaster/core/services/PlayerJobBoardExporter';
import type QuartermasterPlugin from '../main';

export class ExportPlayerJobBoardModal extends Modal {
	plugin: QuartermasterPlugin;
	exporter: PlayerJobBoardExporter;

	// Export options
	title: string = 'Job Board';
	groupByStatus: boolean = true;
	groupByLocation: boolean = false;
	showExpirationWarnings: boolean = true;
	outputPath: string = 'Job-Board-Player-View.md';

	constructor(app: App, plugin: QuartermasterPlugin) {
		super(app);
		this.plugin = plugin;

		// Create exporter with player view settings
		const config = {
			showReputationImpacts: this.plugin.settings.playerViewShowReputationImpacts,
			showPrerequisites: this.plugin.settings.playerViewShowPrerequisites,
			showExactTimeRemaining: this.plugin.settings.playerViewShowExactTimeRemaining
		};
		this.exporter = new PlayerJobBoardExporter(config);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('export-player-job-board-modal');

		contentEl.createEl('h2', { text: 'Export Player Job Board' });

		contentEl.createEl('p', {
			text: 'Generate a markdown file showing player-visible jobs',
			cls: 'setting-item-description'
		});

		// Document title
		new Setting(contentEl)
			.setName('Document Title')
			.setDesc('Title for the exported job board')
			.addText(text => text
				.setPlaceholder('Job Board')
				.setValue(this.title)
				.onChange(value => {
					this.title = value;
				}));

		// Output file path
		new Setting(contentEl)
			.setName('Output File Path')
			.setDesc('Where to save the exported markdown file')
			.addText(text => text
				.setPlaceholder('Job-Board-Player-View.md')
				.setValue(this.outputPath)
				.onChange(value => {
					this.outputPath = value;
				}));

		// Group by options
		const groupSection = contentEl.createDiv({ cls: 'setting-item-heading' });
		groupSection.createEl('h3', { text: 'Organization' });

		new Setting(contentEl)
			.setName('Group by Status')
			.setDesc('Group jobs into "Available" and "In Progress" sections')
			.addToggle(toggle => toggle
				.setValue(this.groupByStatus)
				.onChange(value => {
					this.groupByStatus = value;
					if (value) {
						this.groupByLocation = false;
					}
				}));

		new Setting(contentEl)
			.setName('Group by Location')
			.setDesc('Group jobs by their location/region')
			.addToggle(toggle => toggle
				.setValue(this.groupByLocation)
				.onChange(value => {
					this.groupByLocation = value;
					if (value) {
						this.groupByStatus = false;
					}
				}));

		// Display options
		const displaySection = contentEl.createDiv({ cls: 'setting-item-heading' });
		displaySection.createEl('h3', { text: 'Display Options' });

		new Setting(contentEl)
			.setName('Show Expiration Warnings')
			.setDesc('Highlight jobs that are expiring soon or past deadline')
			.addToggle(toggle => toggle
				.setValue(this.showExpirationWarnings)
				.onChange(value => {
					this.showExpirationWarnings = value;
				}));

		// Action buttons
		const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });

		const exportBtn = buttonContainer.createEl('button', {
			text: 'Export to File',
			cls: 'mod-cta'
		});
		exportBtn.onclick = async () => {
			await this.exportToFile();
		};

		const previewBtn = buttonContainer.createEl('button', {
			text: 'Copy to Clipboard'
		});
		previewBtn.onclick = async () => {
			await this.copyToClipboard();
		};

		const cancelBtn = buttonContainer.createEl('button', {
			text: 'Cancel'
		});
		cancelBtn.onclick = () => {
			this.close();
		};
	}

	private async exportToFile() {
		try {
			// Load all jobs
			const allJobs = await this.plugin.jobFileHandler.getAllJobs();

			// Get current calendar day if available
			let currentDay = 0;
			try {
				currentDay = this.plugin.settings.calendarState?.currentDay ?? 0;
			} catch (error) {
				// Calendar not available, use 0
			}

			// Generate markdown
			const options: ExportOptions = {
				title: this.title,
				groupByStatus: this.groupByStatus,
				groupByLocation: this.groupByLocation,
				showExpirationWarnings: this.showExpirationWarnings,
				currentDay
			};

			const markdown = this.exporter.exportToMarkdown(allJobs, options);

			// Save to file
			const filePath = this.outputPath.endsWith('.md') ? this.outputPath : `${this.outputPath}.md`;

			// Check if file exists
			const existingFile = this.app.vault.getAbstractFileByPath(filePath);
			if (existingFile) {
				// Overwrite existing file
				await this.app.vault.modify(existingFile as any, markdown);
				new Notice(`Player job board exported to ${filePath} (overwritten)`);
			} else {
				// Create new file
				await this.app.vault.create(filePath, markdown);
				new Notice(`Player job board exported to ${filePath}`);
			}

			this.close();
		} catch (error) {
			console.error('[ExportPlayerJobBoardModal] Export failed:', error);
			new Notice(`Export failed: ${error.message}`);
		}
	}

	private async copyToClipboard() {
		try {
			// Load all jobs
			const allJobs = await this.plugin.jobFileHandler.getAllJobs();

			// Get current calendar day if available
			let currentDay = 0;
			try {
				currentDay = this.plugin.settings.calendarState?.currentDay ?? 0;
			} catch (error) {
				// Calendar not available, use 0
			}

			// Generate markdown
			const options: ExportOptions = {
				title: this.title,
				groupByStatus: this.groupByStatus,
				groupByLocation: this.groupByLocation,
				showExpirationWarnings: this.showExpirationWarnings,
				currentDay
			};

			const markdown = this.exporter.exportToMarkdown(allJobs, options);

			// Copy to clipboard
			await navigator.clipboard.writeText(markdown);
			new Notice('Player job board copied to clipboard');
		} catch (error) {
			console.error('[ExportPlayerJobBoardModal] Copy failed:', error);
			new Notice(`Copy failed: ${error.message}`);
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
