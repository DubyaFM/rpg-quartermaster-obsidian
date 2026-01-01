/**
 * Obsidian Campaign Persistence Service
 *
 * Handles reading/writing campaign profiles to Obsidian's data.json.
 * Implements ICampaignPersistence from core package.
 *
 * Responsibilities:
 * - Load campaigns from data.json
 * - Save campaigns to data.json (atomic writes)
 * - Migrate legacy settings to default campaign on first load
 * - Preserve existing plugin data (containers, items, currency, settings)
 * - Validate JSON schema on load
 *
 * Data Structure:
 * ```json
 * {
 *   "campaigns": [],
 *   "settings": {},
 *   "containers": [],
 *   "items": [],
 *   "currency": {}
 * }
 * ```
 */

import { Plugin } from 'obsidian';
import { CampaignProfile, ICampaignPersistence } from '@quartermaster/core/services/CampaignManager';
import { RPGShopkeepSettings } from '@quartermaster/core/models/types';

/**
 * Obsidian plugin data structure
 * Contains campaigns plus other plugin data
 */
export interface ObsidianPluginData {
	campaigns?: CampaignProfile[];
	settings?: RPGShopkeepSettings;
	containers?: any[];
	items?: any[];
	currency?: { [playerId: string]: any };
	// Allow other fields for future expansion
	[key: string]: any;
}

/**
 * Obsidian implementation of campaign persistence
 *
 * Stores campaign profiles in the plugin's data.json file.
 * Uses Obsidian's built-in loadData/saveData methods.
 */
export class ObsidianCampaignPersistence implements ICampaignPersistence {
	constructor(private plugin: Plugin) {}

	/**
	 * Load all campaigns from data.json
	 *
	 * @returns Array of campaign profiles (empty if none exist)
	 */
	async loadCampaigns(): Promise<CampaignProfile[]> {
		try {
			const data = await this.plugin.loadData() as ObsidianPluginData | null;

			// If no data file exists, return empty array
			if (!data) {
				console.log('[ObsidianCampaignPersistence] No data file found, returning empty campaigns');
				return [];
			}

			// If campaigns array doesn't exist, return empty array
			if (!data.campaigns) {
				console.log('[ObsidianCampaignPersistence] No campaigns array found, returning empty');
				return [];
			}

			// Validate campaigns array
			if (!Array.isArray(data.campaigns)) {
				console.error('[ObsidianCampaignPersistence] campaigns field is not an array:', data.campaigns);
				throw new Error('Invalid data.json: campaigns must be an array');
			}

			// Basic validation of each campaign
			const validatedCampaigns = data.campaigns.filter((campaign, index) => {
				if (!campaign.id || !campaign.name || !campaign.worldId) {
					console.warn(`[ObsidianCampaignPersistence] Skipping invalid campaign at index ${index}:`, campaign);
					return false;
				}
				return true;
			});

			console.log(`[ObsidianCampaignPersistence] Loaded ${validatedCampaigns.length} campaigns`);
			return validatedCampaigns;
		} catch (error) {
			console.error('[ObsidianCampaignPersistence] Error loading campaigns:', error);
			throw new Error(`Failed to load campaigns: ${error.message}`);
		}
	}

	/**
	 * Save all campaigns to data.json
	 *
	 * IMPORTANT: This preserves all other fields in data.json (settings, containers, items, currency)
	 * Only the campaigns array is replaced.
	 *
	 * @param campaigns - Complete list of campaigns to save
	 */
	async saveCampaigns(campaigns: CampaignProfile[]): Promise<void> {
		try {
			// Load existing data to preserve other fields
			const existingData = await this.plugin.loadData() as ObsidianPluginData | null || {};

			// Create updated data with new campaigns array
			const updatedData: ObsidianPluginData = {
				...existingData,
				campaigns
			};

			// Save atomically (Obsidian's saveData handles atomic writes)
			await this.plugin.saveData(updatedData);

			console.log(`[ObsidianCampaignPersistence] Saved ${campaigns.length} campaigns`);
		} catch (error) {
			console.error('[ObsidianCampaignPersistence] Error saving campaigns:', error);
			throw new Error(`Failed to save campaigns: ${error.message}`);
		}
	}

	/**
	 * Migrate legacy settings to default campaign
	 *
	 * This method creates a default campaign from existing plugin settings
	 * if no campaigns exist yet. This ensures backward compatibility for
	 * users upgrading from pre-campaign versions.
	 *
	 * Migration process:
	 * 1. Check if campaigns array already exists (skip if yes)
	 * 2. Load existing settings to extract path configurations
	 * 3. Create default campaign with paths from settings
	 * 4. Save default campaign to data.json
	 *
	 * @returns True if migration occurred, false if campaigns already exist
	 */
	async migrateToDefaultCampaign(): Promise<boolean> {
		try {
			console.log('[ObsidianCampaignPersistence] Checking for legacy settings migration');

			// Load existing data
			const data = await this.plugin.loadData() as ObsidianPluginData | null;

			// If no data file, nothing to migrate
			if (!data) {
				console.log('[ObsidianCampaignPersistence] No data file found, no migration needed');
				return false;
			}

			// If campaigns already exist, no migration needed
			if (data.campaigns && data.campaigns.length > 0) {
				console.log('[ObsidianCampaignPersistence] Campaigns already exist, no migration needed');
				return false;
			}

			console.log('[ObsidianCampaignPersistence] Migrating legacy settings to default campaign');

			// Extract settings (if they exist)
			const settings = data.settings as any || {};

			// Create default campaign from settings
			const defaultCampaign: CampaignProfile = {
				id: 'campaign_default',
				name: 'Default Campaign',
				worldId: 'world-custom',
				createdAt: Date.now(),
				lastAccessedAt: Date.now(),
				isActive: true,
				description: 'Automatically migrated from plugin settings',
				pathMappings: {
					shops: settings?.shopsFolder || 'Shops/',
					party: settings?.partyInventoryFile || 'Party Inventory.md',
					transactions: settings?.transactionLogFile || 'Transaction Log.md',
					npcs: 'NPCs/',
					locations: 'Locations/',
					factions: 'Factions/',
					jobs: 'Jobs/',
					projects: 'Projects/',
					'activity-log': 'activity-log.md',
					calendar: 'calendar-state.json',
					items: settings?.itemsFolders?.[0]?.path || 'Items/',
					libraries: 'Libraries/'
				},
				activeLibraryIds: []
			};

			// Save migrated campaign
			data.campaigns = [defaultCampaign];
			await this.plugin.saveData(data);

			console.log('[ObsidianCampaignPersistence] Migration complete: created default campaign');
			return true;
		} catch (error) {
			console.error('[ObsidianCampaignPersistence] Error during migration:', error);
			throw new Error(`Failed to migrate to default campaign: ${error.message}`);
		}
	}

	/**
	 * Get a specific campaign by ID
	 *
	 * Helper method for quick lookups without loading all campaigns.
	 *
	 * @param id - Campaign ID to find
	 * @returns Campaign profile or null if not found
	 */
	async getCampaign(id: string): Promise<CampaignProfile | null> {
		const campaigns = await this.loadCampaigns();
		return campaigns.find(c => c.id === id) || null;
	}

	/**
	 * Get the currently active campaign
	 *
	 * @returns Active campaign profile or null if none active
	 */
	async getActiveCampaign(): Promise<CampaignProfile | null> {
		const campaigns = await this.loadCampaigns();
		return campaigns.find(c => c.isActive) || null;
	}

	/**
	 * Check if any campaigns exist
	 *
	 * @returns True if at least one campaign exists
	 */
	async hasCampaigns(): Promise<boolean> {
		const campaigns = await this.loadCampaigns();
		return campaigns.length > 0;
	}

	/**
	 * Get campaign count
	 *
	 * @returns Number of campaigns
	 */
	async getCampaignCount(): Promise<number> {
		const campaigns = await this.loadCampaigns();
		return campaigns.length;
	}

	/**
	 * Validate data.json structure
	 *
	 * Checks that the data file has the expected structure.
	 * Used for debugging and error reporting.
	 *
	 * @returns Validation result with errors if any
	 */
	async validateDataStructure(): Promise<{ valid: boolean; errors: string[] }> {
		const errors: string[] = [];

		try {
			const data = await this.plugin.loadData() as ObsidianPluginData | null;

			if (!data) {
				errors.push('No data file found');
				return { valid: false, errors };
			}

			// Check campaigns array
			if (data.campaigns !== undefined) {
				if (!Array.isArray(data.campaigns)) {
					errors.push('campaigns field exists but is not an array');
				} else {
					// Validate each campaign
					data.campaigns.forEach((campaign, index) => {
						if (!campaign.id) {
							errors.push(`Campaign at index ${index} missing id`);
						}
						if (!campaign.name) {
							errors.push(`Campaign at index ${index} missing name`);
						}
						if (!campaign.worldId) {
							errors.push(`Campaign at index ${index} missing worldId`);
						}
					});
				}
			}

			// Check other expected fields
			if (data.settings !== undefined && typeof data.settings !== 'object') {
				errors.push('settings field exists but is not an object');
			}

			if (data.containers !== undefined && !Array.isArray(data.containers)) {
				errors.push('containers field exists but is not an array');
			}

			if (data.items !== undefined && !Array.isArray(data.items)) {
				errors.push('items field exists but is not an array');
			}

			if (data.currency !== undefined && typeof data.currency !== 'object') {
				errors.push('currency field exists but is not an object');
			}

		} catch (error) {
			errors.push(`Error reading data file: ${error.message}`);
		}

		return {
			valid: errors.length === 0,
			errors
		};
	}
}
