/**
 * Tests for restock_block effect
 *
 * Verifies that:
 * - restock_block effect prevents inventory restocking
 * - UI can check if restocking is blocked
 * - UI can get blocking event names for tooltips
 * - Multiple blocking events are handled correctly
 */

import { describe, it, expect, vi } from 'vitest';
import { restockShopInventory } from '../calculators/restock';
import { EffectRegistry } from '../services/EffectRegistry';
import { Shop, Item } from '../models/types';
import { IRandomizer } from '../interfaces/IRandomizer';
import { ResolvedEffects } from '../models/effectTypes';
import { ActiveEvent } from '../models/eventTypes';
import { DEFAULT_CURRENCY_CONFIG } from '../data/defaultCurrencyConfig';

// Mock randomizer
const mockRandomizer: IRandomizer = {
	randomInt: vi.fn((min: number, max: number) => Math.floor((min + max) / 2)),
	randomFloat: vi.fn(() => 0.5),
	rollDice: vi.fn(() => ({ total: 10, breakdown: '2d6 = 10' })),
	randomChoice: vi.fn(items => items[0]),
	weightedChoice: vi.fn((items) => items[0]),
	rollPercentile: vi.fn(() => 50),
	chance: vi.fn(() => true),
};

// Mock items
const mockCommonItem: Item = {
	name: 'Common Potion',
	description: 'A common healing potion',
	cost: { cp: 0, sp: 0, gp: 50, pp: 0 },
	rarity: 'common',
	type: 'potion',
	category: 'consumable',
	source: 'PHB',
	file: { path: 'items/potion.md', name: 'potion.md', basename: 'potion' }
};

const mockRareItem: Item = {
	name: 'Rare Sword',
	description: 'A rare magical sword',
	cost: { cp: 0, sp: 0, gp: 5000, pp: 0 },
	rarity: 'rare',
	type: 'weapon',
	category: 'weapon',
	source: 'DMG',
	file: { path: 'items/sword.md', name: 'sword.md', basename: 'sword' }
};

const allMockItems: Item[] = [mockCommonItem, mockRareItem];

// Mock shop
const mockShop: Shop = {
	name: 'Test Shop',
	wealthLevel: 'comfortable',
	inventory: [
		{ ...mockCommonItem, stock: 5, originalStock: 15 },
		{ ...mockRareItem, stock: 1, originalStock: 1 }
	],
	currency: { cp: 0, sp: 0, gp: 1000, pp: 0 },
	id: 'test-shop',
	lastRestock: '2024-01-01',
	markup: 0,
	markdown: 0,
	shopkeeper: 'Bob',
	transactions: []
};

// Helper to create mock active event
function createMockActiveEvent(
	id: string,
	name: string,
	priority: number,
	effects: any
): ActiveEvent {
	return {
		eventId: id,
		name,
		priority,
		effects,
		definition: {
			id,
			name,
			eventType: 'one-time',
			priority,
			effects
		}
	};
}

describe('Restock Block Effect', () => {
	describe('restockShopInventory with restock_block', () => {
		it('should block restocking when restock_block is true', () => {
			const effectContext: ResolvedEffects = {
				restock_block: true,
				resolvedDay: 100,
				competingEffects: {
					restock_block: ['siege-of-brindol']
				},
				resolutionStrategies: {
					restock_block: 'any_true'
				}
			};

			const result = restockShopInventory(
				mockRandomizer,
				mockShop,
				allMockItems,
				DEFAULT_CURRENCY_CONFIG,
				effectContext
			);

			expect(result.blocked).toBe(true);
			expect(result.blockingEvents).toEqual(['siege-of-brindol']);
			expect(result.stats.totalItems).toBe(0);
			expect(result.stats.commonRefilled).toBe(0);
			expect(result.stats.rareKept).toBe(0);
			// Shop inventory should be unchanged
			expect(result.shop.inventory).toEqual(mockShop.inventory);
		});

		it('should allow restocking when restock_block is false', () => {
			const effectContext: ResolvedEffects = {
				restock_block: false,
				resolvedDay: 100,
				competingEffects: {},
				resolutionStrategies: {}
			};

			const result = restockShopInventory(
				mockRandomizer,
				mockShop,
				allMockItems,
				DEFAULT_CURRENCY_CONFIG,
				effectContext
			);

			expect(result.blocked).toBe(false);
			expect(result.blockingEvents).toBeUndefined();
			expect(result.stats.totalItems).toBeGreaterThan(0);
			// Common items should be refilled
			expect(result.stats.commonRefilled).toBeGreaterThan(0);
		});

		it('should allow restocking when no effectContext provided', () => {
			const result = restockShopInventory(
				mockRandomizer,
				mockShop,
				allMockItems,
				DEFAULT_CURRENCY_CONFIG
			);

			expect(result.blocked).toBe(false);
			expect(result.stats.totalItems).toBeGreaterThan(0);
		});

		it('should handle multiple blocking events', () => {
			const effectContext: ResolvedEffects = {
				restock_block: true,
				resolvedDay: 100,
				competingEffects: {
					restock_block: ['siege-of-brindol', 'supply-shortage', 'trade-embargo']
				},
				resolutionStrategies: {
					restock_block: 'any_true'
				}
			};

			const result = restockShopInventory(
				mockRandomizer,
				mockShop,
				allMockItems,
				DEFAULT_CURRENCY_CONFIG,
				effectContext
			);

			expect(result.blocked).toBe(true);
			expect(result.blockingEvents).toEqual([
				'siege-of-brindol',
				'supply-shortage',
				'trade-embargo'
			]);
			expect(result.stats.totalItems).toBe(0);
		});

		it('should handle null effectContext', () => {
			const result = restockShopInventory(
				mockRandomizer,
				mockShop,
				allMockItems,
				DEFAULT_CURRENCY_CONFIG,
				null
			);

			expect(result.blocked).toBe(false);
			expect(result.stats.totalItems).toBeGreaterThan(0);
		});
	});

	describe('EffectRegistry helper methods', () => {
		const registry = new EffectRegistry();

		it('isRestockBlocked should return true when restock_block is true', () => {
			const effects: ResolvedEffects = {
				restock_block: true,
				resolvedDay: 100
			};

			expect(registry.isRestockBlocked(effects)).toBe(true);
		});

		it('isRestockBlocked should return false when restock_block is false', () => {
			const effects: ResolvedEffects = {
				restock_block: false,
				resolvedDay: 100
			};

			expect(registry.isRestockBlocked(effects)).toBe(false);
		});

		it('isRestockBlocked should return false when restock_block is undefined', () => {
			const effects: ResolvedEffects = {
				resolvedDay: 100
			};

			expect(registry.isRestockBlocked(effects)).toBe(false);
		});

		it('getRestockBlockingEventNames should return event IDs when present', () => {
			const effects: ResolvedEffects = {
				restock_block: true,
				resolvedDay: 100,
				competingEffects: {
					restock_block: ['siege', 'embargo']
				}
			};

			const eventNames = registry.getRestockBlockingEventNames(effects);
			expect(eventNames).toEqual(['siege', 'embargo']);
		});

		it('getRestockBlockingEventNames should return empty array when no competing effects', () => {
			const effects: ResolvedEffects = {
				restock_block: true,
				resolvedDay: 100
			};

			const eventNames = registry.getRestockBlockingEventNames(effects);
			expect(eventNames).toEqual([]);
		});

		it('getRestockBlockingEventNames should return empty array when restock_block not in competingEffects', () => {
			const effects: ResolvedEffects = {
				restock_block: true,
				resolvedDay: 100,
				competingEffects: {
					shop_closed: ['holiday']
				}
			};

			const eventNames = registry.getRestockBlockingEventNames(effects);
			expect(eventNames).toEqual([]);
		});
	});

	describe('Integration: EffectRegistry with restock_block', () => {
		const registry = new EffectRegistry();

		it('should resolve restock_block from single event', () => {
			const events: ActiveEvent[] = [
				createMockActiveEvent('siege', 'Siege of Brindol', 10, {
					restock_block: true
				})
			];

			const resolved = registry.getResolvedEffects(100, events);

			expect(resolved.restock_block).toBe(true);
			expect(resolved.resolutionStrategies?.restock_block).toBe('any_true');
			expect(resolved.competingEffects?.restock_block).toContain('siege');
		});

		it('should resolve restock_block as true if any event sets it to true', () => {
			const events: ActiveEvent[] = [
				createMockActiveEvent('normal-day', 'Normal Day', 1, {
					restock_block: false
				}),
				createMockActiveEvent('siege', 'Siege', 10, {
					restock_block: true
				}),
				createMockActiveEvent('festival', 'Festival', 5, {
					restock_block: false
				})
			];

			const resolved = registry.getResolvedEffects(100, events);

			expect(resolved.restock_block).toBe(true);
			expect(resolved.resolutionStrategies?.restock_block).toBe('any_true');
			// All events that contributed should be in competingEffects
			expect(resolved.competingEffects?.restock_block).toHaveLength(3);
		});

		it('should resolve restock_block as false if all events set it to false', () => {
			const events: ActiveEvent[] = [
				createMockActiveEvent('event-1', 'Event 1', 1, {
					restock_block: false
				}),
				createMockActiveEvent('event-2', 'Event 2', 2, {
					restock_block: false
				})
			];

			const resolved = registry.getResolvedEffects(100, events);

			expect(resolved.restock_block).toBe(false);
			expect(resolved.resolutionStrategies?.restock_block).toBe('any_true');
		});

		it('should not set restock_block if no events specify it', () => {
			const events: ActiveEvent[] = [
				createMockActiveEvent('event-1', 'Event 1', 1, {
					price_mult_global: 1.5
				})
			];

			const resolved = registry.getResolvedEffects(100, events);

			expect(resolved.restock_block).toBeUndefined();
			expect(resolved.resolutionStrategies?.restock_block).toBeUndefined();
		});
	});

	describe('End-to-end: Full restock blocking scenario', () => {
		const registry = new EffectRegistry();

		it('should block restock when siege is active', () => {
			// Setup: Active siege event with restock_block
			const events: ActiveEvent[] = [
				createMockActiveEvent('siege-of-brindol', 'Siege of Brindol', 10, {
					restock_block: true,
					price_mult_global: 2.0 // Also apply price increase
				})
			];

			// Get resolved effects
			const effectContext = registry.getResolvedEffects(100, events);

			// Check if blocked (for UI)
			expect(registry.isRestockBlocked(effectContext)).toBe(true);

			// Get blocking event names (for UI tooltip)
			const blockingEvents = registry.getRestockBlockingEventNames(effectContext);
			expect(blockingEvents).toContain('siege-of-brindol');

			// Attempt to restock
			const result = restockShopInventory(
				mockRandomizer,
				mockShop,
				allMockItems,
				DEFAULT_CURRENCY_CONFIG,
				effectContext
			);

			// Verify blocked
			expect(result.blocked).toBe(true);
			expect(result.blockingEvents).toContain('siege-of-brindol');
			expect(result.stats.totalItems).toBe(0);
			expect(result.shop.inventory).toEqual(mockShop.inventory); // Unchanged
		});

		it('should allow restock when siege ends', () => {
			// Setup: No active events
			const events: ActiveEvent[] = [];

			// Get resolved effects
			const effectContext = registry.getResolvedEffects(100, events);

			// Check if blocked (for UI)
			expect(registry.isRestockBlocked(effectContext)).toBe(false);

			// Attempt to restock
			const result = restockShopInventory(
				mockRandomizer,
				mockShop,
				allMockItems,
				DEFAULT_CURRENCY_CONFIG,
				effectContext
			);

			// Verify not blocked
			expect(result.blocked).toBe(false);
			expect(result.stats.totalItems).toBeGreaterThan(0);
			expect(result.shop.inventory.length).toBeGreaterThan(0);
		});
	});
});
