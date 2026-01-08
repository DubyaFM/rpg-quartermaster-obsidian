/**
 * DateFormatter Service
 *
 * Converts absolute day counters to human-readable calendar dates.
 * Handles calendar definitions with varying month lengths, week structures,
 * and origin date mapping.
 *
 * Pure service with no state - all methods are functional.
 *
 * Refactored (Phase 2): Delegates all date calculations to CalendarDriver
 */

import { CalendarDefinition, CalendarOrigin, FormattedDate, CalendarHoliday } from '../models/types';
import { CalendarDriver } from './CalendarDriver';

export class DateFormatter {
	/**
	 * Convert absolute day counter to formatted date
	 * Delegates calculation to CalendarDriver, adds formatting logic
	 *
	 * @param dayCounter Absolute day (0-indexed)
	 * @param calendar Calendar definition to use
	 * @param origin Optional origin date (maps Day 0 to a specific date)
	 * @returns Formatted date object with multiple representations
	 */
	format(dayCounter: number, calendar: CalendarDefinition, origin?: CalendarOrigin): FormattedDate {
		// Create CalendarDriver for this calendar
		const driver = new CalendarDriver(calendar, origin);
		const date = driver.getDate(dayCounter);

		// If simple counter mode, return basic format
		if (date.isSimpleCounter) {
			return {
				dayOfWeek: '',
				dayOfMonth: 0,
				monthName: '',
				year: 0,
				yearSuffix: date.yearSuffix || '',
				formatted: `Day ${dayCounter}`,
				compact: `Day ${dayCounter}`,
				absoluteDay: dayCounter
			};
		}

		// Format strings using CalendarDate components
		const ordinalSuffix = this.getOrdinalSuffix(date.dayOfMonth);
		const yearSuffix = date.yearSuffix || '';

		const formatted = date.dayOfWeek
			? `${date.dayOfWeek}, ${date.dayOfMonth}${ordinalSuffix} of ${date.monthName}, ${date.year} ${yearSuffix}`.trim()
			: `${date.dayOfMonth}${ordinalSuffix} of ${date.monthName}, ${date.year} ${yearSuffix}`.trim();

		const compact = `${date.dayOfMonth} ${date.monthName} ${date.year}`;

		return {
			dayOfWeek: date.dayOfWeek,
			dayOfMonth: date.dayOfMonth,
			monthName: date.monthName,
			year: date.year,
			yearSuffix,
			formatted,
			compact,
			absoluteDay: dayCounter
		};
	}

	/**
	 * Get day of week for a given day counter
	 * Delegates to CalendarDriver
	 *
	 * @param dayCounter Absolute day
	 * @param calendar Calendar definition
	 * @returns Day of week name or empty string if no weekdays defined
	 */
	getDayOfWeek(dayCounter: number, calendar: CalendarDefinition): string {
		const driver = new CalendarDriver(calendar);
		return driver.getDayOfWeek(dayCounter);
	}

	/**
	 * Get month name for a given day counter
	 * Delegates to CalendarDriver
	 *
	 * @param dayCounter Absolute day
	 * @param calendar Calendar definition
	 * @returns Month name or empty string if no months defined
	 */
	getMonthName(dayCounter: number, calendar: CalendarDefinition): string {
		const driver = new CalendarDriver(calendar);
		return driver.getMonthName(dayCounter);
	}

	/**
	 * Get day of month (1-based) for a given day counter
	 * Delegates to CalendarDriver
	 *
	 * @param dayCounter Absolute day
	 * @param calendar Calendar definition
	 * @returns Day of month (1-indexed)
	 */
	getDayOfMonth(dayCounter: number, calendar: CalendarDefinition): number {
		const driver = new CalendarDriver(calendar);
		return driver.getDayOfMonth(dayCounter);
	}

	/**
	 * Get year number for a given day counter
	 * Delegates to CalendarDriver
	 *
	 * @param dayCounter Absolute day
	 * @param calendar Calendar definition
	 * @param origin Optional origin date
	 * @returns Year number
	 */
	getYear(dayCounter: number, calendar: CalendarDefinition, origin?: CalendarOrigin): number {
		const driver = new CalendarDriver(calendar, origin);
		return driver.getYear(dayCounter);
	}

	/**
	 * Get holidays that occur on a specific day
	 *
	 * @param dayCounter Absolute day
	 * @param calendar Calendar definition
	 * @returns Array of holidays occurring on this day
	 */
	getHolidaysForDay(dayCounter: number, calendar: CalendarDefinition): CalendarHoliday[] {
		if (!calendar.holidays || calendar.holidays.length === 0) {
			return [];
		}

		const totalDaysInYear = calendar.months ? calendar.months.reduce((sum, month) => sum + month.days, 0) : 365;
		const dayOfYear = dayCounter % totalDaysInYear;

		const matchingHolidays: CalendarHoliday[] = [];

		for (const holiday of calendar.holidays) {
			// Check if holiday matches by day of year
			if (holiday.dayOfYear !== undefined && holiday.dayOfYear === dayOfYear) {
				matchingHolidays.push(holiday);
			}

			// Check if holiday matches by month and day
			if (holiday.month !== undefined && holiday.day !== undefined && calendar.months) {
				const holidayDayOfYear = this.calculateDayOfYear(holiday.month, holiday.day, calendar);
				if (holidayDayOfYear === dayOfYear) {
					matchingHolidays.push(holiday);
				}
			}
		}

		return matchingHolidays;
	}

	/**
	 * Calculate day of year from month and day
	 *
	 * @param monthIndex Month index (0-based)
	 * @param dayOfMonth Day of month (1-based)
	 * @param calendar Calendar definition
	 * @returns Day of year (0-indexed)
	 */
	private calculateDayOfYear(monthIndex: number, dayOfMonth: number, calendar: CalendarDefinition): number {
		if (!calendar.months || monthIndex >= calendar.months.length) {
			return 0;
		}

		let dayOfYear = 0;

		// Add days from previous months
		for (let i = 0; i < monthIndex; i++) {
			dayOfYear += calendar.months[i].days;
		}

		// Add day of current month (subtract 1 because dayOfMonth is 1-indexed)
		dayOfYear += dayOfMonth - 1;

		return dayOfYear;
	}

	/**
	 * Format ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
	 *
	 * @param day Day number
	 * @returns Ordinal suffix string
	 */
	private getOrdinalSuffix(day: number): string {
		if (day >= 11 && day <= 13) {
			return 'th';
		}

		const lastDigit = day % 10;
		switch (lastDigit) {
			case 1:
				return 'st';
			case 2:
				return 'nd';
			case 3:
				return 'rd';
			default:
				return 'th';
		}
	}
}
