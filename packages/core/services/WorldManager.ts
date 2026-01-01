/**
 * World Manager Service
 *
 * Core service for managing world/setting definitions (create, update, delete, list).
 * Platform-agnostic - works with any persistence adapter.
 *
 * Responsibilities:
 * - Provide access to preset worlds
 * - Create custom user-defined worlds
 * - Validate required fields
 * - Prevent deletion of worlds that have active campaigns
 * - Generate slugified IDs for new worlds
 *
 * Usage:
 * ```typescript
 * const worldManager = new WorldManager(persistenceAdapter, campaignManager);
 * await worldManager.initialize();
 * const worlds = await worldManager.listWorlds(); // Returns both preset and custom worlds
 * const newWorld = await worldManager.createWorld({
 *   name: "My Homebrew World",
 *   currencySystemId: "dnd5e",
 *   calendarSystemId: "gregorian"
 * });
 * ```
 */

import { World, PRESET_WORLDS } from '../models/World';
import { CampaignProfile } from './CampaignManager';

/**
 * World persistence adapter interface
 *
 * Platforms must implement this to provide world storage.
 * Preset worlds are always available in-memory.
 * Only custom user-created worlds need persistent storage.
 */
export interface IWorldPersistence {
	/**
	 * Load all custom worlds from persistent storage
	 * @returns Array of custom (non-preset) worlds
	 */
	loadWorlds(): Promise<World[]>;

	/**
	 * Save all custom worlds to persistent storage
	 * @param worlds - Complete list of custom worlds (replaces existing)
	 */
	saveWorlds(worlds: World[]): Promise<void>;
}

/**
 * Campaign query interface for WorldManager
 *
 * WorldManager needs to check if worlds have associated campaigns.
 * Instead of tight coupling to CampaignManager, we use a minimal interface.
 */
export interface ICampaignQuery {
	/**
	 * Get campaigns by world ID
	 * @param worldId - World ID to filter by
	 * @returns Array of campaigns belonging to this world
	 */
	getCampaignsByWorld(worldId: string): Promise<CampaignProfile[]>;
}

/**
 * World Manager Service
 *
 * Manages CRUD operations for world definitions.
 * Combines preset worlds (always available) with custom worlds (persistent storage).
 */
export class WorldManager {
	private customWorlds: World[] = [];
	private loaded: boolean = false;

	constructor(
		private persistence: IWorldPersistence,
		private campaignQuery?: ICampaignQuery
	) {}

	/**
	 * Load custom worlds from storage
	 * Must be called before using other methods
	 */
	async initialize(): Promise<void> {
		if (this.loaded) {
			return; // Already loaded
		}

		this.customWorlds = await this.persistence.loadWorlds();
		this.loaded = true;
	}

	/**
	 * Ensure worlds are loaded
	 * Throws error if not initialized
	 */
	private ensureLoaded(): void {
		if (!this.loaded) {
			throw new Error('WorldManager not initialized. Call initialize() first.');
		}
	}

	/**
	 * Generate a slugified ID from a world name
	 * @param name - World name to slugify
	 * @returns World ID in format "world-{slug}"
	 */
	private generateWorldId(name: string): string {
		const slug = name
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
			.replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

		return `world-${slug}`;
	}

	/**
	 * List all worlds (preset + custom)
	 * @returns Array of all world definitions
	 */
	async listWorlds(): Promise<World[]> {
		this.ensureLoaded();

		// Return copies to prevent mutation, preset worlds first
		return [
			...PRESET_WORLDS.map(w => ({ ...w })),
			...this.customWorlds.map(w => ({ ...w }))
		];
	}

	/**
	 * Get a specific world by ID
	 * @param id - World ID
	 * @returns World definition or null if not found
	 */
	async getWorld(id: string): Promise<World | null> {
		this.ensureLoaded();

		// Check preset worlds first
		const preset = PRESET_WORLDS.find(w => w.id === id);
		if (preset) {
			return { ...preset }; // Return copy
		}

		// Check custom worlds
		const custom = this.customWorlds.find(w => w.id === id);
		return custom ? { ...custom } : null;
	}

	/**
	 * Create a new custom world
	 * @param world - Partial world data (id and timestamps auto-generated)
	 * @returns Complete world definition with generated ID
	 */
	async createWorld(world: Partial<World>): Promise<World> {
		this.ensureLoaded();

		// Validate required fields
		if (!world.name || world.name.trim().length === 0) {
			throw new Error('World name is required');
		}

		if (world.name.length > 100) {
			throw new Error('World name must be 100 characters or less');
		}

		if (!world.currencySystemId || world.currencySystemId.trim().length === 0) {
			throw new Error('Currency system ID is required');
		}

		if (!world.calendarSystemId || world.calendarSystemId.trim().length === 0) {
			throw new Error('Calendar system ID is required');
		}

		// Generate ID if not provided
		const id = world.id || this.generateWorldId(world.name);

		// Validate ID format
		if (!id.startsWith('world-')) {
			throw new Error('World ID must start with "world-"');
		}

		// Check for duplicate ID (both preset and custom)
		const allWorlds = [...PRESET_WORLDS, ...this.customWorlds];
		if (allWorlds.some(w => w.id === id)) {
			throw new Error(`World with ID "${id}" already exists`);
		}

		// Create complete world definition
		const now = Date.now();
		const newWorld: World = {
			id,
			name: world.name.trim(),
			description: world.description?.trim(),
			currencySystemId: world.currencySystemId.trim(),
			calendarSystemId: world.calendarSystemId.trim(),
			defaultLibraryIds: world.defaultLibraryIds || [],
			createdAt: world.createdAt || now,
			isOfficial: false // Custom worlds are never official
		};

		// Add to collection
		this.customWorlds.push(newWorld);

		// Persist
		await this.persistence.saveWorlds(this.customWorlds);

		return newWorld;
	}

	/**
	 * Update an existing custom world
	 * @param id - World ID to update
	 * @param updates - Partial world data to merge
	 * @throws Error if world is a preset (official worlds cannot be modified)
	 */
	async updateWorld(id: string, updates: Partial<World>): Promise<void> {
		this.ensureLoaded();

		// Prevent modification of preset worlds
		if (PRESET_WORLDS.some(w => w.id === id)) {
			throw new Error('Cannot modify official preset worlds');
		}

		// Find custom world
		const index = this.customWorlds.findIndex(w => w.id === id);
		if (index === -1) {
			throw new Error(`World not found: ${id}`);
		}

		// Validate name if provided
		if (updates.name !== undefined) {
			if (updates.name.trim().length === 0) {
				throw new Error('World name cannot be empty');
			}
			if (updates.name.length > 100) {
				throw new Error('World name must be 100 characters or less');
			}
		}

		// Validate currency system ID if provided
		if (updates.currencySystemId !== undefined && updates.currencySystemId.trim().length === 0) {
			throw new Error('Currency system ID cannot be empty');
		}

		// Validate calendar system ID if provided
		if (updates.calendarSystemId !== undefined && updates.calendarSystemId.trim().length === 0) {
			throw new Error('Calendar system ID cannot be empty');
		}

		// Prevent ID changes
		if (updates.id && updates.id !== id) {
			throw new Error('Cannot change world ID');
		}

		// Prevent createdAt changes
		if (updates.createdAt && updates.createdAt !== this.customWorlds[index].createdAt) {
			throw new Error('Cannot change world creation timestamp');
		}

		// Prevent isOfficial changes
		if (updates.isOfficial !== undefined) {
			throw new Error('Cannot change isOfficial flag (custom worlds are always non-official)');
		}

		// Merge updates
		this.customWorlds[index] = {
			...this.customWorlds[index],
			...updates,
			// Ensure required fields aren't cleared
			id: this.customWorlds[index].id,
			name: updates.name?.trim() || this.customWorlds[index].name,
			currencySystemId: updates.currencySystemId?.trim() || this.customWorlds[index].currencySystemId,
			calendarSystemId: updates.calendarSystemId?.trim() || this.customWorlds[index].calendarSystemId,
			defaultLibraryIds: updates.defaultLibraryIds ?? this.customWorlds[index].defaultLibraryIds,
			createdAt: this.customWorlds[index].createdAt,
			isOfficial: false
		};

		// Persist
		await this.persistence.saveWorlds(this.customWorlds);
	}

	/**
	 * Delete a custom world
	 * @param id - World ID to delete
	 * @throws Error if world is a preset or has active campaigns
	 */
	async deleteWorld(id: string): Promise<void> {
		this.ensureLoaded();

		// Prevent deletion of preset worlds
		if (PRESET_WORLDS.some(w => w.id === id)) {
			throw new Error('Cannot delete official preset worlds');
		}

		// Find custom world
		const index = this.customWorlds.findIndex(w => w.id === id);
		if (index === -1) {
			throw new Error(`World not found: ${id}`);
		}

		// Check if world has campaigns (if campaign query is available)
		if (this.campaignQuery) {
			const campaigns = await this.campaignQuery.getCampaignsByWorld(id);
			if (campaigns.length > 0) {
				throw new Error(
					`Cannot delete world "${this.customWorlds[index].name}" because it has ${campaigns.length} campaign(s). ` +
					'Delete or reassign those campaigns first.'
				);
			}
		}

		// Remove from collection
		this.customWorlds.splice(index, 1);

		// Persist
		await this.persistence.saveWorlds(this.customWorlds);
	}

	/**
	 * Get campaigns for a specific world
	 * @param worldId - World ID
	 * @returns Array of campaigns belonging to this world
	 * @throws Error if campaign query is not available
	 */
	async getCampaignsForWorld(worldId: string): Promise<CampaignProfile[]> {
		this.ensureLoaded();

		if (!this.campaignQuery) {
			throw new Error('Campaign query not available. WorldManager was initialized without ICampaignQuery.');
		}

		return await this.campaignQuery.getCampaignsByWorld(worldId);
	}

	/**
	 * Check if a world name is already in use (case-insensitive)
	 * Checks both preset and custom worlds
	 * @param name - World name to check
	 * @param excludeId - Optional world ID to exclude from check (for updates)
	 * @returns True if name is already used
	 */
	async isNameTaken(name: string, excludeId?: string): Promise<boolean> {
		this.ensureLoaded();

		const normalizedName = name.trim().toLowerCase();
		const allWorlds = [...PRESET_WORLDS, ...this.customWorlds];

		return allWorlds.some(w =>
			w.name.toLowerCase() === normalizedName &&
			w.id !== excludeId
		);
	}

	/**
	 * Get total world count (preset + custom)
	 * @returns Number of worlds
	 */
	async getWorldCount(): Promise<number> {
		this.ensureLoaded();

		return PRESET_WORLDS.length + this.customWorlds.length;
	}

	/**
	 * Get count of custom worlds only
	 * @returns Number of custom (non-preset) worlds
	 */
	async getCustomWorldCount(): Promise<number> {
		this.ensureLoaded();

		return this.customWorlds.length;
	}

	/**
	 * Check if a world is a preset (official) world
	 * @param id - World ID to check
	 * @returns True if world is a preset, false if custom or not found
	 */
	async isPresetWorld(id: string): Promise<boolean> {
		return PRESET_WORLDS.some(w => w.id === id);
	}
}
