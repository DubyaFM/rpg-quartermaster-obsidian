// Simple randomizer implementation using Math.random()
// Used as fallback when Dice Roller plugin is not available

import { IRandomizer, RollResult } from '../interfaces/IRandomizer';

export class SimpleRandomizer implements IRandomizer {
	randomInt(min: number, max: number): number {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	randomFloat(): number {
		return Math.random();
	}

	// Basic dice notation parser (supports simple patterns like 1d6, 2d20, etc.)
	rollDice(notation: string): RollResult {
		const match = notation.match(/(\d+)d(\d+)([+\-]\d+)?/i);
		if (!match) {
			return { total: 0, breakdown: `Invalid notation: ${notation}` };
		}

		const [, numDiceStr, dieSizeStr, modifierStr] = match;
		const numDice = parseInt(numDiceStr);
		const dieSize = parseInt(dieSizeStr);
		const modifier = modifierStr ? parseInt(modifierStr) : 0;

		const rolls: number[] = [];
		for (let i = 0; i < numDice; i++) {
			rolls.push(this.randomInt(1, dieSize));
		}

		const sum = rolls.reduce((a, b) => a + b, 0);
		const total = sum + modifier;

		const modifierText = modifier !== 0 ? ` ${modifier > 0 ? '+' : ''}${modifier}` : '';
		const breakdown = `${notation}: [${rolls.join(', ')}]${modifierText} = ${total}`;

		return { total, breakdown };
	}

	randomChoice<T>(items: T[]): T {
		if (items.length === 0) {
			throw new Error('Cannot choose from empty array');
		}
		return items[this.randomInt(0, items.length - 1)];
	}

	weightedChoice<T>(items: T[], weights: number[]): T {
		if (items.length !== weights.length) {
			throw new Error('Items and weights arrays must have the same length');
		}
		if (items.length === 0) {
			throw new Error('Cannot choose from empty array');
		}

		const totalWeight = weights.reduce((a, b) => a + b, 0);
		let random = this.randomFloat() * totalWeight;

		for (let i = 0; i < items.length; i++) {
			random -= weights[i];
			if (random < 0) {
				return items[i];
			}
		}

		// Fallback to last item (shouldn't happen, but guards against floating point errors)
		return items[items.length - 1];
	}

	rollPercentile(): number {
		return this.randomInt(1, 100);
	}

	chance(percentage: number): boolean {
		return this.rollPercentile() <= percentage;
	}
}
