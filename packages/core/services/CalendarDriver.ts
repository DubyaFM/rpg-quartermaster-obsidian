/**
 * CalendarDriver Service
 *
 * The "physics of time" layer that converts absolute days to calendar dates.
 * Handles months, weekdays, and basic year calculations for any calendar system.
 *
 * Pure class with no side effects - all methods are deterministic.
 * Replaces date calculation logic from DateFormatter.
 *
 * Design Notes:
 * - Calendar definition is injected at construction
 * - All calculations are stateless and functional
 * - Supports configurable week lengths (including no weeks)
 * - Handles "simple counter" mode when no months defined
 * - Safe for very large absolute days (up to Number.MAX_SAFE_INTEGER)
 * - Supports intercalary days (days outside normal month/week cycle)
 *
 * Intercalary Day Support:
 * - Months with type: "intercalary" are treated as standalone holidays
 * - Intercalary days do NOT advance the weekday cycle by default
 * - Weekday calculation counts only non-intercalary days
 * - Example: Hammer 30 (Sunday) -> Midwinter 1 (no weekday) -> Alturiak 1 (Monday)
 */

import { CalendarDefinition, CalendarOrigin, CalendarDate, LeapRule, Era, Season } from '../models/types';
import { isLeapYear, getLeapDaysBefore, getMonthDays, getLeapDayTargetMonth } from '../utils/LeapCalculator';

// Re-export CalendarDate for convenience
export type { CalendarDate } from '../models/types';

export class CalendarDriver {
	private calendar: CalendarDefinition;
	private origin?: CalendarOrigin;

	/** Cached total days in year for performance */
	private totalDaysInYear: number;

	/** Cached cumulative days at start of each month for O(log n) lookups */
	private monthStartDays: number[];

	/** Cached count of non-intercalary days in a year (for weekday calculations) */
	private weekCountingDaysInYear: number;

	/** Cached cumulative intercalary days before each month index */
	private intercalaryDaysBeforeMonth: number[];

	/** Cached base year for calculations */
	private baseYear: number;

	/** Current time of day (minutes from midnight, 0-1439) */
	private timeOfDay: number = 0;

	/** Dawn/dusk transition window in minutes (default: 30 minutes) */
	private readonly TWILIGHT_DURATION = 30;

	constructor(calendar: CalendarDefinition, origin?: CalendarOrigin) {
		this.calendar = calendar;
		this.origin = origin;

		// Pre-calculate year length and month start days
		this.baseYear = this.origin?.year ?? this.calendar.startingYear ?? 0;
		this.totalDaysInYear = this.calculateTotalDaysInYear();
		this.monthStartDays = this.calculateMonthStartDays();
		this.weekCountingDaysInYear = this.calculateWeekCountingDaysInYear();
		this.intercalaryDaysBeforeMonth = this.calculateIntercalaryDaysBeforeMonth();
	}

	/**
	 * Get the calendar definition being used
	 */
	getCalendarDefinition(): CalendarDefinition {
		return this.calendar;
	}

	/**
	 * Get the origin date configuration
	 */
	getOrigin(): CalendarOrigin | undefined {
		return this.origin;
	}

	/**
	 * Get the era for a given year
	 * Returns the matching era based on year boundaries
	 *
	 * @param year Year number to check
	 * @returns Era object or undefined if no eras defined or no match
	 */
	getEra(year: number): Era | undefined {
		if (!this.calendar.eras || this.calendar.eras.length === 0) {
			return undefined;
		}

		// Find the era that matches this year
		for (const era of this.calendar.eras) {
			// Check if year is within era boundaries
			if (year >= era.startYear) {
				// If no endYear, this is the current/final era
				if (era.endYear === undefined || year < era.endYear) {
					return era;
				}
			}
		}

		return undefined;
	}

	/**
	 * Convert absolute day counter to calendar date
	 *
	 * @param absoluteDay Absolute day (0-indexed)
	 * @returns CalendarDate with all date components
	 */
	getDate(absoluteDay: number): CalendarDate {
		// Handle simple counter mode (no months defined)
		if (!this.hasMonths()) {
			return this.createSimpleCounterDate(absoluteDay);
		}

		// Calculate year and day of year
		const { year, dayOfYear } = this.calculateYearAndDayOfYear(absoluteDay);

		// Calculate month and day of month from day of year (pass year for leap calculations)
		const { monthIndex, dayOfMonth } = this.calculateMonthAndDay(dayOfYear, year);

		// Get month info
		const month = this.calendar.months[monthIndex];
		const monthName = month?.name || '';
		const isIntercalary = month?.type === 'intercalary';

		// Calculate day of week (intercalary days have no weekday)
		const { dayOfWeek, dayOfWeekIndex } = isIntercalary
			? { dayOfWeek: '', dayOfWeekIndex: -1 }
			: this.calculateDayOfWeek(absoluteDay);

		// Calculate year suffix with era support
		const yearSuffix = this.calculateYearSuffix(year);

		return {
			absoluteDay,
			dayOfMonth,
			monthIndex,
			monthName,
			year,
			dayOfWeek,
			dayOfWeekIndex,
			dayOfYear,
			yearSuffix,
			isSimpleCounter: false,
			isIntercalary
		};
	}

	/**
	 * Get day of week for a given day counter
	 *
	 * @param absoluteDay Absolute day
	 * @returns Day of week name or empty string if no weekdays defined or if intercalary
	 */
	getDayOfWeek(absoluteDay: number): string {
		if (!this.hasWeekdays()) {
			return '';
		}

		// Check if this day is intercalary
		if (this.isIntercalaryDay(absoluteDay)) {
			return '';
		}

		const index = this.calculateWeekdayIndex(absoluteDay);
		return index >= 0 ? this.calendar.weekdays[index] : '';
	}

	/**
	 * Get month name for a given day counter
	 *
	 * @param absoluteDay Absolute day
	 * @returns Month name or empty string if no months defined
	 */
	getMonthName(absoluteDay: number): string {
		if (!this.hasMonths()) {
			return '';
		}

		const { year, dayOfYear } = this.calculateYearAndDayOfYear(absoluteDay);
		const { monthIndex } = this.calculateMonthAndDay(dayOfYear, year);
		return this.calendar.months[monthIndex]?.name || '';
	}

	/**
	 * Get day of month (1-based) for a given day counter
	 *
	 * @param absoluteDay Absolute day
	 * @returns Day of month (1-indexed) or 0 if no months defined
	 */
	getDayOfMonth(absoluteDay: number): number {
		if (!this.hasMonths()) {
			return 0;
		}

		const { year, dayOfYear } = this.calculateYearAndDayOfYear(absoluteDay);
		const { dayOfMonth } = this.calculateMonthAndDay(dayOfYear, year);
		return dayOfMonth;
	}

	/**
	 * Get year number for a given day counter
	 *
	 * @param absoluteDay Absolute day
	 * @returns Year number
	 */
	getYear(absoluteDay: number): number {
		if (!this.hasMonths()) {
			return 0;
		}

		const { year } = this.calculateYearAndDayOfYear(absoluteDay);
		return year;
	}

	/**
	 * Get day of year (0-indexed) for a given day counter
	 *
	 * @param absoluteDay Absolute day
	 * @returns Day of year (0-indexed)
	 */
	getDayOfYear(absoluteDay: number): number {
		if (!this.hasMonths()) {
			return absoluteDay;
		}

		const { dayOfYear } = this.calculateYearAndDayOfYear(absoluteDay);
		return dayOfYear;
	}

	/**
	 * Get the total number of days in a year
	 *
	 * @returns Total days in year (0 if no months defined)
	 */
	getTotalDaysInYear(): number {
		return this.totalDaysInYear;
	}

	/**
	 * Get the number of weekdays in the calendar's week
	 *
	 * @returns Number of weekdays (0 if no weekdays defined)
	 */
	getWeekLength(): number {
		return this.calendar.weekdays?.length || 0;
	}

	/**
	 * Check if the calendar has months defined
	 */
	hasMonths(): boolean {
		return this.calendar.months && this.calendar.months.length > 0;
	}

	/**
	 * Check if the calendar has weekdays defined
	 */
	hasWeekdays(): boolean {
		return this.calendar.weekdays && this.calendar.weekdays.length > 0;
	}

	/**
	 * Check if the calendar has leap rules defined
	 */
	hasLeapRules(): boolean {
		return this.calendar.leapRules !== undefined && this.calendar.leapRules.length > 0;
	}

	/**
	 * Check if a given year is a leap year according to the calendar's rules
	 *
	 * @param year Year number to check
	 * @returns true if the year is a leap year
	 */
	isLeapYear(year: number): boolean {
		return isLeapYear(year, this.calendar.leapRules);
	}

	/**
	 * Get the total days in a specific year, accounting for leap years
	 *
	 * @param year Year number
	 * @returns Total days in that year
	 */
	getDaysInYear(year: number): number {
		if (this.isLeapYear(year)) {
			return this.totalDaysInYear + 1;
		}
		return this.totalDaysInYear;
	}

	/**
	 * Get the month index that receives the leap day for a given year
	 * Returns undefined if not a leap year or no leap rules
	 *
	 * @param year Year number
	 * @returns Month index (0-based) or undefined
	 */
	getLeapDayTargetMonth(year: number): number | undefined {
		if (!this.isLeapYear(year)) {
			return undefined;
		}
		return getLeapDayTargetMonth(year, this.calendar.leapRules);
	}

	/**
	 * Check if the calendar has any intercalary months defined
	 */
	hasIntercalaryMonths(): boolean {
		if (!this.hasMonths()) {
			return false;
		}
		return this.calendar.months.some(m => m.type === 'intercalary');
	}

	/**
	 * Check if a given absolute day falls within an intercalary period
	 *
	 * @param absoluteDay Absolute day
	 * @returns true if this day is in an intercalary month
	 */
	isIntercalaryDay(absoluteDay: number): boolean {
		if (!this.hasMonths()) {
			return false;
		}

		const { year, dayOfYear } = this.calculateYearAndDayOfYear(absoluteDay);
		const { monthIndex } = this.calculateMonthAndDay(dayOfYear, year);
		const month = this.calendar.months[monthIndex];

		return month?.type === 'intercalary';
	}

	/**
	 * Get the count of non-intercalary days in a year
	 * Used for understanding the actual "working week" cycle
	 *
	 * @returns Number of days that count toward weekday advancement
	 */
	getWeekCountingDaysInYear(): number {
		return this.weekCountingDaysInYear;
	}

	/**
	 * Get the current season for a given absolute day
	 * Returns the season that the given day falls within, based on season start dates.
	 * If no seasons are defined in the calendar, returns undefined.
	 * Seasons can cross year boundaries (e.g., Winter: Dec 21 - March 20).
	 *
	 * @param absoluteDay Absolute day counter
	 * @returns Season object or undefined if no seasons defined
	 */
	getSeason(absoluteDay: number): Season | undefined {
		// Return undefined if no seasons defined
		if (!this.calendar.seasons || this.calendar.seasons.length === 0) {
			return undefined;
		}

		// Get the current date to determine month and day
		const date = this.getDate(absoluteDay);

		// If simple counter mode, no seasons
		if (date.isSimpleCounter) {
			return undefined;
		}

		// Find the active season by comparing dates
		return this.findActiveSeason(date.monthIndex, date.dayOfMonth);
	}

	/**
	 * Get default sunrise/sunset times when no season is active
	 * Returns reasonable defaults: sunrise at 6:00 AM, sunset at 6:00 PM
	 *
	 * @returns Object with sunrise and sunset in minutes from midnight
	 */
	getDefaultSolarTimes(): { sunrise: number; sunset: number } {
		return {
			sunrise: 6 * 60,  // 6:00 AM = 360 minutes
			sunset: 18 * 60   // 6:00 PM = 1080 minutes
		};
	}

	/**
	 * Get sunrise/sunset times for a given day, optionally filtered by region
	 *
	 * Algorithm:
	 * 1. If region is provided, find season matching both date and region
	 * 2. If no region-specific season found, fall back to generic season
	 * 3. If no season found at all, return default solar times
	 *
	 * This allows calendars to define region-specific solar overrides while
	 * maintaining backwards compatibility with non-region seasons.
	 *
	 * @param absoluteDay Absolute day counter
	 * @param context Optional context with region filter
	 * @returns Object with sunrise and sunset in minutes from midnight
	 */
	getSolarTimes(absoluteDay: number, context?: { region?: string }): { sunrise: number; sunset: number } {
		// If no seasons defined, return defaults
		if (!this.calendar.seasons || this.calendar.seasons.length === 0) {
			return this.getDefaultSolarTimes();
		}

		// Get the current date
		const date = this.getDate(absoluteDay);

		// If region context provided, try to find region-specific season first
		if (context?.region) {
			const regionSpecificSeason = this.findRegionSeason(date.monthIndex, date.dayOfMonth, context.region);

			if (regionSpecificSeason) {
				// Region-specific season found - use its solar times
				return {
					sunrise: regionSpecificSeason.sunrise,
					sunset: regionSpecificSeason.sunset
				};
			}
		}

		// No region context or no region-specific season found
		// Fall back to standard season (no region filter)
		const season = this.getSeason(absoluteDay);

		if (season) {
			return {
				sunrise: season.sunrise,
				sunset: season.sunset
			};
		}

		// No season found at all - return defaults
		return this.getDefaultSolarTimes();
	}

	/**
	 * Get current time of day in minutes from midnight
	 *
	 * @returns Minutes from midnight (0-1439)
	 */
	getTimeOfDay(): number {
		return this.timeOfDay;
	}

	/**
	 * Set time of day in minutes from midnight
	 * Clamps value to valid range (0-1439)
	 *
	 * @param minutes Minutes from midnight (0-1439)
	 */
	setTimeOfDay(minutes: number): void {
		// Clamp to valid range
		this.timeOfDay = Math.max(0, Math.min(1439, Math.floor(minutes)));
	}

	/**
	 * Advance time by a given number of minutes
	 * Returns the number of days that rolled over (0 if no rollover, 1+ if days passed)
	 *
	 * @param minutes Number of minutes to advance
	 * @returns Number of days rolled over
	 */
	advanceTime(minutes: number): number {
		if (minutes < 0) {
			throw new Error('Cannot advance time by negative minutes');
		}

		const totalMinutes = this.timeOfDay + minutes;
		const daysRolledOver = Math.floor(totalMinutes / 1440);
		this.timeOfDay = totalMinutes % 1440;

		return daysRolledOver;
	}

	/**
	 * Get sunrise time for a given absolute day
	 * Uses season definitions if available, otherwise returns default
	 *
	 * @param absoluteDay Absolute day counter
	 * @returns Sunrise time in minutes from midnight
	 */
	getSunrise(absoluteDay: number): number {
		const season = this.getSeason(absoluteDay);
		if (season) {
			return season.sunrise;
		}
		return this.getDefaultSolarTimes().sunrise;
	}

	/**
	 * Get sunset time for a given absolute day
	 * Uses season definitions if available, otherwise returns default
	 *
	 * @param absoluteDay Absolute day counter
	 * @returns Sunset time in minutes from midnight
	 */
	getSunset(absoluteDay: number): number {
		const season = this.getSeason(absoluteDay);
		if (season) {
			return season.sunset;
		}
		return this.getDefaultSolarTimes().sunset;
	}

	/**
	 * Get current sun state based on time of day and season
	 * Dawn/dusk periods extend ±TWILIGHT_DURATION minutes from sunrise/sunset
	 *
	 * @param absoluteDay Absolute day counter (for season calculation)
	 * @param timeOfDay Time of day in minutes from midnight (uses current time if not provided)
	 * @returns Sun state: 'day', 'dawn', 'dusk', or 'night'
	 */
	getSunState(absoluteDay: number, timeOfDay?: number): 'day' | 'dawn' | 'dusk' | 'night' {
		const currentTime = timeOfDay ?? this.timeOfDay;
		const sunrise = this.getSunrise(absoluteDay);
		const sunset = this.getSunset(absoluteDay);

		// Dawn period: sunrise - TWILIGHT_DURATION to sunrise + TWILIGHT_DURATION
		const dawnStart = sunrise - this.TWILIGHT_DURATION;
		const dawnEnd = sunrise + this.TWILIGHT_DURATION;

		// Dusk period: sunset - TWILIGHT_DURATION to sunset + TWILIGHT_DURATION
		const duskStart = sunset - this.TWILIGHT_DURATION;
		const duskEnd = sunset + this.TWILIGHT_DURATION;

		if (currentTime >= dawnStart && currentTime < dawnEnd) {
			return 'dawn';
		} else if (currentTime >= dawnEnd && currentTime < duskStart) {
			return 'day';
		} else if (currentTime >= duskStart && currentTime < duskEnd) {
			return 'dusk';
		} else {
			return 'night';
		}
	}

	/**
	 * Get light level based on sun state
	 * Provides baseline light levels for environmental calculations
	 *
	 * @param absoluteDay Absolute day counter (for season calculation)
	 * @param timeOfDay Time of day in minutes from midnight (uses current time if not provided)
	 * @returns Light level: 'bright', 'dim', or 'dark'
	 */
	getLightLevel(absoluteDay: number, timeOfDay?: number): 'bright' | 'dim' | 'dark' {
		const sunState = this.getSunState(absoluteDay, timeOfDay);

		switch (sunState) {
			case 'day':
				return 'bright';
			case 'dawn':
			case 'dusk':
				return 'dim';
			case 'night':
				return 'dark';
		}
	}

	/**
	 * Calculate the absolute day for a given date
	 *
	 * @param year Year number
	 * @param monthIndex Month index (0-indexed)
	 * @param dayOfMonth Day of month (1-indexed)
	 * @returns Absolute day counter
	 */
	getAbsoluteDay(year: number, monthIndex: number, dayOfMonth: number): number {
		if (!this.hasMonths()) {
			return dayOfMonth - 1;  // Simple counter mode
		}

		// If no leap rules, use simple calculation
		if (!this.hasLeapRules()) {
			return this.getAbsoluteDaySimple(year, monthIndex, dayOfMonth);
		}

		return this.getAbsoluteDayWithLeap(year, monthIndex, dayOfMonth);
	}

	/**
	 * Simple absolute day calculation for calendars without leap rules
	 */
	private getAbsoluteDaySimple(year: number, monthIndex: number, dayOfMonth: number): number {
		const yearsElapsed = year - this.baseYear;
		const daysFromYears = yearsElapsed * this.totalDaysInYear;

		// Get days within year
		const daysBeforeMonth = monthIndex > 0 ? this.monthStartDays[monthIndex] : 0;
		const daysInMonth = dayOfMonth - 1;  // Convert to 0-indexed

		return daysFromYears + daysBeforeMonth + daysInMonth;
	}

	/**
	 * Absolute day calculation for calendars with leap rules
	 */
	private getAbsoluteDayWithLeap(year: number, monthIndex: number, dayOfMonth: number): number {
		// Calculate days to start of year
		const daysToYear = this.calculateDaysToYear(year);

		// Calculate days within year, accounting for leap days
		let daysWithinYear = 0;
		const leapTargetMonth = this.getLeapDayTargetMonth(year);

		for (let i = 0; i < monthIndex; i++) {
			let monthDays = this.calendar.months[i].days;
			if (leapTargetMonth === i) {
				monthDays += 1;
			}
			daysWithinYear += monthDays;
		}

		daysWithinYear += dayOfMonth - 1;  // Add days in current month (0-indexed)

		return daysToYear + daysWithinYear;
	}

	// ==========================================================================
	// Private Methods
	// ==========================================================================

	/**
	 * Create a CalendarDate for simple counter mode (no months)
	 */
	private createSimpleCounterDate(absoluteDay: number): CalendarDate {
		// Simple counter mode still uses year 0, so calculate suffix for that
		const yearSuffix = this.calculateYearSuffix(0);

		return {
			absoluteDay,
			dayOfMonth: 0,
			monthIndex: -1,
			monthName: '',
			year: 0,
			dayOfWeek: '',
			dayOfWeekIndex: -1,
			dayOfYear: absoluteDay,
			yearSuffix,
			isSimpleCounter: true,
			isIntercalary: false
		};
	}

	/**
	 * Calculate total days in a year from month definitions
	 */
	private calculateTotalDaysInYear(): number {
		if (!this.hasMonths()) {
			return 0;
		}
		return this.calendar.months.reduce((sum, month) => sum + month.days, 0);
	}


	/**
	 * Calculate count of non-intercalary days in a year
	 * These are the days that count toward weekday advancement
	 */
	private calculateWeekCountingDaysInYear(): number {
		if (!this.hasMonths()) {
			return 0;
		}
		return this.calendar.months.reduce((sum, month) => {
			if (month.type === 'intercalary') {
				return sum;  // Intercalary days don't count
			}
			return sum + month.days;
		}, 0);
	}

	/**
	 * Pre-calculate cumulative intercalary days before each month index
	 * Used to subtract from absolute day when calculating weekday
	 */
	private calculateIntercalaryDaysBeforeMonth(): number[] {
		if (!this.hasMonths()) {
			return [];
		}

		const intercalaryBefore: number[] = [];
		let cumulative = 0;

		for (const month of this.calendar.months) {
			intercalaryBefore.push(cumulative);
			if (month.type === 'intercalary') {
				cumulative += month.days;
			}
		}

		return intercalaryBefore;
	}
	/**
	 * Pre-calculate cumulative days at the start of each month
	 * Used for O(log n) month lookups via binary search
	 */
	private calculateMonthStartDays(): number[] {
		if (!this.hasMonths()) {
			return [];
		}

		const startDays: number[] = [];
		let cumulative = 0;

		for (const month of this.calendar.months) {
			startDays.push(cumulative);
			cumulative += month.days;
		}

		return startDays;
	}

	/**
	 * Calculate year and day of year from absolute day
	 *
	 * Uses safe integer arithmetic to handle very large day values.
	 * When leap rules are defined, iterates through years to handle variable year lengths.
	 */
	private calculateYearAndDayOfYear(absoluteDay: number): { year: number; dayOfYear: number } {
		if (this.totalDaysInYear === 0) {
			return { year: 0, dayOfYear: 0 };
		}

		// If no leap rules, use fast calculation
		if (!this.hasLeapRules()) {
			return this.calculateYearAndDayOfYearSimple(absoluteDay);
		}

		// With leap rules, we need to iterate through years
		return this.calculateYearAndDayOfYearWithLeap(absoluteDay);
	}

	/**
	 * Simple year/day calculation for calendars without leap rules
	 */
	private calculateYearAndDayOfYearSimple(absoluteDay: number): { year: number; dayOfYear: number } {
		// Use Math.floor for consistent behavior with negative days (if ever supported)
		const yearsElapsed = Math.floor(absoluteDay / this.totalDaysInYear);
		const dayOfYear = absoluteDay % this.totalDaysInYear;

		// Handle negative modulo (JavaScript quirk)
		const normalizedDayOfYear = dayOfYear < 0
			? dayOfYear + this.totalDaysInYear
			: dayOfYear;

		const year = this.baseYear + yearsElapsed;

		return { year, dayOfYear: normalizedDayOfYear };
	}

	/**
	 * Year/day calculation for calendars with leap rules
	 *
	 * For efficiency with large day counts, we use an estimated year first,
	 * then adjust based on actual leap day counts.
	 */
	private calculateYearAndDayOfYearWithLeap(absoluteDay: number): { year: number; dayOfYear: number } {
		// Get an initial estimate using average year length
		// Gregorian average: 365.2425 days. We use the base year length for initial estimate.
		const avgYearLength = this.totalDaysInYear + 0.25; // Approximate for 4-year cycles
		let estimatedYearsElapsed = Math.floor(absoluteDay / avgYearLength);
		let currentYear = this.baseYear + estimatedYearsElapsed;

		// Calculate actual days elapsed to the start of estimated year
		let daysToCurrentYear = this.calculateDaysToYear(currentYear);

		// Adjust if we overestimated or underestimated
		while (daysToCurrentYear > absoluteDay && currentYear > this.baseYear) {
			currentYear--;
			daysToCurrentYear = this.calculateDaysToYear(currentYear);
		}

		while (daysToCurrentYear + this.getDaysInYear(currentYear) <= absoluteDay) {
			daysToCurrentYear += this.getDaysInYear(currentYear);
			currentYear++;
		}

		const dayOfYear = absoluteDay - daysToCurrentYear;

		return { year: currentYear, dayOfYear };
	}

	/**
	 * Calculate total absolute days from base year to the start of a given year
	 * Accounts for leap years in the range
	 */
	private calculateDaysToYear(targetYear: number): number {
		if (targetYear === this.baseYear) {
			return 0;
		}

		const yearsElapsed = targetYear - this.baseYear;
		const baseDays = yearsElapsed * this.totalDaysInYear;

		// Add leap days that occurred between baseYear and targetYear
		const leapDays = getLeapDaysBefore(targetYear, this.baseYear, this.calendar.leapRules);

		return baseDays + leapDays;
	}

	/**
	 * Calculate month index and day of month from day of year
	 *
	 * Uses binary search for O(log n) performance with many months.
	 * When leap rules are defined, accounts for the leap day in the target month.
	 */
	private calculateMonthAndDay(dayOfYear: number, year?: number): { monthIndex: number; dayOfMonth: number } {
		// If no leap rules or year not provided, use cached month start days
		if (!this.hasLeapRules() || year === undefined) {
			return this.calculateMonthAndDaySimple(dayOfYear);
		}

		return this.calculateMonthAndDayWithLeap(dayOfYear, year);
	}

	/**
	 * Simple month/day calculation for calendars without leap rules
	 */
	private calculateMonthAndDaySimple(dayOfYear: number): { monthIndex: number; dayOfMonth: number } {
		// Binary search for the correct month
		let left = 0;
		let right = this.calendar.months.length - 1;
		let monthIndex = 0;

		while (left <= right) {
			const mid = Math.floor((left + right) / 2);
			const monthStart = this.monthStartDays[mid];
			const monthEnd = monthStart + this.calendar.months[mid].days;

			if (dayOfYear < monthStart) {
				right = mid - 1;
			} else if (dayOfYear >= monthEnd) {
				left = mid + 1;
			} else {
				monthIndex = mid;
				break;
			}
		}

		// Calculate day of month (1-indexed)
		const dayOfMonth = dayOfYear - this.monthStartDays[monthIndex] + 1;

		return { monthIndex, dayOfMonth };
	}

	/**
	 * Month/day calculation for calendars with leap rules
	 * Accounts for leap day in the target month
	 */
	private calculateMonthAndDayWithLeap(dayOfYear: number, year: number): { monthIndex: number; dayOfMonth: number } {
		const leapTargetMonth = this.getLeapDayTargetMonth(year);
		let cumulativeDays = 0;

		for (let i = 0; i < this.calendar.months.length; i++) {
			const month = this.calendar.months[i];
			let monthDays = month.days;

			// Add leap day if this is the target month for this leap year
			if (leapTargetMonth === i) {
				monthDays += 1;
			}

			if (dayOfYear < cumulativeDays + monthDays) {
				const dayOfMonth = dayOfYear - cumulativeDays + 1;
				return { monthIndex: i, dayOfMonth };
			}

			cumulativeDays += monthDays;
		}

		// Fallback to last month (should not happen with valid input)
		const lastIndex = this.calendar.months.length - 1;
		return { monthIndex: lastIndex, dayOfMonth: dayOfYear - cumulativeDays + 1 };
	}

	/**
	 * Calculate weekday index from absolute day
	 */
	/**
	 * Calculate weekday index from absolute day
	 *
	 * For calendars with intercalary days, this method counts only non-intercalary
	 * days to determine the weekday. This ensures weekdays remain consistent
	 * across intercalary periods.
	 *
	 * Example: Hammer 30 (Sunday) -> Midwinter 1 (no weekday) -> Alturiak 1 (Monday)
	 */
	private calculateWeekdayIndex(absoluteDay: number): number {
		const weekLength = this.calendar.weekdays.length;
		if (weekLength === 0) {
			return -1;
		}

		// If no intercalary months, use simple calculation
		if (!this.hasIntercalaryMonths()) {
			const index = absoluteDay % weekLength;
			return index < 0 ? index + weekLength : index;
		}

		// For calendars with intercalary days, we need to count only non-intercalary days
		// Calculate how many "week-counting" days have elapsed
		const weekCountingDay = this.calculateWeekCountingDay(absoluteDay);

		// Handle negative days (defensive)
		const index = weekCountingDay % weekLength;
		return index < 0 ? index + weekLength : index;
	}

	/**
	 * Calculate the "week-counting day" for a given absolute day
	 *
	 * This is the count of non-intercalary days from day 0 up to (but not including
	 * if the current day is intercalary) the given absolute day.
	 *
	 * Used for weekday calculations in calendars with intercalary periods.
	 */
	private calculateWeekCountingDay(absoluteDay: number): number {
		if (!this.hasMonths() || this.weekCountingDaysInYear === 0) {
			return absoluteDay;
		}

		// Calculate how many complete years of "week-counting" days
		const { year, dayOfYear } = this.calculateYearAndDayOfYear(absoluteDay);
		const yearsElapsed = year - this.baseYear;
		const weekDaysFromYears = yearsElapsed * this.weekCountingDaysInYear;

		// Calculate week-counting days within the current year
		const { monthIndex, dayOfMonth } = this.calculateMonthAndDay(dayOfYear, year);

		// Count all non-intercalary days in months before the current month
		let weekDaysInYear = 0;
		for (let i = 0; i < monthIndex; i++) {
			const month = this.calendar.months[i];
			if (month.type !== 'intercalary') {
				weekDaysInYear += month.days;
			}
		}

		// Add days in current month (only if not intercalary)
		const currentMonth = this.calendar.months[monthIndex];
		if (currentMonth && currentMonth.type !== 'intercalary') {
			weekDaysInYear += dayOfMonth - 1;  // 0-indexed within month
		}

		return weekDaysFromYears + weekDaysInYear;
	}

	/**
	 * Calculate day of week name and index
	 */
	private calculateDayOfWeek(absoluteDay: number): { dayOfWeek: string; dayOfWeekIndex: number } {
		if (!this.hasWeekdays()) {
			return { dayOfWeek: '', dayOfWeekIndex: -1 };
		}

		const dayOfWeekIndex = this.calculateWeekdayIndex(absoluteDay);
		const dayOfWeek = this.calendar.weekdays[dayOfWeekIndex];

		return { dayOfWeek, dayOfWeekIndex };
	}

	/**
	 * Calculate year suffix with era support
	 * If eras are defined, uses era abbreviation and handles negative years with direction
	 * Falls back to legacy yearSuffix if no eras defined
	 *
	 * @param year Year number
	 * @returns Formatted year suffix (e.g., "DR", "BD", "AD")
	 */
	private calculateYearSuffix(year: number): string {
		const era = this.getEra(year);

		if (era) {
			// Era found - use its abbreviation
			return era.abbrev;
		}

		// No era found - fall back to legacy yearSuffix
		return this.calendar.yearSuffix || '';
	}

	/**
	 * Find the active season for a given month and day
	 * Only considers seasons WITHOUT region tags (standard/default seasons)
	 * Handles seasons that cross year boundaries (e.g., Winter: Dec-Feb)
	 *
	 * Algorithm:
	 * 1. Filter to only seasons without region tags
	 * 2. Sort filtered seasons by start date (month, then day)
	 * 3. Find the last season whose start date is <= the given date
	 * 4. If no such season exists, the last season in the year wraps around
	 *
	 * @param monthIndex Current month (0-indexed)
	 * @param dayOfMonth Current day of month (1-indexed)
	 * @returns Active season or undefined if no seasons defined
	 */
	private findActiveSeason(monthIndex: number, dayOfMonth: number): Season | undefined {
		if (!this.calendar.seasons || this.calendar.seasons.length === 0) {
			return undefined;
		}

		// Filter to only seasons without region tags (standard/default seasons)
		const nonRegionSeasons = this.calendar.seasons.filter(s => !s.region);

		if (nonRegionSeasons.length === 0) {
			return undefined;
		}

		// Sort seasons by start date (month, then day)
		const sortedSeasons = [...nonRegionSeasons].sort((a, b) => {
			if (a.startMonth !== b.startMonth) {
				return a.startMonth - b.startMonth;
			}
			return a.startDay - b.startDay;
		});

		// Find the last season whose start date is <= current date
		let activeSeason: Season | undefined = undefined;

		for (const season of sortedSeasons) {
			// Check if season starts before or on current date
			if (season.startMonth < monthIndex ||
				(season.startMonth === monthIndex && season.startDay <= dayOfMonth)) {
				activeSeason = season;
			} else {
				// We've passed the current date, stop searching
				break;
			}
		}

		// If no season found, it means we're in the last season of the year
		// (which wraps around from the previous year)
		if (activeSeason === undefined) {
			activeSeason = sortedSeasons[sortedSeasons.length - 1];
		}

		return activeSeason;
	}

	/**
	 * Find the active season for a specific region
	 * Only returns seasons with a matching region tag
	 *
	 * @param monthIndex Current month (0-indexed)
	 * @param dayOfMonth Current day of month (1-indexed)
	 * @param region Region filter ('temperate' | 'polar' | 'tropical')
	 * @returns Region-specific season or undefined
	 */
	private findRegionSeason(monthIndex: number, dayOfMonth: number, region: string): Season | undefined {
		if (!this.calendar.seasons || this.calendar.seasons.length === 0) {
			return undefined;
		}

		// Filter to only seasons matching the region
		const regionSeasons = this.calendar.seasons.filter(s => s.region === region);

		if (regionSeasons.length === 0) {
			return undefined;
		}

		// Sort by start date
		const sortedSeasons = [...regionSeasons].sort((a, b) => {
			if (a.startMonth !== b.startMonth) {
				return a.startMonth - b.startMonth;
			}
			return a.startDay - b.startDay;
		});

		// Find the last season whose start date is <= current date
		let activeSeason: Season | undefined = undefined;

		for (const season of sortedSeasons) {
			if (season.startMonth < monthIndex ||
				(season.startMonth === monthIndex && season.startDay <= dayOfMonth)) {
				activeSeason = season;
			} else {
				break;
			}
		}

		// If no season found, wrap to last season of previous year
		if (activeSeason === undefined && sortedSeasons.length > 0) {
			activeSeason = sortedSeasons[sortedSeasons.length - 1];
		}

		return activeSeason;
	}
}
