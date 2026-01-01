/**
 * Item identification utilities for unique item keys.
 *
 * Provides composite key generation for items, especially variants that share
 * the same file path but have different resolved names.
 *
 * PHASE 4 UPDATE: Prefers UUID over file paths for cross-platform compatibility,
 * with automatic fallback to file paths for backward compatibility.
 */

import { Item } from '../models/types';

/**
 * Generates a unique key for an item.
 *
 * PRIORITY:
 * 1. UUID (if available) - cross-platform compatible
 * 2. File path - Obsidian backward compatibility
 *
 * For variant items, uses composite key format: "{identifier}::{variantName}"
 * For regular items, uses just the identifier.
 *
 * Examples with UUID:
 * - "uuid-12345::Leather Armor of Gleaming"
 * - "uuid-67890"
 *
 * Examples with file path (backward compatibility):
 * - "items/Armor of Gleaming.md::Plate Armor of Gleaming"
 * - "items/Sword.md"
 *
 * @param item - The item to generate a key for
 * @returns A unique string key
 */
export function getItemKey(item: Item): string {
    // Prefer UUID (cross-platform compatible)
    if (item.id) {
        if (item.isVariant && item.name) {
            // Composite key with UUID: "uuid::variantName"
            return `${item.id}::${item.name}`;
        }
        return item.id;
    }

    // Fallback to file path (Obsidian backward compatibility)
    const filePath = item.file?.path || '';

    if (item.isVariant && item.name) {
        // Composite key with file path: "filePath::variantName"
        return `${filePath}::${item.name}`;
    }

    // Final fallback to path or name
    return filePath || item.name;
}

/**
 * Generates a unique identifier for an item (alias for getItemKey for clarity).
 *
 * This function name is more explicit about intent - it's used for item identification
 * in inventory generation, deduplication, and other core logic.
 *
 * @param item - The item to generate an identifier for
 * @returns A unique string identifier
 */
export function getItemIdentifier(item: Item): string {
    return getItemKey(item);
}

/**
 * Compares two items for equality based on their unique keys.
 *
 * @param item1 - First item to compare
 * @param item2 - Second item to compare
 * @returns True if items have the same unique key
 */
export function areItemsEqual(item1: Item, item2: Item): boolean {
    return getItemKey(item1) === getItemKey(item2);
}

/**
 * Extracts the file path portion from an item key.
 *
 * @param key - The composite key (format: "path::name" or "path")
 * @returns The file path portion
 */
export function getFilePathFromKey(key: string): string {
    const parts = key.split('::');
    return parts[0];
}

/**
 * Extracts the item name portion from an item key.
 *
 * @param key - The composite key (format: "path::name" or "path")
 * @returns The item name portion, or empty string if no name in key
 */
export function getItemNameFromKey(key: string): string {
    const parts = key.split('::');
    return parts.length > 1 ? parts[1] : '';
}

/**
 * Checks if a key represents a variant item (has both path and name).
 *
 * @param key - The composite key to check
 * @returns True if key is in variant format ("path::name")
 */
export function isVariantKey(key: string): boolean {
    return key.includes('::');
}
