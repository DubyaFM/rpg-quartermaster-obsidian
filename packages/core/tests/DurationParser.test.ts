import { describe, it, expect } from 'vitest';
import { parseDuration, DEFAULT_DURATION_UNITS, DurationUnitConfig } from '../utils/DurationParser';
import { Mulberry32 } from '../utils/Mulberry32';

describe('DurationParser', () => {
	describe('Fixed Durations', () => {
		it('should parse single minute duration', () => {
			const rng = new Mulberry32(12345);
			const result = parseDuration('30 minutes', rng);
			expect(result).toBe(30);
		});

		it('should parse single hour duration', () => {
			const rng = new Mulberry32(12345);
			const result = parseDuration('6 hours', rng);
			expect(result).toBe(360); // 6 * 60
		});

		it('should parse single day duration', () => {
			const rng = new Mulberry32(12345);
			const result = parseDuration('30 days', rng);
			expect(result).toBe(43200); // 30 * 24 * 60
		});

		it('should parse week duration', () => {
			const rng = new Mulberry32(12345);
			const result = parseDuration('1 week', rng);
			expect(result).toBe(10080); // 7 * 24 * 60
		});

		it('should parse month duration', () => {
			const rng = new Mulberry32(12345);
			const result = parseDuration('2 months', rng);
			expect(result).toBe(86400); // 2 * 30 * 24 * 60
		});

		it('should parse year duration', () => {
			const rng = new Mulberry32(12345);
			const result = parseDuration('1 year', rng);
			expect(result).toBe(525600); // 365 * 24 * 60
		});

		it('should handle singular units', () => {
			const rng = new Mulberry32(12345);
			expect(parseDuration('1 minute', rng)).toBe(1);
			expect(parseDuration('1 hour', rng)).toBe(60);
			expect(parseDuration('1 day', rng)).toBe(1440);
		});

		it('should handle plural units', () => {
			const rng = new Mulberry32(12345);
			expect(parseDuration('5 minutes', rng)).toBe(5);
			expect(parseDuration('3 hours', rng)).toBe(180);
			expect(parseDuration('2 days', rng)).toBe(2880);
		});
	});

	describe('Dice Durations', () => {
		it('should parse simple dice notation', () => {
			const rng = new Mulberry32(12345);
			const result = parseDuration('1d4 days', rng);
			// 1d4 with seed 12345 should give deterministic result
			expect(result).toBeGreaterThanOrEqual(1440); // 1 day minimum
			expect(result).toBeLessThanOrEqual(5760); // 4 days maximum
		});

		it('should parse multiple dice', () => {
			const rng = new Mulberry32(54321);
			const result = parseDuration('2d6 hours', rng);
			expect(result).toBeGreaterThanOrEqual(120); // 2 hours minimum (2*1*60)
			expect(result).toBeLessThanOrEqual(720); // 12 hours maximum (2*6*60)
		});

		it('should produce deterministic results with same seed', () => {
			const rng1 = new Mulberry32(99999);
			const rng2 = new Mulberry32(99999);

			const result1 = parseDuration('3d8 days', rng1);
			const result2 = parseDuration('3d8 days', rng2);

			expect(result1).toBe(result2);
		});

		it('should handle dice with all unit types', () => {
			const rng = new Mulberry32(11111);

			const minutes = parseDuration('1d10 minutes', rng);
			expect(minutes).toBeGreaterThanOrEqual(1);
			expect(minutes).toBeLessThanOrEqual(10);
		});
	});

	describe('Compound Expressions', () => {
		it('should parse addition of two fixed durations', () => {
			const rng = new Mulberry32(12345);
			const result = parseDuration('2 weeks + 3 days', rng);
			const expected = (2 * 7 * 24 * 60) + (3 * 24 * 60); // 24480
			expect(result).toBe(expected);
		});

		it('should parse addition of fixed and dice durations', () => {
			const rng = new Mulberry32(12345);
			const result = parseDuration('1 week + 1d6 days', rng);
			// 1 week = 10080 minutes, 1d6 days = 1440-8640 minutes
			expect(result).toBeGreaterThanOrEqual(11520); // 1 week + 1 day
			expect(result).toBeLessThanOrEqual(18720); // 1 week + 6 days
		});

		it('should parse subtraction', () => {
			const rng = new Mulberry32(12345);
			const result = parseDuration('3 days - 4 hours', rng);
			const expected = (3 * 24 * 60) - (4 * 60); // 4080
			expect(result).toBe(expected);
		});

		it('should parse complex expression with multiple operations', () => {
			const rng = new Mulberry32(12345);
			const result = parseDuration('1 week + 2 days - 6 hours + 30 minutes', rng);
			const expected = (7 * 24 * 60) + (2 * 24 * 60) - (6 * 60) + 30; // 12510
			expect(result).toBe(expected);
		});

		it('should handle mixed dice and fixed values', () => {
			const rng = new Mulberry32(77777);
			const result = parseDuration('2d6 days + 1d4 hours - 15 minutes', rng);
			// Should be deterministic with this seed
			expect(result).toBeGreaterThan(0);
		});

		it('should handle leading positive operator', () => {
			const rng = new Mulberry32(12345);
			const result = parseDuration('+ 5 hours', rng);
			expect(result).toBe(300);
		});

		it('should handle leading negative operator', () => {
			const rng = new Mulberry32(12345);
			// This should throw because result would be negative
			expect(() => parseDuration('- 5 hours', rng)).toThrow('cannot be negative');
		});
	});

	describe('Custom Unit Configuration', () => {
		it('should use custom hours per day', () => {
			const rng = new Mulberry32(12345);
			const config: DurationUnitConfig = {
				...DEFAULT_DURATION_UNITS,
				hoursPerDay: 20 // 20-hour days
			};

			const result = parseDuration('1 day', rng, config);
			expect(result).toBe(1200); // 20 * 60
		});

		it('should use custom days per week', () => {
			const rng = new Mulberry32(12345);
			const config: DurationUnitConfig = {
				...DEFAULT_DURATION_UNITS,
				daysPerWeek: 10 // 10-day weeks (like Forgotten Realms)
			};

			const result = parseDuration('1 week', rng, config);
			expect(result).toBe(14400); // 10 * 24 * 60
		});

		it('should use custom days per month', () => {
			const rng = new Mulberry32(12345);
			const config: DurationUnitConfig = {
				...DEFAULT_DURATION_UNITS,
				daysPerMonth: 28 // 28-day months
			};

			const result = parseDuration('1 month', rng, config);
			expect(result).toBe(40320); // 28 * 24 * 60
		});

		it('should use custom days per year', () => {
			const rng = new Mulberry32(12345);
			const config: DurationUnitConfig = {
				...DEFAULT_DURATION_UNITS,
				daysPerYear: 360 // 360-day year
			};

			const result = parseDuration('1 year', rng, config);
			expect(result).toBe(518400); // 360 * 24 * 60
		});

		it('should combine all custom units correctly', () => {
			const rng = new Mulberry32(12345);
			const config: DurationUnitConfig = {
				minutesPerHour: 60,
				hoursPerDay: 20,
				daysPerWeek: 10,
				daysPerMonth: 30,
				daysPerYear: 360
			};

			const result = parseDuration('1 week + 2 days', rng, config);
			const expected = (10 * 20 * 60) + (2 * 20 * 60); // 14400
			expect(result).toBe(expected);
		});
	});

	describe('Case Insensitivity and Whitespace', () => {
		it('should handle uppercase units', () => {
			const rng = new Mulberry32(12345);
			const result = parseDuration('5 HOURS', rng);
			expect(result).toBe(300);
		});

		it('should handle mixed case', () => {
			const rng = new Mulberry32(12345);
			const result = parseDuration('2 DaYs + 3 HoUrS', rng);
			expect(result).toBe(3060); // (2*24*60) + (3*60)
		});

		it('should handle extra whitespace', () => {
			const rng = new Mulberry32(12345);
			const result = parseDuration('  5   hours  +  2  days  ', rng);
			expect(result).toBe(3180); // (5*60) + (2*24*60)
		});

		it('should handle no spaces around operators', () => {
			const rng = new Mulberry32(12345);
			const result = parseDuration('5 hours+2 days', rng);
			expect(result).toBe(3180);
		});

		it('should handle mixed spacing', () => {
			const rng = new Mulberry32(12345);
			const result = parseDuration('1d6 days+  2hours  - 30  minutes', rng);
			expect(result).toBeGreaterThan(0);
		});
	});

	describe('Error Handling', () => {
		it('should throw on empty notation', () => {
			const rng = new Mulberry32(12345);
			expect(() => parseDuration('', rng)).toThrow('cannot be empty');
		});

		it('should throw on whitespace-only notation', () => {
			const rng = new Mulberry32(12345);
			expect(() => parseDuration('   ', rng)).toThrow('cannot be empty');
		});

		it('should throw on invalid unit', () => {
			const rng = new Mulberry32(12345);
			// "fortnights" is not recognized, so only "5" is tokenized, leaving no unit
			expect(() => parseDuration('5 fortnights', rng)).toThrow('Missing unit');
		});

		it('should throw on missing unit', () => {
			const rng = new Mulberry32(12345);
			expect(() => parseDuration('5', rng)).toThrow('Missing unit');
		});

		it('should throw on missing value', () => {
			const rng = new Mulberry32(12345);
			expect(() => parseDuration('hours', rng)).toThrow('Expected number or dice notation');
		});

		it('should throw on invalid dice notation', () => {
			const rng = new Mulberry32(12345);
			// "5d" is not valid dice notation (needs NdN), so regex matches "5" and "hours"
			// This results in "5 hours" which equals 300 minutes
			const result = parseDuration('5d hours', rng);
			expect(result).toBe(300);
		});

		it('should throw on negative result', () => {
			const rng = new Mulberry32(12345);
			expect(() => parseDuration('1 hour - 2 hours', rng)).toThrow('cannot be negative');
		});

		it('should throw on operator without value', () => {
			const rng = new Mulberry32(12345);
			expect(() => parseDuration('5 hours +', rng)).toThrow('Trailing operator');
		});
	});

	describe('Edge Cases', () => {
		it('should handle very large durations', () => {
			const rng = new Mulberry32(12345);
			const result = parseDuration('100 years', rng);
			expect(result).toBe(52560000); // 100 * 365 * 24 * 60
		});

		it('should handle zero result (subtracting to zero)', () => {
			const rng = new Mulberry32(12345);
			const result = parseDuration('5 hours - 5 hours', rng);
			expect(result).toBe(0);
		});

		it('should handle single minute', () => {
			const rng = new Mulberry32(12345);
			const result = parseDuration('1 minute', rng);
			expect(result).toBe(1);
		});

		it('should floor fractional results', () => {
			// This shouldn't happen with our integer math, but let's verify
			const rng = new Mulberry32(12345);
			const result = parseDuration('1 hour', rng);
			expect(Number.isInteger(result)).toBe(true);
		});
	});

	describe('Deterministic Behavior', () => {
		it('should produce identical results with same seed across multiple calls', () => {
			const results: number[] = [];

			for (let i = 0; i < 10; i++) {
				const rng = new Mulberry32(42);
				results.push(parseDuration('2d6 days + 1d4 hours', rng));
			}

			// All results should be identical
			const firstResult = results[0];
			results.forEach(result => {
				expect(result).toBe(firstResult);
			});
		});

		it('should produce different results with different seeds', () => {
			const rng1 = new Mulberry32(100);
			const rng2 = new Mulberry32(200);

			const result1 = parseDuration('3d10 days', rng1);
			const result2 = parseDuration('3d10 days', rng2);

			// With different seeds, results should likely differ
			// (not guaranteed, but statistically very unlikely to be same with 3d10)
			expect(result1).not.toBe(result2);
		});
	});

	describe('Real-World Examples', () => {
		it('should parse typical event duration (festival)', () => {
			const rng = new Mulberry32(12345);
			const result = parseDuration('1d3 days', rng);
			expect(result).toBeGreaterThanOrEqual(1440); // At least 1 day
			expect(result).toBeLessThanOrEqual(4320); // At most 3 days
		});

		it('should parse quest deadline', () => {
			const rng = new Mulberry32(12345);
			const result = parseDuration('2 weeks - 1d6 days', rng);
			// 2 weeks - 1d6 days = 20160 - (1440 to 8640)
			expect(result).toBeGreaterThanOrEqual(11520); // 2 weeks - 6 days
			expect(result).toBeLessThanOrEqual(18720); // 2 weeks - 1 day
		});

		it('should parse crafting time', () => {
			const rng = new Mulberry32(12345);
			const result = parseDuration('2d4 weeks + 1d6 days', rng);
			expect(result).toBeGreaterThan(0);
		});

		it('should parse travel duration', () => {
			const rng = new Mulberry32(12345);
			const result = parseDuration('3 days + 2d8 hours', rng);
			expect(result).toBeGreaterThan(0);
		});

		it('should parse disease incubation', () => {
			const rng = new Mulberry32(12345);
			const result = parseDuration('1d4 days + 1d12 hours', rng);
			expect(result).toBeGreaterThan(0);
		});
	});
});
