import { describe, it, expect } from 'vitest';
import {
	isLeapYear,
	countLeapYears,
	getLeapDaysBefore,
	getDaysInYear,
	getLeapDayTargetMonth,
	getMonthDays,
	createGregorianLeapRules,
	createSimpleLeapRule
} from '../utils/LeapCalculator';
import { LeapRule } from '../models/types';

/**
 * LeapCalculator Utility Tests
 *
 * Comprehensive tests for the leap year calculation utilities.
 */

describe('LeapCalculator', () => {
	describe('isLeapYear', () => {
		describe('with no rules', () => {
			it('should return false for undefined rules', () => {
				expect(isLeapYear(2000, undefined)).toBe(false);
				expect(isLeapYear(2004, undefined)).toBe(false);
			});

			it('should return false for empty rules array', () => {
				expect(isLeapYear(2000, [])).toBe(false);
				expect(isLeapYear(2004, [])).toBe(false);
			});
		});

		describe('with simple interval rules', () => {
			const rules4Year = createSimpleLeapRule(4);
			const rules5Year = createSimpleLeapRule(5);

			it('should identify leap years with 4-year interval', () => {
				expect(isLeapYear(0, rules4Year)).toBe(true);
				expect(isLeapYear(4, rules4Year)).toBe(true);
				expect(isLeapYear(8, rules4Year)).toBe(true);
				expect(isLeapYear(100, rules4Year)).toBe(true);
				expect(isLeapYear(2000, rules4Year)).toBe(true);
			});

			it('should identify non-leap years with 4-year interval', () => {
				expect(isLeapYear(1, rules4Year)).toBe(false);
				expect(isLeapYear(2, rules4Year)).toBe(false);
				expect(isLeapYear(3, rules4Year)).toBe(false);
				expect(isLeapYear(5, rules4Year)).toBe(false);
				expect(isLeapYear(2001, rules4Year)).toBe(false);
			});

			it('should handle 5-year interval', () => {
				expect(isLeapYear(0, rules5Year)).toBe(true);
				expect(isLeapYear(5, rules5Year)).toBe(true);
				expect(isLeapYear(10, rules5Year)).toBe(true);
				expect(isLeapYear(4, rules5Year)).toBe(false);
				expect(isLeapYear(6, rules5Year)).toBe(false);
			});
		});

		describe('with offset rules', () => {
			it('should handle offset of 2', () => {
				const rules: LeapRule[] = [{ interval: 4, offset: 2 }];
				expect(isLeapYear(2, rules)).toBe(true);
				expect(isLeapYear(6, rules)).toBe(true);
				expect(isLeapYear(10, rules)).toBe(true);
				expect(isLeapYear(0, rules)).toBe(false);
				expect(isLeapYear(4, rules)).toBe(false);
				expect(isLeapYear(8, rules)).toBe(false);
			});

			it('should handle offset of 1', () => {
				const rules: LeapRule[] = [{ interval: 4, offset: 1 }];
				expect(isLeapYear(1, rules)).toBe(true);
				expect(isLeapYear(5, rules)).toBe(true);
				expect(isLeapYear(9, rules)).toBe(true);
				expect(isLeapYear(0, rules)).toBe(false);
				expect(isLeapYear(4, rules)).toBe(false);
			});
		});

		describe('with Gregorian rules (4, !100, 400)', () => {
			const gregorianRules = createGregorianLeapRules();

			it('should identify standard leap years (divisible by 4)', () => {
				expect(isLeapYear(2004, gregorianRules)).toBe(true);
				expect(isLeapYear(2008, gregorianRules)).toBe(true);
				expect(isLeapYear(2012, gregorianRules)).toBe(true);
				expect(isLeapYear(2016, gregorianRules)).toBe(true);
				expect(isLeapYear(2020, gregorianRules)).toBe(true);
				expect(isLeapYear(2024, gregorianRules)).toBe(true);
			});

			it('should identify non-leap years (not divisible by 4)', () => {
				expect(isLeapYear(2001, gregorianRules)).toBe(false);
				expect(isLeapYear(2002, gregorianRules)).toBe(false);
				expect(isLeapYear(2003, gregorianRules)).toBe(false);
				expect(isLeapYear(2005, gregorianRules)).toBe(false);
				expect(isLeapYear(2019, gregorianRules)).toBe(false);
				expect(isLeapYear(2021, gregorianRules)).toBe(false);
			});

			it('should exclude century years not divisible by 400', () => {
				expect(isLeapYear(1700, gregorianRules)).toBe(false);
				expect(isLeapYear(1800, gregorianRules)).toBe(false);
				expect(isLeapYear(1900, gregorianRules)).toBe(false);
				expect(isLeapYear(2100, gregorianRules)).toBe(false);
				expect(isLeapYear(2200, gregorianRules)).toBe(false);
				expect(isLeapYear(2300, gregorianRules)).toBe(false);
			});

			it('should include century years divisible by 400', () => {
				expect(isLeapYear(1600, gregorianRules)).toBe(true);
				expect(isLeapYear(2000, gregorianRules)).toBe(true);
				expect(isLeapYear(2400, gregorianRules)).toBe(true);
				expect(isLeapYear(2800, gregorianRules)).toBe(true);
			});
		});

		describe('with multiple rules (OR logic)', () => {
			it('should match if any rule matches', () => {
				// Leap year if divisible by 4 OR divisible by 7
				const rules: LeapRule[] = [
					{ interval: 4 },
					{ interval: 7 }
				];

				expect(isLeapYear(4, rules)).toBe(true);   // 4 matches first rule
				expect(isLeapYear(7, rules)).toBe(true);   // 7 matches second rule
				expect(isLeapYear(28, rules)).toBe(true);  // 28 matches both
				expect(isLeapYear(14, rules)).toBe(true);  // 14 matches second
				expect(isLeapYear(5, rules)).toBe(false);  // 5 matches neither
			});
		});
	});

	describe('countLeapYears', () => {
		const rules4Year = createSimpleLeapRule(4);
		const gregorianRules = createGregorianLeapRules();

		it('should return 0 for empty range', () => {
			expect(countLeapYears(2000, 2000, rules4Year)).toBe(0);
			expect(countLeapYears(5, 5, rules4Year)).toBe(0);
		});

		it('should return 0 for reversed range', () => {
			expect(countLeapYears(2010, 2000, rules4Year)).toBe(0);
		});

		it('should count leap years with simple 4-year rule', () => {
			// Years 0-3: only year 0 is leap
			expect(countLeapYears(0, 4, rules4Year)).toBe(1);

			// Years 0-7: years 0, 4 are leap
			expect(countLeapYears(0, 8, rules4Year)).toBe(2);

			// Years 0-11: years 0, 4, 8 are leap
			expect(countLeapYears(0, 12, rules4Year)).toBe(3);

			// Years 1-8: years 4 is leap (0 and 8 are outside range)
			expect(countLeapYears(1, 8, rules4Year)).toBe(1);
		});

		it('should count Gregorian leap years correctly', () => {
			// 1996-2004: 1996, 2000, 2004 = 3 leap years (but 2004 is exclusive)
			expect(countLeapYears(1996, 2004, gregorianRules)).toBe(2);

			// 1896-1904: 1896, 1900(no!), 1904 = 2 (but 1904 is exclusive)
			expect(countLeapYears(1896, 1904, gregorianRules)).toBe(1);

			// Full century: 1900-1999
			// Leap years: 1904, 1908, ..., 1996 = 24 leap years (1900 is not leap)
			expect(countLeapYears(1900, 2000, gregorianRules)).toBe(24);

			// 2000-2099: 2000, 2004, 2008, ..., 2096 = 25 leap years
			// (2000 is leap because /400, rest are normal /4)
			expect(countLeapYears(2000, 2100, gregorianRules)).toBe(25);
		});
	});

	describe('getLeapDaysBefore', () => {
		const rules4Year = createSimpleLeapRule(4);

		it('should return 0 for base year', () => {
			expect(getLeapDaysBefore(2000, 2000, rules4Year)).toBe(0);
		});

		it('should count leap days between base year and target', () => {
			// From year 0 to year 8: leap years 0, 4 = 2 leap days
			expect(getLeapDaysBefore(8, 0, rules4Year)).toBe(2);

			// From year 0 to year 4: leap year 0 = 1 leap day
			expect(getLeapDaysBefore(4, 0, rules4Year)).toBe(1);
		});

		it('should handle negative direction', () => {
			// From year 8 to year 0: -2 leap days (going backwards)
			expect(getLeapDaysBefore(0, 8, rules4Year)).toBe(-2);
		});
	});

	describe('getDaysInYear', () => {
		const rules4Year = createSimpleLeapRule(4);

		it('should return base days for non-leap year', () => {
			expect(getDaysInYear(2001, 365, rules4Year)).toBe(365);
			expect(getDaysInYear(2002, 365, rules4Year)).toBe(365);
			expect(getDaysInYear(2003, 365, rules4Year)).toBe(365);
		});

		it('should return base + 1 for leap year', () => {
			expect(getDaysInYear(2000, 365, rules4Year)).toBe(366);
			expect(getDaysInYear(2004, 365, rules4Year)).toBe(366);
		});

		it('should work with any base year length', () => {
			expect(getDaysInYear(0, 360, rules4Year)).toBe(361);
			expect(getDaysInYear(1, 360, rules4Year)).toBe(360);
		});
	});

	describe('getLeapDayTargetMonth', () => {
		it('should return undefined for non-leap year', () => {
			const rules = createSimpleLeapRule(4, 1);
			expect(getLeapDayTargetMonth(2001, rules)).toBeUndefined();
			expect(getLeapDayTargetMonth(2002, rules)).toBeUndefined();
		});

		it('should return target month for leap year', () => {
			const rules = createSimpleLeapRule(4, 1);  // February
			expect(getLeapDayTargetMonth(2000, rules)).toBe(1);
			expect(getLeapDayTargetMonth(2004, rules)).toBe(1);
		});

		it('should return undefined for rules without target month', () => {
			const rules: LeapRule[] = [{ interval: 4 }];
			expect(getLeapDayTargetMonth(2000, rules)).toBeUndefined();
		});

		it('should return first matching rule target', () => {
			const rules: LeapRule[] = [
				{ interval: 4, targetMonth: 5 },
				{ interval: 8, targetMonth: 10 }
			];

			// Year 4: matches first rule only
			expect(getLeapDayTargetMonth(4, rules)).toBe(5);

			// Year 8: matches both rules, returns first
			expect(getLeapDayTargetMonth(8, rules)).toBe(5);
		});
	});

	describe('getMonthDays', () => {
		const rules = createSimpleLeapRule(4, 1);  // Leap day goes to month 1

		it('should return base days for non-leap year', () => {
			expect(getMonthDays(2001, 0, 31, rules)).toBe(31);
			expect(getMonthDays(2001, 1, 28, rules)).toBe(28);
		});

		it('should return base days for non-target month in leap year', () => {
			expect(getMonthDays(2000, 0, 31, rules)).toBe(31);  // January
			expect(getMonthDays(2000, 2, 31, rules)).toBe(31);  // March
		});

		it('should add leap day to target month in leap year', () => {
			expect(getMonthDays(2000, 1, 28, rules)).toBe(29);  // February in 2000
			expect(getMonthDays(2004, 1, 28, rules)).toBe(29);
		});
	});

	describe('createGregorianLeapRules', () => {
		it('should create proper Gregorian leap rule structure', () => {
			const rules = createGregorianLeapRules();

			expect(rules).toHaveLength(1);
			expect(rules[0].interval).toBe(4);
			expect(rules[0].targetMonth).toBe(1);  // February by default
			expect(rules[0].exclude).toBeDefined();
			expect(rules[0].exclude).toHaveLength(1);
			expect(rules[0].exclude![0].interval).toBe(100);
			expect(rules[0].exclude![0].exclude).toHaveLength(1);
			expect(rules[0].exclude![0].exclude![0].interval).toBe(400);
		});

		it('should allow custom target month', () => {
			const rules = createGregorianLeapRules(5);  // June
			expect(rules[0].targetMonth).toBe(5);
		});
	});

	describe('createSimpleLeapRule', () => {
		it('should create simple interval rule', () => {
			const rules = createSimpleLeapRule(4);
			expect(rules).toHaveLength(1);
			expect(rules[0].interval).toBe(4);
			expect(rules[0].offset).toBe(0);
			expect(rules[0].targetMonth).toBeUndefined();
		});

		it('should create rule with target month', () => {
			const rules = createSimpleLeapRule(4, 1);
			expect(rules[0].interval).toBe(4);
			expect(rules[0].targetMonth).toBe(1);
		});

		it('should create rule with offset', () => {
			const rules = createSimpleLeapRule(4, 1, 2);
			expect(rules[0].interval).toBe(4);
			expect(rules[0].offset).toBe(2);
			expect(rules[0].targetMonth).toBe(1);
		});
	});

	describe('edge cases', () => {
		it('should handle year 0', () => {
			const rules = createSimpleLeapRule(4);
			expect(isLeapYear(0, rules)).toBe(true);
		});

		it('should handle negative years', () => {
			const rules = createSimpleLeapRule(4);
			expect(isLeapYear(-4, rules)).toBe(true);
			expect(isLeapYear(-8, rules)).toBe(true);
			expect(isLeapYear(-1, rules)).toBe(false);
			expect(isLeapYear(-5, rules)).toBe(false);
		});

		it('should handle very large years', () => {
			const rules = createGregorianLeapRules();
			expect(isLeapYear(1_000_000, rules)).toBe(true);  // /4, /100, /400
			expect(isLeapYear(1_000_100, rules)).toBe(false); // /4, /100, !/400
			expect(isLeapYear(1_000_400, rules)).toBe(true);  // /4, /100, /400
		});

		it('should handle interval of 1 (every year is leap)', () => {
			const rules: LeapRule[] = [{ interval: 1 }];
			expect(isLeapYear(0, rules)).toBe(true);
			expect(isLeapYear(1, rules)).toBe(true);
			expect(isLeapYear(2, rules)).toBe(true);
			expect(isLeapYear(999, rules)).toBe(true);
		});

		it('should handle nested exclusions correctly', () => {
			// Leap year every 2 years, except every 4, except every 8
			// So: leap years are 2, 6, 8, 10, 14, 16, ...
			const rules: LeapRule[] = [
				{
					interval: 2,
					exclude: [
						{
							interval: 4,
							exclude: [
								{ interval: 8 }
							]
						}
					]
				}
			];

			expect(isLeapYear(0, rules)).toBe(true);   // /2, /4, /8 -> match exclude of exclude
			expect(isLeapYear(2, rules)).toBe(true);   // /2, !/4
			expect(isLeapYear(4, rules)).toBe(false);  // /2, /4, !/8 -> excluded
			expect(isLeapYear(6, rules)).toBe(true);   // /2, !/4
			expect(isLeapYear(8, rules)).toBe(true);   // /2, /4, /8 -> match exclude of exclude
			expect(isLeapYear(10, rules)).toBe(true);  // /2, !/4
			expect(isLeapYear(12, rules)).toBe(false); // /2, /4, !/8 -> excluded
		});
	});
});
