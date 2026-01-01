import {
  ActivityEvent,
  ActivityEventType,
  ActivityLogQuery,
  ActivityLogResult,
} from '@quartermaster/core/models/ActivityLog';

/**
 * View state for the activity log tab
 * Contains all data and UI state needed to render the activity log interface
 */
export interface ActivityLogViewState {
  /** List of activity events to display */
  events: ActivityEvent[];

  /** Whether data is currently being loaded */
  loading: boolean;

  /** Error message if operation failed, null otherwise */
  error: string | null;

  /** Current filter query */
  filters: ActivityLogQuery;

  /** Current search query text */
  searchQuery: string;

  /** Whether more events exist beyond current results */
  hasMore: boolean;

  /** Number of corrupted/unreadable entries found */
  corruptedCount: number;
}

/**
 * Data source interface (adapter pattern)
 * Abstracts the underlying data persistence layer (files, database, etc.)
 * Implementations can be swapped for testing or different storage backends
 */
export interface IActivityLogDataSource {
  /**
   * Fetch activity log events with filtering and pagination
   * @param query Filter and pagination parameters
   * @returns Paginated result with events and metadata
   */
  getActivityLog(query: ActivityLogQuery): Promise<ActivityLogResult>;

  /**
   * Search activity log events by text
   * @param query Query with searchText field and pagination parameters
   * @returns Paginated result with matching events
   */
  searchActivityLog(query: ActivityLogQuery): Promise<ActivityLogResult>;

  /**
   * Get count of corrupted entries that couldn't be parsed
   * @returns Number of corrupted entries
   */
  getCorruptedEntryCount(): number;
}

/**
 * ViewModel for Activity Log tab
 *
 * Separates presentation logic from platform-specific dependencies (Obsidian API).
 * This design makes the ViewModel testable without mocking Obsidian.
 *
 * Key responsibilities:
 * - Manage filter and search state
 * - Coordinate data loading with loading state
 * - Handle pagination
 * - Notify UI layer of state changes via listener pattern
 *
 * Usage:
 * ```typescript
 * const viewModel = new ActivityLogTabViewModel(dataSource);
 * viewModel.subscribe((state) => {
 *   // Update UI with new state
 *   renderActivityLog(state);
 * });
 * await viewModel.loadEvents();
 * ```
 */
export class ActivityLogTabViewModel {
  private state: ActivityLogViewState = {
    events: [],
    loading: false,
    error: null,
    filters: {
      campaignId: 'campaign_default',
      sortOrder: 'desc',
      limit: 50,
      offset: 0,
    },
    searchQuery: '',
    hasMore: true,
    corruptedCount: 0,
  };

  private listeners: Array<(state: ActivityLogViewState) => void> = [];

  /**
   * Create a new activity log view model
   * @param dataSource Platform-specific data adapter
   */
  constructor(private dataSource: IActivityLogDataSource) {}

  /**
   * Subscribe to state changes
   * Listener will be called whenever state updates
   *
   * @param listener Callback function that receives new state
   * @returns Unsubscribe function to remove listener
   */
  subscribe(listener: (state: ActivityLogViewState) => void): () => void {
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Get current view state (snapshot)
   * Safe to use for UI rendering
   *
   * @returns Copy of current state
   */
  getState(): ActivityLogViewState {
    return { ...this.state };
  }

  /**
   * Load events from data source
   * Handles both initial load and pagination
   *
   * @param reset If true, clear existing events and reset offset to 0. If false, append to existing events.
   */
  async loadEvents(reset: boolean = false): Promise<void> {
    this.updateState({ loading: true, error: null });

    try {
      // Use reset offset if resetting, otherwise use current offset
      const query = reset ? { ...this.state.filters, offset: 0 } : this.state.filters;

      // Choose data source based on whether search is active
      const result = this.state.searchQuery
        ? await this.dataSource.searchActivityLog({
            ...query,
            searchText: this.state.searchQuery,
          })
        : await this.dataSource.getActivityLog(query);

      // Update state with results
      this.updateState({
        events: reset ? result.events : [...this.state.events, ...result.events],
        loading: false,
        hasMore: result.hasMore,
        corruptedCount: this.dataSource.getCorruptedEntryCount(),
      });
    } catch (error) {
      this.updateState({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load events',
      });
    }
  }

  /**
   * Update filter criteria and reload events
   * Resets pagination to first page
   *
   * @param newFilters Partial filter object to merge with current filters
   */
  async updateFilters(newFilters: Partial<ActivityLogQuery>): Promise<void> {
    this.updateState({
      filters: { ...this.state.filters, ...newFilters, offset: 0 },
    });
    await this.loadEvents(true);
  }

  /**
   * Update search query and reload events
   * Resets pagination to first page
   *
   * @param query Search text to find in event descriptions
   */
  async updateSearch(query: string): Promise<void> {
    this.updateState({
      searchQuery: query,
      filters: { ...this.state.filters, offset: 0 },
    });
    await this.loadEvents(true);
  }

  /**
   * Load next page of events
   * Increments offset by limit and appends results
   * No-op if already loading or no more results available
   */
  async loadMore(): Promise<void> {
    if (this.state.loading || !this.state.hasMore) return;

    this.updateState({
      filters: {
        ...this.state.filters,
        offset: (this.state.filters.offset || 0) + (this.state.filters.limit || 50),
      },
    });

    await this.loadEvents(false);
  }

  /**
   * Filter events by date range
   * Filters by real-world timestamps (Unix milliseconds)
   *
   * @param startDate Start timestamp in milliseconds (optional)
   * @param endDate End timestamp in milliseconds (optional)
   */
  async filterByDateRange(startDate?: number, endDate?: number): Promise<void> {
    await this.updateFilters({
      startDate,
      endDate,
    });
  }

  /**
   * Filter events by event types
   * Shows only events matching the specified types
   *
   * @param eventTypes Array of event types to show (optional, omit to show all)
   */
  async filterByEventTypes(eventTypes?: ActivityEventType[]): Promise<void> {
    await this.updateFilters({
      eventTypes,
    });
  }

  /**
   * Filter events by actor
   * Shows only events triggered by specific actor types or names
   *
   * @param actorTypes Optional actor types ('player', 'gm', 'system')
   * @param actorNames Optional specific actor names
   */
  async filterByActor(
    actorTypes?: Array<'player' | 'gm' | 'system'>,
    actorNames?: string[]
  ): Promise<void> {
    await this.updateFilters({
      actorTypes,
      actorNames,
    });
  }

  /**
   * Reset all filters to default state
   * Shows most recent 50 events with no search
   */
  async resetFilters(): Promise<void> {
    this.updateState({
      filters: {
        campaignId: 'campaign_default',
        sortOrder: 'desc',
        limit: 50,
        offset: 0,
      },
      searchQuery: '',
    });
    await this.loadEvents(true);
  }

  /**
   * Change sort order between ascending and descending
   * Most recent first is default (desc)
   *
   * @param sortOrder 'asc' for oldest first, 'desc' for newest first
   */
  async setSortOrder(sortOrder: 'asc' | 'desc'): Promise<void> {
    await this.updateFilters({
      sortOrder,
    });
  }

  /**
   * Change page size for pagination
   * Resets to first page when limit changes
   *
   * @param limit Number of events per page
   */
  async setPageSize(limit: number): Promise<void> {
    await this.updateFilters({
      limit,
    });
  }

  /**
   * Update internal state and notify all listeners
   * Private method - state changes only through public methods
   *
   * @param updates Partial state to merge with current state
   */
  private updateState(updates: Partial<ActivityLogViewState>): void {
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
  }

  /**
   * Notify all subscribed listeners of state change
   * Called after every state update
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
