import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActivityLogService } from '../../services/ActivityLogService';
import { ActivityEventType } from '../../models/ActivityLog';
import type { IDataAdapter } from '../../interfaces/IDataAdapter';
import type { ActivityEvent, ActivityLogResult } from '../../models/ActivityLog';

describe('ActivityLogService', () => {
  let mockAdapter: Partial<IDataAdapter>;
  let service: ActivityLogService;
  let loggedEvents: ActivityEvent[];

  beforeEach(() => {
    loggedEvents = [];
    mockAdapter = {
      logActivity: vi.fn(async (event: ActivityEvent) => {
        loggedEvents.push(event);
      }),
      getActivityLog: vi.fn(async () => ({
        events: loggedEvents,
        total: loggedEvents.length,
        hasMore: false,
        offset: 0,
        limit: 50,
      })),
      searchActivityLog: vi.fn(async () => ({
        events: [],
        total: 0,
        hasMore: false,
        offset: 0,
        limit: 50,
      })),
      getActivityLogByDateRange: vi.fn(async () => ({
        events: [],
        total: 0,
        hasMore: false,
        offset: 0,
        limit: 100,
      })),
    };
    service = new ActivityLogService(mockAdapter as IDataAdapter);
  });

  describe('logShopTransaction', () => {
    it('should log a purchase transaction', async () => {
      await service.logShopTransaction({
        transactionType: 'purchase',
        shopName: 'The Smithy',
        items: [
          {
            itemName: 'Longsword',
            quantity: 1,
            unitCost: '15 gp',
            totalCost: '15 gp',
          },
        ],
        totalCost: '15 gp',
        playerName: 'Alice',
      });

      expect(mockAdapter.logActivity).toHaveBeenCalledOnce();
      expect(loggedEvents).toHaveLength(1);

      const event = loggedEvents[0];
      expect(event.type).toBe(ActivityEventType.SHOP_TRANSACTION);
      expect(event.metadata.transactionType).toBe('purchase');
      expect(event.metadata.shopName).toBe('The Smithy');
      expect(event.metadata.playerName).toBe('Alice');
      expect(event.description).toContain('purchased');
      expect(event.description).toContain('The Smithy');
    });

    it('should log a sale transaction', async () => {
      await service.logShopTransaction({
        transactionType: 'sale',
        shopName: 'General Store',
        items: [
          {
            itemName: 'Potion of Healing',
            quantity: 3,
            unitCost: '25 gp',
            totalCost: '75 gp',
          },
        ],
        totalCost: '75 gp',
      });

      const event = loggedEvents[0];
      expect(event.metadata.transactionType).toBe('sale');
      expect(event.description).toContain('sold');
    });
  });

  describe('logShopCreated', () => {
    it('should log shop creation with NPC details', async () => {
      await service.logShopCreated({
        shopName: 'Arcane Emporium',
        shopType: 'Magic Shop',
        wealthLevel: 'Wealthy',
        location: 'Market District',
        npcShopkeep: {
          name: 'Elara Moonwhisper',
          species: 'Elf',
          disposition: 'Friendly',
        },
      });

      const event = loggedEvents[0];
      expect(event.type).toBe(ActivityEventType.SHOP_CREATED);
      expect(event.metadata.shopName).toBe('Arcane Emporium');
      expect(event.metadata.npcShopkeep?.name).toBe('Elara Moonwhisper');
      expect(event.description).toContain('wealthy');
      expect(event.description).toContain('Market District');
    });
  });

  describe('logProjectStarted', () => {
    it('should log project start with assigned players', async () => {
      await service.logProjectStarted({
        projectName: 'Scribe Scroll',
        projectId: 'proj-001',
        templateName: 'Scroll Scribing',
        assignedPlayers: ['Alice', 'Bob'],
        estimatedDuration: '7 days',
        cost: '150 gp',
      });

      const event = loggedEvents[0];
      expect(event.type).toBe(ActivityEventType.PROJECT_STARTED);
      expect(event.metadata.assignedPlayers).toEqual(['Alice', 'Bob']);
      expect(event.description).toContain('Alice, Bob');
    });
  });

  describe('logProjectCompleted', () => {
    it('should log project completion with item outcome', async () => {
      await service.logProjectCompleted({
        projectName: 'Scribe Scroll',
        projectId: 'proj-001',
        totalDaysSpent: 7,
        outcome: {
          type: 'item',
          itemName: 'Scroll of Fireball',
        },
      });

      const event = loggedEvents[0];
      expect(event.type).toBe(ActivityEventType.PROJECT_COMPLETED);
      expect(event.metadata.outcome.type).toBe('item');
      expect(event.metadata.outcome.itemName).toBe('Scroll of Fireball');
    });

    it('should log project completion with currency outcome', async () => {
      await service.logProjectCompleted({
        projectName: 'Pit Fighting',
        projectId: 'proj-002',
        totalDaysSpent: 3,
        outcome: {
          type: 'currency',
          currencyAmount: '75 gp',
        },
      });

      const event = loggedEvents[0];
      expect(event.metadata.outcome.type).toBe('currency');
      expect(event.metadata.outcome.currencyAmount).toBe('75 gp');
    });
  });

  describe('logProjectFailed', () => {
    it('should log project failure', async () => {
      await service.logProjectFailed({
        projectName: 'Failed Quest',
        projectId: 'proj-003',
        daysSpent: 5,
        failureReason: 'Ran into a Tarrasque',
      });

      const event = loggedEvents[0];
      expect(event.type).toBe(ActivityEventType.PROJECT_FAILED);
      expect(event.metadata.projectName).toBe('Failed Quest');
      expect(event.metadata.failureReason).toBe('Ran into a Tarrasque');
      expect(event.description).toContain('failed after 5 days');
    });
  });

  describe('logTimeAdvanced', () => {
    it('should log time advancement with affected systems', async () => {
      await service.logTimeAdvanced({
        daysAdvanced: 3,
        fromDate: '2024-01-01',
        toDate: '2024-01-04',
        affectedSystems: ['projects', 'strongholds'],
      });

      const event = loggedEvents[0];
      expect(event.type).toBe(ActivityEventType.TIME_ADVANCED);
      expect(event.metadata.daysAdvanced).toBe(3);
      expect(event.metadata.affectedSystems).toContain('projects');
      expect(event.description).toContain('3 days');
    });
  });

  describe('logPartyFundsAdjusted', () => {
    it('should log funds addition', async () => {
      await service.logPartyFundsAdjusted({
        adjustmentType: 'add',
        amount: '100 gp',
        previousBalance: '500 gp',
        newBalance: '600 gp',
        reason: 'Quest reward',
      });

      const event = loggedEvents[0];
      expect(event.type).toBe(ActivityEventType.PARTY_FUNDS_ADJUSTED);
      expect(event.metadata.adjustmentType).toBe('add');
      expect(event.description).toContain('Added');
    });

    it('should log funds subtraction', async () => {
      await service.logPartyFundsAdjusted({
        adjustmentType: 'subtract',
        amount: '50 gp',
        previousBalance: '500 gp',
        newBalance: '450 gp',
        reason: 'Tax payment',
      });

      const event = loggedEvents[0];
      expect(event.type).toBe(ActivityEventType.PARTY_FUNDS_ADJUSTED);
      expect(event.metadata.adjustmentType).toBe('subtract');
      expect(event.description).toContain('Subtracted');
    });

    it('should log funds set', async () => {
      await service.logPartyFundsAdjusted({
        adjustmentType: 'set',
        amount: '1000 gp',
        previousBalance: '500 gp',
        newBalance: '1000 gp',
        reason: 'Found treasure',
      });

      const event = loggedEvents[0];
      expect(event.type).toBe(ActivityEventType.PARTY_FUNDS_ADJUSTED);
      expect(event.metadata.adjustmentType).toBe('set');
      expect(event.description).toContain('Set');
    });
  });

  describe('logPartyItemAdded', () => {
    it('should log item addition from shop purchase', async () => {
      await service.logPartyItemAdded({
        itemName: 'Longsword',
        quantity: 1,
        source: 'shop_purchase',
        associatedEventId: 'trans-123',
      });

      const event = loggedEvents[0];
      expect(event.type).toBe(ActivityEventType.PARTY_ITEM_ADDED);
      expect(event.metadata.source).toBe('shop_purchase');
      expect(event.metadata.associatedEventId).toBe('trans-123');
      expect(event.description).toContain('Added 1x Longsword');
    });
  });

  describe('logPartyItemRemoved', () => {
    it('should log item removal due to sale', async () => {
      await service.logPartyItemRemoved({
        itemName: 'Shortsword',
        quantity: 1,
        reason: 'sold',
        associatedEventId: 'trans-456',
      });

      const event = loggedEvents[0];
      expect(event.type).toBe(ActivityEventType.PARTY_ITEM_REMOVED);
      expect(event.metadata.reason).toBe('sold');
      expect(event.metadata.associatedEventId).toBe('trans-456');
      expect(event.description).toContain('Removed 1x Shortsword');
    });

    it('should log item removal due to consumption', async () => {
      await service.logPartyItemRemoved({
        itemName: 'Ration',
        quantity: 5,
        reason: 'consumed',
      });

      const event = loggedEvents[0];
      expect(event.type).toBe(ActivityEventType.PARTY_ITEM_REMOVED);
      expect(event.metadata.reason).toBe('consumed');
      expect(event.description).toContain('Removed 5x Ration');
    });

    it('should log item removal due to loss', async () => {
      await service.logPartyItemRemoved({
        itemName: 'Magic Ring',
        quantity: 1,
        reason: 'lost',
      });

      const event = loggedEvents[0];
      expect(event.type).toBe(ActivityEventType.PARTY_ITEM_REMOVED);
      expect(event.metadata.reason).toBe('lost');
      expect(event.description).toContain('Removed 1x Magic Ring');
    });

    it('should log item removal due to manual adjustment', async () => {
      await service.logPartyItemRemoved({
        itemName: 'Gold Piece',
        quantity: 100,
        reason: 'manual',
        actorName: 'Alice',
      });

      const event = loggedEvents[0];
      expect(event.type).toBe(ActivityEventType.PARTY_ITEM_REMOVED);
      expect(event.metadata.reason).toBe('manual');
      expect(event.actorType).toBe('gm');
      expect(event.actorName).toBe('Alice');
    });
  });

  describe('logCustomNote', () => {
    it('should log custom note with tags', async () => {
      await service.logCustomNote({
        title: 'Session Notes',
        content: 'Party defeated the dragon',
        tags: ['combat', 'milestone'],
        category: 'Session Summary',
      });

      const event = loggedEvents[0];
      expect(event.type).toBe(ActivityEventType.CUSTOM_NOTE);
      expect(event.metadata.title).toBe('Session Notes');
      expect(event.metadata.tags).toContain('combat');
    });
  });

  describe('Query Methods', () => {
    it('should call getActivityLog with query parameters', async () => {
      await service.getActivityLog({
        campaignId: 'campaign_default',
        eventTypes: [ActivityEventType.SHOP_TRANSACTION],
        limit: 25,
        offset: 0,
      });

      expect(mockAdapter.getActivityLog).toHaveBeenCalledOnce();
    });

    it('should call searchActivityLog with search text', async () => {
      await service.searchActivityLog('dragon', 50, 0);

      expect(mockAdapter.searchActivityLog).toHaveBeenCalledWith(
        'campaign_default',
        'dragon',
        50,
        0
      );
    });

    it('should call getActivityLogByDateRange with date range', async () => {
      const start = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const end = Date.now();

      await service.getActivityLogByDateRange(start, end);

      expect(mockAdapter.getActivityLogByDateRange).toHaveBeenCalledWith(
        'campaign_default',
        start,
        end,
        100,
        0
      );
    });
  });

  describe('Graceful Degradation', () => {
    it('should handle missing adapter methods gracefully', async () => {
      const serviceWithoutMethods = new ActivityLogService({} as IDataAdapter);

      const result = await serviceWithoutMethods.getActivityLog({
        campaignId: 'test',
      });

      expect(result.events).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('Graceful Degradation for Log methods', () => {
    let serviceWithoutLogActivity: ActivityLogService;

    beforeEach(() => {
      // Create a mock adapter where logActivity is undefined
      serviceWithoutLogActivity = new ActivityLogService({} as IDataAdapter);
    });

    it('logShopTransaction should not throw if adapter.logActivity is undefined', async () => {
      await expect(serviceWithoutLogActivity.logShopTransaction({
        transactionType: 'purchase',
        shopName: 'Test Shop',
        items: [{ itemName: 'Item', quantity: 1, unitCost: '1 gp', totalCost: '1 gp' }],
        totalCost: '1 gp',
      })).resolves.toBeUndefined();
    });

    it('logShopCreated should not throw if adapter.logActivity is undefined', async () => {
      await expect(serviceWithoutLogActivity.logShopCreated({
        shopName: 'Test Shop',
        shopType: 'Magic',
        wealthLevel: 'Wealthy',
      })).resolves.toBeUndefined();
    });

    it('logProjectStarted should not throw if adapter.logActivity is undefined', async () => {
      await expect(serviceWithoutLogActivity.logProjectStarted({
        projectName: 'Test Project',
        projectId: 'proj-123',
        templateName: 'Template',
        assignedPlayers: ['Player1'],
        estimatedDuration: '1 day',
      })).resolves.toBeUndefined();
    });

    it('logProjectProgress should not throw if adapter.logActivity is undefined', async () => {
      await expect(serviceWithoutLogActivity.logProjectProgress({
        projectName: 'Test Project',
        projectId: 'proj-123',
        daysWorked: 1,
        successfulDays: 1,
        failedDays: 0,
      })).resolves.toBeUndefined();
    });

    it('logProjectCompleted should not throw if adapter.logActivity is undefined', async () => {
      await expect(serviceWithoutLogActivity.logProjectCompleted({
        projectName: 'Test Project',
        projectId: 'proj-123',
        totalDaysSpent: 5,
        outcome: { type: 'item', itemName: 'Reward' },
      })).resolves.toBeUndefined();
    });

    it('logProjectFailed should not throw if adapter.logActivity is undefined', async () => {
      await expect(serviceWithoutLogActivity.logProjectFailed({
        projectName: 'Test Project',
        projectId: 'proj-123',
        daysSpent: 5,
        failureReason: 'Failed',
      })).resolves.toBeUndefined();
    });

    it('logTimeAdvanced should not throw if adapter.logActivity is undefined', async () => {
      await expect(serviceWithoutLogActivity.logTimeAdvanced({
        daysAdvanced: 1,
        fromDate: '2024-01-01',
        toDate: '2024-01-02',
        affectedSystems: [],
      })).resolves.toBeUndefined();
    });

    it('logPartyFundsAdjusted should not throw if adapter.logActivity is undefined', async () => {
      await expect(serviceWithoutLogActivity.logPartyFundsAdjusted({
        adjustmentType: 'add',
        amount: '10 gp',
        previousBalance: '0 gp',
        newBalance: '10 gp',
        reason: 'Test',
      })).resolves.toBeUndefined();
    });

    it('logPartyItemAdded should not throw if adapter.logActivity is undefined', async () => {
      await expect(serviceWithoutLogActivity.logPartyItemAdded({
        itemName: 'Test Item',
        quantity: 1,
        source: 'manual',
      })).resolves.toBeUndefined();
    });

    it('logPartyItemRemoved should not throw if adapter.logActivity is undefined', async () => {
      await expect(serviceWithoutLogActivity.logPartyItemRemoved({
        itemName: 'Test Item',
        quantity: 1,
        reason: 'manual',
      })).resolves.toBeUndefined();
    });

    it('logCustomNote should not throw if adapter.logActivity is undefined', async () => {
      await expect(serviceWithoutLogActivity.logCustomNote({
        title: 'Test Note',
        content: 'Content',
      })).resolves.toBeUndefined();
    });
  });
});

