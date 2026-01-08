// Mulberry32 seeded random number generator
// Fast, high-quality PRNG with 32-bit state for cross-platform deterministic generation

import { ISeededRandomizer } from '../interfaces/ISeededRandomizer';
import { RollResult } from '../interfaces/IRandomizer';

/**
 * Mulberry32 PRNG implementation
 *
 * A fast, high-quality pseudo-random number generator suitable for non-cryptographic use.
 * Produces identical sequences on all platforms given the same seed.
 *
 * Algorithm: Mulberry32 by Tommy Ettinger
 * Period: 2^32 (4,294,967,296 values before repeating)
 * Quality: Passes PractRand, TestU01 SmallCrush
 *
 * Golden master test: new Mulberry32(12345).randomFloat() ≈ 0.6270739405881613
 *
 * Use cases:
 * - Calendar event generation (same day = same events)
 * - World state consistency during time travel
 * - Save/restore with exact RNG state
 */
export class Mulberry32 implements ISeededRandomizer {
	private state: number;

	/**
	 * Create a new Mulberry32 generator
	 *
	 * @param seed - Initial seed value (will be converted to 32-bit unsigned integer)
	 */
	constructor(seed: number) {
		// Ensure seed is a valid 32-bit unsigned integer
		this.state = Math.floor(seed) >>> 0;
	}

	/**
	 * Generate next random number in sequence
	 *
	 * Core Mulberry32 algorithm:
	 * 1. Add constant to state
	 * 2. Mix bits with XOR and multiplication
	 * 3. Final XOR shift for avalanche
	 *
	 * @returns Raw 32-bit unsigned integer
	 */
	private next(): number {
		let z = (this.state += 0x6D2B79F5);
		z = Math.imul(z ^ (z >>> 15), z | 1);
		z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
		return (z ^ (z >>> 14)) >>> 0;
	}

	randomFloat(): number {
		// Convert 32-bit integer to [0, 1) float
		// Divide by 2^32 for uniform distribution
		return this.next() / 0x100000000;
	}

	randomInt(min: number, max: number): number {
		// Inclusive range [min, max]
		const range = max - min + 1;
		return Math.floor(this.randomFloat() * range) + min;
	}

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

		// Fallback to last item (guards against floating point errors)
		return items[items.length - 1];
	}

	rollPercentile(): number {
		return this.randomInt(1, 100);
	}

	chance(percentage: number): boolean {
		return this.rollPercentile() <= percentage;
	}

	reseed(seed: number): void {
		// Reset to deterministic initial state
		this.state = Math.floor(seed) >>> 0;
	}

	getState(): number {
		// Return current state for serialization
		return this.state;
	}
}
