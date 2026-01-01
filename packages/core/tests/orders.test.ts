
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateOrderPrice,
  calculateCraftingTime,
  formatOrderDate,
  formatCraftingTime,
  createOrder,
  isOrderReady,
  getReadyOrders,
  getPendingOrders,
  completeOrder
} from '../calculators/orders';
import { Item, ItemCost, Order } from '../models/types';
import { IRandomizer, RollResult } from '../interfaces/IRandomizer';
import { getDefaultCurrencyConfig } from '../data/defaultCurrencyConfig.js';
import type { CurrencyConfig } from '../models/currency-config.js';

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

const mockItem: Item = {
  name: 'Magic Sword',
  description: 'A sword with magical properties.',
  cost: { cp: 0, sp: 0, gp: 100, pp: 0 },
  rarity: 'Rare',
  type: 'Weapon',
  category: 'Weapons',
  source: 'DMG',
  link: 'some-link',
  id: 'magic-sword',
};

describe('Order Utilities', () => {

  let config: CurrencyConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    config = getDefaultCurrencyConfig();
    // Reset Date mock before each test to ensure consistent results
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-01-01T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('calculateOrderPrice', () => {
    it('should calculate order price with a 50% markup', () => {
      const price = calculateOrderPrice(mockItem, config);
      // Original cost: 100 gold = 10000 copper
      // Markup: 50% -> 15000 copper = 15 platinum (currency normalization)
      expect(price).toEqual({ cp: 0, sp: 0, gp: 0, pp: 15 });
    });
  });

  describe('calculateCraftingTime', () => {
    it('should calculate crafting time for a rare item', () => {
      // Mock rollDice to return a predictable value for '1d6'
      (mockRandomizer.rollDice as vi.Mock).mockReturnValue({ total: 3, breakdown: '' });
      const time = calculateCraftingTime(mockRandomizer, mockItem);
      // Rare item: 1d6 * 30. Mocked roll is 3, so 3 * 30 = 90
      expect(time).toBe(90);
    });

    it('should use fallback for unknown rarity', () => {
      const unknownRarityItem = { ...mockItem, rarity: 'Unknown' };
      const time = calculateCraftingTime(mockRandomizer, unknownRarityItem);
      expect(time).toBe(7); // Fallback for unknown rarity
    });

    // Note: Test for specific crafting time configuration removed as config loading
    // is handled by adapter layer and not testable in core unit tests
  });

  describe('formatOrderDate', () => {
    it('should format the completion date correctly', () => {
      const date = formatOrderDate(5);
      const expectedDate = new Date('2023-01-06T12:00:00.000Z').toISOString();
      expect(date).toBe(expectedDate);
    });
  });

  describe('formatCraftingTime', () => {
    it('should format days less than 7', () => {
      expect(formatCraftingTime(1)).toBe('1 day');
      expect(formatCraftingTime(5)).toBe('5 days');
    });

    it('should format weeks', () => {
      expect(formatCraftingTime(7)).toBe('1 week');
      expect(formatCraftingTime(14)).toBe('2 weeks');
      expect(formatCraftingTime(10)).toBe('1 week and 3 days');
    });

    it('should format months', () => {
      expect(formatCraftingTime(30)).toBe('1 month');
      expect(formatCraftingTime(60)).toBe('2 months');
      expect(formatCraftingTime(35)).toBe('1 month and 5 days');
      expect(formatCraftingTime(37)).toBe('1 month and 1 week'); // 30 + 7 = 37
      expect(formatCraftingTime(40)).toBe('1 month and 1 week and 3 days'); // 30 + 7 + 3 = 40
      expect(formatCraftingTime(42)).toBe('1 month and 1 week and 5 days'); // 30 + 7 + 5 = 42
    });
  });

  describe('createOrder', () => {
    it('should create an order object', () => {
      (mockRandomizer.rollDice as vi.Mock).mockReturnValue({ total: 3, breakdown: '' });
      const order = createOrder(mockRandomizer, mockItem, 'My Shop', config, 'Shopkeeper Bob');
      expect(order.item).toEqual(mockItem);
      expect(order.itemName).toBe('Magic Sword');
      expect(order.shopName).toBe('My Shop');
      expect(order.shopkeeper).toBe('Shopkeeper Bob');
      expect(order.price).toEqual({ cp: 0, sp: 0, gp: 0, pp: 15 });
      expect(order.craftingDays).toBe(90);
      expect(order.status).toBe('pending');

      // Verify dates are valid ISO strings without checking exact time (avoid timezone issues)
      const orderDate = new Date(order.orderDate);
      const completionDate = new Date(order.completionDate);
      expect(orderDate.toISOString()).toBe(order.orderDate);
      expect(completionDate.toISOString()).toBe(order.completionDate);

      // Verify completion date is 90 days after order date
      const daysDiff = Math.round((completionDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBe(90);
    });
  });

  describe('isOrderReady', () => {
    it('should return true if order is ready', () => {
      const readyOrder: Order = {
        item: mockItem,
        itemName: 'Magic Sword',
        shopName: 'My Shop',
        orderDate: new Date('2022-12-01T12:00:00.000Z').toISOString(),
        completionDate: new Date('2022-12-05T12:00:00.000Z').toISOString(),
        price: { cp: 0, sp: 0, gp: 100, pp: 0 },
        craftingDays: 4,
        status: 'pending',
      };
      expect(isOrderReady(readyOrder)).toBe(true);
    });

    it('should return false if order is not ready', () => {
      const pendingOrder: Order = {
        item: mockItem,
        itemName: 'Magic Sword',
        shopName: 'My Shop',
        orderDate: new Date('2023-01-01T12:00:00.000Z').toISOString(),
        completionDate: new Date('2023-01-05T12:00:00.000Z').toISOString(),
        price: { cp: 0, sp: 0, gp: 100, pp: 0 },
        craftingDays: 4,
        status: 'pending',
      };
      expect(isOrderReady(pendingOrder)).toBe(false);
    });
  });

  describe('getReadyOrders', () => {
    it('should return only ready orders', () => {
      const orders: Order[] = [
        {
          item: mockItem, itemName: 'A', shopName: 'Shop', status: 'pending',
          orderDate: new Date('2022-12-01T12:00:00.000Z').toISOString(),
          completionDate: new Date('2022-12-05T12:00:00.000Z').toISOString(),
          price: { cp: 0, sp: 0, gp: 100, pp: 0 }, craftingDays: 4,
        },
        {
          item: mockItem, itemName: 'B', shopName: 'Shop', status: 'pending',
          orderDate: new Date('2023-01-01T12:00:00.000Z').toISOString(),
          completionDate: new Date('2023-01-05T12:00:00.000Z').toISOString(),
          price: { cp: 0, sp: 0, gp: 100, pp: 0 }, craftingDays: 4,
        },
        {
          item: mockItem, itemName: 'C', shopName: 'Shop', status: 'completed',
          orderDate: new Date('2022-12-01T12:00:00.000Z').toISOString(),
          completionDate: new Date('2022-12-05T12:00:00.000Z').toISOString(),
          price: { cp: 0, sp: 0, gp: 100, pp: 0 }, craftingDays: 4,
        },
      ];
      const ready = getReadyOrders(orders);
      expect(ready.length).toBe(1);
      expect(ready[0].itemName).toBe('A');
    });
  });

  describe('getPendingOrders', () => {
    it('should return only pending orders', () => {
      const orders: Order[] = [
        {
          item: mockItem, itemName: 'A', shopName: 'Shop', status: 'pending',
          orderDate: new Date('2022-12-01T12:00:00.000Z').toISOString(),
          completionDate: new Date('2022-12-05T12:00:00.000Z').toISOString(),
          price: { cp: 0, sp: 0, gp: 100, pp: 0 }, craftingDays: 4,
        },
        {
          item: mockItem, itemName: 'B', shopName: 'Shop', status: 'pending',
          orderDate: new Date('2023-01-01T12:00:00.000Z').toISOString(),
          completionDate: new Date('2023-01-05T12:00:00.000Z').toISOString(),
          price: { cp: 0, sp: 0, gp: 100, pp: 0 }, craftingDays: 4,
        },
        {
          item: mockItem, itemName: 'C', shopName: 'Shop', status: 'completed',
          orderDate: new Date('2022-12-01T12:00:00.000Z').toISOString(),
          completionDate: new Date('2022-12-05T12:00:00.000Z').toISOString(),
          price: { cp: 0, sp: 0, gp: 100, pp: 0 }, craftingDays: 4,
        },
      ];
      const pending = getPendingOrders(orders);
      expect(pending.length).toBe(1);
      expect(pending[0].itemName).toBe('B');
    });
  });

  describe('completeOrder', () => {
    it('should mark an order as completed', () => {
      const order: Order = {
        item: mockItem, itemName: 'A', shopName: 'Shop', status: 'pending',
        orderDate: new Date().toISOString(), completionDate: new Date().toISOString(),
        price: { cp: 0, sp: 0, gp: 100, pp: 0 }, craftingDays: 1,
      };
      completeOrder(order);
      expect(order.status).toBe('completed');
    });
  });
});
