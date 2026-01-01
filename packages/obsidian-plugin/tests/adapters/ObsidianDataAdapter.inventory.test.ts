import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ObsidianDataAdapter } from '../../src/adapters/ObsidianDataAdapter';
import type { App, TFile } from 'obsidian';
import type { InventoryContainer, InventoryItem, RPGShopkeepSettings } from '@quartermaster/core/models/types';
import { InventoryMarkdownEditor } from '../../src/editors/InventoryMarkdownEditor';

describe('ObsidianDataAdapter - Inventory Methods', () => {
	let adapter: ObsidianDataAdapter;
	let mockApp: Partial<App>;
	let mockSettings: RPGShopkeepSettings;
	let mockPlugin: any;
	let mockInventoryEditor: Partial<InventoryMarkdownEditor>;

	beforeEach(() => {
		vi.clearAllMocks();

		// Mock inventory editor
		mockInventoryEditor = {
			addContainerBlock: vi.fn(),
			addItem: vi.fn(),
			removeItem: vi.fn()
		};

		// Mock plugin with pluginData
		mockPlugin = {
			pluginData: {
				containers: [],
				items: [],
				currency: {}
			},
			saveData: vi.fn(async (data) => {}),
			inventoryEditor: mockInventoryEditor,
			app: {} as App,
			settings: {} as RPGShopkeepSettings
		};

		// Mock App
		mockApp = {
			vault: {
				adapter: {
					exists: vi.fn(async (path: string) => false),
					read: vi.fn(async (path: string) => ''),
					write: vi.fn(async (path: string, data: string) => {})
				}
			} as any,
			metadataCache: {
				on: vi.fn()
			} as any
		};

		// Mock settings
		mockSettings = {
			shopFolder: 'Shops',
			partyInventoryPath: 'Party Inventory.md'
		} as RPGShopkeepSettings;

		adapter = new ObsidianDataAdapter(mockApp as App, mockSettings, mockPlugin);
	});

	describe('Container Operations', () => {
		it('should get container by id', async () => {
			const testContainer: InventoryContainer = {
				id: 'container-1',
				name: 'Backpack',
				type: 'item',
				maxCapacity: 300,
				currentWeight: 0,
				weightMultiplier: 1.0,
				ownerId: 'player-1',
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			};

			mockPlugin.pluginData.containers = [testContainer];

			const result = await adapter.getContainer('container-1');

			expect(result).toEqual(testContainer);
		});

		it('should return null when container not found', async () => {
			mockPlugin.pluginData.containers = [];

			const result = await adapter.getContainer('nonexistent');

			expect(result).toBeNull();
		});

		it('should get all containers', async () => {
			const containers: InventoryContainer[] = [
				{
					id: 'container-1',
					name: 'Backpack',
					type: 'item',
					maxCapacity: 300,
					currentWeight: 0,
					weightMultiplier: 1.0,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				},
				{
					id: 'container-2',
					name: 'Sack',
					type: 'item',
					maxCapacity: 150,
					currentWeight: 0,
					weightMultiplier: 1.0,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				}
			];

			mockPlugin.pluginData.containers = containers;

			const result = await adapter.getAllContainers();

			expect(result).toHaveLength(2);
			expect(result).toEqual(containers);
		});

		it('should save container to memory and markdown', async () => {
			const newContainer: InventoryContainer = {
				id: 'container-1',
				name: 'Backpack',
				type: 'item',
				maxCapacity: 300,
				currentWeight: 0,
				weightMultiplier: 1.0,
				ownerId: 'player-1',
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			};

			await adapter.saveContainer(newContainer);

			// Should add to memory
			expect(mockPlugin.pluginData.containers).toContain(newContainer);

			// Should save data
			expect(mockPlugin.saveData).toHaveBeenCalledWith(mockPlugin.pluginData);

			// Should update markdown
			expect(mockInventoryEditor.addContainerBlock).toHaveBeenCalledWith(newContainer);
		});

		it('should update container in memory', async () => {
			const originalContainer: InventoryContainer = {
				id: 'container-1',
				name: 'Backpack',
				type: 'item',
				maxCapacity: 300,
				currentWeight: 0,
				weightMultiplier: 1.0,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			};

			mockPlugin.pluginData.containers = [originalContainer];

			const updatedContainer: InventoryContainer = {
				...originalContainer,
				name: 'Large Backpack',
				maxCapacity: 500
			};

			await adapter.updateContainer(updatedContainer);

			// Should update in memory
			expect(mockPlugin.pluginData.containers[0]).toEqual(updatedContainer);

			// Should save data
			expect(mockPlugin.saveData).toHaveBeenCalledWith(mockPlugin.pluginData);
		});

		it('should delete container and associated items', async () => {
			const container: InventoryContainer = {
				id: 'container-1',
				name: 'Backpack',
				type: 'item',
				maxCapacity: 300,
				currentWeight: 0,
				weightMultiplier: 1.0,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			};

			const item1: InventoryItem = {
				id: 'item-1',
				itemId: 'Rope',
				containerId: 'container-1',
				quantity: 1,
				weight: 10,
				acquiredAt: new Date().toISOString()
			};

			const item2: InventoryItem = {
				id: 'item-2',
				itemId: 'Rations',
				containerId: 'container-2', // Different container
				quantity: 5,
				weight: 2,
				acquiredAt: new Date().toISOString()
			};

			mockPlugin.pluginData.containers = [container];
			mockPlugin.pluginData.items = [item1, item2];

			await adapter.deleteContainer('container-1');

			// Container should be removed
			expect(mockPlugin.pluginData.containers).toHaveLength(0);

			// Only items from deleted container should be removed
			expect(mockPlugin.pluginData.items).toHaveLength(1);
			expect(mockPlugin.pluginData.items[0]).toEqual(item2);

			// Should save data
			expect(mockPlugin.saveData).toHaveBeenCalledWith(mockPlugin.pluginData);
		});

		it('should initialize pluginData if missing', async () => {
			// Start with undefined pluginData
			mockPlugin.pluginData = undefined;

			const newContainer: InventoryContainer = {
				id: 'container-1',
				name: 'Backpack',
				type: 'item',
				maxCapacity: 300,
				currentWeight: 0,
				weightMultiplier: 1.0,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			};

			await adapter.saveContainer(newContainer);

			// pluginData should be initialized
			expect(mockPlugin.pluginData).toBeDefined();
			expect(mockPlugin.pluginData.containers).toBeDefined();
			expect(mockPlugin.pluginData.items).toBeDefined();
			expect(mockPlugin.pluginData.currency).toBeDefined();
		});
	});

	describe('Item Operations', () => {
		it('should get inventory item by id', async () => {
			const testItem: InventoryItem = {
				id: 'item-1',
				itemId: 'Rope',
				containerId: 'container-1',
				quantity: 1,
				weight: 10,
				acquiredAt: new Date().toISOString()
			};

			mockPlugin.pluginData.items = [testItem];

			const result = await adapter.getInventoryItem('item-1');

			expect(result).toEqual(testItem);
		});

		it('should get all inventory items', async () => {
			const items: InventoryItem[] = [
				{
					id: 'item-1',
					itemId: 'Rope',
					containerId: 'container-1',
					quantity: 1,
					weight: 10,
					acquiredAt: new Date().toISOString()
				},
				{
					id: 'item-2',
					itemId: 'Rations',
					containerId: 'container-1',
					quantity: 5,
					weight: 2,
					acquiredAt: new Date().toISOString()
				}
			];

			mockPlugin.pluginData.items = items;

			// Note: getAllInventoryItems was replaced with getPartyInventoryV2 in the bugfix
			const result = await adapter.getPartyInventoryV2();

			expect(result.items).toEqual(items);
		});

		it('should save item to memory and markdown', async () => {
			const newItem: InventoryItem = {
				id: 'item-1',
				itemId: 'Rope',
				containerId: 'container-1',
				quantity: 1,
				weight: 10,
				acquiredAt: new Date().toISOString()
			};

			await adapter.saveInventoryItem(newItem);

			// Should add to memory
			expect(mockPlugin.pluginData.items).toContain(newItem);

			// Should save data
			expect(mockPlugin.saveData).toHaveBeenCalledWith(mockPlugin.pluginData);

			// Should update markdown
			expect(mockInventoryEditor.addItem).toHaveBeenCalledWith('container-1', newItem);
		});

		it('should update item in memory', async () => {
			const originalItem: InventoryItem = {
				id: 'item-1',
				itemId: 'Rope',
				containerId: 'container-1',
				quantity: 1,
				weight: 10,
				acquiredAt: new Date().toISOString()
			};

			mockPlugin.pluginData.items = [originalItem];

			const updatedItem: InventoryItem = {
				...originalItem,
				quantity: 3
			};

			await adapter.updateInventoryItem(updatedItem);

			// Should update in memory
			expect(mockPlugin.pluginData.items[0]).toEqual(updatedItem);

			// Should save data
			expect(mockPlugin.saveData).toHaveBeenCalledWith(mockPlugin.pluginData);
		});

		it('should delete item from memory and markdown', async () => {
			const item: InventoryItem = {
				id: 'item-1',
				itemId: 'Rope',
				containerId: 'container-1',
				quantity: 1,
				weight: 10,
				acquiredAt: new Date().toISOString()
			};

			mockPlugin.pluginData.items = [item];

			await adapter.deleteInventoryItem('item-1');

			// Should remove from memory
			expect(mockPlugin.pluginData.items).toHaveLength(0);

			// Should save data
			expect(mockPlugin.saveData).toHaveBeenCalledWith(mockPlugin.pluginData);

			// Should update markdown
			expect(mockInventoryEditor.removeItem).toHaveBeenCalledWith('container-1', 'Rope');
		});

		it('should get items in container', async () => {
			const items: InventoryItem[] = [
				{
					id: 'item-1',
					itemId: 'Rope',
					containerId: 'container-1',
					quantity: 1,
					weight: 10,
					acquiredAt: new Date().toISOString()
				},
				{
					id: 'item-2',
					itemId: 'Rations',
					containerId: 'container-1',
					quantity: 5,
					weight: 2,
					acquiredAt: new Date().toISOString()
				},
				{
					id: 'item-3',
					itemId: 'Tent',
					containerId: 'container-2',
					quantity: 1,
					weight: 20,
					acquiredAt: new Date().toISOString()
				}
			];

			mockPlugin.pluginData.items = items;

			const result = await adapter.getItemsInContainer('container-1');

			expect(result).toHaveLength(2);
			expect(result.every(item => item.containerId === 'container-1')).toBe(true);
		});
	});

	describe('Party Inventory V2', () => {
		it('should return full inventory structure', async () => {
			const containers: InventoryContainer[] = [
				{
					id: 'container-1',
					name: 'Backpack',
					type: 'item',
					maxCapacity: 300,
					currentWeight: 0,
					weightMultiplier: 1.0,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				}
			];

			const items: InventoryItem[] = [
				{
					id: 'item-1',
					itemId: 'Rope',
					containerId: 'container-1',
					quantity: 1,
					weight: 10,
					acquiredAt: new Date().toISOString()
				}
			];

			const currency = {
				'player-1': { pp: 0, gp: 50, sp: 0, cp: 0 }
			};

			mockPlugin.pluginData = { containers, items, currency };

			const result = await adapter.getPartyInventoryV2();

			expect(result).toEqual({ containers, items, currency });
		});

		it('should return default structure when missing', async () => {
			mockPlugin.pluginData = undefined;

			const result = await adapter.getPartyInventoryV2();

			expect(result).toEqual({ containers: [], items: [], currency: {} });
		});

		it('should save entire inventory structure', async () => {
			const inventory = {
				containers: [
					{
						id: 'container-1',
						name: 'Backpack',
						type: 'item' as const,
						maxCapacity: 300,
						currentWeight: 0,
						weightMultiplier: 1.0,
						createdAt: new Date().toISOString(),
						updatedAt: new Date().toISOString()
					}
				],
				items: [
					{
						id: 'item-1',
						itemId: 'Rope',
						containerId: 'container-1',
						quantity: 1,
						weight: 10,
						acquiredAt: new Date().toISOString()
					}
				],
				currency: {
					'player-1': { pp: 0, gp: 50, sp: 0, cp: 0 }
				}
			};

			await adapter.savePartyInventoryV2(inventory);

			expect(mockPlugin.pluginData).toEqual(inventory);
			expect(mockPlugin.saveData).toHaveBeenCalledWith(inventory);
		});
	});

	describe('Edge Cases', () => {
		it('should handle empty containers array', async () => {
			mockPlugin.pluginData.containers = [];

			const result = await adapter.getAllContainers();

			expect(result).toEqual([]);
		});

		it('should handle empty items array', async () => {
			mockPlugin.pluginData.items = [];

			const result = await adapter.getItemsInContainer('any-container');

			expect(result).toEqual([]);
		});

		it('should not throw when deleting non-existent container', async () => {
			mockPlugin.pluginData.containers = [];

			await expect(
				adapter.deleteContainer('nonexistent')
			).resolves.not.toThrow();
		});

		it('should not throw when deleting non-existent item', async () => {
			mockPlugin.pluginData.items = [];

			// Item not found should be handled gracefully
			await adapter.deleteInventoryItem('nonexistent');

			expect(mockPlugin.pluginData.items).toHaveLength(0);
		});

		it('should handle update of non-existent item gracefully', async () => {
			mockPlugin.pluginData.items = [];

			const item: InventoryItem = {
				id: 'nonexistent',
				itemId: 'Item',
				containerId: 'container-1',
				quantity: 1,
				weight: 0,
				acquiredAt: new Date().toISOString()
			};

			await adapter.updateInventoryItem(item);

			// Should not throw, just not update anything
			expect(mockPlugin.pluginData.items).toHaveLength(0);
		});
	});
});
