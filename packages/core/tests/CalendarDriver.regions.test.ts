import { describe, it, expect, beforeEach } from 'vitest';
import { CalendarDriver } from '../services/CalendarDriver';
import { CalendarDefinition, Season } from '../models/types';

/**
 * Regional Solar Overrides Tests (TKT-CAL-015)
 *
 * Tests the CalendarDriver's ability to handle regional sunrise/sunset overrides
 * for different latitudes (e.g., polar regions with midnight sun).
 *
 * Features tested:
 * - Region tags on seasons
 * - getSolarTimes with region context
 * - Fallback to standard season times when no region specified
 * - Multiple regions in same calendar
 * - Edge cases (polar midnight sun, tropical consistency)
 */

// ==========================================================================
// Test Fixtures - Calendar with Regional Seasons
// ==========================================================================

/**
 * Calendar with region-specific solar times
 * - Temperate region: standard sunrise/sunset variation
 * - Polar region: extreme variation (midnight sun in summer, polar night in winter)
 * - Tropical region: minimal variation year-round
 */
const CALENDAR_WITH_REGIONS: CalendarDefinition = {
	id: 'regional-calendar',
	name: 'Calendar with Regional Overrides',
	description: 'Calendar supporting multiple climate regions',
	weekdays: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5'],
	months: [
		{ name: 'Winter Month', days: 30, order: 0 },
		{ name: 'Spring Month', days: 30, order: 1 },
		{ name: 'Summer Month', days: 30, order: 2 },
		{ name: 'Fall Month', days: 30, order: 3 }
	],
	holidays: [],
	startingYear: 2024,
	seasons: [
		// Temperate region (default/standard) - moderate variation
		{
			name: 'Winter',
			startMonth: 0,
			startDay: 1,
			sunrise: 8 * 60,  // 8:00 AM
			sunset: 16 * 60   // 4:00 PM
		},
		{
			name: 'Spring',
			startMonth: 1,
			startDay: 1,
			sunrise: 6 * 60,  // 6:00 AM
			sunset: 18 * 60   // 6:00 PM
		},
		{
			name: 'Summer',
			startMonth: 2,
			startDay: 1,
			sunrise: 5 * 60,  // 5:00 AM
			sunset: 20 * 60   // 8:00 PM
		},
		{
			name: 'Fall',
			startMonth: 3,
			startDay: 1,
			sunrise: 7 * 60,  // 7:00 AM
			sunset: 17 * 60   // 5:00 PM
		},

		// Polar region - extreme variation
		{
			name: 'Polar Winter',
			startMonth: 0,
			startDay: 1,
			sunrise: 12 * 60,  // Noon (polar night - sun barely rises)
			sunset: 12 * 60,   // Noon (no daylight)
			region: 'polar'
		},
		{
			name: 'Polar Spring',
			startMonth: 1,
			startDay: 1,
			sunrise: 4 * 60,   // 4:00 AM (long days starting)
			sunset: 20 * 60,   // 8:00 PM
			region: 'polar'
		},
		{
			name: 'Polar Summer',
			startMonth: 2,
			startDay: 1,
			sunrise: 0,        // Midnight sun (sun never sets)
			sunset: 1439,      // 11:59 PM
			region: 'polar'
		},
		{
			name: 'Polar Fall',
			startMonth: 3,
			startDay: 1,
			sunrise: 6 * 60,   // 6:00 AM
			sunset: 18 * 60,   // 6:00 PM
			region: 'polar'
		},

		// Tropical region - minimal variation
		{
			name: 'Tropical Dry Season',
			startMonth: 0,
			startDay: 1,
			sunrise: 6 * 60,   // 6:00 AM
			sunset: 18 * 60,   // 6:00 PM
			region: 'tropical'
		},
		{
			name: 'Tropical Wet Season',
			startMonth: 2,
			startDay: 1,
			sunrise: 6 * 60,   // 6:00 AM (same as dry season)
			sunset: 18 * 60,   // 6:00 PM
			region: 'tropical'
		}
	]
};

/**
 * Simple calendar with no seasons (for baseline testing)
 */
const CALENDAR_NO_SEASONS: CalendarDefinition = {
	id: 'no-seasons',
	name: 'Calendar without Seasons',
	weekdays: ['Day'],
	months: [{ name: 'Month', days: 30, order: 0 }],
	holidays: []
};

/**
 * Calendar with seasons but no regions (for backward compatibility testing)
 */
const CALENDAR_NO_REGIONS: CalendarDefinition = {
	id: 'no-regions',
	name: 'Calendar without Regions',
	weekdays: ['Day'],
	months: [
		{ name: 'Winter', days: 30, order: 0 },
		{ name: 'Summer', days: 30, order: 1 }
	],
	holidays: [],
	seasons: [
		{
			name: 'Winter',
			startMonth: 0,
			startDay: 1,
			sunrise: 8 * 60,
			sunset: 16 * 60
		},
		{
			name: 'Summer',
			startMonth: 1,
			startDay: 1,
			sunrise: 5 * 60,
			sunset: 20 * 60
		}
	]
};

// ==========================================================================
// Tests
// ==========================================================================

describe('Regional Solar Overrides (TKT-CAL-015)', () => {
	describe('getSolarTimes - basic functionality', () => {
		let driver: CalendarDriver;

		beforeEach(() => {
			driver = new CalendarDriver(CALENDAR_WITH_REGIONS);
		});

		it('should return default times when no seasons defined', () => {
			const noSeasonDriver = new CalendarDriver(CALENDAR_NO_SEASONS);
			const times = noSeasonDriver.getSolarTimes(0);

			expect(times.sunrise).toBe(6 * 60);  // 6:00 AM
			expect(times.sunset).toBe(18 * 60);  // 6:00 PM
		});

		it('should return standard season times when no region context provided', () => {
			// Day 0 = Winter Month 1 (temperate winter)
			const winterTimes = driver.getSolarTimes(0);

			expect(winterTimes.sunrise).toBe(8 * 60);  // 8:00 AM
			expect(winterTimes.sunset).toBe(16 * 60);  // 4:00 PM
		});

		it('should return standard season times when region context is empty', () => {
			const summerTimes = driver.getSolarTimes(60, {});  // Day 60 = Summer Month 1

			expect(summerTimes.sunrise).toBe(5 * 60);  // 5:00 AM (temperate summer)
			expect(summerTimes.sunset).toBe(20 * 60);  // 8:00 PM
		});
	});

	describe('getSolarTimes - region filtering', () => {
		let driver: CalendarDriver;

		beforeEach(() => {
			driver = new CalendarDriver(CALENDAR_WITH_REGIONS);
		});

		it('should return polar winter times when region is polar', () => {
			// Day 0 = Winter Month 1
			const polarWinterTimes = driver.getSolarTimes(0, { region: 'polar' });

			expect(polarWinterTimes.sunrise).toBe(12 * 60);  // Noon (polar night)
			expect(polarWinterTimes.sunset).toBe(12 * 60);   // Noon
		});

		it('should return polar summer times (midnight sun)', () => {
			// Day 60 = Summer Month 1
			const polarSummerTimes = driver.getSolarTimes(60, { region: 'polar' });

			expect(polarSummerTimes.sunrise).toBe(0);      // Midnight
			expect(polarSummerTimes.sunset).toBe(1439);    // 11:59 PM
		});

		it('should return tropical times with minimal variation', () => {
			// Day 0 = Tropical Dry Season
			const dryTimes = driver.getSolarTimes(0, { region: 'tropical' });
			expect(dryTimes.sunrise).toBe(6 * 60);
			expect(dryTimes.sunset).toBe(18 * 60);

			// Day 60 = Tropical Wet Season
			const wetTimes = driver.getSolarTimes(60, { region: 'tropical' });
			expect(wetTimes.sunrise).toBe(6 * 60);  // Same as dry season
			expect(wetTimes.sunset).toBe(18 * 60);
		});

		it('should fall back to standard season when region has no override', () => {
			// Request temperate region explicitly (matches non-region seasons)
			const temperateWinter = driver.getSolarTimes(0, { region: 'temperate' });

			// Should fall back to standard Winter season (no temperate-tagged season exists)
			expect(temperateWinter.sunrise).toBe(8 * 60);
			expect(temperateWinter.sunset).toBe(16 * 60);
		});
	});

	describe('getSolarTimes - seasonal progression', () => {
		let driver: CalendarDriver;

		beforeEach(() => {
			driver = new CalendarDriver(CALENDAR_WITH_REGIONS);
		});

		it('should track polar seasonal changes correctly', () => {
			// Winter (Day 0-29)
			const polarWinter = driver.getSolarTimes(15, { region: 'polar' });
			expect(polarWinter.sunrise).toBe(12 * 60);  // Polar night

			// Spring (Day 30-59)
			const polarSpring = driver.getSolarTimes(45, { region: 'polar' });
			expect(polarSpring.sunrise).toBe(4 * 60);   // Long days
			expect(polarSpring.sunset).toBe(20 * 60);

			// Summer (Day 60-89)
			const polarSummer = driver.getSolarTimes(75, { region: 'polar' });
			expect(polarSummer.sunrise).toBe(0);        // Midnight sun
			expect(polarSummer.sunset).toBe(1439);

			// Fall (Day 90-119)
			const polarFall = driver.getSolarTimes(105, { region: 'polar' });
			expect(polarFall.sunrise).toBe(6 * 60);
			expect(polarFall.sunset).toBe(18 * 60);
		});

		it('should track temperate seasonal changes correctly', () => {
			// Winter (Day 0-29)
			const winter = driver.getSolarTimes(15);
			expect(winter.sunrise).toBe(8 * 60);
			expect(winter.sunset).toBe(16 * 60);

			// Spring (Day 30-59)
			const spring = driver.getSolarTimes(45);
			expect(spring.sunrise).toBe(6 * 60);
			expect(spring.sunset).toBe(18 * 60);

			// Summer (Day 60-89)
			const summer = driver.getSolarTimes(75);
			expect(summer.sunrise).toBe(5 * 60);
			expect(summer.sunset).toBe(20 * 60);

			// Fall (Day 90-119)
			const fall = driver.getSolarTimes(105);
			expect(fall.sunrise).toBe(7 * 60);
			expect(fall.sunset).toBe(17 * 60);
		});
	});

	describe('backward compatibility', () => {
		it('should work with calendars that have no region tags', () => {
			const driver = new CalendarDriver(CALENDAR_NO_REGIONS);

			// Should return season times normally
			const winterTimes = driver.getSolarTimes(0);
			expect(winterTimes.sunrise).toBe(8 * 60);
			expect(winterTimes.sunset).toBe(16 * 60);

			// Should ignore region context if no region-tagged seasons exist
			const winterWithRegion = driver.getSolarTimes(0, { region: 'polar' });
			expect(winterWithRegion.sunrise).toBe(8 * 60);  // Falls back to standard
			expect(winterWithRegion.sunset).toBe(16 * 60);
		});

		it('should work with existing getSunrise/getSunset methods', () => {
			const driver = new CalendarDriver(CALENDAR_WITH_REGIONS);

			// Existing methods should return standard season times (no region context)
			expect(driver.getSunrise(0)).toBe(8 * 60);   // Temperate winter sunrise
			expect(driver.getSunset(0)).toBe(16 * 60);   // Temperate winter sunset

			expect(driver.getSunrise(60)).toBe(5 * 60);  // Temperate summer sunrise
			expect(driver.getSunset(60)).toBe(20 * 60);  // Temperate summer sunset
		});
	});

	describe('edge cases', () => {
		let driver: CalendarDriver;

		beforeEach(() => {
			driver = new CalendarDriver(CALENDAR_WITH_REGIONS);
		});

		it('should handle polar midnight sun correctly', () => {
			const midnightSun = driver.getSolarTimes(60, { region: 'polar' });

			// Sun never sets
			expect(midnightSun.sunrise).toBe(0);
			expect(midnightSun.sunset).toBe(1439);

			// Daylight should be ~24 hours
			const daylightMinutes = midnightSun.sunset - midnightSun.sunrise;
			expect(daylightMinutes).toBe(1439);  // Almost full day
		});

		it('should handle polar night (no daylight)', () => {
			const polarNight = driver.getSolarTimes(0, { region: 'polar' });

			// Sun barely rises
			expect(polarNight.sunrise).toBe(12 * 60);  // Noon
			expect(polarNight.sunset).toBe(12 * 60);   // Noon

			// No effective daylight
			const daylightMinutes = polarNight.sunset - polarNight.sunrise;
			expect(daylightMinutes).toBe(0);
		});

		it('should handle year boundaries with region context', () => {
			// Last day of year (Day 119 = Fall Month 30)
			const lastDay = driver.getSolarTimes(119, { region: 'polar' });
			expect(lastDay.sunrise).toBe(6 * 60);   // Polar fall

			// First day of next year (Day 120 = Winter Month 1 of next year)
			const firstDay = driver.getSolarTimes(120, { region: 'polar' });
			expect(firstDay.sunrise).toBe(12 * 60);  // Polar winter (wraps around)
		});

		it('should handle invalid region gracefully', () => {
			// Request a region that doesn't exist
			const invalidRegion = driver.getSolarTimes(0, { region: 'desert' as any });

			// Should fall back to standard season times
			expect(invalidRegion.sunrise).toBe(8 * 60);
			expect(invalidRegion.sunset).toBe(16 * 60);
		});

		it('should handle undefined region in context gracefully', () => {
			const undefinedRegion = driver.getSolarTimes(0, { region: undefined });

			// Should return standard season times
			expect(undefinedRegion.sunrise).toBe(8 * 60);
			expect(undefinedRegion.sunset).toBe(16 * 60);
		});
	});

	describe('tropical region consistency', () => {
		let driver: CalendarDriver;

		beforeEach(() => {
			driver = new CalendarDriver(CALENDAR_WITH_REGIONS);
		});

		it('should show minimal variation in tropical regions', () => {
			// Dry season (winter months)
			const dryTimes = driver.getSolarTimes(15, { region: 'tropical' });

			// Wet season (summer months)
			const wetTimes = driver.getSolarTimes(75, { region: 'tropical' });

			// Both should be the same (tropical regions have consistent daylight)
			expect(dryTimes.sunrise).toBe(wetTimes.sunrise);
			expect(dryTimes.sunset).toBe(wetTimes.sunset);
		});
	});

	describe('integration with CalendarSystem', () => {
		it('should support location-based region inheritance (documented behavior)', () => {
			const driver = new CalendarDriver(CALENDAR_WITH_REGIONS);

			// Simulate location with region: 'polar'
			// In actual implementation, CalendarSystem would resolve this from Location hierarchy
			const locationRegion = 'polar';

			const times = driver.getSolarTimes(60, { region: locationRegion });

			expect(times.sunrise).toBe(0);      // Polar midnight sun
			expect(times.sunset).toBe(1439);
		});

		it('should support child location inheriting parent region (documented behavior)', () => {
			const driver = new CalendarDriver(CALENDAR_WITH_REGIONS);

			// Simulate:
			// Parent location: "Icewind Dale" (region: 'polar')
			// Child location: "Ten Towns" (no region specified, inherits from parent)
			const inheritedRegion = 'polar';  // Resolved by CalendarSystem from parent

			const times = driver.getSolarTimes(0, { region: inheritedRegion });

			expect(times.sunrise).toBe(12 * 60);  // Polar winter
			expect(times.sunset).toBe(12 * 60);
		});
	});
});
