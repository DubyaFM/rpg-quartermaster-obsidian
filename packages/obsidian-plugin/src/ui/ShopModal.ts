// Main shop interface modal - orchestrates shop interactions
import { Modal, App, Setting, Notice } from 'obsidian';
import { Shop, ShopItem, PurchasedItem, Item } from '@quartermaster/core/models/types';
import { formatCurrency, convertToCopper, multiplyCurrency, subtractCurrency, addCurrency } from '@quartermaster/core/calculators/currency';
import { ShopCartManager } from './helpers/ShopCartManager';
import { ShopBargainingHelper } from './helpers/ShopBargainingHelper';
import { SellManager } from './helpers/SellManager';
import { RestockManager } from './helpers/RestockManager';
import { OrderManager } from './helpers/OrderManager';
import { InventoryFilter } from './helpers/InventoryFilter';
import { createSellItem, filterSellableItems } from '@quartermaster/core/calculators/sell';
import { canShopAffordPurchase, getMaxAffordableQuantity, updateShopGoldAfterTransaction } from '@quartermaster/core/calculators/sell';
import { resolveVariant } from '@quartermaster/core/services/variantResolver';
import { getItemKey } from '@quartermaster/core/utils/itemIdentifiers';
import { isMagicItem } from '@quartermaster/core/calculators/magicItemPricing';
import { NPCProfileModal } from './NPCProfileModal';
import type QuartermasterPlugin from '../main';

export class ShopModal extends Modal {
	plugin: QuartermasterPlugin;
	shop: Shop;
	shopFilePath?: string;  // File path for saving the shop
	cartManager: ShopCartManager;
	sellManager: SellManager;
	restockManager: RestockManager;
	orderManager: OrderManager;
	inventoryFilter: InventoryFilter;
	bargainingHelper: ShopBargainingHelper;
	currentView: 'buy' | 'sell' | 'orders' = 'buy';
	bulkDiscountEnabled: boolean = false;
	partyItems: Item[] = [];

	constructor(app: App, plugin: QuartermasterPlugin, shop: Shop, shopFilePath?: string) {
		super(app);
		this.plugin = plugin;
		this.shop = shop;
		this.shopFilePath = shopFilePath;
		this.cartManager = new ShopCartManager();
		this.sellManager = new SellManager();
		this.restockManager = new RestockManager();
		this.orderManager = new OrderManager();
		this.inventoryFilter = new InventoryFilter();
		const config = this.plugin.dataAdapter.getCurrencyConfig();
		this.bargainingHelper = new ShopBargainingHelper(config);
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Load party inventory if in sell view
		if (this.currentView === 'sell' && this.partyItems.length === 0) {
			await this.loadPartyInventory();
		}

		this.renderHeader(contentEl);
		this.renderShopkeepInfo(contentEl);
		this.renderTabs(contentEl);
		this.renderInventory(contentEl);
		this.renderCart(contentEl);
		this.renderActions(contentEl);
	}

	async loadPartyInventory() {
		try {
			const partyInventoryItems = await this.plugin.dataAdapter.getPartyInventoryItems();

			// Convert PartyInventoryItem to Item format
			this.partyItems = partyInventoryItems.map((item: any) => ({
				name: item.name,
				cost: item.cost,
				type: item.type || 'unknown',
				rarity: item.rarity || 'common',
				description: item.description || '',
				source: item.source || 'unknown',
				category: item.category || 'Miscellaneous',
				file: { path: item.file?.path || '', name: item.name }
			}));
		} catch (error) {
			new Notice('Failed to load party inventory');
			console.error(error);
		}
	}

	renderHeader(container: HTMLElement) {
		const config = this.plugin.dataAdapter.getCurrencyConfig();
		container.createEl('h2', { text: this.shop.name });
		container.createEl('p', { text: `Type: ${this.shop.type}` });
		if (this.shop.wealthLevel) {
			container.createEl('p', { text: `Wealth: ${this.shop.wealthLevel}` });
		}
		if (this.shop.location) {
			container.createEl('p', { text: `Location: ${this.shop.location}` });
		}

		// Display shop funds if available
		if (this.shop.fundsOnHand) {
			const fundsDisplay = container.createDiv({ cls: 'shop-funds-display' });
			const fundsStr = formatCurrency(this.shop.fundsOnHand, config);
			fundsDisplay.createEl('span', {
				text: `Shop Funds: ${fundsStr}`,
				cls: 'shop-funds-amount'
			});
		}
	}

	renderShopkeepInfo(container: HTMLElement) {
		// Check for NPC shopkeep first (new system), fallback to legacy shopkeep
		const npcData = this.shop.shopkeepData;
		const legacyShopkeep = this.shop.shopkeep;

		if (!npcData && !legacyShopkeep) return;

		const shopkeepEl = container.createDiv({ cls: 'shop-shopkeep-info' });
		shopkeepEl.createEl('h3', { text: 'Shopkeep' });

		const infoEl = shopkeepEl.createDiv();

		// Use NPC data if available, otherwise use legacy shopkeep
		const name = npcData?.name || legacyShopkeep?.name;
		const species = npcData?.species || legacyShopkeep?.species;
		const disposition = npcData?.disposition || legacyShopkeep?.disposition;
		const bargainDC = npcData?.bargainDC || legacyShopkeep?.bargainDC;
		const quirk = npcData?.quirk || legacyShopkeep?.quirk;

		infoEl.createEl('p', { text: `${name} (${species})` });
		infoEl.createEl('p', { text: `Disposition: ${disposition} (DC ${bargainDC})` });
		infoEl.createEl('p', { text: `"${quirk}"`, cls: 'shopkeep-quirk' });

		// Add "View NPC Profile" button if NPC system is being used
		if (npcData && this.shop.shopkeepNPC) {
			const viewNPCBtn = infoEl.createEl('button', {
				text: 'View NPC Profile',
				cls: 'shop-view-npc-btn'
			});
			viewNPCBtn.onclick = async () => {
				// Find NPC file path
				const npcPath = await this.plugin.dataAdapter.findNPCPath(npcData.name);
				if (npcPath) {
					new NPCProfileModal(
						this.app,
						this.plugin,
						npcData,
						npcPath,
						async (updatedNPC) => {
							// Update cached NPC data in shop
							this.shop.shopkeepData = updatedNPC;
							this.onOpen(); // Re-render
						}
					).open();
				} else {
					new Notice('Could not find NPC file');
				}
			};
		}

		// Bulk discount toggle
		const bulkEl = infoEl.createDiv();
		const checkbox = bulkEl.createEl('input', { type: 'checkbox' });
		checkbox.checked = this.bulkDiscountEnabled;
		checkbox.onchange = () => {
			this.bulkDiscountEnabled = checkbox.checked;
			this.onOpen(); // Re-render
		};
		bulkEl.createSpan({ text: ' Enable Bulk Discount (3+ items)' });
	}

	renderTabs(container: HTMLElement) {
		const tabsEl = container.createDiv({ cls: 'shop-tabs' });

		const buyTab = tabsEl.createEl('button', {
			text: 'Buy from Shop',
			cls: this.currentView === 'buy' ? 'shop-tab-active' : ''
		});
		buyTab.onclick = () => {
			this.currentView = 'buy';
			this.onOpen();
		};

		const sellTab = tabsEl.createEl('button', {
			text: 'Sell to Shop',
			cls: this.currentView === 'sell' ? 'shop-tab-active' : ''
		});
		sellTab.onclick = () => {
			this.currentView = 'sell';
			this.onOpen();
		};

		const ordersTab = tabsEl.createEl('button', {
			text: 'Special Orders',
			cls: this.currentView === 'orders' ? 'shop-tab-active' : ''
		});
		ordersTab.onclick = () => {
			this.currentView = 'orders';
			this.onOpen();
		};
	}

	renderInventory(container: HTMLElement) {
		const inventoryEl = container.createDiv({ cls: 'shop-inventory' });

		const headerEl = inventoryEl.createDiv({ cls: 'inventory-header' });

		let headerText = 'Shop Inventory';
		if (this.currentView === 'sell') headerText = 'Your Items';
		if (this.currentView === 'orders') headerText = 'Place Special Order';

		headerEl.createEl('h3', { text: headerText });

		// Add sorting/filtering controls for buy view
		if (this.currentView === 'buy') {
			this.renderInventoryControls(headerEl);
		}

		if (this.currentView === 'buy') {
			this.renderBuyInventory(inventoryEl);
		} else if (this.currentView === 'sell') {
			this.renderSellInventory(inventoryEl);
		} else if (this.currentView === 'orders') {
			this.renderOrdersView(inventoryEl);
		}
	}

	renderOrdersView(container: HTMLElement) {
		container.createEl('p', { text: 'Search for an item to place a special order. Orders have a 50% markup and take time to craft.' });

		// Search input for finding items
		const searchDiv = container.createDiv({ cls: 'order-search' });
		const searchInput = searchDiv.createEl('input', {
			type: 'text',
			placeholder: 'Search for item to order...',
			cls: 'order-search-input'
		});

		const searchBtn = searchDiv.createEl('button', { text: 'Search' });
		searchBtn.onclick = async () => {
			await this.searchForOrderItem(searchInput.value);
		};

		// Display existing orders
		this.renderExistingOrders(container);
	}

	async searchForOrderItem(query: string) {
		if (!query) {
			new Notice('Please enter a search term');
			return;
		}

		// Get all items and filter by search
		let allItems;
		try {
			allItems = await this.plugin.dataAdapter.getAvailableItems();
		} catch (error) {
			if (error.message && error.message.includes('No item folders configured')) {
				new Notice('⚠️ Please configure item folders in Quartermaster settings first', 5000);
				return;
			}
			throw error;
		}
		const results = allItems.filter(item =>
			item.name.toLowerCase().includes(query.toLowerCase()) ||
			item.type.toLowerCase().includes(query.toLowerCase()) ||
			item.category.toLowerCase().includes(query.toLowerCase())
		);

		if (results.length === 0) {
			new Notice('No items found matching your search');
			return;
		}

		// Show modal with results
		this.showOrderItemModal(results);
	}

	showOrderItemModal(items: Item[]) {
		// For simplicity, just order the first item found
		// In a full implementation, this would show a selection modal
		const item = items[0];

		const order = this.orderManager.placeOrder(
			this.plugin.randomizer,
			item,
			this.shop.name,
			this.shop.shopkeep?.name
		);

		new Notice(`Order placed for ${item.name}! Ready in ${order.craftingDays} days (${order.completionDate})`);
		this.onOpen(); // Re-render to show new order
	}

	renderExistingOrders(container: HTMLElement) {
		const config = this.plugin.dataAdapter.getCurrencyConfig();
		const ordersDiv = container.createDiv({ cls: 'existing-orders' });
		ordersDiv.createEl('h4', { text: 'Your Orders' });

		const allOrders = this.orderManager.getAllOrders();

		if (allOrders.length === 0) {
			ordersDiv.createEl('p', { text: 'No orders placed yet' });
			return;
		}

		allOrders.forEach(order => {
			const orderEl = ordersDiv.createDiv({ cls: 'order-item' });

			orderEl.createSpan({ text: `${order.item.name}` });
			orderEl.createSpan({ text: ` - ${formatCurrency(order.price, config)}` });
			orderEl.createSpan({ text: ` (${order.status})` });

			if (order.status === 'pending') {
				const timeRemaining = this.orderManager.getTimeRemaining(order);
				orderEl.createSpan({ text: ` - ${timeRemaining}` });

				// Check if order is ready (completion date has passed)
				const readyOrders = this.orderManager.getReadyOrders();
				const isReady = readyOrders.some(o => o.itemName === order.itemName && o.orderDate === order.orderDate);

				if (isReady) {
					const pickupBtn = orderEl.createEl('button', { text: 'Pick Up' });
					pickupBtn.onclick = async () => {
						await this.pickupOrder(order);
					};
				}
			}
		});
	}

	async pickupOrder(order: any) {
		// Mark order as completed
		this.orderManager.completeOrder(order.itemName);

		// Add to party inventory (similar to purchase)
		const purchasedItem: PurchasedItem = {
			...order.item,
			quantity: 1,
			totalCost: order.price,
			stock: 0,
			originalCost: order.item.cost
		};

		const totalInCopper = convertToCopper(order.price);
		await this.plugin.dataAdapter.updatePartyInventory([purchasedItem], totalInCopper);
		await this.plugin.dataAdapter.logTransaction(
			[purchasedItem],
			order.price,
			this.shop.name,
			{ transactionType: 'purchase' }
		);

		new Notice(`Picked up ${order.item.name}!`);
		this.onOpen();
	}

	renderInventoryControls(container: HTMLElement) {
		const controlsEl = container.createDiv({ cls: 'inventory-controls' });

		// Sort dropdown
		const sortLabel = controlsEl.createSpan({ text: 'Sort by: ', cls: 'control-label' });
		const sortSelect = controlsEl.createEl('select');

		const sortOptions = [
			{ value: 'category', label: 'Category' },
			{ value: 'price', label: 'Price' },
			{ value: 'rarity', label: 'Rarity' },
			{ value: 'type', label: 'Type' },
			{ value: 'name', label: 'Name' }
		];

		sortOptions.forEach(option => {
			const optEl = sortSelect.createEl('option', {
				value: option.value,
				text: option.label
			});
			if (this.inventoryFilter.getSortOptions().criteria === option.value) {
				optEl.selected = true;
			}
		});

		sortSelect.onchange = () => {
			this.inventoryFilter.setSort(sortSelect.value as any);
			this.onOpen(); // Re-render
		};

		// Toggle sort direction button
		const toggleBtn = controlsEl.createEl('button', {
			text: this.inventoryFilter.getSortIndicator(),
			cls: 'sort-toggle'
		});
		toggleBtn.onclick = () => {
			this.inventoryFilter.toggleDirection();
			this.onOpen();
		};

		// Search input
		const searchInput = controlsEl.createEl('input', {
			type: 'text',
			placeholder: 'Search items...',
			cls: 'search-input'
		});
		searchInput.value = this.inventoryFilter.getSearchQuery();
		searchInput.oninput = () => {
			this.inventoryFilter.setSearch(searchInput.value);
			this.onOpen();
		};
	}

	renderBuyInventory(container: HTMLElement) {
		// Render Base Stock section
		if (this.shop.baseStock && this.shop.baseStock.length > 0) {
			const baseStockHeader = container.createEl('h3', { text: 'Base Stock', cls: 'inventory-section-header' });
			baseStockHeader.style.marginTop = '0';
			baseStockHeader.style.marginBottom = '10px';
			baseStockHeader.style.color = 'var(--text-accent)';

			const baseStockContainer = container.createDiv({ cls: 'inventory-section' });
			this.renderInventorySection(baseStockContainer, this.shop.baseStock, 'base');
		}

		// Render Special Stock section
		if (this.shop.specialStock && this.shop.specialStock.length > 0) {
			// Create header container with button
			const headerContainer = container.createDiv({ cls: 'shop-inventory-header' });
			headerContainer.style.marginTop = '20px';
			headerContainer.style.marginBottom = '10px';

			const specialStockHeader = headerContainer.createEl('h3', { text: 'Special Stock', cls: 'inventory-section-header' });
			specialStockHeader.style.margin = '0';
			specialStockHeader.style.color = 'var(--text-accent)';

			// Add management buttons
			const managementDiv = headerContainer.createDiv({ cls: 'shop-management' });

			const addItemBtn = managementDiv.createEl('button', {
				text: '+ Add Item',
				cls: 'shop-mgmt-btn'
			});
			addItemBtn.onclick = async () => {
				await this.openAddItemModal();
			};

			const rerollAllBtn = managementDiv.createEl('button', {
				text: '🔄 Re-roll All',
				cls: 'shop-mgmt-btn'
			});
			rerollAllBtn.onclick = () => {
				this.rerollAllSpecialStock();
			};

			const specialStockContainer = container.createDiv({ cls: 'inventory-section' });
			this.renderInventorySection(specialStockContainer, this.shop.specialStock, 'special');
		}

		// Legacy support: render single inventory if present
		if (this.shop.inventory && this.shop.inventory.length > 0) {
			this.renderInventorySection(container, this.shop.inventory, 'special');
		}

		// Check if all sections are empty
		const hasNoItems =
			(!this.shop.baseStock || this.shop.baseStock.length === 0) &&
			(!this.shop.specialStock || this.shop.specialStock.length === 0) &&
			(!this.shop.inventory || this.shop.inventory.length === 0);

		if (hasNoItems) {
			container.createEl('p', { text: 'No items in shop inventory.' });
		}
	}

	renderInventorySection(container: HTMLElement, inventory: ShopItem[], stockType: 'base' | 'special' = 'special') {
		const config = this.plugin.dataAdapter.getCurrencyConfig();
		// Apply sorting and filtering
		const filteredItems = this.inventoryFilter.apply(inventory);

		if (filteredItems.length === 0) {
			container.createEl('p', { text: 'No items match your search or filter criteria.' });
			return;
		}

		filteredItems.forEach((item, index) => {
			const itemEl = container.createDiv({ cls: 'shop-item' });

			// Item info section
			const infoSection = itemEl.createDiv({ cls: 'shop-item-info' });

			// Add rarity tag for magic items
			if (isMagicItem(item)) {
				const rarityClass = `rarity-${item.rarity.toLowerCase().replace(/ /g, '-')}`;
				infoSection.createSpan({
					cls: `rarity-tag ${rarityClass}`,
					text: item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1)
				});
			}

			// Create item name as internal link for hover preview
			this.renderItemLink(infoSection, item);

			// Add variant dropdown if this item has pre-resolved variants
			if (item.availableVariants && item.availableVariants.length > 1) {
				this.renderVariantDropdown(infoSection, item);
			}

			infoSection.createSpan({ text: ` - ${formatCurrency(item.costOverride || item.cost, config)}` });
			infoSection.createSpan({ text: ` (${item.stock} in stock)` });

			// Quantity counter section
			const quantitySection = itemEl.createDiv({ cls: 'shop-item-quantity-controls' });

			// Get current quantity in cart for this item (using composite key for variants)
			const itemKey = getItemKey(item);
			const cartItem = this.cartManager.getCartItems().find(ci => getItemKey(ci) === itemKey);
			const currentQuantity = cartItem?.quantity || 0;

			// Calculate max quantity based on stock and available money
			const itemCost = item.costOverride || item.cost;
			const itemCostInCopper = convertToCopper(itemCost);
			const currentCartTotal = this.cartManager.getCartTotalInCopper();
			// TODO: Get actual party gold amount - for now assume unlimited
			const maxByMoney = Math.floor((999999999 - currentCartTotal) / itemCostInCopper);
			const maxQuantity = Math.min(item.stock + currentQuantity, maxByMoney);

			// << button (set to 0)
			const minBtn = quantitySection.createEl('button', { text: '<<', cls: 'quantity-btn-min' });
			minBtn.onclick = () => {
				if (currentQuantity > 0) {
					this.updateItemQuantity(item, 0, currentQuantity);
				}
			};

			// < button (decrease by 1)
			const decreaseBtn = quantitySection.createEl('button', { text: '<', cls: 'quantity-btn-decrease' });
			decreaseBtn.onclick = () => {
				if (currentQuantity > 0) {
					this.updateItemQuantity(item, currentQuantity - 1, currentQuantity);
				}
			};

			// Current quantity display
			const quantityDisplay = quantitySection.createSpan({
				text: currentQuantity.toString(),
				cls: 'quantity-display'
			});

			// > button (increase by 1)
			const increaseBtn = quantitySection.createEl('button', { text: '>', cls: 'quantity-btn-increase' });
			increaseBtn.onclick = () => {
				if (currentQuantity < maxQuantity) {
					this.updateItemQuantity(item, currentQuantity + 1, currentQuantity);
				}
			};

			// >> button (set to max)
			const maxBtn = quantitySection.createEl('button', { text: '>>', cls: 'quantity-btn-max' });
			maxBtn.onclick = () => {
				if (currentQuantity < maxQuantity) {
					this.updateItemQuantity(item, maxQuantity, currentQuantity);
				}
			};

			// Disable buttons if at limits
			if (currentQuantity === 0) {
				minBtn.disabled = true;
				decreaseBtn.disabled = true;
			}
			if (currentQuantity >= maxQuantity) {
				increaseBtn.disabled = true;
				maxBtn.disabled = true;
			}

			// Add re-roll and delete buttons for special stock items
			if (stockType === 'special') {
				const rerollBtn = quantitySection.createEl('button', {
					text: '🔄',
					cls: 'shop-reroll-btn'
				});
				rerollBtn.onclick = () => {
					this.rerollSpecialStockItem(item);
				};

				const deleteBtn = quantitySection.createEl('button', {
					text: 'X',
					cls: 'shop-remove-btn'
				});
				deleteBtn.onclick = () => {
					this.deleteSpecialStockItem(item);
				};
			}
		});
	}

	updateItemQuantity(item: ShopItem, newQuantity: number, oldQuantity: number) {
		const config = this.plugin.dataAdapter.getCurrencyConfig();
		// Calculate the difference
		const diff = newQuantity - oldQuantity;

		if (diff > 0) {
			// Adding items to cart
			this.cartManager.addToCart(item, diff);
			item.stock -= diff;
		} else if (diff < 0) {
			// Removing items from cart
			const cartItem = this.cartManager.getCartItems().find(ci => ci.name === item.name);
			if (cartItem) {
				if (newQuantity === 0) {
					// Remove completely
					this.cartManager.removeFromCart(cartItem);
					item.stock += oldQuantity;
				} else {
					// Update quantity
					cartItem.quantity = newQuantity;
					cartItem.totalCost = multiplyCurrency(cartItem.cost, newQuantity, config);
					item.stock += Math.abs(diff);
				}
			}
		}

		this.onOpen();
	}

	deleteSpecialStockItem(item: ShopItem) {
		// Remove from special stock
		const index = this.shop.specialStock.findIndex(i => getItemKey(i) === getItemKey(item));
		if (index !== -1) {
			this.shop.specialStock.splice(index, 1);

			// Remove from cart if it was there
			const itemKey = getItemKey(item);
			const cartItem = this.cartManager.getCartItems().find(ci => getItemKey(ci) === itemKey);
			if (cartItem) {
				this.cartManager.removeFromCart(cartItem);
			}

			// Save shop and refresh UI
			if (this.shopFilePath) {
				this.plugin.dataAdapter.saveShop(this.shop, this.shopFilePath);
			}
			this.onOpen();
		}
	}

	async rerollSpecialStockItem(item: ShopItem) {
		try {
			// Get all available items
			const allItems = await this.plugin.dataAdapter.getAvailableItems();

			// Import necessary functions
			const { createShopItem } = await import('@quartermaster/core/generators/inventory');

			// Filter items to same rarity as the item we're replacing
			const sameRarityItems = allItems.filter((i: Item) => i.rarity === item.rarity);

			// Remove the current item from the pool
			const replacementPool = sameRarityItems.filter((i: Item) => getItemKey(i) !== getItemKey(item));

			if (replacementPool.length === 0) {
				new Notice('No alternative items found for this rarity');
				return;
			}

			// Select random replacement
			const randomIndex = Math.floor(Math.random() * replacementPool.length);
			const replacement = replacementPool[randomIndex];

			// Create shop item from replacement
			const newShopItem = createShopItem(this.plugin.randomizer, replacement, allItems);

			// Find and replace in special stock
			const index = this.shop.specialStock.findIndex(i => getItemKey(i) === getItemKey(item));
			if (index !== -1) {
				// Remove from cart if the old item was there
				const itemKey = getItemKey(item);
				const cartItem = this.cartManager.getCartItems().find(ci => getItemKey(ci) === itemKey);
				if (cartItem) {
					this.cartManager.removeFromCart(cartItem);
				}

				// Replace the item
				this.shop.specialStock[index] = newShopItem;

				// Save shop and refresh UI
				if (this.shopFilePath) {
					await this.plugin.dataAdapter.saveShop(this.shop, this.shopFilePath);
				}
				this.onOpen();
			}
		} catch (error) {
			console.error('Error re-rolling special stock item:', error);
			new Notice('Failed to re-roll item');
		}
	}

	async rerollAllSpecialStock() {
		try {
			const config = this.plugin.dataAdapter.getCurrencyConfig();
			// Get all available items
			const allItems = await this.plugin.dataAdapter.getAvailableItems();

			// Import inventory generation function and base stock
			const { generateRandomShopInventory } = await import('@quartermaster/core/generators/inventory');

			// Load shop config
			const shopConfig = await this.plugin.dataAdapter.getShopConfig(this.shop.type, this.shop.wealthLevel);

			// Load base stock configuration
			const baseStockConfig = await this.plugin.dataAdapter.getBaseStockConfig();
			const baseStockItems = baseStockConfig?.[this.shop.type]?.[this.shop.wealthLevel] || [];

			// Generate new special stock using the same parameters
			const newInventory = generateRandomShopInventory(
				this.plugin.randomizer,
				allItems,
				shopConfig,
				config,
				this.shop.type,
				baseStockItems
			);

			// Clear cart for all items in special stock
			this.shop.specialStock.forEach(item => {
				const itemKey = getItemKey(item);
				const cartItem = this.cartManager.getCartItems().find(ci => getItemKey(ci) === itemKey);
				if (cartItem) {
					this.cartManager.removeFromCart(cartItem);
				}
			});

			// Replace special stock with newly generated inventory
			this.shop.specialStock = newInventory.specialStock;

			// Save shop and refresh UI
			if (this.shopFilePath) {
				await this.plugin.dataAdapter.saveShop(this.shop, this.shopFilePath);
			}
			this.onOpen();

			new Notice('Special stock re-rolled successfully');
		} catch (error) {
			console.error('Error re-rolling all special stock:', error);
			new Notice('Failed to re-roll special stock');
		}
	}

	async openAddItemModal() {
		const { AddShopItemModal } = await import('./AddShopItemModal');

		const modal = new AddShopItemModal(
			this.app,
			this.plugin,
			this.shop,
			(shopItem: ShopItem) => {
				// Add item to special stock
				this.shop.specialStock.push(shopItem);

				// Save shop and refresh UI
				if (this.shopFilePath) {
					this.plugin.dataAdapter.saveShop(this.shop, this.shopFilePath);
				}
				this.onOpen();
			}
		);

		modal.open();
	}

	renderSellInventory(container: HTMLElement) {
		const config = this.plugin.dataAdapter.getCurrencyConfig();
		// Add search and custom item controls
		const sellControlsEl = container.createDiv({ cls: 'sell-controls' });

		// Button to add items from vault or create custom
		const addItemBtn = sellControlsEl.createEl('button', {
			text: '+ Add Item to Sell',
			cls: 'mod-cta'
		});
		addItemBtn.onclick = async () => {
			await this.openSellItemSearchModal();
		};

		// Divider
		container.createEl('hr');

		// Display party inventory items
		if (this.partyItems.length === 0) {
			container.createEl('p', { text: 'No items in party inventory' });
			return;
		}

		// Filter items by shop type interest
		const sellableItems = filterSellableItems(this.partyItems, this.shop.type);

		if (sellableItems.length === 0) {
			container.createEl('p', { text: `This ${this.shop.type} shop isn't interested in buying any of your items from your inventory.` });
		} else {
			container.createEl('h4', { text: 'Items in Party Inventory:' });

			const disposition = this.shop.shopkeep?.disposition || 'neutral';

			sellableItems.forEach(item => {
				// Get party inventory item to find quantity
				const partyItem = this.partyItems.find(p => p.name === item.name);
				const quantity = 1; // Default, will be updated when we have full quantity tracking

				const sellItem = createSellItem(item, quantity, disposition, config);

				const itemEl = container.createDiv({ cls: 'shop-item' });

				// Render item name as link with hover preview
				this.renderItemLink(itemEl, item);

				itemEl.createSpan({ text: ` - ${formatCurrency(sellItem.sellPrice, config)}` });
				itemEl.createSpan({ text: ` (${sellItem.ownedQuantity} owned)`, cls: 'item-quantity' });

				// Show base vs modified price if different
				if (disposition !== 'neutral') {
					itemEl.createSpan({
						text: ` (Base: ${formatCurrency(sellItem.baseSellPrice, config)})`,
						cls: 'item-base-price'
					});
				}

				const addBtn = itemEl.createEl('button', { text: 'Add to Sell Cart' });
				addBtn.onclick = () => {
					this.sellManager.addToCart(sellItem, 1);
					this.onOpen();
				};
			});
		}
	}

	async openSellItemSearchModal() {
		const config = this.plugin.dataAdapter.getCurrencyConfig();
		const { AddSellItemModal } = await import('./AddSellItemModal');
		new AddSellItemModal(this.app, this.plugin, this.shop, (item) => {
			// Create a sell item from the selected/custom item
			const disposition = this.shop.shopkeep?.disposition || 'neutral';
			const sellItem = createSellItem(item, 1, disposition, config);
			this.sellManager.addToCart(sellItem, 1);
			this.onOpen();
		}).open();
	}

	renderCart(container: HTMLElement) {
		// Don't show cart in orders view
		if (this.currentView === 'orders') {
			return;
		}

		const cartEl = container.createDiv({ cls: 'shop-cart' });

		if (this.currentView === 'buy') {
			this.renderBuyCart(cartEl);
		} else {
			this.renderSellCart(cartEl);
		}
	}

	renderBuyCart(container: HTMLElement) {
		const config = this.plugin.dataAdapter.getCurrencyConfig();
		container.createEl('h3', { text: 'Purchase Cart' });

		if (!this.cartManager.hasItems()) {
			container.createEl('p', { text: 'Cart is empty' });
			return;
		}

		this.cartManager.getCartItems().forEach(item => {
			const itemEl = container.createDiv({ cls: 'cart-item' });
			itemEl.createSpan({ text: `${item.name} (${item.quantity}x)` });
			itemEl.createSpan({ text: ` - ${formatCurrency(item.totalCost, config)}` });

			const removeBtn = itemEl.createEl('button', { text: 'Remove' });
			removeBtn.onclick = () => {
				this.cartManager.removeFromCart(item);
				this.onOpen();
			};
		});

		const totalEl = container.createDiv({ cls: 'cart-total' });
		totalEl.createEl('strong', { text: `Total Cost: ${formatCurrency(this.cartManager.getCartTotal(), config)}` });
	}

	renderSellCart(container: HTMLElement) {
		const config = this.plugin.dataAdapter.getCurrencyConfig();
		container.createEl('h3', { text: 'Sell Cart' });

		if (this.sellManager.isEmpty()) {
			container.createEl('p', { text: 'Sell cart is empty' });
			return;
		}

		this.sellManager.getCart().forEach(item => {
			const itemEl = container.createDiv({ cls: 'cart-item' });
			itemEl.createSpan({ text: `${item.sellItem.name} (${item.quantityToSell}x)` });
			itemEl.createSpan({ text: ` + ${formatCurrency(item.totalPrice, config)}` });

			const removeBtn = itemEl.createEl('button', { text: 'Remove' });
			removeBtn.onclick = () => {
				this.sellManager.removeFromCart(item.sellItem.name);
				this.onOpen();
			};
		});

		const totalEl = container.createDiv({ cls: 'cart-total' });
		totalEl.createEl('strong', { text: `Total Gained: ${formatCurrency(this.sellManager.calculateTotal(), config)}` });
	}

	renderActions(container: HTMLElement) {
		// Don't show standard actions in orders view
		if (this.currentView === 'orders') {
			return;
		}

		const actionsEl = container.createDiv({ cls: 'shop-actions' });

		if (this.currentView === 'buy') {
			// Bargain button (only for purchases)
			if (this.shop.shopkeep && !this.bargainingHelper.isBargainApplied()) {
				const bargainBtn = actionsEl.createEl('button', { text: 'Apply Bargain Discount' });
				bargainBtn.onclick = () => {
					const discount = this.bargainingHelper.getBargainDiscountPercent(this.shop.shopkeep!.bargainDC);

					// Apply discount to both base stock and special stock
					if (this.shop.baseStock) {
						this.shop.baseStock.forEach(item => {
							this.bargainingHelper.applyBargainDiscount(item, this.shop.shopkeep!, discount);
						});
					}
					if (this.shop.specialStock) {
						this.shop.specialStock.forEach(item => {
							this.bargainingHelper.applyBargainDiscount(item, this.shop.shopkeep!, discount);
						});
					}

					// Legacy support
					if (this.shop.inventory) {
						this.shop.inventory.forEach(item => {
							this.bargainingHelper.applyBargainDiscount(item, this.shop.shopkeep!, discount);
						});
					}

					new Notice(`Applied ${discount}% discount!`);
					this.onOpen();
				};
			}

			// Checkout button
			const checkoutBtn = actionsEl.createEl('button', {
				text: 'Complete Purchase',
				cls: 'mod-cta'
			});
			checkoutBtn.onclick = async () => {
				await this.completePurchase();
			};
		} else {
			// Complete sale button
			const sellBtn = actionsEl.createEl('button', {
				text: 'Complete Sale',
				cls: 'mod-cta'
			});
			sellBtn.onclick = async () => {
				await this.completeSale();
			};
		}

		// Restock button (only for buy view)
		if (this.currentView === 'buy') {
			const restockBtn = actionsEl.createEl('button', { text: 'Restock Inventory' });
			restockBtn.onclick = async () => {
				await this.restockInventory();
			};
		}

		// Save shop button
		const saveBtn = actionsEl.createEl('button', { text: 'Save Shop' });
		saveBtn.onclick = async () => {
			await this.saveShop();
		};
	}

	async completePurchase() {
		const config = this.plugin.dataAdapter.getCurrencyConfig();
		if (!this.cartManager.hasItems()) {
			new Notice('Cart is empty!');
			return;
		}

		const items = this.cartManager.getCartItems();
		const totalInCopper = this.cartManager.getCartTotalInCopper();
		const totalCost = this.cartManager.getCartTotal();

		// Use adapters to persist
		await this.plugin.dataAdapter.updatePartyInventory(items, totalInCopper);
		await this.plugin.dataAdapter.logTransaction(items, totalCost, this.shop.name);

		// Update shop gold after transaction (shop gains gold from sale to party)
		if (this.shop.fundsOnHand) {
			this.shop.fundsOnHand = updateShopGoldAfterTransaction(
				this.shop.fundsOnHand,
				totalCost, // Shop sold to party (gains gold)
				{ copper: 0, silver: 0, gold: 0, platinum: 0 }, // No purchases from party
				config
			);

			// Save updated shop
			await this.saveShop();
		}

		new Notice(`Purchase complete! Total: ${formatCurrency(totalCost, config)}`);
		this.cartManager.clearCart();
		this.close();
	}

	async completeSale() {
		const config = this.plugin.dataAdapter.getCurrencyConfig();
		if (this.sellManager.isEmpty()) {
			new Notice('Sell cart is empty!');
			return;
		}

		// Validate cart
		const validation = this.sellManager.validate();
		if (!validation.valid) {
			new Notice(`Cannot complete sale: ${validation.errors.join(', ')}`);
			return;
		}

		const sellItems = this.sellManager.getCart();
		const totalGained = this.sellManager.calculateTotal();
		const totalInCopper = this.sellManager.getTotalValueInCopper();

		// Validate shop can afford this purchase
		if (this.shop.fundsOnHand && !canShopAffordPurchase(this.shop.fundsOnHand, totalGained, config)) {
			// Calculate max the shop can afford
			let maxAffordable = 0;
			const shopFundsCopper = convertToCopper(this.shop.fundsOnHand);

			// Show detailed message
			const shopFundsStr = formatCurrency(this.shop.fundsOnHand, config);
			const attemptedStr = formatCurrency(totalGained, config);

			new Notice(`Shop cannot afford this purchase! Shop has ${shopFundsStr}, but you're trying to sell ${attemptedStr} worth of items.`);
			return;
		}

		// Convert sell items to PurchasedItem format for transaction log
		const transactionItems: PurchasedItem[] = sellItems.map(item => ({
			...item.sellItem,
			quantity: item.quantityToSell,
			totalCost: item.totalPrice,
			stock: 0, // Not applicable for sells
			originalCost: item.sellItem.cost
		}));

		// Update party inventory (add currency, remove items)
		// Note: For sells, we pass negative copper to ADD currency to party
		await this.plugin.dataAdapter.updatePartyInventory(transactionItems, -totalInCopper);

		// Log transaction with sell context
		await this.plugin.dataAdapter.logTransaction(
			transactionItems,
			totalGained,
			this.shop.name,
			{ transactionType: 'sale' }
		);

		// Update shop gold after transaction (shop loses gold, party gains)
		if (this.shop.fundsOnHand) {
			this.shop.fundsOnHand = updateShopGoldAfterTransaction(
				this.shop.fundsOnHand,
				{ copper: 0, silver: 0, gold: 0, platinum: 0 }, // No purchases from shop
				totalGained, // Shop buys from party (loses gold)
				config
			);

			// Save updated shop
			await this.saveShop();
		}

		new Notice(`Sale complete! You gained: ${formatCurrency(totalGained, config)}`);
		this.sellManager.clearCart();
		this.partyItems = []; // Force reload on next view
		this.close();
	}

	async restockInventory() {
		try {
			// Get all available items
			let allItems;
			try {
				allItems = await this.plugin.dataAdapter.getAvailableItems();
			} catch (error) {
				if (error.message && error.message.includes('No item folders configured')) {
					new Notice('⚠️ Please configure item folders in Quartermaster settings first', 5000);
					return;
				}
				throw error;
			}

			// Restock using core logic
			const result = await this.restockManager.restock(
				this.plugin.randomizer,
				this.shop,
				allItems,
			(this.plugin.dataAdapter as any).getCurrencyConfig()
			);

			// Update shop inventory
			this.shop = result.shop;

			// Format and display statistics
			const statsMessage = this.restockManager.formatStats(result.stats);
			new Notice(statsMessage);

			// Re-render to show updated inventory
			this.onOpen();
		} catch (error) {
			new Notice('Failed to restock inventory');
			console.error(error);
		}
	}

	async saveShop() {
		await this.plugin.dataAdapter.saveShop(this.shop, this.plugin.settings.shopsFolder);
		new Notice(`Shop saved: ${this.shop.name}`);
	}

	renderItemLink(container: HTMLElement, item: ShopItem | Item) {
		// Check if item has a valid file path
		if (item.file && item.file.path) {
			// Create an internal link element
			const linkEl = container.createEl('a', {
				cls: 'internal-link',
				href: item.file.path
			});
			linkEl.textContent = item.name;

			// Enable hover preview by registering the link
			linkEl.addEventListener('mouseover', (event) => {
				this.app.workspace.trigger('hover-link', {
					event,
					source: 'quartermaster',
					hoverParent: container,
					targetEl: linkEl,
					linktext: item.file.path
				});
			});
		} else {
			// No file path, just display as text
			container.createSpan({ text: item.name });
		}
	}

	async renderVariantDropdown(container: HTMLElement, item: ShopItem) {
		// Create a dropdown with all variant options
		const dropdownContainer = container.createDiv({ cls: 'variant-dropdown-container' });

		const select = dropdownContainer.createEl('select', { cls: 'variant-dropdown' });
		select.title = 'Change variant';

		// Add all variant options to dropdown (from pre-resolved variants)
		if (item.availableVariants) {
			item.availableVariants.forEach((variant, index) => {
				const option = select.createEl('option', {
					value: index.toString(),
					text: variant.name
				});

				// Mark currently selected variant
				if (index === (item.selectedVariantIndex || 0)) {
					option.selected = true;
				}
			});
		}

		// Handle variant change
		select.onchange = () => {
			const selectedIndex = parseInt(select.value);

			if (!item.availableVariants || selectedIndex === item.selectedVariantIndex) {
				return; // No change
			}

			const selectedVariant = item.availableVariants[selectedIndex];

			if (selectedVariant) {
				// Get old key for cart update
				const oldKey = getItemKey(item);

				// Check if old variant was in cart
				const cartItem = this.cartManager.getCartItems().find(ci => getItemKey(ci) === oldKey);
				const hadCartQuantity = cartItem?.quantity || 0;

				// Update the shop item with new variant details
				item.name = selectedVariant.name;
				item.cost = selectedVariant.cost;
				item.baseItemName = selectedVariant.baseItemName;
				item.selectedVariantIndex = selectedIndex;

				// Clear any cost override when changing variants
				delete item.costOverride;

				// If item was in cart, remove old entry
				if (hadCartQuantity > 0 && cartItem) {
					this.cartManager.removeFromCart(cartItem);
					// Restore stock that was reserved by cart
					item.stock += hadCartQuantity;
					// Cart will be updated when user clicks quantity buttons again
					new Notice(`Variant changed. Please re-add ${selectedVariant.name} to cart if desired.`);
				}

				// Re-render the inventory to show updated item
				this.onOpen();

				if (hadCartQuantity === 0) {
					new Notice(`Changed variant to ${selectedVariant.name}`);
				}
			} else {
				new Notice('Failed to change variant');
				console.error('Variant not found at index:', selectedIndex);
			}
		};
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
