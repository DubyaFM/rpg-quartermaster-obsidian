
import { describe, it, expect } from 'vitest';
import {
  parseCostString,
  convertToCopper,
  convertFromCopper,
  formatCurrency,
  addCurrency,
  multiplyCurrency,
  subtractCurrency,
  compareCurrency,
  applySmartDiscount
} from '../calculators/currency';
import { ItemCost } from '../models/types';
import { getDefaultCurrencyConfig } from '../data/defaultCurrencyConfig';
import type { CurrencyConfig } from '../models/currency-config';

describe('Currency Utilities', () => {

  describe('parseCostString', () => {
    const config = getDefaultCurrencyConfig();

    it('should parse a simple gold string', () => {
      const cost = parseCostString('25 gp', config);
      expect(cost).toEqual({ cp: 0, sp: 0, gp: 25, pp: 0 });
    });

    it('should parse a complex cost string', () => {
      const cost = parseCostString('1 pp 5 gp 3 sp 2 cp', config);
      expect(cost).toEqual({ cp: 2, sp: 3, gp: 5, pp: 1 });
    });

    it('should parse with full currency names', () => {
      const cost = parseCostString('1 platinum 5 gold 3 silver 2 copper', config);
      expect(cost).toEqual({ cp: 2, sp: 3, gp: 5, pp: 1 });
    });

    it('should parse with mixed casing', () => {
      const cost = parseCostString('1 Pp 5 gP 3 Sp 2 Cp', config);
      expect(cost).toEqual({ cp: 2, sp: 3, gp: 5, pp: 1 });
    });

    it('should handle multiple occurrences of the same currency', () => {
      const cost = parseCostString('1 gp 2 gp', config);
      expect(cost).toEqual({ cp: 0, sp: 0, gp: 3, pp: 0 });
    });

    it('should return null for an empty string', () => {
      const cost = parseCostString('', config);
      expect(cost).toBeNull();
    });

    it('should return null for an invalid string', () => {
      const cost = parseCostString('abc', config);
      expect(cost).toBeNull();
    });

    it('should assume copper (base unit) if only a number is provided', () => {
      const cost = parseCostString('100', config);
      expect(cost).toEqual({ cp: 100, sp: 0, gp: 0, pp: 0 });
    });

    it('should handle strings with only numbers and no currency unit', () => {
      const cost = parseCostString('500', config);
      expect(cost).toEqual({ cp: 500, sp: 0, gp: 0, pp: 0 });
    });

    it('should handle zero amounts correctly', () => {
      const cost = parseCostString('0 gp', config);
      expect(cost).toEqual({ cp: 0, sp: 0, gp: 0, pp: 0 });
    });

    it('should ignore negative amounts in string', () => {
      const cost = parseCostString('-5 gp', config);
      expect(cost).toBeNull();
    });
  });

  describe('convertToCopper', () => {
    it('should convert a simple gold cost to copper', () => {
      const cost: ItemCost = { cp: 0, sp: 0, gp: 1, pp: 0 };
      expect(convertToCopper(cost)).toBe(100);
    });

    it('should convert a complex cost to copper', () => {
      const cost: ItemCost = { cp: 2, sp: 3, gp: 5, pp: 1 };
      expect(convertToCopper(cost)).toBe(1000 + 500 + 30 + 2);
    });

    it('should handle zero cost', () => {
      const cost: ItemCost = { cp: 0, sp: 0, gp: 0, pp: 0 };
      expect(convertToCopper(cost)).toBe(0);
    });
  });

  describe('convertFromCopper', () => {
    it('should convert copper to a complex ItemCost', () => {
      const cost = convertFromCopper(1532);
      expect(cost).toEqual({ cp: 2, sp: 3, gp: 5, pp: 1 });
    });

    it('should convert 100 copper to 1 gold', () => {
      const cost = convertFromCopper(100);
      expect(cost).toEqual({ cp: 0, sp: 0, gp: 1, pp: 0 });
    });

    it('should convert 10 copper to 1 silver', () => {
      const cost = convertFromCopper(10);
      expect(cost).toEqual({ cp: 0, sp: 1, gp: 0, pp: 0 });
    });

    it('should convert 1000 copper to 1 platinum', () => {
      const cost = convertFromCopper(1000);
      expect(cost).toEqual({ cp: 0, sp: 0, gp: 0, pp: 1 });
    });

    it('should handle zero copper', () => {
      const cost = convertFromCopper(0);
      expect(cost).toEqual({ cp: 0, sp: 0, gp: 0, pp: 0 });
    });
  });

  describe('formatCurrency', () => {
    const config = getDefaultCurrencyConfig();

    it('should format a complex cost', () => {
      const cost: ItemCost = { cp: 2, sp: 3, gp: 5, pp: 1 };
      expect(formatCurrency(cost, config)).toBe('1 pp, 5 gp, 3 sp, 2 cp');
    });

    it('should format a simple gold cost', () => {
      const cost: ItemCost = { cp: 0, sp: 0, gp: 25, pp: 0 };
      expect(formatCurrency(cost, config)).toBe('25 gp');
    });

    it('should format zero cost', () => {
      const cost: ItemCost = { cp: 0, sp: 0, gp: 0, pp: 0 };
      expect(formatCurrency(cost, config)).toBe('0 cp');
    });

    it('should omit zero denominations', () => {
      const cost: ItemCost = { cp: 0, sp: 3, gp: 0, pp: 1 };
      expect(formatCurrency(cost, config)).toBe('1 pp, 3 sp');
    });
  });

  describe('addCurrency', () => {
    const config = getDefaultCurrencyConfig();

    it('should correctly add two currency amounts', () => {
      const cost1: ItemCost = { cp: 5, sp: 2, gp: 1, pp: 0 };
      const cost2: ItemCost = { cp: 5, sp: 8, gp: 0, pp: 1 };
      const result = addCurrency(cost1, cost2, config);
      expect(result).toEqual({ cp: 0, sp: 1, gp: 2, pp: 1 });
    });

    it('should handle adding with zero', () => {
      const cost1: ItemCost = { cp: 5, sp: 0, gp: 0, pp: 0 };
      const cost2: ItemCost = { cp: 0, sp: 0, gp: 0, pp: 0 };
      const result = addCurrency(cost1, cost2, config);
      expect(result).toEqual({ cp: 5, sp: 0, gp: 0, pp: 0 });
    });
  });

  describe('multiplyCurrency', () => {
    const config = getDefaultCurrencyConfig();

    it('should correctly multiply a currency amount', () => {
      const cost: ItemCost = { cp: 0, sp: 5, gp: 1, pp: 0 }; // 1 gp 5 sp = 150 cp
      const result = multiplyCurrency(cost, 2, config); // 300 cp = 3 gp
      expect(result).toEqual({ cp: 0, sp: 0, gp: 3, pp: 0 });
    });

    it('should handle multiplication by zero', () => {
      const cost: ItemCost = { cp: 1, sp: 1, gp: 1, pp: 1 };
      const result = multiplyCurrency(cost, 0, config);
      expect(result).toEqual({ cp: 0, sp: 0, gp: 0, pp: 0 });
    });

    it('should handle fractional results correctly', () => {
      const cost: ItemCost = { cp: 5, sp: 0, gp: 0, pp: 0 }; // 5 cp
      const result = multiplyCurrency(cost, 0.5, config); // 2.5 cp, should round to 3 cp
      expect(result).toEqual({ cp: 3, sp: 0, gp: 0, pp: 0 });
    });
  });

  describe('subtractCurrency', () => {
    const config = getDefaultCurrencyConfig();

    it('should correctly subtract two currency amounts', () => {
      const cost1: ItemCost = { cp: 0, sp: 0, gp: 2, pp: 0 }; // 200 cp
      const cost2: ItemCost = { cp: 0, sp: 5, gp: 0, pp: 0 }; // 50 cp
      const { result, isNegative } = subtractCurrency(cost1, cost2, config);
      expect(result).toEqual({ cp: 0, sp: 5, gp: 1, pp: 0 }); // 150 cp
      expect(isNegative).toBe(false);
    });

    it('should indicate if the result is negative', () => {
      const cost1: ItemCost = { cp: 0, sp: 5, gp: 0, pp: 0 }; // 50 cp
      const cost2: ItemCost = { cp: 0, sp: 0, gp: 1, pp: 0 }; // 100 cp
      const { result, isNegative } = subtractCurrency(cost1, cost2, config);
      expect(result).toEqual({ cp: 0, sp: 0, gp: 0, pp: 0 }); // Should return 0 if negative
      expect(isNegative).toBe(true);
    });

    it('should handle subtracting zero', () => {
      const cost1: ItemCost = { cp: 10, sp: 0, gp: 0, pp: 0 };
      const cost2: ItemCost = { cp: 0, sp: 0, gp: 0, pp: 0 };
      const { result, isNegative } = subtractCurrency(cost1, cost2, config);
      expect(result).toEqual({ cp: 0, sp: 1, gp: 0, pp: 0 });
      expect(isNegative).toBe(false);
    });
  });

  describe('compareCurrency', () => {
    const config = getDefaultCurrencyConfig();

    it('should return -1 if a < b', () => {
      const costA: ItemCost = { cp: 0, sp: 0, gp: 1, pp: 0 };
      const costB: ItemCost = { cp: 0, sp: 0, gp: 2, pp: 0 };
      expect(compareCurrency(costA, costB, config)).toBe(-1);
    });

    it('should return 1 if a > b', () => {
      const costA: ItemCost = { cp: 0, sp: 0, gp: 2, pp: 0 };
      const costB: ItemCost = { cp: 0, sp: 0, gp: 1, pp: 0 };
      expect(compareCurrency(costA, costB, config)).toBe(1);
    });

    it('should return 0 if a === b', () => {
      const costA: ItemCost = { cp: 0, sp: 0, gp: 1, pp: 0 };
      const costB: ItemCost = { cp: 0, sp: 10, gp: 0, pp: 0 };
      expect(compareCurrency(costA, costB, config)).toBe(0);
    });
  });

  describe('applySmartDiscount', () => {
    const config = getDefaultCurrencyConfig();

    it('should apply a discount and round to the nearest silver for gold prices', () => {
      const cost: ItemCost = { cp: 0, sp: 0, gp: 10, pp: 0 }; // 1000 cp
      const discounted = applySmartDiscount(cost, 0.10, config); // 10% off = 900 cp
      expect(discounted).toEqual({ cp: 0, sp: 0, gp: 9, pp: 0 }); // Rounds to nearest silver (10 cp)
    });

    it('should apply a discount and round to the nearest copper for silver prices', () => {
      const cost: ItemCost = { cp: 0, sp: 5, gp: 0, pp: 0 }; // 50 cp
      const discounted = applySmartDiscount(cost, 0.10, config); // 10% off = 45 cp
      expect(discounted).toEqual({ cp: 5, sp: 4, gp: 0, pp: 0 }); // Rounds to nearest copper (1 cp)
    });

    it('should apply a discount and round to the nearest gold for platinum prices', () => {
      const cost: ItemCost = { cp: 0, sp: 0, gp: 0, pp: 1 }; // 1000 cp
      const discounted = applySmartDiscount(cost, 0.10, config); // 10% off = 900 cp
      expect(discounted).toEqual({ cp: 0, sp: 0, gp: 9, pp: 0 }); // Rounds to nearest gold (100 cp)
    });

    it('should ensure the minimum cost is 1 copper', () => {
      const cost: ItemCost = { cp: 1, sp: 0, gp: 0, pp: 0 }; // 1 cp
      const discounted = applySmartDiscount(cost, 0.99, config); // 99% off = 0.01 cp
      expect(discounted).toEqual({ cp: 1, sp: 0, gp: 0, pp: 0 });
    });

    it('should handle 0% discount', () => {
      const cost: ItemCost = { cp: 5, sp: 4, gp: 3, pp: 2 };
      const discounted = applySmartDiscount(cost, 0, config);
      expect(discounted).toEqual(cost);
    });

    it('should handle 100% discount', () => {
      const cost: ItemCost = { cp: 5, sp: 4, gp: 3, pp: 2 };
      const discounted = applySmartDiscount(cost, 1, config);
      expect(discounted).toEqual({ cp: 1, sp: 0, gp: 0, pp: 0 }); // Minimum 1 cp
    });
  });
});
