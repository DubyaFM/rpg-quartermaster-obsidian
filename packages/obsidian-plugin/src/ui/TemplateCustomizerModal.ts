// Modal for creating and editing custom shop templates
import { Modal, App, Setting, Notice } from 'obsidian';
import { ShopGenerationConfig, Item } from '@quartermaster/core/models/types';
import { CurrencyConfig } from '@quartermaster/core/models/currency-config';
import { formatCurrency } from '@quartermaster/core/calculators/currency';
import { generateShopFunds } from '@quartermaster/core/generators/inventory';
import { validateTemplateConfig } from '@quartermaster/core/services/templateManager';
// ConfigLoader no longer needed - using dataAdapter instead
import { ItemVaultHandler } from '../adapters/ItemVaultHandler';
import type QuartermasterPlugin from '../main';

export class TemplateCustomizerModal extends Modal {
	private plugin: QuartermasterPlugin;
	private shopType: string;
	private wealthLevel: string;
	private customConfig: Partial<ShopGenerationConfig> = {};
	private defaultConfig: ShopGenerationConfig;
	private itemMetadata: {
		types: string[];
		rarities: string[];
		matrix: Record<string, Record<string, number>>;
		totalItems: number;
	};

	constructor(
		app: App,
		plugin: QuartermasterPlugin,
		shopType: string,
		wealthLevel: string
	) {
		super(app);
		this.plugin = plugin;
		this.shopType = shopType;
		this.wealthLevel = wealthLevel;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Show loading message
		contentEl.createEl('p', { text: 'Loading template data...' });

		try {
			// Load default config
			this.defaultConfig = await this.plugin.dataAdapter.getBaseShopConfig(this.shopType, this.wealthLevel);

			// Load existing custom template (if any)
			const existing = await this.plugin.dataAdapter.getCustomTemplate(this.shopType, this.wealthLevel);
			if (existing) {
				this.customConfig = existing;
			}

			// Load item metadata (CACHED after first call!)
			const itemHandler = new ItemVaultHandler(this.app, this.plugin.settings, this.plugin);
			this.itemMetadata = await itemHandler.getItemMetadata();

			// Clear loading and render UI
			contentEl.empty();
			this.renderUI();

		} catch (error) {
			contentEl.empty();
			contentEl.createEl('p', {
				text: `Failed to load template data: ${error.message}`,
				cls: 'template-error'
			});
			console.error('Template customizer load error:', error);
		}
	}

	private renderUI() {
		const { contentEl } = this;
		contentEl.empty(); // Fix duplicate rendering bug

		contentEl.createEl('h2', { text: 'Customize Shop Template' });

		// Shop type and wealth (read-only display)
		const infoEl = contentEl.createDiv({ cls: 'template-info' });
		infoEl.createEl('p', { text: `Shop Type: ${this.shopType}` });
		infoEl.createEl('p', { text: `Wealth Level: ${this.wealthLevel}` });

		// Render each section
		this.renderTotalItemCount(contentEl);
		this.renderBasicItemTypes(contentEl);
		this.renderMagicItemConfig(contentEl);
		this.renderGuaranteedItems(contentEl);
		this.renderShopGold(contentEl);
		this.renderActions(contentEl);
	}

	private renderTotalItemCount(containerEl: HTMLElement) {
		const section = containerEl.createDiv({ cls: 'template-section' });
		section.createEl('h3', { text: 'Total Item Count' });

		const useDefault = !this.customConfig.totalItemRange;

		new Setting(section)
			.setName('Use default (calculated from rarity limits)')
			.setDesc('If enabled, total items = sum of maxItems per rarity')
			.addToggle(toggle => toggle
				.setValue(useDefault)
				.onChange(value => {
					if (value) {
						delete this.customConfig.totalItemRange;
					} else {
						// Initialize with reasonable defaults
						this.customConfig.totalItemRange = {
							min: 30,
							max: 50
						};
					}
					this.renderUI(); // Re-render
				})
			);

		if (!useDefault) {
			new Setting(section)
				.setName('Minimum items')
				.setDesc('Minimum total items in shop')
				.addText(text => text
					.setPlaceholder('30')
					.setValue(String(this.customConfig.totalItemRange!.min))
					.onChange(value => {
						const num = parseInt(value);
						if (!isNaN(num) && num >= 0) {
							this.customConfig.totalItemRange!.min = num;
						}
					})
				);

			new Setting(section)
				.setName('Maximum items')
				.setDesc('Maximum total items in shop')
				.addText(text => text
					.setPlaceholder('50')
					.setValue(String(this.customConfig.totalItemRange!.max))
					.onChange(value => {
						const num = parseInt(value);
						if (!isNaN(num) && num >= 0) {
							this.customConfig.totalItemRange!.max = num;
						}
					})
				);
		}
	}

	private renderBasicItemTypes(containerEl: HTMLElement) {
		const section = containerEl.createDiv({ cls: 'template-section' });
		section.createEl('h3', { text: 'Basic Item Types' });

		section.createEl('p', {
			text: 'Set spawn chance (0-100%) for each basic (non-magic) item type. 100% means all items of that type always appear.',
			cls: 'setting-item-description'
		});

		// Initialize if not exists
		if (!this.customConfig.basicItemTypes) {
			this.customConfig.basicItemTypes = this.defaultConfig.basicItemTypes
				? { ...this.defaultConfig.basicItemTypes }
				: {};
		}

		// Show each item type from vault
		for (const itemType of this.itemMetadata.types) {
			const typeContainer = section.createDiv({ cls: 'basic-item-type-row' });

			// Type name and count
			const typeHeader = typeContainer.createDiv({ cls: 'basic-item-type-header' });
			typeHeader.createEl('span', { text: itemType, cls: 'basic-item-type-name' });

			// Show count of items in vault for this type
			const typeCount = Object.values(this.itemMetadata.matrix[itemType] || {})
				.reduce((sum, count) => sum + count, 0);
			typeHeader.createEl('span', {
				text: `(${typeCount} items)`,
				cls: 'basic-item-type-count'
			});

			// Single percentage input
			new Setting(typeContainer)
				.setName('')
				.addText(text => text
					.setPlaceholder('0-100')
					.setValue(String(this.customConfig.basicItemTypes![itemType] || ''))
					.onChange(value => {
						const val = value === '' ? 0 : parseInt(value);

						if (!isNaN(val) && val >= 0 && val <= 100) {
							this.customConfig.basicItemTypes![itemType] = val;
						} else {
							new Notice('Spawn chance must be between 0 and 100');
						}
					})
				);
		}
	}

	private renderMagicItemConfig(containerEl: HTMLElement) {
		const section = containerEl.createDiv({ cls: 'template-section' });
		section.createEl('h3', { text: 'Magic Item Configuration' });

		section.createEl('p', {
			text: 'Configure how many magic items can appear and their rarity distribution.',
			cls: 'setting-item-description'
		});

		// Magic Item Count Weights
		const countSection = section.createDiv({ cls: 'magic-item-count-section' });
		countSection.createEl('h4', { text: 'Magic Item Count Weights' });
		countSection.createEl('p', {
			text: 'Weighted probability for number of magic items (e.g., "0": 70 means 70% chance of no magic items)',
			cls: 'setting-item-description'
		});

		// Initialize if not exists
		if (!this.customConfig.magicItemCountWeights) {
			this.customConfig.magicItemCountWeights = this.defaultConfig.magicItemCountWeights
				? { ...this.defaultConfig.magicItemCountWeights }
				: { "0": 70, "1": 20, "2": 10 };
		}

		// Render count weights inputs
		const weightsContainer = countSection.createDiv({ cls: 'magic-count-weights' });

		// Allow up to 10 possible counts
		for (let i = 0; i <= 10; i++) {
			const countKey = String(i);
			const currentWeight = this.customConfig.magicItemCountWeights[countKey] || 0;

			new Setting(weightsContainer)
				.setName(`${i} items`)
				.addText(text => text
					.setPlaceholder('Weight (0-100)')
					.setValue(currentWeight > 0 ? String(currentWeight) : '')
					.onChange(value => {
						const val = value === '' ? 0 : parseInt(value);
						if (!isNaN(val) && val >= 0) {
							this.customConfig.magicItemCountWeights![countKey] = val;
						}
					})
				);
		}

		// Magic Item Rarity Configuration
		const raritySection = section.createDiv({ cls: 'magic-item-rarity-section' });
		raritySection.createEl('h4', { text: 'Magic Item Rarity Configuration' });

		// Choose between default modifier or override
		const useOverride = !!this.customConfig.overrideMagicItemChances;

		new Setting(raritySection)
			.setName('Configuration Mode')
			.setDesc('Default uses party level + wealth modifier. Override sets exact percentages.')
			.addDropdown(dropdown => dropdown
				.addOption('default', 'Use Default Modifier')
				.addOption('override', 'Override with Exact Percentages')
				.setValue(useOverride ? 'override' : 'default')
				.onChange(value => {
					if (value === 'override') {
						this.customConfig.overrideMagicItemChances = {
							common: 50,
							uncommon: 30,
							rare: 15,
							veryRare: 5,
							legendary: 0
						};
						delete this.customConfig.defaultMagicItemModifier;
					} else {
						delete this.customConfig.overrideMagicItemChances;
						this.customConfig.defaultMagicItemModifier = this.defaultConfig.defaultMagicItemModifier || 0.5;
					}
					this.renderUI(); // Re-render
				})
			);

		if (useOverride) {
			// Show override inputs
			const rarities: Array<{ key: keyof NonNullable<ShopGenerationConfig['overrideMagicItemChances']>; label: string }> = [
				{ key: 'common', label: 'Common' },
				{ key: 'uncommon', label: 'Uncommon' },
				{ key: 'rare', label: 'Rare' },
				{ key: 'veryRare', label: 'Very Rare' },
				{ key: 'legendary', label: 'Legendary' }
			];

			for (const { key, label } of rarities) {
				new Setting(raritySection)
					.setName(label)
					.setDesc('Percentage chance (0-100)')
					.addText(text => text
						.setPlaceholder('0-100')
						.setValue(String(this.customConfig.overrideMagicItemChances![key] || 0))
						.onChange(value => {
							const val = value === '' ? 0 : parseInt(value);
							if (!isNaN(val) && val >= 0 && val <= 100) {
								this.customConfig.overrideMagicItemChances![key] = val;
							} else {
								new Notice('Percentage chance must be between 0 and 100');
							}
						})
					);
			}
		} else {
			// Show default modifier slider
			const modifier = this.customConfig.defaultMagicItemModifier
				|| this.defaultConfig.defaultMagicItemModifier
				|| 0.5;

			new Setting(raritySection)
				.setName('Magic Item Modifier')
				.setDesc('Multiplier applied to party-level base chances (0.0 - 1.0)')
				.addSlider(slider => slider
					.setLimits(0, 1, 0.1)
					.setValue(modifier)
					.setDynamicTooltip()
					.onChange(value => {
						this.customConfig.defaultMagicItemModifier = value;
					})
				);

			raritySection.createEl('p', {
				text: `Current modifier: ${modifier.toFixed(1)}x (will be multiplied by party level base and wealth modifier)`,
				cls: 'setting-item-description'
			});
		}
	}

	private renderGuaranteedItems(containerEl: HTMLElement) {
		const section = containerEl.createDiv({ cls: 'template-section' });
		section.createEl('h3', { text: 'Guaranteed Items' });

		section.createEl('p', {
			text: 'Items that always (or frequently) appear in this shop type. Each item has a spawn chance (0-100%) and stock range.',
			cls: 'setting-item-description'
		});

		if (!this.customConfig.specificItems) {
			this.customConfig.specificItems = [];
		}

		// List current guaranteed items
		const itemsListEl = section.createDiv({ cls: 'specific-items-list' });
		this.renderSpecificItemsList(itemsListEl);

		// Add new item button
		const addBtn = section.createEl('button', { text: '+ Add Guaranteed Item', cls: 'mod-cta' });
		addBtn.onclick = async () => {
			await this.openAddSpecificItemModal();
		};
	}

	private renderSpecificItemsList(container: HTMLElement) {
		container.empty();

		if (!this.customConfig.specificItems || this.customConfig.specificItems.length === 0) {
			container.createEl('p', { text: 'No guaranteed items configured', cls: 'empty-list' });
			return;
		}

		for (let i = 0; i < this.customConfig.specificItems.length; i++) {
			const item = this.customConfig.specificItems[i];

			const itemEl = container.createDiv({ cls: 'specific-item' });

			const infoEl = itemEl.createDiv({ cls: 'specific-item-info' });
			infoEl.createEl('span', { text: item.itemName, cls: 'specific-item-name' });
			infoEl.createEl('span', {
				text: ` (${item.spawnChance}% chance, stock: ${item.stockRange.min}-${item.stockRange.max})`,
				cls: 'specific-item-details'
			});

			const removeBtn = itemEl.createEl('button', { text: 'Remove', cls: 'specific-item-remove' });
			removeBtn.onclick = () => {
				this.customConfig.specificItems!.splice(i, 1);
				this.renderSpecificItemsList(container);
			};
		}
	}

	private async openAddSpecificItemModal() {
		// Create a simple modal for adding specific items
		const modal = new Modal(this.app);
		modal.titleEl.setText('Add Guaranteed Item');

		const { contentEl } = modal;

		let selectedItem: string = '';
		let spawnChance: number = 100;
		let stockMin: number = 1;
		let stockMax: number = 3;

		// Load items for autocomplete
		const itemHandler = new ItemVaultHandler(this.app, this.plugin.settings, this.plugin);
		let allItems;
		try {
			allItems = await itemHandler.getAvailableItems();
		} catch (error) {
			if (error.message && error.message.includes('No item folders configured')) {
				new Notice('⚠️ Please configure item folders in Quartermaster settings first', 5000);
				modal.close();
				return;
			}
			throw error;
		}
		const itemNames = allItems.map(item => item.name).sort();

		// Create datalist for autocomplete
		const datalist = contentEl.createEl('datalist', { attr: { id: 'item-autocomplete' } });
		itemNames.forEach(name => {
			datalist.createEl('option', { value: name });
		});

		// Item name input with autocomplete
		new Setting(contentEl)
			.setName('Item Name')
			.setDesc('Enter or select an item name from your vault')
			.addText(text => {
				const inputEl = text.inputEl;
				inputEl.setAttribute('list', 'item-autocomplete');
				text.setPlaceholder('Longsword')
					.onChange(value => selectedItem = value);
			});

		new Setting(contentEl)
			.setName('Spawn Chance')
			.setDesc('Percentage chance this item appears (0-100)')
			.addText(text => text
				.setPlaceholder('100')
				.setValue('100')
				.onChange(value => {
					const val = parseInt(value);
					if (!isNaN(val)) spawnChance = val;
				})
			);

		new Setting(contentEl)
			.setName('Minimum Stock')
			.setDesc('Minimum quantity when item spawns')
			.addText(text => text
				.setPlaceholder('1')
				.setValue('1')
				.onChange(value => {
					const val = parseInt(value);
					if (!isNaN(val)) stockMin = val;
				})
			);

		new Setting(contentEl)
			.setName('Maximum Stock')
			.setDesc('Maximum quantity when item spawns')
			.addText(text => text
				.setPlaceholder('3')
				.setValue('3')
				.onChange(value => {
					const val = parseInt(value);
					if (!isNaN(val)) stockMax = val;
				})
			);

		const addBtn = contentEl.createEl('button', { text: 'Add Item', cls: 'mod-cta' });
		addBtn.onclick = () => {
			if (!selectedItem) {
				new Notice('Please enter an item name');
				return;
			}

			if (spawnChance < 0 || spawnChance > 100) {
				new Notice('Spawn chance must be between 0 and 100');
				return;
			}

			if (stockMin < 0 || stockMax < stockMin) {
				new Notice('Invalid stock range');
				return;
			}

			this.customConfig.specificItems!.push({
				itemName: selectedItem,
				spawnChance: spawnChance,
				stockRange: { min: stockMin, max: stockMax }
			});

			const itemsListEl = this.contentEl.querySelector('.specific-items-list');
			if (itemsListEl) {
				this.renderSpecificItemsList(itemsListEl as HTMLElement);
			}

			modal.close();
		};

		modal.open();
	}

	private renderShopGold(containerEl: HTMLElement) {
		const section = containerEl.createDiv({ cls: 'template-section' });
		section.createEl('h3', { text: 'Shop Gold' });

		section.createEl('p', {
			text: 'Configure starting gold for this shop using dice notation (e.g., 30d10+200 gp)',
			cls: 'setting-item-description'
		});

		if (!this.customConfig.fundsOnHandDice) {
			// Initialize with default values
			this.customConfig.fundsOnHandDice = this.defaultConfig.fundsOnHandDice
				? { ...this.defaultConfig.fundsOnHandDice }
				: { count: 10, sides: 10, bonus: 50, currency: 'gp' };
		}

		const goldConfig = this.customConfig.fundsOnHandDice;

		// Display as: [30 ▼] d [10 ▼] + [200 ▼] [gp ▼]
		const rowEl = section.createDiv({ cls: 'gold-dice-row' });

		// Dice count dropdown
		const countSelect = rowEl.createEl('select', { cls: 'gold-dice-select' });
		for (let i = 1; i <= 50; i++) {
			const opt = countSelect.createEl('option', { text: String(i), value: String(i) });
			if (i === goldConfig.count) opt.selected = true;
		}
		countSelect.addEventListener('change', () => {
			this.customConfig.fundsOnHandDice!.count = parseInt(countSelect.value);
		});

		rowEl.createEl('span', { text: ' d ', cls: 'gold-dice-separator' });

		// Die type dropdown
		const sidesSelect = rowEl.createEl('select', { cls: 'gold-dice-select' });
		[4, 6, 8, 10, 12, 20, 100].forEach(sides => {
			const opt = sidesSelect.createEl('option', { text: String(sides), value: String(sides) });
			if (sides === goldConfig.sides) opt.selected = true;
		});
		sidesSelect.addEventListener('change', () => {
			this.customConfig.fundsOnHandDice!.sides = parseInt(sidesSelect.value);
		});

		rowEl.createEl('span', { text: ' + ', cls: 'gold-dice-separator' });

		// Bonus dropdown (increments of 5)
		const bonusSelect = rowEl.createEl('select', { cls: 'gold-dice-select' });
		for (let i = 0; i <= 500; i += 5) {
			const opt = bonusSelect.createEl('option', { text: String(i), value: String(i) });
			if (i === goldConfig.bonus) opt.selected = true;
		}
		bonusSelect.addEventListener('change', () => {
			this.customConfig.fundsOnHandDice!.bonus = parseInt(bonusSelect.value);
		});

		rowEl.createEl('span', { text: ' ', cls: 'gold-dice-separator' });

		// Currency dropdown
		const currencySelect = rowEl.createEl('select', { cls: 'gold-dice-select' });
		['cp', 'sp', 'gp', 'pp'].forEach(curr => {
			const opt = currencySelect.createEl('option', {
				text: curr.toUpperCase(),
				value: curr
			});
			if (curr === goldConfig.currency) opt.selected = true;
		});
		currencySelect.addEventListener('change', () => {
			this.customConfig.fundsOnHandDice!.currency = currencySelect.value as any;
		});

		// Preview button
		const previewBtn = section.createEl('button', { text: 'Roll Preview', cls: 'gold-preview-btn' });
		previewBtn.onclick = () => {
			const currencyConfig = this.plugin.dataAdapter.getCurrencyConfig();
			const rolled = generateShopFunds(this.plugin.randomizer, this.customConfig.fundsOnHandDice!, currencyConfig);
			const formatted = formatCurrency(rolled, currencyConfig);
			new Notice(`Preview roll: ${formatted}`);
		};
	}

	private renderActions(containerEl: HTMLElement) {
		const actions = containerEl.createDiv({ cls: 'modal-button-container' });

		// Save button
		const saveBtn = actions.createEl('button', { text: 'Save Template', cls: 'mod-cta' });
		saveBtn.onclick = async () => {
			await this.saveTemplate();
		};

		// Reset button
		const resetBtn = actions.createEl('button', { text: 'Reset to Defaults' });
		resetBtn.onclick = () => {
			if (confirm('Reset all customizations to default values?')) {
				this.customConfig = {};
				this.renderUI();
			}
		};

		// Cancel button
		const cancelBtn = actions.createEl('button', { text: 'Cancel' });
		cancelBtn.onclick = () => this.close();
	}

	private async saveTemplate() {
		try {
			// Validate before saving
			const merged = { ...this.defaultConfig, ...this.customConfig };
			const validation = validateTemplateConfig(merged);

			if (!validation.valid) {
				new Notice(`Template validation failed: ${validation.errors.join(', ')}`);
				return;
			}

			// Save template
			await this.plugin.dataAdapter.saveCustomTemplate(this.shopType, this.wealthLevel, this.customConfig);

			new Notice('Template saved successfully!');
			this.close();

		} catch (error) {
			new Notice(`Error saving template: ${error.message}`);
			console.error('Template save error:', error);
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
