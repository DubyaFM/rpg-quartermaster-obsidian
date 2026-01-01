import { describe, it, expect, vi } from 'vitest';
import {
	generateRandomShopkeep,
	rerollShopkeepTrait,
	flattenSpeciesTiers
} from '../generators/shopkeeper';
import { IRandomizer } from '../interfaces/IRandomizer';
import { RawShopkeepConfig } from '../interfaces/IConfigAdapter';

// Mock randomizer
const mockRandomizer: IRandomizer = {
	randomInt: vi.fn((min, max) => Math.floor((min + max) / 2)),
	randomFloat: vi.fn(() => 0.5),
	randomChoice: vi.fn((arr) => arr[0]),
	weightedChoice: vi.fn((items, weights) => items[0]),
	rollDice: vi.fn(() => ({ total: 10, breakdown: '2d6 = 10' })),
	rollPercentile: vi.fn(() => 50),
	chance: vi.fn((percent) => percent > 50)
};

// Mock shopkeeper config with weighted species
const mockShopkeepConfig: RawShopkeepConfig = {
	names: {
		male: ['Aldric', 'Borin', 'Cedric'],
		female: ['Aria', 'Brynn', 'Celia'],
		neutral: ['Ash', 'Brook', 'Cedar']
	},
	surnames: ['Ironforge', 'Goldleaf', 'Stonewell'],
	genders: ['male', 'female', 'non-binary'],
	species: {
		tier1: [{ name: 'Human', weight: 25.0 }],
		tier2: [
			{ name: 'Dwarf', weight: 15.0 },
			{ name: 'Halfling', weight: 15.0 }
		],
		tier3: [
			{ name: 'Elf', weight: 3.57 },
			{ name: 'Tiefling', weight: 3.57 }
		],
		tier4: [
			{ name: 'Tabaxi', weight: 0.71 },
			{ name: 'Kenku', weight: 0.71 }
		]
	},
	dispositions: [
		{ type: 'hostile', weight: 5, description: 'Hostile', dc: 20 },
		{ type: 'neutral', weight: 50, description: 'Neutral', dc: 10 },
		{ type: 'friendly', weight: 20, description: 'Friendly', dc: 5 }
	],
	quirks: [
		'Always speaks in rhymes',
		'Has a pet rat',
		'Never makes eye contact'
	],
	motivations: [
		'Saving for retirement',
		'Building a trading empire',
		'Supporting family'
	]
};

describe('Shopkeeper Generator - Weighted Species', () => {
	describe('flattenSpeciesTiers', () => {
		it('should flatten all species tiers into single array', () => {
			const flattened = flattenSpeciesTiers(mockShopkeepConfig.species);

			expect(flattened).toHaveLength(7); // 1 + 2 + 2 + 2
			expect(flattened.find(s => s.name === 'Human')).toBeDefined();
			expect(flattened.find(s => s.name === 'Tabaxi')).toBeDefined();
		});

		it('should preserve weights', () => {
			const flattened = flattenSpeciesTiers(mockShopkeepConfig.species);

			const human = flattened.find(s => s.name === 'Human');
			expect(human?.weight).toBe(25.0);

			const tabaxi = flattened.find(s => s.name === 'Tabaxi');
			expect(tabaxi?.weight).toBe(0.71);
		});

		it('should handle empty tiers', () => {
			const emptyConfig = {
				tier1: [],
				tier2: [],
				tier3: [],
				tier4: []
			};

			const flattened = flattenSpeciesTiers(emptyConfig);
			expect(flattened).toHaveLength(0);
		});

		it('should handle partial tiers', () => {
			const partialConfig = {
				tier1: [{ name: 'Human', weight: 50 }],
				tier2: [],
				tier3: [{ name: 'Elf', weight: 25 }],
				tier4: []
			};

			const flattened = flattenSpeciesTiers(partialConfig);
			expect(flattened).toHaveLength(2);
		});
	});

	describe('generateRandomShopkeep - new format', () => {
		it('should generate shopkeep with weighted species selection', () => {
			const shopkeep = generateRandomShopkeep(mockRandomizer, mockShopkeepConfig);

			expect(shopkeep).toBeDefined();
			expect(shopkeep.name).toBeDefined();
			expect(shopkeep.species).toBeDefined();
			expect(shopkeep.gender).toBeDefined();
			expect(shopkeep.disposition).toBeDefined();
			expect(shopkeep.quirk).toBeDefined();
			expect(shopkeep.bargainDC).toBeDefined();
		});

		it('should use weightedChoice for species selection', () => {
			generateRandomShopkeep(mockRandomizer, mockShopkeepConfig);

			// Check that weightedChoice was called for species
			expect(mockRandomizer.weightedChoice).toHaveBeenCalled();
		});

		it('should select name based on gender (male)', () => {
			(mockRandomizer.randomChoice as any).mockImplementation((arr: any[]) => {
				if (arr.includes('male')) return 'male';
				if (arr.includes('Aldric')) return 'Aldric';
				return arr[0];
			});

			const shopkeep = generateRandomShopkeep(mockRandomizer, mockShopkeepConfig);

			expect(shopkeep.gender).toBe('male');
			expect(['Aldric', 'Borin', 'Cedric'].some(n => shopkeep.name.includes(n))).toBe(true);
		});

		it('should select name based on gender (female)', () => {
			(mockRandomizer.randomChoice as any).mockImplementation((arr: any[]) => {
				if (arr.includes('female')) return 'female';
				if (arr.includes('Aria')) return 'Aria';
				return arr[0];
			});

			const shopkeep = generateRandomShopkeep(mockRandomizer, mockShopkeepConfig);

			expect(shopkeep.gender).toBe('female');
			expect(['Aria', 'Brynn', 'Celia'].some(n => shopkeep.name.includes(n))).toBe(true);
		});

		it('should select name based on gender (non-binary)', () => {
			(mockRandomizer.randomChoice as any).mockImplementation((arr: any[]) => {
				if (arr.includes('non-binary')) return 'non-binary';
				if (arr.includes('Ash')) return 'Ash';
				return arr[0];
			});

			const shopkeep = generateRandomShopkeep(mockRandomizer, mockShopkeepConfig);

			expect(shopkeep.gender).toBe('non-binary');
			expect(['Ash', 'Brook', 'Cedar'].some(n => shopkeep.name.includes(n))).toBe(true);
		});

		it('should include surname in name', () => {
			const shopkeep = generateRandomShopkeep(mockRandomizer, mockShopkeepConfig);

			expect(shopkeep.name).toMatch(/\w+ \w+/); // First and last name
		});

		it('should set bargainDC from disposition', () => {
			(mockRandomizer.weightedChoice as any).mockReturnValue(
				{ type: 'friendly', weight: 20, description: 'Friendly', dc: 5 }
			);

			const shopkeep = generateRandomShopkeep(mockRandomizer, mockShopkeepConfig);

			expect(shopkeep.disposition).toBe('friendly');
			expect(shopkeep.bargainDC).toBe(5);
		});

		it('should select quirk or motivation based on chance', () => {
			// 20% chance for motivation (returns true if > 50, so false = quirk)
			(mockRandomizer.chance as any).mockReturnValue(false);

			const shopkeep = generateRandomShopkeep(mockRandomizer, mockShopkeepConfig);

			expect(mockShopkeepConfig.quirks.includes(shopkeep.quirk) ||
				mockShopkeepConfig.motivations.includes(shopkeep.quirk)).toBe(true);
		});
	});

	describe('rerollShopkeepTrait - new format', () => {
		const baseShopkeep = {
			name: 'Aldric Ironforge',
			species: 'Human',
			gender: 'male',
			disposition: 'neutral' as const,
			quirk: 'Always speaks in rhymes',
			bargainDC: 10
		};

		it('should re-roll name while preserving gender', () => {
			const rerolled = rerollShopkeepTrait(
				mockRandomizer,
				baseShopkeep,
				'name',
				mockShopkeepConfig
			);

			expect(rerolled.gender).toBe(baseShopkeep.gender);
			expect(rerolled.name).toBeDefined();
			expect(rerolled.name).toMatch(/\w+ \w+/);
		});

		it('should re-roll species with weighted selection', () => {
			(mockRandomizer.weightedChoice as any).mockReturnValue({ name: 'Tabaxi', weight: 0.71 });

			const rerolled = rerollShopkeepTrait(
				mockRandomizer,
				baseShopkeep,
				'species',
				mockShopkeepConfig
			);

			expect(rerolled.species).toBe('Tabaxi');
			expect(mockRandomizer.weightedChoice).toHaveBeenCalled();
		});

		it('should re-roll gender and update name', () => {
			(mockRandomizer.randomChoice as any).mockImplementation((arr: any[]) => {
				if (arr.includes('female')) return 'female';
				if (arr.includes('Aria')) return 'Aria';
				return arr[0];
			});

			const rerolled = rerollShopkeepTrait(
				mockRandomizer,
				baseShopkeep,
				'gender',
				mockShopkeepConfig
			);

			expect(rerolled.gender).toBe('female');
			// Name should be updated to match new gender
			expect(['Aria', 'Brynn', 'Celia'].some(n => rerolled.name.includes(n))).toBe(true);
		});

		it('should preserve surname when re-rolling gender', () => {
			const rerolled = rerollShopkeepTrait(
				mockRandomizer,
				baseShopkeep,
				'gender',
				mockShopkeepConfig
			);

			expect(rerolled.name).toContain('Ironforge');
		});

		it('should re-roll disposition and update bargainDC', () => {
			(mockRandomizer.weightedChoice as any).mockReturnValue(
				{ type: 'hostile', weight: 5, description: 'Hostile', dc: 20 }
			);

			const rerolled = rerollShopkeepTrait(
				mockRandomizer,
				baseShopkeep,
				'disposition',
				mockShopkeepConfig
			);

			expect(rerolled.disposition).toBe('hostile');
			expect(rerolled.bargainDC).toBe(20);
		});

		it('should re-roll quirk', () => {
			(mockRandomizer.chance as any).mockReturnValue(false); // Select quirk
			(mockRandomizer.randomChoice as any).mockImplementation((arr: any[]) => {
				if (arr.includes('Has a pet rat')) return 'Has a pet rat';
				return arr[0];
			});

			const rerolled = rerollShopkeepTrait(
				mockRandomizer,
				baseShopkeep,
				'quirk',
				mockShopkeepConfig
			);

			expect(mockShopkeepConfig.quirks.includes(rerolled.quirk) ||
				mockShopkeepConfig.motivations.includes(rerolled.quirk)).toBe(true);
		});

		it('should not modify original shopkeep', () => {
			const original = { ...baseShopkeep };
			rerollShopkeepTrait(mockRandomizer, baseShopkeep, 'species', mockShopkeepConfig);

			expect(baseShopkeep).toEqual(original);
		});
	});

	describe('backward compatibility with legacy NPCTables format', () => {
		const legacyTables = {
			maleNames: ['John', 'Bob'],
			femaleNames: ['Jane', 'Alice'],
			neutralNames: ['Alex'],
			surnames: ['Smith', 'Jones'],
			genders: ['male', 'female'],
			species: ['Human', 'Elf', 'Dwarf'], // Simple string array
			dispositions: [
				{ type: 'neutral', weight: 50, dc: 10 }
			],
			quirks: ['Friendly'],
			motivations: ['Money']
		};

		it('should work with legacy format', () => {
			const shopkeep = generateRandomShopkeep(mockRandomizer, legacyTables);

			expect(shopkeep).toBeDefined();
			expect(shopkeep.species).toBeDefined();
		});

		it('should use randomChoice for species in legacy format', () => {
			vi.clearAllMocks();

			generateRandomShopkeep(mockRandomizer, legacyTables);

			// Should use randomChoice for species (not weightedChoice)
			expect(mockRandomizer.randomChoice).toHaveBeenCalled();
		});

		it('should re-roll traits with legacy format', () => {
			const baseShopkeep = {
				name: 'John Smith',
				species: 'Human',
				gender: 'male',
				disposition: 'neutral' as const,
				quirk: 'Friendly',
				bargainDC: 10
			};

			const rerolled = rerollShopkeepTrait(
				mockRandomizer,
				baseShopkeep,
				'species',
				legacyTables
			);

			expect(rerolled.species).toBeDefined();
		});
	});
});
