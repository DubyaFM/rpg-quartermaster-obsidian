/**
 * Renown Calculator
 *
 * Platform-agnostic utility functions for renown and reputation calculations.
 * Handles rank determination, score changes, and rank transitions.
 */

import { RenownRank, RenownComponent } from '../models/types';

// ============================================================================
// Rank Calculation
// ============================================================================

/**
 * Determines the current rank based on a score and rank ladder.
 * Ranks are ordered by threshold (ascending), and the highest threshold
 * not exceeding the score is the current rank.
 *
 * @param score - The renown score (can be negative)
 * @param rankLadder - Array of rank definitions (must be sorted by threshold ascending)
 * @returns The current rank, or null if no rank qualifies
 */
export function getCurrentRank(
	score: number,
	rankLadder: RenownRank[]
): RenownRank | null {
	if (!rankLadder || rankLadder.length === 0) {
		return null;
	}

	// Find the highest threshold that the score meets or exceeds
	let currentRank: RenownRank | null = null;
	for (const rank of rankLadder) {
		if (score >= rank.threshold) {
			currentRank = rank;
		} else {
			// Since ladder is sorted, no need to continue
			break;
		}
	}

	return currentRank;
}

/**
 * Gets the rank title at a specific score.
 * Convenience wrapper around getCurrentRank().
 *
 * @param score - The renown score
 * @param rankLadder - Array of rank definitions
 * @returns The rank title, or null if no rank qualifies
 */
export function getRankAtScore(
	score: number,
	rankLadder: RenownRank[]
): string | null {
	const rank = getCurrentRank(score, rankLadder);
	return rank ? rank.title : null;
}

// ============================================================================
// Rank Change Detection
// ============================================================================

export interface RankChangeResult {
	previousRank: RenownRank | null;
	newRank: RenownRank | null;
	previousTitle: string | null;
	newTitle: string | null;
	rankedUp: boolean;
	rankedDown: boolean;
	thresholdCrossed: boolean;
}

/**
 * Calculates whether a score change resulted in a rank change.
 * Detects both rank-ups and rank-downs.
 *
 * @param previousScore - The score before the change
 * @param newScore - The score after the change
 * @param rankLadder - Array of rank definitions
 * @returns RankChangeResult with before/after ranks and change flags
 */
export function calculateRankChange(
	previousScore: number,
	newScore: number,
	rankLadder: RenownRank[]
): RankChangeResult {
	const previousRank = getCurrentRank(previousScore, rankLadder);
	const newRank = getCurrentRank(newScore, rankLadder);

	const previousTitle = previousRank ? previousRank.title : null;
	const newTitle = newRank ? newRank.title : null;

	const rankedUp = (previousRank?.threshold ?? -Infinity) < (newRank?.threshold ?? -Infinity);
	const rankedDown = (previousRank?.threshold ?? -Infinity) > (newRank?.threshold ?? -Infinity);
	const thresholdCrossed = rankedUp || rankedDown;

	return {
		previousRank,
		newRank,
		previousTitle,
		newTitle,
		rankedUp,
		rankedDown,
		thresholdCrossed
	};
}

// ============================================================================
// Effective Score Resolution
// ============================================================================

/**
 * Gets the effective renown score for a specific player.
 * If the player has an individual override, use that.
 * Otherwise, fall back to the party score.
 *
 * @param renownComponent - The renown component (from faction/location/NPC)
 * @param playerName - Optional player name (if null, returns party score)
 * @returns The effective renown score for the player (or party)
 */
export function getEffectiveScore(
	renownComponent: RenownComponent,
	playerName?: string
): number {
	if (!renownComponent.enabled) {
		return 0;
	}

	// If no player specified, return party score
	if (!playerName) {
		return renownComponent.partyScore;
	}

	// Check for individual override
	if (renownComponent.individualScores && playerName in renownComponent.individualScores) {
		return renownComponent.individualScores[playerName];
	}

	// Fall back to party score
	return renownComponent.partyScore;
}

// ============================================================================
// Score Modification
// ============================================================================

export interface ScoreChangeResult {
	previousScore: number;
	newScore: number;
	change: number;
	rankChange: RankChangeResult;
}

/**
 * Applies a score change to a renown component.
 * Handles both party-wide changes and individual player changes.
 *
 * @param renownComponent - The renown component to modify (mutates in place)
 * @param delta - The score change (positive or negative)
 * @param playerName - Optional player name for individual override
 * @returns ScoreChangeResult with before/after values and rank changes
 */
export function applyScoreChange(
	renownComponent: RenownComponent,
	delta: number,
	playerName?: string
): ScoreChangeResult {
	const previousScore = getEffectiveScore(renownComponent, playerName);

	// Apply change to appropriate score
	if (!playerName) {
		// Party-wide change
		renownComponent.partyScore += delta;
	} else {
		// Individual override
		if (!renownComponent.individualScores) {
			renownComponent.individualScores = {};
		}
		const currentIndividual = renownComponent.individualScores[playerName] ?? renownComponent.partyScore;
		renownComponent.individualScores[playerName] = currentIndividual + delta;
	}

	const newScore = getEffectiveScore(renownComponent, playerName);
	const rankChange = calculateRankChange(previousScore, newScore, renownComponent.rankLadder);

	// Update lastUpdated timestamp
	renownComponent.lastUpdated = new Date().toISOString();

	return {
		previousScore,
		newScore,
		change: delta,
		rankChange
	};
}

// ============================================================================
// Score Setter
// ============================================================================

/**
 * Sets the renown score to a specific value (instead of applying a delta).
 * Useful for manual adjustments via UI.
 *
 * @param renownComponent - The renown component to modify (mutates in place)
 * @param newScore - The new score to set
 * @param playerName - Optional player name for individual override
 * @returns ScoreChangeResult with before/after values and rank changes
 */
export function setScore(
	renownComponent: RenownComponent,
	newScore: number,
	playerName?: string
): ScoreChangeResult {
	const previousScore = getEffectiveScore(renownComponent, playerName);
	const delta = newScore - previousScore;

	return applyScoreChange(renownComponent, delta, playerName);
}

// ============================================================================
// Rank Ladder Validation
// ============================================================================

/**
 * Validates a rank ladder for common issues.
 * Checks for proper sorting, duplicate thresholds, and missing data.
 *
 * @param rankLadder - The rank ladder to validate
 * @returns Array of error messages (empty if valid)
 */
export function validateRankLadder(rankLadder: RenownRank[]): string[] {
	const errors: string[] = [];

	if (!rankLadder || rankLadder.length === 0) {
		errors.push('Rank ladder is empty');
		return errors;
	}

	// Check for missing titles
	for (let i = 0; i < rankLadder.length; i++) {
		const rank = rankLadder[i];
		if (!rank.title || rank.title.trim() === '') {
			errors.push(`Rank at index ${i} has no title`);
		}
		if (rank.threshold === undefined || rank.threshold === null) {
			errors.push(`Rank "${rank.title}" has no threshold`);
		}
	}

	// Check for proper ascending order
	for (let i = 1; i < rankLadder.length; i++) {
		if (rankLadder[i].threshold < rankLadder[i - 1].threshold) {
			errors.push(
				`Rank ladder not sorted: "${rankLadder[i - 1].title}" (${rankLadder[i - 1].threshold}) comes before "${rankLadder[i].title}" (${rankLadder[i].threshold})`
			);
		}
	}

	// Check for duplicate thresholds
	const thresholds = new Set<number>();
	for (const rank of rankLadder) {
		if (thresholds.has(rank.threshold)) {
			errors.push(`Duplicate threshold: ${rank.threshold}`);
		}
		thresholds.add(rank.threshold);
	}

	return errors;
}

// ============================================================================
// Helper: Sort Rank Ladder
// ============================================================================

/**
 * Sorts a rank ladder by threshold (ascending).
 * Returns a new array (does not mutate original).
 *
 * @param rankLadder - The rank ladder to sort
 * @returns A new sorted rank ladder
 */
export function sortRankLadder(rankLadder: RenownRank[]): RenownRank[] {
	return [...rankLadder].sort((a, b) => a.threshold - b.threshold);
}
