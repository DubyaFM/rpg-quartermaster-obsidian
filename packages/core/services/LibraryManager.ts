/**
 * Library Manager Service
 *
 * Core service for managing library lifecycle (enable/disable).
 * Platform-agnostic - works with CampaignManager and data adapters.
 *
 * Responsibilities:
 * - Enable/disable libraries for a campaign
 * - Track orphaned items (items from disabled libraries)
 * - Provide safety checks for library operations
 *
 * Safety Policy (from Risk Analysis):
 * - Disabling library has zero impact on existing items (severed by default)
 * - Enabling library adds to search scope (no conflicts)
 * - "Update from Source" requires manual user action
 *
 * Usage:
 * ```typescript
 * const libraryManager = new LibraryManager(campaignManager, dataAdapter);
 * await libraryManager.enableLibrary('campaign-123', 'library-srd');
 * const orphaned = await libraryManager.getOrphanedItems('campaign-123', 'library-srd');
 * ```
 */

import type { CampaignManager } from './CampaignManager';
import type { IDataAdapter } from '../interfaces/IDataAdapter';
import type { Item } from '../models/types';

/**
 * Library Manager Service
 *
 * Manages library activation/deactivation for campaigns.
 * Delegates persistence to CampaignManager.
 */
export class LibraryManager {
	constructor(
		private campaignManager: CampaignManager,
		private dataAdapter: IDataAdapter
	) {}

	/**
	 * Enable a library for a campaign
	 *
	 * This adds the library to the campaign's activeLibraryIds array,
	 * making its items available for selection in shop generation, etc.
	 *
	 * **Safety**: Enabling a library has no immediate effect on existing data.
	 * It only expands the search scope for future operations.
	 *
	 * @param campaignId - Campaign ID to enable library for
	 * @param libraryId - Library ID to enable (e.g., "library-srd", "library-{uuid}")
	 * @throws Error if campaign not found
	 */
	async enableLibrary(
		campaignId: string,
		libraryId: string
	): Promise<void> {
		// Get current campaign
		const campaign = await this.campaignManager.getCampaign(campaignId);
		if (!campaign) {
			throw new Error(`Campaign not found: ${campaignId}`);
		}

		// Check if already enabled
		if (campaign.activeLibraryIds.includes(libraryId)) {
			console.log(`[LibraryManager] Library already enabled: ${libraryId}`);
			return;
		}

		// Add to activeLibraryIds
		const updatedLibraryIds = [...campaign.activeLibraryIds, libraryId];

		// Update campaign
		await this.campaignManager.updateCampaign(campaignId, {
			activeLibraryIds: updatedLibraryIds
		});

		console.log(`[LibraryManager] Enabled library ${libraryId} for campaign ${campaignId}`);
	}

	/**
	 * Disable a library for a campaign
	 *
	 * This removes the library from the campaign's activeLibraryIds array.
	 *
	 * **Safety**: Existing items remain unchanged (severed by default).
	 * Items from this library become "orphaned" but remain fully functional.
	 * They effectively become "Custom Local Items" and lose the ability to
	 * sync with the library template.
	 *
	 * @param campaignId - Campaign ID to disable library for
	 * @param libraryId - Library ID to disable
	 * @throws Error if campaign not found
	 */
	async disableLibrary(
		campaignId: string,
		libraryId: string
	): Promise<void> {
		// Get current campaign
		const campaign = await this.campaignManager.getCampaign(campaignId);
		if (!campaign) {
			throw new Error(`Campaign not found: ${campaignId}`);
		}

		// Remove from activeLibraryIds
		const updatedLibraryIds = campaign.activeLibraryIds.filter(
			id => id !== libraryId
		);

		// Update campaign (even if library wasn't in the list)
		await this.campaignManager.updateCampaign(campaignId, {
			activeLibraryIds: updatedLibraryIds
		});

		console.log(`[LibraryManager] Disabled library ${libraryId} for campaign ${campaignId}`);
	}

	/**
	 * Get orphaned items for a disabled library
	 *
	 * Finds all items in the campaign's inventory/shops that originated
	 * from the specified library. These items remain functional but can
	 * no longer sync with the library template.
	 *
	 * **Note**: This method identifies orphaned items by checking if the
	 * item's source_uuid (if present) starts with the libraryId. For platforms
	 * that don't track source_uuid (like Obsidian), this will return an empty array.
	 *
	 * **Backend Implementation**: Backend platforms track source_uuid in the database.
	 * **Obsidian Implementation**: Obsidian uses file-based storage without source_uuid tracking.
	 *
	 * @param campaignId - Campaign ID to search in (currently unused, for future multi-campaign support)
	 * @param libraryId - Library ID to find orphaned items from
	 * @returns Array of items that originated from this library
	 */
	async getOrphanedItems(
		campaignId: string,
		libraryId: string
	): Promise<Item[]> {
		// Get all available items from the data adapter
		const allItems = await this.dataAdapter.getAvailableItems();

		// Filter items that have source_uuid starting with libraryId
		// Note: source_uuid is not in the core Item interface yet, but backends may use it
		const orphanedItems = allItems.filter(item => {
			// Check if item has source_uuid (backend-specific field)
			const sourceUuid = (item as any).source_uuid;
			return sourceUuid && typeof sourceUuid === 'string' && sourceUuid.startsWith(libraryId);
		});

		console.log(`[LibraryManager] Found ${orphanedItems.length} orphaned items from library ${libraryId}`);

		return orphanedItems;
	}

	/**
	 * Check if a library is enabled for a campaign
	 *
	 * @param campaignId - Campaign ID to check
	 * @param libraryId - Library ID to check
	 * @returns True if library is enabled
	 * @throws Error if campaign not found
	 */
	async isLibraryEnabled(
		campaignId: string,
		libraryId: string
	): Promise<boolean> {
		const campaign = await this.campaignManager.getCampaign(campaignId);
		if (!campaign) {
			throw new Error(`Campaign not found: ${campaignId}`);
		}

		return campaign.activeLibraryIds.includes(libraryId);
	}

	/**
	 * Get all enabled libraries for a campaign
	 *
	 * @param campaignId - Campaign ID to get libraries for
	 * @returns Array of library IDs
	 * @throws Error if campaign not found
	 */
	async getEnabledLibraries(campaignId: string): Promise<string[]> {
		const campaign = await this.campaignManager.getCampaign(campaignId);
		if (!campaign) {
			throw new Error(`Campaign not found: ${campaignId}`);
		}

		return [...campaign.activeLibraryIds]; // Return copy
	}
}
