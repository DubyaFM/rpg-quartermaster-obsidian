/**
 * Activity Log Type System
 *
 * Comprehensive event system for tracking all campaign activities across:
 * - Shop transactions and management
 * - Projects and downtime activities
 * - Party inventory changes
 * - Time advancement
 * - Custom notes and milestones
 *
 * Uses discriminated unions for strict type safety and exhaustiveness checking.
 */

/**
 * Activity event type enum
 * All possible event types that can be logged in the activity system
 */
export enum ActivityEventType {
  SHOP_TRANSACTION = 'shop_transaction',
  SHOP_CREATED = 'shop_created',
  SHOP_INVENTORY_RESTOCKED = 'shop_inventory_restocked',
  PROJECT_STARTED = 'project_started',
  PROJECT_PROGRESS = 'project_progress',
  PROJECT_COMPLETED = 'project_completed',
  PROJECT_FAILED = 'project_failed',
  STRONGHOLD_ORDER_GIVEN = 'stronghold_order_given',
  STRONGHOLD_ORDER_COMPLETED = 'stronghold_order_completed',
  TIME_ADVANCED = 'time_advanced',
  PARTY_FUNDS_ADJUSTED = 'party_funds_adjusted',
  PARTY_ITEM_ADDED = 'party_item_added',
  PARTY_ITEM_REMOVED = 'party_item_removed',
  CUSTOM_NOTE = 'custom_note',
}

/**
 * Base activity event - shared fields for all event types
 * All specific event types extend this interface
 */
export interface BaseActivityEvent {
  /** UUID identifier for this event */
  id: string;

  /** Campaign ID (for Phase 1: always "campaign_default") */
  campaignId: string;

  /** Unix timestamp in milliseconds (Date.now()) */
  timestamp: number;

  /** Optional in-game date (ISO format or custom string) */
  gameDate?: string;

  /** Event type discriminator for discriminated union */
  type: ActivityEventType;

  /** Who triggered this event */
  actorType: 'player' | 'gm' | 'system';

  /** Optional actor name (player name or "Game Master") */
  actorName?: string;

  /** Human-readable summary of the event */
  description: string;

  /** Type-safe metadata discriminated by event type */
  metadata: unknown;

  /** Optional GM notes added after event creation */
  notes?: string;

  /** Timestamp when notes were last updated (Unix timestamp in milliseconds) */
  notesLastUpdated?: number;
}

/**
 * Shop purchase or sale transaction
 * Tracks individual shop transactions with item details and costs
 */
export interface ShopTransactionEvent extends BaseActivityEvent {
  type: ActivityEventType.SHOP_TRANSACTION;
  metadata: {
    /** Whether party bought or sold */
    transactionType: 'purchase' | 'sale';

    /** Shop where transaction occurred */
    shopName: string;

    /** Optional reference to shop file/id */
    shopId?: string;

    /** Items in this transaction */
    items: Array<{
      /** Item display name */
      itemName: string;

      /** Optional reference to item file/id */
      itemId?: string;

      /** Quantity purchased/sold */
      quantity: number;

      /** Cost per unit (currency format: "5 gp, 3 sp") */
      unitCost: string;

      /** Total cost for this item line (quantity × unitCost) */
      totalCost: string;
    }>;

    /** Total transaction value across all items */
    totalCost: string;

    /** Party member who made this transaction (optional) */
    playerName?: string;
  };
}

/**
 * Shop creation event
 * Logged when a new shop is generated or created
 */
export interface ShopCreatedEvent extends BaseActivityEvent {
  type: ActivityEventType.SHOP_CREATED;
  metadata: {
    /** Display name of shop */
    shopName: string;

    /** Optional reference to shop file/id */
    shopId?: string;

    /** Shop type (e.g., "Blacksmith", "Alchemist", "Magic Shop") */
    shopType: string;

    /** Wealth level (e.g., "Poor", "Modest", "Comfortable", "Wealthy", "Aristocratic") */
    wealthLevel: string;

    /** Optional in-world location of shop */
    location?: string;

    /** Optional NPC shopkeeper details */
    npcShopkeep?: {
      name: string;
      species: string;
      disposition: string;
    };
  };
}

/**
 * Shop inventory restocking event
 * Logged when a shop's inventory is refreshed or updated
 */
export interface ShopInventoryRestockedEvent extends BaseActivityEvent {
  type: ActivityEventType.SHOP_INVENTORY_RESTOCKED;
  metadata: {
    /** Shop being restocked */
    shopName: string;

    /** Optional reference to shop file/id */
    shopId?: string;

    /** Number of items added during restock */
    itemsAdded: number;

    /** Whether full restock or partial update */
    restockType: 'full' | 'partial';
  };
}

/**
 * Project start event
 * Logged when a downtime project is created and started
 */
export interface ProjectStartedEvent extends BaseActivityEvent {
  type: ActivityEventType.PROJECT_STARTED;
  metadata: {
    /** Project display name */
    projectName: string;

    /** Unique project identifier */
    projectId: string;

    /** Template this project is based on */
    templateName: string;

    /** Party members assigned to this project */
    assignedPlayers: string[];

    /** Estimated duration (e.g., "7 days" or "Variable") */
    estimatedDuration: string;

    /** Optional project cost (currency format: "100 gp") */
    cost?: string;
  };
}

/**
 * Project progress update event
 * Logged when a project makes progress (days worked, checks made)
 */
export interface ProjectProgressEvent extends BaseActivityEvent {
  type: ActivityEventType.PROJECT_PROGRESS;
  metadata: {
    /** Project name */
    projectName: string;

    /** Project identifier */
    projectId: string;

    /** Total days worked so far */
    daysWorked: number;

    /** Number of successful work days */
    successfulDays: number;

    /** Number of failed work days */
    failedDays: number;

    /** Days remaining until completion (optional) */
    remainingDays?: number;

    /** Progress as percentage 0-100 (optional) */
    progressPercentage?: number;
  };
}

/**
 * Project completion event
 * Logged when a project finishes successfully
 */
export interface ProjectCompletedEvent extends BaseActivityEvent {
  type: ActivityEventType.PROJECT_COMPLETED;
  metadata: {
    /** Project name */
    projectName: string;

    /** Project identifier */
    projectId: string;

    /** Total days spent on this project */
    totalDaysSpent: number;

    /** Outcome details */
    outcome: {
      /** Type of outcome produced */
      type: 'item' | 'currency' | 'information' | 'custom';

      /** Item name if outcome type is 'item' */
      itemName?: string;

      /** Currency amount if outcome type is 'currency' (currency format) */
      currencyAmount?: string;

      /** Notes/information if outcome type is 'information' or 'custom' */
      notes?: string;
    };
  };
}

/**
 * Project failure event
 * Logged when a project fails to complete
 */
export interface ProjectFailedEvent extends BaseActivityEvent {
  type: ActivityEventType.PROJECT_FAILED;
  metadata: {
    /** Project name */
    projectName: string;

    /** Project identifier */
    projectId: string;

    /** Days spent before failure */
    daysSpent: number;

    /** Reason for failure */
    failureReason: string;
  };
}

/**
 * Time advancement event
 * Logged when game time advances (long rest, downtime, etc.)
 */
export interface TimeAdvancedEvent extends BaseActivityEvent {
  type: ActivityEventType.TIME_ADVANCED;
  metadata: {
    /** Number of days advanced */
    daysAdvanced: number;

    /** Starting date before time advancement */
    fromDate: string;

    /** Ending date after time advancement */
    toDate: string;

    /** Systems affected by this time advancement */
    affectedSystems: string[];
  };
}

/**
 * Party funds adjustment event
 * Logged when party funds are added, removed, or set
 */
export interface PartyFundsAdjustedEvent extends BaseActivityEvent {
  type: ActivityEventType.PARTY_FUNDS_ADJUSTED;
  metadata: {
    /** Type of adjustment */
    adjustmentType: 'add' | 'subtract' | 'set';

    /** Amount adjusted (currency format: "50 gp, 5 sp") */
    amount: string;

    /** Party funds before adjustment */
    previousBalance: string;

    /** Party funds after adjustment */
    newBalance: string;

    /** Reason for adjustment */
    reason: string;
  };
}

/**
 * Party item added event
 * Logged when an item is added to party inventory
 */
export interface PartyItemAddedEvent extends BaseActivityEvent {
  type: ActivityEventType.PARTY_ITEM_ADDED;
  metadata: {
    /** Item name */
    itemName: string;

    /** Optional reference to item file/id */
    itemId?: string;

    /** Quantity added */
    quantity: number;

    /** Source of the item */
    source: 'shop_purchase' | 'project_outcome' | 'manual' | 'loot';

    /** Optional link to related transaction or project event */
    associatedEventId?: string;
  };
}

/**
 * Party item removed event
 * Logged when an item is removed from party inventory
 */
export interface PartyItemRemovedEvent extends BaseActivityEvent {
  type: ActivityEventType.PARTY_ITEM_REMOVED;
  metadata: {
    /** Item name */
    itemName: string;

    /** Optional reference to item file/id */
    itemId?: string;

    /** Quantity removed */
    quantity: number;

    /** Reason for removal */
    reason: 'sold' | 'consumed' | 'lost' | 'manual';

    /** Optional link to related transaction or event */
    associatedEventId?: string;
  };
}

/**
 * Stronghold order given event
 * Logged when an order is assigned to a stronghold or facility
 */
export interface StrongholdOrderGivenEvent extends BaseActivityEvent {
  type: ActivityEventType.STRONGHOLD_ORDER_GIVEN;
  metadata: {
    /** Stronghold name */
    strongholdName: string;

    /** Stronghold identifier */
    strongholdId: string;

    /** Order name */
    orderName: string;

    /** Order identifier */
    orderId: string;

    /** Type of order (facility-specific or stronghold-wide) */
    orderType: 'facility' | 'stronghold';

    /** Facility name if this is a facility order */
    facilityName?: string;

    /** Time required in days */
    timeRequired: number;

    /** Estimated completion day */
    completionDay: number;

    /** Currency cost (currency format: "100 gp") */
    cost: string;
  };
}

/**
 * Stronghold order completed event
 * Logged when an order finishes execution
 */
export interface StrongholdOrderCompletedEvent extends BaseActivityEvent {
  type: ActivityEventType.STRONGHOLD_ORDER_COMPLETED;
  metadata: {
    /** Stronghold name */
    strongholdName: string;

    /** Stronghold identifier */
    strongholdId: string;

    /** Order name */
    orderName: string;

    /** Order identifier */
    orderId: string;

    /** Type of order (facility-specific or stronghold-wide) */
    orderType: 'facility' | 'stronghold';

    /** Facility name if this is a facility order */
    facilityName?: string;

    /** Days spent on this order */
    daysSpent: number;

    /** Results produced by order completion */
    results: Array<{
      /** Type of result */
      type: 'item' | 'gold' | 'defender' | 'buff' | 'event' | 'morale';

      /** Human-readable description */
      description: string;
    }>;
  };
}

/**
 * Custom note event
 * Logged for custom GM notes, milestones, and campaign events
 */
export interface CustomNoteEvent extends BaseActivityEvent {
  type: ActivityEventType.CUSTOM_NOTE;
  metadata: {
    /** Note title/headline */
    title: string;

    /** Note content/body */
    content: string;

    /** Optional tags for categorization */
    tags?: string[];

    /** Optional category for filtering */
    category?: string;
  };
}

/**
 * Discriminated union of all activity event types
 * Use this type for functions that accept any activity event
 * TypeScript will enforce exhaustiveness checking with switch statements
 */
export type ActivityEvent =
  | ShopTransactionEvent
  | ShopCreatedEvent
  | ShopInventoryRestockedEvent
  | ProjectStartedEvent
  | ProjectProgressEvent
  | ProjectCompletedEvent
  | ProjectFailedEvent
  | StrongholdOrderGivenEvent
  | StrongholdOrderCompletedEvent
  | TimeAdvancedEvent
  | PartyFundsAdjustedEvent
  | PartyItemAddedEvent
  | PartyItemRemovedEvent
  | CustomNoteEvent;

/**
 * Query parameters for filtering and searching activity logs
 * All parameters are optional - omit to ignore that filter
 */
export interface ActivityLogQuery {
  /** Campaign to query (required) */
  campaignId: string;

  /** Filter by event types (optional) */
  eventTypes?: ActivityEventType[];

  /** Filter by actor type (optional) */
  actorTypes?: Array<'player' | 'gm' | 'system'>;

  /** Filter by actor names (optional) */
  actorNames?: string[];

  /** Filter by real-world start timestamp in milliseconds (optional) */
  startDate?: number;

  /** Filter by real-world end timestamp in milliseconds (optional) */
  endDate?: number;

  /** Filter by in-game start date (optional) */
  gameStartDate?: string;

  /** Filter by in-game end date (optional) */
  gameEndDate?: string;

  /** Search in event descriptions (optional) */
  searchText?: string;

  /** Maximum number of events to return (optional) */
  limit?: number;

  /** Number of events to skip for pagination (optional) */
  offset?: number;

  /** Sort order by timestamp */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Result container for paginated activity log queries
 * Provides events and pagination metadata
 */
export interface ActivityLogResult {
  /** Events matching the query */
  events: ActivityEvent[];

  /** Total number of matching events (before pagination) */
  total: number;

  /** Whether more events exist beyond this page */
  hasMore: boolean;

  /** Current offset used in query */
  offset: number;

  /** Current limit used in query */
  limit: number;
}
