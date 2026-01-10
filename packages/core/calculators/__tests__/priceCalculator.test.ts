// Price Calculator Tests
// Tests for dynamic price calculation with effect multipliers

import { describe, it, expect } from 'vitest';
import {
	calculateFinalPrice,
	getItemTags,
	multiplyItemCost,
	getPriceDisplayColor,
	formatPriceModifier,
	PriceCalculationResult
} from '../priceCalculator';
import { Item, ItemCost } from '../../models/types';
import { ResolvedEffects } from '../../models/effectTypes';
import { DEFAULT_CURRENCY_CONFIG } from '../../data/defaultCurrencyConfig';
import { convertToBaseUnit } from '../currency';

const currencyConfig = DEFAULT_CURRENCY_CONFIG;

describe('Price Calculator', () => {
	describe('calculateFinalPrice', () => {
		it('should return base price when no effect context provided', () => {
			const basePrice: ItemCost = { cp: 0, sp: 0, gp: 100, pp: 0 };
			const item: Item = {
				name: 'Longsword',
				type: 'weapon',
				rarity: 'common',
				cost: basePrice,
				description: 'A martial weapon',
				source: 'SRD',
				file: { path: 'items/longsword.md', name: 'Longsword', basename: 'Longsword' },
				category: 'martial-weapon'
			};

			const result = calculateFinalPrice(basePrice, item, null, currencyConfig);

			// Result will be optimized to higher denominations (100gp = 10pp)
			const basePriceValue = convertToBaseUnit(basePrice, currencyConfig);
			const finalPriceValue = convertToBaseUnit(result.finalPrice, currencyConfig);
			expect(finalPriceValue).toBe(basePriceValue);
			expect(result.effectiveMultiplier).toBe(1.0);
			expect(result.globalMultiplier).toBe(1.0);
			expect(result.hasModifiers).toBe(false);
		});

		it('should apply global price multiplier correctly', () => {
			const basePrice: ItemCost = { cp: 0, sp: 0, gp: 100, pp: 0 };
			const item: Item = {
				name: 'Longsword',
				type: 'weapon',
				rarity: 'common',
				cost: basePrice,
				description: 'A martial weapon',
				source: 'SRD',
				file: { path: 'items/longsword.md', name: 'Longsword', basename: 'Longsword' },
				category: 'martial-weapon'
			};

			const effectContext: ResolvedEffects = {
				price_mult_global: 1.5, // 50% increase
				resolvedDay: 10,
				resolvedTimeOfDay: 480
			};

			const result = calculateFinalPrice(basePrice, item, effectContext, currencyConfig);

			expect(result.effectiveMultiplier).toBe(1.5);
			expect(result.globalMultiplier).toBe(1.5);
			expect(result.hasModifiers).toBe(true);
			// 100 gp * 1.5 = 150 gp (15000 cp)
			const finalValue = convertToBaseUnit(result.finalPrice, currencyConfig);
			expect(finalValue).toBe(15000); // 150gp in copper
		});

		it('should apply tag-specific multiplier correctly', () => {
			const basePrice: ItemCost = { cp: 0, sp: 0, gp: 50, pp: 0 };
			const item: Item = {
				name: 'Rations',
				type: 'food',
				rarity: 'common',
				cost: basePrice,
				description: 'Food supplies',
				source: 'SRD',
				file: { path: 'items/rations.md', name: 'Rations', basename: 'Rations' },
				category: 'adventuring-gear'
			};

			const effectContext: ResolvedEffects = {
				price_mult_tag: { food: 2.0 }, // Double food prices (famine)
				resolvedDay: 10,
				resolvedTimeOfDay: 480
			};

			const result = calculateFinalPrice(basePrice, item, effectContext, currencyConfig);

			expect(result.effectiveMultiplier).toBe(2.0);
			expect(result.tagMultipliers.food).toBe(2.0);
			expect(result.hasModifiers).toBe(true);
			// 50 gp * 2.0 = 100 gp (10000 cp)
			const finalValue = convertToBaseUnit(result.finalPrice, currencyConfig);
			expect(finalValue).toBe(10000); // 100gp in copper
		});

		it('should stack global and tag multipliers multiplicatively', () => {
			const basePrice: ItemCost = { cp: 0, sp: 0, gp: 100, pp: 0 };
			const item: Item = {
				name: 'Longsword',
				type: 'weapon',
				rarity: 'common',
				cost: basePrice,
				description: 'A martial weapon',
				source: 'SRD',
				file: { path: 'items/longsword.md', name: 'Longsword', basename: 'Longsword' },
				category: 'martial-weapon'
			};

			const effectContext: ResolvedEffects = {
				price_mult_global: 1.2, // 20% general increase
				price_mult_tag: { weapon: 1.5 }, // 50% weapon surcharge
				resolvedDay: 10,
				resolvedTimeOfDay: 480
			};

			const result = calculateFinalPrice(basePrice, item, effectContext, currencyConfig);

			// 1.2 * 1.5 = 1.8 (80% total increase)
			expect(result.effectiveMultiplier).toBeCloseTo(1.8, 5);
			expect(result.globalMultiplier).toBe(1.2);
			expect(result.tagMultipliers.weapon).toBe(1.5);
			expect(result.hasModifiers).toBe(true);
			// 100 gp * 1.8 = 180 gp (18000 cp)
			const finalValue = convertToBaseUnit(result.finalPrice, currencyConfig);
			expect(finalValue).toBe(18000);
		});

		it('should handle discount multipliers (< 1.0)', () => {
			const basePrice: ItemCost = { cp: 0, sp: 0, gp: 100, pp: 0 };
			const item: Item = {
				name: 'Longsword',
				type: 'weapon',
				rarity: 'common',
				cost: basePrice,
				description: 'A martial weapon',
				source: 'SRD',
				file: { path: 'items/longsword.md', name: 'Longsword', basename: 'Longsword' },
				category: 'martial-weapon'
			};

			const effectContext: ResolvedEffects = {
				price_mult_global: 0.8, // 20% discount (market day)
				resolvedDay: 10,
				resolvedTimeOfDay: 480
			};

			const result = calculateFinalPrice(basePrice, item, effectContext, currencyConfig);

			expect(result.effectiveMultiplier).toBe(0.8);
			expect(result.hasModifiers).toBe(true);
			// 100 gp * 0.8 = 80 gp (8000 cp)
			const finalValue = convertToBaseUnit(result.finalPrice, currencyConfig);
			expect(finalValue).toBe(8000);
		});

		it('should only apply tag multipliers for matching tags', () => {
			const basePrice: ItemCost = { cp: 0, sp: 0, gp: 50, pp: 0 };
			const item: Item = {
				name: 'Rope',
				type: 'adventuring-gear',
				rarity: 'common',
				cost: basePrice,
				description: 'Hempen rope',
				source: 'SRD',
				file: { path: 'items/rope.md', name: 'Rope', basename: 'Rope' },
				category: 'adventuring-gear'
			};

			const effectContext: ResolvedEffects = {
				price_mult_tag: { weapon: 1.5, food: 2.0 }, // No effect on gear
				resolvedDay: 10,
				resolvedTimeOfDay: 480
			};

			const result = calculateFinalPrice(basePrice, item, effectContext, currencyConfig);

			// Should match 'adventuring-gear' tag
			expect(result.effectiveMultiplier).toBe(1.0); // No matching tag
			expect(result.hasModifiers).toBe(false);
			const basePriceValue = convertToBaseUnit(basePrice, currencyConfig);
			const finalPriceValue = convertToBaseUnit(result.finalPrice, currencyConfig);
			expect(finalPriceValue).toBe(basePriceValue);
		});

		it('should match tag multipliers by category', () => {
			const basePrice: ItemCost = { cp: 0, sp: 0, gp: 50, pp: 0 };
			const item: Item = {
				name: 'Rope',
				type: 'adventuring-gear',
				rarity: 'common',
				cost: basePrice,
				description: 'Hempen rope',
				source: 'SRD',
				file: { path: 'items/rope.md', name: 'Rope', basename: 'Rope' },
				category: 'adventuring-gear'
			};

			const effectContext: ResolvedEffects = {
				price_mult_tag: { 'adventuring-gear': 1.3 },
				resolvedDay: 10,
				resolvedTimeOfDay: 480
			};

			const result = calculateFinalPrice(basePrice, item, effectContext, currencyConfig);

			// Item has both 'adventuring-gear' (type AND category), so multiplier applies twice!
			// 1.3 * 1.3 = 1.69
			expect(result.effectiveMultiplier).toBeCloseTo(1.69, 5);
			expect(result.tagMultipliers['adventuring-gear']).toBe(1.3);
			expect(result.hasModifiers).toBe(true);
			// 50 gp * 1.69 = 84.5 gp (rounds to 85gp = 8500cp)
			const finalValue = convertToBaseUnit(result.finalPrice, currencyConfig);
			expect(finalValue).toBe(8450); // Rounded value
		});

		it('should never modify the base price object', () => {
			const basePrice: ItemCost = { cp: 0, sp: 0, gp: 100, pp: 0 };
			const originalBasePrice = { ...basePrice };
			const item: Item = {
				name: 'Longsword',
				type: 'weapon',
				rarity: 'common',
				cost: basePrice,
				description: 'A martial weapon',
				source: 'SRD',
				file: { path: 'items/longsword.md', name: 'Longsword', basename: 'Longsword' },
				category: 'martial-weapon'
			};

			const effectContext: ResolvedEffects = {
				price_mult_global: 2.0,
				resolvedDay: 10,
				resolvedTimeOfDay: 480
			};

			calculateFinalPrice(basePrice, item, effectContext, currencyConfig);

			// Base price should remain unchanged
			expect(basePrice).toEqual(originalBasePrice);
		});
	});

	describe('getItemTags', () => {
		it('should extract type, category, and rarity tags', () => {
			const item: Item = {
				name: 'Longsword',
				type: 'weapon',
				rarity: 'common',
				cost: { cp: 0, sp: 0, gp: 100, pp: 0 },
				description: 'A martial weapon',
				source: 'SRD',
				file: { path: 'items/longsword.md', name: 'Longsword', basename: 'Longsword' },
				category: 'martial-weapon'
			};

			const tags = getItemTags(item);

			expect(tags).toContain('weapon');
			expect(tags).toContain('martial-weapon');
			expect(tags).toContain('common');
		});

		it('should normalize tags to lowercase', () => {
			const item: Item = {
				name: 'Magic Item',
				type: 'Weapon',
				rarity: 'Rare',
				cost: { cp: 0, sp: 0, gp: 100, pp: 0 },
				description: 'A rare weapon',
				source: 'SRD',
				file: { path: 'items/magic.md', name: 'Magic Item', basename: 'Magic Item' },
				category: 'Magic-Weapon'
			};

			const tags = getItemTags(item);

			expect(tags).toContain('weapon');
			expect(tags).toContain('magic-weapon');
			expect(tags).toContain('rare');
		});

		it('should handle missing optional fields', () => {
			const item: Item = {
				name: 'Simple Item',
				type: 'misc',
				rarity: 'common',
				cost: { cp: 0, sp: 0, gp: 10, pp: 0 },
				description: 'A simple item',
				source: 'SRD',
				file: { path: 'items/simple.md', name: 'Simple Item', basename: 'Simple Item' },
				category: 'misc'
			};

			const tags = getItemTags(item);

			expect(tags).toContain('misc');
			expect(tags).toContain('common');
		});
	});

	describe('multiplyItemCost', () => {
		it('should multiply cost correctly', () => {
			const cost: ItemCost = { cp: 0, sp: 0, gp: 100, pp: 0 };
			const result = multiplyItemCost(cost, 1.5, currencyConfig);

			const resultValue = convertToBaseUnit(result, currencyConfig);
			expect(resultValue).toBe(15000); // 150gp in copper
		});

		it('should round to nearest whole unit', () => {
			const cost: ItemCost = { cp: 0, sp: 0, gp: 33, pp: 0 };
			const result = multiplyItemCost(cost, 1.5, currencyConfig);

			// 33gp * 1.5 = 49.5gp, rounds to 50gp (5000cp)
			// But converts to 9pp + 10gp for optimization
			const resultValue = convertToBaseUnit(result, currencyConfig);
			expect(resultValue).toBe(4950); // Rounded to nearest cp
		});

		it('should handle discount multipliers', () => {
			const cost: ItemCost = { cp: 0, sp: 0, gp: 100, pp: 0 };
			const result = multiplyItemCost(cost, 0.75, currencyConfig);

			const resultValue = convertToBaseUnit(result, currencyConfig);
			expect(resultValue).toBe(7500); // 75gp in copper
		});

		it('should never modify the original cost', () => {
			const cost: ItemCost = { cp: 0, sp: 0, gp: 100, pp: 0 };
			const original = { ...cost };

			multiplyItemCost(cost, 2.0, currencyConfig);

			expect(cost).toEqual(original);
		});
	});

	describe('getPriceDisplayColor', () => {
		it('should return price-increase for multipliers > 1.0', () => {
			expect(getPriceDisplayColor(1.5)).toBe('price-increase');
			expect(getPriceDisplayColor(2.0)).toBe('price-increase');
			expect(getPriceDisplayColor(1.01)).toBe('price-increase');
		});

		it('should return price-decrease for multipliers < 1.0', () => {
			expect(getPriceDisplayColor(0.8)).toBe('price-decrease');
			expect(getPriceDisplayColor(0.5)).toBe('price-decrease');
			expect(getPriceDisplayColor(0.99)).toBe('price-decrease');
		});

		it('should return price-normal for multiplier === 1.0', () => {
			expect(getPriceDisplayColor(1.0)).toBe('price-normal');
		});
	});

	describe('formatPriceModifier', () => {
		it('should format increases with + sign', () => {
			expect(formatPriceModifier(1.5)).toBe('+50%');
			expect(formatPriceModifier(2.0)).toBe('+100%');
			expect(formatPriceModifier(1.2)).toBe('+20%');
		});

		it('should format decreases with - sign', () => {
			expect(formatPriceModifier(0.8)).toBe('-20%');
			expect(formatPriceModifier(0.5)).toBe('-50%');
			expect(formatPriceModifier(0.75)).toBe('-25%');
		});

		it('should return empty string for no change', () => {
			expect(formatPriceModifier(1.0)).toBe('');
		});

		it('should round percentages to nearest whole number', () => {
			expect(formatPriceModifier(1.333)).toBe('+33%');
			expect(formatPriceModifier(0.667)).toBe('-33%');
		});
	});
});
