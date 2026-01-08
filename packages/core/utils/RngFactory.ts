// Factory for creating Mulberry32 seeded random number generators
// Platform-agnostic factory implementation for deterministic RNG

import { IRngFactory } from '../interfaces/IRngFactory';
import { ISeededRandomizer } from '../interfaces/ISeededRandomizer';
import { Mulberry32 } from './Mulberry32';

/**
 * Factory for creating Mulberry32 RNG instances
 *
 * Provides a platform-agnostic way to create seeded random number generators
 * for calendar events, world generation, and other deterministic systems.
 *
 * Example usage:
 * ```typescript
 * const factory = new RngFactory();
 * const dayRng = factory.create(currentDay); // Day-specific RNG
 * const event = generateEvent(dayRng); // Same day = same event
 *
 * // Save state
 * const savedState = dayRng.getState();
 *
 * // Restore state later
 * const restoredRng = factory.create(savedState);
 * // Continues same sequence from saved point
 * ```
 */
export class RngFactory implements IRngFactory {
	/**
	 * Create a new seeded random number generator
	 *
	 * @param seed - Initial seed value (integer). Same seed produces same sequence.
	 * @returns New Mulberry32 instance with deterministic sequence
	 */
	create(seed: number): ISeededRandomizer {
		return new Mulberry32(seed);
	}
}
