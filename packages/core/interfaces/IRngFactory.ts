// Factory interface for creating seeded random number generators
// Platform-agnostic factory pattern for RNG instantiation

import { ISeededRandomizer } from './ISeededRandomizer';

/**
 * Factory interface for creating seeded random number generators
 *
 * Abstracts the creation of ISeededRandomizer instances, allowing platforms
 * to provide their own implementations (e.g., seedrandom library, custom PRNG, etc.)
 *
 * Use cases:
 * - Calendar system creating day-specific generators
 * - Event system creating reproducible event sequences
 * - World generation with save/restore capability
 *
 * Example usage:
 * ```typescript
 * const rngFactory: IRngFactory = new SeedRandomFactory();
 * const dayRng = rngFactory.create(currentDay); // Day-specific RNG
 * const event = generateEvent(dayRng); // Same day = same event
 * ```
 */
export interface IRngFactory {
	/**
	 * Create a new seeded random number generator
	 *
	 * @param seed - Initial seed value (integer). Same seed produces same sequence.
	 * @returns New seeded randomizer instance
	 */
	create(seed: number): ISeededRandomizer;
}
