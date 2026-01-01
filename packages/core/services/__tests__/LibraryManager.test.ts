/**
 * Unit tests for LibraryManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LibraryManager } from '../LibraryManager';
import { CampaignManager, CampaignProfile, ICampaignPersistence } from '../CampaignManager';
import { IDataAdapter } from '../../interfaces/IDataAdapter';
import { Item } from '../../models/types';

describe('LibraryManager', () => {
	let libraryManager: LibraryManager;
	let campaignManager: CampaignManager;
	let mockPersistence: ICampaignPersistence;
	let mockDataAdapter: IDataAdapter;
	let campaigns: CampaignProfile[];

	const mockCampaign: CampaignProfile = {
		id: 'campaign-test',
		name: 'Test Campaign',
		worldId: 'world-forgotten-realms',
		createdAt: Date.now(),
		lastAccessedAt: Date.now(),
		isActive: true,
		activeLibraryIds: ['library-srd'],
		pathMappings: {}
	};

	const mockItems: Item[] = [
		{
			id: 'item-1',
			name: 'Longsword',
			cost: { gp: 15 },
			type: 'weapon',
			rarity: 'common',
			description: 'A common longsword',
			source: 'SRD',
			file: { path: '/items/longsword.md', name: 'longsword' },
			category: 'weapon',
			source_uuid: 'library-srd-longsword-template'
		} as any,
		{
			id: 'item-2',
			name: 'Healing Potion',
			cost: { gp: 50 },
			type: 'potion',
			rarity: 'common',
			description: 'Restores 2d4+2 HP',
			source: 'SRD',
			file: { path: '/items/healing-potion.md', name: 'healing-potion' },
			category: 'consumable',
			source_uuid: 'library-srd-healing-potion-template'
		} as any,
		{
			id: 'item-3',
			name: 'Custom Sword',
			cost: { gp: 100 },
			type: 'weapon',
			rarity: 'rare',
			description: 'A custom homebrew sword',
			source: 'Homebrew',
			file: { path: '/items/custom-sword.md', name: 'custom-sword' },
			category: 'weapon'
			// No source_uuid - this is a custom item
		} as any,
		{
			id: 'item-4',
			name: 'Eberron Wand',
			cost: { gp: 200 },
			type: 'wand',
			rarity: 'uncommon',
			description: 'A wand from Eberron',
			source: 'Eberron',
			file: { path: '/items/eberron-wand.md', name: 'eberron-wand' },
			category: 'magic-item',
			source_uuid: 'library-eberron-wand-template'
		} as any
	];

	beforeEach(async () => {
		campaigns = [mockCampaign];

		mockPersistence = {
			loadCampaigns: vi.fn().mockResolvedValue(campaigns),
			saveCampaigns: vi.fn().mockImplementation((updatedCampaigns: CampaignProfile[]) => {
				campaigns = updatedCampaigns;
				return Promise.resolve();
			})
		};

		mockDataAdapter = {
			getAvailableItems: vi.fn().mockResolvedValue(mockItems)
		} as any;

		campaignManager = new CampaignManager(mockPersistence);
		await campaignManager.initialize();

		libraryManager = new LibraryManager(campaignManager, mockDataAdapter);
	});

	// ==================== ENABLE LIBRARY ====================

	describe('enableLibrary', () => {
		it('should add library to activeLibraryIds', async () => {
			await libraryManager.enableLibrary('campaign-test', 'library-eberron');

			const campaign = await campaignManager.getCampaign('campaign-test');
			expect(campaign?.activeLibraryIds).toContain('library-eberron');
			expect(campaign?.activeLibraryIds).toContain('library-srd');
			expect(campaign?.activeLibraryIds.length).toBe(2);
		});

		it('should not duplicate library if already enabled', async () => {
			await libraryManager.enableLibrary('campaign-test', 'library-srd');

			const campaign = await campaignManager.getCampaign('campaign-test');
			const srdCount = campaign?.activeLibraryIds.filter(id => id === 'library-srd').length;
			expect(srdCount).toBe(1);
		});

		it('should throw error if campaign not found', async () => {
			await expect(
				libraryManager.enableLibrary('nonexistent', 'library-srd')
			).rejects.toThrow('Campaign not found');
		});

		it('should enable multiple libraries', async () => {
			await libraryManager.enableLibrary('campaign-test', 'library-eberron');
			await libraryManager.enableLibrary('campaign-test', 'library-custom');

			const campaign = await campaignManager.getCampaign('campaign-test');
			expect(campaign?.activeLibraryIds).toEqual([
				'library-srd',
				'library-eberron',
				'library-custom'
			]);
		});
	});

	// ==================== DISABLE LIBRARY ====================

	describe('disableLibrary', () => {
		it('should remove library from activeLibraryIds', async () => {
			await libraryManager.disableLibrary('campaign-test', 'library-srd');

			const campaign = await campaignManager.getCampaign('campaign-test');
			expect(campaign?.activeLibraryIds).not.toContain('library-srd');
			expect(campaign?.activeLibraryIds.length).toBe(0);
		});

		it('should not throw error if library not enabled', async () => {
			await expect(
				libraryManager.disableLibrary('campaign-test', 'library-nonexistent')
			).resolves.not.toThrow();

			const campaign = await campaignManager.getCampaign('campaign-test');
			expect(campaign?.activeLibraryIds).toEqual(['library-srd']);
		});

		it('should throw error if campaign not found', async () => {
			await expect(
				libraryManager.disableLibrary('nonexistent', 'library-srd')
			).rejects.toThrow('Campaign not found');
		});

		it('should preserve other libraries when disabling one', async () => {
			// Enable multiple libraries
			await libraryManager.enableLibrary('campaign-test', 'library-eberron');
			await libraryManager.enableLibrary('campaign-test', 'library-custom');

			// Disable one
			await libraryManager.disableLibrary('campaign-test', 'library-srd');

			const campaign = await campaignManager.getCampaign('campaign-test');
			expect(campaign?.activeLibraryIds).toEqual([
				'library-eberron',
				'library-custom'
			]);
		});
	});

	// ==================== GET ORPHANED ITEMS ====================

	describe('getOrphanedItems', () => {
		it('should find items with source_uuid from disabled library', async () => {
			const orphaned = await libraryManager.getOrphanedItems(
				'campaign-test',
				'library-srd'
			);

			expect(orphaned.length).toBe(2);
			expect(orphaned.find(i => i.name === 'Longsword')).toBeDefined();
			expect(orphaned.find(i => i.name === 'Healing Potion')).toBeDefined();
		});

		it('should return empty array if no items from library', async () => {
			const orphaned = await libraryManager.getOrphanedItems(
				'campaign-test',
				'library-nonexistent'
			);

			expect(orphaned.length).toBe(0);
		});

		it('should not include items without source_uuid', async () => {
			const orphaned = await libraryManager.getOrphanedItems(
				'campaign-test',
				'library-srd'
			);

			expect(orphaned.find(i => i.name === 'Custom Sword')).toBeUndefined();
		});

		it('should find items from specific library only', async () => {
			const orphaned = await libraryManager.getOrphanedItems(
				'campaign-test',
				'library-eberron'
			);

			expect(orphaned.length).toBe(1);
			expect(orphaned[0].name).toBe('Eberron Wand');
		});

		it('should handle items without source_uuid gracefully', async () => {
			// Add item without source_uuid
			mockDataAdapter.getAvailableItems = vi.fn().mockResolvedValue([
				{
					id: 'item-5',
					name: 'Local Item',
					cost: { gp: 10 },
					type: 'misc',
					rarity: 'common',
					description: 'A local item',
					source: 'Local',
					file: { path: '/items/local.md', name: 'local' },
					category: 'misc'
					// No source_uuid
				}
			]);

			const orphaned = await libraryManager.getOrphanedItems(
				'campaign-test',
				'library-srd'
			);

			expect(orphaned.length).toBe(0);
		});
	});

	// ==================== IS LIBRARY ENABLED ====================

	describe('isLibraryEnabled', () => {
		it('should return true if library is enabled', async () => {
			const isEnabled = await libraryManager.isLibraryEnabled(
				'campaign-test',
				'library-srd'
			);

			expect(isEnabled).toBe(true);
		});

		it('should return false if library is not enabled', async () => {
			const isEnabled = await libraryManager.isLibraryEnabled(
				'campaign-test',
				'library-eberron'
			);

			expect(isEnabled).toBe(false);
		});

		it('should throw error if campaign not found', async () => {
			await expect(
				libraryManager.isLibraryEnabled('nonexistent', 'library-srd')
			).rejects.toThrow('Campaign not found');
		});

		it('should reflect changes after enabling library', async () => {
			await libraryManager.enableLibrary('campaign-test', 'library-eberron');

			const isEnabled = await libraryManager.isLibraryEnabled(
				'campaign-test',
				'library-eberron'
			);

			expect(isEnabled).toBe(true);
		});

		it('should reflect changes after disabling library', async () => {
			await libraryManager.disableLibrary('campaign-test', 'library-srd');

			const isEnabled = await libraryManager.isLibraryEnabled(
				'campaign-test',
				'library-srd'
			);

			expect(isEnabled).toBe(false);
		});
	});

	// ==================== GET ENABLED LIBRARIES ====================

	describe('getEnabledLibraries', () => {
		it('should return list of enabled libraries', async () => {
			const libraries = await libraryManager.getEnabledLibraries('campaign-test');

			expect(libraries).toEqual(['library-srd']);
		});

		it('should return empty array if no libraries enabled', async () => {
			await libraryManager.disableLibrary('campaign-test', 'library-srd');

			const libraries = await libraryManager.getEnabledLibraries('campaign-test');

			expect(libraries).toEqual([]);
		});

		it('should return all enabled libraries', async () => {
			await libraryManager.enableLibrary('campaign-test', 'library-eberron');
			await libraryManager.enableLibrary('campaign-test', 'library-custom');

			const libraries = await libraryManager.getEnabledLibraries('campaign-test');

			expect(libraries).toEqual([
				'library-srd',
				'library-eberron',
				'library-custom'
			]);
		});

		it('should throw error if campaign not found', async () => {
			await expect(
				libraryManager.getEnabledLibraries('nonexistent')
			).rejects.toThrow('Campaign not found');
		});

		it('should return a copy of the array', async () => {
			const libraries1 = await libraryManager.getEnabledLibraries('campaign-test');
			const libraries2 = await libraryManager.getEnabledLibraries('campaign-test');

			expect(libraries1).not.toBe(libraries2); // Different array instances
			expect(libraries1).toEqual(libraries2); // But same values
		});
	});

	// ==================== INTEGRATION TESTS ====================

	describe('Integration', () => {
		it('should handle full library lifecycle', async () => {
			// Start with library-srd enabled
			expect(await libraryManager.isLibraryEnabled('campaign-test', 'library-srd')).toBe(true);

			// Enable new library
			await libraryManager.enableLibrary('campaign-test', 'library-eberron');
			expect(await libraryManager.isLibraryEnabled('campaign-test', 'library-eberron')).toBe(true);

			// Get enabled libraries
			let libraries = await libraryManager.getEnabledLibraries('campaign-test');
			expect(libraries).toEqual(['library-srd', 'library-eberron']);

			// Check for orphaned items
			let orphaned = await libraryManager.getOrphanedItems('campaign-test', 'library-eberron');
			expect(orphaned.length).toBe(1);

			// Disable library
			await libraryManager.disableLibrary('campaign-test', 'library-eberron');
			expect(await libraryManager.isLibraryEnabled('campaign-test', 'library-eberron')).toBe(false);

			// Verify final state
			libraries = await libraryManager.getEnabledLibraries('campaign-test');
			expect(libraries).toEqual(['library-srd']);
		});

		it('should maintain data consistency after multiple operations', async () => {
			// Enable and disable multiple times
			await libraryManager.enableLibrary('campaign-test', 'library-a');
			await libraryManager.enableLibrary('campaign-test', 'library-b');
			await libraryManager.disableLibrary('campaign-test', 'library-a');
			await libraryManager.enableLibrary('campaign-test', 'library-c');
			await libraryManager.disableLibrary('campaign-test', 'library-srd');

			const libraries = await libraryManager.getEnabledLibraries('campaign-test');
			expect(libraries).toEqual(['library-b', 'library-c']);
		});
	});
});
