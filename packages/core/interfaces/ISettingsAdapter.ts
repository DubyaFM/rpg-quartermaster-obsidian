// Settings Adapter Interface
// Abstracts settings persistence and change notification for platform independence

import { RPGShopkeepSettings } from '../models/types';
import { GlobalSettings, CampaignSettings } from '../models/Settings';

/**
 * Interface for settings persistence and management
 *
 * Phase 2 Update: Supports both global and campaign-scoped settings
 *
 * Implementations:
 * - ObsidianSettingsAdapter: Obsidian plugin settings (Phase 1+)
 * - FileSystemSettingsAdapter: JSON file (Phase 2+)
 * - DatabaseSettingsAdapter: User preferences table (Phase 6+)
 *
 * Storage Model:
 * - Global settings: data.json.globalSettings (Obsidian) or app_settings table (Backend)
 * - Campaign settings: data.json.campaigns[].settings (Obsidian) or campaign_settings table (Backend)
 *
 * Merge Strategy:
 * - getSettings() returns merged global + campaign (campaign overrides global)
 * - This maintains backward compatibility with existing code
 */
export interface ISettingsAdapter {
	// ─── Backward Compatible Methods (Legacy) ────────────────────────────────────────────

	/**
	 * Get current plugin settings (merged global + campaign)
	 * Should return synchronously for immediate access
	 *
	 * **Phase 2 Behavior**:
	 * - Merges global settings with active campaign settings
	 * - Campaign settings override global where conflicts exist
	 * - Maintains backward compatibility with Phase 1 code
	 *
	 * @returns Merged settings object (RPGShopkeepSettings)
	 */
	getSettings(): RPGShopkeepSettings;

	/**
	 * Save settings to persistent storage (legacy method)
	 * May require I/O operations, so returns a promise
	 *
	 * **Phase 2 Behavior**:
	 * - Intelligently splits settings into global vs campaign
	 * - Uses SETTINGS_MIGRATION_MAP to determine scope
	 * - Saves to appropriate storage location
	 *
	 * @param settings Settings to save
	 * @throws Error if save fails
	 */
	saveSettings(settings: RPGShopkeepSettings): Promise<void>;

	/**
	 * Register callback for settings changes
	 * Enables reactive updates when settings are modified
	 *
	 * **Phase 2 Behavior**:
	 * - Triggers on global settings change
	 * - Triggers on campaign settings change
	 * - Triggers on campaign switch (campaign settings changed)
	 *
	 * @param callback Function to call when settings change
	 */
	onSettingsChange(callback: (settings: RPGShopkeepSettings) => void): void;

	// ─── Campaign-Scoped Methods (Phase 2+) ────────────────────────────────────────────

	/**
	 * Get global settings (app-level, shared across all campaigns)
	 *
	 * **Note**: Async to support storage I/O operations
	 *
	 * @returns Promise resolving to global settings object
	 */
	getGlobalSettings(): Promise<GlobalSettings>;

	/**
	 * Save global settings to persistent storage
	 *
	 * **Side Effects**:
	 * - Triggers onSettingsChange callbacks with merged settings
	 * - Updates data.json.globalSettings (Obsidian)
	 *
	 * @param settings Global settings to save
	 * @throws Error if save fails
	 */
	saveGlobalSettings(settings: GlobalSettings): Promise<void>;

	/**
	 * Get campaign-specific settings for a given campaign
	 *
	 * **Note**: Async to support storage I/O operations
	 *
	 * @param campaignId Campaign ID to get settings for
	 * @returns Promise resolving to campaign settings object, or null if campaign not found
	 */
	getCampaignSettings(campaignId: string): Promise<CampaignSettings | null>;

	/**
	 * Save campaign-specific settings
	 *
	 * **Side Effects**:
	 * - Triggers onSettingsChange callbacks if saving for active campaign
	 * - Updates data.json.campaigns[].settings (Obsidian)
	 *
	 * @param campaignId Campaign ID to save settings for
	 * @param settings Campaign settings to save
	 * @throws Error if campaign not found or save fails
	 */
	saveCampaignSettings(campaignId: string, settings: CampaignSettings): Promise<void>;
}
