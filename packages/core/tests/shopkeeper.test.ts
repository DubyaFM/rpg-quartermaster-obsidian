
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateRandomShopkeep,
  rerollShopkeepTrait,
  NPCTables
} from '../generators/shopkeeper';
import { IRandomizer, RollResult } from '../interfaces/IRandomizer';
import { Shopkeep } from '../models/types';

// Mock IRandomizer
const mockRandomizer: IRandomizer = {
  randomInt: vi.fn((min: number, max: number) => min), // Always return min
  randomFloat: vi.fn(() => 0.5), // Always return 0.5
  rollDice: vi.fn((notation: string): RollResult => ({ total: 0, breakdown: '' })),
  randomChoice: vi.fn(items => items[0]), // Always pick the first item
  weightedChoice: vi.fn((items, weights) => items[0]), // Always pick the first item
  rollPercentile: vi.fn(() => 50),
  chance: vi.fn((percentage: number) => percentage >= 50), // True if percentage is 50 or more
};

const mockNPCTables: NPCTables = {
  maleNames: ['Aldric', 'Borin'],
  femaleNames: ['Aria', 'Brynn'],
  neutralNames: ['Ash', 'Brook'],
  surnames: ['Ironforge', 'Goldleaf'],
  genders: ['male', 'female', 'non-binary'],
  species: ['Human', 'Dwarf'],
  dispositions: [
    { type: 'hostile', weight: 5, dc: 20 },
    { type: 'neutral', weight: 50, dc: 10 },
    { type: 'helpful', weight: 10, dc: 0 },
  ],
  quirks: ['Always speaks in rhymes', 'Has a pet rat'],
  motivations: ['Saving gold', 'Supporting family'],
};

describe('Shopkeep Generator Utility', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    (mockRandomizer.randomChoice as vi.Mock).mockImplementation(items => items[0]);
    (mockRandomizer.weightedChoice as vi.Mock).mockImplementation(items => items[0]);
    (mockRandomizer.chance as vi.Mock).mockImplementation((percentage: number) => percentage >= 50);
  });

  describe('generateRandomShopkeep', () => {
    it('should generate a male shopkeep with default mocks', () => {
      const shopkeep = generateRandomShopkeep(mockRandomizer, mockNPCTables);
      expect(shopkeep.name).toBe('Aldric Ironforge');
      expect(shopkeep.species).toBe('Human');
      expect(shopkeep.gender).toBe('male');
      expect(shopkeep.disposition).toBe('hostile');
      expect(shopkeep.bargainDC).toBe(20);
      expect(shopkeep.quirk).toBe('Always speaks in rhymes');
    });

    it('should generate a female shopkeep when randomChoice for gender is mocked', () => {
      (mockRandomizer.randomChoice as vi.Mock).mockImplementationOnce(items => items[1]); // Pick 'female'
      const shopkeep = generateRandomShopkeep(mockRandomizer, mockNPCTables);
      expect(shopkeep.name).toBe('Aria Ironforge');
      expect(shopkeep.gender).toBe('female');
    });

    it('should generate a non-binary shopkeep when randomChoice for gender is mocked', () => {
      (mockRandomizer.randomChoice as vi.Mock).mockImplementationOnce(items => items[2]); // Pick 'non-binary'
      const shopkeep = generateRandomShopkeep(mockRandomizer, mockNPCTables);
      expect(shopkeep.name).toBe('Ash Ironforge'); // Uses neutralNames
      expect(shopkeep.gender).toBe('non-binary');
    });

    it('should use motivation for quirk if chance is met', () => {
      (mockRandomizer.chance as vi.Mock).mockReturnValueOnce(true); // 20% chance for motivation
      const shopkeep = generateRandomShopkeep(mockRandomizer, mockNPCTables);
      expect(shopkeep.quirk).toBe('Saving gold');
    });
  });

  describe('rerollShopkeepTrait', () => {
    const initialShopkeep: Shopkeep = {
      name: 'Aldric Ironforge',
      species: 'Human',
      gender: 'male',
      disposition: 'neutral',
      quirk: 'Always speaks in rhymes',
      bargainDC: 10,
    };

    it('should reroll name', () => {
      (mockRandomizer.randomChoice as vi.Mock).mockImplementationOnce(items => items[1]); // New first name: Borin
      (mockRandomizer.randomChoice as vi.Mock).mockImplementationOnce(items => items[1]); // New surname: Goldleaf
      const updatedShopkeep = rerollShopkeepTrait(mockRandomizer, initialShopkeep, 'name', mockNPCTables);
      expect(updatedShopkeep.name).toBe('Borin Goldleaf');
      expect(updatedShopkeep.species).toBe(initialShopkeep.species);
    });

    it('should reroll species', () => {
      (mockRandomizer.randomChoice as vi.Mock).mockImplementationOnce(items => items[1]); // New species: Dwarf
      const updatedShopkeep = rerollShopkeepTrait(mockRandomizer, initialShopkeep, 'species', mockNPCTables);
      expect(updatedShopkeep.species).toBe('Dwarf');
      expect(updatedShopkeep.name).toBe(initialShopkeep.name);
    });

    it('should reroll gender and update name accordingly', () => {
      (mockRandomizer.randomChoice as vi.Mock).mockImplementationOnce(items => items[1]); // New gender: female
      (mockRandomizer.randomChoice as vi.Mock).mockImplementationOnce(items => items[0]); // New female name: Aria
      const updatedShopkeep = rerollShopkeepTrait(mockRandomizer, initialShopkeep, 'gender', mockNPCTables);
      expect(updatedShopkeep.gender).toBe('female');
      expect(updatedShopkeep.name).toBe('Aria Ironforge'); // Surname should be preserved
    });

    it('should reroll disposition and update bargainDC', () => {
      (mockRandomizer.weightedChoice as vi.Mock).mockImplementationOnce(items => items[2]); // New disposition: helpful
      const updatedShopkeep = rerollShopkeepTrait(mockRandomizer, initialShopkeep, 'disposition', mockNPCTables);
      expect(updatedShopkeep.disposition).toBe('helpful');
      expect(updatedShopkeep.bargainDC).toBe(0);
    });

    it('should reroll quirk', () => {
      (mockRandomizer.chance as vi.Mock).mockReturnValueOnce(true); // Use motivation
      (mockRandomizer.randomChoice as vi.Mock).mockImplementationOnce(items => items[1]); // New motivation: Supporting family
      const updatedShopkeep = rerollShopkeepTrait(mockRandomizer, initialShopkeep, 'quirk', mockNPCTables);
      expect(updatedShopkeep.quirk).toBe('Supporting family');
    });
  });
});
