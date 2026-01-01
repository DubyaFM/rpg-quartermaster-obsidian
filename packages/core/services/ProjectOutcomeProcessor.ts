import { ProjectInstance, ProjectOutcome, PurchasedItem } from '../models/types';
import type { CurrencyConfig } from '../models/currency-config.js';

/**
 * Service for handling project completion outcomes
 * Uses dependency injection for platform-specific operations
 */
export class ProjectOutcomeProcessor {
	private inventoryUpdater: (items: PurchasedItem[], goldInCopper: number) => Promise<void>;
	private noteCreator: (title: string, content: string) => Promise<void>;
	private notifier: (message: string, title?: string) => void;
	private config: CurrencyConfig;

	/**
	 * Initialize ProjectOutcomeProcessor with currency configuration
	 * @param inventoryUpdater Callback to update party inventory when outcomes are processed
	 * @param noteCreator Callback to create notes for information outcomes
	 * @param notifier Callback to display user notifications
	 * @param config Currency configuration defining denominations and conversion rates
	 */
	constructor(
		inventoryUpdater: (items: PurchasedItem[], goldInCopper: number) => Promise<void>,
		noteCreator: (title: string, content: string) => Promise<void>,
		notifier: (message: string, title?: string) => void,
		config: CurrencyConfig
	) {
		this.inventoryUpdater = inventoryUpdater;
		this.noteCreator = noteCreator;
		this.notifier = notifier;
		this.config = config;
	}

	/**
	 * Process project outcome on completion
	 * @param instance Completed project instance
	 * @param outcome Outcome configuration
	 */
	async processOutcome(instance: ProjectInstance, outcome: ProjectOutcome): Promise<void> {
		console.log(`[ProjectOutcomeProcessor] Processing outcome for project: ${instance.name}`);

		switch (outcome.type) {
			case 'item':
				await this.processItemOutcome(outcome, instance.name);
				break;
			case 'currency':
				await this.processCurrencyOutcome(outcome, instance.name);
				break;
			case 'information':
				await this.processInformationOutcome(outcome, instance.name);
				break;
			case 'other':
				await this.processOtherOutcome(outcome, instance.name);
				break;
			default:
				console.warn(`[ProjectOutcomeProcessor] Unknown outcome type: ${outcome.type}`);
		}
	}

	/**
	 * Process item outcome
	 */
	private async processItemOutcome(outcome: ProjectOutcome, projectName: string): Promise<void> {
		if (!outcome.itemName) {
			throw new Error('Item outcome missing itemName');
		}

		const item: PurchasedItem = {
			name: outcome.itemName,
			quantity: outcome.itemQuantity || 1,
			cost: { cp: 0, sp: 0, gp: 0, pp: 0 },  // No cost (crafted)
			totalCost: { cp: 0, sp: 0, gp: 0, pp: 0 },
			purchasedBy: projectName,  // Track source as project name
			// Mock required Item fields (these would normally come from item database)
			type: 'Project Outcome',
			rarity: 'unknown',
			description: `Created from project: ${projectName}`,
			source: 'Project',
			file: { path: '', name: outcome.itemName },
			category: 'Project Crafted'
		};

		// Add to party inventory
		await this.inventoryUpdater([item], 0);

		// Return outcome message (caller will add to summary)
		console.log(
			`[ProjectOutcomeProcessor] ${projectName} complete! Added ${item.quantity}x ${item.name} to party inventory.`
		);
	}

	/**
	 * Process currency outcome
	 */
	private async processCurrencyOutcome(outcome: ProjectOutcome, projectName: string): Promise<void> {
		if (!outcome.currencyAmount) {
			throw new Error('Currency outcome missing currencyAmount');
		}

		// Convert currency amount to base unit using configured denominations
		const fundsInCopper = this.convertToCopper(outcome.currencyAmount, this.config);

		// Add to party treasury
		await this.inventoryUpdater([], fundsInCopper);

		// Return outcome message
		const currencyDisplay = this.formatCurrency(outcome.currencyAmount);
		console.log(
			`[ProjectOutcomeProcessor] ${projectName} complete! Added ${currencyDisplay} to party treasury.`
		);
	}

	/**
	 * Process information outcome
	 */
	private async processInformationOutcome(outcome: ProjectOutcome, projectName: string): Promise<void> {
		if (!outcome.informationTitle) {
			throw new Error('Information outcome missing title');
		}

		const content = outcome.informationContent || `Information discovered from ${projectName}`;

		// Create note in vault
		await this.noteCreator(outcome.informationTitle, content);

		// Return outcome message
		console.log(
			`[ProjectOutcomeProcessor] ${projectName} complete! Created note: ${outcome.informationTitle}`
		);
	}

	/**
	 * Process custom/other outcome
	 */
	private async processOtherOutcome(outcome: ProjectOutcome, projectName: string): Promise<void> {
		// Just log the custom outcome
		const message = outcome.customOutcome || `${projectName} has completed.`;

		console.log(`[ProjectOutcomeProcessor] ${message}`);
	}

	/**
	 * Convert ItemCost to base unit using configured denominations (helper)
	 * @param cost Currency cost with denominations
	 * @param config Currency configuration for conversion rates
	 * @returns Amount in base unit (typically copper in D&D 5e)
	 */
	private convertToCopper(cost: any, config: CurrencyConfig): number {
		// Get active system's denominations to determine conversion rates
		const system = config.systems[config.defaultSystem];
		if (!system) {
			console.error(`Currency system "${config.defaultSystem}" not found in configuration`);
			// Fallback to D&D 5e standard rates
			return (
				cost.copper +
				cost.silver * 10 +
				cost.gold * 100 +
				cost.platinum * 1000
			);
		}

		let total = 0;
		const mapping: { [key: string]: number } = {
			copper: cost.copper || 0,
			silver: cost.silver || 0,
			gold: cost.gold || 0,
			platinum: cost.platinum || 0
		};

		for (const denom of system.denominations) {
			const amount = mapping[denom.id] || 0;
			total += amount * denom.conversionRate;
		}

		return total;
	}

	/**
	 * Format currency for display (helper)
	 */
	private formatCurrency(cost: any): string {
		const parts: string[] = [];

		if (cost.platinum > 0) parts.push(`${cost.platinum} pp`);
		if (cost.gold > 0) parts.push(`${cost.gold} gp`);
		if (cost.silver > 0) parts.push(`${cost.silver} sp`);
		if (cost.copper > 0) parts.push(`${cost.copper} cp`);

		return parts.length > 0 ? parts.join(', ') : '0 cp';
	}
}
