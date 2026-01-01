// Template builder for facility templates
import { Modal, App, Setting, Notice, TextAreaComponent } from 'obsidian';
import { FacilityTemplate } from '@quartermaster/core/models/stronghold';
import type QuartermasterPlugin from '../../main';

export class FacilityCreatorModal extends Modal {
	plugin: QuartermasterPlugin;
	template: Partial<FacilityTemplate> = {
		tier: 1,
		type: 'basic',
		size: { category: 'roomy', areaSquares: 4 },
		hirelingsRequired: 0,
		buildCost: { gold: 0, timeInDays: 1 },
		associatedOrderIds: [],
		prerequisites: '',
		passiveBenefits: ''
	};
	orderIds: string[] = [];

	constructor(app: App, plugin: QuartermasterPlugin, existingTemplate?: FacilityTemplate) {
		super(app);
		this.plugin = plugin;
		if (existingTemplate) {
			this.template = { ...existingTemplate };
		}
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('facility-creator-modal');

		contentEl.createEl('h2', { text: 'Facility Template Creator' });

		await this.loadOrderIds();
		this.renderBasicInfo(contentEl);
		this.renderSizeInfo(contentEl);
		this.renderCostInfo(contentEl);
		this.renderOrdersInfo(contentEl);
		this.renderActions(contentEl);
	}

	async loadOrderIds() {
		try {
			const orders = await this.plugin.dataAdapter.loadOrders?.() || [];
			this.orderIds = orders.map((o: { id: string }) => o.id);
		} catch (error) {
			console.error('Failed to load order IDs:', error);
		}
	}

	renderBasicInfo(container: HTMLElement) {
		const section = container.createDiv({ cls: 'facility-basic-info' });
		section.createEl('h3', { text: 'Basic Information' });

		new Setting(section)
			.setName('Template ID')
			.setDesc('Unique identifier (e.g., smithy_basic, temple_tier2)')
			.addText(text => text
				.setPlaceholder('facility_id')
				.setValue(this.template.id || '')
				.onChange(value => {
					this.template.id = value;
				}));

		new Setting(section)
			.setName('Name')
			.setDesc('Display name of the facility')
			.addText(text => text
				.setPlaceholder('Smithy')
				.setValue(this.template.name || '')
				.onChange(value => {
					this.template.name = value;
				}));

		new Setting(section)
			.setName('Tier')
			.setDesc('Tier level (1-3, higher = upgrade)')
			.addText(text => text
				.setPlaceholder('1')
				.setValue(this.template.tier?.toString() || '1')
				.onChange(value => {
					const num = parseInt(value);
					if (!isNaN(num) && num >= 1 && num <= 3) {
						this.template.tier = num;
					}
				}));

		new Setting(section)
			.setName('Type')
			.setDesc('Basic or Special facility')
			.addDropdown(dropdown => dropdown
				.addOption('basic', 'Basic')
				.addOption('special', 'Special')
				.setValue(this.template.type || 'basic')
				.onChange(value => {
					this.template.type = value as 'basic' | 'special';
				}));

		new Setting(section)
			.setName('Description')
			.setDesc('Description of the facility')
			.addTextArea(text => {
				text.setPlaceholder('A facility for crafting weapons and armor')
					.setValue(this.template.description || '')
					.onChange(value => {
						this.template.description = value;
					});
				text.inputEl.rows = 3;
			});

		new Setting(section)
			.setName('Unlock Level (PC)')
			.setDesc('Minimum PC level to build (optional)')
			.addText(text => text
				.setPlaceholder('1')
				.setValue(this.template.unlockLevel?.toString() || '')
				.onChange(value => {
					const num = parseInt(value);
					if (!isNaN(num) && num > 0) {
						this.template.unlockLevel = num;
					} else if (value === '') {
						this.template.unlockLevel = undefined;
					}
				}));

		new Setting(section)
			.setName('Base Facility ID')
			.setDesc('For upgrades: ID of facility this upgrades from (optional)')
			.addText(text => text
				.setPlaceholder('smithy_basic')
				.setValue(this.template.baseFacilityId || '')
				.onChange(value => {
					this.template.baseFacilityId = value || undefined;
				}));

		new Setting(section)
			.setName('Prerequisites')
			.setDesc('Text describing requirements to build')
			.addTextArea(text => {
				text.setPlaceholder('Must have access to iron ore')
					.setValue(this.template.prerequisites || '')
					.onChange(value => {
						this.template.prerequisites = value;
					});
				text.inputEl.rows = 2;
			});

		new Setting(section)
			.setName('Passive Benefits')
			.setDesc('Ongoing benefits this facility provides')
			.addTextArea(text => {
				text.setPlaceholder('+1 AC to all defenders wearing crafted armor')
					.setValue(this.template.passiveBenefits || '')
					.onChange(value => {
						this.template.passiveBenefits = value;
					});
				text.inputEl.rows = 2;
			});
	}

	renderSizeInfo(container: HTMLElement) {
		const section = container.createDiv({ cls: 'facility-size-info' });
		section.createEl('h3', { text: 'Size Information' });

		new Setting(section)
			.setName('Size Category')
			.setDesc('Size classification of the facility')
			.addDropdown(dropdown => dropdown
				.addOption('cramped', 'Cramped')
				.addOption('roomy', 'Roomy')
				.addOption('vast', 'Vast')
				.addOption('other', 'Other')
				.setValue(this.template.size?.category || 'roomy')
				.onChange(value => {
					if (!this.template.size) {
						this.template.size = { category: value as any, areaSquares: 4 };
					} else {
						this.template.size.category = value as any;
					}
				}));

		new Setting(section)
			.setName('Area (Squares)')
			.setDesc('Number of 5-foot squares')
			.addText(text => text
				.setPlaceholder('4')
				.setValue(this.template.size?.areaSquares?.toString() || '4')
				.onChange(value => {
					const num = parseInt(value);
					if (!isNaN(num) && num > 0) {
						if (!this.template.size) {
							this.template.size = { category: 'roomy', areaSquares: num };
						} else {
							this.template.size.areaSquares = num;
						}
					}
				}));

		new Setting(section)
			.setName('Hirelings Required')
			.setDesc('Number of hirelings needed to operate')
			.addText(text => text
				.setPlaceholder('0')
				.setValue(this.template.hirelingsRequired?.toString() || '0')
				.onChange(value => {
					const num = parseInt(value);
					if (!isNaN(num) && num >= 0) {
						this.template.hirelingsRequired = num;
					}
				}));
	}

	renderCostInfo(container: HTMLElement) {
		const section = container.createDiv({ cls: 'facility-cost-info' });
		section.createEl('h3', { text: 'Build & Upgrade Costs' });

		new Setting(section)
			.setName('Build Cost (Gold)')
			.setDesc('Gold required to build')
			.addText(text => text
				.setPlaceholder('500')
				.setValue(this.template.buildCost?.gold?.toString() || '0')
				.onChange(value => {
					const num = parseInt(value);
					if (!isNaN(num) && num >= 0) {
						if (!this.template.buildCost) {
							this.template.buildCost = { gold: num, timeInDays: 1 };
						} else {
							this.template.buildCost.gold = num;
						}
					}
				}));

		new Setting(section)
			.setName('Build Time (Days)')
			.setDesc('Days required to build')
			.addText(text => text
				.setPlaceholder('7')
				.setValue(this.template.buildCost?.timeInDays?.toString() || '1')
				.onChange(value => {
					const num = parseInt(value);
					if (!isNaN(num) && num > 0) {
						if (!this.template.buildCost) {
							this.template.buildCost = { gold: 0, timeInDays: num };
						} else {
							this.template.buildCost.timeInDays = num;
						}
					}
				}));

		// Upgrade costs (optional)
		section.createEl('h4', { text: 'Upgrade Cost (Optional)' });

		const hasUpgradeCost = !!this.template.upgradeCost;

		new Setting(section)
			.setName('Has Upgrade Cost')
			.setDesc('Enable upgrade costs for this facility')
			.addToggle(toggle => toggle
				.setValue(hasUpgradeCost)
				.onChange(value => {
					if (value && !this.template.upgradeCost) {
						this.template.upgradeCost = { gold: 0, timeInDays: 1 };
					} else if (!value) {
						this.template.upgradeCost = undefined;
					}
					this.onOpen();
				}));

		if (hasUpgradeCost) {
			new Setting(section)
				.setName('Upgrade Cost (Gold)')
				.addText(text => text
					.setPlaceholder('250')
					.setValue(this.template.upgradeCost?.gold?.toString() || '0')
					.onChange(value => {
						const num = parseInt(value);
						if (!isNaN(num) && num >= 0 && this.template.upgradeCost) {
							this.template.upgradeCost.gold = num;
						}
					}));

			new Setting(section)
				.setName('Upgrade Time (Days)')
				.addText(text => text
					.setPlaceholder('3')
					.setValue(this.template.upgradeCost?.timeInDays?.toString() || '1')
					.onChange(value => {
						const num = parseInt(value);
						if (!isNaN(num) && num > 0 && this.template.upgradeCost) {
							this.template.upgradeCost.timeInDays = num;
						}
					}));
		}
	}

	renderOrdersInfo(container: HTMLElement) {
		const section = container.createDiv({ cls: 'facility-orders-info' });
		section.createEl('h3', { text: 'Associated Orders' });

		if (!this.template.associatedOrderIds) {
			this.template.associatedOrderIds = [];
		}

		const orderList = section.createDiv({ cls: 'order-list' });

		if (this.template.associatedOrderIds.length === 0) {
			orderList.createEl('p', { text: 'No orders associated yet' });
		} else {
			const ul = orderList.createEl('ul');
			this.template.associatedOrderIds.forEach((orderId, index) => {
				const li = ul.createEl('li');
				li.createEl('span', { text: orderId });
				li.createEl('button', { text: 'Remove' })
					.addEventListener('click', () => {
						this.template.associatedOrderIds?.splice(index, 1);
						this.onOpen();
					});
			});
		}

		new Setting(section)
			.setName('Add Order')
			.setDesc('Add an order ID to this facility')
			.addText(text => text
				.setPlaceholder('order_id')
				.then(textComponent => {
					const addBtn = section.createEl('button', { text: 'Add' });
					addBtn.addEventListener('click', () => {
						const orderId = textComponent.getValue().trim();
						if (orderId && !this.template.associatedOrderIds?.includes(orderId)) {
							this.template.associatedOrderIds?.push(orderId);
							textComponent.setValue('');
							this.onOpen();
						}
					});
				}));
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
				.setButtonText('Save Template')
				.setCta()
				.onClick(async () => {
					await this.saveTemplate();
				}));
	}

	async saveTemplate() {
		// Validation
		if (!this.template.id || this.template.id.trim() === '') {
			new Notice('Template ID is required');
			return;
		}

		if (!this.template.name || this.template.name.trim() === '') {
			new Notice('Template name is required');
			return;
		}

		if (!this.template.description || this.template.description.trim() === '') {
			new Notice('Template description is required');
			return;
		}

		try {
			const facilityTemplate: FacilityTemplate = {
				id: this.template.id!,
				name: this.template.name!,
				tier: this.template.tier || 1,
				baseFacilityId: this.template.baseFacilityId,
				type: this.template.type || 'basic',
				description: this.template.description!,
				unlockLevel: this.template.unlockLevel,
				prerequisites: this.template.prerequisites || '',
				size: this.template.size || { category: 'roomy', areaSquares: 4 },
				hirelingsRequired: this.template.hirelingsRequired || 0,
				buildCost: this.template.buildCost || { gold: 0, timeInDays: 1 },
				upgradeCost: this.template.upgradeCost,
				associatedOrderIds: this.template.associatedOrderIds || [],
				passiveBenefits: this.template.passiveBenefits || '',
				metadata: {
					createdDate: this.template.metadata?.createdDate || new Date().toISOString(),
					lastModified: new Date().toISOString()
				}
			};

			await this.plugin.dataAdapter.saveFacilityTemplate(facilityTemplate);

			new Notice(`Facility template "${facilityTemplate.name}" saved successfully!`);
			this.close();
		} catch (error) {
			console.error('Failed to save facility template:', error);
			new Notice('Failed to save template. See console for details.');
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
