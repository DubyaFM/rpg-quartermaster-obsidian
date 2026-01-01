/**
 * Job/Quest data structures for job board feature
 *
 * @module Job
 * @packageDocumentation
 */

/**
 * Job status enum
 * Represents the lifecycle state of a job
 */
export enum JobStatus {
	/** Job is available for party to take */
	Posted = 'Posted',

	/** Party has accepted the job, working on it */
	Taken = 'Taken',

	/** Job successfully completed */
	Completed = 'Completed',

	/** Party failed to complete the job */
	Failed = 'Failed',

	/** Job availability duration expired before being taken */
	Expired = 'Expired',

	/** Job was manually cancelled by GM */
	Cancelled = 'Cancelled'
}

/**
 * Helper type for status string literals
 */
export type JobStatusString = 'Posted' | 'Taken' | 'Completed' | 'Failed' | 'Expired' | 'Cancelled';

/**
 * Item reward with quantity
 */
export interface JobRewardItem {
	/**
	 * Item name or link to item file
	 * Example: "Potion of Healing", "[[Items/Magic Items/Ring of Protection]]"
	 */
	item: string;

	/**
	 * Quantity of items to award
	 * Must be positive integer
	 * Range: 1 to 9999
	 */
	quantity: number;
}

/**
 * Reputation impact on a faction, location, or NPC
 * Phase 1: Stored as strings, no automatic application
 * Phase 2: Will integrate with faction/location/renown systems
 */
export interface JobReputationImpact {
	/**
	 * Type of entity this impact affects
	 */
	targetType: ReputationTargetType;

	/**
	 * Entity identifier (freeform string or entity link)
	 * Phase 1: Freeform string or link (e.g., "Waterdeep", "[[Factions/Harpers]]")
	 * Auto-suggest from files if available
	 */
	targetEntity: string;

	/**
	 * Renown value change (whole integers only)
	 * Can be positive or negative
	 */
	value: number;

	/**
	 * When to apply this impact
	 */
	condition: ReputationCondition;
}

/**
 * Types of entities that can have reputation
 */
export enum ReputationTargetType {
	/** Impact affects a location's renown */
	Location = 'Location',

	/** Impact affects a faction's renown */
	Faction = 'Faction',

	/** Impact affects an individual NPC's attitude */
	NPC = 'NPC'
}

export type ReputationTargetTypeString = 'Location' | 'Faction' | 'NPC';

/**
 * Conditions for when to apply reputation impacts
 */
export enum ReputationCondition {
	/** Apply when job status changes to Completed */
	OnSuccess = 'On Success',

	/** Apply when job status changes to Failed */
	OnFailure = 'On Failure',

	/** Apply when job status changes to Expired */
	OnExpiration = 'On Expiration'
}

export type ReputationConditionString = 'On Success' | 'On Failure' | 'On Expiration';

/**
 * Job/Quest data structure
 * Stored as YAML frontmatter in job markdown files
 *
 * Note: Job ID uses filename as identifier (no separate id field)
 */
export interface Job {
	// ==================== CORE IDENTITY ====================

	/**
	 * Job title (required)
	 * Max length: 200 characters
	 * Example: "Rat Catcher", "Escort Caravan to Baldur's Gate"
	 */
	title: string;

	/**
	 * Location or region where job takes place
	 * Can be freeform string or link to location file
	 * Auto-suggests from location files if available
	 * Example: "Waterdeep", "[[Locations/The Docks]]"
	 */
	location?: string;

	/**
	 * Questgiver NPC
	 * Can be freeform string or link to NPC file
	 * Auto-suggests from NPC files as user types
	 * Example: "Innkeeper Bess", "[[NPCs/Lord Neverember]]"
	 */
	questgiver?: string;

	/**
	 * Prerequisites for taking the job
	 * Stored as string, GM manually validates
	 * UI provides structured input (one line per prerequisite)
	 * Example: "Level 5+", "Thieves' Guild membership", "Spoke to the Mayor"
	 */
	prerequisites?: string;

	// ==================== LIFECYCLE STATE ====================

	/**
	 * Current status of the job
	 */
	status: JobStatus;

	/**
	 * Calendar day when job was posted
	 * Auto-populated on creation with current calendar day
	 * Type: number (absolute day counter from CalendarService)
	 */
	postDate: number;

	/**
	 * Calendar day when job was taken (status changed to Taken)
	 * Type: number (absolute day counter)
	 * Null if not yet taken
	 */
	takenDate: number | null;

	/**
	 * How many days the job remains available after posting
	 * 0 = indefinite (never auto-expires)
	 * UI displays as "No Limit" when 0
	 * Validation: min 0, no max, integers only
	 * Example: 3 = expires on day (postDate + 3)
	 */
	durationAvailability: number;

	/**
	 * How many days party has to complete after taking job
	 * 0 = indefinite (no deadline)
	 * UI displays as "No Limit" when 0
	 * Validation: min 0, no max, integers only
	 * Example: 7 = deadline on day (takenDate + 7)
	 */
	durationCompletion: number;

	// ==================== REWARDS & OUTCOMES ====================

	/**
	 * Fund reward (in gold pieces)
	 * Validation: min 0, no max, integers only, no negative values
	 * Added to party inventory on completion
	 */
	rewardFunds: number;

	/**
	 * Experience point reward
	 * Validation: min 0, no max, integers only, no negative values
	 */
	rewardXP: number;

	/**
	 * Item rewards
	 * Array of items with quantities
	 * UI auto-suggests items from database
	 * Items can be links to item files or freeform strings
	 * If no item link, adds as string to party inventory
	 */
	rewardItems: JobRewardItem[];

	/**
	 * Reputation impacts on factions, locations, or NPCs
	 * Phase 1: Minimal implementation, no automatic application
	 * Stored as linked fields with prompts for files/entries
	 * Allows unlinked strings if no file exists
	 */
	reputationImpacts: JobReputationImpact[];

	/**
	 * Narrative consequence if job expires or fails
	 * Supports markdown formatting
	 * No maximum length
	 * Shown to GM in modal when job expires/fails
	 */
	narrativeConsequence?: string;

	// ==================== VISIBILITY & MANAGEMENT ====================

	/**
	 * If true, job is hidden from player view
	 * Phase 1: Player view not implemented yet
	 * Future: GM can toggle to hide secret quests
	 * Default: false
	 */
	hideFromPlayers: boolean;

	/**
	 * Soft delete flag
	 * If true, job is archived and hidden from active views
	 * Can be un-archived by changing back to false
	 * Default: false
	 */
	archived: boolean;

	/**
	 * File path where this job is stored
	 * Relative to vault root
	 * Example: "Jobs/rat-catcher.md"
	 * Set by JobFileHandler on load
	 * Used as job identifier (no separate ID field)
	 */
	filePath?: string;
}

/**
 * Default job template
 * Used when creating new jobs
 */
export const DEFAULT_JOB: Partial<Job> = {
	status: JobStatus.Posted,
	takenDate: null,
	durationAvailability: 0,  // No limit
	durationCompletion: 0,    // No deadline
	rewardFunds: 0,
	rewardXP: 0,
	rewardItems: [],
	reputationImpacts: [],
	hideFromPlayers: false,
	archived: false
};

/**
 * Create a new job with default values
 * Note: No ID generated - filename serves as identifier
 *
 * @param title Job title
 * @param postDate Calendar day when job is posted
 * @param overrides Optional field overrides
 * @returns New job object
 */
export function createNewJob(
	title: string,
	postDate: number,
	overrides?: Partial<Job>
): Job {
	return {
		...DEFAULT_JOB,
		title,
		postDate,
		...overrides
	} as Job;
}
