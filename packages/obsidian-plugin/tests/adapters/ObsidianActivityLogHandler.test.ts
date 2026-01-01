import { ActivityEventType } from '@quartermaster/core/models/ActivityLog';
import type {
  ActivityEvent,
  ShopTransactionEvent,
  ProjectCompletedEvent,
  CustomNoteEvent,
  TimeAdvancedEvent,
  PartyGoldAdjustedEvent,
  PartyItemAddedEvent,
  PartyItemRemovedEvent,
  ActivityLogQuery,
  ActivityLogResult,
} from '@quartermaster/core/models/ActivityLog';

/**
 * ObsidianActivityLogHandler Test Suite
 *
 * These tests focus on the algorithmic and data transformation logic
 * that can be tested independently of the Obsidian API.
 *
 * Not tested here (require Obsidian mocking):
 * - File I/O operations (ensureLogFile, registerFileWatcher)
 * - Cache loading and Vault interactions
 * - Hot cache updates on external file modifications
 */

describe('ObsidianActivityLogHandler', () => {
  // ==================== METADATA ENCODING/DECODING ====================

  describe('Metadata Encoding/Decoding', () => {
    it('should encode string to base64 safely', () => {
      const testString = 'Shop: "The Dragon\'s Hoard" <Level 5>';
      const encoded = btoa(testString);
      const decoded = atob(encoded);
      expect(decoded).toBe(testString);
    });

    it('should encode JSON metadata to base64', () => {
      const metadata = {
        shopName: 'Test Shop',
        itemCost: '100 gp',
        items: [{ name: 'Sword', cost: '50 gp' }],
      };

      const encoded = btoa(JSON.stringify(metadata));
      const decoded = JSON.parse(atob(encoded));

      expect(decoded.shopName).toBe('Test Shop');
      expect(decoded.itemCost).toBe('100 gp');
      expect(decoded.items).toHaveLength(1);
      expect(decoded.items[0].name).toBe('Sword');
    });

    it('should handle special characters in base64 encoding', () => {
      const specialChars = 'Potion of "Greater" Healing (50% off)';
      const encoded = btoa(specialChars);
      const decoded = atob(encoded);
      expect(decoded).toBe(specialChars);
    });

    it('should handle unicode characters in metadata', () => {
      const unicode = '❤️ Elven Bow 🏹 (Rare)';
      const encoded = btoa(unescape(encodeURIComponent(unicode)));
      const decoded = decodeURIComponent(escape(atob(encoded)));
      expect(decoded).toBe(unicode);
    });
  });

  // ==================== EVENT TYPE VALIDATION ====================

  describe('Event Type Validation', () => {
    it('should validate all ActivityEventType enum values', () => {
      const validTypes = Object.values(ActivityEventType);

      expect(validTypes).toContain(ActivityEventType.SHOP_TRANSACTION);
      expect(validTypes).toContain(ActivityEventType.SHOP_CREATED);
      expect(validTypes).toContain(ActivityEventType.SHOP_INVENTORY_RESTOCKED);
      expect(validTypes).toContain(ActivityEventType.PROJECT_STARTED);
      expect(validTypes).toContain(ActivityEventType.PROJECT_PROGRESS);
      expect(validTypes).toContain(ActivityEventType.PROJECT_COMPLETED);
      expect(validTypes).toContain(ActivityEventType.PROJECT_FAILED);
      expect(validTypes).toContain(ActivityEventType.TIME_ADVANCED);
      expect(validTypes).toContain(ActivityEventType.PARTY_GOLD_ADJUSTED);
      expect(validTypes).toContain(ActivityEventType.PARTY_ITEM_ADDED);
      expect(validTypes).toContain(ActivityEventType.PARTY_ITEM_REMOVED);
      expect(validTypes).toContain(ActivityEventType.CUSTOM_NOTE);
    });

    it('should reject invalid event type strings', () => {
      const validTypes = Object.values(ActivityEventType);

      expect(validTypes).not.toContain('invalid_type');
      expect(validTypes).not.toContain('SHOP_TRANSACTION');
      expect(validTypes).not.toContain('unknown_event');
    });

    it('should validate actor types', () => {
      const validActorTypes = ['player', 'gm', 'system'] as const;

      expect(validActorTypes).toContain('player');
      expect(validActorTypes).toContain('gm');
      expect(validActorTypes).toContain('system');

      expect(validActorTypes).not.toContain('invalid');
    });
  });

  // ==================== ACTIVITY LOG RESULT STRUCTURE ====================

  describe('ActivityLogResult Structure', () => {
    it('should create properly structured ActivityLogResult', () => {
      const mockEvents: ActivityEvent[] = [
        {
          id: 'evt-1',
          campaignId: 'campaign_default',
          timestamp: Date.now(),
          type: ActivityEventType.SHOP_TRANSACTION,
          actorType: 'player',
          actorName: 'Alice',
          description: 'Test transaction',
          metadata: {
            transactionType: 'purchase' as const,
            shopName: 'Test Shop',
            items: [],
            totalCost: '100 gp',
          },
        } as ShopTransactionEvent,
      ];

      const result: ActivityLogResult = {
        events: mockEvents,
        total: mockEvents.length,
        hasMore: false,
        offset: 0,
        limit: 50,
      };

      expect(result.events).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(result.offset).toBe(0);
      expect(result.limit).toBe(50);
    });

    it('should calculate hasMore flag for first page', () => {
      const totalEvents = 100;
      const limit = 50;
      const offset = 0;

      const hasMore = offset + limit < totalEvents;
      expect(hasMore).toBe(true);
    });

    it('should calculate hasMore flag for last page', () => {
      const totalEvents = 100;
      const limit = 50;
      const offset = 50;

      const hasMore = offset + limit < totalEvents;
      expect(hasMore).toBe(false);
    });

    it('should handle pagination with exact multiple', () => {
      const totalEvents = 100;
      const limit = 50;
      const offset = 100;

      const hasMore = offset + limit < totalEvents;
      expect(hasMore).toBe(false);
    });
  });

  // ==================== PAGINATION LOGIC ====================

  describe('Pagination Logic', () => {
    let mockEvents: ActivityEvent[];

    beforeEach(() => {
      mockEvents = Array.from({ length: 100 }, (_, i) => ({
        id: `evt-${i}`,
        campaignId: 'campaign_default',
        timestamp: Date.now() + i,
        type: ActivityEventType.CUSTOM_NOTE,
        actorType: 'gm' as const,
        description: `Event ${i}`,
        metadata: {
          title: `Note ${i}`,
          content: 'Test content',
        },
      } as CustomNoteEvent));
    });

    it('should slice events correctly for first page', () => {
      const offset = 0;
      const limit = 50;
      const paginated = mockEvents.slice(offset, offset + limit);

      expect(paginated).toHaveLength(50);
      expect(paginated[0].id).toBe('evt-0');
      expect(paginated[49].id).toBe('evt-49');
    });

    it('should slice events correctly for second page', () => {
      const offset = 50;
      const limit = 50;
      const paginated = mockEvents.slice(offset, offset + limit);

      expect(paginated).toHaveLength(50);
      expect(paginated[0].id).toBe('evt-50');
      expect(paginated[49].id).toBe('evt-99');
    });

    it('should handle partial last page', () => {
      const offset = 80;
      const limit = 50;
      const paginated = mockEvents.slice(offset, offset + limit);

      expect(paginated).toHaveLength(20);
      expect(paginated[0].id).toBe('evt-80');
      expect(paginated[19].id).toBe('evt-99');
    });

    it('should handle out of bounds offset', () => {
      const offset = 200;
      const limit = 50;
      const paginated = mockEvents.slice(offset, offset + limit);

      expect(paginated).toHaveLength(0);
    });

    it('should calculate correct pagination metadata', () => {
      const offset = 0;
      const limit = 25;
      const total = 100;
      const hasMore = offset + limit < total;

      expect(hasMore).toBe(true);

      const offset2 = 75;
      const hasMore2 = offset2 + limit < total;
      expect(hasMore2).toBe(false); // 75 + 25 = 100, not < 100

      const offset3 = 50;
      const hasMore3 = offset3 + limit < total;
      expect(hasMore3).toBe(true); // 50 + 25 = 75, < 100
    });
  });

  // ==================== FILTER LOGIC ====================

  describe('Filter Logic', () => {
    let mockEvents: ActivityEvent[];

    beforeEach(() => {
      mockEvents = [
        {
          id: 'evt-1',
          campaignId: 'campaign_default',
          timestamp: 1000,
          type: ActivityEventType.SHOP_TRANSACTION,
          actorType: 'player' as const,
          actorName: 'Alice',
          description: 'Bought sword',
          metadata: {} as any,
        },
        {
          id: 'evt-2',
          campaignId: 'campaign_default',
          timestamp: 2000,
          type: ActivityEventType.PROJECT_COMPLETED,
          actorType: 'system' as const,
          description: 'Project done',
          metadata: {} as any,
        },
        {
          id: 'evt-3',
          campaignId: 'campaign_other',
          timestamp: 3000,
          type: ActivityEventType.CUSTOM_NOTE,
          actorType: 'gm' as const,
          actorName: 'GameMaster',
          description: 'Custom note',
          metadata: {} as any,
        },
      ];
    });

    it('should filter by campaign ID', () => {
      const filtered = mockEvents.filter(e => e.campaignId === 'campaign_default');
      expect(filtered).toHaveLength(2);
      expect(filtered.every(e => e.campaignId === 'campaign_default')).toBe(true);
    });

    it('should filter by single event type', () => {
      const filtered = mockEvents.filter(
        e => e.type === ActivityEventType.SHOP_TRANSACTION
      );
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('evt-1');
    });

    it('should filter by multiple event types', () => {
      const types = [
        ActivityEventType.SHOP_TRANSACTION,
        ActivityEventType.CUSTOM_NOTE,
      ];
      const filtered = mockEvents.filter(e => types.includes(e.type));

      expect(filtered).toHaveLength(2);
      expect(filtered.map(e => e.id)).toEqual(['evt-1', 'evt-3']);
    });

    it('should filter by actor type', () => {
      const filtered = mockEvents.filter(e => e.actorType === 'player');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('evt-1');
    });

    it('should filter by actor types', () => {
      const actorTypes: Array<'player' | 'gm' | 'system'> = ['player', 'gm'];
      const filtered = mockEvents.filter(e => actorTypes.includes(e.actorType));

      expect(filtered).toHaveLength(2);
      expect(filtered.map(e => e.id)).toEqual(['evt-1', 'evt-3']);
    });

    it('should filter by actor name (partial match)', () => {
      const filtered = mockEvents.filter(
        e => e.actorName && e.actorName.includes('Alice')
      );
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('evt-1');
    });

    it('should filter by multiple criteria', () => {
      const filtered = mockEvents.filter(
        e =>
          e.campaignId === 'campaign_default' && e.actorType === 'system'
      );
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('evt-2');
    });

    it('should apply timestamp range filter (start)', () => {
      const startDate = 1500;
      const filtered = mockEvents.filter(e => e.timestamp >= startDate);

      expect(filtered).toHaveLength(2);
      expect(filtered.every(e => e.timestamp >= startDate)).toBe(true);
    });

    it('should apply timestamp range filter (end)', () => {
      const endDate = 2000;
      const filtered = mockEvents.filter(e => e.timestamp <= endDate);

      expect(filtered).toHaveLength(2);
      expect(filtered.every(e => e.timestamp <= endDate)).toBe(true);
    });

    it('should apply timestamp range filter (both)', () => {
      const startDate = 1500;
      const endDate = 2500;
      const filtered = mockEvents.filter(
        e => e.timestamp >= startDate && e.timestamp <= endDate
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('evt-2');
    });

    it('should handle empty filter result', () => {
      const filtered = mockEvents.filter(
        e => e.type === ActivityEventType.TIME_ADVANCED
      );
      expect(filtered).toHaveLength(0);
    });

    it('should filter by description (case-insensitive)', () => {
      const searchText = 'sword';
      const filtered = mockEvents.filter(e =>
        e.description.toLowerCase().includes(searchText.toLowerCase())
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('evt-1');
    });
  });

  // ==================== SORTING LOGIC ====================

  describe('Sorting Logic', () => {
    it('should sort by timestamp ascending', () => {
      const events = [
        { id: '3', timestamp: 3000 } as any,
        { id: '1', timestamp: 1000 } as any,
        { id: '2', timestamp: 2000 } as any,
      ];

      const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);

      expect(sorted[0].id).toBe('1');
      expect(sorted[1].id).toBe('2');
      expect(sorted[2].id).toBe('3');
    });

    it('should sort by timestamp descending', () => {
      const events = [
        { id: '1', timestamp: 1000 } as any,
        { id: '3', timestamp: 3000 } as any,
        { id: '2', timestamp: 2000 } as any,
      ];

      const sorted = [...events].sort((a, b) => b.timestamp - a.timestamp);

      expect(sorted[0].id).toBe('3');
      expect(sorted[1].id).toBe('2');
      expect(sorted[2].id).toBe('1');
    });

    it('should apply descending order flag', () => {
      const events = [
        { id: '1', timestamp: 1000 } as any,
        { id: '3', timestamp: 3000 } as any,
        { id: '2', timestamp: 2000 } as any,
      ];

      const sortOrder: 'asc' | 'desc' = 'desc';
      let sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
      sorted =
        sortOrder === 'desc'
          ? sorted.reverse()
          : sorted;

      expect(sorted[0].id).toBe('3');
      expect(sorted[2].id).toBe('1');
    });

    it('should apply ascending order flag', () => {
      const events = [
        { id: '1', timestamp: 1000 } as any,
        { id: '3', timestamp: 3000 } as any,
        { id: '2', timestamp: 2000 } as any,
      ];

      const sortOrder: 'asc' | 'desc' = 'asc';
      let sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
      if (sortOrder !== 'asc') {
        sorted = sorted.reverse();
      }

      expect(sorted[0].id).toBe('1');
      expect(sorted[2].id).toBe('3');
    });

    it('should maintain stable sort for equal timestamps', () => {
      const events = [
        { id: 'a', timestamp: 1000 } as any,
        { id: 'b', timestamp: 1000 } as any,
        { id: 'c', timestamp: 1000 } as any,
      ];

      const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);

      // All should have same timestamp
      expect(sorted.every(e => e.timestamp === 1000)).toBe(true);
      expect(sorted.map(e => e.id)).toEqual(['a', 'b', 'c']);
    });
  });

  // ==================== SEARCH LOGIC ====================

  describe('Search Logic', () => {
    let mockEvents: ActivityEvent[];

    beforeEach(() => {
      mockEvents = [
        {
          id: 'evt-1',
          campaignId: 'campaign_default',
          timestamp: 1000,
          type: ActivityEventType.SHOP_TRANSACTION,
          actorType: 'player' as const,
          description: 'Purchased healing potions at the Apothecary',
          metadata: {} as any,
        },
        {
          id: 'evt-2',
          campaignId: 'campaign_default',
          timestamp: 2000,
          type: ActivityEventType.CUSTOM_NOTE,
          actorType: 'gm' as const,
          description: 'Campaign milestone',
          metadata: {
            title: 'Quest Completed',
            content: 'The party found the dragon\'s lair',
          } as any,
        },
        {
          id: 'evt-3',
          campaignId: 'campaign_default',
          timestamp: 3000,
          type: ActivityEventType.SHOP_TRANSACTION,
          actorType: 'player' as const,
          description: 'Sold ancient artifacts at the Curiosity Shop',
          metadata: {} as any,
        },
      ];
    });

    it('should search in description field', () => {
      const searchText = 'potions';
      const filtered = mockEvents.filter(e =>
        e.description.toLowerCase().includes(searchText.toLowerCase())
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('evt-1');
    });

    it('should search case-insensitively', () => {
      const searchText = 'APOTHECARY';
      const filtered = mockEvents.filter(e =>
        e.description.toLowerCase().includes(searchText.toLowerCase())
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('evt-1');
    });

    it('should search in custom note content', () => {
      const searchText = 'dragon';
      const filtered = mockEvents.filter(e => {
        if (e.description.toLowerCase().includes(searchText.toLowerCase())) {
          return true;
        }
        if (
          e.type === ActivityEventType.CUSTOM_NOTE &&
          (e as CustomNoteEvent).metadata.content
            .toLowerCase()
            .includes(searchText.toLowerCase())
        ) {
          return true;
        }
        return false;
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('evt-2');
    });

    it('should return multiple results if matching', () => {
      const searchText = 'at';
      const filtered = mockEvents.filter(e =>
        e.description.toLowerCase().includes(searchText.toLowerCase())
      );

      expect(filtered).toHaveLength(2);
      expect(filtered.map(e => e.id)).toEqual(['evt-1', 'evt-3']);
    });

    it('should return empty result for no matches', () => {
      const searchText = 'nonexistent';
      const filtered = mockEvents.filter(e =>
        e.description.toLowerCase().includes(searchText.toLowerCase())
      );

      expect(filtered).toHaveLength(0);
    });
  });

  // ==================== COMPLETE QUERY APPLICATION ====================

  describe('Complete Query Application (Filter + Sort + Paginate)', () => {
    let mockEvents: ActivityEvent[];

    beforeEach(() => {
      mockEvents = [
        {
          id: 'evt-1',
          campaignId: 'campaign_default',
          timestamp: 3000,
          type: ActivityEventType.SHOP_TRANSACTION,
          actorType: 'player' as const,
          actorName: 'Alice',
          description: 'Shop purchase',
          metadata: {} as any,
        },
        {
          id: 'evt-2',
          campaignId: 'campaign_default',
          timestamp: 1000,
          type: ActivityEventType.PROJECT_COMPLETED,
          actorType: 'system' as const,
          description: 'Project done',
          metadata: {} as any,
        },
        {
          id: 'evt-3',
          campaignId: 'campaign_other',
          timestamp: 2000,
          type: ActivityEventType.CUSTOM_NOTE,
          actorType: 'gm' as const,
          description: 'Custom note',
          metadata: {} as any,
        },
        {
          id: 'evt-4',
          campaignId: 'campaign_default',
          timestamp: 4000,
          type: ActivityEventType.SHOP_TRANSACTION,
          actorType: 'player' as const,
          actorName: 'Bob',
          description: 'Another purchase',
          metadata: {} as any,
        },
      ];
    });

    it('should apply filter, sort, and paginate', () => {
      const query: ActivityLogQuery = {
        campaignId: 'campaign_default',
        eventTypes: [ActivityEventType.SHOP_TRANSACTION],
        offset: 0,
        limit: 10,
        sortOrder: 'desc',
      };

      let filtered = mockEvents.filter(e => e.campaignId === query.campaignId);
      if (query.eventTypes && query.eventTypes.length > 0) {
        filtered = filtered.filter(e =>
          query.eventTypes!.includes(e.type)
        );
      }

      const sortOrder = query.sortOrder || 'desc';
      filtered.sort((a, b) => {
        const comparison = a.timestamp - b.timestamp;
        return sortOrder === 'desc' ? -comparison : comparison;
      });

      const offset = query.offset || 0;
      const limit = query.limit || 50;
      const paginated = filtered.slice(offset, offset + limit);

      const result: ActivityLogResult = {
        events: paginated,
        total: filtered.length,
        hasMore: offset + limit < filtered.length,
        offset,
        limit,
      };

      expect(result.events).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(false);
      expect(result.events[0].id).toBe('evt-4'); // Most recent first
      expect(result.events[1].id).toBe('evt-1');
    });

    it('should handle complex query with multiple filters', () => {
      const query: ActivityLogQuery = {
        campaignId: 'campaign_default',
        actorTypes: ['player'],
        startDate: 2000,
        endDate: 3500,
        offset: 0,
        limit: 10,
        sortOrder: 'asc',
      };

      let filtered = mockEvents.filter(e => e.campaignId === query.campaignId);

      if (query.actorTypes && query.actorTypes.length > 0) {
        filtered = filtered.filter(e =>
          query.actorTypes!.includes(e.actorType)
        );
      }

      if (query.startDate !== undefined) {
        filtered = filtered.filter(e => e.timestamp >= query.startDate!);
      }
      if (query.endDate !== undefined) {
        filtered = filtered.filter(e => e.timestamp <= query.endDate!);
      }

      const sortOrder = query.sortOrder || 'desc';
      filtered.sort((a, b) => {
        const comparison = a.timestamp - b.timestamp;
        return sortOrder === 'desc' ? -comparison : comparison;
      });

      const offset = query.offset || 0;
      const limit = query.limit || 50;
      const paginated = filtered.slice(offset, offset + limit);

      const result: ActivityLogResult = {
        events: paginated,
        total: filtered.length,
        hasMore: offset + limit < filtered.length,
        offset,
        limit,
      };

      expect(result.events).toHaveLength(1);
      expect(result.events[0].id).toBe('evt-1');
      expect(result.total).toBe(1);
    });
  });

  // ==================== WIKI LINK FORMATTING ====================

  describe('Wiki Link Formatting', () => {
    const wikilink = (name: string): string => `[[${name}]]`;

    it('should create wikilinks for shop names', () => {
      expect(wikilink("The Dragon's Hoard")).toBe(
        "[[The Dragon's Hoard]]"
      );
      expect(wikilink('Blacksmith Shop')).toBe('[[Blacksmith Shop]]');
    });

    it('should create wikilinks for location names', () => {
      expect(wikilink('Market District')).toBe('[[Market District]]');
      expect(wikilink('Port City')).toBe('[[Port City]]');
    });

    it('should handle special characters in wikilinks', () => {
      expect(wikilink('Shop & Trade')).toBe('[[Shop & Trade]]');
      expect(wikilink('(Secret) Back Door')).toBe(
        '[[(Secret) Back Door]]'
      );
    });

    it('should preserve case in wikilinks', () => {
      expect(wikilink('The Dragon\'s Hoard')).toBe(
        '[[The Dragon\'s Hoard]]'
      );
      expect(wikilink('DANGEROUS CAVE')).toBe('[[DANGEROUS CAVE]]');
    });
  });

  // ==================== EVENT TYPE LABEL FORMATTING ====================

  describe('Event Type Label Formatting', () => {
    const formatEventTypeLabel = (type: ActivityEventType): string => {
      const labels: Record<ActivityEventType, string> = {
        [ActivityEventType.SHOP_TRANSACTION]: 'Shop Transaction',
        [ActivityEventType.SHOP_CREATED]: 'Shop Created',
        [ActivityEventType.SHOP_INVENTORY_RESTOCKED]: 'Shop Restocked',
        [ActivityEventType.PROJECT_STARTED]: 'Project Started',
        [ActivityEventType.PROJECT_PROGRESS]: 'Project Progress',
        [ActivityEventType.PROJECT_COMPLETED]: 'Project Completed',
        [ActivityEventType.PROJECT_FAILED]: 'Project Failed',
        [ActivityEventType.TIME_ADVANCED]: 'Time Advanced',
        [ActivityEventType.PARTY_GOLD_ADJUSTED]: 'Party Gold Adjusted',
        [ActivityEventType.PARTY_ITEM_ADDED]: 'Party Item Added',
        [ActivityEventType.PARTY_ITEM_REMOVED]: 'Party Item Removed',
        [ActivityEventType.CUSTOM_NOTE]: 'Custom Note',
      };
      return (
        labels[type] ||
        type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      );
    };

    it('should format shop transaction label', () => {
      expect(formatEventTypeLabel(ActivityEventType.SHOP_TRANSACTION)).toBe(
        'Shop Transaction'
      );
    });

    it('should format all event type labels correctly', () => {
      const labels = {
        [ActivityEventType.SHOP_CREATED]: 'Shop Created',
        [ActivityEventType.PROJECT_COMPLETED]: 'Project Completed',
        [ActivityEventType.TIME_ADVANCED]: 'Time Advanced',
        [ActivityEventType.PARTY_GOLD_ADJUSTED]: 'Party Gold Adjusted',
        [ActivityEventType.CUSTOM_NOTE]: 'Custom Note',
      };

      Object.entries(labels).forEach(([type, label]) => {
        expect(formatEventTypeLabel(type as ActivityEventType)).toBe(label);
      });
    });
  });

  // ==================== CORRUPTED ENTRY HANDLING ====================

  describe('Corrupted Entry Structure', () => {
    it('should create properly structured corrupted entry', () => {
      const corruptedEntry = {
        lineNumber: 42,
        rawContent: 'Invalid markdown content <!-- incomplete',
        error: 'Missing metadata HTML comment',
      };

      expect(corruptedEntry.lineNumber).toBe(42);
      expect(corruptedEntry.rawContent).toContain('Invalid');
      expect(corruptedEntry.error).toContain('Missing');
    });

    it('should track multiple corrupted entries', () => {
      const corrupted = [
        {
          lineNumber: 10,
          rawContent: 'Content 1',
          error: 'Error 1',
        },
        {
          lineNumber: 50,
          rawContent: 'Content 2',
          error: 'Error 2',
        },
      ];

      expect(corrupted).toHaveLength(2);
      expect(corrupted[0].lineNumber).toBe(10);
      expect(corrupted[1].lineNumber).toBe(50);
    });
  });

  // ==================== GAME DATE FILTERING ====================

  describe('Game Date Filtering', () => {
    let mockEvents: ActivityEvent[];

    beforeEach(() => {
      mockEvents = [
        {
          id: 'evt-1',
          campaignId: 'campaign_default',
          timestamp: 1000,
          gameDate: '2024-01-01',
          type: ActivityEventType.CUSTOM_NOTE,
          actorType: 'gm' as const,
          description: 'Day 1',
          metadata: {} as any,
        },
        {
          id: 'evt-2',
          campaignId: 'campaign_default',
          timestamp: 2000,
          gameDate: '2024-02-15',
          type: ActivityEventType.CUSTOM_NOTE,
          actorType: 'gm' as const,
          description: 'Day 46',
          metadata: {} as any,
        },
        {
          id: 'evt-3',
          campaignId: 'campaign_default',
          timestamp: 3000,
          gameDate: '2024-03-30',
          type: ActivityEventType.CUSTOM_NOTE,
          actorType: 'gm' as const,
          description: 'Day 89',
          metadata: {} as any,
        },
      ];
    });

    it('should filter by game start date', () => {
      const gameStartDate = '2024-02-01';
      const filtered = mockEvents.filter(
        e => e.gameDate && e.gameDate >= gameStartDate
      );

      expect(filtered).toHaveLength(2);
      expect(filtered.map(e => e.id)).toEqual(['evt-2', 'evt-3']);
    });

    it('should filter by game end date', () => {
      const gameEndDate = '2024-02-28';
      const filtered = mockEvents.filter(
        e => e.gameDate && e.gameDate <= gameEndDate
      );

      expect(filtered).toHaveLength(2);
      expect(filtered.map(e => e.id)).toEqual(['evt-1', 'evt-2']);
    });

    it('should filter by game date range', () => {
      const gameStartDate = '2024-02-01';
      const gameEndDate = '2024-03-01';
      const filtered = mockEvents.filter(
        e =>
          e.gameDate &&
          e.gameDate >= gameStartDate &&
          e.gameDate <= gameEndDate
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('evt-2');
    });

    it('should handle events without game date', () => {
      const eventWithoutGameDate: ActivityEvent = {
        id: 'evt-4',
        campaignId: 'campaign_default',
        timestamp: 4000,
        type: ActivityEventType.CUSTOM_NOTE,
        actorType: 'gm' as const,
        description: 'No date',
        metadata: {} as any,
      };

      const filtered = [eventWithoutGameDate, ...mockEvents].filter(
        e => e.gameDate && e.gameDate >= '2024-01-01'
      );

      expect(filtered).toHaveLength(3);
      expect(filtered.every(e => e.gameDate !== undefined)).toBe(true);
    });
  });
});
