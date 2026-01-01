/**
 * Unit tests for WorldManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorldManager, IWorldPersistence, ICampaignQuery } from '../WorldManager';
import { World, PRESET_WORLDS } from '../../models/World';
import { CampaignProfile } from '../CampaignManager';

describe('WorldManager', () => {
	let worldManager: WorldManager;
	let mockPersistence: IWorldPersistence;
	let mockCampaignQuery: ICampaignQuery;
	let customWorlds: World[];

	beforeEach(() => {
		customWorlds = [];

		mockPersistence = {
			loadWorlds: vi.fn().mockResolvedValue(customWorlds),
			saveWorlds: vi.fn().mockImplementation((worlds: World[]) => {
				customWorlds = worlds;
				return Promise.resolve();
			})
		};

		mockCampaignQuery = {
			getCampaignsByWorld: vi.fn().mockResolvedValue([])
		};

		worldManager = new WorldManager(mockPersistence, mockCampaignQuery);
	});

	// ==================== INITIALIZATION ====================

	describe('initialize', () => {
		it('should load custom worlds from persistence', async () => {
			const testWorlds: World[] = [
				{
					id: 'world-custom-test',
					name: 'Custom Test World',
					currencySystemId: 'dnd5e',
					calendarSystemId: 'gregorian',
					defaultLibraryIds: [],
					createdAt: Date.now(),
					isOfficial: false
				}
			];

			mockPersistence.loadWorlds = vi.fn().mockResolvedValue(testWorlds);
			worldManager = new WorldManager(mockPersistence, mockCampaignQuery);

			await worldManager.initialize();

			const worlds = await worldManager.listWorlds();
			// Should have preset worlds + custom world
			expect(worlds.length).toBe(PRESET_WORLDS.length + 1);
			expect(worlds.find(w => w.id === 'world-custom-test')).toBeDefined();
		});

		it('should not load twice if already initialized', async () => {
			await worldManager.initialize();
			await worldManager.initialize();

			expect(mockPersistence.loadWorlds).toHaveBeenCalledTimes(1);
		});

		it('should throw error if methods called before initialization', async () => {
			await expect(worldManager.listWorlds()).rejects.toThrow('not initialized');
			await expect(worldManager.getWorld('world-generic')).rejects.toThrow('not initialized');
			await expect(worldManager.createWorld({ name: 'Test' })).rejects.toThrow('not initialized');
		});
	});

	// ==================== LIST WORLDS ====================

	describe('listWorlds', () => {
		beforeEach(async () => {
			await worldManager.initialize();
		});

		it('should return preset worlds when no custom worlds exist', async () => {
			const worlds = await worldManager.listWorlds();
			expect(worlds.length).toBe(PRESET_WORLDS.length);
			expect(worlds[0].isOfficial).toBe(true);
		});

		it('should return preset worlds followed by custom worlds', async () => {
			await worldManager.createWorld({
				name: 'Custom World',
				currencySystemId: 'dnd5e',
				calendarSystemId: 'gregorian'
			});

			const worlds = await worldManager.listWorlds();
			expect(worlds.length).toBe(PRESET_WORLDS.length + 1);

			// Preset worlds should come first
			for (let i = 0; i < PRESET_WORLDS.length; i++) {
				expect(worlds[i].isOfficial).toBe(true);
			}

			// Custom world should be last
			expect(worlds[worlds.length - 1].isOfficial).toBe(false);
			expect(worlds[worlds.length - 1].name).toBe('Custom World');
		});

		it('should return copies to prevent mutation', async () => {
			const worlds = await worldManager.listWorlds();
			const firstWorld = worlds[0];
			firstWorld.name = 'MUTATED';

			const worldsAgain = await worldManager.listWorlds();
			expect(worldsAgain[0].name).not.toBe('MUTATED');
		});
	});

	// ==================== GET WORLD ====================

	describe('getWorld', () => {
		beforeEach(async () => {
			await worldManager.initialize();
		});

		it('should return preset world by ID', async () => {
			const world = await worldManager.getWorld('world-generic');
			expect(world).not.toBeNull();
			expect(world!.name).toBe('Generic Fantasy');
			expect(world!.isOfficial).toBe(true);
		});

		it('should return custom world by ID', async () => {
			const created = await worldManager.createWorld({
				name: 'My Homebrew',
				currencySystemId: 'dnd5e',
				calendarSystemId: 'harptos'
			});

			const retrieved = await worldManager.getWorld(created.id);
			expect(retrieved).not.toBeNull();
			expect(retrieved!.name).toBe('My Homebrew');
			expect(retrieved!.isOfficial).toBe(false);
		});

		it('should return null for non-existent world', async () => {
			const world = await worldManager.getWorld('world-nonexistent');
			expect(world).toBeNull();
		});

		it('should return copy to prevent mutation', async () => {
			const world = await worldManager.getWorld('world-generic');
			world!.name = 'MUTATED';

			const worldAgain = await worldManager.getWorld('world-generic');
			expect(worldAgain!.name).not.toBe('MUTATED');
		});
	});

	// ==================== CREATE WORLD ====================

	describe('createWorld', () => {
		beforeEach(async () => {
			await worldManager.initialize();
		});

		it('should create a new custom world with valid data', async () => {
			const newWorld = await worldManager.createWorld({
				name: 'Dark Sun',
				description: 'A harsh desert world',
				currencySystemId: 'dnd5e',
				calendarSystemId: 'gregorian',
				defaultLibraryIds: ['library-srd']
			});

			expect(newWorld.id).toBe('world-dark-sun');
			expect(newWorld.name).toBe('Dark Sun');
			expect(newWorld.description).toBe('A harsh desert world');
			expect(newWorld.currencySystemId).toBe('dnd5e');
			expect(newWorld.calendarSystemId).toBe('gregorian');
			expect(newWorld.defaultLibraryIds).toEqual(['library-srd']);
			expect(newWorld.isOfficial).toBe(false);
			expect(newWorld.createdAt).toBeGreaterThan(0);
		});

		it('should auto-generate slugified ID from name', async () => {
			const world = await worldManager.createWorld({
				name: 'My Cool Custom World!!!',
				currencySystemId: 'dnd5e',
				calendarSystemId: 'gregorian'
			});

			expect(world.id).toBe('world-my-cool-custom-world');
		});

		it('should accept custom ID if provided', async () => {
			const world = await worldManager.createWorld({
				id: 'world-custom-id',
				name: 'Custom ID World',
				currencySystemId: 'dnd5e',
				calendarSystemId: 'gregorian'
			});

			expect(world.id).toBe('world-custom-id');
		});

		it('should default to empty defaultLibraryIds if not provided', async () => {
			const world = await worldManager.createWorld({
				name: 'Minimal World',
				currencySystemId: 'dnd5e',
				calendarSystemId: 'gregorian'
			});

			expect(world.defaultLibraryIds).toEqual([]);
		});

		it('should persist new world to storage', async () => {
			await worldManager.createWorld({
				name: 'Persistent World',
				currencySystemId: 'dnd5e',
				calendarSystemId: 'gregorian'
			});

			expect(mockPersistence.saveWorlds).toHaveBeenCalled();
		});

		it('should throw error if name is missing', async () => {
			await expect(
				worldManager.createWorld({
					currencySystemId: 'dnd5e',
					calendarSystemId: 'gregorian'
				})
			).rejects.toThrow('name is required');
		});

		it('should throw error if name is empty', async () => {
			await expect(
				worldManager.createWorld({
					name: '   ',
					currencySystemId: 'dnd5e',
					calendarSystemId: 'gregorian'
				})
			).rejects.toThrow('name is required');
		});

		it('should throw error if name exceeds 100 characters', async () => {
			await expect(
				worldManager.createWorld({
					name: 'A'.repeat(101),
					currencySystemId: 'dnd5e',
					calendarSystemId: 'gregorian'
				})
			).rejects.toThrow('100 characters or less');
		});

		it('should throw error if currencySystemId is missing', async () => {
			await expect(
				worldManager.createWorld({
					name: 'Test World',
					calendarSystemId: 'gregorian'
				})
			).rejects.toThrow('Currency system ID is required');
		});

		it('should throw error if calendarSystemId is missing', async () => {
			await expect(
				worldManager.createWorld({
					name: 'Test World',
					currencySystemId: 'dnd5e'
				})
			).rejects.toThrow('Calendar system ID is required');
		});

		it('should throw error if ID does not start with "world-"', async () => {
			await expect(
				worldManager.createWorld({
					id: 'invalid-id',
					name: 'Test World',
					currencySystemId: 'dnd5e',
					calendarSystemId: 'gregorian'
				})
			).rejects.toThrow('must start with "world-"');
		});

		it('should throw error if ID already exists (preset)', async () => {
			await expect(
				worldManager.createWorld({
					id: 'world-generic',
					name: 'Duplicate Generic',
					currencySystemId: 'dnd5e',
					calendarSystemId: 'gregorian'
				})
			).rejects.toThrow('already exists');
		});

		it('should throw error if ID already exists (custom)', async () => {
			await worldManager.createWorld({
				id: 'world-test',
				name: 'Test World',
				currencySystemId: 'dnd5e',
				calendarSystemId: 'gregorian'
			});

			await expect(
				worldManager.createWorld({
					id: 'world-test',
					name: 'Duplicate Test',
					currencySystemId: 'dnd5e',
					calendarSystemId: 'gregorian'
				})
			).rejects.toThrow('already exists');
		});
	});

	// ==================== UPDATE WORLD ====================

	describe('updateWorld', () => {
		beforeEach(async () => {
			await worldManager.initialize();
		});

		it('should update a custom world', async () => {
			const created = await worldManager.createWorld({
				name: 'Original Name',
				currencySystemId: 'dnd5e',
				calendarSystemId: 'gregorian'
			});

			await worldManager.updateWorld(created.id, {
				name: 'Updated Name',
				description: 'New description'
			});

			const updated = await worldManager.getWorld(created.id);
			expect(updated!.name).toBe('Updated Name');
			expect(updated!.description).toBe('New description');
		});

		it('should update currency and calendar system IDs', async () => {
			const created = await worldManager.createWorld({
				name: 'Test World',
				currencySystemId: 'dnd5e',
				calendarSystemId: 'gregorian'
			});

			await worldManager.updateWorld(created.id, {
				currencySystemId: 'star_wars',
				calendarSystemId: 'harptos'
			});

			const updated = await worldManager.getWorld(created.id);
			expect(updated!.currencySystemId).toBe('star_wars');
			expect(updated!.calendarSystemId).toBe('harptos');
		});

		it('should update defaultLibraryIds', async () => {
			const created = await worldManager.createWorld({
				name: 'Test World',
				currencySystemId: 'dnd5e',
				calendarSystemId: 'gregorian'
			});

			await worldManager.updateWorld(created.id, {
				defaultLibraryIds: ['library-srd', 'library-custom']
			});

			const updated = await worldManager.getWorld(created.id);
			expect(updated!.defaultLibraryIds).toEqual(['library-srd', 'library-custom']);
		});

		it('should persist changes to storage', async () => {
			const created = await worldManager.createWorld({
				name: 'Test World',
				currencySystemId: 'dnd5e',
				calendarSystemId: 'gregorian'
			});

			vi.clearAllMocks();

			await worldManager.updateWorld(created.id, { name: 'Updated' });
			expect(mockPersistence.saveWorlds).toHaveBeenCalled();
		});

		it('should throw error when updating preset world', async () => {
			await expect(
				worldManager.updateWorld('world-generic', { name: 'Modified Generic' })
			).rejects.toThrow('Cannot modify official preset worlds');
		});

		it('should throw error for non-existent world', async () => {
			await expect(
				worldManager.updateWorld('world-nonexistent', { name: 'Test' })
			).rejects.toThrow('World not found');
		});

		it('should throw error if name is empty', async () => {
			const created = await worldManager.createWorld({
				name: 'Test World',
				currencySystemId: 'dnd5e',
				calendarSystemId: 'gregorian'
			});

			await expect(
				worldManager.updateWorld(created.id, { name: '   ' })
			).rejects.toThrow('cannot be empty');
		});

		it('should throw error if name exceeds 100 characters', async () => {
			const created = await worldManager.createWorld({
				name: 'Test World',
				currencySystemId: 'dnd5e',
				calendarSystemId: 'gregorian'
			});

			await expect(
				worldManager.updateWorld(created.id, { name: 'A'.repeat(101) })
			).rejects.toThrow('100 characters or less');
		});

		it('should throw error if trying to change ID', async () => {
			const created = await worldManager.createWorld({
				name: 'Test World',
				currencySystemId: 'dnd5e',
				calendarSystemId: 'gregorian'
			});

			await expect(
				worldManager.updateWorld(created.id, { id: 'world-different' })
			).rejects.toThrow('Cannot change world ID');
		});

		it('should throw error if trying to change createdAt', async () => {
			const created = await worldManager.createWorld({
				name: 'Test World',
				currencySystemId: 'dnd5e',
				calendarSystemId: 'gregorian'
			});

			await expect(
				worldManager.updateWorld(created.id, { createdAt: Date.now() + 10000 })
			).rejects.toThrow('Cannot change world creation timestamp');
		});

		it('should throw error if trying to change isOfficial', async () => {
			const created = await worldManager.createWorld({
				name: 'Test World',
				currencySystemId: 'dnd5e',
				calendarSystemId: 'gregorian'
			});

			await expect(
				worldManager.updateWorld(created.id, { isOfficial: true } as any)
			).rejects.toThrow('Cannot change isOfficial flag');
		});
	});

	// ==================== DELETE WORLD ====================

	describe('deleteWorld', () => {
		beforeEach(async () => {
			await worldManager.initialize();
		});

		it('should delete a custom world', async () => {
			const created = await worldManager.createWorld({
				name: 'To Delete',
				currencySystemId: 'dnd5e',
				calendarSystemId: 'gregorian'
			});

			await worldManager.deleteWorld(created.id);

			const deleted = await worldManager.getWorld(created.id);
			expect(deleted).toBeNull();
		});

		it('should persist deletion to storage', async () => {
			const created = await worldManager.createWorld({
				name: 'To Delete',
				currencySystemId: 'dnd5e',
				calendarSystemId: 'gregorian'
			});

			vi.clearAllMocks();

			await worldManager.deleteWorld(created.id);
			expect(mockPersistence.saveWorlds).toHaveBeenCalled();
		});

		it('should throw error when deleting preset world', async () => {
			await expect(
				worldManager.deleteWorld('world-generic')
			).rejects.toThrow('Cannot delete official preset worlds');
		});

		it('should throw error for non-existent world', async () => {
			await expect(
				worldManager.deleteWorld('world-nonexistent')
			).rejects.toThrow('World not found');
		});

		it('should throw error if world has campaigns', async () => {
			const created = await worldManager.createWorld({
				name: 'With Campaigns',
				currencySystemId: 'dnd5e',
				calendarSystemId: 'gregorian'
			});

			const mockCampaigns: CampaignProfile[] = [
				{
					id: 'campaign-1',
					name: 'Test Campaign',
					worldId: created.id,
					createdAt: Date.now(),
					isActive: true,
					activeLibraryIds: []
				}
			];

			mockCampaignQuery.getCampaignsByWorld = vi.fn().mockResolvedValue(mockCampaigns);

			await expect(
				worldManager.deleteWorld(created.id)
			).rejects.toThrow('has 1 campaign(s)');
		});

		it('should delete world without campaign query if no campaigns', async () => {
			const managerWithoutQuery = new WorldManager(mockPersistence);
			await managerWithoutQuery.initialize();

			const created = await managerWithoutQuery.createWorld({
				name: 'To Delete',
				currencySystemId: 'dnd5e',
				calendarSystemId: 'gregorian'
			});

			// Should not throw even without campaign query
			await managerWithoutQuery.deleteWorld(created.id);

			const deleted = await managerWithoutQuery.getWorld(created.id);
			expect(deleted).toBeNull();
		});
	});

	// ==================== GET CAMPAIGNS FOR WORLD ====================

	describe('getCampaignsForWorld', () => {
		beforeEach(async () => {
			await worldManager.initialize();
		});

		it('should return campaigns for a world', async () => {
			const mockCampaigns: CampaignProfile[] = [
				{
					id: 'campaign-1',
					name: 'Campaign 1',
					worldId: 'world-generic',
					createdAt: Date.now(),
					isActive: true,
					activeLibraryIds: []
				},
				{
					id: 'campaign-2',
					name: 'Campaign 2',
					worldId: 'world-generic',
					createdAt: Date.now(),
					isActive: false,
					activeLibraryIds: []
				}
			];

			mockCampaignQuery.getCampaignsByWorld = vi.fn().mockResolvedValue(mockCampaigns);

			const campaigns = await worldManager.getCampaignsForWorld('world-generic');
			expect(campaigns).toHaveLength(2);
			expect(campaigns[0].name).toBe('Campaign 1');
		});

		it('should throw error if campaign query not available', async () => {
			const managerWithoutQuery = new WorldManager(mockPersistence);
			await managerWithoutQuery.initialize();

			await expect(
				managerWithoutQuery.getCampaignsForWorld('world-generic')
			).rejects.toThrow('Campaign query not available');
		});
	});

	// ==================== HELPER METHODS ====================

	describe('isNameTaken', () => {
		beforeEach(async () => {
			await worldManager.initialize();
		});

		it('should return true for preset world name (case-insensitive)', async () => {
			expect(await worldManager.isNameTaken('Generic Fantasy')).toBe(true);
			expect(await worldManager.isNameTaken('generic fantasy')).toBe(true);
			expect(await worldManager.isNameTaken('GENERIC FANTASY')).toBe(true);
		});

		it('should return true for custom world name', async () => {
			await worldManager.createWorld({
				name: 'Custom World',
				currencySystemId: 'dnd5e',
				calendarSystemId: 'gregorian'
			});

			expect(await worldManager.isNameTaken('Custom World')).toBe(true);
			expect(await worldManager.isNameTaken('custom world')).toBe(true);
		});

		it('should return false for unique name', async () => {
			expect(await worldManager.isNameTaken('Unique Name')).toBe(false);
		});

		it('should exclude specified world ID from check', async () => {
			const created = await worldManager.createWorld({
				name: 'Test World',
				currencySystemId: 'dnd5e',
				calendarSystemId: 'gregorian'
			});

			expect(await worldManager.isNameTaken('Test World', created.id)).toBe(false);
		});
	});

	describe('getWorldCount', () => {
		beforeEach(async () => {
			await worldManager.initialize();
		});

		it('should return total count including presets', async () => {
			const count = await worldManager.getWorldCount();
			expect(count).toBe(PRESET_WORLDS.length);
		});

		it('should include custom worlds in count', async () => {
			await worldManager.createWorld({
				name: 'Custom 1',
				currencySystemId: 'dnd5e',
				calendarSystemId: 'gregorian'
			});

			const count = await worldManager.getWorldCount();
			expect(count).toBe(PRESET_WORLDS.length + 1);
		});
	});

	describe('getCustomWorldCount', () => {
		beforeEach(async () => {
			await worldManager.initialize();
		});

		it('should return zero when no custom worlds exist', async () => {
			const count = await worldManager.getCustomWorldCount();
			expect(count).toBe(0);
		});

		it('should return count of custom worlds only', async () => {
			await worldManager.createWorld({
				name: 'Custom 1',
				currencySystemId: 'dnd5e',
				calendarSystemId: 'gregorian'
			});

			await worldManager.createWorld({
				name: 'Custom 2',
				currencySystemId: 'dnd5e',
				calendarSystemId: 'gregorian'
			});

			const count = await worldManager.getCustomWorldCount();
			expect(count).toBe(2);
		});
	});

	describe('isPresetWorld', () => {
		beforeEach(async () => {
			await worldManager.initialize();
		});

		it('should return true for preset worlds', async () => {
			expect(await worldManager.isPresetWorld('world-generic')).toBe(true);
			expect(await worldManager.isPresetWorld('world-forgotten-realms')).toBe(true);
		});

		it('should return false for custom worlds', async () => {
			const created = await worldManager.createWorld({
				name: 'Custom World',
				currencySystemId: 'dnd5e',
				calendarSystemId: 'gregorian'
			});

			expect(await worldManager.isPresetWorld(created.id)).toBe(false);
		});

		it('should return false for non-existent worlds', async () => {
			expect(await worldManager.isPresetWorld('world-nonexistent')).toBe(false);
		});
	});

	// ==================== PRESET WORLDS ====================

	describe('PRESET_WORLDS', () => {
		beforeEach(async () => {
			await worldManager.initialize();
		});

		it('should include Generic Fantasy world', async () => {
			const generic = await worldManager.getWorld('world-generic');
			expect(generic).not.toBeNull();
			expect(generic!.name).toBe('Generic Fantasy');
			expect(generic!.currencySystemId).toBe('dnd5e');
			expect(generic!.calendarSystemId).toBe('gregorian');
		});

		it('should include Forgotten Realms world', async () => {
			const faerun = await worldManager.getWorld('world-forgotten-realms');
			expect(faerun).not.toBeNull();
			expect(faerun!.name).toBe('Forgotten Realms');
			expect(faerun!.currencySystemId).toBe('dnd5e');
			expect(faerun!.calendarSystemId).toBe('harptos');
		});

		it('should include Eberron world', async () => {
			const eberron = await worldManager.getWorld('world-eberron');
			expect(eberron).not.toBeNull();
			expect(eberron!.name).toBe('Eberron');
		});

		it('should include Sci-Fi world', async () => {
			const scifi = await worldManager.getWorld('world-sci-fi');
			expect(scifi).not.toBeNull();
			expect(scifi!.name).toBe('Sci-Fi Universe');
			expect(scifi!.currencySystemId).toBe('star_wars');
		});

		it('should mark all preset worlds as official', async () => {
			const worlds = await worldManager.listWorlds();
			const presets = worlds.filter(w => PRESET_WORLDS.some(p => p.id === w.id));

			presets.forEach(preset => {
				expect(preset.isOfficial).toBe(true);
			});
		});
	});
});
