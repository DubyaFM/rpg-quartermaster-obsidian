/**
 * LeapCalculator Utility
 *
 * Handles complex leap year calculations for calendar systems.
 * Supports multiple leap rules per calendar with nested exclusions.
 *
 * Design Features:
 * - Supports Gregorian-style rules (every 4, not 100, yes 400)
 * - Supports interval + offset patterns (e.g., "every 4 years starting from year 4")
 * - Supports target month specification (which month gets the extra day)
 * - Handles very large year numbers without integer overflow
 * - Pure functions with no side effects
 *
 * Examples:
 * - Gregorian: { interval: 4, exclude: [{ interval: 100, exclude: [{ interval: 400 }] }] }
 * - Harptos Shieldmeet: { interval: 4, targetMonth: 9 } (adds day to Midsummer every 4 years)
 */

import { LeapRule } from '../models/types';

/**
 * Determines if a given year is a leap year according to a set of leap rules.
 *
 * Rules are evaluated in order. A year is a leap year if ANY rule matches.
 * Each rule can have nested exclude rules that negate the match.
 *
 * @param year - The year to check
 * @param rules - Array of leap rules to evaluate
 * @returns true if the year is a leap year
 */
export function isLeapYear(year: number, rules: LeapRule[] | undefined): boolean {
	if (!rules || rules.length === 0) {
		return false;
	}

	// A year is a leap year if ANY rule matches (OR logic)
	return rules.some(rule => matchesLeapRule(year, rule));
}

/**
 * Checks if a year matches a single leap rule (including exclusions).
 *
 * @param year - The year to check
 * @param rule - The leap rule to evaluate
 * @returns true if the year matches the rule and is not excluded
 */
function matchesLeapRule(year: number, rule: LeapRule): boolean {
	const offset = rule.offset ?? 0;

	// Check if year matches the interval pattern
	// (year - offset) must be divisible by interval
	if ((year - offset) % rule.interval !== 0) {
		return false;
	}

	// If there are exclusion rules, check if any exclude this year
	if (rule.exclude && rule.exclude.length > 0) {
		// If ANY exclude rule matches, this year is excluded
		if (rule.exclude.some(excludeRule => matchesLeapRule(year, excludeRule))) {
			return false;
		}
	}

	return true;
}

/**
 * Calculates the number of leap days between two years (exclusive of endYear).
 * Used for absolute day calculations across leap year boundaries.
 *
 * @param startYear - First year (inclusive)
 * @param endYear - Last year (exclusive)
 * @param rules - Leap rules to apply
 * @returns Number of leap years in the range
 */
export function countLeapYears(startYear: number, endYear: number, rules: LeapRule[] | undefined): number {
	if (!rules || rules.length === 0 || endYear <= startYear) {
		return 0;
	}

	let count = 0;

	// For very large ranges, we could optimize with formula-based counting,
	// but for typical campaign year ranges (<10000 years), iteration is fine
	// and ensures correctness with complex nested exclusion rules
	for (let year = startYear; year < endYear; year++) {
		if (isLeapYear(year, rules)) {
			count++;
		}
	}

	return count;
}

/**
 * Calculates the number of leap days that have occurred up to (but not including) the given year,
 * counting from a base year.
 *
 * @param year - Target year
 * @param baseYear - Year to start counting from (typically calendar origin year)
 * @param rules - Leap rules to apply
 * @returns Number of leap days accumulated
 */
export function getLeapDaysBefore(year: number, baseYear: number, rules: LeapRule[] | undefined): number {
	if (!rules || rules.length === 0) {
		return 0;
	}

	if (year >= baseYear) {
		return countLeapYears(baseYear, year, rules);
	} else {
		// Counting backwards: negate the count
		return -countLeapYears(year, baseYear, rules);
	}
}

/**
 * Gets the total number of days in a year, accounting for leap days.
 *
 * @param year - The year to calculate
 * @param baseDaysInYear - Standard year length (e.g., 365)
 * @param rules - Leap rules to apply
 * @returns Total days in the year
 */
export function getDaysInYear(year: number, baseDaysInYear: number, rules: LeapRule[] | undefined): number {
	if (isLeapYear(year, rules)) {
		return baseDaysInYear + 1;
	}
	return baseDaysInYear;
}

/**
 * Gets the month index where leap day should be inserted for a given year.
 * Returns -1 if no leap day (not a leap year or no rules).
 *
 * If multiple rules match, returns the target month from the first matching rule.
 *
 * @param year - The year to check
 * @param rules - Leap rules to apply
 * @returns Month index (0-based) or undefined if leap day goes at end of year
 */
export function getLeapDayTargetMonth(year: number, rules: LeapRule[] | undefined): number | undefined {
	if (!rules || rules.length === 0) {
		return undefined;
	}

	for (const rule of rules) {
		if (matchesLeapRule(year, rule)) {
			return rule.targetMonth;
		}
	}

	return undefined;
}

/**
 * Calculates the effective month length for a specific year and month,
 * accounting for leap days.
 *
 * @param year - The year
 * @param monthIndex - The month index (0-based)
 * @param baseMonthDays - Standard days in this month
 * @param rules - Leap rules to apply
 * @returns Effective days in the month for this year
 */
export function getMonthDays(
	year: number,
	monthIndex: number,
	baseMonthDays: number,
	rules: LeapRule[] | undefined
): number {
	if (!isLeapYear(year, rules)) {
		return baseMonthDays;
	}

	const targetMonth = getLeapDayTargetMonth(year, rules);

	// If no target month specified, leap day goes at end of year (last month)
	// If target month matches this month, add the leap day
	if (targetMonth === monthIndex) {
		return baseMonthDays + 1;
	}

	return baseMonthDays;
}

/**
 * Creates a Gregorian-style leap rule set.
 * Convenience function for calendars using standard Gregorian leap year rules.
 *
 * Gregorian rules:
 * - Leap year every 4 years
 * - EXCEPT century years (divisible by 100)
 * - UNLESS also divisible by 400
 *
 * @param targetMonth - Month index where February 29th falls (default: 1 for February)
 * @returns LeapRule array for Gregorian calendar
 */
export function createGregorianLeapRules(targetMonth: number = 1): LeapRule[] {
	return [
		{
			interval: 4,
			targetMonth,
			exclude: [
				{
					interval: 100,
					exclude: [
						{
							interval: 400
						}
					]
				}
			]
		}
	];
}

/**
 * Creates a simple "every N years" leap rule.
 * Convenience function for calendars with simple leap year patterns.
 *
 * @param interval - Leap year interval (e.g., 4 for every 4 years)
 * @param targetMonth - Month index to receive leap day (undefined = end of year)
 * @param offset - Year offset for calculation (default: 0)
 * @returns LeapRule array
 */
export function createSimpleLeapRule(
	interval: number,
	targetMonth?: number,
	offset: number = 0
): LeapRule[] {
	return [
		{
			interval,
			offset,
			targetMonth
		}
	];
}
