import { Modal, App, Notice } from 'obsidian';
import { ActivityLogTab } from './ActivityLogTab';
import type { ObsidianActivityLogHandler } from '../adapters/ObsidianActivityLogHandler';

/**
 * Activity Log Modal
 * Modal wrapper for the Activity Log tab
 */
export class ActivityLogModal extends Modal {
  private tab: ActivityLogTab | null = null;

  constructor(app: App, private handler: ObsidianActivityLogHandler) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('activity-log-modal');

    // Add title
    contentEl.createEl('h2', { text: 'Activity Log' });

    // Create tab container
    const tabContainer = contentEl.createDiv('activity-log-container');

    // Create and display tab
    this.tab = new ActivityLogTab(this.app, tabContainer, this.handler);
    this.tab.display().catch((error) => {
      console.error('[ActivityLog] Failed to display activity log tab:', error);
      new Notice('Failed to load activity log');
    });
  }

  onClose(): void {
    if (this.tab) {
      this.tab.onClose();
      this.tab = null;
    }
    const { contentEl } = this;
    contentEl.empty();
  }
}
