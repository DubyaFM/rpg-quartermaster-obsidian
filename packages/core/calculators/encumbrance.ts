import {
	PartyMember,
	CreatureSize,
	EncumbranceLevel,
	PlayerEncumbrance,
	InventoryContainer,
	InventoryItem
} from '../models/types';

/**
 * Encumbrance Thresholds - Customizable ratios
 */
export interface EncumbranceThresholds {
	encumbered: number;  // Ratio (default: 0.333 = 5/15)
	heavilyEncumbered: number;  // Ratio (default: 0.666 = 10/15)
	overloaded: number;  // Ratio (default: 1.0 = 15/15)
}

/**
 * Encumbrance Penalties - Customizable speed reductions
 */
export interface EncumbrancePenalties {
	encumbered: number;  // Speed reduction (default: 10 ft)
	heavilyEncumbered: number;  // Speed reduction (default: 20 ft)
	overloadedSpeed: number;  // Fixed speed (default: 5 ft)
}

/**
 * Calculate carrying capacity based on D&D 5e rules
 * Base: STR × 15 lbs
 * Large creatures: × 2
 * Huge creatures: × 4
 * Gargantuan creatures: × 8
 * Tiny creatures: × 0.5
 * Small creatures: × 1 (no change)
 *
 * @param strengthScore - Strength ability score
 * @param size - Creature size
 * @param bonuses - Additional bonuses to carrying capacity
 * @returns Carrying capacity in pounds
 */
export function calculateCarryingCapacity(
	strengthScore: number,
	size: CreatureSize = 'Medium',
	bonuses: number = 0
): number {
	// Base capacity: STR × 15
	const baseCapacity = strengthScore * 15;
	const sizeMultiplier = getSizeMultiplier(size);

	// Apply size multiplier, then add flat capacity bonuses
	// Example: STR 16 Medium = 240, + 60 bonus = 300
	return Math.floor((baseCapacity * sizeMultiplier) + bonuses);
}

/**
 * Get size multiplier for carrying capacity
 *
 * @param size - Creature size
 * @returns Multiplier for carrying capacity
 */
function getSizeMultiplier(size: CreatureSize): number {
	switch (size) {
		case 'Tiny':
			return 0.5;
		case 'Small':
			return 1;
		case 'Medium':
			return 1;
		case 'Large':
			return 2;
		case 'Huge':
			return 4;
		case 'Gargantuan':
			return 8;
		default:
			return 1;
	}
}

/**
 * Determine encumbrance level based on current load vs capacity
 *
 * D&D 5e Rules:
 * - Normal: 0 to 5×STR
 * - Encumbered: 5×STR to 10×STR (Speed -10 ft)
 * - Heavily Encumbered: 10×STR to 15×STR (Speed -20 ft, disadvantage on ability checks, attack rolls, saves using STR/DEX/CON)
 * - Overloaded: Over 15×STR (Speed 5 ft max)
 *
 * IMPORTANT: These thresholds should be customizable in settings!
 * GM may want to use Variant Encumbrance rules or custom thresholds
 *
 * @param currentWeight - Current weight being carried
 * @param carryingCapacity - Maximum carrying capacity
 * @param customThresholds - Optional custom thresholds
 * @returns Encumbrance level
 */
export function getEncumbranceLevel(
	currentWeight: number,
	carryingCapacity: number,
	customThresholds?: EncumbranceThresholds
): EncumbranceLevel {
	const thresholds = customThresholds || getDefaultThresholds();

	const ratio = currentWeight / carryingCapacity;

	// Threshold interpretation:
	// - Being AT or ABOVE a threshold triggers that encumbrance level
	// - Use >= for encumbered and heavily_encumbered
	// - Use > for overloaded (being exactly at capacity doesn't overload you)
	if (ratio > thresholds.overloaded) {
		return 'overloaded';
	} else if (ratio >= thresholds.heavilyEncumbered) {
		return 'heavily_encumbered';
	} else if (ratio >= thresholds.encumbered) {
		return 'encumbered';
	} else {
		return 'normal';
	}
}

/**
 * Get default encumbrance thresholds
 *
 * @returns Default thresholds
 */
function getDefaultThresholds(): EncumbranceThresholds {
	return {
		// D&D 5e Variant Encumbrance thresholds
		// You become encumbered when EXCEEDING these weights:
		// - 5×STR (1/3 of capacity) - at this weight you're still normal
		// - 10×STR (2/3 of capacity) - at this weight you're still encumbered
		// - 15×STR (full capacity) - at this weight you're still heavily encumbered
		//
		// To handle the ">= threshold" logic below while matching D&D intent,
		// we set thresholds slightly above the fractional boundaries:
		encumbered: 1/3 + Number.EPSILON,  // Trigger at 51+ lbs (for STR 10)
		heavilyEncumbered: 2/3 + Number.EPSILON,  // Trigger at 101+ lbs (for STR 10)
		overloaded: 1.0,  // Trigger at 151+ lbs (handled by > not >=)
	};
}

/**
 * Calculate speed modifier based on encumbrance level
 *
 * @param level - Encumbrance level
 * @param baseSpeed - Base walking speed (default: 30 ft)
 * @param customPenalties - Optional custom penalties
 * @returns Modified speed in feet
 */
export function getSpeedModifier(
	level: EncumbranceLevel,
	baseSpeed: number = 30,
	customPenalties?: EncumbrancePenalties
): number {
	const penalties = customPenalties || getDefaultPenalties();

	switch (level) {
		case 'normal':
			return baseSpeed;
		case 'encumbered':
			return Math.max(baseSpeed - penalties.encumbered, 5);
		case 'heavily_encumbered':
			return Math.max(baseSpeed - penalties.heavilyEncumbered, 5);
		case 'overloaded':
			return penalties.overloadedSpeed;
		default:
			return baseSpeed;
	}
}

/**
 * Get default encumbrance penalties
 *
 * @returns Default penalties
 */
function getDefaultPenalties(): EncumbrancePenalties {
	return {
		encumbered: 10,
		heavilyEncumbered: 20,
		overloadedSpeed: 5,
	};
}

/**
 * Check if player has disadvantage on ability checks
 *
 * @param level - Encumbrance level
 * @returns True if player has disadvantage
 */
export function hasDisadvantage(level: EncumbranceLevel): boolean {
	return level === 'heavily_encumbered' || level === 'overloaded';
}

/**
 * Calculate total weight of a container including nested containers
 * Accounts for weight multipliers (e.g., Bag of Holding)
 *
 * @param containerId - Container to calculate weight for
 * @param containers - All containers in inventory
 * @param items - All items in inventory
 * @param maxDepth - Prevent infinite recursion (default: 10)
 * @returns Total weight in pounds
 */
export function calculateContainerWeight(
	containerId: string,
	containers: InventoryContainer[],
	items: InventoryItem[],
	maxDepth: number = 10
): number {
	if (maxDepth <= 0) {
		console.warn('Max depth reached in container weight calculation - possible circular reference');
		return 0;
	}

	const container = containers.find(c => c.id === containerId);
	if (!container) return 0;

	// Calculate weight of items directly in this container
	const itemsWeight = items
		.filter(item => item.containerId === containerId)
		.reduce((sum, item) => sum + (item.weight * item.quantity), 0);

	// Calculate weight of nested containers
	const nestedWeight = containers
		.filter(c => c.parentContainerId === containerId)
		.reduce((sum, nestedContainer) => {
			const nestedTotal = calculateContainerWeight(
				nestedContainer.id,
				containers,
				items,
				maxDepth - 1
			);
			// Apply nested container's weight multiplier
			return sum + (nestedTotal * nestedContainer.weightMultiplier);
		}, 0);

	// Total weight = items + nested containers
	// Don't apply multiplier here - parent will apply it
	return itemsWeight + nestedWeight;
}

/**
 * Calculate effective weight of a container when carried by a player
 * This applies the container's weight multiplier
 *
 * @param containerId - Container to calculate effective weight for
 * @param containers - All containers in inventory
 * @param items - All items in inventory
 * @returns Effective weight in pounds (after applying multiplier)
 */
export function calculateEffectiveWeight(
	containerId: string,
	containers: InventoryContainer[],
	items: InventoryItem[]
): number {
	const container = containers.find(c => c.id === containerId);
	if (!container) return 0;

	const totalWeight = calculateContainerWeight(containerId, containers, items);
	return totalWeight * container.weightMultiplier;
}

/**
 * Calculate total weight carried by a player
 * Includes all containers owned by the player
 *
 * @param playerId - Player ID
 * @param containers - All containers in inventory
 * @param items - All items in inventory
 * @returns Total weight carried in pounds
 */
export function calculatePlayerLoad(
	playerId: string,
	containers: InventoryContainer[],
	items: InventoryItem[]
): number {
	const playerContainers = containers.filter(c => c.ownerId === playerId);

	return playerContainers.reduce((sum, container) => {
		return sum + calculateEffectiveWeight(container.id, containers, items);
	}, 0);
}

/**
 * Calculate encumbrance state for a player
 *
 * @param player - Party member
 * @param containers - All containers in inventory
 * @param items - All items in inventory
 * @param settings - Optional encumbrance settings
 * @returns Player encumbrance state
 */
export function calculatePlayerEncumbrance(
	player: PartyMember,
	containers: InventoryContainer[],
	items: InventoryItem[],
	settings?: {
		thresholds?: EncumbranceThresholds;
		penalties?: EncumbrancePenalties;
	}
): PlayerEncumbrance {
	const currentLoad = calculatePlayerLoad(player.id, containers, items);

	// Get carrying capacity bonuses
	const capacityBonuses = player.bonuses
		?.filter(b => b.type === 'carrying_capacity')
		.reduce((sum, b) => sum + b.value, 0) || 0;

	const carryingCapacity = calculateCarryingCapacity(
		player.strength || 10,
		player.size,
		capacityBonuses
	);

	const encumbranceLevel = getEncumbranceLevel(
		currentLoad,
		carryingCapacity,
		settings?.thresholds
	);

	const speedModifier = getSpeedModifier(
		encumbranceLevel,
		player.speed || 30,
		settings?.penalties
	);

	return {
		playerId: player.id,
		carryingCapacity,
		currentLoad,
		encumbranceLevel,
		speedModifier,
		hasDisadvantage: hasDisadvantage(encumbranceLevel),
		calculatedAt: new Date().toISOString(),
	};
}
