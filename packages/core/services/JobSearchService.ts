/**
 * Job search and filtering service
 *
 * Provides search, filter, sort, and grouping operations for jobs
 * Platform-agnostic - pure business logic
 *
 * @module JobSearchService
 * @packageDocumentation
 */

import { Job, JobStatus } from '../models/Job';

/**
 * Search filters for jobs
 */
export interface JobSearchFilters {
	/** Filter by job status (multiple allowed) */
	statuses?: JobStatus[];

	/** Filter by location (multiple allowed) */
	locations?: string[];

	/** Search text (matches title, questgiver, or location) */
	searchText?: string;

	/** Include archived jobs */
	includeArchived?: boolean;

	/** Hide jobs marked as hidden from players */
	hideFromPlayers?: boolean;
}

/**
 * Sort field options
 */
export enum JobSortField {
	/** Sort by job title (alphabetical) */
	Title = 'title',

	/** Sort by post date (newest first) */
	PostDate = 'postDate',

	/** Sort by status */
	Status = 'status',

	/** Sort by location */
	Location = 'location',

	/** Sort by days remaining (expiration/deadline) */
	DaysRemaining = 'daysRemaining'
}

/**
 * Sort direction
 */
export enum SortDirection {
	Ascending = 'asc',
	Descending = 'desc'
}

/**
 * Sort options
 */
export interface JobSortOptions {
	/** Field to sort by */
	field: JobSortField;

	/** Sort direction */
	direction: SortDirection;
}

/**
 * Group field options
 */
export enum JobGroupField {
	/** Group by job status */
	Status = 'status',

	/** Group by location */
	Location = 'location',

	/** No grouping (flat list) */
	None = 'none'
}

/**
 * Grouped jobs result
 */
export interface GroupedJobs {
	/** Group label (status or location name) */
	label: string;

	/** Jobs in this group */
	jobs: Job[];
}

/**
 * Job search service
 *
 * Provides pure functions for searching, filtering, sorting,
 * and grouping job collections
 */
export class JobSearchService {
	/**
	 * Filter jobs based on search criteria
	 *
	 * @param jobs Jobs to filter
	 * @param filters Filter criteria
	 * @returns Filtered jobs
	 */
	filterJobs(jobs: Job[], filters: JobSearchFilters): Job[] {
		let filtered = [...jobs]; // Clone to prevent mutation

		// Filter by archived status
		if (!filters.includeArchived) {
			filtered = filtered.filter(job => !job.archived);
		}

		// Filter by hideFromPlayers flag
		if (filters.hideFromPlayers !== undefined) {
			filtered = filtered.filter(job => job.hideFromPlayers === filters.hideFromPlayers);
		}

		// Filter by status
		if (filters.statuses && filters.statuses.length > 0) {
			filtered = filtered.filter(job => filters.statuses!.includes(job.status));
		}

		// Filter by location
		if (filters.locations && filters.locations.length > 0) {
			filtered = filtered.filter(job => {
				if (!job.location) return false;
				// Normalize for comparison (case-insensitive)
				const jobLocation = this.normalizeString(job.location);
				return filters.locations!.some(loc =>
					this.normalizeString(loc) === jobLocation
				);
			});
		}

		// Filter by search text
		if (filters.searchText && filters.searchText.trim() !== '') {
			const searchLower = this.normalizeString(filters.searchText);
			filtered = filtered.filter(job => {
				const titleMatch = this.normalizeString(job.title).includes(searchLower);
				const questgiverMatch = job.questgiver
					? this.normalizeString(job.questgiver).includes(searchLower)
					: false;
				const locationMatch = job.location
					? this.normalizeString(job.location).includes(searchLower)
					: false;

				return titleMatch || questgiverMatch || locationMatch;
			});
		}

		return filtered;
	}

	/**
	 * Sort jobs based on sort options
	 *
	 * @param jobs Jobs to sort
	 * @param sortOptions Sort criteria
	 * @param currentDay Current calendar day (for DaysRemaining sort)
	 * @returns Sorted jobs
	 */
	sortJobs(jobs: Job[], sortOptions: JobSortOptions, currentDay?: number): Job[] {
		const sorted = [...jobs]; // Clone to prevent mutation

		sorted.sort((a, b) => {
			let comparison = 0;

			switch (sortOptions.field) {
				case JobSortField.Title:
					comparison = a.title.localeCompare(b.title);
					break;

				case JobSortField.PostDate:
					comparison = a.postDate - b.postDate;
					break;

				case JobSortField.Status:
					comparison = this.compareStatus(a.status, b.status);
					break;

				case JobSortField.Location:
					const aLoc = a.location || '';
					const bLoc = b.location || '';
					comparison = aLoc.localeCompare(bLoc);
					break;

				case JobSortField.DaysRemaining:
					if (currentDay !== undefined) {
						comparison = this.compareDaysRemaining(a, b, currentDay);
					}
					break;
			}

			// Apply sort direction
			return sortOptions.direction === SortDirection.Ascending ? comparison : -comparison;
		});

		return sorted;
	}

	/**
	 * Group jobs by specified field
	 *
	 * @param jobs Jobs to group
	 * @param groupBy Field to group by
	 * @returns Grouped jobs
	 */
	groupJobs(jobs: Job[], groupBy: JobGroupField): GroupedJobs[] {
		if (groupBy === JobGroupField.None) {
			return [{ label: 'All Jobs', jobs }];
		}

		const groups = new Map<string, Job[]>();

		for (const job of jobs) {
			let groupKey: string;

			switch (groupBy) {
				case JobGroupField.Status:
					groupKey = job.status;
					break;

				case JobGroupField.Location:
					groupKey = job.location || 'No Location';
					break;

				default:
					groupKey = 'Unknown';
			}

			if (!groups.has(groupKey)) {
				groups.set(groupKey, []);
			}
			groups.get(groupKey)!.push(job);
		}

		// Convert map to array and sort groups
		const result: GroupedJobs[] = Array.from(groups.entries()).map(([label, jobs]) => ({
			label,
			jobs
		}));

		// Sort groups by label
		result.sort((a, b) => {
			if (groupBy === JobGroupField.Status) {
				return this.compareStatus(a.label as JobStatus, b.label as JobStatus);
			}
			return a.label.localeCompare(b.label);
		});

		return result;
	}

	/**
	 * Get unique locations from jobs
	 *
	 * Useful for populating location filter UI
	 *
	 * @param jobs Jobs to extract locations from
	 * @returns Sorted array of unique locations
	 */
	getUniqueLocations(jobs: Job[]): string[] {
		const locations = new Set<string>();

		for (const job of jobs) {
			if (job.location && job.location.trim() !== '') {
				// Extract location name from wikilink if present
				const cleanLocation = this.extractTextFromWikilink(job.location);
				locations.add(cleanLocation);
			}
		}

		return Array.from(locations).sort((a, b) => a.localeCompare(b));
	}

	/**
	 * Get unique questgivers from jobs
	 *
	 * Useful for populating questgiver filter UI (future enhancement)
	 *
	 * @param jobs Jobs to extract questgivers from
	 * @returns Sorted array of unique questgivers
	 */
	getUniqueQuestgivers(jobs: Job[]): string[] {
		const questgivers = new Set<string>();

		for (const job of jobs) {
			if (job.questgiver && job.questgiver.trim() !== '') {
				const cleanQuestgiver = this.extractTextFromWikilink(job.questgiver);
				questgivers.add(cleanQuestgiver);
			}
		}

		return Array.from(questgivers).sort((a, b) => a.localeCompare(b));
	}

	/**
	 * Compare job statuses for sorting
	 *
	 * Defines priority order: Posted > Taken > Expired > Failed > Completed > Cancelled
	 *
	 * @param a First status
	 * @param b Second status
	 * @returns Comparison result (-1, 0, 1)
	 */
	private compareStatus(a: JobStatus, b: JobStatus): number {
		const statusOrder: Record<JobStatus, number> = {
			[JobStatus.Posted]: 0,
			[JobStatus.Taken]: 1,
			[JobStatus.Expired]: 2,
			[JobStatus.Failed]: 3,
			[JobStatus.Completed]: 4,
			[JobStatus.Cancelled]: 5
		};

		return statusOrder[a] - statusOrder[b];
	}

	/**
	 * Compare jobs by days remaining
	 *
	 * Jobs with fewer days remaining come first
	 * Indefinite jobs (null) come last
	 *
	 * @param a First job
	 * @param b Second job
	 * @param currentDay Current calendar day
	 * @returns Comparison result (-1, 0, 1)
	 */
	private compareDaysRemaining(a: Job, b: Job, currentDay: number): number {
		const aDays = this.calculateJobDaysRemaining(a, currentDay);
		const bDays = this.calculateJobDaysRemaining(b, currentDay);

		// Null (indefinite) goes to end
		if (aDays === null && bDays === null) return 0;
		if (aDays === null) return 1;
		if (bDays === null) return -1;

		return aDays - bDays;
	}

	/**
	 * Calculate days remaining for a job
	 *
	 * For Posted jobs: days until availability expires
	 * For Taken jobs: days until completion deadline
	 * For terminal states: null
	 *
	 * @param job Job to calculate
	 * @param currentDay Current calendar day
	 * @returns Days remaining, or null if indefinite/terminal
	 */
	private calculateJobDaysRemaining(job: Job, currentDay: number): number | null {
		if (job.status === JobStatus.Posted) {
			if (job.durationAvailability === 0) return null; // Indefinite
			const expirationDay = job.postDate + job.durationAvailability;
			return expirationDay - currentDay;
		}

		if (job.status === JobStatus.Taken) {
			if (job.durationCompletion === 0) return null; // No deadline
			if (job.takenDate === null) return null;
			const deadlineDay = job.takenDate + job.durationCompletion;
			return deadlineDay - currentDay;
		}

		// Terminal states have no time remaining
		return null;
	}

	/**
	 * Normalize string for case-insensitive comparison
	 *
	 * Also extracts text from Obsidian wikilinks
	 *
	 * @param text Text to normalize
	 * @returns Normalized text
	 */
	private normalizeString(text: string): string {
		const extracted = this.extractTextFromWikilink(text);
		return extracted.toLowerCase().trim();
	}

	/**
	 * Extract display text from Obsidian wikilink
	 *
	 * @param text Text that may contain a wikilink
	 * @returns Clean text without wikilink syntax
	 *
	 * @example
	 * ```ts
	 * extractTextFromWikilink("Waterdeep")
	 * // Returns: "Waterdeep"
	 *
	 * extractTextFromWikilink("[[Locations/Waterdeep]]")
	 * // Returns: "Waterdeep"
	 *
	 * extractTextFromWikilink("[[Locations/The Docks|The Docks]]")
	 * // Returns: "The Docks"
	 * ```
	 */
	private extractTextFromWikilink(text: string): string {
		// Check for Obsidian wikilink format: [[path/to/file|display]] or [[path/to/file]]
		const wikilinkMatch = text.match(/\[\[(?:([^\]|]+)\|)?([^\]]+)\]\]/);
		if (wikilinkMatch) {
			// If there's a display name (with |), use it, otherwise use the path
			const displayName = wikilinkMatch[2];
			const pathName = wikilinkMatch[1] || displayName;

			// If using the path, extract just the file name (last part after /)
			if (displayName === pathName || !wikilinkMatch[1]) {
				const parts = displayName.split('/');
				return parts[parts.length - 1];
			}

			return displayName;
		}

		return text;
	}
}
