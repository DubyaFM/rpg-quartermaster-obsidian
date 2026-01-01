/**
 * Unit tests for PorterService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PorterService, CampaignExportManifest } from '../PorterService';
import { IDataAdapter, PartyInventoryV2 } from '../../interfaces/IDataAdapter';
import { Shop, Transaction } from '../../models/types';

describe('PorterService', () => {
  let service: PorterService;
  let mockDataAdapter: IDataAdapter;

  const mockShops: Shop[] = [
    {
      id: 'shop-1',
      name: 'Test Blacksmith',
      type: 'blacksmith',
      wealthLevel: 'comfortable',
      location: 'Test Town',
      shopkeep: {
        name: 'John Smith',
        species: 'Human',
        gender: 'Male',
        disposition: 'friendly',
        quirk: 'Hums while working',
        bargainDC: 10
      },
      fundsOnHand: { pp: 0, gp: 100, sp: 50, cp: 0 },
      baseStock: [],
      specialStock: [],
      inventory: []
    }
  ];

  const mockParty: PartyInventoryV2 = {
    version: 2,
    containers: [],
    items: [],
    encumbrance: [],
    currency: { pp: 10, gp: 500, sp: 100, cp: 50 },
    updatedAt: new Date().toISOString()
  };

  const mockTransactions: Transaction[] = [
    {
      id: 'txn-1',
      type: 'purchase',
      shopId: 'shop-1',
      totalCost: { pp: 0, gp: 15, sp: 0, cp: 0 },
      items: [],
      timestamp: 1704063600000,
      notes: 'Bought a longsword'
    } as any
  ];

  beforeEach(() => {
    mockDataAdapter = {
      getAllShops: vi.fn().mockResolvedValue(mockShops),
      getPartyInventory: vi.fn().mockResolvedValue(mockParty),
      getAllTransactions: vi.fn().mockResolvedValue(mockTransactions),
      saveShop: vi.fn().mockResolvedValue(undefined)
    } as any;

    service = new PorterService(mockDataAdapter, 'obsidian', 'v1.2.3');
  });

  // ==================== EXPORT CAMPAIGN ====================

  describe('exportCampaign', () => {
    it('should export campaign to CEF format', async () => {
      const manifest = await service.exportCampaign(
        'campaign-test',
        'Test Campaign',
        'world-forgotten-realms',
        'A test campaign',
        { inflationModifier: 1.2 }
      );

      expect(manifest.version).toBe('1.0.0');
      expect(manifest.exportedAt).toBeGreaterThan(0);

      expect(manifest.campaign.id).toBe('campaign-test');
      expect(manifest.campaign.name).toBe('Test Campaign');
      expect(manifest.campaign.worldId).toBe('world-forgotten-realms');
      expect(manifest.campaign.description).toBe('A test campaign');
      expect(manifest.campaign.settings).toEqual({ inflationModifier: 1.2 });

      expect(manifest.data.shops).toEqual(mockShops);
      expect(manifest.data.party).toEqual(mockParty);
      expect(manifest.data.transactions).toEqual(mockTransactions);

      expect(manifest.metadata.sourcePlatform).toBe('obsidian');
      expect(manifest.metadata.exportedBy).toBe('obsidian-v1.2.3');
      expect(manifest.metadata.counts.shops).toBe(1);
      expect(manifest.metadata.counts.transactions).toBe(1);
    });

    it('should hydrate all data from adapter', async () => {
      await service.exportCampaign(
        'campaign-test',
        'Test Campaign',
        'world-test'
      );

      expect(mockDataAdapter.getAllShops).toHaveBeenCalled();
      expect(mockDataAdapter.getPartyInventory).toHaveBeenCalled();
      expect(mockDataAdapter.getAllTransactions).toHaveBeenCalled();
    });

    it('should handle optional parameters', async () => {
      const manifest = await service.exportCampaign(
        'campaign-test',
        'Test Campaign',
        'world-test'
      );

      expect(manifest.campaign.description).toBeUndefined();
      expect(manifest.campaign.settings).toBeUndefined();
    });

    it('should count total items correctly', async () => {
      const shopsWithItems: Shop[] = [
        {
          ...mockShops[0],
          inventory: [
            { id: 'item-1', name: 'Sword', stock: 1 } as any,
            { id: 'item-2', name: 'Shield', stock: 2 } as any
          ]
        }
      ];

      const partyWithItems: PartyInventoryV2 = {
        version: 2,
        containers: [],
        items: [
          { id: 'item-3', name: 'Potion', quantity: 5 } as any
        ],
        encumbrance: [],
        currency: mockParty.currency,
        updatedAt: new Date().toISOString()
      };

      mockDataAdapter.getAllShops = vi.fn().mockResolvedValue(shopsWithItems);
      mockDataAdapter.getPartyInventory = vi.fn().mockResolvedValue(partyWithItems);

      const manifest = await service.exportCampaign(
        'campaign-test',
        'Test Campaign',
        'world-test'
      );

      expect(manifest.metadata.counts.items).toBe(3); // 2 from shop + 1 from party
    });
  });

  // ==================== VALIDATE MANIFEST ====================

  describe('validateManifest', () => {
    let validManifest: CampaignExportManifest;

    beforeEach(async () => {
      validManifest = await service.exportCampaign(
        'campaign-test',
        'Test Campaign',
        'world-test'
      );
    });

    it('should validate valid manifest', () => {
      const result = service.validateManifest(validManifest);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail if manifest is null', () => {
      const result = service.validateManifest(null as any);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Manifest is null or undefined');
    });

    it('should fail if version is missing', () => {
      const invalidManifest = { ...validManifest };
      delete (invalidManifest as any).version;

      const result = service.validateManifest(invalidManifest);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing CEF version');
    });

    it('should warn if version mismatch', () => {
      const invalidManifest = {
        ...validManifest,
        version: '2.0.0'
      };

      const result = service.validateManifest(invalidManifest);

      expect(result.valid).toBe(true); // Still valid, just warning
      expect(result.warnings).toContain('CEF version mismatch: expected 1.0.0, got 2.0.0');
    });

    it('should fail if campaign metadata is missing', () => {
      const invalidManifest = { ...validManifest };
      delete (invalidManifest as any).campaign;

      const result = service.validateManifest(invalidManifest);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing campaign metadata');
    });

    it('should fail if campaign name is missing', () => {
      const invalidManifest = {
        ...validManifest,
        campaign: { ...validManifest.campaign, name: '' }
      };

      const result = service.validateManifest(invalidManifest);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing campaign name');
    });

    it('should fail if world ID is missing', () => {
      const invalidManifest = {
        ...validManifest,
        campaign: { ...validManifest.campaign, worldId: '' }
      };

      const result = service.validateManifest(invalidManifest);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing campaign worldId');
    });

    it('should fail if data section is missing', () => {
      const invalidManifest = { ...validManifest };
      delete (invalidManifest as any).data;

      const result = service.validateManifest(invalidManifest);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing campaign data');
    });

    it('should fail if party inventory is missing', () => {
      const invalidManifest = {
        ...validManifest,
        data: { ...validManifest.data, party: null as any }
      };

      const result = service.validateManifest(invalidManifest);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing party inventory');
    });

    it('should warn if shops are missing', () => {
      const invalidManifest = {
        ...validManifest,
        data: { ...validManifest.data, shops: null as any }
      };

      const result = service.validateManifest(invalidManifest);

      expect(result.valid).toBe(true); // Warning, not error
      expect(result.warnings).toContain('No shops in export');
    });

    it('should warn if metadata is missing', () => {
      const invalidManifest = { ...validManifest };
      delete (invalidManifest as any).metadata;

      const result = service.validateManifest(invalidManifest);

      expect(result.valid).toBe(true); // Warning, not error
      expect(result.warnings).toContain('Missing export metadata');
    });
  });

  // ==================== IMPORT CAMPAIGN ====================

  describe('importCampaign', () => {
    let validManifest: CampaignExportManifest;

    beforeEach(async () => {
      validManifest = await service.exportCampaign(
        'campaign-test',
        'Test Campaign',
        'world-test'
      );
    });

    it('should import valid manifest', async () => {
      const result = await service.importCampaign(validManifest);

      expect(result.shopsImported).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(mockDataAdapter.saveShop).toHaveBeenCalledWith(mockShops[0]);
    });

    it('should validate manifest before import', async () => {
      const invalidManifest = { ...validManifest };
      delete (invalidManifest as any).campaign;

      await expect(
        service.importCampaign(invalidManifest)
      ).rejects.toThrow('Invalid CEF manifest');
    });

    it('should skip validation if requested', async () => {
      const invalidManifest = { ...validManifest };
      delete (invalidManifest as any).campaign;

      // Should not throw, but will fail during import
      await service.importCampaign(invalidManifest, { skipValidation: true });

      // No error thrown, but shops won't be imported correctly
      expect(true).toBe(true);
    });

    it('should collect errors for failed imports', async () => {
      mockDataAdapter.saveShop = vi.fn()
        .mockRejectedValue(new Error('Database error'));

      const result = await service.importCampaign(validManifest);

      expect(result.shopsImported).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Database error');
    });

    it('should continue importing after errors', async () => {
      const shopsWithError: Shop[] = [
        mockShops[0],
        { ...mockShops[0], id: 'shop-2', name: 'Second Shop' }
      ];

      mockDataAdapter.getAllShops = vi.fn().mockResolvedValue(shopsWithError);
      mockDataAdapter.saveShop = vi.fn()
        .mockRejectedValueOnce(new Error('First failed'))
        .mockResolvedValueOnce(undefined);

      const manifest = await service.exportCampaign(
        'campaign-test',
        'Test Campaign',
        'world-test'
      );

      const result = await service.importCampaign(manifest);

      expect(result.shopsImported).toBe(1); // Only second succeeded
      expect(result.errors).toHaveLength(1);
    });
  });

  // ==================== SERIALIZATION ====================

  describe('Serialization', () => {
    let manifest: CampaignExportManifest;

    beforeEach(async () => {
      manifest = await service.exportCampaign(
        'campaign-test',
        'Test Campaign',
        'world-test'
      );
    });

    it('should serialize manifest to JSON', () => {
      const json = service.serializeManifest(manifest);

      expect(json).toBeDefined();
      expect(typeof json).toBe('string');

      const parsed = JSON.parse(json);
      expect(parsed.version).toBe('1.0.0');
      expect(parsed.campaign.name).toBe('Test Campaign');
    });

    it('should deserialize manifest from JSON', () => {
      const json = service.serializeManifest(manifest);
      const deserialized = service.deserializeManifest(json);

      expect(deserialized).toEqual(manifest);
    });

    it('should throw on invalid JSON', () => {
      expect(() => {
        service.deserializeManifest('invalid json{');
      }).toThrow('Failed to parse CEF manifest');
    });

    it('should format JSON with indentation', () => {
      const json = service.serializeManifest(manifest);

      // Should be pretty-printed
      expect(json).toContain('\n');
      expect(json).toContain('  '); // 2-space indentation
    });
  });

  // ==================== ROUNDTRIP TEST ====================

  describe('Export/Import Roundtrip', () => {
    it('should successfully roundtrip campaign data', async () => {
      // Export
      const manifest = await service.exportCampaign(
        'campaign-original',
        'Original Campaign',
        'world-test'
      );

      // Serialize/Deserialize (simulating file save/load)
      const json = service.serializeManifest(manifest);
      const deserialized = service.deserializeManifest(json);

      // Import
      const result = await service.importCampaign(deserialized);

      expect(result.shopsImported).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(mockDataAdapter.saveShop).toHaveBeenCalledWith(mockShops[0]);
    });
  });
});
