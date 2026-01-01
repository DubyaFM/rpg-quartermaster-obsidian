// Modal for adding items to shop special stock
import { Modal, App, Notice } from 'obsidian';
import { Shop, Item, ShopItem } from '@quartermaster/core/models/types';
import { expandVariantItems } from '@quartermaster/core/services/variantResolver';
import { formatCurrency } from '@quartermaster/core/calculators/currency';
import type QuartermasterPlugin from '../main';

export class AddShopItemModal extends Modal {
	plugin: QuartermasterPlugin;
	shop: Shop;
	onAddItem: (item: ShopItem) => void;
	searchQuery: string = '';
	allItems: Item[] = [];

	constructor(app: App, plugin: QuartermasterPlugin, shop: Shop, onAddItem: (item: ShopItem) => void) {
		super(app);
		this.plugin = plugin;
		this.shop = shop;
		this.onAddItem = onAddItem;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Add Item to Shop' });

		// Load all items if not already loaded
		if (this.allItems.length === 0) {
			contentEl.createEl('p', { text: 'Loading items...' });
			try {
				const config = this.plugin.dataAdapter.getCurrencyConfig();
				const vaultItems = await this.plugin.dataAdapter.getAvailableItems();
				// Expand variant items into all their specific variants
				this.allItems = expandVariantItems(vaultItems, config);
				// Re-render after loading
				this.onOpen();
				return;
			} catch (error) {
				if (error.message && error.message.includes('No item folders configured')) {
					contentEl.createEl('p', { text: '⚠️ Please configure item folders in Quartermaster settings first' });
					return;
				}
				contentEl.createEl('p', { text: 'Failed to load items from vault' });
				console.error(error);
				return;
			}
		}

		// Search input
		const searchContainer = contentEl.createDiv({ cls: 'add-item-search' });
		searchContainer.createEl('label', { text: 'Search for items:' });
		const searchInput = searchContainer.createEl('input', {
			type: 'text',
			placeholder: 'Type to search...',
		});
		searchInput.value = this.searchQuery;
		searchInput.oninput = () => {
			this.searchQuery = searchInput.value;
			this.onOpen();
		};
		searchInput.focus();

		// Filter items based on search
		const filteredItems = this.allItems.filter(item =>
			item.name.toLowerCase().includes(this.searchQuery.toLowerCase())
		);

		// Results container
		const resultsContainer = contentEl.createDiv({ cls: 'add-item-list' });

		if (filteredItems.length === 0) {
			resultsContainer.createEl('p', { text: 'No items found', cls: 'add-item-count' });
		} else {
			resultsContainer.createEl('p', {
				text: `${filteredItems.length} item${filteredItems.length === 1 ? '' : 's'} found`,
				cls: 'add-item-count'
			});

			// Show up to 50 results
			const displayItems = filteredItems.slice(0, 50);

			displayItems.forEach(item => {
				const itemEl = resultsContainer.createDiv({ cls: 'add-item-option' });

				const infoDiv = itemEl.createDiv({ cls: 'add-item-info' });

				// Item name
				infoDiv.createSpan({ text: item.name, cls: 'shop-item-name' });

				// Rarity badge
				if (item.rarity && item.rarity !== 'none') {
					const rarityClass = `rarity-${item.rarity.toLowerCase().replace(/ /g, '-')}`;
					infoDiv.createSpan({
						cls: `rarity-tag ${rarityClass} add-item-rarity`,
						text: item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1)
					});
				}

				// Cost
				infoDiv.createSpan({
					text: formatCurrency(item.cost, this.plugin.dataAdapter.getCurrencyConfig()),
					cls: 'add-item-cost'
				});

				// Source
				if (item.source) {
					infoDiv.createSpan({
						text: Array.isArray(item.source) ? item.source.join(', ') : item.source,
						cls: 'add-item-source'
					});
				}

				// Add button
				const addBtn = itemEl.createEl('button', {
					text: 'Add',
					cls: 'add-item-btn'
				});
				addBtn.onclick = async () => {
					await this.addItemToShop(item);
				};
			});

			if (filteredItems.length > 50) {
				resultsContainer.createEl('p', {
					text: `Showing first 50 of ${filteredItems.length} results. Try refining your search.`,
					cls: 'add-item-more'
				});
			}
		}

		// Cancel button
		const cancelBtn = contentEl.createEl('button', {
			text: 'Cancel',
			cls: 'add-item-cancel'
		});
		cancelBtn.onclick = () => {
			this.close();
		};
	}

	async addItemToShop(item: Item) {
		try {
			// Import createShopItem to generate proper ShopItem with stock
			const { createShopItem } = await import('@quartermaster/core/generators/inventory');

			// Get all items for variant resolution
			const allItems = await this.plugin.dataAdapter.getAvailableItems();

			// Create shop item using plugin's randomizer
			const shopItem = createShopItem(this.plugin.randomizer, item, allItems);

			// Add to shop via callback
			this.onAddItem(shopItem);

			new Notice(`Added ${item.name} to shop`);
			this.close();
		} catch (error) {
			console.error('Error adding item to shop:', error);
			new Notice('Failed to add item to shop');
		}
	}
}
