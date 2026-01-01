// Loot Table Utility
// Random loot generation for D&D 5e treasure, following DMG guidelines
// Supports individual loot, hoard loot, quest rewards, and special themed loot

import { Item, ItemCost } from '../models/types';
import type { CurrencyConfig } from '../models/currency-config.js';
import { parseCostString, addCurrency, convertToCopper, convertFromCopper } from '../calculators/currency';
import { generateWeightedLoot } from '../generators/inventory';
import { IRandomizer } from '../interfaces/IRandomizer';
import CurrencyManager from '../services/CurrencyManager.js';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type CRTier = 'cr_0_4' | 'cr_5_10' | 'cr_11_16' | 'cr_17_plus';
export type LootType = 'individual' | 'hoard';
export type RewardTier = 'minor' | 'moderate' | 'major' | 'epic';
export type SpecialLootType = 'treasure_map' | 'merchant_caravan' | 'wizard_tower' | 'ancient_ruins';

export interface CurrencyRoll {
	dice: string;
	type: string;  // Any denomination from config (e.g., 'cp', 'sp', 'gp', 'pp', 'gems') or custom types
	multiply?: number;
}

export interface LootTableEntry {
	description: string;
	currency: {
		rolls: CurrencyRoll[];
	};
	items: {
		common: number;
		uncommon: number;
		rare: number;
		veryRare: number;
		legendary: number;
	};
	itemCount: number;
	typeFilter?: string[];  // Optional filter for item types
}

export interface LootTableConfig {
	individual: Record<CRTier, LootTableEntry>;
	hoard: Record<CRTier, LootTableEntry>;
	rewards: Record<RewardTier, LootTableEntry>;
	special: Record<SpecialLootType, LootTableEntry>;
}

export interface LootResult {
	currency: ItemCost;
	items: Item[];
	description: string;
	gems?: number;  // Special case for gem rolls
}

// =============================================================================
// LOOT TABLE LOADING
// =============================================================================

let cachedLootTables: LootTableConfig | null = null;

/**
 * Set loot tables configuration (called by adapter layer)
 * Caches the configuration for use by loot generation functions
 *
 * @param tables Parsed loot table configuration from YAML
 */
export function setLootTables(tables: LootTableConfig): void {
	cachedLootTables = tables;
}

/**
 * Get cached loot tables or defaults
 * Tables should be set by adapter layer via setLootTables()
 *
 * @returns Cached loot table configuration or defaults if not set
 */
export function getLootTables(): LootTableConfig {
	if (cachedLootTables) {
		return cachedLootTables;
	}

	// Return defaults if tables haven't been loaded yet
	console.warn('Loot tables not loaded, using defaults');
	return getDefaultLootTables();
}

/**
 * Get default loot tables as fallback
 * Basic configuration if YAML file is missing or corrupted
 */
function getDefaultLootTables(): LootTableConfig {
	return {
		individual: {
			cr_0_4: {
				description: 'Weak creatures',
				currency: { rolls: [{ dice: '5d6', type: 'cp' }] },
				items: { common: 5, uncommon: 0, rare: 0, veryRare: 0, legendary: 0 },
				itemCount: 1
			},
			cr_5_10: {
				description: 'Moderate creatures',
				currency: { rolls: [{ dice: '4d6', type: 'sp' }, { dice: '1d6', type: 'gp' }] },
				items: { common: 15, uncommon: 5, rare: 0, veryRare: 0, legendary: 0 },
				itemCount: 2
			},
			cr_11_16: {
				description: 'Strong creatures',
				currency: { rolls: [{ dice: '2d6', type: 'gp' }, { dice: '3d6', type: 'gp' }] },
				items: { common: 20, uncommon: 15, rare: 5, veryRare: 0, legendary: 0 },
				itemCount: 3
			},
			cr_17_plus: {
				description: 'Epic creatures',
				currency: { rolls: [{ dice: '2d6', type: 'pp' }, { dice: '8d6', type: 'gp' }] },
				items: { common: 25, uncommon: 20, rare: 15, veryRare: 10, legendary: 5 },
				itemCount: 5
			}
		},
		hoard: {
			cr_0_4: {
				description: 'Small hoard',
				currency: {
					rolls: [
						{ dice: '6d6', type: 'cp', multiply: 100 },
						{ dice: '3d6', type: 'sp', multiply: 10 },
						{ dice: '2d6', type: 'gp' }
					]
				},
				items: { common: 30, uncommon: 10, rare: 0, veryRare: 0, legendary: 0 },
				itemCount: 6
			},
			cr_5_10: {
				description: 'Moderate hoard',
				currency: {
					rolls: [
						{ dice: '2d6', type: 'sp', multiply: 100 },
						{ dice: '6d6', type: 'gp', multiply: 10 },
						{ dice: '3d6', type: 'pp' }
					]
				},
				items: { common: 40, uncommon: 25, rare: 10, veryRare: 2, legendary: 0 },
				itemCount: 10
			},
			cr_11_16: {
				description: 'Large hoard',
				currency: {
					rolls: [
						{ dice: '12d6', type: 'gp', multiply: 100 },
						{ dice: '8d6', type: 'pp', multiply: 10 }
					]
				},
				items: { common: 50, uncommon: 40, rare: 25, veryRare: 10, legendary: 2 },
				itemCount: 15
			},
			cr_17_plus: {
				description: 'Epic hoard',
				currency: {
					rolls: [
						{ dice: '24d6', type: 'gp', multiply: 1000 },
						{ dice: '12d6', type: 'pp', multiply: 100 }
					]
				},
				items: { common: 60, uncommon: 50, rare: 40, veryRare: 25, legendary: 10 },
				itemCount: 20
			}
		},
		rewards: {
			minor: {
				description: 'Small quest reward',
				currency: { rolls: [{ dice: '3d6', type: 'gp', multiply: 10 }] },
				items: { common: 30, uncommon: 10, rare: 0, veryRare: 0, legendary: 0 },
				itemCount: 3
			},
			moderate: {
				description: 'Moderate quest reward',
				currency: { rolls: [{ dice: '5d6', type: 'gp', multiply: 10 }, { dice: '1d6', type: 'pp' }] },
				items: { common: 40, uncommon: 25, rare: 5, veryRare: 0, legendary: 0 },
				itemCount: 6
			},
			major: {
				description: 'Major quest reward',
				currency: {
					rolls: [
						{ dice: '10d6', type: 'gp', multiply: 10 },
						{ dice: '3d6', type: 'pp', multiply: 10 }
					]
				},
				items: { common: 50, uncommon: 35, rare: 15, veryRare: 5, legendary: 0 },
				itemCount: 10
			},
			epic: {
				description: 'Epic quest reward',
				currency: {
					rolls: [
						{ dice: '20d6', type: 'gp', multiply: 100 },
						{ dice: '10d6', type: 'pp', multiply: 10 }
					]
				},
				items: { common: 60, uncommon: 50, rare: 30, veryRare: 15, legendary: 5 },
				itemCount: 15
			}
		},
		special: {
			treasure_map: {
				description: 'Buried treasure from a map',
				currency: {
					rolls: [
						{ dice: '10d6', type: 'gp', multiply: 100 },
						{ dice: '5d6', type: 'pp', multiply: 10 },
						{ dice: '1d100', type: 'gems' }
					]
				},
				items: { common: 40, uncommon: 30, rare: 15, veryRare: 5, legendary: 1 },
				itemCount: 12
			},
			merchant_caravan: {
				description: 'Raided merchant caravan',
				currency: {
					rolls: [
						{ dice: '8d6', type: 'gp', multiply: 10 },
						{ dice: '2d6', type: 'pp' }
					]
				},
				items: { common: 60, uncommon: 15, rare: 3, veryRare: 0, legendary: 0 },
				itemCount: 15
			},
			wizard_tower: {
				description: "Wizard's stash",
				currency: {
					rolls: [
						{ dice: '5d6', type: 'gp', multiply: 10 },
						{ dice: '3d6', type: 'pp' }
					]
				},
				items: { common: 30, uncommon: 40, rare: 20, veryRare: 10, legendary: 2 },
				itemCount: 12,
				typeFilter: ['scroll', 'potion', 'wondrous']
			},
			ancient_ruins: {
				description: 'Ancient ruins loot',
				currency: {
					rolls: [
						{ dice: '6d6', type: 'gp', multiply: 100 },
						{ dice: '4d6', type: 'pp', multiply: 10 }
					]
				},
				items: { common: 35, uncommon: 30, rare: 20, veryRare: 12, legendary: 3 },
				itemCount: 14
			}
		}
	};
}

// =============================================================================
// DICE ROLLING UTILITIES
// =============================================================================

/**
 * Parse and roll dice notation (e.g., "2d6", "3d10", "1d20")
 *
 * @param randomizer Randomizer implementation for dice rolls
 * @param diceStr Dice notation string
 * @returns Total result of all dice rolled
 */
export function rollDice(randomizer: IRandomizer, diceStr: string): number {
	// If randomizer has rollDice method, use it
	if (randomizer.rollDice) {
		const result = randomizer.rollDice(diceStr);
		return result.total;
	}

	// Otherwise parse dice notation manually: XdY where X = number of dice, Y = dice size
	const match = diceStr.match(/(\d+)d(\d+)/i);

	if (!match) {
		console.error(`Invalid dice notation: ${diceStr}`);
		return 0;
	}

	const numDice = parseInt(match[1]);
	const diceSize = parseInt(match[2]);

	let total = 0;
	for (let i = 0; i < numDice; i++) {
		total += randomizer.randomInt(1, diceSize);
	}

	return total;
}

/**
 * Process currency rolls and generate total currency
 * Handles dice notation, multipliers, and multiple currency types
 * Uses currency configuration to support different currency systems
 *
 * @param randomizer Randomizer implementation for dice rolls
 * @param rolls Array of currency roll configurations
 * @param config Currency configuration for proper denomination conversion and validation
 * @param baseUnitMultiplier Multiplier to convert dice results to base currency units (default: 1)
 * @returns ItemCost with all currency combined, and optional gems count
 *
 * @description
 * Processes each currency roll in sequence, handling dice notation and multipliers.
 * The currency configuration is used to validate denomination types and initialize
 * proper currency objects for the active currency system. This allows the loot
 * generation system to work with any configured currency system by dynamically
 * accessing properties based on denomination abbreviations.
 *
 * Special handling for 'gems' type: gem counts are stored separately and not
 * converted using the currency configuration.
 *
 * @example
 * // Generate currency for a loot table entry with D&D 5e currency
 * const config = getDnd5eCurrencyConfig();
 * const rolls: CurrencyRoll[] = [
 *   { dice: '6d6', type: 'cp', multiply: 100 },  // 600-3600 cp
 *   { dice: '3d6', type: 'sp', multiply: 10 },   // 30-180 sp
 *   { dice: '2d6', type: 'gp' }                  // 2-12 gp
 * ];
 * const result = generateCurrencyLoot(randomizer, rolls, config);
 * // Rolls are combined into a single ItemCost with proper denomination distribution
 * // based on the active currency system in config
 */
export function generateCurrencyLoot(
	randomizer: IRandomizer,
	rolls: CurrencyRoll[],
	config: CurrencyConfig,
	baseUnitMultiplier: number = 1
): { currency: ItemCost; gems?: number } {
	// Use CurrencyManager to get valid denominations and create properly zeroed costs
	const manager = new CurrencyManager(config);
	let totalCurrency: ItemCost = manager.createZeroedCost();
	let gems: number | undefined;

	// Get valid denomination abbreviations for validation
	const validDenoms = manager.getDenominationKeys();

	for (const roll of rolls) {
		const amount = rollDice(randomizer, roll.dice);
		const multiplier = roll.multiply || 1;
		const total = amount * multiplier;

		if (roll.type === 'gems') {
			// Special case: gems are stored separately, not as a currency denomination
			gems = total;
		} else {
			// Validate that the type is a valid denomination in the config
			if (validDenoms.includes(roll.type)) {
				// Create temporary currency object for this roll using manager
				const rollCurrency: ItemCost = manager.createZeroedCost();

				// Dynamically assign the roll amount to the appropriate denomination
				rollCurrency[roll.type as keyof ItemCost] = total;

				// Add to total (addCurrency now requires config parameter)
				totalCurrency = addCurrency(totalCurrency, rollCurrency, config);
			} else {
				// Log warning if invalid denomination is encountered
				console.warn(
					`[generateCurrencyLoot] Invalid currency type in loot roll: "${roll.type}". ` +
					`Valid denominations are: ${validDenoms.join(', ')}`
				);
			}
		}
	}

	return { currency: totalCurrency, gems };
}

// =============================================================================
// LOOT GENERATION
// =============================================================================

/**
 * Generate random loot based on CR tier and loot type
 * Uses weighted probability for item rarity selection and currency configuration
 * for proper currency denomination conversion
 *
 * @param randomizer Randomizer implementation for all random generation
 * @param crTier Challenge rating tier (0-4, 5-10, 11-16, 17+)
 * @param lootType Individual (single creature) or hoard (treasure cache)
 * @param allItems Complete pool of items to choose from
 * @param config Currency configuration for converting dice rolls to proper denominations
 * @returns Complete loot result with currency and items
 *
 * @description
 * The currency configuration is used to ensure loot currency results are properly
 * distributed across denominations in the active currency system. This allows
 * the same loot generation to work with different currency systems by adjusting
 * how dice rolls are converted to currency values.
 *
 * @example
 * // Generate loot for a CR 5-10 creature with D&D 5e currency
 * const config = getDnd5eCurrencyConfig();
 * const result = generateLoot(randomizer, 'cr_5_10', 'hoard', allItems, config);
 * // Returns: { currency: {cp: 0, sp: 0, gp: 850, pp: 2}, items: [...], description: "..." }
 */
export function generateLoot(
	randomizer: IRandomizer,
	crTier: CRTier,
	lootType: LootType,
	allItems: Item[],
	config: CurrencyConfig
): LootResult {
	const lootTables = getLootTables();
	const tableEntry = lootTables[lootType][crTier];

	// Generate currency with config (baseUnitMultiplier 100 for D&D 5e currency denominations)
	const { currency, gems } = generateCurrencyLoot(randomizer, tableEntry.currency.rolls, config, 100);

	// Generate items using weighted loot generation
	const items = generateItemLoot(randomizer, tableEntry, allItems);

	return {
		currency,
		items,
		description: tableEntry.description,
		gems
	};
}

/**
 * Generate quest reward loot
 * Similar to regular loot but with balanced tier progression
 * Uses currency configuration for proper denomination conversion
 *
 * @param randomizer Randomizer implementation for all random generation
 * @param rewardTier Minor, moderate, major, or epic
 * @param allItems Complete pool of items
 * @param config Currency configuration for converting dice rolls to proper denominations
 * @returns Loot result appropriate for quest completion
 *
 * @description
 * The currency configuration ensures reward gold is properly distributed
 * across denominations in the active currency system.
 *
 * @example
 * // Generate a minor quest reward with D&D 5e currency
 * const config = getDnd5eCurrencyConfig();
 * const result = generateRewardLoot(randomizer, 'minor', allItems, config);
 * // Returns: { currency: {...}, items: [...], description: "Small quest reward" }
 */
export function generateRewardLoot(
	randomizer: IRandomizer,
	rewardTier: RewardTier,
	allItems: Item[],
	config: CurrencyConfig
): LootResult {
	const lootTables = getLootTables();
	const tableEntry = lootTables.rewards[rewardTier];

	// Generate currency with config (baseUnitMultiplier 100 for D&D 5e currency denominations)
	const { currency, gems } = generateCurrencyLoot(randomizer, tableEntry.currency.rolls, config, 100);
	const items = generateItemLoot(randomizer, tableEntry, allItems);

	return {
		currency,
		items,
		description: tableEntry.description,
		gems
	};
}

/**
 * Generate special themed loot
 * For unique situations like treasure maps or wizard towers
 * Uses currency configuration for proper denomination conversion
 *
 * @param randomizer Randomizer implementation for all random generation
 * @param specialType Type of special loot (treasure_map, merchant_caravan, wizard_tower, ancient_ruins)
 * @param allItems Complete pool of items
 * @param config Currency configuration for converting dice rolls to proper denominations
 * @returns Themed loot result with currency and items
 *
 * @description
 * The currency configuration ensures special loot currency is properly distributed
 * across denominations in the active currency system. Type filtering is applied
 * before item generation to match the special loot theme.
 *
 * @example
 * // Generate treasure map loot with D&D 5e currency
 * const config = getDnd5eCurrencyConfig();
 * const result = generateSpecialLoot(randomizer, 'treasure_map', allItems, config);
 * // Returns: { currency: {...}, items: [...], description: "Buried treasure from a map", gems: 50 }
 *
 * @example
 * // Generate wizard tower loot (filtered to scrolls and potions)
 * const result = generateSpecialLoot(randomizer, 'wizard_tower', allItems, config);
 * // Returns: { currency: {...}, items: [potions, scrolls, wondrous items], description: "..." }
 */
export function generateSpecialLoot(
	randomizer: IRandomizer,
	specialType: SpecialLootType,
	allItems: Item[],
	config: CurrencyConfig
): LootResult {
	const lootTables = getLootTables();
	const tableEntry = lootTables.special[specialType];

	// Generate currency with config (baseUnitMultiplier 100 for D&D 5e currency denominations)
	const { currency, gems } = generateCurrencyLoot(randomizer, tableEntry.currency.rolls, config, 100);

	// Apply type filter if specified
	let filteredItems = allItems;
	if (tableEntry.typeFilter && tableEntry.typeFilter.length > 0) {
		filteredItems = allItems.filter(item =>
			tableEntry.typeFilter!.some(type => item.type.toLowerCase().includes(type.toLowerCase()))
		);
	}

	const items = generateItemLoot(randomizer, tableEntry, filteredItems);

	return {
		currency,
		items,
		description: tableEntry.description,
		gems
	};
}

/**
 * Generate items based on loot table entry
 * Uses weighted random selection based on rarity weights
 *
 * @param randomizer Randomizer implementation for random selection
 * @param tableEntry Loot table configuration
 * @param allItems Available item pool
 * @returns Array of randomly selected items
 */
function generateItemLoot(randomizer: IRandomizer, tableEntry: LootTableEntry, allItems: Item[]): Item[] {
	if (allItems.length === 0) {
		return [];
	}

	// Use existing weighted loot generation from inventoryGenerator
	const rarityWeights = {
		common: tableEntry.items.common,
		uncommon: tableEntry.items.uncommon,
		rare: tableEntry.items.rare,
		veryRare: tableEntry.items.veryRare,
		legendary: tableEntry.items.legendary
	};

	return generateWeightedLoot(randomizer, allItems, rarityWeights, tableEntry.itemCount);
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get display name for CR tier
 */
export function getCRTierName(crTier: CRTier): string {
	const names: Record<CRTier, string> = {
		'cr_0_4': 'CR 0-4 (Weak)',
		'cr_5_10': 'CR 5-10 (Moderate)',
		'cr_11_16': 'CR 11-16 (Strong)',
		'cr_17_plus': 'CR 17+ (Epic)'
	};
	return names[crTier];
}

/**
 * Get display name for reward tier
 */
export function getRewardTierName(tier: RewardTier): string {
	const names: Record<RewardTier, string> = {
		'minor': 'Minor Quest',
		'moderate': 'Moderate Quest',
		'major': 'Major Quest',
		'epic': 'Epic Quest'
	};
	return names[tier];
}

/**
 * Get display name for special loot type
 */
export function getSpecialLootName(type: SpecialLootType): string {
	const names: Record<SpecialLootType, string> = {
		'treasure_map': 'Treasure Map',
		'merchant_caravan': 'Merchant Caravan',
		'wizard_tower': 'Wizard Tower',
		'ancient_ruins': 'Ancient Ruins'
	};
	return names[type];
}

/**
 * Clear cached loot tables (useful for testing or config reload)
 */
export function clearLootTableCache(): void {
	cachedLootTables = null;
}
