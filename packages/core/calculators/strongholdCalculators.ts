/**
 * Stronghold calculation utilities
 * Platform-agnostic functions for costs, defender capacity, and completion times
 */

import { FacilityTemplate, CustomOrder, StrongholdFacility } from '../models/stronghold';
import type { ItemCost } from '../models/types';
import type { CurrencyConfig } from '../models/currency-config.js';
import { convertToBaseUnit, convertFromBaseUnit } from './currency.js';

/**
 * Calculate the build cost for a facility
 * @param template - The facility template
 * @param config - Currency configuration for consistent cost handling
 * @param wealthModifier - Optional wealth modifier (0.0-1.0) to adjust cost
 * @returns ItemCost object with full multi-denomination cost
 * @example
 * const cost = calculateFacilityBuildCost(template, currencyConfig, 0.5);
 */
export function calculateFacilityBuildCost(
	template: FacilityTemplate,
	config: CurrencyConfig,
	wealthModifier?: number
): ItemCost {
	// Convert full ItemCost to base units (handles all denominations)
	const baseCostInBaseUnits = convertToBaseUnit(template.buildCost, config);

	// Apply wealth modifier if provided
	let adjustedBaseUnits = baseCostInBaseUnits;
	if (wealthModifier !== undefined && wealthModifier !== null) {
		adjustedBaseUnits = Math.floor(baseCostInBaseUnits * wealthModifier);
	}

	// Convert back to ItemCost format
	return convertFromBaseUnit(adjustedBaseUnits, config);
}

/**
 * Calculate the upgrade cost for a facility
 * @param template - The upgraded facility template
 * @param config - Currency configuration for consistent cost handling
 * @param wealthModifier - Optional wealth modifier (0.0-1.0) to adjust cost
 * @returns ItemCost object with full multi-denomination cost, or zero cost if no upgrade defined
 * @example
 * const upgradeCost = calculateFacilityUpgradeCost(template, currencyConfig, 0.8);
 */
export function calculateFacilityUpgradeCost(
	template: FacilityTemplate,
	config: CurrencyConfig,
	wealthModifier?: number
): ItemCost {
	// Return zero cost if no upgrade cost defined
	if (!template.upgradeCost) {
		return convertFromBaseUnit(0, config);
	}

	// Convert full ItemCost to base units (handles all denominations)
	const baseCostInBaseUnits = convertToBaseUnit(template.upgradeCost, config);

	// Apply wealth modifier if provided
	let adjustedBaseUnits = baseCostInBaseUnits;
	if (wealthModifier !== undefined && wealthModifier !== null) {
		adjustedBaseUnits = Math.floor(baseCostInBaseUnits * wealthModifier);
	}

	// Convert back to ItemCost format
	return convertFromBaseUnit(adjustedBaseUnits, config);
}

/**
 * Calculate the time required to build a facility
 * @param template - The facility template
 * @param config - Currency configuration for consistency with economic systems
 * @returns Time in days
 * @example
 * const buildTime = calculateFacilityBuildTime(template, currencyConfig);
 */
export function calculateFacilityBuildTime(template: FacilityTemplate, config: CurrencyConfig): number {
	return template.buildCost.timeInDays;
}

/**
 * Calculate the time required to upgrade a facility
 * @param template - The upgraded facility template
 * @param config - Currency configuration for consistency with economic systems
 * @returns Time in days, or 0 if no upgrade cost defined
 * @example
 * const upgradeTime = calculateFacilityUpgradeTime(template, currencyConfig);
 */
export function calculateFacilityUpgradeTime(template: FacilityTemplate, config: CurrencyConfig): number {
	if (!template.upgradeCost) {
		return 0;
	}

	return template.upgradeCost.timeInDays;
}

/**
 * Calculate the cost for executing a custom order
 * @param order - The custom order
 * @param config - Currency configuration for consistent cost handling
 * @param variableAmount - The variable amount if order has variable cost
 * @returns Cost in pieces
 * @example
 * const cost = calculateOrderCost(order, currencyConfig, 500);
 */
export function calculateOrderCost(
	order: CustomOrder,
	config: CurrencyConfig,
	variableAmount?: number
): number {
	switch (order.goldCost.type) {
		case 'none':
			return 0;
		case 'constant':
			return order.goldCost.amount || 0;
		case 'variable':
			return variableAmount || 0;
		default:
			return 0;
	}
}

/**
 * Calculate the maximum defender capacity based on facilities
 * This is a placeholder implementation - actual logic would depend on specific facility benefits
 * @param facilities - Array of facilities in the stronghold
 * @param config - Currency configuration for future economic scaling
 * @returns Maximum defender count
 * @example
 * const capacity = calculateDefenderCapacity(stronghold.facilities, currencyConfig);
 */
export function calculateDefenderCapacity(facilities: StrongholdFacility[], config: CurrencyConfig): number {
	// Base capacity
	let capacity = 10;

	// Add capacity based on specific facility types
	// This is a simplified example - real implementation would check facility templates
	for (const facility of facilities) {
		// Each facility adds 2 to defender capacity
		// This would be customized based on facility type and template in a full implementation
		capacity += 2;
	}

	return capacity;
}

/**
 * Calculate the completion day given a start day and duration
 * @param startDay - The starting calendar day
 * @param durationInDays - Number of days required
 * @param config - Currency configuration for consistency with project economics
 * @returns The calendar day when the task completes
 * @example
 * const completionDay = calculateCompletionDay(100, 14, currencyConfig);
 */
export function calculateCompletionDay(startDay: number, durationInDays: number, config: CurrencyConfig): number {
	return startDay + durationInDays;
}

/**
 * Calculate the time remaining until completion
 * @param currentDay - Current calendar day
 * @param completionDay - Target completion day
 * @param config - Currency configuration for consistency with project economics
 * @returns Days remaining (0 if complete or overdue)
 * @example
 * const remaining = calculateDaysRemaining(110, 114, currencyConfig);
 */
export function calculateDaysRemaining(currentDay: number, completionDay: number, config: CurrencyConfig): number {
	const remaining = completionDay - currentDay;
	return remaining > 0 ? remaining : 0;
}

/**
 * Check if a task is complete
 * @param currentDay - Current calendar day
 * @param completionDay - Target completion day
 * @param config - Currency configuration for consistency with project economics
 * @returns True if current day >= completion day
 * @example
 * const isComplete = isTaskComplete(120, 114, currencyConfig);
 */
export function isTaskComplete(currentDay: number, completionDay: number, config: CurrencyConfig): boolean {
	return currentDay >= completionDay;
}

/**
 * Calculate total cost for multiple facilities
 * @param templates - Array of facility templates to build
 * @param config - Currency configuration for consistent cost handling
 * @param wealthModifier - Optional wealth modifier (0.0-1.0)
 * @returns Total ItemCost with full multi-denomination support
 * @example
 * const totalCost = calculateTotalFacilityCost(templates, currencyConfig, 0.75);
 */
export function calculateTotalFacilityCost(
	templates: FacilityTemplate[],
	config: CurrencyConfig,
	wealthModifier?: number
): ItemCost {
	let totalBaseUnits = 0;

	// Sum all facility costs in base units
	for (const template of templates) {
		const facilityCost = calculateFacilityBuildCost(template, config, wealthModifier);
		totalBaseUnits += convertToBaseUnit(facilityCost, config);
	}

	// Convert back to ItemCost format
	return convertFromBaseUnit(totalBaseUnits, config);
}

/**
 * Calculate total time required for multiple facilities (sequential construction)
 * @param templates - Array of facility templates to build
 * @param config - Currency configuration for consistency with economic systems
 * @returns Total time in days
 * @example
 * const totalTime = calculateTotalBuildTime(templates, currencyConfig);
 */
export function calculateTotalBuildTime(templates: FacilityTemplate[], config: CurrencyConfig): number {
	return templates.reduce((total, template) => {
		return total + calculateFacilityBuildTime(template, config);
	}, 0);
}
