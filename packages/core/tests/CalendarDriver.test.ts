import { describe, it, expect, beforeEach } from 'vitest';
import { CalendarDriver } from '../services/CalendarDriver';
import { CalendarDefinition, CalendarOrigin, CalendarDate } from '../models/types';

// ==========================================================================
// Test Fixtures - Calendar Definitions
// ==========================================================================

/**
 * Harptos Calendar (Forgotten Realms)
 * - 12 months of 30 days each = 360 days/year
 * - 10-day week (tenday)
 */
const HARPTOS_CALENDAR: CalendarDefinition = {
	id: 'harptos',
	name: 'Calendar of Harptos',
	description: 'The standard calendar of Faerun (Forgotten Realms)',
	weekdays: ['1st Day', '2nd Day', '3rd Day', '4th Day', '5th Day', '6th Day', '7th Day', '8th Day', '9th Day', '10th Day'],
	months: [
		{ name: 'Hammer', days: 30, order: 0 },
		{ name: 'Alturiak', days: 30, order: 1 },
		{ name: 'Ches', days: 30, order: 2 },
		{ name: 'Tarsakh', days: 30, order: 3 },
		{ name: 'Mirtul', days: 30, order: 4 },
		{ name: 'Kythorn', days: 30, order: 5 },
		{ name: 'Flamerule', days: 30, order: 6 },
		{ name: 'Eleasis', days: 30, order: 7 },
		{ name: 'Eleint', days: 30, order: 8 },
		{ name: 'Marpenoth', days: 30, order: 9 },
		{ name: 'Uktar', days: 30, order: 10 },
		{ name: 'Nightal', days: 30, order: 11 }
	],
	holidays: [
		{ name: 'Midwinter', description: 'Festival day between Hammer and Alturiak', dayOfYear: 30, notifyOnArrival: true }
	],
	startingYear: 1492,
	yearSuffix: 'DR'
};

/**
 * Gregorian Calendar (Real World)
 * - 12 months with varying lengths = 365 days/year (non-leap)
 * - 7-day week
 */
const GREGORIAN_CALENDAR: CalendarDefinition = {
	id: 'gregorian',
	name: 'Gregorian Calendar',
	description: 'The standard real-world calendar',
	weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
	months: [
		{ name: 'January', days: 31, order: 0 },
		{ name: 'February', days: 28, order: 1 },
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
	holidays: [
		{ name: "New Year's Day", description: 'First day of the year', month: 0, day: 1, notifyOnArrival: true }
	],
	startingYear: 2024,
	yearSuffix: 'AD'
};

/**
 * Simple Counter Calendar (No months)
 * - Fallback mode for simple day tracking
 */
const SIMPLE_COUNTER_CALENDAR: CalendarDefinition = {
	id: 'simple-counter',
	name: 'Simple Day Counter',
	description: 'Basic counting from Day 0',
	weekdays: [],
	months: [],
	holidays: []
};

/**
 * Custom Short Week Calendar
 * - 3-day week for testing configurable week length
 */
const SHORT_WEEK_CALENDAR: CalendarDefinition = {
	id: 'short-week',
	name: 'Short Week Calendar',
	description: 'Calendar with 3-day week',
	weekdays: ['Alpha', 'Beta', 'Gamma'],
	months: [
		{ name: 'First Month', days: 30, order: 0 },
		{ name: 'Second Month', days: 30, order: 1 }
	],
	holidays: [],
	startingYear: 1,
	yearSuffix: ''
};

// ==========================================================================
// Tests
// ==========================================================================

describe('CalendarDriver', () => {
	describe('constructor and initialization', () => {
		it('should create driver with calendar definition', () => {
			const driver = new CalendarDriver(HARPTOS_CALENDAR);

			expect(driver.getCalendarDefinition()).toBe(HARPTOS_CALENDAR);
			expect(driver.getOrigin()).toBeUndefined();
		});

		it('should create driver with calendar and origin', () => {
			const origin: CalendarOrigin = { year: 1490, month: 0, day: 1 };
			const driver = new CalendarDriver(HARPTOS_CALENDAR, origin);

			expect(driver.getCalendarDefinition()).toBe(HARPTOS_CALENDAR);
			expect(driver.getOrigin()).toBe(origin);
		});

		it('should calculate total days in year correctly', () => {
			const harptosDriver = new CalendarDriver(HARPTOS_CALENDAR);
			const gregorianDriver = new CalendarDriver(GREGORIAN_CALENDAR);

			expect(harptosDriver.getTotalDaysInYear()).toBe(360);  // 12 * 30
			expect(gregorianDriver.getTotalDaysInYear()).toBe(365);
		});

		it('should return 0 total days for simple counter calendar', () => {
			const driver = new CalendarDriver(SIMPLE_COUNTER_CALENDAR);

			expect(driver.getTotalDaysInYear()).toBe(0);
		});

		it('should return correct week length', () => {
			const harptosDriver = new CalendarDriver(HARPTOS_CALENDAR);
			const gregorianDriver = new CalendarDriver(GREGORIAN_CALENDAR);
			const shortWeekDriver = new CalendarDriver(SHORT_WEEK_CALENDAR);
			const simpleDriver = new CalendarDriver(SIMPLE_COUNTER_CALENDAR);

			expect(harptosDriver.getWeekLength()).toBe(10);
			expect(gregorianDriver.getWeekLength()).toBe(7);
			expect(shortWeekDriver.getWeekLength()).toBe(3);
			expect(simpleDriver.getWeekLength()).toBe(0);
		});
	});

	describe('simple counter mode (no months)', () => {
		let driver: CalendarDriver;

		beforeEach(() => {
			driver = new CalendarDriver(SIMPLE_COUNTER_CALENDAR);
		});

		it('should return simple counter date for any day', () => {
			const date = driver.getDate(147);

			expect(date.isSimpleCounter).toBe(true);
			expect(date.absoluteDay).toBe(147);
			expect(date.dayOfMonth).toBe(0);
			expect(date.monthIndex).toBe(-1);
			expect(date.monthName).toBe('');
			expect(date.year).toBe(0);
			expect(date.dayOfWeek).toBe('');
			expect(date.dayOfWeekIndex).toBe(-1);
			expect(date.dayOfYear).toBe(147);
		});

		it('should handle day 0', () => {
			const date = driver.getDate(0);

			expect(date.isSimpleCounter).toBe(true);
			expect(date.absoluteDay).toBe(0);
			expect(date.dayOfYear).toBe(0);
		});

		it('should return empty strings for month and weekday methods', () => {
			expect(driver.getMonthName(100)).toBe('');
			expect(driver.getDayOfWeek(100)).toBe('');
			expect(driver.getDayOfMonth(100)).toBe(0);
			expect(driver.getYear(100)).toBe(0);
		});

		it('should not be affected by hasMonths/hasWeekdays', () => {
			expect(driver.hasMonths()).toBe(false);
			expect(driver.hasWeekdays()).toBe(false);
		});
	});

	describe('Harptos calendar date calculations', () => {
		let driver: CalendarDriver;

		beforeEach(() => {
			driver = new CalendarDriver(HARPTOS_CALENDAR);
		});

		it('should calculate Day 0 as 1st Hammer 1492', () => {
			const date = driver.getDate(0);

			expect(date.absoluteDay).toBe(0);
			expect(date.dayOfMonth).toBe(1);
			expect(date.monthIndex).toBe(0);
			expect(date.monthName).toBe('Hammer');
			expect(date.year).toBe(1492);
			expect(date.dayOfWeek).toBe('1st Day');
			expect(date.dayOfWeekIndex).toBe(0);
			expect(date.dayOfYear).toBe(0);
			expect(date.yearSuffix).toBe('DR');
			expect(date.isSimpleCounter).toBe(false);
		});

		it('should calculate last day of Hammer (Day 29)', () => {
			const date = driver.getDate(29);

			expect(date.dayOfMonth).toBe(30);
			expect(date.monthName).toBe('Hammer');
			expect(date.year).toBe(1492);
		});

		it('should calculate first day of Alturiak (Day 30)', () => {
			const date = driver.getDate(30);

			expect(date.dayOfMonth).toBe(1);
			expect(date.monthIndex).toBe(1);
			expect(date.monthName).toBe('Alturiak');
		});

		it('should calculate mid-year (Day 180 = 1st Flamerule)', () => {
			// 6 months * 30 days = 180 days (0-indexed: day 180 = 181st day = 1st of 7th month)
			const date = driver.getDate(180);

			expect(date.dayOfMonth).toBe(1);
			expect(date.monthIndex).toBe(6);
			expect(date.monthName).toBe('Flamerule');
		});

		it('should calculate end of year (Day 359 = 30th Nightal)', () => {
			const date = driver.getDate(359);

			expect(date.dayOfMonth).toBe(30);
			expect(date.monthIndex).toBe(11);
			expect(date.monthName).toBe('Nightal');
			expect(date.year).toBe(1492);
		});

		it('should roll over to next year (Day 360 = 1st Hammer 1493)', () => {
			const date = driver.getDate(360);

			expect(date.dayOfMonth).toBe(1);
			expect(date.monthIndex).toBe(0);
			expect(date.monthName).toBe('Hammer');
			expect(date.year).toBe(1493);
		});

		it('should calculate multiple years correctly', () => {
			// 5 years * 360 days + 45 days = 1845 days
			const date = driver.getDate(1845);

			expect(date.year).toBe(1497);
			expect(date.monthName).toBe('Alturiak');
			expect(date.dayOfMonth).toBe(16);  // 45 - 30 (Hammer) = 15, so day 16 of Alturiak
		});

		it('should calculate day of week correctly with 10-day week', () => {
			// Day 0 = 1st Day
			// Day 10 = 1st Day (next tenday)
			// Day 5 = 6th Day
			expect(driver.getDate(0).dayOfWeek).toBe('1st Day');
			expect(driver.getDate(10).dayOfWeek).toBe('1st Day');
			expect(driver.getDate(5).dayOfWeek).toBe('6th Day');
			expect(driver.getDate(9).dayOfWeek).toBe('10th Day');
		});
	});

	describe('Gregorian calendar date calculations', () => {
		let driver: CalendarDriver;

		beforeEach(() => {
			driver = new CalendarDriver(GREGORIAN_CALENDAR);
		});

		it('should calculate Day 0 as January 1, 2024', () => {
			const date = driver.getDate(0);

			expect(date.dayOfMonth).toBe(1);
			expect(date.monthName).toBe('January');
			expect(date.year).toBe(2024);
			expect(date.dayOfWeek).toBe('Sunday');
		});

		it('should handle varying month lengths (February)', () => {
			// Day 31 = February 1 (after 31 days of January)
			const date = driver.getDate(31);

			expect(date.dayOfMonth).toBe(1);
			expect(date.monthName).toBe('February');
		});

		it('should calculate March 1 after February', () => {
			// Day 31 (Jan) + 28 (Feb) = Day 59 = March 1
			const date = driver.getDate(59);

			expect(date.dayOfMonth).toBe(1);
			expect(date.monthName).toBe('March');
		});

		it('should calculate year rollover (365 days)', () => {
			const date = driver.getDate(365);

			expect(date.dayOfMonth).toBe(1);
			expect(date.monthName).toBe('January');
			expect(date.year).toBe(2025);
		});

		it('should calculate day of week with 7-day week', () => {
			// Day 0 = Sunday
			// Day 1 = Monday
			// Day 6 = Saturday
			// Day 7 = Sunday (next week)
			expect(driver.getDate(0).dayOfWeek).toBe('Sunday');
			expect(driver.getDate(1).dayOfWeek).toBe('Monday');
			expect(driver.getDate(6).dayOfWeek).toBe('Saturday');
			expect(driver.getDate(7).dayOfWeek).toBe('Sunday');
		});
	});

	describe('origin date calculations', () => {
		it('should offset year when origin is provided', () => {
			const origin: CalendarOrigin = { year: 1490, month: 0, day: 1 };
			const driver = new CalendarDriver(HARPTOS_CALENDAR, origin);

			// Day 0 should now be year 1490 (not 1492)
			const date = driver.getDate(0);
			expect(date.year).toBe(1490);

			// Day 360 should be year 1491
			const nextYear = driver.getDate(360);
			expect(nextYear.year).toBe(1491);
		});

		it('should prefer origin over startingYear', () => {
			const origin: CalendarOrigin = { year: 1000, month: 0, day: 1 };
			const driver = new CalendarDriver(HARPTOS_CALENDAR, origin);

			expect(driver.getDate(0).year).toBe(1000);  // Not 1492
		});
	});

	describe('configurable week length', () => {
		it('should handle 3-day week', () => {
			const driver = new CalendarDriver(SHORT_WEEK_CALENDAR);

			expect(driver.getDate(0).dayOfWeek).toBe('Alpha');
			expect(driver.getDate(1).dayOfWeek).toBe('Beta');
			expect(driver.getDate(2).dayOfWeek).toBe('Gamma');
			expect(driver.getDate(3).dayOfWeek).toBe('Alpha');
		});

		it('should handle calendar with no weekdays', () => {
			const noWeekCalendar: CalendarDefinition = {
				id: 'no-week',
				name: 'No Week Calendar',
				weekdays: [],
				months: [{ name: 'Only Month', days: 30, order: 0 }],
				holidays: []
			};
			const driver = new CalendarDriver(noWeekCalendar);

			const date = driver.getDate(0);
			expect(date.dayOfWeek).toBe('');
			expect(date.dayOfWeekIndex).toBe(-1);
		});
	});

	describe('helper methods', () => {
		let harptosDriver: CalendarDriver;
		let gregorianDriver: CalendarDriver;

		beforeEach(() => {
			harptosDriver = new CalendarDriver(HARPTOS_CALENDAR);
			gregorianDriver = new CalendarDriver(GREGORIAN_CALENDAR);
		});

		it('getDayOfWeek should return correct weekday', () => {
			expect(harptosDriver.getDayOfWeek(0)).toBe('1st Day');
			expect(harptosDriver.getDayOfWeek(5)).toBe('6th Day');
			expect(gregorianDriver.getDayOfWeek(0)).toBe('Sunday');
			expect(gregorianDriver.getDayOfWeek(3)).toBe('Wednesday');
		});

		it('getMonthName should return correct month', () => {
			expect(harptosDriver.getMonthName(0)).toBe('Hammer');
			expect(harptosDriver.getMonthName(30)).toBe('Alturiak');
			expect(gregorianDriver.getMonthName(0)).toBe('January');
			expect(gregorianDriver.getMonthName(31)).toBe('February');
		});

		it('getDayOfMonth should return correct day', () => {
			expect(harptosDriver.getDayOfMonth(0)).toBe(1);
			expect(harptosDriver.getDayOfMonth(29)).toBe(30);
			expect(harptosDriver.getDayOfMonth(30)).toBe(1);
		});

		it('getYear should return correct year', () => {
			expect(harptosDriver.getYear(0)).toBe(1492);
			expect(harptosDriver.getYear(360)).toBe(1493);
		});

		it('getDayOfYear should return correct day of year', () => {
			expect(harptosDriver.getDayOfYear(0)).toBe(0);
			expect(harptosDriver.getDayOfYear(59)).toBe(59);
			expect(harptosDriver.getDayOfYear(360)).toBe(0);  // Rolls over
		});

		it('hasMonths should return correct boolean', () => {
			const simpleDriver = new CalendarDriver(SIMPLE_COUNTER_CALENDAR);
			expect(harptosDriver.hasMonths()).toBe(true);
			expect(simpleDriver.hasMonths()).toBe(false);
		});

		it('hasWeekdays should return correct boolean', () => {
			const simpleDriver = new CalendarDriver(SIMPLE_COUNTER_CALENDAR);
			expect(harptosDriver.hasWeekdays()).toBe(true);
			expect(simpleDriver.hasWeekdays()).toBe(false);
		});
	});

	describe('getAbsoluteDay (reverse calculation)', () => {
		let driver: CalendarDriver;

		beforeEach(() => {
			driver = new CalendarDriver(HARPTOS_CALENDAR);
		});

		it('should calculate absolute day for start of year', () => {
			const absoluteDay = driver.getAbsoluteDay(1492, 0, 1);
			expect(absoluteDay).toBe(0);
		});

		it('should calculate absolute day for end of first month', () => {
			const absoluteDay = driver.getAbsoluteDay(1492, 0, 30);
			expect(absoluteDay).toBe(29);
		});

		it('should calculate absolute day for start of second month', () => {
			const absoluteDay = driver.getAbsoluteDay(1492, 1, 1);
			expect(absoluteDay).toBe(30);
		});

		it('should calculate absolute day for next year', () => {
			const absoluteDay = driver.getAbsoluteDay(1493, 0, 1);
			expect(absoluteDay).toBe(360);
		});

		it('should be reversible with getDate', () => {
			// Test round-trip
			const testDays = [0, 45, 180, 359, 360, 720, 1000];
			for (const day of testDays) {
				const date = driver.getDate(day);
				const calculatedDay = driver.getAbsoluteDay(date.year, date.monthIndex, date.dayOfMonth);
				expect(calculatedDay).toBe(day);
			}
		});
	});

	describe('high day counter edge cases', () => {
		let driver: CalendarDriver;

		beforeEach(() => {
			driver = new CalendarDriver(HARPTOS_CALENDAR);
		});

		it('should handle 1 million days', () => {
			const date = driver.getDate(1_000_000);

			// 1,000,000 / 360 = 2777 years, 280 days remainder
			expect(date.year).toBe(1492 + 2777);
			expect(date.dayOfYear).toBe(280);
			expect(date.isSimpleCounter).toBe(false);
		});

		it('should handle 100 million days', () => {
			const date = driver.getDate(100_000_000);

			// 100,000,000 / 360 = 277,777 years, 280 days remainder
			expect(date.year).toBe(1492 + 277777);
			expect(date.dayOfYear).toBe(280);
		});

		it('should handle large values without overflow', () => {
			// Test a very large but safe integer
			const largeDay = 1_000_000_000_000;  // 1 trillion days
			const date = driver.getDate(largeDay);

			// Should not throw and should produce valid results
			expect(date.isSimpleCounter).toBe(false);
			expect(typeof date.year).toBe('number');
			expect(Number.isFinite(date.year)).toBe(true);
		});

		it('should maintain consistency at large values', () => {
			const day = 999_999_999;
			const date = driver.getDate(day);

			// Verify calculations are internally consistent
			const recalculatedDay = driver.getAbsoluteDay(date.year, date.monthIndex, date.dayOfMonth);
			expect(recalculatedDay).toBe(day);
		});
	});

	describe('year suffix', () => {
		it('should include year suffix from calendar definition', () => {
			const harptosDriver = new CalendarDriver(HARPTOS_CALENDAR);
			const gregorianDriver = new CalendarDriver(GREGORIAN_CALENDAR);

			expect(harptosDriver.getDate(0).yearSuffix).toBe('DR');
			expect(gregorianDriver.getDate(0).yearSuffix).toBe('AD');
		});

		it('should handle missing year suffix', () => {
			const driver = new CalendarDriver(SHORT_WEEK_CALENDAR);

			expect(driver.getDate(0).yearSuffix).toBe('');
		});
	});

	describe('edge cases', () => {
		it('should handle calendar with single month', () => {
			const singleMonthCalendar: CalendarDefinition = {
				id: 'single',
				name: 'Single Month',
				weekdays: ['Day'],
				months: [{ name: 'Only', days: 100, order: 0 }],
				holidays: []
			};
			const driver = new CalendarDriver(singleMonthCalendar);

			expect(driver.getDate(0).monthName).toBe('Only');
			expect(driver.getDate(50).dayOfMonth).toBe(51);
			expect(driver.getDate(99).dayOfMonth).toBe(100);
			expect(driver.getDate(100).dayOfMonth).toBe(1);
			expect(driver.getDate(100).year).toBe(1);  // Year 1 (0 + 1)
		});

		it('should handle calendar with single weekday', () => {
			const singleWeekdayCalendar: CalendarDefinition = {
				id: 'single-day',
				name: 'Single Weekday',
				weekdays: ['The Day'],
				months: [{ name: 'Month', days: 30, order: 0 }],
				holidays: []
			};
			const driver = new CalendarDriver(singleWeekdayCalendar);

			// All days should be "The Day"
			expect(driver.getDate(0).dayOfWeek).toBe('The Day');
			expect(driver.getDate(100).dayOfWeek).toBe('The Day');
		});

		it('should handle startingYear of 0', () => {
			const zeroYearCalendar: CalendarDefinition = {
				id: 'zero',
				name: 'Zero Start',
				weekdays: [],
				months: [{ name: 'Month', days: 30, order: 0 }],
				holidays: [],
				startingYear: 0
			};
			const driver = new CalendarDriver(zeroYearCalendar);

			expect(driver.getDate(0).year).toBe(0);
			expect(driver.getDate(30).year).toBe(1);
		});

		it('should handle negative startingYear', () => {
			const negativeYearCalendar: CalendarDefinition = {
				id: 'negative',
				name: 'Negative Start',
				weekdays: [],
				months: [{ name: 'Month', days: 30, order: 0 }],
				holidays: [],
				startingYear: -100
			};
			const driver = new CalendarDriver(negativeYearCalendar);

			expect(driver.getDate(0).year).toBe(-100);
			expect(driver.getDate(30).year).toBe(-99);
		});
	});
});
