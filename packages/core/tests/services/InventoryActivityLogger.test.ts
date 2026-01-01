import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InventoryActivityLogger } from '../../services/InventoryActivityLogger';
import { InventoryActivityEntry, InventoryAction } from '../../models/types';
import { IDataAdapter } from '../../interfaces/IDataAdapter';
import { EventBus } from '../../services/EventBus';

describe('InventoryActivityLogger', () => {
	let logger: InventoryActivityLogger;
	let mockAdapter: Partial<IDataAdapter>;
	let eventBus: EventBus;
	let savedActivities: InventoryActivityEntry[];

	beforeEach(() => {
		savedActivities = [];
		eventBus = new EventBus();

		mockAdapter = {
			saveInventoryActivity: vi.fn(async (entry: InventoryActivityEntry) => {
				savedActivities.push(entry);
			}),
			getInventoryActivity: vi.fn(async (filter?: any) => {
				let results = [...savedActivities];

				if (filter?.playerId) {
					results = results.filter(a => a.playerId === filter.playerId);
				}

				if (filter?.itemId) {
					results = results.filter(a => a.itemId === filter.itemId);
				}

				if (filter?.limit) {
					results = results.slice(0, filter.limit);
				}

				if (filter?.offset) {
					results = results.slice(filter.offset);
				}

				return results;
			})
		};

		logger = new InventoryActivityLogger(
			mockAdapter as IDataAdapter,
			eventBus
		);
	});

	describe('logAction', () => {
		it('should log basic action with all required fields', async () => {
			const entry = await logger.logAction({
				action: 'add',
				itemId: 'item-1',
				itemName: 'Longsword',
				quantity: 1,
				toContainerId: 'backpack-1'
			});

			expect(entry.id).toBeTruthy();
			expect(entry.timestamp).toBeTruthy();
			expect(entry.action).toBe('add');
			expect(entry.itemId).toBe('item-1');
			expect(entry.itemName).toBe('Longsword');
			expect(entry.quantity).toBe(1);
			expect(entry.toContainerId).toBe('backpack-1');
			expect(mockAdapter.saveInventoryActivity).toHaveBeenCalledWith(entry);
		});

		it('should include optional fields when provided', async () => {
			const entry = await logger.logAction({
				action: 'transfer',
				playerId: 'player-1',
				itemId: 'item-1',
				itemName: 'Sword',
				quantity: 1,
				fromContainerId: 'backpack-1',
				toContainerId: 'chest-1',
				notes: 'Stored in base',
				relatedDate: '2025-01-15'
			});

			expect(entry.playerId).toBe('player-1');
			expect(entry.fromContainerId).toBe('backpack-1');
			expect(entry.toContainerId).toBe('chest-1');
			expect(entry.notes).toBe('Stored in base');
			expect(entry.relatedDate).toBe('2025-01-15');
		});

		it('should emit event to EventBus after saving', async () => {
			const emitSpy = vi.spyOn(eventBus, 'emit');

			const entry = await logger.logAction({
				action: 'add',
				itemId: 'item-1',
				itemName: 'Potion',
				quantity: 1,
				toContainerId: 'backpack-1'
			});

			expect(emitSpy).toHaveBeenCalledWith('inventory:actionLogged', entry);
		});

		it('should generate unique IDs for each entry', async () => {
			const entry1 = await logger.logAction({
				action: 'add',
				itemId: 'item-1',
				itemName: 'Item 1',
				quantity: 1
			});

			const entry2 = await logger.logAction({
				action: 'add',
				itemId: 'item-2',
				itemName: 'Item 2',
				quantity: 1
			});

			expect(entry1.id).not.toBe(entry2.id);
		});

		it('should generate ISO timestamp', async () => {
			const before = new Date().toISOString();
			const entry = await logger.logAction({
				action: 'add',
				itemId: 'item-1',
				itemName: 'Test',
				quantity: 1
			});
			const after = new Date().toISOString();

			expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
			expect(entry.timestamp >= before).toBe(true);
			expect(entry.timestamp <= after).toBe(true);
		});
	});

	describe('Helper Methods', () => {
		describe('logTransfer', () => {
			it('should log transfer action', async () => {
				const entry = await logger.logTransfer({
					playerId: 'player-1',
					itemId: 'item-1',
					itemName: 'Sword',
					quantity: 1,
					fromContainerId: 'backpack-1',
					toContainerId: 'chest-1',
					notes: 'Moved to storage'
				});

				expect(entry.action).toBe('transfer');
				expect(entry.fromContainerId).toBe('backpack-1');
				expect(entry.toContainerId).toBe('chest-1');
			});

			it('should allow transfer without playerId (DM action)', async () => {
				const entry = await logger.logTransfer({
					itemId: 'item-1',
					itemName: 'Treasure',
					quantity: 100,
					fromContainerId: 'dragon-hoard',
					toContainerId: 'party-wagon'
				});

				expect(entry.playerId).toBeUndefined();
			});
		});

		describe('logConsume', () => {
			it('should log consume action', async () => {
				const entry = await logger.logConsume({
					playerId: 'player-1',
					itemId: 'potion-1',
					itemName: 'Potion of Healing',
					quantity: 1,
					containerId: 'backpack-1',
					notes: 'Used in combat'
				});

				expect(entry.action).toBe('consume');
				expect(entry.playerId).toBe('player-1');
				expect(entry.fromContainerId).toBe('backpack-1');
				expect(entry.toContainerId).toBeUndefined();
			});
		});

		describe('logAdd', () => {
			it('should log add action', async () => {
				const entry = await logger.logAdd({
					playerId: 'player-1',
					itemId: 'loot-1',
					itemName: 'Gold Coins',
					quantity: 100,
					containerId: 'backpack-1',
					notes: 'Looted from chest'
				});

				expect(entry.action).toBe('add');
				expect(entry.toContainerId).toBe('backpack-1');
				expect(entry.fromContainerId).toBeUndefined();
			});

			it('should allow add without playerId (system action)', async () => {
				const entry = await logger.logAdd({
					itemId: 'quest-reward',
					itemName: 'Magic Sword',
					quantity: 1,
					containerId: 'party-shared'
				});

				expect(entry.playerId).toBeUndefined();
			});
		});

		describe('logRemove', () => {
			it('should log remove action', async () => {
				const entry = await logger.logRemove({
					playerId: 'player-1',
					itemId: 'item-1',
					itemName: 'Broken Shield',
					quantity: 1,
					containerId: 'backpack-1',
					notes: 'Discarded after battle'
				});

				expect(entry.action).toBe('remove');
				expect(entry.fromContainerId).toBe('backpack-1');
				expect(entry.toContainerId).toBeUndefined();
			});
		});
	});

	describe('Query Methods', () => {
		beforeEach(async () => {
			// Create test data
			await logger.logAdd({
				playerId: 'player-1',
				itemId: 'item-1',
				itemName: 'Sword',
				quantity: 1,
				containerId: 'backpack-1'
			});

			await logger.logAdd({
				playerId: 'player-1',
				itemId: 'item-2',
				itemName: 'Potion',
				quantity: 5,
				containerId: 'backpack-1'
			});

			await logger.logAdd({
				playerId: 'player-2',
				itemId: 'item-3',
				itemName: 'Bow',
				quantity: 1,
				containerId: 'backpack-2'
			});

			await logger.logConsume({
				playerId: 'player-1',
				itemId: 'item-2',
				itemName: 'Potion',
				quantity: 1,
				containerId: 'backpack-1'
			});
		});

		describe('getPlayerActivity', () => {
			it('should return all activity for a player', async () => {
				const activity = await logger.getPlayerActivity('player-1');
				expect(activity).toHaveLength(3); // 2 adds + 1 consume
			});

			it('should return empty array for player with no activity', async () => {
				const activity = await logger.getPlayerActivity('player-3');
				expect(activity).toHaveLength(0);
			});

			it('should support limit option', async () => {
				const activity = await logger.getPlayerActivity('player-1', { limit: 2 });
				expect(activity).toHaveLength(2);
			});

			it('should support offset option', async () => {
				const activity = await logger.getPlayerActivity('player-1', { offset: 1 });
				expect(activity).toHaveLength(2);
			});
		});

		describe('getItemHistory', () => {
			it('should return all activity for an item', async () => {
				const history = await logger.getItemHistory('item-2');
				expect(history).toHaveLength(2); // 1 add + 1 consume
			});

			it('should return empty array for item with no history', async () => {
				const history = await logger.getItemHistory('item-999');
				expect(history).toHaveLength(0);
			});

			it('should support limit and offset', async () => {
				const history = await logger.getItemHistory('item-2', { limit: 1 });
				expect(history).toHaveLength(1);
			});
		});

		describe('getRecentActivity', () => {
			it('should return all recent activity', async () => {
				const recent = await logger.getRecentActivity(10);
				expect(recent).toHaveLength(4); // All entries
			});

			it('should default to limit of 50', async () => {
				const recent = await logger.getRecentActivity();
				expect(mockAdapter.getInventoryActivity).toHaveBeenCalledWith({ limit: 50 });
			});

			it('should respect custom limit', async () => {
				const recent = await logger.getRecentActivity(2);
				expect(recent).toHaveLength(2);
			});
		});
	});

	describe('EventBus Integration', () => {
		it('should listen for calendar:dateChanged events', () => {
			const listenerCount = eventBus.getListenerCount('calendar:dateChanged');
			expect(listenerCount).toBeGreaterThan(0);
		});

		it('should emit inventory:actionLogged events', async () => {
			let emittedEntry: InventoryActivityEntry | null = null;

			eventBus.subscribe('inventory:actionLogged', (entry) => {
				emittedEntry = entry;
			});

			const entry = await logger.logAdd({
				itemId: 'test-item',
				itemName: 'Test',
				quantity: 1,
				containerId: 'test-container'
			});

			expect(emittedEntry).toBeTruthy();
			expect(emittedEntry!.id).toBe(entry.id);
		});
	});

	describe('Action Types', () => {
		const actionTypes: InventoryAction[] = [
			'add',
			'remove',
			'transfer',
			'consume',
			'lost',
			'found',
			'sold',
			'purchased'
		];

		actionTypes.forEach((action) => {
			it(`should support ${action} action`, async () => {
				const entry = await logger.logAction({
					action,
					itemId: 'item-1',
					itemName: 'Test Item',
					quantity: 1
				});

				expect(entry.action).toBe(action);
			});
		});
	});

	describe('Edge Cases', () => {
		it('should handle large quantities', async () => {
			const entry = await logger.logAdd({
				itemId: 'coins',
				itemName: 'Gold Coins',
				quantity: 10000,
				containerId: 'treasure-chest'
			});

			expect(entry.quantity).toBe(10000);
		});

		it('should handle zero quantity', async () => {
			const entry = await logger.logAction({
				action: 'consume',
				itemId: 'item-1',
				itemName: 'Empty Item',
				quantity: 0
			});

			expect(entry.quantity).toBe(0);
		});

		it('should handle very long item names', async () => {
			const longName = 'A'.repeat(500);
			const entry = await logger.logAdd({
				itemId: 'item-1',
				itemName: longName,
				quantity: 1,
				containerId: 'backpack'
			});

			expect(entry.itemName).toBe(longName);
		});

		it('should handle special characters in notes', async () => {
			const entry = await logger.logAdd({
				itemId: 'item-1',
				itemName: 'Test',
				quantity: 1,
				containerId: 'backpack',
				notes: 'Found in "Dragon\'s Lair" (Level 10+) 🐉'
			});

			expect(entry.notes).toBe('Found in "Dragon\'s Lair" (Level 10+) 🐉');
		});
	});
});
