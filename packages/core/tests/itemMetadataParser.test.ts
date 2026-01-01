import { describe, it, expect } from 'vitest';
import {
  extractItemTypes,
  extractRarities,
  buildTypeRarityMatrix,
  getItemMetadataSummary
} from '../parsers/itemMetadataParser';
import { Item } from '../models/types';

describe('Item Metadata Parser', () => {

  const sampleItems: Item[] = [
    {
      name: 'Longsword',
      cost: { cp: 0, sp: 0, gp: 15, pp: 0 },
      type: 'weapon',
      rarity: 'common',
      description: 'A versatile sword',
      source: 'PHB',
      category: 'Weapons',
      file: { path: 'items/longsword.md', name: 'Longsword' }
    },
    {
      name: 'Shortsword',
      cost: { cp: 0, sp: 0, gp: 10, pp: 0 },
      type: 'weapon',
      rarity: 'common',
      description: 'A short blade',
      source: 'PHB',
      category: 'Weapons',
      file: { path: 'items/shortsword.md', name: 'Shortsword' }
    },
    {
      name: 'Plate Armor',
      cost: { cp: 0, sp: 0, gp: 1500, pp: 0 },
      type: 'armor',
      rarity: 'common',
      description: 'Heavy plate armor',
      source: 'PHB',
      category: 'Armor',
      file: { path: 'items/plate.md', name: 'Plate Armor' }
    },
    {
      name: 'Potion of Healing',
      cost: { cp: 0, sp: 0, gp: 50, pp: 0 },
      type: 'potion',
      rarity: 'common',
      description: 'Heals wounds',
      source: 'DMG',
      category: 'Potions',
      file: { path: 'items/potion-healing.md', name: 'Potion of Healing' }
    },
    {
      name: 'Flame Tongue',
      cost: { cp: 0, sp: 0, gp: 5000, pp: 0 },
      type: 'weapon',
      rarity: 'rare',
      description: 'A magical flaming sword',
      source: 'DMG',
      category: 'Magic Items',
      file: { path: 'items/flame-tongue.md', name: 'Flame Tongue' }
    },
    {
      name: 'Ring of Protection',
      cost: { cp: 0, sp: 0, gp: 3000, pp: 0 },
      type: 'ring',
      rarity: 'uncommon',
      description: 'Grants +1 AC',
      source: 'DMG',
      category: 'Magic Items',
      file: { path: 'items/ring-protection.md', name: 'Ring of Protection' }
    }
  ];

  describe('extractItemTypes', () => {
    it('should extract all unique item types', () => {
      const types = extractItemTypes(sampleItems);

      expect(types).toContain('weapon');
      expect(types).toContain('armor');
      expect(types).toContain('potion');
      expect(types).toContain('ring');
      expect(types).toHaveLength(4);
    });

    it('should return types in sorted order', () => {
      const types = extractItemTypes(sampleItems);

      expect(types).toEqual(['armor', 'potion', 'ring', 'weapon']);
    });

    it('should handle empty item array', () => {
      const types = extractItemTypes([]);

      expect(types).toEqual([]);
    });

    it('should handle items with duplicate types', () => {
      const items: Item[] = [
        { ...sampleItems[0], type: 'weapon' },
        { ...sampleItems[1], type: 'weapon' },
        { ...sampleItems[2], type: 'weapon' }
      ];

      const types = extractItemTypes(items);

      expect(types).toEqual(['weapon']);
    });

    it('should normalize types to lowercase', () => {
      const items: Item[] = [
        { ...sampleItems[0], type: 'Weapon' },
        { ...sampleItems[1], type: 'WEAPON' },
        { ...sampleItems[2], type: 'weapon' }
      ];

      const types = extractItemTypes(items);

      expect(types).toEqual(['weapon']);
    });
  });

  describe('extractRarities', () => {
    it('should extract all unique rarities', () => {
      const rarities = extractRarities(sampleItems);

      expect(rarities).toContain('common');
      expect(rarities).toContain('uncommon');
      expect(rarities).toContain('rare');
    });

    it('should maintain D&D 5e rarity ordering', () => {
      const rarities = extractRarities(sampleItems);

      const expectedOrder = ['common', 'uncommon', 'rare'];
      expect(rarities).toEqual(expectedOrder);
    });

    it('should handle all D&D 5e rarities in order', () => {
      const allRarityItems: Item[] = [
        { ...sampleItems[0], rarity: 'legendary' },
        { ...sampleItems[1], rarity: 'common' },
        { ...sampleItems[2], rarity: 'very rare' },
        { ...sampleItems[3], rarity: 'rare' },
        { ...sampleItems[4], rarity: 'uncommon' }
      ];

      const rarities = extractRarities(allRarityItems);

      expect(rarities).toEqual(['common', 'uncommon', 'rare', 'very rare', 'legendary']);
    });

    it('should handle "none" rarity as common', () => {
      const items: Item[] = [
        { ...sampleItems[0], rarity: 'none' }
      ];

      const rarities = extractRarities(items);

      expect(rarities).toContain('common');
    });

    it('should handle empty item array', () => {
      const rarities = extractRarities([]);

      expect(rarities).toEqual([]);
    });
  });

  describe('buildTypeRarityMatrix', () => {
    it('should build correct matrix of item counts', () => {
      const matrix = buildTypeRarityMatrix(sampleItems);

      expect(matrix['weapon']).toBeDefined();
      expect(matrix['weapon']['common']).toBe(2);  // Longsword, Shortsword
      expect(matrix['weapon']['rare']).toBe(1);    // Flame Tongue
      expect(matrix['armor']['common']).toBe(1);   // Plate Armor
      expect(matrix['potion']['common']).toBe(1);  // Potion of Healing
      expect(matrix['ring']['uncommon']).toBe(1);  // Ring of Protection
    });

    it('should handle empty item array', () => {
      const matrix = buildTypeRarityMatrix([]);

      expect(Object.keys(matrix)).toHaveLength(0);
    });

    it('should accumulate counts for multiple items', () => {
      const items: Item[] = [
        { ...sampleItems[0], type: 'weapon', rarity: 'common' },
        { ...sampleItems[1], type: 'weapon', rarity: 'common' },
        { ...sampleItems[2], type: 'weapon', rarity: 'common' }
      ];

      const matrix = buildTypeRarityMatrix(items);

      expect(matrix['weapon']['common']).toBe(3);
    });

    it('should treat "none" rarity as common', () => {
      const items: Item[] = [
        { ...sampleItems[0], rarity: 'none' }
      ];

      const matrix = buildTypeRarityMatrix(items);

      expect(matrix['weapon']['common']).toBe(1);
      expect(matrix['weapon']['none']).toBeUndefined();
    });

    it('should handle multiple types and rarities', () => {
      const matrix = buildTypeRarityMatrix(sampleItems);

      expect(Object.keys(matrix).length).toBeGreaterThan(0);
      expect(matrix['weapon']).toBeDefined();
      expect(matrix['armor']).toBeDefined();
      expect(matrix['potion']).toBeDefined();
      expect(matrix['ring']).toBeDefined();
    });
  });

  describe('getItemMetadataSummary', () => {
    it('should return complete metadata summary', () => {
      const summary = getItemMetadataSummary(sampleItems);

      expect(summary.types).toEqual(['armor', 'potion', 'ring', 'weapon']);
      expect(summary.rarities).toEqual(['common', 'uncommon', 'rare']);
      expect(summary.totalItems).toBe(6);
      expect(summary.matrix).toBeDefined();
    });

    it('should calculate total items correctly', () => {
      const summary = getItemMetadataSummary(sampleItems);

      expect(summary.totalItems).toBe(sampleItems.length);
    });

    it('should handle empty array', () => {
      const summary = getItemMetadataSummary([]);

      expect(summary.types).toEqual([]);
      expect(summary.rarities).toEqual([]);
      expect(summary.totalItems).toBe(0);
      expect(summary.matrix).toEqual({});
    });

    it('should include matrix with correct counts', () => {
      const summary = getItemMetadataSummary(sampleItems);

      expect(summary.matrix['weapon']['common']).toBe(2);
      expect(summary.matrix['weapon']['rare']).toBe(1);
      expect(summary.matrix['ring']['uncommon']).toBe(1);
    });
  });
});
