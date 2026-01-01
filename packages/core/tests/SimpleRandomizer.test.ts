
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SimpleRandomizer } from '../utils/SimpleRandomizer';

describe('SimpleRandomizer', () => {
  let randomizer: SimpleRandomizer;

  beforeEach(() => {
    randomizer = new SimpleRandomizer();
  });

  describe('randomInt', () => {
    it('should return an integer within the specified range', () => {
      const min = 1;
      const max = 10;
      const result = randomizer.randomInt(min, max);
      expect(result).toBeGreaterThanOrEqual(min);
      expect(result).toBeLessThanOrEqual(max);
      expect(Number.isInteger(result)).toBe(true);
    });
  });

  describe('randomFloat', () => {
    it('should return a float between 0 and 1', () => {
      const result = randomizer.randomFloat();
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(1);
    });
  });

  describe('rollDice', () => {
    it('should correctly parse and roll a simple dice notation (e.g., 1d6)', () => {
      const result = randomizer.rollDice('1d6');
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.total).toBeLessThanOrEqual(6);
      expect(result.breakdown).toMatch(/1d6: \[(\d+)\] = \d+/);
    });

    it('should handle multiple dice (e.g., 3d8)', () => {
      const result = randomizer.rollDice('3d8');
      expect(result.total).toBeGreaterThanOrEqual(3);
      expect(result.total).toBeLessThanOrEqual(24);
      expect(result.breakdown).toMatch(/3d8: \[(\d+, \d+, \d+)\] = \d+/);
    });

    it('should handle modifiers (e.g., 2d10+5)', () => {
        vi.spyOn(randomizer, 'randomInt').mockReturnValue(5);
        const result = randomizer.rollDice('2d10+5');
        expect(result.total).toBe(15);
        expect(result.breakdown).toBe('2d10+5: [5, 5] +5 = 15');
    });

    it('should handle negative modifiers (e.g., 1d20-2)', () => {
        vi.spyOn(randomizer, 'randomInt').mockReturnValue(10);
        const result = randomizer.rollDice('1d20-2');
        expect(result.total).toBe(8);
        expect(result.breakdown).toBe('1d20-2: [10] -2 = 8');
    });

    it('should return 0 for invalid notation', () => {
      const result = randomizer.rollDice('invalid');
      expect(result.total).toBe(0);
      expect(result.breakdown).toBe('Invalid notation: invalid');
    });
  });

  describe('randomChoice', () => {
    it('should return a random item from the array', () => {
      const items = ['a', 'b', 'c'];
      const result = randomizer.randomChoice(items);
      expect(items).toContain(result);
    });

    it('should throw an error for an empty array', () => {
      expect(() => randomizer.randomChoice([])).toThrow('Cannot choose from empty array');
    });
  });

  describe('weightedChoice', () => {
    it('should return an item based on weights', () => {
      const items = ['a', 'b', 'c'];
      const weights = [1, 9, 0];
      vi.spyOn(randomizer, 'randomFloat').mockReturnValue(0.1); // Ensures 'b' is chosen
      const result = randomizer.weightedChoice(items, weights);
      expect(result).toBe('b');
    });

    it('should throw an error for mismatched items and weights', () => {
      const items = ['a', 'b'];
      const weights = [1];
      expect(() => randomizer.weightedChoice(items, weights)).toThrow('Items and weights arrays must have the same length');
    });

    it('should throw an error for an empty array', () => {
        expect(() => randomizer.weightedChoice([], [])).toThrow('Cannot choose from empty array');
      });
  });

  describe('rollPercentile', () => {
    it('should return a number between 1 and 100', () => {
      const result = randomizer.rollPercentile();
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(100);
    });
  });

  describe('chance', () => {
    it('should return true if roll is within percentage', () => {
      vi.spyOn(randomizer, 'rollPercentile').mockReturnValue(50);
      expect(randomizer.chance(60)).toBe(true);
    });

    it('should return false if roll is outside percentage', () => {
      vi.spyOn(randomizer, 'rollPercentile').mockReturnValue(70);
      expect(randomizer.chance(60)).toBe(false);
    });
  });
});
