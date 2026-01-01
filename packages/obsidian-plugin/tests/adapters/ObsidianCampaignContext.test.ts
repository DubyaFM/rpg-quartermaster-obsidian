import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObsidianCampaignContext, CampaignProfile } from '../../src/adapters/ObsidianCampaignContext';

describe('ObsidianCampaignContext', () => {
    let context: ObsidianCampaignContext;
    let mockProfile: CampaignProfile;
    let mockPlugin: any;

    beforeEach(() => {
        mockProfile = {
            id: 'campaign-123',
            name: 'Test Campaign',
            worldId: 'world-456',
            createdAt: 1000,
            isActive: true,
            pathMappings: {
                shops: 'Shops',
                party: 'Party',
                transactions: 'Transactions'
            },
            activeLibraryIds: ['lib-1', 'lib-2'],
            settings: {
                inflationModifier: 1.5,
                currencySystemId: 'custom-currency'
            }
        };

        mockPlugin = {
            loadData: vi.fn().mockResolvedValue({ campaigns: [mockProfile] }),
            saveData: vi.fn().mockResolvedValue(undefined)
        };

        context = new ObsidianCampaignContext(mockProfile, mockPlugin);
    });

    describe('getters', () => {
        it('should return campaign id', () => {
            expect(context.getCampaignId()).toBe('campaign-123');
        });

        it('should return campaign name', () => {
            expect(context.getCampaignName()).toBe('Test Campaign');
        });

        it('should return world id', () => {
            expect(context.getWorldId()).toBe('world-456');
        });

        it('should return active library ids', () => {
            expect(context.getActiveLibraryIds()).toEqual(['lib-1', 'lib-2']);
        });

        it('should check if library is enabled', () => {
            expect(context.isLibraryEnabled('lib-1')).toBe(true);
            expect(context.isLibraryEnabled('lib-3')).toBe(false);
        });

        it('should return inflation modifier', () => {
            expect(context.getInflationModifier()).toBe(1.5);
        });

        it('should return currency system id', () => {
            expect(context.getCurrencySystemId()).toBe('custom-currency');
        });
    });

    describe('defaults', () => {
        beforeEach(() => {
            // Setup profile with missing optional fields
            const minimalProfile: CampaignProfile = {
                id: 'campaign-minimal',
                name: 'Minimal',
                worldId: 'world-min',
                createdAt: 1000,
                isActive: true,
                pathMappings: {
                    shops: 'Shops',
                    party: 'Party',
                    transactions: 'Transactions'
                },
                activeLibraryIds: []
            };
            context = new ObsidianCampaignContext(minimalProfile, mockPlugin);
        });

        it('should return default inflation modifier (1.0)', () => {
            expect(context.getInflationModifier()).toBe(1.0);
        });

        it('should return default currency system id', () => {
            expect(context.getCurrencySystemId()).toBe('dnd5e-standard');
        });
    });

    describe('updateLastAccessed', () => {
        it('should update timestamp and persist to data', async () => {
            const now = Date.now();
            vi.useFakeTimers();
            vi.setSystemTime(now);

            await context.updateLastAccessed();

            // Verify timestamp update in profile object
            expect(mockProfile.lastAccessedAt).toBe(now);

            // Verify save call
            expect(mockPlugin.loadData).toHaveBeenCalled();
            expect(mockPlugin.saveData).toHaveBeenCalledWith(expect.objectContaining({
                campaigns: expect.arrayContaining([
                    expect.objectContaining({
                        id: 'campaign-123',
                        lastAccessedAt: now
                    })
                ])
            }));

            vi.useRealTimers();
        });
    });
});
