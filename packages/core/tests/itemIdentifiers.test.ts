import { describe, expect, it } from 'vitest';
import {
  getItemKey,
  getItemIdentifier,
  areItemsEqual,
  getFilePathFromKey,
  getItemNameFromKey,
  isVariantKey,
} from '../utils/itemIdentifiers';
import { Item } from '../models/types';

describe('itemIdentifiers', () => {
  // Test data
  const basicItem: Item = {
    name: 'Sword',
    type: 'Weapon',
    cost: { gp: 10 },
    id: undefined,
    file: { path: 'items/Sword.md', basename: 'Sword' },
    isVariant: false,
  };

  const uuidItem: Item = {
    ...basicItem,
    id: 'item-uuid-12345',
  };

  const variantItemFilePath: Item = {
    ...basicItem,
    name: 'Longsword +1',
    isVariant: true,
    file: { path: 'items/Magic Longsword.md', basename: 'Magic Longsword' },
  };

  const variantItemUuid: Item = {
    ...variantItemFilePath,
    id: 'item-uuid-67890',
  };

  const itemNoPathNoUuid: Item = {
    name: 'Potion of Healing',
    type: 'Potion',
    cost: { gp: 50 },
    id: undefined,
    file: undefined,
    isVariant: false,
  };

  describe('getItemKey and getItemIdentifier', () => {
    it('should return UUID if available', () => {
      expect(getItemKey(uuidItem)).toBe('item-uuid-12345');
      expect(getItemIdentifier(uuidItem)).toBe('item-uuid-12345');
    });

    it('should return composite UUID for variant items with UUID', () => {
      expect(getItemKey(variantItemUuid)).toBe('item-uuid-67890::Longsword +1');
      expect(getItemIdentifier(variantItemUuid)).toBe('item-uuid-67890::Longsword +1');
    });

    it('should fallback to file path if UUID is not available', () => {
      expect(getItemKey(basicItem)).toBe('items/Sword.md');
      expect(getItemIdentifier(basicItem)).toBe('items/Sword.md');
    });

    it('should fallback to composite file path for variant items without UUID', () => {
      expect(getItemKey(variantItemFilePath)).toBe('items/Magic Longsword.md::Longsword +1');
      expect(getItemIdentifier(variantItemFilePath)).toBe('items/Magic Longsword.md::Longsword +1');
    });

    it('should fallback to name if neither UUID nor file path is available', () => {
      expect(getItemKey(itemNoPathNoUuid)).toBe('Potion of Healing');
      expect(getItemIdentifier(itemNoPathNoUuid)).toBe('Potion of Healing');
    });

    it('should handle item with empty file path but with UUID', () => {
      const item: Item = { ...uuidItem, file: { path: '', basename: '' } };
      expect(getItemKey(item)).toBe('item-uuid-12345');
    });

    it('should handle item with empty file path and no UUID', () => {
      const item: Item = { ...basicItem, file: { path: '', basename: '' } };
      expect(getItemKey(item)).toBe('Sword');
    });
  });

  describe('areItemsEqual', () => {
    it('should return true for identical items (same UUID)', () => {
      const item1: Item = { ...uuidItem };
      const item2: Item = { ...uuidItem };
      expect(areItemsEqual(item1, item2)).toBe(true);
    });

    it('should return true for identical items (same composite UUID)', () => {
      const item1: Item = { ...variantItemUuid };
      const item2: Item = { ...variantItemUuid };
      expect(areItemsEqual(item1, item2)).toBe(true);
    });

    it('should return true for identical items (same file path)', () => {
      const item1: Item = { ...basicItem };
      const item2: Item = { ...basicItem };
      expect(areItemsEqual(item1, item2)).toBe(true);
    });

    it('should return true for identical items (same composite file path)', () => {
      const item1: Item = { ...variantItemFilePath };
      const item2: Item = { ...variantItemFilePath };
      expect(areItemsEqual(item1, item2)).toBe(true);
    });

    it('should return true for identical items (same name only)', () => {
      const item1: Item = { ...itemNoPathNoUuid };
      const item2: Item = { ...itemNoPathNoUuid };
      expect(areItemsEqual(item1, item2)).toBe(true);
    });

    it('should return false for different items (different UUID)', () => {
      const item1: Item = { ...uuidItem };
      const item2: Item = { ...uuidItem, id: 'item-different-uuid' };
      expect(areItemsEqual(item1, item2)).toBe(false);
    });

    it('should return false for different items (different file path)', () => {
      const item1: Item = { ...basicItem };
      const item2: Item = { ...basicItem, file: { path: 'items/Different.md', basename: 'Different' } };
      expect(areItemsEqual(item1, item2)).toBe(false);
    });
  });

  describe('getFilePathFromKey', () => {
    it('should extract file path from a path-based key', () => {
      expect(getFilePathFromKey('items/Sword.md')).toBe('items/Sword.md');
    });

    it('should extract file path from a composite path-based key', () => {
      expect(getFilePathFromKey('items/Magic Longsword.md::Longsword +1')).toBe('items/Magic Longsword.md');
    });

    it('should extract UUID from a UUID-based key', () => {
      expect(getFilePathFromKey('item-uuid-12345')).toBe('item-uuid-12345');
    });

    it('should extract UUID from a composite UUID-based key', () => {
      expect(getFilePathFromKey('item-uuid-67890::Longsword +1')).toBe('item-uuid-67890');
    });
  });

  describe('getItemNameFromKey', () => {
    it('should return empty string for a simple key', () => {
      expect(getItemNameFromKey('items/Sword.md')).toBe('');
      expect(getItemNameFromKey('item-uuid-12345')).toBe('');
    });

    it('should extract item name from a composite key', () => {
      expect(getItemNameFromKey('items/Magic Longsword.md::Longsword +1')).toBe('Longsword +1');
      expect(getItemNameFromKey('item-uuid-67890::Longsword +1')).toBe('Longsword +1');
    });
  });

  describe('isVariantKey', () => {
    it('should return true for a composite key', () => {
      expect(isVariantKey('items/Magic Longsword.md::Longsword +1')).toBe(true);
      expect(isVariantKey('item-uuid-67890::Longsword +1')).toBe(true);
    });

    it('should return false for a simple key', () => {
      expect(isVariantKey('items/Sword.md')).toBe(false);
      expect(isVariantKey('item-uuid-12345')).toBe(false);
    });
  });
});
