/**
 * Player Job Board Exporter
 *
 * Generates markdown exports of player-visible job boards
 * for sharing with players or external viewing
 *
 * @module PlayerJobBoardExporter
 */

import type { Job } from '../models/Job';
import type { PlayerJob, PlayerJobViewConfig } from '../models/PlayerJob';
import { PlayerJobViewService, PlayerJobFilterOptions } from './PlayerJobViewService';

export interface ExportOptions {
	/** Title for the exported document */
	title?: string;

	/** Whether to group jobs by status */
	groupByStatus?: boolean;

	/** Whether to group jobs by location */
	groupByLocation?: boolean;

	/** Whether to include expiration warnings */
	showExpirationWarnings?: boolean;

	/** Current calendar day for calculating time remaining */
	currentDay?: number;
}

/**
 * Service for exporting player job board to markdown
 */
export class PlayerJobBoardExporter {
	private playerViewService: PlayerJobViewService;

	constructor(config?: Partial<PlayerJobViewConfig>) {
		this.playerViewService = new PlayerJobViewService(config);
	}

	/**
	 * Exports player-visible jobs to markdown format
	 *
	 * @param jobs - All jobs
	 * @param options - Export configuration
	 * @returns Markdown string
	 */
	exportToMarkdown(
		jobs: Job[],
		options: ExportOptions = {}
	): string {
		const {
			title = 'Job Board',
			groupByStatus = true,
			groupByLocation = false,
			showExpirationWarnings = true,
			currentDay = 0
		} = options;

		const playerJobs = this.playerViewService.getPlayerJobs(jobs);

		let markdown = `# ${title}\n\n`;
		markdown += `_Last Updated: ${new Date().toLocaleDateString()}_\n\n`;

		if (playerJobs.length === 0) {
			markdown += '**No jobs currently available**\n';
			return markdown;
		}

		if (groupByStatus) {
			markdown += this.exportGroupedByStatus(playerJobs, currentDay, showExpirationWarnings);
		} else if (groupByLocation) {
			markdown += this.exportGroupedByLocation(playerJobs, currentDay, showExpirationWarnings);
		} else {
			markdown += this.exportFlat(playerJobs, currentDay, showExpirationWarnings);
		}

		return markdown;
	}

	/**
	 * Exports jobs grouped by status
	 */
	private exportGroupedByStatus(
		jobs: PlayerJob[],
		currentDay: number,
		showWarnings: boolean
	): string {
		let markdown = '';

		// Group by status
		const posted = jobs.filter(j => j.status === 'Posted');
		const taken = jobs.filter(j => j.status === 'Taken');

		if (posted.length > 0) {
			markdown += `## 📋 Available Jobs (${posted.length})\n\n`;
			posted.forEach(job => {
				markdown += this.formatJobCard(job, currentDay, showWarnings);
			});
		}

		if (taken.length > 0) {
			markdown += `## ⏳ In Progress (${taken.length})\n\n`;
			taken.forEach(job => {
				markdown += this.formatJobCard(job, currentDay, showWarnings);
			});
		}

		return markdown;
	}

	/**
	 * Exports jobs grouped by location
	 */
	private exportGroupedByLocation(
		jobs: PlayerJob[],
		currentDay: number,
		showWarnings: boolean
	): string {
		let markdown = '';

		// Group by location
		const locationGroups = new Map<string, PlayerJob[]>();

		jobs.forEach(job => {
			const location = job.location || 'No Location';
			if (!locationGroups.has(location)) {
				locationGroups.set(location, []);
			}
			locationGroups.get(location)!.push(job);
		});

		// Sort locations alphabetically
		const sortedLocations = Array.from(locationGroups.keys()).sort();

		sortedLocations.forEach(location => {
			const locationJobs = locationGroups.get(location)!;
			markdown += `## 📍 ${location} (${locationJobs.length})\n\n`;
			locationJobs.forEach(job => {
				markdown += this.formatJobCard(job, currentDay, showWarnings);
			});
		});

		return markdown;
	}

	/**
	 * Exports jobs in flat list
	 */
	private exportFlat(
		jobs: PlayerJob[],
		currentDay: number,
		showWarnings: boolean
	): string {
		let markdown = '## All Jobs\n\n';
		jobs.forEach(job => {
			markdown += this.formatJobCard(job, currentDay, showWarnings);
		});
		return markdown;
	}

	/**
	 * Formats a single job as a markdown card
	 */
	private formatJobCard(
		job: PlayerJob,
		currentDay: number,
		showWarnings: boolean
	): string {
		let card = `### ${job.title}\n\n`;

		// Status badge
		const statusEmoji = job.status === 'Posted' ? '📋' : '⏳';
		card += `**Status:** ${statusEmoji} ${job.status}\n`;

		// Location
		if (job.location) {
			card += `**Location:** ${job.location}\n`;
		}

		// Questgiver
		if (job.questgiver) {
			card += `**Questgiver:** ${job.questgiver}\n`;
		}

		// Prerequisites
		if (job.prerequisites) {
			card += `**Prerequisites:** ${job.prerequisites}\n`;
		}

		// Rewards section
		card += `\n**Rewards:**\n`;
		if (job.rewardFunds > 0) {
			card += `- 💰 ${job.rewardFunds} gp\n`;
		}
		if (job.rewardXP > 0) {
			card += `- ⭐ ${job.rewardXP} XP\n`;
		}
		if (job.rewardItems.length > 0) {
			job.rewardItems.forEach(item => {
				card += `- 📦 ${item.item} (x${item.quantity})\n`;
			});
		}
		if (job.rewardFunds === 0 && job.rewardXP === 0 && job.rewardItems.length === 0) {
			card += `- _No monetary rewards listed_\n`;
		}

		// Time constraints
		if (showWarnings && currentDay > 0) {
			const warnings = this.getTimeWarnings(job, currentDay);
			if (warnings.length > 0) {
				card += `\n⚠️ **${warnings.join(' | ')}**\n`;
			}
		}

		// Reputation impacts (if enabled)
		if (job.reputationImpacts.length > 0) {
			card += `\n**Reputation Effects:**\n`;
			job.reputationImpacts.forEach(impact => {
				const sign = impact.value >= 0 ? '+' : '';
				card += `- ${impact.targetEntity} (${impact.targetType}): ${sign}${impact.value} renown on ${impact.condition}\n`;
			});
		}

		card += '\n---\n\n';
		return card;
	}

	/**
	 * Gets time-based warnings for a job
	 */
	private getTimeWarnings(job: PlayerJob, currentDay: number): string[] {
		const warnings: string[] = [];

		// Availability warning
		if (job.status === 'Posted' && job.durationAvailability > 0) {
			const expiresOn = job.postDate + job.durationAvailability;
			const daysLeft = expiresOn - currentDay;

			if (daysLeft <= 0) {
				warnings.push('Expired');
			} else if (daysLeft <= 2) {
				warnings.push(`Expires in ${daysLeft} day(s)`);
			}
		}

		// Completion deadline warning
		if (job.status === 'Taken' && job.takenDate !== null && job.durationCompletion > 0) {
			const deadline = job.takenDate + job.durationCompletion;
			const daysLeft = deadline - currentDay;

			if (daysLeft <= 0) {
				warnings.push('Deadline passed');
			} else if (daysLeft <= 3) {
				warnings.push(`${daysLeft} day(s) to complete`);
			}
		}

		return warnings;
	}
}
