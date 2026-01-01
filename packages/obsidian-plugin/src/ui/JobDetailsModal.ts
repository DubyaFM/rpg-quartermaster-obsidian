/**
 * Job Details Modal
 *
 * Read-only view of job details with action buttons for status changes
 * Displays all job information in a formatted view
 *
 * @module JobDetailsModal
 */

import { Modal, App, Notice, Setting } from 'obsidian';
import { Job, JobStatus } from '@quartermaster/core/models/Job';
import { JobExpirationService } from '@quartermaster/core/services/JobExpirationService';
import { RewardDistributor } from '@quartermaster/core/services/RewardDistributor';
import type QuartermasterPlugin from '../main';
import { EditJobModal } from './EditJobModal';
import { DistributeRewardsModal } from './DistributeRewardsModal';

export class JobDetailsModal extends Modal {
	plugin: QuartermasterPlugin;
	job: Job;
	expirationService: JobExpirationService;
	rewardDistributor: RewardDistributor;

	constructor(app: App, plugin: QuartermasterPlugin, job: Job) {
		super(app);
		this.plugin = plugin;
		this.job = job;
		this.expirationService = new JobExpirationService();
		this.rewardDistributor = new RewardDistributor();
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('job-details-modal');

		// Header
		const header = contentEl.createDiv({ cls: 'job-details-header' });
		header.createEl('h2', { text: this.job.title });

		const statusBadge = header.createEl('span', {
			text: this.job.status,
			cls: `job-status-badge status-${this.job.status.toLowerCase()}`
		});

		// Metadata
		this.renderMetadata(contentEl);

		// Basic Info
		this.renderBasicInfo(contentEl);

		// Time Info
		this.renderTimeInfo(contentEl);

		// Prerequisites
		if (this.job.prerequisites) {
			this.renderPrerequisites(contentEl);
		}

		// Rewards
		this.renderRewards(contentEl);

		// Reputation Impacts
		if (this.job.reputationImpacts.length > 0) {
			this.renderReputationImpacts(contentEl);
		}

		// Narrative Consequence
		if (this.job.narrativeConsequence) {
			this.renderNarrativeConsequence(contentEl);
		}

		// Actions
		this.renderActions(contentEl);
	}

	private renderMetadata(container: HTMLElement) {
		const section = container.createDiv({ cls: 'job-details-section' });

		const metadata = section.createDiv({ cls: 'job-metadata' });
		metadata.createEl('p', { text: `Posted: Day ${this.job.postDate}` });

		if (this.job.takenDate !== null) {
			metadata.createEl('p', { text: `Taken: Day ${this.job.takenDate}` });
		}

		if (this.job.hideFromPlayers) {
			metadata.createEl('p', {
				text: '🔒 Hidden from Players',
				cls: 'job-flag-text'
			});
		}

		if (this.job.archived) {
			metadata.createEl('p', {
				text: '📁 Archived',
				cls: 'job-flag-text'
			});
		}
	}

	private renderBasicInfo(container: HTMLElement) {
		const section = container.createDiv({ cls: 'job-details-section' });
		section.createEl('h3', { text: 'Basic Information' });

		if (this.job.location) {
			section.createEl('p', { text: `📍 Location: ${this.job.location}` });
		}

		if (this.job.questgiver) {
			section.createEl('p', { text: `👤 Questgiver: ${this.job.questgiver}` });
		}
	}

	private renderTimeInfo(container: HTMLElement) {
		const section = container.createDiv({ cls: 'job-details-section' });
		section.createEl('h3', { text: 'Time Constraints' });

		const currentDay = this.plugin.settings.calendarState?.currentDay || 0;

		// Availability duration
		if (this.job.durationAvailability === 0) {
			section.createEl('p', { text: '⏰ Availability: No Limit' });
		} else {
			const expirationDay = this.expirationService.calculateExpirationDay(this.job);
			section.createEl('p', {
				text: `⏰ Availability: ${this.job.durationAvailability} days (expires Day ${expirationDay})`
			});
		}

		// Completion deadline
		if (this.job.durationCompletion === 0) {
			section.createEl('p', { text: '⏰ Completion Deadline: No Limit' });
		} else {
			if (this.job.takenDate !== null) {
				const deadlineDay = this.expirationService.calculateDeadlineDay(this.job);
				section.createEl('p', {
					text: `⏰ Completion Deadline: ${this.job.durationCompletion} days (deadline Day ${deadlineDay})`
				});
			} else {
				section.createEl('p', {
					text: `⏰ Completion Deadline: ${this.job.durationCompletion} days after taken`
				});
			}
		}

		// Days remaining
		const daysRemaining = this.expirationService.calculateDaysRemaining(this.job, currentDay);
		if (daysRemaining !== null) {
			const formatted = this.expirationService.formatDaysRemaining(daysRemaining);
			const timeClass = daysRemaining < 0 ? 'time-overdue' :
				daysRemaining === 0 ? 'time-urgent' :
					daysRemaining <= 3 ? 'time-warning' : 'time-normal';

			section.createEl('p', {
				text: `⌛ ${formatted}`,
				cls: timeClass
			});
		}
	}

	private renderPrerequisites(container: HTMLElement) {
		const section = container.createDiv({ cls: 'job-details-section' });
		section.createEl('h3', { text: 'Prerequisites' });

		const prereqText = section.createDiv({ cls: 'job-prerequisites-text' });
		prereqText.createEl('p', { text: this.job.prerequisites });
	}

	private renderRewards(container: HTMLElement) {
		const section = container.createDiv({ cls: 'job-details-section' });
		section.createEl('h3', { text: 'Rewards' });

		const rewardsList = section.createDiv({ cls: 'rewards-list' });

		if (this.job.rewardFunds > 0) {
			rewardsList.createEl('p', { text: `💰 Currency: ${this.job.rewardFunds} gp` });
		}

		if (this.job.rewardXP > 0) {
			rewardsList.createEl('p', { text: `⭐ XP: ${this.job.rewardXP}` });
		}

		if (this.job.rewardItems.length > 0) {
			rewardsList.createEl('h4', { text: 'Items:' });
			const itemsList = rewardsList.createEl('ul');
			this.job.rewardItems.forEach(item => {
				itemsList.createEl('li', {
					text: `${item.item} (x${item.quantity})`
				});
			});
		}

		if (this.job.rewardFunds === 0 && this.job.rewardXP === 0 && this.job.rewardItems.length === 0) {
			rewardsList.createEl('p', {
				text: 'No rewards defined',
				cls: 'placeholder-text'
			});
		}
	}

	private renderReputationImpacts(container: HTMLElement) {
		const section = container.createDiv({ cls: 'job-details-section' });
		section.createEl('h3', { text: 'Reputation Impacts' });

		const impactsList = section.createDiv({ cls: 'reputation-impacts-list' });

		// Group by condition
		const onSuccess = this.job.reputationImpacts.filter(i => i.condition === 'On Success');
		const onFailure = this.job.reputationImpacts.filter(i => i.condition === 'On Failure');
		const onExpiration = this.job.reputationImpacts.filter(i => i.condition === 'On Expiration');

		if (onSuccess.length > 0) {
			impactsList.createEl('h4', { text: 'On Success:' });
			const list = impactsList.createEl('ul');
			onSuccess.forEach(impact => {
				const sign = impact.value >= 0 ? '+' : '';
				list.createEl('li', {
					text: `${impact.targetEntity} (${impact.targetType}): ${sign}${impact.value}`
				});
			});
		}

		if (onFailure.length > 0) {
			impactsList.createEl('h4', { text: 'On Failure:' });
			const list = impactsList.createEl('ul');
			onFailure.forEach(impact => {
				const sign = impact.value >= 0 ? '+' : '';
				list.createEl('li', {
					text: `${impact.targetEntity} (${impact.targetType}): ${sign}${impact.value}`
				});
			});
		}

		if (onExpiration.length > 0) {
			impactsList.createEl('h4', { text: 'On Expiration:' });
			const list = impactsList.createEl('ul');
			onExpiration.forEach(impact => {
				const sign = impact.value >= 0 ? '+' : '';
				list.createEl('li', {
					text: `${impact.targetEntity} (${impact.targetType}): ${sign}${impact.value}`
				});
			});
		}
	}

	private renderNarrativeConsequence(container: HTMLElement) {
		const section = container.createDiv({ cls: 'job-details-section' });
		section.createEl('h3', { text: 'Narrative Consequence' });

		section.createEl('p', { text: this.job.narrativeConsequence });
	}

	private renderActions(container: HTMLElement) {
		const section = container.createDiv({ cls: 'job-actions-section' });

		// Edit button (always available)
		const editBtn = section.createEl('button', {
			text: 'Edit Job',
			cls: 'mod-cta'
		});
		editBtn.onclick = () => {
			new EditJobModal(this.app, this.plugin, this.job).open();
			this.close();
		};

		// Status-specific actions
		if (this.job.status === JobStatus.Posted) {
			const takeBtn = section.createEl('button', {
				text: 'Take Job'
			});
			takeBtn.onclick = async () => {
				await this.takeJob();
			};
		}

		if (this.job.status === JobStatus.Taken) {
			const completeBtn = section.createEl('button', {
				text: 'Complete'
			});
			completeBtn.onclick = async () => {
				await this.completeJob();
			};

			const failBtn = section.createEl('button', {
				text: 'Fail',
				cls: 'mod-warning'
			});
			failBtn.onclick = async () => {
				await this.failJob();
			};
		}

		// Distribute rewards button (for completed jobs)
		if (this.job.status === JobStatus.Completed) {
			const distributeBtn = section.createEl('button', {
				text: 'Distribute Rewards',
				cls: 'mod-cta'
			});
			distributeBtn.onclick = () => {
				new DistributeRewardsModal(this.app, this.plugin, this.job).open();
				this.close();
			};
		}

		// Archive toggle
		if ([JobStatus.Completed, JobStatus.Failed, JobStatus.Expired].includes(this.job.status)) {
			const archiveBtn = section.createEl('button', {
				text: this.job.archived ? 'Unarchive' : 'Archive'
			});
			archiveBtn.onclick = async () => {
				await this.toggleArchive();
			};
		}

		// Close button
		const closeBtn = section.createEl('button', {
			text: 'Close'
		});
		closeBtn.onclick = () => {
			this.close();
		};
	}

	private async takeJob() {
		try {
			const currentDay = this.plugin.settings.calendarState?.currentDay || 0;
			this.job.status = JobStatus.Taken;
			this.job.takenDate = currentDay;

			await this.plugin.jobFileHandler.saveJob(this.job);

			new Notice(`Job "${this.job.title}" marked as Taken`);
			this.close();

			this.plugin.eventBus.emit('JobUpdated', { job: this.job, timestamp: Date.now() });
		} catch (error) {
			console.error('[JobDetailsModal] Error taking job:', error);
			new Notice('Failed to take job');
		}
	}

	private async completeJob() {
		try {
			this.job.status = JobStatus.Completed;

			await this.plugin.jobFileHandler.saveJob(this.job);

			new Notice(`Job "${this.job.title}" marked as Completed`);

			// Ask if they want to distribute rewards now
			const distributeNow = confirm('Job completed! Would you like to distribute rewards now?');

			if (distributeNow) {
				new DistributeRewardsModal(this.app, this.plugin, this.job).open();
			}

			this.close();

			this.plugin.eventBus.emit('JobStatusChanged', {
				jobPath: this.job.filePath!,
				previousStatus: JobStatus.Taken,
				newStatus: JobStatus.Completed,
				job: this.job,
				timestamp: Date.now(),
				reason: 'Manual'
			});
		} catch (error) {
			console.error('[JobDetailsModal] Error completing job:', error);
			new Notice('Failed to complete job');
		}
	}

	private async failJob() {
		try {
			this.job.status = JobStatus.Failed;

			await this.plugin.jobFileHandler.saveJob(this.job);

			new Notice(`Job "${this.job.title}" marked as Failed`);
			this.close();

			this.plugin.eventBus.emit('JobStatusChanged', {
				jobPath: this.job.filePath!,
				previousStatus: JobStatus.Taken,
				newStatus: JobStatus.Failed,
				job: this.job,
				timestamp: Date.now(),
				reason: 'Manual'
			});
		} catch (error) {
			console.error('[JobDetailsModal] Error failing job:', error);
			new Notice('Failed to mark job as failed');
		}
	}

	private async toggleArchive() {
		try {
			this.job.archived = !this.job.archived;

			await this.plugin.jobFileHandler.saveJob(this.job);

			new Notice(`Job "${this.job.title}" ${this.job.archived ? 'archived' : 'unarchived'}`);

			// Refresh display
			this.onOpen();
		} catch (error) {
			console.error('[JobDetailsModal] Error toggling archive:', error);
			new Notice('Failed to toggle archive status');
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
