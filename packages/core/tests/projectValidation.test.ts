import { describe, it, expect } from 'vitest';
import {
	validateCostStrategy,
	validateDurationStrategy,
	validateSuccessCriteriaStrategy,
	validateProjectCompletion,
	hasReachedTimeLimit,
	hasMetSuccessThreshold,
	validateAssignedPlayers
} from '../calculators/projectValidation';
import { ProjectInstance, PurchasedItem } from '../models/types';

describe('projectValidation', () => {
	describe('validateCostStrategy', () => {
		it('should validate "none" cost strategy', () => {
			expect(validateCostStrategy({ type: 'none' })).toBe(true);
		});

		it('should validate fixed cost strategy with cost', () => {
			const strategy = {
				type: 'fixed' as const,
				fixedCost: { cp: 0, sp: 0, gp: 100, pp: 0 }
			};
			expect(validateCostStrategy(strategy)).toBe(true);
		});

		it('should reject fixed cost strategy without cost', () => {
			const strategy = { type: 'fixed' as const };
			expect(validateCostStrategy(strategy)).toBe(false);
		});

		it('should validate variable cost strategy with guidance', () => {
			const strategy = {
				type: 'variable' as const,
				guidanceText: 'Cost varies by level'
			};
			expect(validateCostStrategy(strategy)).toBe(true);
		});

		it('should reject variable cost strategy without guidance', () => {
			const strategy = { type: 'variable' as const };
			expect(validateCostStrategy(strategy)).toBe(false);
		});
	});

	describe('validateDurationStrategy', () => {
		it('should validate fixed duration with days', () => {
			const strategy = {
				type: 'fixed' as const,
				fixedDays: 5
			};
			expect(validateDurationStrategy(strategy)).toBe(true);
		});

		it('should reject fixed duration without days', () => {
			const strategy = { type: 'fixed' as const };
			expect(validateDurationStrategy(strategy)).toBe(false);
		});

		it('should validate variable duration with guidance', () => {
			const strategy = {
				type: 'variable' as const,
				guidanceText: '1 day per level'
			};
			expect(validateDurationStrategy(strategy)).toBe(true);
		});

		it('should reject variable duration without guidance', () => {
			const strategy = { type: 'variable' as const };
			expect(validateDurationStrategy(strategy)).toBe(false);
		});
	});

	describe('validateSuccessCriteriaStrategy', () => {
		it('should validate fixed criteria with text', () => {
			const strategy = {
				type: 'fixed' as const,
				fixedCriteria: 'DC 15 check'
			};
			expect(validateSuccessCriteriaStrategy(strategy)).toBe(true);
		});

		it('should reject fixed criteria without text', () => {
			const strategy = { type: 'fixed' as const };
			expect(validateSuccessCriteriaStrategy(strategy)).toBe(false);
		});

		it('should validate variable criteria with guidance', () => {
			const strategy = {
				type: 'variable' as const,
				guidanceText: 'DC varies'
			};
			expect(validateSuccessCriteriaStrategy(strategy)).toBe(true);
		});
	});

	describe('validateProjectCompletion', () => {
		const createMockInstance = (materials?: any): ProjectInstance => ({
			id: 'instance_1',
			templateId: 'template_1',
			name: 'Test Project',
			assignedTo: ['Player1'],
			status: 'in_progress',
			totalDays: 5,
			remainingDays: 0,
			daysWorkedByPlayer: { 'Player1': 5 },
			fundsCost: { cp: 0, sp: 0, gp: 100, pp: 0 },
			materialsCost: materials,
			outcome: { type: 'item', itemName: 'Test Item', itemQuantity: 1 },
			createdDate: Date.now()
		});

		it('should validate project without materials', () => {
			const instance = createMockInstance();
			const inventory: PurchasedItem[] = [];

			const result = validateProjectCompletion(instance, inventory);

			expect(result.valid).toBe(true);
			expect(result.missingMaterials).toHaveLength(0);
		});

		it('should validate project with available materials', () => {
			const instance = createMockInstance([
				{ itemName: 'Dragon Scale', quantity: 2 }
			]);

			const inventory: PurchasedItem[] = [
				{
					name: 'Dragon Scale',
					cost: { cp: 0, sp: 0, gp: 500, pp: 0 },
					type: 'material',
					rarity: 'rare',
					description: '',
					source: '',
					file: { path: '', name: '' },
					category: 'material',
					quantity: 3
				}
			];

			const result = validateProjectCompletion(instance, inventory);

			expect(result.valid).toBe(true);
			expect(result.missingMaterials).toHaveLength(0);
		});

		it('should detect missing materials', () => {
			const instance = createMockInstance([
				{ itemName: 'Dragon Scale', quantity: 5 }
			]);

			const inventory: PurchasedItem[] = [
				{
					name: 'Dragon Scale',
					cost: { cp: 0, sp: 0, gp: 500, pp: 0 },
					type: 'material',
					rarity: 'rare',
					description: '',
					source: '',
					file: { path: '', name: '' },
					category: 'material',
					quantity: 2  // Not enough
				}
			];

			const result = validateProjectCompletion(instance, inventory);

			expect(result.valid).toBe(false);
			expect(result.missingMaterials).toContain('Dragon Scale (need 5, have 2)');
		});

		it('should detect completely missing materials', () => {
			const instance = createMockInstance([
				{ itemName: 'Unicorn Hair', quantity: 1 }
			]);

			const inventory: PurchasedItem[] = [];

			const result = validateProjectCompletion(instance, inventory);

			expect(result.valid).toBe(false);
			expect(result.missingMaterials).toContain('Unicorn Hair');
		});
	});

	describe('hasReachedTimeLimit', () => {
		const createInstance = (timeLimit?: number, startDay?: number): ProjectInstance => ({
			id: 'instance_1',
			templateId: 'template_1',
			name: 'Test Project',
			assignedTo: ['Player1'],
			status: 'in_progress',
			totalDays: 10,
			remainingDays: 5,
			daysWorkedByPlayer: { 'Player1': 5 },
			fundsCost: { cp: 0, sp: 0, gp: 100, pp: 0 },
			outcome: { type: 'item', itemName: 'Test Item', itemQuantity: 1 },
			createdDate: Date.now(),
			timeLimit,
			startDay
		});

		it('should return false for project without time limit', () => {
			const instance = createInstance();
			expect(hasReachedTimeLimit(instance, 110)).toBe(false);
		});

		it('should return false when under time limit', () => {
			const instance = createInstance(10, 100);
			expect(hasReachedTimeLimit(instance, 105)).toBe(false);
		});

		it('should return true when time limit reached', () => {
			const instance = createInstance(10, 100);
			expect(hasReachedTimeLimit(instance, 110)).toBe(true);
		});

		it('should return true when time limit exceeded', () => {
			const instance = createInstance(10, 100);
			expect(hasReachedTimeLimit(instance, 115)).toBe(true);
		});
	});

	describe('hasMetSuccessThreshold', () => {
		const createInstance = (successfulDays: number, totalRequired?: number): ProjectInstance => ({
			id: 'instance_1',
			templateId: 'template_1',
			name: 'Test Project',
			assignedTo: ['Player1'],
			status: 'in_progress',
			totalDays: 10,
			remainingDays: 5,
			daysWorkedByPlayer: { 'Player1': 5 },
			fundsCost: { cp: 0, sp: 0, gp: 100, pp: 0 },
			successCriteria: 'DC 15 check',
			successfulDays,
			totalSuccessesRequired: totalRequired,
			outcome: { type: 'item', itemName: 'Test Item', itemQuantity: 1 },
			createdDate: Date.now()
		});

		it('should return false for project without threshold', () => {
			const instance = createInstance(5);
			expect(hasMetSuccessThreshold(instance)).toBe(false);
		});

		it('should return false when under threshold', () => {
			const instance = createInstance(3, 5);
			expect(hasMetSuccessThreshold(instance)).toBe(false);
		});

		it('should return true when threshold met', () => {
			const instance = createInstance(5, 5);
			expect(hasMetSuccessThreshold(instance)).toBe(true);
		});

		it('should return true when threshold exceeded', () => {
			const instance = createInstance(7, 5);
			expect(hasMetSuccessThreshold(instance)).toBe(true);
		});
	});

	describe('validateAssignedPlayers', () => {
		const createInstance = (assignedTo: string[]): ProjectInstance => ({
			id: 'instance_1',
			templateId: 'template_1',
			name: 'Test Project',
			assignedTo,
			status: 'in_progress',
			totalDays: 10,
			remainingDays: 5,
			daysWorkedByPlayer: {},
			fundsCost: { cp: 0, sp: 0, gp: 100, pp: 0 },
			outcome: { type: 'item', itemName: 'Test Item', itemQuantity: 1 },
			createdDate: Date.now()
		});

		it('should validate all assigned players exist', () => {
			const instance = createInstance(['Player1', 'Player2']);
			const result = validateAssignedPlayers(instance, ['Player1', 'Player2', 'Player3']);

			expect(result.valid).toBe(true);
			expect(result.invalidPlayers).toHaveLength(0);
		});

		it('should detect invalid player names', () => {
			const instance = createInstance(['Player1', 'InvalidPlayer']);
			const result = validateAssignedPlayers(instance, ['Player1', 'Player2']);

			expect(result.valid).toBe(false);
			expect(result.invalidPlayers).toContain('InvalidPlayer');
		});

		it('should detect multiple invalid players', () => {
			const instance = createInstance(['Player1', 'Invalid1', 'Invalid2']);
			const result = validateAssignedPlayers(instance, ['Player1']);

			expect(result.valid).toBe(false);
			expect(result.invalidPlayers).toHaveLength(2);
			expect(result.invalidPlayers).toContain('Invalid1');
			expect(result.invalidPlayers).toContain('Invalid2');
		});
	});
});
