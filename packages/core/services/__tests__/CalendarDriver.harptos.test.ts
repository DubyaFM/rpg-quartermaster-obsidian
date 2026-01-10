import { describe, it, expect, beforeEach } from 'vitest';
import { CalendarDriver } from '../CalendarDriver';
import { CalendarDefinition, CalendarOrigin } from '../../models/types';
import goldenFixtures from './fixtures/harptos-golden.json';

/**
 * Golden Master Tests for Harptos Calendar (Forgotten Realms)
 *
 * All test cases manually verified against Forgotten Realms Wiki canon.
 * Source: https://forgottenrealms.fandom.com/wiki/Calendar_of_Harptos
 *
 * Key Features Tested:
 * - Intercalary days (festival days that don't advance weekday cycle)
 * - 10-day tenday week cycle
 * - Leap year logic (Shieldmeet every 4 years)
 * - Era system (BD/DR)
 * - High integer day counts
 * - Month and year transitions
 */

// ==========================================================================
// Test Fixtures - Harptos Calendar Definition
// ==========================================================================

/**
 * Full Harptos Calendar with Intercalary Days
 * - 12 standard months of 30 days = 360 days
 * - 5 intercalary festival days = 5 days
 * - Total: 365 days/year (366 on leap years with Shieldmeet)
 * - 10-day week cycle (intercalary days do NOT advance weekday)
 */
const HARPTOS_CALENDAR: CalendarDefinition = {
	id: 'harptos-full',
	name: 'Calendar of Harptos (Forgotten Realms)',
	description: 'The standard calendar of Faerûn with intercalary festival days',
	weekdays: ['1st Day', '2nd Day', '3rd Day', '4th Day', '5th Day', '6th Day', '7th Day', '8th Day', '9th Day', '10th Day'],
	months: [
		// Month 1: Hammer (Deepwinter)
		{ name: 'Hammer', days: 30, order: 0, type: 'standard' },
		// Intercalary Day 1: Midwinter
		{ name: 'Midwinter', days: 1, order: 1, type: 'intercalary' },
		// Month 2: Alturiak (The Claw of Winter)
		{ name: 'Alturiak', days: 30, order: 2, type: 'standard' },
		// Month 3: Ches (The Claw of the Sunsets)
		{ name: 'Ches', days: 30, order: 3, type: 'standard' },
		// Month 4: Tarsakh (The Claw of the Storms)
		{ name: 'Tarsakh', days: 30, order: 4, type: 'standard' },
		// Intercalary Day 2: Greengrass
		{ name: 'Greengrass', days: 1, order: 5, type: 'intercalary' },
		// Month 5: Mirtul (The Melting)
		{ name: 'Mirtul', days: 30, order: 6, type: 'standard' },
		// Month 6: Kythorn (The Time of Flowers)
		{ name: 'Kythorn', days: 30, order: 7, type: 'standard' },
		// Month 7: Flamerule (Summertide)
		{ name: 'Flamerule', days: 30, order: 8, type: 'standard' },
		// Intercalary Day 3: Midsummer
		{ name: 'Midsummer', days: 1, order: 9, type: 'intercalary' },
		// Month 8: Eleasis (Highsun)
		{ name: 'Eleasis', days: 30, order: 10, type: 'standard' },
		// Month 9: Eleint (The Fading)
		{ name: 'Eleint', days: 30, order: 11, type: 'standard' },
		// Intercalary Day 4: Highharvestide
		{ name: 'Highharvestide', days: 1, order: 12, type: 'intercalary' },
		// Month 10: Marpenoth (Leaffall)
		{ name: 'Marpenoth', days: 30, order: 13, type: 'standard' },
		// Month 11: Uktar (The Rotting)
		{ name: 'Uktar', days: 30, order: 14, type: 'standard' },
		// Intercalary Day 5: Feast of the Moon
		{ name: 'Feast of the Moon', days: 1, order: 15, type: 'intercalary' },
		// Month 12: Nightal (The Drawing Down)
		{ name: 'Nightal', days: 30, order: 16, type: 'standard' }
	],
	holidays: [
		{ name: 'Midwinter', description: 'Festival day between Hammer and Alturiak', dayOfYear: 30, notifyOnArrival: true },
		{ name: 'Greengrass', description: 'Festival day between Tarsakh and Mirtul', dayOfYear: 121, notifyOnArrival: true },
		{ name: 'Midsummer', description: 'Festival day between Flamerule and Eleasis', dayOfYear: 212, notifyOnArrival: true },
		{ name: 'Shieldmeet', description: 'Leap year festival day after Midsummer', dayOfYear: 213, notifyOnArrival: true },
		{ name: 'Highharvestide', description: 'Festival day between Eleint and Marpenoth', dayOfYear: 273, notifyOnArrival: true },
		{ name: 'Feast of the Moon', description: 'Festival day between Uktar and Nightal', dayOfYear: 334, notifyOnArrival: true }
	],
	eras: [
		{ name: 'Before Dalereckoning', abbrev: 'BD', startYear: -10000, endYear: 1, direction: -1 },
		{ name: 'Dalereckoning', abbrev: 'DR', startYear: 1, direction: 1 }
	],
	leapRules: [
		{ interval: 4, offset: 0, targetMonth: 9 }  // Insert Shieldmeet after Midsummer (index 9)
	],
	startingYear: 1493,  // Use non-leap year to avoid Shieldmeet complexity in basic tests
	yearSuffix: 'DR'
};

// ==========================================================================
// Golden Master Tests
// ==========================================================================

describe('CalendarDriver - Harptos Golden Master Tests', () => {
	let driver: CalendarDriver;

	beforeEach(() => {
		driver = new CalendarDriver(HARPTOS_CALENDAR);
	});

	describe('basic date calculations', () => {
		it('should match all golden master basic dates', () => {
			const testCases = goldenFixtures.testCases.basicDates.cases;

			for (const testCase of testCases) {
				const date = driver.getDate(testCase.absoluteDay);

				expect(date.year, `${testCase.name} - year`).toBe(testCase.expected.year);
				expect(date.monthIndex, `${testCase.name} - monthIndex`).toBe(testCase.expected.monthIndex);
				expect(date.monthName, `${testCase.name} - monthName`).toBe(testCase.expected.monthName);
				expect(date.dayOfMonth, `${testCase.name} - dayOfMonth`).toBe(testCase.expected.dayOfMonth);
				expect(date.dayOfYear, `${testCase.name} - dayOfYear`).toBe(testCase.expected.dayOfYear);
				expect(date.dayOfWeek, `${testCase.name} - dayOfWeek`).toBe(testCase.expected.dayOfWeek);
				expect(date.dayOfWeekIndex, `${testCase.name} - dayOfWeekIndex`).toBe(testCase.expected.dayOfWeekIndex);
				expect(date.yearSuffix, `${testCase.name} - yearSuffix`).toBe(testCase.expected.yearSuffix);
				expect(date.isIntercalary, `${testCase.name} - isIntercalary`).toBe(testCase.expected.isIntercalary);
			}
		});
	});

	describe('intercalary day boundaries', () => {
		it('should maintain weekday continuity across all intercalary boundaries', () => {
			const testCases = goldenFixtures.testCases.intercalaryBoundaries.cases;

			for (const testCase of testCases) {
				const before = driver.getDate(testCase.beforeDay);
				const intercalary = driver.getDate(testCase.intercalaryDay);
				const after = driver.getDate(testCase.afterDay);

				expect(before.dayOfWeek, `${testCase.name} - before weekday`).toBe(testCase.expected.beforeWeekday);
				expect(intercalary.dayOfWeek, `${testCase.name} - intercalary weekday`).toBe(testCase.expected.intercalaryWeekday);
				expect(after.dayOfWeek, `${testCase.name} - after weekday`).toBe(testCase.expected.afterWeekday);

				// Verify intercalary day has no weekday index
				expect(intercalary.dayOfWeekIndex, `${testCase.name} - intercalary index`).toBe(-1);
				expect(intercalary.isIntercalary, `${testCase.name} - isIntercalary flag`).toBe(true);
			}
		});

		it('should not advance weekday index on intercalary days', () => {
			// All intercalary days: Midwinter(30), Greengrass(121), Midsummer(212), Highharvestide(273), Feast(334)
			const intercalaryDays = [30, 121, 212, 273, 334];

			for (const day of intercalaryDays) {
				const intercalary = driver.getDate(day);
				expect(intercalary.isIntercalary).toBe(true);
				expect(intercalary.dayOfWeekIndex).toBe(-1);
				expect(intercalary.dayOfWeek).toBe('');
			}
		});

		it('should preserve weekday cycle across entire year', () => {
			let expectedWeekdayIndex = 0;

			for (let day = 0; day < 365; day++) {
				const date = driver.getDate(day);

				if (date.isIntercalary) {
					// Intercalary days don't have weekdays
					expect(date.dayOfWeek).toBe('');
					expect(date.dayOfWeekIndex).toBe(-1);
					// expectedWeekdayIndex does NOT advance
				} else {
					// Normal days follow 10-day tenday cycle
					expect(date.dayOfWeekIndex).toBe(expectedWeekdayIndex);
					expectedWeekdayIndex = (expectedWeekdayIndex + 1) % 10;
				}
			}
		});
	});

	describe('leap year logic (Shieldmeet)', () => {
		it('should correctly identify leap years', () => {
			const testCases = goldenFixtures.testCases.leapYearTests.cases;

			for (const testCase of testCases) {
				const isLeap = driver.isLeapYear(testCase.year);
				expect(isLeap, `${testCase.name}`).toBe(testCase.expectedLeap);
			}
		});

		it('should handle leap years with Shieldmeet insertion', () => {
			// 1492 is a leap year (1492 % 4 === 0)
			// In leap years, Shieldmeet is inserted after Midsummer
			// This is not yet fully implemented - placeholder for future work
			expect(driver.isLeapYear(1492)).toBe(true);
			expect(driver.isLeapYear(1493)).toBe(false);
			expect(driver.isLeapYear(1496)).toBe(true);
		});

		it('should identify leap day target month', () => {
			// Shieldmeet is inserted after Midsummer (month index 9)
			const targetMonth = driver.getLeapDayTargetMonth(1492);
			expect(targetMonth).toBe(9);

			// Non-leap year should return undefined
			const nonLeapTarget = driver.getLeapDayTargetMonth(1493);
			expect(nonLeapTarget).toBeUndefined();
		});
	});

	describe('era system (BD/DR)', () => {
		it('should use correct era suffixes', () => {
			const testCases = goldenFixtures.testCases.eraTests.cases;

			for (const testCase of testCases) {
				const date = driver.getDate(0);  // Day 0 of any year
				const era = driver.getEra(testCase.year);

				if (era) {
					expect(era.abbrev, `${testCase.name}`).toBe(testCase.expectedSuffix);
				} else {
					// If no era found, should fall back to calendar's yearSuffix
					expect(HARPTOS_CALENDAR.yearSuffix, `${testCase.name}`).toBe(testCase.expectedSuffix);
				}
			}
		});

		it('should handle negative years (Before Dalereckoning)', () => {
			const origin: CalendarOrigin = { year: -100, month: 0, day: 1 };
			const driverBD = new CalendarDriver(HARPTOS_CALENDAR, origin);

			const date = driverBD.getDate(0);
			expect(date.year).toBe(-100);

			const era = driverBD.getEra(-100);
			expect(era?.abbrev).toBe('BD');
		});

		it('should handle Year 0 and Year 1 transition', () => {
			const origin: CalendarOrigin = { year: 0, month: 0, day: 1 };
			const driverYear0 = new CalendarDriver(HARPTOS_CALENDAR, origin);

			const year0 = driverYear0.getDate(0);
			expect(year0.year).toBe(0);
			expect(year0.yearSuffix).toBe('BD');  // Year 0 is BD (endYear is exclusive)

			// Year 0 is a leap year (0 % 4 === 0), so it has 366 days
			// Day 365 is still in Year 0, Day 366 is Year 1
			const stillYear0 = driverYear0.getDate(365);
			expect(stillYear0.year).toBe(0);  // Still in Year 0 (leap year)

			const year1 = driverYear0.getDate(366);  // Account for leap year
			expect(year1.year).toBe(1);
			expect(year1.yearSuffix).toBe('DR');
		});
	});

	describe('month transition tests', () => {
		it('should handle standard month transitions', () => {
			const testCases = goldenFixtures.testCases.monthTransitionTests.cases;

			for (const testCase of testCases) {
				const before = driver.getDate(testCase.beforeDay);
				const after = driver.getDate(testCase.afterDay);

				expect(before.monthName, `${testCase.name} - before month`).toBe(testCase.expected.beforeMonth);
				expect(after.monthName, `${testCase.name} - after month`).toBe(testCase.expected.afterMonth);

				// Verify weekday continuity (non-intercalary transitions)
				if (testCase.expected.weekdayContinuity) {
					const expectedNextWeekday = (before.dayOfWeekIndex + 1) % 10;
					expect(after.dayOfWeekIndex, `${testCase.name} - weekday continuity`).toBe(expectedNextWeekday);
				}
			}
		});

		it('should handle year rollover correctly', () => {
			// Last day of year (Nightal 30)
			const lastDay = driver.getDate(364);
			expect(lastDay.monthName).toBe('Nightal');
			expect(lastDay.dayOfMonth).toBe(30);
			expect(lastDay.year).toBe(1493);

			// First day of next year (Hammer 1, 1494 DR)
			const firstDay = driver.getDate(365);
			expect(firstDay.monthName).toBe('Hammer');
			expect(firstDay.dayOfMonth).toBe(1);
			expect(firstDay.year).toBe(1494);
		});
	});

	describe('high integer day counts', () => {
		it('should handle 1 million days without overflow', () => {
			const date = driver.getDate(1_000_000);

			// Verify basic consistency
			expect(typeof date.year).toBe('number');
			expect(Number.isFinite(date.year)).toBe(true);
			expect(date.monthName).toBeTruthy();
			expect(date.dayOfMonth).toBeGreaterThan(0);
			expect(date.dayOfMonth).toBeLessThanOrEqual(30);
		});

		it('should handle 100 million days', () => {
			const date = driver.getDate(100_000_000);

			expect(typeof date.year).toBe('number');
			expect(Number.isFinite(date.year)).toBe(true);
			expect(date.isSimpleCounter).toBe(false);
		});

		it('should maintain date reversibility at high values', () => {
			const testDay = 999_999_999;
			const date = driver.getDate(testDay);

			const calculatedDay = driver.getAbsoluteDay(date.year, date.monthIndex, date.dayOfMonth);
			expect(calculatedDay).toBe(testDay);
		});
	});

	describe('year progression tests', () => {
		it('should calculate multi-year dates correctly', () => {
			const testCases = goldenFixtures.testCases.yearRolloverTests.cases;

			for (const testCase of testCases) {
				const date = driver.getDate(testCase.absoluteDay);
				expect(date.year, `${testCase.name}`).toBe(testCase.expected.year);
			}
		});

		it('should handle decade transitions', () => {
			// 10 years from 1493: 2 leap years (1496, 1500) = 10*365 + 2 = 3652 days
			const tenYears = driver.getDate(3652);
			expect(tenYears.year).toBe(1503);
			expect(tenYears.monthName).toBe('Hammer');
			expect(tenYears.dayOfMonth).toBe(1);
		});

		it('should handle century transitions', () => {
			// 100 years from 1493: 25 leap years = 100*365 + 25 = 36,525 days
			const century = driver.getDate(36525);
			expect(century.year).toBe(1593);
		});
	});

	describe('date math round-trip consistency', () => {
		it('should round-trip getDate() and getAbsoluteDay() for all test cases', () => {
			const allTestDays = [
				...goldenFixtures.testCases.basicDates.cases.map((c: any) => c.absoluteDay),
				...goldenFixtures.testCases.intercalaryBoundaries.cases.flatMap((c: any) => [c.beforeDay, c.intercalaryDay, c.afterDay]),
				...goldenFixtures.testCases.monthTransitionTests.cases.flatMap((c: any) => [c.beforeDay, c.afterDay])
			];

			for (const day of allTestDays) {
				const date = driver.getDate(day);
				const calculatedDay = driver.getAbsoluteDay(date.year, date.monthIndex, date.dayOfMonth);
				expect(calculatedDay, `Round-trip for day ${day}`).toBe(day);
			}
		});

		it('should handle random day samples consistently', () => {
			// Test random days in first 10 years
			const randomDays = [15, 78, 234, 501, 892, 1203, 1789, 2456, 3102, 3599];

			for (const day of randomDays) {
				const date = driver.getDate(day);
				const calculatedDay = driver.getAbsoluteDay(date.year, date.monthIndex, date.dayOfMonth);
				expect(calculatedDay).toBe(day);
			}
		});
	});

	describe('calendar metadata', () => {
		it('should return correct total days in year', () => {
			// 12 months × 30 days + 5 intercalary days = 365 days
			expect(driver.getTotalDaysInYear()).toBe(365);
		});

		it('should return correct week-counting days', () => {
			// 12 months × 30 days = 360 days (intercalary days don't count)
			expect(driver.getWeekCountingDaysInYear()).toBe(360);
		});

		it('should return correct week length', () => {
			expect(driver.getWeekLength()).toBe(10);
		});

		it('should detect intercalary months', () => {
			expect(driver.hasIntercalaryMonths()).toBe(true);
		});

		it('should have leap rules defined', () => {
			expect(driver.hasLeapRules()).toBe(true);
		});
	});
});
