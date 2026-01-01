/**
 * Create Job Modal
 *
 * Modal for creating new jobs/quests
 * Implements single scrolling form with all job fields
 *
 * @module CreateJobModal
 */

import { Modal, App, Setting, Notice, TextComponent } from 'obsidian';
import { Job, JobStatus, createNewJob, JobRewardItem, JobReputationImpact, ReputationTargetType, ReputationCondition } from '@quartermaster/core/models/Job';
import { JobValidator } from '@quartermaster/core/services/JobValidator';
import type QuartermasterPlugin from '../main';
import { ReputationTargetSuggest } from './suggest/ReputationTargetSuggest';

export class CreateJobModal extends Modal {
	plugin: QuartermasterPlugin;
	validator: JobValidator;
	allJobs: Job[] = [];
	reputationSuggests: Map<number, ReputationTargetSuggest> = new Map();

	// Job fields
	title: string = '';
	location: string = '';
	questgiver: string = '';
	prerequisites: string = '';
	durationAvailability: number = 0;
	durationCompletion: number = 0;
	rewardGold: number = 0;
	rewardXP: number = 0;
	rewardItems: JobRewardItem[] = [];
	reputationImpacts: JobReputationImpact[] = [];
	narrativeConsequence: string = '';
	hideFromPlayers: boolean = false;

	constructor(app: App, plugin: QuartermasterPlugin) {
		super(app);
		this.plugin = plugin;
		this.validator = new JobValidator();
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('job-create-modal');

		contentEl.createEl('h2', { text: 'Create New Job' });

		// Load all jobs for auto-suggest
		try {
			this.allJobs = await this.plugin.jobFileHandler.getAllJobs();
		} catch (error) {
			console.error('Failed to load jobs for auto-suggest:', error);
			this.allJobs = [];
		}

		// Basic Information Section
		this.renderBasicInfoSection(contentEl);

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
					.setPlaceholder('Must have completed "Save the Village"\nMust have [[Items/Magic Items/Ring of Protection]]')
					.setValue(this.prerequisites)
					.onChange(value => this.prerequisites = value);
				text.inputEl.rows = 3;
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

		section.createEl('p', {
			text: '💡 Duration 0 means "No Limit" - the job will never expire/have no deadline',
			cls: 'setting-item-description'
		});
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
		section.createEl('p', {
			text: 'Reputation changes that occur based on job outcome',
			cls: 'setting-item-description'
		});

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

		const createBtn = buttonContainer.createEl('button', {
			text: 'Create Job',
			cls: 'mod-cta'
		});
		createBtn.onclick = async () => {
			await this.createJob();
		};

		const cancelBtn = buttonContainer.createEl('button', {
			text: 'Cancel'
		});
		cancelBtn.onclick = () => {
			this.close();
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

	private async createJob() {
		// Validate required fields
		if (!this.title || this.title.trim() === '') {
			new Notice('Job title is required');
			return;
		}

		// Get current calendar day from plugin
		const currentDay = this.plugin.settings.calendarState?.currentDay || 0;

		// Create job object
		const job = createNewJob(this.title, currentDay, {
			location: this.location || undefined,
			questgiver: this.questgiver || undefined,
			prerequisites: this.prerequisites || undefined,
			status: JobStatus.Posted,
			durationAvailability: this.durationAvailability,
			durationCompletion: this.durationCompletion,
			rewardFunds: this.rewardGold,
			rewardXP: this.rewardXP,
			rewardItems: this.rewardItems,
			reputationImpacts: this.reputationImpacts,
			narrativeConsequence: this.narrativeConsequence || undefined,
			hideFromPlayers: this.hideFromPlayers,
			archived: false
		});

		// Validate complete job
		const validationResult = this.validator.validate(job);

		if (!validationResult.valid) {
			const errors = validationResult.errors.filter(e => e.severity === 'error');
			new Notice(`Validation failed: ${errors[0].message}`);
			return;
		}

		// Show warnings if any
		const warnings = validationResult.errors.filter(e => e.severity === 'warning');
		if (warnings.length > 0) {
			console.warn('[CreateJobModal] Validation warnings:', warnings);
		}

		try {
			// Save job using adapter
			await this.plugin.jobFileHandler.saveJob(job);

			new Notice(`Job "${job.title}" created successfully`);
			this.close();

			// Emit job created event
			this.plugin.eventBus.emit('JobCreated', { job, timestamp: Date.now() });
		} catch (error) {
			console.error('[CreateJobModal] Error creating job:', error);
			new Notice(`Failed to create job: ${error.message}`);
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
