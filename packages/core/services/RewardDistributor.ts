/**
 * Reward distribution service
 *
 * Calculates and validates reward distribution for job completion
 * Platform-agnostic - pure business logic
 *
 * @module RewardDistributor
 * @packageDocumentation
 */

import { Job, JobStatus, JobRewardItem, JobReputationImpact, ReputationCondition } from '../models/Job';

/**
 * Result of reward distribution calculation
 */
export interface RewardDistributionResult {
	/** Currency to add to party treasury */
	currencyReward: number;

	/** Experience points to award */
	xpReward: number;

	/** Items to add to party inventory */
	itemRewards: JobRewardItem[];

	/** Reputation impacts to apply (filtered by condition) */
	reputationImpacts: JobReputationImpact[];

	/** Warnings for GM review */
	warnings: string[];
}

/**
 * Reward distributor service
 *
 * Provides pure functions for calculating and validating
 * reward distribution for completed jobs
 */
export class RewardDistributor {
	/**
	 * Calculate rewards for job completion
	 *
	 * Filters reputation impacts based on job outcome:
	 * - Completed → OnSuccess impacts
	 * - Failed → OnFailure impacts
	 * - Expired → OnExpiration impacts
	 *
	 * @param job Job to calculate rewards for
	 * @returns Reward distribution details and warnings
	 */
	calculateRewards(job: Job): RewardDistributionResult {
		const warnings: string[] = [];

		// Only terminal states should distribute rewards
		if (![JobStatus.Completed, JobStatus.Failed, JobStatus.Expired].includes(job.status)) {
			warnings.push(`Job status is ${job.status}. Rewards should only be distributed for terminal states (Completed, Failed, Expired).`);
		}

		// Validate currency reward (no negatives per user decision)
		if (job.rewardFunds < 0) {
			warnings.push(`Currency reward is negative (${job.rewardFunds}). Rewards must be >= 0.`);
		}

		// Validate XP reward (no negatives per user decision)
		if (job.rewardXP < 0) {
			warnings.push(`XP reward is negative (${job.rewardXP}). Rewards must be >= 0.`);
		}

		// Validate item quantities
		for (const item of job.rewardItems) {
			if (item.quantity <= 0) {
				warnings.push(`Item "${item.item}" has invalid quantity (${item.quantity}). Quantity must be > 0.`);
			}
			if (!Number.isInteger(item.quantity)) {
				warnings.push(`Item "${item.item}" has non-integer quantity (${item.quantity}). Quantity must be a whole number.`);
			}
		}

		// Filter reputation impacts by job status
		const reputationImpacts = this.filterReputationImpacts(job);

		return {
			currencyReward: job.rewardFunds,
			xpReward: job.rewardXP,
			itemRewards: [...job.rewardItems], // Clone array to prevent mutations
			reputationImpacts,
			warnings
		};
	}

	/**
	 * Filter reputation impacts based on job status
	 *
	 * @param job Job to filter reputation impacts for
	 * @returns Reputation impacts that match the job's outcome
	 */
	filterReputationImpacts(job: Job): JobReputationImpact[] {
		// Map job status to reputation condition
		let condition: ReputationCondition | null = null;

		switch (job.status) {
			case JobStatus.Completed:
				condition = ReputationCondition.OnSuccess;
				break;
			case JobStatus.Failed:
				condition = ReputationCondition.OnFailure;
				break;
			case JobStatus.Expired:
				condition = ReputationCondition.OnExpiration;
				break;
			default:
				// Non-terminal states have no reputation impacts
				return [];
		}

		// Filter impacts by condition
		return job.reputationImpacts.filter(impact => impact.condition === condition);
	}

	/**
	 * Validate reputation impacts
	 *
	 * Checks for common issues in reputation impact definitions
	 *
	 * @param impacts Reputation impacts to validate
	 * @returns Array of validation warnings
	 */
	validateReputationImpacts(impacts: JobReputationImpact[]): string[] {
		const warnings: string[] = [];

		for (const impact of impacts) {
			// Check for empty target entity
			if (!impact.targetEntity || impact.targetEntity.trim() === '') {
				warnings.push('Reputation impact has empty target entity');
			}

			// Check for non-integer renown values
			if (!Number.isInteger(impact.value)) {
				warnings.push(`Reputation impact for "${impact.targetEntity}" has non-integer value (${impact.value}). Value must be a whole number.`);
			}

			// Warn about very large impacts (likely data entry errors)
			if (Math.abs(impact.value) > 100) {
				warnings.push(`Reputation impact for "${impact.targetEntity}" has very large value (${impact.value}). Verify this is intentional.`);
			}
		}

		return warnings;
	}

	/**
	 * Format reward summary for GM display
	 *
	 * Creates human-readable summary of rewards to be distributed
	 *
	 * @param result Reward distribution result
	 * @returns Formatted summary string
	 *
	 * @example
	 * ```ts
	 * const result = distributor.calculateRewards(job);
	 * const summary = distributor.formatRewardSummary(result);
	 * // Returns:
	 * // "Currency: 100 gp
	 * //  XP: 500
	 * //  Items: Potion of Healing (3), Ring of Protection (1)
	 * //  Reputation: Waterdeep +2, Zhentarim -1"
	 * ```
	 */
	formatRewardSummary(result: RewardDistributionResult): string {
		const lines: string[] = [];

		// Currency
		if (result.currencyReward > 0) {
			lines.push(`Currency: ${result.currencyReward} gp`);
		}

		// XP
		if (result.xpReward > 0) {
			lines.push(`XP: ${result.xpReward}`);
		}

		// Items
		if (result.itemRewards.length > 0) {
			const itemStrings = result.itemRewards.map(item => {
				const itemName = this.extractItemName(item.item);
				return `${itemName} (${item.quantity})`;
			});
			lines.push(`Items: ${itemStrings.join(', ')}`);
		}

		// Reputation impacts
		if (result.reputationImpacts.length > 0) {
			const impactStrings = result.reputationImpacts.map(impact => {
				const entityName = this.extractEntityName(impact.targetEntity);
				const sign = impact.value >= 0 ? '+' : '';
				return `${entityName} ${sign}${impact.value}`;
			});
			lines.push(`Reputation: ${impactStrings.join(', ')}`);
		}

		// If no rewards at all
		if (lines.length === 0) {
			lines.push('No rewards to distribute');
		}

		return lines.join('\n');
	}

	/**
	 * Extract item name from item string
	 *
	 * Handles both plain strings and Obsidian wikilinks
	 *
	 * @param itemString Item string (may be a wikilink)
	 * @returns Clean item name
	 *
	 * @example
	 * ```ts
	 * extractItemName("Potion of Healing")
	 * // Returns: "Potion of Healing"
	 *
	 * extractItemName("[[Items/Magic Items/Ring of Protection]]")
	 * // Returns: "Ring of Protection"
	 *
	 * extractItemName("[[Items/Potion|Healing Potion]]")
	 * // Returns: "Healing Potion"
	 * ```
	 */
	private extractItemName(itemString: string): string {
		// Check for Obsidian wikilink format: [[path/to/file|display]] or [[path/to/file]]
		const wikilinkMatch = itemString.match(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/);
		if (wikilinkMatch) {
			return wikilinkMatch[1];
		}

		return itemString;
	}

	/**
	 * Extract entity name from entity string
	 *
	 * Handles both plain strings and Obsidian wikilinks
	 *
	 * @param entityString Entity string (may be a wikilink)
	 * @returns Clean entity name
	 */
	private extractEntityName(entityString: string): string {
		// Same logic as extractItemName
		const wikilinkMatch = entityString.match(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/);
		if (wikilinkMatch) {
			return wikilinkMatch[1];
		}

		return entityString;
	}

	/**
	 * Check if rewards should be distributed automatically
	 *
	 * Some job outcomes should prompt GM review rather than
	 * auto-distributing rewards (e.g., failed jobs with negative rep impacts)
	 *
	 * @param job Job to check
	 * @param result Calculated reward distribution
	 * @returns true if rewards can be auto-distributed, false if GM review needed
	 */
	shouldPromptGMReview(job: Job, result: RewardDistributionResult): boolean {
		// Always prompt if there are validation warnings
		if (result.warnings.length > 0) {
			return true;
		}

		// Failed or expired jobs with reputation impacts should be reviewed
		if ([JobStatus.Failed, JobStatus.Expired].includes(job.status) && result.reputationImpacts.length > 0) {
			return true;
		}

		// Jobs with narrative consequences should be reviewed
		if (job.narrativeConsequence && job.narrativeConsequence.trim() !== '') {
			return true;
		}

		// Otherwise, auto-distribute is safe
		return false;
	}
}
