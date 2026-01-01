import {
	ProjectInstance,
	ProjectCostStrategy,
	ProjectDurationStrategy,
	ProjectSuccessCriteriaStrategy,
	PurchasedItem
} from '../models/types';

/**
 * Validate cost strategy configuration
 */
export function validateCostStrategy(strategy: ProjectCostStrategy): boolean {
	if (!strategy || !strategy.type) {
		return false;
	}

	if (strategy.type === 'fixed') {
		return strategy.fixedCost !== undefined;
	}

	if (strategy.type === 'variable') {
		return strategy.guidanceText !== undefined && strategy.guidanceText.trim() !== '';
	}

	return strategy.type === 'none';
}

/**
 * Validate duration strategy configuration
 */
export function validateDurationStrategy(strategy: ProjectDurationStrategy): boolean {
	if (!strategy || !strategy.type) {
		return false;
	}

	if (strategy.type === 'fixed') {
		return strategy.fixedDays !== undefined && strategy.fixedDays >= 1;
	}

	if (strategy.type === 'variable') {
		return strategy.guidanceText !== undefined && strategy.guidanceText.trim() !== '';
	}

	return false;
}

/**
 * Validate success criteria strategy configuration
 */
export function validateSuccessCriteriaStrategy(strategy: ProjectSuccessCriteriaStrategy): boolean {
	if (!strategy || !strategy.type) {
		return false;
	}

	if (strategy.type === 'fixed') {
		return strategy.fixedCriteria !== undefined && strategy.fixedCriteria.trim() !== '';
	}

	if (strategy.type === 'variable') {
		return strategy.guidanceText !== undefined && strategy.guidanceText.trim() !== '';
	}

	return false;
}

/**
 * Validate project instance can be completed
 * Checks if materials still in inventory
 */
export function validateProjectCompletion(
	instance: ProjectInstance,
	currentInventory: PurchasedItem[]
): { valid: boolean; missingMaterials: string[] } {
	const missingMaterials: string[] = [];

	// If no materials required, validation passes
	if (!instance.materialsCost || instance.materialsCost.length === 0) {
		return { valid: true, missingMaterials: [] };
	}

	// Check each required material
	for (const requiredMaterial of instance.materialsCost) {
		// Find matching item in inventory
		const inventoryItem = currentInventory.find(
			item => item.name.toLowerCase() === requiredMaterial.itemName.toLowerCase()
		);

		// Check if item exists and has sufficient quantity
		if (!inventoryItem) {
			missingMaterials.push(requiredMaterial.itemName);
		} else if (inventoryItem.quantity < requiredMaterial.quantity) {
			missingMaterials.push(
				`${requiredMaterial.itemName} (need ${requiredMaterial.quantity}, have ${inventoryItem.quantity})`
			);
		}
	}

	return {
		valid: missingMaterials.length === 0,
		missingMaterials
	};
}

/**
 * Check if project has reached time limit
 */
export function hasReachedTimeLimit(instance: ProjectInstance, currentDay: number): boolean {
	if (!instance.timeLimit || !instance.startDay) {
		return false;  // No time limit configured
	}

	const daysElapsed = currentDay - instance.startDay;
	return daysElapsed >= instance.timeLimit;
}

/**
 * Check if project has met success threshold (for auto-completion)
 */
export function hasMetSuccessThreshold(instance: ProjectInstance): boolean {
	if (!instance.totalSuccessesRequired) {
		return false;  // No threshold configured
	}

	const successfulDays = instance.successfulDays || 0;
	return successfulDays >= instance.totalSuccessesRequired;
}

/**
 * Calculate total days elapsed since project start
 */
export function getTotalDaysElapsed(instance: ProjectInstance, currentDay: number): number {
	if (!instance.startDay) {
		return 0;
	}

	return currentDay - instance.startDay;
}

/**
 * Calculate days remaining until time limit
 */
export function getDaysUntilTimeLimit(instance: ProjectInstance, currentDay: number): number | null {
	if (!instance.timeLimit || !instance.startDay) {
		return null;  // No time limit configured
	}

	const daysElapsed = currentDay - instance.startDay;
	const daysRemaining = instance.timeLimit - daysElapsed;

	return Math.max(0, daysRemaining);
}

/**
 * Check if project is at risk of exceeding time limit
 * @param warningDays Number of days before limit to start warning
 */
export function isApproachingTimeLimit(
	instance: ProjectInstance,
	currentDay: number,
	warningDays: number = 2
): boolean {
	const daysUntilLimit = getDaysUntilTimeLimit(instance, currentDay);

	if (daysUntilLimit === null) {
		return false;  // No time limit
	}

	return daysUntilLimit <= warningDays && daysUntilLimit > 0;
}

/**
 * Calculate success rate for projects with success checks
 */
export function getSuccessRate(instance: ProjectInstance): number {
	const successful = instance.successfulDays || 0;
	const failed = instance.failedDays || 0;
	const total = successful + failed;

	if (total === 0) {
		return 0;
	}

	return (successful / total) * 100;
}

/**
 * Check if all assigned players exist in party members list
 */
export function validateAssignedPlayers(
	instance: ProjectInstance,
	validPlayerNames: string[]
): { valid: boolean; invalidPlayers: string[] } {
	const invalidPlayers: string[] = [];

	for (const playerName of instance.assignedTo) {
		if (!validPlayerNames.includes(playerName)) {
			invalidPlayers.push(playerName);
		}
	}

	return {
		valid: invalidPlayers.length === 0,
		invalidPlayers
	};
}
