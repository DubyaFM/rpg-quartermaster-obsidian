// Modal for logging quick transactions without a full shop
import { Modal, App, Setting, Notice } from 'obsidian';
import { Item, PurchasedItem, ItemCost } from '@quartermaster/core/models/types';
import { multiplyCurrency, convertToCopper, formatCurrency } from '@quartermaster/core/calculators/currency';
import type QuartermasterPlugin from '../main';

export class QuickTransactionModal extends Modal {
	plugin: QuartermasterPlugin;
	selectedItem: Item | null = null;
	quantity: number = 1;
	price: number = 0;
	selectedPlayer: string = '';

	constructor(app: App, plugin: QuartermasterPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Quick Transaction' });

		new Setting(contentEl)
			.setName('Item')
			.setDesc('Search for an item')
			.addText(text => {
				text.setPlaceholder('Start typing item name...');
				// TODO: Add autocomplete functionality
			});

		new Setting(contentEl)
			.setName('Quantity')
			.addText(text => text
				.setPlaceholder('1')
				.onChange(value => this.quantity = parseInt(value) || 1));

		new Setting(contentEl)
			.setName('Price per item (in gold)')
			.addText(text => text
				.setPlaceholder('0')
				.onChange(value => this.price = parseInt(value) || 0));

		if (this.plugin.settings.enablePlayerTracking && this.plugin.settings.partyMembers.length > 0) {
			new Setting(contentEl)
				.setName('Player')
				.setDesc('Which player is making this purchase?')
				.addDropdown(dropdown => {
					dropdown.addOption('', '-- Select Player --');
					this.plugin.settings.partyMembers.forEach(member => {
						dropdown.addOption(member.name, member.name);
					});
					return dropdown.onChange(value => this.selectedPlayer = value);
				});
		}

		const logBtn = contentEl.createEl('button', {
			text: 'Log Transaction',
			cls: 'mod-cta'
		});
		logBtn.onclick = async () => {
			await this.logQuickTransaction();
		};
	}

	async logQuickTransaction() {
		if (!this.selectedItem && this.price === 0) {
			new Notice('Please select an item or enter a price');
			return;
		}

		const config = this.plugin.dataAdapter.getCurrencyConfig();
		const dummyCost: ItemCost = { copper: 0, silver: 0, gold: this.price, platinum: 0 };
		const totalCost = multiplyCurrency(dummyCost, this.quantity, config);

		const item: PurchasedItem = {
			name: this.selectedItem?.name || 'Custom Item',
			cost: dummyCost,
			type: this.selectedItem?.type || 'misc',
			rarity: this.selectedItem?.rarity || 'common',
			description: this.selectedItem?.description || '',
			source: this.selectedItem?.source || '',
			file: this.selectedItem?.file || { path: '', name: '' },
			category: this.selectedItem?.category || 'misc',
			quantity: this.quantity,
			totalCost: totalCost,
			purchasedBy: this.selectedPlayer || undefined
		};

		// Use adapters for persistence
		const costInCopper = convertToCopper(totalCost);
		await this.plugin.dataAdapter.updatePartyInventory([item], costInCopper);
		await this.plugin.dataAdapter.logTransaction([item], totalCost, 'Quick Transaction');

		new Notice(`Logged transaction: ${item.name} x${item.quantity} for ${formatCurrency(totalCost, config)}`);
		this.close();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
