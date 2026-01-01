/**
 * EventTableFileHandler - Handles event table YAML file operations
 * Loads and caches event tables from config folder
 */

import { App, TFile } from 'obsidian';
import { CustomEventTable, ValidationResult } from '@quartermaster/core/models/stronghold';
import * as yaml from 'js-yaml';

export class EventTableFileHandler {
	private tableCache: Map<string, CustomEventTable> = new Map();
	private cacheValid: boolean = false;

	constructor(private app: App) {}

	/**
	 * Load all event tables from config folder
	 */
	async loadEventTables(folderPath: string): Promise<CustomEventTable[]> {
		// Return cached tables if cache is valid
		if (this.cacheValid && this.tableCache.size > 0) {
			return Array.from(this.tableCache.values());
		}

		const tables: CustomEventTable[] = [];
		const files = this.app.vault.getFiles();

		for (const file of files) {
			if (file.path.startsWith(folderPath) && file.extension === 'yaml') {
				try {
					const table = await this.loadTable(file);
					if (table) {
						tables.push(table);
						this.tableCache.set(table.id, table);
					}
				} catch (error) {
					console.error(`Error loading event table from ${file.path}:`, error);
				}
			}
		}

		this.cacheValid = true;
		return tables;
	}

	/**
	 * Load a single event table from a file
	 */
	async loadTable(file: TFile): Promise<CustomEventTable | null> {
		try {
			const content = await this.app.vault.read(file);
			const data = yaml.load(content) as any;

			if (!data || !data.id) {
				return null;
			}

			const table: CustomEventTable = {
				id: data.id,
				name: data.name || 'Unnamed Event Table',
				description: data.description,
				diceType: data.diceType || 'd20',
				events: data.events || [],
				metadata: {
					createdDate: data.metadata?.createdDate || new Date().toISOString(),
					lastModified: data.metadata?.lastModified || new Date().toISOString()
				}
			};

			return table;
		} catch (error) {
			console.error(`Error parsing event table from ${file.path}:`, error);
			return null;
		}
	}

	/**
	 * Save an event table to YAML file
	 */
	async saveEventTable(table: CustomEventTable, folderPath: string): Promise<void> {
		const fileName = `${table.id}.yaml`;
		const filePath = `${folderPath}/${fileName}`;

		// Prepare table data
		const data = {
			id: table.id,
			name: table.name,
			description: table.description,
			diceType: table.diceType,
			events: table.events,
			metadata: {
				...table.metadata,
				lastModified: new Date().toISOString()
			}
		};

		// Convert to YAML
		const content = yaml.dump(data, {
			indent: 2,
			lineWidth: -1,
			noRefs: true
		});

		// Check if file exists
		const existingFile = this.app.vault.getAbstractFileByPath(filePath);

		if (existingFile && existingFile instanceof TFile) {
			// Update existing file
			await this.app.vault.modify(existingFile, content);
		} else {
			// Create new file
			await this.ensureFolder(folderPath);
			await this.app.vault.create(filePath, content);
		}

		// Update cache
		this.tableCache.set(table.id, table);
	}

	/**
	 * Delete an event table file
	 */
	async deleteTable(tableId: string, folderPath: string): Promise<void> {
		const filePath = `${folderPath}/${tableId}.yaml`;
		const file = this.app.vault.getAbstractFileByPath(filePath);

		if (file && file instanceof TFile) {
			await this.app.vault.delete(file);
			this.tableCache.delete(tableId);
		}
	}

	/**
	 * Validate an event table structure
	 * Returns validation result with errors and warnings
	 */
	validateEventTable(table: CustomEventTable): ValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Basic validation
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

		// Validate dice type
		const validDiceTypes = ['d100', 'd20', 'd12', 'd10', 'd8', 'd6', 'd4'];
		if (!validDiceTypes.includes(table.diceType)) {
			errors.push(`Invalid dice type: ${table.diceType}. Must be one of: ${validDiceTypes.join(', ')}`);
		}

		// Check for overlapping ranges
		const covered = new Set<number>();
		const overlaps: Array<{ value: number; events: string[] }> = [];

		for (const event of table.events) {
			// Validate range
			if (event.rollRange.min > event.rollRange.max) {
				errors.push(`Event "${event.eventName}": roll range min (${event.rollRange.min}) > max (${event.rollRange.max})`);
			}

			// Check for overlaps
			for (let i = event.rollRange.min; i <= event.rollRange.max; i++) {
				if (covered.has(i)) {
					const existing = overlaps.find(o => o.value === i);
					if (existing) {
						existing.events.push(event.eventName);
					} else {
						overlaps.push({ value: i, events: [event.eventName] });
					}
				}
				covered.add(i);
			}

			// Validate trigger_event entries
			if (event.resultType === 'trigger_event' && !event.nestedTableId) {
				errors.push(`Event "${event.eventName}": trigger_event result type requires nestedTableId`);
			}
		}

		// Report overlaps
		for (const overlap of overlaps) {
			errors.push(`Roll value ${overlap.value} is covered by multiple events: ${overlap.events.join(', ')}`);
		}

		// Check for gaps
		const maxValue = this.getMaxDiceValue(table.diceType);
		const minValue = 1;
		const gaps: Array<{ min: number; max: number }> = [];
		let gapStart: number | null = null;

		for (let i = minValue; i <= maxValue; i++) {
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
			gaps.push({ min: gapStart, max: maxValue });
		}

		// Report gaps as warnings
		for (const gap of gaps) {
			if (gap.min === gap.max) {
				warnings.push(`Roll value ${gap.min} is not covered by any event`);
			} else {
				warnings.push(`Roll range ${gap.min}-${gap.max} is not covered by any events`);
			}
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings
		};
	}

	/**
	 * Get maximum dice value for validation
	 */
	private getMaxDiceValue(diceType: string): number {
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
	 * Invalidate table cache (call when files change)
	 */
	invalidateCache(): void {
		this.cacheValid = false;
	}

	/**
	 * Clear table cache completely
	 */
	clearCache(): void {
		this.tableCache.clear();
		this.cacheValid = false;
	}

	/**
	 * Get table from cache
	 */
	getCachedTable(tableId: string): CustomEventTable | undefined {
		return this.tableCache.get(tableId);
	}

	/**
	 * Check if cache is valid
	 */
	isCacheValid(): boolean {
		return this.cacheValid;
	}

	/**
	 * Ensure folder exists, create if needed
	 */
	private async ensureFolder(path: string): Promise<void> {
		const folder = this.app.vault.getAbstractFileByPath(path);
		if (!folder) {
			await this.app.vault.createFolder(path);
		}
	}
}
