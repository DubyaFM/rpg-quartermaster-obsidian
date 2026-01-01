
import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateSellPrice,
  getShopInterestFilter,
  isShopInterestedInItem,
  filterSellableItems,
  createSellItem,
  canShopAffordPurchase,
  getMaxAffordableQuantity,
  updateShopFundsAfterTransaction
} from '../calculators/sell';
import { Item, ItemCost } from '../models/types';
import { getDefaultCurrencyConfig } from '../data/defaultCurrencyConfig.js';
import type { CurrencyConfig } from '../models/currency-config.js';

const mockItem: Item = {
  name: 'Potion of Healing',
  description: '',
  cost: { cp: 0, sp: 0, gp: 50, pp: 0 },
  rarity: 'Common',
  type: 'Potion',
  category: 'Consumable',
  source: 'PHB',
  link: '',
  id: 'potion-healing',
};

const mockWeapon: Item = {
  name: 'Longsword',
  description: '',
  cost: { cp: 0, sp: 0, gp: 15, pp: 0 },
  rarity: 'Common',
  type: 'Weapon',
  category: 'Martial Weapon',
  source: 'PHB',
  link: '',
  id: 'longsword',
};

const mockArmor: Item = {
  name: 'Leather Armor',
  description: '',
  cost: { cp: 0, sp: 0, gp: 10, pp: 0 },
  rarity: 'Common',
  type: 'Armor',
  category: 'Light Armor',
  source: 'PHB',
  link: '',
  id: 'leather-armor',
};

const mockScroll: Item = {
  name: 'Scroll of Fireball',
  description: '',
  cost: { cp: 0, sp: 0, gp: 300, pp: 0 },
  rarity: 'Uncommon',
  type: 'Scroll',
  category: 'Scrolls',
  source: 'PHB',
  link: '',
  id: 'scroll-fireball',
};

const mockFood: Item = {
  name: 'Rations',
  description: '',
  cost: { cp: 0, sp: 5, gp: 0, pp: 0 },
  rarity: 'Common',
  type: 'Food',
  category: 'Adventuring Gear',
  source: 'PHB',
  link: '',
  id: 'rations',
};

describe('Sell Calculation Utility', () => {
  let config: CurrencyConfig;

  beforeEach(() => {
    config = getDefaultCurrencyConfig();
  });

  describe('calculateSellPrice', () => {
    it('should calculate base sell price at 50% of item value', () => {
      const { baseSellPrice } = calculateSellPrice(mockItem, 'neutral', config);
      // 50 gp = 5000 cp. 50% of 5000 cp = 2500 cp = 2pp 5gp
      expect(baseSellPrice).toEqual({ cp: 0, sp: 0, gp: 5, pp: 2 });
    });

    it('should calculate modified sell price for hostile disposition (40%)', () => {
      const { modifiedSellPrice } = calculateSellPrice(mockItem, 'hostile', config);
      // 50 gp = 5000 cp. 40% of 5000 cp = 2000 cp = 2pp
      expect(modifiedSellPrice).toEqual({ cp: 0, sp: 0, gp: 0, pp: 2 });
    });

    it('should calculate modified sell price for unfriendly disposition (45%)', () => {
      const { modifiedSellPrice } = calculateSellPrice(mockItem, 'unfriendly', config);
      // 50 gp = 5000 cp. 45% of 5000 cp = 2250 cp = 2pp 2gp 5sp
      expect(modifiedSellPrice).toEqual({ cp: 0, sp: 5, gp: 2, pp: 2 });
    });

    it('should calculate modified sell price for neutral disposition (50%)', () => {
      const { modifiedSellPrice } = calculateSellPrice(mockItem, 'neutral', config);
      // 50 gp = 5000 cp. 50% of 5000 cp = 2500 cp = 2pp 5gp
      expect(modifiedSellPrice).toEqual({ cp: 0, sp: 0, gp: 5, pp: 2 });
    });

    it('should calculate modified sell price for friendly disposition (55%)', () => {
      const { modifiedSellPrice } = calculateSellPrice(mockItem, 'friendly', config);
      // 50 gp = 5000 cp. 55% of 5000 cp = 2750 cp = 2pp 7gp 5sp
      expect(modifiedSellPrice).toEqual({ cp: 0, sp: 5, gp: 7, pp: 2 });
    });

    it('should calculate modified sell price for helpful disposition (60%)', () => {
      const { modifiedSellPrice } = calculateSellPrice(mockItem, 'helpful', config);
      // 50 gp = 5000 cp. 60% of 5000 cp = 3000 cp = 3pp
      expect(modifiedSellPrice).toEqual({ cp: 0, sp: 0, gp: 0, pp: 3 });
    });

    it('should ensure a minimum sell price of 1 copper', () => {
      const cheapItem: Item = {
        ...mockItem,
        cost: { cp: 1, sp: 0, gp: 0, pp: 0 }, // 1 cp
      };
      const { modifiedSellPrice } = calculateSellPrice(cheapItem, 'hostile', config);
      expect(modifiedSellPrice).toEqual({ cp: 1, sp: 0, gp: 0, pp: 0 });
    });
  });

  describe('getShopInterestFilter', () => {
    it('should return correct filter for blacksmith', () => {
      expect(getShopInterestFilter('blacksmith')).toEqual(['weapon', 'armor']);
    });

    it('should return correct filter for alchemist', () => {
      expect(getShopInterestFilter('alchemist')).toEqual(['potion', 'scroll', 'poison']);
    });

    it('should return empty array for general shop (buys everything)', () => {
      expect(getShopInterestFilter('general')).toEqual([]);
      expect(getShopInterestFilter('marketplace')).toEqual([]);
    });

    it('should return empty array for unknown shop type', () => {
      expect(getShopInterestFilter('unknown')).toEqual([]);
    });
  });

  describe('isShopInterestedInItem', () => {
    it('should return true if shop buys everything', () => {
      expect(isShopInterestedInItem(mockItem, 'general')).toBe(true);
    });

    it('should return true for blacksmith and weapon', () => {
      expect(isShopInterestedInItem(mockWeapon, 'blacksmith')).toBe(true);
    });

    it('should return true for blacksmith and armor', () => {
      expect(isShopInterestedInItem(mockArmor, 'blacksmith')).toBe(true);
    });

    it('should return false for blacksmith and potion', () => {
      expect(isShopInterestedInItem(mockItem, 'blacksmith')).toBe(false);
    });

    it('should return true for alchemist and potion', () => {
      expect(isShopInterestedInItem(mockItem, 'alchemist')).toBe(true);
    });

    it('should return true for alchemist and scroll', () => {
      expect(isShopInterestedInItem(mockScroll, 'alchemist')).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(isShopInterestedInItem(mockWeapon, 'Blacksmith')).toBe(true);
      expect(isShopInterestedInItem(mockItem, 'Alchemist')).toBe(true);
    });

    it('should handle partial matches for item types', () => {
      const customPotion: Item = { ...mockItem, type: 'Healing Potion' };
      expect(isShopInterestedInItem(customPotion, 'alchemist')).toBe(true);
    });
  });

  describe('filterSellableItems', () => {
    const allItems = [mockItem, mockWeapon, mockArmor, mockScroll, mockFood];

    it('should filter items for a blacksmith', () => {
      const sellable = filterSellableItems(allItems, 'blacksmith');
      expect(sellable.length).toBe(2);
      expect(sellable).toContain(mockWeapon);
      expect(sellable).toContain(mockArmor);
    });

    it('should filter items for an alchemist', () => {
      const sellable = filterSellableItems(allItems, 'alchemist');
      expect(sellable.length).toBe(2);
      expect(sellable).toContain(mockItem);
      expect(sellable).toContain(mockScroll);
    });

    it('should return all items for a general store', () => {
      const sellable = filterSellableItems(allItems, 'general');
      expect(sellable.length).toBe(allItems.length);
    });

    it('should return no items for an uninterested shop', () => {
      const sellable = filterSellableItems(allItems, 'unknown-shop-type');
      // Unknown shop types return all items (default behavior)
      expect(sellable.length).toBe(allItems.length);
    });
  });

  describe('createSellItem', () => {
    it('should create a SellItem with calculated prices and quantity', () => {
      const sellItem = createSellItem(mockItem, 5, 'friendly');
      expect(sellItem.name).toBe('Potion of Healing');
      expect(sellItem.ownedQuantity).toBe(5);
      // 50 gp = 5000 cp. Base 50% = 2500 cp (2pp 5gp). Friendly 55% = 2750 cp (2pp 7gp 5sp)
      expect(sellItem.baseSellPrice).toEqual({ cp: 0, sp: 0, gp: 5, pp: 2 });
      expect(sellItem.sellPrice).toEqual({ cp: 0, sp: 5, gp: 7, pp: 2 });
    });
  });

  describe('canShopAffordPurchase', () => {
    it('should return true when shop can afford purchase', () => {
      const shopFunds: ItemCost = { cp: 0, sp: 0, gp: 100, pp: 0 };
      const sellTotal: ItemCost = { cp: 0, sp: 0, gp: 50, pp: 0 };

      expect(canShopAffordPurchase(shopFunds, sellTotal)).toBe(true);
    });

    it('should return false when shop cannot afford purchase', () => {
      const shopFunds: ItemCost = { cp: 0, sp: 0, gp: 25, pp: 0 };
      const sellTotal: ItemCost = { cp: 0, sp: 0, gp: 50, pp: 0 };

      expect(canShopAffordPurchase(shopFunds, sellTotal)).toBe(false);
    });

    it('should return true when amounts are equal', () => {
      const shopFunds: ItemCost = { cp: 0, sp: 0, gp: 50, pp: 0 };
      const sellTotal: ItemCost = { cp: 0, sp: 0, gp: 50, pp: 0 };

      expect(canShopAffordPurchase(shopFunds, sellTotal)).toBe(true);
    });

    it('should handle complex currency comparisons', () => {
      const shopFunds: ItemCost = { cp: 5, sp: 3, gp: 10, pp: 1 };
      const sellTotal: ItemCost = { cp: 0, sp: 0, gp: 15, pp: 0 };
      // Shop has: 1000 + 1000 + 30 + 5 = 2035 cp
      // Sell total: 1500 cp
      expect(canShopAffordPurchase(shopFunds, sellTotal)).toBe(true);
    });

    it('should return false when shop has zero funds', () => {
      const shopFunds: ItemCost = { cp: 0, sp: 0, gp: 0, pp: 0 };
      const sellTotal: ItemCost = { cp: 1, sp: 0, gp: 0, pp: 0 };

      expect(canShopAffordPurchase(shopFunds, sellTotal)).toBe(false);
    });
  });

  describe('getMaxAffordableQuantity', () => {
    it('should calculate max affordable quantity', () => {
      const shopFunds: ItemCost = { cp: 0, sp: 0, gp: 100, pp: 0 };
      const itemCost: ItemCost = { cp: 0, sp: 0, gp: 15, pp: 0 };

      const maxQty = getMaxAffordableQuantity(shopFunds, itemCost, 10, config);
      // 100 gp / 15 gp = 6.66... = 6 items max
      expect(maxQty).toBe(6);
    });

    it('should not exceed requested quantity', () => {
      const shopFunds: ItemCost = { cp: 0, sp: 0, gp: 100, pp: 0 };
      const itemCost: ItemCost = { cp: 0, sp: 0, gp: 5, pp: 0 };

      const maxQty = getMaxAffordableQuantity(shopFunds, itemCost, 10, config);
      // Could afford 20, but only 10 requested
      expect(maxQty).toBe(10);
    });

    it('should return 0 when shop has no funds', () => {
      const shopFunds: ItemCost = { cp: 0, sp: 0, gp: 0, pp: 0 };
      const itemCost: ItemCost = { cp: 0, sp: 0, gp: 10, pp: 0 };

      const maxQty = getMaxAffordableQuantity(shopFunds, itemCost, 5, config);
      expect(maxQty).toBe(0);
    });

    it('should return requested quantity for free items', () => {
      const shopFunds: ItemCost = { cp: 0, sp: 0, gp: 10, pp: 0 };
      const itemCost: ItemCost = { cp: 0, sp: 0, gp: 0, pp: 0 };

      const maxQty = getMaxAffordableQuantity(shopFunds, itemCost, 100, config);
      expect(maxQty).toBe(100);
    });

    it('should handle complex currency calculations', () => {
      const shopFunds: ItemCost = { cp: 0, sp: 0, gp: 50, pp: 0 }; // 5000 cp
      const itemCost: ItemCost = { cp: 0, sp: 7, gp: 0, pp: 0 }; // 70 cp

      const maxQty = getMaxAffordableQuantity(shopFunds, itemCost, 100, config);
      // 5000 cp / 70 cp = 71.4... = 71 items
      expect(maxQty).toBe(71);
    });
  });

  describe('updateShopFundsAfterTransaction', () => {
    it('should increase funds when shop makes sales', () => {
      const shopFunds: ItemCost = { cp: 0, sp: 0, gp: 100, pp: 0 };
      const purchases: ItemCost = { cp: 0, sp: 0, gp: 50, pp: 0 };
      const sales: ItemCost = { cp: 0, sp: 0, gp: 0, pp: 0 };

      const newFunds = updateShopFundsAfterTransaction(shopFunds, purchases, sales, config);
      // 10000cp + 5000cp = 15000cp = 15pp
      expect(newFunds).toEqual({ cp: 0, sp: 0, gp: 0, pp: 15 });
    });

    it('should decrease funds when shop makes purchases', () => {
      const shopFunds: ItemCost = { cp: 0, sp: 0, gp: 100, pp: 0 };
      const purchases: ItemCost = { cp: 0, sp: 0, gp: 0, pp: 0 };
      const sales: ItemCost = { cp: 0, sp: 0, gp: 30, pp: 0 };

      const newFunds = updateShopFundsAfterTransaction(shopFunds, purchases, sales, config);
      // 10000cp - 3000cp = 7000cp = 7pp
      expect(newFunds).toEqual({ cp: 0, sp: 0, gp: 0, pp: 7 });
    });

    it('should handle both purchases and sales', () => {
      const shopFunds: ItemCost = { cp: 0, sp: 0, gp: 100, pp: 0 };
      const purchases: ItemCost = { cp: 0, sp: 0, gp: 50, pp: 0 };
      const sales: ItemCost = { cp: 0, sp: 0, gp: 30, pp: 0 };

      const newFunds = updateShopFundsAfterTransaction(shopFunds, purchases, sales, config);
      // 10000cp + 5000cp - 3000cp = 12000cp = 12pp
      expect(newFunds).toEqual({ cp: 0, sp: 0, gp: 0, pp: 12 });
    });

    it('should return zero when transaction would result in negative funds', () => {
      const shopFunds: ItemCost = { cp: 0, sp: 0, gp: 50, pp: 0 };
      const purchases: ItemCost = { cp: 0, sp: 0, gp: 0, pp: 0 };
      const sales: ItemCost = { cp: 0, sp: 0, gp: 100, pp: 0 };

      const newFunds = updateShopFundsAfterTransaction(shopFunds, purchases, sales, config);
      // Would be negative, should reset to zero
      expect(newFunds).toEqual({ cp: 0, sp: 0, gp: 0, pp: 0 });
    });

    it('should handle complex multi-currency transactions', () => {
      const shopFunds: ItemCost = { cp: 5, sp: 3, gp: 10, pp: 1 };
      const purchases: ItemCost = { cp: 0, sp: 5, gp: 5, pp: 0 };
      const sales: ItemCost = { cp: 10, sp: 2, gp: 3, pp: 0 };

      const newFunds = updateShopFundsAfterTransaction(shopFunds, purchases, sales, config);

      // Convert to copper for verification
      const initialCopper = 5 + 30 + 1000 + 1000; // 2035
      const purchasesCopper = 50 + 500; // 550
      const salesCopper = 10 + 20 + 300; // 330
      const expectedCopper = initialCopper + purchasesCopper - salesCopper; // 2255

      const resultCopper = newFunds.cp + (newFunds.sp * 10) +
                          (newFunds.gp * 100) + (newFunds.pp * 1000);
      expect(resultCopper).toBe(2255);
    });
  });
});
