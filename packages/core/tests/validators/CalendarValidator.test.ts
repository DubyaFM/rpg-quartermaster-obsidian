import { describe, it, expect } from 'vitest';
import { CalendarValidator, CalendarValidationError, ValidationSeverity } from '../../validators/CalendarValidator';
import { CalendarDefinition } from '../../models/types';

describe('CalendarValidator', () => {
	// Valid minimal calendar for testing
	const validMinimalCalendar: CalendarDefinition = {
		id: 'test-calendar',
		name: 'Test Calendar',
		weekdays: ['Monday', 'Tuesday', 'Wednesday'],
		months: [
			{ name: 'January', days: 31, order: 0 },
			{ name: 'February', days: 28, order: 1 }
		],
		holidays: []
	};

	// Valid Gregorian calendar
	const validGregorian: CalendarDefinition = {
		id: 'gregorian',
		name: 'Gregorian Calendar',
		weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
		months: [
			{ name: 'January', days: 31, order: 0, season: 'Winter' },
			{ name: 'February', days: 28, order: 1, season: 'Winter' },
			{ name: 'March', days: 31, order: 2, season: 'Spring' },
			{ name: 'April', days: 30, order: 3, season: 'Spring' },
			{ name: 'May', days: 31, order: 4, season: 'Spring' },
			{ name: 'June', days: 30, order: 5, season: 'Summer' },
			{ name: 'July', days: 31, order: 6, season: 'Summer' },
			{ name: 'August', days: 31, order: 7, season: 'Summer' },
			{ name: 'September', days: 30, order: 8, season: 'Fall' },
			{ name: 'October', days: 31, order: 9, season: 'Fall' },
			{ name: 'November', days: 30, order: 10, season: 'Fall' },
			{ name: 'December', days: 31, order: 11, season: 'Winter' }
		],
		holidays: [],
		startingYear: 1,
		yearSuffix: 'AD',
		leapRules: [
			{
				interval: 4,
				targetMonth: 1,
				exclude: [
					{
						interval: 100,
						exclude: [
							{ interval: 400 }
						]
					}
				]
			}
		],
		seasons: [
			{ name: 'Spring', startMonth: 2, startDay: 20, sunrise: 360, sunset: 1080 },
			{ name: 'Summer', startMonth: 5, startDay: 21, sunrise: 300, sunset: 1140 },
			{ name: 'Fall', startMonth: 8, startDay: 22, sunrise: 360, sunset: 1080 },
			{ name: 'Winter', startMonth: 11, startDay: 21, sunrise: 420, sunset: 1020 }
		]
	};

	// Valid Harptos calendar with intercalary days
	const validHarptos: CalendarDefinition = {
		id: 'faerun-harptos',
		name: 'Calendar of Harptos',
		weekdays: ['First Day', 'Second Day', 'Third Day', 'Fourth Day', 'Fifth Day', 'Sixth Day', 'Seventh Day', 'Eighth Day', 'Ninth Day', 'Tenth Day'],
		months: [
			{ name: 'Hammer', days: 30, order: 0, season: 'Winter' },
			{ name: 'Midwinter', days: 1, order: 1, season: 'Winter', type: 'intercalary' },
			{ name: 'Alturiak', days: 30, order: 2, season: 'Winter' },
			{ name: 'Ches', days: 30, order: 3, season: 'Spring' },
			{ name: 'Tarsakh', days: 30, order: 4, season: 'Spring' },
			{ name: 'Greengrass', days: 1, order: 5, season: 'Spring', type: 'intercalary' },
			{ name: 'Mirtul', days: 30, order: 6, season: 'Spring' },
			{ name: 'Kythorn', days: 30, order: 7, season: 'Summer' },
			{ name: 'Flamerule', days: 30, order: 8, season: 'Summer' },
			{ name: 'Midsummer', days: 1, order: 9, season: 'Summer', type: 'intercalary' },
			{ name: 'Eleasis', days: 30, order: 10, season: 'Summer' },
			{ name: 'Eleint', days: 30, order: 11, season: 'Fall' },
			{ name: 'Highharvestide', days: 1, order: 12, season: 'Fall', type: 'intercalary' },
			{ name: 'Marpenoth', days: 30, order: 13, season: 'Fall' },
			{ name: 'Uktar', days: 30, order: 14, season: 'Fall' },
			{ name: 'Feast of the Moon', days: 1, order: 15, season: 'Fall', type: 'intercalary' },
			{ name: 'Nightal', days: 30, order: 16, season: 'Winter' }
		],
		holidays: [],
		startingYear: 1358,
		yearSuffix: 'DR'
	};

	describe('validate', () => {
		it('should return valid for a minimal correct calendar', () => {
			const result = CalendarValidator.validate(validMinimalCalendar);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should return valid for Gregorian calendar', () => {
			const result = CalendarValidator.validate(validGregorian);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should return valid for Harptos calendar', () => {
			const result = CalendarValidator.validate(validHarptos);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should include info about total year length', () => {
			const result = CalendarValidator.validate(validGregorian);
			const yearLengthInfo = result.info.find(i => i.message.includes('Total days in year'));
			expect(yearLengthInfo).toBeDefined();
			expect(yearLengthInfo?.message).toContain('365');
		});

		it('should include info about successful mathematical validation', () => {
			const result = CalendarValidator.validate(validGregorian);
			const mathInfo = result.info.find(i => i.message.includes('Mathematical validation passed'));
			expect(mathInfo).toBeDefined();
		});
	});

	describe('Schema Validation - Required Fields', () => {
		it('should error if id is missing', () => {
			const { id, ...invalid } = validMinimalCalendar;
			const result = CalendarValidator.validate(invalid as any);
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.field === 'id')).toBe(true);
		});

		it('should error if id is empty string', () => {
			const result = CalendarValidator.validate({ ...validMinimalCalendar, id: '' });
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.field === 'id')).toBe(true);
		});

		it('should error if name is missing', () => {
			const { name, ...invalid } = validMinimalCalendar;
			const result = CalendarValidator.validate(invalid as any);
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.field === 'name')).toBe(true);
		});

		it('should error if weekdays is missing', () => {
			const { weekdays, ...invalid } = validMinimalCalendar;
			const result = CalendarValidator.validate(invalid as any);
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.field === 'weekdays')).toBe(true);
		});

		it('should error if months is missing', () => {
			const { months, ...invalid } = validMinimalCalendar;
			const result = CalendarValidator.validate(invalid as any);
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.field === 'months')).toBe(true);
		});

		it('should error if holidays is missing', () => {
			const { holidays, ...invalid } = validMinimalCalendar;
			const result = CalendarValidator.validate(invalid as any);
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.field === 'holidays')).toBe(true);
		});

		it('should error if months array is empty', () => {
			const result = CalendarValidator.validate({ ...validMinimalCalendar, months: [] });
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.field === 'months' && e.message.includes('at least one month'))).toBe(true);
		});
	});

	describe('Schema Validation - Weekdays', () => {
		it('should warn if weekdays array is empty', () => {
			const result = CalendarValidator.validate({ ...validMinimalCalendar, weekdays: [] });
			expect(result.warnings.some(w => w.field === 'weekdays')).toBe(true);
		});

		it('should error if weekday is not a string', () => {
			const result = CalendarValidator.validate({ ...validMinimalCalendar, weekdays: ['Monday', 123 as any, 'Wednesday'] });
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.field === 'weekdays[1]')).toBe(true);
		});

		it('should error if weekday is empty string', () => {
			const result = CalendarValidator.validate({ ...validMinimalCalendar, weekdays: ['Monday', '', 'Wednesday'] });
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.field === 'weekdays[1]')).toBe(true);
		});

		it('should error if weekdays have duplicates', () => {
			const result = CalendarValidator.validate({ ...validMinimalCalendar, weekdays: ['Monday', 'Tuesday', 'Monday'] });
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.field === 'weekdays' && e.message.includes('Duplicate'))).toBe(true);
		});

		it('should provide info for unusual week lengths', () => {
			const result = CalendarValidator.validate({ ...validMinimalCalendar, weekdays: ['A', 'B', 'C', 'D'] });
			expect(result.info.some(i => i.field === 'weekdays' && i.message.includes('Unusual week length'))).toBe(true);
		});

		it('should not provide info for common week lengths', () => {
			const result = CalendarValidator.validate({ ...validMinimalCalendar, weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] });
			expect(result.info.some(i => i.field === 'weekdays' && i.message.includes('Unusual'))).toBe(false);
		});
	});

	describe('Schema Validation - Months', () => {
		it('should error if month has no name', () => {
			const result = CalendarValidator.validate({
				...validMinimalCalendar,
				months: [{ days: 30, order: 0 } as any]
			});
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.field === 'months[0].name')).toBe(true);
		});

		it('should error if month has no days', () => {
			const result = CalendarValidator.validate({
				...validMinimalCalendar,
				months: [{ name: 'Test', order: 0 } as any]
			});
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.field === 'months[0].days')).toBe(true);
		});

		it('should error if month has 0 days', () => {
			const result = CalendarValidator.validate({
				...validMinimalCalendar,
				months: [{ name: 'Test', days: 0, order: 0 }]
			});
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.field === 'months[0].days' && e.message.includes('must be >= 1'))).toBe(true);
		});

		it('should error if month has negative days', () => {
			const result = CalendarValidator.validate({
				...validMinimalCalendar,
				months: [{ name: 'Test', days: -5, order: 0 }]
			});
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.field === 'months[0].days')).toBe(true);
		});

		it('should warn if month has > 366 days', () => {
			const result = CalendarValidator.validate({
				...validMinimalCalendar,
				months: [{ name: 'LongMonth', days: 400, order: 0 }]
			});
			expect(result.warnings.some(w => w.field === 'months[0].days' && w.message.includes('unusually long'))).toBe(true);
		});

		it('should error if months have duplicate names', () => {
			const result = CalendarValidator.validate({
				...validMinimalCalendar,
				months: [
					{ name: 'January', days: 31, order: 0 },
					{ name: 'January', days: 28, order: 1 }
				]
			});
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.message.includes('Duplicate month name'))).toBe(true);
		});

		it('should error if month type is invalid', () => {
			const result = CalendarValidator.validate({
				...validMinimalCalendar,
				months: [{ name: 'Test', days: 30, order: 0, type: 'invalid' as any }]
			});
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.field === 'months[0].type')).toBe(true);
		});

		it('should warn if intercalary month has > 1 day', () => {
			const result = CalendarValidator.validate({
				...validMinimalCalendar,
				months: [
					{ name: 'Normal', days: 30, order: 0 },
					{ name: 'Festival', days: 5, order: 1, type: 'intercalary' }
				]
			});
			expect(result.warnings.some(w => w.field === 'months[1].days')).toBe(true);
		});

		it('should warn if order field is present (deprecated)', () => {
			const result = CalendarValidator.validate(validMinimalCalendar);
			expect(result.warnings.some(w => w.field.includes('.order'))).toBe(true);
		});
	});

	describe('Schema Validation - Eras', () => {
		it('should error if eras is not an array', () => {
			const result = CalendarValidator.validate({ ...validMinimalCalendar, eras: 'not-array' as any });
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.field === 'eras')).toBe(true);
		});

		it('should warn if eras array is empty', () => {
			const result = CalendarValidator.validate({ ...validMinimalCalendar, eras: [] });
			expect(result.warnings.some(w => w.field === 'eras')).toBe(true);
		});

		it('should error if era has no name', () => {
			const result = CalendarValidator.validate({
				...validMinimalCalendar,
				eras: [{ abbrev: 'AD', startYear: 1, direction: 1 } as any]
			});
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.field === 'eras[0].name')).toBe(true);
		});

		it('should error if era has no abbrev', () => {
			const result = CalendarValidator.validate({
				...validMinimalCalendar,
				eras: [{ name: 'Anno Domini', startYear: 1, direction: 1 } as any]
			});
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.field === 'eras[0].abbrev')).toBe(true);
		});

		it('should error if era has invalid direction', () => {
			const result = CalendarValidator.validate({
				...validMinimalCalendar,
				eras: [{ name: 'AD', abbrev: 'AD', startYear: 1, direction: 0 as any }]
			});
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.field === 'eras[0].direction')).toBe(true);
		});

		it('should error if era endYear <= startYear', () => {
			const result = CalendarValidator.validate({
				...validMinimalCalendar,
				eras: [{ name: 'AD', abbrev: 'AD', startYear: 100, endYear: 100, direction: 1 }]
			});
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.field === 'eras[0].endYear')).toBe(true);
		});

		it('should error if eras have duplicate names', () => {
			const result = CalendarValidator.validate({
				...validMinimalCalendar,
				eras: [
					{ name: 'Era1', abbrev: 'E1', startYear: 0, endYear: 100, direction: 1 },
					{ name: 'Era1', abbrev: 'E2', startYear: 100, direction: 1 }
				]
			});
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.message.includes('Duplicate era name'))).toBe(true);
		});

		it('should error if eras have duplicate abbreviations', () => {
			const result = CalendarValidator.validate({
				...validMinimalCalendar,
				eras: [
					{ name: 'Era1', abbrev: 'E', startYear: 0, endYear: 100, direction: 1 },
					{ name: 'Era2', abbrev: 'E', startYear: 100, direction: 1 }
				]
			});
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.message.includes('Duplicate era abbreviation'))).toBe(true);
		});

		it('should error if eras have overlapping year ranges', () => {
			const result = CalendarValidator.validate({
				...validMinimalCalendar,
				eras: [
					{ name: 'Era1', abbrev: 'E1', startYear: 0, endYear: 150, direction: 1 },
					{ name: 'Era2', abbrev: 'E2', startYear: 100, endYear: 200, direction: 1 }
				]
			});
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.message.includes('overlapping year ranges'))).toBe(true);
		});

		it('should not error for non-overlapping eras', () => {
			const result = CalendarValidator.validate({
				...validMinimalCalendar,
				eras: [
					{ name: 'Era1', abbrev: 'E1', startYear: 0, endYear: 100, direction: 1 },
					{ name: 'Era2', abbrev: 'E2', startYear: 100, direction: 1 }
				]
			});
			expect(result.valid).toBe(true);
		});
	});

	describe('Schema Validation - Leap Rules', () => {
		it('should error if leapRules is not an array', () => {
			const result = CalendarValidator.validate({ ...validMinimalCalendar, leapRules: 'not-array' as any });
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.field === 'leapRules')).toBe(true);
		});

		it('should warn if leapRules array is empty', () => {
			const result = CalendarValidator.validate({ ...validMinimalCalendar, leapRules: [] });
			expect(result.warnings.some(w => w.field === 'leapRules')).toBe(true);
		});

		it('should error if leap rule has no interval', () => {
			const result = CalendarValidator.validate({
				...validMinimalCalendar,
				leapRules: [{} as any]
			});
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.field === 'leapRules[0].interval')).toBe(true);
		});

		it('should error if leap rule interval is not positive integer', () => {
			const result = CalendarValidator.validate({
				...validMinimalCalendar,
				leapRules: [{ interval: -4 }]
			});
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.field === 'leapRules[0].interval')).toBe(true);
		});

		it('should error if leap rule targetMonth is negative', () => {
			const result = CalendarValidator.validate({
				...validMinimalCalendar,
				leapRules: [{ interval: 4, targetMonth: -1 }]
			});
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.field === 'leapRules[0].targetMonth')).toBe(true);
		});

		it('should validate nested exclude rules', () => {
			const result = CalendarValidator.validate({
				...validMinimalCalendar,
				leapRules: [
					{
						interval: 4,
						exclude: [{ interval: 0 }]  // Invalid interval in exclude
					}
				]
			});
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.field === 'leapRules[0].exclude[0].interval')).toBe(true);
		});
	});

	describe('Schema Validation - Seasons', () => {
		it('should error if seasons is not an array', () => {
			const result = CalendarValidator.validate({ ...validMinimalCalendar, seasons: 'not-array' as any });
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.field === 'seasons')).toBe(true);
		});

		it('should warn if seasons array is empty', () => {
			const result = CalendarValidator.validate({ ...validMinimalCalendar, seasons: [] });
			expect(result.warnings.some(w => w.field === 'seasons')).toBe(true);
		});

		it('should error if season has no name', () => {
			const result = CalendarValidator.validate({
				...validMinimalCalendar,
				seasons: [{ startMonth: 0, startDay: 1, sunrise: 360, sunset: 1080 } as any]
			});
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.field === 'seasons[0].name')).toBe(true);
		});

		it('should error if season startMonth is negative', () => {
			const result = CalendarValidator.validate({
				...validMinimalCalendar,
				seasons: [{ name: 'Spring', startMonth: -1, startDay: 1, sunrise: 360, sunset: 1080 }]
			});
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.field === 'seasons[0].startMonth')).toBe(true);
		});

		it('should error if season startDay is 0 or negative', () => {
			const result = CalendarValidator.validate({
				...validMinimalCalendar,
				seasons: [{ name: 'Spring', startMonth: 0, startDay: 0, sunrise: 360, sunset: 1080 }]
			});
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.field === 'seasons[0].startDay')).toBe(true);
		});

		it('should error if sunrise is out of range', () => {
			const result = CalendarValidator.validate({
				...validMinimalCalendar,
				seasons: [{ name: 'Spring', startMonth: 0, startDay: 1, sunrise: 1500, sunset: 1080 }]
			});
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.field === 'seasons[0].sunrise')).toBe(true);
		});

		it('should error if sunset is out of range', () => {
			const result = CalendarValidator.validate({
				...validMinimalCalendar,
				seasons: [{ name: 'Spring', startMonth: 0, startDay: 1, sunrise: 360, sunset: 2000 }]
			});
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.field === 'seasons[0].sunset')).toBe(true);
		});

		it('should error if sunrise >= sunset', () => {
			const result = CalendarValidator.validate({
				...validMinimalCalendar,
				seasons: [{ name: 'Spring', startMonth: 0, startDay: 1, sunrise: 1080, sunset: 360 }]
			});
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.message.includes('sunrise') && e.message.includes('sunset'))).toBe(true);
		});

		it('should warn for duplicate season names', () => {
			const result = CalendarValidator.validate({
				...validMinimalCalendar,
				seasons: [
					{ name: 'Spring', startMonth: 0, startDay: 1, sunrise: 360, sunset: 1080 },
					{ name: 'Spring', startMonth: 0, startDay: 1, sunrise: 360, sunset: 1080, region: 'polar' }
				]
			});
			expect(result.warnings.some(w => w.field === 'seasons[1].name')).toBe(true);
		});
	});

	describe('Logical Validation', () => {
		it('should error if all months are intercalary', () => {
			const result = CalendarValidator.validate({
				...validMinimalCalendar,
				months: [
					{ name: 'Festival1', days: 1, order: 0, type: 'intercalary' },
					{ name: 'Festival2', days: 1, order: 1, type: 'intercalary' }
				]
			});
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.field === 'months' && e.message.includes('standard'))).toBe(true);
		});

		it('should error if leap rule targets non-existent month', () => {
			const result = CalendarValidator.validate({
				...validMinimalCalendar,
				leapRules: [{ interval: 4, targetMonth: 10 }]  // Only 2 months defined
			});
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.message.includes('references month 10'))).toBe(true);
		});

		it('should error if season references non-existent month', () => {
			const result = CalendarValidator.validate({
				...validMinimalCalendar,
				seasons: [{ name: 'Spring', startMonth: 5, startDay: 1, sunrise: 360, sunset: 1080 }]  // Only 2 months
			});
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.field === 'seasons[0].startMonth')).toBe(true);
		});

		it('should error if season startDay exceeds month length', () => {
			const result = CalendarValidator.validate({
				...validMinimalCalendar,
				seasons: [{ name: 'Spring', startMonth: 0, startDay: 50, sunrise: 360, sunset: 1080 }]  // Month only has 31 days
			});
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.field === 'seasons[0].startDay')).toBe(true);
		});

		it('should warn for short years (< 200 days)', () => {
			const result = CalendarValidator.validate({
				...validMinimalCalendar,
				months: [{ name: 'Short', days: 100, order: 0 }]
			});
			expect(result.warnings.some(w => w.field === 'months' && w.message.includes('Short year'))).toBe(true);
		});

		it('should warn for long years (> 500 days)', () => {
			const result = CalendarValidator.validate({
				...validMinimalCalendar,
				months: [{ name: 'Long', days: 600, order: 0 }]
			});
			expect(result.warnings.some(w => w.field === 'months' && w.message.includes('Long year'))).toBe(true);
		});
	});

	describe('Mathematical Validation', () => {
		it('should pass for minimal calendar (crash test)', () => {
			const result = CalendarValidator.validate(validMinimalCalendar);
			expect(result.valid).toBe(true);
		});

		it('should pass for Gregorian calendar (crash test)', () => {
			const result = CalendarValidator.validate(validGregorian);
			expect(result.valid).toBe(true);
		});

		it('should pass for Harptos calendar (crash test)', () => {
			const result = CalendarValidator.validate(validHarptos);
			expect(result.valid).toBe(true);
		});

		it('should error if calendar causes crash at day 0', () => {
			// This would require a fundamentally broken calendar structure
			// Testing with months that sum to 0 days
			const result = CalendarValidator.validate({
				id: 'broken',
				name: 'Broken',
				weekdays: ['Day'],
				months: [],  // This will fail schema validation first
				holidays: []
			});
			expect(result.valid).toBe(false);
		});
	});

	describe('validateOrThrow', () => {
		it('should not throw for valid calendar', () => {
			expect(() => CalendarValidator.validateOrThrow(validMinimalCalendar)).not.toThrow();
		});

		it('should throw CalendarValidationError for invalid calendar', () => {
			const invalid = { ...validMinimalCalendar, id: '' };
			expect(() => CalendarValidator.validateOrThrow(invalid)).toThrow(CalendarValidationError);
		});

		it('should include suggestion in thrown error', () => {
			const invalid = { ...validMinimalCalendar, id: '' };
			try {
				CalendarValidator.validateOrThrow(invalid);
				expect.fail('Should have thrown');
			} catch (error) {
				expect(error).toBeInstanceOf(CalendarValidationError);
				expect((error as CalendarValidationError).suggestion).toBeDefined();
			}
		});
	});

	describe('getValidationErrors', () => {
		it('should return empty array for valid calendar', () => {
			const errors = CalendarValidator.getValidationErrors(validMinimalCalendar);
			expect(errors).toHaveLength(0);
		});

		it('should return formatted error strings', () => {
			const invalid = { ...validMinimalCalendar, id: '' };
			const errors = CalendarValidator.getValidationErrors(invalid);
			expect(errors.length).toBeGreaterThan(0);
			expect(errors[0]).toContain('id:');
		});

		it('should include suggestions in formatted errors', () => {
			const invalid = { ...validMinimalCalendar, id: '' };
			const errors = CalendarValidator.getValidationErrors(invalid);
			expect(errors.some(e => e.includes('Suggestion:'))).toBe(true);
		});
	});

	describe('Edge Cases', () => {
		it('should handle calendar with yearSuffix and eras (warning)', () => {
			const result = CalendarValidator.validate({
				...validMinimalCalendar,
				yearSuffix: 'AD',
				eras: [{ name: 'Anno Domini', abbrev: 'AD', startYear: 1, direction: 1 }]
			});
			expect(result.warnings.some(w => w.field === 'yearSuffix')).toBe(true);
		});

		it('should handle calendar with no weekdays (simple counter)', () => {
			const result = CalendarValidator.validate({
				...validMinimalCalendar,
				weekdays: []
			});
			expect(result.warnings.some(w => w.field === 'weekdays')).toBe(true);
		});

		it('should validate nested leap rule exclusions', () => {
			const result = CalendarValidator.validate(validGregorian);
			expect(result.valid).toBe(true);
		});
	});
});
