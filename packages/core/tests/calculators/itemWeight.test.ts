import { describe, it, expect } from 'vitest';
import {
	getItemWeight,
	resolveVariantWeight,
	buildSRDWeightsMap,
	ItemWeightConfig
} from '../../calculators/itemWeight';
import { Item } from '../../models/types';

describe('itemWeight', () => {
	// Mock data
	const mockConfig: ItemWeightConfig = {
		specificWeights: {
			'longsword': 3,
			'potion of healing': 0.5,
			'custom item': 10
		},
		typeDefaults: {
			'weapon': 3,
			'potion': 0.5,
			'armor': 20,
			'tool': 5
		}
	};

	const mockSRDWeights = new Map<string, number>([
		['dagger', 1],
		['shortsword', 2],
		['leather armor', 10],
		['backpack', 5]
	]);

	const createMockItem = (name: string, type: string, weight?: number): Item => ({
		name,
		cost: { gp: 1 },
		type,
		rarity: 'common',
		description: 'Test item',
		source: 'test',
		file: { path: '/test', name: 'test' },
		category: 'test',
		weight
	});

	describe('getItemWeight - 4-Tier Fallback', () => {
		it('Tier 1: should use item explicit weight field', () => {
			const item = createMockItem('Test Item', 'weapon', 25);
			const weight = getItemWeight(item, mockConfig, mockSRDWeights);
			expect(weight).toBe(25);
		});

		it('Tier 1: should handle zero weight', () => {
			const item = createMockItem('Sling', 'weapon', 0);
			const weight = getItemWeight(item, mockConfig, mockSRDWeights);
			expect(weight).toBe(0);
		});

		it('Tier 2: should use config specific weight when item has no weight', () => {
			const item = createMockItem('Longsword', 'weapon');
			const weight = getItemWeight(item, mockConfig, mockSRDWeights);
			expect(weight).toBe(3); // From specificWeights
		});

		it('Tier 2: should be case-insensitive for config lookup', () => {
			const item = createMockItem('LONGSWORD', 'weapon');
			const weight = getItemWeight(item, mockConfig, mockSRDWeights);
			expect(weight).toBe(3);
		});

		it('Tier 3: should use SRD database weight', () => {
			const item = createMockItem('Dagger', 'weapon');
			const weight = getItemWeight(item, mockConfig, mockSRDWeights);
			expect(weight).toBe(1); // From SRD
		});

		it('Tier 3: should be case-insensitive for SRD lookup', () => {
			const item = createMockItem('DAGGER', 'weapon');
			const weight = getItemWeight(item, mockConfig, mockSRDWeights);
			expect(weight).toBe(1);
		});

		it('Tier 4: should use type default weight', () => {
			const item = createMockItem('Unknown Weapon', 'weapon');
			const weight = getItemWeight(item, mockConfig, mockSRDWeights);
			expect(weight).toBe(3); // From typeDefaults
		});

		it('Tier 4: should be case-insensitive for type lookup', () => {
			const item = createMockItem('Unknown Item', 'WEAPON');
			const weight = getItemWeight(item, mockConfig, mockSRDWeights);
			expect(weight).toBe(3);
		});

		it('Tier 5: should use final fallback (1 lb) when nothing matches', () => {
			const item = createMockItem('Mystery Item', 'unknown_type');
			const weight = getItemWeight(item, {}, new Map());
			expect(weight).toBe(1); // Final fallback
		});

		it('should prioritize tiers correctly (explicit > config > SRD > type > fallback)', () => {
			// Item has explicit weight - should use it even though other tiers have data
			const itemWithWeight = createMockItem('Longsword', 'weapon', 100);
			expect(getItemWeight(itemWithWeight, mockConfig, mockSRDWeights)).toBe(100);

			// Config should override SRD
			const config: ItemWeightConfig = {
				specificWeights: { 'dagger': 5 },
				typeDefaults: {}
			};
			const item = createMockItem('Dagger', 'weapon');
			expect(getItemWeight(item, config, mockSRDWeights)).toBe(5); // Config, not SRD's 1
		});
	});

	describe('resolveVariantWeight', () => {
		const baseItems: Item[] = [
			createMockItem('Longsword', 'weapon', 3),
			createMockItem('Leather Armor', 'armor', 10),
			createMockItem('Potion of Healing', 'potion', 0.5)
		];

		it('should use variant explicit weight if provided', () => {
			const variant = createMockItem('Longsword +1', 'weapon', 5);
			const weight = resolveVariantWeight(variant, baseItems, mockConfig, mockSRDWeights);
			expect(weight).toBe(5);
		});

		it('should inherit weight from base item (remove +1)', () => {
			const variant = createMockItem('Longsword +1', 'weapon');
			const weight = resolveVariantWeight(variant, baseItems, mockConfig, mockSRDWeights);
			expect(weight).toBe(3); // From base Longsword
		});

		it('should inherit weight from base item (remove +2)', () => {
			const variant = createMockItem('Longsword +2', 'weapon');
			const weight = resolveVariantWeight(variant, baseItems, mockConfig, mockSRDWeights);
			expect(weight).toBe(3);
		});

		it('should inherit weight from base item (remove +3)', () => {
			const variant = createMockItem('Longsword +3', 'weapon');
			const weight = resolveVariantWeight(variant, baseItems, mockConfig, mockSRDWeights);
			expect(weight).toBe(3);
		});

		it('should inherit weight from base item (remove "of [something]")', () => {
			const variant = createMockItem('Longsword of Sharpness', 'weapon');
			const weight = resolveVariantWeight(variant, baseItems, mockConfig, mockSRDWeights);
			expect(weight).toBe(3);
		});

		it('should handle armor variants', () => {
			const variant = createMockItem('Leather Armor of Fire Resistance', 'armor');
			const weight = resolveVariantWeight(variant, baseItems, mockConfig, mockSRDWeights);
			expect(weight).toBe(10);
		});

		it('should handle potion variants', () => {
			const variant = createMockItem('Potion of Healing (Greater)', 'potion');
			// Won't match "Potion of Healing" because extraction removes "of Healing"
			// Falls back to standard weight calculation
			const weight = resolveVariantWeight(variant, baseItems, mockConfig, mockSRDWeights);
			expect(weight).toBe(0.5); // From type default
		});

		it('should fallback to standard calculation when base not found', () => {
			const variant = createMockItem('Greatsword +1', 'weapon');
			const weight = resolveVariantWeight(variant, baseItems, mockConfig, mockSRDWeights);
			expect(weight).toBe(3); // From type default
		});

		it('should be case-insensitive when matching base items', () => {
			const variant = createMockItem('LONGSWORD +1', 'weapon');
			const weight = resolveVariantWeight(variant, baseItems, mockConfig, mockSRDWeights);
			expect(weight).toBe(3);
		});
	});

	describe('buildSRDWeightsMap', () => {
		it('should build map from SRD items with weights', () => {
			const srdItems: Item[] = [
				createMockItem('Dagger', 'weapon', 1),
				createMockItem('Longsword', 'weapon', 3),
				createMockItem('Potion', 'potion', 0.5)
			];

			const map = buildSRDWeightsMap(srdItems);

			expect(map.size).toBe(3);
			expect(map.get('dagger')).toBe(1);
			expect(map.get('longsword')).toBe(3);
			expect(map.get('potion')).toBe(0.5);
		});

		it('should skip items without weight', () => {
			const srdItems: Item[] = [
				createMockItem('Dagger', 'weapon', 1),
				createMockItem('Unknown', 'weapon'), // No weight
				createMockItem('Potion', 'potion', 0.5)
			];

			const map = buildSRDWeightsMap(srdItems);

			expect(map.size).toBe(2);
			expect(map.has('unknown')).toBe(false);
		});

		it('should handle empty array', () => {
			const map = buildSRDWeightsMap([]);
			expect(map.size).toBe(0);
		});

		it('should use lowercase keys', () => {
			const srdItems: Item[] = [
				createMockItem('DAGGER', 'weapon', 1),
				createMockItem('LongSword', 'weapon', 3)
			];

			const map = buildSRDWeightsMap(srdItems);

			expect(map.get('dagger')).toBe(1);
			expect(map.get('longsword')).toBe(3);
			expect(map.has('DAGGER')).toBe(false);
			expect(map.has('LongSword')).toBe(false);
		});

		it('should handle zero weight items', () => {
			const srdItems: Item[] = [
				createMockItem('Sling', 'weapon', 0)
			];

			const map = buildSRDWeightsMap(srdItems);

			expect(map.size).toBe(1);
			expect(map.get('sling')).toBe(0);
		});
	});

	describe('Edge Cases', () => {
		it('should handle fractional weights', () => {
			const item = createMockItem('Dart', 'weapon', 0.25);
			const weight = getItemWeight(item, mockConfig, mockSRDWeights);
			expect(weight).toBe(0.25);
		});

		it('should handle very large weights', () => {
			const item = createMockItem('Anvil', 'misc', 500);
			const weight = getItemWeight(item, mockConfig, mockSRDWeights);
			expect(weight).toBe(500);
		});

		it('should handle null weight as undefined', () => {
			const item = createMockItem('Test', 'weapon');
			item.weight = null as any;
			const weight = getItemWeight(item, mockConfig, mockSRDWeights);
			expect(weight).toBe(3); // Falls through to type default
		});

		it('should handle items with no type', () => {
			const item = createMockItem('Mystery', '');
			const weight = getItemWeight(item, mockConfig, mockSRDWeights);
			expect(weight).toBe(1); // Final fallback
		});

		it('should handle empty config', () => {
			const item = createMockItem('Test', 'weapon');
			const weight = getItemWeight(item, {}, new Map());
			expect(weight).toBe(1);
		});
	});
});
