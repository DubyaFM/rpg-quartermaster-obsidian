
import { describe, it, expect } from 'vitest';
import { SRD_ITEMS, SRDItemData } from '../data/srdItems';

describe('SRD Items Data', () => {

  it('should have a populated SRD_ITEMS array', () => {
    expect(SRD_ITEMS).toBeDefined();
    expect(SRD_ITEMS.length).toBeGreaterThan(0);
  });

  it('should ensure each item in SRD_ITEMS has the correct structure', () => {
    SRD_ITEMS.forEach((item: SRDItemData) => {
      expect(item).toHaveProperty('name');
      expect(typeof item.name).toBe('string');

      expect(item).toHaveProperty('cost');
      expect(typeof item.cost).toBe('string');

      expect(item).toHaveProperty('type');
      expect(typeof item.type).toBe('string');

      expect(item).toHaveProperty('rarity');
      expect(typeof item.rarity).toBe('string');

      expect(item).toHaveProperty('description');
      expect(typeof item.description).toBe('string');
    });
  });

  it('should contain specific known items', () => {
    const potionOfHealing = SRD_ITEMS.find(item => item.name === 'Potion of Healing');
    expect(potionOfHealing).toBeDefined();
    expect(potionOfHealing?.cost).toBe('50 gp');
    expect(potionOfHealing?.type).toBe('potion');

    const longsword = SRD_ITEMS.find(item => item.name === 'Longsword');
    expect(longsword).toBeDefined();
    expect(longsword?.cost).toBe('15 gp');
    expect(longsword?.type).toBe('weapon');
  });

  it('should have unique item names (or at least not duplicate common ones)', () => {
    const names = SRD_ITEMS.map(item => item.name);
    const uniqueNames = new Set(names);
    // This test might fail if there are legitimate duplicates (e.g., 'Spell Scroll (1st Level)' and 'Spell Scroll (2nd Level)' are distinct but share a pattern)
    // For now, we'll just check for exact name duplicates.
    expect(names.length).toBe(uniqueNames.size);
  });
});
