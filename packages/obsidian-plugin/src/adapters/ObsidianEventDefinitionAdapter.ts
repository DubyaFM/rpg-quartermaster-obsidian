/**
 * ObsidianEventDefinitionAdapter
 *
 * Handles loading event definitions from YAML files in vault.
 * Implements IEventDefinitionAdapter for platform-agnostic event system.
 *
 * Event Definition Sources (in priority order):
 * 1. Calendar Settings Events: config/calendars/*.yaml (holidays, seasons)
 * 2. Module Events: config/events/*.yaml (weather, economy, moons)
 * 3. Campaign Events: campaigns/{id}/events.json (campaign-specific)
 *
 * Features:
 * - YAML parsing for easy editing
 * - Multiple source directories with priority
 * - In-memory caching for performance
 * - Optional file watcher for hot-reload
 * - Context-based filtering (location, faction, season, region)
 */

import { App, TFile, normalizePath } from 'obsidian';
import * as yaml from 'js-yaml';
import { IEventDefinitionAdapter } from '@quartermaster/core/interfaces/IEventDefinitionAdapter';
import { AnyEventDefinition, EventContext } from '@quartermaster/core/models/eventTypes';

export class ObsidianEventDefinitionAdapter implements IEventDefinitionAdapter {
	private definitionCache: Map<string, AnyEventDefinition> = new Map();
	private cacheTimestamp: number = 0;
	private lastInvalidated: string | null = null;

	constructor(
		private app: App,
		private pluginDir: string
	) {}

	/**
	 * Load all event definitions from vault sources
	 * Sources checked in order: calendars, events, campaigns
	 *
	 * @param context Optional filtering context
	 * @returns Array of event definitions
	 */
	async loadEventDefinitions(context?: EventContext): Promise<AnyEventDefinition[]> {
		// Return cached definitions if available
		if (this.definitionCache.size > 0) {
			return this.filterByContext(Array.from(this.definitionCache.values()), context);
		}

		const definitions: AnyEventDefinition[] = [];

		// Load from calendar YAML files (holidays, intercalary days)
		const calendarDefs = await this.loadFromCalendars();
		definitions.push(...calendarDefs);

		// Load from event module YAML files (weather, economy, moons)
		const moduleDefs = await this.loadFromEventModules();
		definitions.push(...moduleDefs);

		// Load from campaign-specific JSON (if available)
		const campaignDefs = await this.loadFromCampaigns();
		definitions.push(...campaignDefs);

		// Populate cache
		this.populateCache(definitions);
		this.cacheTimestamp = Date.now();

		return this.filterByContext(definitions, context);
	}

	/**
	 * Load a specific event definition by ID
	 *
	 * @param id Event identifier
	 * @returns Event definition or null if not found
	 */
	async loadEventDefinitionById(id: string): Promise<AnyEventDefinition | null> {
		// Check cache first
		if (this.definitionCache.has(id)) {
			return this.definitionCache.get(id)!;
		}

		// Load all definitions (populates cache)
		await this.loadEventDefinitions();

		return this.definitionCache.get(id) || null;
	}

	/**
	 * Load multiple event definitions by IDs (batch operation)
	 *
	 * @param ids Array of event identifiers
	 * @returns Array of definitions (null for missing)
	 */
	async loadEventDefinitionsByIds(ids: string[]): Promise<(AnyEventDefinition | null)[]> {
		// Ensure cache is populated
		if (this.definitionCache.size === 0) {
			await this.loadEventDefinitions();
		}

		return ids.map(id => this.definitionCache.get(id) || null);
	}

	/**
	 * Get list of all available event IDs
	 *
	 * @returns Array of event IDs
	 */
	async listEventDefinitionIds(): Promise<string[]> {
		// Ensure cache is populated
		if (this.definitionCache.size === 0) {
			await this.loadEventDefinitions();
		}

		return Array.from(this.definitionCache.keys());
	}

	/**
	 * Check if an event definition exists
	 *
	 * @param id Event identifier
	 * @returns True if definition exists
	 */
	async hasEventDefinition(id: string): Promise<boolean> {
		// Check cache first
		if (this.definitionCache.has(id)) {
			return true;
		}

		// Load all definitions (populates cache)
		await this.loadEventDefinitions();

		return this.definitionCache.has(id);
	}

	/**
	 * Invalidate cached event definitions
	 * Forces fresh load on next request
	 */
	async invalidateDefinitionCache(): Promise<void> {
		this.definitionCache.clear();
		this.cacheTimestamp = 0;
		this.lastInvalidated = new Date().toISOString();
		console.log('[EventDefinitionAdapter] Cache invalidated');
	}

	/**
	 * Get cache status and diagnostics
	 *
	 * @returns Cache status object
	 */
	getDefinitionCacheInfo(): {
		cached: boolean;
		definitionCount: number;
		ageMs: number;
		lastInvalidated?: string;
	} | null {
		if (this.definitionCache.size === 0) {
			return null;
		}

		return {
			cached: true,
			definitionCount: this.definitionCache.size,
			ageMs: Date.now() - this.cacheTimestamp,
			lastInvalidated: this.lastInvalidated || undefined
		};
	}

	// ============================================================================
	// Private Helper Methods
	// ============================================================================

	/**
	 * Load event definitions from calendar YAML files
	 * Extracts holidays as fixed date events
	 *
	 * @private
	 * @returns Array of event definitions from calendars
	 */
	private async loadFromCalendars(): Promise<AnyEventDefinition[]> {
		const definitions: AnyEventDefinition[] = [];

		try {
			const calendarsDir = normalizePath(`${this.pluginDir}/config/calendars`);

			// Check if calendars directory exists
			const dirExists = await this.app.vault.adapter.exists(calendarsDir);
			if (!dirExists) {
				console.log(`[EventDefinitionAdapter] No calendars directory found: ${calendarsDir}`);
				return definitions;
			}

			// List all files in calendars directory
			const listing = await this.app.vault.adapter.list(calendarsDir);

			// Load each YAML file
			for (const filePath of listing.files) {
				if (!filePath.endsWith('.yaml') && !filePath.endsWith('.yml')) {
					continue;
				}

				try {
					const content = await this.app.vault.adapter.read(filePath);
					const parsed: any = yaml.load(content);

					// Extract holidays as fixed date events
					if (parsed.holidays && Array.isArray(parsed.holidays)) {
						for (const holiday of parsed.holidays) {
							// Convert holiday definition to FixedDateEvent
							const eventDef = this.convertHolidayToEvent(holiday, parsed.id);
							if (eventDef) {
								definitions.push(eventDef);
							}
						}
					}
				} catch (error) {
					console.error(`[EventDefinitionAdapter] Error loading calendar ${filePath}:`, error);
				}
			}

			console.log(`[EventDefinitionAdapter] Loaded ${definitions.length} event definitions from calendars`);
		} catch (error) {
			console.error(`[EventDefinitionAdapter] Error loading calendars:`, error);
		}

		return definitions;
	}

	/**
	 * Load event definitions from event module YAML files
	 * Supports fixed, interval, chain, and conditional events
	 *
	 * @private
	 * @returns Array of event definitions from modules
	 */
	private async loadFromEventModules(): Promise<AnyEventDefinition[]> {
		const definitions: AnyEventDefinition[] = [];

		try {
			const eventsDir = normalizePath(`${this.pluginDir}/config/events`);

			// Check if events directory exists
			const dirExists = await this.app.vault.adapter.exists(eventsDir);
			if (!dirExists) {
				console.log(`[EventDefinitionAdapter] No events directory found: ${eventsDir}`);
				return definitions;
			}

			// List all files in events directory
			const listing = await this.app.vault.adapter.list(eventsDir);

			// Load each YAML file
			for (const filePath of listing.files) {
				if (!filePath.endsWith('.yaml') && !filePath.endsWith('.yml')) {
					continue;
				}

				try {
					const content = await this.app.vault.adapter.read(filePath);
					const parsed: any = yaml.load(content);

					// Support both single event and array of events in file
					if (Array.isArray(parsed)) {
						// Array of events
						for (const eventDef of parsed) {
							if (this.isValidEventDefinition(eventDef)) {
								definitions.push(eventDef as AnyEventDefinition);
							}
						}
					} else if (parsed && typeof parsed === 'object') {
						// Check if this is an events array wrapper
						if (parsed.events && Array.isArray(parsed.events)) {
							for (const eventDef of parsed.events) {
								if (this.isValidEventDefinition(eventDef)) {
									definitions.push(eventDef as AnyEventDefinition);
								}
							}
						} else if (this.isValidEventDefinition(parsed)) {
							// Single event object
							definitions.push(parsed as AnyEventDefinition);
						}
					}
				} catch (error) {
					console.error(`[EventDefinitionAdapter] Error loading event module ${filePath}:`, error);
				}
			}

			console.log(`[EventDefinitionAdapter] Loaded ${definitions.length} event definitions from modules`);
		} catch (error) {
			console.error(`[EventDefinitionAdapter] Error loading event modules:`, error);
		}

		return definitions;
	}

	/**
	 * Load event definitions from campaign-specific JSON files
	 * Path pattern: campaigns/{campaignId}/events.json
	 *
	 * @private
	 * @returns Array of event definitions from campaigns
	 */
	private async loadFromCampaigns(): Promise<AnyEventDefinition[]> {
		const definitions: AnyEventDefinition[] = [];

		try {
			// Check if campaigns directory exists
			const campaignsDir = normalizePath('campaigns');
			const dirExists = await this.app.vault.adapter.exists(campaignsDir);
			if (!dirExists) {
				console.log(`[EventDefinitionAdapter] No campaigns directory found`);
				return definitions;
			}

			// List all campaign directories
			const listing = await this.app.vault.adapter.list(campaignsDir);

			// Check each campaign directory for events.json
			for (const subDir of listing.folders) {
				const eventsPath = normalizePath(`${subDir}/events.json`);
				const fileExists = await this.app.vault.adapter.exists(eventsPath);

				if (fileExists) {
					try {
						const content = await this.app.vault.adapter.read(eventsPath);
						const parsed = JSON.parse(content);

						// Support both single event and array of events
						if (Array.isArray(parsed)) {
							for (const eventDef of parsed) {
								if (this.isValidEventDefinition(eventDef)) {
									definitions.push(eventDef as AnyEventDefinition);
								}
							}
						} else if (parsed && typeof parsed === 'object') {
							// Check for events array wrapper
							if (parsed.events && Array.isArray(parsed.events)) {
								for (const eventDef of parsed.events) {
									if (this.isValidEventDefinition(eventDef)) {
										definitions.push(eventDef as AnyEventDefinition);
									}
								}
							} else if (this.isValidEventDefinition(parsed)) {
								definitions.push(parsed as AnyEventDefinition);
							}
						}
					} catch (error) {
						console.error(`[EventDefinitionAdapter] Error loading campaign events ${eventsPath}:`, error);
					}
				}
			}

			console.log(`[EventDefinitionAdapter] Loaded ${definitions.length} event definitions from campaigns`);
		} catch (error) {
			console.error(`[EventDefinitionAdapter] Error loading campaign events:`, error);
		}

		return definitions;
	}

	/**
	 * Convert calendar holiday to FixedDateEvent
	 *
	 * @private
	 * @param holiday Holiday definition from calendar YAML
	 * @param calendarId Calendar identifier
	 * @returns FixedDateEvent or null if invalid
	 */
	private convertHolidayToEvent(holiday: any, calendarId: string): AnyEventDefinition | null {
		try {
			// Holidays from calendars become FixedDateEvents with minimal effects
			// GMs can override with full event definitions in config/events/
			const eventId = `holiday-${calendarId}-${holiday.name.toLowerCase().replace(/\s+/g, '-')}`;

			// Determine date specification
			let month: number;
			let day: number;

			if (typeof holiday.dayOfYear === 'number') {
				// Calculate month and day from dayOfYear
				// This is a simplified calculation - calendar-specific logic should be in CalendarDriver
				// For now, we'll use the provided month/day if available, or skip if only dayOfYear
				if (typeof holiday.month === 'number' && typeof holiday.day === 'number') {
					month = holiday.month;
					day = holiday.day;
				} else {
					// Skip - can't convert dayOfYear without calendar context
					console.warn(`[EventDefinitionAdapter] Holiday "${holiday.name}" uses dayOfYear without month/day, skipping`);
					return null;
				}
			} else if (typeof holiday.month === 'number' && typeof holiday.day === 'number') {
				month = holiday.month;
				day = holiday.day;
			} else {
				console.warn(`[EventDefinitionAdapter] Holiday "${holiday.name}" missing date specification`);
				return null;
			}

			const eventDef: AnyEventDefinition = {
				id: eventId,
				name: holiday.name,
				type: 'fixed',
				date: {
					month,
					day
				},
				duration: 1,
				priority: 10, // Holidays have low priority (effects can override)
				effects: {}, // No effects by default
				description: holiday.description || undefined
			};

			return eventDef;
		} catch (error) {
			console.error(`[EventDefinitionAdapter] Error converting holiday to event:`, error);
			return null;
		}
	}

	/**
	 * Validate event definition has required fields
	 *
	 * @private
	 * @param obj Object to validate
	 * @returns True if valid event definition
	 */
	private isValidEventDefinition(obj: any): boolean {
		if (!obj || typeof obj !== 'object') {
			return false;
		}

		// Required fields for all events
		if (!obj.id || typeof obj.id !== 'string') {
			return false;
		}
		if (!obj.name || typeof obj.name !== 'string') {
			return false;
		}
		if (!obj.type || !['fixed', 'interval', 'chain', 'conditional'].includes(obj.type)) {
			return false;
		}
		if (typeof obj.priority !== 'number') {
			return false;
		}
		if (!obj.effects || typeof obj.effects !== 'object') {
			return false;
		}

		// Type-specific validation
		switch (obj.type) {
			case 'fixed':
				if (!obj.date || typeof obj.date !== 'object') {
					return false;
				}
				if (typeof obj.date.month !== 'number' || typeof obj.date.day !== 'number') {
					return false;
				}
				break;

			case 'interval':
				if (typeof obj.interval !== 'number') {
					return false;
				}
				break;

			case 'chain':
				if (typeof obj.seed !== 'number') {
					return false;
				}
				if (!Array.isArray(obj.states) || obj.states.length === 0) {
					return false;
				}
				break;

			case 'conditional':
				if (!obj.condition || typeof obj.condition !== 'string') {
					return false;
				}
				if (typeof obj.tier !== 'number' || (obj.tier !== 1 && obj.tier !== 2)) {
					return false;
				}
				break;
		}

		return true;
	}

	/**
	 * Populate cache with definitions
	 *
	 * @private
	 * @param definitions Array of event definitions
	 */
	private populateCache(definitions: AnyEventDefinition[]): void {
		this.definitionCache.clear();

		for (const def of definitions) {
			this.definitionCache.set(def.id, def);
		}
	}

	/**
	 * Filter definitions by context
	 *
	 * @private
	 * @param definitions Array of event definitions
	 * @param context Optional filtering context
	 * @returns Filtered array
	 */
	private filterByContext(definitions: AnyEventDefinition[], context?: EventContext): AnyEventDefinition[] {
		if (!context) {
			return definitions;
		}

		return definitions.filter(def => {
			// Filter by location
			if (context.location && def.locations && def.locations.length > 0) {
				if (!def.locations.includes(context.location)) {
					return false;
				}
			}

			// Filter by faction
			if (context.faction && def.factions && def.factions.length > 0) {
				if (!def.factions.includes(context.faction)) {
					return false;
				}
			}

			// Filter by season
			if (context.season && def.seasons && def.seasons.length > 0) {
				if (!def.seasons.includes(context.season)) {
					return false;
				}
			}

			// Filter by region
			if (context.region && def.regions && def.regions.length > 0) {
				if (!def.regions.includes(context.region)) {
					return false;
				}
			}

			// Filter by tags
			if (context.tags && context.tags.length > 0 && def.tags && def.tags.length > 0) {
				const hasMatchingTag = context.tags.some(tag => def.tags!.includes(tag));
				if (!hasMatchingTag) {
					return false;
				}
			}

			return true;
		});
	}
}
