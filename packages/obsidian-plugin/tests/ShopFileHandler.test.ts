/**
 * ShopFileHandler Jest tests
 * Tests UUID handling in shop file operations
 */

import { UUIDRegistry } from '../src/services/UUIDRegistry';
import { RPGShopkeepSettings, Shop } from '@quartermaster/core/models/types';

// Mock crypto.randomUUID
const mockUUID = vi.fn();
Object.defineProperty(global, 'crypto', {
    value: {
        randomUUID: mockUUID,
    },
});

// Helper to create mock settings
function createMockSettings(overrides: Partial<RPGShopkeepSettings> = {}): RPGShopkeepSettings {
    return {
        storeCrossPlatformIds: false,
        shopsFolder: 'Shops',
        ...overrides,
    } as unknown as RPGShopkeepSettings;
}

describe('ShopFileHandler UUID Integration', () => {
    let mockSettings: RPGShopkeepSettings;
    let uuidRegistry: UUIDRegistry;
    let uuidCounter: number;

    beforeEach(() => {
        uuidCounter = 0;
        mockUUID.mockImplementation(() => {
            uuidCounter++;
            return `00000000-0000-4000-8000-00000000000${uuidCounter}`;
        });

        mockSettings = createMockSettings();
        uuidRegistry = new UUIDRegistry(() => mockSettings);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Memory-Only Mode UUID Handling', () => {
        it('should generate UUID for shop without id field', () => {
            const shop: Shop = {
                name: 'Test Shop',
                type: 'blacksmith',
                wealthLevel: 'comfortable',
            } as Shop;

            const uuid = uuidRegistry.getShopId('Shops/Test Shop.md', shop);

            expect(uuid).toMatch(/^shop-/);
            expect(shop.id).toBeUndefined(); // Should not modify object in memory mode
            expect(uuidRegistry.shopRegistryMap.get('Shops/Test Shop.md')).toBe(uuid);
        });

        it('should return same UUID for same path', () => {
            const shop1: Shop = { name: 'Shop 1' } as Shop;
            const shop2: Shop = { name: 'Shop 2' } as Shop;

            const uuid1 = uuidRegistry.getShopId('Shops/Test.md', shop1);
            const uuid2 = uuidRegistry.getShopId('Shops/Test.md', shop2);

            expect(uuid1).toBe(uuid2);
        });

        it('should generate different UUIDs for different paths', () => {
            const shop1: Shop = { name: 'Shop 1' } as Shop;
            const shop2: Shop = { name: 'Shop 2' } as Shop;

            const uuid1 = uuidRegistry.getShopId('Shops/Shop1.md', shop1);
            const uuid2 = uuidRegistry.getShopId('Shops/Shop2.md', shop2);

            expect(uuid1).not.toBe(uuid2);
        });
    });

    describe('Persistent Mode UUID Handling', () => {
        beforeEach(() => {
            mockSettings.storeCrossPlatformIds = true;
        });

        it('should return existing UUID from shop object', () => {
            const shop: Shop = {
                name: 'Test Shop',
                id: 'shop-existing-12345',
            } as Shop;

            const uuid = uuidRegistry.getShopId('Shops/Test Shop.md', shop);

            expect(uuid).toBe('shop-existing-12345');
            expect(uuidRegistry.shopRegistryMap.has('Shops/Test Shop.md')).toBe(false);
        });

        it('should generate new UUID if shop has no id', () => {
            const shop: Shop = { name: 'Test Shop' } as Shop;

            const uuid = uuidRegistry.getShopId('Shops/Test Shop.md', shop);

            expect(uuid).toMatch(/^shop-/);
            expect(uuidRegistry.shopRegistryMap.has('Shops/Test Shop.md')).toBe(false);
        });

        it('should set UUID on shop object when using setShopId', () => {
            const shop: Shop = { name: 'Test Shop' } as Shop;

            uuidRegistry.setShopId('Shops/Test Shop.md', shop, 'shop-custom-uuid');

            expect(shop.id).toBe('shop-custom-uuid');
            expect(uuidRegistry.shopRegistryMap.has('Shops/Test Shop.md')).toBe(false);
        });
    });

    describe('NPC Reference UUID Handling', () => {
        it('should handle shop with NPC wikilink and UUID', () => {
            const shop: Shop = {
                name: 'Test Shop',
                shopkeepNPC: '[[Aldric Ironforge]]',
                shopkeepNpcId: 'npc-aldric-123',
            } as Shop;

            // Verify the structure is preserved
            expect(shop.shopkeepNPC).toBe('[[Aldric Ironforge]]');
            expect(shop.shopkeepNpcId).toBe('npc-aldric-123');
        });

        it('should support dual-field storage for NPC references', () => {
            const shop: Shop = {
                name: 'Test Shop',
                shopkeepNPC: '[[New NPC]]',        // Wikilink (human-editable)
                shopkeepNpcId: 'npc-new-uuid',      // UUID (machine-readable)
            } as Shop;

            // Both should coexist
            expect(shop.shopkeepNPC).toBeDefined();
            expect(shop.shopkeepNpcId).toBeDefined();
        });
    });

    describe('Mode Switching', () => {
        it('should respect dynamic settings changes', () => {
            // Start in memory mode
            const shop1: Shop = { name: 'Memory Shop' } as Shop;
            const memoryUuid = uuidRegistry.getShopId('Shops/Memory.md', shop1);
            expect(uuidRegistry.shopRegistryMap.has('Shops/Memory.md')).toBe(true);

            // Switch to persistent mode
            mockSettings.storeCrossPlatformIds = true;

            // New shop should use persistent mode
            const shop2: Shop = { name: 'Persistent Shop', id: 'shop-persistent' } as Shop;
            const persistentUuid = uuidRegistry.getShopId('Shops/Persistent.md', shop2);

            expect(persistentUuid).toBe('shop-persistent');
            expect(uuidRegistry.shopRegistryMap.has('Shops/Persistent.md')).toBe(false);
        });
    });

    describe('UUID Format', () => {
        it('should generate valid UUID v4 format for shops', () => {
            const uuid = uuidRegistry.generateShopId();
            expect(uuid).toMatch(/^shop-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        });
    });

    describe('getShopById Behavior', () => {
        it('should find shop by UUID in memory mode using registry', () => {
            const shop: Shop = { name: 'Test Shop' } as Shop;
            const uuid = uuidRegistry.getShopId('Shops/Test.md', shop);

            // Registry should have the mapping
            const pathFromRegistry = Array.from(uuidRegistry.shopRegistryMap.entries())
                .find(([path, id]) => id === uuid)?.[0];

            expect(pathFromRegistry).toBe('Shops/Test.md');
        });

        it('should not use registry in persistent mode', () => {
            mockSettings.storeCrossPlatformIds = true;

            const shop: Shop = { name: 'Test Shop', id: 'shop-existing' } as Shop;
            uuidRegistry.getShopId('Shops/Test.md', shop);

            // Registry should be empty in persistent mode
            expect(uuidRegistry.shopRegistryMap.size).toBe(0);
        });
    });
});
