
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NPC_TABLES, weightedRandom, randomChoice } from '../data/npcTables';

describe('NPC Tables', () => {

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should have populated NPC_TABLES', () => {
    expect(NPC_TABLES.maleNames.length).toBeGreaterThan(0);
    expect(NPC_TABLES.femaleNames.length).toBeGreaterThan(0);
    expect(NPC_TABLES.neutralNames.length).toBeGreaterThan(0);
    expect(NPC_TABLES.surnames.length).toBeGreaterThan(0);
    expect(NPC_TABLES.species.length).toBeGreaterThan(0);
    expect(NPC_TABLES.genders.length).toBeGreaterThan(0);
    expect(NPC_TABLES.dispositions.length).toBeGreaterThan(0);
    expect(NPC_TABLES.quirks.length).toBeGreaterThan(0);
    expect(NPC_TABLES.motivations.length).toBeGreaterThan(0);
  });

  describe('weightedRandom', () => {
    it('should return an item based on its weight', () => {
      const items = [
        { type: 'common', weight: 10 },
        { type: 'rare', weight: 1 },
      ];

      // Mock Math.random to always pick the common item
      vi.spyOn(Math, 'random').mockReturnValue(0.1); // 0.1 * 11 (total weight) = 1.1. This is < 10 (common weight)
      expect(weightedRandom(items).type).toBe('common');

      // Mock Math.random to always pick the rare item
      vi.spyOn(Math, 'random').mockReturnValue(0.95); // 0.95 * 11 (total weight) = 10.45. This is >= 10 (common weight), so it picks rare
      expect(weightedRandom(items).type).toBe('rare');
    });

    it('should handle items with zero weight', () => {
      const items = [
        { type: 'common', weight: 10 },
        { type: 'zero', weight: 0 },
      ];
      vi.spyOn(Math, 'random').mockReturnValue(0.1);
      expect(weightedRandom(items).type).toBe('common');
    });

    it('should return the last item if random value falls exactly on the boundary', () => {
      const items = [
        { type: 'first', weight: 1 },
        { type: 'last', weight: 1 },
      ];
      vi.spyOn(Math, 'random').mockReturnValue(0.99); // Close to 1, should pick last
      expect(weightedRandom(items).type).toBe('last');
    });
  });

  describe('randomChoice', () => {
    it('should return a random element from the array', () => {
      const array = ['a', 'b', 'c'];
      vi.spyOn(Math, 'random').mockReturnValue(0.5); // Should pick the middle element
      expect(randomChoice(array)).toBe('b');

      vi.spyOn(Math, 'random').mockReturnValue(0.01); // Should pick the first element
      expect(randomChoice(array)).toBe('a');

      vi.spyOn(Math, 'random').mockReturnValue(0.99); // Should pick the last element
      expect(randomChoice(array)).toBe('c');
    });

    it('should return undefined for an empty array', () => {
      expect(randomChoice([])).toBeUndefined();
    });
  });
});
