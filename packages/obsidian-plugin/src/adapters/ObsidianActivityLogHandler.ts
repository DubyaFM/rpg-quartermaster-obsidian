import { App, TFile, TAbstractFile, Notice, Vault, EventRef } from 'obsidian';
import {
  ActivityEvent,
  ActivityEventType,
  ShopTransactionEvent,
  ShopCreatedEvent,
  ShopInventoryRestockedEvent,
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
  ActivityLogQuery,
  ActivityLogResult,
} from '@quartermaster/core/models/ActivityLog';
import { formatCurrency } from '@quartermaster/core/calculators/currency';

export interface CorruptedEntry {
  lineNumber: number;
  rawContent: string;
  error: string;
}

export class ObsidianActivityLogHandler {
  private cache: ActivityEvent[] = [];
  private cacheLoaded: boolean = false;
  private corruptedEntries: CorruptedEntry[] = [];
  private fileWatcherRegistered: boolean = false;
  private fileModifyRef: EventRef | null = null;

  constructor(
    private app: App,
    private logFilePath: string
  ) {}

  /**
   * Initialize hot cache and register file watcher
   * Called once during plugin load
   */
  async initialize(): Promise<void> {
    await this.rebuildCache();
    this.registerFileWatcher();
  }

  /**
   * Unload handler - unregister file watcher
   */
  unload(): void {
    if (this.fileModifyRef) {
      this.app.vault.offref(this.fileModifyRef);
      this.fileModifyRef = null;
      this.fileWatcherRegistered = false;
    }
  }

  /**
   * Log an activity event (prepend to file)
   */
  async logActivity(event: ActivityEvent): Promise<void> {
    const file = await this.ensureLogFile();
    const content = await this.app.vault.read(file);

    const entry = this.generateMarkdownEntry(event);

    // Prepend new entry after the main header (most recent first)
    const headerMatch = content.match(/^# Activity Log\s*\n*/);
    const header = headerMatch ? headerMatch[0] : '# Activity Log\n\n';
    const body = content.replace(/^# Activity Log\s*\n*/, '');

    const newContent = header + entry + '\n' + body;

    await this.app.vault.modify(file, newContent);

    // Update cache
    this.cache.unshift(event);
  }

  /**
   * Update notes on an existing activity event
   */
  async updateActivityNotes(eventId: string, notes: string, timestamp: number): Promise<void> {
    const file = await this.ensureLogFile();
    const content = await this.app.vault.read(file);

    // Find event in cache
    const event = this.cache.find(e => e.id === eventId);
    if (!event) {
      throw new Error(`Event with ID ${eventId} not found`);
    }

    // Update event
    event.notes = notes || undefined;
    event.notesLastUpdated = notes ? timestamp : undefined;

    // Regenerate entire file content
    const headerMatch = content.match(/^# Activity Log\s*\n*/);
    const header = headerMatch ? headerMatch[0] : '# Activity Log\n\n';

    // Rebuild all entries
    const entries = this.cache.map(e => this.generateMarkdownEntry(e)).join('\n');
    const newContent = header + entries;

    await this.app.vault.modify(file, newContent);
  }

  /**
   * Get activity log from cache, applying filters and pagination
   */
  async getActivityLog(query: ActivityLogQuery): Promise<ActivityLogResult> {
    if (!this.cacheLoaded) {
      await this.rebuildCache();
    }
    return this.applyFilters(this.cache, query);
  }

  /**
   * Search activity log from cache, applying filters and pagination
   */
  async searchActivityLog(query: ActivityLogQuery): Promise<ActivityLogResult> {
    if (!this.cacheLoaded) {
      await this.rebuildCache();
    }

    const lowerSearchText = query.searchText ? query.searchText.toLowerCase() : '';
    let filtered = this.cache.filter(event => {
      // Search in description
      if (event.description.toLowerCase().includes(lowerSearchText)) return true;

      // Search in custom note content
      if (event.type === ActivityEventType.CUSTOM_NOTE && (event as CustomNoteEvent).metadata.content.toLowerCase().includes(lowerSearchText)) return true;

      // Add more specific metadata searches if needed for common fields
      return false;
    });

    return this.applyFilters(filtered, query);
  }

  /**
   * Get activity log by date range from cache, applying filters and pagination
   * Note: ActivityLogQuery already supports date range filtering, this method mostly
   * delegates but can be kept for API consistency if needed.
   */
  async getActivityLogByDateRange(query: ActivityLogQuery): Promise<ActivityLogResult> {
    return this.getActivityLog(query);
  }

  /**
   * Get corrupted entries found during parsing
   */
  getCorruptedEntries(): CorruptedEntry[] {
    return this.corruptedEntries;
  }

  /**
   * Rebuild cache from markdown file
   */
  async rebuildCache(): Promise<void> {
    const file = await this.ensureLogFile();
    const content = await this.app.vault.read(file);

    const { events, corrupted } = this.parseMarkdownToEvents(content);

    this.cache = events.sort((a, b) => b.timestamp - a.timestamp); // Ensure sorted descending by timestamp
    this.corruptedEntries = corrupted;
    this.cacheLoaded = true;

    console.log(`[ActivityLog] Cache rebuilt: ${events.length} events, ${corrupted.length} corrupted`);
  }

  // ==================== MARKDOWN GENERATION ====================

  /**
   * Generate markdown entry for an activity event
   */
  private generateMarkdownEntry(event: ActivityEvent): string {
    // Header with date and event type label
    const datePart = event.gameDate ? ` (${event.gameDate})` : '';
    const timestampPart = ` @ ${new Date(event.timestamp).toLocaleString()}`; // ISO string for better parsing
    let entry = `## ${this.formatEventTypeLabel(event.type)}${datePart}${timestampPart}\n`;

    // Metadata comment (for parsing)
    entry += this.generateMetadataComment(event);

    // Event-specific content
    entry += this.generateEventContent(event);

    entry += '\n---\n'; // Separator

    return entry;
  }

  /**
   * Generate HTML comment with metadata
   */
  private generateMetadataComment(event: ActivityEvent): string {
    let comment = '<!-- ';
    comment += `id: ${event.id} `;
    comment += `type: ${event.type} `;
    comment += `campaignId: ${event.campaignId} `;
    comment += `timestamp: ${event.timestamp} `; // Include timestamp for parsing
    if (event.gameDate) comment += `gameDate: ${event.gameDate} `;
    comment += `actorType: ${event.actorType} `;
    if (event.actorName) comment += `actorName: ${event.actorName} `;
    comment += `description: ${event.description.replace(/\s/g, '_')} `; // Replace spaces for simple parsing

    // Stringify metadata safely to embed
    const metadataString = JSON.stringify(event.metadata);
    comment += `metadata: ${btoa(metadataString)} `; // Base64 encode metadata to avoid issues with special chars

    // Include notes and notesLastUpdated if present
    if (event.notes) {
      const notesString = event.notes.replace(/\n/g, '\\n').replace(/--/g, '\\-\\-'); // Escape for HTML comment
      comment += `notes: ${btoa(notesString)} `;
    }
    if (event.notesLastUpdated) {
      comment += `notesLastUpdated: ${event.notesLastUpdated} `;
    }

    comment += '-->\n\n';
    return comment;
  }

  /**
   * Generate event-specific content for human readability
   */
  private generateEventContent(event: ActivityEvent): string {
    let content = `**Actor:** ${event.actorName || event.actorType}\n`;
    content += `**Description:** ${event.description}\n\n`;

    // Add notes if present
    if (event.notes) {
      const notesDate = event.notesLastUpdated
        ? new Date(event.notesLastUpdated).toLocaleString()
        : '';
      content += `> **Notes** ${notesDate ? `(${notesDate})` : ''}\n`;
      content += `> ${event.notes.replace(/\n/g, '\n> ')}\n\n`;
    }

    switch (event.type) {
      case ActivityEventType.SHOP_TRANSACTION:
        return content + this.formatShopTransaction(event as ShopTransactionEvent);
      case ActivityEventType.SHOP_CREATED:
        return content + this.formatShopCreated(event as ShopCreatedEvent);
      case ActivityEventType.SHOP_INVENTORY_RESTOCKED:
        return content + this.formatShopInventoryRestocked(event as ShopInventoryRestockedEvent);
      case ActivityEventType.PROJECT_STARTED:
        return content + this.formatProjectStarted(event as ProjectStartedEvent);
      case ActivityEventType.PROJECT_PROGRESS:
        return content + this.formatProjectProgress(event as ProjectProgressEvent);
      case ActivityEventType.PROJECT_COMPLETED:
        return content + this.formatProjectCompleted(event as ProjectCompletedEvent);
      case ActivityEventType.PROJECT_FAILED:
        return content + this.formatProjectFailed(event as ProjectFailedEvent);
      case ActivityEventType.STRONGHOLD_ORDER_GIVEN:
        return content + this.formatStrongholdOrderGiven(event as StrongholdOrderGivenEvent);
      case ActivityEventType.STRONGHOLD_ORDER_COMPLETED:
        return content + this.formatStrongholdOrderCompleted(event as StrongholdOrderCompletedEvent);
      case ActivityEventType.TIME_ADVANCED:
        return content + this.formatTimeAdvanced(event as TimeAdvancedEvent);
      case ActivityEventType.PARTY_FUNDS_ADJUSTED:
        return content + this.formatPartyGoldAdjusted(event as PartyFundsAdjustedEvent);
      case ActivityEventType.PARTY_ITEM_ADDED:
        return content + this.formatPartyItemAdded(event as PartyItemAddedEvent);
      case ActivityEventType.PARTY_ITEM_REMOVED:
        return content + this.formatPartyItemRemoved(event as PartyItemRemovedEvent);
      case ActivityEventType.CUSTOM_NOTE:
        return content + this.formatCustomNote(event as CustomNoteEvent);
      default:
        const _exhaustive: never = event;
        return content + `*Type: ${_exhaustive}*`; // Fallback for unhandled types
    }
  }

  // --- Specific Event Formatters ---
  private formatShopTransaction(event: ShopTransactionEvent): string {
    const meta = event.metadata;
    let text = `**Transaction Type:** ${meta.transactionType}\n`;
    text += `**Shop:** ${this.wikilink(meta.shopName)}${meta.shopId ? ` (\`${meta.shopId}\`)\n` : '\n'}`;
    text += `**Total Cost:** ${meta.totalCost}\n`;
    if (meta.playerName) text += `**Player:** ${meta.playerName}\n`;
    text += '\n**Items:**\n';
    meta.items.forEach(item => {
      text += `- ${item.quantity}x ${item.itemName} (${item.unitCost} each, Total: ${item.totalCost})\n`;
    });
    return text;
  }

  private formatShopCreated(event: ShopCreatedEvent): string {
    const meta = event.metadata;
    let text = `**Shop Type:** ${meta.shopType}\n`;
    text += `**Wealth Level:** ${meta.wealthLevel}\n`;
    if (meta.location) text += `**Location:** ${this.wikilink(meta.location)}\n`;
    if (meta.npcShopkeep) {
      text += `**Shopkeeper:** ${meta.npcShopkeep.name} (${meta.npcShopkeep.species}, ${meta.npcShopkeep.disposition})\n`;
    }
    return text;
  }

  private formatShopInventoryRestocked(event: ShopInventoryRestockedEvent): string {
    const meta = event.metadata;
    let text = `**Shop:** ${this.wikilink(meta.shopName)}${meta.shopId ? ` (\`${meta.shopId}\`)\n` : '\n'}`;
    text += `**Items Added:** ${meta.itemsAdded}\n`;
    text += `**Restock Type:** ${meta.restockType}\n`;
    return text;
  }

  private formatProjectStarted(event: ProjectStartedEvent): string {
    const meta = event.metadata;
    let text = `**Project Name:** ${meta.projectName} (\`${meta.projectId}\`)\n`;
    text += `**Template:** ${meta.templateName}\n`;
    text += `**Assigned Players:** ${meta.assignedPlayers.join(', ')}\n`;
    text += `**Estimated Duration:** ${meta.estimatedDuration}\n`;
    if (meta.cost) text += `**Cost:** ${meta.cost}\n`;
    return text;
  }

  private formatProjectProgress(event: ProjectProgressEvent): string {
    const meta = event.metadata;
    let text = `**Project Name:** ${meta.projectName} (\`${meta.projectId}\`)\n`;
    text += `**Days Worked:** ${meta.daysWorked} (Successful: ${meta.successfulDays}, Failed: ${meta.failedDays})\n`;
    if (meta.remainingDays !== undefined) text += `**Remaining Days:** ${meta.remainingDays}\n`;
    if (meta.progressPercentage !== undefined) text += `**Progress:** ${meta.progressPercentage.toFixed(0)}%\n`;
    return text;
  }

  private formatProjectCompleted(event: ProjectCompletedEvent): string {
    const meta = event.metadata;
    let text = `**Project Name:** ${meta.projectName} (\`${meta.projectId}\`)\n`;
    text += `**Total Days Spent:** ${meta.totalDaysSpent}\n`;
    text += `**Outcome Type:** ${meta.outcome.type}\n`;
    if (meta.outcome.itemName) text += `**Item Outcome:** ${meta.outcome.itemName}\n`;
    if (meta.outcome.currencyAmount) text += `**Funds Outcome:** ${meta.outcome.currencyAmount}\n`;
    if (meta.outcome.notes) text += `**Notes:** ${meta.outcome.notes}\n`;
    return text;
  }

  private formatProjectFailed(event: ProjectFailedEvent): string {
    const meta = event.metadata;
    let text = `**Project Name:** ${meta.projectName} (\`${meta.projectId}\`)\n`;
    text += `**Days Spent:** ${meta.daysSpent}\n`;
    text += `**Reason:** ${meta.failureReason}\n`;
    return text;
  }

  private formatStrongholdOrderGiven(event: StrongholdOrderGivenEvent): string {
    const meta = event.metadata;
    let text = `**Stronghold:** ${this.wikilink(meta.strongholdName)} (\`${meta.strongholdId}\`)\n`;
    text += `**Order:** ${meta.orderName} (\`${meta.orderId}\`)\n`;
    text += `**Type:** ${meta.orderType}\n`;
    if (meta.facilityName) text += `**Facility:** ${meta.facilityName}\n`;
    text += `**Time Required:** ${meta.timeRequired} days\n`;
    text += `**Completion Day:** ${meta.completionDay}\n`;
    text += `**Funds Cost:** ${meta.cost}\n`;
    return text;
  }

  private formatStrongholdOrderCompleted(event: StrongholdOrderCompletedEvent): string {
    const meta = event.metadata;
    let text = `**Stronghold:** ${this.wikilink(meta.strongholdName)} (\`${meta.strongholdId}\`)\n`;
    text += `**Order:** ${meta.orderName} (\`${meta.orderId}\`)\n`;
    text += `**Type:** ${meta.orderType}\n`;
    if (meta.facilityName) text += `**Facility:** ${meta.facilityName}\n`;
    text += `**Days Spent:** ${meta.daysSpent}\n`;
    text += '\n**Results:**\n';
    meta.results.forEach(result => {
      text += `- ${result.type}: ${result.description}\n`;
    });
    return text;
  }

  private formatTimeAdvanced(event: TimeAdvancedEvent): string {
    const meta = event.metadata;
    let text = `**Days Advanced:** ${meta.daysAdvanced}\n`;
    text += `**From Date:** ${meta.fromDate}\n`;
    text += `**To Date:** ${meta.toDate}\n`;
    text += `**Affected Systems:** ${meta.affectedSystems.join(', ')}\n`;
    return text;
  }

  private formatPartyGoldAdjusted(event: PartyFundsAdjustedEvent): string {
    const meta = event.metadata;
    let text = `**Adjustment Type:** ${meta.adjustmentType}\n`;
    text += `**Amount:** ${meta.amount}\n`;
    text += `**Previous Balance:** ${meta.previousBalance}\n`;
    text += `**New Balance:** ${meta.newBalance}\n`;
    text += `**Reason:** ${meta.reason}\n`;
    return text;
  }

  private formatPartyItemAdded(event: PartyItemAddedEvent): string {
    const meta = event.metadata;
    let text = `**Item:** ${meta.itemName}${meta.itemId ? ` (\`${meta.itemId}\`)\n` : '\n'}`;
    text += `**Quantity:** ${meta.quantity}\n`;
    text += `**Source:** ${meta.source}\n`;
    if (meta.associatedEventId) text += `**Associated Event:** \`${meta.associatedEventId}\`\n`;
    return text;
  }

  private formatPartyItemRemoved(event: PartyItemRemovedEvent): string {
    const meta = event.metadata;
    let text = `**Item:** ${meta.itemName}${meta.itemId ? ` (\`${meta.itemId}\`)\n` : '\n'}`;
    text += `**Quantity:** ${meta.quantity}\n`;
    text += `**Reason:** ${meta.reason}\n`;
    if (meta.associatedEventId) text += `**Associated Event:** \`${meta.associatedEventId}\`\n`;
    return text;
  }

  private formatCustomNote(event: CustomNoteEvent): string {
    const meta = event.metadata;
    let text = `**Title:** ${meta.title}\n`;
    text += `**Content:**\n${meta.content}\n`;
    if (meta.tags && meta.tags.length > 0) text += `**Tags:** ${meta.tags.join(', ')}\n`;
    if (meta.category) text += `**Category:** ${meta.category}\n`;
    return text;
  }

  // ==================== MARKDOWN PARSING ====================

  /**
   * Validate actor type enum
   */
  private isValidActorType(value: string): value is 'player' | 'gm' | 'system' {
    return value === 'player' || value === 'gm' || value === 'system';
  }

  /**
   * Validate event type enum
   */
  private isValidEventType(value: string): value is ActivityEventType {
    return Object.values(ActivityEventType).includes(value as ActivityEventType);
  }

  /**
   * Parse markdown content into structured events
   * Returns events and corrupted entries
   */
  private parseMarkdownToEvents(markdown: string): {
    events: ActivityEvent[];
    corrupted: CorruptedEntry[];
  } {
    const events: ActivityEvent[] = [];
    const corrupted: CorruptedEntry[] = [];
    let currentLineNumber = 0;

    const sections = markdown.split('\n---\n'); // Split by the separator

    for (const section of sections) {
      if (!section.trim()) continue; // Skip empty sections

      try {
        const event = this.parseSectionToEvent(section, currentLineNumber);
        if (event) {
          events.push(event);
        }
      } catch (error) {
        corrupted.push({
          lineNumber: currentLineNumber,
          rawContent: section.substring(0, 200), // First 200 chars
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      currentLineNumber += section.split('\n').length;
    }

    return { events, corrupted };
  }

  private parseSectionToEvent(section: string, startLine: number): ActivityEvent | null {
    // Extract metadata from HTML comment
    const metaMatch = section.match(/<!-- (.*?) -->/s);
    if (!metaMatch) {
        throw new Error('Missing metadata HTML comment');
    }

    const metadataStr = metaMatch[1];
    const parsedMetadata: any = {};

    // Parse key-value pairs from comment
    // Handles base64 encoded 'metadata' field separately
    const kvPairs = metadataStr.match(/(\w+):\s*([^\s]+?)(?=\s+\w+:|$)/g);
    if (kvPairs) {
        for (const pair of kvPairs) {
            const [key, value] = pair.split(/:\s*/);
            if (key === 'metadata') {
                try {
                    parsedMetadata[key] = JSON.parse(atob(value));
                } catch (e) {
                    throw new Error(`Failed to decode/parse metadata JSON: ${e}`);
                }
            } else if (key === 'notes') {
                try {
                    parsedMetadata[key] = atob(value); // Base64 decode notes
                } catch (e) {
                    console.warn('[ActivityLog] Failed to decode notes, skipping');
                }
            } else if (key === 'notesLastUpdated') {
                parsedMetadata[key] = parseInt(value);
            } else {
                parsedMetadata[key] = value.replace(/_/g, ' '); // Decode description spaces
            }
        }
    }

    if (!parsedMetadata.id || !parsedMetadata.type || !parsedMetadata.campaignId || !parsedMetadata.timestamp) {
        throw new Error('Missing required metadata (id, type, campaignId, or timestamp)');
    }

    // Validate actorType enum
    if (!this.isValidActorType(parsedMetadata.actorType)) {
        console.warn(`[ActivityLog] Invalid actorType "${parsedMetadata.actorType}" in metadata, defaulting to "system"`);
    }

    // Validate event type enum
    if (!this.isValidEventType(parsedMetadata.type)) {
        console.warn(`[ActivityLog] Invalid event type "${parsedMetadata.type}" in metadata, defaulting to CUSTOM_NOTE`);
    }

    const event: ActivityEvent = {
        id: parsedMetadata.id,
        campaignId: parsedMetadata.campaignId,
        timestamp: parseInt(parsedMetadata.timestamp), // Ensure timestamp is a number
        gameDate: parsedMetadata.gameDate,
        type: this.isValidEventType(parsedMetadata.type)
          ? (parsedMetadata.type as ActivityEventType)
          : ActivityEventType.CUSTOM_NOTE,  // Default to custom note if invalid
        actorType: this.isValidActorType(parsedMetadata.actorType)
          ? parsedMetadata.actorType
          : 'system',  // Default to system if invalid
        actorName: parsedMetadata.actorName,
        description: parsedMetadata.description,
        metadata: parsedMetadata.metadata, // This is the deserialized metadata object
        notes: parsedMetadata.notes,
        notesLastUpdated: parsedMetadata.notesLastUpdated,
    };

    return event;
  }

  // ==================== FILE OPERATIONS ====================

  /**
   * Ensure log file exists, creating it if necessary
   */
  private async ensureLogFile(): Promise<TFile> {
    let file = this.app.vault.getAbstractFileByPath(this.logFilePath);

    if (file instanceof TFile) {
      return file;
    }

    // Only create if file doesn't exist
    if (!file) {
      const initialContent = '# Activity Log\n\n';
      const dirMatch = this.logFilePath.match(/(.*)\//);
      if (dirMatch && dirMatch[1]) {
        const parentFolder = this.app.vault.getAbstractFileByPath(dirMatch[1]);
        if (!parentFolder) {
          await this.app.vault.createFolder(dirMatch[1]).catch((error: Error) => {
            if (!error.message.includes('already exists')) {
              throw error;
            }
          });
        }
      }

      file = await this.app.vault.create(this.logFilePath, initialContent).catch(async (error: Error) => {
        if (error.message.includes('already exists')) {
          // File was created by another process, retrieve it
          const existingFile = this.app.vault.getAbstractFileByPath(this.logFilePath);
          if (existingFile instanceof TFile) {
            return existingFile;
          }
        }
        throw error;
      });
    }

    return file as TFile;
  }

  /**
   * Register file watcher to invalidate cache on external modifications
   */
  private registerFileWatcher(): void {
    if (this.fileWatcherRegistered) return;

    this.fileModifyRef = this.app.vault.on('modify', async (file: TAbstractFile) => {
      if (file instanceof TFile && file.path === this.logFilePath) {
        console.log('[ActivityLog] External modification detected, rebuilding cache...');
        await this.rebuildCache();
      }
    });

    this.fileWatcherRegistered = true;
  }

  // ==================== FILTERING & SORTING ====================

  /**
   * Apply query filters to events
   */
  private applyFilters(events: ActivityEvent[], query: ActivityLogQuery): ActivityLogResult {
    let filtered = [...events];

    // Campaign filter (already handled by default in getCampaignId, but good for explicit query)
    if (query.campaignId) {
      filtered = filtered.filter(e => e.campaignId === query.campaignId);
    }

    // Event types filter
    if (query.eventTypes && query.eventTypes.length > 0) {
      filtered = filtered.filter(e => query.eventTypes!.includes(e.type));
    }

    // Actor types filter
    if (query.actorTypes && query.actorTypes.length > 0) {
      filtered = filtered.filter(e => query.actorTypes!.includes(e.actorType));
    }

    // Actor names filter
    if (query.actorNames && query.actorNames.length > 0) {
      filtered = filtered.filter(e => e.actorName && query.actorNames!.some(name => e.actorName!.includes(name)));
    }

    // Real-world timestamp range filter
    if (query.startDate !== undefined) {
      filtered = filtered.filter(e => e.timestamp >= query.startDate!);
    }
    if (query.endDate !== undefined) {
      filtered = filtered.filter(e => e.timestamp <= query.endDate!);
    }

    // In-game date range filter (assuming gameDate is comparable string or we need a date parser)
    // For now, simple string comparison
    if (query.gameStartDate) {
      filtered = filtered.filter(e => e.gameDate && e.gameDate >= query.gameStartDate!);
    }
    if (query.gameEndDate) {
      filtered = filtered.filter(e => e.gameDate && e.gameDate <= query.gameEndDate!);
    }

    // Search text in description (already handled by searchActivityLog, but re-applying in case this is called directly)
    if (query.searchText) {
      const lowerSearchText = query.searchText.toLowerCase();
      filtered = filtered.filter(e =>
        e.description.toLowerCase().includes(lowerSearchText) ||
        (e.type === ActivityEventType.CUSTOM_NOTE && (e as CustomNoteEvent).metadata.content.toLowerCase().includes(lowerSearchText))
      );
    }

    // Sorting
    const sortOrder = query.sortOrder || 'desc'; // Default to descending for most recent first

    filtered.sort((a, b) => {
      // Default sort is by timestamp
      let comparison = a.timestamp - b.timestamp;

      // Apply sort order
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // Pagination
    const offset = query.offset || 0;
    const limit = query.limit || filtered.length; // If no limit, take all matching
    const paginated = filtered.slice(offset, offset + limit);

    return {
      events: paginated,
      total: filtered.length,
      hasMore: offset + limit < filtered.length,
      offset: offset,
      limit: limit,
    };
  }

  // ==================== HELPERS ====================

  private formatEventTypeLabel(type: ActivityEventType): string {
    const labels: Record<ActivityEventType, string> = {
      [ActivityEventType.SHOP_TRANSACTION]: 'Shop Transaction',
      [ActivityEventType.SHOP_CREATED]: 'Shop Created',
      [ActivityEventType.SHOP_INVENTORY_RESTOCKED]: 'Shop Restocked',
      [ActivityEventType.PROJECT_STARTED]: 'Project Started',
      [ActivityEventType.PROJECT_PROGRESS]: 'Project Progress',
      [ActivityEventType.PROJECT_COMPLETED]: 'Project Completed',
      [ActivityEventType.PROJECT_FAILED]: 'Project Failed',
      [ActivityEventType.STRONGHOLD_ORDER_GIVEN]: 'Stronghold Order Given',
      [ActivityEventType.STRONGHOLD_ORDER_COMPLETED]: 'Stronghold Order Completed',
      [ActivityEventType.TIME_ADVANCED]: 'Time Advanced',
      [ActivityEventType.PARTY_FUNDS_ADJUSTED]: 'Party Funds Adjusted',
      [ActivityEventType.PARTY_ITEM_ADDED]: 'Party Item Added',
      [ActivityEventType.PARTY_ITEM_REMOVED]: 'Party Item Removed',
      [ActivityEventType.CUSTOM_NOTE]: 'Custom Note',
    };
    return labels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  private wikilink(name: string): string {
    return `[[${name}]]`;
  }
}
