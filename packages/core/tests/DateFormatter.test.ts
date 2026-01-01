import { describe, it, expect, beforeEach } from 'vitest';
import { DateFormatter } from '../services/DateFormatter';
import { CalendarDefinition, CalendarOrigin } from '../models/types';

// Test fixtures - minimal calendar definitions for testing
// Actual calendars are loaded from config/calendars.yaml in production
const HARPTOS_CALENDAR: CalendarDefinition = {
	id: 'harptos',
	name: 'Calendar of Harptos',
	description: 'The standard calendar of Faerûn (Forgotten Realms)',
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

describe('DateFormatter', () => {
	let formatter: DateFormatter;

	beforeEach(() => {
		formatter = new DateFormatter();
	});

	describe('simple counter mode', () => {
		const simpleCalendar: CalendarDefinition = {
			id: 'simple',
			name: 'Simple Counter',
			description: 'No months',
			weekdays: [],
			months: [],
			holidays: []
		};

		it('should format day counter when no months defined', () => {
			const date = formatter.format(147, simpleCalendar);

			expect(date.formatted).toBe('Day 147');
			expect(date.compact).toBe('Day 147');
			expect(date.absoluteDay).toBe(147);
			expect(date.dayOfWeek).toBe('');
			expect(date.monthName).toBe('');
		});
	});

	describe('Harptos calendar', () => {
		it('should format Day 0 correctly', () => {
			const date = formatter.format(0, HARPTOS_CALENDAR);

			expect(date.dayOfMonth).toBe(1);
			expect(date.monthName).toBe('Hammer');
			expect(date.absoluteDay).toBe(0);
		});

		it('should format Day 30 (last day of Hammer)', () => {
			const date = formatter.format(29, HARPTOS_CALENDAR);

			expect(date.dayOfMonth).toBe(30);
			expect(date.monthName).toBe('Hammer');
		});

		it('should format Day 31 (first day of Alturiak)', () => {
			const date = formatter.format(30, HARPTOS_CALENDAR);

			expect(date.dayOfMonth).toBe(1);
			expect(date.monthName).toBe('Alturiak');
		});

		it('should format mid-year correctly', () => {
			const date = formatter.format(180, HARPTOS_CALENDAR);

			expect(date.monthName).toBe('Flamerule');  // 6th month
			expect(date.dayOfMonth).toBe(1);
		});

		it('should format end of year correctly', () => {
			const date = formatter.format(359, HARPTOS_CALENDAR);

			expect(date.monthName).toBe('Nightal');  // Last month
			expect(date.dayOfMonth).toBe(30);
		});

		it('should roll over to next year', () => {
			const date = formatter.format(360, HARPTOS_CALENDAR);

			expect(date.monthName).toBe('Hammer');
			expect(date.dayOfMonth).toBe(1);
			expect(date.year).toBe(1493);  // Default starting year 1492 + 1
		});

		it('should include yearSuffix in formatted string', () => {
			const date = formatter.format(0, HARPTOS_CALENDAR);

			expect(date.formatted).toContain('DR');
			expect(date.yearSuffix).toBe('DR');
		});

		it('should format with origin date', () => {
			const origin: CalendarOrigin = {
				year: 1490,
				month: 0,
				day: 1
			};

			const date = formatter.format(360, HARPTOS_CALENDAR, origin);

			expect(date.year).toBe(1491);  // 1490 + 1 year elapsed
			expect(date.monthName).toBe('Hammer');
			expect(date.dayOfMonth).toBe(1);
		});

		it('should handle day of week calculation', () => {
			const date1 = formatter.format(0, HARPTOS_CALENDAR);
			const date2 = formatter.format(10, HARPTOS_CALENDAR);

			expect(date1.dayOfWeek).toBe('1st Day');
			expect(date2.dayOfWeek).toBe('1st Day');  // 10 % 10 = 0, which is index 0
		});
	});

	describe('Gregorian calendar', () => {
		it('should format Day 0 as January 1st', () => {
			const date = formatter.format(0, GREGORIAN_CALENDAR);

			expect(date.dayOfMonth).toBe(1);
			expect(date.monthName).toBe('January');
			expect(date.year).toBe(2024);  // Default starting year
		});

		it('should handle varying month lengths', () => {
			// Day 31 should be February 1st (after 31 days of January)
			const date = formatter.format(31, GREGORIAN_CALENDAR);

			expect(date.monthName).toBe('February');
			expect(date.dayOfMonth).toBe(1);
		});

		it('should format leap to next year', () => {
			// 365 days = 1 full year
			const date = formatter.format(365, GREGORIAN_CALENDAR);

			expect(date.monthName).toBe('January');
			expect(date.dayOfMonth).toBe(1);
			expect(date.year).toBe(2025);  // 2024 + 1
		});

		it('should format day of week', () => {
			// Day 0 = Sunday (index 0)
			const date1 = formatter.format(0, GREGORIAN_CALENDAR);
			// Day 1 = Monday (index 1)
			const date2 = formatter.format(1, GREGORIAN_CALENDAR);

			expect(date1.dayOfWeek).toBe('Sunday');
			expect(date2.dayOfWeek).toBe('Monday');
		});
	});

	describe('getHolidaysForDay', () => {
		it('should return holidays by dayOfYear', () => {
			const holidays = formatter.getHolidaysForDay(30, HARPTOS_CALENDAR);

			expect(holidays.length).toBeGreaterThan(0);
			expect(holidays[0].name).toBe('Midwinter');
		});

		it('should return holidays by month and day', () => {
			const holidays = formatter.getHolidaysForDay(0, GREGORIAN_CALENDAR);

			expect(holidays.length).toBeGreaterThan(0);
			expect(holidays.some(h => h.name === "New Year's Day")).toBe(true);
		});

		it('should return empty array if no holidays', () => {
			const simpleCalendar: CalendarDefinition = {
				id: 'test',
				name: 'Test',
				description: 'No holidays',
				weekdays: [],
				months: [{ name: 'Month', days: 30, order: 0 }],
				holidays: []
			};

			const holidays = formatter.getHolidaysForDay(0, simpleCalendar);

			expect(holidays).toEqual([]);
		});
	});

	describe('ordinal suffixes', () => {
		it('should format 1st correctly', () => {
			const date = formatter.format(0, HARPTOS_CALENDAR);
			expect(date.formatted).toContain('1st');
		});

		it('should format 2nd correctly', () => {
			const date = formatter.format(1, HARPTOS_CALENDAR);
			expect(date.formatted).toContain('2nd');
		});

		it('should format 3rd correctly', () => {
			const date = formatter.format(2, HARPTOS_CALENDAR);
			expect(date.formatted).toContain('3rd');
		});

		it('should format 4th correctly', () => {
			const date = formatter.format(3, HARPTOS_CALENDAR);
			expect(date.formatted).toContain('4th');
		});

		it('should format 11th, 12th, 13th correctly', () => {
			const date11 = formatter.format(10, HARPTOS_CALENDAR);
			const date12 = formatter.format(11, HARPTOS_CALENDAR);
			const date13 = formatter.format(12, HARPTOS_CALENDAR);

			expect(date11.formatted).toContain('11th');
			expect(date12.formatted).toContain('12th');
			expect(date13.formatted).toContain('13th');
		});

		it('should format 21st correctly', () => {
			const date = formatter.format(20, HARPTOS_CALENDAR);
			expect(date.formatted).toContain('21st');
		});
	});

	describe('helper methods', () => {
		it('getDayOfWeek should return correct weekday', () => {
			const day = formatter.getDayOfWeek(0, GREGORIAN_CALENDAR);
			expect(day).toBe('Sunday');
		});

		it('getMonthName should return correct month', () => {
			const month = formatter.getMonthName(0, HARPTOS_CALENDAR);
			expect(month).toBe('Hammer');
		});

		it('getDayOfMonth should return correct day', () => {
			const day = formatter.getDayOfMonth(0, HARPTOS_CALENDAR);
			expect(day).toBe(1);
		});

		it('getYear should return correct year', () => {
			const year = formatter.getYear(0, HARPTOS_CALENDAR);
			expect(year).toBe(1492);
		});

		it('getYear with origin should offset correctly', () => {
			const origin: CalendarOrigin = {
				year: 1000,
				month: 0,
				day: 1
			};

			const year = formatter.getYear(360, HARPTOS_CALENDAR, origin);
			expect(year).toBe(1001);  // 1000 + 1 year elapsed
		});
	});

	describe('compact format', () => {
		it('should create compact date string', () => {
			const date = formatter.format(0, HARPTOS_CALENDAR);

			expect(date.compact).toBe('1 Hammer 1492');
		});

		it('should not include day of week in compact format', () => {
			const date = formatter.format(0, GREGORIAN_CALENDAR);

			expect(date.compact).not.toContain('Sunday');
			expect(date.compact).toBe('1 January 2024');
		});
	});
});
