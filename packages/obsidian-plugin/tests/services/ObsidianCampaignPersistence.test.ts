import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObsidianCampaignPersistence } from '../../src/services/ObsidianCampaignPersistence';
import { App, Plugin, PluginManifest } from 'obsidian';

describe('ObsidianCampaignPersistence', () => {
	let mockPlugin: Plugin;
	let persistence: ObsidianCampaignPersistence;
	let pluginData: any;

	beforeEach(() => {
		pluginData = {};
		const app = new App();
		const manifest: PluginManifest = {
			id: 'test-plugin',
			name: 'Test Plugin',
			version: '1.0.0',
			minAppVersion: '0.15.0',
			description: 'Test',
			author: 'Test'
		};

		mockPlugin = new (class extends Plugin {
			async loadData() {
				return pluginData;
			}
			async saveData(data: any) {
				pluginData = data;
			}
		})(app, manifest);

		persistence = new ObsidianCampaignPersistence(mockPlugin);
	});

	describe('loadCampaigns', () => {
		it('should load campaigns from data', async () => {
			pluginData = {
				campaigns: [
					{ id: 'c1', name: 'Campaign 1', worldId: 'world-1' }
				]
			};

			const campaigns = await persistence.loadCampaigns();
			expect(campaigns).toHaveLength(1);
			expect(campaigns[0].name).toBe('Campaign 1');
		});

		it('should return empty array if no campaigns found', async () => {
			pluginData = {};
			const campaigns = await persistence.loadCampaigns();
			expect(campaigns).toEqual([]);
		});

		it('should return empty array if no data file', async () => {
			vi.spyOn(mockPlugin, 'loadData').mockResolvedValue(null);
			const campaigns = await persistence.loadCampaigns();
			expect(campaigns).toEqual([]);
		});

		it('should throw error if campaigns is not an array', async () => {
			pluginData = { campaigns: 'not-an-array' };
			await expect(persistence.loadCampaigns()).rejects.toThrow('campaigns must be an array');
		});

		it('should filter out invalid campaigns', async () => {
			pluginData = {
				campaigns: [
					{ id: 'c1', name: 'Valid', worldId: 'world-1' },
					{ name: 'Invalid (no ID)', worldId: 'world-1' }
				]
			};
			const campaigns = await persistence.loadCampaigns();
			expect(campaigns).toHaveLength(1);
			expect(campaigns[0].id).toBe('c1');
		});
	});

	describe('saveCampaigns', () => {
		it('should save campaigns and preserve other data', async () => {
			pluginData = {
				settings: { theme: 'dark' },
				otherField: 'preserved'
			};

			const newCampaigns = [
				{ id: 'c1', name: 'New Campaign', worldId: 'world-1', isActive: true, activeLibraryIds: [] }
			];

			await persistence.saveCampaigns(newCampaigns as any);

			expect(pluginData.campaigns).toEqual(newCampaigns);
			expect(pluginData.settings.theme).toBe('dark');
			expect(pluginData.otherField).toBe('preserved');
		});
	});

	describe('migrateToDefaultCampaign', () => {
		it('should create default campaign if legacy settings exist and no campaigns', async () => {
			pluginData = {
				settings: {
					shopsFolder: 'MyShops/',
					partyInventoryFile: 'Party.md'
				}
			};

			const migrated = await persistence.migrateToDefaultCampaign();
			expect(migrated).toBe(true);
			expect(pluginData.campaigns).toHaveLength(1);
			expect(pluginData.campaigns[0].id).toBe('campaign_default');
			expect(pluginData.campaigns[0].pathMappings.shops).toBe('MyShops/');
			expect(pluginData.campaigns[0].pathMappings.party).toBe('Party.md');
		});

		it('should not migrate if campaigns already exist', async () => {
			pluginData = {
				campaigns: [{ id: 'c1', name: 'Existing', worldId: 'world-1' }]
			};

			const migrated = await persistence.migrateToDefaultCampaign();
			expect(migrated).toBe(false);
			expect(pluginData.campaigns).toHaveLength(1);
		});

		it('should not migrate if no data exists', async () => {
			vi.spyOn(mockPlugin, 'loadData').mockResolvedValue(null);
			const migrated = await persistence.migrateToDefaultCampaign();
			expect(migrated).toBe(false);
		});
	});

	describe('getCampaign', () => {
		it('should return campaign by ID', async () => {
			pluginData = {
				campaigns: [{ id: 'c1', name: 'C1', worldId: 'world-1' }]
			};
			const result = await persistence.getCampaign('c1');
			expect(result?.name).toBe('C1');
		});

		it('should return null if not found', async () => {
			pluginData = { campaigns: [] };
			const result = await persistence.getCampaign('c1');
			expect(result).toBeNull();
		});
	});

	describe('getActiveCampaign', () => {
		it('should return active campaign', async () => {
			pluginData = {
				campaigns: [
					{ id: 'c1', name: 'C1', worldId: 'world-1', isActive: false },
					{ id: 'c2', name: 'C2', worldId: 'world-1', isActive: true }
				]
			};
			const result = await persistence.getActiveCampaign();
			expect(result?.id).toBe('c2');
		});

		it('should return null if no active campaign', async () => {
			pluginData = {
				campaigns: [
					{ id: 'c1', name: 'C1', worldId: 'world-1', isActive: false }
				]
			};
			const result = await persistence.getActiveCampaign();
			expect(result).toBeNull();
		});
	});

	describe('hasCampaigns and getCampaignCount', () => {
		it('should return correct status and count', async () => {
			pluginData = { campaigns: [] };
			expect(await persistence.hasCampaigns()).toBe(false);
			expect(await persistence.getCampaignCount()).toBe(0);

			pluginData = {
				campaigns: [{ id: 'c1', name: 'C1', worldId: 'world-1' }]
			};
			expect(await persistence.hasCampaigns()).toBe(true);
			expect(await persistence.getCampaignCount()).toBe(1);
		});
	});

	describe('validateDataStructure', () => {
		it('should return valid: true for correct structure', async () => {
			pluginData = {
				campaigns: [{ id: 'c1', name: 'C1', worldId: 'world-1' }],
				settings: {},
				containers: [],
				items: [],
				currency: {}
			};
			const result = await persistence.validateDataStructure();
			expect(result.valid).toBe(true);
		});

		it('should report errors for invalid structure', async () => {
			pluginData = {
				campaigns: 'not-array',
				settings: 'not-object',
				containers: 'not-array',
				items: 'not-array',
				currency: 'not-object'
			};
			const result = await persistence.validateDataStructure();
			expect(result.valid).toBe(false);
			expect(result.errors).toContain('campaigns field exists but is not an array');
			expect(result.errors).toContain('settings field exists but is not an object');
			expect(result.errors).toContain('containers field exists but is not an array');
			expect(result.errors).toContain('items field exists but is not an array');
			expect(result.errors).toContain('currency field exists but is not an object');
		});

		it('should report errors for missing campaign fields', async () => {
			pluginData = {
				campaigns: [
					{ id: 'c1' }, // Missing name, worldId
					{ name: 'Missing ID' } // Missing id, worldId
				]
			};
			const result = await persistence.validateDataStructure();
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.includes('missing name'))).toBe(true);
			expect(result.errors.some(e => e.includes('missing worldId'))).toBe(true);
			expect(result.errors.some(e => e.includes('missing id'))).toBe(true);
		});
	});
});
