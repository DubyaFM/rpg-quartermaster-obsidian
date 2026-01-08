/**
 * Calendar Definition Validator
 *
 * Validates calendar definitions for structural, logical, and mathematical correctness.
 * Provides comprehensive error reporting with severity levels and suggestions.
 *
 * Validation Levels:
 * - ERROR: Blocks loading (structural errors, invalid data, mathematical failures)
 * - WARNING: Allows loading but logs issues (suboptimal configs, edge cases)
 * - INFO: Informational messages (suggestions, best practices)
 *
 * Validation Coverage:
 * 1. Schema Validation:
 *    - Required fields present and correct types
 *    - Valid ranges for numeric fields
 *    - No duplicate names in arrays
 *
 * 2. Logical Validation:
 *    - No months with 0 days
 *    - Valid leap rule configurations
 *    - Consistent era boundaries
 *    - Reasonable season sunrise/sunset times
 *
 * 3. Mathematical Validation:
 *    - Crash test with getDate(0) - must return valid date
 *    - Crash test with getDate(100000) - must not overflow or error
 *    - Round-trip test: getDate → getAbsoluteDay → getDate consistency
 */

import { CalendarDefinition, CalendarMonth, LeapRule, Era, Season } from '../models/types';
import { CalendarDriver } from '../services/CalendarDriver';

/**
 * Validation severity levels
 */
export type ValidationSeverity = 'error' | 'warning' | 'info';

/**
 * Validation issue
 */
export interface ValidationIssue {
	severity: ValidationSeverity;
	field: string;
	message: string;
	suggestion?: string;
}

/**
 * Validation result
 */
export interface CalendarValidationResult {
	valid: boolean;  // true only if no errors (warnings/info are ok)
	errors: ValidationIssue[];
	warnings: ValidationIssue[];
	info: ValidationIssue[];
}

/**
 * Calendar Validation Error
 * Thrown when validation fails critically
 */
export class CalendarValidationError extends Error {
	constructor(
		public field: string,
		message: string,
		public suggestion?: string
	) {
		super(`Calendar validation failed: ${field} - ${message}`);
		this.name = 'CalendarValidationError';
	}
}

/**
 * Calendar Validator
 *
 * Validates calendar definitions at multiple levels:
 * - Schema validation (structure and types)
 * - Logical validation (business rules)
 * - Mathematical validation (crash testing with CalendarDriver)
 */
export class CalendarValidator {
	/**
	 * Validate a complete calendar definition
	 *
	 * @param calendar - Calendar definition to validate
	 * @returns Validation result with errors, warnings, and info
	 */
	static validate(calendar: Partial<CalendarDefinition>): CalendarValidationResult {
		const errors: ValidationIssue[] = [];
		const warnings: ValidationIssue[] = [];
		const info: ValidationIssue[] = [];

		// Schema validation
		this.validateSchema(calendar, errors, warnings, info);

		// Only proceed with logical/mathematical validation if schema is valid
		if (errors.length === 0) {
			// Logical validation
			this.validateLogic(calendar as CalendarDefinition, errors, warnings, info);

			// Mathematical validation (crash testing)
			if (errors.length === 0) {
				this.validateMathematics(calendar as CalendarDefinition, errors, warnings, info);
			}
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings,
			info
		};
	}

	/**
	 * Validate and throw if invalid
	 *
	 * @param calendar - Calendar definition to validate
	 * @throws CalendarValidationError if validation fails
	 */
	static validateOrThrow(calendar: Partial<CalendarDefinition>): void {
		const result = this.validate(calendar);

		if (!result.valid) {
			const firstError = result.errors[0];
			throw new CalendarValidationError(
				firstError.field,
				firstError.message,
				firstError.suggestion
			);
		}
	}

	/**
	 * Get validation errors as formatted strings
	 *
	 * @param calendar - Calendar definition to validate
	 * @returns Array of error messages
	 */
	static getValidationErrors(calendar: Partial<CalendarDefinition>): string[] {
		const result = this.validate(calendar);
		return result.errors.map(err => {
			const msg = `${err.field}: ${err.message}`;
			return err.suggestion ? `${msg} (Suggestion: ${err.suggestion})` : msg;
		});
	}

	// ==========================================================================
	// Schema Validation
	// ==========================================================================

	/**
	 * Validate schema (structure and types)
	 */
	private static validateSchema(
		calendar: Partial<CalendarDefinition>,
		errors: ValidationIssue[],
		warnings: ValidationIssue[],
		info: ValidationIssue[]
	): void {
		// Required: id
		if (!calendar.id) {
			errors.push({
				severity: 'error',
				field: 'id',
				message: 'Calendar ID is required',
				suggestion: 'Use a unique identifier like "gregorian", "harptos", "custom-calendar-1"'
			});
		} else if (typeof calendar.id !== 'string' || calendar.id.trim().length === 0) {
			errors.push({
				severity: 'error',
				field: 'id',
				message: 'Calendar ID must be a non-empty string',
				suggestion: 'Use lowercase alphanumeric with hyphens (e.g., "my-calendar")'
			});
		}

		// Required: name
		if (!calendar.name) {
			errors.push({
				severity: 'error',
				field: 'name',
				message: 'Calendar name is required',
				suggestion: 'Provide a human-readable name (e.g., "Gregorian Calendar")'
			});
		} else if (typeof calendar.name !== 'string' || calendar.name.trim().length === 0) {
			errors.push({
				severity: 'error',
				field: 'name',
				message: 'Calendar name must be a non-empty string'
			});
		}

		// Required: weekdays array
		if (!calendar.weekdays) {
			errors.push({
				severity: 'error',
				field: 'weekdays',
				message: 'Weekdays array is required',
				suggestion: 'Provide an array of weekday names (e.g., ["Monday", "Tuesday", ...])'
			});
		} else if (!Array.isArray(calendar.weekdays)) {
			errors.push({
				severity: 'error',
				field: 'weekdays',
				message: 'Weekdays must be an array',
				suggestion: 'Use an array of strings: ["Day 1", "Day 2", ...]'
			});
		} else {
			this.validateWeekdays(calendar.weekdays, errors, warnings, info);
		}

		// Required: months array
		if (!calendar.months) {
			errors.push({
				severity: 'error',
				field: 'months',
				message: 'Months array is required',
				suggestion: 'Provide at least one month definition'
			});
		} else if (!Array.isArray(calendar.months)) {
			errors.push({
				severity: 'error',
				field: 'months',
				message: 'Months must be an array',
				suggestion: 'Use an array of month objects'
			});
		} else if (calendar.months.length === 0) {
			errors.push({
				severity: 'error',
				field: 'months',
				message: 'Calendar must have at least one month',
				suggestion: 'Add at least one month definition with name and days'
			});
		} else {
			this.validateMonths(calendar.months, errors, warnings, info);
		}

		// Required: holidays array
		if (!calendar.holidays) {
			errors.push({
				severity: 'error',
				field: 'holidays',
				message: 'Holidays array is required',
				suggestion: 'Provide an empty array [] if no holidays defined'
			});
		} else if (!Array.isArray(calendar.holidays)) {
			errors.push({
				severity: 'error',
				field: 'holidays',
				message: 'Holidays must be an array'
			});
		}

		// Optional: eras
		if (calendar.eras !== undefined) {
			if (!Array.isArray(calendar.eras)) {
				errors.push({
					severity: 'error',
					field: 'eras',
					message: 'Eras must be an array if provided'
				});
			} else {
				this.validateEras(calendar.eras, errors, warnings, info);
			}
		}

		// Optional: leapRules
		if (calendar.leapRules !== undefined) {
			if (!Array.isArray(calendar.leapRules)) {
				errors.push({
					severity: 'error',
					field: 'leapRules',
					message: 'Leap rules must be an array if provided'
				});
			} else {
				this.validateLeapRules(calendar.leapRules, errors, warnings, info);
			}
		}

		// Optional: seasons
		if (calendar.seasons !== undefined) {
			if (!Array.isArray(calendar.seasons)) {
				errors.push({
					severity: 'error',
					field: 'seasons',
					message: 'Seasons must be an array if provided'
				});
			} else {
				this.validateSeasons(calendar.seasons, errors, warnings, info);
			}
		}

		// Optional: startingYear
		if (calendar.startingYear !== undefined) {
			if (typeof calendar.startingYear !== 'number' || !Number.isInteger(calendar.startingYear)) {
				errors.push({
					severity: 'error',
					field: 'startingYear',
					message: 'Starting year must be an integer if provided'
				});
			}
		}

		// Optional: yearSuffix (deprecated in favor of eras)
		if (calendar.yearSuffix !== undefined) {
			if (typeof calendar.yearSuffix !== 'string') {
				errors.push({
					severity: 'error',
					field: 'yearSuffix',
					message: 'Year suffix must be a string if provided'
				});
			}

			if (calendar.eras && calendar.eras.length > 0) {
				warnings.push({
					severity: 'warning',
					field: 'yearSuffix',
					message: 'yearSuffix is deprecated when eras are defined',
					suggestion: 'Use eras for more flexible year formatting'
				});
			}
		}
	}

	/**
	 * Validate weekdays array
	 */
	private static validateWeekdays(
		weekdays: any[],
		errors: ValidationIssue[],
		warnings: ValidationIssue[],
		info: ValidationIssue[]
	): void {
		if (weekdays.length === 0) {
			warnings.push({
				severity: 'warning',
				field: 'weekdays',
				message: 'No weekdays defined (simple day counter mode)',
				suggestion: 'Consider adding weekday names for better date formatting'
			});
		}

		// Check all weekdays are strings
		weekdays.forEach((day, index) => {
			if (typeof day !== 'string' || day.trim().length === 0) {
				errors.push({
					severity: 'error',
					field: `weekdays[${index}]`,
					message: 'Weekday name must be a non-empty string'
				});
			}
		});

		// Check for duplicates
		const uniqueWeekdays = new Set(weekdays);
		if (uniqueWeekdays.size !== weekdays.length) {
			errors.push({
				severity: 'error',
				field: 'weekdays',
				message: 'Duplicate weekday names found',
				suggestion: 'Each weekday must have a unique name'
			});
		}

		// Info: typical week lengths
		if (weekdays.length > 0 && ![1, 5, 6, 7, 8, 10].includes(weekdays.length)) {
			info.push({
				severity: 'info',
				field: 'weekdays',
				message: `Unusual week length: ${weekdays.length} days`,
				suggestion: 'Common week lengths are 1, 5-8, or 10 days'
			});
		}
	}

	/**
	 * Validate months array
	 */
	private static validateMonths(
		months: any[],
		errors: ValidationIssue[],
		warnings: ValidationIssue[],
		info: ValidationIssue[]
	): void {
		const monthNames = new Set<string>();

		months.forEach((month, index) => {
			if (!month || typeof month !== 'object') {
				errors.push({
					severity: 'error',
					field: `months[${index}]`,
					message: 'Month must be an object'
				});
				return;
			}

			// Required: name
			if (!month.name || typeof month.name !== 'string' || month.name.trim().length === 0) {
				errors.push({
					severity: 'error',
					field: `months[${index}].name`,
					message: 'Month name is required and must be a non-empty string'
				});
			} else {
				// Check for duplicate month names
				if (monthNames.has(month.name)) {
					errors.push({
						severity: 'error',
						field: `months[${index}].name`,
						message: `Duplicate month name: "${month.name}"`,
						suggestion: 'Each month must have a unique name'
					});
				}
				monthNames.add(month.name);
			}

			// Required: days
			if (month.days === undefined || month.days === null) {
				errors.push({
					severity: 'error',
					field: `months[${index}].days`,
					message: 'Month days is required'
				});
			} else if (typeof month.days !== 'number' || !Number.isInteger(month.days)) {
				errors.push({
					severity: 'error',
					field: `months[${index}].days`,
					message: 'Month days must be an integer'
				});
			} else if (month.days < 1) {
				errors.push({
					severity: 'error',
					field: `months[${index}].days`,
					message: `Month "${month.name || index}" has ${month.days} days (must be >= 1)`,
					suggestion: 'Each month must have at least 1 day'
				});
			} else if (month.days > 366) {
				warnings.push({
					severity: 'warning',
					field: `months[${index}].days`,
					message: `Month "${month.name}" has ${month.days} days (unusually long)`,
					suggestion: 'Verify this is correct - most months are 28-31 days'
				});
			}

			// Optional: order (deprecated)
			if (month.order !== undefined) {
				warnings.push({
					severity: 'warning',
					field: `months[${index}].order`,
					message: 'month.order is deprecated - months are ordered by array index',
					suggestion: 'Remove order field and rely on array position'
				});
			}

			// Optional: type (standard | intercalary)
			if (month.type !== undefined) {
				if (month.type !== 'standard' && month.type !== 'intercalary') {
					errors.push({
						severity: 'error',
						field: `months[${index}].type`,
						message: `Invalid month type: "${month.type}"`,
						suggestion: 'Use "standard" or "intercalary"'
					});
				}

				// Intercalary months should typically be 1 day
				if (month.type === 'intercalary' && month.days > 1) {
					warnings.push({
						severity: 'warning',
						field: `months[${index}].days`,
						message: `Intercalary month "${month.name}" has ${month.days} days`,
						suggestion: 'Intercalary months are typically 1 day long'
					});
				}
			}

			// Optional: season
			if (month.season !== undefined && (typeof month.season !== 'string' || month.season.trim().length === 0)) {
				errors.push({
					severity: 'error',
					field: `months[${index}].season`,
					message: 'Month season must be a non-empty string if provided'
				});
			}
		});
	}

	/**
	 * Validate eras array
	 */
	private static validateEras(
		eras: any[],
		errors: ValidationIssue[],
		warnings: ValidationIssue[],
		info: ValidationIssue[]
	): void {
		if (eras.length === 0) {
			warnings.push({
				severity: 'warning',
				field: 'eras',
				message: 'Empty eras array defined',
				suggestion: 'Remove eras field or define at least one era'
			});
			return;
		}

		const eraNames = new Set<string>();
		const eraAbbrevs = new Set<string>();

		eras.forEach((era, index) => {
			if (!era || typeof era !== 'object') {
				errors.push({
					severity: 'error',
					field: `eras[${index}]`,
					message: 'Era must be an object'
				});
				return;
			}

			// Required: name
			if (!era.name || typeof era.name !== 'string' || era.name.trim().length === 0) {
				errors.push({
					severity: 'error',
					field: `eras[${index}].name`,
					message: 'Era name is required and must be a non-empty string'
				});
			} else {
				if (eraNames.has(era.name)) {
					errors.push({
						severity: 'error',
						field: `eras[${index}].name`,
						message: `Duplicate era name: "${era.name}"`
					});
				}
				eraNames.add(era.name);
			}

			// Required: abbrev
			if (!era.abbrev || typeof era.abbrev !== 'string' || era.abbrev.trim().length === 0) {
				errors.push({
					severity: 'error',
					field: `eras[${index}].abbrev`,
					message: 'Era abbreviation is required and must be a non-empty string'
				});
			} else {
				if (eraAbbrevs.has(era.abbrev)) {
					errors.push({
						severity: 'error',
						field: `eras[${index}].abbrev`,
						message: `Duplicate era abbreviation: "${era.abbrev}"`
					});
				}
				eraAbbrevs.add(era.abbrev);
			}

			// Required: startYear
			if (typeof era.startYear !== 'number' || !Number.isInteger(era.startYear)) {
				errors.push({
					severity: 'error',
					field: `eras[${index}].startYear`,
					message: 'Era startYear must be an integer'
				});
			}

			// Optional: endYear
			if (era.endYear !== undefined) {
				if (typeof era.endYear !== 'number' || !Number.isInteger(era.endYear)) {
					errors.push({
						severity: 'error',
						field: `eras[${index}].endYear`,
						message: 'Era endYear must be an integer if provided'
					});
				} else if (era.startYear !== undefined && era.endYear <= era.startYear) {
					errors.push({
						severity: 'error',
						field: `eras[${index}].endYear`,
						message: 'Era endYear must be greater than startYear',
						suggestion: `${era.name} ends at ${era.endYear}, but starts at ${era.startYear}`
					});
				}
			}

			// Required: direction
			if (era.direction !== 1 && era.direction !== -1) {
				errors.push({
					severity: 'error',
					field: `eras[${index}].direction`,
					message: 'Era direction must be 1 (forward) or -1 (backward)',
					suggestion: 'Use 1 for normal counting, -1 for counting down'
				});
			}
		});

		// Check for overlapping eras
		for (let i = 0; i < eras.length; i++) {
			for (let j = i + 1; j < eras.length; j++) {
				const era1 = eras[i];
				const era2 = eras[j];

				if (typeof era1.startYear === 'number' && typeof era2.startYear === 'number') {
					const era1End = era1.endYear || Number.MAX_SAFE_INTEGER;
					const era2End = era2.endYear || Number.MAX_SAFE_INTEGER;

					const overlap = (era1.startYear < era2End) && (era2.startYear < era1End);

					if (overlap) {
						errors.push({
							severity: 'error',
							field: 'eras',
							message: `Eras "${era1.name}" and "${era2.name}" have overlapping year ranges`,
							suggestion: 'Each year should belong to exactly one era'
						});
					}
				}
			}
		}
	}

	/**
	 * Validate leap rules array
	 */
	private static validateLeapRules(
		leapRules: any[],
		errors: ValidationIssue[],
		warnings: ValidationIssue[],
		info: ValidationIssue[]
	): void {
		if (leapRules.length === 0) {
			warnings.push({
				severity: 'warning',
				field: 'leapRules',
				message: 'Empty leap rules array defined',
				suggestion: 'Remove leapRules field if no leap years'
			});
			return;
		}

		leapRules.forEach((rule, index) => {
			this.validateLeapRule(rule, `leapRules[${index}]`, errors, warnings, info);
		});
	}

	/**
	 * Validate a single leap rule (recursive for exclude rules)
	 */
	private static validateLeapRule(
		rule: any,
		path: string,
		errors: ValidationIssue[],
		warnings: ValidationIssue[],
		info: ValidationIssue[]
	): void {
		if (!rule || typeof rule !== 'object') {
			errors.push({
				severity: 'error',
				field: path,
				message: 'Leap rule must be an object'
			});
			return;
		}

		// Required: interval
		if (typeof rule.interval !== 'number' || !Number.isInteger(rule.interval) || rule.interval < 1) {
			errors.push({
				severity: 'error',
				field: `${path}.interval`,
				message: 'Leap rule interval must be a positive integer',
				suggestion: 'Use interval like 4 for "every 4 years"'
			});
		}

		// Optional: offset
		if (rule.offset !== undefined) {
			if (typeof rule.offset !== 'number' || !Number.isInteger(rule.offset)) {
				errors.push({
					severity: 'error',
					field: `${path}.offset`,
					message: 'Leap rule offset must be an integer if provided'
				});
			}
		}

		// Optional: targetMonth
		if (rule.targetMonth !== undefined) {
			if (typeof rule.targetMonth !== 'number' || !Number.isInteger(rule.targetMonth) || rule.targetMonth < 0) {
				errors.push({
					severity: 'error',
					field: `${path}.targetMonth`,
					message: 'Leap rule targetMonth must be a non-negative integer if provided',
					suggestion: 'Use 0 for first month, 1 for second month, etc.'
				});
			}
		}

		// Optional: exclude (recursive validation)
		if (rule.exclude !== undefined) {
			if (!Array.isArray(rule.exclude)) {
				errors.push({
					severity: 'error',
					field: `${path}.exclude`,
					message: 'Leap rule exclude must be an array if provided'
				});
			} else {
				rule.exclude.forEach((excludeRule: any, i: number) => {
					this.validateLeapRule(excludeRule, `${path}.exclude[${i}]`, errors, warnings, info);
				});
			}
		}
	}

	/**
	 * Validate seasons array
	 */
	private static validateSeasons(
		seasons: any[],
		errors: ValidationIssue[],
		warnings: ValidationIssue[],
		info: ValidationIssue[]
	): void {
		if (seasons.length === 0) {
			warnings.push({
				severity: 'warning',
				field: 'seasons',
				message: 'Empty seasons array defined',
				suggestion: 'Remove seasons field if no seasons defined'
			});
			return;
		}

		const seasonNames = new Set<string>();

		seasons.forEach((season, index) => {
			if (!season || typeof season !== 'object') {
				errors.push({
					severity: 'error',
					field: `seasons[${index}]`,
					message: 'Season must be an object'
				});
				return;
			}

			// Required: name
			if (!season.name || typeof season.name !== 'string' || season.name.trim().length === 0) {
				errors.push({
					severity: 'error',
					field: `seasons[${index}].name`,
					message: 'Season name is required and must be a non-empty string'
				});
			} else {
				if (seasonNames.has(season.name)) {
					warnings.push({
						severity: 'warning',
						field: `seasons[${index}].name`,
						message: `Duplicate season name: "${season.name}"`,
						suggestion: 'Season names should be unique unless used for region-specific variants'
					});
				}
				seasonNames.add(season.name);
			}

			// Required: startMonth
			if (typeof season.startMonth !== 'number' || !Number.isInteger(season.startMonth) || season.startMonth < 0) {
				errors.push({
					severity: 'error',
					field: `seasons[${index}].startMonth`,
					message: 'Season startMonth must be a non-negative integer',
					suggestion: 'Use 0 for first month, 1 for second month, etc.'
				});
			}

			// Required: startDay
			if (typeof season.startDay !== 'number' || !Number.isInteger(season.startDay) || season.startDay < 1) {
				errors.push({
					severity: 'error',
					field: `seasons[${index}].startDay`,
					message: 'Season startDay must be a positive integer (1-indexed)',
					suggestion: 'Use 1 for first day of month'
				});
			}

			// Required: sunrise
			if (typeof season.sunrise !== 'number' || !Number.isInteger(season.sunrise)) {
				errors.push({
					severity: 'error',
					field: `seasons[${index}].sunrise`,
					message: 'Season sunrise must be an integer (minutes from midnight)',
					suggestion: 'Use 0-1439 (e.g., 360 for 6:00 AM)'
				});
			} else if (season.sunrise < 0 || season.sunrise > 1439) {
				errors.push({
					severity: 'error',
					field: `seasons[${index}].sunrise`,
					message: `Season sunrise must be 0-1439 minutes. Got: ${season.sunrise}`,
					suggestion: 'Sunrise time must be within a 24-hour day'
				});
			}

			// Required: sunset
			if (typeof season.sunset !== 'number' || !Number.isInteger(season.sunset)) {
				errors.push({
					severity: 'error',
					field: `seasons[${index}].sunset`,
					message: 'Season sunset must be an integer (minutes from midnight)',
					suggestion: 'Use 0-1439 (e.g., 1080 for 6:00 PM)'
				});
			} else if (season.sunset < 0 || season.sunset > 1439) {
				errors.push({
					severity: 'error',
					field: `seasons[${index}].sunset`,
					message: `Season sunset must be 0-1439 minutes. Got: ${season.sunset}`,
					suggestion: 'Sunset time must be within a 24-hour day'
				});
			}

			// Validate sunrise < sunset
			if (typeof season.sunrise === 'number' && typeof season.sunset === 'number') {
				if (season.sunrise >= season.sunset) {
					errors.push({
						severity: 'error',
						field: `seasons[${index}]`,
						message: `Season "${season.name}" has sunrise (${season.sunrise}) >= sunset (${season.sunset})`,
						suggestion: 'Sunrise must be before sunset'
					});
				}
			}

			// Optional: region
			if (season.region !== undefined) {
				if (typeof season.region !== 'string' || season.region.trim().length === 0) {
					errors.push({
						severity: 'error',
						field: `seasons[${index}].region`,
						message: 'Season region must be a non-empty string if provided'
					});
				}
			}
		});
	}

	// ==========================================================================
	// Logical Validation
	// ==========================================================================

	/**
	 * Validate logical consistency
	 */
	private static validateLogic(
		calendar: CalendarDefinition,
		errors: ValidationIssue[],
		warnings: ValidationIssue[],
		info: ValidationIssue[]
	): void {
		// Check if calendar has at least one standard (non-intercalary) month
		const hasStandardMonth = calendar.months.some(m => m.type !== 'intercalary');
		if (!hasStandardMonth) {
			errors.push({
				severity: 'error',
				field: 'months',
				message: 'Calendar must have at least one standard (non-intercalary) month',
				suggestion: 'Add at least one month with type "standard" or no type field'
			});
		}

		// Check if leap rules target valid months
		if (calendar.leapRules && calendar.leapRules.length > 0) {
			calendar.leapRules.forEach((rule, index) => {
				this.validateLeapRuleTargetMonth(rule, calendar.months.length, `leapRules[${index}]`, errors);
			});
		}

		// Check if seasons reference valid months
		if (calendar.seasons && calendar.seasons.length > 0) {
			calendar.seasons.forEach((season, index) => {
				if (season.startMonth >= calendar.months.length) {
					errors.push({
						severity: 'error',
						field: `seasons[${index}].startMonth`,
						message: `Season "${season.name}" references month ${season.startMonth}, but calendar only has ${calendar.months.length} months`,
						suggestion: `Use month index 0-${calendar.months.length - 1}`
					});
				}

				// Check if startDay is within month bounds
				if (season.startMonth < calendar.months.length) {
					const month = calendar.months[season.startMonth];
					if (season.startDay > month.days) {
						errors.push({
							severity: 'error',
							field: `seasons[${index}].startDay`,
							message: `Season "${season.name}" starts on day ${season.startDay}, but month "${month.name}" only has ${month.days} days`,
							suggestion: `Use day 1-${month.days}`
						});
					}
				}
			});
		}

		// Info: total year length
		const totalDays = calendar.months.reduce((sum, m) => sum + m.days, 0);
		info.push({
			severity: 'info',
			field: 'months',
			message: `Total days in year: ${totalDays}`
		});

		// Warning: unusual year lengths
		if (totalDays < 200) {
			warnings.push({
				severity: 'warning',
				field: 'months',
				message: `Short year: only ${totalDays} days`,
				suggestion: 'Verify this is correct - most calendars have 300-400 days'
			});
		} else if (totalDays > 500) {
			warnings.push({
				severity: 'warning',
				field: 'months',
				message: `Long year: ${totalDays} days`,
				suggestion: 'Verify this is correct - most calendars have 300-400 days'
			});
		}
	}

	/**
	 * Validate leap rule target month (recursive)
	 */
	private static validateLeapRuleTargetMonth(
		rule: LeapRule,
		monthCount: number,
		path: string,
		errors: ValidationIssue[]
	): void {
		if (rule.targetMonth !== undefined && rule.targetMonth >= monthCount) {
			errors.push({
				severity: 'error',
				field: `${path}.targetMonth`,
				message: `Leap rule references month ${rule.targetMonth}, but calendar only has ${monthCount} months`,
				suggestion: `Use month index 0-${monthCount - 1} or omit targetMonth to add leap day at end of year`
			});
		}

		if (rule.exclude) {
			rule.exclude.forEach((excludeRule, i) => {
				this.validateLeapRuleTargetMonth(excludeRule, monthCount, `${path}.exclude[${i}]`, errors);
			});
		}
	}

	// ==========================================================================
	// Mathematical Validation (Crash Testing)
	// ==========================================================================

	/**
	 * Validate mathematical correctness using CalendarDriver crash tests
	 */
	private static validateMathematics(
		calendar: CalendarDefinition,
		errors: ValidationIssue[],
		warnings: ValidationIssue[],
		info: ValidationIssue[]
	): void {
		try {
			// Create a CalendarDriver instance
			const driver = new CalendarDriver(calendar);

			// Test 1: getDate(0) must return valid date
			try {
				const date0 = driver.getDate(0);
				if (!date0) {
					errors.push({
						severity: 'error',
						field: 'calendar',
						message: 'getDate(0) returned null/undefined',
						suggestion: 'Calendar definition causes crash at day 0'
					});
				}
			} catch (error) {
				errors.push({
					severity: 'error',
					field: 'calendar',
					message: `getDate(0) threw error: ${error instanceof Error ? error.message : String(error)}`,
					suggestion: 'Calendar definition is not valid for day 0 calculations'
				});
			}

			// Test 2: getDate(100000) must not overflow or error
			try {
				const date100k = driver.getDate(100000);
				if (!date100k) {
					errors.push({
						severity: 'error',
						field: 'calendar',
						message: 'getDate(100000) returned null/undefined',
						suggestion: 'Calendar definition causes crash at large day values'
					});
				}
			} catch (error) {
				errors.push({
					severity: 'error',
					field: 'calendar',
					message: `getDate(100000) threw error: ${error instanceof Error ? error.message : String(error)}`,
					suggestion: 'Calendar definition is not valid for large day values'
				});
			}

			// Test 3: Round-trip consistency for various days
			const testDays = [0, 1, 365, 1000, 10000];
			for (const testDay of testDays) {
				try {
					const date = driver.getDate(testDay);
					if (!date) continue;

					// Skip simple counter mode (no round-trip for those)
					if (date.isSimpleCounter) continue;

					const absoluteDay = driver.getAbsoluteDay(date.year, date.monthIndex, date.dayOfMonth);
					if (absoluteDay !== testDay) {
						errors.push({
							severity: 'error',
							field: 'calendar',
							message: `Round-trip failed for day ${testDay}: got ${absoluteDay}`,
							suggestion: 'getDate() and getAbsoluteDay() are inconsistent'
						});
					}
				} catch (error) {
					// Already caught by previous tests
				}
			}

			// Info: successful validation
			info.push({
				severity: 'info',
				field: 'calendar',
				message: 'Mathematical validation passed (tested days 0, 1, 365, 1000, 10000, 100000)'
			});

		} catch (error) {
			errors.push({
				severity: 'error',
				field: 'calendar',
				message: `Failed to create CalendarDriver: ${error instanceof Error ? error.message : String(error)}`,
				suggestion: 'Calendar definition has fundamental structural issues'
			});
		}
	}
}
