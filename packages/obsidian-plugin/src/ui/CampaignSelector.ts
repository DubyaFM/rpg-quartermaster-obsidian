/**
 * Campaign Selector Component
 *
 * Status bar dropdown selector for switching between campaigns.
 * Displays active campaign name and provides quick access to:
 * - Switch to different campaign
 * - Create new campaign
 * - Manage campaigns
 *
 * **Phase 3 - TKT-CS-023**
 */

import { App, Menu, Notice } from 'obsidian';
import type QuartermasterPlugin from '../main';
import { CampaignSwitchLoader } from './CampaignSwitchLoader';

export class CampaignSelector {
	private statusBarItem: HTMLElement;
	private activeCampaignId: string | null = null;
	private activeCampaignName: string = 'No Campaign';

	constructor(
		private app: App,
		private plugin: QuartermasterPlugin
	) {
		this.statusBarItem = plugin.addStatusBarItem();
		this.statusBarItem.addClass('quartermaster-campaign-selector');

		// Initialize display
		this.refreshDisplay();

		// Register click handler
		this.statusBarItem.onclick = (event: MouseEvent) => {
			this.showCampaignMenu(event);
		};

		// Listen for campaign changes
		this.plugin.registerEvent(
			this.app.workspace.on('quartermaster:campaign-changed' as any, () => {
				this.refreshDisplay();
			})
		);
	}

	/**
	 * Refresh the status bar display with current campaign info
	 */
	async refreshDisplay(): Promise<void> {
		try {
			// Get active campaign ID
			this.activeCampaignId = await this.plugin.adapterFactory.getActiveCampaignId();

			if (!this.activeCampaignId) {
				this.activeCampaignName = 'No Campaign';
				this.renderStatusBar();
				return;
			}

			// Get campaign list to find active campaign name
			const campaigns = await this.plugin.adapterFactory.listCampaigns();
			const activeCampaign = campaigns.find(c => c.id === this.activeCampaignId);

			if (activeCampaign) {
				this.activeCampaignName = activeCampaign.name;
			} else {
				this.activeCampaignName = 'Unknown Campaign';
			}

			this.renderStatusBar();
		} catch (error) {
			console.error('[CampaignSelector] Error refreshing display:', error);
			this.activeCampaignName = 'Error';
			this.renderStatusBar();
		}
	}

	/**
	 * Render the status bar item
	 * @private
	 */
	private renderStatusBar(): void {
		this.statusBarItem.empty();

		// Icon
		const icon = this.statusBarItem.createSpan({ cls: 'quartermaster-campaign-selector-icon' });
		icon.setText('📋');

		// Campaign name
		const text = this.statusBarItem.createSpan({ cls: 'quartermaster-campaign-selector-text' });
		text.setText(this.activeCampaignName);

		// Tooltip
		this.statusBarItem.setAttribute('aria-label', `Active Campaign: ${this.activeCampaignName}`);
		this.statusBarItem.setAttribute('title', `Click to switch campaigns`);
	}

	/**
	 * Show campaign selection menu
	 * @param event - Mouse event from status bar click
	 * @private
	 */
	private async showCampaignMenu(event: MouseEvent): Promise<void> {
		const menu = new Menu();

		try {
			// Get all campaigns
			const campaigns = await this.plugin.adapterFactory.listCampaigns();

			// Add campaign menu items
			for (const campaign of campaigns) {
				const isActive = campaign.id === this.activeCampaignId;

				menu.addItem((item) => {
					const title = isActive ? `✓ ${campaign.name}` : campaign.name;
					item
						.setTitle(title)
						.setIcon(isActive ? 'check' : 'circle')
						.setSection('campaigns')
						.onClick(async () => {
							if (!isActive) {
								await this.switchToCampaign(campaign.id, campaign.name);
							}
						});
				});
			}

			// Separator
			menu.addSeparator();

			// Create New Campaign
			menu.addItem((item) => {
				item
					.setTitle('Create New Campaign')
					.setIcon('plus')
					.setSection('actions')
					.onClick(() => {
						// Import dynamically to avoid circular dependencies
						import('./SetupWizardModal').then(({ SetupWizardModal }) => {
							new SetupWizardModal(this.app, this.plugin, () => {
								this.refreshDisplay();
							}).open();
						}).catch(error => {
							console.error('[CampaignSelector] Failed to load SetupWizardModal:', error);
							new Notice('Failed to open campaign wizard');
						});
					});
			});

			// Manage Campaigns
			menu.addItem((item) => {
				item
					.setTitle('Manage Campaigns')
					.setIcon('settings')
					.setSection('actions')
					.onClick(() => {
						// Import dynamically to avoid circular dependencies
						import('./CampaignManagerModal').then(({ CampaignManagerModal }) => {
							new CampaignManagerModal(this.app, this.plugin, () => {
								this.refreshDisplay();
							}).open();
						}).catch(error => {
							console.error('[CampaignSelector] Failed to load CampaignManagerModal:', error);
							new Notice('Failed to open campaign manager');
						});
					});
			});

			// Show menu at mouse position
			menu.showAtMouseEvent(event);
		} catch (error) {
			console.error('[CampaignSelector] Error showing campaign menu:', error);
			new Notice('Failed to load campaign list');
		}
	}

	/**
	 * Switch to a different campaign
	 *
	 * @param campaignId - ID of campaign to switch to
	 * @param campaignName - Name of campaign (for loading message)
	 * @private
	 */
	private async switchToCampaign(campaignId: string, campaignName: string): Promise<void> {
		// Show loading modal
		const loader = new CampaignSwitchLoader(this.app, campaignName);
		loader.open();

		try {
			// Perform campaign switch via plugin
			await this.plugin.switchCampaign(campaignId);

			// Close loading modal
			loader.onSwitchComplete();

			// Show success notice
			new Notice(`Switched to campaign: ${campaignName}`);

			// Refresh display (also triggered by campaign-changed event, but this ensures immediate update)
			await this.refreshDisplay();
		} catch (error) {
			console.error('[CampaignSelector] Campaign switch failed:', error);

			// Show error in loading modal
			loader.onSwitchError(error as Error);

			// Also show notice for quick feedback
			new Notice(`Failed to switch campaign: ${(error as Error).message}`);
		}
	}

	/**
	 * Cleanup when selector is destroyed
	 */
	destroy(): void {
		this.statusBarItem.remove();
	}
}
