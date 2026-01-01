import type { IDataAdapter } from '../interfaces/IDataAdapter';
import type { ICampaignContext } from '../interfaces/ICampaignContext';
import type {
  ActivityEvent,
  ActivityEventType,
  ActivityLogQuery,
  ActivityLogResult,
  ShopTransactionEvent,
  ShopCreatedEvent,
  ProjectStartedEvent,
  ProjectProgressEvent,
  ProjectCompletedEvent,
  ProjectFailedEvent,
  StrongholdOrderGivenEvent,
  StrongholdOrderCompletedEvent,
  TimeAdvancedEvent,
  PartyFundsAdjustedEvent,
  PartyItemAddedEvent,
  PartyItemRemovedEvent,
  CustomNoteEvent,
} from '../models/ActivityLog';
import { ActivityEventType as EventType } from '../models/ActivityLog';

/**
 * Service for managing activity log operations
 * Provides high-level methods for logging common game events
 *
 * **Phase 1 Update**: Now uses ICampaignContext to get current campaign ID
 * instead of hardcoded DEFAULT_CAMPAIGN constant.
 */
export class ActivityLogService {
  constructor(
    private adapter: IDataAdapter,
    private campaignContext: ICampaignContext
  ) {}

  /**
   * Generate a unique ID for an activity event
   */
  private generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * Get current timestamp in milliseconds
   */
  private getTimestamp(): number {
    return Date.now();
  }

  /**
   * Get current campaign ID from context
   * All activity logs are tagged with the active campaign
   */
  private getCampaignId(): string {
    return this.campaignContext.getCampaignId();
  }

  /**
   * Log a shop transaction (purchase or sale)
   */
  async logShopTransaction(params: {
    transactionType: 'purchase' | 'sale';
    shopName: string;
    shopId?: string;
    items: Array<{
      itemName: string;
      itemId?: string;
      quantity: number;
      unitCost: string;
      totalCost: string;
    }>;
    totalCost: string;
    playerName?: string;
    actorName?: string;
    gameDate?: string;
  }): Promise<void> {
    const event: ShopTransactionEvent = {
      id: this.generateId(),
      campaignId: this.getCampaignId(),
      timestamp: this.getTimestamp(),
      gameDate: params.gameDate,
      type: EventType.SHOP_TRANSACTION,
      actorType: params.actorName ? 'player' : 'gm',
      actorName: params.actorName || 'Game Master',
      description: this.formatShopTransactionDescription(params),
      metadata: {
        transactionType: params.transactionType,
        shopName: params.shopName,
        shopId: params.shopId,
        items: params.items,
        totalCost: params.totalCost,
        playerName: params.playerName,
      },
    };

    await this.adapter.logActivity?.(event);
  }

  private formatShopTransactionDescription(params: {
    transactionType: 'purchase' | 'sale';
    shopName: string;
    items: Array<{ itemName: string; quantity: number }>;
    totalCost: string;
    playerName?: string;
  }): string {
    const action = params.transactionType === 'purchase' ? 'purchased' : 'sold';
    const itemCount = params.items.reduce((sum, item) => sum + item.quantity, 0);
    const itemText = itemCount === 1 ? 'item' : 'items';
    const playerText = params.playerName ? ` (${params.playerName})` : '';

    return `${action} ${itemCount} ${itemText} at ${params.shopName} for ${params.totalCost}${playerText}`;
  }

  /**
   * Log shop creation
   */
  async logShopCreated(params: {
    shopName: string;
    shopId?: string;
    shopType: string;
    wealthLevel: string;
    location?: string;
    npcShopkeep?: {
      name: string;
      species: string;
      disposition: string;
    };
    actorName?: string;
    gameDate?: string;
  }): Promise<void> {
    const event: ShopCreatedEvent = {
      id: this.generateId(),
      campaignId: this.getCampaignId(),
      timestamp: this.getTimestamp(),
      gameDate: params.gameDate,
      type: EventType.SHOP_CREATED,
      actorType: 'gm',
      actorName: params.actorName || 'Game Master',
      description: `Created ${params.wealthLevel.toLowerCase()} ${params.shopType} "${params.shopName}"${params.location ? ` in ${params.location}` : ''}`,
      metadata: {
        shopName: params.shopName,
        shopId: params.shopId,
        shopType: params.shopType,
        wealthLevel: params.wealthLevel,
        location: params.location,
        npcShopkeep: params.npcShopkeep,
      },
    };

    await this.adapter.logActivity?.(event);
  }

  /**
   * Log project start
   */
  async logProjectStarted(params: {
    projectName: string;
    projectId: string;
    templateName: string;
    assignedPlayers: string[];
    estimatedDuration: string;
    cost?: string;
    actorName?: string;
    gameDate?: string;
  }): Promise<void> {
    const event: ProjectStartedEvent = {
      id: this.generateId(),
      campaignId: this.getCampaignId(),
      timestamp: this.getTimestamp(),
      gameDate: params.gameDate,
      type: EventType.PROJECT_STARTED,
      actorType: 'gm',
      actorName: params.actorName || 'Game Master',
      description: `Started project "${params.projectName}" (${params.assignedPlayers.join(', ')})`,
      metadata: {
        projectName: params.projectName,
        projectId: params.projectId,
        templateName: params.templateName,
        assignedPlayers: params.assignedPlayers,
        estimatedDuration: params.estimatedDuration,
        cost: params.cost,
      },
    };

    await this.adapter.logActivity?.(event);
  }

  /**
   * Log project progress
   */
  async logProjectProgress(params: {
    projectName: string;
    projectId: string;
    daysWorked: number;
    successfulDays: number;
    failedDays: number;
    remainingDays?: number;
    progressPercentage?: number;
    gameDate?: string;
  }): Promise<void> {
    const event: ProjectProgressEvent = {
      id: this.generateId(),
      campaignId: this.getCampaignId(),
      timestamp: this.getTimestamp(),
      gameDate: params.gameDate,
      type: EventType.PROJECT_PROGRESS,
      actorType: 'system',
      description: `Project "${params.projectName}" progress: ${params.daysWorked} days worked (${params.successfulDays} successful, ${params.failedDays} failed)`,
      metadata: {
        projectName: params.projectName,
        projectId: params.projectId,
        daysWorked: params.daysWorked,
        successfulDays: params.successfulDays,
        failedDays: params.failedDays,
        remainingDays: params.remainingDays,
        progressPercentage: params.progressPercentage,
      },
    };

    await this.adapter.logActivity?.(event);
  }

  /**
   * Log project completion
   */
  async logProjectCompleted(params: {
    projectName: string;
    projectId: string;
    totalDaysSpent: number;
    outcome: {
      type: 'item' | 'currency' | 'information' | 'custom';
      itemName?: string;
      currencyAmount?: string;
      notes?: string;
    };
    gameDate?: string;
  }): Promise<void> {
    const event: ProjectCompletedEvent = {
      id: this.generateId(),
      campaignId: this.getCampaignId(),
      timestamp: this.getTimestamp(),
      gameDate: params.gameDate,
      type: EventType.PROJECT_COMPLETED,
      actorType: 'system',
      description: `Completed project "${params.projectName}" in ${params.totalDaysSpent} days`,
      metadata: {
        projectName: params.projectName,
        projectId: params.projectId,
        totalDaysSpent: params.totalDaysSpent,
        outcome: params.outcome,
      },
    };

    await this.adapter.logActivity?.(event);
  }

  /**
   * Log project failure
   */
  async logProjectFailed(params: {
    projectName: string;
    projectId: string;
    daysSpent: number;
    failureReason: string;
    gameDate?: string;
  }): Promise<void> {
    const event: ProjectFailedEvent = {
      id: this.generateId(),
      campaignId: this.getCampaignId(),
      timestamp: this.getTimestamp(),
      gameDate: params.gameDate,
      type: EventType.PROJECT_FAILED,
      actorType: 'system',
      description: `Project "${params.projectName}" failed after ${params.daysSpent} days: ${params.failureReason}`,
      metadata: {
        projectName: params.projectName,
        projectId: params.projectId,
        daysSpent: params.daysSpent,
        failureReason: params.failureReason,
      },
    };

    await this.adapter.logActivity?.(event);
  }

  /**
   * Log stronghold order given
   */
  async logStrongholdOrderGiven(params: {
    strongholdName: string;
    strongholdId: string;
    orderName: string;
    orderId: string;
    orderType: 'facility' | 'stronghold';
    facilityName?: string;
    timeRequired: number;
    completionDay: number;
    cost: string;
    actorName?: string;
    gameDate?: string;
  }): Promise<void> {
    const facilityText = params.facilityName ? ` at ${params.facilityName}` : '';
    const event: StrongholdOrderGivenEvent = {
      id: this.generateId(),
      campaignId: this.getCampaignId(),
      timestamp: this.getTimestamp(),
      gameDate: params.gameDate,
      type: EventType.STRONGHOLD_ORDER_GIVEN,
      actorType: 'gm',
      actorName: params.actorName || 'Game Master',
      description: `Assigned order "${params.orderName}" to ${params.strongholdName}${facilityText} (${params.timeRequired} days, ${params.cost})`,
      metadata: {
        strongholdName: params.strongholdName,
        strongholdId: params.strongholdId,
        orderName: params.orderName,
        orderId: params.orderId,
        orderType: params.orderType,
        facilityName: params.facilityName,
        timeRequired: params.timeRequired,
        completionDay: params.completionDay,
        cost: params.cost,
      },
    };

    await this.adapter.logActivity?.(event);
  }

  /**
   * Log stronghold order completion
   */
  async logStrongholdOrderCompleted(params: {
    strongholdName: string;
    strongholdId: string;
    orderName: string;
    orderId: string;
    orderType: 'facility' | 'stronghold';
    facilityName?: string;
    daysSpent: number;
    results: Array<{
      type: 'item' | 'gold' | 'defender' | 'buff' | 'event' | 'morale';
      description: string;
    }>;
    gameDate?: string;
  }): Promise<void> {
    const facilityText = params.facilityName ? ` at ${params.facilityName}` : '';
    const event: StrongholdOrderCompletedEvent = {
      id: this.generateId(),
      campaignId: this.getCampaignId(),
      timestamp: this.getTimestamp(),
      gameDate: params.gameDate,
      type: EventType.STRONGHOLD_ORDER_COMPLETED,
      actorType: 'system',
      description: `Completed order "${params.orderName}" at ${params.strongholdName}${facilityText} (${params.daysSpent} days)`,
      metadata: {
        strongholdName: params.strongholdName,
        strongholdId: params.strongholdId,
        orderName: params.orderName,
        orderId: params.orderId,
        orderType: params.orderType,
        facilityName: params.facilityName,
        daysSpent: params.daysSpent,
        results: params.results,
      },
    };

    await this.adapter.logActivity?.(event);
  }

  /**
   * Log time advancement
   */
  async logTimeAdvanced(params: {
    daysAdvanced: number;
    fromDate: string;
    toDate: string;
    affectedSystems: string[];
    gameDate?: string;
  }): Promise<void> {
    const event: TimeAdvancedEvent = {
      id: this.generateId(),
      campaignId: this.getCampaignId(),
      timestamp: this.getTimestamp(),
      gameDate: params.gameDate || params.toDate,
      type: EventType.TIME_ADVANCED,
      actorType: 'gm',
      actorName: 'Game Master',
      description: `Advanced time by ${params.daysAdvanced} day${params.daysAdvanced !== 1 ? 's' : ''} (${params.fromDate} → ${params.toDate})`,
      metadata: {
        daysAdvanced: params.daysAdvanced,
        fromDate: params.fromDate,
        toDate: params.toDate,
        affectedSystems: params.affectedSystems,
      },
    };

    await this.adapter.logActivity?.(event);
  }

  /**
   * Log party funds adjustment
   */
  async logPartyFundsAdjusted(params: {
    adjustmentType: 'add' | 'subtract' | 'set';
    amount: string;
    previousBalance: string;
    newBalance: string;
    reason: string;
    actorName?: string;
    gameDate?: string;
  }): Promise<void> {
    const event: PartyFundsAdjustedEvent = {
      id: this.generateId(),
      campaignId: this.getCampaignId(),
      timestamp: this.getTimestamp(),
      gameDate: params.gameDate,
      type: EventType.PARTY_FUNDS_ADJUSTED,
      actorType: 'gm',
      actorName: params.actorName || 'Game Master',
      description: `${params.adjustmentType === 'add' ? 'Added' : params.adjustmentType === 'subtract' ? 'Subtracted' : 'Set'} ${params.amount}: ${params.reason}`,
      metadata: {
        adjustmentType: params.adjustmentType,
        amount: params.amount,
        previousBalance: params.previousBalance,
        newBalance: params.newBalance,
        reason: params.reason,
      },
    };

    await this.adapter.logActivity?.(event);
  }

  /**
   * Log party item added
   */
  async logPartyItemAdded(params: {
    itemName: string;
    itemId?: string;
    quantity: number;
    source: 'shop_purchase' | 'project_outcome' | 'manual' | 'loot';
    associatedEventId?: string;
    actorName?: string;
    gameDate?: string;
  }): Promise<void> {
    const event: PartyItemAddedEvent = {
      id: this.generateId(),
      campaignId: this.getCampaignId(),
      timestamp: this.getTimestamp(),
      gameDate: params.gameDate,
      type: EventType.PARTY_ITEM_ADDED,
      actorType: params.source === 'manual' ? 'gm' : 'system',
      actorName: params.actorName,
      description: `Added ${params.quantity}x ${params.itemName} to party inventory (${params.source})`,
      metadata: {
        itemName: params.itemName,
        itemId: params.itemId,
        quantity: params.quantity,
        source: params.source,
        associatedEventId: params.associatedEventId,
      },
    };

    await this.adapter.logActivity?.(event);
  }

  /**
   * Log party item removed
   */
  async logPartyItemRemoved(params: {
    itemName: string;
    itemId?: string;
    quantity: number;
    reason: 'sold' | 'consumed' | 'lost' | 'manual';
    associatedEventId?: string;
    actorName?: string;
    gameDate?: string;
  }): Promise<void> {
    const event: PartyItemRemovedEvent = {
      id: this.generateId(),
      campaignId: this.getCampaignId(),
      timestamp: this.getTimestamp(),
      gameDate: params.gameDate,
      type: EventType.PARTY_ITEM_REMOVED,
      actorType: params.reason === 'manual' ? 'gm' : 'system',
      actorName: params.actorName,
      description: `Removed ${params.quantity}x ${params.itemName} from party inventory (${params.reason})`,
      metadata: {
        itemName: params.itemName,
        itemId: params.itemId,
        quantity: params.quantity,
        reason: params.reason,
        associatedEventId: params.associatedEventId,
      },
    };

    await this.adapter.logActivity?.(event);
  }

  /**
   * Log custom note
   */
  async logCustomNote(params: {
    title: string;
    content: string;
    tags?: string[];
    category?: string;
    actorName?: string;
    gameDate?: string;
  }): Promise<void> {
    const event: CustomNoteEvent = {
      id: this.generateId(),
      campaignId: this.getCampaignId(),
      timestamp: this.getTimestamp(),
      gameDate: params.gameDate,
      type: EventType.CUSTOM_NOTE,
      actorType: 'gm',
      actorName: params.actorName || 'Game Master',
      description: params.title,
      metadata: {
        title: params.title,
        content: params.content,
        tags: params.tags,
        category: params.category,
      },
    };

    await this.adapter.logActivity?.(event);
  }

  /**
   * Update notes on an existing activity event
   */
  async updateEventNotes(params: {
    eventId: string;
    notes: string;
    actorName?: string;
  }): Promise<void> {
    if (!this.adapter.updateActivityNotes) {
      console.warn('[ActivityLogService] updateActivityNotes not supported by adapter');
      return;
    }

    await this.adapter.updateActivityNotes(params.eventId, params.notes, this.getTimestamp());
  }

  /**
   * Query activity log with filters
   */
  async getActivityLog(query: ActivityLogQuery): Promise<ActivityLogResult> {
    if (!this.adapter.getActivityLog) {
      return {
        events: [],
        total: 0,
        hasMore: false,
        offset: 0,
        limit: query.limit || 50,
      };
    }

    return this.adapter.getActivityLog(query);
  }

  /**
   * Search activity log by text
   */
  async searchActivityLog(
    searchText: string,
    limit = 50,
    offset = 0
  ): Promise<ActivityLogResult> {
    if (!this.adapter.searchActivityLog) {
      return {
        events: [],
        total: 0,
        hasMore: false,
        offset: 0,
        limit,
      };
    }

    return this.adapter.searchActivityLog(
      this.getCampaignId(),
      searchText,
      limit,
      offset
    );
  }

  /**
   * Get activity log by date range
   */
  async getActivityLogByDateRange(
    startDate: number,
    endDate: number,
    limit = 100,
    offset = 0
  ): Promise<ActivityLogResult> {
    if (!this.adapter.getActivityLogByDateRange) {
      return {
        events: [],
        total: 0,
        hasMore: false,
        offset: 0,
        limit,
      };
    }

    return this.adapter.getActivityLogByDateRange(
      this.getCampaignId(),
      startDate,
      endDate,
      limit,
      offset
    );
  }
}
