/**
 * DateFormatter Service
 *
 * Converts absolute day counters to human-readable calendar dates.
 * Handles calendar definitions with varying month lengths, week structures,
 * and origin date mapping.
 *
 * Pure service with no state - all methods are functional.
 */

import { CalendarDefinition, CalendarOrigin, FormattedDate, CalendarHoliday } from '../models/types';

export class DateFormatter {
	/**
	 * Convert absolute day counter to formatted date
	 *
	 * @param dayCounter Absolute day (0-indexed)
	 * @param calendar Calendar definition to use
	 * @param origin Optional origin date (maps Day 0 to a specific date)
	 * @returns Formatted date object with multiple representations
	 */
	format(dayCounter: number, calendar: CalendarDefinition, origin?: CalendarOrigin): FormattedDate {
		// If no months defined (simple counter mode), return basic format
		if (!calendar.months || calendar.months.length === 0) {
			return {
				dayOfWeek: '',
				dayOfMonth: 0,
				monthName: '',
				year: 0,
				yearSuffix: calendar.yearSuffix,
				formatted: `Day ${dayCounter}`,
				compact: `Day ${dayCounter}`,
				absoluteDay: dayCounter
			};
		}

		// Calculate date components
		const totalDaysInYear = calendar.months.reduce((sum, month) => sum + month.days, 0);
		const yearsElapsed = Math.floor(dayCounter / totalDaysInYear);
		const dayOfYear = dayCounter % totalDaysInYear;

		// Determine month and day of month
		let remainingDays = dayOfYear;
		let monthIndex = 0;
		let dayOfMonth = 1;

		for (let i = 0; i < calendar.months.length; i++) {
			const monthDays = calendar.months[i].days;
			if (remainingDays < monthDays) {
				monthIndex = i;
				dayOfMonth = remainingDays + 1;  // 1-indexed
				break;
			}
			remainingDays -= monthDays;
		}

		const month = calendar.months[monthIndex];

		// Calculate year (with origin offset if provided)
		const year = origin
			? origin.year + yearsElapsed
			: (calendar.startingYear || 0) + yearsElapsed;

		// Calculate day of week (if weekdays defined)
		const dayOfWeek = calendar.weekdays && calendar.weekdays.length > 0
			? calendar.weekdays[dayCounter % calendar.weekdays.length]
			: '';

		// Format strings
		const ordinalSuffix = this.getOrdinalSuffix(dayOfMonth);
		const monthName = month.name;
		const yearSuffix = calendar.yearSuffix || '';

		const formatted = dayOfWeek
			? `${dayOfWeek}, ${dayOfMonth}${ordinalSuffix} of ${monthName}, ${year} ${yearSuffix}`.trim()
			: `${dayOfMonth}${ordinalSuffix} of ${monthName}, ${year} ${yearSuffix}`.trim();

		const compact = `${dayOfMonth} ${monthName} ${year}`;

		return {
			dayOfWeek,
			dayOfMonth,
			monthName,
			year,
			yearSuffix,
			formatted,
			compact,
			absoluteDay: dayCounter
		};
	}

	/**
	 * Get day of week for a given day counter
	 *
	 * @param dayCounter Absolute day
	 * @param calendar Calendar definition
	 * @returns Day of week name or empty string if no weekdays defined
	 */
	getDayOfWeek(dayCounter: number, calendar: CalendarDefinition): string {
		if (!calendar.weekdays || calendar.weekdays.length === 0) {
			return '';
		}
		return calendar.weekdays[dayCounter % calendar.weekdays.length];
	}

	/**
	 * Get month name for a given day counter
	 *
	 * @param dayCounter Absolute day
	 * @param calendar Calendar definition
	 * @returns Month name or empty string if no months defined
	 */
	getMonthName(dayCounter: number, calendar: CalendarDefinition): string {
		if (!calendar.months || calendar.months.length === 0) {
			return '';
		}

		const totalDaysInYear = calendar.months.reduce((sum, month) => sum + month.days, 0);
		const dayOfYear = dayCounter % totalDaysInYear;

		let remainingDays = dayOfYear;
		for (const month of calendar.months) {
			if (remainingDays < month.days) {
				return month.name;
			}
			remainingDays -= month.days;
		}

		return calendar.months[0].name;  // Fallback
	}

	/**
	 * Get day of month (1-based) for a given day counter
	 *
	 * @param dayCounter Absolute day
	 * @param calendar Calendar definition
	 * @returns Day of month (1-indexed)
	 */
	getDayOfMonth(dayCounter: number, calendar: CalendarDefinition): number {
		if (!calendar.months || calendar.months.length === 0) {
			return 0;
		}

		const totalDaysInYear = calendar.months.reduce((sum, month) => sum + month.days, 0);
		const dayOfYear = dayCounter % totalDaysInYear;

		let remainingDays = dayOfYear;
		for (const month of calendar.months) {
			if (remainingDays < month.days) {
				return remainingDays + 1;  // 1-indexed
			}
			remainingDays -= month.days;
		}

		return 1;  // Fallback
	}

	/**
	 * Get year number for a given day counter
	 *
	 * @param dayCounter Absolute day
	 * @param calendar Calendar definition
	 * @param origin Optional origin date
	 * @returns Year number
	 */
	getYear(dayCounter: number, calendar: CalendarDefinition, origin?: CalendarOrigin): number {
		if (!calendar.months || calendar.months.length === 0) {
			return 0;
		}

		const totalDaysInYear = calendar.months.reduce((sum, month) => sum + month.days, 0);
		const yearsElapsed = Math.floor(dayCounter / totalDaysInYear);

		return origin
			? origin.year + yearsElapsed
			: (calendar.startingYear || 0) + yearsElapsed;
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
