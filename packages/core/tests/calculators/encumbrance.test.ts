import { describe, it, expect } from 'vitest';
import {
	calculateCarryingCapacity,
	getEncumbranceLevel,
	getSpeedModifier,
	hasDisadvantage,
	calculateContainerWeight,
	calculateEffectiveWeight,
	calculatePlayerLoad,
	calculatePlayerEncumbrance,
	EncumbranceThresholds,
	EncumbrancePenalties
} from '../../calculators/encumbrance';
import {
	PartyMember,
	InventoryContainer,
	InventoryItem,
	CreatureSize
} from '../../models/types';

describe('encumbrance', () => {
	describe('calculateCarryingCapacity', () => {
		it('should calculate base capacity (STR × 15)', () => {
			expect(calculateCarryingCapacity(10, 'Medium')).toBe(150);
			expect(calculateCarryingCapacity(15, 'Medium')).toBe(225);
			expect(calculateCarryingCapacity(20, 'Medium')).toBe(300);
		});

		it('should apply size multipliers correctly', () => {
			const str = 10; // 150 base capacity

			expect(calculateCarryingCapacity(str, 'Tiny')).toBe(75); // × 0.5
			expect(calculateCarryingCapacity(str, 'Small')).toBe(150); // × 1
			expect(calculateCarryingCapacity(str, 'Medium')).toBe(150); // × 1
			expect(calculateCarryingCapacity(str, 'Large')).toBe(300); // × 2
			expect(calculateCarryingCapacity(str, 'Huge')).toBe(600); // × 4
			expect(calculateCarryingCapacity(str, 'Gargantuan')).toBe(1200); // × 8
		});

		it('should default to Medium size if not provided', () => {
			expect(calculateCarryingCapacity(10)).toBe(150);
		});

		it('should add flat bonuses after size multiplier', () => {
			// STR 10 × 15 = 150 base
			// × 2 for Large = 300
			// + 30 flat bonus = 330
			expect(calculateCarryingCapacity(10, 'Large', 30)).toBe(330);
		});

		it('should handle zero bonuses', () => {
			expect(calculateCarryingCapacity(10, 'Medium', 0)).toBe(150);
		});

		it('should floor the result', () => {
			// Edge case: fractional capacity
			expect(calculateCarryingCapacity(10, 'Tiny')).toBe(75); // 150 × 0.5 = 75.0
		});
	});

	describe('getEncumbranceLevel', () => {
		const capacity = 150; // STR 10

		it('should return normal when under 1/3 capacity', () => {
			expect(getEncumbranceLevel(0, capacity)).toBe('normal');
			expect(getEncumbranceLevel(49, capacity)).toBe('normal');
			expect(getEncumbranceLevel(50, capacity)).toBe('normal'); // Exactly at threshold
		});

		it('should return encumbered when between 1/3 and 2/3 capacity', () => {
			expect(getEncumbranceLevel(51, capacity)).toBe('encumbered');
			expect(getEncumbranceLevel(99, capacity)).toBe('encumbered');
			expect(getEncumbranceLevel(100, capacity)).toBe('encumbered'); // Exactly at threshold
		});

		it('should return heavily_encumbered when between 2/3 and 1× capacity', () => {
			expect(getEncumbranceLevel(101, capacity)).toBe('heavily_encumbered');
			expect(getEncumbranceLevel(149, capacity)).toBe('heavily_encumbered');
			expect(getEncumbranceLevel(150, capacity)).toBe('heavily_encumbered'); // Exactly at threshold
		});

		it('should return overloaded when over capacity', () => {
			expect(getEncumbranceLevel(151, capacity)).toBe('overloaded');
			expect(getEncumbranceLevel(200, capacity)).toBe('overloaded');
			expect(getEncumbranceLevel(1000, capacity)).toBe('overloaded');
		});

		it('should use custom thresholds when provided', () => {
			const customThresholds: EncumbranceThresholds = {
				encumbered: 0.5, // 50%
				heavilyEncumbered: 0.75, // 75%
				overloaded: 1.0 // 100%
			};

			expect(getEncumbranceLevel(74, capacity, customThresholds)).toBe('normal'); // 74/150 = 0.493 < 0.5
			expect(getEncumbranceLevel(75, capacity, customThresholds)).toBe('encumbered'); // 75/150 = 0.5 >= 0.5
			expect(getEncumbranceLevel(113, capacity, customThresholds)).toBe('heavily_encumbered'); // 113/150 = 0.753 >= 0.75
			expect(getEncumbranceLevel(151, capacity, customThresholds)).toBe('overloaded'); // 151/150 = 1.006 > 1.0
		});
	});

	describe('getSpeedModifier', () => {
		it('should return base speed for normal encumbrance', () => {
			expect(getSpeedModifier('normal', 30)).toBe(30);
			expect(getSpeedModifier('normal', 40)).toBe(40);
		});

		it('should reduce speed by 10 for encumbered', () => {
			expect(getSpeedModifier('encumbered', 30)).toBe(20);
			expect(getSpeedModifier('encumbered', 40)).toBe(30);
		});

		it('should reduce speed by 20 for heavily_encumbered', () => {
			expect(getSpeedModifier('heavily_encumbered', 30)).toBe(10);
			expect(getSpeedModifier('heavily_encumbered', 40)).toBe(20);
		});

		it('should set speed to 5 for overloaded', () => {
			expect(getSpeedModifier('overloaded', 30)).toBe(5);
			expect(getSpeedModifier('overloaded', 40)).toBe(5);
			expect(getSpeedModifier('overloaded', 10)).toBe(5);
		});

		it('should default to 30 ft base speed if not provided', () => {
			expect(getSpeedModifier('normal')).toBe(30);
			expect(getSpeedModifier('encumbered')).toBe(20);
		});

		it('should enforce minimum speed of 5 ft', () => {
			expect(getSpeedModifier('encumbered', 10)).toBe(5); // Would be 0, but clamped
			expect(getSpeedModifier('heavily_encumbered', 15)).toBe(5); // Would be -5, but clamped
		});

		it('should use custom penalties when provided', () => {
			const customPenalties: EncumbrancePenalties = {
				encumbered: 5,
				heavilyEncumbered: 15,
				overloadedSpeed: 10
			};

			expect(getSpeedModifier('encumbered', 30, customPenalties)).toBe(25);
			expect(getSpeedModifier('heavily_encumbered', 30, customPenalties)).toBe(15);
			expect(getSpeedModifier('overloaded', 30, customPenalties)).toBe(10);
		});
	});

	describe('hasDisadvantage', () => {
		it('should return false for normal and encumbered', () => {
			expect(hasDisadvantage('normal')).toBe(false);
			expect(hasDisadvantage('encumbered')).toBe(false);
		});

		it('should return true for heavily_encumbered and overloaded', () => {
			expect(hasDisadvantage('heavily_encumbered')).toBe(true);
			expect(hasDisadvantage('overloaded')).toBe(true);
		});
	});

	describe('calculateContainerWeight', () => {
		const containers: InventoryContainer[] = [
			{
				id: 'container-1',
				name: 'Backpack',
				type: 'item',
				maxCapacity: 30,
				currentWeight: 0,
				weightMultiplier: 1.0,
				createdAt: '2025-01-01',
				updatedAt: '2025-01-01'
			},
			{
				id: 'container-2',
				name: 'Nested Pouch',
				type: 'item',
				maxCapacity: 10,
				currentWeight: 0,
				weightMultiplier: 1.0,
				parentContainerId: 'container-1',
				createdAt: '2025-01-01',
				updatedAt: '2025-01-01'
			},
			{
				id: 'container-3',
				name: 'Bag of Holding',
				type: 'item',
				maxCapacity: 500,
				currentWeight: 0,
				weightMultiplier: 0.0, // Weightless!
				parentContainerId: 'container-1',
				createdAt: '2025-01-01',
				updatedAt: '2025-01-01'
			}
		];

		const items: InventoryItem[] = [
			{
				id: 'item-1',
				itemId: 'longsword',
				containerId: 'container-1',
				quantity: 1,
				weight: 3,
				acquiredAt: '2025-01-01'
			},
			{
				id: 'item-2',
				itemId: 'potion',
				containerId: 'container-2',
				quantity: 5,
				weight: 0.5,
				acquiredAt: '2025-01-01'
			},
			{
				id: 'item-3',
				itemId: 'gold-bars',
				containerId: 'container-3',
				quantity: 10,
				weight: 50,
				acquiredAt: '2025-01-01'
			}
		];

		it('should calculate weight of items in container', () => {
			const weight = calculateContainerWeight('container-1', containers, items);
			// 1 longsword (3 lb) + nested pouch (2.5 lb) + bag of holding (0 lb)
			expect(weight).toBe(5.5);
		});

		it('should include nested container weights', () => {
			const weight = calculateContainerWeight('container-2', containers, items);
			// 5 potions @ 0.5 each = 2.5 lb
			expect(weight).toBe(2.5);
		});

		it('should apply weight multiplier to nested containers', () => {
			const weight = calculateContainerWeight('container-3', containers, items);
			// 10 gold bars @ 50 each = 500 lb
			expect(weight).toBe(500);

			// But when parent calculates, it applies the 0.0 multiplier
			const parentWeight = calculateContainerWeight('container-1', containers, items);
			expect(parentWeight).toBe(5.5); // 3 (longsword) + 2.5 (pouch) + 0 (bag × 0.0)
		});

		it('should return 0 for non-existent container', () => {
			const weight = calculateContainerWeight('non-existent', containers, items);
			expect(weight).toBe(0);
		});

		it('should return 0 for empty container', () => {
			const emptyContainers: InventoryContainer[] = [
				{
					id: 'empty',
					name: 'Empty Bag',
					type: 'item',
					maxCapacity: 30,
					currentWeight: 0,
					weightMultiplier: 1.0,
					createdAt: '2025-01-01',
					updatedAt: '2025-01-01'
				}
			];

			const weight = calculateContainerWeight('empty', emptyContainers, []);
			expect(weight).toBe(0);
		});

		it('should prevent infinite recursion with max depth', () => {
			// Create circular reference (should not happen in practice due to validation)
			const circularContainers: InventoryContainer[] = [
				{
					id: 'c1',
					name: 'C1',
					type: 'item',
					maxCapacity: 30,
					currentWeight: 0,
					weightMultiplier: 1.0,
					parentContainerId: 'c2',
					createdAt: '2025-01-01',
					updatedAt: '2025-01-01'
				},
				{
					id: 'c2',
					name: 'C2',
					type: 'item',
					maxCapacity: 30,
					currentWeight: 0,
					weightMultiplier: 1.0,
					parentContainerId: 'c1',
					createdAt: '2025-01-01',
					updatedAt: '2025-01-01'
				}
			];

			// Should not throw, should return 0 when max depth reached
			const weight = calculateContainerWeight('c1', circularContainers, [], 2);
			expect(weight).toBe(0);
		});
	});

	describe('calculateEffectiveWeight', () => {
		const containers: InventoryContainer[] = [
			{
				id: 'normal-bag',
				name: 'Backpack',
				type: 'item',
				maxCapacity: 30,
				currentWeight: 0,
				weightMultiplier: 1.0,
				createdAt: '2025-01-01',
				updatedAt: '2025-01-01'
			},
			{
				id: 'bag-of-holding',
				name: 'Bag of Holding',
				type: 'item',
				maxCapacity: 500,
				currentWeight: 0,
				weightMultiplier: 0.0,
				createdAt: '2025-01-01',
				updatedAt: '2025-01-01'
			}
		];

		const items: InventoryItem[] = [
			{
				id: 'item-1',
				itemId: 'heavy-stuff',
				containerId: 'normal-bag',
				quantity: 1,
				weight: 100,
				acquiredAt: '2025-01-01'
			},
			{
				id: 'item-2',
				itemId: 'more-heavy-stuff',
				containerId: 'bag-of-holding',
				quantity: 1,
				weight: 500,
				acquiredAt: '2025-01-01'
			}
		];

		it('should return full weight for normal containers', () => {
			const weight = calculateEffectiveWeight('normal-bag', containers, items);
			expect(weight).toBe(100); // 100 × 1.0
		});

		it('should return zero weight for Bag of Holding', () => {
			const weight = calculateEffectiveWeight('bag-of-holding', containers, items);
			expect(weight).toBe(0); // 500 × 0.0
		});

		it('should return 0 for non-existent container', () => {
			const weight = calculateEffectiveWeight('non-existent', containers, items);
			expect(weight).toBe(0);
		});
	});

	describe('calculatePlayerLoad', () => {
		const player1Id = 'player-1';
		const player2Id = 'player-2';

		const containers: InventoryContainer[] = [
			{
				id: 'p1-bag',
				name: 'Player 1 Backpack',
				type: 'item',
				maxCapacity: 30,
				currentWeight: 0,
				weightMultiplier: 1.0,
				ownerId: player1Id,
				createdAt: '2025-01-01',
				updatedAt: '2025-01-01'
			},
			{
				id: 'p2-bag',
				name: 'Player 2 Backpack',
				type: 'item',
				maxCapacity: 30,
				currentWeight: 0,
				weightMultiplier: 1.0,
				ownerId: player2Id,
				createdAt: '2025-01-01',
				updatedAt: '2025-01-01'
			},
			{
				id: 'shared',
				name: 'Party Wagon',
				type: 'vehicle',
				maxCapacity: 2000,
				currentWeight: 0,
				weightMultiplier: 0.0,
				createdAt: '2025-01-01',
				updatedAt: '2025-01-01'
			}
		];

		const items: InventoryItem[] = [
			{ id: '1', itemId: 'sword', containerId: 'p1-bag', quantity: 1, weight: 3, acquiredAt: '2025-01-01' },
			{ id: '2', itemId: 'armor', containerId: 'p1-bag', quantity: 1, weight: 20, acquiredAt: '2025-01-01' },
			{ id: '3', itemId: 'bow', containerId: 'p2-bag', quantity: 1, weight: 2, acquiredAt: '2025-01-01' },
			{ id: '4', itemId: 'treasure', containerId: 'shared', quantity: 1, weight: 1000, acquiredAt: '2025-01-01' }
		];

		it('should calculate total load for player', () => {
			const load = calculatePlayerLoad(player1Id, containers, items);
			expect(load).toBe(23); // 3 + 20
		});

		it('should not include other players items', () => {
			const load = calculatePlayerLoad(player2Id, containers, items);
			expect(load).toBe(2); // Only bow
		});

		it('should not include shared container items', () => {
			// Shared container has no owner, so no player carries it
			const load1 = calculatePlayerLoad(player1Id, containers, items);
			const load2 = calculatePlayerLoad(player2Id, containers, items);
			expect(load1).toBe(23);
			expect(load2).toBe(2);
			// Neither player carries the 1000 lb treasure in the wagon
		});

		it('should return 0 for player with no containers', () => {
			const load = calculatePlayerLoad('player-3', containers, items);
			expect(load).toBe(0);
		});
	});

	describe('calculatePlayerEncumbrance', () => {
		const player: PartyMember = {
			id: 'player-1',
			name: 'Test Fighter',
			strength: 16,
			size: 'Medium',
			speed: 30
		};

		const containers: InventoryContainer[] = [
			{
				id: 'backpack',
				name: 'Backpack',
				type: 'item',
				maxCapacity: 30,
				currentWeight: 0,
				weightMultiplier: 1.0,
				ownerId: 'player-1',
				createdAt: '2025-01-01',
				updatedAt: '2025-01-01'
			}
		];

		const createItems = (weight: number): InventoryItem[] => [
			{
				id: 'item-1',
				itemId: 'stuff',
				containerId: 'backpack',
				quantity: 1,
				weight,
				acquiredAt: '2025-01-01'
			}
		];

		it('should calculate encumbrance for normal load', () => {
			const items = createItems(50); // Light load
			const encumbrance = calculatePlayerEncumbrance(player, containers, items);

			expect(encumbrance.playerId).toBe('player-1');
			expect(encumbrance.carryingCapacity).toBe(240); // 16 × 15
			expect(encumbrance.currentLoad).toBe(50);
			expect(encumbrance.encumbranceLevel).toBe('normal');
			expect(encumbrance.speedModifier).toBe(30);
			expect(encumbrance.hasDisadvantage).toBe(false);
			expect(encumbrance.calculatedAt).toBeTruthy();
		});

		it('should calculate encumbrance for encumbered load', () => {
			const items = createItems(100); // Encumbered
			const encumbrance = calculatePlayerEncumbrance(player, containers, items);

			expect(encumbrance.encumbranceLevel).toBe('encumbered');
			expect(encumbrance.speedModifier).toBe(20);
			expect(encumbrance.hasDisadvantage).toBe(false);
		});

		it('should calculate encumbrance for heavily encumbered load', () => {
			const items = createItems(180); // Heavily encumbered
			const encumbrance = calculatePlayerEncumbrance(player, containers, items);

			expect(encumbrance.encumbranceLevel).toBe('heavily_encumbered');
			expect(encumbrance.speedModifier).toBe(10);
			expect(encumbrance.hasDisadvantage).toBe(true);
		});

		it('should calculate encumbrance for overloaded', () => {
			const items = createItems(250); // Overloaded
			const encumbrance = calculatePlayerEncumbrance(player, containers, items);

			expect(encumbrance.encumbranceLevel).toBe('overloaded');
			expect(encumbrance.speedModifier).toBe(5);
			expect(encumbrance.hasDisadvantage).toBe(true);
		});

		it('should use default strength of 10 if not provided', () => {
			const weakPlayer: PartyMember = {
				id: 'player-2',
				name: 'Weak Character'
			};

			const items = createItems(100);
			const encumbrance = calculatePlayerEncumbrance(weakPlayer, containers, items);

			expect(encumbrance.carryingCapacity).toBe(150); // 10 × 15
		});

		it('should apply carrying capacity bonuses', () => {
			const playerWithBonuses: PartyMember = {
				...player,
				bonuses: [
					{
						id: 'belt-bonus',
						source: 'Belt of Giant Strength',
						type: 'carrying_capacity',
						target: 'carrying_capacity',
						value: 60 // +60 lbs bonus
					}
				]
			};

			const items = createItems(100);
			const encumbrance = calculatePlayerEncumbrance(playerWithBonuses, containers, items);

			expect(encumbrance.carryingCapacity).toBe(300); // (16 × 15) + 60
		});

		it('should ignore non-carrying-capacity bonuses', () => {
			const playerWithBonuses: PartyMember = {
				...player,
				bonuses: [
					{
						id: 'speed-bonus',
						source: 'Boots of Speed',
						type: 'speed',
						target: 'speed',
						value: 10
					}
				]
			};

			const items = createItems(100);
			const encumbrance = calculatePlayerEncumbrance(playerWithBonuses, containers, items);

			expect(encumbrance.carryingCapacity).toBe(240); // 16 × 15, no bonus
		});

		it('should use custom thresholds and penalties', () => {
			const items = createItems(120);
			const settings = {
				thresholds: {
					encumbered: 0.5,
					heavilyEncumbered: 0.75,
					overloaded: 1.0
				} as EncumbranceThresholds,
				penalties: {
					encumbered: 5,
					heavilyEncumbered: 15,
					overloadedSpeed: 10
				} as EncumbrancePenalties
			};

			const encumbrance = calculatePlayerEncumbrance(player, containers, items, settings);

			// 120 / 240 = 0.5, exactly at encumbered threshold
			expect(encumbrance.encumbranceLevel).toBe('encumbered');
			expect(encumbrance.speedModifier).toBe(25); // 30 - 5
		});
	});
});
