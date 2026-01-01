import { Setting } from 'obsidian';
import type { App } from 'obsidian';
import {
  ActivityEvent,
  ActivityEventType,
} from '@quartermaster/core/models/ActivityLog';
import { ActivityLogTabViewModel, IActivityLogDataSource } from './viewmodels/ActivityLogTabViewModel';
import type { ObsidianActivityLogHandler } from '../adapters/ObsidianActivityLogHandler';

/**
 * Activity Log Tab - Search/filter/sort UI
 */
export class ActivityLogTab {
  private viewModel: ActivityLogTabViewModel;
  private unsubscribe: (() => void) | null = null;
  private listEl: HTMLElement | null = null;

  constructor(
    private app: App,
    private containerEl: HTMLElement,
    private handler: ObsidianActivityLogHandler
  ) {
    // Create ViewModel with data source adapter
    const dataSource: IActivityLogDataSource = {
      getActivityLog: (query) => handler.getActivityLog(query),
      searchActivityLog: (query) => handler.searchActivityLog(query),
      getCorruptedEntryCount: () => handler.getCorruptedEntries().length,
    };

    this.viewModel = new ActivityLogTabViewModel(dataSource);

    // Subscribe to state changes
    this.unsubscribe = this.viewModel.subscribe((state) => {
      this.render(state);
    });
  }

  /**
   * Display the tab
   */
  async display(): Promise<void> {
    this.containerEl.empty();
    this.containerEl.addClass('activity-log-tab');

    this.renderHeader();
    this.renderFilters();
    this.listEl = this.containerEl.createDiv('activity-log-list');

    // Initial load
    await this.viewModel.loadEvents(true);
  }

  /**
   * Clean up
   */
  onClose(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  /**
   * Render header with search
   */
  private renderHeader(): void {
    const header = this.containerEl.createDiv('activity-log-header');

    new Setting(header)
      .setName('Search Activities')
      .addText((text) => {
        text
          .setPlaceholder('Search by description...')
          .onChange(async (value) => {
            await this.viewModel.updateSearch(value);
          });
      });
  }

  /**
   * Render filters
   */
  private renderFilters(): void {
    const filterContainer = this.containerEl.createDiv('activity-log-filters');

    // Event type filter
    new Setting(filterContainer)
      .setName('Event Type')
      .addDropdown((dropdown) => {
        dropdown.addOption('', 'All Types');

        for (const type of Object.values(ActivityEventType)) {
          dropdown.addOption(type, this.formatTypeLabel(type));
        }

        dropdown.onChange(async (value) => {
          await this.viewModel.updateFilters({
            eventTypes: value ? [value as ActivityEventType] : undefined,
          });
        });
      });

    // Date range filters
    const dateContainer = filterContainer.createDiv('date-range-filters');
    new Setting(dateContainer)
      .setName('Date Range')
      .setDesc('Filter by timestamp range')
      .addText((text) => {
        text
          .setPlaceholder('Start timestamp')
          .onChange(async (value) => {
            const parsed = parseInt(value);
            await this.viewModel.filterByDateRange(
              isNaN(parsed) ? undefined : parsed,
              undefined
            );
          });
      })
      .addText((text) => {
        text
          .setPlaceholder('End timestamp')
          .onChange(async (value) => {
            const parsed = parseInt(value);
            const currentFilters = this.viewModel.getState().filters;
            await this.viewModel.filterByDateRange(
              currentFilters.startDate,
              isNaN(parsed) ? undefined : parsed
            );
          });
      });

    // Sort order
    new Setting(filterContainer)
      .setName('Sort Order')
      .addDropdown((dropdown) => {
        dropdown
          .addOption('desc', 'Newest First')
          .addOption('asc', 'Oldest First')
          .setValue('desc')
          .onChange(async (value) => {
            await this.viewModel.updateFilters({
              sortOrder: value as 'asc' | 'desc',
            });
          });
      });

    // Reset button
    const resetButton = filterContainer.createEl('button', {
      text: 'Reset Filters',
      cls: 'mod-cta',
    });
    resetButton.addEventListener('click', async () => {
      await this.viewModel.resetFilters();
    });
  }

  /**
   * Render based on ViewModel state
   */
  private render(state: ReturnType<typeof this.viewModel.getState>): void {
    if (!this.listEl) return;

    this.listEl.empty();

    // Corrupted entries warning
    if (state.corruptedCount > 0) {
      const warningEl = this.listEl.createDiv('activity-log-warning');
      warningEl.createEl('p', {
        text: `Warning: Found ${state.corruptedCount} corrupted ${
          state.corruptedCount === 1 ? 'entry' : 'entries'
        } in activity log.`,
      });
      warningEl.createEl('button', { text: 'View Details' }).addEventListener('click', () => {
        // TODO: Open CorruptedEntryModal
        console.log('Corrupted entries:', this.handler.getCorruptedEntries());
      });
    }

    // Loading state
    if (state.loading && state.events.length === 0) {
      this.listEl.createEl('p', { text: 'Loading...', cls: 'activity-log-loading' });
      return;
    }

    // Error state
    if (state.error) {
      this.listEl.createEl('p', {
        text: `Error: ${state.error}`,
        cls: 'activity-log-error',
      });
      return;
    }

    // Empty state
    if (state.events.length === 0) {
      this.listEl.createEl('p', {
        text: 'No activities found.',
        cls: 'activity-log-empty',
      });
      return;
    }

    // Render events
    for (const event of state.events) {
      this.renderEvent(this.listEl, event);
    }

    // Load more button
    if (state.hasMore && !state.loading) {
      const loadMoreButton = this.listEl.createEl('button', {
        text: 'Load More',
        cls: 'mod-cta',
      });
      loadMoreButton.addEventListener('click', async () => {
        await this.viewModel.loadMore();
      });
    }

    // Loading indicator for pagination
    if (state.loading && state.events.length > 0) {
      this.listEl.createEl('p', { text: 'Loading more...', cls: 'activity-log-loading' });
    }
  }

  /**
   * Render individual event
   */
  private renderEvent(container: HTMLElement, event: ActivityEvent): void {
    const eventEl = container.createDiv('activity-log-event');

    // Header
    const headerEl = eventEl.createDiv('activity-log-event-header');

    // Timestamp
    const date = new Date(event.timestamp);
    headerEl.createSpan({
      text: date.toLocaleString(),
      cls: 'activity-log-timestamp',
    });

    headerEl.createSpan({ text: ' - ' });

    // Event type
    headerEl.createSpan({
      text: this.formatTypeLabel(event.type),
      cls: 'activity-log-event-type',
    });

    // Description
    if (event.description) {
      eventEl.createEl('p', {
        text: event.description,
        cls: 'activity-log-description',
      });
    }

    // Actor info
    if (event.actorName) {
      const actorEl = eventEl.createDiv('activity-log-actor');
      actorEl.createSpan({
        text: `${event.actorType}: ${event.actorName}`,
        cls: 'activity-log-actor-info',
      });
    }
  }

  /**
   * Format event type label
   */
  private formatTypeLabel(type: string): string {
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
