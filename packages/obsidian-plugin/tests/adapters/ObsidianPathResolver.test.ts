import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObsidianPathResolver } from '../../src/adapters/ObsidianPathResolver';
import { Vault, TFolder, TFile } from 'obsidian';
import { CampaignPathMappings } from '../../src/interfaces/IPathResolver';

describe('ObsidianPathResolver', () => {
    let resolver: ObsidianPathResolver;
    let mockVault: any;
    let pathMappings: CampaignPathMappings;

    beforeEach(() => {
        pathMappings = {
            shops: 'Campaign/Shops',
            party: 'Campaign/Party',
            transactions: 'Campaign/Log.md' // Note: This key usually expects a folder, but for testing logic
        };

        mockVault = {
            getAbstractFileByPath: vi.fn(),
            createFolder: vi.fn().mockResolvedValue(undefined)
        };

        resolver = new ObsidianPathResolver(pathMappings, mockVault);
    });

    describe('resolveRoot', () => {
        it('should resolve and normalize existing folder path', async () => {
            // Mock folder exists
            mockVault.getAbstractFileByPath.mockReturnValue({ children: [] }); // Simulate TFolder

            const result = await resolver.resolveRoot('shops');

            expect(result).toBe('Campaign/Shops/');
            expect(mockVault.getAbstractFileByPath).toHaveBeenCalledWith('Campaign/Shops');
            expect(mockVault.createFolder).not.toHaveBeenCalled();
        });

        it('should create folder if it does not exist', async () => {
            // Mock folder does not exist
            mockVault.getAbstractFileByPath.mockReturnValue(null);

            const result = await resolver.resolveRoot('shops');

            expect(result).toBe('Campaign/Shops/');
            expect(mockVault.createFolder).toHaveBeenCalledWith('Campaign/Shops');
        });

        it('should throw error if path exists as a file', async () => {
            // Mock file exists at path
            mockVault.getAbstractFileByPath.mockReturnValue({}); // Simulate TFile (no children property)

            await expect(resolver.resolveRoot('shops')).rejects.toThrow('exists but is a file');
        });

        it('should throw error if key not configured', async () => {
            await expect(resolver.resolveRoot('npcs' as any)).rejects.toThrow('Path mapping not configured');
        });
    });

    describe('resolveEntityPath', () => {
        it('should combine root and filename', async () => {
            mockVault.getAbstractFileByPath.mockReturnValue({ children: [] });

            const result = await resolver.resolveEntityPath('shops', 'Blacksmith.md');

            expect(result).toBe('Campaign/Shops/Blacksmith.md');
        });
    });

    describe('validateRequiredPaths', () => {
        it('should return missing keys', () => {
            const missing = resolver.validateRequiredPaths(['shops', 'npcs' as any]);
            expect(missing).toEqual(['npcs']);
        });

        it('should return empty array if all present', () => {
            const missing = resolver.validateRequiredPaths(['shops', 'party']);
            expect(missing).toEqual([]);
        });
    });
});
