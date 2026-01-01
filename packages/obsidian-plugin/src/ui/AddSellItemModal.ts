// Modal for adding items to sell (from vault or custom)
import { Modal, App, Setting, Notice } from 'obsidian';
import { Shop, Item } from '@quartermaster/core/models/types';
import { parseCostString } from '@quartermaster/core/calculators/currency';
import { expandVariantItems } from '@quartermaster/core/services/variantResolver';
import type QuartermasterPlugin from '../main';

export class AddSellItemModal extends Modal {
	plugin: QuartermasterPlugin;
	shop: Shop;
	onAddItem: (item: Item) => void;
	searchQuery: string = '';
	allItems: Item[] = [];
	selectedTab: 'search' | 'custom' = 'search';

	constructor(app: App, plugin: QuartermasterPlugin, shop: Shop, onAddItem: (item: Item) => void) {
		super(app);
		this.plugin = plugin;
		this.shop = shop;
		this.onAddItem = onAddItem;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Add Item to Sell' });

		// Tab buttons
		const tabContainer = contentEl.createDiv({ cls: 'sell-item-tabs' });

		const searchTabBtn = tabContainer.createEl('button', {
			text: 'Search Vault Items',
			cls: this.selectedTab === 'search' ? 'tab-active' : ''
		});
		searchTabBtn.onclick = () => {
			this.selectedTab = 'search';
			this.onOpen();
		};

		const customTabBtn = tabContainer.createEl('button', {
			text: 'Create Custom Item',
			cls: this.selectedTab === 'custom' ? 'tab-active' : ''
		});
		customTabBtn.onclick = () => {
			this.selectedTab = 'custom';
			this.onOpen();
		};

		// Content area
		const contentArea = contentEl.createDiv({ cls: 'sell-item-content' });

		if (this.selectedTab === 'search') {
			await this.renderSearchTab(contentArea);
		} else {
			this.renderCustomTab(contentArea);
		}
	}

	async renderSearchTab(container: HTMLElement) {
		// Load all items if not already loaded
		if (this.allItems.length === 0) {
			container.createEl('p', { text: 'Loading items...' });
			try {
				const config = this.plugin.dataAdapter.getCurrencyConfig();
				const vaultItems = await this.plugin.dataAdapter.getAvailableItems();
				// Expand variant items into all their specific variants
				// This converts "Armor of Cold Resistance" into "Chain Mail of Cold Resistance", etc.
				this.allItems = expandVariantItems(vaultItems, config);
				// Re-render after loading
				this.onOpen();
				return;
			} catch (error) {
				if (error.message && error.message.includes('No item folders configured')) {
					container.createEl('p', { text: '⚠️ Please configure item folders in Quartermaster settings first' });
					return;
				}
				container.createEl('p', { text: 'Failed to load items from vault' });
				console.error(error);
				return;
			}
		}

		// Search input
		const searchInput = container.createEl('input', {
			type: 'text',
			placeholder: 'Search for items...',
			cls: 'search-input'
		});
		searchInput.value = this.searchQuery;
		searchInput.oninput = () => {
			this.searchQuery = searchInput.value;
			this.onOpen();
		};

		// Filter items based on search
		const filteredItems = this.allItems.filter(item =>
			item.name.toLowerCase().includes(this.searchQuery.toLowerCase())
		);

		// Results container
		const resultsContainer = container.createDiv({ cls: 'search-results' });

		if (filteredItems.length === 0) {
			resultsContainer.createEl('p', { text: 'No items found' });
		} else {
			// Limit to 20 results
			const displayItems = filteredItems.slice(0, 20);

			displayItems.forEach(item => {
				const itemEl = resultsContainer.createDiv({ cls: 'search-result-item' });

				const infoEl = itemEl.createDiv({ cls: 'item-info' });
				infoEl.createSpan({ text: item.name, cls: 'item-name' });
				infoEl.createSpan({ text: ` (${item.type}, ${item.rarity})`, cls: 'item-details' });

				const selectBtn = itemEl.createEl('button', { text: 'Select' });
				selectBtn.onclick = () => {
					this.onAddItem(item);
					this.close();
				};
			});

			if (filteredItems.length > 20) {
				resultsContainer.createEl('p', {
					text: `Showing 20 of ${filteredItems.length} results. Refine your search for more.`,
					cls: 'search-info'
				});
			}
		}
	}

	renderCustomTab(container: HTMLElement) {
		const config = this.plugin.dataAdapter.getCurrencyConfig();
		container.createEl('h3', { text: 'Create Custom Item' });
		container.createEl('p', { text: 'Quickly add an item to sell:' });

		let itemName = '';
		let itemCost = '1 gp';

		// Item name
		new Setting(container)
			.setName('Item Name')
			.setDesc('Name of the item to sell')
			.addText(text => text
				.setPlaceholder('Mysterious Gem')
				.onChange(value => itemName = value));

		// Item cost (base value)
		new Setting(container)
			.setName('Base Value')
			.setDesc('Item\'s base value (e.g., "50 gp", "1 pp 5 gp")')
			.addText(text => text
				.setPlaceholder('50 gp')
				.setValue(itemCost)
				.onChange(value => itemCost = value));

		// Create button
		const createBtn = container.createEl('button', {
			text: 'Add Item to Sell',
			cls: 'mod-cta'
		});
		createBtn.onclick = () => {
			if (!itemName.trim()) {
				new Notice('Please enter an item name');
				return;
			}

			try {
				const config = this.plugin.dataAdapter.getCurrencyConfig();
				const cost = parseCostString(itemCost, config);

				const customItem: Item = {
					name: itemName.trim(),
					cost: cost,
					type: 'miscellaneous',
					rarity: 'common',
					description: 'Custom item',
					source: 'Custom',
					category: 'Custom Items',
					file: { path: '', name: itemName.trim() }
				};

				this.onAddItem(customItem);
				this.close();
			} catch (error) {
				new Notice('Invalid cost format. Use formats like "50 gp" or "1 pp 5 gp"');
				console.error(error);
			}
		};
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
