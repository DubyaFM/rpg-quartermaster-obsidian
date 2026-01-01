import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObsidianConfigAdapter } from '../../src/adapters/ObsidianConfigAdapter';
import { App, Plugin } from 'obsidian';

describe('ObsidianConfigAdapter', () => {
    let adapter: ObsidianConfigAdapter;
    let mockApp: App;
    let mockPlugin: Plugin;
    let mockVaultAdapter: any;

    const mockShopConfig = {
        shopTypes: {
            general: { name: 'General Store' }
        }
    };

    beforeEach(() => {
        // Setup mock Vault Adapter
        mockVaultAdapter = {
            exists: vi.fn(),
            read: vi.fn(),
            write: vi.fn(),
            mkdir: vi.fn(),
            list: vi.fn(),
            remove: vi.fn()
        };

        // Setup mock App
        mockApp = {
            vault: {
                adapter: mockVaultAdapter
            }
        } as any;

        // Setup mock Plugin
        mockPlugin = {
            manifest: {
                dir: '.obsidian/plugins/quartermaster'
            }
        } as any;

        // Create adapter instance
        adapter = new ObsidianConfigAdapter(mockApp, mockPlugin);
    });

    describe('loadShopConfig', () => {
        it('should load config from file on first call', async () => {
            // Setup mock file system
            mockVaultAdapter.exists.mockResolvedValue(true);
            mockVaultAdapter.read.mockResolvedValue('shopTypes:\n  general:\n    name: General Store');

            // Call method
            const result = await adapter.loadShopConfig();

            // Verify result
            expect(result).toEqual(mockShopConfig);
            expect(mockVaultAdapter.read).toHaveBeenCalledWith('.obsidian/plugins/quartermaster/config/shopConfig.yaml');
        });

        it('should return cached result on second call', async () => {
            // Setup mock file system
            mockVaultAdapter.exists.mockResolvedValue(true);
            mockVaultAdapter.read.mockResolvedValue('shopTypes:\n  general:\n    name: General Store');

            // First call
            await adapter.loadShopConfig();
            
            // Clear mock history to verify second call doesn't read file
            mockVaultAdapter.read.mockClear();
            mockVaultAdapter.exists.mockClear();

            // Second call
            const result = await adapter.loadShopConfig();

            // Verify result
            expect(result).toEqual(mockShopConfig);
            // Should not read file again
            expect(mockVaultAdapter.read).not.toHaveBeenCalled();
            expect(mockVaultAdapter.exists).not.toHaveBeenCalled();
        });
    });

    describe('teardown', () => {
        it('should clear the config cache', async () => {
            // Setup mock file system
            mockVaultAdapter.exists.mockResolvedValue(true);
            mockVaultAdapter.read.mockResolvedValue('shopTypes:\n  general:\n    name: General Store');

            // Populate cache
            await adapter.loadShopConfig();
            
            // Teardown
            await adapter.teardown();

            // Clear mock history
            mockVaultAdapter.read.mockClear();

            // Call again - should read file again because cache was cleared
            await adapter.loadShopConfig();

            expect(mockVaultAdapter.read).toHaveBeenCalledTimes(1);
        });
    });
});
