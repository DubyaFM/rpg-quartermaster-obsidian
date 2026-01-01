import { describe, it, expect } from 'vitest';
import {
  ActivityEventType,
  type ActivityEvent,
  type ShopTransactionEvent,
  type ProjectCompletedEvent,
} from '../../models/ActivityLog';

describe('ActivityLog Types', () => {
  describe('Discriminated Union Type Safety', () => {
    it('should narrow type based on ActivityEventType.SHOP_TRANSACTION', () => {
      const event: ActivityEvent = {
        id: 'test-123',
        campaignId: 'campaign_default',
        timestamp: Date.now(),
        type: ActivityEventType.SHOP_TRANSACTION,
        actorType: 'player',
        actorName: 'Alice',
        description: 'Purchased items',
        metadata: {
          transactionType: 'purchase',
          shopName: 'The Smithy',
          items: [],
          totalCost: '50 gp',
        },
      };

      if (event.type === ActivityEventType.SHOP_TRANSACTION) {
        // TypeScript should know this is ShopTransactionEvent
        expect(event.metadata.shopName).toBe('The Smithy');
        expect(event.metadata.transactionType).toBe('purchase');
      }
    });

    it('should handle PROJECT_COMPLETED type with outcome metadata', () => {
      const event: ProjectCompletedEvent = {
        id: 'proj-456',
        campaignId: 'campaign_default',
        timestamp: Date.now(),
        type: ActivityEventType.PROJECT_COMPLETED,
        actorType: 'system',
        description: 'Project completed',
        metadata: {
          projectName: 'Scribe Scroll',
          projectId: 'proj-001',
          totalDaysSpent: 7,
          outcome: {
            type: 'item',
            itemName: 'Scroll of Fireball',
          },
        },
      };

      expect(event.metadata.projectName).toBe('Scribe Scroll');
      expect(event.metadata.outcome.type).toBe('item');
      expect(event.metadata.outcome.itemName).toBe('Scroll of Fireball');
    });
  });

  describe('ActivityEventType Enum', () => {
    it('should have all 12 event types defined', () => {
      expect(ActivityEventType.SHOP_TRANSACTION).toBe('shop_transaction');
      expect(ActivityEventType.SHOP_CREATED).toBe('shop_created');
      expect(ActivityEventType.SHOP_INVENTORY_RESTOCKED).toBe('shop_inventory_restocked');
      expect(ActivityEventType.PROJECT_STARTED).toBe('project_started');
      expect(ActivityEventType.PROJECT_PROGRESS).toBe('project_progress');
      expect(ActivityEventType.PROJECT_COMPLETED).toBe('project_completed');
      expect(ActivityEventType.PROJECT_FAILED).toBe('project_failed');
      expect(ActivityEventType.TIME_ADVANCED).toBe('time_advanced');
      expect(ActivityEventType.PARTY_FUNDS_ADJUSTED).toBe('party_funds_adjusted');
      expect(ActivityEventType.PARTY_ITEM_ADDED).toBe('party_item_added');
      expect(ActivityEventType.PARTY_ITEM_REMOVED).toBe('party_item_removed');
      expect(ActivityEventType.CUSTOM_NOTE).toBe('custom_note');
    });
  });
});
