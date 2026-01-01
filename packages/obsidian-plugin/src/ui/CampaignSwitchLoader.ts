/**
 * Campaign Switch Loading Modal
 *
 * Displays loading state during campaign switching to prevent user confusion.
 * Automatically closes on success or shows error modal on failure.
 *
 * **Phase 3 - TKT-CS-028**
 */

import { App, Modal } from 'obsidian';

export class CampaignSwitchLoader extends Modal {
	private progressBar: HTMLElement;
	private messageEl: HTMLElement;
	private timeoutId: NodeJS.Timeout | null = null;
	private readonly TIMEOUT_MS = 10000; // 10 seconds

	constructor(
		app: App,
		private targetCampaignName: string,
		private onTimeout?: () => void
	) {
		super(app);

		// Modal should block UI interaction during switch
		this.modalEl.addClass('quartermaster-loading-modal');
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('quartermaster-campaign-loading');

		// Header
		contentEl.createEl('h2', {
			text: 'Switching Campaign',
			cls: 'quartermaster-loading-header'
		});

		// Loading message
		this.messageEl = contentEl.createEl('p', {
			text: `Loading ${this.targetCampaignName}...`,
			cls: 'quartermaster-loading-message'
		});

		// Progress bar / spinner
		this.progressBar = contentEl.createDiv('quartermaster-progress-bar');
		const spinner = this.progressBar.createDiv('quartermaster-spinner');
		spinner.innerHTML = `
			<svg class="quartermaster-spinner-svg" viewBox="0 0 50 50">
				<circle class="quartermaster-spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle>
			</svg>
		`;

		// Start timeout
		this.startTimeout();
	}

	/**
	 * Start 10-second timeout timer
	 * @private
	 */
	private startTimeout(): void {
		this.timeoutId = setTimeout(() => {
			this.onSwitchTimeout();
		}, this.TIMEOUT_MS);
	}

	/**
	 * Clear timeout timer
	 * @private
	 */
	private clearTimer(): void {
		if (this.timeoutId) {
			clearTimeout(this.timeoutId);
			this.timeoutId = null;
		}
	}

	/**
	 * Call when campaign switch completes successfully
	 */
	onSwitchComplete(): void {
		this.clearTimer();
		this.close();
	}

	/**
	 * Call when campaign switch fails
	 *
	 * @param error - Error that occurred during switch
	 */
	onSwitchError(error: Error): void {
		this.clearTimer();

		const { contentEl } = this;
		contentEl.empty();
		contentEl.removeClass('quartermaster-campaign-loading');
		contentEl.addClass('quartermaster-campaign-error');

		// Error header
		contentEl.createEl('h2', {
			text: 'Campaign Switch Failed',
			cls: 'quartermaster-error-header'
		});

		// Error message
		contentEl.createEl('p', {
			text: error.message || 'An unknown error occurred during campaign switch',
			cls: 'quartermaster-error-message'
		});

		// Technical details (collapsed)
		const details = contentEl.createEl('details', {
			cls: 'quartermaster-error-details'
		});
		details.createEl('summary', { text: 'Technical Details' });
		const pre = details.createEl('pre', {
			cls: 'quartermaster-error-stack'
		});
		pre.textContent = error.stack || error.toString();

		// OK button to close
		const buttonContainer = contentEl.createDiv('quartermaster-button-container');
		const okButton = buttonContainer.createEl('button', {
			text: 'OK',
			cls: 'mod-cta'
		});
		okButton.onclick = () => this.close();
	}

	/**
	 * Handle timeout event
	 * @private
	 */
	private onSwitchTimeout(): void {
		const timeoutError = new Error(
			`Campaign switch timed out after ${this.TIMEOUT_MS / 1000} seconds. ` +
			'This may indicate a problem with the campaign data or adapters.'
		);

		this.onSwitchError(timeoutError);

		// Call custom timeout handler if provided
		if (this.onTimeout) {
			this.onTimeout();
		}
	}

	/**
	 * Cleanup on modal close
	 */
	onClose(): void {
		this.clearTimer();
		const { contentEl } = this;
		contentEl.empty();
	}
}
