/**
 * Fantasy-Calendar.com JSON Parser
 *
 * Converts app.fantasy-calendar.com JSON exports to Quartermaster CalendarDefinition format.
 *
 * Supported Features:
 * - Months (standard and intercalary)
 * - Weekdays
 * - Leap days with complex interval rules
 * - Events (converted to holidays for recurring annual events)
 * - Years/Eras
 * - Seasons with sunrise/sunset times
 *
 * Not Imported (Future):
 * - Moons (requires separate celestial system)
 * - Cycles (requires separate tracking system)
 * - Event categories (metadata only)
 * - One-off events (not part of calendar definition)
 */

import {
	CalendarDefinition,
	CalendarMonth,
	CalendarHoliday,
	Era,
	LeapRule,
	Season
} from '../models/types';

/**
 * Fantasy-Calendar.com JSON format interfaces
 * Based on REF-CalendarJSON.md specification
 */
export interface FCMonth {
	name: string;
	length: number;
	type: 'standard' | 'intercalary';
	subtitle?: string;
	week_data?: {
		days: string[];
		length: number;
	};
}

export interface FCWeekday {
	name: string;
}

export interface FCYear {
	id?: string;
	name: string;
	numeric: number;
}

export interface FCLeapDay {
	name: string;
	intercalary: boolean;
	timespan: number;  // Month index to add leap day to
	interval: string;  // e.g., "1,4,!100,400"
	offset: number;
}

export interface FCSeason {
	name: string;
	day_index: number;  // Day of year (1-indexed)
	color?: string;
	time?: {
		sunrise: number;  // Minutes from midnight
		sunset: number;
	};
}

export interface FCEvent {
	name: string;
	description?: string;
	event_category_id?: string;
	data: {
		date: {
			year?: number;  // undefined = recurring annual event
			month: number;
			day: number;
		};
		conditions?: any;
	};
}

export interface FCCalendar {
	name: string;
	description?: string;
	static_data?: {
		year?: number;
		year_data?: {
			timespan?: number;
			global_week?: string[];
			day_offset?: number;
			first_day?: number;
			overflow?: boolean;
		};
	};
	weekdays?: FCWeekday[];
	months?: FCMonth[];
	years?: FCYear[];
	leap_days?: FCLeapDay[];
	seasons?: FCSeason[];
	events?: FCEvent[];
	moons?: any[];  // Not imported yet
	cycles?: any[];  // Not imported yet
	event_categories?: any[];  // Not imported yet
}

/**
 * Parse result with warnings
 */
export interface ParseResult {
	calendar: CalendarDefinition;
	warnings: string[];
}

/**
 * Fantasy-Calendar.com JSON Parser
 */
export class FantasyCalendarParser {
	/**
	 * Parse Fantasy-Calendar.com JSON string into CalendarDefinition
	 *
	 * @param jsonString JSON string from FC.com export
	 * @returns Parse result with calendar and warnings
	 * @throws Error if JSON is invalid or required fields are missing
	 */
	parse(jsonString: string): ParseResult {
		const warnings: string[] = [];

		// Parse JSON
		let fcCalendar: FCCalendar;
		try {
			fcCalendar = JSON.parse(jsonString);
		} catch (error) {
			throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
		}

		// Validate required fields
		if (!fcCalendar.name) {
			throw new Error('Missing required field: name');
		}

		if (!fcCalendar.months || fcCalendar.months.length === 0) {
			throw new Error('Missing required field: months array must not be empty');
		}

		// Generate ID from name (lowercase, replace spaces with dashes)
		const id = fcCalendar.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

		// Parse weekdays
		const weekdays = this.parseWeekdays(fcCalendar, warnings);

		// Parse months
		const months = this.parseMonths(fcCalendar, warnings);

		// Parse leap rules
		const leapRules = this.parseLeapRules(fcCalendar, warnings);

		// Parse holidays from events
		const holidays = this.parseHolidays(fcCalendar, warnings);

		// Parse eras from years
		const eras = this.parseEras(fcCalendar, warnings);

		// Parse seasons
		const seasons = this.parseSeasons(fcCalendar, warnings);

		// Extract starting year
		const startingYear = fcCalendar.static_data?.year;

		const calendar: CalendarDefinition = {
			id,
			name: fcCalendar.name,
			description: fcCalendar.description,
			weekdays,
			months,
			holidays,
			startingYear,
			eras,
			leapRules: leapRules.length > 0 ? leapRules : undefined,
			seasons: seasons.length > 0 ? seasons : undefined
		};

		return { calendar, warnings };
	}

	/**
	 * Parse weekdays array
	 */
	private parseWeekdays(fcCalendar: FCCalendar, warnings: string[]): string[] {
		// Try weekdays array first
		if (fcCalendar.weekdays && fcCalendar.weekdays.length > 0) {
			return fcCalendar.weekdays.map(w => w.name);
		}

		// Fall back to global_week
		if (fcCalendar.static_data?.year_data?.global_week) {
			return fcCalendar.static_data.year_data.global_week;
		}

		// Default to no weekdays (pure day counter)
		warnings.push('No weekdays found, using empty weekday array (pure day counter mode)');
		return [];
	}

	/**
	 * Parse months array
	 */
	private parseMonths(fcCalendar: FCCalendar, warnings: string[]): CalendarMonth[] {
		if (!fcCalendar.months) {
			return [];
		}

		return fcCalendar.months.map((fcMonth, index) => ({
			name: fcMonth.name,
			days: fcMonth.length,
			order: index,
			type: fcMonth.type || 'standard'
		}));
	}

	/**
	 * Parse leap day rules into LeapRule format
	 *
	 * FC.com interval format: "1,4,!100,400"
	 * - Comma-separated list of integers
	 * - ! prefix means "except"
	 * - Evaluated left-to-right
	 *
	 * Example: "1,4,!100,400"
	 * - Base: every 4 years
	 * - Except: not every 100 years
	 * - Unless: every 400 years
	 *
	 * Our format uses nested LeapRule with exclude array
	 */
	private parseLeapRules(fcCalendar: FCCalendar, warnings: string[]): LeapRule[] {
		if (!fcCalendar.leap_days || fcCalendar.leap_days.length === 0) {
			return [];
		}

		const rules: LeapRule[] = [];

		for (const leapDay of fcCalendar.leap_days) {
			try {
				const rule = this.parseIntervalString(
					leapDay.interval,
					leapDay.offset,
					leapDay.timespan
				);

				rules.push(rule);
			} catch (error) {
				warnings.push(
					`Failed to parse leap day "${leapDay.name}": ${error instanceof Error ? error.message : String(error)}`
				);
			}
		}

		return rules;
	}

	/**
	 * Parse FC.com interval string to LeapRule
	 *
	 * Format: "1,4,!100,400"
	 * - First number is always base (usually 1)
	 * - Second number is the interval
	 * - ! prefix means exception
	 *
	 * @param intervalStr Interval string from FC.com
	 * @param offset Year offset
	 * @param targetMonth Month index to add leap day to
	 */
	private parseIntervalString(intervalStr: string, offset: number, targetMonth: number): LeapRule {
		const parts = intervalStr.split(',').map(p => p.trim());

		if (parts.length < 2) {
			throw new Error(`Invalid interval string: ${intervalStr}`);
		}

		// First number is base (usually 1, we ignore it)
		// Second number is the interval
		const interval = parseInt(parts[1], 10);
		if (isNaN(interval)) {
			throw new Error(`Invalid interval number: ${parts[1]}`);
		}

		const rule: LeapRule = {
			interval,
			offset,
			targetMonth
		};

		// Process exceptions (! prefix) and nested rules
		if (parts.length > 2) {
			const excludes: LeapRule[] = [];
			let i = 2;

			while (i < parts.length) {
				const part = parts[i];

				if (part.startsWith('!')) {
					// Exception rule
					const excInterval = parseInt(part.substring(1), 10);
					if (!isNaN(excInterval)) {
						// Check if next part is a "yes" override
						if (i + 1 < parts.length && !parts[i + 1].startsWith('!')) {
							const yesInterval = parseInt(parts[i + 1], 10);
							if (!isNaN(yesInterval)) {
								// Create exception with its own exclude
								excludes.push({
									interval: excInterval,
									offset,
									exclude: [{
										interval: yesInterval,
										offset
									}]
								});
								i += 2;
								continue;
							}
						}

						// Simple exception
						excludes.push({
							interval: excInterval,
							offset
						});
					}
				}
				i++;
			}

			if (excludes.length > 0) {
				rule.exclude = excludes;
			}
		}

		return rule;
	}

	/**
	 * Parse events into holidays (only recurring annual events)
	 */
	private parseHolidays(fcCalendar: FCCalendar, warnings: string[]): CalendarHoliday[] {
		if (!fcCalendar.events || fcCalendar.events.length === 0) {
			return [];
		}

		const holidays: CalendarHoliday[] = [];

		for (const event of fcCalendar.events) {
			// Only import events without a year (recurring annual events)
			if (event.data.date.year === undefined) {
				holidays.push({
					name: event.name,
					description: event.description,
					month: event.data.date.month,
					day: event.data.date.day,
					notifyOnArrival: true  // Default to notify for imported holidays
				});
			}
		}

		if (fcCalendar.events.length > holidays.length) {
			const oneOffCount = fcCalendar.events.length - holidays.length;
			warnings.push(
				`Skipped ${oneOffCount} one-off event(s). Only recurring annual events are imported as holidays.`
			);
		}

		return holidays;
	}

	/**
	 * Parse years array into eras
	 */
	private parseEras(fcCalendar: FCCalendar, warnings: string[]): Era[] | undefined {
		if (!fcCalendar.years || fcCalendar.years.length === 0) {
			return undefined;
		}

		// FC.com years are individual year names, not eras
		// We need to detect if there's a pattern that suggests era boundaries
		// For now, we'll create a generic era if we have year names
		const firstYear = fcCalendar.years[0];
		const lastYear = fcCalendar.years[fcCalendar.years.length - 1];

		// Check if there's a common suffix (like "DR")
		const nameParts = firstYear.name.split(/\s+/);
		const possibleSuffix = nameParts[nameParts.length - 1];

		// If multiple years have the same last word, it might be an era suffix
		const hasSuffix = fcCalendar.years.filter(y =>
			y.name.endsWith(possibleSuffix)
		).length > 1;

		if (hasSuffix && possibleSuffix.length <= 3) {
			// Looks like an era suffix
			return [{
				name: 'Default Era',
				abbrev: possibleSuffix,
				startYear: firstYear.numeric,
				endYear: undefined,
				direction: 1
			}];
		}

		warnings.push(
			'Year names found but no clear era pattern detected. Named years not imported.'
		);
		return undefined;
	}

	/**
	 * Parse seasons array
	 */
	private parseSeasons(fcCalendar: FCCalendar, warnings: string[]): Season[] {
		if (!fcCalendar.seasons || fcCalendar.seasons.length === 0) {
			return [];
		}

		const seasons: Season[] = [];

		for (const fcSeason of fcCalendar.seasons) {
			if (fcSeason.day_index === undefined || fcSeason.day_index === null) {
				warnings.push(`Season "${fcSeason.name}" missing day_index, skipped`);
				continue;
			}

			// Convert day_index (1-based day of year) to month+day
			const { month, day } = this.dayOfYearToMonthDay(
				fcSeason.day_index,
				fcCalendar.months || []
			);

			seasons.push({
				name: fcSeason.name,
				startMonth: month,
				startDay: day,
				sunrise: fcSeason.time?.sunrise ?? 360,  // Default 6am
				sunset: fcSeason.time?.sunset ?? 1140  // Default 7pm
			});
		}

		return seasons;
	}

	/**
	 * Convert day of year (1-indexed) to month (0-indexed) + day (1-indexed)
	 */
	private dayOfYearToMonthDay(dayOfYear: number, months: FCMonth[]): { month: number; day: number } {
		let remainingDays = dayOfYear - 1;  // Convert to 0-indexed

		for (let m = 0; m < months.length; m++) {
			if (remainingDays < months[m].length) {
				return {
					month: m,
					day: remainingDays + 1  // Convert back to 1-indexed
				};
			}
			remainingDays -= months[m].length;
		}

		// Day of year exceeds calendar length, return last day of last month
		const lastMonth = months[months.length - 1];
		return {
			month: months.length - 1,
			day: lastMonth.length
		};
	}
}
