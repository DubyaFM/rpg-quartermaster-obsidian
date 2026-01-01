import { ProjectInstance, ProjectProgressUpdate } from '../models/types';

/**
 * Service for calculating project progress when time advances
 * Pure calculation service - no state management
 */
export class ProjectProgressService {
	/**
	 * Process time advancement for a single project
	 * @param instance Project instance
	 * @param daysAdvanced How many days passed
	 * @param wasSuccessful For projects with success checks, whether check passed
	 * @returns Progress update result
	 */
	processProgress(
		instance: ProjectInstance,
		daysAdvanced: number,
		wasSuccessful: boolean = true
	): ProjectProgressUpdate {
		let daysWorked = 0;

		// If automatic success or success check passed
		if (instance.successCriteria === undefined || wasSuccessful) {
			daysWorked = Math.min(daysAdvanced, instance.remainingDays);
		}
		// If success check failed, no progress made
		else {
			daysWorked = 0;
		}

		const newRemaining = Math.max(0, instance.remainingDays - daysWorked);
		const completed = newRemaining === 0;

		return {
			instanceId: instance.id,
			previousRemainingDays: instance.remainingDays,
			newRemainingDays: newRemaining,
			daysWorked,
			completed,
			outcome: completed ? instance.outcome : undefined
		};
	}

	/**
	 * Process time advancement for multiple projects
	 * @param instances Array of project instances
	 * @param daysAdvanced How many days passed
	 * @param successResults Map of instance ID to success result (for non-automatic)
	 * @returns Array of progress updates
	 */
	processBatchProgress(
		instances: ProjectInstance[],
		daysAdvanced: number,
		successResults?: Map<string, boolean>
	): ProjectProgressUpdate[] {
		const updates: ProjectProgressUpdate[] = [];

		for (const instance of instances) {
			const wasSuccessful = successResults?.get(instance.id) ?? true;
			const update = this.processProgress(instance, daysAdvanced, wasSuccessful);
			updates.push(update);
		}

		return updates;
	}

	/**
	 * Calculate remaining days after advancement
	 */
	calculateRemainingDays(
		currentRemaining: number,
		daysAdvanced: number,
		wasSuccessful: boolean
	): number {
		if (!wasSuccessful) {
			return currentRemaining;  // No progress on failure
		}

		const daysWorked = Math.min(daysAdvanced, currentRemaining);
		return Math.max(0, currentRemaining - daysWorked);
	}

	/**
	 * Check if project is complete
	 */
	isComplete(instance: ProjectInstance): boolean {
		return instance.remainingDays <= 0;
	}

	/**
	 * Get progress percentage
	 */
	getProgressPercentage(instance: ProjectInstance): number {
		if (instance.totalDays === 0) {
			return 0;
		}

		const progress = (instance.totalDays - instance.remainingDays) / instance.totalDays * 100;
		return Math.round(progress);
	}

	/**
	 * Check if project has met success threshold (for auto-completion)
	 */
	hasMetSuccessThreshold(instance: ProjectInstance): boolean {
		if (!instance.totalSuccessesRequired) {
			return false;  // No threshold configured
		}

		const successfulDays = instance.successfulDays || 0;
		return successfulDays >= instance.totalSuccessesRequired;
	}

	/**
	 * Check if project has reached time limit
	 */
	hasReachedTimeLimit(instance: ProjectInstance, currentDay: number): boolean {
		if (!instance.timeLimit || !instance.startDay) {
			return false;  // No time limit configured
		}

		const daysElapsed = currentDay - instance.startDay;
		return daysElapsed >= instance.timeLimit;
	}

	/**
	 * Process time budgeting for multi-project allocation
	 * @param projectAllocations Map of instance ID to days allocated
	 * @param maxDaysPerPlayer Total days each player can allocate
	 * @param playerAssignments Map of instance ID to array of assigned player names
	 * @returns Validation result and allocations by player
	 */
	validateTimeBudget(
		projectAllocations: Map<string, number>,
		maxDaysPerPlayer: number,
		playerAssignments: Map<string, string[]>
	): {
		valid: boolean;
		errors: string[];
		allocationsByPlayer: Map<string, Map<string, number>>;  // playerName → (instanceId → days)
	} {
		const errors: string[] = [];
		const allocationsByPlayer = new Map<string, Map<string, number>>();

		// Build player allocations
		for (const [instanceId, daysAllocated] of projectAllocations.entries()) {
			const assignedPlayers = playerAssignments.get(instanceId) || [];

			for (const playerName of assignedPlayers) {
				if (!allocationsByPlayer.has(playerName)) {
					allocationsByPlayer.set(playerName, new Map());
				}

				const playerAllocations = allocationsByPlayer.get(playerName)!;
				playerAllocations.set(instanceId, daysAllocated);
			}
		}

		// Validate each player's total allocation
		for (const [playerName, allocations] of allocationsByPlayer.entries()) {
			const totalAllocated = Array.from(allocations.values()).reduce((sum, days) => sum + days, 0);

			if (totalAllocated > maxDaysPerPlayer) {
				errors.push(
					`${playerName} has allocated ${totalAllocated} days, exceeds maximum of ${maxDaysPerPlayer}`
				);
			}
		}

		return {
			valid: errors.length === 0,
			errors,
			allocationsByPlayer
		};
	}
}
