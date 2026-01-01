import { describe, it, expect, beforeEach } from 'vitest';
import { rollDice, evaluateDiceGold } from '../calculators/dice';
import { SimpleRandomizer } from '../utils/SimpleRandomizer';
import { GoldOnHandDice } from '../models/types';
import { getDefaultCurrencyConfig } from '../data/defaultCurrencyConfig.js';
import type { CurrencyConfig } from '../models/currency-config.js';

describe('Dice Calculator', () => {
  const randomizer = new SimpleRandomizer();
  let currencyConfig: CurrencyConfig;

  beforeEach(() => {
    currencyConfig = getDefaultCurrencyConfig();
  });

  describe('rollDice', () => {
    it('should roll a single die and return a value in range', () => {
      const result = rollDice(randomizer, 1, 6);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(6);
    });

    it('should roll multiple dice and return sum in expected range', () => {
      const result = rollDice(randomizer, 3, 6);
      expect(result).toBeGreaterThanOrEqual(3);  // minimum: 3 × 1
      expect(result).toBeLessThanOrEqual(18);     // maximum: 3 × 6
    });

    it('should work with different die types', () => {
      const d4 = rollDice(randomizer, 1, 4);
      expect(d4).toBeGreaterThanOrEqual(1);
      expect(d4).toBeLessThanOrEqual(4);

      const d20 = rollDice(randomizer, 1, 20);
      expect(d20).toBeGreaterThanOrEqual(1);
      expect(d20).toBeLessThanOrEqual(20);

      const d100 = rollDice(randomizer, 1, 100);
      expect(d100).toBeGreaterThanOrEqual(1);
      expect(d100).toBeLessThanOrEqual(100);
    });

    it('should handle large numbers of dice', () => {
      const result = rollDice(randomizer, 50, 10);
      expect(result).toBeGreaterThanOrEqual(50);   // minimum: 50 × 1
      expect(result).toBeLessThanOrEqual(500);      // maximum: 50 × 10
    });
  });

  describe('evaluateDiceGold', () => {
    it('should generate gold in copper', () => {
      const diceConfig: GoldOnHandDice = {
        count: 2,
        sides: 6,
        bonus: 5,
        currency: 'cp'
      };

      const result = evaluateDiceGold(randomizer, diceConfig, currencyConfig, 1);

      // Result should be between (2×1)+5=7 and (2×6)+5=17 copper
      const totalCopper = result.cp + (result.sp * 10) +
                         (result.gp * 100) + (result.pp * 1000);
      expect(totalCopper).toBeGreaterThanOrEqual(7);
      expect(totalCopper).toBeLessThanOrEqual(17);
    });

    it('should generate gold in silver', () => {
      const diceConfig: GoldOnHandDice = {
        count: 3,
        sides: 6,
        bonus: 10,
        currency: 'sp'
      };

      const result = evaluateDiceGold(randomizer, diceConfig, currencyConfig, 10);

      // Result should be between (3×1)+10=13 and (3×6)+10=28 silver (130-280 copper)
      const totalCopper = result.cp + (result.sp * 10) +
                         (result.gp * 100) + (result.pp * 1000);
      expect(totalCopper).toBeGreaterThanOrEqual(130);
      expect(totalCopper).toBeLessThanOrEqual(280);
    });

    it('should generate gold in gold pieces', () => {
      const diceConfig: GoldOnHandDice = {
        count: 10,
        sides: 10,
        bonus: 50,
        currency: 'gp'
      };

      const result = evaluateDiceGold(randomizer, diceConfig, currencyConfig, 100);

      // Result should be between (10×1)+50=60 and (10×10)+50=150 gold (6000-15000 copper)
      const totalCopper = result.cp + (result.sp * 10) +
                         (result.gp * 100) + (result.pp * 1000);
      expect(totalCopper).toBeGreaterThanOrEqual(6000);
      expect(totalCopper).toBeLessThanOrEqual(15000);
    });

    it('should generate gold in platinum', () => {
      const diceConfig: GoldOnHandDice = {
        count: 5,
        sides: 10,
        bonus: 20,
        currency: 'pp'
      };

      const result = evaluateDiceGold(randomizer, diceConfig, currencyConfig, 1000);

      // Result should be between (5×1)+20=25 and (5×10)+20=70 platinum (25000-70000 copper)
      const totalCopper = result.cp + (result.sp * 10) +
                         (result.gp * 100) + (result.pp * 1000);
      expect(totalCopper).toBeGreaterThanOrEqual(25000);
      expect(totalCopper).toBeLessThanOrEqual(70000);
    });

    it('should handle zero bonus', () => {
      const diceConfig: GoldOnHandDice = {
        count: 2,
        sides: 6,
        bonus: 0,
        currency: 'gp'
      };

      const result = evaluateDiceGold(randomizer, diceConfig, currencyConfig, 100);

      // Result should be between 2 and 12 gold (200-1200 copper)
      const totalCopper = result.cp + (result.sp * 10) +
                         (result.gp * 100) + (result.pp * 1000);
      expect(totalCopper).toBeGreaterThanOrEqual(200);
      expect(totalCopper).toBeLessThanOrEqual(1200);
    });

    it('should return properly formatted ItemCost', () => {
      const diceConfig: GoldOnHandDice = {
        count: 1,
        sides: 6,
        bonus: 0,
        currency: 'gp'
      };

      const result = evaluateDiceGold(randomizer, diceConfig, currencyConfig, 100);

      expect(result).toHaveProperty('cp');
      expect(result).toHaveProperty('sp');
      expect(result).toHaveProperty('gp');
      expect(result).toHaveProperty('pp');
      expect(typeof result.cp).toBe('number');
      expect(typeof result.sp).toBe('number');
      expect(typeof result.gp).toBe('number');
      expect(typeof result.pp).toBe('number');
    });
  });
});
