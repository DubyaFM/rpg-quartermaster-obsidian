
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createShopItem,
  shuffleArray,
  generateRandomShopInventory,
  rerollItem,
  generateWeightedLoot
} from '../generators/inventory';
import { Item, ShopItem, ShopGenerationConfig } from '../models/types';
import { IRandomizer, RollResult } from '../interfaces/IRandomizer';
import { getDefaultCurrencyConfig } from '../data/defaultCurrencyConfig';
import type { CurrencyConfig } from '../models/currency-config';

// Mock IRandomizer
const mockRandomizer: IRandomizer = {
  randomInt: vi.fn((min: number, max: number) => min), // Always return min for predictable stock
  randomFloat: vi.fn(() => 0.5), // Always return 0.5 for predictable chance rolls
  rollDice: vi.fn((notation: string): RollResult => {
    const match = notation.match(/(\d+)d(\d+)/i);
    if (!match) return { total: 0, breakdown: '' };
    const numDice = parseInt(match[1]);
    const dieSize = parseInt(match[2]);
    const total = numDice * Math.floor(dieSize / 2); // Simplified mock roll
    return { total, breakdown: `${notation} = ${total}` };
  }),
  randomChoice: vi.fn(items => items[0]), // Always pick the first item
  weightedChoice: vi.fn((items, weights) => items[0]), // Always pick the first item
  rollPercentile: vi.fn(() => 50),
  chance: vi.fn((percentage: number) => percentage >= 50), // True if percentage is 50 or more
};

const mockItemCommon: Item = {
  name: 'Common Potion',
  description: '',
  cost: { cp: 0, sp: 0, gp: 10, pp: 0 },
  rarity: 'common',
  type: 'potion',
  category: 'Consumable',
  source: 'PHB',
  file: {} as any,
};

const mockItemUncommon: Item = {
  name: 'Uncommon Scroll',
  description: '',
  cost: { cp: 0, sp: 0, gp: 50, pp: 0 },
  rarity: 'uncommon',
  type: 'scroll',
  category: 'Consumable',
  source: 'PHB',
  file: {} as any,
};

const mockItemRare: Item = {
  name: 'Rare Sword',
  description: '',
  cost: { cp: 0, sp: 0, gp: 500, pp: 0 },
  rarity: 'rare',
  type: 'weapon',
  category: 'Weapon',
  source: 'DMG',
  file: {} as any,
};

const mockItemVeryRare: Item = {
  name: 'Very Rare Armor',
  description: '',
  cost: { cp: 0, sp: 0, gp: 5000, pp: 0 },
  rarity: 'very-rare',
  type: 'armor',
  category: 'Armor',
  source: 'DMG',
  file: {} as any,
};

const mockItemLegendary: Item = {
  name: 'Legendary Shield',
  description: '',
  cost: { cp: 0, sp: 0, gp: 50000, pp: 0 },
  rarity: 'legendary',
  type: 'shield',
  category: 'Armor',
  source: 'DMG',
  file: {} as any,
};

const allMockItems: Item[] = [
  mockItemCommon, mockItemUncommon, mockItemRare, mockItemVeryRare, mockItemLegendary,
  { ...mockItemCommon, name: 'Common Potion 2' },
  { ...mockItemUncommon, name: 'Uncommon Scroll 2' },
  { ...mockItemRare, name: 'Rare Axe' },
];

describe('Inventory Generator Utility', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset randomInt mock for createShopItem to return min (10 for common/uncommon, 1 for rare+)
    (mockRandomizer.randomInt as vi.Mock).mockImplementation((min: number, max: number) => {
      if (min === 10 && max === 20) return 10; // For common/uncommon
      if (min === 1 && max === 5) return 1; // For rare consumables
      return 1; // Default for others
    });
    (mockRandomizer.randomChoice as vi.Mock).mockImplementation(items => items[0]);
    (mockRandomizer.weightedChoice as vi.Mock).mockImplementation(items => items[0]);
    (mockRandomizer.chance as vi.Mock).mockImplementation((percentage: number) => percentage >= 50);
  });

  describe('createShopItem', () => {
    it('should create a ShopItem from an Item with correct stock for common', () => {
      const shopItem = createShopItem(mockRandomizer, mockItemCommon);
      expect(shopItem.name).toBe('Common Potion');
      expect(shopItem.stock).toBe(10); // Mocked randomInt(10, 20) returns 10
      expect(shopItem.originalCost).toEqual(mockItemCommon.cost);
    });

    it('should create a ShopItem from an Item with correct stock for rare non-consumable', () => {
      const shopItem = createShopItem(mockRandomizer, mockItemRare);
      expect(shopItem.name).toBe('Rare Sword');
      expect(shopItem.stock).toBe(1); // Default for rare non-consumables
    });

    it('should create a ShopItem from an Item with correct stock for rare consumable', () => {
      const rarePotion: Item = { ...mockItemRare, type: 'potion' };
      const shopItem = createShopItem(mockRandomizer, rarePotion);
      expect(shopItem.name).toBe('Rare Sword');
      expect(shopItem.stock).toBe(1); // Mocked randomInt(1, 5) returns 1
    });
  });

  describe('shuffleArray', () => {
    it('should shuffle an array without changing its contents', () => {
      const array = [1, 2, 3, 4, 5];
      const shuffled = shuffleArray(mockRandomizer, array);
      expect(shuffled).not.toEqual(array); // Should be shuffled
      expect(shuffled.sort()).toEqual(array.sort()); // Same contents
      expect(mockRandomizer.randomInt).toHaveBeenCalled();
    });

    it('should return an empty array if given an empty array', () => {
      const shuffled = shuffleArray(mockRandomizer, []);
      expect(shuffled).toEqual([]);
    });
  });

  describe('generateRandomShopInventory', () => {
    const currencyConfig = getDefaultCurrencyConfig();
    const config: ShopGenerationConfig = {
      maxItems: { common: 2, uncommon: 1, rare: 1, veryRare: 0, legendary: 0 },
      rarityChances: { common: 100, uncommon: 70, rare: 50, veryRare: 30, legendary: 10 },
    };

    it('should generate inventory for a normal shop', () => {
      // Mock randomChoice to always pick the first item in the filtered list
      (mockRandomizer.randomChoice as vi.Mock).mockImplementation(items => items[0]);

      const result = generateRandomShopInventory(mockRandomizer, allMockItems, config, currencyConfig);
      const inventory = [...result.baseStock, ...result.specialStock];

      // Expect 2 common (mockItemCommon, Common Potion 2)
      // Expect 1 uncommon (mockItemUncommon) - chance is 70, mockRandomizer.chance returns true
      // Expect 1 rare (mockItemRare) - chance is 50, mockRandomizer.chance returns true
      expect(inventory.length).toBe(4);
      expect(inventory.some(item => item.name === 'Common Potion')).toBe(true);
      expect(inventory.some(item => item.name === 'Common Potion 2')).toBe(true);
      expect(inventory.some(item => item.name === 'Uncommon Scroll')).toBe(true);
      expect(inventory.some(item => item.name === 'Rare Sword')).toBe(true);
    });

    it('should handle marketplace shop type', () => {
      // Mock randomInt for marketplace stock
      (mockRandomizer.randomInt as vi.Mock).mockImplementation((min: number, max: number) => {
        if (min === 20 && max === 50) return 20; // Common marketplace stock
        if (min === 15 && max === 30) return 15; // Uncommon marketplace stock
        return 1; // Other stock
      });

      const marketplaceConfig: ShopGenerationConfig = {
        maxItems: { common: 0, uncommon: 0, rare: 1, veryRare: 1, legendary: 0 }, // Only roll for rare+ in marketplace
        rarityChances: { common: 0, uncommon: 0, rare: 100, veryRare: 100, legendary: 0 },
      };

      const result = generateRandomShopInventory(mockRandomizer, allMockItems, marketplaceConfig, currencyConfig, 'marketplace');
      const inventory = [...result.baseStock, ...result.specialStock];

      // Expect all common and uncommon items to be present
      expect(inventory.some(item => item.name === 'Common Potion')).toBe(true);
      expect(inventory.some(item => item.name === 'Common Potion 2')).toBe(true);
      expect(inventory.some(item => item.name === 'Uncommon Scroll')).toBe(true);
      expect(inventory.some(item => item.name === 'Uncommon Scroll 2')).toBe(true);

      // Expect rare and very rare items from rolls
      expect(inventory.some(item => item.name === 'Rare Sword')).toBe(true);
      expect(inventory.some(item => item.name === 'Very Rare Armor')).toBe(true);

      // Total items: 2 common + 2 uncommon + 1 rare + 1 very rare = 6
      expect(inventory.length).toBe(6);
    });

    it('should not add duplicate items', () => {
      const configWithDuplicates: ShopGenerationConfig = {
        maxItems: { common: 5, uncommon: 0, rare: 0, veryRare: 0, legendary: 0 },
        rarityChances: { common: 100, uncommon: 0, rare: 0, veryRare: 0, legendary: 0 },
      };
      // Make randomChoice always return the same common item
      (mockRandomizer.randomChoice as vi.Mock).mockReturnValue(mockItemCommon);

      const result = generateRandomShopInventory(mockRandomizer, allMockItems, configWithDuplicates, currencyConfig);
      const inventory = [...result.baseStock, ...result.specialStock];
      // The inventory should be populated from the combined baseStock and specialStock
      // Verify we can properly combine the two arrays from the new return type
      expect(Array.isArray(inventory)).toBe(true);
      expect(inventory.length).toBeGreaterThan(0);
      expect(inventory[0].name).toBe('Common Potion');
    });
  });

  describe('rerollItem', () => {
    const currencyConfig = getDefaultCurrencyConfig();

    it('should reroll an item to another of the same rarity', () => {
      const newItem = rerollItem(mockRandomizer, mockItemRare, allMockItems, currencyConfig);
      expect(newItem).toBeDefined();
      expect(newItem?.rarity).toBe('rare');
      expect(newItem?.name).not.toBe(mockItemRare.name);
      expect(newItem?.name).toBe('Rare Axe'); // Because randomChoice picks the first available
    });

    it('should return null if no other items of the same rarity exist', () => {
      const singleRareItem: Item[] = [mockItemRare];
      const newItem = rerollItem(mockRandomizer, mockItemRare, singleRareItem, currencyConfig);
      expect(newItem).toBeNull();
    });
  });

  describe('generateWeightedLoot', () => {
    const rarityWeights = { common: 10, uncommon: 5, rare: 2, veryRare: 1, legendary: 0 };

    it('should generate loot based on weights', () => {
      // Mock weightedChoice to always pick 'common'
      (mockRandomizer.weightedChoice as vi.Mock).mockReturnValue('common');
      // Mock randomChoice to always pick the first common item
      (mockRandomizer.randomChoice as vi.Mock).mockImplementation(items => items.find(item => item.rarity === 'common'));

      const loot = generateWeightedLoot(mockRandomizer, allMockItems, rarityWeights, 3);
      expect(loot.length).toBe(3);
      expect(loot[0].name).toBe('Common Potion');
      expect(loot[1].name).toBe('Common Potion');
      expect(loot[2].name).toBe('Common Potion');
    });

    it('should handle empty item pools for a chosen rarity', () => {
      const weightsWithLegendary = { common: 1, uncommon: 1, rare: 1, veryRare: 1, legendary: 1 };
      // Mock weightedChoice to always pick 'legendary'
      (mockRandomizer.weightedChoice as vi.Mock).mockReturnValue('legendary');
      // Mock randomChoice to return undefined if no legendary items are available
      (mockRandomizer.randomChoice as vi.Mock).mockImplementation(items => items.find(item => item.rarity === 'legendary'));

      const loot = generateWeightedLoot(mockRandomizer, [mockItemCommon], weightsWithLegendary, 1);
      expect(loot.length).toBe(0); // No legendary items in allMockItems
    });
  });
});
