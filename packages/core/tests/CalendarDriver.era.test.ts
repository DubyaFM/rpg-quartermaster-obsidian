import { describe, it, expect, beforeEach } from 'vitest';
import { CalendarDriver } from '../services/CalendarDriver';
import { CalendarDefinition, Era } from '../models/types';

// ==========================================================================
// Test Fixtures - Calendar Definitions with Eras
// ==========================================================================

/**
 * Forgotten Realms calendar with Dalereckoning eras
 * - DR (Dalereckoning): year 1 onwards (counting forward)
 * - BD (Before Dalereckoning): year 0 and earlier (counting backward)
 */
const HARPTOS_WITH_ERAS: CalendarDefinition = {
	id: 'harptos-eras',
	name: 'Calendar of Harptos with Eras',
	description: 'Faerûn calendar with DR/BD eras',
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
	yearSuffix: 'DR',  // Legacy suffix, should be overridden by eras
	eras: [
		{
			name: 'Before Dalereckoning',
			abbrev: 'BD',
			startYear: -Infinity,  // All years before 1
			endYear: 1,
			direction: -1  // Count backward
		},
		{
			name: 'Dalereckoning',
			abbrev: 'DR',
			startYear: 1,
			endYear: undefined,  // Current era, no end
			direction: 1  // Count forward
		}
	]
};

/**
 * Gregorian calendar with BC/AD eras
 */
const GREGORIAN_WITH_ERAS: CalendarDefinition = {
	id: 'gregorian-eras',
	name: 'Gregorian Calendar with BC/AD',
	description: 'Real-world calendar with BC/AD eras',
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
	yearSuffix: 'AD',  // Legacy suffix
	eras: [
		{
			name: 'Before Christ',
			abbrev: 'BC',
			startYear: -Infinity,
			endYear: 1,
			direction: -1
		},
		{
			name: 'Anno Domini',
			abbrev: 'AD',
			startYear: 1,
			endYear: undefined,
			direction: 1
		}
	]
};

/**
 * Calendar with multiple historical eras
 */
const MULTI_ERA_CALENDAR: CalendarDefinition = {
	id: 'multi-era',
	name: 'Multi-Era Calendar',
	description: 'Calendar with three distinct eras',
	weekdays: ['Day1', 'Day2', 'Day3'],
	months: [
		{ name: 'Month1', days: 30, order: 0 },
		{ name: 'Month2', days: 30, order: 1 }
	],
	holidays: [],
	startingYear: 500,
	eras: [
		{
			name: 'Ancient Era',
			abbrev: 'AE',
			startYear: -Infinity,
			endYear: 0,
			direction: -1
		},
		{
			name: 'Classical Era',
			abbrev: 'CE',
			startYear: 0,
			endYear: 1000,
			direction: 1
		},
		{
			name: 'Modern Era',
			abbrev: 'ME',
			startYear: 1000,
			endYear: undefined,
			direction: 1
		}
	]
};

/**
 * Calendar with no eras (legacy mode)
 */
const NO_ERAS_CALENDAR: CalendarDefinition = {
	id: 'no-eras',
	name: 'Legacy Calendar',
	description: 'Calendar without era support',
	weekdays: ['Day'],
	months: [{ name: 'Month', days: 30, order: 0 }],
	holidays: [],
	startingYear: 1,
	yearSuffix: 'YR'  // Should use this when no eras defined
};

// ==========================================================================
// Tests
// ==========================================================================

describe('CalendarDriver - Era Support', () => {
	describe('getEra() method', () => {
		it('should return correct era for positive year', () => {
			const driver = new CalendarDriver(HARPTOS_WITH_ERAS);
			const era = driver.getEra(1492);

			expect(era).toBeDefined();
			expect(era?.name).toBe('Dalereckoning');
			expect(era?.abbrev).toBe('DR');
			expect(era?.direction).toBe(1);
		});

		it('should return correct era for negative year', () => {
			const driver = new CalendarDriver(HARPTOS_WITH_ERAS);
			const era = driver.getEra(-700);

			expect(era).toBeDefined();
			expect(era?.name).toBe('Before Dalereckoning');
			expect(era?.abbrev).toBe('BD');
			expect(era?.direction).toBe(-1);
		});

		it('should return correct era for year 0', () => {
			const driver = new CalendarDriver(HARPTOS_WITH_ERAS);
			const era = driver.getEra(0);

			expect(era).toBeDefined();
			expect(era?.name).toBe('Before Dalereckoning');
			expect(era?.abbrev).toBe('BD');
		});

		it('should return correct era for year 1 (era boundary)', () => {
			const driver = new CalendarDriver(HARPTOS_WITH_ERAS);
			const era = driver.getEra(1);

			expect(era).toBeDefined();
			expect(era?.name).toBe('Dalereckoning');
			expect(era?.abbrev).toBe('DR');
		});

		it('should return undefined when no eras defined', () => {
			const driver = new CalendarDriver(NO_ERAS_CALENDAR);
			const era = driver.getEra(100);

			expect(era).toBeUndefined();
		});

		it('should handle multiple eras with boundaries', () => {
			const driver = new CalendarDriver(MULTI_ERA_CALENDAR);

			const ancient = driver.getEra(-500);
			expect(ancient?.abbrev).toBe('AE');

			const classical = driver.getEra(500);
			expect(classical?.abbrev).toBe('CE');

			const modern = driver.getEra(1500);
			expect(modern?.abbrev).toBe('ME');
		});

		it('should handle era boundary transitions', () => {
			const driver = new CalendarDriver(MULTI_ERA_CALENDAR);

			// Last year of Ancient Era
			expect(driver.getEra(-1)?.abbrev).toBe('AE');

			// First year of Classical Era
			expect(driver.getEra(0)?.abbrev).toBe('CE');

			// Last year of Classical Era
			expect(driver.getEra(999)?.abbrev).toBe('CE');

			// First year of Modern Era
			expect(driver.getEra(1000)?.abbrev).toBe('ME');
		});
	});

	describe('era suffix in formatted dates', () => {
		it('should apply DR suffix for positive years', () => {
			const driver = new CalendarDriver(HARPTOS_WITH_ERAS);
			const date = driver.getDate(0);  // Day 0 = 1st Hammer 1492 DR

			expect(date.year).toBe(1492);
			expect(date.yearSuffix).toBe('DR');
		});

		it('should apply BD suffix for negative years', () => {
			const driver = new CalendarDriver(HARPTOS_WITH_ERAS);
			// Create driver with origin in negative years
			const origin = { year: -700, month: 0, day: 1 };
			const driverNegative = new CalendarDriver(HARPTOS_WITH_ERAS, origin);

			const date = driverNegative.getDate(0);  // Day 0 = 1st Hammer -700 BD

			expect(date.year).toBe(-700);
			expect(date.yearSuffix).toBe('BD');
		});

		it('should handle year 0 correctly', () => {
			const driver = new CalendarDriver(HARPTOS_WITH_ERAS);
			const origin = { year: 0, month: 0, day: 1 };
			const driverZero = new CalendarDriver(HARPTOS_WITH_ERAS, origin);

			const date = driverZero.getDate(0);

			expect(date.year).toBe(0);
			expect(date.yearSuffix).toBe('BD');
		});

		it('should use legacy yearSuffix when no eras defined', () => {
			const driver = new CalendarDriver(NO_ERAS_CALENDAR);
			const date = driver.getDate(0);

			expect(date.yearSuffix).toBe('YR');
		});

		it('should prefer era suffix over legacy yearSuffix', () => {
			const driver = new CalendarDriver(HARPTOS_WITH_ERAS);
			const date = driver.getDate(0);

			// Calendar has yearSuffix: 'DR', but eras should override
			expect(date.yearSuffix).toBe('DR');  // From era, not legacy
		});

		it('should apply correct suffix across era boundaries', () => {
			const driver = new CalendarDriver(MULTI_ERA_CALENDAR);

			// Ancient Era
			const origin1 = { year: -500, month: 0, day: 1 };
			const driver1 = new CalendarDriver(MULTI_ERA_CALENDAR, origin1);
			expect(driver1.getDate(0).yearSuffix).toBe('AE');

			// Classical Era
			const origin2 = { year: 500, month: 0, day: 1 };
			const driver2 = new CalendarDriver(MULTI_ERA_CALENDAR, origin2);
			expect(driver2.getDate(0).yearSuffix).toBe('CE');

			// Modern Era
			const origin3 = { year: 1500, month: 0, day: 1 };
			const driver3 = new CalendarDriver(MULTI_ERA_CALENDAR, origin3);
			expect(driver3.getDate(0).yearSuffix).toBe('ME');
		});
	});

	describe('negative year display', () => {
		it('should handle negative years with backward-counting era', () => {
			const driver = new CalendarDriver(HARPTOS_WITH_ERAS);
			const origin = { year: -700, month: 0, day: 1 };
			const driverNegative = new CalendarDriver(HARPTOS_WITH_ERAS, origin);

			const date = driverNegative.getDate(0);

			expect(date.year).toBe(-700);
			expect(date.yearSuffix).toBe('BD');

			// The year value is negative (-700)
			// Display formatting (e.g., "700 BD") would be handled by UI layer
			// CalendarDriver returns raw values
		});

		it('should handle large negative years', () => {
			const driver = new CalendarDriver(HARPTOS_WITH_ERAS);
			const origin = { year: -10000, month: 0, day: 1 };
			const driverNegative = new CalendarDriver(HARPTOS_WITH_ERAS, origin);

			const date = driverNegative.getDate(0);

			expect(date.year).toBe(-10000);
			expect(date.yearSuffix).toBe('BD');
		});

		it('should handle transition from negative to positive years', () => {
			const driver = new CalendarDriver(HARPTOS_WITH_ERAS);
			const origin = { year: -2, month: 0, day: 1 };
			const driverTransition = new CalendarDriver(HARPTOS_WITH_ERAS, origin);

			// 60 days per year (2 months * 30 days)
			const yearNeg2 = driverTransition.getDate(0);
			expect(yearNeg2.year).toBe(-2);
			expect(yearNeg2.yearSuffix).toBe('BD');

			const yearNeg1 = driverTransition.getDate(720);  // 2 years later (360 days/year * 2)
			expect(yearNeg1.year).toBe(0);
			expect(yearNeg1.yearSuffix).toBe('BD');

			const year1 = driverTransition.getDate(1080);  // 3 years later
			expect(year1.year).toBe(1);
			expect(year1.yearSuffix).toBe('DR');
		});
	});

	describe('direction support', () => {
		it('should store direction value correctly', () => {
			const driver = new CalendarDriver(HARPTOS_WITH_ERAS);

			const drEra = driver.getEra(1492);
			expect(drEra?.direction).toBe(1);  // Forward counting

			const bdEra = driver.getEra(-700);
			expect(bdEra?.direction).toBe(-1);  // Backward counting
		});

		it('should handle era with direction: 1 (forward)', () => {
			const driver = new CalendarDriver(GREGORIAN_WITH_ERAS);
			const era = driver.getEra(2024);

			expect(era?.direction).toBe(1);
			expect(era?.abbrev).toBe('AD');
		});

		it('should handle era with direction: -1 (backward)', () => {
			const driver = new CalendarDriver(GREGORIAN_WITH_ERAS);
			const era = driver.getEra(-500);

			expect(era?.direction).toBe(-1);
			expect(era?.abbrev).toBe('BC');
		});
	});

	describe('edge cases', () => {
		it('should handle calendar with empty eras array', () => {
			const emptyErasCalendar: CalendarDefinition = {
				...NO_ERAS_CALENDAR,
				eras: []
			};
			const driver = new CalendarDriver(emptyErasCalendar);

			expect(driver.getEra(100)).toBeUndefined();
			expect(driver.getDate(0).yearSuffix).toBe('YR');  // Falls back to legacy
		});

		it('should handle very large positive years', () => {
			const driver = new CalendarDriver(HARPTOS_WITH_ERAS);
			const origin = { year: 1000000, month: 0, day: 1 };
			const driverLarge = new CalendarDriver(HARPTOS_WITH_ERAS, origin);

			const date = driverLarge.getDate(0);

			expect(date.year).toBe(1000000);
			expect(date.yearSuffix).toBe('DR');
		});

		it('should handle very large negative years', () => {
			const driver = new CalendarDriver(HARPTOS_WITH_ERAS);
			const origin = { year: -1000000, month: 0, day: 1 };
			const driverLarge = new CalendarDriver(HARPTOS_WITH_ERAS, origin);

			const date = driverLarge.getDate(0);

			expect(date.year).toBe(-1000000);
			expect(date.yearSuffix).toBe('BD');
		});

		it('should handle era with no endYear (current era)', () => {
			const driver = new CalendarDriver(HARPTOS_WITH_ERAS);
			const era = driver.getEra(999999);

			expect(era).toBeDefined();
			expect(era?.abbrev).toBe('DR');
			expect(era?.endYear).toBeUndefined();
		});
	});

	describe('simple counter mode with eras', () => {
		it('should use era suffix for year 0 in simple counter mode', () => {
			const simpleWithEras: CalendarDefinition = {
				id: 'simple-eras',
				name: 'Simple Counter with Eras',
				weekdays: [],
				months: [],
				holidays: [],
				eras: [
					{
						name: 'Test Era',
						abbrev: 'TE',
						startYear: -Infinity,
						endYear: undefined,
						direction: 1
					}
				]
			};
			const driver = new CalendarDriver(simpleWithEras);
			const date = driver.getDate(100);

			expect(date.isSimpleCounter).toBe(true);
			expect(date.year).toBe(0);
			expect(date.yearSuffix).toBe('TE');
		});

		it('should fall back to legacy suffix in simple counter mode', () => {
			const simpleLegacy: CalendarDefinition = {
				id: 'simple-legacy',
				name: 'Simple Counter Legacy',
				weekdays: [],
				months: [],
				holidays: [],
				yearSuffix: 'SC'
			};
			const driver = new CalendarDriver(simpleLegacy);
			const date = driver.getDate(100);

			expect(date.yearSuffix).toBe('SC');
		});
	});
});
