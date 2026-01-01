// Event table builder for random stronghold events
import { Modal, App, Setting, Notice } from 'obsidian';
import { CustomEventTable, EventTableEntry } from '@quartermaster/core/models/stronghold';
import type QuartermasterPlugin from '../../main';

export class EventTableCreatorModal extends Modal {
	plugin: QuartermasterPlugin;
	eventTable: Partial<CustomEventTable> = {
		diceType: 'd100',
		events: []
	};
	availableTables: string[] = [];

	constructor(app: App, plugin: QuartermasterPlugin, existingTable?: CustomEventTable) {
		super(app);
		this.plugin = plugin;
		if (existingTable) {
			this.eventTable = { ...existingTable };
		}
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('event-table-creator-modal');

		contentEl.createEl('h2', { text: 'Event Table Creator' });

		await this.loadAvailableTables();
		this.renderBasicInfo(contentEl);
		this.renderEventsInfo(contentEl);
		this.renderValidation(contentEl);
		this.renderActions(contentEl);
	}

	async loadAvailableTables() {
		try {
			const tables = await this.plugin.dataAdapter.loadEventTables();
			this.availableTables = tables.map(t => t.id);
		} catch (error) {
			console.error('Failed to load event tables:', error);
		}
	}

	renderBasicInfo(container: HTMLElement) {
		const section = container.createDiv({ cls: 'event-table-basic-info' });
		section.createEl('h3', { text: 'Basic Information' });

		new Setting(section)
			.setName('Table ID')
			.setDesc('Unique identifier (e.g., stronghold_events, random_encounters)')
			.addText(text => text
				.setPlaceholder('table_id')
				.setValue(this.eventTable.id || '')
				.onChange(value => {
					this.eventTable.id = value;
				}));

		new Setting(section)
			.setName('Name')
			.setDesc('Display name of the event table')
			.addText(text => text
				.setPlaceholder('Stronghold Events')
				.setValue(this.eventTable.name || '')
				.onChange(value => {
					this.eventTable.name = value;
				}));

		new Setting(section)
			.setName('Description')
			.setDesc('Optional description of when to use this table')
			.addTextArea(text => {
				text.setPlaceholder('Roll on this table when checking for stronghold events')
					.setValue(this.eventTable.description || '')
					.onChange(value => {
						this.eventTable.description = value;
					});
				text.inputEl.rows = 2;
			});

		new Setting(section)
			.setName('Dice Type')
			.setDesc('Type of dice to roll for this table')
			.addDropdown(dropdown => dropdown
				.addOption('d100', 'd100')
				.addOption('d20', 'd20')
				.addOption('d12', 'd12')
				.addOption('d10', 'd10')
				.addOption('d8', 'd8')
				.addOption('d6', 'd6')
				.addOption('d4', 'd4')
				.setValue(this.eventTable.diceType || 'd100')
				.onChange(value => {
					this.eventTable.diceType = value as any;
				}));
	}

	renderEventsInfo(container: HTMLElement) {
		const section = container.createDiv({ cls: 'event-table-events-info' });
		section.createEl('h3', { text: 'Event Entries' });

		if (!this.eventTable.events) {
			this.eventTable.events = [];
		}

		const eventsList = section.createDiv({ cls: 'events-list' });

		if (this.eventTable.events.length === 0) {
			eventsList.createEl('p', { text: 'No events configured yet' });
		} else {
			const table = eventsList.createEl('table', { cls: 'event-entries-table' });
			const thead = table.createEl('thead');
			const headerRow = thead.createEl('tr');
			headerRow.createEl('th', { text: 'Range' });
			headerRow.createEl('th', { text: 'Event' });
			headerRow.createEl('th', { text: 'Type' });
			headerRow.createEl('th', { text: 'Actions' });

			const tbody = table.createEl('tbody');
			this.eventTable.events.forEach((event, index) => {
				const row = tbody.createEl('tr');
				row.createEl('td', { text: `${event.rollRange.min}-${event.rollRange.max}` });
				row.createEl('td', { text: event.eventName });
				row.createEl('td', { text: event.resultType });

				const actionsCell = row.createEl('td');
				actionsCell.createEl('button', { text: 'Remove' })
					.addEventListener('click', () => {
						this.eventTable.events?.splice(index, 1);
						this.onOpen();
					});
			});
		}

		section.createEl('h4', { text: 'Add New Event' });

		const newEventForm = section.createDiv({ cls: 'new-event-form' });

		let newEvent: Partial<EventTableEntry> = {
			rollRange: { min: 1, max: 1 },
			resultType: 'narrative'
		};

		new Setting(newEventForm)
			.setName('Roll Range')
			.setDesc('Min and max values for this event')
			.addText(text => text
				.setPlaceholder('Min')
				.setValue(newEvent.rollRange?.min.toString() || '1')
				.onChange(value => {
					const num = parseInt(value);
					if (!isNaN(num) && num > 0) {
						if (!newEvent.rollRange) {
							newEvent.rollRange = { min: num, max: num };
						} else {
							newEvent.rollRange.min = num;
						}
					}
				}))
			.addText(text => text
				.setPlaceholder('Max')
				.setValue(newEvent.rollRange?.max.toString() || '1')
				.onChange(value => {
					const num = parseInt(value);
					if (!isNaN(num) && num > 0) {
						if (!newEvent.rollRange) {
							newEvent.rollRange = { min: 1, max: num };
						} else {
							newEvent.rollRange.max = num;
						}
					}
				}));

		new Setting(newEventForm)
			.setName('Event Name')
			.setDesc('Short name for this event')
			.addText(text => text
				.setPlaceholder('Merchant Arrives')
				.setValue(newEvent.eventName || '')
				.onChange(value => {
					newEvent.eventName = value;
				}));

		new Setting(newEventForm)
			.setName('Event Description')
			.setDesc('Detailed description of what happens')
			.addTextArea(text => {
				text.setPlaceholder('A traveling merchant arrives at the stronghold with rare goods')
					.setValue(newEvent.description || '')
					.onChange(value => {
						newEvent.description = value;
					});
				text.inputEl.rows = 3;
			});

		new Setting(newEventForm)
			.setName('Result Type')
			.setDesc('Is this a narrative event or does it trigger another table?')
			.addDropdown(dropdown => dropdown
				.addOption('narrative', 'Narrative (text only)')
				.addOption('trigger_event', 'Trigger Event (roll on nested table)')
				.setValue(newEvent.resultType || 'narrative')
				.onChange(value => {
					newEvent.resultType = value as 'narrative' | 'trigger_event';
					this.onOpen();
				}));

		if (newEvent.resultType === 'trigger_event') {
			new Setting(newEventForm)
				.setName('Nested Table ID')
				.setDesc('ID of event table to roll on (max 1 level)')
				.addDropdown(dropdown => {
					dropdown.addOption('', '-- Select Table --');
					this.availableTables.forEach(tableId => {
						dropdown.addOption(tableId, tableId);
					});
					dropdown.setValue(newEvent.nestedTableId || '');
					dropdown.onChange(value => {
						newEvent.nestedTableId = value || undefined;
					});
					return dropdown;
				});
		}

		new Setting(newEventForm)
			.addButton(btn => btn
				.setButtonText('Add Event')
				.onClick(() => {
					// Validation
					if (!newEvent.eventName || !newEvent.description || !newEvent.rollRange) {
						new Notice('Please fill in all event fields');
						return;
					}

					if (newEvent.rollRange.min > newEvent.rollRange.max) {
						new Notice('Min cannot be greater than max');
						return;
					}

					if (newEvent.resultType === 'trigger_event' && !newEvent.nestedTableId) {
						new Notice('Please select a nested table for trigger_event type');
						return;
					}

					const entry: EventTableEntry = {
						id: `event_${Date.now()}`,
						rollRange: newEvent.rollRange,
						eventName: newEvent.eventName!,
						description: newEvent.description!,
						resultType: newEvent.resultType || 'narrative',
						nestedTableId: newEvent.nestedTableId
					};

					this.eventTable.events?.push(entry);
					this.onOpen();
				}));
	}

	renderValidation(container: HTMLElement) {
		const section = container.createDiv({ cls: 'event-table-validation' });
		section.createEl('h3', { text: 'Validation' });

		const validationResults = this.validateEventTable();

		if (validationResults.errors.length === 0 && validationResults.warnings.length === 0) {
			section.createEl('p', { text: '✓ No validation issues found', cls: 'validation-success' });
		} else {
			if (validationResults.errors.length > 0) {
				const errorsList = section.createDiv({ cls: 'validation-errors' });
				errorsList.createEl('strong', { text: 'Errors:' });
				const ul = errorsList.createEl('ul');
				validationResults.errors.forEach(error => {
					ul.createEl('li', { text: error, cls: 'error' });
				});
			}

			if (validationResults.warnings.length > 0) {
				const warningsList = section.createDiv({ cls: 'validation-warnings' });
				warningsList.createEl('strong', { text: 'Warnings:' });
				const ul = warningsList.createEl('ul');
				validationResults.warnings.forEach(warning => {
					ul.createEl('li', { text: warning, cls: 'warning' });
				});
			}
		}
	}

	validateEventTable(): { errors: string[], warnings: string[] } {
		const errors: string[] = [];
		const warnings: string[] = [];

		if (!this.eventTable.events || this.eventTable.events.length === 0) {
			warnings.push('No events configured');
			return { errors, warnings };
		}

		const diceMax = this.getDiceMax(this.eventTable.diceType || 'd100');
		const coveredValues = new Set<number>();

		// Check for overlaps and out-of-range values
		this.eventTable.events.forEach((event, index) => {
			if (event.rollRange.max > diceMax) {
				errors.push(`Event ${index + 1}: max value ${event.rollRange.max} exceeds dice max ${diceMax}`);
			}

			for (let i = event.rollRange.min; i <= event.rollRange.max; i++) {
				if (coveredValues.has(i)) {
					errors.push(`Overlapping range detected at value ${i}`);
				}
				coveredValues.add(i);
			}

			// Check nesting depth
			if (event.resultType === 'trigger_event') {
				// In a real implementation, we'd check if nested table also has trigger_event entries
				// For now, just warn about potential depth issues
				warnings.push(`Event ${index + 1} triggers nested table. Ensure max 1 level nesting.`);
			}
		});

		// Check for gaps
		const allCovered = [];
		for (let i = 1; i <= diceMax; i++) {
			if (!coveredValues.has(i)) {
				allCovered.push(i);
			}
		}

		if (allCovered.length > 0 && allCovered.length < diceMax) {
			warnings.push(`Gaps found in coverage. Uncovered values: ${allCovered.length} total`);
		}

		return { errors, warnings };
	}

	getDiceMax(diceType: string): number {
		const maxValues: { [key: string]: number } = {
			'd100': 100,
			'd20': 20,
			'd12': 12,
			'd10': 10,
			'd8': 8,
			'd6': 6,
			'd4': 4
		};
		return maxValues[diceType] || 100;
	}

	renderActions(container: HTMLElement) {
		const actionsContainer = container.createDiv({ cls: 'modal-button-container' });

		new Setting(actionsContainer)
			.addButton(btn => btn
				.setButtonText('Cancel')
				.onClick(() => {
					this.close();
				}))
			.addButton(btn => btn
				.setButtonText('Save Event Table')
				.setCta()
				.onClick(async () => {
					await this.saveEventTable();
				}));
	}

	async saveEventTable() {
		// Validation
		if (!this.eventTable.id || this.eventTable.id.trim() === '') {
			new Notice('Table ID is required');
			return;
		}

		if (!this.eventTable.name || this.eventTable.name.trim() === '') {
			new Notice('Table name is required');
			return;
		}

		const validationResults = this.validateEventTable();
		if (validationResults.errors.length > 0) {
			new Notice('Cannot save: validation errors present. See validation section.');
			return;
		}

		try {
			const customEventTable: CustomEventTable = {
				id: this.eventTable.id!,
				name: this.eventTable.name!,
				description: this.eventTable.description,
				diceType: this.eventTable.diceType || 'd100',
				events: this.eventTable.events || [],
				metadata: {
					createdDate: this.eventTable.metadata?.createdDate || new Date().toISOString(),
					lastModified: new Date().toISOString()
				}
			};

			await this.plugin.dataAdapter.saveEventTable(customEventTable);

			new Notice(`Event table "${customEventTable.name}" saved successfully!`);
			this.close();
		} catch (error) {
			console.error('Failed to save event table:', error);
			new Notice('Failed to save event table. See console for details.');
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
