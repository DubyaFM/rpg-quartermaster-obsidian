import { UUIDRegistry } from '../src/services/UUIDRegistry';
import { Shop, Item, RPGShopkeepSettings } from '@quartermaster/core/models/types';
import { NPCProfile } from '@quartermaster/core/models/npc';

// Mock crypto.randomUUID for consistent testing
const mockUUID = vi.fn();
Object.defineProperty(global, 'crypto', {
    value: {
        randomUUID: mockUUID,
    },
});

// Minimal mock settings - only the property UUIDRegistry actually uses
function createMockSettings(overrides: Partial<RPGShopkeepSettings> = {}): RPGShopkeepSettings {
    return {
        storeCrossPlatformIds: false,
        ...overrides,
    } as unknown as RPGShopkeepSettings;
}

describe('UUIDRegistry', () => {
    let mockSettings: RPGShopkeepSettings;
    let registry: UUIDRegistry;
    let uuidCounter: number;

    beforeEach(() => {
        uuidCounter = 0;
        mockUUID.mockImplementation(() => {
            uuidCounter++;
            return `00000000-0000-4000-8000-00000000000${uuidCounter}`;
        });

        mockSettings = createMockSettings();
        registry = new UUIDRegistry(() => mockSettings);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // --- Memory-Only Mode (storeCrossPlatformIds = false) ---
    describe('Memory-Only Mode', () => {
        it('should generate and return a UUID, storing it in the memory map', () => {
            const shop: Shop = { name: 'Test Shop' } as Shop;
            const uuid = registry.getShopId('path/to/shop.md', shop);

            expect(typeof uuid).toBe('string');
            expect(uuid).toMatch(/^shop-/);
            expect(registry.shopRegistryMap.get('path/to/shop.md')).toBe(uuid);
            expect(shop.id).toBeUndefined(); // getShopId should not modify the object
        });

        it('should return the same UUID for the same path', () => {
            const shop1: Shop = { name: 'Test Shop' } as Shop;
            const shop2: Shop = { name: 'Another Test Shop' } as Shop;

            const uuid1 = registry.getShopId('path/to/shop.md', shop1);
            const uuid2 = registry.getShopId('path/to/shop.md', shop2);

            expect(typeof uuid1).toBe('string');
            expect(uuid2).toBe(uuid1);
        });

        it('should allow setting a UUID in the memory map', () => {
            const shop: Shop = { name: 'Test Shop' } as Shop;
            registry.setShopId('path/to/shop.md', shop, 'custom-uuid');
            expect(registry.shopRegistryMap.get('path/to/shop.md')).toBe('custom-uuid');
            expect(shop.id).toBeUndefined(); // setShopId should not modify the object in memory-only mode
        });

        it('should generate item IDs and store in memory', () => {
            const item: Item = { name: 'Test Item' } as Item;
            const uuid = registry.getItemId('path/to/item.md', item);

            expect(typeof uuid).toBe('string');
            expect(uuid).toMatch(/^item-/);
            expect(registry.itemRegistryMap.get('path/to/item.md')).toBe(uuid);
            expect(item.id).toBeUndefined();
        });
    });

    // --- Persistent Mode (storeCrossPlatformIds = true) ---
    describe('Persistent Mode', () => {
        beforeEach(() => {
            mockSettings.storeCrossPlatformIds = true;
        });

        it('should return existing UUID from shop object', () => {
            const shop: Shop = { name: 'Test Shop', id: 'shop-existing-uuid' } as Shop;
            const uuid = registry.getShopId('path/to/shop.md', shop);

            expect(uuid).toBe('shop-existing-uuid');
            // Should NOT store in memory registry in persistent mode
            expect(registry.shopRegistryMap.has('path/to/shop.md')).toBe(false);
        });

        it('should generate new UUID if shop has no id', () => {
            const shop: Shop = { name: 'Test Shop' } as Shop;
            const uuid = registry.getShopId('path/to/shop.md', shop);

            expect(typeof uuid).toBe('string');
            expect(uuid).toMatch(/^shop-/);
            // Should NOT store in memory registry in persistent mode
            expect(registry.shopRegistryMap.has('path/to/shop.md')).toBe(false);
        });

        it('should set UUID on the shop object when using setShopId', () => {
            const shop: Shop = { name: 'Test Shop' } as Shop;
            registry.setShopId('path/to/shop.md', shop, 'shop-custom-uuid');

            expect(shop.id).toBe('shop-custom-uuid');
            // Should NOT store in memory registry
            expect(registry.shopRegistryMap.has('path/to/shop.md')).toBe(false);
        });

        it('should return existing UUID from item object', () => {
            const item: Item = { name: 'Test Item', id: 'item-existing-uuid' } as Item;
            const uuid = registry.getItemId('path/to/item.md', item);

            expect(uuid).toBe('item-existing-uuid');
            expect(registry.itemRegistryMap.has('path/to/item.md')).toBe(false);
        });

        it('should set UUID on the item object when using setItemId', () => {
            const item: Item = { name: 'Test Item' } as Item;
            registry.setItemId('path/to/item.md', item, 'item-custom-uuid');

            expect(item.id).toBe('item-custom-uuid');
            expect(registry.itemRegistryMap.has('path/to/item.md')).toBe(false);
        });
    });

    // --- NPC ID Handling (Always Persistent) ---
    describe('NPC ID Handling', () => {
        it('should always return existing npcId from object', () => {
            const npc: NPCProfile = { name: 'Test NPC', npcId: 'npc-existing' } as NPCProfile;
            const uuid = registry.getNpcId('path/to/npc.md', npc);
            expect(uuid).toBe('npc-existing');
        });

        it('should generate a new npcId if not present', () => {
            const npc: NPCProfile = { name: 'New NPC' } as NPCProfile;
            const uuid = registry.getNpcId('path/to/npc.md', npc);
            expect(typeof uuid).toBe('string');
            expect(uuid).toMatch(/^npc-/);
        });

        it('should set npcId on the object when using setNpcId', () => {
            const npc: NPCProfile = { name: 'Test NPC' } as NPCProfile;
            registry.setNpcId('path/to/npc.md', npc, 'custom-npc-uuid');
            expect(npc.npcId).toBe('custom-npc-uuid');
        });
    });

    // --- UUID Format Validation ---
    describe('UUID Format Validation', () => {
        it('should generate shop IDs with "shop-" prefix and valid UUID format', () => {
            const uuid = registry.generateShopId();
            expect(uuid).toMatch(/^shop-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        });

        it('should generate NPC IDs with "npc-" prefix and valid UUID format', () => {
            const uuid = registry.generateNpcId();
            expect(uuid).toMatch(/^npc-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        });

        it('should generate item IDs with "item-" prefix and valid UUID format', () => {
            const uuid = registry.generateItemId();
            expect(uuid).toMatch(/^item-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        });

        it('should generate transaction IDs with "txn-" prefix and valid UUID format', () => {
            const uuid = registry.generateTransactionId();
            expect(uuid).toMatch(/^txn-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        });

        it('should generate project template IDs with "template-" prefix and valid UUID format', () => {
            const uuid = registry.generateProjectTemplateId();
            expect(uuid).toMatch(/^template-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        });

        it('should generate project instance IDs with "project-" prefix and valid UUID format', () => {
            const uuid = registry.generateProjectInstanceId();
            expect(uuid).toMatch(/^project-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        });

        it('should generate unique project template IDs', () => {
            const uuid1 = registry.generateProjectTemplateId();
            const uuid2 = registry.generateProjectTemplateId();
            expect(uuid1).not.toBe(uuid2);
        });

        it('should generate unique project instance IDs', () => {
            const uuid1 = registry.generateProjectInstanceId();
            const uuid2 = registry.generateProjectInstanceId();
            expect(uuid1).not.toBe(uuid2);
        });
    });

    // --- Registry Clear ---
    describe('clear() method', () => {
        it('should clear all internal maps', () => {
            registry.getShopId('path/to/shop.md', { name: 'Shop 1' } as Shop);
            registry.getItemId('path/to/item.md', { name: 'Item 1' } as Item);

            expect(registry.shopRegistryMap.size).toBe(1);
            expect(registry.itemRegistryMap.size).toBe(1);

            registry.clear();

            expect(registry.shopRegistryMap.size).toBe(0);
            expect(registry.itemRegistryMap.size).toBe(0);
            expect(registry.npcRegistryMap.size).toBe(0);
        });
    });

    // --- Mode Switching ---
    describe('Mode Switching', () => {
        it('should respect dynamic settings changes', () => {
            // Start in memory mode
            const shop: Shop = { name: 'Test Shop' } as Shop;
            const memoryUuid = registry.getShopId('path/to/shop.md', shop);
            expect(registry.shopRegistryMap.has('path/to/shop.md')).toBe(true);

            // Switch to persistent mode
            mockSettings.storeCrossPlatformIds = true;

            // Now it should read from object, not memory
            const shop2: Shop = { name: 'Test Shop 2', id: 'shop-persistent' } as Shop;
            const persistentUuid = registry.getShopId('path/to/shop2.md', shop2);
            expect(persistentUuid).toBe('shop-persistent');
            expect(registry.shopRegistryMap.has('path/to/shop2.md')).toBe(false);
        });
    });
});
