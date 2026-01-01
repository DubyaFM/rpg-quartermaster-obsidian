// Modal for generating new shops
import { Modal, App, Setting, Notice } from 'obsidian';
import { Shopkeep, Shop } from '@quartermaster/core/models/types';
import { NPC_TABLES } from '@quartermaster/core/data/npcTables';
import { generateRandomShopkeep, rerollShopkeepTrait } from '@quartermaster/core/generators/shopkeeper';
import { generateRandomShopInventory, generateShopFunds } from '@quartermaster/core/generators/inventory';
import { generateShopkeepNPC, shopkeepToNPC } from '@quartermaster/core/generators/npc';
import type QuartermasterPlugin from '../main';
import { ShopModal } from './ShopModal';

export class NewShopModal extends Modal {
	plugin: QuartermasterPlugin;
	shopType: string = 'general';
	shopName: string = 'General Store';
	wealthLevel: string = 'modest';
	shopLocation: string = '';
	shopkeep?: Shopkeep;
	allowedTypesContent?: HTMLDivElement;

	constructor(app: App, plugin: QuartermasterPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Generate New Shop' });

		// Shop Name
		new Setting(contentEl)
			.setName('Shop Name')
			.setDesc('Enter a name for this shop')
			.addText(text => text
				.setPlaceholder('The Rusty Anvil')
				.setValue(this.shopName)
				.onChange(value => this.shopName = value));

		// Shop Type
		new Setting(contentEl)
			.setName('Shop Type')
			.setDesc('Select the type of shop to generate')
			.addDropdown(dropdown => dropdown
				.addOption('blacksmith', 'Blacksmith')
				.addOption('alchemist', 'Alchemist')
				.addOption('general', 'General Store')
				.addOption('magic', 'Magic Shop')
				.addOption('tavern', 'Tavern')
				.addOption('marketplace', 'Large Marketplace')
				.addOption('inn', 'Inn (Service Provider)')
				.addOption('temple', 'Temple (Service Provider)')
				.addOption('travel', 'Travel Services')
				.setValue(this.shopType)
				.onChange(async (value) => {
					this.shopType = value;
					await this.updateAllowedTypesDisplay();
				}));

		// Wealth Level
		new Setting(contentEl)
			.setName('Wealth Level')
			.setDesc('Determines the shop\'s inventory quality and variety')
			.addDropdown(dropdown => dropdown
				.addOption('poor', 'Poor - Basic goods only')
				.addOption('modest', 'Modest - Some variety')
				.addOption('comfortable', 'Comfortable - Good selection')
				.addOption('wealthy', 'Wealthy - Quality goods')
				.addOption('aristocratic', 'Aristocratic - Rare items available')
				.setValue(this.wealthLevel)
				.onChange(async (value) => {
					this.wealthLevel = value;
					await this.updateAllowedTypesDisplay();
				}));

		// Location
		new Setting(contentEl)
			.setName('Location')
			.setDesc('Optional location for this shop')
			.addText(text => text
				.setPlaceholder('Market District, The Docks, etc.')
				.setValue(this.shopLocation)
				.onChange(value => this.shopLocation = value));

		// Allowed item types display
		const allowedTypesDiv = contentEl.createDiv({ cls: 'allowed-types-display' });
		allowedTypesDiv.createEl('h4', { text: 'Allowed Item Types:' });
		const allowedTypesContent = allowedTypesDiv.createDiv({ cls: 'allowed-types-content' });
		allowedTypesContent.setText('Loading...');

		// Store reference for updates
		this.allowedTypesContent = allowedTypesContent;

		// Initial update
		this.updateAllowedTypesDisplay();

		// Shopkeep generation section
		const shopkeepSection = contentEl.createDiv({ cls: 'shopkeep-section' });
		shopkeepSection.createEl('h3', { text: 'Shopkeep' });

		const shopkeepDisplay = shopkeepSection.createDiv({ cls: 'shopkeep-display' });
		this.renderShopkeepDisplay(shopkeepDisplay);

		const shopkeepBtn = shopkeepSection.createEl('button', {
			text: this.shopkeep ? 'Re-roll Shopkeep' : 'Generate Shopkeep',
			cls: 'mod-cta'
		});
		shopkeepBtn.onclick = () => {
			this.shopkeep = generateRandomShopkeep(this.plugin.randomizer, NPC_TABLES);
			this.renderShopkeepDisplay(shopkeepDisplay);
			shopkeepBtn.setText('Re-roll Shopkeep');
		};

		// Wealth level info
		const infoEl = contentEl.createDiv({ cls: 'shop-wealth-info' });
		infoEl.createEl('h4', { text: 'Wealth Level Guide:' });
		infoEl.createEl('p', { text: '• Poor: 8-15 common items, rare magic items almost never available' });
		infoEl.createEl('p', { text: '• Modest: 10-20 common items, occasional uncommon item' });
		infoEl.createEl('p', { text: '• Comfortable: 12-25 common items, several uncommon, rare items possible' });
		infoEl.createEl('p', { text: '• Wealthy: 15-30 common items, many uncommon, rare and very rare items' });
		infoEl.createEl('p', { text: '• Aristocratic: 18-35 common items, extensive variety including legendary items' });

		const generateBtn = contentEl.createEl('button', {
			text: 'Generate Shop',
			cls: 'mod-cta'
		});
		generateBtn.onclick = async () => {
			if (!this.shopName || !this.shopType) {
				new Notice('Please fill in all fields');
				return;
			}
			await this.generateShop();
		};
	}

	renderShopkeepDisplay(container: HTMLElement) {
		container.empty();

		if (!this.shopkeep) {
			container.createEl('p', { text: 'No shopkeep generated yet', cls: 'shopkeep-placeholder' });
			return;
		}

		const infoEl = container.createDiv({ cls: 'shopkeep-info' });

		// Name with re-roll
		const nameRow = infoEl.createDiv({ cls: 'shopkeep-row' });
		nameRow.createSpan({ text: `Name: ${this.shopkeep.name}`, cls: 'shopkeep-name' });
		const nameRerollBtn = nameRow.createEl('button', { text: '⟳', cls: 'shopkeep-reroll-btn' });
		nameRerollBtn.onclick = () => this.rerollTrait('name', container);

		// Species with re-roll
		const speciesRow = infoEl.createDiv({ cls: 'shopkeep-row' });
		speciesRow.createSpan({ text: `Species: ${this.shopkeep.species}` });
		const speciesRerollBtn = speciesRow.createEl('button', { text: '⟳', cls: 'shopkeep-reroll-btn' });
		speciesRerollBtn.onclick = () => this.rerollTrait('species', container);

		// Gender with re-roll
		const genderRow = infoEl.createDiv({ cls: 'shopkeep-row' });
		genderRow.createSpan({ text: `Gender: ${this.shopkeep.gender.charAt(0).toUpperCase() + this.shopkeep.gender.slice(1)}` });
		const genderRerollBtn = genderRow.createEl('button', { text: '⟳', cls: 'shopkeep-reroll-btn' });
		genderRerollBtn.onclick = () => this.rerollTrait('gender', container);

		// Disposition with re-roll
		const dispositionRow = infoEl.createDiv({ cls: 'shopkeep-row' });
		const dispositionText = dispositionRow.createSpan();
		dispositionText.createSpan({ text: `Disposition: ` });
		dispositionText.createSpan({
			text: `${this.shopkeep.disposition.charAt(0).toUpperCase() + this.shopkeep.disposition.slice(1)}`,
			cls: `shopkeep-disposition-${this.shopkeep.disposition}`
		});
		dispositionText.createSpan({ text: ` (DC ${this.shopkeep.bargainDC})`, cls: 'shopkeep-dc' });
		const dispositionRerollBtn = dispositionRow.createEl('button', { text: '⟳', cls: 'shopkeep-reroll-btn' });
		dispositionRerollBtn.onclick = () => this.rerollTrait('disposition', container);

		// Quirk with re-roll
		const quirkRow = infoEl.createDiv({ cls: 'shopkeep-row' });
		quirkRow.createSpan({ text: `Quirk: ${this.shopkeep.quirk}`, cls: 'shopkeep-quirk' });
		const quirkRerollBtn = quirkRow.createEl('button', { text: '⟳', cls: 'shopkeep-reroll-btn' });
		quirkRerollBtn.onclick = () => this.rerollTrait('quirk', container);
	}

	rerollTrait(trait: 'name' | 'species' | 'gender' | 'disposition' | 'quirk', container: HTMLElement) {
		if (!this.shopkeep) return;
		this.shopkeep = rerollShopkeepTrait(this.plugin.randomizer, this.shopkeep, trait, NPC_TABLES);
		this.renderShopkeepDisplay(container);
	}

	async updateAllowedTypesDisplay() {
		if (!this.allowedTypesContent) return;

		try {
			const config = await this.plugin.dataAdapter.getShopConfig(this.shopType, this.wealthLevel);
			if (!config || !config.basicItemTypes) {
				this.allowedTypesContent.setText('All item types allowed');
				return;
			}

			const types = Object.entries(config.basicItemTypes)
				.map(([type, chance]) => `${type} (${chance}%)`)
				.join(', ');

			this.allowedTypesContent.setText(types || 'No types configured');
		} catch (error) {
			console.error('[NewShopModal] Failed to load allowed types:', error);
			this.allowedTypesContent.setText('Error loading types');
		}
	}

	async generateShop() {
		let loadingNotice: Notice | null = null;
		try {
			// Show loading notice
			loadingNotice = new Notice('Generating shop...', 0);

			// Get all items using adapter
			let allItems;
			try {
				allItems = await this.plugin.dataAdapter.getAvailableItems();
			} catch (error) {
				loadingNotice?.hide();
				if (error.message && error.message.includes('No item folders configured')) {
					new Notice('⚠️ Please configure item folders in Quartermaster settings first', 5000);
					return;
				}
				throw error; // Re-throw other errors
			}

			if (!allItems || allItems.length === 0) {
				loadingNotice.hide();
				new Notice('No items found. Please configure item detection in settings or enable SRD database.');
				return;
			}

			// Filter out items with zero cost (non-magic items without prices, magic items that failed auto-pricing)
			// Exception: Keep variant parents (they have cost: "" by design, will be resolved with calculated costs)
			const itemsWithCost = allItems.filter(item => {
				// Keep variant parents - they have zero cost but will be resolved with calculated costs
				if (item.isVariant && item.variantAliases && item.variantAliases.length > 0) {
					return true;
				}

				// Filter out all non-variant items with zero cost
				// This includes: mundane items without cost, magic items that failed auto-pricing
				const totalCost = item.cost.copper + item.cost.silver + item.cost.gold + item.cost.platinum;
				if (totalCost === 0) {
					return false;
				}

				return true;
			});

			console.log(`[NewShopModal] Items with cost > 0: ${itemsWithCost.length}`);

			if (itemsWithCost.length === 0) {
				loadingNotice.hide();
				new Notice(`No items with valid costs found in vault. Please add item costs or enable the SRD database in settings.`);
				return;
			}

			// Get config and generate inventory (with template support!)
			const config = await this.plugin.dataAdapter.getShopConfig(this.shopType, this.wealthLevel);

			if (!config) {
				loadingNotice.hide();
				new Notice('Failed to load shop configuration. Please check shopConfig.yaml file.');
				return;
			}

			// Load base stock configuration
			const baseStockConfig = await this.plugin.dataAdapter.getBaseStockConfig();
			const baseStockItems = baseStockConfig?.[this.shopType]?.[this.wealthLevel] || [];

			console.log(`[NewShopModal] Base stock items for ${this.shopType}/${this.wealthLevel}:`, baseStockItems.length);

			const randomInventory = generateRandomShopInventory(
				this.plugin.randomizer,
				itemsWithCost,
				config,
			(this.plugin.dataAdapter as any).getCurrencyConfig(),
				this.shopType,
				baseStockItems
			);

			// Check if inventory generation failed (empty base stock AND empty special stock)
			if ((!randomInventory.baseStock || randomInventory.baseStock.length === 0) &&
			    (!randomInventory.specialStock || randomInventory.specialStock.length === 0)) {
				loadingNotice.hide();

				// Provide detailed error message with config information
				const allowedTypes = config.basicItemTypes ? Object.keys(config.basicItemTypes).join(', ') : 'none configured';
				const itemsByType: Record<string, number> = {};
				itemsWithCost.forEach(item => {
					itemsByType[item.type] = (itemsByType[item.type] || 0) + 1;
				});
				const typeBreakdown = Object.entries(itemsByType)
					.sort((a, b) => b[1] - a[1])
					.slice(0, 5)
					.map(([type, count]) => `${type}: ${count}`)
					.join(', ');

				console.error(`[NewShopModal] Failed to generate inventory for ${this.shopType}/${this.wealthLevel}`);
				console.error(`[NewShopModal] Allowed types from config: ${allowedTypes}`);
				console.error(`[NewShopModal] Items in vault by type (top 5): ${typeBreakdown}`);

				new Notice(`Failed to generate shop inventory.\n\nAllowed item types for ${this.shopType}: ${allowedTypes}\n\nCheck that your vault contains items with these types, or try a different shop type.`, 10000);
				return;
			}

			// Generate shop funds if configured
			let fundsOnHand = undefined;
			if (config.fundsOnHandDice) {
				const currencyConfig = this.plugin.dataAdapter.getCurrencyConfig();
				fundsOnHand = generateShopFunds(this.plugin.randomizer, config.fundsOnHandDice, currencyConfig);
			}

			// Handle NPC creation if setting is enabled
			let shopkeepNPC: string | undefined;
			let shopkeepData: any;

			if (this.plugin.settings.createNPCLinks && this.shopkeep) {
				try {
					// Convert legacy Shopkeep to NPCProfile
					const npc = shopkeepToNPC(this.shopkeep);

					// Set faction and location from shop
					if (this.shopLocation) npc.location = this.shopLocation;

					// Save NPC file
					const npcPath = await this.plugin.dataAdapter.saveNPC(npc);

					// Create wikilink
					shopkeepNPC = `[[${npc.name}]]`;
					shopkeepData = npc;

					console.log(`Created NPC file for ${npc.name} at ${npcPath}`);
				} catch (error) {
					console.error('Failed to create NPC file:', error);
					new Notice('Failed to create NPC file - using embedded shopkeep instead');
				}
			}

			const shop: Shop = {
				name: this.shopName,
				type: this.shopType,
				wealthLevel: this.wealthLevel as any,
				baseStock: randomInventory.baseStock,
				specialStock: randomInventory.specialStock,
				location: this.shopLocation || undefined,
				fundsOnHand: fundsOnHand,

				// New NPC system (if enabled)
				shopkeepNPC: shopkeepNPC,
				shopkeepData: shopkeepData,

				// Legacy shopkeep (for backward compatibility or if NPC creation disabled)
				shopkeep: this.shopkeep
			};

			loadingNotice.hide();
			new Notice('Shop generated successfully!');
			this.close();
			new ShopModal(this.app, this.plugin, shop).open();

		} catch (error) {
			// Ensure loading notice is hidden on error
			if (loadingNotice) {
				loadingNotice.hide();
			}
			console.error('Error generating shop:', error);
			new Notice(`Failed to generate shop: ${error.message || 'Unknown error'}. Check console for details.`);
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
