/**
 * Fantasy-Calendar.com Import Service
 *
 * Orchestrates the import process for Fantasy-Calendar.com JSON exports:
 * 1. Parse JSON using FantasyCalendarParser
 * 2. Validate using CalendarValidator
 * 3. Return structured result with warnings and validation issues
 *
 * Platform implementations (Obsidian, Backend) handle file I/O and persistence.
 */

import { CalendarDefinition } from '../models/types';
import { FantasyCalendarParser, ParseResult } from './FantasyCalendarParser';
import { CalendarValidator, CalendarValidationResult, ValidationIssue } from '../validators/CalendarValidator';

/**
 * Import result with calendar, warnings, and validation issues
 */
export interface ImportResult {
	/** Whether import succeeded (no validation errors) */
	success: boolean;
	/** Parsed and validated calendar definition (only if success=true) */
	calendar?: CalendarDefinition;
	/** Parse warnings (skipped data, format issues) */
	parseWarnings: string[];
	/** Validation errors (blocks import) */
	validationErrors: ValidationIssue[];
	/** Validation warnings (allows import but indicates issues) */
	validationWarnings: ValidationIssue[];
	/** Validation info messages */
	validationInfo: ValidationIssue[];
	/** Combined error message if import failed */
	error?: string;
}

/**
 * Fantasy-Calendar.com Import Service
 *
 * Two-step import process:
 * 1. Parse: Convert FC.com JSON to CalendarDefinition
 * 2. Validate: Check calendar for errors/warnings
 *
 * Platform code handles:
 * - Reading JSON from file
 * - Saving validated calendar to storage
 * - Displaying warnings/errors to user
 * - Confirming before save
 */
export class FantasyCalendarImporter {
	private parser: FantasyCalendarParser;

	constructor() {
		this.parser = new FantasyCalendarParser();
	}

	/**
	 * Import Fantasy-Calendar.com JSON
	 *
	 * Parses and validates JSON string. If successful, returns validated
	 * CalendarDefinition ready for persistence.
	 *
	 * If validation fails, returns errors but still includes the parsed
	 * calendar (for debugging or advanced users).
	 *
	 * @param jsonString JSON string from FC.com export
	 * @returns Import result with success flag, calendar, and all issues
	 */
	import(jsonString: string): ImportResult {
		try {
			// Step 1: Parse FC.com JSON to CalendarDefinition
			const parseResult = this.parseJSON(jsonString);
			if (!parseResult.success) {
				return parseResult;
			}

			const calendar = parseResult.calendar!;
			const parseWarnings = parseResult.parseWarnings;

			// Step 2: Validate CalendarDefinition
			const validationResult = this.validateCalendar(calendar);

			// Combine results
			if (validationResult.valid) {
				return {
					success: true,
					calendar,
					parseWarnings,
					validationErrors: [],
					validationWarnings: validationResult.warnings,
					validationInfo: validationResult.info
				};
			} else {
				return {
					success: false,
					calendar,  // Still return parsed calendar for debugging
					parseWarnings,
					validationErrors: validationResult.errors,
					validationWarnings: validationResult.warnings,
					validationInfo: validationResult.info,
					error: this.formatValidationErrorSummary(validationResult)
				};
			}

		} catch (error) {
			// Catch any unexpected errors
			return {
				success: false,
				parseWarnings: [],
				validationErrors: [],
				validationWarnings: [],
				validationInfo: [],
				error: `Import failed: ${error instanceof Error ? error.message : String(error)}`
			};
		}
	}

	/**
	 * Parse Fantasy-Calendar.com JSON
	 *
	 * @param jsonString JSON string to parse
	 * @returns Parse result or error result
	 */
	private parseJSON(jsonString: string): ImportResult {
		try {
			const parseResult: ParseResult = this.parser.parse(jsonString);

			return {
				success: true,
				calendar: parseResult.calendar,
				parseWarnings: parseResult.warnings,
				validationErrors: [],
				validationWarnings: [],
				validationInfo: []
			};

		} catch (error) {
			return {
				success: false,
				parseWarnings: [],
				validationErrors: [],
				validationWarnings: [],
				validationInfo: [],
				error: `Parse failed: ${error instanceof Error ? error.message : String(error)}`
			};
		}
	}

	/**
	 * Validate parsed calendar
	 *
	 * @param calendar Calendar definition to validate
	 * @returns Validation result
	 */
	private validateCalendar(calendar: CalendarDefinition): CalendarValidationResult {
		return CalendarValidator.validate(calendar);
	}

	/**
	 * Format validation errors into summary message
	 *
	 * @param validation Validation result
	 * @returns Summary error message
	 */
	private formatValidationErrorSummary(validation: CalendarValidationResult): string {
		const errorCount = validation.errors.length;
		const firstError = validation.errors[0];

		if (errorCount === 1) {
			return `Validation failed: ${firstError.field} - ${firstError.message}`;
		} else {
			return `Validation failed with ${errorCount} error(s). First error: ${firstError.field} - ${firstError.message}`;
		}
	}

	/**
	 * Get user-friendly summary of import result
	 *
	 * Formats warnings and errors for display to user.
	 *
	 * @param result Import result
	 * @returns Human-readable summary lines
	 */
	static getImportSummary(result: ImportResult): string[] {
		const lines: string[] = [];

		if (result.success) {
			lines.push(`✓ Calendar imported successfully: "${result.calendar!.name}"`);

			// Show parse warnings
			if (result.parseWarnings.length > 0) {
				lines.push('');
				lines.push('Parse Warnings:');
				result.parseWarnings.forEach(w => lines.push(`  - ${w}`));
			}

			// Show validation warnings
			if (result.validationWarnings.length > 0) {
				lines.push('');
				lines.push('Validation Warnings:');
				result.validationWarnings.forEach(w =>
					lines.push(`  - ${w.field}: ${w.message}`)
				);
			}

			// Show info
			if (result.validationInfo.length > 0) {
				lines.push('');
				lines.push('Info:');
				result.validationInfo.forEach(i =>
					lines.push(`  - ${i.message}`)
				);
			}

		} else {
			lines.push(`✗ Import failed: ${result.error}`);

			if (result.validationErrors.length > 0) {
				lines.push('');
				lines.push('Validation Errors:');
				result.validationErrors.forEach(e => {
					const msg = `  - ${e.field}: ${e.message}`;
					lines.push(e.suggestion ? `${msg} (${e.suggestion})` : msg);
				});
			}

			if (result.parseWarnings.length > 0) {
				lines.push('');
				lines.push('Parse Warnings:');
				result.parseWarnings.forEach(w => lines.push(`  - ${w}`));
			}
		}

		return lines;
	}
}
