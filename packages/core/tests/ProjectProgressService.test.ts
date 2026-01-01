import { describe, it, expect } from 'vitest';
import { ProjectProgressService } from '../services/ProjectProgressService';
import { ProjectInstance } from '../models/types';

describe('ProjectProgressService', () => {
	const service = new ProjectProgressService();

	const createMockInstance = (overrides?: Partial<ProjectInstance>): ProjectInstance => ({
		id: 'instance_1',
		templateId: 'template_1',
		name: 'Test Project',
		assignedTo: ['Player1'],
		status: 'in_progress',
		totalDays: 10,
		remainingDays: 10,
		daysWorkedByPlayer: { 'Player1': 0 },
		fundsCost: { cp: 0, sp: 0, gp: 100, pp: 0 },
		outcome: { type: 'item', itemName: 'Test Item', itemQuantity: 1 },
		createdDate: Date.now(),
		...overrides
	});

	describe('progress calculation', () => {
		it('should process progress for automatic success', () => {
			const instance = createMockInstance();

			const result = service.processProgress(instance, 3, true);

			expect(result.instanceId).toBe('instance_1');
			expect(result.previousRemainingDays).toBe(10);
			expect(result.newRemainingDays).toBe(7);
			expect(result.daysWorked).toBe(3);
			expect(result.completed).toBe(false);
		});

		it('should complete project when remaining days reach zero', () => {
			const instance = createMockInstance({ remainingDays: 3 });

			const result = service.processProgress(instance, 3, true);

			expect(result.newRemainingDays).toBe(0);
			expect(result.completed).toBe(true);
			expect(result.outcome).toBeDefined();
		});

		it('should not make progress on failed checks', () => {
			const instance = createMockInstance({
				successCriteria: 'DC 15 check'
			});

			const result = service.processProgress(instance, 3, false);

			expect(result.daysWorked).toBe(0);
			expect(result.newRemainingDays).toBe(10);  // No progress
			expect(result.completed).toBe(false);
		});

		it('should make progress on successful checks', () => {
			const instance = createMockInstance({
				successCriteria: 'DC 15 check'
			});

			const result = service.processProgress(instance, 3, true);

			expect(result.daysWorked).toBe(3);
			expect(result.newRemainingDays).toBe(7);
			expect(result.completed).toBe(false);
		});

		it('should not exceed total days worked', () => {
			const instance = createMockInstance({ remainingDays: 2 });

			const result = service.processProgress(instance, 5, true);

			expect(result.daysWorked).toBe(2);  // Capped at remaining days
			expect(result.newRemainingDays).toBe(0);
			expect(result.completed).toBe(true);
		});
	});

	describe('time budgeting validation', () => {
		it('should validate single player time budget', () => {
			const allocations = new Map([
				['project_1', 3],
				['project_2', 4]
			]);

			const playerAssignments = new Map([
				['project_1', ['Player1']],
				['project_2', ['Player1']]
			]);

			const result = service.validateTimeBudget(allocations, 7, playerAssignments);

			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should reject over-allocated time budget', () => {
			const allocations = new Map([
				['project_1', 5],
				['project_2', 4]
			]);

			const playerAssignments = new Map([
				['project_1', ['Player1']],
				['project_2', ['Player1']]
			]);

			const result = service.validateTimeBudget(allocations, 7, playerAssignments);

			expect(result.valid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});

		it('should validate multi-player time budget', () => {
			const allocations = new Map([
				['project_1', 7],   // Player1 only
				['project_2', 5],   // Player2 only
				['project_3', 3]    // Both players
			]);

			const playerAssignments = new Map([
				['project_1', ['Player1']],
				['project_2', ['Player2']],
				['project_3', ['Player1', 'Player2']]
			]);

			const result = service.validateTimeBudget(allocations, 10, playerAssignments);

			expect(result.valid).toBe(true);
			// Player1: 7 + 3 = 10 ✓
			// Player2: 5 + 3 = 8 ✓
		});

		it('should track allocations by player', () => {
			const allocations = new Map([
				['project_1', 3],
				['project_2', 4]
			]);

			const playerAssignments = new Map([
				['project_1', ['Player1']],
				['project_2', ['Player1']]
			]);

			const result = service.validateTimeBudget(allocations, 7, playerAssignments);

			expect(result.allocationsByPlayer.has('Player1')).toBe(true);
			const player1Allocations = result.allocationsByPlayer.get('Player1');
			expect(player1Allocations?.size).toBe(2);
		});
	});
});
