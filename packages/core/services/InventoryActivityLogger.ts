import { v4 as uuidv4 } from 'uuid';
import { InventoryActivityEntry, InventoryAction } from '../models/types';
import { IDataAdapter } from '../interfaces/IDataAdapter';
import { EventBus } from './EventBus';

/**
 * Inventory Activity Logger
 * Logs inventory actions and integrates with EventBus for cross-system notifications
 */
export class InventoryActivityLogger {
	constructor(
		private adapter: IDataAdapter,
		private eventBus: EventBus
	) {
		// Listen for calendar date changes (if integrated)
		this.eventBus.subscribe('calendar:dateChanged', this.onDateChanged.bind(this));
	}

	/**
	 * Log an inventory action
	 *
	 * @param params - Action parameters
	 * @returns Created activity entry
	 */
	async logAction(params: {
		action: InventoryAction;
		playerId?: string;
		itemId: string;
		itemName: string;
		quantity: number;
		fromContainerId?: string;
		toContainerId?: string;
		notes?: string;
		relatedDate?: string;
	}): Promise<InventoryActivityEntry> {
		const entry: InventoryActivityEntry = {
			id: uuidv4(),
			timestamp: new Date().toISOString(),
			action: params.action,
			playerId: params.playerId,
			itemId: params.itemId,
			itemName: params.itemName,
			quantity: params.quantity,
			fromContainerId: params.fromContainerId,
			toContainerId: params.toContainerId,
			notes: params.notes,
			relatedDate: params.relatedDate,
		};

		await this.adapter.saveInventoryActivity(entry);

		// Emit event for other systems to react
		this.eventBus.emit('inventory:actionLogged', entry);

		return entry;
	}

	/**
	 * Log a transfer action
	 *
	 * @param params - Transfer parameters
	 * @returns Created activity entry
	 */
	async logTransfer(params: {
		playerId?: string;
		itemId: string;
		itemName: string;
		quantity: number;
		fromContainerId: string;
		toContainerId: string;
		notes?: string;
	}): Promise<InventoryActivityEntry> {
		return await this.logAction({
			action: 'transfer',
			...params,
		});
	}

	/**
	 * Log item consumption
	 *
	 * @param params - Consumption parameters
	 * @returns Created activity entry
	 */
	async logConsume(params: {
		playerId: string;
		itemId: string;
		itemName: string;
		quantity: number;
		containerId: string;
		notes?: string;
	}): Promise<InventoryActivityEntry> {
		return await this.logAction({
			action: 'consume',
			playerId: params.playerId,
			itemId: params.itemId,
			itemName: params.itemName,
			quantity: params.quantity,
			fromContainerId: params.containerId,
			notes: params.notes,
		});
	}

	/**
	 * Log item added to inventory
	 *
	 * @param params - Add parameters
	 * @returns Created activity entry
	 */
	async logAdd(params: {
		playerId?: string;
		itemId: string;
		itemName: string;
		quantity: number;
		containerId: string;
		notes?: string;
	}): Promise<InventoryActivityEntry> {
		return await this.logAction({
			action: 'add',
			playerId: params.playerId,
			itemId: params.itemId,
			itemName: params.itemName,
			quantity: params.quantity,
			toContainerId: params.containerId,
			notes: params.notes,
		});
	}

	/**
	 * Log item removed from inventory
	 *
	 * @param params - Remove parameters
	 * @returns Created activity entry
	 */
	async logRemove(params: {
		playerId?: string;
		itemId: string;
		itemName: string;
		quantity: number;
		containerId: string;
		notes?: string;
	}): Promise<InventoryActivityEntry> {
		return await this.logAction({
			action: 'remove',
			playerId: params.playerId,
			itemId: params.itemId,
			itemName: params.itemName,
			quantity: params.quantity,
			fromContainerId: params.containerId,
			notes: params.notes,
		});
	}

	/**
	 * Get activity log for a player
	 *
	 * @param playerId - Player ID
	 * @param options - Query options
	 * @returns Array of activity entries
	 */
	async getPlayerActivity(
		playerId: string,
		options?: { limit?: number; offset?: number }
	): Promise<InventoryActivityEntry[]> {
		return await this.adapter.getInventoryActivity({
			playerId,
			...options,
		});
	}

	/**
	 * Get activity log for an item
	 *
	 * @param itemId - Item ID
	 * @param options - Query options
	 * @returns Array of activity entries
	 */
	async getItemHistory(
		itemId: string,
		options?: { limit?: number; offset?: number }
	): Promise<InventoryActivityEntry[]> {
		return await this.adapter.getInventoryActivity({
			itemId,
			...options,
		});
	}

	/**
	 * Get recent activity (all players)
	 *
	 * @param limit - Maximum number of entries to return
	 * @returns Array of activity entries
	 */
	async getRecentActivity(
		limit: number = 50
	): Promise<InventoryActivityEntry[]> {
		return await this.adapter.getInventoryActivity({ limit });
	}

	/**
	 * Calendar integration: Associate activities with in-game date
	 * This is called automatically when calendar date changes
	 *
	 * @param event - Date changed event
	 */
	private onDateChanged(event: { date: string }): void {
		// Store current date for future log entries
		// This would be used when logging actions to auto-populate relatedDate
		// Implementation will vary based on platform
	}
}
