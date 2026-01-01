/**
 * Player-Facing Job Data Model
 *
 * Represents job information visible to players.
 * Excludes GM-only metadata like hideFromPlayers, archived, narrativeConsequence.
 *
 * @module PlayerJob
 */

import type { JobStatus, JobRewardItem, JobReputationImpact } from './Job';

/**
 * Player-visible job data
 *
 * This is a subset of the full Job model that excludes:
 * - hideFromPlayers (GM metadata)
 * - archived (GM metadata)
 * - narrativeConsequence (GM-only spoiler information)
 * - filePath (internal identifier)
 */
export interface PlayerJob {
	/**
	 * Job title (required)
	 */
	title: string;

	/**
	 * Location where job takes place
	 * Optional wikilink: [[Location Name]] or [[Location Name|Display Text]]
	 */
	location?: string;

	/**
	 * NPC offering the job
	 * Optional wikilink: [[NPC Name]] or [[NPC Name|Display Text]]
	 */
	questgiver?: string;

	/**
	 * Requirements to take the job (free text)
	 * Example: "Level 5+, Good reputation with City Watch"
	 */
	prerequisites?: string;

	/**
	 * Current job status
	 */
	status: JobStatus;

	/**
	 * Calendar day when job was posted
	 */
	postDate: number;

	/**
	 * Calendar day when job was taken by party (null if not taken yet)
	 */
	takenDate: number | null;

	/**
	 * Days job remains available after posting
	 * 0 = "No Limit" (job never expires from availability)
	 */
	durationAvailability: number;

	/**
	 * Days allowed to complete job after taking it
	 * 0 = "No Limit" (no deadline)
	 */
	durationCompletion: number;

	/**
	 * Fund reward in gold pieces (minimum 0, no negatives)
	 */
	rewardFunds: number;

	/**
	 * XP reward (minimum 0, no negatives)
	 */
	rewardXP: number;

	/**
	 * Item rewards with quantities
	 * Items can be wikilinks: [[Item Name]]
	 */
	rewardItems: JobRewardItem[];

	/**
	 * Reputation changes with factions/locations
	 * Conditional based on job outcome (success, failure, expiration)
	 *
	 * Note: Including this in player view is configurable.
	 * Some GMs may want to hide reputation mechanics from players.
	 */
	reputationImpacts: JobReputationImpact[];
}

/**
 * Configuration for what job data to expose to players
 */
export interface PlayerJobViewConfig {
	/**
	 * Whether to show reputation impacts to players
	 * Default: true (show reputation mechanics)
	 */
	showReputationImpacts: boolean;

	/**
	 * Whether to show prerequisite requirements
	 * Default: true
	 */
	showPrerequisites: boolean;

	/**
	 * Whether to show exact time remaining
	 * If false, shows generic urgency (e.g., "Urgent", "Soon", "Plenty of time")
	 * Default: true (show exact days)
	 */
	showExactTimeRemaining: boolean;
}

/**
 * Default player view configuration
 */
export const DEFAULT_PLAYER_VIEW_CONFIG: PlayerJobViewConfig = {
	showReputationImpacts: true,
	showPrerequisites: true,
	showExactTimeRemaining: true
};
