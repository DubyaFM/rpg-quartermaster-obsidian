import { describe, it, expect } from 'vitest';
import { DEFAULT_CAMPAIGN, type Campaign } from '../../models/Campaign';

describe('Campaign Types', () => {
  describe('DEFAULT_CAMPAIGN', () => {
    it('should have correct id and name', () => {
      expect(DEFAULT_CAMPAIGN.id).toBe('campaign_default');
      expect(DEFAULT_CAMPAIGN.name).toBe('Default Campaign');
    });

    it('should be marked as active', () => {
      expect(DEFAULT_CAMPAIGN.isActive).toBe(true);
    });

    it('should have valid timestamps', () => {
      expect(DEFAULT_CAMPAIGN.createdAt).toBeGreaterThan(0);
      expect(DEFAULT_CAMPAIGN.updatedAt).toBeGreaterThan(0);
    });
  });

  describe('Campaign Interface', () => {
    it('should allow creating custom campaigns', () => {
      const campaign: Campaign = {
        id: 'test-campaign',
        name: 'Test Campaign',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isActive: false,
        description: 'A test campaign',
        partyMembers: ['Alice', 'Bob'],
      };

      expect(campaign.id).toBe('test-campaign');
      expect(campaign.partyMembers).toHaveLength(2);
    });
  });
});
