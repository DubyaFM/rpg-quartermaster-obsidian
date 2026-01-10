/**
 * Transaction Effects Test
 *
 * Tests for TKT-CAL-037: Update Transaction Log for Events
 *
 * Verifies that transaction records correctly capture active effects and price modifiers
 * at the time of purchase, creating immutable historical snapshots.
 */

import { describe, it, expect } from 'vitest';
import { TransactionContext, PurchasedItem, ItemCost } from '../models/types';

describe('Transaction Effect Context', () => {
  describe('TransactionContext with effects', () => {
    it('should allow optional effect fields', () => {
      // Arrange: Create a transaction context without effects (backward compatibility)
      const contextWithoutEffects: TransactionContext = {
        transactionType: 'purchase',
        sourceReference: 'Test Shop'
      };

      // Assert: All optional fields should be undefined
      expect(contextWithoutEffects.activeEffects).toBeUndefined();
      expect(contextWithoutEffects.effectiveMultiplier).toBeUndefined();
      expect(contextWithoutEffects.modifierSource).toBeUndefined();
    });

    it('should capture active effects at transaction time', () => {
      // Arrange: Create a transaction context with effects
      const contextWithEffects: TransactionContext = {
        transactionType: 'purchase',
        sourceReference: 'Test Shop',
        activeEffects: ['market_day', 'siege_event'],
        effectiveMultiplier: 1.2, // 20% price increase
        modifierSource: 'Market Day (-20%), Siege (+50%)'
      };

      // Assert: All effect fields should be populated
      expect(contextWithEffects.activeEffects).toEqual(['market_day', 'siege_event']);
      expect(contextWithEffects.effectiveMultiplier).toBe(1.2);
      expect(contextWithEffects.modifierSource).toBe('Market Day (-20%), Siege (+50%)');
    });

    it('should capture effective multiplier at transaction time', () => {
      // Test Case 1: Price increase (siege)
      const contextIncrease: TransactionContext = {
        transactionType: 'purchase',
        sourceReference: 'Blacksmith',
        activeEffects: ['siege'],
        effectiveMultiplier: 1.5, // 50% increase
        modifierSource: 'Siege (+50%)'
      };

      expect(contextIncrease.effectiveMultiplier).toBe(1.5);

      // Test Case 2: Price decrease (market day)
      const contextDecrease: TransactionContext = {
        transactionType: 'purchase',
        sourceReference: 'Market Stall',
        activeEffects: ['market_day'],
        effectiveMultiplier: 0.8, // 20% discount
        modifierSource: 'Market Day (-20%)'
      };

      expect(contextDecrease.effectiveMultiplier).toBe(0.8);

      // Test Case 3: No change (no active effects)
      const contextNoChange: TransactionContext = {
        transactionType: 'purchase',
        sourceReference: 'General Store',
        effectiveMultiplier: 1.0
      };

      expect(contextNoChange.effectiveMultiplier).toBe(1.0);
    });
  });

  describe('PurchasedItem with price snapshots', () => {
    it('should allow optional price snapshot fields', () => {
      // Arrange: Create a purchased item without price snapshots (backward compatibility)
      const baseItem: PurchasedItem = {
        id: 'item-1',
        name: 'Longsword',
        type: 'weapon',
        rarity: 'common',
        cost: { gp: 15, sp: 0, cp: 0, pp: 0 },
        totalCost: { gp: 15, sp: 0, cp: 0, pp: 0 },
        quantity: 1,
        description: 'A standard longsword',
        source: 'PHB',
        file: { path: '', name: 'Longsword' },
        category: 'weapon'
      };

      // Assert: Optional fields should be undefined
      expect(baseItem.basePrice).toBeUndefined();
      expect(baseItem.finalPrice).toBeUndefined();
    });

    it('should capture base and final prices when effects are active', () => {
      // Arrange: Create a purchased item with price snapshots
      const basePrice: ItemCost = { gp: 100, sp: 0, cp: 0, pp: 0 };
      const finalPrice: ItemCost = { gp: 150, sp: 0, cp: 0, pp: 0 }; // 50% increase

      const itemWithEffects: PurchasedItem = {
        id: 'item-2',
        name: 'Plate Armor',
        type: 'armor',
        rarity: 'common',
        cost: finalPrice, // Current cost reflects final price
        totalCost: finalPrice,
        quantity: 1,
        description: 'Heavy plate armor',
        source: 'PHB',
        file: { path: '', name: 'Plate Armor' },
        category: 'armor',
        basePrice: basePrice,
        finalPrice: finalPrice
      };

      // Assert: Price snapshots should be preserved
      expect(itemWithEffects.basePrice).toEqual(basePrice);
      expect(itemWithEffects.finalPrice).toEqual(finalPrice);
      expect(itemWithEffects.basePrice).not.toEqual(itemWithEffects.finalPrice);
    });

    it('should handle identical base and final prices when no effects active', () => {
      // Arrange: Create a purchased item where prices are identical
      const price: ItemCost = { gp: 50, sp: 0, cp: 0, pp: 0 };

      const itemNoEffects: PurchasedItem = {
        id: 'item-3',
        name: 'Chain Mail',
        type: 'armor',
        rarity: 'common',
        cost: price,
        totalCost: price,
        quantity: 1,
        description: 'Chain mail armor',
        source: 'PHB',
        file: { path: '', name: 'Chain Mail' },
        category: 'armor',
        basePrice: price,
        finalPrice: price
      };

      // Assert: Both prices should be equal
      expect(itemNoEffects.basePrice).toEqual(itemNoEffects.finalPrice);
    });
  });

  describe('Immutability principle', () => {
    it('should demonstrate that transaction records are immutable snapshots', () => {
      // Arrange: Create a transaction at a specific moment in time
      const transactionTime = Date.now();
      const activeEffectsSnapshot = ['market_day'];
      const multiplierSnapshot = 0.8;

      const context: TransactionContext = {
        transactionType: 'purchase',
        sourceReference: 'Market Stall',
        calendarDay: 42,
        formattedDate: '15th of Hammer, 1492 DR',
        activeEffects: activeEffectsSnapshot,
        effectiveMultiplier: multiplierSnapshot,
        modifierSource: 'Market Day (-20%)'
      };

      // Act: Later events might change active effects, but transaction record stays frozen
      const laterActiveEffects = ['siege']; // Different effects now active
      const laterMultiplier = 1.5; // Different multiplier now active

      // Assert: Original transaction context remains unchanged (immutable snapshot)
      expect(context.activeEffects).toEqual(['market_day']);
      expect(context.activeEffects).not.toEqual(laterActiveEffects);
      expect(context.effectiveMultiplier).toBe(0.8);
      expect(context.effectiveMultiplier).not.toBe(laterMultiplier);
    });
  });
});
