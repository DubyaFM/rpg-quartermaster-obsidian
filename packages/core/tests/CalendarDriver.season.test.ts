import { describe, it, expect, beforeEach } from 'vitest';
import { CalendarDriver } from '../services/CalendarDriver';
import { CalendarDefinition, Season } from '../models/types';

// ==========================================================================
// Test Fixtures - Calendar Definitions with Seasons
// ==========================================================================

/**
 * Gregorian Calendar with Standard Seasons
 * - Spring: March 20 - June 20
 * - Summer: June 21 - September 22
 * - Fall: September 23 - December 20
 * - Winter: December 21 - March 19 (crosses year boundary)
 */
const GREGORIAN_WITH_SEASONS: CalendarDefinition = {
	id: 'gregorian-seasons',
	name: 'Gregorian Calendar with Seasons',
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
	holidays: [],
	startingYear: 2024,
	yearSuffix: 'AD',
	seasons: [
		{
			name: 'Spring',
			startMonth: 2,  // March (0-indexed)
			startDay: 20,
			sunrise: 6 * 60,  // 6:00 AM
			sunset: 18 * 60   // 6:00 PM
		},
		{
			name: 'Summer',
			startMonth: 5,  // June (0-indexed)
			startDay: 21,
			sunrise: 5 * 60,  // 5:00 AM
			sunset: 20 * 60   // 8:00 PM
		},
		{
			name: 'Fall',
			startMonth: 8,  // September (0-indexed)
			startDay: 23,
			sunrise: 6 * 60 + 30,  // 6:30 AM
			sunset: 18 * 60 + 30   // 6:30 PM
		},
		{
			name: 'Winter',
			startMonth: 11,  // December (0-indexed)
			startDay: 21,
			sunrise: 7 * 60,  // 7:00 AM
			sunset: 17 * 60   // 5:00 PM
		}
	]
};

/**
 * Harptos Calendar with Seasons
 * - Spring: Ches 1 - Mirtul 30 (months 2-4)
 * - Summer: Kythorn 1 - Eleasis 30 (months 5-7)
 * - Fall: Eleint 1 - Uktar 30 (months 8-10)
 * - Winter: Nightal 1 - Alturiak 30 (months 11-1, crosses year)
 */
const HARPTOS_WITH_SEASONS: CalendarDefinition = {
	id: 'harptos-seasons',
	name: 'Calendar of Harptos with Seasons',
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
	holidays: [],
	startingYear: 1492,
	yearSuffix: 'DR',
	seasons: [
		{
			name: 'Spring',
			startMonth: 2,  // Ches
			startDay: 1,
			sunrise: 6 * 60,
			sunset: 18 * 60
		},
		{
			name: 'Summer',
			startMonth: 5,  // Kythorn
			startDay: 1,
			sunrise: 5 * 60,
			sunset: 19 * 60
		},
		{
			name: 'Fall',
			startMonth: 8,  // Eleint
			startDay: 1,
			sunrise: 6 * 60 + 30,
			sunset: 17 * 60 + 30
		},
		{
			name: 'Winter',
			startMonth: 11,  // Nightal
			startDay: 1,
			sunrise: 7 * 60,
			sunset: 17 * 60
		}
	]
};

/**
 * Calendar with Multi-Phase Seasons
 * Tests support for overlapping season names (early/mid/late summer)
 */
const MULTI_PHASE_SEASONS: CalendarDefinition = {
	id: 'multi-phase',
	name: 'Multi-Phase Seasons Calendar',
	weekdays: ['Day'],
	months: [
		{ name: 'Month1', days: 30, order: 0 },
		{ name: 'Month2', days: 30, order: 1 },
		{ name: 'Month3', days: 30, order: 2 },
		{ name: 'Month4', days: 30, order: 3 }
	],
	holidays: [],
	startingYear: 1,
	seasons: [
		{
			name: 'Early Summer',
			startMonth: 0,
			startDay: 1,
			sunrise: 5 * 60,
			sunset: 19 * 60
		},
		{
			name: 'Mid Summer',
			startMonth: 1,
			startDay: 1,
			sunrise: 4 * 60 + 30,
			sunset: 19 * 60 + 30
		},
		{
			name: 'Late Summer',
			startMonth: 2,
			startDay: 1,
			sunrise: 5 * 60,
			sunset: 19 * 60
		},
		{
			name: 'Fall',
			startMonth: 3,
			startDay: 1,
			sunrise: 6 * 60,
			sunset: 18 * 60
		}
	]
};

/**
 * Calendar with No Seasons
 */
const NO_SEASONS_CALENDAR: CalendarDefinition = {
	id: 'no-seasons',
	name: 'Calendar without Seasons',
	weekdays: ['Day'],
	months: [
		{ name: 'Month', days: 30, order: 0 }
	],
	holidays: [],
	startingYear: 1
};

/**
 * Simple Counter Calendar (no months)
 */
const SIMPLE_COUNTER: CalendarDefinition = {
	id: 'simple',
	name: 'Simple Counter',
	weekdays: [],
	months: [],
	holidays: []
};

// ==========================================================================
// Tests
// ==========================================================================

describe('CalendarDriver - Season Calculation', () => {
	describe('getSeason - basic functionality', () => {
		it('should return undefined when no seasons defined', () => {
			const driver = new CalendarDriver(NO_SEASONS_CALENDAR);
			const season = driver.getSeason(0);

			expect(season).toBeUndefined();
		});

		it('should return undefined for simple counter calendar', () => {
			const driver = new CalendarDriver(SIMPLE_COUNTER);
			const season = driver.getSeason(100);

			expect(season).toBeUndefined();
		});

		it('should return a season when seasons are defined', () => {
			const driver = new CalendarDriver(GREGORIAN_WITH_SEASONS);
			const season = driver.getSeason(0);  // January 1

			expect(season).toBeDefined();
			expect(season?.name).toBe('Winter');
		});
	});

	describe('getSeason - Gregorian calendar seasons', () => {
		let driver: CalendarDriver;

		beforeEach(() => {
			driver = new CalendarDriver(GREGORIAN_WITH_SEASONS);
		});

		it('should return Winter for January 1 (Day 0)', () => {
			// January 1 = Day 0
			const season = driver.getSeason(0);

			expect(season?.name).toBe('Winter');
			expect(season?.sunrise).toBe(7 * 60);
			expect(season?.sunset).toBe(17 * 60);
		});

		it('should return Winter for March 19 (last day before Spring)', () => {
			// March 19 = 31 (Jan) + 28 (Feb) + 18 (March 1-19) = Day 77
			const season = driver.getSeason(77);

			expect(season?.name).toBe('Winter');
		});

		it('should return Spring for March 20 (first day of Spring)', () => {
			// March 20 = 31 (Jan) + 28 (Feb) + 19 (March 1-20) = Day 78
			const season = driver.getSeason(78);

			expect(season?.name).toBe('Spring');
			expect(season?.sunrise).toBe(6 * 60);
			expect(season?.sunset).toBe(18 * 60);
		});

		it('should return Spring for June 20 (last day before Summer)', () => {
			// June 20 = 31+28+31+30+31+19 = Day 170
			const season = driver.getSeason(170);

			expect(season?.name).toBe('Spring');
		});

		it('should return Summer for June 21 (first day of Summer)', () => {
			// June 21 = 31+28+31+30+31+20 = Day 171
			const season = driver.getSeason(171);

			expect(season?.name).toBe('Summer');
			expect(season?.sunrise).toBe(5 * 60);
			expect(season?.sunset).toBe(20 * 60);
		});

		it('should return Summer for September 22 (last day before Fall)', () => {
			// September 22 = 31+28+31+30+31+30+31+31+21 = Day 264
			const season = driver.getSeason(264);

			expect(season?.name).toBe('Summer');
		});

		it('should return Fall for September 23 (first day of Fall)', () => {
			// September 23 = 31+28+31+30+31+30+31+31+22 = Day 265
			const season = driver.getSeason(265);

			expect(season?.name).toBe('Fall');
			expect(season?.sunrise).toBe(6 * 60 + 30);
			expect(season?.sunset).toBe(18 * 60 + 30);
		});

		it('should return Fall for December 20 (last day before Winter)', () => {
			// December 20 = 31+28+31+30+31+30+31+31+30+31+30+19 = Day 353
			const season = driver.getSeason(353);

			expect(season?.name).toBe('Fall');
		});

		it('should return Winter for December 21 (first day of Winter)', () => {
			// December 21 = 31+28+31+30+31+30+31+31+30+31+30+20 = Day 354
			const season = driver.getSeason(354);

			expect(season?.name).toBe('Winter');
			expect(season?.sunrise).toBe(7 * 60);
			expect(season?.sunset).toBe(17 * 60);
		});

		it('should return Winter for December 31 (end of year)', () => {
			// December 31 = 31+28+31+30+31+30+31+31+30+31+30+30 = Day 364
			const season = driver.getSeason(364);

			expect(season?.name).toBe('Winter');
		});
	});

	describe('getSeason - Year-crossing seasons', () => {
		let driver: CalendarDriver;

		beforeEach(() => {
			driver = new CalendarDriver(GREGORIAN_WITH_SEASONS);
		});

		it('should handle Winter crossing into next year (January)', () => {
			// Next year's January 1 = Day 365
			const season = driver.getSeason(365);

			expect(season?.name).toBe('Winter');
		});

		it('should handle Winter crossing into next year (February)', () => {
			// Next year's February 15 = Day 365 + 31 + 14 = Day 410
			const season = driver.getSeason(410);

			expect(season?.name).toBe('Winter');
		});

		it('should transition from Winter to Spring in next year', () => {
			// Next year's March 19 = Day 365 + 77 = Day 442
			const winterDay = driver.getSeason(442);
			expect(winterDay?.name).toBe('Winter');

			// Next year's March 20 = Day 365 + 78 = Day 443
			const springDay = driver.getSeason(443);
			expect(springDay?.name).toBe('Spring');
		});

		it('should handle season boundaries across multiple years', () => {
			// Test 3 years into the future
			// Year 3, January 1 = Day 365 * 2 = Day 730
			const season = driver.getSeason(730);

			expect(season?.name).toBe('Winter');
		});
	});

	describe('getSeason - Harptos calendar seasons', () => {
		let driver: CalendarDriver;

		beforeEach(() => {
			driver = new CalendarDriver(HARPTOS_WITH_SEASONS);
		});

		it('should return Winter for Hammer 1 (Day 0)', () => {
			const season = driver.getSeason(0);

			expect(season?.name).toBe('Winter');
		});

		it('should return Winter for Alturiak 30 (last day before Spring)', () => {
			// Alturiak 30 = 30 (Hammer) + 29 (Alturiak 1-30) = Day 59
			const season = driver.getSeason(59);

			expect(season?.name).toBe('Winter');
		});

		it('should return Spring for Ches 1 (first day of Spring)', () => {
			// Ches 1 = 30 (Hammer) + 30 (Alturiak) = Day 60
			const season = driver.getSeason(60);

			expect(season?.name).toBe('Spring');
		});

		it('should return Spring for Mirtul 30 (last day before Summer)', () => {
			// Mirtul 30 = 30+30+30+30+29 = Day 149
			const season = driver.getSeason(149);

			expect(season?.name).toBe('Spring');
		});

		it('should return Summer for Kythorn 1 (first day of Summer)', () => {
			// Kythorn 1 = 30+30+30+30+30 = Day 150
			const season = driver.getSeason(150);

			expect(season?.name).toBe('Summer');
		});

		it('should return Fall for Eleint 1 (first day of Fall)', () => {
			// Eleint 1 = 30*8 = Day 240
			const season = driver.getSeason(240);

			expect(season?.name).toBe('Fall');
		});

		it('should return Winter for Nightal 1 (first day of Winter)', () => {
			// Nightal 1 = 30*11 = Day 330
			const season = driver.getSeason(330);

			expect(season?.name).toBe('Winter');
		});

		it('should handle Winter crossing year boundary', () => {
			// Next year's Hammer 1 = Day 360
			const season = driver.getSeason(360);

			expect(season?.name).toBe('Winter');
		});
	});

	describe('getSeason - Multi-phase seasons', () => {
		let driver: CalendarDriver;

		beforeEach(() => {
			driver = new CalendarDriver(MULTI_PHASE_SEASONS);
		});

		it('should return Early Summer for Month1', () => {
			const season = driver.getSeason(0);

			expect(season?.name).toBe('Early Summer');
			expect(season?.sunrise).toBe(5 * 60);
		});

		it('should transition to Mid Summer on Month2 Day 1', () => {
			const season = driver.getSeason(30);  // Day 30 = Month2 Day 1

			expect(season?.name).toBe('Mid Summer');
			expect(season?.sunrise).toBe(4 * 60 + 30);
		});

		it('should transition to Late Summer on Month3 Day 1', () => {
			const season = driver.getSeason(60);  // Day 60 = Month3 Day 1

			expect(season?.name).toBe('Late Summer');
		});

		it('should transition to Fall on Month4 Day 1', () => {
			const season = driver.getSeason(90);  // Day 90 = Month4 Day 1

			expect(season?.name).toBe('Fall');
		});
	});

	describe('getSeason - Edge cases', () => {
		it('should handle calendar with single season', () => {
			const singleSeasonCal: CalendarDefinition = {
				id: 'single-season',
				name: 'Single Season',
				weekdays: ['Day'],
				months: [
					{ name: 'Month1', days: 30, order: 0 },
					{ name: 'Month2', days: 30, order: 1 }
				],
				holidays: [],
				seasons: [
					{
						name: 'Eternal Summer',
						startMonth: 0,
						startDay: 1,
						sunrise: 6 * 60,
						sunset: 18 * 60
					}
				]
			};

			const driver = new CalendarDriver(singleSeasonCal);

			// All days should be Eternal Summer
			expect(driver.getSeason(0)?.name).toBe('Eternal Summer');
			expect(driver.getSeason(30)?.name).toBe('Eternal Summer');
			expect(driver.getSeason(59)?.name).toBe('Eternal Summer');
			expect(driver.getSeason(60)?.name).toBe('Eternal Summer'); // Next year
		});

		it('should handle seasons with same start month but different days', () => {
			const samMonthSeasons: CalendarDefinition = {
				id: 'same-month-seasons',
				name: 'Same Month Seasons',
				weekdays: ['Day'],
				months: [
					{ name: 'LongMonth', days: 100, order: 0 }
				],
				holidays: [],
				seasons: [
					{
						name: 'Early Period',
						startMonth: 0,
						startDay: 1,
						sunrise: 6 * 60,
						sunset: 18 * 60
					},
					{
						name: 'Mid Period',
						startMonth: 0,
						startDay: 34,
						sunrise: 5 * 60,
						sunset: 19 * 60
					},
					{
						name: 'Late Period',
						startMonth: 0,
						startDay: 67,
						sunrise: 6 * 60,
						sunset: 18 * 60
					}
				]
			};

			const driver = new CalendarDriver(samMonthSeasons);

			expect(driver.getSeason(0)?.name).toBe('Early Period');  // Day 1
			expect(driver.getSeason(33)?.name).toBe('Mid Period');   // Day 34
			expect(driver.getSeason(66)?.name).toBe('Late Period');  // Day 67
		});
	});

	describe('getDefaultSolarTimes', () => {
		it('should return default sunrise/sunset times', () => {
			const driver = new CalendarDriver(NO_SEASONS_CALENDAR);
			const times = driver.getDefaultSolarTimes();

			expect(times.sunrise).toBe(6 * 60);  // 6:00 AM = 360 minutes
			expect(times.sunset).toBe(18 * 60);  // 6:00 PM = 1080 minutes
		});

		it('should return same defaults regardless of calendar', () => {
			const driver1 = new CalendarDriver(GREGORIAN_WITH_SEASONS);
			const driver2 = new CalendarDriver(HARPTOS_WITH_SEASONS);
			const driver3 = new CalendarDriver(SIMPLE_COUNTER);

			expect(driver1.getDefaultSolarTimes()).toEqual(driver2.getDefaultSolarTimes());
			expect(driver2.getDefaultSolarTimes()).toEqual(driver3.getDefaultSolarTimes());
		});
	});

	describe('Season boundaries - precise day calculations', () => {
		let driver: CalendarDriver;

		beforeEach(() => {
			driver = new CalendarDriver(GREGORIAN_WITH_SEASONS);
		});

		it('should handle exact boundary day correctly', () => {
			// March 20 is the first day of Spring
			// We need to verify March 19 vs March 20

			// March 19 = 31 (Jan) + 28 (Feb) + 18 = Day 77
			const winterLast = driver.getSeason(77);
			expect(winterLast?.name).toBe('Winter');

			// March 20 = 31 (Jan) + 28 (Feb) + 19 = Day 78
			const springFirst = driver.getSeason(78);
			expect(springFirst?.name).toBe('Spring');
		});

		it('should handle mid-month season start', () => {
			// December 21 starts Winter
			// December 20 = Day 353 (should be Fall)
			// December 21 = Day 354 (should be Winter)

			const fallLast = driver.getSeason(353);
			expect(fallLast?.name).toBe('Fall');

			const winterFirst = driver.getSeason(354);
			expect(winterFirst?.name).toBe('Winter');
		});
	});

	describe('Season persistence across years', () => {
		it('should maintain correct seasons across 10 years', () => {
			const driver = new CalendarDriver(GREGORIAN_WITH_SEASONS);

			// Test the same calendar date across multiple years
			for (let year = 0; year < 10; year++) {
				const yearOffset = year * 365;

				// Summer (July 4 = Day 31+28+31+30+31+30+3 = Day 184)
				const summerDay = yearOffset + 184;
				expect(driver.getSeason(summerDay)?.name).toBe('Summer');

				// Winter (January 15 = Day 14)
				const winterDay = yearOffset + 14;
				expect(driver.getSeason(winterDay)?.name).toBe('Winter');
			}
		});
	});
});
