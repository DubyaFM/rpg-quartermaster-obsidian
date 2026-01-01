// Order template builder
import { Modal, App, Setting, Notice } from 'obsidian';
import { CustomOrder, OrderResult } from '@quartermaster/core/models/stronghold';
import type QuartermasterPlugin from '../../main';

export class OrderCreatorModal extends Modal {
	plugin: QuartermasterPlugin;
	order: Partial<CustomOrder> = {
		orderType: 'facility',
		timeRequired: 1,
		goldCost: { type: 'none' },
		results: []
	};
	facilityIds: string[] = [];

	constructor(app: App, plugin: QuartermasterPlugin, existingOrder?: CustomOrder) {
		super(app);
		this.plugin = plugin;
		if (existingOrder) {
			this.order = { ...existingOrder };
		}
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('order-creator-modal');

		contentEl.createEl('h2', { text: 'Custom Order Creator' });

		await this.loadFacilityIds();
		this.renderBasicInfo(contentEl);
		this.renderCostInfo(contentEl);
		this.renderResultsInfo(contentEl);
		this.renderActions(contentEl);
	}

	async loadFacilityIds() {
		try {
			const facilities = await this.plugin.dataAdapter.loadFacilityTemplates();
			this.facilityIds = facilities.map(f => f.id);
		} catch (error) {
			console.error('Failed to load facility IDs:', error);
		}
	}

	renderBasicInfo(container: HTMLElement) {
		const section = container.createDiv({ cls: 'order-basic-info' });
		section.createEl('h3', { text: 'Basic Information' });

		new Setting(section)
			.setName('Order ID')
			.setDesc('Unique identifier (e.g., craft_weapon, train_guards)')
			.addText(text => text
				.setPlaceholder('order_id')
				.setValue(this.order.id || '')
				.onChange(value => {
					this.order.id = value;
				}));

		new Setting(section)
			.setName('Name')
			.setDesc('Display name of the order')
			.addText(text => text
				.setPlaceholder('Craft Weapon')
				.setValue(this.order.name || '')
				.onChange(value => {
					this.order.name = value;
				}));

		new Setting(section)
			.setName('Description')
			.setDesc('Description of what this order does')
			.addTextArea(text => {
				text.setPlaceholder('Craft a weapon using available materials')
					.setValue(this.order.description || '')
					.onChange(value => {
						this.order.description = value;
					});
				text.inputEl.rows = 3;
			});

		new Setting(section)
			.setName('Order Type')
			.setDesc('Can this be executed at facilities or stronghold level?')
			.addDropdown(dropdown => dropdown
				.addOption('facility', 'Facility Order')
				.addOption('stronghold', 'Stronghold Order')
				.setValue(this.order.orderType || 'facility')
				.onChange(value => {
					this.order.orderType = value as 'facility' | 'stronghold';
					this.onOpen();
				}));

		if (this.order.orderType === 'facility') {
			section.createEl('h4', { text: 'Associated Facilities' });

			if (!this.order.associatedFacilityIds) {
				this.order.associatedFacilityIds = [];
			}

			const facilityList = section.createDiv({ cls: 'facility-list' });

			if (this.order.associatedFacilityIds.length === 0) {
				facilityList.createEl('p', { text: 'No facilities associated yet' });
			} else {
				const ul = facilityList.createEl('ul');
				this.order.associatedFacilityIds.forEach((facilityId, index) => {
					const li = ul.createEl('li');
					li.createEl('span', { text: facilityId });
					li.createEl('button', { text: 'Remove' })
						.addEventListener('click', () => {
							this.order.associatedFacilityIds?.splice(index, 1);
							this.onOpen();
						});
				});
			}

			new Setting(section)
				.setName('Add Facility')
				.setDesc('Add a facility ID that can execute this order')
				.addText(text => text
					.setPlaceholder('facility_id')
					.then(textComponent => {
						const addBtn = section.createEl('button', { text: 'Add' });
						addBtn.addEventListener('click', () => {
							const facilityId = textComponent.getValue().trim();
							if (facilityId && !this.order.associatedFacilityIds?.includes(facilityId)) {
								this.order.associatedFacilityIds?.push(facilityId);
								textComponent.setValue('');
								this.onOpen();
							}
						});
					}));
		}

		new Setting(section)
			.setName('Time Required (Days)')
			.setDesc('Days needed to complete this order')
			.addText(text => text
				.setPlaceholder('7')
				.setValue(this.order.timeRequired?.toString() || '1')
				.onChange(value => {
					const num = parseInt(value);
					if (!isNaN(num) && num > 0) {
						this.order.timeRequired = num;
					}
				}));
	}

	renderCostInfo(container: HTMLElement) {
		const section = container.createDiv({ cls: 'order-cost-info' });
		section.createEl('h3', { text: 'Gold Cost Configuration' });

		new Setting(section)
			.setName('Cost Type')
			.setDesc('How is the gold cost determined?')
			.addDropdown(dropdown => dropdown
				.addOption('none', 'No Cost')
				.addOption('constant', 'Constant Amount')
				.addOption('variable', 'Variable (User Input)')
				.setValue(this.order.goldCost?.type || 'none')
				.onChange(value => {
					if (!this.order.goldCost) {
						this.order.goldCost = { type: value as any };
					} else {
						this.order.goldCost.type = value as any;
					}
					this.onOpen();
				}));

		if (this.order.goldCost?.type === 'constant') {
			new Setting(section)
				.setName('Gold Amount')
				.setDesc('Fixed gold cost for this order')
				.addText(text => text
					.setPlaceholder('50')
					.setValue(this.order.goldCost?.amount?.toString() || '0')
					.onChange(value => {
						const num = parseInt(value);
						if (!isNaN(num) && num >= 0 && this.order.goldCost) {
							this.order.goldCost.amount = num;
						}
					}));
		}

		if (this.order.goldCost?.type === 'variable') {
			new Setting(section)
				.setName('Cost Prompt')
				.setDesc('Prompt to show user when asking for gold amount')
				.addText(text => text
					.setPlaceholder('Enter gold cost for materials')
					.setValue(this.order.goldCost?.prompt || '')
					.onChange(value => {
						if (this.order.goldCost) {
							this.order.goldCost.prompt = value;
						}
					}));
		}
	}

	renderResultsInfo(container: HTMLElement) {
		const section = container.createDiv({ cls: 'order-results-info' });
		section.createEl('h3', { text: 'Order Results' });

		if (!this.order.results) {
			this.order.results = [];
		}

		const resultsList = section.createDiv({ cls: 'results-list' });

		if (this.order.results.length === 0) {
			resultsList.createEl('p', { text: 'No results configured yet' });
		} else {
			this.order.results.forEach((result, index) => {
				const resultItem = resultsList.createDiv({ cls: 'result-item' });
				resultItem.createEl('strong', { text: `Result ${index + 1}: ${result.type}` });

				const config = resultItem.createDiv({ cls: 'result-config' });
				const configText = this.formatResultConfig(result);
				config.createEl('p', { text: configText });

				resultItem.createEl('button', { text: 'Remove' })
					.addEventListener('click', () => {
						this.order.results?.splice(index, 1);
						this.onOpen();
					});
			});
		}

		section.createEl('h4', { text: 'Add New Result' });

		let newResultType: OrderResult['type'] = 'item';
		let newResultConfig: OrderResult['config'] = {};

		new Setting(section)
			.setName('Result Type')
			.setDesc('What type of result does this order produce?')
			.addDropdown(dropdown => dropdown
				.addOption('item', 'Item')
				.addOption('currency', 'Currency')
				.addOption('defender', 'Defenders')
				.addOption('buff', 'Buff')
				.addOption('event', 'Event Table Roll')
				.addOption('morale', 'Morale Change')
				.setValue(newResultType)
				.onChange(value => {
					newResultType = value as OrderResult['type'];
					newResultConfig = {};
					this.onOpen();
				}));

		this.renderResultConfigInputs(section, newResultType, newResultConfig);

		new Setting(section)
			.addButton(btn => btn
				.setButtonText('Add Result')
				.onClick(() => {
					const newResult: OrderResult = {
						id: `result_${Date.now()}`,
						type: newResultType,
						config: newResultConfig
					};
					this.order.results?.push(newResult);
					this.onOpen();
				}));
	}

	renderResultConfigInputs(container: HTMLElement, type: OrderResult['type'], config: OrderResult['config']) {
		const configSection = container.createDiv({ cls: 'result-config-inputs' });

		switch (type) {
			case 'item':
				new Setting(configSection)
					.setName('Item Prompt')
					.setDesc('Prompt to ask user for item name')
					.addText(text => text
						.setPlaceholder('Enter item name')
						.setValue(config.itemPrompt || '')
						.onChange(value => {
							config.itemPrompt = value;
						}));
				break;

			case 'currency':
				new Setting(configSection)
					.setName('Currency Amount')
					.setDesc('Amount of currency to add to stash')
					.addText(text => text
						.setPlaceholder('100')
						.setValue(config.currencyAmount?.toString() || '')
						.onChange(value => {
							const num = parseInt(value);
							if (!isNaN(num) && num > 0) {
								config.currencyAmount = num;
							}
						}));
				break;

			case 'defender':
				new Setting(configSection)
					.setName('Defender Count')
					.setDesc('Number of basic defenders to add')
					.addText(text => text
						.setPlaceholder('5')
						.setValue(config.defenderCount?.toString() || '')
						.onChange(value => {
							const num = parseInt(value);
							if (!isNaN(num) && num > 0) {
								config.defenderCount = num;
							}
						}));
				break;

			case 'buff':
				new Setting(configSection)
					.setName('Buff ID')
					.setDesc('ID of buff to apply')
					.addText(text => text
						.setPlaceholder('buff_morale_boost')
						.setValue(config.buffId || '')
						.onChange(value => {
							config.buffId = value;
						}));
				break;

			case 'event':
				new Setting(configSection)
					.setName('Event Table ID')
					.setDesc('ID of event table to roll on')
					.addText(text => text
						.setPlaceholder('random_events')
						.setValue(config.eventTableId || '')
						.onChange(value => {
							config.eventTableId = value;
						}));
				break;

			case 'morale':
				new Setting(configSection)
					.setName('Morale Change')
					.setDesc('Morale adjustment (positive or negative)')
					.addText(text => text
						.setPlaceholder('+5')
						.setValue(config.moraleChange?.toString() || '')
						.onChange(value => {
							const num = parseInt(value);
							if (!isNaN(num)) {
								config.moraleChange = num;
							}
						}));
				break;
		}
	}

	formatResultConfig(result: OrderResult): string {
		switch (result.type) {
			case 'item':
				return `Prompt: ${result.config.itemPrompt || 'N/A'}`;
			case 'currency':
				return `Amount: ${result.config.currencyAmount || 0} gp`;
			case 'defender':
				return `Count: ${result.config.defenderCount || 0}`;
			case 'buff':
				return `Buff ID: ${result.config.buffId || 'N/A'}`;
			case 'event':
				return `Event Table: ${result.config.eventTableId || 'N/A'}`;
			case 'morale':
				return `Change: ${result.config.moraleChange || 0}`;
			default:
				return 'Unknown config';
		}
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
				.setButtonText('Save Order')
				.setCta()
				.onClick(async () => {
					await this.saveOrder();
				}));
	}

	async saveOrder() {
		// Validation
		if (!this.order.id || this.order.id.trim() === '') {
			new Notice('Order ID is required');
			return;
		}

		if (!this.order.name || this.order.name.trim() === '') {
			new Notice('Order name is required');
			return;
		}

		if (!this.order.description || this.order.description.trim() === '') {
			new Notice('Order description is required');
			return;
		}

		try {
			const customOrder: CustomOrder = {
				id: this.order.id!,
				name: this.order.name!,
				description: this.order.description!,
				orderType: this.order.orderType || 'facility',
				associatedFacilityIds: this.order.associatedFacilityIds,
				timeRequired: this.order.timeRequired || 1,
				goldCost: this.order.goldCost || { type: 'none' },
				results: this.order.results || [],
				metadata: {
					createdDate: this.order.metadata?.createdDate || new Date().toISOString(),
					lastModified: new Date().toISOString()
				}
			};

			await this.plugin.dataAdapter.saveOrder?.(customOrder);

			new Notice(`Order "${customOrder.name}" saved successfully!`);
			this.close();
		} catch (error) {
			console.error('Failed to save order:', error);
			new Notice('Failed to save order. See console for details.');
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
