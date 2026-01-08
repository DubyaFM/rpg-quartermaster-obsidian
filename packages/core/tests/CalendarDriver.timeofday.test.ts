import { describe, it, expect, beforeEach } from 'vitest';
import { CalendarDriver } from '../services/CalendarDriver';
import { CalendarDefinition, Season } from '../models/types';

// ==========================================================================
// Test Fixtures - Calendar with Seasons
// ==========================================================================

/**
 * Calendar with seasonal definitions for sun state testing
 * Simulates a year with varying daylight hours across seasons
 */
const SEASONAL_CALENDAR: CalendarDefinition = {
	id: 'seasonal',
	name: 'Seasonal Calendar',
	description: 'Calendar with defined seasons for daylight testing',
	weekdays: ['Day1', 'Day2', 'Day3', 'Day4', 'Day5'],
	months: [
		{ name: 'Winter Month', days: 90, order: 0 },  // Days 0-89
		{ name: 'Spring Month', days: 90, order: 1 },  // Days 90-179
		{ name: 'Summer Month', days: 90, order: 2 },  // Days 180-269
		{ name: 'Autumn Month', days: 90, order: 3 }   // Days 270-359
	],
	holidays: [],
	startingYear: 1,
	yearSuffix: '',
	seasons: [
		{
			name: 'Winter',
			startMonth: 0,
			startDay: 1,
			sunrise: 8 * 60,   // 8:00 AM = 480 minutes
			sunset: 16 * 60    // 4:00 PM = 960 minutes
		},
		{
			name: 'Spring',
			startMonth: 1,
			startDay: 1,
			sunrise: 6 * 60,   // 6:00 AM = 360 minutes
			sunset: 18 * 60    // 6:00 PM = 1080 minutes
		},
		{
			name: 'Summer',
			startMonth: 2,
			startDay: 1,
			sunrise: 5 * 60,   // 5:00 AM = 300 minutes
			sunset: 19 * 60    // 7:00 PM = 1140 minutes
		},
		{
			name: 'Autumn',
			startMonth: 3,
			startDay: 1,
			sunrise: 7 * 60,   // 7:00 AM = 420 minutes
			sunset: 17 * 60    // 5:00 PM = 1020 minutes
		}
	]
};

/**
 * Simple calendar without seasons for default behavior testing
 */
const NO_SEASON_CALENDAR: CalendarDefinition = {
	id: 'no-season',
	name: 'No Season Calendar',
	description: 'Calendar without season definitions',
	weekdays: ['Day'],
	months: [
		{ name: 'Month', days: 30, order: 0 }
	],
	holidays: [],
	startingYear: 1,
	yearSuffix: ''
};

// ==========================================================================
// Time of Day Tests
// ==========================================================================

describe('CalendarDriver - Time of Day', () => {
	describe('getTimeOfDay and setTimeOfDay', () => {
		let driver: CalendarDriver;

		beforeEach(() => {
			driver = new CalendarDriver(SEASONAL_CALENDAR);
		});

		it('should initialize with time 0 (midnight)', () => {
			expect(driver.getTimeOfDay()).toBe(0);
		});

		it('should set time of day correctly', () => {
			driver.setTimeOfDay(720); // 12:00 PM
			expect(driver.getTimeOfDay()).toBe(720);
		});

		it('should clamp time of day to valid range (max 1439)', () => {
			driver.setTimeOfDay(1500);
			expect(driver.getTimeOfDay()).toBe(1439);
		});

		it('should clamp time of day to valid range (min 0)', () => {
			driver.setTimeOfDay(-100);
			expect(driver.getTimeOfDay()).toBe(0);
		});

		it('should floor fractional minutes', () => {
			driver.setTimeOfDay(720.7);
			expect(driver.getTimeOfDay()).toBe(720);
		});

		it('should handle boundary values', () => {
			driver.setTimeOfDay(0);
			expect(driver.getTimeOfDay()).toBe(0);

			driver.setTimeOfDay(1439);
			expect(driver.getTimeOfDay()).toBe(1439);
		});
	});

	describe('advanceTime', () => {
		let driver: CalendarDriver;

		beforeEach(() => {
			driver = new CalendarDriver(SEASONAL_CALENDAR);
		});

		it('should advance time within same day', () => {
			driver.setTimeOfDay(60); // 1:00 AM
			const daysRolled = driver.advanceTime(120); // Add 2 hours

			expect(daysRolled).toBe(0);
			expect(driver.getTimeOfDay()).toBe(180); // 3:00 AM
		});

		it('should handle single day rollover', () => {
			driver.setTimeOfDay(1400); // 11:20 PM
			const daysRolled = driver.advanceTime(100); // Add 1 hour 40 minutes

			expect(daysRolled).toBe(1);
			expect(driver.getTimeOfDay()).toBe(60); // 1:00 AM next day
		});

		it('should handle multiple day rollover', () => {
			driver.setTimeOfDay(1000);
			const daysRolled = driver.advanceTime(3000); // ~2 days

			expect(daysRolled).toBe(2);
			expect(driver.getTimeOfDay()).toBe(1000 + 3000 - (2 * 1440)); // 1120 minutes
		});

		it('should handle exact day boundary', () => {
			driver.setTimeOfDay(0);
			const daysRolled = driver.advanceTime(1440); // Exactly 1 day

			expect(daysRolled).toBe(1);
			expect(driver.getTimeOfDay()).toBe(0); // Back to midnight
		});

		it('should handle zero minute advancement', () => {
			driver.setTimeOfDay(500);
			const daysRolled = driver.advanceTime(0);

			expect(daysRolled).toBe(0);
			expect(driver.getTimeOfDay()).toBe(500);
		});

		it('should throw error for negative minutes', () => {
			expect(() => driver.advanceTime(-10)).toThrow('Cannot advance time by negative minutes');
		});

		it('should handle large time advances', () => {
			driver.setTimeOfDay(0);
			const daysRolled = driver.advanceTime(10000); // ~7 days

			expect(daysRolled).toBe(6);
			expect(driver.getTimeOfDay()).toBe(1360); // 10000 % 1440 = 1360
		});

		it('should maintain time precision with repeated advances', () => {
			driver.setTimeOfDay(0);

			// Advance by 1 minute 100 times
			for (let i = 0; i < 100; i++) {
				driver.advanceTime(1);
			}

			expect(driver.getTimeOfDay()).toBe(100);
		});
	});

	describe('getSunrise and getSunset', () => {
		let driver: CalendarDriver;

		beforeEach(() => {
			driver = new CalendarDriver(SEASONAL_CALENDAR);
		});

		it('should get sunrise time from winter season', () => {
			const winterDay = 45; // Middle of winter month
			const sunrise = driver.getSunrise(winterDay);

			expect(sunrise).toBe(8 * 60); // 8:00 AM
		});

		it('should get sunset time from winter season', () => {
			const winterDay = 45;
			const sunset = driver.getSunset(winterDay);

			expect(sunset).toBe(16 * 60); // 4:00 PM
		});

		it('should get sunrise time from summer season', () => {
			const summerDay = 225; // Middle of summer month
			const sunrise = driver.getSunrise(summerDay);

			expect(sunrise).toBe(5 * 60); // 5:00 AM
		});

		it('should get sunset time from summer season', () => {
			const summerDay = 225;
			const sunset = driver.getSunset(summerDay);

			expect(sunset).toBe(19 * 60); // 7:00 PM
		});

		it('should use default times when no seasons defined', () => {
			const noSeasonDriver = new CalendarDriver(NO_SEASON_CALENDAR);
			const sunrise = noSeasonDriver.getSunrise(0);
			const sunset = noSeasonDriver.getSunset(0);

			expect(sunrise).toBe(6 * 60);  // Default 6:00 AM
			expect(sunset).toBe(18 * 60);  // Default 6:00 PM
		});

		it('should handle season transitions correctly', () => {
			// Spring starts at day 90 (month 1, day 1)
			const lastWinterDay = 89;
			const firstSpringDay = 90;

			const winterSunrise = driver.getSunrise(lastWinterDay);
			const springSunrise = driver.getSunrise(firstSpringDay);

			expect(winterSunrise).toBe(8 * 60);
			expect(springSunrise).toBe(6 * 60);
		});
	});

	describe('getSunState', () => {
		let driver: CalendarDriver;

		beforeEach(() => {
			driver = new CalendarDriver(SEASONAL_CALENDAR);
		});

		it('should return "night" before dawn', () => {
			const winterDay = 45;
			// Winter sunrise at 8:00 AM (480), dawn starts at 7:30 AM (450)
			const state = driver.getSunState(winterDay, 400); // 6:40 AM

			expect(state).toBe('night');
		});

		it('should return "dawn" during dawn period', () => {
			const winterDay = 45;
			// Dawn period: 7:30 AM - 8:30 AM (450-510 minutes)
			const state1 = driver.getSunState(winterDay, 450); // 7:30 AM
			const state2 = driver.getSunState(winterDay, 480); // 8:00 AM
			const state3 = driver.getSunState(winterDay, 509); // 8:29 AM

			expect(state1).toBe('dawn');
			expect(state2).toBe('dawn');
			expect(state3).toBe('dawn');
		});

		it('should return "day" during daylight hours', () => {
			const winterDay = 45;
			// Day period: 8:30 AM - 3:30 PM (510-930 minutes)
			const state1 = driver.getSunState(winterDay, 510); // 8:30 AM
			const state2 = driver.getSunState(winterDay, 720); // 12:00 PM
			const state3 = driver.getSunState(winterDay, 929); // 3:29 PM

			expect(state1).toBe('day');
			expect(state2).toBe('day');
			expect(state3).toBe('day');
		});

		it('should return "dusk" during dusk period', () => {
			const winterDay = 45;
			// Sunset at 4:00 PM (960), dusk period: 3:30 PM - 4:30 PM (930-990)
			const state1 = driver.getSunState(winterDay, 930); // 3:30 PM
			const state2 = driver.getSunState(winterDay, 960); // 4:00 PM
			const state3 = driver.getSunState(winterDay, 989); // 4:29 PM

			expect(state1).toBe('dusk');
			expect(state2).toBe('dusk');
			expect(state3).toBe('dusk');
		});

		it('should return "night" after dusk', () => {
			const winterDay = 45;
			// Night starts at 4:30 PM (990)
			const state1 = driver.getSunState(winterDay, 990); // 4:30 PM
			const state2 = driver.getSunState(winterDay, 1200); // 8:00 PM
			const state3 = driver.getSunState(winterDay, 1439); // 11:59 PM

			expect(state1).toBe('night');
			expect(state2).toBe('night');
			expect(state3).toBe('night');
		});

		it('should use current time of day if not provided', () => {
			driver.setTimeOfDay(720); // 12:00 PM (noon)
			const winterDay = 45;

			const state = driver.getSunState(winterDay);

			expect(state).toBe('day');
		});

		it('should handle summer daylight hours correctly', () => {
			const summerDay = 225;
			// Summer: sunrise 5:00 AM (300), sunset 7:00 PM (1140)
			// Dawn: 4:30-5:30 AM (270-330)
			// Day: 5:30 AM - 6:30 PM (330-1110)
			// Dusk: 6:30-7:30 PM (1110-1170)

			const night1 = driver.getSunState(summerDay, 260); // Before dawn
			const dawn = driver.getSunState(summerDay, 300);   // Dawn
			const day = driver.getSunState(summerDay, 720);    // Noon
			const dusk = driver.getSunState(summerDay, 1140);  // Dusk
			const night2 = driver.getSunState(summerDay, 1200); // After dusk

			expect(night1).toBe('night');
			expect(dawn).toBe('dawn');
			expect(day).toBe('day');
			expect(dusk).toBe('dusk');
			expect(night2).toBe('night');
		});

		it('should handle edge case at exact transition boundaries', () => {
			const winterDay = 45;
			// Dawn starts at 450 (sunrise - 30)
			// Dawn ends at 510 (sunrise + 30)
			// Dusk starts at 930 (sunset - 30)
			// Dusk ends at 990 (sunset + 30)

			const beforeDawn = driver.getSunState(winterDay, 449);
			const atDawnStart = driver.getSunState(winterDay, 450);
			const atDawnEnd = driver.getSunState(winterDay, 509);
			const afterDawn = driver.getSunState(winterDay, 510);

			expect(beforeDawn).toBe('night');
			expect(atDawnStart).toBe('dawn');
			expect(atDawnEnd).toBe('dawn');
			expect(afterDawn).toBe('day');
		});
	});

	describe('getLightLevel', () => {
		let driver: CalendarDriver;

		beforeEach(() => {
			driver = new CalendarDriver(SEASONAL_CALENDAR);
		});

		it('should return "dark" during night', () => {
			const winterDay = 45;
			const level1 = driver.getLightLevel(winterDay, 0);    // Midnight
			const level2 = driver.getLightLevel(winterDay, 400);  // Early morning
			const level3 = driver.getLightLevel(winterDay, 1200); // Evening

			expect(level1).toBe('dark');
			expect(level2).toBe('dark');
			expect(level3).toBe('dark');
		});

		it('should return "dim" during dawn', () => {
			const winterDay = 45;
			const level = driver.getLightLevel(winterDay, 480); // Dawn (8:00 AM)

			expect(level).toBe('dim');
		});

		it('should return "bright" during day', () => {
			const winterDay = 45;
			const level = driver.getLightLevel(winterDay, 720); // Noon

			expect(level).toBe('bright');
		});

		it('should return "dim" during dusk', () => {
			const winterDay = 45;
			const level = driver.getLightLevel(winterDay, 960); // Dusk (4:00 PM)

			expect(level).toBe('dim');
		});

		it('should use current time of day if not provided', () => {
			driver.setTimeOfDay(720); // Noon
			const winterDay = 45;

			const level = driver.getLightLevel(winterDay);

			expect(level).toBe('bright');
		});

		it('should vary by season', () => {
			// Winter day at 6:00 AM (360 minutes)
			const winterDay = 45;
			const winterLevel = driver.getLightLevel(winterDay, 360);

			// Summer day at 5:00 AM (300 minutes)
			const summerDay = 225;
			const summerLevel = driver.getLightLevel(summerDay, 300);

			// In winter, 6:00 AM is night (sunrise at 8:00 AM, dawn starts at 7:30 AM)
			// In summer, 5:00 AM is dawn (sunrise at 5:00 AM, dawn period 4:30-5:30 AM)
			expect(winterLevel).toBe('dark');
			expect(summerLevel).toBe('dim');
		});
	});

	describe('edge cases and integration', () => {
		it('should handle time advancement across season boundaries', () => {
			const driver = new CalendarDriver(SEASONAL_CALENDAR);
			const lastWinterDay = 89;

			// Set time to evening
			driver.setTimeOfDay(1200);

			// Get sun state for current season
			const winterState = driver.getSunState(lastWinterDay);
			expect(winterState).toBe('night'); // 8:00 PM in winter

			// Same time on first spring day
			const firstSpringDay = 90;
			const springState = driver.getSunState(firstSpringDay);
			expect(springState).toBe('night'); // 8:00 PM in spring (sunset at 6:00 PM)
		});

		it('should handle very early morning times (near midnight)', () => {
			const driver = new CalendarDriver(SEASONAL_CALENDAR);
			const winterDay = 45;

			const state1 = driver.getSunState(winterDay, 0);   // Midnight
			const state2 = driver.getSunState(winterDay, 1);   // 12:01 AM
			const state3 = driver.getSunState(winterDay, 60);  // 1:00 AM

			expect(state1).toBe('night');
			expect(state2).toBe('night');
			expect(state3).toBe('night');
		});

		it('should handle very late evening times (near midnight)', () => {
			const driver = new CalendarDriver(SEASONAL_CALENDAR);
			const winterDay = 45;

			const state1 = driver.getSunState(winterDay, 1380); // 11:00 PM
			const state2 = driver.getSunState(winterDay, 1438); // 11:58 PM
			const state3 = driver.getSunState(winterDay, 1439); // 11:59 PM

			expect(state1).toBe('night');
			expect(state2).toBe('night');
			expect(state3).toBe('night');
		});

		it('should handle calendar without seasons gracefully', () => {
			const driver = new CalendarDriver(NO_SEASON_CALENDAR);

			// Should use default times (6:00 AM - 6:00 PM)
			const sunrise = driver.getSunrise(0);
			const sunset = driver.getSunset(0);

			expect(sunrise).toBe(6 * 60);
			expect(sunset).toBe(18 * 60);

			// Dawn: 5:30-6:30 AM (330-390)
			// Day: 6:30 AM - 5:30 PM (390-1050)
			// Dusk: 5:30-6:30 PM (1050-1110)

			expect(driver.getSunState(0, 300)).toBe('night');  // 5:00 AM
			expect(driver.getSunState(0, 360)).toBe('dawn');   // 6:00 AM
			expect(driver.getSunState(0, 720)).toBe('day');    // Noon
			expect(driver.getSunState(0, 1080)).toBe('dusk');  // 6:00 PM
			expect(driver.getSunState(0, 1200)).toBe('night'); // 8:00 PM
		});

		it('should maintain time state across multiple operations', () => {
			const driver = new CalendarDriver(SEASONAL_CALENDAR);
			const winterDay = 45;

			// Start at midnight
			driver.setTimeOfDay(0);
			expect(driver.getSunState(winterDay)).toBe('night');

			// Advance to dawn (8:00 AM = 480 minutes)
			driver.advanceTime(480); // 0 + 480 = 480 (8:00 AM)
			expect(driver.getSunState(winterDay)).toBe('dawn');

			// Advance to day (9:00 AM = 540 minutes)
			driver.advanceTime(60); // 480 + 60 = 540 (9:00 AM)
			expect(driver.getSunState(winterDay)).toBe('day');

			// Advance to dusk (4:00 PM = 960 minutes)
			// Winter sunset at 4:00 PM (960), dusk period 3:30-4:30 PM (930-990)
			driver.advanceTime(420); // 540 + 420 = 960 (4:00 PM)
			expect(driver.getSunState(winterDay)).toBe('dusk');

			// Advance to night (5:00 PM = 1020 minutes)
			driver.advanceTime(60); // 960 + 60 = 1020 (5:00 PM, past dusk end at 4:30 PM)
			expect(driver.getSunState(winterDay)).toBe('night');
		});
	});
});
