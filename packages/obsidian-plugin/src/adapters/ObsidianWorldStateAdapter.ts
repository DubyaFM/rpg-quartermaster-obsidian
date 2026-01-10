/**
 * ObsidianWorldStateAdapter
 *
 * Handles loading and saving world state as JSON file in vault.
 * Default path: .quartermaster/world-state.json (configurable)
 * Implements IWorldStateAdapter for platform-agnostic world event services.
 *
 * Features:
 * - Configurable storage path (per campaign or shared across campaigns)
 * - Automatic backup creation (world-state.backup.json)
 * - Graceful handling of missing files (creates default state)
 * - JSON format for easy inspection and manual editing
 */

import { App, TFile, normalizePath } from 'obsidian';
import { IWorldStateAdapter } from '@quartermaster/core/interfaces/IWorldStateAdapter';
import { WorldState, WorldStateStoragePaths } from '@quartermaster/core/models/worldStateTypes';

export class ObsidianWorldStateAdapter implements IWorldStateAdapter {
	private storagePath: string;
	private backupPath: string;

	constructor(private app: App, storagePath?: string) {
		// Use provided path or default from WorldStateStoragePaths
		this.storagePath = normalizePath(storagePath || WorldStateStoragePaths.obsidian.primary);

		// Derive backup path by appending .backup before extension
		const dir = this.storagePath.substring(0, this.storagePath.lastIndexOf('/'));
		const filename = this.storagePath.substring(this.storagePath.lastIndexOf('/') + 1);
		const name = filename.substring(0, filename.lastIndexOf('.'));
		const ext = filename.substring(filename.lastIndexOf('.'));
		this.backupPath = normalizePath(`${dir}/${name}.backup${ext}`);
	}

	/**
	 * Load world state from vault
	 * Returns null if no saved state exists (graceful handling)
	 *
	 * @returns WorldState or null if not found
	 */
	async loadWorldState(): Promise<WorldState | null> {
		try {
			const file = this.app.vault.getAbstractFileByPath(this.storagePath);

			if (!file || !(file instanceof TFile)) {
				console.log(`[WorldStateAdapter] No saved world state found at ${this.storagePath}`);
				return null;
			}

			const content = await this.app.vault.read(file);
			const state = JSON.parse(content) as WorldState;

			// Validate required fields
			if (this.isValidWorldState(state)) {
				console.log(`[WorldStateAdapter] Loaded world state from ${this.storagePath}`);
				return state;
			} else {
				console.warn(`[WorldStateAdapter] Invalid world state format in ${this.storagePath}`);
				return null;
			}
		} catch (error) {
			console.error(`[WorldStateAdapter] Error loading world state:`, error);
			throw new Error(`Failed to load world state: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Save world state to vault
	 * Creates backup copy before overwriting
	 *
	 * @param state World state to save
	 */
	async saveWorldState(state: WorldState): Promise<void> {
		try {
			// Update lastSaved timestamp
			state.lastSaved = new Date().toISOString();

			// Ensure storage directory exists
			await this.ensureStorageDirectory();

			// Create backup of existing state (if it exists)
			await this.createBackup();

			// Convert to JSON with pretty formatting
			const content = JSON.stringify(state, null, 2);

			const file = this.app.vault.getAbstractFileByPath(this.storagePath);

			if (file && file instanceof TFile) {
				// Update existing file
				await this.app.vault.modify(file, content);
				console.log(`[WorldStateAdapter] Updated world state: ${this.storagePath}`);
			} else {
				// Create new file
				await this.app.vault.create(this.storagePath, content);
				console.log(`[WorldStateAdapter] Created world state: ${this.storagePath}`);
			}
		} catch (error) {
			console.error(`[WorldStateAdapter] Error saving world state:`, error);
			throw new Error(`Failed to save world state: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Restore world state from backup copy
	 * Used for recovery if primary state is corrupted
	 *
	 * @returns WorldState from backup, or null if no backup exists
	 */
	async restoreWorldStateFromBackup(): Promise<WorldState | null> {
		try {
			const backupFile = this.app.vault.getAbstractFileByPath(this.backupPath);

			if (!backupFile || !(backupFile instanceof TFile)) {
				console.log(`[WorldStateAdapter] No backup file found at ${this.backupPath}`);
				return null;
			}

			const content = await this.app.vault.read(backupFile);
			const state = JSON.parse(content) as WorldState;

			if (this.isValidWorldState(state)) {
				console.log(`[WorldStateAdapter] Restored world state from backup: ${this.backupPath}`);
				return state;
			} else {
				console.warn(`[WorldStateAdapter] Invalid backup format in ${this.backupPath}`);
				return null;
			}
		} catch (error) {
			console.error(`[WorldStateAdapter] Error restoring from backup:`, error);
			throw new Error(`Failed to restore from backup: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Check if world state file exists
	 *
	 * @returns True if saved state exists
	 */
	async hasWorldState(): Promise<boolean> {
		const file = this.app.vault.getAbstractFileByPath(this.storagePath);
		return file instanceof TFile;
	}

	/**
	 * Delete world state and backup files
	 * Used when resetting campaign
	 */
	async deleteWorldState(): Promise<void> {
		try {
			// Delete primary state file
			const file = this.app.vault.getAbstractFileByPath(this.storagePath);
			if (file && file instanceof TFile) {
				await this.app.vault.delete(file);
				console.log(`[WorldStateAdapter] Deleted world state: ${this.storagePath}`);
			}

			// Delete backup file
			const backupFile = this.app.vault.getAbstractFileByPath(this.backupPath);
			if (backupFile && backupFile instanceof TFile) {
				await this.app.vault.delete(backupFile);
				console.log(`[WorldStateAdapter] Deleted backup: ${this.backupPath}`);
			}
		} catch (error) {
			console.error(`[WorldStateAdapter] Error deleting world state:`, error);
			throw new Error(`Failed to delete world state: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Get current storage path
	 * Useful for debugging and UI display
	 *
	 * @returns Current storage path
	 */
	getStoragePath(): string {
		return this.storagePath;
	}

	/**
	 * Update storage path (allows dynamic configuration)
	 * Useful for switching between campaigns or custom paths
	 *
	 * @param path New storage path
	 */
	setStoragePath(path: string): void {
		this.storagePath = normalizePath(path);

		// Update backup path to match
		const dir = this.storagePath.substring(0, this.storagePath.lastIndexOf('/'));
		const filename = this.storagePath.substring(this.storagePath.lastIndexOf('/') + 1);
		const name = filename.substring(0, filename.lastIndexOf('.'));
		const ext = filename.substring(filename.lastIndexOf('.'));
		this.backupPath = normalizePath(`${dir}/${name}.backup${ext}`);
	}

	/**
	 * Create backup copy of current world state
	 * Called before saving new state
	 */
	private async createBackup(): Promise<void> {
		try {
			const file = this.app.vault.getAbstractFileByPath(this.storagePath);

			if (!file || !(file instanceof TFile)) {
				// No existing file to back up
				return;
			}

			const content = await this.app.vault.read(file);
			const backupFile = this.app.vault.getAbstractFileByPath(this.backupPath);

			if (backupFile && backupFile instanceof TFile) {
				// Update existing backup
				await this.app.vault.modify(backupFile, content);
			} else {
				// Create new backup
				await this.app.vault.create(this.backupPath, content);
			}

			console.log(`[WorldStateAdapter] Created backup: ${this.backupPath}`);
		} catch (error) {
			console.warn(`[WorldStateAdapter] Failed to create backup:`, error);
			// Don't throw - backup failure shouldn't block save operation
		}
	}

	/**
	 * Ensure storage directory exists
	 * Creates directory if it doesn't exist
	 */
	private async ensureStorageDirectory(): Promise<void> {
		const dir = this.storagePath.substring(0, this.storagePath.lastIndexOf('/'));

		if (!dir) {
			// File is in vault root - no directory to create
			return;
		}

		const folder = this.app.vault.getAbstractFileByPath(dir);

		if (!folder) {
			console.log(`[WorldStateAdapter] Creating storage directory: ${dir}`);
			await this.app.vault.createFolder(dir).catch((error: Error) => {
				if (!error.message.includes('already exists')) {
					throw error;
				}
			});
		}
	}

	/**
	 * Validate world state structure
	 * Ensures required fields are present
	 *
	 * @param state State to validate
	 * @returns True if state has required fields
	 */
	private isValidWorldState(state: any): state is WorldState {
		return (
			state &&
			typeof state.version === 'number' &&
			typeof state.activeCalendarId === 'string' &&
			state.clock &&
			typeof state.clock.currentDay === 'number' &&
			typeof state.clock.timeOfDay === 'number' &&
			state.chainStates &&
			typeof state.chainStates === 'object' &&
			Array.isArray(state.overrides) &&
			state.moduleToggles &&
			typeof state.moduleToggles === 'object'
		);
	}
}
