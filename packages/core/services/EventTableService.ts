/**
 * EventTableService - Business logic for event table management
 * Platform-agnostic service for managing event tables and rolling events
 * Compatible with Javalent Dice Roller plugin format
 */

import {
	CustomEventTable,
	EventTableEntry,
	ValidationResult
} from '../models/stronghold';
import {
	rollDice,
	selectEventByRoll,
	checkTableCoverage,
	checkTableOverlaps,
	IRandomizer,
	DiceType
} from '../generators/eventRoller';

export class EventTableService {
	private tables: Map<string, CustomEventTable> = new Map();
	private maxChainDepth: number = 1; // Single-level chaining only

	/**
	 * Load event tables from provided array
	 * Typically called by adapter layer after reading YAML files
	 */
	loadEventTables(tables: CustomEventTable[]): void {
		this.tables.clear();
		for (const table of tables) {
			this.tables.set(table.id, table);
		}
	}

	/**
	 * Get an event table by ID
	 */
	getTable(tableId: string): CustomEventTable | undefined {
		return this.tables.get(tableId);
	}

	/**
	 * Get all loaded tables
	 */
	getAllTables(): CustomEventTable[] {
		return Array.from(this.tables.values());
	}

	/**
	 * Get tables by dice type
	 */
	getTablesByDiceType(diceType: DiceType): CustomEventTable[] {
		return Array.from(this.tables.values()).filter(t => t.diceType === diceType);
	}

	/**
	 * Roll on an event table
	 * Automatically handles single-level nested tables
	 */
	rollEvent(tableId: string, randomizer: IRandomizer): {
		success: boolean;
		event?: EventTableEntry;
		roll?: number;
		nestedEvent?: EventTableEntry;
		nestedRoll?: number;
		error?: string;
	} {
		const table = this.getTable(tableId);
		if (!table) {
			return {
				success: false,
				error: `Event table ${tableId} not found`
			};
		}

		// Roll on primary table
		const roll = rollDice(table.diceType, randomizer);
		const event = selectEventByRoll(table, roll);

		if (!event) {
			return {
				success: false,
				roll,
				error: `No event found for roll ${roll} on table ${tableId}`
			};
		}

		// Check if this triggers a nested event
		if (event.resultType === 'trigger_event' && event.nestedTableId) {
			const nestedResult = this.resolveNestedEvent(event, randomizer, 0);

			if (!nestedResult.success) {
				return {
					success: false,
					roll,
					event,
					error: nestedResult.error
				};
			}

			return {
				success: true,
				roll,
				event,
				nestedEvent: nestedResult.event,
				nestedRoll: nestedResult.roll
			};
		}

		// Narrative event (no nesting)
		return {
			success: true,
			roll,
			event
		};
	}

	/**
	 * Roll on an event table with a specific roll value (DM override)
	 */
	rollEventWithValue(tableId: string, rollValue: number): {
		success: boolean;
		event?: EventTableEntry;
		error?: string;
	} {
		const table = this.getTable(tableId);
		if (!table) {
			return {
				success: false,
				error: `Event table ${tableId} not found`
			};
		}

		const event = selectEventByRoll(table, rollValue);

		if (!event) {
			return {
				success: false,
				error: `No event found for roll ${rollValue} on table ${tableId}`
			};
		}

		return {
			success: true,
			event
		};
	}

	/**
	 * Resolve a nested event (single-level chaining only)
	 * @param entry - The event entry that triggers a nested table
	 * @param randomizer - Random number generator
	 * @param depth - Current recursion depth (enforces max depth)
	 */
	private resolveNestedEvent(
		entry: EventTableEntry,
		randomizer: IRandomizer,
		depth: number
	): {
		success: boolean;
		event?: EventTableEntry;
		roll?: number;
		error?: string;
	} {
		// Enforce maximum chain depth
		if (depth >= this.maxChainDepth) {
			return {
				success: false,
				error: `Maximum chain depth (${this.maxChainDepth}) exceeded`
			};
		}

		if (!entry.nestedTableId) {
			return {
				success: false,
				error: 'Nested table ID not specified'
			};
		}

		const nestedTable = this.getTable(entry.nestedTableId);
		if (!nestedTable) {
			return {
				success: false,
				error: `Nested table ${entry.nestedTableId} not found`
			};
		}

		// Roll on nested table
		const roll = rollDice(nestedTable.diceType, randomizer);
		const event = selectEventByRoll(nestedTable, roll);

		if (!event) {
			return {
				success: false,
				roll,
				error: `No event found for roll ${roll} on nested table ${entry.nestedTableId}`
			};
		}

		// Nested tables should not chain further (single-level only)
		if (event.resultType === 'trigger_event') {
			return {
				success: false,
				error: 'Nested tables cannot trigger additional events (single-level chaining only)'
			};
		}

		return {
			success: true,
			event,
			roll
		};
	}

	/**
	 * Validate an event table structure
	 * Checks for overlapping ranges, gaps, and chaining depth
	 */
	validateTable(table: CustomEventTable): ValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Basic structure validation
		if (!table.id || table.id.trim() === '') {
			errors.push('Table ID is required');
		}

		if (!table.name || table.name.trim() === '') {
			errors.push('Table name is required');
		}

		if (!table.events || table.events.length === 0) {
			errors.push('Table must have at least one event');
			return { valid: false, errors, warnings };
		}

		// Check for overlapping ranges
		const overlapCheck = checkTableOverlaps(table);
		if (overlapCheck.hasOverlaps) {
			for (const overlap of overlapCheck.overlaps) {
				errors.push(`Roll value ${overlap.value} is covered by multiple events: ${overlap.events.join(', ')}`);
			}
		}

		// Check for gaps
		const coverageCheck = checkTableCoverage(table);
		if (!coverageCheck.complete) {
			for (const gap of coverageCheck.gaps) {
				if (gap.min === gap.max) {
					warnings.push(`Roll value ${gap.min} is not covered by any event`);
				} else {
					warnings.push(`Roll range ${gap.min}-${gap.max} is not covered by any events`);
				}
			}
		}

		// Validate each event
		for (const event of table.events) {
			const eventErrors = this.validateEventEntry(event, table);
			errors.push(...eventErrors);
		}

		// Check nested table chaining depth
		for (const event of table.events) {
			if (event.resultType === 'trigger_event' && event.nestedTableId) {
				const nestedTable = this.getTable(event.nestedTableId);
				if (nestedTable) {
					// Check if nested table has any trigger_event entries (not allowed)
					const hasNestedTriggers = nestedTable.events.some(e => e.resultType === 'trigger_event');
					if (hasNestedTriggers) {
						errors.push(`Nested table ${event.nestedTableId} contains trigger_event entries. Only single-level chaining is allowed.`);
					}
				}
			}
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings
		};
	}

	/**
	 * Validate a single event entry
	 */
	private validateEventEntry(event: EventTableEntry, table: CustomEventTable): string[] {
		const errors: string[] = [];

		if (!event.id) {
			errors.push('Event ID is required');
		}

		if (!event.eventName || event.eventName.trim() === '') {
			errors.push('Event name is required');
		}

		// Validate roll range
		if (event.rollRange.min > event.rollRange.max) {
			errors.push(`Event ${event.eventName}: roll range min (${event.rollRange.min}) cannot be greater than max (${event.rollRange.max})`);
		}

		// Validate range is within dice type bounds
		const maxDiceValue = this.getMaxDiceValue(table.diceType);
		const minDiceValue = 1;

		if (event.rollRange.min < minDiceValue) {
			errors.push(`Event ${event.eventName}: roll range min (${event.rollRange.min}) is below minimum for ${table.diceType} (${minDiceValue})`);
		}

		if (event.rollRange.max > maxDiceValue) {
			errors.push(`Event ${event.eventName}: roll range max (${event.rollRange.max}) exceeds maximum for ${table.diceType} (${maxDiceValue})`);
		}

		// Validate trigger_event has nested table ID
		if (event.resultType === 'trigger_event' && !event.nestedTableId) {
			errors.push(`Event ${event.eventName}: trigger_event result type requires nestedTableId`);
		}

		// Validate narrative events don't have nested table ID
		if (event.resultType === 'narrative' && event.nestedTableId) {
			errors.push(`Event ${event.eventName}: narrative result type should not have nestedTableId`);
		}

		return errors;
	}

	/**
	 * Get maximum dice value for a dice type
	 */
	private getMaxDiceValue(diceType: DiceType): number {
		switch (diceType) {
			case 'd100': return 100;
			case 'd20': return 20;
			case 'd12': return 12;
			case 'd10': return 10;
			case 'd8': return 8;
			case 'd6': return 6;
			case 'd4': return 4;
			default: return 20;
		}
	}

	/**
	 * Add or update a table
	 */
	addTable(table: CustomEventTable): void {
		this.tables.set(table.id, table);
	}

	/**
	 * Remove a table
	 */
	removeTable(tableId: string): boolean {
		return this.tables.delete(tableId);
	}

	/**
	 * Check if a table exists
	 */
	hasTable(tableId: string): boolean {
		return this.tables.has(tableId);
	}

	/**
	 * Get table count
	 */
	getTableCount(): number {
		return this.tables.size;
	}

	/**
	 * Clear all tables
	 */
	clearTables(): void {
		this.tables.clear();
	}

	/**
	 * Search tables by name
	 */
	searchTables(query: string): CustomEventTable[] {
		const lowerQuery = query.toLowerCase();
		return Array.from(this.tables.values()).filter(t =>
			t.name.toLowerCase().includes(lowerQuery) ||
			(t.description && t.description.toLowerCase().includes(lowerQuery))
		);
	}

	/**
	 * Export table to Javalent Dice Roller markdown format
	 * Useful for compatibility with the plugin
	 */
	exportToMarkdown(tableId: string): string | null {
		const table = this.getTable(tableId);
		if (!table) {
			return null;
		}

		let markdown = `# ${table.name}\n\n`;

		if (table.description) {
			markdown += `${table.description}\n\n`;
		}

		// Create table header
		markdown += `| dice: ${table.diceType} | Event |\n`;
		markdown += `| ---------- | ----- |\n`;

		// Add event entries
		for (const event of table.events) {
			const range = event.rollRange.min === event.rollRange.max
				? `${event.rollRange.min}`
				: `${event.rollRange.min}-${event.rollRange.max}`;

			const result = event.resultType === 'trigger_event' && event.nestedTableId
				? `Roll on [[${event.nestedTableId}]]`
				: event.description;

			markdown += `| ${range} | ${event.eventName}: ${result} |\n`;
		}

		return markdown;
	}
}
