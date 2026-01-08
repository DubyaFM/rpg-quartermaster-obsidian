// Event Definition Adapter Interface
// Abstracts event definition pack loading across platforms (Obsidian, Web, Mobile)

import { AnyEventDefinition, EventContext } from '../models/eventTypes';

/**
 * Adapter for loading event definition packs
 *
 * Event definitions are static game data (holidays, weather patterns, economic cycles).
 * This adapter loads them from platform-specific sources:
 * - Obsidian: YAML files in vault
 * - Web: Database or JSON files from server
 * - Mobile: Bundled JSON or embedded database
 *
 * Implementations should consider caching for performance, as definitions
 * are loaded frequently during world advancement and rarely change at runtime.
 */
export interface IEventDefinitionAdapter {
	/**
	 * Load all event definitions from persistent storage
	 *
	 * Returns the complete set of available event definitions (fixed, interval, chain, conditional).
	 * Implementations may filter by context if supported.
	 *
	 * @param context Optional filtering context (location, faction, season, etc.)
	 * @returns Promise resolving to array of event definitions
	 * @throws Error if storage access fails (file I/O, database errors, etc.)
	 *
	 * Caching Notes:
	 * - Implementations MAY cache definitions after first load
	 * - Cache should be invalidated on file modifications (Obsidian)
	 * - Should support optional cache invalidation via parameters
	 *
	 * Platform Notes:
	 * - Obsidian: Scans vault for event definition YAML files
	 * - Web: Queries events table from SQLite or REST endpoint
	 * - Mobile: Reads from bundled JSON or embedded SQLite
	 */
	loadEventDefinitions(context?: EventContext): Promise<AnyEventDefinition[]>;

	/**
	 * Load a specific event definition by its unique ID
	 *
	 * @param id Event identifier (e.g., "weather-blizzard", "holiday-new-year")
	 * @returns Promise resolving to event definition, or null if not found
	 * @throws Error if storage access fails
	 *
	 * Performance Notes:
	 * - Should use cached definitions if available
	 * - For large definition packs, prefer loading by ID over loadEventDefinitions()
	 *
	 * Platform Notes:
	 * - Obsidian: Searches YAML files for matching id field
	 * - Web: Queries events table by id
	 * - Mobile: Searches bundled JSON or embedded database
	 */
	loadEventDefinitionById(id: string): Promise<AnyEventDefinition | null>;

	/**
	 * Load event definitions matching a set of IDs
	 *
	 * Batch version of loadEventDefinitionById() for efficiency.
	 *
	 * @param ids Array of event identifiers
	 * @returns Promise resolving to array of definitions (same order as input, null for missing)
	 * @throws Error if storage access fails
	 *
	 * Implementation Notes:
	 * - Must preserve order (definitions[i] corresponds to ids[i])
	 * - Include null for missing definitions (don't skip)
	 * - Callers handle null filtering as needed
	 */
	loadEventDefinitionsByIds(ids: string[]): Promise<(AnyEventDefinition | null)[]>;

	/**
	 * Get list of all available event IDs
	 *
	 * Lightweight method for discovery without loading full definitions.
	 * Useful for validation, UI dropdowns, or preloading checks.
	 *
	 * @returns Promise resolving to array of event IDs
	 * @throws Error if storage access fails
	 */
	listEventDefinitionIds(): Promise<string[]>;

	/**
	 * Check if an event definition exists
	 *
	 * @param id Event identifier
	 * @returns Promise resolving to true if definition exists, false otherwise
	 */
	hasEventDefinition(id: string): Promise<boolean>;

	/**
	 * Invalidate cached event definitions
	 *
	 * Called when event packs are modified, or to force fresh load from storage.
	 * Optional method - only used by adapters that implement caching.
	 *
	 * @returns Promise resolving when cache is cleared
	 *
	 * Platform Notes:
	 * - Obsidian: Clear in-memory cache (file watcher handles automatic updates)
	 * - Web: Clear query cache
	 * - Mobile: Optional (bundled definitions don't change)
	 */
	invalidateDefinitionCache?(): Promise<void>;

	/**
	 * Get cache status and diagnostics
	 *
	 * Optional method for debugging and monitoring cache behavior.
	 * Implementations that don't cache should return null.
	 *
	 * @returns Cache status object, or null if not cached
	 *
	 * Example Return:
	 * ```typescript
	 * {
	 *   cached: true,
	 *   definitionCount: 42,
	 *   ageMs: 3600000,  // milliseconds since loaded
	 *   lastInvalidated: '2026-01-05T10:30:00Z'
	 * }
	 * ```
	 */
	getDefinitionCacheInfo?(): {
		cached: boolean;
		definitionCount: number;
		ageMs: number;
		lastInvalidated?: string;
	} | null;
}
