// Platform-agnostic randomization interface
// This can be implemented by Math.random(), Dice Roller plugin, or any other source

export interface RollResult {
	total: number;
	breakdown?: string; // Optional visual breakdown like "2d6: [3, 5] = 8"
}

export interface IRandomizer {
	// Basic random operations
	randomInt(min: number, max: number): number;
	randomFloat(): number; // 0.0 to 1.0

	// Dice notation (optional - may not be implemented by all)
	rollDice?(notation: string): RollResult;

	// Table selection
	randomChoice<T>(items: T[]): T;
	weightedChoice<T>(items: T[], weights: number[]): T;

	// Percentage
	rollPercentile(): number; // 1-100
	chance(percentage: number): boolean; // true/false based on % chance
}
