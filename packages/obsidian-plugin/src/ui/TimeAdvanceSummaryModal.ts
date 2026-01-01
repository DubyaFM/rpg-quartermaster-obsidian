import { Modal, App } from 'obsidian';
import type { TimeAdvanceSummary } from '@quartermaster/core/services/TimeAdvanceSummaryBuilder';

/**
 * Time Advance Summary Modal
 * Shows post-time-advance summary with all system updates
 */
export class TimeAdvanceSummaryModal extends Modal {
  constructor(app: App, private summary: TimeAdvanceSummary) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('time-advance-summary-modal');

    // Title
    contentEl.createEl('h2', {
      text: `Time Advanced: ${this.summary.daysAdvanced} Day${
        this.summary.daysAdvanced !== 1 ? 's' : ''
      }`,
    });

    // Date range
    contentEl.createEl('p', {
      text: `${this.summary.fromDate} → ${this.summary.toDate}`,
      cls: 'time-advance-dates',
    });

    // Check if there's any content
    if (!this.summary.hasContent) {
      contentEl.createEl('p', {
        text: 'No significant events occurred during this time period.',
        cls: 'time-advance-empty',
      });
      this.renderCloseButton();
      return;
    }

    // Render each section
    for (const section of this.summary.sections) {
      if (section.isEmpty) continue;

      const sectionEl = contentEl.createDiv('summary-section');
      sectionEl.createEl('h3', { text: section.title });

      const listEl = sectionEl.createEl('ul');
      for (const item of section.content) {
        listEl.createEl('li', { text: item });
      }
    }

    // Buttons
    this.renderButtons();
  }

  /**
   * Render action buttons
   */
  private renderButtons(): void {
    const buttonContainer = this.contentEl.createDiv('summary-modal-buttons');

    // Close button
    const closeButton = buttonContainer.createEl('button', {
      text: 'Close',
      cls: 'mod-cta',
    });
    closeButton.addEventListener('click', () => this.close());
  }

  /**
   * Render close button for empty state
   */
  private renderCloseButton(): void {
    const closeButton = this.contentEl.createEl('button', {
      text: 'Close',
      cls: 'mod-cta',
    });
    closeButton.addEventListener('click', () => this.close());
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
