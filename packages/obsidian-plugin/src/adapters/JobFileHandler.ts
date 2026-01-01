/**
 * Job file handler
 *
 * Handles job file operations (save, load, update, list)
 * Implements IJobDataAccess interface for Obsidian
 *
 * @module JobFileHandler
 * @packageDocumentation
 */

import { App, TFile, TFolder } from 'obsidian';
import * as yaml from 'js-yaml';
import { Job, JobStatus, createNewJob } from '@quartermaster/core/models/Job';
import { IJobDataAccess } from '@quartermaster/core/interfaces/IJobDataAccess';
import { JobStatusChangeReason } from '@quartermaster/core/models/events/JobEvents';
import { generateUniqueJobFilename } from '@quartermaster/core/utils/jobSlugGenerator';

/**
 * Job file handler
 *
 * Implements IJobDataAccess for Obsidian vault file I/O
 */
export class JobFileHandler implements IJobDataAccess {
	constructor(
		private app: App,
		private jobsFolderPath: string
	) {}

	/**
	 * Get all jobs from the jobs folder
	 *
	 * @param includeArchived Whether to include archived jobs
	 * @returns Array of all jobs
	 */
	async getAllJobs(includeArchived: boolean = false): Promise<Job[]> {
		const jobPaths = await this.getJobFilenames();
		const jobs: Job[] = [];

		for (const path of jobPaths) {
			try {
				const job = await this.getJob(path);
				if (job) {
					// Filter by archived status if requested
					if (!includeArchived && job.archived) {
						continue;
					}
					jobs.push(job);
				}
			} catch (error) {
				console.error(`[JobFileHandler] Error loading job from ${path}:`, error);
				// Continue loading other jobs
			}
		}

		return jobs;
	}

	/**
	 * Get a single job by file path
	 *
	 * @param jobPath Job file path (relative to vault root)
	 * @returns Job object, or null if not found
	 */
	async getJob(jobPath: string): Promise<Job | null> {
		const file = this.app.vault.getAbstractFileByPath(jobPath);
		if (!file || !(file instanceof TFile)) {
			return null;
		}

		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache?.frontmatter) {
			console.warn(`[JobFileHandler] Job file ${jobPath} has no frontmatter`);
			return null;
		}

		const fm = cache.frontmatter;

		// Build Job object from frontmatter
		const job: Job = {
			title: fm.title || '',
			location: fm.location,
			questgiver: fm.questgiver,
			prerequisites: fm.prerequisites,
			status: fm.status || JobStatus.Posted,
			postDate: fm.postDate || 0,
			takenDate: fm.takenDate ?? null,
			durationAvailability: fm.durationAvailability ?? 0,
			durationCompletion: fm.durationCompletion ?? 0,
			rewardFunds: fm.rewardGold || 0,
			rewardXP: fm.rewardXP || 0,
			rewardItems: fm.rewardItems || [],
			reputationImpacts: fm.reputationImpacts || [],
			narrativeConsequence: fm.narrativeConsequence,
			hideFromPlayers: fm.hideFromPlayers || false,
			archived: fm.archived || false,
			filePath: jobPath
		};

		return job;
	}

	/**
	 * Save a new or updated job to file
	 *
	 * @param job Job to save
	 */
	async saveJob(job: Job): Promise<void> {
		const content = this.generateJobMarkdown(job);

		// Ensure jobs folder exists
		await this.ensureFolder(this.jobsFolderPath);

		if (job.filePath) {
			// Update existing job
			const file = this.app.vault.getAbstractFileByPath(job.filePath);
			if (file && file instanceof TFile) {
				await this.app.vault.modify(file, content);
				return;
			}
		}

		// Create new job
		// Generate filename from title
		const existingFilenames = await this.getJobFilenames();
		const baseNames = existingFilenames.map(path => {
			const parts = path.split('/');
			return parts[parts.length - 1]; // Just the filename
		});

		const filename = generateUniqueJobFilename(job.title, baseNames);
		const fullPath = this.jobsFolderPath.endsWith('/')
			? `${this.jobsFolderPath}${filename}`
			: `${this.jobsFolderPath}/${filename}`;

		await this.app.vault.create(fullPath, content);

		// Update job with its file path
		job.filePath = fullPath;
	}

	/**
	 * Update job status
	 *
	 * @param jobPath Job file path
	 * @param newStatus New status to set
	 * @param reason Reason for status change
	 */
	async updateJobStatus(
		jobPath: string,
		newStatus: JobStatus,
		reason: JobStatusChangeReason
	): Promise<void> {
		const job = await this.getJob(jobPath);
		if (!job) {
			throw new Error(`Job not found: ${jobPath}`);
		}

		// Update status
		job.status = newStatus;

		// Update takenDate if transitioning to Taken
		if (newStatus === JobStatus.Taken && !job.takenDate) {
			// Note: This requires access to current calendar day
			// For now, mark as null - caller should set takenDate before calling this
			// Or we could inject CalendarService here
		}

		// Save updated job
		await this.saveJob(job);
	}

	/**
	 * Delete a job file (hard delete)
	 *
	 * @param jobPath Job file path
	 */
	async deleteJob(jobPath: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(jobPath);
		if (!file || !(file instanceof TFile)) {
			throw new Error(`Job file not found: ${jobPath}`);
		}

		await this.app.vault.delete(file);
	}

	/**
	 * Archive a job (soft delete)
	 *
	 * Sets archived flag to true
	 *
	 * @param jobPath Job file path
	 */
	async archiveJob(jobPath: string): Promise<void> {
		const job = await this.getJob(jobPath);
		if (!job) {
			throw new Error(`Job not found: ${jobPath}`);
		}

		job.archived = true;
		await this.saveJob(job);
	}

	/**
	 * Get list of all job filenames
	 *
	 * @returns Array of job file paths
	 */
	async getJobFilenames(): Promise<string[]> {
		const folder = this.app.vault.getAbstractFileByPath(this.jobsFolderPath);
		if (!folder) {
			return [];
		}

		const files = this.app.vault.getMarkdownFiles()
			.filter(f => f.path.startsWith(this.jobsFolderPath))
			.map(f => f.path);

		return files;
	}

	/**
	 * Generate job markdown file content
	 *
	 * Format:
	 * ```
	 * ---
	 * title: Job Title
	 * status: Posted
	 * ...
	 * ---
	 *
	 * # Job Title
	 *
	 * **Status:** Posted
	 * **Location:** Waterdeep
	 * ...
	 * ```
	 *
	 * @param job Job to convert to markdown
	 * @returns Markdown file content
	 */
	private generateJobMarkdown(job: Job): string {
		// Build frontmatter object
		const frontmatter: Record<string, any> = {
			title: job.title,
			status: job.status,
			postDate: job.postDate,
			takenDate: job.takenDate,
			durationAvailability: job.durationAvailability,
			durationCompletion: job.durationCompletion,
			rewardGold: job.rewardFunds,
			rewardXP: job.rewardXP,
			rewardItems: job.rewardItems,
			reputationImpacts: job.reputationImpacts,
			hideFromPlayers: job.hideFromPlayers,
			archived: job.archived
		};

		// Add optional fields only if they have values
		if (job.location) frontmatter.location = job.location;
		if (job.questgiver) frontmatter.questgiver = job.questgiver;
		if (job.prerequisites) frontmatter.prerequisites = job.prerequisites;
		if (job.narrativeConsequence) frontmatter.narrativeConsequence = job.narrativeConsequence;

		// Generate YAML frontmatter
		const frontmatterYAML = yaml.dump(frontmatter, {
			indent: 2,
			lineWidth: -1, // Don't wrap long lines
			noRefs: true // Don't use YAML anchors/references
		});

		// Build markdown body
		let body = `# ${job.title}\n\n`;

		// Status section
		body += `**Status:** ${job.status}\n`;
		if (job.location) {
			body += `**Location:** ${job.location}\n`;
		}
		if (job.questgiver) {
			body += `**Questgiver:** ${job.questgiver}\n`;
		}
		body += '\n';

		// Prerequisites
		if (job.prerequisites && job.prerequisites.trim() !== '') {
			body += `## Prerequisites\n\n`;
			body += `${job.prerequisites}\n\n`;
		}

		// Rewards section
		body += `## Rewards\n\n`;
		if (job.rewardFunds > 0) {
			body += `- **Gold:** ${job.rewardFunds} gp\n`;
		}
		if (job.rewardXP > 0) {
			body += `- **XP:** ${job.rewardXP}\n`;
		}
		if (job.rewardItems.length > 0) {
			body += `- **Items:**\n`;
			for (const item of job.rewardItems) {
				body += `  - ${item.item} (x${item.quantity})\n`;
			}
		}
		body += '\n';

		// Reputation impacts
		if (job.reputationImpacts.length > 0) {
			body += `## Reputation Impacts\n\n`;
			for (const impact of job.reputationImpacts) {
				const sign = impact.value >= 0 ? '+' : '';
				body += `- **${impact.targetEntity}** (${impact.targetType}): ${sign}${impact.value} ${impact.condition}\n`;
			}
			body += '\n';
		}

		// Narrative consequence
		if (job.narrativeConsequence && job.narrativeConsequence.trim() !== '') {
			body += `## Narrative Consequence\n\n`;
			body += `${job.narrativeConsequence}\n\n`;
		}

		// Time constraints
		body += `## Time Constraints\n\n`;
		body += `- **Posted:** Day ${job.postDate}\n`;
		if (job.takenDate !== null) {
			body += `- **Taken:** Day ${job.takenDate}\n`;
		}
		if (job.durationAvailability > 0) {
			body += `- **Availability:** ${job.durationAvailability} days\n`;
		} else {
			body += `- **Availability:** No Limit\n`;
		}
		if (job.durationCompletion > 0) {
			body += `- **Completion Deadline:** ${job.durationCompletion} days after taken\n`;
		} else {
			body += `- **Completion Deadline:** No Limit\n`;
		}
		body += '\n';

		// Quest description section (placeholder for GM notes)
		body += `## Description\n\n`;
		body += `<!-- Add quest description and GM notes here -->\n\n`;

		// Combine frontmatter and body
		return `---\n${frontmatterYAML}---\n\n${body}`;
	}

	/**
	 * Ensure folder exists, create if not
	 *
	 * @param path Folder path
	 */
	private async ensureFolder(path: string): Promise<void> {
		const folder = this.app.vault.getAbstractFileByPath(path);
		if (!folder) {
			await this.app.vault.createFolder(path);
		}
	}
}
