/**
 * Player Job View Service
 *
 * Filters and formats jobs for player-facing views.
 * Excludes GM-only metadata and applies player view configuration.
 *
 * @module PlayerJobViewService
 */

import type { Job, JobStatus } from '../models/Job';
import type {
	PlayerJob,
	PlayerJobViewConfig
} from '../models/PlayerJob';
import { DEFAULT_PLAYER_VIEW_CONFIG } from '../models/PlayerJob';
import { JobStatus as JobStatusEnum } from '../models/Job';

/**
 * Options for filtering player-visible jobs
 */
export interface PlayerJobFilterOptions {
	/**
	 * Only show jobs with these statuses
	 * Default: [Posted, Taken] (hide completed/failed/expired/cancelled)
	 */
	includeStatuses?: JobStatus[];

	/**
	 * Whether to include jobs the party has taken
	 * Default: true
	 */
	includeTakenJobs?: boolean;

	/**
	 * Whether to include jobs that are still posted
	 * Default: true
	 */
	includePostedJobs?: boolean;

	/**
	 * Filter by location (if specified)
	 * Supports exact match and wikilink comparison
	 */
	location?: string;

	/**
	 * Search query for title, location, or questgiver
	 */
	searchQuery?: string;
}

/**
 * Default filter options for player view
 */
const DEFAULT_FILTER_OPTIONS: PlayerJobFilterOptions = {
	includeStatuses: [JobStatusEnum.Posted, JobStatusEnum.Taken],
	includeTakenJobs: true,
	includePostedJobs: true
};

/**
 * Service for filtering and formatting jobs for player view
 */
export class PlayerJobViewService {
	private config: PlayerJobViewConfig;

	constructor(config: Partial<PlayerJobViewConfig> = {}) {
		this.config = { ...DEFAULT_PLAYER_VIEW_CONFIG, ...config };
	}

	/**
	 * Updates the player view configuration
	 */
	updateConfig(config: Partial<PlayerJobViewConfig>): void {
		this.config = { ...this.config, ...config };
	}

	/**
	 * Filters jobs for player visibility
	 *
	 * Excludes:
	 * - Jobs with hideFromPlayers = true
	 * - Archived jobs
	 * - Jobs not matching filter criteria
	 *
	 * @param jobs - All jobs from the system
	 * @param options - Filter options
	 * @returns Jobs visible to players
	 */
	filterPlayerVisibleJobs(
		jobs: Job[],
		options: PlayerJobFilterOptions = {}
	): Job[] {
		const opts = { ...DEFAULT_FILTER_OPTIONS, ...options };

		return jobs.filter(job => {
			// Exclude GM-hidden jobs
			if (job.hideFromPlayers) {
				return false;
			}

			// Exclude archived jobs
			if (job.archived) {
				return false;
			}

			// Filter by status if specified
			if (opts.includeStatuses && !opts.includeStatuses.includes(job.status)) {
				return false;
			}

			// Filter by taken/posted status
			if (!opts.includeTakenJobs && job.status === JobStatusEnum.Taken) {
				return false;
			}

			if (!opts.includePostedJobs && job.status === JobStatusEnum.Posted) {
				return false;
			}

			// Filter by location if specified
			if (opts.location) {
				if (!job.location) {
					return false;
				}

				const normalizedLocation = this.extractTextFromWikilink(opts.location).toLowerCase();
				const jobLocation = this.extractTextFromWikilink(job.location).toLowerCase();

				if (!jobLocation.includes(normalizedLocation)) {
					return false;
				}
			}

			// Search query filter
			if (opts.searchQuery) {
				const query = opts.searchQuery.toLowerCase();
				const searchableText = [
					job.title,
					job.location ? this.extractTextFromWikilink(job.location) : '',
					job.questgiver ? this.extractTextFromWikilink(job.questgiver) : ''
				].join(' ').toLowerCase();

				if (!searchableText.includes(query)) {
					return false;
				}
			}

			return true;
		});
	}

	/**
	 * Converts a full Job to a player-visible PlayerJob
	 *
	 * Excludes GM-only fields:
	 * - hideFromPlayers
	 * - archived
	 * - narrativeConsequence
	 * - filePath
	 *
	 * Applies configuration settings (e.g., hide reputation impacts if configured)
	 *
	 * @param job - Full job data
	 * @returns Player-visible job data
	 */
	toPlayerJob(job: Job): PlayerJob {
		const playerJob: PlayerJob = {
			title: job.title,
			location: job.location,
			questgiver: job.questgiver,
			prerequisites: this.config.showPrerequisites ? job.prerequisites : undefined,
			status: job.status,
			postDate: job.postDate,
			takenDate: job.takenDate,
			durationAvailability: job.durationAvailability,
			durationCompletion: job.durationCompletion,
			rewardFunds: job.rewardFunds,
			rewardXP: job.rewardXP,
			rewardItems: job.rewardItems,
			reputationImpacts: this.config.showReputationImpacts ? job.reputationImpacts : []
		};

		return playerJob;
	}

	/**
	 * Gets all player-visible jobs as PlayerJob objects
	 *
	 * Convenience method that combines filtering and conversion
	 *
	 * @param jobs - All jobs
	 * @param options - Filter options
	 * @returns Player-visible jobs
	 */
	getPlayerJobs(
		jobs: Job[],
		options: PlayerJobFilterOptions = {}
	): PlayerJob[] {
		const visibleJobs = this.filterPlayerVisibleJobs(jobs, options);
		return visibleJobs.map(job => this.toPlayerJob(job));
	}

	/**
	 * Gets unique locations from player-visible jobs
	 *
	 * Useful for location filter dropdowns in player UI
	 *
	 * @param jobs - All jobs
	 * @returns Unique location strings (with wikilinks extracted)
	 */
	getAvailableLocations(jobs: Job[]): string[] {
		const visibleJobs = this.filterPlayerVisibleJobs(jobs);
		const locations = visibleJobs
			.map(job => job.location)
			.filter((location): location is string => !!location)
			.map(location => this.extractTextFromWikilink(location));

		return Array.from(new Set(locations)).sort();
	}

	/**
	 * Gets count of jobs by status (player-visible only)
	 *
	 * @param jobs - All jobs
	 * @returns Status counts
	 */
	getJobCountsByStatus(jobs: Job[]): Record<JobStatus, number> {
		const visibleJobs = this.filterPlayerVisibleJobs(jobs, {
			includeStatuses: undefined // Include all statuses for counting
		});

		const counts: Record<string, number> = {
			[JobStatusEnum.Posted]: 0,
			[JobStatusEnum.Taken]: 0,
			[JobStatusEnum.Completed]: 0,
			[JobStatusEnum.Failed]: 0,
			[JobStatusEnum.Expired]: 0,
			[JobStatusEnum.Cancelled]: 0
		};

		visibleJobs.forEach(job => {
			counts[job.status] = (counts[job.status] || 0) + 1;
		});

		return counts as Record<JobStatus, number>;
	}

	/**
	 * Extracts page name from wikilink
	 *
	 * [[Page Name]] → "Page Name"
	 * [[Page Name|Display Text]] → "Page Name"
	 * "Plain text" → "Plain text"
	 *
	 * @param text - Text that might contain a wikilink
	 * @returns Extracted page name
	 */
	private extractTextFromWikilink(text: string): string {
		// Match [[Page Name|Display Text]] or [[Page Name]]
		// Group 1 captures the page name (before pipe or before closing ]])
		const wikilinkMatch = text.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
		if (wikilinkMatch) {
			return wikilinkMatch[1];
		}
		return text;
	}
}
