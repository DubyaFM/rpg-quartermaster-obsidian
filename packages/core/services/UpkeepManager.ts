/**
 * UpkeepManager - Upkeep cost calculator (PASSIVE SERVICE)
 *
 * Calculates and applies daily upkeep costs for party members.
 * This is a PASSIVE service called by the Daily Costs Menu UI,
 * NOT an event listener.
 *
 * Responsibilities:
 * - Calculate upkeep costs based on configuration
 * - Apply upkeep deductions to party inventory
 * - Log upkeep transactions
 *
 * NOT Responsibilities:
 * - Automatically deducting costs (that's done by UI after user confirmation)
 * - Listening to TimeAdvanced events (UI calls this manually)
 */

import { PurchasedItem, ItemCost, PartyMember, TransactionContext, UpkeepConfig, UpkeepCostConfig } from '../models/types';
import type { CurrencyConfig } from '../models/currency-config.js';
import { addCurrency, convertToBaseUnit, multiplyCurrency } from '../calculators/currency';

export class UpkeepManager {
	private config: CurrencyConfig;

	/**
	 * Initialize UpkeepManager with currency configuration
	 * @param updatePartyInventory Callback to update party inventory after upkeep deduction
	 * @param logTransaction Callback to log transaction in audit trail
	 * @param config Currency configuration defining denominations and conversion rates
	 */
	constructor(
		private updatePartyInventory: (items: PurchasedItem[], costInCopper: number) => Promise<void>,
		private logTransaction: (items: PurchasedItem[], cost: ItemCost, source: string, context?: TransactionContext) => Promise<void>,
		config: CurrencyConfig
	) {
		this.config = config;
	}

	/**
	 * Calculate upkeep cost for party based on configuration
	 * Used by Daily Costs Menu to show preview before applying
	 *
	 * @param days Number of days to calculate for
	 * @param upkeepConfig User's upkeep configuration
	 * @param partyMembers Array of party members
	 * @param lifestyleCosts Lifestyle cost definitions from YAML
	 * @returns Total upkeep cost (denominations per active currency system)
	 */
	calculateUpkeepCost(
		days: number,
		upkeepConfig: UpkeepConfig,
		partyMembers: PartyMember[],
		lifestyleCosts: UpkeepCostConfig
	): ItemCost {
		let totalCost: ItemCost = { cp: 0, sp: 0, gp: 0, pp: 0 };

		// Calculate cost for each party member
		for (const member of partyMembers) {
			// Get member's specific settings or use party-wide defaults
			const memberSettings = upkeepConfig.individualSettings?.[member.name]
				|| upkeepConfig.partyWideSettings;

			let memberCost: ItemCost = { cp: 0, sp: 0, gp: 0, pp: 0 };

			// Add rations cost if enabled
			if (memberSettings.useRations) {
				const rationCostPerDay = lifestyleCosts.rations.costPerDay;
				const rationCost = multiplyCurrency(rationCostPerDay, days, this.config);
				memberCost = addCurrency(memberCost, rationCost, this.config);
			}

			// Add lifestyle cost if enabled
			if (memberSettings.useLifestyleExpenses) {
				const lifestyleLevel = memberSettings.lifestyleLevel;
				const lifestyleCostPerDay = lifestyleCosts.lifestyleLevels[lifestyleLevel].costPerDay;
				const lifestyleCost = multiplyCurrency(lifestyleCostPerDay, days, this.config);
				memberCost = addCurrency(memberCost, lifestyleCost, this.config);
			}

			// Add to total
			totalCost = addCurrency(totalCost, memberCost, this.config);
		}

		return totalCost;
	}

	/**
	 * Apply upkeep deduction to party inventory
	 * Called by UI after user confirms the cost
	 *
	 * @param cost Upkeep cost to deduct (in active currency system)
	 * @param days Number of days upkeep is for
	 * @param context Optional transaction context (e.g., calendar day)
	 */
	async applyUpkeep(cost: ItemCost, days: number, context?: TransactionContext): Promise<void> {
		const costInCopper = convertToBaseUnit(cost, this.config);

		// Deduct gold from party inventory
		await this.updatePartyInventory([], -costInCopper);

		// Log transaction
		const source = days === 1 ? 'Daily Upkeep' : `Upkeep (${days} days)`;
		await this.logTransaction([], cost, source, context);
	}

	/**
	 * Get breakdown of upkeep costs per party member
	 * Used by UI to show detailed cost preview
	 *
	 * @param days Number of days to calculate for
	 * @param upkeepConfig User's upkeep configuration
	 * @param partyMembers Array of party members
	 * @param lifestyleCosts Lifestyle cost definitions from YAML
	 * @returns Map of member name to cost breakdown (in active currency system)
	 */
	getUpkeepBreakdown(
		days: number,
		upkeepConfig: UpkeepConfig,
		partyMembers: PartyMember[],
		lifestyleCosts: UpkeepCostConfig
	): Map<string, { rations: ItemCost | null; lifestyle: ItemCost | null; total: ItemCost }> {
		const breakdown = new Map<string, { rations: ItemCost | null; lifestyle: ItemCost | null; total: ItemCost }>();

		for (const member of partyMembers) {
			const memberSettings = upkeepConfig.individualSettings?.[member.name]
				|| upkeepConfig.partyWideSettings;

			let rationsCost: ItemCost | null = null;
			let lifestyleCost: ItemCost | null = null;
			let totalCost: ItemCost = { cp: 0, sp: 0, gp: 0, pp: 0 };

			if (memberSettings.useRations) {
				rationsCost = multiplyCurrency(lifestyleCosts.rations.costPerDay, days, this.config);
				totalCost = addCurrency(totalCost, rationsCost, this.config);
			}

			if (memberSettings.useLifestyleExpenses) {
				const lifestyleLevel = memberSettings.lifestyleLevel;
				lifestyleCost = multiplyCurrency(lifestyleCosts.lifestyleLevels[lifestyleLevel].costPerDay, days, this.config);
				totalCost = addCurrency(totalCost, lifestyleCost, this.config);
			}

			breakdown.set(member.name, {
				rations: rationsCost,
				lifestyle: lifestyleCost,
				total: totalCost
			});
		}

		return breakdown;
	}
}
