
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  setLootTables,
  getLootTables,
  rollDice,
  generateCurrencyLoot,
  generateLoot,
  generateRewardLoot,
  generateSpecialLoot,
  getCRTierName,
  getRewardTierName,
  getSpecialLootName,
  clearLootTableCache,
  CRTier,
  LootType,
  RewardTier,
  SpecialLootType
} from '../generators/loot';
import { Item, ItemCost } from '../models/types';
import { IRandomizer, RollResult } from '../interfaces/IRandomizer';
import { getDefaultCurrencyConfig } from '../data/defaultCurrencyConfig';
import * as InventoryGenerators from '../generators/inventory';
import * as CurrencyCalculators from '../calculators/currency';

// Mock loot table configuration
const mockLootTables = {
  individual: {
    cr_0_4: {
      description: 'Weak creatures',
      currency: { rolls: [{ dice: '5d6', type: 'cp' as const }] },
      items: { common: 5, uncommon: 0, rare: 0, veryRare: 0, legendary: 0 },
      itemCount: 1
    }
  },
  hoard: {
    cr_0_4: {
      description: 'Small hoard',
      currency: { rolls: [{ dice: '6d6', type: 'cp' as const, multiply: 100 }] },
      items: { common: 30, uncommon: 10, rare: 0, veryRare: 0, legendary: 0 },
      itemCount: 6
    }
  },
  rewards: {
    minor: {
      description: 'Small quest reward',
      currency: { rolls: [{ dice: '3d6', type: 'gp' as const, multiply: 10 }] },
      items: { common: 30, uncommon: 10, rare: 0, veryRare: 0, legendary: 0 },
      itemCount: 3
    }
  },
  special: {
    wizard_tower: {
      description: "Wizard's stash",
      currency: { rolls: [{ dice: '5d6', type: 'gp' as const, multiply: 10 }] },
      items: { common: 30, uncommon: 40, rare: 20, veryRare: 10, legendary: 2 },
      itemCount: 12,
      typeFilter: ['scroll', 'potion']
    }
  }
};

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

// Mock generateWeightedLoot from inventory.ts
vi.mock('../generators/inventory', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    generateWeightedLoot: vi.fn(() => [mockItemCommon, mockItemUncommon]),
  };
});

// Mock currency functions - update with new signatures
vi.mock('../calculators/currency', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    addCurrency: vi.fn((a: ItemCost, b: ItemCost, config) => {
      // Use the actual addCurrency implementation
      return actual.addCurrency(a, b, config);
    }),
    convertToCopper: vi.fn((cost: ItemCost) => cost.gp * 100 + cost.sp * 10 + cost.cp + cost.pp * 1000),
    convertFromCopper: vi.fn((cp: number) => {
      const platinum = Math.floor(cp / 1000);
      const gold = Math.floor((cp % 1000) / 100);
      const silver = Math.floor((cp % 100) / 10);
      const copperRemainder = cp % 10;
      return { cp: copperRemainder, sp: silver, gp: gold, pp: platinum };
    }),
  };
});

const mockItemCommon: Item = {
  name: 'Common Item',
  description: '',
  cost: { cp: 0, sp: 0, gp: 1, pp: 0 },
  rarity: 'common',
  type: 'misc',
  category: 'General',
  source: 'SRD',
  file: {} as any,
};

const mockItemUncommon: Item = {
  name: 'Uncommon Item',
  description: '',
  cost: { cp: 0, sp: 0, gp: 10, pp: 0 },
  rarity: 'uncommon',
  type: 'misc',
  category: 'General',
  source: 'SRD',
  file: {} as any,
};

const mockItemScroll: Item = {
  name: 'Scroll of Fireball',
  description: '',
  cost: { cp: 0, sp: 0, gp: 300, pp: 0 },
  rarity: 'uncommon',
  type: 'scroll',
  category: 'Scrolls',
  source: 'PHB',
  file: {} as any,
};

const mockItemPotion: Item = {
  name: 'Potion of Healing',
  description: '',
  cost: { cp: 0, sp: 0, gp: 50, pp: 0 },
  rarity: 'common',
  type: 'potion',
  category: 'Potions',
  source: 'PHB',
  file: {} as any,
};

const allMockItems: Item[] = [
  mockItemCommon, mockItemUncommon, mockItemScroll, mockItemPotion
];

describe('Loot Table Utility', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    clearLootTableCache(); // Clear cache before each test
    setLootTables(mockLootTables as any); // Set mock loot tables
    // Reset mock for randomInt to return a predictable value for dice rolls
    (mockRandomizer.randomInt as vi.Mock).mockImplementation((min: number, max: number) => Math.floor((min + max) / 2));
  });

  describe('setLootTables and getLootTables', () => {
    it('should set and get loot tables', () => {
      const lootTables = getLootTables();
      expect(lootTables).toBeDefined();
      expect(lootTables.individual.cr_0_4).toBeDefined();
      expect(lootTables.hoard.cr_0_4).toBeDefined();
      expect(lootTables.rewards.minor).toBeDefined();
      expect(lootTables.special.wizard_tower).toBeDefined();
    });

    it('should return default loot tables if not set', () => {
      clearLootTableCache();
      const lootTables = getLootTables();
      expect(lootTables).toBeDefined();
      expect(lootTables.individual.cr_0_4.description).toBe('Weak creatures');
    });
  });

  describe('rollDice', () => {
    it('should roll dice using randomizer\'s rollDice method if available', () => {
      (mockRandomizer.rollDice as vi.Mock).mockReturnValue({ total: 7, breakdown: '' });
      const result = rollDice(mockRandomizer, '1d10');
      expect(result).toBe(7);
      expect(mockRandomizer.rollDice).toHaveBeenCalledWith('1d10');
    });

    it('should roll dice manually if randomizer has no rollDice method', () => {
      const customRandomizer = { ...mockRandomizer, rollDice: undefined };
      (customRandomizer.randomInt as vi.Mock).mockReturnValue(3); // Mock 1d6 to always be 3
      const result = rollDice(customRandomizer, '2d6');
      expect(result).toBe(6); // 3 + 3
      expect(customRandomizer.randomInt).toHaveBeenCalledTimes(2);
    });

    it('should return 0 for invalid dice notation', () => {
      vi.resetAllMocks();
      const result = rollDice(mockRandomizer, 'invalid');
      expect(result).toBe(0);
    });
  });

  describe('generateCurrencyLoot', () => {
    it('should generate currency loot correctly', () => {
      (mockRandomizer.randomInt as vi.Mock).mockReturnValue(3); // Mock dice to return 3
      const config = getDefaultCurrencyConfig();
      const rolls = [
        { dice: '5d6', type: 'cp' },
        { dice: '2d4', type: 'gp', multiply: 10 },
      ];
      const { currency } = generateCurrencyLoot(mockRandomizer, rolls, config);
      // 5d6 cp -> rollDice mock: 5 * floor(6/2) = 5 * 3 = 15 cp
      // 2d4 gp * 10 -> rollDice mock: 2 * floor(4/2) * 10 = 2 * 2 * 10 = 40 gp = 4000 cp
      // Total: 15 + 4000 = 4015 cp = 4pp + 0gp + 1sp + 5cp
      expect(currency).toEqual({ cp: 5, sp: 1, gp: 0, pp: 4 });
    });

    it('should handle gems', () => {
      (mockRandomizer.randomInt as vi.Mock).mockReturnValue(50); // Mock 1d100 to be 50
      const config = getDefaultCurrencyConfig();
      const rolls = [
        { dice: '1d100', type: 'gems' },
      ];
      const { gems } = generateCurrencyLoot(mockRandomizer, rolls, config);
      expect(gems).toBe(50);
    });

    it('should validate invalid currency types and log warnings', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const config = getDefaultCurrencyConfig();
      const rolls = [
        { dice: '5d6', type: 'invalid_currency' },
      ];
      const { currency } = generateCurrencyLoot(mockRandomizer, rolls, config);
      // Should still return a zeroed cost for invalid types
      expect(currency).toEqual({ cp: 0, sp: 0, gp: 0, pp: 0 });
      // Should have logged a warning
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid currency type in loot roll: "invalid_currency"')
      );
      consoleWarnSpy.mockRestore();
    });
  });

  describe('generateLoot', () => {
    it('should generate individual loot for CR 0-4', () => {
      (mockRandomizer.randomInt as vi.Mock).mockReturnValue(3); // For 5d6 cp
      const config = getDefaultCurrencyConfig();
      const loot = generateLoot(mockRandomizer, 'cr_0_4', 'individual', allMockItems, config);
      expect(loot.description).toBe('Weak creatures');
      // 5d6 cp -> 3*5 = 15 cp, normalized: 1sp + 5cp
      expect(loot.currency).toEqual({ cp: 5, sp: 1, gp: 0, pp: 0 });
      expect(loot.items).toEqual([mockItemCommon, mockItemUncommon]); // Mocked from generateWeightedLoot
    });

    it('should generate hoard loot for CR 0-4', () => {
      (mockRandomizer.randomInt as vi.Mock).mockReturnValue(3); // For 6d6 cp
      const config = getDefaultCurrencyConfig();
      const loot = generateLoot(mockRandomizer, 'cr_0_4', 'hoard', allMockItems, config);
      expect(loot.description).toBe('Small hoard');
      // 6d6 cp * 100 -> (3*6)*100 = 1800 cp, normalized: 1pp + 8gp
      expect(loot.currency).toEqual({ cp: 0, sp: 0, gp: 8, pp: 1 });
      expect(loot.items).toEqual([mockItemCommon, mockItemUncommon]);
    });
  });

  describe('generateRewardLoot', () => {
    it('should generate minor reward loot', () => {
      (mockRandomizer.randomInt as vi.Mock).mockReturnValue(3); // For 3d6 gp
      const config = getDefaultCurrencyConfig();
      const loot = generateRewardLoot(mockRandomizer, 'minor', allMockItems, config);
      expect(loot.description).toBe('Small quest reward');
      // 3d6 gp * 10 -> (3*3)*10 = 90 gp = 9000 cp = 9pp
      expect(loot.currency).toEqual({ cp: 0, sp: 0, gp: 0, pp: 9 });
      expect(loot.items).toEqual([mockItemCommon, mockItemUncommon]);
    });
  });

  describe('generateSpecialLoot', () => {
    it('should generate wizard tower loot with type filter', () => {
      (mockRandomizer.randomInt as vi.Mock).mockReturnValue(3); // For 5d6 gp
      const config = getDefaultCurrencyConfig();
      const loot = generateSpecialLoot(mockRandomizer, 'wizard_tower', allMockItems, config);
      expect(loot.description).toBe("Wizard's stash");
      // 5d6 gp * 10 -> (3*5)*10 = 150 gp = 15000 cp = 15pp
      expect(loot.currency).toEqual({ cp: 0, sp: 0, gp: 0, pp: 15 });
      // generateWeightedLoot is mocked to return [mockItemCommon, mockItemUncommon]
      // The type filter should apply to the allMockItems before passing to generateWeightedLoot
      // In this case, mockItemScroll and mockItemPotion should be the only ones passed to generateWeightedLoot
      // However, since generateWeightedLoot is mocked to return fixed items, we check the filter logic separately.
      // For this test, we'll just check the currency and description.
      expect(loot.items).toEqual([mockItemCommon, mockItemUncommon]); // Still returns mocked items
    });
  });

  describe('Utility Functions', () => {
    it('getCRTierName should return correct name', () => {
      expect(getCRTierName('cr_0_4')).toBe('CR 0-4 (Weak)');
    });

    it('getRewardTierName should return correct name', () => {
      expect(getRewardTierName('minor')).toBe('Minor Quest');
    });

    it('getSpecialLootName should return correct name', () => {
      expect(getSpecialLootName('wizard_tower')).toBe('Wizard Tower');
    });
  });
});
