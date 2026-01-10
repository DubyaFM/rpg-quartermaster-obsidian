// Handles transaction log file operations
import { App, TFile } from 'obsidian';
import { PurchasedItem, ItemCost, TransactionContext, Transaction, RenownHistoryEntry } from '@quartermaster/core/models/types';
import { formatCurrency } from '@quartermaster/core/calculators/currency';
import type { CurrencyConfig } from '@quartermaster/core/models/currency-config';

export class TransactionLogHandler {
	constructor(
		private app: App,
		private logFilePath: string,
		private currencyConfig: CurrencyConfig,
		private plugin?: any
	) {}

	async logTransaction(
		items: PurchasedItem[],
		cost: ItemCost,
		source: string,
		context?: TransactionContext,
		shopId?: string,
		npcId?: string
	): Promise<void> {
		// Generate transaction UUID and enrich context
		let enrichedContext = { ...context };
		const uuidRegistry = this.plugin?.uuidRegistry;
		if (uuidRegistry) {
			enrichedContext.id = uuidRegistry.generateTransactionId();
			enrichedContext.shopId = shopId;
			enrichedContext.npcId = npcId;
		}

		const file = await this.ensureLogFile();
		const content = await this.app.vault.read(file);

		const entry = this.generateTransactionEntry(items, cost, source, enrichedContext);
		const newContent = content + '\n' + entry;

		await this.app.vault.modify(file, newContent);
	}
// Add these methods to TransactionLogHandler class

	/**
	 * Get all transactions from the transaction log
	 * Required by PorterService for campaign export
	 */
	async getAllTransactions(): Promise<Transaction[]> {
		try {
			const file = this.app.vault.getAbstractFileByPath(this.logFilePath);
			if (!file) {
				// Log file doesn't exist yet - return empty array
				return [];
			}

			const content = await this.app.vault.read(file as TFile);
			return this.parseTransactionLog(content);
		} catch (error) {
			console.warn(`[TransactionLogHandler] Error reading transaction log: ${error}`);
			return [];
		}
	}

	/**
	 * Parse transaction log markdown content into Transaction objects
	 */
	private parseTransactionLog(content: string): Transaction[] {
		const transactions: Transaction[] = [];

		// Split content by transaction entries (separated by ## headers)
		const entries = content.split(/^## /m).filter(entry => entry.trim().length > 0);

		for (const entry of entries) {
			try {
				const transaction = this.parseTransactionEntry(entry);
				if (transaction) {
					transactions.push(transaction);
				}
			} catch (error) {
				// Log parse error but continue processing other transactions
				console.warn(`[TransactionLogHandler] Failed to parse transaction entry: ${error}`);
			}
		}

		return transactions;
	}

	/**
	 * Parse a single transaction entry from the log
	 */
	private parseTransactionEntry(entry: string): Transaction | null {
		// Skip headers like "Transaction Log"
		if (!entry.includes('**Total Cost:**')) {
			return null;
		}

		// Extract transaction metadata from HTML comment
		const metadataMatch = entry.match(/<!--\s*(.*?)\s*-->/);
		let id = '';
		let shopId: string | undefined;
		let npcId: string | undefined;

		if (metadataMatch) {
			const metadata = metadataMatch[1];
			const txnMatch = metadata.match(/txn:\s*(\S+)/);
			const shopMatch = metadata.match(/shop:\s*(\S+)/);
			const npcMatch = metadata.match(/npc:\s*(\S+)/);

			if (txnMatch) id = txnMatch[1];
			if (shopMatch) shopId = shopMatch[1];
			if (npcMatch) npcId = npcMatch[1];
		}

		// Extract header info (date and source)
		const headerMatch = entry.match(/^(.*?)\s*-\s*(.+?)$/m);
		if (!headerMatch) return null;

		const dateStr = headerMatch[1].trim();
		const source = headerMatch[2].trim();

		// Parse timestamp from date
		let timestamp: number;
		const dayMatch = dateStr.match(/Day (\d+)/);
		if (dayMatch) {
			// Use calendar day as timestamp (in days since start)
			timestamp = parseInt(dayMatch[1]) * 86400000; // Convert days to milliseconds
		} else {
			// Try to parse as ISO date
			const parsedDate = new Date(dateStr);
			timestamp = parsedDate.getTime() || Date.now();
		}

		// Extract total cost
		const costMatch = entry.match(/\*\*Total Cost:\*\*\s*(.+?)$/m);
		if (!costMatch) return null;
		// Store cost as empty object (cannot reliably parse formatted string back to ItemCost)
		const cost: ItemCost = {};

		// Extract transaction type
		const typeMatch = entry.match(/\*\*Type:\*\*\s*(\w+)/);
		let type: Transaction['type'] = 'purchase'; // Default
		if (typeMatch) {
			const typeStr = typeMatch[1].toLowerCase();
			if (typeStr === 'sale' || typeStr === 'purchase' || typeStr === 'trade' ||
			    typeStr === 'loot' || typeStr === 'reward' || typeStr === 'adjustment') {
				type = typeStr as Transaction['type'];
			}
		}

		// Extract calendar day
		let calendarDay: number | undefined;
		const calendarDayMatch = entry.match(/\*\*Calendar Day:\*\*\s*(\d+)/);
		if (calendarDayMatch) {
			calendarDay = parseInt(calendarDayMatch[1]);
		}

		// Extract formatted date
		let formattedDate: string | undefined;
		const formattedDateMatch = dateStr.match(/\((.*?)\)/);
		if (formattedDateMatch) {
			formattedDate = formattedDateMatch[1];
		}

		// Extract items
		const items: PurchasedItem[] = [];
		const itemsSection = entry.match(/\*\*Items:\*\*\n((?:- .*\n?)+)/);
		if (itemsSection) {
			const itemLines = itemsSection[1].split('\n').filter(line => line.trim().startsWith('-'));
			for (const line of itemLines) {
				// Parse: "- Bought/Sold: Item Name (Qty x) - Cost"
				const itemMatch = line.match(/^- (Bought|Sold):\s*(.+?)\s*\((\d+)x\)\s*-\s*(.+?)$/);
				if (itemMatch) {
					const isSale = itemMatch[1] === 'Sold';
					const name = itemMatch[2].trim();
					const quantity = parseInt(itemMatch[3]);
					const totalCost = itemMatch[4].trim();

				items.push({
					// Minimal required Item fields (best-effort from log)
					name,
					quantity,
					cost: {}, // Cannot reliably parse cost from formatted string
					totalCost: {}, // Cannot reliably parse cost from formatted string
					type: 'unknown', // Not stored in transaction log
					rarity: 'unknown', // Not stored in transaction log
					description: '', // Not stored in transaction log
					source: '', // Not stored in transaction log
					file: { path: '', name: '' }, // Not stored in transaction log
					category: 'unknown', // Not stored in transaction log
					isSale
				} as PurchasedItem);
				}
			}
		}

		// Build transaction context
		const context: TransactionContext | undefined = (id || shopId || npcId || calendarDay !== undefined || formattedDate || type !== 'purchase')
			? {
					id,
					shopId,
					npcId,
					calendarDay,
					formattedDate,
					transactionType: type === 'sale' ? 'sale' : 'purchase'
			  }
			: undefined;

		return {
			id: id || `txn-${timestamp}`, // Fallback ID for old transactions
			timestamp,
			type,
			source,
			items,
			cost,
			context
		};
	}
	/**
	 * Log a renown change to the activity log
	 */
	async logRenownChange(entry: RenownHistoryEntry): Promise<void> {
		const file = await this.ensureLogFile();
		const content = await this.app.vault.read(file);

		const logEntry = this.generateRenownEntry(entry);
		const newContent = content + '\n' + logEntry;

		await this.app.vault.modify(file, newContent);
	}

	private async ensureLogFile(): Promise<TFile> {
		let file = this.app.vault.getAbstractFileByPath(this.logFilePath);

		if (!file) {
			const initialContent = '# Transaction Log\n\n';
			file = await this.app.vault.create(this.logFilePath, initialContent);
		}

		return file as TFile;
	}

	private generateTransactionEntry(
		items: PurchasedItem[],
		cost: ItemCost,
		source: string,
		context?: TransactionContext
	): string {
		// Use calendar date if available, otherwise fallback to real-world date
		let dateHeader: string;
		if (context?.calendarDay !== undefined && context?.formattedDate) {
			// Calendar system is active - use in-game date
			dateHeader = `Day ${context.calendarDay} (${context.formattedDate})`;
		} else {
			// Fallback to real-world date (for backward compatibility)
			const realDate = new Date().toISOString().split('T')[0];
			dateHeader = realDate;
		}

		let entry = `## ${dateHeader} - ${source}\n`;

		// Add UUIDs as metadata (hidden from casual reading but parseable)
		if (context?.id || context?.shopId || context?.npcId) {
			entry += '<!-- ';
			if (context?.id) entry += `txn: ${context.id} `;
			if (context?.shopId) entry += `shop: ${context.shopId} `;
			if (context?.npcId) entry += `npc: ${context.npcId} `;
			entry += '-->\n';
		}

		// Display transaction ID in human-readable format
		if (context?.id) {
			entry += `**Transaction ID:** \`${context.id}\`\n`;
		}

		entry += `**Total Cost:** ${formatCurrency(cost, this.currencyConfig)}\n\n`;

		if (context?.transactionType) {
			entry += `**Type:** ${context.transactionType}\n`;
		}

		// Show calendar day in metadata section if available
		if (context?.calendarDay !== undefined) {
			entry += `**Calendar Day:** ${context.calendarDay}\n`;
		}

		// Display active effects and price modifiers if present
		if (context?.effectiveMultiplier !== undefined && context.effectiveMultiplier !== 1.0) {
			const percentChange = Math.round((context.effectiveMultiplier - 1.0) * 100);
			const sign = percentChange > 0 ? '+' : '';
			entry += `**Price Modifier:** ${sign}${percentChange}% (${context.effectiveMultiplier}x)\n`;
		}

		if (context?.modifierSource) {
			entry += `**Modifier Source:** ${context.modifierSource}\n`;
		}

		if (context?.activeEffects && context.activeEffects.length > 0) {
			entry += `**Active Effects:** ${context.activeEffects.join(', ')}\n`;
		}

		entry += '**Items:**\n';
		for (const item of items) {
			const prefix = item.isSale ? 'Sold' : 'Bought';
			let itemLine = `- ${prefix}: ${item.name} (${item.quantity}x) - ${formatCurrency(item.totalCost, this.currencyConfig)}`;

			// Show base price vs final price if they differ (indicating effects were applied)
			if (item.basePrice && item.finalPrice) {
				const basePriceStr = formatCurrency(item.basePrice, this.currencyConfig);
				const finalPriceStr = formatCurrency(item.finalPrice, this.currencyConfig);

				// Only show breakdown if prices actually differ
				if (basePriceStr !== finalPriceStr) {
					itemLine += ` (base: ${basePriceStr}, final: ${finalPriceStr})`;
				}
			}

			entry += itemLine + '\n';
		}

		entry += '\n---\n';

		return entry;
	}

	/**
	 * Generate a formatted renown change entry for the activity log
	 */
	private generateRenownEntry(entry: RenownHistoryEntry): string {
		// Use calendar date if available, otherwise fallback to real-world date
		let dateHeader: string;
		if (entry.calendarDay !== undefined && entry.formattedDate) {
			// Calendar system is active - use in-game date
			dateHeader = `Day ${entry.calendarDay} (${entry.formattedDate})`;
		} else {
			// Fallback to timestamp
			const timestamp = new Date(entry.timestamp);
			const dateStr = timestamp.toISOString().split('T')[0];
			dateHeader = dateStr;
		}

		// Determine entity display (with link if available)
		const entityDisplay = entry.entityLink || entry.entityName;

		// Build header
		let logEntry = `## ${dateHeader} - Renown Change: ${entityDisplay}\n\n`;

		// Entity type
		logEntry += `**Entity Type:** ${entry.entityType}\n`;

		// Player-specific or party-wide
		if (entry.playerName) {
			logEntry += `**Player:** ${entry.playerName}\n`;
		} else {
			logEntry += `**Scope:** Party-wide\n`;
		}

		// Score change
		const changePrefix = entry.change >= 0 ? '+' : '';
		logEntry += `**Score Change:** ${changePrefix}${entry.change} (${entry.previousScore} → ${entry.newScore})\n`;

		// Rank change (if applicable)
		if (entry.rankedUp || entry.rankedDown) {
			const direction = entry.rankedUp ? '↑' : '↓';
			logEntry += `**Rank Change:** ${direction} "${entry.previousRank}" → "${entry.newRank}"\n`;
		} else if (entry.previousRank && entry.newRank) {
			logEntry += `**Current Rank:** "${entry.newRank}"\n`;
		}

		// Source
		logEntry += `**Source:** ${entry.source}`;
		if (entry.sourceDescription) {
			logEntry += ` - ${entry.sourceDescription}`;
		}
		logEntry += '\n';

		if (entry.sourceLink) {
			logEntry += `**Related:** ${entry.sourceLink}\n`;
		}

		// Calendar day (if available)
		if (entry.calendarDay !== undefined) {
			logEntry += `**Calendar Day:** ${entry.calendarDay}\n`;
		}

		logEntry += '\n---\n';

		return logEntry;
	}
}
