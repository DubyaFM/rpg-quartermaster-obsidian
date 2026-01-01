/**
 * Job Board Modal
 *
 * Main job board view with filtering, sorting, and job management
 * Displays list of jobs with status, location, and time remaining
 *
 * @module JobBoardModal
 */

import { Modal, App, Setting, Notice } from 'obsidian';
import { Job, JobStatus } from '@quartermaster/core/models/Job';
import { JobSearchService, JobSearchFilters, JobSortField, SortDirection, JobGroupField } from '@quartermaster/core/services/JobSearchService';
import { JobExpirationService } from '@quartermaster/core/services/JobExpirationService';
import type QuartermasterPlugin from '../main';
import { CreateJobModal } from './CreateJobModal';
import { EditJobModal } from './EditJobModal';
import { JobDetailsModal } from './JobDetailsModal';

export class JobBoardModal extends Modal {
	plugin: QuartermasterPlugin;
	searchService: JobSearchService;
	expirationService: JobExpirationService;

	// State
	allJobs: Job[] = [];
	filteredJobs: Job[] = [];
	filters: JobSearchFilters = {
		includeArchived: false,
		hideFromPlayers: false
	};
	sortField: JobSortField = JobSortField.PostDate;
	sortDirection: SortDirection = SortDirection.Descending;
	groupBy: JobGroupField = JobGroupField.Status;

	// UI containers
	filterContainer?: HTMLElement;
	jobsListContainer?: HTMLElement;

	constructor(app: App, plugin: QuartermasterPlugin) {
		super(app);
		this.plugin = plugin;
		this.searchService = new JobSearchService();
		this.expirationService = new JobExpirationService();
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('job-board-modal');

		contentEl.createEl('h2', { text: 'Job Board' });

		// Action buttons at top
		this.renderTopActions(contentEl);

		// Filter controls
		const filterSection = contentEl.createDiv({ cls: 'job-filter-section' });
		this.filterContainer = filterSection;
		this.renderFilters(filterSection);

		// Jobs list
		const jobsSection = contentEl.createDiv({ cls: 'jobs-list-section' });
		this.jobsListContainer = jobsSection;

		// Load and display jobs
		await this.loadJobs();
	}

	private renderTopActions(container: HTMLElement) {
		const actionsDiv = container.createDiv({ cls: 'job-board-actions' });

		const createBtn = actionsDiv.createEl('button', {
			text: '+ Create New Job',
			cls: 'mod-cta'
		});
		createBtn.onclick = () => {
			new CreateJobModal(this.app, this.plugin).open();
			this.close();
		};

		const refreshBtn = actionsDiv.createEl('button', {
			text: '🔄 Refresh'
		});
		refreshBtn.onclick = async () => {
			await this.loadJobs();
			new Notice('Job board refreshed');
		};
	}

	private renderFilters(container: HTMLElement) {
		container.empty();
		container.createEl('h3', { text: 'Filters' });

		// Status filter (multi-select checkboxes)
		const statusFilterDiv = container.createDiv({ cls: 'filter-group' });
		statusFilterDiv.createEl('h4', { text: 'Status' });

		const statuses = [
			JobStatus.Posted,
			JobStatus.Taken,
			JobStatus.Completed,
			JobStatus.Failed,
			JobStatus.Expired,
			JobStatus.Cancelled
		];

		statuses.forEach(status => {
			new Setting(statusFilterDiv)
				.setName(status)
				.addToggle(toggle => {
					const isSelected = this.filters.statuses?.includes(status) ?? false;
					toggle
						.setValue(isSelected)
						.onChange(value => {
							if (!this.filters.statuses) {
								this.filters.statuses = [];
							}

							if (value) {
								if (!this.filters.statuses.includes(status)) {
									this.filters.statuses.push(status);
								}
							} else {
								this.filters.statuses = this.filters.statuses.filter(s => s !== status);
							}

							this.applyFiltersAndRefresh();
						});
				});
		});

		// Location filter (multi-select checkboxes)
		const locationFilterDiv = container.createDiv({ cls: 'filter-group' });
		locationFilterDiv.createEl('h4', { text: 'Location' });

		const uniqueLocations = this.searchService.getUniqueLocations(this.allJobs);
		if (uniqueLocations.length === 0) {
			locationFilterDiv.createEl('p', {
				text: 'No locations available',
				cls: 'placeholder-text'
			});
		} else {
			uniqueLocations.forEach(location => {
				new Setting(locationFilterDiv)
					.setName(location)
					.addToggle(toggle => {
						const isSelected = this.filters.locations?.includes(location) ?? false;
						toggle
							.setValue(isSelected)
							.onChange(value => {
								if (!this.filters.locations) {
									this.filters.locations = [];
								}

								if (value) {
									if (!this.filters.locations.includes(location)) {
										this.filters.locations.push(location);
									}
								} else {
									this.filters.locations = this.filters.locations.filter(l => l !== location);
								}

								this.applyFiltersAndRefresh();
							});
					});
			});
		}

		// Search text
		new Setting(container)
			.setName('Search')
			.setDesc('Search by title, questgiver, or location')
			.addText(text => text
				.setPlaceholder('Search...')
				.setValue(this.filters.searchText || '')
				.onChange(value => {
					this.filters.searchText = value;
					this.applyFiltersAndRefresh();
				}));

		// Include archived toggle
		new Setting(container)
			.setName('Include Archived')
			.addToggle(toggle => toggle
				.setValue(this.filters.includeArchived || false)
				.onChange(value => {
					this.filters.includeArchived = value;
					this.applyFiltersAndRefresh();
				}));

		// Sort options
		const sortDiv = container.createDiv({ cls: 'filter-group' });
		sortDiv.createEl('h4', { text: 'Sort' });

		new Setting(sortDiv)
			.setName('Sort By')
			.addDropdown(dropdown => dropdown
				.addOption(JobSortField.PostDate, 'Post Date')
				.addOption(JobSortField.Title, 'Title')
				.addOption(JobSortField.Status, 'Status')
				.addOption(JobSortField.Location, 'Location')
				.addOption(JobSortField.DaysRemaining, 'Days Remaining')
				.setValue(this.sortField)
				.onChange(value => {
					this.sortField = value as JobSortField;
					this.applyFiltersAndRefresh();
				}));

		new Setting(sortDiv)
			.setName('Direction')
			.addDropdown(dropdown => dropdown
				.addOption(SortDirection.Ascending, 'Ascending')
				.addOption(SortDirection.Descending, 'Descending')
				.setValue(this.sortDirection)
				.onChange(value => {
					this.sortDirection = value as SortDirection;
					this.applyFiltersAndRefresh();
				}));

		// Group by
		new Setting(container)
			.setName('Group By')
			.addDropdown(dropdown => dropdown
				.addOption(JobGroupField.None, 'None')
				.addOption(JobGroupField.Status, 'Status')
				.addOption(JobGroupField.Location, 'Location')
				.setValue(this.groupBy)
				.onChange(value => {
					this.groupBy = value as JobGroupField;
					this.applyFiltersAndRefresh();
				}));

		// Clear filters button
		const clearBtn = container.createEl('button', {
			text: 'Clear Filters'
		});
		clearBtn.onclick = () => {
			this.filters = {
				includeArchived: false,
				hideFromPlayers: false
			};
			this.renderFilters(container);
			this.applyFiltersAndRefresh();
		};
	}

	private async loadJobs() {
		try {
			this.allJobs = await this.plugin.jobFileHandler.getAllJobs(true);
			this.applyFiltersAndRefresh();
		} catch (error) {
			console.error('[JobBoardModal] Error loading jobs:', error);
			new Notice('Failed to load jobs');
		}
	}

	private applyFiltersAndRefresh() {
		// Apply filters
		let filtered = this.searchService.filterJobs(this.allJobs, this.filters);

		// Apply sort
		const currentDay = this.plugin.settings.calendarState?.currentDay || 0;
		filtered = this.searchService.sortJobs(filtered, {
			field: this.sortField,
			direction: this.sortDirection
		}, currentDay);

		this.filteredJobs = filtered;

		// Refresh display
		if (this.jobsListContainer) {
			this.renderJobsList(this.jobsListContainer);
		}
	}

	private renderJobsList(container: HTMLElement) {
		container.empty();

		if (this.filteredJobs.length === 0) {
			container.createEl('p', {
				text: 'No jobs found matching filters',
				cls: 'placeholder-text'
			});
			return;
		}

		// Group jobs if needed
		const grouped = this.searchService.groupJobs(this.filteredJobs, this.groupBy);

		grouped.forEach(group => {
			const groupSection = container.createDiv({ cls: 'job-group' });

			if (this.groupBy !== JobGroupField.None) {
				groupSection.createEl('h3', { text: group.label });
			}

			const jobsGrid = groupSection.createDiv({ cls: 'jobs-grid' });

			group.jobs.forEach(job => {
				this.renderJobCard(jobsGrid, job);
			});
		});
	}

	private renderJobCard(container: HTMLElement, job: Job) {
		const card = container.createDiv({ cls: `job-card job-status-${job.status.toLowerCase()}` });

		// Header
		const header = card.createDiv({ cls: 'job-card-header' });
		header.createEl('h4', { text: job.title });

		const statusBadge = header.createEl('span', {
			text: job.status,
			cls: `job-status-badge status-${job.status.toLowerCase()}`
		});

		// Info
		const info = card.createDiv({ cls: 'job-card-info' });

		if (job.location) {
			info.createEl('p', { text: `📍 ${job.location}` });
		}

		if (job.questgiver) {
			info.createEl('p', { text: `👤 ${job.questgiver}` });
		}

		// Time info
		const currentDay = this.plugin.settings.calendarState?.currentDay || 0;
		const daysRemaining = this.expirationService.calculateDaysRemaining(job, currentDay);
		if (daysRemaining !== null) {
			const timeText = this.expirationService.formatDaysRemaining(daysRemaining);
			const timeClass = daysRemaining < 0 ? 'time-overdue' :
				daysRemaining === 0 ? 'time-urgent' :
					daysRemaining <= 3 ? 'time-warning' : 'time-normal';

			info.createEl('p', {
				text: `⏰ ${timeText}`,
				cls: timeClass
			});
		}

		// Rewards summary
		const rewardsDiv = card.createDiv({ cls: 'job-card-rewards' });
		if (job.rewardFunds > 0) {
			rewardsDiv.createEl('span', { text: `💰 ${job.rewardFunds} gp` });
		}
		if (job.rewardXP > 0) {
			rewardsDiv.createEl('span', { text: `⭐ ${job.rewardXP} XP` });
		}
		if (job.rewardItems.length > 0) {
			rewardsDiv.createEl('span', { text: `📦 ${job.rewardItems.length} items` });
		}

		// Flags
		const flagsDiv = card.createDiv({ cls: 'job-card-flags' });
		if (job.hideFromPlayers) {
			flagsDiv.createEl('span', { text: '🔒 Hidden', cls: 'job-flag' });
		}
		if (job.archived) {
			flagsDiv.createEl('span', { text: '📁 Archived', cls: 'job-flag' });
		}

		// Actions
		const actions = card.createDiv({ cls: 'job-card-actions' });

		const viewBtn = actions.createEl('button', {
			text: 'View',
			cls: 'mod-cta'
		});
		viewBtn.onclick = () => {
			new JobDetailsModal(this.app, this.plugin, job).open();
			this.close();
		};

		const editBtn = actions.createEl('button', {
			text: 'Edit'
		});
		editBtn.onclick = () => {
			new EditJobModal(this.app, this.plugin, job).open();
			this.close();
		};

		// Quick actions based on status
		if (job.status === JobStatus.Posted) {
			const takeBtn = actions.createEl('button', {
				text: 'Take Job'
			});
			takeBtn.onclick = async () => {
				await this.takeJob(job);
			};
		}

		if (job.status === JobStatus.Taken) {
			const completeBtn = actions.createEl('button', {
				text: 'Complete'
			});
			completeBtn.onclick = async () => {
				await this.completeJob(job);
			};

			const failBtn = actions.createEl('button', {
				text: 'Fail',
				cls: 'mod-warning'
			});
			failBtn.onclick = async () => {
				await this.failJob(job);
			};
		}

		if ([JobStatus.Completed, JobStatus.Failed, JobStatus.Expired].includes(job.status)) {
			const archiveBtn = actions.createEl('button', {
				text: job.archived ? 'Unarchive' : 'Archive'
			});
			archiveBtn.onclick = async () => {
				await this.toggleArchive(job);
			};
		}
	}

	private async takeJob(job: Job) {
		try {
			const currentDay = this.plugin.settings.calendarState?.currentDay || 0;
			job.status = JobStatus.Taken;
			job.takenDate = currentDay;

			await this.plugin.jobFileHandler.saveJob(job);

			new Notice(`Job "${job.title}" marked as Taken`);
			await this.loadJobs();

			this.plugin.eventBus.emit('JobUpdated', { job, timestamp: Date.now() });
		} catch (error) {
			console.error('[JobBoardModal] Error taking job:', error);
			new Notice('Failed to take job');
		}
	}

	private async completeJob(job: Job) {
		try {
			job.status = JobStatus.Completed;

			await this.plugin.jobFileHandler.saveJob(job);

			new Notice(`Job "${job.title}" marked as Completed`);
			await this.loadJobs();

			this.plugin.eventBus.emit('JobStatusChanged', {
				jobPath: job.filePath!,
				previousStatus: JobStatus.Taken,
				newStatus: JobStatus.Completed,
				job,
				timestamp: Date.now(),
				reason: 'Manual'
			});
		} catch (error) {
			console.error('[JobBoardModal] Error completing job:', error);
			new Notice('Failed to complete job');
		}
	}

	private async failJob(job: Job) {
		try {
			job.status = JobStatus.Failed;

			await this.plugin.jobFileHandler.saveJob(job);

			new Notice(`Job "${job.title}" marked as Failed`);
			await this.loadJobs();

			this.plugin.eventBus.emit('JobStatusChanged', {
				jobPath: job.filePath!,
				previousStatus: JobStatus.Taken,
				newStatus: JobStatus.Failed,
				job,
				timestamp: Date.now(),
				reason: 'Manual'
			});
		} catch (error) {
			console.error('[JobBoardModal] Error failing job:', error);
			new Notice('Failed to mark job as failed');
		}
	}

	private async toggleArchive(job: Job) {
		try {
			job.archived = !job.archived;

			await this.plugin.jobFileHandler.saveJob(job);

			new Notice(`Job "${job.title}" ${job.archived ? 'archived' : 'unarchived'}`);
			await this.loadJobs();
		} catch (error) {
			console.error('[JobBoardModal] Error toggling archive:', error);
			new Notice('Failed to toggle archive status');
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
