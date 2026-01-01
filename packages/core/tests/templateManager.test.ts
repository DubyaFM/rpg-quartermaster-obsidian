import { describe, it, expect } from 'vitest';
import {
  mergeTemplateWithDefaults,
  validateTemplateConfig,
  calculateEffectiveConfig
} from '../services/templateManager';
import { ShopGenerationConfig } from '../models/types';

describe('Template Manager', () => {

  const defaultConfig: ShopGenerationConfig = {
    type: 'blacksmith',
    wealthLevel: 'modest',
    maxItems: {
      common: 15,
      uncommon: 5,
      rare: 2,
      veryRare: 0,
      legendary: 0
    },
    rarityChances: {
      common: 100,
      uncommon: 50,
      rare: 20,
      veryRare: 5,
      legendary: 1
    },
    fundsOnHandDice: {
      count: 10,
      sides: 10,
      bonus: 50,
      currency: 'gp'
    }
  };

  describe('mergeTemplateWithDefaults', () => {
    it('should merge partial template with defaults', () => {
      const customConfig: Partial<ShopGenerationConfig> = {
        totalItemRange: { min: 30, max: 50 }
      };

      const merged = mergeTemplateWithDefaults(customConfig, defaultConfig);

      expect(merged.totalItemRange).toEqual({ min: 30, max: 50 });
      expect(merged.maxItems).toEqual(defaultConfig.maxItems);
      expect(merged.rarityChances).toEqual(defaultConfig.rarityChances);
      expect(merged.isCustomTemplate).toBe(true);
    });

    it('should override rarity chances', () => {
      const customConfig: Partial<ShopGenerationConfig> = {
        rarityChances: {
          common: 90,
          uncommon: 70,
          rare: 50,
          veryRare: 30,
          legendary: 10
        }
      };

      const merged = mergeTemplateWithDefaults(customConfig, defaultConfig);

      expect(merged.rarityChances).toEqual(customConfig.rarityChances);
      expect(merged.maxItems).toEqual(defaultConfig.maxItems);
    });

    it('should add specific items', () => {
      const customConfig: Partial<ShopGenerationConfig> = {
        specificItems: [
          {
            itemName: 'Longsword',
            spawnChance: 100,
            stockRange: { min: 3, max: 8 }
          }
        ]
      };

      const merged = mergeTemplateWithDefaults(customConfig, defaultConfig);

      expect(merged.specificItems).toHaveLength(1);
      expect(merged.specificItems![0].itemName).toBe('Longsword');
    });

    it('should add item type chances', () => {
      const customConfig: Partial<ShopGenerationConfig> = {
        itemTypeChances: {
          'weapon': {
            common: 95,
            uncommon: 80,
            rare: 60
          }
        }
      };

      const merged = mergeTemplateWithDefaults(customConfig, defaultConfig);

      expect(merged.itemTypeChances).toBeDefined();
      expect(merged.itemTypeChances!['weapon']).toEqual({
        common: 95,
        uncommon: 80,
        rare: 60
      });
    });

    it('should override funds configuration', () => {
      const customConfig: Partial<ShopGenerationConfig> = {
        fundsOnHandDice: {
          count: 30,
          sides: 10,
          bonus: 200,
          currency: 'gp'
        }
      };

      const merged = mergeTemplateWithDefaults(customConfig, defaultConfig);

      expect(merged.fundsOnHandDice).toEqual(customConfig.fundsOnHandDice);
    });

    it('should mark config as custom template', () => {
      const customConfig: Partial<ShopGenerationConfig> = {
        totalItemRange: { min: 10, max: 20 }
      };

      const merged = mergeTemplateWithDefaults(customConfig, defaultConfig);

      expect(merged.isCustomTemplate).toBe(true);
    });

    it('should preserve all default fields when custom is empty', () => {
      const customConfig: Partial<ShopGenerationConfig> = {};

      const merged = mergeTemplateWithDefaults(customConfig, defaultConfig);

      expect(merged.type).toBe(defaultConfig.type);
      expect(merged.wealthLevel).toBe(defaultConfig.wealthLevel);
      expect(merged.maxItems).toEqual(defaultConfig.maxItems);
      expect(merged.rarityChances).toEqual(defaultConfig.rarityChances);
    });
  });

  describe('validateTemplateConfig', () => {
    it('should validate a valid config', () => {
      const result = validateTemplateConfig(defaultConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should catch invalid percentage (> 100)', () => {
      const invalidConfig: ShopGenerationConfig = {
        ...defaultConfig,
        rarityChances: {
          common: 150,  // Invalid!
          uncommon: 50,
          rare: 20,
          veryRare: 5,
          legendary: 1
        }
      };

      const result = validateTemplateConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('must be between 0 and 100'))).toBe(true);
    });

    it('should catch invalid percentage (< 0)', () => {
      const invalidConfig: ShopGenerationConfig = {
        ...defaultConfig,
        rarityChances: {
          common: 100,
          uncommon: -10,  // Invalid!
          rare: 20,
          veryRare: 5,
          legendary: 1
        }
      };

      const result = validateTemplateConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should catch invalid spawn chance in specific items', () => {
      const invalidConfig: ShopGenerationConfig = {
        ...defaultConfig,
        specificItems: [
          {
            itemName: 'Test Item',
            spawnChance: 150,  // Invalid!
            stockRange: { min: 1, max: 5 }
          }
        ]
      };

      const result = validateTemplateConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('spawnChance must be between 0 and 100'))).toBe(true);
    });

    it('should catch invalid stock range (min > max)', () => {
      const invalidConfig: ShopGenerationConfig = {
        ...defaultConfig,
        specificItems: [
          {
            itemName: 'Test Item',
            spawnChance: 100,
            stockRange: { min: 10, max: 5 }  // Invalid!
          }
        ]
      };

      const result = validateTemplateConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('stockRange.max must be >= stockRange.min'))).toBe(true);
    });

    it('should catch invalid total item range (min > max)', () => {
      const invalidConfig: ShopGenerationConfig = {
        ...defaultConfig,
        totalItemRange: { min: 50, max: 30 }  // Invalid!
      };

      const result = validateTemplateConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('totalItemRange.max must be >= totalItemRange.min'))).toBe(true);
    });

    it('should catch invalid dice count', () => {
      const invalidConfig: ShopGenerationConfig = {
        ...defaultConfig,
        fundsOnHandDice: {
          count: -5,  // Invalid!
          sides: 10,
          bonus: 50,
          currency: 'gp'
        }
      };

      const result = validateTemplateConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('goldOnHandDice.count must be >= 0'))).toBe(true);
    });

    it('should catch invalid dice sides', () => {
      const invalidConfig: ShopGenerationConfig = {
        ...defaultConfig,
        fundsOnHandDice: {
          count: 10,
          sides: 0,  // Invalid!
          bonus: 50,
          currency: 'gp'
        }
      };

      const result = validateTemplateConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('goldOnHandDice.sides must be one of'))).toBe(true);
    });

    it('should validate item type chances percentages', () => {
      const invalidConfig: ShopGenerationConfig = {
        ...defaultConfig,
        itemTypeChances: {
          'weapon': {
            common: 120,  // Invalid!
            uncommon: 80
          }
        }
      };

      const result = validateTemplateConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('must be between 0 and 100'))).toBe(true);
    });
  });

  describe('calculateEffectiveConfig', () => {
    it('should return default config when no custom provided', () => {
      const result = calculateEffectiveConfig(defaultConfig);

      expect(result).toEqual(defaultConfig);
      expect(result.isCustomTemplate).toBeUndefined();
    });

    it('should merge when custom config provided', () => {
      const customConfig: Partial<ShopGenerationConfig> = {
        totalItemRange: { min: 25, max: 40 }
      };

      const result = calculateEffectiveConfig(defaultConfig, customConfig);

      expect(result.totalItemRange).toEqual({ min: 25, max: 40 });
      expect(result.maxItems).toEqual(defaultConfig.maxItems);
      expect(result.isCustomTemplate).toBe(true);
    });

    it('should handle null custom config', () => {
      const result = calculateEffectiveConfig(defaultConfig, null);

      expect(result).toEqual(defaultConfig);
    });

    it('should handle undefined custom config', () => {
      const result = calculateEffectiveConfig(defaultConfig, undefined);

      expect(result).toEqual(defaultConfig);
    });
  });
});
