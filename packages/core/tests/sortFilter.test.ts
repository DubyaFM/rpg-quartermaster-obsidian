
import { describe, it, expect } from 'vitest';
import {
  sortInventoryByPrice,
  sortInventoryByRarity,
  sortInventoryByType,
  sortInventoryByCategory,
  sortInventoryByName,
  filterInventoryBySearch,
  applyMultiSort,
  getRarityBreakdown,
  getTypeBreakdown,
  calculateInventoryValue,
  SortDirection,
  SortCriteria
} from '../utils/sortFilter';
import { ShopItem } from '../models/types';

// Mock ShopItem data for testing
const mockShopItems: ShopItem[] = [
  {
    name: 'Potion of Healing',
    description: 'Heals 2d4+2 hit points.',
    cost: { cp: 0, sp: 0, gp: 50, pp: 0 },
    costOverride: null,
    rarity: 'Common',
    type: 'Consumable',
    category: 'Potions',
    source: 'PHB',
    link: 'some-link',
    id: 'healing-potion',
    stock: 5,
    isNew: false,
    isSold: false,
    isRestocked: false,
    originalStock: 5,
    priceHistory: [],
    transactionHistory: [],
  },
  {
    name: 'Sword of Wounding',
    description: 'A magical sword.',
    cost: { cp: 0, sp: 0, gp: 500, pp: 0 },
    costOverride: null,
    rarity: 'Rare',
    type: 'Weapon',
    category: 'Weapons',
    source: 'DMG',
    link: 'some-link',
    id: 'sword-wounding',
    stock: 1,
    isNew: false,
    isSold: false,
    isRestocked: false,
    originalStock: 1,
    priceHistory: [],
    transactionHistory: [],
  },
  {
    name: 'Shield +1',
    description: 'A magical shield.',
    cost: { cp: 0, sp: 0, gp: 200, pp: 0 },
    costOverride: null,
    rarity: 'Uncommon',
    type: 'Armor',
    category: 'Armor',
    source: 'DMG',
    link: 'some-link',
    id: 'shield-plus1',
    stock: 2,
    isNew: false,
    isSold: false,
    isRestocked: false,
    originalStock: 2,
    priceHistory: [],
    transactionHistory: [],
  },
  {
    name: 'Scroll of Fireball',
    description: 'A scroll containing the Fireball spell.',
    cost: { cp: 0, sp: 0, gp: 300, pp: 0 },
    costOverride: null,
    rarity: 'Uncommon',
    type: 'Scroll',
    category: 'Scrolls',
    source: 'PHB',
    link: 'some-link',
    id: 'scroll-fireball',
    stock: 3,
    isNew: false,
    isSold: false,
    isRestocked: false,
    originalStock: 3,
    priceHistory: [],
    transactionHistory: [],
  },
  {
    name: 'Ring of Protection',
    description: 'A magical ring.',
    cost: { cp: 0, sp: 0, gp: 800, pp: 0 },
    costOverride: null,
    rarity: 'Rare',
    type: 'Ring',
    category: 'Attunement Items',
    source: 'DMG',
    link: 'some-link',
    id: 'ring-protection',
    stock: 1,
    isNew: false,
    isSold: false,
    isRestocked: false,
    originalStock: 1,
    priceHistory: [],
    transactionHistory: [],
  },
  {
    name: 'Basic Item',
    description: 'A very basic item.',
    cost: { cp: 0, sp: 1, gp: 0, pp: 0 },
    costOverride: null,
    rarity: 'None',
    type: 'Misc',
    category: 'General',
    source: 'Custom',
    link: 'some-link',
    id: 'basic-item',
    stock: 10,
    isNew: false,
    isSold: false,
    isRestocked: false,
    originalStock: 10,
    priceHistory: [],
    transactionHistory: [],
  },
];

describe('sortFilter', () => {
  describe('sortInventoryByPrice', () => {
    it('should sort items by price in ascending order', () => {
      const sorted = sortInventoryByPrice(mockShopItems, 'asc');
      expect(sorted[0].name).toBe('Basic Item'); // 1 sp
      expect(sorted[1].name).toBe('Potion of Healing'); // 50 gp
      expect(sorted[2].name).toBe('Shield +1'); // 200 gp
    });

    it('should sort items by price in descending order', () => {
      const sorted = sortInventoryByPrice(mockShopItems, 'desc');
      expect(sorted[0].name).toBe('Ring of Protection'); // 800 gp
      expect(sorted[1].name).toBe('Sword of Wounding'); // 500 gp
      expect(sorted[2].name).toBe('Scroll of Fireball'); // 300 gp
    });
  });

  describe('sortInventoryByRarity', () => {
    it('should sort items by rarity in ascending order', () => {
      const sorted = sortInventoryByRarity(mockShopItems, 'asc');
      expect(sorted[0].name).toBe('Basic Item'); // None
      expect(sorted[1].name).toBe('Potion of Healing'); // Common
      expect(sorted[2].name).toBe('Scroll of Fireball'); // Uncommon (alphabetical secondary sort)
      expect(sorted[3].name).toBe('Shield +1'); // Uncommon (alphabetical secondary sort)
    });

    it('should sort items by rarity in descending order', () => {
      const sorted = sortInventoryByRarity(mockShopItems, 'desc');
      expect(sorted[0].name).toBe('Ring of Protection'); // Rare
      expect(sorted[1].name).toBe('Sword of Wounding'); // Rare
      expect(sorted[2].name).toBe('Scroll of Fireball'); // Uncommon
    });
  });

  describe('sortInventoryByType', () => {
    it('should sort items by type in ascending order', () => {
      const sorted = sortInventoryByType(mockShopItems, 'asc');
      expect(sorted[0].name).toBe('Shield +1'); // Armor
      expect(sorted[1].name).toBe('Potion of Healing'); // Consumable
    });

    it('should sort items by type in descending order', () => {
      const sorted = sortInventoryByType(mockShopItems, 'desc');
      expect(sorted[0].name).toBe('Sword of Wounding'); // Weapon
      expect(sorted[1].name).toBe('Scroll of Fireball'); // Scroll
    });
  });

  describe('sortInventoryByCategory', () => {
    it('should sort items by category in ascending order', () => {
      const sorted = sortInventoryByCategory(mockShopItems, 'asc');
      expect(sorted[0].name).toBe('Shield +1'); // Armor
      expect(sorted[1].name).toBe('Ring of Protection'); // Attunement Items
    });

    it('should sort items by category in descending order', () => {
      const sorted = sortInventoryByCategory(mockShopItems, 'desc');
      expect(sorted[0].name).toBe('Sword of Wounding'); // Weapons
      expect(sorted[1].name).toBe('Scroll of Fireball'); // Scrolls
    });
  });

  describe('sortInventoryByName', () => {
    it('should sort items by name in ascending order', () => {
      const sorted = sortInventoryByName(mockShopItems, 'asc');
      expect(sorted[0].name).toBe('Basic Item');
      expect(sorted[1].name).toBe('Potion of Healing');
    });

    it('should sort items by name in descending order', () => {
      const sorted = sortInventoryByName(mockShopItems, 'desc');
      expect(sorted[0].name).toBe('Sword of Wounding');
      expect(sorted[1].name).toBe('Shield +1');
    });
  });

  describe('filterInventoryBySearch', () => {
    it('should filter items by name', () => {
      const filtered = filterInventoryBySearch(mockShopItems, 'potion');
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('Potion of Healing');
    });

    it('should filter items by description', () => {
      const filtered = filterInventoryBySearch(mockShopItems, 'magical sword');
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('Sword of Wounding');
    });

    it('should filter items by type', () => {
      const filtered = filterInventoryBySearch(mockShopItems, 'weapon');
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('Sword of Wounding');
    });

    it('should filter items by rarity', () => {
      const filtered = filterInventoryBySearch(mockShopItems, 'rare');
      expect(filtered.length).toBe(2);
      expect(filtered.some(item => item.name === 'Sword of Wounding')).toBe(true);
      expect(filtered.some(item => item.name === 'Ring of Protection')).toBe(true);
    });

    it('should filter items by category', () => {
      const filtered = filterInventoryBySearch(mockShopItems, 'potions');
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('Potion of Healing');
    });

    it('should return all items if query is empty', () => {
      const filtered = filterInventoryBySearch(mockShopItems, '');
      expect(filtered.length).toBe(mockShopItems.length);
    });

    it('should be case-insensitive', () => {
      const filtered = filterInventoryBySearch(mockShopItems, 'PoTiOn');
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('Potion of Healing');
    });

    it('should filter by source', () => {
      const filtered = filterInventoryBySearch(mockShopItems, 'phb');
      expect(filtered.length).toBe(2);
      expect(filtered.some(item => item.name === 'Potion of Healing')).toBe(true);
      expect(filtered.some(item => item.name === 'Scroll of Fireball')).toBe(true);
    });
  });

  describe('applyMultiSort', () => {
    it('should apply search and then sort by price ascending', () => {
      const sortOptions = { criteria: 'price' as SortCriteria, direction: 'asc' as SortDirection };
      const processed = applyMultiSort(mockShopItems, sortOptions, 'scroll');
      expect(processed.length).toBe(1);
      expect(processed[0].name).toBe('Scroll of Fireball');
    });

    it('should apply search and then sort by rarity descending', () => {
      const sortOptions = { criteria: 'rarity' as SortCriteria, direction: 'desc' as SortDirection };
      const processed = applyMultiSort(mockShopItems, sortOptions, 'magical');
      expect(processed.length).toBe(3);
      expect(processed[0].name).toBe('Ring of Protection'); // Rare
      expect(processed[1].name).toBe('Sword of Wounding'); // Rare
      expect(processed[2].name).toBe('Shield +1'); // Uncommon
    });

    it('should sort by category then name by default if criteria is unknown', () => {
      const sortOptions = { criteria: 'unknown' as SortCriteria, direction: 'asc' as SortDirection };
      const processed = applyMultiSort(mockShopItems, sortOptions);
      expect(processed[0].name).toBe('Shield +1'); // Armor
      expect(processed[1].name).toBe('Ring of Protection'); // Attunement Items
    });
  });

  describe('getRarityBreakdown', () => {
    it('should return a map of rarity counts', () => {
      const breakdown = getRarityBreakdown(mockShopItems);
      expect(breakdown.get('common')).toBe(1);
      expect(breakdown.get('rare')).toBe(2);
      expect(breakdown.get('uncommon')).toBe(2);
      expect(breakdown.get('none')).toBe(1);
      expect(breakdown.get('legendary')).toBeUndefined();
    });
  });

  describe('getTypeBreakdown', () => {
    it('should return a map of type counts', () => {
      const breakdown = getTypeBreakdown(mockShopItems);
      expect(breakdown.get('Consumable')).toBe(1);
      expect(breakdown.get('Weapon')).toBe(1);
      expect(breakdown.get('Armor')).toBe(1);
      expect(breakdown.get('Scroll')).toBe(1);
      expect(breakdown.get('Ring')).toBe(1);
      expect(breakdown.get('Misc')).toBe(1);
    });
  });

  describe('calculateInventoryValue', () => {
    it('should calculate the total value of the inventory in copper', () => {
      // Potion: 50 gp = 5000 cp, stock 5 = 25000 cp
      // Sword: 500 gp = 50000 cp, stock 1 = 50000 cp
      // Shield: 200 gp = 20000 cp, stock 2 = 40000 cp
      // Scroll: 300 gp = 30000 cp, stock 3 = 90000 cp
      // Ring: 800 gp = 80000 cp, stock 1 = 80000 cp
      // Basic Item: 1 sp = 10 cp, stock 10 = 100 cp
      // Total = 25000 + 50000 + 40000 + 90000 + 80000 + 100 = 285100 cp
      const totalValue = calculateInventoryValue(mockShopItems);
      expect(totalValue).toBe(285100);
    });

    it('should handle items with costOverride', () => {
      const itemsWithOverride: ShopItem[] = [
        {
          name: 'Override Item',
          description: '',
          cost: { cp: 0, sp: 0, gp: 100, pp: 0 },
          costOverride: { cp: 0, sp: 0, gp: 1, pp: 0 },
          rarity: 'Common',
          type: 'Misc',
          category: 'General',
          source: 'Custom',
          link: 'some-link',
          id: 'override-item',
          stock: 1,
          isNew: false,
          isSold: false,
          isRestocked: false,
          originalStock: 1,
          priceHistory: [],
          transactionHistory: [],
        },
      ];
      const totalValue = calculateInventoryValue(itemsWithOverride);
      expect(totalValue).toBe(100); // 1 gp = 100 cp
    });

    it('should return 0 for an empty inventory', () => {
      const totalValue = calculateInventoryValue([]);
      expect(totalValue).toBe(0);
    });
  });
});
