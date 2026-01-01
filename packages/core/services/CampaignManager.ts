/**
 * Campaign Manager Service
 *
 * Core service for managing campaign lifecycle (create, update, delete, list).
 * Platform-agnostic - works with any persistence adapter.
 *
 * Responsibilities:
 * - Generate UUIDs for new campaigns
 * - Validate required fields
 * - Ensure only one campaign is active at a time
 * - Update lastAccessedAt timestamp on activation
 * - Prevent deletion of active campaign
 *
 * Usage:
 * ```typescript
 * const campaignManager = new CampaignManager(persistenceAdapter, idGenerator);
 * const newCampaign = await campaignManager.createCampaign({
 *   name: "Curse of Strahd",
 *   worldId: "world-ravenloft"
 * });
 * ```
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Campaign profile structure
 *
 * This is the core data model for a campaign, stored by the persistence adapter.
 */
export interface CampaignProfile {
	id: string;                    // "campaign-{uuid}"
	name: string;                  // Human-readable name
	worldId: string;               // "world-{slug}"
	createdAt: number;             // Unix timestamp (milliseconds)
	lastAccessedAt?: number;       // Unix timestamp
	isActive: boolean;             // Only one active per session
	description?: string;          // Optional user description

	// Path mappings (Obsidian-specific, but defined here for type safety)
	pathMappings?: Record<string, string>;

	// Library management
	activeLibraryIds: string[];    // List of enabled library UUIDs

	// Campaign-specific settings (Phase 2+)
	settings?: {
		inflationModifier?: number;
		currencySystemId?: string;
		calendarSystemId?: string;
		currentGameDate?: string;
		featureFlags?: Record<string, boolean>;
	};
}

/**
 * Campaign persistence adapter interface
 *
 * Platforms must implement this to provide campaign storage.
 * Obsidian uses data.json, Backend uses SQLite, Mobile uses AsyncStorage.
 */
export interface ICampaignPersistence {
	/**
	 * Load all campaigns from persistent storage
	 */
	loadCampaigns(): Promise<CampaignProfile[]>;

	/**
	 * Save all campaigns to persistent storage
	 * @param campaigns - Complete list of campaigns (replaces existing)
	 */
	saveCampaigns(campaigns: CampaignProfile[]): Promise<void>;
}

/**
 * Campaign Manager Service
 *
 * Manages CRUD operations for campaign profiles.
 * Delegates persistence to platform-specific adapter.
 */
export class CampaignManager {
	private campaigns: CampaignProfile[] = [];
	private loaded: boolean = false;

	constructor(
		private persistence: ICampaignPersistence,
		private idGenerator: () => string = () => `campaign-${uuidv4()}`
	) {}

	/**
	 * Load campaigns from storage
	 * Must be called before using other methods
	 */
	async initialize(): Promise<void> {
		if (this.loaded) {
			return; // Already loaded
		}

		this.campaigns = await this.persistence.loadCampaigns();
		this.loaded = true;
	}

	/**
	 * Ensure campaigns are loaded
	 * Throws error if not initialized
	 */
	private ensureLoaded(): void {
		if (!this.loaded) {
			throw new Error('CampaignManager not initialized. Call initialize() first.');
		}
	}

	/**
	 * Create a new campaign profile
	 *
	 * @param profile - Partial campaign data (id and timestamps auto-generated)
	 * @returns Complete campaign profile with generated ID
	 */
	async createCampaign(profile: Partial<CampaignProfile>): Promise<CampaignProfile> {
		this.ensureLoaded();

		// Generate ID if not provided
		const id = profile.id || this.idGenerator();

		// Validate required fields
		if (!profile.name || profile.name.trim().length === 0) {
			throw new Error('Campaign name is required');
		}

		if (profile.name.length > 100) {
			throw new Error('Campaign name must be 100 characters or less');
		}

		if (!profile.worldId || !profile.worldId.startsWith('world-')) {
			throw new Error('Campaign worldId is required and must start with "world-"');
		}

		// Check for duplicate ID
		if (this.campaigns.some(c => c.id === id)) {
			throw new Error(`Campaign with ID ${id} already exists`);
		}

		// Create complete profile with defaults
		const now = Date.now();
		const newCampaign: CampaignProfile = {
			id,
			name: profile.name.trim(),
			worldId: profile.worldId,
			createdAt: profile.createdAt || now,
			lastAccessedAt: profile.lastAccessedAt || now,
			isActive: profile.isActive ?? false,
			description: profile.description?.trim(),
			pathMappings: profile.pathMappings || {},
			activeLibraryIds: profile.activeLibraryIds || [],
			settings: profile.settings
		};

		// If this is the first campaign, make it active
		if (this.campaigns.length === 0) {
			newCampaign.isActive = true;
		}

		// If setting as active, deactivate others
		if (newCampaign.isActive) {
			this.campaigns.forEach(c => c.isActive = false);
		}

		// Add to collection
		this.campaigns.push(newCampaign);

		// Persist
		await this.persistence.saveCampaigns(this.campaigns);

		return newCampaign;
	}

	/**
	 * Update an existing campaign
	 *
	 * @param id - Campaign ID to update
	 * @param updates - Partial campaign data to merge
	 */
	async updateCampaign(id: string, updates: Partial<CampaignProfile>): Promise<void> {
		this.ensureLoaded();

		const index = this.campaigns.findIndex(c => c.id === id);
		if (index === -1) {
			throw new Error(`Campaign not found: ${id}`);
		}

		// Validate name if provided
		if (updates.name !== undefined) {
			if (updates.name.trim().length === 0) {
				throw new Error('Campaign name cannot be empty');
			}
			if (updates.name.length > 100) {
				throw new Error('Campaign name must be 100 characters or less');
			}
		}

		// Validate worldId if provided
		if (updates.worldId !== undefined && !updates.worldId.startsWith('world-')) {
			throw new Error('Campaign worldId must start with "world-"');
		}

		// Prevent ID changes
		if (updates.id && updates.id !== id) {
			throw new Error('Cannot change campaign ID');
		}

		// Prevent createdAt changes
		if (updates.createdAt && updates.createdAt !== this.campaigns[index].createdAt) {
			throw new Error('Cannot change campaign creation timestamp');
		}

		// If setting as active, deactivate others
		if (updates.isActive === true) {
			this.campaigns.forEach(c => c.isActive = false);
		}

		// Merge updates
		this.campaigns[index] = {
			...this.campaigns[index],
			...updates,
			// Ensure required fields aren't cleared
			id: this.campaigns[index].id,
			name: updates.name?.trim() || this.campaigns[index].name,
			worldId: updates.worldId || this.campaigns[index].worldId,
			createdAt: this.campaigns[index].createdAt,
			activeLibraryIds: updates.activeLibraryIds ?? this.campaigns[index].activeLibraryIds
		};

		// Persist
		await this.persistence.saveCampaigns(this.campaigns);
	}

	/**
	 * Delete a campaign
	 *
	 * @param id - Campaign ID to delete
	 * @throws Error if campaign is active (must deactivate first)
	 */
	async deleteCampaign(id: string): Promise<void> {
		this.ensureLoaded();

		const index = this.campaigns.findIndex(c => c.id === id);
		if (index === -1) {
			throw new Error(`Campaign not found: ${id}`);
		}

		// Prevent deletion of active campaign
		if (this.campaigns[index].isActive) {
			throw new Error('Cannot delete active campaign. Switch to another campaign first.');
		}

		// Remove from collection
		this.campaigns.splice(index, 1);

		// Persist
		await this.persistence.saveCampaigns(this.campaigns);
	}

	/**
	 * Get a specific campaign by ID
	 *
	 * @param id - Campaign ID
	 * @returns Campaign profile or null if not found
	 */
	async getCampaign(id: string): Promise<CampaignProfile | null> {
		this.ensureLoaded();

		const campaign = this.campaigns.find(c => c.id === id);
		return campaign ? { ...campaign } : null; // Return copy to prevent mutation
	}

	/**
	 * Get all campaigns
	 *
	 * @returns Array of all campaign profiles
	 */
	async listCampaigns(): Promise<CampaignProfile[]> {
		this.ensureLoaded();

		// Return copies to prevent mutation
		return this.campaigns.map(c => ({ ...c }));
	}

	/**
	 * Set the active campaign
	 * Deactivates all other campaigns and updates lastAccessedAt
	 *
	 * @param id - Campaign ID to activate
	 */
	async setActiveCampaign(id: string): Promise<void> {
		this.ensureLoaded();

		const campaign = this.campaigns.find(c => c.id === id);
		if (!campaign) {
			throw new Error(`Campaign not found: ${id}`);
		}

		// Deactivate all campaigns
		this.campaigns.forEach(c => c.isActive = false);

		// Activate target campaign and update timestamp
		campaign.isActive = true;
		campaign.lastAccessedAt = Date.now();

		// Persist
		await this.persistence.saveCampaigns(this.campaigns);
	}

	/**
	 * Get the currently active campaign
	 *
	 * @returns Active campaign profile or null if none active
	 */
	async getActiveCampaign(): Promise<CampaignProfile | null> {
		this.ensureLoaded();

		const activeCampaign = this.campaigns.find(c => c.isActive);
		return activeCampaign ? { ...activeCampaign } : null;
	}

	/**
	 * Get campaigns by world ID
	 *
	 * @param worldId - World ID to filter by
	 * @returns Array of campaigns belonging to this world
	 */
	async getCampaignsByWorld(worldId: string): Promise<CampaignProfile[]> {
		this.ensureLoaded();

		return this.campaigns
			.filter(c => c.worldId === worldId)
			.map(c => ({ ...c }));
	}

	/**
	 * Check if a campaign name is already in use (case-insensitive)
	 *
	 * @param name - Campaign name to check
	 * @param excludeId - Optional campaign ID to exclude from check (for updates)
	 * @returns True if name is already used
	 */
	async isNameTaken(name: string, excludeId?: string): Promise<boolean> {
		this.ensureLoaded();

		const normalizedName = name.trim().toLowerCase();
		return this.campaigns.some(c =>
			c.name.toLowerCase() === normalizedName &&
			c.id !== excludeId
		);
	}

	/**
	 * Get total campaign count
	 *
	 * @returns Number of campaigns
	 */
	async getCampaignCount(): Promise<number> {
		this.ensureLoaded();

		return this.campaigns.length;
	}

	/**
	 * Clone an existing campaign
	 *
	 * Creates a copy of a campaign with a new ID and name.
	 * Useful for GMs running the same adventure with multiple groups.
	 *
	 * **Important**: This only clones the campaign profile (metadata).
	 * It does NOT clone actual data files (shops, party, transactions).
	 * Data cloning is platform-specific and handled by the adapter layer.
	 *
	 * @param sourceCampaignId - Campaign ID to clone from
	 * @param newName - Name for the cloned campaign
	 * @param options - Cloning options
	 * @returns Complete cloned campaign profile
	 */
	async cloneCampaign(
		sourceCampaignId: string,
		newName: string,
		options?: {
			description?: string;
			worldId?: string;
			updatePathMappings?: boolean; // If true, update folder names with campaign suffix
		}
	): Promise<CampaignProfile> {
		this.ensureLoaded();

		// Get source campaign
		const sourceCampaign = this.campaigns.find(c => c.id === sourceCampaignId);
		if (!sourceCampaign) {
			throw new Error(`Source campaign not found: ${sourceCampaignId}`);
		}

		// Validate new name
		if (await this.isNameTaken(newName)) {
			throw new Error(`Campaign name "${newName}" is already in use`);
		}

		// Generate new ID
		const newId = this.idGenerator();

		// Create suffix for path mappings (if requested)
		const pathSuffix = options?.updatePathMappings
			? `-${newName.toLowerCase().replace(/\s+/g, '-').substring(0, 20)}`
			: '';

		// Clone path mappings with optional suffix
		const clonedPathMappings = options?.updatePathMappings && sourceCampaign.pathMappings
			? Object.fromEntries(
				Object.entries(sourceCampaign.pathMappings).map(([key, value]) => {
					// Add suffix to folder paths, not individual files
					if (value.endsWith('/')) {
						// It's a folder - add suffix
						return [key, value.replace(/\/$/, pathSuffix + '/')];
					} else if (value.includes('/')) {
						// It's a file in a folder - add suffix to folder part
						const lastSlash = value.lastIndexOf('/');
						const folder = value.substring(0, lastSlash);
						const filename = value.substring(lastSlash);
						return [key, folder + pathSuffix + filename];
					} else {
						// It's a root-level file - add suffix before extension
						const lastDot = value.lastIndexOf('.');
						if (lastDot > 0) {
							const name = value.substring(0, lastDot);
							const ext = value.substring(lastDot);
							return [key, name + pathSuffix + ext];
						}
						return [key, value + pathSuffix];
					}
				})
			)
			: { ...sourceCampaign.pathMappings };

		// Create cloned profile
		const clonedProfile: CampaignProfile = {
			id: newId,
			name: newName.trim(),
			worldId: options?.worldId || sourceCampaign.worldId,
			createdAt: Date.now(),
			lastAccessedAt: Date.now(),
			isActive: false, // Cloned campaigns start inactive
			description: options?.description || `Cloned from "${sourceCampaign.name}"`,
			pathMappings: clonedPathMappings,
			activeLibraryIds: [...(sourceCampaign.activeLibraryIds || [])],
			settings: sourceCampaign.settings ? { ...sourceCampaign.settings } : undefined
		};

		// Add to collection
		this.campaigns.push(clonedProfile);

		// Persist
		await this.persistence.saveCampaigns(this.campaigns);

		console.log(`[CampaignManager] Cloned campaign: ${sourceCampaignId} -> ${newId} (${newName})`);

		return clonedProfile;
	}
}
