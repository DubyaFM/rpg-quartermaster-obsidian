import { App, Notice } from 'obsidian';
import type QuartermasterPlugin from '../main';
import { Shop, Item } from '@quartermaster/core/models/types';
import { NPCProfile } from '@quartermaster/core/models/npc';

/**
 * Report of UUID migration results.
 * Tracks how many entities were successfully migrated and any errors encountered.
 */
export interface MigrationReport {
	/** Number of shops that were updated with UUIDs */
	shopsUpdated: number;
	/** Number of NPCs that were verified/updated with UUIDs */
	npcsUpdated: number;
	/** Number of items that received runtime UUIDs */
	itemsUpdated: number;
	/** Array of error messages encountered during migration */
	errors: string[];
}

/**
 * Service for migrating existing vault files to include persistent UUIDs.
 * Used when user enables "Store cross-platform IDs in frontmatter" setting.
 *
 * This service handles batch UUID migration across three entity types:
 * - Shops: Generates and saves UUIDs to shop files
 * - NPCs: Verifies existing UUIDs (they already have them)
 * - Items: Generates runtime UUIDs (writing to frontmatter is future work)
 *
 * The migration is non-destructive and can be run multiple times safely.
 * Progress callbacks enable UI feedback for long-running operations.
 */
export class MigrationService {
	constructor(
		private app: App,
		private plugin: QuartermasterPlugin
	) {}

	/**
	 * Migrate all entities in the vault to include UUIDs.
	 * Processes shops, NPCs, and items in sequence with error handling.
	 *
	 * @param progressCallback - Optional callback to receive migration progress
	 *                          Receives (completed, total, entityType) for UI updates
	 * @returns MigrationReport with counts of updated entities and any errors
	 *
	 * @example
	 * ```typescript
	 * const report = await migrationService.migrateAllEntities((done, total, type) => {
	 *   console.log(`${type}: ${done}/${total}`);
	 * });
	 * ```
	 */
	async migrateAllEntities(
		progressCallback?: (progress: number, total: number, entityType: string) => void
	): Promise<MigrationReport> {
		const report: MigrationReport = {
			shopsUpdated: 0,
			npcsUpdated: 0,
			itemsUpdated: 0,
			errors: []
		};

		// Migrate shops
		try {
			const shopCount = await this.migrateShops(report, progressCallback);
			report.shopsUpdated = shopCount;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			report.errors.push(`Shop migration failed: ${errorMessage}`);
		}

		// Migrate NPCs
		try {
			const npcCount = await this.migrateNPCs(report, progressCallback);
			report.npcsUpdated = npcCount;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			report.errors.push(`NPC migration failed: ${errorMessage}`);
		}

		// Migrate Items
		try {
			const itemCount = await this.migrateItems(report, progressCallback);
			report.itemsUpdated = itemCount;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			report.errors.push(`Item migration failed: ${errorMessage}`);
		}

		return report;
	}

	/**
	 * Migrate all shops to include UUIDs in frontmatter.
	 * For each shop without a UUID, generates one and persists it to the shop file.
	 *
	 * @param report - MigrationReport to collect errors
	 * @param progressCallback - Optional progress callback
	 * @returns Number of shops that were updated
	 *
	 * @remarks
	 * - Only updates shops missing UUIDs (safe to run multiple times)
	 * - Extracts folder path from shop file path for save operation
	 * - Each error is collected but doesn't halt migration for other shops
	 */
	private async migrateShops(
		report: MigrationReport,
		progressCallback?: (progress: number, total: number, entityType: string) => void
	): Promise<number> {
		const shopPaths = await this.plugin.dataAdapter.listShops();
		let updated = 0;

		for (let i = 0; i < shopPaths.length; i++) {
			try {
				const shop = await this.plugin.dataAdapter.getShop(shopPaths[i]);

				// Generate UUID if missing
				if (!shop.id) {
					const newId = this.plugin.uuidRegistry.generateShopId();
					this.plugin.uuidRegistry.setShopId(shopPaths[i], shop, newId);

					// Extract folder path from full shop path (remove filename)
					const lastSlashIndex = shopPaths[i].lastIndexOf('/');
					const folderPath = lastSlashIndex > 0
						? shopPaths[i].substring(0, lastSlashIndex)
						: '';

					// Save shop with new UUID persisted to frontmatter
					await this.plugin.dataAdapter.saveShop(shop, folderPath);
					updated++;
				}

				progressCallback?.(i + 1, shopPaths.length, 'shops');
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				report.errors.push(`Shop at ${shopPaths[i]}: ${errorMessage}`);
			}
		}

		return updated;
	}

	/**
	 * Migrate all NPCs to ensure UUIDs are present.
	 * NPCs should already have npcId fields from creation, but this verifies
	 * and generates UUIDs for any that are missing (edge case handling).
	 *
	 * @param report - MigrationReport to collect errors
	 * @param progressCallback - Optional progress callback
	 * @returns Number of NPCs that were updated
	 *
	 * @remarks
	 * - Most NPCs will already have UUIDs (generated at creation)
	 * - This migration is primarily a verification pass
	 * - Updates are minimal unless there are legacy NPCs without IDs
	 */
	private async migrateNPCs(
		report: MigrationReport,
		progressCallback?: (progress: number, total: number, entityType: string) => void
	): Promise<number> {
		const npcPaths = await this.plugin.dataAdapter.listNPCs();
		let updated = 0;

		for (let i = 0; i < npcPaths.length; i++) {
			try {
				const npc = await this.plugin.dataAdapter.getNPC(npcPaths[i]);

				// NPCs should already have npcId, but verify and generate if missing
				if (!npc.npcId) {
					const newId = this.plugin.uuidRegistry.generateNpcId();
					this.plugin.uuidRegistry.setNpcId(npcPaths[i], npc, newId);

					// Save NPC with new UUID persisted
					await this.plugin.dataAdapter.saveNPC(npc);
					updated++;
				}

				progressCallback?.(i + 1, npcPaths.length, 'NPCs');
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				report.errors.push(`NPC at ${npcPaths[i]}: ${errorMessage}`);
			}
		}

		return updated;
	}

	/**
	 * Migrate all items to include UUIDs.
	 * Items are loaded in bulk via ItemVaultHandler and given runtime UUIDs.
	 * Persisting item UUIDs to individual item files is a future enhancement.
	 *
	 * @param report - MigrationReport to collect errors
	 * @param progressCallback - Optional progress callback
	 * @returns Number of items that received UUIDs
	 *
	 * @remarks
	 * - Items are bulk-loaded from vault (not iterated individually)
	 * - UUIDs are generated via registry (memory or persistent depending on setting)
	 * - Actual persistence to item file frontmatter is not yet implemented
	 * - This prevents duplicate UUID generation for the same item
	 * - Future work: WriteItemsToVault service to persist item UUIDs
	 */
	private async migrateItems(
		report: MigrationReport,
		progressCallback?: (progress: number, total: number, entityType: string) => void
	): Promise<number> {
		const items = await this.plugin.dataAdapter.getAvailableItems();
		let updated = 0;

		for (let i = 0; i < items.length; i++) {
			// Generate UUID via registry if missing
			if (!items[i].id && items[i].file?.path) {
				const itemPath = items[i].file!.path;
				const newId = this.plugin.uuidRegistry.generateItemId();
				this.plugin.uuidRegistry.setItemId(itemPath, items[i], newId);
				updated++;
			}

			progressCallback?.(i + 1, items.length, 'items');
		}

		// Note: Item UUIDs are generated but not persisted to files yet
		// This will happen naturally when items are used in shops/inventory
		// or when a dedicated WriteItemsToVault service is implemented

		return updated;
	}
}
