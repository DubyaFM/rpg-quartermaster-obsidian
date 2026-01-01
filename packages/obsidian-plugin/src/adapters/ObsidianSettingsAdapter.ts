// Obsidian Settings Adapter
// Implements ISettingsAdapter for Obsidian plugin settings persistence
// Phase 2 Update: Supports global and campaign-scoped settings

import { Plugin } from 'obsidian';
import { ISettingsAdapter } from '@quartermaster/core/interfaces/ISettingsAdapter';
import { ICampaignContext } from '@quartermaster/core/interfaces/ICampaignContext';
import { RPGShopkeepSettings, ItemFolderConfig } from '@quartermaster/core/models/types';
import {
	GlobalSettings,
	CampaignSettings,
	CampaignPathMappings,
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
		[key: string]: unknown;
	}>;
	settings?: RPGShopkeepSettings; // Legacy (Phase 1)
	[key: string]: unknown;
}

/**
 * Obsidian implementation of settings adapter
 *
 * Phase 2 Update:
 * - Supports global settings (data.json.globalSettings)
 * - Supports campaign settings (data.json.campaigns[].settings)
 * - Merges global + campaign for backward compatibility
 * - Campaign settings override global where conflicts exist
 *
 * **Note**: getSettings() is synchronous but internally accesses plugin data.
 * This works because Obsidian caches loadData() results.
 */
export class ObsidianSettingsAdapter implements ISettingsAdapter {
	private settingsChangeCallbacks: Array<(settings: RPGShopkeepSettings) => void> = [];
	private cachedData: ObsidianPluginData | null = null;

	constructor(
		private plugin: Plugin,
		private campaignContext?: ICampaignContext
	) {}

	// ─── Backward Compatible Methods (Legacy) ────────────────────────────────────────────

	/**
	 * Get current settings (merged global + campaign)
	 * Returns synchronously for immediate access
	 *
	 * Merge Priority:
	 * 1. Campaign settings (highest priority)
	 * 2. Global settings
	 * 3. Hardcoded defaults (lowest priority)
	 *
	 * **Note**: Uses synchronous access to cached plugin data
	 */
	getSettings(): RPGShopkeepSettings {
		// Use cached data - updated on save operations
		const data = (this.plugin as any).settings || this.cachedData;

		const global = this.getGlobalSettingsFromData(data);
		const campaignId = this.campaignContext?.getCampaignId() || 'campaign_default';
		const campaign = this.getCampaignSettingsFromData(campaignId, data);

		return this.mergeSettings(global, campaign);
	}

	/**
	 * Save settings to Obsidian plugin data (legacy method)
	 *
	 * Phase 2 Behavior:
	 * - Splits settings into global vs campaign using SETTINGS_MIGRATION_MAP
	 * - Saves to appropriate storage locations
	 * - Triggers settings change callbacks
	 *
	 * @param settings Settings to save
	 */
	async saveSettings(settings: RPGShopkeepSettings): Promise<void> {
		// Split settings into global vs campaign
		const { global, campaign } = this.splitSettings(settings);

		// Save both
		await this.saveGlobalSettings(global);

		const campaignId = this.campaignContext?.getCampaignId() || 'campaign_default';
		await this.saveCampaignSettings(campaignId, campaign);

		// Callbacks already triggered by save methods
	}

	/**
	 * Register callback for settings changes
	 *
	 * Phase 2 Behavior:
	 * - Triggers on global settings change
	 * - Triggers on campaign settings change (for active campaign)
	 * - Triggers on campaign switch
	 */
	onSettingsChange(callback: (settings: RPGShopkeepSettings) => void): void {
		this.settingsChangeCallbacks.push(callback);
	}

	// ─── Campaign-Scoped Methods (Phase 2+) ────────────────────────────────────────────

	/**
	 * Get global settings (app-level, shared across all campaigns)
	 *
	 * @returns Promise resolving to global settings object with defaults applied
	 */
	async getGlobalSettings(): Promise<GlobalSettings> {
		const data = await this.plugin.loadData() as ObsidianPluginData | null;
		this.cachedData = data;
		return this.getGlobalSettingsFromData(data);
	}

	/**
	 * Get global settings from data object (synchronous helper)
	 * @private
	 */
	private getGlobalSettingsFromData(data: ObsidianPluginData | null): GlobalSettings {
		if (!data || !data.globalSettings) {
			return { ...DEFAULT_GLOBAL_SETTINGS };
		}

		// Merge with defaults to ensure all fields present
		return {
			...DEFAULT_GLOBAL_SETTINGS,
			...data.globalSettings,
		};
	}

	/**
	 * Save global settings to persistent storage
	 *
	 * Side Effects:
	 * - Updates data.json.globalSettings
	 * - Triggers onSettingsChange callbacks with merged settings
	 */
	async saveGlobalSettings(settings: GlobalSettings): Promise<void> {
		const data = await this.plugin.loadData() as ObsidianPluginData | null;
		const updatedData = data || {};

		updatedData.globalSettings = settings;

		await this.plugin.saveData(updatedData);
		this.cachedData = updatedData;

		// Trigger callbacks with merged settings
		this.notifyCallbacks(this.getSettings());
	}

	/**
	 * Get campaign-specific settings for a given campaign
	 *
	 * @param campaignId Campaign ID to get settings for
	 * @returns Promise resolving to campaign settings object, or null if campaign not found
	 */
	async getCampaignSettings(campaignId: string): Promise<CampaignSettings | null> {
		const data = await this.plugin.loadData() as ObsidianPluginData | null;
		this.cachedData = data;
		return this.getCampaignSettingsFromData(campaignId, data);
	}

	/**
	 * Get campaign settings from data object (synchronous helper)
	 * @private
	 */
	private getCampaignSettingsFromData(campaignId: string, data: ObsidianPluginData | null): CampaignSettings | null {
		if (!data || !data.campaigns) {
			return null;
		}

		const campaign = data.campaigns.find((c) => c.id === campaignId);

		if (!campaign || !campaign.settings) {
			return null;
		}

		// Merge with defaults to ensure all fields present
		return {
			...DEFAULT_CAMPAIGN_SETTINGS,
			...campaign.settings,
		} as CampaignSettings;
	}

	/**
	 * Save campaign-specific settings
	 *
	 * Side Effects:
	 * - Updates data.json.campaigns[].settings
	 * - Triggers onSettingsChange callbacks if saving for active campaign
	 *
	 * @param campaignId Campaign ID to save settings for
	 * @param settings Campaign settings to save
	 * @throws Error if campaign not found
	 */
	async saveCampaignSettings(campaignId: string, settings: CampaignSettings): Promise<void> {
		const data = await this.plugin.loadData() as ObsidianPluginData | null;

		if (!data || !data.campaigns) {
			throw new Error('No campaigns found in plugin data');
		}

		const campaign = data.campaigns.find((c) => c.id === campaignId);

		if (!campaign) {
			throw new Error(`Campaign not found: ${campaignId}`);
		}

		// Update campaign settings
		campaign.settings = settings;

		await this.plugin.saveData(data);
		this.cachedData = data;

		// Trigger callbacks only if this is the active campaign
		const activeCampaignId = this.campaignContext?.getCampaignId() || 'campaign_default';
		if (campaignId === activeCampaignId) {
			this.notifyCallbacks(this.getSettings());
		}
	}

	// ─── Helper Methods ────────────────────────────────────────────

	/**
	 * Merge global and campaign settings into RPGShopkeepSettings
	 *
	 * Priority: Campaign > Global > Defaults
	 *
	 * @param global Global settings
	 * @param campaign Campaign settings (or null)
	 * @returns Merged settings as RPGShopkeepSettings
	 * @private
	 */
	private mergeSettings(
		global: GlobalSettings,
		campaign: CampaignSettings | null
	): RPGShopkeepSettings {
		// Start with defaults from both scopes
		const merged: RPGShopkeepSettings = {
			// Global settings
			defaultCurrency: global.defaultCurrency,
			useSRDDatabase: global.useSRDDatabase,
			storeCrossPlatformIds: global.storeCrossPlatformIds,
			autoSaveShops: global.autoSaveShops,
			customConfigFolderPath: global.customConfigFolderPath,
			useCustomShopConfig: global.useCustomShopConfig,
			useCustomServicesConfig: global.useCustomServicesConfig,
			useCustomShopkeepConfig: global.useCustomShopkeepConfig,
			useCustomFactionsConfig: global.useCustomFactionsConfig,
			useCustomLootTablesConfig: global.useCustomLootTablesConfig,
			dateFormat: global.dateFormat,
			showCalendarInUI: global.showCalendarInUI,

			// Campaign settings (with defaults)
			partyInventoryFile: campaign?.pathMappings?.party || 'Party Inventory.md',
			transactionLogFile: campaign?.pathMappings?.transactions || 'Transactions.md',
			shopsFolder: campaign?.pathMappings?.shops || 'Shops/',
			npcsFolder: campaign?.pathMappings?.npcs || 'NPCs/',
			locationsFolder: campaign?.pathMappings?.locations || 'Locations/',
			factionsFolder: campaign?.pathMappings?.factions || 'Factions/',
			jobsFolder: campaign?.pathMappings?.jobs || 'Jobs/',
			strongholdsFolder: campaign?.pathMappings?.strongholds || 'Strongholds/',
			strongholdStashesFolder: campaign?.pathMappings?.strongholdStashes || 'Stronghold Stashes/',
			facilitiesConfigFolder: campaign?.pathMappings?.facilities || 'Facilities/',
			ordersConfigFolder: campaign?.pathMappings?.orders || 'Orders/',
			eventTablesFolder: campaign?.pathMappings?.eventTables || 'Event Tables/',
			hirelingsFolder: campaign?.pathMappings?.hirelings || 'Hirelings/',
			partyMembersFolder: campaign?.pathMappings?.partyMembers || 'Party Members/',
			jobNotificationLogPath: campaign?.pathMappings?.jobNotificationLog || 'Job Notifications.md',
			partyInventoryPath: campaign?.pathMappings?.party || 'Party Inventory.md',
			projectTemplatesPath: campaign?.pathMappings?.projectTemplates || 'Project Templates/',
			projectInstancesPath: campaign?.pathMappings?.projects || 'Projects/',
			activityLogPath: campaign?.pathMappings?.activityLog || 'Activity Log.md',

			// Economic settings
			magicItemMarkupPercent: campaign?.magicItemMarkupPercent ?? DEFAULT_CAMPAIGN_SETTINGS.magicItemMarkupPercent!,
			magicItemRarityModifiers: campaign?.magicItemRarityModifiers ?? DEFAULT_CAMPAIGN_SETTINGS.magicItemRarityModifiers!,

			// Party settings
			partyFunds: campaign?.partyFunds,
			partyLevel: campaign?.partyLevel ?? DEFAULT_CAMPAIGN_SETTINGS.partyLevel!,
			partyMembers: campaign?.partyMembers ?? [],
			partyMembersMigrated: campaign?.partyMembersMigrated ?? false,
			enablePlayerTracking: campaign?.enablePlayerTracking ?? DEFAULT_CAMPAIGN_SETTINGS.enablePlayerTracking!,

			// Calendar settings
			calendarState: campaign?.calendarState,
			upkeepConfig: campaign?.upkeepConfig,
			shopRestockConfig: campaign?.shopRestockConfig,

			// Feature toggles
			enableStrongholdFeatures: campaign?.enableStrongholdFeatures ?? DEFAULT_CAMPAIGN_SETTINGS.enableStrongholdFeatures!,
			autoExpireJobs: campaign?.autoExpireJobs ?? DEFAULT_CAMPAIGN_SETTINGS.autoExpireJobs!,
			notifyOnJobDeadlines: campaign?.notifyOnJobDeadlines ?? DEFAULT_CAMPAIGN_SETTINGS.notifyOnJobDeadlines!,
			notifyOnJobExpirations: campaign?.notifyOnJobExpirations ?? DEFAULT_CAMPAIGN_SETTINGS.notifyOnJobExpirations!,
			enableEncumbranceTracking: campaign?.enableEncumbranceTracking ?? DEFAULT_CAMPAIGN_SETTINGS.enableEncumbranceTracking!,
			trackManualInventoryEdits: campaign?.trackManualInventoryEdits ?? DEFAULT_CAMPAIGN_SETTINGS.trackManualInventoryEdits!,

			// NPC settings
			createNPCLinks: campaign?.createNPCLinks ?? DEFAULT_CAMPAIGN_SETTINGS.createNPCLinks!,
			trackHirelingLoyalty: campaign?.trackHirelingLoyalty ?? DEFAULT_CAMPAIGN_SETTINGS.trackHirelingLoyalty!,
			autoPayHirelings: campaign?.autoPayHirelings ?? DEFAULT_CAMPAIGN_SETTINGS.autoPayHirelings!,

			// Player view settings
			playerViewShowReputationImpacts: campaign?.playerViewShowReputationImpacts ?? DEFAULT_CAMPAIGN_SETTINGS.playerViewShowReputationImpacts!,
			playerViewShowPrerequisites: campaign?.playerViewShowPrerequisites ?? DEFAULT_CAMPAIGN_SETTINGS.playerViewShowPrerequisites!,
			playerViewShowExactTimeRemaining: campaign?.playerViewShowExactTimeRemaining ?? DEFAULT_CAMPAIGN_SETTINGS.playerViewShowExactTimeRemaining!,
			projectProgressionSummary: campaign?.projectProgressionSummary ?? DEFAULT_CAMPAIGN_SETTINGS.projectProgressionSummary!,

			// Library & sources
			availableSources: campaign?.availableSources ?? DEFAULT_CAMPAIGN_SETTINGS.availableSources!,
			enabledSources: campaign?.enabledSources ?? DEFAULT_CAMPAIGN_SETTINGS.enabledSources!,

			// Template preferences
			shopTemplatePreferences: campaign?.shopTemplatePreferences ?? DEFAULT_CAMPAIGN_SETTINGS.shopTemplatePreferences!,

			// Legacy fields (Phase 1)
			itemsFolders: [], // Migrated to pathMappings.items
			partyMemberFolder: campaign?.pathMappings?.partyMembers || 'Party Members/',
		};

		return merged;
	}

	/**
	 * Split RPGShopkeepSettings into global and campaign settings
	 *
	 * Uses SETTINGS_MIGRATION_MAP to determine scope
	 *
	 * @param settings Settings to split
	 * @returns Object with global and campaign settings
	 * @private
	 */
	private splitSettings(settings: RPGShopkeepSettings): {
		global: GlobalSettings;
		campaign: CampaignSettings;
	} {
		const global: Partial<GlobalSettings> = {};
		const campaign: Partial<CampaignSettings> = {
			pathMappings: {
				shops: 'Shops/',
				party: 'Party Inventory.md',
				transactions: 'Transactions.md',
			} as CampaignPathMappings,
		};

		// Extract global settings
		for (const [key, value] of Object.entries(SETTINGS_MIGRATION_MAP.global)) {
			if (key in settings) {
				(global as any)[value] = (settings as any)[key];
			}
		}

		// Extract campaign settings
		for (const [key, targetPath] of Object.entries(SETTINGS_MIGRATION_MAP.campaign)) {
			if (!(key in settings)) continue;

			if (targetPath.startsWith('pathMappings.')) {
				// Extract path mapping
				const pathKey = targetPath.replace('pathMappings.', '');
				(campaign.pathMappings as any)[pathKey] = (settings as any)[key];
			} else {
				// Direct campaign setting
				(campaign as any)[targetPath] = (settings as any)[key];
			}
		}

		return {
			global: { ...DEFAULT_GLOBAL_SETTINGS, ...global },
			campaign: { ...DEFAULT_CAMPAIGN_SETTINGS, ...campaign } as CampaignSettings,
		};
	}

	/**
	 * Notify all registered callbacks of settings change
	 * @private
	 */
	private notifyCallbacks(settings: RPGShopkeepSettings): void {
		for (const callback of this.settingsChangeCallbacks) {
			try {
				callback(settings);
			} catch (error) {
				console.error('Error in settings change callback:', error);
			}
		}
	}

	/**
	 * Update the internal settings reference and trigger campaign switch
	 * Used when campaign is switched via factory
	 *
	 * @param newCampaignId New active campaign ID
	 */
	triggerCampaignSwitch(newCampaignId: string): void {
		// Notify callbacks with new merged settings (campaign changed)
		this.notifyCallbacks(this.getSettings());
	}
}
