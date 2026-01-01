import { Modal, App } from 'obsidian';
import type { CorruptedEntry } from '../adapters/ObsidianActivityLogHandler';

/**
 * Corrupted Entry Modal
 * Shows repair instructions for corrupted activity log entries
 */
export class CorruptedEntryModal extends Modal {
  constructor(app: App, private entries: CorruptedEntry[]) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('corrupted-entry-modal');

    // Title
    contentEl.createEl('h2', {
      text: `Corrupted Activity Log Entries (${this.entries.length})`,
    });

    // Instructions
    const instructionsEl = contentEl.createDiv('repair-instructions');
    instructionsEl.createEl('p', {
      text: 'The following entries could not be parsed correctly. Please review and fix them manually in your activity log file.',
    });

    // List of corrupted entries
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      this.renderCorruptedEntry(contentEl, entry, i + 1);
    }

    // How to fix instructions
    this.renderFixInstructions(contentEl);

    // Close button
    const closeButton = contentEl.createEl('button', {
      text: 'Close',
      cls: 'mod-cta',
    });
    closeButton.addEventListener('click', () => this.close());
  }

  /**
   * Render individual corrupted entry
   */
  private renderCorruptedEntry(
    container: HTMLElement,
    entry: CorruptedEntry,
    index: number
  ): void {
    const entryEl = container.createDiv('corrupted-entry');

    // Entry number and error
    entryEl.createEl('h3', { text: `Entry #${index}` });
    entryEl.createEl('p', {
      text: `Error: ${entry.error}`,
      cls: 'corrupted-error',
    });

    // Line number
    if (entry.lineNumber !== undefined) {
      entryEl.createEl('p', {
        text: `Approximate line: ${entry.lineNumber}`,
        cls: 'corrupted-line',
      });
    }

    // Raw content preview
    const codeEl = entryEl.createEl('pre');
    codeEl.createEl('code', {
      text: entry.rawContent,
      cls: 'corrupted-content',
    });
  }

  /**
   * Render fix instructions
   */
  private renderFixInstructions(container: HTMLElement): void {
    const instructionsEl = container.createDiv('fix-instructions');
    instructionsEl.createEl('h3', { text: 'How to Fix' });

    const list = instructionsEl.createEl('ol');

    list.createEl('li', {
      text: 'Open your activity log file in Obsidian',
    });

    list.createEl('li', {
      text: 'Search for the corrupted content shown above',
    });

    list.createEl('li', {
      text: 'Check that each entry has proper format:',
    });

    const formatList = list.createEl('ul');
    formatList.createEl('li', { text: 'Header: ## Date - Event Type' });
    formatList.createEl('li', { text: 'Metadata comment: <!-- id: ... type: ... -->' });
    formatList.createEl('li', { text: 'Content with proper markdown formatting' });
    formatList.createEl('li', { text: 'Separator: ---' });

    list.createEl('li', {
      text: 'Fix any formatting errors or remove the corrupted entry',
    });

    list.createEl('li', {
      text: 'Save the file - the activity log will automatically reload',
    });
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
