import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObsidianAdapterFactory } from '../../src/services/ObsidianAdapterFactory';
import { App } from 'obsidian';
import { CampaignProfile } from '../../src/adapters/ObsidianCampaignContext';

// Mock dependencies
vi.mock('obsidian', () => ({
    App: class {},
    Plugin: class {},
    normalizePath: (path: string) => path,
    Vault: class {},
    TFolder: class {}
}));

// Mock DataAdapter to track teardown calls
vi.mock('../../src/adapters/ObsidianDataAdapter', () => {
    return {
        ObsidianDataAdapter: vi.fn().mockImplementation(() => ({
            teardown: vi.fn().mockResolvedValue(undefined),
            getShop: vi.fn(),
            getPartyInventory: vi.fn(),
            initializeCalendar: vi.fn(),
            initializeRenownConfig: vi.fn(),
            initializeProjects: vi.fn(),
            initializeActivityLog: vi.fn(),
            getCurrencyConfig: vi.fn().mockReturnValue({ systems: { default: { name: 'Default' } }, defaultSystem: 'default' })
        }))
    };
});

describe('Campaign Switching Integration', () => {
    let factory: ObsidianAdapterFactory;
    let mockApp: App;
    let mockPlugin: any;
    let campaigns: CampaignProfile[];

    beforeEach(() => {
        // Setup mock campaigns
        campaigns = [
            {
                id: 'campaign-1',
                name: 'Campaign One',
                worldId: 'world-1',
                createdAt: 1000,
                isActive: true,
                pathMappings: {
                    shops: 'Campaign1/Shops',
                    party: 'Campaign1/Party.md',
                    transactions: 'Campaign1/Log.md'
                },
                activeLibraryIds: []
            },
            {
                id: 'campaign-2',
                name: 'Campaign Two',
                worldId: 'world-2',
                createdAt: 2000,
                isActive: false,
                pathMappings: {
                    shops: 'Campaign2/Shops',
                    party: 'Campaign2/Party.md',
                    transactions: 'Campaign2/Log.md'
                },
                activeLibraryIds: []
            }
        ];

        // Setup mock plugin
        mockPlugin = {
            settings: {},
            loadData: vi.fn().mockResolvedValue({ campaigns }),
            saveData: vi.fn().mockImplementation(async (data) => {
                if (data.campaigns) campaigns = data.campaigns;
            }),
            manifest: { dir: 'plugins/quartermaster' }
        };

        // Setup mock app
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

    it('should full switching cycle', async () => {
        // 1. Initialize adapters for Campaign 1
        const bundle1 = await factory.createAdapters('campaign-1');
        
        expect(bundle1.campaignContext.getCampaignId()).toBe('campaign-1');
        expect(await bundle1.pathResolver.resolveRoot('shops')).toContain('Campaign1');

        // 2. Switch to Campaign 2
        // Capture teardown spy before it's nullified
        const teardownSpy = bundle1.dataAdapter.teardown;

        // First dispose old adapters
        await factory.disposeAdapters(bundle1);
        
        // Verify teardown called
        expect(teardownSpy).toHaveBeenCalled();

        // Create new adapters
        const bundle2 = await factory.createAdapters('campaign-2');
        
        expect(bundle2.campaignContext.getCampaignId()).toBe('campaign-2');
        expect(await bundle2.pathResolver.resolveRoot('shops')).toContain('Campaign2');

        // 3. Verify persistence of active state
        await factory.setActiveCampaign('campaign-2');
        expect(mockPlugin.saveData).toHaveBeenCalled();
        
        const activeId = await factory.getActiveCampaignId();
        expect(activeId).toBe('campaign-2');
    });

    it('should create default campaign if none exist', async () => {
        // Empty campaigns
        mockPlugin.loadData.mockResolvedValue({});
        campaigns = [];

        const activeId = await factory.getActiveCampaignId();
        
        expect(activeId).toBe('campaign_default');
        expect(mockPlugin.saveData).toHaveBeenCalled();
        expect(campaigns.length).toBe(1);
    });
});
