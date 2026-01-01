// Inventory Generator Utility
// Random inventory/loot table generator for D&D shops and treasure hoards
// Can be reused for any system that needs weighted random item distribution

import { Item, ShopItem, ShopGenerationConfig, ItemCost, FundsOnHandDice } from '../models/types';
import { BaseStockItem } from '../interfaces/IConfigAdapter';
import { IRandomizer } from '../interfaces/IRandomizer';
import type { CurrencyConfig } from '../models/currency-config.js';
import { expandVariantItems, resolveVariant } from '../services/variantResolver';
import { evaluateDiceGold } from '../calculators/dice';
import { isMagicItem } from '../calculators/magicItemPricing';
import { SRD_ITEMS, SRDItemData } from '../data/srdItems';
import { parseCostString } from '../calculators/currency';
import { DEFAULT_CURRENCY_CONFIG } from '../data/defaultCurrencyConfig';
import { getItemIdentifier } from '../utils/itemIdentifiers';

/**
 * Determine stock quantity based on item rarity and type
 * @param randomizer Randomizer for stock quantity rolls
 * @param item Item to determine stock for
 */
function determineStockQuantity(randomizer: IRandomizer, item: Item): number {
	const rarity = item.rarity.toLowerCase();
	const isConsumable = item.type === 'potion' || item.type === 'scroll';

	// Common and uncommon items: 10-20 stock
	if (rarity === 'common' || rarity === 'none' || rarity === 'uncommon') {
		return randomizer.randomInt(10, 20);
	}

	// Rare consumables: 1-5 stock
	if (rarity === 'rare' && isConsumable) {
		return randomizer.randomInt(1, 5);
	}

	// All other magic items (rare, very-rare, legendary non-consumables): 1 stock
	return 1;
}

/**
 * Create a shop item from a regular item
 * @param randomizer Randomizer for stock quantity determination
 * @param item Item to convert to shop item
 * @param allItems Optional: all items for variant resolution
 * @param config Currency configuration for variant pricing calculations
 */
export function createShopItem(randomizer: IRandomizer, item: Item, allItems?: Item[], config?: CurrencyConfig): ShopItem {
	const shopItem: ShopItem = {
		...item,
		originalCost: { ...item.cost },
		stock: determineStockQuantity(randomizer, item)
	};

	// If this IS a variant parent (not an expanded variant), resolve all variants and attach them
	if (item.isVariant && item.variantAliases && item.variantAliases.length > 1 && allItems && config) {
		// This is the parent - resolve all variants
		const variants: Item[] = [];
		for (const alias of item.variantAliases) {
			const resolved = resolveVariant(item, alias, allItems, config);
			if (resolved) {
				variants.push(resolved);
			}
		}

		// Attach variants to shop item
		if (variants.length > 0) {
			shopItem.availableVariants = variants;
			shopItem.selectedVariantIndex = 0; // Default to first variant

			// Update shop item to use first variant's details for display
			shopItem.name = variants[0].name;
			shopItem.cost = variants[0].cost;
			shopItem.baseItemName = variants[0].baseItemName;
		}
	}

	return shopItem;
}

/**
 * Shuffle an array (Fisher-Yates algorithm)
 * @param randomizer Randomizer for shuffling
 * @param array Array to shuffle
 */
export function shuffleArray<T>(randomizer: IRandomizer, array: T[]): T[] {
	const shuffled = [...array];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = randomizer.randomInt(0, i);
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
}

/**
 * Generate shop's starting funds amount by rolling dice
 * This limits how much the shop can buy from players
 * Converts dice roll result to proper currency denominations using the provided config
 *
 * @param randomizer Randomizer implementation for dice rolls
 * @param goldDiceConfig Dice configuration (e.g., 5d10+20 gp)
 * @param config Currency configuration for converting to proper denominations
 * @returns ItemCost object with rolled funds amount distributed across denominations
 *
 * @description
 * The function rolls the specified dice, adds any bonus, and converts the result
 * into the appropriate currency denominations using the provided config.
 * For D&D 5e shops with "funds on hand" denominations (e.g., "5d10 gp"),
 * baseUnitMultiplier of 100 is used since 1 gp = 100 cp.
 *
 * @example
 * // Roll 5d10+20 gp for a modest blacksmith
 * const config = getDnd5eCurrencyConfig();
 * const funds = generateShopFunds(randomizer, {count: 5, sides: 10, bonus: 20, currency: 'gp'}, config);
 * // If roll is 47 (5d10 = 27, +20 = 47):
 * // 47 gp * 100 (cp multiplier) = 4700 cp
 * // Returns: {cp: 0, sp: 0, gp: 47, pp: 0}
 */
export function generateShopFunds(randomizer: IRandomizer, goldDiceConfig: FundsOnHandDice, config: CurrencyConfig): ItemCost {
	// For D&D 5e shops, funds dice (e.g., "10d10 gp") need multiplier of 100 (1 gp = 100 cp)
	return evaluateDiceGold(randomizer, goldDiceConfig, config, 100);
}

/**
 * Normalize rarity string to canonical form
 * Handles variations: "very-rare", "veryrare", "very rare" -> "very rare"
 * @param rarity Raw rarity string from item data
 * @returns Normalized rarity string
 */
export function normalizeRarity(rarity: string): string {
	if (!rarity) return '';
	const normalized = rarity.toLowerCase().trim();

	// Map all variations to canonical forms
	if (normalized === 'very-rare' || normalized === 'veryrare' || normalized === 'very rare') {
		return 'very rare';
	}

	return normalized;
}

/**
 * Check if a basic (non-magic) item type should be included in shop
 * @param itemType Type of the item (e.g., "weapon", "armor")
 * @param typeChances Config with type->percentage mappings
 * @param randomizer Randomizer for percentage rolls
 * @returns true if item type should be included
 */
export function shouldIncludeBasicItemType(
	itemType: string,
	typeChances: Record<string, number>,
	randomizer: IRandomizer,
	enableLogging = false
): boolean {
	const normalizedType = itemType.toLowerCase();
	const chance = typeChances[normalizedType];

	// If type not in config, don't include
	if (chance === undefined) {
		if (enableLogging) {
			console.log(`[Inventory] Filtering out item type '${normalizedType}' - not in allowed types [${Object.keys(typeChances).join(', ')}]`);
		}
		return false;
	}

	// 100% = always include, otherwise roll
	if (chance >= 100) {
		return true;
	}

	const included = randomizer.chance(chance);
	if (enableLogging && !included) {
		console.log(`[Inventory] Item type '${normalizedType}' failed ${chance}% chance roll`);
	}
	return included;
}

/**
 * Roll for number of magic items using weighted table
 * @param weights Weighted count distribution (e.g., {"0": 70, "1": 20, "2": 10})
 * @param randomizer Randomizer for weighted roll
 * @returns Number of magic items to generate
 */
export function rollMagicItemCount(
	weights: Record<string, number>,
	randomizer: IRandomizer
): number {
	const entries = Object.entries(weights).map(([count, weight]) => ({
		count: parseInt(count),
		weight
	}));

	const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0);
	if (totalWeight === 0) return 0;

	let roll = randomizer.randomFloat() * totalWeight;

	for (const entry of entries) {
		roll -= entry.weight;
		if (roll <= 0) {
			return entry.count;
		}
	}

	// Fallback to last entry
	return entries[entries.length - 1].count;
}

/**
 * Roll for a magic item rarity using hierarchical chances
 * Rolls from highest to lowest rarity (legendary -> common)
 * @param chances Rarity percentage chances (e.g., {common: 50, uncommon: 30, rare: 15})
 * @param randomizer Randomizer for percentage rolls
 * @returns Rarity string or null if no rarity rolled
 */
export function rollMagicItemRarity(
	chances: Record<string, number>,
	randomizer: IRandomizer
): string | null {
	// Roll from highest to lowest rarity
	const rarities = ['legendary', 'veryRare', 'rare', 'uncommon', 'common'];

	for (const rarity of rarities) {
		const chance = chances[rarity] || 0;
		if (chance > 0 && randomizer.chance(chance)) {
			return rarity;
		}
	}

	return null;
}

/**
 * Helper: Check if an item should spawn based on itemTypeChances config
 * LEGACY SUPPORT - for old config format with itemTypeChances
 * @param randomizer Randomizer for rolling chance
 * @param item Item to check
 * @param config Shop generation config (may have itemTypeChances)
 * @returns true if item passes type/rarity filter, false otherwise
 */
function passesTypeRarityFilter(randomizer: IRandomizer, item: Item, config: ShopGenerationConfig): boolean {
	// If no itemTypeChances specified, all items pass
	if (!config.itemTypeChances) {
		return true;
	}

	// Get the type chances for this item's type
	const itemType = item.type.toLowerCase();
	const typeChances = config.itemTypeChances[itemType];

	// If this item type isn't in the filter, it doesn't spawn
	if (!typeChances) {
		return false;
	}

	// Get the chance for this item's rarity
	const itemRarity = item.rarity.toLowerCase();
	let rarityChance: number | undefined;

	if (itemRarity === 'common' || itemRarity === 'none') {
		rarityChance = typeChances.common;
	} else if (itemRarity === 'uncommon') {
		rarityChance = typeChances.uncommon;
	} else if (itemRarity === 'rare') {
		rarityChance = typeChances.rare;
	} else if (itemRarity === 'very-rare' || itemRarity === 'veryrare') {
		rarityChance = typeChances.veryRare;
	} else if (itemRarity === 'legendary') {
		rarityChance = typeChances.legendary;
	}

	// If no chance specified for this rarity, item doesn't spawn
	if (rarityChance === undefined) {
		return false;
	}

	// Roll against the chance
	return randomizer.chance(rarityChance);
}

/**
 * Convert SRD item data to full Item object
 * Used for base stock fallback when items aren't in vault
 *
 * @param srdItem SRD item data to convert
 * @returns Full Item object with SRD source
 */
function convertSRDItemToItem(srdItem: SRDItemData): Item {
	return {
		name: srdItem.name,
		cost: parseCostString(srdItem.cost, DEFAULT_CURRENCY_CONFIG) || { cp: 0, sp: 0, gp: 0, pp: 0 },
		type: srdItem.type,
		rarity: srdItem.rarity,
		description: srdItem.description,
		source: 'SRD',
		file: {
			path: `srd:${srdItem.name.toLowerCase().replace(/\s+/g, '-')}`,
			name: srdItem.name,
			basename: srdItem.name
		},
		category: srdItem.type
	};
}

/**
 * Process base stock items and add them to inventory
 * Base stock items are guaranteed items from baseStockConfig.yaml
 *
 * Items are sourced ONLY from SRD database for guaranteed reliability.
 * This ensures base stock is always available regardless of user's vault contents.
 *
 * @param randomizer Randomizer for stock quantity rolls
 * @param baseStockItems Array of base stock item definitions
 * @param inventory Current inventory array to add items to
 * @param usedItemIds Set of already used item IDs to prevent duplicates
 * @param currencyConfig Currency configuration for variant pricing calculations
 */
function addBaseStockItems(
	randomizer: IRandomizer,
	baseStockItems: BaseStockItem[],
	inventory: ShopItem[],
	usedItemIds: Set<string>,
	currencyConfig: CurrencyConfig
): void {
	if (!baseStockItems || baseStockItems.length === 0) {
		return;
	}

	console.log(`[Inventory] Processing ${baseStockItems.length} base stock items (SRD-only)`);

	for (const baseStock of baseStockItems) {
		// Roll spawn chance (typically 100%)
		if (!randomizer.chance(baseStock.spawnChance)) {
			continue;
		}

		// Find item in SRD database only
		const srdItem = SRD_ITEMS.find(s => s.name.toLowerCase() === baseStock.item.toLowerCase());

		if (!srdItem) {
			console.warn(`[Inventory] Base stock item "${baseStock.item}" not found in SRD database`);
			continue;
		}

		// Convert SRD item to Item object
		const item = convertSRDItemToItem(srdItem);

		// Skip if already used (check file path)
		const itemId = getItemIdentifier(item);
		if (usedItemIds.has(itemId)) {
			continue;
		}

		// Create shop item with custom stock range
		const shopItem = createShopItem(randomizer, item, undefined, currencyConfig);
		shopItem.stock = randomizer.randomInt(baseStock.minStock, baseStock.maxStock);

		inventory.push(shopItem);
		usedItemIds.add(itemId);
	}

	console.log(`[Inventory] Base stock items added: ${inventory.length} total items (SRD-only)`);
}

/**
 * Generate random shop inventory based on configuration
 * NEW SYSTEM: Separates basic (non-magic) items from magic items
 * Flow: Add base stock -> Add basic items -> Roll magic item count -> Roll rarities -> Select specific items -> Add guaranteed items
 *
 * @param randomizer Randomizer implementation for generating random values
 * @param allItems Complete pool of items to choose from
 * @param config Shop generation configuration
 * @param currencyConfig Currency configuration for variant pricing calculations
 * @param shopType Shop type (optional, for special marketplace handling)
 * @param baseStockItems Optional base stock items (guaranteed items from baseStockConfig.yaml)
 * @returns Object with baseStock and specialStock arrays (no duplicates within each)
 */
export function generateRandomShopInventory(
	randomizer: IRandomizer,
	allItems: Item[],
	config: ShopGenerationConfig,
	currencyConfig: CurrencyConfig,
	shopType?: string,
	baseStockItems?: BaseStockItem[]
): { baseStock: ShopItem[], specialStock: ShopItem[] } {
	const baseStock: ShopItem[] = [];
	const specialStock: ShopItem[] = [];
	const usedItemIds = new Set<string>();

	// Separate variant parents from regular items
	// Variant parents will stay as parents for magic item selection (allows dropdown UI)
	const variantParents = allItems.filter(item => item.isVariant && item.variantAliases && item.variantAliases.length > 0);
	const nonVariantItems = allItems.filter(item => !(item.isVariant && item.variantAliases && item.variantAliases.length > 0));

	// Expand any nested variants in non-variant items only
	const expandedNonVariants = expandVariantItems(nonVariantItems, currencyConfig);

	// Combine for use in inventory generation
	const expandedItems = [...expandedNonVariants, ...variantParents];

	// STEP 0: Add base stock items (guaranteed items from baseStockConfig.yaml)
	// These are SRD-only items added before any random generation
	if (baseStockItems && baseStockItems.length > 0) {
		addBaseStockItems(randomizer, baseStockItems, baseStock, usedItemIds, currencyConfig);
	}

	// Check if using new config format (basicItemTypes + magicItemCountWeights)
	const isNewFormat = config.basicItemTypes && config.magicItemCountWeights;

	if (isNewFormat) {
		// ===== NEW FORMAT: MAGIC ITEM SYSTEM (Phase 6) =====
		// This is the primary generation system for shops
		// Flow: Base stock -> Basic items -> Roll magic count -> Roll rarities -> Select items -> Guaranteed items

		console.log(`[Inventory] New format detected. Expanded items: ${expandedItems.length}`);
		console.log(`[Inventory] Config basicItemTypes:`, config.basicItemTypes);
		console.log(`[Inventory] Config magicItemCountWeights:`, config.magicItemCountWeights);

		// Count item types before filtering
		const nonMagicItems = expandedItems.filter(item => !isMagicItem(item));
		const itemTypeCount: Record<string, number> = {};
		nonMagicItems.forEach(item => {
			itemTypeCount[item.type] = (itemTypeCount[item.type] || 0) + 1;
		});
		console.log(`[Inventory] Non-magic items by type:`, itemTypeCount);

		// STEP 1: Filter and add basic (non-magic) items based on basicItemTypes
		// All non-magic items of relevant types are included (with percentage chance per type)
		const basicItems = expandedItems.filter(item =>
			!isMagicItem(item) && shouldIncludeBasicItemType(item.type, config.basicItemTypes ?? {}, randomizer, true)
		);

		console.log(`[Inventory] Basic items after filtering: ${basicItems.length}`);

		for (const item of basicItems) {
			const itemId = getItemIdentifier(item);
		if (!usedItemIds.has(itemId)) {
				specialStock.push(createShopItem(randomizer, item, allItems, currencyConfig));
				usedItemIds.add(itemId);
			}
		}

		// STEP 2: Roll magic item count using weighted table
		// e.g., {"0": 70, "1": 20, "2": 10} means 70% no magic, 20% one item, 10% two items
		const magicItemCount = rollMagicItemCount(config.magicItemCountWeights ?? {}, randomizer);

		if (magicItemCount > 0) {
			// STEP 3: Get effective magic chances (pre-calculated by ConfigLoader)
			// These are party-level-based chances modified by wealth and shop modifiers
			const magicChances = (config as any).effectiveMagicItemChances || {
				common: 0,
				uncommon: 0,
				rare: 0,
				veryRare: 0,
				legendary: 0
			};

			// STEP 4: Roll rarity for each magic item (highest to lowest)
			// For each magic item slot, roll once from legendary down to common
			const magicItemRarities: string[] = [];
			for (let i = 0; i < magicItemCount; i++) {
				const rarity = rollMagicItemRarity(magicChances, randomizer);
				if (rarity) magicItemRarities.push(rarity);
			}

			// STEP 5: Select specific items for each rarity
			// Map camelCase rarity keys to actual item rarity values
			const rarityMap: Record<string, string> = {
				common: 'common',
				uncommon: 'uncommon',
				rare: 'rare',
				veryRare: 'very rare',  // Note: normalized to "very rare"
				legendary: 'legendary'
			};

			for (const rarityKey of magicItemRarities) {
				const targetRarity = rarityMap[rarityKey] || rarityKey;

				// Find all magic items of this rarity that haven't been used
				const magicItems = expandedItems.filter(item =>
					isMagicItem(item) &&
					normalizeRarity(item.rarity) === normalizeRarity(targetRarity) &&
					!usedItemIds.has(getItemIdentifier(item))
				);

				if (magicItems.length > 0) {
					const selected = randomizer.randomChoice(magicItems);
					specialStock.push(createShopItem(randomizer, selected, allItems, currencyConfig));
					usedItemIds.add(getItemIdentifier(selected));
				}
			}
		}

		// STEP 6: Add guaranteed items from template (specificItems)
		// These are template-defined items with spawn chances and custom stock ranges
		if (config.specificItems && config.specificItems.length > 0) {
			for (const specificItem of config.specificItems) {
				// Roll spawn chance
				if (randomizer.chance(specificItem.spawnChance)) {
					// Find the item by name (case-insensitive)
					const item = allItems.find(i => i.name.toLowerCase() === specificItem.itemName.toLowerCase());
					if (item) {
						const itemId = getItemIdentifier(item);
						if (!usedItemIds.has(itemId)) {
							const shopItem = createShopItem(randomizer, item, allItems, currencyConfig);
							// Override stock with custom range
							shopItem.stock = randomizer.randomInt(specificItem.stockRange.min, specificItem.stockRange.max);
							specialStock.push(shopItem);
							usedItemIds.add(itemId);
						}
					} else {
						console.warn(`Specific item "${specificItem.itemName}" not found in vault`);
					}
				}
			}
		}

		console.log(`[Inventory] Final special stock count: ${specialStock.length}`);
	} else {
		// ===== LEGACY FORMAT: maxItems + rarityChances + itemTypeChances =====
		// Keep old implementation for backward compatibility with existing configs

		// STEP 1: Add specific guaranteed items from template (if any)
		if (config.specificItems && config.specificItems.length > 0) {
			for (const specificItem of config.specificItems) {
				// Roll spawn chance
				if (randomizer.chance(specificItem.spawnChance)) {
					// Find the item by name
					const item = allItems.find(i => i.name.toLowerCase() === specificItem.itemName.toLowerCase());
					if (item) {
						const shopItem = createShopItem(randomizer, item, allItems, currencyConfig);
						// Override stock with custom range
						shopItem.stock = randomizer.randomInt(specificItem.stockRange.min, specificItem.stockRange.max);
						specialStock.push(shopItem);
					} else {
						console.warn(`Specific item "${specificItem.itemName}" not found in vault`);
					}
				}
			}
		}

		// Group items by rarity tier
		const rarityGroups = {
			common: expandedItems.filter(item => item.rarity === 'common' || item.rarity === 'none'),
			uncommon: expandedItems.filter(item => item.rarity === 'uncommon'),
			rare: expandedItems.filter(item => item.rarity === 'rare'),
			'very-rare': expandedItems.filter(item => item.rarity === 'very-rare'),
			legendary: expandedItems.filter(item => item.rarity === 'legendary')
		};

		// Special handling for marketplace: include ALL common and uncommon items
		const isMarketplace = shopType === 'marketplace';

		if (isMarketplace) {
			// Add ALL common items with higher stock quantities
			rarityGroups.common.forEach(item => {
				if (passesTypeRarityFilter(randomizer, item, config)) {
					const shopItem = createShopItem(randomizer, item, allItems, currencyConfig);
					shopItem.stock = randomizer.randomInt(20, 50);
					specialStock.push(shopItem);
				}
			});

			// Add ALL uncommon items with higher stock quantities
			rarityGroups.uncommon.forEach(item => {
				if (passesTypeRarityFilter(randomizer, item, config)) {
					const shopItem = createShopItem(randomizer, item, allItems, currencyConfig);
					shopItem.stock = randomizer.randomInt(15, 30);
					specialStock.push(shopItem);
				}
			});

			// For rare and higher, use normal probabilistic generation
			const higherRarities: string[] = ['rare', 'veryRare', 'legendary'];
			const rarityMapping: Record<string, keyof typeof rarityGroups> = {
				rare: 'rare',
				veryRare: 'very-rare',
				legendary: 'legendary'
			};

			for (const rarity of higherRarities) {
				const maxForRarity = (config.maxItems as Record<string, number> ?? {})[rarity] ?? 0;
				const chanceForRarity = (config.rarityChances as Record<string, number> ?? {})[rarity] ?? 0;
				let itemPool = rarityGroups[rarityMapping[rarity]];

				if (config.itemTypeChances) {
					itemPool = itemPool.filter(item => passesTypeRarityFilter(randomizer, item, config));
				}

				if (maxForRarity > 0 && chanceForRarity > 0 && itemPool.length > 0) {
					for (let i = 0; i < maxForRarity; i++) {
						if (randomizer.chance(chanceForRarity)) {
							const randomItem = randomizer.randomChoice(itemPool);
							if (!specialStock.find(item => item.name === randomItem.name)) {
								specialStock.push(createShopItem(randomizer, randomItem, allItems, currencyConfig));
							}
						}
					}
				}
			}
		} else {
			// Normal shop generation (legacy)
			let commonPool = [...rarityGroups.common];
			if (config.itemTypeChances) {
				commonPool = commonPool.filter(item => passesTypeRarityFilter(randomizer, item, config));
			}
			const commonCount = Math.min((config.maxItems ?? {}).common ?? 0, commonPool.length);
			const shuffledCommon = shuffleArray(randomizer, commonPool);
			specialStock.push(...shuffledCommon.slice(0, commonCount).map(item => createShopItem(randomizer, item, allItems, currencyConfig)));

			// Roll for each higher rarity
			const rarities: string[] = ['uncommon', 'rare', 'veryRare', 'legendary'];
			const rarityMapping: Record<string, keyof typeof rarityGroups> = {
				uncommon: 'uncommon',
				rare: 'rare',
				veryRare: 'very-rare',
				legendary: 'legendary'
			};

			for (const rarity of rarities) {
				const maxForRarity = (config.maxItems as Record<string, number> ?? {})[rarity] ?? 0;
				const chanceForRarity = (config.rarityChances as Record<string, number> ?? {})[rarity] ?? 0;
				let itemPool = rarityGroups[rarityMapping[rarity]];

				if (config.itemTypeChances) {
					itemPool = itemPool.filter(item => passesTypeRarityFilter(randomizer, item, config));
				}

				if (maxForRarity > 0 && chanceForRarity > 0 && itemPool.length > 0) {
					for (let i = 0; i < maxForRarity; i++) {
						if (randomizer.chance(chanceForRarity)) {
							const randomItem = randomizer.randomChoice(itemPool);
							if (!specialStock.find(item => item.name === randomItem.name)) {
								specialStock.push(createShopItem(randomizer, randomItem, allItems, currencyConfig));
							}
						}
					}
				}
			}
		}
	}

	console.log(`[Inventory] Generated ${baseStock.length} base stock items, ${specialStock.length} special stock items`);
	return { baseStock, specialStock };
}

/**
 * Re-roll a specific item to get another of the same rarity
 * Useful for DMs who want to refresh shop inventory or treasure
 *
 * @param randomizer Randomizer implementation for generating random values
 * @param currentItem Item to replace
 * @param allItems Complete pool of items to choose from
 * @param config Currency configuration for variant pricing calculations
 * @returns New random item of the same rarity, or null if no alternatives available
 */
export function rerollItem(randomizer: IRandomizer, currentItem: Item, allItems: Item[], config: CurrencyConfig): Item | null {
	const rarity = currentItem.rarity;

	// Expand variant items first to include all possible variants
	const expandedItems = expandVariantItems(allItems, config);

	// Filter items by the same rarity, excluding current item
	const sameRarityItems = expandedItems.filter(item =>
		item.rarity === rarity && item.name !== currentItem.name
	);

	if (sameRarityItems.length === 0) {
		return null;
	}

	// Pick a random replacement using randomizer
	return randomizer.randomChoice(sameRarityItems);
}

/**
 * Generate weighted random loot table
 * Useful for treasure generation in dungeons or monster loot
 *
 * @param randomizer Randomizer implementation for generating random values
 * @param allItems Complete pool of items to choose from
 * @param rarityWeights Weight distribution for each rarity (higher = more likely)
 * @param itemCount How many items to generate
 * @returns Array of randomly selected items based on weights
 */
export function generateWeightedLoot(
	randomizer: IRandomizer,
	allItems: Item[],
	rarityWeights: { common: number; uncommon: number; rare: number; veryRare: number; legendary: number },
	itemCount: number
): Item[] {
	const loot: Item[] = [];

	// Group items by rarity
	const rarityGroups = {
		common: allItems.filter(item => item.rarity === 'common' || item.rarity === 'none'),
		uncommon: allItems.filter(item => item.rarity === 'uncommon'),
		rare: allItems.filter(item => item.rarity === 'rare'),
		veryRare: allItems.filter(item => item.rarity === 'very-rare'),
		legendary: allItems.filter(item => item.rarity === 'legendary')
	};

	// Create arrays for weighted choice
	const rarities: (keyof typeof rarityGroups)[] = ['common', 'uncommon', 'rare', 'veryRare', 'legendary'];
	const weights = [
		rarityWeights.common,
		rarityWeights.uncommon,
		rarityWeights.rare,
		rarityWeights.veryRare,
		rarityWeights.legendary
	];

	for (let i = 0; i < itemCount; i++) {
		// Roll for rarity based on weights using randomizer
		const selectedRarity = randomizer.weightedChoice(rarities, weights);

		// Select random item from chosen rarity using randomizer
		const pool = rarityGroups[selectedRarity];
		if (pool.length > 0) {
			const randomItem = randomizer.randomChoice(pool);
			loot.push(randomItem);
		}
	}

	return loot;
}
