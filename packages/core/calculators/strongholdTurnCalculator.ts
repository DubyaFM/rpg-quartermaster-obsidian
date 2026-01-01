/**
 * Stronghold turn and neglect calculation utilities
 * Handles turn progression, neglect tracking, and penalty calculations
 */

import type { CurrencyConfig } from '../models/currency-config.js';

/**
 * Calculate the number of turns that have passed
 * @param currentDay - Current calendar day
 * @param lastTurnDay - Last day orders were given
 * @param config - Currency configuration for consistency with economic systems
 * @param turnInterval - Number of days per turn (default: 7)
 * @returns Number of complete turns that have passed
 * @example
 * const turnsPassed = calculateTurnsPassed(115, 100, currencyConfig, 7);
 */
export function calculateTurnsPassed(
	currentDay: number,
	lastTurnDay: number,
	config: CurrencyConfig,
	turnInterval: number = 7
): number {
	const daysPassed = currentDay - lastTurnDay;
	return Math.floor(daysPassed / turnInterval);
}

/**
 * Check if neglect should be triggered based on PC level
 * Players get grace periods based on their level:
 * - Level 1-4: 1 turn grace period
 * - Level 5-10: 2 turn grace period
 * - Level 11-16: 3 turn grace period
 * - Level 17-20: 4 turn grace period
 *
 * @param turnsMissed - Number of turns since last orders given
 * @param pcLevel - Current party level
 * @param config - Currency configuration for consistency with economic systems
 * @returns True if neglect should trigger
 * @example
 * const shouldNeglect = shouldTriggerNeglect(3, 8, currencyConfig);
 */
export function shouldTriggerNeglect(turnsMissed: number, pcLevel: number, config: CurrencyConfig): boolean {
	const gracePeriod = calculateNeglectGracePeriod(pcLevel, config);
	return turnsMissed > gracePeriod;
}

/**
 * Calculate the grace period for neglect based on PC level
 * Higher level parties get more leeway due to greater responsibilities
 *
 * @param pcLevel - Current party level (1-20)
 * @param config - Currency configuration for consistency with economic systems
 * @returns Number of turns before neglect triggers
 * @example
 * const gracePeriod = calculateNeglectGracePeriod(12, currencyConfig);
 */
export function calculateNeglectGracePeriod(pcLevel: number, config: CurrencyConfig): number {
	if (pcLevel <= 4) {
		return 1;
	} else if (pcLevel <= 10) {
		return 2;
	} else if (pcLevel <= 16) {
		return 3;
	} else {
		return 4;
	}
}

/**
 * Calculate neglect penalty points
 * Each turn beyond the grace period adds 1 point of neglect
 *
 * @param turnsMissed - Number of turns since last orders given
 * @param pcLevel - Current party level
 * @param config - Currency configuration for consistency with economic systems
 * @returns Neglect penalty points to add
 * @example
 * const penalty = calculateNeglectPenalty(5, 10, currencyConfig);
 */
export function calculateNeglectPenalty(turnsMissed: number, pcLevel: number, config: CurrencyConfig): number {
	const gracePeriod = calculateNeglectGracePeriod(pcLevel, config);
	const turnsOverGrace = turnsMissed - gracePeriod;

	if (turnsOverGrace <= 0) {
		return 0;
	}

	// 1 neglect point per turn over grace period
	return turnsOverGrace;
}

/**
 * Determine if stronghold is considered neglected
 * @param neglectCounter - Current neglect counter value
 * @param config - Currency configuration for consistency with economic systems
 * @param threshold - Threshold for being considered neglected (default: 3)
 * @returns True if stronghold is neglected
 * @example
 * const isNeglected = isStrongholdNeglected(5, currencyConfig, 3);
 */
export function isStrongholdNeglected(neglectCounter: number, config: CurrencyConfig, threshold: number = 3): boolean {
	return neglectCounter >= threshold;
}

/**
 * Calculate morale penalty from neglect
 * Each point of neglect reduces morale by a certain amount
 *
 * @param neglectCounter - Current neglect counter value
 * @param config - Currency configuration for consistency with economic systems
 * @param penaltyPerPoint - Morale reduction per neglect point (default: -1)
 * @returns Total morale penalty
 * @example
 * const penalty = calculateNeglectMoralePenalty(4, currencyConfig, -1);
 */
export function calculateNeglectMoralePenalty(
	neglectCounter: number,
	config: CurrencyConfig,
	penaltyPerPoint: number = -1
): number {
	return neglectCounter * penaltyPerPoint;
}

/**
 * Calculate days until next turn deadline
 * @param currentDay - Current calendar day
 * @param lastTurnDay - Last day orders were given
 * @param config - Currency configuration for consistency with economic systems
 * @param turnInterval - Number of days per turn (default: 7)
 * @returns Days remaining until next turn deadline
 * @example
 * const daysLeft = calculateDaysUntilNextTurn(115, 100, currencyConfig, 7);
 */
export function calculateDaysUntilNextTurn(
	currentDay: number,
	lastTurnDay: number,
	config: CurrencyConfig,
	turnInterval: number = 7
): number {
	const daysSinceLastTurn = currentDay - lastTurnDay;
	const daysIntoCurrentTurn = daysSinceLastTurn % turnInterval;
	return turnInterval - daysIntoCurrentTurn;
}

/**
 * Reset neglect counter (called when orders are given)
 * @param config - Currency configuration for consistency with economic systems
 * @returns New neglect counter value (0)
 * @example
 * const resetValue = resetNeglectCounter(currencyConfig);
 */
export function resetNeglectCounter(config: CurrencyConfig): number {
	return 0;
}

/**
 * Get neglect severity description
 * @param neglectCounter - Current neglect counter value
 * @param config - Currency configuration for consistency with economic systems
 * @returns Human-readable severity level
 * @example
 * const severity = getNeglectSeverity(7, currencyConfig);
 */
export function getNeglectSeverity(neglectCounter: number, config: CurrencyConfig): string {
	if (neglectCounter === 0) {
		return 'None';
	} else if (neglectCounter <= 2) {
		return 'Minor';
	} else if (neglectCounter <= 5) {
		return 'Moderate';
	} else if (neglectCounter <= 10) {
		return 'Severe';
	} else {
		return 'Critical';
	}
}

/**
 * Calculate recommended actions based on neglect level
 * @param neglectCounter - Current neglect counter value
 * @param config - Currency configuration for consistency with economic systems
 * @returns Array of recommended actions
 * @example
 * const recommendations = getNeglectRecommendations(8, currencyConfig);
 */
export function getNeglectRecommendations(neglectCounter: number, config: CurrencyConfig): string[] {
	const recommendations: string[] = [];

	if (neglectCounter === 0) {
		return ['Stronghold is well-maintained'];
	}

	if (neglectCounter >= 3) {
		recommendations.push('Give orders immediately to prevent further deterioration');
	}

	if (neglectCounter >= 5) {
		recommendations.push('Consider hiring additional staff');
		recommendations.push('Perform maintenance orders to restore morale');
	}

	if (neglectCounter >= 10) {
		recommendations.push('URGENT: Risk of facility inoperability');
		recommendations.push('URGENT: Risk of hireling desertion');
	}

	return recommendations;
}
