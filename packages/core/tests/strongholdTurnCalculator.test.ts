import { describe, it, expect } from 'vitest';
import {
	calculateTurnsPassed,
	shouldTriggerNeglect,
	calculateNeglectGracePeriod,
	calculateNeglectPenalty,
	isStrongholdNeglected,
	calculateNeglectMoralePenalty,
	calculateDaysUntilNextTurn,
	getNeglectSeverity,
	getNeglectRecommendations
} from '../calculators/strongholdTurnCalculator';

describe('Stronghold Turn Calculator', () => {

	describe('calculateTurnsPassed', () => {
		it('should calculate turns passed with 7-day interval', () => {
			expect(calculateTurnsPassed(8, 1, 7)).toBe(1);
			expect(calculateTurnsPassed(15, 1, 7)).toBe(2);
			expect(calculateTurnsPassed(22, 1, 7)).toBe(3);
		});

		it('should handle partial turns', () => {
			expect(calculateTurnsPassed(5, 1, 7)).toBe(0); // Not a full turn yet
			expect(calculateTurnsPassed(10, 1, 7)).toBe(1); // Just over 1 turn
		});

		it('should handle custom turn intervals', () => {
			expect(calculateTurnsPassed(11, 1, 10)).toBe(1);
			expect(calculateTurnsPassed(16, 1, 5)).toBe(3);
		});

		it('should return 0 when no turns passed', () => {
			expect(calculateTurnsPassed(10, 10, 7)).toBe(0);
			expect(calculateTurnsPassed(15, 10, 7)).toBe(0);
		});
	});

	describe('calculateNeglectGracePeriod', () => {
		it('should return correct grace periods for different PC levels', () => {
			expect(calculateNeglectGracePeriod(1)).toBe(1);
			expect(calculateNeglectGracePeriod(4)).toBe(1);
			expect(calculateNeglectGracePeriod(5)).toBe(2);
			expect(calculateNeglectGracePeriod(10)).toBe(2);
			expect(calculateNeglectGracePeriod(11)).toBe(3);
			expect(calculateNeglectGracePeriod(16)).toBe(3);
			expect(calculateNeglectGracePeriod(17)).toBe(4);
			expect(calculateNeglectGracePeriod(20)).toBe(4);
		});

		it('should handle edge cases', () => {
			expect(calculateNeglectGracePeriod(0)).toBe(1);
			expect(calculateNeglectGracePeriod(-1)).toBe(1);
			expect(calculateNeglectGracePeriod(100)).toBe(4);
		});
	});

	describe('shouldTriggerNeglect', () => {
		it('should not trigger within grace period', () => {
			expect(shouldTriggerNeglect(0, 1)).toBe(false);
			expect(shouldTriggerNeglect(1, 1)).toBe(false);
			expect(shouldTriggerNeglect(1, 5)).toBe(false);
			expect(shouldTriggerNeglect(2, 10)).toBe(false);
		});

		it('should trigger after grace period', () => {
			expect(shouldTriggerNeglect(2, 1)).toBe(true); // Level 1-4: grace = 1
			expect(shouldTriggerNeglect(3, 5)).toBe(true); // Level 5-10: grace = 2
			expect(shouldTriggerNeglect(4, 11)).toBe(true); // Level 11-16: grace = 3
			expect(shouldTriggerNeglect(5, 17)).toBe(true); // Level 17-20: grace = 4
		});
	});

	describe('calculateNeglectPenalty', () => {
		it('should return 0 within grace period', () => {
			expect(calculateNeglectPenalty(0, 1)).toBe(0);
			expect(calculateNeglectPenalty(1, 1)).toBe(0);
		});

		it('should calculate penalty after grace period', () => {
			expect(calculateNeglectPenalty(2, 1)).toBe(1); // 2 turns - 1 grace = 1
			expect(calculateNeglectPenalty(5, 5)).toBe(3); // 5 turns - 2 grace = 3
			expect(calculateNeglectPenalty(10, 11)).toBe(7); // 10 turns - 3 grace = 7
		});

		it('should handle large neglect', () => {
			expect(calculateNeglectPenalty(20, 1)).toBe(19); // 20 turns - 1 grace = 19
		});
	});

	describe('isStrongholdNeglected', () => {
		it('should return false when not neglected', () => {
			expect(isStrongholdNeglected(0)).toBe(false);
			expect(isStrongholdNeglected(2)).toBe(false);
		});

		it('should return true when neglected', () => {
			expect(isStrongholdNeglected(3)).toBe(true); // Default threshold is 3
			expect(isStrongholdNeglected(5)).toBe(true);
			expect(isStrongholdNeglected(10)).toBe(true);
		});

		it('should handle threshold edge case', () => {
			expect(isStrongholdNeglected(5, 5)).toBe(true);
			expect(isStrongholdNeglected(4, 5)).toBe(false);
		});
	});

	describe('calculateNeglectMoralePenalty', () => {
		it('should scale morale penalty with neglect', () => {
			expect(calculateNeglectMoralePenalty(0)).toBe(-0); // 0 * -1 = -0
			expect(calculateNeglectMoralePenalty(1)).toBe(-1);
			expect(calculateNeglectMoralePenalty(5)).toBe(-5);
			expect(calculateNeglectMoralePenalty(10)).toBe(-10);
		});

		it('should use custom penalty rate', () => {
			expect(calculateNeglectMoralePenalty(5, -2)).toBe(-10); // 5 * -2 = -10
		});
	});

	describe('calculateDaysUntilNextTurn', () => {
		it('should calculate days until next turn', () => {
			expect(calculateDaysUntilNextTurn(1, 1, 7)).toBe(7); // Current day 1, last turn day 1, 7 days until next
			expect(calculateDaysUntilNextTurn(5, 1, 7)).toBe(3); // Current day 5, last turn day 1, 3 days until day 8
			expect(calculateDaysUntilNextTurn(7, 1, 7)).toBe(1); // Current day 7, last turn day 1, 1 day until day 8
		});

		it('should return full interval when turn cycle completes', () => {
			expect(calculateDaysUntilNextTurn(8, 1, 7)).toBe(7); // New cycle starts
		});

		it('should calculate correctly when past one cycle', () => {
			expect(calculateDaysUntilNextTurn(10, 1, 7)).toBe(5); // 10 - 1 = 9 days, 9 % 7 = 2, 7 - 2 = 5
		});
	});

	describe('getNeglectSeverity', () => {
		it('should return correct severity levels', () => {
			expect(getNeglectSeverity(0)).toBe('None');
			expect(getNeglectSeverity(2)).toBe('Minor');
			expect(getNeglectSeverity(5)).toBe('Moderate');
			expect(getNeglectSeverity(10)).toBe('Severe');
			expect(getNeglectSeverity(20)).toBe('Critical');
		});
	});

	describe('getNeglectRecommendations', () => {
		it('should return well-maintained message for no neglect', () => {
			const recommendations = getNeglectRecommendations(0);
			expect(recommendations.length).toBe(1);
			expect(recommendations[0]).toContain('well-maintained');
		});

		it('should return recommendations for moderate neglect', () => {
			const recommendations = getNeglectRecommendations(3);
			expect(recommendations.length).toBeGreaterThan(0);
			expect(recommendations[0]).toContain('Give orders');
		});

		it('should return more urgent recommendations for severe neglect', () => {
			const recommendations = getNeglectRecommendations(10);
			expect(recommendations.length).toBeGreaterThan(0);
			expect(recommendations.some(r => r.includes('URGENT'))).toBe(true);
		});

		it('should return critical recommendations for critical neglect', () => {
			const recommendations = getNeglectRecommendations(20);
			expect(recommendations.length).toBeGreaterThan(0);
			expect(recommendations.some(r => r.includes('immediate') || r.includes('critical'))).toBe(true);
		});
	});
});
