/**
 * Settings Migration (Phase 2)
 *
 * One-time migration to split existing RPGShopkeepSettings into:
 * - GlobalSettings (data.json.globalSettings)
 * - CampaignSettings (data.json.campaigns[].settings)
 *
 * Migration Strategy:
 * 1. Check if migration already run (settingsMigrationComplete flag)
 * 2. Extract settings from data.json.settings (legacy Phase 1)
 * 3. Split into global and campaign using SETTINGS_MIGRATION_MAP
 * 4. Save global to data.json.globalSettings
 * 5. Save campaign to default campaign (campaign_default)
 * 6. Mark migration complete
 * 7. Preserve all existing data (containers, items, currency, etc.)
 */

import { Plugin } from 'obsidian';
import { RPGShopkeepSettings } from '@quartermaster/core/models/types';
import {
	GlobalSettings,
	CampaignSettings,
	DEFAULT_GLOBAL_SETTINGS,
	DEFAULT_CAMPAIGN_SETTINGS,
	SETTINGS_MIGRATION_MAP,
} from '@quartermaster/core/models/Settings';

/**
 * Obsidian plugin data structure
 */
interface ObsidianPluginData {
	globalSettings?: GlobalSettings;
	campaigns?: Array<{
		id: string;
		settings?: CampaignSettings;
		pathMappings?: Record<string, string>;
		[key: string]: unknown;
	}>;
	settings?: RPGShopkeepSettings; // Legacy (Phase 1)
	settingsMigrationComplete?: boolean;
	[key: string]: unknown;
}

/**
 * Settings Migration Service
 *
 * Handles one-time migration from Phase 1 to Phase 2 settings structure
 */
export class SettingsMigration {
	/**
	 * Run settings migration if needed
	 *
	 * Idempotent: Safe to call multiple times (checks flag first)
	 *
	 * @param plugin Obsidian plugin instance
	 * @returns true if migration was performed, false if already migrated
	 */
	static async migrate(plugin: Plugin): Promise<boolean> {
		const data = (await plugin.loadData()) as ObsidianPluginData | null;

		// ─── Migration Already Complete ────────────────────────────────────────────
		if (data?.settingsMigrationComplete) {
			console.log('[SettingsMigration] Settings already migrated, skipping');
			return false;
		}

		// ─── No Data File (Fresh Install) ────────────────────────────────────────────
		if (!data) {
			console.log('[SettingsMigration] No data file found, creating defaults');
			await this.createDefaults(plugin);
			return true;
		}

		// ─── Migration Needed ────────────────────────────────────────────
		console.log('[SettingsMigration] Starting settings migration...');

		// Get legacy settings (Phase 1)
		const legacySettings = data.settings as RPGShopkeepSettings | undefined;

		if (!legacySettings) {
			console.log('[SettingsMigration] No legacy settings found, using defaults');
			await this.createDefaults(plugin);
			return true;
		}

		// Split legacy settings into global + campaign
		const { global, campaign } = this.splitLegacySettings(legacySettings);

		// ─── Update Data Structure ────────────────────────────────────────────
		data.globalSettings = global;

		// Find default campaign (should exist from Phase 1 migration)
		const defaultCampaign = data.campaigns?.find((c) => c.id === 'campaign_default');

		if (defaultCampaign) {
			// Merge campaign settings with existing pathMappings
			defaultCampaign.settings = {
				...campaign,
				pathMappings: {
					...campaign.pathMappings,
					...defaultCampaign.pathMappings, // Preserve Phase 1 pathMappings
				},
			};
		} else {
			console.warn(
				'[SettingsMigration] Default campaign not found, creating new one'
			);
			// Create default campaign if missing
			data.campaigns = [
				{
					id: 'campaign_default',
					name: 'Default Campaign',
					worldId: 'world-custom',
					description: 'Migrated from Phase 1 settings',
					isActive: true,
					createdAt: Date.now(),
					updatedAt: Date.now(),
					settings: campaign,
					pathMappings: (campaign.pathMappings || {
						shops: 'Shops/',
						party: 'Party Inventory.md',
						transactions: 'Transactions.md',
					}) as unknown as Record<string, string>,
					activeLibraryIds: campaign.activeLibraryIds || ['srd'],
				},
			];
		}

		// Mark migration complete
		data.settingsMigrationComplete = true;

		// Preserve legacy settings for rollback (optional)
		// data.settings_legacy_backup = data.settings;

		// Save updated data
		await plugin.saveData(data);

		console.log('[SettingsMigration] Migration complete!');
		console.log('[SettingsMigration] Global settings saved to globalSettings');
		console.log('[SettingsMigration] Campaign settings saved to campaigns[0].settings');

		return true;
	}

	/**
	 * Create default global and campaign settings for fresh installs
	 *
	 * @param plugin Obsidian plugin instance
	 * @private
	 */
	private static async createDefaults(plugin: Plugin): Promise<void> {
		const data: ObsidianPluginData = {
			globalSettings: { ...DEFAULT_GLOBAL_SETTINGS },
			campaigns: [
				{
					id: 'campaign_default',
					name: 'Default Campaign',
					worldId: 'world-custom',
					description: 'Default campaign',
					isActive: true,
					createdAt: Date.now(),
					updatedAt: Date.now(),
					settings: { ...DEFAULT_CAMPAIGN_SETTINGS } as CampaignSettings,
					pathMappings: {
						shops: 'Shops/',
						party: 'Party Inventory.md',
						transactions: 'Transactions.md',
						npcs: 'NPCs/',
						locations: 'Locations/',
						factions: 'Factions/',
						jobs: 'Jobs/',
						projects: 'Projects/',
						projectTemplates: 'Project Templates/',
						activityLog: 'Activity Log.md',
						strongholds: 'Strongholds/',
						strongholdStashes: 'Stronghold Stashes/',
						facilities: 'Facilities/',
						orders: 'Orders/',
						eventTables: 'Event Tables/',
						hirelings: 'Hirelings/',
						partyMembers: 'Party Members/',
						jobNotificationLog: 'Job Notifications.md',
					},
					activeLibraryIds: ['srd'],
				},
			],
			settingsMigrationComplete: true,
		};

		await plugin.saveData(data);
		console.log('[SettingsMigration] Created default global and campaign settings');
	}

	/**
	 * Split legacy RPGShopkeepSettings into global and campaign settings
	 *
	 * Uses SETTINGS_MIGRATION_MAP to determine scope
	 *
	 * @param legacySettings Legacy settings from Phase 1
	 * @returns Object with global and campaign settings
	 * @private
	 */
	private static splitLegacySettings(legacySettings: RPGShopkeepSettings): {
		global: GlobalSettings;
		campaign: CampaignSettings;
	} {
		const global: Partial<GlobalSettings> = {};
		const campaign: Partial<CampaignSettings> = {
			pathMappings: {
				shops: 'Shops/',
				party: 'Party Inventory.md',
				transactions: 'Transactions.md',
			},
		};

		// ─── Extract Global Settings ────────────────────────────────────────────
		for (const [legacyKey, newKey] of Object.entries(SETTINGS_MIGRATION_MAP.global)) {
			if (legacyKey in legacySettings) {
				(global as any)[newKey] = (legacySettings as any)[legacyKey];
			}
		}

		// ─── Extract Campaign Settings ────────────────────────────────────────────
		for (const [legacyKey, targetPath] of Object.entries(SETTINGS_MIGRATION_MAP.campaign)) {
			if (!(legacyKey in legacySettings)) continue;

			if (targetPath.startsWith('pathMappings.')) {
				// Extract path mapping
				const pathKey = targetPath.replace('pathMappings.', '');
				(campaign.pathMappings as any)[pathKey] = (legacySettings as any)[legacyKey];
			} else {
				// Direct campaign setting
				(campaign as any)[targetPath] = (legacySettings as any)[legacyKey];
			}
		}

		// ─── Merge with Defaults ────────────────────────────────────────────
		const finalGlobal: GlobalSettings = {
			...DEFAULT_GLOBAL_SETTINGS,
			...global,
		};

		const finalCampaign: CampaignSettings = {
			...DEFAULT_CAMPAIGN_SETTINGS,
			...campaign,
			pathMappings: {
				shops: 'Shops/',
				party: 'Party Inventory.md',
				transactions: 'Transactions.md',
				...campaign.pathMappings,
			},
		} as CampaignSettings;

		console.log('[SettingsMigration] Extracted global settings:', Object.keys(global).length, 'fields');
		console.log('[SettingsMigration] Extracted campaign settings:', Object.keys(campaign).length, 'fields');

		return {
			global: finalGlobal,
			campaign: finalCampaign,
		};
	}

	/**
	 * Check if migration has been completed
	 *
	 * @param plugin Obsidian plugin instance
	 * @returns true if migration complete, false otherwise
	 */
	static async isMigrationComplete(plugin: Plugin): Promise<boolean> {
		const data = (await plugin.loadData()) as ObsidianPluginData | null;
		return data?.settingsMigrationComplete === true;
	}

	/**
	 * Reset migration flag (for testing purposes only)
	 *
	 * ⚠️ WARNING: This will cause migration to run again on next load
	 *
	 * @param plugin Obsidian plugin instance
	 */
	static async resetMigration(plugin: Plugin): Promise<void> {
		const data = (await plugin.loadData()) as ObsidianPluginData | null;

		if (data) {
			data.settingsMigrationComplete = false;
			await plugin.saveData(data);
			console.log('[SettingsMigration] Migration flag reset');
		}
	}
}
