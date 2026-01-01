import { v4 as uuidv4 } from 'uuid';
import {
	InventoryContainer,
	InventoryItem,
	ContainerType,
	PartyMember
} from '../models/types';
import { IDataAdapter } from '../interfaces/IDataAdapter';

/**
 * Container Service
 * Manages CRUD operations for inventory containers with validation
 */
export class ContainerService {
	constructor(private adapter: IDataAdapter) {}

	/**
	 * Create a new container
	 *
	 * @param params - Container creation parameters
	 * @returns Created container
	 */
	async createContainer(params: {
		name: string;
		type: ContainerType;
		maxCapacity: number;
		weightMultiplier?: number;
		ownerId?: string;
		parentContainerId?: string;
		locationId?: string;
		description?: string;
		icon?: string;
		isDefault?: boolean;
	}): Promise<InventoryContainer> {
		// Validation
		if (params.parentContainerId) {
			await this.validateNesting(params.parentContainerId);
		}

		if (params.ownerId) {
			await this.validateOwner(params.ownerId);
		}

		const container: InventoryContainer = {
			id: uuidv4(),
			name: params.name,
			type: params.type,
			maxCapacity: params.maxCapacity,
			currentWeight: 0,
			weightMultiplier: params.weightMultiplier ?? 1.0,
			ownerId: params.ownerId,
			parentContainerId: params.parentContainerId,
			locationId: params.locationId,
			description: params.description,
			icon: params.icon,
			isDefault: params.isDefault ?? false,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		await this.adapter.saveContainer(container);
		return container;
	}

	/**
	 * Get container by ID
	 *
	 * @param id - Container ID
	 * @returns Container or null if not found
	 */
	async getContainer(id: string): Promise<InventoryContainer | null> {
		return await this.adapter.getContainer(id);
	}

	/**
	 * Update container
	 *
	 * @param id - Container ID
	 * @param updates - Partial updates to apply
	 * @returns Updated container
	 */
	async updateContainer(
		id: string,
		updates: Partial<InventoryContainer>
	): Promise<InventoryContainer> {
		const existing = await this.getContainer(id);
		if (!existing) {
			throw new Error(`Container ${id} not found`);
		}

		// Validate parent changes
		if (updates.parentContainerId && updates.parentContainerId !== existing.parentContainerId) {
			await this.validateNesting(updates.parentContainerId, id);
		}

		const updated: InventoryContainer = {
			...existing,
			...updates,
			id: existing.id,  // Cannot change ID
			updatedAt: new Date().toISOString(),
		};

		await this.adapter.updateContainer(updated);
		return updated;
	}

	/**
	 * Delete container
	 * Options:
	 * - moveItemsTo: Move items to another container
	 * - deleteItems: Delete all items (dangerous!)
	 *
	 * @param id - Container ID
	 * @param options - Deletion options
	 */
	async deleteContainer(
		id: string,
		options?: { moveItemsTo?: string; deleteItems?: boolean }
	): Promise<void> {
		const container = await this.getContainer(id);
		if (!container) {
			throw new Error(`Container ${id} not found`);
		}

		// Handle items
		const items = await this.adapter.getItemsInContainer(id);
		if (items.length > 0) {
			if (options?.deleteItems) {
				// Delete all items
				for (const item of items) {
					await this.adapter.deleteInventoryItem(item.id);
				}
			} else if (options?.moveItemsTo) {
				// Move items to another container
				for (const item of items) {
					await this.adapter.updateInventoryItem({
						...item,
						containerId: options.moveItemsTo,
					});
				}
			} else {
				throw new Error(
					`Cannot delete container ${container.name} - it contains ${items.length} items. ` +
					`Specify moveItemsTo or deleteItems option.`
				);
			}
		}

		// Handle nested containers
		const children = await this.getChildContainers(id);
		for (const child of children) {
			await this.deleteContainer(child.id, options);
		}

		await this.adapter.deleteContainer(id);
	}

	/**
	 * Validate that container nesting is allowed
	 * Prevents circular references and enforces max depth
	 *
	 * @param parentId - Parent container ID
	 * @param childId - Optional child container ID
	 * @param maxDepth - Maximum nesting depth (default: 3)
	 */
	private async validateNesting(
		parentId: string,
		childId?: string,
		maxDepth: number = 3
	): Promise<void> {
		// Check if parent exists
		const parent = await this.getContainer(parentId);
		if (!parent) {
			throw new Error(`Parent container ${parentId} not found`);
		}

		// Check depth
		// getContainerDepth returns the number of ancestors (0 for root)
		// maxDepth = 3 means we allow up to 3 levels of nesting
		// If parent is at depth 2, child would be at depth 3 (max), which is OK
		// If parent is at depth 3, child would be at depth 4, which exceeds max
		// So reject if parent_depth + 1 > maxDepth, i.e., parent_depth >= maxDepth
		const depth = await this.getContainerDepth(parentId);
		const childDepth = depth + 1;
		if (childDepth >= maxDepth) {
			throw new Error(
				`Cannot nest container - max depth of ${maxDepth} would be exceeded (child would be at depth ${childDepth})`
			);
		}

		// Check for circular reference
		if (childId) {
			const wouldCreateCycle = await this.wouldCreateCycle(parentId, childId);
			if (wouldCreateCycle) {
				throw new Error('Cannot nest container - would create circular reference');
			}
		}
	}

	/**
	 * Check if nesting would create a circular reference
	 *
	 * @param parentId - Parent container ID
	 * @param childId - Child container ID
	 * @returns True if circular reference would be created
	 */
	private async wouldCreateCycle(
		parentId: string,
		childId: string
	): Promise<boolean> {
		let currentId: string | undefined = parentId;
		const visited = new Set<string>();

		while (currentId) {
			if (currentId === childId) {
				return true;  // Would create cycle
			}

			if (visited.has(currentId)) {
				// Already visited - circular reference detected in existing structure
				console.warn('Circular reference detected in container hierarchy');
				return true;
			}

			visited.add(currentId);
			const container = await this.getContainer(currentId);
			currentId = container?.parentContainerId;
		}

		return false;
	}

	/**
	 * Get depth of container in hierarchy (0 = root)
	 *
	 * @param containerId - Container ID
	 * @returns Depth level
	 */
	private async getContainerDepth(containerId: string): Promise<number> {
		let depth = 0;
		let currentId: string | undefined = containerId;
		const visited = new Set<string>();

		while (currentId) {
			const container = await this.getContainer(currentId);
			if (!container?.parentContainerId) break;

			if (visited.has(currentId)) {
				console.warn('Circular reference detected in getContainerDepth');
				break;
			}

			visited.add(currentId);
			currentId = container.parentContainerId;
			depth++;
		}

		return depth;
	}

	/**
	 * Validate that owner exists
	 *
	 * @param ownerId - Owner ID (PartyMember.id)
	 */
	private async validateOwner(ownerId: string): Promise<void> {
		const members = await this.adapter.getPartyMembers();
		const ownerExists = members.some(m => m.id === ownerId);

		if (!ownerExists) {
			throw new Error(`Owner ${ownerId} not found in party members`);
		}
	}

	/**
	 * Get all containers owned by a player
	 *
	 * @param playerId - Player ID
	 * @returns Array of containers
	 */
	async getPlayerContainers(playerId: string): Promise<InventoryContainer[]> {
		const inventory = await this.adapter.getPartyInventoryV2();
		return inventory.containers.filter(c => c.ownerId === playerId);
	}

	/**
	 * Get party shared containers (no owner)
	 *
	 * @returns Array of shared containers
	 */
	async getSharedContainers(): Promise<InventoryContainer[]> {
		const inventory = await this.adapter.getPartyInventoryV2();
		return inventory.containers.filter(c => !c.ownerId);
	}

	/**
	 * Get child containers (nested inside parent)
	 *
	 * @param parentId - Parent container ID
	 * @returns Array of child containers
	 */
	async getChildContainers(parentId: string): Promise<InventoryContainer[]> {
		const inventory = await this.adapter.getPartyInventoryV2();
		return inventory.containers.filter(c => c.parentContainerId === parentId);
	}

	/**
	 * Get breadcrumb path for a container (for UI display)
	 * Example: ["Party Shared", "Wagon", "Large Chest"]
	 *
	 * @param containerId - Container ID
	 * @returns Array of container names from root to target
	 */
	async getContainerPath(containerId: string): Promise<string[]> {
		const path: string[] = [];
		let currentId: string | undefined = containerId;
		const visited = new Set<string>();

		while (currentId) {
			if (visited.has(currentId)) {
				console.warn('Circular reference in getContainerPath');
				break;
			}

			visited.add(currentId);
			const container = await this.getContainer(currentId);
			if (!container) break;

			path.unshift(container.name);
			currentId = container.parentContainerId;
		}

		return path;
	}

	/**
	 * Get root containers (no parent)
	 *
	 * @returns Array of root containers
	 */
	async getRootContainers(): Promise<InventoryContainer[]> {
		const inventory = await this.adapter.getPartyInventoryV2();
		return inventory.containers.filter(c => !c.parentContainerId);
	}

	/**
	 * Create default containers for a new player
	 * - "On-person" inventory (player type)
	 * - One bag container (item type, nested in on-person)
	 *
	 * @param player - Party member
	 * @returns Array of created containers
	 */
	async createDefaultContainers(player: PartyMember): Promise<InventoryContainer[]> {
		const containers: InventoryContainer[] = [];

		// Create "On-person" container
		const onPerson = await this.createContainer({
			name: `${player.name}'s Inventory`,
			type: 'player',
			maxCapacity: 0,  // Will use player's carrying capacity
			weightMultiplier: 1.0,
			ownerId: player.id,
			isDefault: true,
		});
		containers.push(onPerson);

		// Create default backpack
		const backpack = await this.createContainer({
			name: 'Backpack',
			type: 'item',
			maxCapacity: 30,
			weightMultiplier: 1.0,
			ownerId: player.id,
			parentContainerId: onPerson.id,
			isDefault: true,
		});
		containers.push(backpack);

		return containers;
	}

	/**
	 * Create party shared container
	 *
	 * @returns Created container
	 */
	async createPartySharedContainer(): Promise<InventoryContainer> {
		return await this.createContainer({
			name: 'Party Shared',
			type: 'custom',
			maxCapacity: 0,  // Unlimited
			weightMultiplier: 0.0,  // Weightless (not carried by anyone)
			isDefault: true,
		});
	}
}
