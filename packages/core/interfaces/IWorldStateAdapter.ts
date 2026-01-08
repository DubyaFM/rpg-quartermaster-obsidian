// World State Adapter Interface
// Abstracts world state persistence across platforms (Obsidian, Web, Mobile)

import { WorldState } from '../models/worldStateTypes';

/**
 * Adapter for loading and saving world state
 *
 * Implementations handle platform-specific persistence:
 * - Obsidian: File-based JSON (.quartermaster/world-state.json)
 * - Web: SQLite database (world_state table)
 * - Mobile: AsyncStorage (React Native)
 *
 * The world state includes:
 * - Current calendar clock position
 * - Chain event state vectors (for deterministic replay)
 * - GM overrides (manual event state changes)
 * - Module toggles (enable/disable event categories)
 * - Schema version (for migration support)
 */
export interface IWorldStateAdapter {
	/**
	 * Load the current world state from persistent storage
	 *
	 * @returns Promise resolving to WorldState object, or null if no saved state exists
	 * @throws Error if storage access fails (permissions, database errors, etc.)
	 *
	 * Platform Notes:
	 * - Obsidian: Checks primary then backup file location
	 * - Web: Queries SQLite world_state table with key='current'
	 * - Mobile: Reads from AsyncStorage @quartermaster/world_state key
	 */
	loadWorldState(): Promise<WorldState | null>;

	/**
	 * Save world state to persistent storage
	 *
	 * Should also create a backup copy (platform-specific location):
	 * - Obsidian: Creates .quartermaster/world-state.backup.json
	 * - Web: Maintains previous version in database (optional)
	 * - Mobile: No backup needed (AsyncStorage is atomic)
	 *
	 * @param state The complete world state to persist
	 * @throws Error if write fails (permissions, database errors, etc.)
	 *
	 * Implementation Requirements:
	 * - Must be atomic (all-or-nothing write)
	 * - Should update WorldState.lastSaved timestamp
	 * - Must validate state schema before writing
	 */
	saveWorldState(state: WorldState): Promise<void>;

	/**
	 * Restore world state from backup copy
	 *
	 * Used for recovery if primary state is corrupted.
	 * If no backup exists, returns null (caller decides fallback behavior).
	 *
	 * @returns Promise resolving to backed-up WorldState, or null if no backup exists
	 * @throws Error if backup file exists but cannot be read
	 *
	 * Platform Notes:
	 * - Obsidian: Reads from .quartermaster/world-state.backup.json
	 * - Web: Retrieves previous version from database (if versioning supported)
	 * - Mobile: Returns null (no backup mechanism)
	 */
	restoreWorldStateFromBackup(): Promise<WorldState | null>;

	/**
	 * Check if world state has been persisted
	 *
	 * Useful for determining whether to show "New Campaign" vs "Load Campaign" UI.
	 *
	 * @returns Promise resolving to true if saved state exists, false otherwise
	 */
	hasWorldState(): Promise<boolean>;

	/**
	 * Delete saved world state and backups
	 *
	 * Used when resetting campaign or creating new world.
	 * Implementation must handle both primary and backup locations.
	 *
	 * @throws Error if deletion fails (read-only storage, etc.)
	 */
	deleteWorldState(): Promise<void>;
}
