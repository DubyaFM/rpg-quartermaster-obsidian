// Party Inventory Reader
// Parses party inventory file to extract items with quantities
// Handles Obsidian-specific file operations

import { App, TFile } from 'obsidian';
import { Item, FileReference } from '@quartermaster/core/models/types';
import { parseCostString } from '@quartermaster/core/calculators/currency';
import type { CurrencyConfig } from '@quartermaster/core/models/currency-config';

export interface PartyInventoryItem {
	item: Item | null;
	name: string;
	quantity: number;
	linkedFile?: FileReference;
}

export class PartyInventoryReader {
	constructor(
		private app: App,
		private currencyConfig: CurrencyConfig
	) {}

	/**
	 * Parse party inventory file to extract items
	 * Reads the party inventory markdown file and extracts item links and quantities
	 *
	 * @param inventoryFilePath Path to party inventory file
	 * @returns Array of items with quantities from party inventory
	 */
	async getInventoryItems(inventoryFilePath: string): Promise<PartyInventoryItem[]> {
		const inventoryFile = this.app.vault.getAbstractFileByPath(inventoryFilePath);

		if (!(inventoryFile instanceof TFile)) {
			return [];
		}

		const content = await this.app.vault.read(inventoryFile);
		const lines = content.split('\n');
		const inventoryItems: PartyInventoryItem[] = [];

		// Find the Items section
		let inItemsSection = false;
		for (const line of lines) {
			if (line.toLowerCase().includes('## items')) {
				inItemsSection = true;
				continue;
			}

			// Stop at next section header
			if (inItemsSection && line.startsWith('##')) {
				break;
			}

			// Parse item lines (format: "- [[path|name]] (5x)" or "- name (5x)")
			if (inItemsSection && line.trim().startsWith('-')) {
				const inventoryItem = this.parseInventoryLine(line);
				if (inventoryItem) {
					inventoryItems.push(inventoryItem);
				}
			}
		}

		return inventoryItems;
	}

	/**
	 * Parse a single inventory line
	 */
	private parseInventoryLine(line: string): PartyInventoryItem | null {
		// Extract item name from wiki link or plain text
		const wikiLinkMatch = line.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
		const quantityMatch = line.match(/\((\d+)x\)/);

		let itemName = '';
		let itemPath = '';

		if (wikiLinkMatch) {
			itemPath = wikiLinkMatch[1];
			itemName = wikiLinkMatch[2] || wikiLinkMatch[1].split('/').pop() || '';
		} else {
			// Plain text item name
			const nameMatch = line.match(/^-\s+([^(]+)/);
			if (nameMatch) {
				itemName = nameMatch[1].trim();
			}
		}

		const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 1;

		if (!itemName) {
			return null;
		}

		// Try to find the linked file if we have a path
		let linkedFile: FileReference | undefined;
		let itemMetadata: Item | null = null;

		if (itemPath) {
			const fullPath = itemPath.endsWith('.md') ? itemPath : `${itemPath}.md`;
			const file = this.app.vault.getAbstractFileByPath(fullPath);

			if (file instanceof TFile) {
				linkedFile = {
					path: file.path,
					name: file.name
				};

				// Try to read item metadata from the file
				const cache = this.app.metadataCache.getFileCache(file);
				if (cache?.frontmatter) {
					const fm = cache.frontmatter;

					// Parse cost
					const costStr = fm.cost || fm.price || fm.value || '';
					const cost = parseCostString(costStr, this.currencyConfig);

					if (cost) {
						itemMetadata = {
							name: itemName,
							cost: cost,
							type: fm.type || 'misc',
							rarity: fm.rarity || 'common',
							description: fm.description || '',
							source: fm.source || '',
							file: linkedFile,
							category: fm.category || 'misc'
						};
					}
				}
			}
		}

		return {
			item: itemMetadata,
			name: itemName,
			quantity: quantity,
			linkedFile: linkedFile
		};
	}
}
