/**
 * Add Event Modal - Create campaign-scope events in Obsidian
 *
 * Features:
 * - Create Fixed Date or One-off events
 * - Date picker with intercalary day support
 * - Simple events only (complex chain events via YAML editing)
 * - Saves to campaign events file via ObsidianEventDefinitionAdapter
 *
 * **Phase 7 - TKT-CAL-056**
 */

import { Modal, App, Setting, Notice } from 'obsidian';
import type QuartermasterPlugin from '../main';

interface DateOption {
	label: string;
	value: string;
	isIntercalary: boolean;
	monthIndex?: number;
	dayOfMonth?: number;
	intercalaryName?: string;
}

export class AddEventModal extends Modal {
	private plugin: QuartermasterPlugin;
	private name: string = '';
	private eventType: 'recurring' | 'one-off' = 'recurring';
	private selectedDate: string = '';
	private year: number | undefined;
	private description: string = '';
	private dateOptions: DateOption[] = [];

	constructor(app: App, plugin: QuartermasterPlugin) {
		super(app);
		this.plugin = plugin;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('quartermaster-add-event-modal');

		contentEl.createEl('h2', { text: 'Add Campaign Event' });

		// Build date options from active calendar
		await this.buildDateOptions();

		this.renderForm();
	}

	/**
	 * Build date picker options from active calendar definition
	 */
	private async buildDateOptions(): Promise<void> {
		try {
			// Get calendar service
			const calendarService = this.plugin.dataAdapter.getCalendarService?.();
			if (!calendarService) {
				console.warn('[AddEventModal] Calendar service not available');
				return;
			}

			// Get state to find active calendar ID
			const state = calendarService.getState();
			if (!state || !state.activeCalendarId) {
				console.warn('[AddEventModal] No active calendar ID in state');
				return;
			}

			// Get calendar definition manager from adapter
			const calendarDefManager = (this.plugin.dataAdapter as any).calendarDefinitionManager;
			if (!calendarDefManager) {
				console.warn('[AddEventModal] Calendar definition manager not available');
				return;
			}

			// Get the active calendar definition
			const calendarDef = calendarDefManager.getDefinition(state.activeCalendarId);
			if (!calendarDef) {
				console.warn('[AddEventModal] No calendar definition found for:', state.activeCalendarId);
				return;
			}

			// Build options from months
			this.dateOptions = [];

			calendarDef.months.forEach((month: any, monthIndex: number) => {
				// Check if this is an intercalary month
				if (month.type === 'intercalary') {
					// Intercalary days are special - add as standalone options
					for (let day = 1; day <= month.days; day++) {
						const dayName = month.intercalaryDays?.[day - 1] || `${month.name} Day ${day}`;
						this.dateOptions.push({
							label: `${dayName} (Intercalary)`,
							value: `intercalary-${month.name}-${day}`,
							isIntercalary: true,
							intercalaryName: dayName
						});
					}
				} else {
					// Standard month - add all days
					for (let day = 1; day <= month.days; day++) {
						this.dateOptions.push({
							label: `${month.name} ${day}`,
							value: `${monthIndex}-${day}`,
							isIntercalary: false,
							monthIndex,
							dayOfMonth: day
						});
					}
				}
			});

			console.log(`[AddEventModal] Built ${this.dateOptions.length} date options`);
		} catch (error) {
			console.error('[AddEventModal] Error building date options:', error);
			new Notice('Error loading calendar dates. Check console for details.');
		}
	}

	/**
	 * Render the form UI
	 */
	private renderForm(): void {
		const { contentEl } = this;

		// Event Name
		new Setting(contentEl)
			.setName('Event Name')
			.setDesc('A descriptive name for this event')
			.addText(text => text
				.setPlaceholder('e.g., Midsummer Festival')
				.setValue(this.name)
				.onChange(value => {
					this.name = value;
				}));

		// Event Type
		const typeSection = contentEl.createDiv({ cls: 'event-type-section' });
		typeSection.style.marginTop = '16px';
		typeSection.style.marginBottom = '16px';

		typeSection.createEl('h4', { text: 'Event Type' });

		new Setting(typeSection)
			.setName('Fixed Date (Recurring)')
			.setDesc('Repeats every year on the same date (e.g., holidays)')
			.addToggle(toggle => toggle
				.setValue(this.eventType === 'recurring')
				.onChange(value => {
					if (value) {
						this.eventType = 'recurring';
						this.refreshForm();
					}
				}));

		new Setting(typeSection)
			.setName('One-Off Event')
			.setDesc('Occurs only once on a specific year')
			.addToggle(toggle => toggle
				.setValue(this.eventType === 'one-off')
				.onChange(value => {
					if (value) {
						this.eventType = 'one-off';
						this.refreshForm();
					}
				}));

		// Date Picker
		new Setting(contentEl)
			.setName('Event Date')
			.setDesc('Select the date when this event occurs')
			.addDropdown(dropdown => {
				dropdown.addOption('', 'Select a date...');

				// Add all date options
				this.dateOptions.forEach(option => {
					dropdown.addOption(option.value, option.label);
				});

				dropdown.setValue(this.selectedDate);
				dropdown.onChange(value => {
					this.selectedDate = value;
				});
			});

		// Year (for one-off events)
		if (this.eventType === 'one-off') {
			new Setting(contentEl)
				.setName('Year')
				.setDesc('The specific year when this event occurs')
				.addText(text => text
					.setPlaceholder('e.g., 1492')
					.setValue(this.year?.toString() || '')
					.onChange(value => {
						const parsed = parseInt(value);
						this.year = isNaN(parsed) ? undefined : parsed;
					}));
		}

		// Description
		new Setting(contentEl)
			.setName('Description')
			.setDesc('Optional notes about this event')
			.addTextArea(text => text
				.setPlaceholder('Add notes about this event...')
				.setValue(this.description)
				.onChange(value => {
					this.description = value;
				}));

		// Information box
		const infoBox = contentEl.createDiv({ cls: 'quartermaster-info-box' });
		infoBox.style.padding = '12px';
		infoBox.style.backgroundColor = 'var(--background-modifier-border)';
		infoBox.style.borderRadius = '4px';
		infoBox.style.marginTop = '16px';
		infoBox.style.marginBottom = '16px';

		infoBox.createEl('strong', { text: 'ℹ️ Note: ' });
		infoBox.createEl('span', {
			text: 'This creates a simple fixed-date event. For complex events (chain events, conditional events, effects), edit the YAML files directly in config/events/.'
		});

		// Action Buttons
		const buttonDiv = contentEl.createDiv({ cls: 'modal-button-container' });
		buttonDiv.style.marginTop = '16px';
		buttonDiv.style.display = 'flex';
		buttonDiv.style.gap = '8px';
		buttonDiv.style.justifyContent = 'flex-end';

		const cancelBtn = buttonDiv.createEl('button', { text: 'Cancel' });
		cancelBtn.onclick = () => this.close();

		const createBtn = buttonDiv.createEl('button', {
			text: 'Create Event',
			cls: 'mod-cta'
		});
		createBtn.onclick = async () => await this.handleSubmit();
	}

	/**
	 * Refresh the form (e.g., when event type changes)
	 */
	private refreshForm(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: 'Add Campaign Event' });
		this.renderForm();
	}

	/**
	 * Handle form submission
	 */
	private async handleSubmit(): Promise<void> {
		try {
			// Validate
			if (!this.name.trim()) {
				new Notice('Please enter an event name');
				return;
			}

			if (!this.selectedDate) {
				new Notice('Please select a date');
				return;
			}

			// Parse selected date
			const selectedOption = this.dateOptions.find(opt => opt.value === this.selectedDate);
			if (!selectedOption) {
				new Notice('Invalid date selected');
				return;
			}

			// Validate year for one-off events
			if (this.eventType === 'one-off' && !this.year) {
				new Notice('Please enter a year for one-off events');
				return;
			}

			// Build event definition
			const eventId = `event-${Date.now()}`;
			const eventDef: any = {
				id: eventId,
				name: this.name.trim(),
				type: 'fixed',
				date: {
					month: selectedOption.monthIndex ?? 0,
					day: selectedOption.dayOfMonth ?? 1
				},
				duration: 1,
				priority: 10,
				effects: {},
				description: this.description.trim() || undefined
			};

			// Add year for one-off events
			if (this.eventType === 'one-off' && this.year) {
				eventDef.date.year = this.year;
			}

			// Add intercalary name if applicable
			if (selectedOption.isIntercalary && selectedOption.intercalaryName) {
				eventDef.date.intercalaryName = selectedOption.intercalaryName;
			}

			// Save event to campaign events file
			await this.saveEvent(eventDef);

			new Notice(`Event "${this.name}" created successfully!`);
			this.close();
		} catch (error) {
			console.error('[AddEventModal] Error creating event:', error);
			new Notice(`Failed to create event: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Save event to campaign events file
	 * @private
	 */
	private async saveEvent(eventDef: any): Promise<void> {
		try {
			// Get active campaign ID
			const campaignId = await this.plugin.adapterFactory.getActiveCampaignId();
			if (!campaignId) {
				throw new Error('No active campaign');
			}

			// Path to campaign events file
			const eventsPath = `campaigns/${campaignId}/events.json`;

			// Read existing events or create new array
			let events: any[] = [];
			const fileExists = await this.app.vault.adapter.exists(eventsPath);

			if (fileExists) {
				const content = await this.app.vault.adapter.read(eventsPath);
				const parsed = JSON.parse(content);

				// Support both array and object with events property
				if (Array.isArray(parsed)) {
					events = parsed;
				} else if (parsed.events && Array.isArray(parsed.events)) {
					events = parsed.events;
				}
			}

			// Add new event
			events.push(eventDef);

			// Write back to file
			const jsonContent = JSON.stringify({ events }, null, 2);
			await this.app.vault.adapter.write(eventsPath, jsonContent);

			// Invalidate event definition cache so it reloads
			const eventAdapter = this.plugin.currentAdapters?.eventDefinitionAdapter;
			if (eventAdapter && 'invalidateDefinitionCache' in eventAdapter) {
				await (eventAdapter as any).invalidateDefinitionCache();
			}

			console.log(`[AddEventModal] Saved event to ${eventsPath}`);
		} catch (error) {
			console.error('[AddEventModal] Error saving event:', error);
			throw error;
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
