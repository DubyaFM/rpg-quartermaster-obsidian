// Handles party inventory file operations
import { App, TFile } from 'obsidian';
import { PurchasedItem, ItemCost } from '@quartermaster/core/models/types';
import { PartyInventory } from '@quartermaster/core/interfaces/IDataAdapter';
import { convertFromBaseUnit, convertToBaseUnit } from '@quartermaster/core/calculators/currency';
import type { CurrencyConfig } from '@quartermaster/core/models/currency-config';

export class PartyInventoryHandler {
	constructor(
		private app: App,
		private inventoryFilePath: string,
		private currencyConfig: CurrencyConfig
	) {}

	async getPartyInventory(): Promise<PartyInventory> {
		const file = await this.ensureInventoryFile();
		const content = await this.app.vault.read(file);

		return this.parseInventoryFile(content);
	}

	async updatePartyInventory(items: PurchasedItem[], costInCopper: number): Promise<void> {
		const file = await this.ensureInventoryFile();
		const content = await this.app.vault.read(file);
		const inventory = this.parseInventoryFile(content);

		// Update currency
		const currentBase = convertToBaseUnit(inventory.currency, this.currencyConfig);
		const newBase = currentBase - costInCopper;
		inventory.currency = convertFromBaseUnit(newBase, this.currencyConfig);

		// Update items
		for (const item of items) {
			if (item.isSale) {
				// Remove sold items
				this.removeItemFromInventory(inventory, item);
			} else {
				// Add purchased items
				this.addItemToInventory(inventory, item);
			}
		}

		const newContent = this.generateInventoryMarkdown(inventory);
		await this.app.vault.modify(file, newContent);
	}

	private async ensureInventoryFile(): Promise<TFile> {
		let file = this.app.vault.getAbstractFileByPath(this.inventoryFilePath);

		if (!file) {
			const initialContent = this.generateInventoryMarkdown({
				currency: { copper: 0, silver: 0, gold: 0, platinum: 0 },
				items: []
			});
			file = await this.app.vault.create(this.inventoryFilePath, initialContent);
		}

		return file as TFile;
	}

	private parseInventoryFile(content: string): PartyInventory {
		const currency = { copper: 0, silver: 0, gold: 0, platinum: 0 };
		const items: PartyInventory['items'] = [];

		const lines = content.split('\n');
		let inCurrency = false;
		let inItems = false;

		for (const line of lines) {
			if (line.includes('## Currency')) {
				inCurrency = true;
				inItems = false;
			} else if (line.includes('## Items')) {
				inCurrency = false;
				inItems = true;
			} else if (inCurrency && line.includes(':')) {
				const match = line.match(/(Gold|Silver|Copper|Platinum):\s*(\d+)/i);
				if (match) {
					const typeKey = match[1].toLowerCase();
					const amount = parseInt(match[2]);
					// Type-safe currency update
					if (typeKey === 'gold' || typeKey === 'silver' || typeKey === 'copper' || typeKey === 'platinum') {
						const currencyKey = typeKey as keyof typeof currency;
						currency[currencyKey] = amount;
					}
				}
			} else if (inItems && line.startsWith('- ')) {
				// Parse item line
				const itemMatch = line.match(/- (.+?) \((\d+)x\)/);
				if (itemMatch) {
					items.push({
						name: itemMatch[1],
						quantity: parseInt(itemMatch[2]),
						cost: { copper: 0, silver: 0, gold: 0, platinum: 0 }
					});
				}
			}
		}

		return { currency, items };
	}

	private generateInventoryMarkdown(inventory: PartyInventory): string {
		let content = '# Party Inventory\n\n';

		content += '## Currency\n';
		if (inventory.currency.platinum > 0) content += `- Platinum: ${inventory.currency.platinum}\n`;
		if (inventory.currency.gold > 0) content += `- Gold: ${inventory.currency.gold}\n`;
		if (inventory.currency.silver > 0) content += `- Silver: ${inventory.currency.silver}\n`;
		if (inventory.currency.copper > 0) content += `- Copper: ${inventory.currency.copper}\n`;

		content += '\n## Items\n';
		for (const item of inventory.items) {
			content += `- ${item.name} (${item.quantity}x)\n`;
		}

		return content;
	}

	private addItemToInventory(inventory: PartyInventory, item: PurchasedItem): void {
		const existing = inventory.items.find(i => i.name === item.name);
		if (existing) {
			existing.quantity += item.quantity;
		} else {
			inventory.items.push({
				name: item.name,
				quantity: item.quantity,
				cost: item.cost
			});
		}
	}

	private removeItemFromInventory(inventory: PartyInventory, item: PurchasedItem): void {
		const existing = inventory.items.find(i => i.name === item.name);
		if (existing) {
			existing.quantity -= item.quantity;
			if (existing.quantity <= 0) {
				inventory.items = inventory.items.filter(i => i.name !== item.name);
			}
		}
	}
}
