import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InventoryManagerModal } from '../../src/ui/InventoryManagerModal';
import type { App } from 'obsidian';
import type { InventoryContainer, InventoryItem } from '@quartermaster/core/models/types';
import type QuartermasterPlugin from '../../src/main';

describe('InventoryManagerModal', () => {
	let modal: InventoryManagerModal;
	let mockApp: Partial<App>;
	let mockPlugin: Partial<QuartermasterPlugin>;
	let mockDataAdapter: any;

	beforeEach(() => {
		vi.clearAllMocks();

		// Mock data adapter
		mockDataAdapter = {
			getAllContainers: vi.fn(async () => []),
			getPartyInventoryV2: vi.fn(async () => ({ items: [], containers: [], currency: {} }))
		};

		// Mock plugin
		mockPlugin = {
			dataAdapter: mockDataAdapter as any
		};

		// Mock App (minimal modal requirements)
		mockApp = {
			workspace: {
				containerEl: document.createElement('div')
			}
		} as any;

		modal = new InventoryManagerModal(mockApp as App, mockPlugin as QuartermasterPlugin);
	});

	describe('loadInventoryData', () => {
		it('should load containers and items', async () => {
			const containers: InventoryContainer[] = [
				{
					id: 'container-1',
					name: 'Backpack',
					type: 'item',
					maxCapacity: 300,
					currentWeight: 0,
					weightMultiplier: 1.0,
					ownerId: 'player-1',
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

			mockDataAdapter.getAllContainers.mockResolvedValue(containers);
			mockDataAdapter.getPartyInventoryV2.mockResolvedValue({ items, containers, currency: {} });

			// Access private method through prototype
			await (modal as any).loadInventoryData();

			expect((modal as any).containers).toEqual(containers);
			expect((modal as any).items).toEqual(items);
		});

		it('should handle load errors gracefully', async () => {
			mockDataAdapter.getAllContainers.mockRejectedValue(new Error('Load failed'));

			// Should not throw
			await expect(
				(modal as any).loadInventoryData()
			).resolves.not.toThrow();
		});

		it('should show notice on error', async () => {
			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			mockDataAdapter.getAllContainers.mockRejectedValue(new Error('Load failed'));

			await (modal as any).loadInventoryData();

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				'[Quartermaster] Failed to load inventory data:',
				expect.any(Error)
			);

			consoleErrorSpy.mockRestore();
		});
	});

	describe('groupContainersByOwner', () => {
		it('should group containers by ownerId', () => {
			const containers: InventoryContainer[] = [
				{
					id: 'container-1',
					name: 'Backpack 1',
					type: 'item',
					maxCapacity: 300,
					currentWeight: 0,
					weightMultiplier: 1.0,
					ownerId: 'player-1',
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				},
				{
					id: 'container-2',
					name: 'Backpack 2',
					type: 'item',
					maxCapacity: 300,
					currentWeight: 0,
					weightMultiplier: 1.0,
					ownerId: 'player-2',
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				}
			];

			(modal as any).containers = containers;

			const grouped = (modal as any).groupContainersByOwner();

			expect(grouped['player-1']).toHaveLength(1);
			expect(grouped['player-2']).toHaveLength(1);
		});

		it('should group null/undefined ownerId as Shared', () => {
			const containers: InventoryContainer[] = [
				{
					id: 'container-1',
					name: 'Shared Chest',
					type: 'item',
					maxCapacity: 500,
					currentWeight: 0,
					weightMultiplier: 1.0,
					ownerId: undefined,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				},
				{
					id: 'container-2',
					name: 'Another Shared',
					type: 'item',
					maxCapacity: 300,
					currentWeight: 0,
					weightMultiplier: 1.0,
					ownerId: 'shared',
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				}
			];

			(modal as any).containers = containers;

			const grouped = (modal as any).groupContainersByOwner();

			expect(grouped['Shared']).toHaveLength(2);
		});

		it('should create Shared group by default', () => {
			(modal as any).containers = [];

			const grouped = (modal as any).groupContainersByOwner();

			expect(grouped).toHaveProperty('Shared');
			expect(grouped['Shared']).toEqual([]);
		});

		it('should handle multiple containers per owner', () => {
			const containers: InventoryContainer[] = [
				{
					id: 'container-1',
					name: 'Backpack',
					type: 'item',
					maxCapacity: 300,
					currentWeight: 0,
					weightMultiplier: 1.0,
					ownerId: 'player-1',
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
					ownerId: 'player-1',
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				},
				{
					id: 'container-3',
					name: 'Pouch',
					type: 'item',
					maxCapacity: 50,
					currentWeight: 0,
					weightMultiplier: 1.0,
					ownerId: 'player-1',
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				}
			];

			(modal as any).containers = containers;

			const grouped = (modal as any).groupContainersByOwner();

			expect(grouped['player-1']).toHaveLength(3);
		});
	});

	describe('calculateContainerWeight', () => {
		it('should sum item weights multiplied by quantities', () => {
			const items: InventoryItem[] = [
				{
					id: 'item-1',
					itemId: 'Rope',
					containerId: 'container-1',
					quantity: 2,
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

			(modal as any).items = items;

			const totalWeight = (modal as any).calculateContainerWeight('container-1');

			// (2 * 10) + (5 * 2) = 20 + 10 = 30
			expect(totalWeight).toBe(30);
		});

		it('should return 0 for empty container', () => {
			(modal as any).items = [];

			const totalWeight = (modal as any).calculateContainerWeight('container-1');

			expect(totalWeight).toBe(0);
		});

		it('should handle items with zero weight', () => {
			const items: InventoryItem[] = [
				{
					id: 'item-1',
					itemId: 'Feather',
					containerId: 'container-1',
					quantity: 100,
					weight: 0,
					acquiredAt: new Date().toISOString()
				}
			];

			(modal as any).items = items;

			const totalWeight = (modal as any).calculateContainerWeight('container-1');

			expect(totalWeight).toBe(0);
		});

		it('should only sum items from specified container', () => {
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
					itemId: 'Tent',
					containerId: 'container-2',
					quantity: 1,
					weight: 20,
					acquiredAt: new Date().toISOString()
				}
			];

			(modal as any).items = items;

			const totalWeight = (modal as any).calculateContainerWeight('container-1');

			expect(totalWeight).toBe(10);
		});
	});

	describe('renderContainerTree', () => {
		it('should show empty state when no containers', () => {
			(modal as any).containers = [];
			(modal as any).items = [];
			(modal as any).leftPanel = document.createElement('div');

			(modal as any).renderContainerTree();

			const emptyState = (modal as any).leftPanel.querySelector('.empty-state');
			expect(emptyState).not.toBeNull();
		});

		it('should render owner groups', () => {
			const containers: InventoryContainer[] = [
				{
					id: 'container-1',
					name: 'Backpack',
					type: 'item',
					maxCapacity: 300,
					currentWeight: 0,
					weightMultiplier: 1.0,
					ownerId: 'player-1',
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				}
			];

			(modal as any).containers = containers;
			(modal as any).items = [];
			(modal as any).leftPanel = document.createElement('div');

			(modal as any).renderContainerTree();

			const ownerGroup = (modal as any).leftPanel.querySelector('.owner-group');
			expect(ownerGroup).not.toBeNull();
		});

		it('should render nested containers recursively', () => {
			const containers: InventoryContainer[] = [
				{
					id: 'container-1',
					name: 'Backpack',
					type: 'item',
					maxCapacity: 300,
					currentWeight: 0,
					weightMultiplier: 1.0,
					ownerId: 'player-1',
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				},
				{
					id: 'container-2',
					name: 'Pouch',
					type: 'item',
					maxCapacity: 50,
					currentWeight: 0,
					weightMultiplier: 1.0,
					ownerId: 'player-1',
					parentContainerId: 'container-1',
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				}
			];

			(modal as any).containers = containers;
			(modal as any).items = [];
			(modal as any).leftPanel = document.createElement('div');

			(modal as any).renderContainerTree();

			const containerItems = (modal as any).leftPanel.querySelectorAll('.container-item');
			expect(containerItems.length).toBe(2);
		});
	});

	describe('renderContainerDetails', () => {
		it('should show empty state when no selection', () => {
			(modal as any).selectedContainer = null;
			(modal as any).rightPanel = document.createElement('div');

			(modal as any).renderContainerDetails();

			const emptyState = (modal as any).rightPanel.querySelector('.empty-state');
			expect(emptyState).not.toBeNull();
		});

		it('should display container name and capacity', () => {
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

			(modal as any).selectedContainer = container;
			(modal as any).items = [];
			(modal as any).rightPanel = document.createElement('div');

			(modal as any).renderContainerDetails();

			const header = (modal as any).rightPanel.querySelector('h3');
			expect(header?.textContent).toBe('Backpack');

			const capacityInfo = (modal as any).rightPanel.querySelector('.capacity-info');
			expect(capacityInfo?.textContent).toContain('300');
		});

		it('should render item list', () => {
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

			(modal as any).selectedContainer = container;
			(modal as any).items = items;
			(modal as any).rightPanel = document.createElement('div');

			(modal as any).renderContainerDetails();

			const itemRows = (modal as any).rightPanel.querySelectorAll('.item-row');
			expect(itemRows.length).toBe(2);
		});

		it('should show item count and weight', () => {
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

			const items: InventoryItem[] = [
				{
					id: 'item-1',
					itemId: 'Rations',
					containerId: 'container-1',
					quantity: 5,
					weight: 2,
					acquiredAt: new Date().toISOString()
				}
			];

			(modal as any).selectedContainer = container;
			(modal as any).items = items;
			(modal as any).rightPanel = document.createElement('div');

			(modal as any).renderContainerDetails();

			const itemMeta = (modal as any).rightPanel.querySelector('.item-meta');
			expect(itemMeta?.textContent).toContain('×5');
			expect(itemMeta?.textContent).toContain('10'); // 5 * 2 = 10 lbs
		});
	});

	describe('Container Selection', () => {
		it('should update selected container on click', () => {
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

			(modal as any).containers = [container];
			(modal as any).items = [];
			(modal as any).leftPanel = document.createElement('div');
			(modal as any).rightPanel = document.createElement('div');

			(modal as any).renderContainerTree();

			const containerDiv = (modal as any).leftPanel.querySelector('.container-item');
			expect(containerDiv).not.toBeNull();

			// Simulate click
			containerDiv?.dispatchEvent(new Event('click'));

			expect((modal as any).selectedContainer).toEqual(container);
		});

		it('should re-render details panel on selection', () => {
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

			(modal as any).containers = [container];
			(modal as any).items = [];
			(modal as any).leftPanel = document.createElement('div');
			(modal as any).rightPanel = document.createElement('div');

			(modal as any).renderContainerTree();

			const containerDiv = (modal as any).leftPanel.querySelector('.container-item');

			// Before click, no selection
			expect((modal as any).rightPanel.querySelector('h3')).toBeNull();

			// Simulate click
			containerDiv?.dispatchEvent(new Event('click'));

			// After click, details should be rendered
			expect((modal as any).rightPanel.querySelector('h3')).not.toBeNull();
		});

		it('should apply selected CSS class', () => {
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

			(modal as any).containers = [container];
			(modal as any).items = [];
			(modal as any).leftPanel = document.createElement('div');
			(modal as any).rightPanel = document.createElement('div');

			(modal as any).renderContainerTree();

			const containerDiv = (modal as any).leftPanel.querySelector('.container-item');

			// Simulate click
			containerDiv?.dispatchEvent(new Event('click'));

			expect(containerDiv?.classList.contains('selected')).toBe(true);
		});
	});

	describe('Edge Cases', () => {
		it('should handle empty items list', () => {
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

			(modal as any).selectedContainer = container;
			(modal as any).items = [];
			(modal as any).rightPanel = document.createElement('div');

			(modal as any).renderContainerDetails();

			const emptyState = (modal as any).rightPanel.querySelector('.empty-state');
			expect(emptyState?.textContent).toContain('No items');
		});

		it('should handle containers with zero capacity', () => {
			const container: InventoryContainer = {
				id: 'container-1',
				name: 'Infinite Bag',
				type: 'item',
				maxCapacity: 0,
				currentWeight: 0,
				weightMultiplier: 1.0,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			};

			(modal as any).selectedContainer = container;
			(modal as any).items = [];
			(modal as any).rightPanel = document.createElement('div');

			(modal as any).renderContainerDetails();

			const capacityInfo = (modal as any).rightPanel.querySelector('.capacity-info');
			expect(capacityInfo?.textContent).toContain('0 / 0');
		});

		it('should handle deeply nested containers', () => {
			const containers: InventoryContainer[] = [
				{
					id: 'container-1',
					name: 'Level 1',
					type: 'item',
					maxCapacity: 300,
					currentWeight: 0,
					weightMultiplier: 1.0,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				},
				{
					id: 'container-2',
					name: 'Level 2',
					type: 'item',
					maxCapacity: 200,
					currentWeight: 0,
					weightMultiplier: 1.0,
					parentContainerId: 'container-1',
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				},
				{
					id: 'container-3',
					name: 'Level 3',
					type: 'item',
					maxCapacity: 100,
					currentWeight: 0,
					weightMultiplier: 1.0,
					parentContainerId: 'container-2',
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				}
			];

			(modal as any).containers = containers;
			(modal as any).items = [];
			(modal as any).leftPanel = document.createElement('div');

			(modal as any).renderContainerTree();

			// Should render all 3 levels
			const containerItems = (modal as any).leftPanel.querySelectorAll('.container-item');
			expect(containerItems.length).toBe(3);
		});
	});
});
