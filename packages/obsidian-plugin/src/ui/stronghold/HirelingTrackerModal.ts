// Hireling roster management modal
import { Modal, App, Setting, Notice } from 'obsidian';
import { Hireling } from '@quartermaster/core/models/stronghold';
import type QuartermasterPlugin from '../../main';

export class HirelingTrackerModal extends Modal {
	plugin: QuartermasterPlugin;
	hirelings: Hireling[] = [];
	statusFilter: 'all' | 'at_stronghold' | 'missing' | 'deceased' = 'all';
	editingHireling: Hireling | null = null;

	constructor(app: App, plugin: QuartermasterPlugin) {
		super(app);
		this.plugin = plugin;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('hireling-tracker-modal');

		contentEl.createEl('h2', { text: 'Hireling Tracker' });

		await this.loadHirelings();
		this.renderFilters(contentEl);
		this.renderHirelingList(contentEl);
		if (this.editingHireling) {
			this.renderHirelingForm(contentEl);
		}
		this.renderActions(contentEl);
	}

	async loadHirelings() {
		try {
			this.hirelings = await this.plugin.dataAdapter.loadStrongholdHirelings?.() || [];
		} catch (error) {
			console.error('Failed to load hirelings:', error);
			new Notice('Failed to load hirelings');
		}
	}

	renderFilters(container: HTMLElement) {
		const filterContainer = container.createDiv({ cls: 'hireling-filters' });

		new Setting(filterContainer)
			.setName('Filter by Status')
			.addDropdown(dropdown => dropdown
				.addOption('all', 'All')
				.addOption('at_stronghold', 'At Stronghold')
				.addOption('missing', 'Missing')
				.addOption('deceased', 'Deceased')
				.setValue(this.statusFilter)
				.onChange(async (value) => {
					this.statusFilter = value as any;
					await this.onOpen();
				}));
	}

	renderHirelingList(container: HTMLElement) {
		const listContainer = container.createDiv({ cls: 'hireling-list-container' });
		listContainer.createEl('h3', { text: 'Hirelings' });

		const filteredHirelings = this.hirelings.filter(h => {
			if (this.statusFilter === 'all') return true;
			return h.identity.status === this.statusFilter;
		});

		if (filteredHirelings.length === 0) {
			listContainer.createEl('p', { text: 'No hirelings found' });
		} else {
			const table = listContainer.createEl('table', { cls: 'hirelings-table' });
			const thead = table.createEl('thead');
			const headerRow = thead.createEl('tr');
			headerRow.createEl('th', { text: 'Name' });
			headerRow.createEl('th', { text: 'Role' });
			headerRow.createEl('th', { text: 'Status' });
			headerRow.createEl('th', { text: 'Morale' });
			headerRow.createEl('th', { text: 'Assignment' });
			headerRow.createEl('th', { text: 'Actions' });

			const tbody = table.createEl('tbody');
			filteredHirelings.forEach(hireling => {
				const row = tbody.createEl('tr');
				row.createEl('td', { text: hireling.identity.name });
				row.createEl('td', { text: hireling.identity.role });
				row.createEl('td', { text: hireling.identity.status });
				row.createEl('td', { text: `${hireling.morale.value}/${hireling.morale.scale.max}` });

				const assignmentCell = row.createEl('td');
				if (hireling.assignedStrongholdId) {
					assignmentCell.appendText(`Stronghold: ${hireling.assignedStrongholdId}`);
				}
				if (hireling.assignedFacilityId) {
					assignmentCell.appendText(`Facility: ${hireling.assignedFacilityId}`);
				}
				if (!hireling.assignedStrongholdId && !hireling.assignedFacilityId) {
					assignmentCell.appendText('Unassigned');
				}

				const actionsCell = row.createEl('td');
				actionsCell.createEl('button', { text: 'Edit' })
					.addEventListener('click', () => {
						this.editingHireling = hireling;
						this.onOpen();
					});

				actionsCell.createEl('button', { text: 'Remove' })
					.addEventListener('click', async () => {
						await this.removeHireling(hireling.id);
					});
			});
		}

		new Setting(listContainer)
			.addButton(btn => btn
				.setButtonText('Add Hireling')
				.onClick(() => {
					this.editingHireling = {
						id: `hireling_${Date.now()}`,
						identity: {
							name: '',
							role: '',
							status: 'at_stronghold'
						},
						mechanics: {},
						morale: {
							value: 10,
							scale: { min: 0, max: 20 }
						},
						payment: {
							type: 'stronghold_staff',
							schedule: 'manual',
							amount: { gold: 0, silver: 0, copper: 0 }
						},
						metadata: {
							createdDate: new Date().toISOString(),
							lastModified: new Date().toISOString()
						}
					};
					this.onOpen();
				}));
	}

	renderHirelingForm(container: HTMLElement) {
		if (!this.editingHireling) return;

		const section = container.createDiv({ cls: 'hireling-form-section' });
		section.createEl('h3', {
			text: this.editingHireling.identity.name ? `Edit ${this.editingHireling.identity.name}` : 'New Hireling'
		});

		// Identity
		section.createEl('h4', { text: 'Identity' });

		new Setting(section)
			.setName('Name')
			.setDesc('Name of the hireling')
			.addText(text => text
				.setPlaceholder('Gorim Ironforge')
				.setValue(this.editingHireling?.identity.name || '')
				.onChange(value => {
					if (this.editingHireling) {
						this.editingHireling.identity.name = value;
					}
				}));

		new Setting(section)
			.setName('Role')
			.setDesc('Role or profession')
			.addText(text => text
				.setPlaceholder('Blacksmith')
				.setValue(this.editingHireling?.identity.role || '')
				.onChange(value => {
					if (this.editingHireling) {
						this.editingHireling.identity.role = value;
					}
				}));

		new Setting(section)
			.setName('Status')
			.setDesc('Current status')
			.addDropdown(dropdown => dropdown
				.addOption('at_stronghold', 'At Stronghold')
				.addOption('missing', 'Missing')
				.addOption('deceased', 'Deceased')
				.setValue(this.editingHireling?.identity.status || 'at_stronghold')
				.onChange(value => {
					if (this.editingHireling) {
						this.editingHireling.identity.status = value as any;
					}
				}));

		// Mechanics
		section.createEl('h4', { text: 'Mechanics' });

		new Setting(section)
			.setName('Stat Block')
			.setDesc('Link to stat block or creature type (optional)')
			.addText(text => text
				.setPlaceholder('[[Commoner]] or "Guard"')
				.setValue(this.editingHireling?.mechanics.statBlock || '')
				.onChange(value => {
					if (this.editingHireling) {
						this.editingHireling.mechanics.statBlock = value;
					}
				}));

		new Setting(section)
			.setName('Personality Notes')
			.setDesc('Optional notes about personality')
			.addTextArea(text => {
				text.setPlaceholder('Gruff but loyal, prefers action over words')
					.setValue(this.editingHireling?.mechanics.personalityNotes || '')
					.onChange(value => {
						if (this.editingHireling) {
							this.editingHireling.mechanics.personalityNotes = value;
						}
					});
				text.inputEl.rows = 2;
			});

		// Morale
		section.createEl('h4', { text: 'Morale' });

		new Setting(section)
			.setName('Morale Value')
			.setDesc('Current morale level')
			.addText(text => text
				.setPlaceholder('10')
				.setValue(this.editingHireling?.morale.value.toString() || '10')
				.onChange(value => {
					const num = parseInt(value);
					if (!isNaN(num) && this.editingHireling) {
						this.editingHireling.morale.value = num;
					}
				}));

		new Setting(section)
			.setName('Morale Scale')
			.setDesc('Min and max morale values')
			.addText(text => text
				.setPlaceholder('Min')
				.setValue(this.editingHireling?.morale.scale.min.toString() || '0')
				.onChange(value => {
					const num = parseInt(value);
					if (!isNaN(num) && this.editingHireling) {
						this.editingHireling.morale.scale.min = num;
					}
				}))
			.addText(text => text
				.setPlaceholder('Max')
				.setValue(this.editingHireling?.morale.scale.max.toString() || '20')
				.onChange(value => {
					const num = parseInt(value);
					if (!isNaN(num) && this.editingHireling) {
						this.editingHireling.morale.scale.max = num;
					}
				}));

		new Setting(section)
			.setName('Morale Notes')
			.setDesc('Optional notes about morale factors (optional)')
			.addText(text => text
				.setPlaceholder('Morale drops when unpaid')
				.setValue(this.editingHireling?.morale.notes || '')
				.onChange(value => {
					if (this.editingHireling) {
						this.editingHireling.morale.notes = value;
					}
				}));

		// Payment
		section.createEl('h4', { text: 'Payment' });

		new Setting(section)
			.setName('Payment Type')
			.addDropdown(dropdown => dropdown
				.addOption('mercenary', 'Mercenary')
				.addOption('stronghold_staff', 'Stronghold Staff')
				.setValue(this.editingHireling?.payment.type || 'stronghold_staff')
				.onChange(value => {
					if (this.editingHireling) {
						this.editingHireling.payment.type = value as any;
					}
				}));

		new Setting(section)
			.setName('Payment Schedule')
			.addDropdown(dropdown => dropdown
				.addOption('none', 'None')
				.addOption('manual', 'Manual')
				.addOption('daily', 'Daily')
				.addOption('weekly', 'Weekly')
				.setValue(this.editingHireling?.payment.schedule || 'manual')
				.onChange(value => {
					if (this.editingHireling) {
						this.editingHireling.payment.schedule = value as any;
					}
				}));

		new Setting(section)
			.setName('Payment Amount')
			.setDesc('Gold, silver, copper per payment')
			.addText(text => text
				.setPlaceholder('GP')
				.setValue(this.editingHireling?.payment.amount.gold.toString() || '0')
				.onChange(value => {
					const num = parseInt(value);
					if (!isNaN(num) && num >= 0 && this.editingHireling) {
						this.editingHireling.payment.amount.gold = num;
					}
				}))
			.addText(text => text
				.setPlaceholder('SP')
				.setValue(this.editingHireling?.payment.amount.silver.toString() || '0')
				.onChange(value => {
					const num = parseInt(value);
					if (!isNaN(num) && num >= 0 && this.editingHireling) {
						this.editingHireling.payment.amount.silver = num;
					}
				}))
			.addText(text => text
				.setPlaceholder('CP')
				.setValue(this.editingHireling?.payment.amount.copper.toString() || '0')
				.onChange(value => {
					const num = parseInt(value);
					if (!isNaN(num) && num >= 0 && this.editingHireling) {
						this.editingHireling.payment.amount.copper = num;
					}
				}));

		// Assignments
		section.createEl('h4', { text: 'Assignments' });

		new Setting(section)
			.setName('Assigned Stronghold')
			.setDesc('Optional stronghold assignment')
			.addText(text => text
				.setPlaceholder('stronghold_id')
				.setValue(this.editingHireling?.assignedStrongholdId || '')
				.onChange(value => {
					if (this.editingHireling) {
						this.editingHireling.assignedStrongholdId = value || undefined;
					}
				}));

		new Setting(section)
			.setName('Assigned Facility')
			.setDesc('Optional facility assignment')
			.addText(text => text
				.setPlaceholder('facility_id')
				.setValue(this.editingHireling?.assignedFacilityId || '')
				.onChange(value => {
					if (this.editingHireling) {
						this.editingHireling.assignedFacilityId = value || undefined;
					}
				}));

		new Setting(section)
			.addButton(btn => btn
				.setButtonText('Cancel')
				.onClick(() => {
					this.editingHireling = null;
					this.onOpen();
				}))
			.addButton(btn => btn
				.setButtonText('Save Hireling')
				.setCta()
				.onClick(async () => {
					await this.saveHireling();
				}));
	}

	async saveHireling() {
		if (!this.editingHireling) return;

		// Validation
		if (!this.editingHireling.identity.name || !this.editingHireling.identity.role) {
			new Notice('Name and role are required');
			return;
		}

		try {
			this.editingHireling.metadata.lastModified = new Date().toISOString();

			// Check if hireling already exists
			const existingIndex = this.hirelings.findIndex(h => h.id === this.editingHireling!.id);

			if (existingIndex >= 0) {
				// Update existing hireling
				this.hirelings[existingIndex] = this.editingHireling;
			} else {
				// Add new hireling
				this.hirelings.push(this.editingHireling);
			}

			// Save all hirelings
			await this.plugin.dataAdapter.saveStrongholdHirelings?.(this.hirelings);

			new Notice(`Hireling "${this.editingHireling.identity.name}" saved!`);
			this.editingHireling = null;
			await this.onOpen();
		} catch (error) {
			console.error('Failed to save hireling:', error);
			new Notice('Failed to save hireling. See console for details.');
		}
	}

	async removeHireling(hirelingId: string) {
		try {
			// Remove hireling from local array
			this.hirelings = this.hirelings.filter(h => h.id !== hirelingId);

			// Save updated hirelings list
			await this.plugin.dataAdapter.saveStrongholdHirelings?.(this.hirelings);

			new Notice('Hireling removed');
			await this.onOpen();
		} catch (error) {
			console.error('Failed to remove hireling:', error);
			new Notice('Failed to remove hireling');
		}
	}

	renderActions(container: HTMLElement) {
		const actionsContainer = container.createDiv({ cls: 'modal-button-container' });

		new Setting(actionsContainer)
			.addButton(btn => btn
				.setButtonText('Close')
				.onClick(() => {
					this.close();
				}));
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
