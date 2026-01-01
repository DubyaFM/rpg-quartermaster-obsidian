/**
 * Distribute Rewards Modal
 *
 * Modal for distributing job rewards to party
 * Shows calculated rewards and allows GM to review before distribution
 *
 * @module DistributeRewardsModal
 */

import { Modal, App, Notice } from 'obsidian';
import { Job } from '@quartermaster/core/models/Job';
import { RewardDistributor } from '@quartermaster/core/services/RewardDistributor';
import type QuartermasterPlugin from '../main';

export class DistributeRewardsModal extends Modal {
	plugin: QuartermasterPlugin;
	job: Job;
	distributor: RewardDistributor;

	constructor(app: App, plugin: QuartermasterPlugin, job: Job) {
		super(app);
		this.plugin = plugin;
		this.job = job;
		this.distributor = new RewardDistributor();
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('distribute-rewards-modal');

		contentEl.createEl('h2', { text: `Distribute Rewards: ${this.job.title}` });

		// Calculate rewards
		const result = this.distributor.calculateRewards(this.job);

		// Show warnings if any
		if (result.warnings.length > 0) {
			this.renderWarnings(contentEl, result.warnings);
		}

		// Show reward summary
		this.renderRewardSummary(contentEl, result);

		// Reputation impacts
		if (result.reputationImpacts.length > 0) {
			this.renderReputationImpacts(contentEl, result.reputationImpacts);
		}

		// Check if GM review is needed
		const needsReview = this.distributor.shouldPromptGMReview(this.job, result);

		if (needsReview) {
			contentEl.createEl('p', {
				text: '⚠️ This job requires GM review before distributing rewards',
				cls: 'warning-text'
			});
		}

		// Action buttons
		this.renderActionButtons(contentEl, result);
	}

	private renderWarnings(container: HTMLElement, warnings: string[]) {
		const section = container.createDiv({ cls: 'warnings-section' });
		section.createEl('h3', { text: '⚠️ Warnings' });

		const warningsList = section.createEl('ul', { cls: 'warnings-list' });
		warnings.forEach(warning => {
			warningsList.createEl('li', { text: warning, cls: 'warning-item' });
		});
	}

	private renderRewardSummary(container: HTMLElement, result: any) {
		const section = container.createDiv({ cls: 'rewards-summary-section' });
		section.createEl('h3', { text: 'Rewards to Distribute' });

		const summary = section.createDiv({ cls: 'rewards-summary' });

		// Gold
		if (result.goldReward > 0) {
			const goldRow = summary.createDiv({ cls: 'reward-row' });
			goldRow.createEl('span', { text: '💰 Gold:' });
			goldRow.createEl('span', { text: `${result.goldReward} gp`, cls: 'reward-value' });
		}

		// XP
		if (result.xpReward > 0) {
			const xpRow = summary.createDiv({ cls: 'reward-row' });
			xpRow.createEl('span', { text: '⭐ XP:' });
			xpRow.createEl('span', { text: `${result.xpReward}`, cls: 'reward-value' });
		}

		// Items
		if (result.itemRewards.length > 0) {
			const itemsSection = summary.createDiv({ cls: 'reward-items-section' });
			itemsSection.createEl('h4', { text: '📦 Items:' });

			const itemsList = itemsSection.createEl('ul');
			result.itemRewards.forEach((item: any) => {
				itemsList.createEl('li', {
					text: `${item.item} (x${item.quantity})`
				});
			});
		}

		// No rewards case
		if (result.goldReward === 0 && result.xpReward === 0 && result.itemRewards.length === 0) {
			summary.createEl('p', {
				text: 'No monetary or item rewards to distribute',
				cls: 'placeholder-text'
			});
		}
	}

	private renderReputationImpacts(container: HTMLElement, impacts: any[]) {
		const section = container.createDiv({ cls: 'reputation-section' });
		section.createEl('h3', { text: 'Reputation Changes' });

		const impactsList = section.createEl('ul', { cls: 'reputation-impacts-list' });

		impacts.forEach(impact => {
			const sign = impact.value >= 0 ? '+' : '';
			const entityName = this.extractEntityName(impact.targetEntity);

			impactsList.createEl('li', {
				text: `${entityName} (${impact.targetType}): ${sign}${impact.value} renown`
			});
		});

		section.createEl('p', {
			text: '💡 Reputation changes are for informational purposes only. Update faction/location files manually.',
			cls: 'setting-item-description'
		});
	}

	private extractEntityName(entityString: string): string {
		// Extract from wikilink if present
		const wikilinkMatch = entityString.match(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/);
		if (wikilinkMatch) {
			return wikilinkMatch[1];
		}
		return entityString;
	}

	private renderActionButtons(container: HTMLElement, result: any) {
		const section = container.createDiv({ cls: 'action-buttons-section' });

		const distributeBtn = section.createEl('button', {
			text: 'Distribute Rewards',
			cls: 'mod-cta'
		});
		distributeBtn.onclick = async () => {
			await this.distributeRewards(result);
		};

		const copyBtn = section.createEl('button', {
			text: 'Copy Summary'
		});
		copyBtn.onclick = () => {
			this.copySummary(result);
		};

		const cancelBtn = section.createEl('button', {
			text: 'Cancel'
		});
		cancelBtn.onclick = () => {
			this.close();
		};
	}

	private async distributeRewards(result: any) {
		try {
			// Add currency to party treasury
			if (result.goldReward > 0) {
				const currentFunds = this.plugin.settings.partyFunds || { copper: 0, silver: 0, gold: 0, platinum: 0 };

				// Add reward currency
				const newFunds = {
					...currentFunds,
					gold: currentFunds.gold + result.goldReward
				};

				this.plugin.settings.partyFunds = newFunds;
				await this.plugin.saveSettings();
			}

			// Add items to party inventory
			if (result.itemRewards.length > 0) {
				const purchasedItems = result.itemRewards.map((item: any) => ({
					name: item.item,
					quantity: item.quantity,
					cost: { copper: 0, silver: 0, gold: 0, platinum: 0 },
					isSale: false
				}));

				await this.plugin.dataAdapter.addItemsToPartyInventory(purchasedItems);
			}

			// Emit rewards distributed event
			this.plugin.eventBus.emit('JobRewardsDistributed', {
				jobPath: this.job.filePath!,
				job: this.job,
				rewards: result,
				timestamp: Date.now()
			});

			// Create success summary
			const summaryParts = [];
			if (result.goldReward > 0) {
				summaryParts.push(`💰 ${result.goldReward} gp added to party treasury`);
			}
			if (result.itemRewards.length > 0) {
				summaryParts.push(`📦 ${result.itemRewards.length} item(s) added to party inventory`);
			}
			if (result.xpReward > 0) {
				summaryParts.push(`⭐ ${result.xpReward} XP earned (distribute manually)`);
			}

			new Notice(
				`Rewards distributed for "${this.job.title}"!\n\n${summaryParts.join('\n')}`,
				8000
			);

			this.close();
		} catch (error) {
			console.error('[DistributeRewardsModal] Error distributing rewards:', error);
			new Notice(`Failed to distribute rewards: ${error.message}`);
		}
	}

	private copySummary(result: any) {
		const summary = this.distributor.formatRewardSummary(result);

		// Copy to clipboard
		navigator.clipboard.writeText(summary).then(() => {
			new Notice('Reward summary copied to clipboard');
		}).catch(error => {
			console.error('[DistributeRewardsModal] Failed to copy:', error);
			new Notice('Failed to copy summary');
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
