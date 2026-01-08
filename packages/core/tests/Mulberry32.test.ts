import { describe, it, expect } from 'vitest';
import { Mulberry32 } from '../utils/Mulberry32';
import { RngFactory } from '../utils/RngFactory';

describe('Mulberry32', () => {
	describe('Golden Master Test', () => {
		it('should produce the exact golden master value for seed 12345', () => {
			const rng = new Mulberry32(12345);
			const result = rng.randomFloat();

			// Golden master: First value from Mulberry32(12345) must be this exact value
			// This verifies cross-platform consistency of the algorithm
			expect(result).toBeCloseTo(0.9797282677609473, 10);
		});
	});

	describe('Sequence Consistency', () => {
		it('should produce identical sequence with same seed', () => {
			const rng1 = new Mulberry32(42);
			const rng2 = new Mulberry32(42);

			const sequence1: number[] = [];
			const sequence2: number[] = [];

			// Generate 1000 values from each
			for (let i = 0; i < 1000; i++) {
				sequence1.push(rng1.randomFloat());
				sequence2.push(rng2.randomFloat());
			}

			// Sequences must be identical
			expect(sequence1).toEqual(sequence2);
		});

		it('should produce different sequences with different seeds', () => {
			const rng1 = new Mulberry32(42);
			const rng2 = new Mulberry32(43);

			const val1 = rng1.randomFloat();
			const val2 = rng2.randomFloat();

			expect(val1).not.toBe(val2);
		});
	});

	describe('Cross-Instance Consistency', () => {
		it('should produce identical sequence from fresh instance with same seed', () => {
			// First instance - consume some values
			const rng1 = new Mulberry32(9999);
			rng1.randomFloat();
			rng1.randomFloat();
			const val1 = rng1.randomFloat();

			// Fresh instance with same seed - get third value
			const rng2 = new Mulberry32(9999);
			rng2.randomFloat();
			rng2.randomFloat();
			const val2 = rng2.randomFloat();

			expect(val1).toBe(val2);
		});
	});

	describe('reseed()', () => {
		it('should reset sequence to deterministic initial state', () => {
			const rng = new Mulberry32(100);
			const firstValue = rng.randomFloat();

			// Consume some values
			rng.randomFloat();
			rng.randomFloat();
			rng.randomFloat();

			// Reseed to same seed
			rng.reseed(100);
			const resetValue = rng.randomFloat();

			// Should produce same first value again
			expect(resetValue).toBe(firstValue);
		});

		it('should change sequence when reseeded to different value', () => {
			const rng = new Mulberry32(100);
			const val1 = rng.randomFloat();

			rng.reseed(200);
			const val2 = rng.randomFloat();

			expect(val1).not.toBe(val2);
		});
	});

	describe('getState()', () => {
		it('should return current state for serialization', () => {
			const rng = new Mulberry32(12345);
			const initialState = rng.getState();

			// Consume some values
			rng.randomFloat();
			rng.randomFloat();

			const newState = rng.getState();

			// State should have changed
			expect(newState).not.toBe(initialState);
		});

		it('should allow state restoration via reseed', () => {
			const rng1 = new Mulberry32(7777);

			// Consume some values
			rng1.randomFloat();
			rng1.randomFloat();
			const savedState = rng1.getState();
			const nextValue = rng1.randomFloat();

			// Create new instance and restore to saved state
			const rng2 = new Mulberry32(0);
			rng2.reseed(savedState);
			const restoredValue = rng2.randomFloat();

			// Should continue from saved point
			expect(restoredValue).toBe(nextValue);
		});
	});

	describe('randomInt()', () => {
		it('should return integers within specified range', () => {
			const rng = new Mulberry32(555);
			const min = 1;
			const max = 10;

			for (let i = 0; i < 100; i++) {
				const result = rng.randomInt(min, max);
				expect(result).toBeGreaterThanOrEqual(min);
				expect(result).toBeLessThanOrEqual(max);
				expect(Number.isInteger(result)).toBe(true);
			}
		});

		it('should be deterministic with same seed', () => {
			const rng1 = new Mulberry32(888);
			const rng2 = new Mulberry32(888);

			const results1 = Array.from({ length: 20 }, () => rng1.randomInt(1, 100));
			const results2 = Array.from({ length: 20 }, () => rng2.randomInt(1, 100));

			expect(results1).toEqual(results2);
		});
	});

	describe('rollDice()', () => {
		it('should produce deterministic dice rolls', () => {
			const rng1 = new Mulberry32(1234);
			const rng2 = new Mulberry32(1234);

			const roll1 = rng1.rollDice('3d6');
			const roll2 = rng2.rollDice('3d6');

			expect(roll1.total).toBe(roll2.total);
			expect(roll1.breakdown).toBe(roll2.breakdown);
		});

		it('should handle dice notation with modifiers', () => {
			const rng = new Mulberry32(5000);
			const result = rng.rollDice('2d8+3');

			expect(result.total).toBeGreaterThanOrEqual(5); // 2*1 + 3
			expect(result.total).toBeLessThanOrEqual(19); // 2*8 + 3
			expect(result.breakdown).toMatch(/2d8\+3: \[(\d+, \d+)\] \+3 = \d+/);
		});

		it('should return error for invalid notation', () => {
			const rng = new Mulberry32(1);
			const result = rng.rollDice('invalid');

			expect(result.total).toBe(0);
			expect(result.breakdown).toBe('Invalid notation: invalid');
		});
	});

	describe('randomChoice()', () => {
		it('should make deterministic choices', () => {
			const items = ['apple', 'banana', 'cherry', 'date', 'elderberry'];

			const rng1 = new Mulberry32(3333);
			const rng2 = new Mulberry32(3333);

			const choices1 = Array.from({ length: 10 }, () => rng1.randomChoice(items));
			const choices2 = Array.from({ length: 10 }, () => rng2.randomChoice(items));

			expect(choices1).toEqual(choices2);
		});

		it('should throw error for empty array', () => {
			const rng = new Mulberry32(1);
			expect(() => rng.randomChoice([])).toThrow('Cannot choose from empty array');
		});
	});

	describe('weightedChoice()', () => {
		it('should make deterministic weighted choices', () => {
			const items = ['rare', 'uncommon', 'common'];
			const weights = [1, 5, 20];

			const rng1 = new Mulberry32(4444);
			const rng2 = new Mulberry32(4444);

			const choices1 = Array.from({ length: 20 }, () => rng1.weightedChoice(items, weights));
			const choices2 = Array.from({ length: 20 }, () => rng2.weightedChoice(items, weights));

			expect(choices1).toEqual(choices2);
		});

		it('should throw error for mismatched arrays', () => {
			const rng = new Mulberry32(1);
			expect(() => rng.weightedChoice(['a', 'b'], [1])).toThrow(
				'Items and weights arrays must have the same length'
			);
		});

		it('should throw error for empty arrays', () => {
			const rng = new Mulberry32(1);
			expect(() => rng.weightedChoice([], [])).toThrow('Cannot choose from empty array');
		});
	});

	describe('rollPercentile()', () => {
		it('should return deterministic values between 1-100', () => {
			const rng1 = new Mulberry32(6666);
			const rng2 = new Mulberry32(6666);

			const rolls1 = Array.from({ length: 30 }, () => rng1.rollPercentile());
			const rolls2 = Array.from({ length: 30 }, () => rng2.rollPercentile());

			expect(rolls1).toEqual(rolls2);

			rolls1.forEach(roll => {
				expect(roll).toBeGreaterThanOrEqual(1);
				expect(roll).toBeLessThanOrEqual(100);
			});
		});
	});

	describe('chance()', () => {
		it('should produce deterministic true/false results', () => {
			const rng1 = new Mulberry32(7777);
			const rng2 = new Mulberry32(7777);

			const results1 = Array.from({ length: 15 }, () => rng1.chance(50));
			const results2 = Array.from({ length: 15 }, () => rng2.chance(50));

			expect(results1).toEqual(results2);
		});
	});

	describe('ISeededRandomizer Interface', () => {
		it('should implement all ISeededRandomizer methods', () => {
			const rng = new Mulberry32(1);

			// IRandomizer methods
			expect(typeof rng.randomInt).toBe('function');
			expect(typeof rng.randomFloat).toBe('function');
			expect(typeof rng.rollDice).toBe('function');
			expect(typeof rng.randomChoice).toBe('function');
			expect(typeof rng.weightedChoice).toBe('function');
			expect(typeof rng.rollPercentile).toBe('function');
			expect(typeof rng.chance).toBe('function');

			// ISeededRandomizer methods
			expect(typeof rng.reseed).toBe('function');
			expect(typeof rng.getState).toBe('function');
		});
	});
});

describe('RngFactory', () => {
	it('should create Mulberry32 instances', () => {
		const factory = new RngFactory();
		const rng = factory.create(12345);

		expect(rng).toBeInstanceOf(Mulberry32);
	});

	it('should create instances with correct seed', () => {
		const factory = new RngFactory();
		const rng = factory.create(12345);

		// Verify using golden master
		const result = rng.randomFloat();
		expect(result).toBeCloseTo(0.9797282677609473, 10);
	});

	it('should create independent instances', () => {
		const factory = new RngFactory();
		const rng1 = factory.create(100);
		const rng2 = factory.create(100);

		// Advance rng1
		rng1.randomFloat();
		rng1.randomFloat();

		// rng2 should still produce first value
		const val1 = rng1.randomFloat();
		const val2 = rng2.randomFloat();

		expect(val1).not.toBe(val2);
	});

	it('should implement IRngFactory interface', () => {
		const factory = new RngFactory();
		expect(typeof factory.create).toBe('function');
	});

	it('should allow state save and restore workflow', () => {
		const factory = new RngFactory();

		// Create RNG and advance it
		const rng1 = factory.create(999);
		rng1.randomFloat();
		rng1.randomFloat();
		const savedState = rng1.getState();
		const nextValue = rng1.randomFloat();

		// Restore to saved state
		const rng2 = factory.create(savedState);
		const restoredValue = rng2.randomFloat();

		expect(restoredValue).toBe(nextValue);
	});
});
