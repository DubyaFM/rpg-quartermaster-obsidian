/**
 * Edit Job Modal
 *
 * Modal for editing existing jobs/quests
 * Similar to CreateJobModal but pre-populated with existing data
 *
 * @module EditJobModal
 */

import { Modal, App, Setting, Notice } from 'obsidian';
import { Job, JobStatus, JobRewardItem, JobReputationImpact, ReputationTargetType, ReputationCondition } from '@quartermaster/core/models/Job';
import { JobValidator } from '@quartermaster/core/services/JobValidator';
import type QuartermasterPlugin from '../main';
import { ReputationTargetSuggest } from './suggest/ReputationTargetSuggest';

export class EditJobModal extends Modal {
	plugin: QuartermasterPlugin;
	validator: JobValidator;
	job: Job;
	allJobs: Job[] = [];
	reputationSuggests: Map<number, ReputationTargetSuggest> = new Map();

	// Job fields (loaded from existing job)
	title: string;
	location: string;
	questgiver: string;
	prerequisites: string;
	status: JobStatus;
	durationAvailability: number;
	durationCompletion: number;
	rewardGold: number;
	rewardXP: number;
	rewardItems: JobRewardItem[];
	reputationImpacts: JobReputationImpact[];
	narrativeConsequence: string;
	hideFromPlayers: boolean;

	constructor(app: App, plugin: QuartermasterPlugin, job: Job) {
		super(app);
		this.plugin = plugin;
		this.validator = new JobValidator();
		this.job = job;

		// Initialize fields from job
		this.title = job.title;
		this.location = job.location || '';
		this.questgiver = job.questgiver || '';
		this.prerequisites = job.prerequisites || '';
		this.status = job.status;
		this.durationAvailability = job.durationAvailability;
		this.durationCompletion = job.durationCompletion;
		this.rewardGold = job.rewardFunds;
		this.rewardXP = job.rewardXP;
		this.rewardItems = [...job.rewardItems]; // Clone array
		this.reputationImpacts = [...job.reputationImpacts]; // Clone array
		this.narrativeConsequence = job.narrativeConsequence || '';
		this.hideFromPlayers = job.hideFromPlayers;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('job-edit-modal');

		contentEl.createEl('h2', { text: `Edit Job: ${this.job.title}` });

		// Load all jobs for auto-suggest
		try {
			this.allJobs = await this.plugin.jobFileHandler.getAllJobs();
		} catch (error) {
			console.error('Failed to load jobs for auto-suggest:', error);
			this.allJobs = [];
		}

		// Info about current status
		const infoDiv = contentEl.createDiv({ cls: 'job-edit-info' });
		infoDiv.createEl('p', {
			text: `Posted: Day ${this.job.postDate} | Status: ${this.job.status}`,
			cls: 'job-edit-meta'
		});

		// Basic Information Section
		this.renderBasicInfoSection(contentEl);

		// Status Section
		this.renderStatusSection(contentEl);

		// Time Constraints Section
		this.renderTimeConstraintsSection(contentEl);

		// Rewards Section
		this.renderRewardsSection(contentEl);

		// Reputation Section
		this.renderReputationSection(contentEl);

		// Narrative Section
		this.renderNarrativeSection(contentEl);

		// Options Section
		this.renderOptionsSection(contentEl);

		// Action Buttons
		this.renderActionButtons(contentEl);
	}

	private renderBasicInfoSection(container: HTMLElement) {
		const section = container.createDiv({ cls: 'job-section' });
		section.createEl('h3', { text: 'Basic Information' });

		// Title (required)
		new Setting(section)
			.setName('Title *')
			.setDesc('Job title (required, max 200 characters)')
			.addText(text => text
				.setPlaceholder('Rat Catcher Wanted')
				.setValue(this.title)
				.onChange(value => {
					this.title = value;
					this.validateField(text.inputEl, 'title', value);
				}));

		// Location (optional)
		new Setting(section)
			.setName('Location')
			.setDesc('Where is this job posted? (optional, can use wikilinks)')
			.addText(text => text
				.setPlaceholder('[[Locations/Waterdeep]]')
				.setValue(this.location)
				.onChange(value => this.location = value));

		// Questgiver (optional)
		new Setting(section)
			.setName('Questgiver')
			.setDesc('Who is offering this job? (optional, can use wikilinks)')
			.addText(text => text
				.setPlaceholder('[[NPCs/Mayor Bob]]')
				.setValue(this.questgiver)
				.onChange(value => this.questgiver = value));

		// Prerequisites (optional)
		new Setting(section)
			.setName('Prerequisites')
			.setDesc('Requirements to take this job (optional)')
			.addTextArea(text => {
				text
					.setPlaceholder('Must have completed "Save the Village"')
					.setValue(this.prerequisites)
					.onChange(value => this.prerequisites = value);
				text.inputEl.rows = 3;
			});
	}

	private renderStatusSection(container: HTMLElement) {
		const section = container.createDiv({ cls: 'job-section' });
		section.createEl('h3', { text: 'Status' });

		new Setting(section)
			.setName('Job Status')
			.setDesc('Current job status')
			.addDropdown(dropdown => {
				dropdown
					.addOption(JobStatus.Posted, 'Posted')
					.addOption(JobStatus.Taken, 'Taken')
					.addOption(JobStatus.Completed, 'Completed')
					.addOption(JobStatus.Failed, 'Failed')
					.addOption(JobStatus.Expired, 'Expired')
					.addOption(JobStatus.Cancelled, 'Cancelled')
					.setValue(this.status)
					.onChange(value => {
						const newStatus = value as JobStatus;
						const error = this.validator.validateStatusTransition(this.job.status, newStatus, this.job);

						if (error) {
							new Notice(`Invalid status transition: ${error.message}`);
							dropdown.setValue(this.status); // Revert
						} else {
							this.status = newStatus;
						}
					});
			});

		section.createEl('p', {
			text: '⚠️ Some status transitions are restricted by business rules',
			cls: 'setting-item-description'
		});
	}

	private renderTimeConstraintsSection(container: HTMLElement) {
		const section = container.createDiv({ cls: 'job-section' });
		section.createEl('h3', { text: 'Time Constraints' });

		// Duration Availability
		new Setting(section)
			.setName('Availability Duration (days)')
			.setDesc('How long is this job available? 0 = No Limit')
			.addText(text => text
				.setPlaceholder('0')
				.setValue(String(this.durationAvailability))
				.onChange(value => {
					const num = parseInt(value) || 0;
					this.durationAvailability = Math.max(0, num);
					text.setValue(String(this.durationAvailability));
				}));

		// Duration Completion
		new Setting(section)
			.setName('Completion Deadline (days)')
			.setDesc('Days to complete after taken. 0 = No Limit')
			.addText(text => text
				.setPlaceholder('0')
				.setValue(String(this.durationCompletion))
				.onChange(value => {
					const num = parseInt(value) || 0;
					this.durationCompletion = Math.max(0, num);
					text.setValue(String(this.durationCompletion));
				}));
	}

	private renderRewardsSection(container: HTMLElement) {
		const section = container.createDiv({ cls: 'job-section' });
		section.createEl('h3', { text: 'Rewards' });

		// Currency Reward
		new Setting(section)
			.setName('Currency Reward')
			.setDesc('Gold pieces (must be >= 0)')
			.addText(text => text
				.setPlaceholder('0')
				.setValue(String(this.rewardGold))
				.onChange(value => {
					const num = parseInt(value) || 0;
					this.rewardGold = Math.max(0, num);
					text.setValue(String(this.rewardGold));
				}));

		// XP Reward
		new Setting(section)
			.setName('XP Reward')
			.setDesc('Experience points (must be >= 0)')
			.addText(text => text
				.setPlaceholder('0')
				.setValue(String(this.rewardXP))
				.onChange(value => {
					const num = parseInt(value) || 0;
					this.rewardXP = Math.max(0, num);
					text.setValue(String(this.rewardXP));
				}));

		// Item Rewards
		const itemsContainer = section.createDiv({ cls: 'reward-items-container' });
		itemsContainer.createEl('h4', { text: 'Item Rewards' });

		const itemsList = itemsContainer.createDiv({ cls: 'reward-items-list' });
		this.renderRewardItemsList(itemsList);

		const addItemBtn = itemsContainer.createEl('button', {
			text: '+ Add Item Reward',
			cls: 'mod-cta'
		});
		addItemBtn.onclick = () => {
			this.rewardItems.push({ item: '', quantity: 1 });
			this.renderRewardItemsList(itemsList);
		};
	}

	private renderRewardItemsList(container: HTMLElement) {
		container.empty();

		if (this.rewardItems.length === 0) {
			container.createEl('p', {
				text: 'No item rewards added',
				cls: 'placeholder-text'
			});
			return;
		}

		this.rewardItems.forEach((rewardItem, index) => {
			const row = container.createDiv({ cls: 'reward-item-row' });

			new Setting(row)
				.setName(`Item ${index + 1}`)
				.addText(text => text
					.setPlaceholder('[[Items/Potion of Healing]]')
					.setValue(rewardItem.item)
					.onChange(value => {
						this.rewardItems[index].item = value;
					}))
				.addText(text => {
					text.inputEl.type = 'number';
					text.inputEl.min = '1';
					text.inputEl.max = '9999';
					text.inputEl.style.width = '80px';
					text
						.setPlaceholder('Qty')
						.setValue(String(rewardItem.quantity))
						.onChange(value => {
							const num = parseInt(value) || 1;
							this.rewardItems[index].quantity = Math.max(1, Math.min(9999, num));
						});
				})
				.addButton(btn => btn
					.setButtonText('Remove')
					.setWarning()
					.onClick(() => {
						this.rewardItems.splice(index, 1);
						this.renderRewardItemsList(container);
					}));
		});
	}

	private renderReputationSection(container: HTMLElement) {
		const section = container.createDiv({ cls: 'job-section' });
		section.createEl('h3', { text: 'Reputation Impacts' });

		const impactsList = section.createDiv({ cls: 'reputation-impacts-list' });
		this.renderReputationImpactsList(impactsList);

		const addImpactBtn = section.createEl('button', {
			text: '+ Add Reputation Impact',
			cls: 'mod-cta'
		});
		addImpactBtn.onclick = () => {
			this.reputationImpacts.push({
				targetType: ReputationTargetType.Location,
				targetEntity: '',
				value: 0,
				condition: ReputationCondition.OnSuccess
			});
			this.renderReputationImpactsList(impactsList);
		};
	}

	private renderReputationImpactsList(container: HTMLElement) {
		container.empty();

		if (this.reputationImpacts.length === 0) {
			container.createEl('p', {
				text: 'No reputation impacts added',
				cls: 'placeholder-text'
			});
			return;
		}

		this.reputationImpacts.forEach((impact, index) => {
			const row = container.createDiv({ cls: 'reputation-impact-row' });
			row.createEl('h4', { text: `Impact ${index + 1}` });

			// Target Type dropdown
			new Setting(row)
				.setName('Target Type')
				.addDropdown(dropdown => dropdown
					.addOption(ReputationTargetType.Location, 'Location')
					.addOption(ReputationTargetType.Faction, 'Faction')
					.addOption(ReputationTargetType.NPC, 'NPC')
					.setValue(impact.targetType)
					.onChange(value => {
						this.reputationImpacts[index].targetType = value as ReputationTargetType;
						// Update suggest to filter by new type
						const suggest = this.reputationSuggests.get(index);
						if (suggest) {
							suggest.setTargetType(value as ReputationTargetType);
						}
					}));

			// Target Entity input with auto-suggest
			new Setting(row)
				.setName('Target Entity')
				.setDesc('Start typing to see suggestions from previous jobs')
				.addText(text => {
					text
						.setPlaceholder('[[Factions/Harpers]]')
						.setValue(impact.targetEntity)
						.onChange(value => {
							this.reputationImpacts[index].targetEntity = value;
						});

					// Create auto-suggest for this input
					const suggest = new ReputationTargetSuggest(
						this.app,
						text.inputEl,
						this.allJobs
					);
					suggest.setTargetType(impact.targetType);
					this.reputationSuggests.set(index, suggest);
				});

			new Setting(row)
				.setName('Renown Change')
				.setDesc('Positive or negative whole number')
				.addText(text => {
					text.inputEl.type = 'number';
					text
						.setPlaceholder('0')
						.setValue(String(impact.value))
						.onChange(value => {
							const num = parseInt(value) || 0;
							this.reputationImpacts[index].value = num;
						});
				});

			new Setting(row)
				.setName('Condition')
				.addDropdown(dropdown => dropdown
					.addOption(ReputationCondition.OnSuccess, 'On Success')
					.addOption(ReputationCondition.OnFailure, 'On Failure')
					.addOption(ReputationCondition.OnExpiration, 'On Expiration')
					.setValue(impact.condition)
					.onChange(value => {
						this.reputationImpacts[index].condition = value as ReputationCondition;
					}));

			new Setting(row)
				.addButton(btn => btn
					.setButtonText('Remove Impact')
					.setWarning()
					.onClick(() => {
						this.reputationImpacts.splice(index, 1);
						this.renderReputationImpactsList(container);
					}));
		});
	}

	private renderNarrativeSection(container: HTMLElement) {
		const section = container.createDiv({ cls: 'job-section' });
		section.createEl('h3', { text: 'Narrative Consequence' });

		new Setting(section)
			.setName('Narrative Consequence')
			.setDesc('What happens when this job is resolved? (optional)')
			.addTextArea(text => {
				text
					.setPlaceholder('The village burns down if the party fails...')
					.setValue(this.narrativeConsequence)
					.onChange(value => this.narrativeConsequence = value);
				text.inputEl.rows = 3;
			});
	}

	private renderOptionsSection(container: HTMLElement) {
		const section = container.createDiv({ cls: 'job-section' });
		section.createEl('h3', { text: 'Options' });

		new Setting(section)
			.setName('Hide from Players')
			.setDesc('Keep this job hidden from players (GM only)')
			.addToggle(toggle => toggle
				.setValue(this.hideFromPlayers)
				.onChange(value => this.hideFromPlayers = value));
	}

	private renderActionButtons(container: HTMLElement) {
		const buttonContainer = container.createDiv({ cls: 'job-action-buttons' });

		const saveBtn = buttonContainer.createEl('button', {
			text: 'Save Changes',
			cls: 'mod-cta'
		});
		saveBtn.onclick = async () => {
			await this.saveJob();
		};

		const cancelBtn = buttonContainer.createEl('button', {
			text: 'Cancel'
		});
		cancelBtn.onclick = () => {
			this.close();
		};

		const deleteBtn = buttonContainer.createEl('button', {
			text: 'Delete Job',
			cls: 'mod-warning'
		});
		deleteBtn.onclick = async () => {
			await this.deleteJob();
		};
	}

	private validateField(inputEl: HTMLInputElement, fieldName: string, value: any): boolean {
		const error = this.validator.validateField(fieldName as keyof import('@quartermaster/core/models/Job').Job, value);

		if (error) {
			inputEl.addClass('validation-error');
			inputEl.title = error.message;
			return false;
		} else {
			inputEl.removeClass('validation-error');
			inputEl.title = '';
			return true;
		}
	}

	private async saveJob() {
		// Validate required fields
		if (!this.title || this.title.trim() === '') {
			new Notice('Job title is required');
			return;
		}

		// Update job object
		this.job.title = this.title;
		this.job.location = this.location || undefined;
		this.job.questgiver = this.questgiver || undefined;
		this.job.prerequisites = this.prerequisites || undefined;
		this.job.status = this.status;
		this.job.durationAvailability = this.durationAvailability;
		this.job.durationCompletion = this.durationCompletion;
		this.job.rewardFunds = this.rewardGold;
		this.job.rewardXP = this.rewardXP;
		this.job.rewardItems = this.rewardItems;
		this.job.reputationImpacts = this.reputationImpacts;
		this.job.narrativeConsequence = this.narrativeConsequence || undefined;
		this.job.hideFromPlayers = this.hideFromPlayers;

		// Validate complete job
		const validationResult = this.validator.validate(this.job);

		if (!validationResult.valid) {
			const errors = validationResult.errors.filter(e => e.severity === 'error');
			new Notice(`Validation failed: ${errors[0].message}`);
			return;
		}

		try {
			await this.plugin.jobFileHandler.saveJob(this.job);

			new Notice(`Job "${this.job.title}" updated successfully`);
			this.close();

			this.plugin.eventBus.emit('JobUpdated', { job: this.job, timestamp: Date.now() });
		} catch (error) {
			console.error('[EditJobModal] Error saving job:', error);
			new Notice(`Failed to save job: ${error.message}`);
		}
	}

	private async deleteJob() {
		const confirmed = confirm(`Are you sure you want to delete the job "${this.job.title}"? This cannot be undone.`);

		if (!confirmed) {
			return;
		}

		try {
			await this.plugin.jobFileHandler.deleteJob(this.job.filePath!);

			new Notice(`Job "${this.job.title}" deleted`);
			this.close();

			this.plugin.eventBus.emit('JobDeleted', {
				jobPath: this.job.filePath!,
				timestamp: Date.now()
			});
		} catch (error) {
			console.error('[EditJobModal] Error deleting job:', error);
			new Notice(`Failed to delete job: ${error.message}`);
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
