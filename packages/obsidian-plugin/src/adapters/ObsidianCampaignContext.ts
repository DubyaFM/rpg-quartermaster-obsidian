/**
 * Obsidian implementation of ICampaignContext
 *
 * Provides campaign-specific configuration by reading from:
 * - Campaign profile in plugin data.json
 * - Campaign-specific settings (Phase 2+)
 * - World entity configuration
 */

import { ICampaignContext } from '@quartermaster/core/interfaces/ICampaignContext';
import type { CampaignProfile } from '@quartermaster/core/services/CampaignManager';
import type QuartermasterPlugin from '../main';

/**
 * Re-export core CampaignProfile for backward compatibility
 */
export type { CampaignProfile } from '@quartermaster/core/services/CampaignManager';

/**
 * Obsidian-specific path mappings type
 * Used when we need to ensure all required paths are configured
 */
export interface CampaignPathMappings {
	shops: string;
	party: string;
	transactions: string;
	npcs?: string;
	locations?: string;
	factions?: string;
	jobs?: string;
	projects?: string;
	'activity-log'?: string;
	calendar?: string;
	items?: string;
	libraries?: string;
}

/**
 * Obsidian implementation of campaign context
 *
 * Reads campaign configuration from plugin data.json and provides
 * it to core services in a platform-agnostic way.
 */
export class ObsidianCampaignContext implements ICampaignContext {
	constructor(
		private profile: CampaignProfile,
		private plugin: QuartermasterPlugin
	) {}

	// ==================== IDENTITY ====================

	getCampaignId(): string {
		return this.profile.id;
	}

	getCampaignName(): string {
		return this.profile.name;
	}

	getWorldId(): string {
		return this.profile.worldId;
	}

	// ==================== LIBRARY MANAGEMENT ====================

	getActiveLibraryIds(): string[] {
		return this.profile.activeLibraryIds ?? [];
	}

	isLibraryEnabled(libraryId: string): boolean {
		return this.getActiveLibraryIds().includes(libraryId);
	}

	// ==================== ECONOMIC CONFIGURATION (FUTURE) ====================

	getInflationModifier(): number {
		return this.profile.settings?.inflationModifier ?? 1.0;
	}

	getCurrencySystemId(): string {
		// Default to D&D 5e currency system
		return this.profile.settings?.currencySystemId ?? 'dnd5e-standard';
	}

	// ==================== CALENDAR CONFIGURATION (FUTURE) ====================

	getCalendarSystemId(): string {
		// Default to Faerun Harptos calendar for D&D campaigns
		return this.profile.settings?.calendarSystemId ?? 'faerun-harptos';
	}

	getCurrentGameDate(): string {
		return this.profile.settings?.currentGameDate ?? new Date().toISOString();
	}

	// ==================== FEATURE FLAGS (FUTURE) ====================

	isFeatureEnabled(feature: string): boolean {
		return this.profile.settings?.featureFlags?.[feature] ?? false;
	}

	// ==================== HELPER METHODS ====================

	/**
	 * Get the raw campaign profile
	 * Useful for factory and setup operations
	 */
	getProfile(): CampaignProfile {
		return this.profile;
	}

	/**
	 * Update last accessed timestamp
	 * Called by factory on campaign switch
	 */
	async updateLastAccessed(): Promise<void> {
		this.profile.lastAccessedAt = Date.now();

		// Persist to data.json
		const data = await this.plugin.loadData() ?? {};
		const campaigns: CampaignProfile[] = data.campaigns ?? [];

		const index = campaigns.findIndex(c => c.id === this.profile.id);
		if (index >= 0) {
			campaigns[index] = this.profile;
			data.campaigns = campaigns;
			await this.plugin.saveData(data);
		}
	}
}
