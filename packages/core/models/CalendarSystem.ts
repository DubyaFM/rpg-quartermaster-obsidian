/**
 * CalendarSystem Model
 *
 * Defines calendar systems at the world level.
 * Campaigns track current date using a calendar system.
 *
 * Related interfaces:
 * - CalendarDefinition in types.ts provides runtime calendar configuration
 * - This model provides preset calendar systems for world-level configuration
 */

/**
 * Calendar Month Definition
 * Represents a single month in a calendar system
 */
export interface CalendarMonth {
	/** Name of the month (e.g., "Hammer", "January") */
	name: string;
	/** Number of days in this month */
	days: number;
	/** Optional season designation (e.g., "Winter", "Summer") */
	season?: string;
}

/**
 * Calendar System Definition
 * Defines a complete calendar system for a world
 */
export interface CalendarSystem {
	/** Unique identifier for this calendar system (e.g., "faerun-harptos", "gregorian") */
	id: string;
	/** Display name of the calendar system (e.g., "Calendar of Harptos", "Gregorian Calendar") */
	name: string;
	/** Array of months in this calendar system */
	months: CalendarMonth[];
	/** Number of days in a week */
	daysPerWeek: number;
	/** Names of weekdays in order (e.g., ["Sunday", "Monday", ...]) */
	weekdayNames: string[];
}

/**
 * Preset Calendar Systems
 * Pre-configured calendar systems for common game worlds
 */
export const PRESET_CALENDAR_SYSTEMS: CalendarSystem[] = [
	{
		id: 'gregorian',
		name: 'Gregorian Calendar',
		months: [
			{ name: 'January', days: 31, season: 'Winter' },
			{ name: 'February', days: 28, season: 'Winter' },
			{ name: 'March', days: 31, season: 'Spring' },
			{ name: 'April', days: 30, season: 'Spring' },
			{ name: 'May', days: 31, season: 'Spring' },
			{ name: 'June', days: 30, season: 'Summer' },
			{ name: 'July', days: 31, season: 'Summer' },
			{ name: 'August', days: 31, season: 'Summer' },
			{ name: 'September', days: 30, season: 'Fall' },
			{ name: 'October', days: 31, season: 'Fall' },
			{ name: 'November', days: 30, season: 'Fall' },
			{ name: 'December', days: 31, season: 'Winter' }
		],
		daysPerWeek: 7,
		weekdayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
	},
	{
		id: 'faerun-harptos',
		name: 'Calendar of Harptos (Forgotten Realms)',
		months: [
			{ name: 'Hammer', days: 30, season: 'Winter' },
			{ name: 'Midwinter', days: 1, season: 'Winter' }, // Festival day
			{ name: 'Alturiak', days: 30, season: 'Winter' },
			{ name: 'Ches', days: 30, season: 'Spring' },
			{ name: 'Tarsakh', days: 30, season: 'Spring' },
			{ name: 'Greengrass', days: 1, season: 'Spring' }, // Festival day
			{ name: 'Mirtul', days: 30, season: 'Spring' },
			{ name: 'Kythorn', days: 30, season: 'Summer' },
			{ name: 'Flamerule', days: 30, season: 'Summer' },
			{ name: 'Midsummer', days: 1, season: 'Summer' }, // Festival day
			{ name: 'Eleasis', days: 30, season: 'Summer' },
			{ name: 'Eleint', days: 30, season: 'Fall' },
			{ name: 'Highharvestide', days: 1, season: 'Fall' }, // Festival day
			{ name: 'Marpenoth', days: 30, season: 'Fall' },
			{ name: 'Uktar', days: 30, season: 'Fall' },
			{ name: 'Feast of the Moon', days: 1, season: 'Fall' }, // Festival day
			{ name: 'Nightal', days: 30, season: 'Winter' }
		],
		daysPerWeek: 10,
		weekdayNames: [
			'First Day',
			'Second Day',
			'Third Day',
			'Fourth Day',
			'Fifth Day',
			'Sixth Day',
			'Seventh Day',
			'Eighth Day',
			'Ninth Day',
			'Tenth Day'
		]
	},
	{
		id: 'golarion-absalom',
		name: 'Absalom Reckoning (Pathfinder)',
		months: [
			{ name: 'Abadius', days: 31, season: 'Winter' },
			{ name: 'Calistril', days: 28, season: 'Winter' },
			{ name: 'Pharast', days: 31, season: 'Spring' },
			{ name: 'Gozran', days: 30, season: 'Spring' },
			{ name: 'Desnus', days: 31, season: 'Spring' },
			{ name: 'Sarenith', days: 30, season: 'Summer' },
			{ name: 'Erastus', days: 31, season: 'Summer' },
			{ name: 'Arodus', days: 31, season: 'Summer' },
			{ name: 'Rova', days: 30, season: 'Fall' },
			{ name: 'Lamashan', days: 31, season: 'Fall' },
			{ name: 'Neth', days: 30, season: 'Fall' },
			{ name: 'Kuthona', days: 31, season: 'Winter' }
		],
		daysPerWeek: 7,
		weekdayNames: ['Moonday', 'Toilday', 'Wealday', 'Oathday', 'Fireday', 'Starday', 'Sunday']
	},
	{
		id: 'simple-counter',
		name: 'Simple Day Counter',
		months: [
			{ name: 'Day', days: 1 } // Single "month" that repeats indefinitely
		],
		daysPerWeek: 1,
		weekdayNames: ['Day']
	}
];
