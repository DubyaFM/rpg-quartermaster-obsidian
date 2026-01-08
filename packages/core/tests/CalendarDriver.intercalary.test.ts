import { describe, it, expect, beforeEach } from 'vitest';
import { CalendarDriver } from '../services/CalendarDriver';
import { CalendarDefinition } from '../models/types';

/**
 * Intercalary Day Support Tests
 *
 * Tests the CalendarDriver's ability to handle intercalary days (days outside
 * the normal month/week cycle) as used in the Calendar of Harptos.
 */

// ==========================================================================
// Test Fixtures
// ==========================================================================

/**
 * Harptos Calendar with Intercalary Days
 * - 12 standard months of 30 days = 360 days
 * - 5 intercalary days (festival days) = 5 days
 * - Total: 365 days/year
 * - 10-day week for standard months, intercalary days don't advance weekday
 */
const HARPTOS_WITH_INTERCALARY: CalendarDefinition = {
	id: 'harptos-full',
	name: 'Calendar of Harptos (Full)',
	description: 'Harptos with intercalary festival days',
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
		{ name: 'Midsummer', days: 1, order: 9, type: 'intercalary' },
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
	yearSuffix: 'DR'
};

/**
 * Simple calendar without intercalary days for comparison
 */
const SIMPLE_CALENDAR: CalendarDefinition = {
	id: 'simple',
	name: 'Simple Calendar',
	weekdays: ['Day 1', 'Day 2', 'Day 3'],
	months: [
		{ name: 'Month 1', days: 30, order: 0 },
		{ name: 'Month 2', days: 30, order: 1 }
	],
	holidays: []
};

// ==========================================================================
// Tests
// ==========================================================================

describe('Intercalary Day Support', () => {
	describe('intercalary month detection', () => {
		let driver: CalendarDriver;

		beforeEach(() => {
			driver = new CalendarDriver(HARPTOS_WITH_INTERCALARY);
		});

		it('should detect calendar has intercalary months', () => {
			expect(driver.hasIntercalaryMonths()).toBe(true);
		});

		it('should identify intercalary days correctly', () => {
			// Day 30 = Midwinter 1 (first intercalary day)
			expect(driver.isIntercalaryDay(30)).toBe(true);

			// Day 0 = Hammer 1 (not intercalary)
			expect(driver.isIntercalaryDay(0)).toBe(false);

			// Day 31 = Alturiak 1 (not intercalary)
			expect(driver.isIntercalaryDay(31)).toBe(false);
		});

		it('should identify all festival days as intercalary', () => {
			// Hammer(0-29=30), Midwinter(30), Alturiak(31-60=30), Ches(61-90=30), Tarsakh(91-120=30)
			// Greengrass(121), Mirtul(122-151=30), Kythorn(152-181=30), Flamerule(182-211=30)
			// Midsummer(212), Eleasis(213-242=30), Eleint(243-272=30), Highharvestide(273)
			// Marpenoth(274-303=30), Uktar(304-333=30), Feast of the Moon(334)
			const intercalaryDays = [30, 121, 212, 273, 334];  // Positions of 5 festival days

			for (const day of intercalaryDays) {
				expect(driver.isIntercalaryDay(day)).toBe(true);
			}
		});

		it('should mark intercalary days in CalendarDate', () => {
			const midwinter = driver.getDate(30);
			expect(midwinter.isIntercalary).toBe(true);
			expect(midwinter.monthName).toBe('Midwinter');

			const hammer = driver.getDate(0);
			expect(hammer.isIntercalary).toBe(false);
		});
	});

	describe('intercalary weekday behavior', () => {
		let driver: CalendarDriver;

		beforeEach(() => {
			driver = new CalendarDriver(HARPTOS_WITH_INTERCALARY);
		});

		it('intercalary days should have no weekday', () => {
			const midwinter = driver.getDate(30);
			expect(midwinter.dayOfWeek).toBe('');
			expect(midwinter.dayOfWeekIndex).toBe(-1);
		});

		it('weekday should not advance across intercalary day', () => {
			// Last day of Hammer: Day 29 = Hammer 30
			// Since Day 0 is 1st Day, Day 29 is 10th Day (29 % 10 = 9, which is index 9 = 10th Day)
			const lastHammer = driver.getDate(29);
			expect(lastHammer.dayOfWeek).toBe('10th Day');

			// Midwinter: Day 30 = no weekday
			const midwinter = driver.getDate(30);
			expect(midwinter.dayOfWeek).toBe('');

			// First day of Alturiak: Day 31 should be 1st Day again (weekday doesn't advance)
			const firstAlturiak = driver.getDate(31);
			expect(firstAlturiak.dayOfWeek).toBe('1st Day');
		});

		it('weekday should remain consistent across all intercalary periods', () => {
			// Test each intercalary boundary
			const testCases = [
				{ before: 29, intercalary: 30, after: 31, expectedBefore: '10th Day', expectedAfter: '1st Day' },  // Hammer -> Midwinter -> Alturiak
				{ before: 120, intercalary: 121, after: 122, expectedBefore: '10th Day', expectedAfter: '1st Day' },  // Tarsakh -> Greengrass -> Mirtul
				{ before: 211, intercalary: 212, after: 213, expectedBefore: '10th Day', expectedAfter: '1st Day' },  // Flamerule -> Midsummer -> Eleasis
				{ before: 272, intercalary: 273, after: 274, expectedBefore: '10th Day', expectedAfter: '1st Day' },  // Eleint -> Highharvestide -> Marpenoth
				{ before: 333, intercalary: 334, after: 335, expectedBefore: '10th Day', expectedAfter: '1st Day' }   // Uktar -> Feast -> Nightal
			];

			for (const test of testCases) {
				const before = driver.getDate(test.before);
				const intercalary = driver.getDate(test.intercalary);
				const after = driver.getDate(test.after);

				expect(before.dayOfWeek).toBe(test.expectedBefore);
				expect(intercalary.dayOfWeek).toBe('');
				expect(after.dayOfWeek).toBe(test.expectedAfter);
			}
		});
	});

	describe('intercalary date calculations', () => {
		let driver: CalendarDriver;

		beforeEach(() => {
			driver = new CalendarDriver(HARPTOS_WITH_INTERCALARY);
		});

		it('should calculate total days in year including intercalary', () => {
			// 12 months * 30 days + 5 intercalary days = 365
			expect(driver.getTotalDaysInYear()).toBe(365);
		});

		it('should calculate week-counting days correctly', () => {
			// 12 months * 30 days = 360 (intercalary days don't count)
			expect(driver.getWeekCountingDaysInYear()).toBe(360);
		});

		it('should render intercalary days as standalone periods', () => {
			const midwinter = driver.getDate(30);
			expect(midwinter.monthName).toBe('Midwinter');
			expect(midwinter.dayOfMonth).toBe(1);
			expect(midwinter.monthIndex).toBe(1);
		});

		it('should handle year rollover with intercalary days', () => {
			// Day 364 = last day of Nightal
			const lastDay = driver.getDate(364);
			expect(lastDay.monthName).toBe('Nightal');
			expect(lastDay.year).toBe(1492);

			// Day 365 = first day of next year
			const firstDay = driver.getDate(365);
			expect(firstDay.monthName).toBe('Hammer');
			expect(firstDay.year).toBe(1493);
		});

		it('should maintain date math consistency across intercalary boundaries', () => {
			// Test round-trip for days around intercalary periods
			const testDays = [29, 30, 31, 120, 121, 122, 210, 211, 212];

			for (const day of testDays) {
				const date = driver.getDate(day);
				const calculatedDay = driver.getAbsoluteDay(date.year, date.monthIndex, date.dayOfMonth);
				expect(calculatedDay).toBe(day);
			}
		});
	});

	describe('golden master tests - Harptos year progression', () => {
		let driver: CalendarDriver;

		beforeEach(() => {
			driver = new CalendarDriver(HARPTOS_WITH_INTERCALARY);
		});

		it('should produce expected dates for key days in year', () => {
			const goldenDates = [
				{ day: 0, month: 'Hammer', dayOfMonth: 1, weekday: '1st Day', isIntercalary: false },
				{ day: 29, month: 'Hammer', dayOfMonth: 30, weekday: '10th Day', isIntercalary: false },
				{ day: 30, month: 'Midwinter', dayOfMonth: 1, weekday: '', isIntercalary: true },
				{ day: 31, month: 'Alturiak', dayOfMonth: 1, weekday: '1st Day', isIntercalary: false },
				{ day: 60, month: 'Alturiak', dayOfMonth: 30, weekday: '10th Day', isIntercalary: false },
				{ day: 121, month: 'Greengrass', dayOfMonth: 1, weekday: '', isIntercalary: true },
				{ day: 122, month: 'Mirtul', dayOfMonth: 1, weekday: '1st Day', isIntercalary: false },
				{ day: 212, month: 'Midsummer', dayOfMonth: 1, weekday: '', isIntercalary: true },
				{ day: 273, month: 'Highharvestide', dayOfMonth: 1, weekday: '', isIntercalary: true },
				{ day: 334, month: 'Feast of the Moon', dayOfMonth: 1, weekday: '', isIntercalary: true },
				{ day: 364, month: 'Nightal', dayOfMonth: 30, weekday: '10th Day', isIntercalary: false }
			];

			for (const expected of goldenDates) {
				const date = driver.getDate(expected.day);
				expect(date.monthName).toBe(expected.month);
				expect(date.dayOfMonth).toBe(expected.dayOfMonth);
				expect(date.dayOfWeek).toBe(expected.weekday);
				expect(date.isIntercalary).toBe(expected.isIntercalary);
			}
		});

		it('should maintain weekday continuity throughout entire year', () => {
			let expectedWeekdayIndex = 0;

			for (let day = 0; day < 365; day++) {
				const date = driver.getDate(day);

				if (date.isIntercalary) {
					// Intercalary days should have no weekday
					expect(date.dayOfWeek).toBe('');
					expect(date.dayOfWeekIndex).toBe(-1);
					// expectedWeekdayIndex stays the same (doesn't advance)
				} else {
					// Normal days should follow weekday cycle
					expect(date.dayOfWeekIndex).toBe(expectedWeekdayIndex);
					expectedWeekdayIndex = (expectedWeekdayIndex + 1) % 10;
				}
			}
		});
	});

	describe('edge cases with intercalary days', () => {
		it('should handle calendar with only intercalary days', () => {
			const onlyIntercalary: CalendarDefinition = {
				id: 'only-intercalary',
				name: 'Only Intercalary',
				weekdays: ['Day'],
				months: [
					{ name: 'Festival', days: 10, order: 0, type: 'intercalary' }
				],
				holidays: []
			};
			const driver = new CalendarDriver(onlyIntercalary);

			expect(driver.hasIntercalaryMonths()).toBe(true);
			expect(driver.getWeekCountingDaysInYear()).toBe(0);

			const date = driver.getDate(5);
			expect(date.dayOfWeek).toBe('');
			expect(date.isIntercalary).toBe(true);
		});

		it('should handle calendar with no intercalary days', () => {
			const driver = new CalendarDriver(SIMPLE_CALENDAR);

			expect(driver.hasIntercalaryMonths()).toBe(false);
			expect(driver.isIntercalaryDay(0)).toBe(false);
		});

		it('should handle simple counter calendar for intercalary checks', () => {
			const simpleCounter: CalendarDefinition = {
				id: 'simple-counter',
				name: 'Simple Day Counter',
				weekdays: [],
				months: [],
				holidays: []
			};
			const driver = new CalendarDriver(simpleCounter);

			expect(driver.hasIntercalaryMonths()).toBe(false);
			expect(driver.isIntercalaryDay(100)).toBe(false);
		});
	});
});
