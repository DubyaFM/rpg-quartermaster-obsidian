import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObsidianAdapterFactory } from '../../src/services/ObsidianAdapterFactory';
import { App } from 'obsidian';

// Mock dependencies
vi.mock('obsidian', () => ({
    App: class {},
    Plugin: class {},
    normalizePath: (path: string) => path,
    Vault: class {},
    TFolder: class {}
}));

// Mock DataAdapter with simulated delay
vi.mock('../../src/adapters/ObsidianDataAdapter', () => {
    return {
        ObsidianDataAdapter: vi.fn().mockImplementation(() => {
            // Simulate initialization work
            const start = Date.now();
            while(Date.now() - start < 10) {} // 10ms CPU work
            
            return {
                teardown: vi.fn().mockResolvedValue(undefined),
                getShop: vi.fn(),
                getPartyInventory: vi.fn(),
                initializeCalendar: vi.fn(),
                initializeRenownConfig: vi.fn(),
                initializeProjects: vi.fn(),
                initializeActivityLog: vi.fn(),
                getCurrencyConfig: vi.fn().mockReturnValue({ systems: { default: { name: 'Default' } }, defaultSystem: 'default' })
            };
        })
    };
});

describe('Campaign Switching Performance', () => {
    let factory: ObsidianAdapterFactory;
    let mockApp: App;
    let mockPlugin: any;

    beforeEach(() => {
        mockPlugin = {
            settings: {},
            loadData: vi.fn().mockResolvedValue({ 
                campaigns: [{
                    id: 'perf-campaign',
                    name: 'Perf Test',
                    worldId: 'world-1',
                    createdAt: 1000,
                    isActive: true,
                    pathMappings: {
                        shops: 'Perf/Shops',
                        party: 'Perf/Party.md',
                        transactions: 'Perf/Log.md'
                    },
                    activeLibraryIds: []
                }]
            }),
            saveData: vi.fn(),
            manifest: { dir: 'plugins/quartermaster' }
        };

        mockApp = {
            vault: {
                adapter: {
                    exists: vi.fn().mockResolvedValue(true),
                    mkdir: vi.fn(),
                    read: vi.fn()
                },
                getAbstractFileByPath: vi.fn().mockReturnValue({ children: [] }),
                createFolder: vi.fn()
            }
        } as any;

        factory = new ObsidianAdapterFactory(mockApp, mockPlugin);
    });

    it('should meet cold start SLO (<500ms)', async () => {
        const start = performance.now();
        
        await factory.createAdapters('perf-campaign');
        
        const duration = performance.now() - start;
        console.log(`Cold start duration: ${duration.toFixed(2)}ms`);
        
        expect(duration).toBeLessThan(500);
    });

    it('should meet warm start/switch SLO (<200ms)', async () => {
        // Warm up
        const bundle1 = await factory.createAdapters('perf-campaign');
        
        const start = performance.now();
        
        // Switch (dispose + create)
        await factory.disposeAdapters(bundle1);
        await factory.createAdapters('perf-campaign');
        
        const duration = performance.now() - start;
        console.log(`Warm switch duration: ${duration.toFixed(2)}ms`);
        
        expect(duration).toBeLessThan(200);
    });

    it('should meet teardown SLO (<50ms)', async () => {
        const bundle = await factory.createAdapters('perf-campaign');
        
        const start = performance.now();
        await factory.disposeAdapters(bundle);
        const duration = performance.now() - start;
        
        console.log(`Teardown duration: ${duration.toFixed(2)}ms`);
        expect(duration).toBeLessThan(50);
    });
    
    // Memory test (approximate)
    it('should not leak significant memory on repeated switches', async () => {
        if (!global.gc) {
            console.warn('Garbage collection not exposed, skipping strict memory test');
            return;
        }

        global.gc();
        const initialMemory = process.memoryUsage().heapUsed;

        let currentBundle = await factory.createAdapters('perf-campaign');

        // Perform 50 switches
        for (let i = 0; i < 50; i++) {
            await factory.disposeAdapters(currentBundle);
            currentBundle = await factory.createAdapters('perf-campaign');
        }

        global.gc();
        const finalMemory = process.memoryUsage().heapUsed;
        const diffMB = (finalMemory - initialMemory) / 1024 / 1024;

        console.log(`Memory growth after 50 switches: ${diffMB.toFixed(2)} MB`);
        
        // Allow some growth for JIT optimization and cached strings, but should be small
        expect(diffMB).toBeLessThan(50); 
    });
});
