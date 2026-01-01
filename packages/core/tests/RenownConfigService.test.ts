import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RenownConfigService } from '../services/RenownConfigService';

describe('RenownConfigService', () => {
  let configLoader: ReturnType<typeof vi.fn>;
  let service: RenownConfigService;

  beforeEach(() => {
    configLoader = vi.fn();
    service = new RenownConfigService(configLoader);
  });

  describe('loadConfig', () => {
    it('should load config from YAML successfully', async () => {
      const mockConfig = {
        location: {
          default: [
            { threshold: 0, title: 'Stranger' },
            { threshold: 10, title: 'Known', perk: 'Locals recognize you' }
          ],
          city: [
            { threshold: 0, title: 'Outsider' },
            { threshold: 5, title: 'Visitor' }
          ]
        },
        faction: {
          positive: [
            { threshold: 0, title: 'Initiate' },
            { threshold: 10, title: 'Member', perk: 'Access to resources' }
          ],
          negative: [
            { threshold: 0, title: 'Neutral' },
            { threshold: -10, title: 'Opposed' }
          ]
        },
        npc: {
          personal: [
            { threshold: 0, title: 'Stranger' },
            { threshold: 5, title: 'Acquaintance' }
          ]
        }
      };

      configLoader.mockResolvedValue(mockConfig);

      await service.loadConfig();

      expect(configLoader).toHaveBeenCalledTimes(1);
    });

    it('should handle missing config gracefully', async () => {
      configLoader.mockResolvedValue(null);

      await service.loadConfig();

      // Should not throw, uses fallback defaults
      const types = service.getLocationLadderTypes();
      expect(types).toContain('default');
    });

    it('should handle malformed config', async () => {
      configLoader.mockResolvedValue({ invalid: 'data' });

      await service.loadConfig();

      // Should fall back to defaults
      const types = service.getLocationLadderTypes();
      expect(types.length).toBeGreaterThan(0);
    });

    it('should handle config loader errors', async () => {
      configLoader.mockRejectedValue(new Error('File not found'));

      await service.loadConfig();

      // Should not throw, uses fallback defaults
      const types = service.getFactionLadderTypes();
      expect(types).toContain('positive');
    });
  });

  describe('getLocationLadderTypes', () => {
    it('should return all location ladder types', async () => {
      const mockConfig = {
        location: {
          default: [{ threshold: 0, title: 'Stranger' }],
          city: [{ threshold: 0, title: 'Outsider' }],
          village: [{ threshold: 0, title: 'Newcomer' }]
        },
        faction: {},
        npc: {}
      };

      configLoader.mockResolvedValue(mockConfig);
      await service.loadConfig();

      const types = service.getLocationLadderTypes();

      expect(types).toContain('default');
      expect(types).toContain('city');
      expect(types).toContain('village');
      expect(types.length).toBe(3);
    });

    it('should return default types when no config loaded', () => {
      const types = service.getLocationLadderTypes();

      expect(types).toContain('default');
      expect(types.length).toBeGreaterThan(0);
    });
  });

  describe('getFactionLadderTypes', () => {
    it('should return all faction ladder types', async () => {
      const mockConfig = {
        location: {},
        faction: {
          positive: [{ threshold: 0, title: 'Initiate' }],
          negative: [{ threshold: 0, title: 'Neutral' }],
          combined: [{ threshold: 0, title: 'Unknown' }],
          military: [{ threshold: 0, title: 'Recruit' }]
        },
        npc: {}
      };

      configLoader.mockResolvedValue(mockConfig);
      await service.loadConfig();

      const types = service.getFactionLadderTypes();

      expect(types).toContain('positive');
      expect(types).toContain('negative');
      expect(types).toContain('combined');
      expect(types).toContain('military');
      expect(types.length).toBe(4);
    });

    it('should return default types when no config loaded', () => {
      const types = service.getFactionLadderTypes();

      // Returns minimal defaults when no config loaded
      expect(types).toContain('positive');
      expect(types.length).toBe(1);
    });
  });

  describe('getLocationLadder', () => {
    it('should return specific location ladder', async () => {
      const mockLadder = [
        { threshold: 0, title: 'Stranger' },
        { threshold: 10, title: 'Known', perk: 'Locals recognize you' },
        { threshold: 25, title: 'Respected', perk: 'Discounts at shops' }
      ];

      const mockConfig = {
        location: {
          default: mockLadder
        },
        faction: {},
        npc: {}
      };

      configLoader.mockResolvedValue(mockConfig);
      await service.loadConfig();

      const ladder = service.getLocationLadder('default');

      expect(ladder).toEqual(mockLadder);
      expect(ladder).toHaveLength(3);
      expect(ladder?.[0].title).toBe('Stranger');
      expect(ladder?.[1].perk).toBe('Locals recognize you');
    });

    it('should return null for non-existent ladder type', async () => {
      const mockConfig = {
        location: {
          default: [{ threshold: 0, title: 'Stranger' }]
        },
        faction: {},
        npc: {}
      };

      configLoader.mockResolvedValue(mockConfig);
      await service.loadConfig();

      const ladder = service.getLocationLadder('nonexistent');

      expect(ladder).toBeNull();
    });

    it('should return null when config not loaded', () => {
      // Don't load config - should return null
      const ladder = service.getLocationLadder('default');

      expect(ladder).toBeNull();
    });
  });

  describe('getFactionLadder', () => {
    it('should return specific faction ladder', async () => {
      const mockLadder = [
        { threshold: 0, title: 'Initiate' },
        { threshold: 10, title: 'Member', perk: 'Access to resources' },
        { threshold: 25, title: 'Veteran', perk: 'Leadership opportunities' }
      ];

      const mockConfig = {
        location: {},
        faction: {
          positive: mockLadder
        },
        npc: {}
      };

      configLoader.mockResolvedValue(mockConfig);
      await service.loadConfig();

      const ladder = service.getFactionLadder('positive');

      expect(ladder).toEqual(mockLadder);
      expect(ladder).toHaveLength(3);
      expect(ladder?.[1].title).toBe('Member');
      expect(ladder?.[2].perk).toBe('Leadership opportunities');
    });

    it('should handle negative faction ladder', async () => {
      const mockLadder = [
        { threshold: 0, title: 'Neutral' },
        { threshold: -10, title: 'Opposed' },
        { threshold: -25, title: 'Enemy', perk: 'Attacked on sight' }
      ];

      const mockConfig = {
        location: {},
        faction: {
          negative: mockLadder
        },
        npc: {}
      };

      configLoader.mockResolvedValue(mockConfig);
      await service.loadConfig();

      const ladder = service.getFactionLadder('negative');

      expect(ladder).toEqual(mockLadder);
      expect(ladder?.[1].threshold).toBe(-10);
    });

    it('should return null for non-existent faction ladder', async () => {
      const mockConfig = {
        location: {},
        faction: {
          positive: [{ threshold: 0, title: 'Initiate' }]
        },
        npc: {}
      };

      configLoader.mockResolvedValue(mockConfig);
      await service.loadConfig();

      const ladder = service.getFactionLadder('nonexistent');

      expect(ladder).toBeNull();
    });
  });

  describe('getNPCLadder', () => {
    it('should return NPC personal reputation ladder', async () => {
      const mockLadder = [
        { threshold: 0, title: 'Stranger' },
        { threshold: 5, title: 'Acquaintance' },
        { threshold: 15, title: 'Friend', perk: 'Will help in times of need' }
      ];

      const mockConfig = {
        location: {},
        faction: {},
        npc: {
          personal: mockLadder
        }
      };

      configLoader.mockResolvedValue(mockConfig);
      await service.loadConfig();

      const ladder = service.getNPCLadder('personal');

      expect(ladder).toEqual(mockLadder);
      expect(ladder?.[2].perk).toBe('Will help in times of need');
    });

    it('should return null when config not loaded', () => {
      // Don't load config - should return null
      const ladder = service.getNPCLadder('personal');

      expect(ladder).toBeNull();
    });
  });

  describe('clearCache', () => {
    it('should clear cached config', async () => {
      const mockConfig1 = {
        location: { default: [{ threshold: 0, title: 'First' }] },
        faction: {},
        npc: {}
      };

      const mockConfig2 = {
        location: { default: [{ threshold: 0, title: 'Second' }] },
        faction: {},
        npc: {}
      };

      configLoader.mockResolvedValueOnce(mockConfig1);
      await service.loadConfig();

      let ladder = service.getLocationLadder('default');
      expect(ladder?.[0].title).toBe('First');

      service.clearCache();

      configLoader.mockResolvedValueOnce(mockConfig2);
      await service.loadConfig();

      ladder = service.getLocationLadder('default');
      expect(ladder?.[0].title).toBe('Second');
    });
  });

  describe('fallback behavior', () => {
    it('should use default location ladder if YAML missing', async () => {
      configLoader.mockResolvedValue(null);
      await service.loadConfig();

      const ladder = service.getLocationLadder('default');

      expect(ladder).not.toBeNull();
      expect(ladder).toBeInstanceOf(Array);
      expect(ladder?.[0]).toHaveProperty('threshold');
      expect(ladder?.[0]).toHaveProperty('title');
    });

    it('should use default faction ladder if YAML missing', async () => {
      configLoader.mockResolvedValue(null);
      await service.loadConfig();

      const ladder = service.getFactionLadder('positive');

      expect(ladder).not.toBeNull();
      expect(ladder).toBeInstanceOf(Array);
    });

    it('should handle partial config with missing sections', async () => {
      const partialConfig = {
        location: {
          default: [{ threshold: 0, title: 'Stranger' }]
        }
        // Missing faction and npc sections
      };

      configLoader.mockResolvedValue(partialConfig);
      await service.loadConfig();

      const locationLadder = service.getLocationLadder('default');
      expect(locationLadder?.[0].title).toBe('Stranger');

      // Missing sections return null, not fallback
      const factionLadder = service.getFactionLadder('positive');
      expect(factionLadder).toBeNull();
    });
  });
});
