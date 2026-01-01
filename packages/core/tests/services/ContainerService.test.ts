import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContainerService } from '../../services/ContainerService';
import {
	InventoryContainer,
	InventoryItem,
	PartyMember,
	PartyInventoryV2
} from '../../models/types';
import { IDataAdapter } from '../../interfaces/IDataAdapter';

describe('ContainerService', () => {
	let service: ContainerService;
	let mockAdapter: Partial<IDataAdapter>;
	let containers: InventoryContainer[];
	let items: InventoryItem[];
	let partyMembers: PartyMember[];

	beforeEach(() => {
		containers = [];
		items = [];
		partyMembers = [
			{
				id: 'player-1',
				name: 'Test Player',
				strength: 10
			}
		];

		mockAdapter = {
			saveContainer: vi.fn(async (container: InventoryContainer) => {
				containers.push(container);
			}),
			getContainer: vi.fn(async (id: string) => {
				return containers.find(c => c.id === id) || null;
			}),
			updateContainer: vi.fn(async (container: InventoryContainer) => {
				const index = containers.findIndex(c => c.id === container.id);
				if (index >= 0) {
					containers[index] = container;
				}
			}),
			deleteContainer: vi.fn(async (id: string) => {
				containers = containers.filter(c => c.id !== id);
			}),
			getAllContainers: vi.fn(async () => containers),
			getItemsInContainer: vi.fn(async (containerId: string) => {
				return items.filter(i => i.containerId === containerId);
			}),
			deleteInventoryItem: vi.fn(async (id: string) => {
				items = items.filter(i => i.id !== id);
			}),
			updateInventoryItem: vi.fn(async (item: InventoryItem) => {
				const index = items.findIndex(i => i.id === item.id);
				if (index >= 0) {
					items[index] = item;
				}
			}),
			getPartyMembers: vi.fn(async () => partyMembers),
			getPartyInventoryV2: vi.fn(async (): Promise<PartyInventoryV2> => ({
				version: 2,
				containers,
				items,
				encumbrance: [],
				currency: { gp: 0 },
				updatedAt: new Date().toISOString()
			}))
		};

		service = new ContainerService(mockAdapter as IDataAdapter);
	});

	describe('createContainer', () => {
		it('should create a container with all required fields', async () => {
			const container = await service.createContainer({
				name: 'Test Backpack',
				type: 'item',
				maxCapacity: 30,
				weightMultiplier: 1.0
			});

			expect(container.id).toBeTruthy();
			expect(container.name).toBe('Test Backpack');
			expect(container.type).toBe('item');
			expect(container.maxCapacity).toBe(30);
			expect(container.weightMultiplier).toBe(1.0);
			expect(container.currentWeight).toBe(0);
			expect(container.isDefault).toBe(false);
			expect(container.createdAt).toBeTruthy();
			expect(container.updatedAt).toBeTruthy();
			expect(mockAdapter.saveContainer).toHaveBeenCalledWith(container);
		});

		it('should default weightMultiplier to 1.0 if not provided', async () => {
			const container = await service.createContainer({
				name: 'Test',
				type: 'item',
				maxCapacity: 30
			});

			expect(container.weightMultiplier).toBe(1.0);
		});

		it('should default isDefault to false if not provided', async () => {
			const container = await service.createContainer({
				name: 'Test',
				type: 'item',
				maxCapacity: 30
			});

			expect(container.isDefault).toBe(false);
		});

		it('should set optional fields when provided', async () => {
			const container = await service.createContainer({
				name: 'Test',
				type: 'item',
				maxCapacity: 30,
				ownerId: 'player-1',
				description: 'A test container',
				icon: 'backpack',
				isDefault: true
			});

			expect(container.ownerId).toBe('player-1');
			expect(container.description).toBe('A test container');
			expect(container.icon).toBe('backpack');
			expect(container.isDefault).toBe(true);
		});

		it('should throw error if owner does not exist', async () => {
			await expect(
				service.createContainer({
					name: 'Test',
					type: 'item',
					maxCapacity: 30,
					ownerId: 'non-existent'
				})
			).rejects.toThrow('Owner non-existent not found');
		});

		it('should throw error if parent container does not exist', async () => {
			await expect(
				service.createContainer({
					name: 'Test',
					type: 'item',
					maxCapacity: 30,
					parentContainerId: 'non-existent'
				})
			).rejects.toThrow('Parent container non-existent not found');
		});

		it('should allow nesting if parent exists and depth is valid', async () => {
			const parent = await service.createContainer({
				name: 'Parent',
				type: 'item',
				maxCapacity: 50
			});

			const child = await service.createContainer({
				name: 'Child',
				type: 'item',
				maxCapacity: 20,
				parentContainerId: parent.id
			});

			expect(child.parentContainerId).toBe(parent.id);
		});

		it('should throw error if nesting would exceed max depth', async () => {
			const level1 = await service.createContainer({
				name: 'Level 1',
				type: 'item',
				maxCapacity: 50
			});

			const level2 = await service.createContainer({
				name: 'Level 2',
				type: 'item',
				maxCapacity: 30,
				parentContainerId: level1.id
			});

			const level3 = await service.createContainer({
				name: 'Level 3',
				type: 'item',
				maxCapacity: 10,
				parentContainerId: level2.id
			});

			// Fourth level should fail (max depth = 3)
			await expect(
				service.createContainer({
					name: 'Level 4',
					type: 'item',
					maxCapacity: 5,
					parentContainerId: level3.id
				})
			).rejects.toThrow('max depth');
		});
	});

	describe('getContainer', () => {
		it('should return container by ID', async () => {
			const created = await service.createContainer({
				name: 'Test',
				type: 'item',
				maxCapacity: 30
			});

			const retrieved = await service.getContainer(created.id);
			expect(retrieved).toEqual(created);
		});

		it('should return null for non-existent container', async () => {
			const retrieved = await service.getContainer('non-existent');
			expect(retrieved).toBeNull();
		});
	});

	describe('updateContainer', () => {
		it('should update container fields', async () => {
			const container = await service.createContainer({
				name: 'Original',
				type: 'item',
				maxCapacity: 30
			});

			const updated = await service.updateContainer(container.id, {
				name: 'Updated',
				maxCapacity: 50
			});

			expect(updated.name).toBe('Updated');
			expect(updated.maxCapacity).toBe(50);
			expect(updated.id).toBe(container.id); // ID should not change
			// updatedAt should be >= original (may be same if update is very fast)
		expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(container.updatedAt).getTime());
		});

		it('should throw error for non-existent container', async () => {
			await expect(
				service.updateContainer('non-existent', { name: 'Test' })
			).rejects.toThrow('Container non-existent not found');
		});

		it('should validate parent changes', async () => {
			const container = await service.createContainer({
				name: 'Test',
				type: 'item',
				maxCapacity: 30
			});

			await expect(
				service.updateContainer(container.id, {
					parentContainerId: 'non-existent'
				})
			).rejects.toThrow('Parent container non-existent not found');
		});

		it('should prevent circular nesting', async () => {
			const parent = await service.createContainer({
				name: 'Parent',
				type: 'item',
				maxCapacity: 50
			});

			const child = await service.createContainer({
				name: 'Child',
				type: 'item',
				maxCapacity: 20,
				parentContainerId: parent.id
			});

			// Try to make parent a child of child (circular)
			await expect(
				service.updateContainer(parent.id, {
					parentContainerId: child.id
				})
			).rejects.toThrow('circular reference');
		});
	});

	describe('deleteContainer', () => {
		it('should delete empty container', async () => {
			const container = await service.createContainer({
				name: 'Test',
				type: 'item',
				maxCapacity: 30
			});

			await service.deleteContainer(container.id);

			const retrieved = await service.getContainer(container.id);
			expect(retrieved).toBeNull();
		});

		it('should throw error when deleting container with items without options', async () => {
			const container = await service.createContainer({
				name: 'Test',
				type: 'item',
				maxCapacity: 30
			});

			items.push({
				id: 'item-1',
				itemId: 'sword',
				containerId: container.id,
				quantity: 1,
				weight: 3,
				acquiredAt: new Date().toISOString()
			});

			await expect(
				service.deleteContainer(container.id)
			).rejects.toThrow('contains 1 items');
		});

		it('should move items when moveItemsTo option provided', async () => {
			const container1 = await service.createContainer({
				name: 'Container 1',
				type: 'item',
				maxCapacity: 30
			});

			const container2 = await service.createContainer({
				name: 'Container 2',
				type: 'item',
				maxCapacity: 30
			});

			items.push({
				id: 'item-1',
				itemId: 'sword',
				containerId: container1.id,
				quantity: 1,
				weight: 3,
				acquiredAt: new Date().toISOString()
			});

			await service.deleteContainer(container1.id, {
				moveItemsTo: container2.id
			});

			expect(items[0].containerId).toBe(container2.id);
			expect(containers.find(c => c.id === container1.id)).toBeUndefined();
		});

		it('should delete items when deleteItems option provided', async () => {
			const container = await service.createContainer({
				name: 'Test',
				type: 'item',
				maxCapacity: 30
			});

			items.push({
				id: 'item-1',
				itemId: 'sword',
				containerId: container.id,
				quantity: 1,
				weight: 3,
				acquiredAt: new Date().toISOString()
			});

			await service.deleteContainer(container.id, { deleteItems: true });

			expect(items.length).toBe(0);
			expect(containers.find(c => c.id === container.id)).toBeUndefined();
		});

		it('should recursively delete nested containers', async () => {
			const parent = await service.createContainer({
				name: 'Parent',
				type: 'item',
				maxCapacity: 50
			});

			const child = await service.createContainer({
				name: 'Child',
				type: 'item',
				maxCapacity: 20,
				parentContainerId: parent.id
			});

			await service.deleteContainer(parent.id, { deleteItems: true });

			expect(containers.find(c => c.id === parent.id)).toBeUndefined();
			expect(containers.find(c => c.id === child.id)).toBeUndefined();
		});

		it('should throw error for non-existent container', async () => {
			await expect(
				service.deleteContainer('non-existent')
			).rejects.toThrow('Container non-existent not found');
		});
	});

	describe('Query Methods', () => {
		let player1Container: InventoryContainer;
		let player2Container: InventoryContainer;
		let sharedContainer: InventoryContainer;

		beforeEach(async () => {
			partyMembers.push({
				id: 'player-2',
				name: 'Player 2',
				strength: 12
			});

			player1Container = await service.createContainer({
				name: 'Player 1 Bag',
				type: 'item',
				maxCapacity: 30,
				ownerId: 'player-1'
			});

			player2Container = await service.createContainer({
				name: 'Player 2 Bag',
				type: 'item',
				maxCapacity: 30,
				ownerId: 'player-2'
			});

			sharedContainer = await service.createContainer({
				name: 'Shared Wagon',
				type: 'vehicle',
				maxCapacity: 2000
			});
		});

		describe('getPlayerContainers', () => {
			it('should return only containers owned by player', async () => {
				const p1Containers = await service.getPlayerContainers('player-1');
				expect(p1Containers).toHaveLength(1);
				expect(p1Containers[0].id).toBe(player1Container.id);
			});

			it('should return empty array for player with no containers', async () => {
				const containers = await service.getPlayerContainers('player-3');
				expect(containers).toHaveLength(0);
			});
		});

		describe('getSharedContainers', () => {
			it('should return only containers with no owner', async () => {
				const shared = await service.getSharedContainers();
				expect(shared).toHaveLength(1);
				expect(shared[0].id).toBe(sharedContainer.id);
			});
		});

		describe('getChildContainers', () => {
			it('should return nested containers', async () => {
				const child = await service.createContainer({
					name: 'Nested Pouch',
					type: 'item',
					maxCapacity: 10,
					parentContainerId: player1Container.id
				});

				const children = await service.getChildContainers(player1Container.id);
				expect(children).toHaveLength(1);
				expect(children[0].id).toBe(child.id);
			});

			it('should return empty array for container with no children', async () => {
				const children = await service.getChildContainers(player1Container.id);
				expect(children).toHaveLength(0);
			});
		});

		describe('getContainerPath', () => {
			it('should return breadcrumb path', async () => {
				const level1 = await service.createContainer({
					name: 'Backpack',
					type: 'item',
					maxCapacity: 50
				});

				const level2 = await service.createContainer({
					name: 'Pouch',
					type: 'item',
					maxCapacity: 10,
					parentContainerId: level1.id
				});

				const path = await service.getContainerPath(level2.id);
				expect(path).toEqual(['Backpack', 'Pouch']);
			});

			it('should return single item for root container', async () => {
				const path = await service.getContainerPath(player1Container.id);
				expect(path).toEqual(['Player 1 Bag']);
			});

			it('should return empty array for non-existent container', async () => {
				const path = await service.getContainerPath('non-existent');
				expect(path).toEqual([]);
			});
		});

		describe('getRootContainers', () => {
			it('should return only containers with no parent', async () => {
				const child = await service.createContainer({
					name: 'Nested',
					type: 'item',
					maxCapacity: 10,
					parentContainerId: player1Container.id
				});

				const roots = await service.getRootContainers();
				expect(roots).toHaveLength(3); // player1, player2, shared
				expect(roots.some(c => c.id === child.id)).toBe(false);
			});
		});
	});

	describe('Default Container Creation', () => {
		describe('createDefaultContainers', () => {
			it('should create on-person inventory and backpack', async () => {
				const player: PartyMember = {
					id: 'player-1',
					name: 'Test Fighter',
					strength: 16
				};

				const defaults = await service.createDefaultContainers(player);

				expect(defaults).toHaveLength(2);

				const onPerson = defaults.find(c => c.type === 'player');
				expect(onPerson).toBeTruthy();
				expect(onPerson!.name).toBe("Test Fighter's Inventory");
				expect(onPerson!.ownerId).toBe('player-1');
				expect(onPerson!.maxCapacity).toBe(0); // Uses player carrying capacity
				expect(onPerson!.isDefault).toBe(true);

				const backpack = defaults.find(c => c.name === 'Backpack');
				expect(backpack).toBeTruthy();
				expect(backpack!.type).toBe('item');
				expect(backpack!.maxCapacity).toBe(30);
				expect(backpack!.parentContainerId).toBe(onPerson!.id);
				expect(backpack!.isDefault).toBe(true);
			});
		});

		describe('createPartySharedContainer', () => {
			it('should create shared container with no owner', async () => {
				const shared = await service.createPartySharedContainer();

				expect(shared.name).toBe('Party Shared');
				expect(shared.type).toBe('custom');
				expect(shared.maxCapacity).toBe(0); // Unlimited
				expect(shared.weightMultiplier).toBe(0.0); // Weightless
				expect(shared.ownerId).toBeUndefined();
				expect(shared.isDefault).toBe(true);
			});
		});
	});
});
