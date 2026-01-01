
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getRestockConfig,
  calculateRetentionChance,
  restockShopInventory,
  formatRestockStats,
  RestockStats
} from '../calculators/restock';
import { Shop, ShopItem, Item } from '../models/types';
import { IRandomizer, RollResult } from '../interfaces/IRandomizer';
import * as InventoryGenerators from '../generators/inventory';

// Mock IRandomizer
const mockRandomizer: IRandomizer = {
  randomInt: vi.fn((min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min),
  randomFloat: vi.fn(() => Math.random()),
  rollDice: vi.fn((notation: string): RollResult => {
    const match = notation.match(/(\d+)d(\d+)/i);
    if (!match) return { total: 0, breakdown: '' };
    const numDice = parseInt(match[1]);
    const dieSize = parseInt(match[2]);
    const total = numDice * Math.floor(dieSize / 2); // Simplified mock roll
    return { total, breakdown: `${notation} = ${total}` };
  }),
  randomChoice: vi.fn(items => items[0]),
  weightedChoice: vi.fn((items, weights) => items[0]),
  rollPercentile: vi.fn(() => 50),
  chance: vi.fn(() => true),
};

// Mock InventoryGenerators
vi.mock('../generators/inventory', () => ({
  createShopItem: vi.fn((randomizer: IRandomizer, item: Item) => ({
    name: item.name,
    description: item.description,
    cost: item.cost,
    costOverride: null,
    rarity: item.rarity,
    type: item.type,
    category: item.category,
    source: item.source,
    link: item.link,
    id: item.id,
    stock: randomizer.randomInt(1, 10), // Mocked stock
    isNew: true,
    isSold: false,
    isRestocked: false,
    originalStock: 0,
    priceHistory: [],
    transactionHistory: [],
  })),
  rerollItem: vi.fn((randomizer: IRandomizer, oldItem: ShopItem, allItems: Item[]) => {
    // Return a different item from allItems, or the first one if only one exists
    const availableItems = allItems.filter(item => item.id !== oldItem.id);
    return availableItems.length > 0 ? availableItems[0] : allItems[0];
  }),
}));

const mockItemCommon: Item = {
  name: 'Common Potion',
  description: '',
  cost: { cp: 0, sp: 0, gp: 10, pp: 0 },
  rarity: 'Common',
  type: 'Potion',
  category: 'Consumable',
  source: 'PHB',
  link: '',
  id: 'common-potion',
};

const mockItemUncommon: Item = {
  name: 'Uncommon Scroll',
  description: '',
  cost: { cp: 0, sp: 0, gp: 50, pp: 0 },
  rarity: 'Uncommon',
  type: 'Scroll',
  category: 'Consumable',
  source: 'PHB',
  link: '',
  id: 'uncommon-scroll',
};

const mockItemRare: Item = {
  name: 'Rare Sword',
  description: '',
  cost: { cp: 0, sp: 0, gp: 500, pp: 0 },
  rarity: 'Rare',
  type: 'Weapon',
  category: 'Weapon',
  source: 'DMG',
  link: '',
  id: 'rare-sword',
};

const mockItemVeryRare: Item = {
  name: 'Very Rare Armor',
  description: '',
  cost: { cp: 0, sp: 0, gp: 5000, pp: 0 },
  rarity: 'Very-Rare',
  type: 'Armor',
  category: 'Armor',
  source: 'DMG',
  link: '',
  id: 'very-rare-armor',
};

const mockItemLegendary: Item = {
  name: 'Legendary Shield',
  description: '',
  cost: { cp: 0, sp: 0, gp: 50000, pp: 0 },
  rarity: 'Legendary',
  type: 'Shield',
  category: 'Armor',
  source: 'DMG',
  link: '',
  id: 'legendary-shield',
};

const allMockItems: Item[] = [
  mockItemCommon, mockItemUncommon, mockItemRare, mockItemVeryRare, mockItemLegendary
];

describe('Restock Utilities', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset randomInt mock for getOriginalStockQuantity
    (mockRandomizer.randomInt as vi.Mock).mockImplementation((min: number, max: number) => {
      if (min === 10 && max === 20) return 15; // For common/uncommon
      if (min === 1 && max === 5) return 3; // For rare consumables
      return 1; // Default for others
    });
  });

  describe('getRestockConfig', () => {
    it('should return correct config for poor wealth level', () => {
      const config = getRestockConfig('poor');
      expect(config.retentionChance).toBe(75);
    });

    it('should return correct config for aristocratic wealth level', () => {
      const config = getRestockConfig('aristocratic');
      expect(config.retentionChance).toBe(25);
    });

    it('should return comfortable config for unknown wealth level', () => {
      const config = getRestockConfig('unknown' as any);
      expect(config.retentionChance).toBe(50);
    });
  });

  describe('calculateRetentionChance', () => {
    it('should return correct retention chance for wealthy and rare', () => {
      const chance = calculateRetentionChance('wealthy', 'Rare');
      expect(chance).toBe(0.35);
    });

    it('should return correct retention chance for poor and legendary', () => {
      const chance = calculateRetentionChance('poor', 'Legendary');
      expect(chance).toBe(0.75);
    });
  });

  describe('restockShopInventory', () => {
    it('should refill common/uncommon items to original stock', () => {
      const shop: Shop = {
        name: 'Test Shop',
        wealthLevel: 'modest',
        inventory: [
          { ...mockItemCommon, stock: 2, originalStock: 15 },
          { ...mockItemUncommon, stock: 0, originalStock: 15 },
        ],
        currency: { cp: 0, sp: 0, gp: 0, pp: 0 },
        id: 'test-shop',
        lastRestock: '',
        markup: 0,
        markdown: 0,
        shopkeeper: 'Bob',
        transactions: [],
      };

      const { shop: restockedShop, stats } = restockShopInventory(mockRandomizer, shop, allMockItems);

      expect(restockedShop.inventory[0].name).toBe('Common Potion');
      expect(restockedShop.inventory[0].stock).toBe(15); // Refilled to original stock
      expect(restockedShop.inventory[1].name).toBe('Uncommon Scroll');
      expect(restockedShop.inventory[1].stock).toBe(15); // Refilled to original stock
      expect(stats.commonRefilled).toBe(1);
      expect(stats.uncommonRefilled).toBe(1);
      expect(stats.rareKept).toBe(0);
      expect(stats.rareReplaced).toBe(0);
      expect(stats.totalItems).toBe(2);
    });

    it('should retain rare+ items with stock based on chance', () => {
      const shop: Shop = {
        name: 'Test Shop',
        wealthLevel: 'comfortable',
        inventory: [
          { ...mockItemRare, stock: 1, originalStock: 1 },
        ],
        currency: { cp: 0, sp: 0, gp: 0, pp: 0 },
        id: 'test-shop',
        lastRestock: '',
        markup: 0,
        markdown: 0,
        shopkeeper: 'Bob',
        transactions: [],
      };

      // Mock randomFloat to ensure retention
      (mockRandomizer.randomFloat as vi.Mock).mockReturnValue(0.4); // 0.4 < 0.5 (comfortable retention chance)

      const { shop: restockedShop, stats } = restockShopInventory(mockRandomizer, shop, allMockItems);

      expect(restockedShop.inventory[0].name).toBe('Rare Sword');
      expect(restockedShop.inventory[0].stock).toBe(1); // Rare item stock is 1
      expect(stats.rareKept).toBe(1);
      expect(stats.rareReplaced).toBe(0);
    });

    it('should replace rare+ items with stock if not retained', () => {
      const shop: Shop = {
        name: 'Test Shop',
        wealthLevel: 'comfortable',
        inventory: [
          { ...mockItemRare, stock: 1, originalStock: 1 },
        ],
        currency: { cp: 0, sp: 0, gp: 0, pp: 0 },
        id: 'test-shop',
        lastRestock: '',
        markup: 0,
        markdown: 0,
        shopkeeper: 'Bob',
        transactions: [],
      };

      // Mock randomFloat to ensure replacement
      (mockRandomizer.randomFloat as vi.Mock).mockReturnValue(0.6); // 0.6 > 0.5 (comfortable retention chance)

      const { shop: restockedShop, stats } = restockShopInventory(mockRandomizer, shop, allMockItems);

      expect(restockedShop.inventory[0].name).not.toBe('Rare Sword');
      expect(stats.rareKept).toBe(0);
      expect(stats.rareReplaced).toBe(1);
    });

    it('should replace rare+ items with 0 stock', () => {
      const shop: Shop = {
        name: 'Test Shop',
        wealthLevel: 'comfortable',
        inventory: [
          { ...mockItemRare, stock: 0, originalStock: 1 },
        ],
        currency: { cp: 0, sp: 0, gp: 0, pp: 0 },
        id: 'test-shop',
        lastRestock: '',
        markup: 0,
        markdown: 0,
        shopkeeper: 'Bob',
        transactions: [],
      };

      const { shop: restockedShop, stats } = restockShopInventory(mockRandomizer, shop, allMockItems);

      expect(restockedShop.inventory[0].name).not.toBe('Rare Sword');
      expect(stats.rareKept).toBe(0);
      expect(stats.rareReplaced).toBe(1);
    });

    it('should preserve costOverride when replacing an item', () => {
      const shop: Shop = {
        name: 'Test Shop',
        wealthLevel: 'comfortable',
        inventory: [
          { ...mockItemRare, stock: 0, originalStock: 1, costOverride: '1000 gp' },
        ],
        currency: { cp: 0, sp: 0, gp: 0, pp: 0 },
        id: 'test-shop',
        lastRestock: '',
        markup: 0,
        markdown: 0,
        shopkeeper: 'Bob',
        transactions: [],
      };

      const { shop: restockedShop } = restockShopInventory(mockRandomizer, shop, allMockItems);

      expect(restockedShop.inventory[0].costOverride).toBe('1000 gp');
    });

    it('should preserve costOverride when retaining an item', () => {
      const shop: Shop = {
        name: 'Test Shop',
        wealthLevel: 'comfortable',
        inventory: [
          { ...mockItemRare, stock: 1, originalStock: 1, costOverride: '1000 gp' },
        ],
        currency: { cp: 0, sp: 0, gp: 0, pp: 0 },
        id: 'test-shop',
        lastRestock: '',
        markup: 0,
        markdown: 0,
        shopkeeper: 'Bob',
        transactions: [],
      };

      (mockRandomizer.randomFloat as vi.Mock).mockReturnValue(0.4); // Ensure retention

      const { shop: restockedShop } = restockShopInventory(mockRandomizer, shop, allMockItems);

      expect(restockedShop.inventory[0].costOverride).toBe('1000 gp');
    });
  });

  describe('formatRestockStats', () => {
    it('should format all stats correctly', () => {
      const stats: RestockStats = {
        commonRefilled: 2,
        uncommonRefilled: 1,
        rareKept: 1,
        rareReplaced: 1,
        totalItems: 5,
      };
      const formatted = formatRestockStats(stats);
      expect(formatted).toBe('Restocked 5 items: 2 common items refilled, 1 uncommon items refilled, 1 rare+ items kept, 1 rare+ items replaced');
    });

    it('should format with only common items refilled', () => {
      const stats: RestockStats = {
        commonRefilled: 3,
        uncommonRefilled: 0,
        rareKept: 0,
        rareReplaced: 0,
        totalItems: 3,
      };
      const formatted = formatRestockStats(stats);
      expect(formatted).toBe('Restocked 3 items: 3 common items refilled');
    });

    it('should format with no items changed', () => {
      const stats: RestockStats = {
        commonRefilled: 0,
        uncommonRefilled: 0,
        rareKept: 0,
        rareReplaced: 0,
        totalItems: 0,
      };
      const formatted = formatRestockStats(stats);
      expect(formatted).toBe('Restocked 0 items: ');
    });
  });
});
