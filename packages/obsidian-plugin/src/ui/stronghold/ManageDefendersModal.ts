// Defender management modal
import { Modal, App, Setting, Notice } from 'obsidian';
import { Stronghold, SpecialDefender } from '@quartermaster/core/models/stronghold';
import type QuartermasterPlugin from '../../main';

export class ManageDefendersModal extends Modal {
	plugin: QuartermasterPlugin;
	stronghold: Stronghold;
	strongholdFilePath: string;
	editingDefender: SpecialDefender | null = null;

	constructor(
		app: App,
		plugin: QuartermasterPlugin,
		stronghold: Stronghold,
		strongholdFilePath: string
	) {
		super(app);
		this.plugin = plugin;
		this.stronghold = stronghold;
		this.strongholdFilePath = strongholdFilePath;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('manage-defenders-modal');

		contentEl.createEl('h2', { text: `Manage Defenders - ${this.stronghold.name}` });

		this.renderBasicDefenders(contentEl);
		this.renderSpecialDefenders(contentEl);
		if (this.editingDefender || this.editingDefender === null) {
			this.renderDefenderForm(contentEl);
		}
		this.renderActions(contentEl);
	}

	renderBasicDefenders(container: HTMLElement) {
		const section = container.createDiv({ cls: 'basic-defenders-section' });
		section.createEl('h3', { text: 'Basic Defenders' });

		const current = this.stronghold.defenders.basic.current;
		const max = this.stronghold.defenders.basic.maximum;

		const controlsDiv = section.createDiv({ cls: 'defender-controls' });

		new Setting(controlsDiv)
			.setName('Current Defenders')
			.setDesc(`Maximum: ${max}`)
			.addButton(btn => btn
				.setButtonText('-')
				.onClick(() => {
					if (this.stronghold.defenders.basic.current > 0) {
						this.stronghold.defenders.basic.current--;
						this.onOpen();
					}
				}))
			.addText(text => text
				.setValue(current.toString())
				.setDisabled(true)
				.then(textComponent => {
					textComponent.inputEl.style.width = '60px';
					textComponent.inputEl.style.textAlign = 'center';
				}))
			.addButton(btn => btn
				.setButtonText('+')
				.onClick(() => {
					if (this.stronghold.defenders.basic.current < this.stronghold.defenders.basic.maximum) {
						this.stronghold.defenders.basic.current++;
					} else {
						// Allow exceeding max if DM wants
						this.stronghold.defenders.basic.current++;
						this.stronghold.defenders.basic.maximum = this.stronghold.defenders.basic.current;
					}
					this.onOpen();
				}));

		new Setting(controlsDiv)
			.setName('Maximum Defenders')
			.setDesc('Set the maximum capacity')
			.addText(text => text
				.setValue(max.toString())
				.onChange(value => {
					const num = parseInt(value);
					if (!isNaN(num) && num >= 0) {
						this.stronghold.defenders.basic.maximum = num;
						if (this.stronghold.defenders.basic.current > num) {
							this.stronghold.defenders.basic.current = num;
						}
					}
				}));
	}

	renderSpecialDefenders(container: HTMLElement) {
		const section = container.createDiv({ cls: 'special-defenders-section' });
		section.createEl('h3', { text: 'Special Defenders' });

		if (this.stronghold.defenders.special.length === 0) {
			section.createEl('p', { text: 'No special defenders assigned yet' });
		} else {
			const table = section.createEl('table', { cls: 'special-defenders-table' });
			const thead = table.createEl('thead');
			const headerRow = thead.createEl('tr');
			headerRow.createEl('th', { text: 'Name' });
			headerRow.createEl('th', { text: 'Role' });
			headerRow.createEl('th', { text: 'Status' });
			headerRow.createEl('th', { text: 'Actions' });

			const tbody = table.createEl('tbody');
			this.stronghold.defenders.special.forEach(defender => {
				const row = tbody.createEl('tr');
				row.createEl('td', { text: defender.name });
				row.createEl('td', { text: defender.role || 'N/A' });
				row.createEl('td', { text: defender.status });

				const actionsCell = row.createEl('td');
				actionsCell.createEl('button', { text: 'Edit' })
					.addEventListener('click', () => {
						this.editingDefender = defender;
						this.onOpen();
					});

				actionsCell.createEl('button', { text: 'Remove' })
					.addEventListener('click', () => {
						this.stronghold.defenders.special = this.stronghold.defenders.special.filter(
							d => d.id !== defender.id
						);
						this.onOpen();
					});
			});
		}

		new Setting(section)
			.addButton(btn => btn
				.setButtonText('Add Special Defender')
				.onClick(() => {
					this.editingDefender = {
						id: `defender_${Date.now()}`,
						name: '',
						status: 'active'
					};
					this.onOpen();
				}));
	}

	renderDefenderForm(container: HTMLElement) {
		if (this.editingDefender === null) return;

		const section = container.createDiv({ cls: 'defender-form-section' });
		section.createEl('h3', {
			text: this.editingDefender.name ? `Edit ${this.editingDefender.name}` : 'New Special Defender'
		});

		new Setting(section)
			.setName('Name')
			.setDesc('Name of the special defender')
			.addText(text => text
				.setPlaceholder('Captain Elara')
				.setValue(this.editingDefender?.name || '')
				.onChange(value => {
					if (this.editingDefender) {
						this.editingDefender.name = value;
					}
				}));

		new Setting(section)
			.setName('Role')
			.setDesc('Role or title (optional)')
			.addText(text => text
				.setPlaceholder('Guard Captain')
				.setValue(this.editingDefender?.role || '')
				.onChange(value => {
					if (this.editingDefender) {
						this.editingDefender.role = value;
					}
				}));

		new Setting(section)
			.setName('Characteristics')
			.setDesc('Brief description (optional)')
			.addTextArea(text => {
				text.setPlaceholder('Tall, scarred veteran with a commanding presence')
					.setValue(this.editingDefender?.characteristics || '')
					.onChange(value => {
						if (this.editingDefender) {
							this.editingDefender.characteristics = value;
						}
					});
				text.inputEl.rows = 2;
			});

		new Setting(section)
			.setName('Stat Block')
			.setDesc('Link to stat block or creature type')
			.addText(text => text
				.setPlaceholder('[[Veteran]] or "Knight"')
				.setValue(this.editingDefender?.statBlock || '')
				.onChange(value => {
					if (this.editingDefender) {
						this.editingDefender.statBlock = value;
					}
				}));

		new Setting(section)
			.setName('Status')
			.setDesc('Current status of the defender')
			.addDropdown(dropdown => dropdown
				.addOption('active', 'Active')
				.addOption('injured', 'Injured')
				.addOption('deceased', 'Deceased')
				.setValue(this.editingDefender?.status || 'active')
				.onChange(value => {
					if (this.editingDefender) {
						this.editingDefender.status = value as 'active' | 'injured' | 'deceased';
					}
				}));

		new Setting(section)
			.addButton(btn => btn
				.setButtonText('Cancel')
				.onClick(() => {
					this.editingDefender = null;
					this.onOpen();
				}))
			.addButton(btn => btn
				.setButtonText('Save Defender')
				.setCta()
				.onClick(() => {
					if (!this.editingDefender?.name) {
						new Notice('Defender name is required');
						return;
					}

					// Check if this is a new defender or editing existing
					const existingIndex = this.stronghold.defenders.special.findIndex(
						d => d.id === this.editingDefender?.id
					);

					if (existingIndex >= 0) {
						// Update existing
						this.stronghold.defenders.special[existingIndex] = this.editingDefender;
					} else {
						// Add new
						this.stronghold.defenders.special.push(this.editingDefender);
					}

					this.editingDefender = null;
					this.onOpen();
				}));
	}

	renderActions(container: HTMLElement) {
		const actionsContainer = container.createDiv({ cls: 'modal-button-container' });

		new Setting(actionsContainer)
			.addButton(btn => btn
				.setButtonText('Close')
				.onClick(() => {
					this.close();
				}))
			.addButton(btn => btn
				.setButtonText('Save Changes')
				.setCta()
				.onClick(async () => {
					await this.saveChanges();
				}));
	}

	async saveChanges() {
		try {
			this.stronghold.metadata.lastModified = new Date().toISOString();
			await this.plugin.dataAdapter.saveStronghold(this.stronghold);

			new Notice('Defenders updated successfully!');
			this.close();
		} catch (error) {
			console.error('Failed to save defenders:', error);
			new Notice('Failed to save changes. See console for details.');
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
