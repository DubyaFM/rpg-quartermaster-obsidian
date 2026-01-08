import { describe, it, expect, beforeEach } from 'vitest';
import { CalendarDriver } from '../services/CalendarDriver';
import { CalendarDefinition, LeapRule } from '../models/types';
import { isLeapYear, countLeapYears, createGregorianLeapRules, createSimpleLeapRule } from '../utils/LeapCalculator';

/**
 * Leap Year Support Tests
 *
 * Tests the CalendarDriver's ability to handle complex leap year rules
 * including Gregorian-style rules (4, !100, 400) and simple interval rules.
 */

// ==========================================================================
// Test Fixtures - Calendar Definitions with Leap Rules
// ==========================================================================

/**
 * Gregorian Calendar with Leap Rules
 * - 365 base days
 * - Leap year every 4 years, except century years, except those divisible by 400
 * - February (month index 1) gets the leap day
 */
const GREGORIAN_WITH_LEAP: CalendarDefinition = {
	id: 'gregorian-leap',
	name: 'Gregorian Calendar with Leap Years',
	description: 'Standard Gregorian calendar with proper leap year rules',
	weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
	months: [
		{ name: 'January', days: 31, order: 0 },
		{ name: 'February', days: 28, order: 1 },  // 29 in leap years
		{ name: 'March', days: 31, order: 2 },
		{ name: 'April', days: 30, order: 3 },
		{ name: 'May', days: 31, order: 4 },
		{ name: 'June', days: 30, order: 5 },
		{ name: 'July', days: 31, order: 6 },
		{ name: 'August', days: 31, order: 7 },
		{ name: 'September', days: 30, order: 8 },
		{ name: 'October', days: 31, order: 9 },
		{ name: 'November', days: 30, order: 10 },
		{ name: 'December', days: 31, order: 11 }
	],
	holidays: [],
	startingYear: 2000,  // Start at year 2000 (a leap year)
	yearSuffix: 'AD',
	leapRules: createGregorianLeapRules(1)  // February is index 1
};

/**
 * Harptos Calendar with Shieldmeet
 * - 365 base days (12 months * 30 + 5 intercalary)
 * - Shieldmeet: Extra day after Midsummer every 4 years
 * - Midsummer is at index 9 in the full Harptos calendar
 */
const HARPTOS_WITH_SHIELDMEET: CalendarDefinition = {
	id: 'harptos-shieldmeet',
	name: 'Calendar of Harptos with Shieldmeet',
	description: 'Harptos calendar with leap year Shieldmeet festival',
	weekdays: ['1st Day', '2nd Day', '3rd Day', '4th Day', '5th Day', '6th Day', '7th Day', '8th Day', '9th Day', '10th Day'],
	months: [
		{ name: 'Hammer', days: 30, order: 0 },
		{ name: 'Midwinter', days: 1, order: 1, type: 'intercalary' },
		{ name: 'Alturiak', days: 30, order: 2 },
		{ name: 'Ches', days: 30, order: 3 },
		{ name: 'Tarsakh', days: 30, order: 4 },
		{ name: 'Greengrass', days: 1, order: 5, type: 'intercalary' },
		{ name: 'Mirtul', days: 30, order: 6 },
		{ name: 'Kythorn', days: 30, order: 7 },
		{ name: 'Flamerule', days: 30, order: 8 },
		{ name: 'Midsummer', days: 1, order: 9, type: 'intercalary' },  // 2 days in leap years (Shieldmeet)
		{ name: 'Eleasis', days: 30, order: 10 },
		{ name: 'Eleint', days: 30, order: 11 },
		{ name: 'Highharvestide', days: 1, order: 12, type: 'intercalary' },
		{ name: 'Marpenoth', days: 30, order: 13 },
		{ name: 'Uktar', days: 30, order: 14 },
		{ name: 'Feast of the Moon', days: 1, order: 15, type: 'intercalary' },
		{ name: 'Nightal', days: 30, order: 16 }
	],
	holidays: [],
	startingYear: 1492,
	yearSuffix: 'DR',
	leapRules: createSimpleLeapRule(4, 9)  // Every 4 years, add to Midsummer
};

/**
 * Simple calendar with basic leap rule for testing
 */
const SIMPLE_LEAP_CALENDAR: CalendarDefinition = {
	id: 'simple-leap',
	name: 'Simple Leap Calendar',
	weekdays: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5'],
	months: [
		{ name: 'First', days: 30, order: 0 },
		{ name: 'Second', days: 30, order: 1 },  // Leap month
		{ name: 'Third', days: 30, order: 2 }
	],
	holidays: [],
	startingYear: 0,
	leapRules: createSimpleLeapRule(4, 1)  // Every 4 years, add to Second month
};

// ==========================================================================
// LeapCalculator Utility Tests
// ==========================================================================

describe('LeapCalculator Utility', () => {
	describe('isLeapYear', () => {
		it('should return false for no rules', () => {
			expect(isLeapYear(2000, undefined)).toBe(false);
			expect(isLeapYear(2000, [])).toBe(false);
		});

		it('should handle simple 4-year interval', () => {
			const rules = createSimpleLeapRule(4);
			expect(isLeapYear(0, rules)).toBe(true);
			expect(isLeapYear(4, rules)).toBe(true);
			expect(isLeapYear(8, rules)).toBe(true);
			expect(isLeapYear(1, rules)).toBe(false);
			expect(isLeapYear(2, rules)).toBe(false);
			expect(isLeapYear(3, rules)).toBe(false);
		});

		it('should handle Gregorian rules correctly', () => {
			const rules = createGregorianLeapRules();

			// Standard leap years (divisible by 4)
			expect(isLeapYear(2000, rules)).toBe(true);
			expect(isLeapYear(2004, rules)).toBe(true);
			expect(isLeapYear(2020, rules)).toBe(true);
			expect(isLeapYear(2024, rules)).toBe(true);

			// Non-leap years
			expect(isLeapYear(2001, rules)).toBe(false);
			expect(isLeapYear(2019, rules)).toBe(false);
			expect(isLeapYear(2021, rules)).toBe(false);

			// Century years NOT divisible by 400 are NOT leap years
			expect(isLeapYear(1900, rules)).toBe(false);
			expect(isLeapYear(2100, rules)).toBe(false);
			expect(isLeapYear(2200, rules)).toBe(false);
			expect(isLeapYear(2300, rules)).toBe(false);

			// Century years divisible by 400 ARE leap years
			expect(isLeapYear(2000, rules)).toBe(true);
			expect(isLeapYear(2400, rules)).toBe(true);
			expect(isLeapYear(1600, rules)).toBe(true);
		});

		it('should handle offset leap rules', () => {
			const rules: LeapRule[] = [{ interval: 4, offset: 2 }];

			// Years 2, 6, 10, 14... are leap years
			expect(isLeapYear(2, rules)).toBe(true);
			expect(isLeapYear(6, rules)).toBe(true);
			expect(isLeapYear(10, rules)).toBe(true);

			// Years 0, 4, 8, 12... are NOT leap years with offset 2
			expect(isLeapYear(0, rules)).toBe(false);
			expect(isLeapYear(4, rules)).toBe(false);
			expect(isLeapYear(8, rules)).toBe(false);
		});
	});

	describe('countLeapYears', () => {
		it('should count leap years in range', () => {
			const rules = createSimpleLeapRule(4);

			// Years 0-7: leap years are 0, 4 = 2 leap years
			expect(countLeapYears(0, 8, rules)).toBe(2);

			// Years 0-3: leap year is 0 = 1 leap year
			expect(countLeapYears(0, 4, rules)).toBe(1);

			// Years 1-4: no leap years (4 is exclusive)
			expect(countLeapYears(1, 4, rules)).toBe(0);

			// Years 1-5: leap year is 4 = 1 leap year
			expect(countLeapYears(1, 5, rules)).toBe(1);
		});

		it('should count Gregorian leap years correctly', () => {
			const rules = createGregorianLeapRules();

			// 1896-1904: 1896, 1900 (no!), 1904 = 2 leap years
			expect(countLeapYears(1896, 1905, rules)).toBe(2);

			// 1996-2004: 1996, 2000, 2004 = 3 leap years
			expect(countLeapYears(1996, 2005, rules)).toBe(3);

			// 2000-2000: empty range
			expect(countLeapYears(2000, 2000, rules)).toBe(0);
		});
	});
});

// ==========================================================================
// CalendarDriver Leap Year Tests
// ==========================================================================

describe('CalendarDriver Leap Year Support', () => {
	describe('leap year detection', () => {
		it('should detect if calendar has leap rules', () => {
			const leapDriver = new CalendarDriver(GREGORIAN_WITH_LEAP);
			const simpleDriver = new CalendarDriver({
				id: 'simple',
				name: 'Simple',
				weekdays: [],
				months: [{ name: 'Month', days: 30, order: 0 }],
				holidays: []
			});

			expect(leapDriver.hasLeapRules()).toBe(true);
			expect(simpleDriver.hasLeapRules()).toBe(false);
		});

		it('should correctly identify leap years', () => {
			const driver = new CalendarDriver(GREGORIAN_WITH_LEAP);

			// Leap years
			expect(driver.isLeapYear(2000)).toBe(true);
			expect(driver.isLeapYear(2004)).toBe(true);
			expect(driver.isLeapYear(2400)).toBe(true);

			// Non-leap years
			expect(driver.isLeapYear(2001)).toBe(false);
			expect(driver.isLeapYear(1900)).toBe(false);
			expect(driver.isLeapYear(2100)).toBe(false);
		});

		it('should return correct days in year', () => {
			const driver = new CalendarDriver(GREGORIAN_WITH_LEAP);

			expect(driver.getDaysInYear(2000)).toBe(366);  // Leap year
			expect(driver.getDaysInYear(2001)).toBe(365);  // Non-leap year
			expect(driver.getDaysInYear(1900)).toBe(365);  // Century, not leap
			expect(driver.getDaysInYear(2400)).toBe(366);  // Century, leap
		});

		it('should return correct leap day target month', () => {
			const driver = new CalendarDriver(GREGORIAN_WITH_LEAP);

			expect(driver.getLeapDayTargetMonth(2000)).toBe(1);  // February
			expect(driver.getLeapDayTargetMonth(2001)).toBeUndefined();  // Not a leap year
		});
	});

	describe('Gregorian leap year date calculations', () => {
		let driver: CalendarDriver;

		beforeEach(() => {
			driver = new CalendarDriver(GREGORIAN_WITH_LEAP);
		});

		it('should calculate Day 0 as January 1, 2000', () => {
			const date = driver.getDate(0);
			expect(date.dayOfMonth).toBe(1);
			expect(date.monthName).toBe('January');
			expect(date.year).toBe(2000);
		});

		it('should correctly handle February 29 in leap year 2000', () => {
			// Day 59 = March 1 in non-leap years (31 + 28)
			// Day 59 = February 29 in leap year 2000 (31 + 28, but Feb has 29)
			const feb28 = driver.getDate(58);  // Day 58 = Feb 28
			expect(feb28.dayOfMonth).toBe(28);
			expect(feb28.monthName).toBe('February');
			expect(feb28.year).toBe(2000);

			const feb29 = driver.getDate(59);  // Day 59 = Feb 29 in 2000
			expect(feb29.dayOfMonth).toBe(29);
			expect(feb29.monthName).toBe('February');
			expect(feb29.year).toBe(2000);

			const mar1 = driver.getDate(60);  // Day 60 = March 1 in 2000
			expect(mar1.dayOfMonth).toBe(1);
			expect(mar1.monthName).toBe('March');
			expect(mar1.year).toBe(2000);
		});

		it('should correctly calculate year rollover in leap year', () => {
			// Year 2000 has 366 days
			const lastDayOf2000 = driver.getDate(365);  // Day 365 = Dec 31, 2000
			expect(lastDayOf2000.dayOfMonth).toBe(31);
			expect(lastDayOf2000.monthName).toBe('December');
			expect(lastDayOf2000.year).toBe(2000);

			const firstDayOf2001 = driver.getDate(366);  // Day 366 = Jan 1, 2001
			expect(firstDayOf2001.dayOfMonth).toBe(1);
			expect(firstDayOf2001.monthName).toBe('January');
			expect(firstDayOf2001.year).toBe(2001);
		});

		it('should correctly calculate dates in non-leap year 2001', () => {
			// 2001 starts at day 366 and has 365 days
			const feb28_2001 = driver.getDate(366 + 58);  // 366 + 58 = 424
			expect(feb28_2001.dayOfMonth).toBe(28);
			expect(feb28_2001.monthName).toBe('February');
			expect(feb28_2001.year).toBe(2001);

			// Day after Feb 28 in non-leap year is March 1
			const mar1_2001 = driver.getDate(366 + 59);
			expect(mar1_2001.dayOfMonth).toBe(1);
			expect(mar1_2001.monthName).toBe('March');
			expect(mar1_2001.year).toBe(2001);
		});

		it('should handle century non-leap year 1900 rule', () => {
			// Create a driver starting in 1896 (a leap year)
			const driver1896 = new CalendarDriver({
				...GREGORIAN_WITH_LEAP,
				startingYear: 1896
			});

			// Test that 1896, 1904 are leap years but 1900 is not
			expect(driver1896.isLeapYear(1896)).toBe(true);
			expect(driver1896.isLeapYear(1900)).toBe(false);  // Century, not /400
			expect(driver1896.isLeapYear(1904)).toBe(true);

			// Calculate days from 1896 to 1904
			// 1896: 366 days (leap)
			// 1897: 365 days
			// 1898: 365 days
			// 1899: 365 days
			// 1900: 365 days (NOT leap - century rule)
			// 1901: 365 days
			// 1902: 365 days
			// 1903: 365 days
			// Total to 1904: 366 + 365*7 = 366 + 2555 = 2921

			const jan1_1904 = driver1896.getDate(2921);
			expect(jan1_1904.year).toBe(1904);
			expect(jan1_1904.monthName).toBe('January');
			expect(jan1_1904.dayOfMonth).toBe(1);
		});
	});

	describe('Harptos Shieldmeet calculations', () => {
		let driver: CalendarDriver;

		beforeEach(() => {
			driver = new CalendarDriver(HARPTOS_WITH_SHIELDMEET);
		});

		it('should detect Shieldmeet leap year rule', () => {
			expect(driver.hasLeapRules()).toBe(true);

			// 1492 is divisible by 4, so it's a leap year
			expect(driver.isLeapYear(1492)).toBe(true);
			expect(driver.isLeapYear(1493)).toBe(false);
			expect(driver.isLeapYear(1494)).toBe(false);
			expect(driver.isLeapYear(1495)).toBe(false);
			expect(driver.isLeapYear(1496)).toBe(true);
		});

		it('should have 366 days in leap year, 365 in non-leap', () => {
			expect(driver.getDaysInYear(1492)).toBe(366);
			expect(driver.getDaysInYear(1493)).toBe(365);
		});

		it('should add Shieldmeet day to Midsummer in leap years', () => {
			expect(driver.getLeapDayTargetMonth(1492)).toBe(9);  // Midsummer index
			expect(driver.getLeapDayTargetMonth(1493)).toBeUndefined();
		});

		it('should correctly calculate Midsummer with Shieldmeet in 1492', () => {
			// Hammer(30) + Midwinter(1) + Alturiak(30) + Ches(30) + Tarsakh(30)
			// + Greengrass(1) + Mirtul(30) + Kythorn(30) + Flamerule(30) = 212 days
			// Midsummer starts at day 212

			const midsummer1 = driver.getDate(212);
			expect(midsummer1.monthName).toBe('Midsummer');
			expect(midsummer1.dayOfMonth).toBe(1);
			expect(midsummer1.isIntercalary).toBe(true);

			// In leap year 1492, Midsummer has 2 days (including Shieldmeet)
			const midsummer2 = driver.getDate(213);
			expect(midsummer2.monthName).toBe('Midsummer');
			expect(midsummer2.dayOfMonth).toBe(2);  // Shieldmeet!
			expect(midsummer2.isIntercalary).toBe(true);

			// Eleasis starts at day 214 in leap year
			const eleasis1 = driver.getDate(214);
			expect(eleasis1.monthName).toBe('Eleasis');
			expect(eleasis1.dayOfMonth).toBe(1);
		});

		it('should correctly calculate Midsummer without Shieldmeet in 1493', () => {
			// First, get to 1493
			// 1492 has 366 days, so day 366 is Jan 1, 1493... wait, Harptos doesn't have January
			// Day 366 is the first day of 1493 (Hammer 1)

			// In 1493, Midsummer is at:
			// 366 (from 1492) + 212 = 578
			const midsummer1_1493 = driver.getDate(366 + 212);
			expect(midsummer1_1493.monthName).toBe('Midsummer');
			expect(midsummer1_1493.dayOfMonth).toBe(1);
			expect(midsummer1_1493.year).toBe(1493);

			// No Shieldmeet in 1493, so next day is Eleasis 1
			const eleasis1_1493 = driver.getDate(366 + 213);
			expect(eleasis1_1493.monthName).toBe('Eleasis');
			expect(eleasis1_1493.dayOfMonth).toBe(1);
			expect(eleasis1_1493.year).toBe(1493);
		});

		it('should maintain year rollover consistency', () => {
			// 1492: 366 days (leap)
			// 1493: 365 days
			// 1494: 365 days
			// 1495: 365 days
			// 1496: 366 days (leap)

			const nightal30_1492 = driver.getDate(365);
			expect(nightal30_1492.monthName).toBe('Nightal');
			expect(nightal30_1492.dayOfMonth).toBe(30);
			expect(nightal30_1492.year).toBe(1492);

			const hammer1_1493 = driver.getDate(366);
			expect(hammer1_1493.monthName).toBe('Hammer');
			expect(hammer1_1493.dayOfMonth).toBe(1);
			expect(hammer1_1493.year).toBe(1493);

			// Total days to start of 1496: 366 + 365 + 365 + 365 = 1461
			const hammer1_1496 = driver.getDate(1461);
			expect(hammer1_1496.monthName).toBe('Hammer');
			expect(hammer1_1496.dayOfMonth).toBe(1);
			expect(hammer1_1496.year).toBe(1496);
		});
	});

	describe('getAbsoluteDay with leap years (round-trip)', () => {
		it('should be reversible for Gregorian leap calendar', () => {
			const driver = new CalendarDriver(GREGORIAN_WITH_LEAP);

			// Test various dates including leap day
			const testDays = [
				0,      // Jan 1, 2000
				59,     // Feb 29, 2000 (leap day)
				60,     // Mar 1, 2000
				365,    // Dec 31, 2000
				366,    // Jan 1, 2001
				366 + 59,  // Mar 1, 2001 (no leap day)
				366 + 365 + 365 + 365,  // Jan 1, 2004 (next leap year)
			];

			for (const day of testDays) {
				const date = driver.getDate(day);
				const calculatedDay = driver.getAbsoluteDay(date.year, date.monthIndex, date.dayOfMonth);
				expect(calculatedDay).toBe(day);
			}
		});

		it('should be reversible for Harptos with Shieldmeet', () => {
			const driver = new CalendarDriver(HARPTOS_WITH_SHIELDMEET);

			const testDays = [
				0,      // Hammer 1, 1492
				212,    // Midsummer 1, 1492
				213,    // Midsummer 2 (Shieldmeet), 1492
				214,    // Eleasis 1, 1492
				365,    // Nightal 30, 1492
				366,    // Hammer 1, 1493
				366 + 212,  // Midsummer 1, 1493
				366 + 213,  // Eleasis 1, 1493 (no Shieldmeet)
			];

			for (const day of testDays) {
				const date = driver.getDate(day);
				const calculatedDay = driver.getAbsoluteDay(date.year, date.monthIndex, date.dayOfMonth);
				expect(calculatedDay).toBe(day);
			}
		});
	});

	describe('high year number handling', () => {
		let driver: CalendarDriver;

		beforeEach(() => {
			driver = new CalendarDriver(GREGORIAN_WITH_LEAP);
		});

		it('should handle years in the millions', () => {
			// Test year 1,000,000
			expect(driver.isLeapYear(1_000_000)).toBe(true);  // Divisible by 4 and 400
			expect(driver.isLeapYear(1_000_100)).toBe(false); // Century not /400
			expect(driver.isLeapYear(1_000_400)).toBe(true);  // Century /400
		});

		it('should calculate dates for very large day counts', () => {
			// 100,000 days from year 2000
			const date = driver.getDate(100_000);

			// Verify the result is reasonable
			expect(date.year).toBeGreaterThan(2000);
			expect(date.year).toBeLessThan(2500);
			expect(date.monthIndex).toBeGreaterThanOrEqual(0);
			expect(date.monthIndex).toBeLessThan(12);
			expect(date.dayOfMonth).toBeGreaterThan(0);
			expect(date.dayOfMonth).toBeLessThanOrEqual(31);

			// Verify round-trip
			const calculatedDay = driver.getAbsoluteDay(date.year, date.monthIndex, date.dayOfMonth);
			expect(calculatedDay).toBe(100_000);
		});

		it('should maintain consistency at 1 million days', () => {
			const largeDays = 1_000_000;
			const date = driver.getDate(largeDays);

			// Round-trip should work
			const calculatedDay = driver.getAbsoluteDay(date.year, date.monthIndex, date.dayOfMonth);
			expect(calculatedDay).toBe(largeDays);
		});

		it('should not overflow with safe integer day counts', () => {
			// Test with 10 billion days (very far future)
			const veryLargeDays = 10_000_000_000;
			const date = driver.getDate(veryLargeDays);

			// Should produce valid numbers
			expect(Number.isFinite(date.year)).toBe(true);
			expect(Number.isInteger(date.dayOfMonth)).toBe(true);
			expect(date.monthIndex).toBeGreaterThanOrEqual(0);
			expect(date.monthIndex).toBeLessThan(12);
		});
	});

	describe('simple leap calendar edge cases', () => {
		let driver: CalendarDriver;

		beforeEach(() => {
			driver = new CalendarDriver(SIMPLE_LEAP_CALENDAR);
		});

		it('should have correct base year length', () => {
			expect(driver.getTotalDaysInYear()).toBe(90);  // 3 months * 30 days
		});

		it('should add leap day to correct month', () => {
			expect(driver.getLeapDayTargetMonth(0)).toBe(1);  // Second month
			expect(driver.getLeapDayTargetMonth(4)).toBe(1);
			expect(driver.getLeapDayTargetMonth(8)).toBe(1);
		});

		it('should correctly calculate Second month with leap day in year 0', () => {
			// Year 0 is a leap year (0 % 4 == 0)
			expect(driver.isLeapYear(0)).toBe(true);
			expect(driver.getDaysInYear(0)).toBe(91);

			// First month: days 0-29
			// Second month: days 30-60 (31 days with leap)
			// Third month: days 61-90

			const second30 = driver.getDate(59);  // Day 59 = Second 30
			expect(second30.monthName).toBe('Second');
			expect(second30.dayOfMonth).toBe(30);

			const second31 = driver.getDate(60);  // Day 60 = Second 31 (leap day!)
			expect(second31.monthName).toBe('Second');
			expect(second31.dayOfMonth).toBe(31);

			const third1 = driver.getDate(61);  // Day 61 = Third 1
			expect(third1.monthName).toBe('Third');
			expect(third1.dayOfMonth).toBe(1);
		});

		it('should correctly calculate Second month without leap day in year 1', () => {
			// Year 1 is not a leap year
			expect(driver.isLeapYear(1)).toBe(false);

			// Year 0: 91 days
			// Year 1 starts at day 91
			// Second month in year 1: days 91+30=121 to 91+59=150 (30 days, no leap)

			const second30_y1 = driver.getDate(91 + 59);  // Day 150 = Second 30
			expect(second30_y1.monthName).toBe('Second');
			expect(second30_y1.dayOfMonth).toBe(30);
			expect(second30_y1.year).toBe(1);

			const third1_y1 = driver.getDate(91 + 60);  // Day 151 = Third 1
			expect(third1_y1.monthName).toBe('Third');
			expect(third1_y1.dayOfMonth).toBe(1);
			expect(third1_y1.year).toBe(1);
		});
	});

	describe('backward compatibility with non-leap calendars', () => {
		it('should work identically to before for calendars without leap rules', () => {
			const calendarWithoutLeap: CalendarDefinition = {
				id: 'no-leap',
				name: 'No Leap Calendar',
				weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
				months: [
					{ name: 'January', days: 31, order: 0 },
					{ name: 'February', days: 28, order: 1 },
					{ name: 'March', days: 31, order: 2 }
				],
				holidays: [],
				startingYear: 2000
			};

			const driver = new CalendarDriver(calendarWithoutLeap);

			expect(driver.hasLeapRules()).toBe(false);
			expect(driver.isLeapYear(2000)).toBe(false);  // No leap rules = no leap years
			expect(driver.getDaysInYear(2000)).toBe(90);
			expect(driver.getLeapDayTargetMonth(2000)).toBeUndefined();

			// Test date calculations
			const date = driver.getDate(0);
			expect(date.dayOfMonth).toBe(1);
			expect(date.monthName).toBe('January');
			expect(date.year).toBe(2000);

			// Round-trip
			const day = driver.getAbsoluteDay(2000, 0, 1);
			expect(day).toBe(0);
		});
	});
});
