/**
 * Duration Parser
 *
 * Parses multi-unit dice notation strings for duration specification.
 * Used by chain events and calendar operations.
 *
 * Supports:
 * - Fixed durations: "6 hours", "30 days"
 * - Dice durations: "1d4 days", "2d6 hours"
 * - Compound expressions: "2 weeks + 1d6 days - 4 hours"
 * - All units: minutes, hours, days, weeks, months, years
 *
 * Examples:
 *   parseDuration("2d6 days", rng, config) -> 7680 (if 2d6 rolls 8)
 *   parseDuration("1 week + 2d4 hours", rng, config) -> 10164 (if 2d4 rolls 3)
 *   parseDuration("3 months - 5 days", rng, config) -> 122400 (for 30-day months)
 */

import { ISeededRandomizer } from '../interfaces/ISeededRandomizer';

/**
 * Calendar-based unit configuration
 * Defines time unit conversions based on calendar definition
 */
export interface DurationUnitConfig {
	/** Minutes in one hour (typically 60) */
	minutesPerHour: number;
	/** Hours in one day (typically 24) */
	hoursPerDay: number;
	/** Days in one week (typically 7) */
	daysPerWeek: number;
	/** Average days in one month (typically 30) */
	daysPerMonth: number;
	/** Days in one year (sum of all month days in calendar) */
	daysPerYear: number;
}

/**
 * Default unit configuration
 * Standard time units (60 min/hour, 24 hour/day, 7 day/week, 30 day/month, 365 day/year)
 */
export const DEFAULT_DURATION_UNITS: DurationUnitConfig = {
	minutesPerHour: 60,
	hoursPerDay: 24,
	daysPerWeek: 7,
	daysPerMonth: 30,
	daysPerYear: 365
};

/**
 * Duration token types
 */
type TokenType = 'number' | 'dice' | 'unit' | 'operator';

/**
 * Parsed token from duration string
 */
interface DurationToken {
	type: TokenType;
	value: string;
	position: number;
}

/**
 * Duration chunk (value + unit + sign)
 */
interface DurationChunk {
	value: number; // Raw value (either fixed number or dice notation to resolve)
	isDice: boolean; // True if value needs dice roll resolution
	diceNotation?: string; // Original dice notation if isDice
	unit: string; // Unit name (minutes, hours, days, weeks, months, years)
	sign: number; // 1 for addition, -1 for subtraction
}

/**
 * Parse duration notation string to absolute minutes
 *
 * @param notation - Duration notation string (e.g., "2d6 days + 1d3 weeks - 4 hours")
 * @param rng - Seeded randomizer for dice roll resolution
 * @param config - Calendar-based unit configuration (defaults to standard units)
 * @returns Resolved duration in absolute minutes
 * @throws Error if notation is invalid or contains unknown units
 *
 * @example
 * const rng = new Mulberry32(12345);
 * const minutes = parseDuration("2d6 hours", rng);
 * // Returns: 480 (if 2d6 rolls 8)
 *
 * @example
 * const config = { minutesPerHour: 60, hoursPerDay: 24, daysPerWeek: 10, daysPerMonth: 30, daysPerYear: 365 };
 * const minutes = parseDuration("1 week + 2 days", rng, config);
 * // Returns: 17280 (12 days * 24 hours * 60 minutes, using 10-day weeks)
 */
export function parseDuration(
	notation: string,
	rng: ISeededRandomizer,
	config: DurationUnitConfig = DEFAULT_DURATION_UNITS
): number {
	// Normalize: trim, lowercase, collapse whitespace
	const normalized = notation.trim().toLowerCase().replace(/\s+/g, ' ');

	if (!normalized) {
		throw new Error('Duration notation cannot be empty');
	}

	// Tokenize the notation string
	const tokens = tokenize(normalized);

	// Parse tokens into duration chunks
	const chunks = parseChunks(tokens);

	// Resolve chunks to minutes and sum
	return resolveChunks(chunks, rng, config);
}

/**
 * Tokenize notation string into components
 *
 * Recognizes: numbers, dice notation (NdN), units, operators (+/-)
 */
function tokenize(notation: string): DurationToken[] {
	const tokens: DurationToken[] = [];
	const regex = /(\d+d\d+|\d+|minutes?|hours?|days?|weeks?|months?|years?|[+\-])/gi;
	let match: RegExpExecArray | null;

	while ((match = regex.exec(notation)) !== null) {
		const value = match[1];
		const position = match.index;

		// Determine token type
		let type: TokenType;
		if (/^\d+d\d+$/i.test(value)) {
			type = 'dice';
		} else if (/^\d+$/.test(value)) {
			type = 'number';
		} else if (/^(minutes?|hours?|days?|weeks?|months?|years?)$/i.test(value)) {
			type = 'unit';
		} else if (/^[+\-]$/.test(value)) {
			type = 'operator';
		} else {
			throw new Error(`Invalid token at position ${position}: "${value}"`);
		}

		tokens.push({ type, value, position });
	}

	if (tokens.length === 0) {
		throw new Error('No valid tokens found in duration notation');
	}

	return tokens;
}

/**
 * Parse tokens into duration chunks
 *
 * Expected patterns:
 * - [number|dice] unit
 * - operator [number|dice] unit
 *
 * Each chunk represents: sign * value * unit
 */
function parseChunks(tokens: DurationToken[]): DurationChunk[] {
	const chunks: DurationChunk[] = [];
	let currentSign = 1; // Default to positive for first chunk
	let i = 0;

	while (i < tokens.length) {
		const token = tokens[i];

		// Handle leading operator
		if (token.type === 'operator') {
			currentSign = token.value === '-' ? -1 : 1;
			i++;
			// Check if operator is trailing (no more tokens or next token is also operator)
			if (i >= tokens.length) {
				throw new Error(
					`Trailing operator "${token.value}" at position ${token.position} without following value`
				);
			}
			continue;
		}

		// Expect [number|dice] unit pattern
		if (token.type !== 'number' && token.type !== 'dice') {
			throw new Error(
				`Expected number or dice notation at position ${token.position}, got "${token.value}"`
			);
		}

		const valueToken = token;
		i++;

		// Next token must be a unit
		if (i >= tokens.length) {
			throw new Error(
				`Missing unit after ${valueToken.type} "${valueToken.value}" at position ${valueToken.position}`
			);
		}

		const unitToken = tokens[i];
		if (unitToken.type !== 'unit') {
			throw new Error(
				`Expected unit at position ${unitToken.position}, got "${unitToken.value}"`
			);
		}
		i++;

		// Normalize unit (remove plural 's')
		const unit = normalizeUnit(unitToken.value);

		// Create chunk
		const chunk: DurationChunk = {
			value: valueToken.type === 'dice' ? 0 : parseInt(valueToken.value),
			isDice: valueToken.type === 'dice',
			diceNotation: valueToken.type === 'dice' ? valueToken.value : undefined,
			unit,
			sign: currentSign
		};

		chunks.push(chunk);

		// Reset sign for next chunk (will be overridden if operator follows)
		currentSign = 1;
	}

	if (chunks.length === 0) {
		throw new Error('No valid duration chunks found');
	}

	return chunks;
}

/**
 * Normalize unit string (strip plural 's')
 */
function normalizeUnit(unit: string): string {
	// Remove trailing 's' for plural forms
	return unit.replace(/s$/, '');
}

/**
 * Resolve duration chunks to absolute minutes
 *
 * - Roll dice notation to get values
 * - Convert all units to minutes
 * - Apply signs and sum
 */
function resolveChunks(
	chunks: DurationChunk[],
	rng: ISeededRandomizer,
	config: DurationUnitConfig
): number {
	let totalMinutes = 0;

	for (const chunk of chunks) {
		// Resolve value (roll dice if needed)
		let value = chunk.value;
		if (chunk.isDice && chunk.diceNotation) {
			const rollResult = rng.rollDice(chunk.diceNotation);
			value = rollResult.total;
		}

		// Convert to minutes based on unit
		const minutes = convertToMinutes(value, chunk.unit, config);

		// Apply sign and accumulate
		totalMinutes += chunk.sign * minutes;
	}

	// Duration cannot be negative
	if (totalMinutes < 0) {
		throw new Error(
			`Duration cannot be negative (resolved to ${totalMinutes} minutes). Check notation for subtraction errors.`
		);
	}

	return Math.floor(totalMinutes);
}

/**
 * Convert value in given unit to minutes
 */
function convertToMinutes(value: number, unit: string, config: DurationUnitConfig): number {
	switch (unit) {
		case 'minute':
			return value;

		case 'hour':
			return value * config.minutesPerHour;

		case 'day':
			return value * config.hoursPerDay * config.minutesPerHour;

		case 'week':
			return value * config.daysPerWeek * config.hoursPerDay * config.minutesPerHour;

		case 'month':
			return value * config.daysPerMonth * config.hoursPerDay * config.minutesPerHour;

		case 'year':
			return value * config.daysPerYear * config.hoursPerDay * config.minutesPerHour;

		default:
			throw new Error(`Unknown duration unit: "${unit}"`);
	}
}
