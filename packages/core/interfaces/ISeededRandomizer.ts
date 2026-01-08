// Platform-agnostic seeded randomization interface
// Extends IRandomizer with deterministic, reseedable capabilities for calendar events and world generation

import { IRandomizer } from './IRandomizer';

/**
 * Seeded random number generator interface
 *
 * Provides deterministic random number generation with the ability to:
 * - Reseed for reproducible results
 * - Save/restore state for time-travel and save/load operations
 * - Generate consistent results across sessions
 *
 * Use cases:
 * - Calendar event generation (same day should produce same events)
 * - World state consistency during time jumps
 * - Save/restore game state with exact RNG state
 *
 * Implementation requirements:
 * - Must produce identical sequences from same seed
 * - State must be serializable as a single number
 * - Reseed must reset to deterministic initial state
 */
export interface ISeededRandomizer extends IRandomizer {
	/**
	 * Reseed the random number generator
	 *
	 * After calling reseed with a specific seed value, the generator must produce
	 * the same sequence of random numbers for all subsequent calls.
	 *
	 * @param seed - Seed value (integer). Same seed produces same sequence.
	 */
	reseed(seed: number): void;

	/**
	 * Get current internal state for serialization
	 *
	 * Returns the current state as a number that can be saved and later restored
	 * via reseed() to continue the exact same random sequence.
	 *
	 * Use cases:
	 * - Save game state with exact RNG position
	 * - Restore state after time travel
	 * - Checkpoint during long event generation
	 *
	 * @returns Current state value (suitable for passing to reseed())
	 */
	getState(): number;
}
