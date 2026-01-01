/**
 * Event table rolling and random event generation
 * Platform-agnostic functions for rolling on event tables and selecting events
 */

import { CustomEventTable, EventTableEntry } from '../models/stronghold';

/**
 * IRandomizer interface for platform-agnostic random number generation
 * Implementations should provide a method to generate random numbers in a range
 */
export interface IRandomizer {
	/**
	 * Generate a random integer between min and max (inclusive)
	 * @param min - Minimum value (inclusive)
	 * @param max - Maximum value (inclusive)
	 * @returns Random integer in range [min, max]
	 */
	randomInt(min: number, max: number): number;
}

/**
 * Standard dice type mapping
 */
export type DiceType = 'd100' | 'd20' | 'd12' | 'd10' | 'd8' | 'd6' | 'd4';

/**
 * Get the maximum value for a dice type
 * @param diceType - The type of dice
 * @returns Maximum roll value
 */
export function getMaxDiceValue(diceType: DiceType): number {
	switch (diceType) {
		case 'd100':
			return 100;
		case 'd20':
			return 20;
		case 'd12':
			return 12;
		case 'd10':
			return 10;
		case 'd8':
			return 8;
		case 'd6':
			return 6;
		case 'd4':
			return 4;
		default:
			return 20; // Default to d20
	}
}

/**
 * Get the minimum value for a dice type (always 1 for standard dice)
 * @param diceType - The type of dice
 * @returns Minimum roll value
 */
export function getMinDiceValue(diceType: DiceType): number {
	return 1;
}

/**
 * Roll a dice of the specified type
 * @param diceType - The type of dice to roll
 * @param randomizer - Random number generator
 * @returns Random roll result
 */
export function rollDice(diceType: DiceType, randomizer: IRandomizer): number {
	const min = getMinDiceValue(diceType);
	const max = getMaxDiceValue(diceType);
	return randomizer.randomInt(min, max);
}

/**
 * Select an event from a table based on a roll
 * @param table - The event table
 * @param roll - The dice roll result
 * @returns The matching event entry, or undefined if no match
 */
export function selectEventByRoll(
	table: CustomEventTable,
	roll: number
): EventTableEntry | undefined {
	for (const event of table.events) {
		if (roll >= event.rollRange.min && roll <= event.rollRange.max) {
			return event;
		}
	}
	return undefined;
}

/**
 * Roll on an event table and return the selected event
 * @param table - The event table
 * @param randomizer - Random number generator
 * @returns The selected event entry, or undefined if no match
 */
export function rollOnEventTable(
	table: CustomEventTable,
	randomizer: IRandomizer
): EventTableEntry | undefined {
	const roll = rollDice(table.diceType, randomizer);
	return selectEventByRoll(table, roll);
}

/**
 * Roll on an event table with explicit roll value (for DM override)
 * @param table - The event table
 * @param rollValue - The specific roll value to use
 * @returns The selected event entry, or undefined if no match
 */
export function rollOnEventTableWithValue(
	table: CustomEventTable,
	rollValue: number
): EventTableEntry | undefined {
	return selectEventByRoll(table, rollValue);
}

/**
 * Validate that a roll falls within valid range for the table's dice type
 * @param table - The event table
 * @param roll - The roll value to validate
 * @returns True if roll is valid for this table's dice type
 */
export function isValidRoll(table: CustomEventTable, roll: number): boolean {
	const min = getMinDiceValue(table.diceType);
	const max = getMaxDiceValue(table.diceType);
	return roll >= min && roll <= max;
}

/**
 * Check if an event table has complete coverage (no gaps in roll ranges)
 * @param table - The event table to check
 * @returns Object with coverage status and any gaps found
 */
export function checkTableCoverage(table: CustomEventTable): {
	complete: boolean;
	gaps: Array<{ min: number; max: number }>;
} {
	const min = getMinDiceValue(table.diceType);
	const max = getMaxDiceValue(table.diceType);

	const covered = new Set<number>();

	// Mark all covered values
	for (const event of table.events) {
		for (let i = event.rollRange.min; i <= event.rollRange.max; i++) {
			covered.add(i);
		}
	}

	// Find gaps
	const gaps: Array<{ min: number; max: number }> = [];
	let gapStart: number | null = null;

	for (let i = min; i <= max; i++) {
		if (!covered.has(i)) {
			if (gapStart === null) {
				gapStart = i;
			}
		} else {
			if (gapStart !== null) {
				gaps.push({ min: gapStart, max: i - 1 });
				gapStart = null;
			}
		}
	}

	// Handle gap at end
	if (gapStart !== null) {
		gaps.push({ min: gapStart, max: max });
	}

	return {
		complete: gaps.length === 0,
		gaps: gaps
	};
}

/**
 * Check if an event table has overlapping ranges
 * @param table - The event table to check
 * @returns Object with overlap status and any overlaps found
 */
export function checkTableOverlaps(table: CustomEventTable): {
	hasOverlaps: boolean;
	overlaps: Array<{
		value: number;
		events: string[];
	}>;
} {
	const valueToEvents = new Map<number, string[]>();

	// Map each value to all events that cover it
	for (const event of table.events) {
		for (let i = event.rollRange.min; i <= event.rollRange.max; i++) {
			if (!valueToEvents.has(i)) {
				valueToEvents.set(i, []);
			}
			valueToEvents.get(i)!.push(event.eventName);
		}
	}

	// Find values covered by multiple events
	const overlaps: Array<{ value: number; events: string[] }> = [];

	for (const [value, events] of valueToEvents.entries()) {
		if (events.length > 1) {
			overlaps.push({ value, events });
		}
	}

	return {
		hasOverlaps: overlaps.length > 0,
		overlaps: overlaps
	};
}

/**
 * Get all possible roll values for a dice type
 * @param diceType - The type of dice
 * @returns Array of all possible roll values
 */
export function getAllPossibleRolls(diceType: DiceType): number[] {
	const min = getMinDiceValue(diceType);
	const max = getMaxDiceValue(diceType);
	const rolls: number[] = [];

	for (let i = min; i <= max; i++) {
		rolls.push(i);
	}

	return rolls;
}

/**
 * Format a dice roll result as a string
 * @param diceType - The type of dice rolled
 * @param rollValue - The roll result
 * @returns Formatted string like "d20: 15"
 */
export function formatRollResult(diceType: DiceType, rollValue: number): string {
	return `${diceType}: ${rollValue}`;
}
