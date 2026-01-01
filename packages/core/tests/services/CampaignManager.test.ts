import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CampaignManager, CampaignProfile, ICampaignPersistence } from '../../services/CampaignManager';

describe('CampaignManager', () => {
	let mockPersistence: ICampaignPersistence;
	let manager: CampaignManager;
	let campaigns: CampaignProfile[];

	beforeEach(() => {
		campaigns = [];
		mockPersistence = {
			loadCampaigns: vi.fn(async () => [...campaigns]),
			saveCampaigns: vi.fn(async (newCampaigns) => {
				campaigns = [...newCampaigns];
			})
		};
		// Use a dynamic ID generator by default
		let idCounter = 0;
		manager = new CampaignManager(mockPersistence, () => `campaign-${idCounter++}`);
	});

	describe('initialize', () => {
		it('should load campaigns from persistence', async () => {
			campaigns = [{ id: 'campaign-1', name: 'Test', worldId: 'world-1', createdAt: Date.now(), isActive: true, activeLibraryIds: [] }];
			await manager.initialize();
			const list = await manager.listCampaigns();
			expect(list).toHaveLength(1);
			expect(list[0].id).toBe('campaign-1');
			expect(mockPersistence.loadCampaigns).toHaveBeenCalledOnce();
		});

		it('should not reload if already loaded', async () => {
			await manager.initialize();
			await manager.initialize();
			expect(mockPersistence.loadCampaigns).toHaveBeenCalledOnce();
		});
	});

	describe('createCampaign', () => {
		beforeEach(async () => {
			await manager.initialize();
		});

		it('should create a new campaign with defaults', async () => {
			const profile = { name: 'New Campaign', worldId: 'world-test' };
			const result = await manager.createCampaign(profile);

			expect(result.id).toBe('campaign-0');
			expect(result.name).toBe('New Campaign');
			expect(result.isActive).toBe(true); // First campaign auto-active
			expect(mockPersistence.saveCampaigns).toHaveBeenCalled();
		});

		it('should throw error if name is missing', async () => {
			await expect(manager.createCampaign({ worldId: 'world-test' } as any))
				.rejects.toThrow('Campaign name is required');
			await expect(manager.createCampaign({ name: '', worldId: 'world-test' }))
				.rejects.toThrow('Campaign name is required');
			await expect(manager.createCampaign({ name: '   ', worldId: 'world-test' }))
				.rejects.toThrow('Campaign name is required');
		});

		it('should throw error if name is too long', async () => {
			await expect(manager.createCampaign({ name: 'a'.repeat(101), worldId: 'world-test' }))
				.rejects.toThrow('Campaign name must be 100 characters or less');
		});

		it('should throw error if worldId is invalid', async () => {
			await expect(manager.createCampaign({ name: 'Test', worldId: 'invalid' }))
				.rejects.toThrow('Campaign worldId is required and must start with "world-"');
			await expect(manager.createCampaign({ name: 'Test', worldId: '' } as any))
				.rejects.toThrow('Campaign worldId is required and must start with "world-"');
		});

		it('should deactivate others if new campaign is active', async () => {
			await manager.createCampaign({ name: 'C1', worldId: 'world-1' });
			const c2 = await manager.createCampaign({ name: 'C2', worldId: 'world-1', isActive: true });

			const list = await manager.listCampaigns();
			expect(list.find(c => c.name === 'C1')?.isActive).toBe(false);
			expect(c2.isActive).toBe(true);
		});

		it('should throw if ID already exists', async () => {
			const m2 = new CampaignManager(mockPersistence, () => 'fixed-id');
			await m2.initialize();
			await m2.createCampaign({ name: 'C1', worldId: 'world-1' });
			await expect(m2.createCampaign({ name: 'C2', worldId: 'world-1' }))
				.rejects.toThrow('Campaign with ID fixed-id already exists');
		});

		it('should use provided ID if present', async () => {
			const customId = 'campaign-custom';
			const result = await manager.createCampaign({ id: customId, name: 'Custom', worldId: 'world-1' });
			expect(result.id).toBe(customId);
		});
	});

	describe('getCampaignsByWorld', () => {
		beforeEach(async () => {
			await manager.initialize();
			await manager.createCampaign({ name: 'C1', worldId: 'world-1' });
			await manager.createCampaign({ name: 'C2', worldId: 'world-2' });
			await manager.createCampaign({ name: 'C3', worldId: 'world-1' });
		});

		it('should filter campaigns by worldId', async () => {
			const world1 = await manager.getCampaignsByWorld('world-1');
			expect(world1).toHaveLength(2);
			expect(world1.every(c => c.worldId === 'world-1')).toBe(true);

			const world2 = await manager.getCampaignsByWorld('world-2');
			expect(world2).toHaveLength(1);
		});

		it('should return empty array if no matches', async () => {
			const none = await manager.getCampaignsByWorld('world-none');
			expect(none).toHaveLength(0);
		});
	});

	describe('isNameTaken', () => {
		beforeEach(async () => {
			await manager.initialize();
			await manager.createCampaign({ name: 'Curse of Strahd', worldId: 'world-1' });
		});

		it('should return true for existing name (case-insensitive)', async () => {
			expect(await manager.isNameTaken('Curse of Strahd')).toBe(true);
			expect(await manager.isNameTaken('curse of strahd')).toBe(true);
			expect(await manager.isNameTaken('  CURSE OF STRAHD  ')).toBe(true);
		});

		it('should return false for new name', async () => {
			expect(await manager.isNameTaken('Lost Mines of Phandelver')).toBe(false);
		});

		it('should exclude specified ID', async () => {
			const list = await manager.listCampaigns();
			const cos = list.find(c => c.name === 'Curse of Strahd')!;
			expect(await manager.isNameTaken('Curse of Strahd', cos.id)).toBe(false);
		});
	});

	describe('getActiveCampaign', () => {
		it('should return null if none active', async () => {
			await manager.initialize();
			// No campaigns yet
			expect(await manager.getActiveCampaign()).toBeNull();
		});

		it('should return the active campaign', async () => {
			await manager.initialize();
			const c = await manager.createCampaign({ name: 'C1', worldId: 'world-1' });
			const active = await manager.getActiveCampaign();
			expect(active?.id).toBe(c.id);
		});
	});

	describe('getCampaignCount', () => {
		it('should return correct count', async () => {
			await manager.initialize();
			expect(await manager.getCampaignCount()).toBe(0);
			await manager.createCampaign({ name: 'C1', worldId: 'world-1' });
			expect(await manager.getCampaignCount()).toBe(1);
		});
	});

	describe('updateCampaign', () => {
		let c1: CampaignProfile;

		beforeEach(async () => {
			await manager.initialize();
			c1 = await manager.createCampaign({ name: 'C1', worldId: 'world-1' });
		});

		it('should update allowed fields', async () => {
			await manager.updateCampaign(c1.id, { name: 'Updated Name', description: 'New Desc' });
			const updated = await manager.getCampaign(c1.id);
			expect(updated?.name).toBe('Updated Name');
			expect(updated?.description).toBe('New Desc');
		});

		it('should throw if campaign not found', async () => {
			await expect(manager.updateCampaign('non-existent', { name: 'Fail' }))
				.rejects.toThrow('Campaign not found');
		});

		it('should prevent ID and createdAt changes', async () => {
			await expect(manager.updateCampaign(c1.id, { id: 'new-id' }))
				.rejects.toThrow('Cannot change campaign ID');
			await expect(manager.updateCampaign(c1.id, { createdAt: 123 }))
				.rejects.toThrow('Cannot change campaign creation timestamp');
		});

		it('should handle activation logic', async () => {
			// Clear campaigns for a fresh start
			campaigns = [];
			const m2 = new CampaignManager(mockPersistence, (id) => `campaign-${Math.random()}`);
			await m2.initialize();
			const cam1 = await m2.createCampaign({ name: 'CAM1', worldId: 'world-1' });
			const cam2 = await m2.createCampaign({ name: 'CAM2', worldId: 'world-1' });

			expect(cam1.isActive).toBe(true);
			expect(cam2.isActive).toBe(false);

			await m2.updateCampaign(cam2.id, { isActive: true });

			expect((await m2.getCampaign(cam1.id))?.isActive).toBe(false);
			expect((await m2.getCampaign(cam2.id))?.isActive).toBe(true);
		});
	});

	describe('deleteCampaign', () => {
		it('should delete an inactive campaign', async () => {
			// Need two campaigns because the first one is always active
			const m2 = new CampaignManager(mockPersistence, () => `c-${Math.random()}`);
			await m2.initialize();
			const c1 = await m2.createCampaign({ name: 'C1', worldId: 'world-1' });
			const c2 = await m2.createCampaign({ name: 'C2', worldId: 'world-1' });

			await m2.deleteCampaign(c2.id);
			expect(await m2.listCampaigns()).toHaveLength(1);
			expect(await m2.getCampaign(c2.id)).toBeNull();
		});

		it('should prevent deleting active campaign', async () => {
			await manager.initialize();
			const c1 = await manager.createCampaign({ name: 'C1', worldId: 'world-1' });
			await expect(manager.deleteCampaign(c1.id)).rejects.toThrow('Cannot delete active campaign');
		});
	});

	describe('getCampaign', () => {
		it('should return a copy, not a reference', async () => {
			await manager.initialize();
			const c1 = await manager.createCampaign({ name: 'C1', worldId: 'world-1' });
			const retrieved = await manager.getCampaign(c1.id);

			if (retrieved) {
				retrieved.name = 'Muted';
			}

			const secondLook = await manager.getCampaign(c1.id);
			expect(secondLook?.name).toBe('C1');
		});
	});

	describe('setActiveCampaign', () => {
		it('should activate target and deactivate others', async () => {
			let idCounter = 0;
			const m2 = new CampaignManager(mockPersistence, () => `c-${idCounter++}`);
			await m2.initialize();
			const c0 = await m2.createCampaign({ name: 'C0', worldId: 'world-1' });
			const c1 = await m2.createCampaign({ name: 'C1', worldId: 'world-1' });

			await m2.setActiveCampaign(c1.id);

			expect((await m2.getCampaign(c0.id))?.isActive).toBe(false);
			expect((await m2.getCampaign(c1.id))?.isActive).toBe(true);
			expect((await m2.getCampaign(c1.id))?.lastAccessedAt).toBeGreaterThan(0);
		});
	});

	describe('cloneCampaign', () => {
		it('should clone profile with new ID and name', async () => {
			await manager.initialize();
			const source = await manager.createCampaign({
				name: 'Source',
				worldId: 'world-1',
				description: 'Desc',
				pathMappings: { shops: 'S/' }
			});

			// Change ID generator for clone
			(manager as any).idGenerator = () => 'campaign-clone';

			const cloned = await manager.cloneCampaign(source.id, 'Clone');

			expect(cloned.id).toBe('campaign-clone');
			expect(cloned.name).toBe('Clone');
			expect(cloned.worldId).toBe(source.worldId);
			expect(cloned.isActive).toBe(false);
			expect(cloned.description).toContain('Cloned from "Source"');
			expect(cloned.pathMappings).toEqual(source.pathMappings);
		});

		it('should update path mappings if requested', async () => {
			await manager.initialize();
			const source = await manager.createCampaign({
				name: 'Source',
				worldId: 'world-1',
				pathMappings: {
					folder: 'Campaigns/Source/',
					fileInFolder: 'Campaigns/Source/Data.md',
					rootFile: 'Source.md'
				}
			});

			(manager as any).idGenerator = () => 'campaign-clone';

			const cloned = await manager.cloneCampaign(source.id, 'Clone', { updatePathMappings: true });

			expect(cloned.pathMappings?.folder).toBe('Campaigns/Source-clone/');
			expect(cloned.pathMappings?.fileInFolder).toBe('Campaigns/Source-clone/Data.md');
			expect(cloned.pathMappings?.rootFile).toBe('Source-clone.md');
		});
	});
});
