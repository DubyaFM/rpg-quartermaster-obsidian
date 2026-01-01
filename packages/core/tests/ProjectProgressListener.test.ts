import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../services/EventBus';
import { ProjectProgressListener } from '../services/listeners/ProjectProgressListener';
import { ProjectInstanceService } from '../services/ProjectInstanceService';
import { ProjectProgressService } from '../services/ProjectProgressService';
import { ProjectOutcomeProcessor } from '../services/ProjectOutcomeProcessor';
import { getDefaultCurrencyConfig } from '../data/defaultCurrencyConfig.js';
import type { CurrencyConfig } from '../models/currency-config.js';
import { SYSTEM_EVENTS } from '../models/events';
import { TimeAdvancedEvent, ProjectInstance, ProjectProgressInput } from '../models/types';

// Mock adapter for ProjectInstanceService
class MockProjectStateAdapter {
	private instances: Map<string, ProjectInstance> = new Map();

	async loadInstances(): Promise<ProjectInstance[]> {
		return Array.from(this.instances.values());
	}

	async saveInstance(instance: ProjectInstance): Promise<void> {
		this.instances.set(instance.id, instance);
	}

	async deleteInstance(id: string): Promise<void> {
		this.instances.delete(id);
	}

	async instanceExists(id: string): Promise<boolean> {
		return this.instances.has(id);
	}

	getStoragePath(): string {
		return '/mock/projects';
	}

	// Helper for tests
	addInstance(instance: ProjectInstance): void {
		this.instances.set(instance.id, instance);
	}
}

describe('ProjectProgressListener', () => {
	let eventBus: EventBus;
	let instanceService: ProjectInstanceService;
	let progressService: ProjectProgressService;
	let outcomeProcessor: ProjectOutcomeProcessor;
	let listener: ProjectProgressListener;
	let mockAdapter: MockProjectStateAdapter;
	let notifySpy: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		const currencyConfig = getDefaultCurrencyConfig();
		eventBus = new EventBus();
		mockAdapter = new MockProjectStateAdapter();
		instanceService = new ProjectInstanceService(mockAdapter);
		progressService = new ProjectProgressService();

		// Mock outcome processor
		const mockInventoryUpdater = vi.fn();
		const mockNoteCreator = vi.fn();
		const mockNotifier = vi.fn();
		outcomeProcessor = new ProjectOutcomeProcessor(
			mockInventoryUpdater,
			mockNoteCreator,
			mockNotifier,
			currencyConfig
		);

		notifySpy = vi.fn();
		listener = new ProjectProgressListener(
			eventBus,
			instanceService,
			progressService,
			outcomeProcessor,
			currencyConfig,
			undefined, // activityLogService not needed for these tests
			notifySpy
		);
	});

	describe('enable and disable', () => {
		it('should enable listener and subscribe to TimeAdvanced events', () => {
			expect(listener.isEnabled()).toBe(false);
			expect(eventBus.getListenerCount(SYSTEM_EVENTS.TIME_ADVANCED)).toBe(0);

			listener.enable();

			expect(listener.isEnabled()).toBe(true);
			expect(eventBus.getListenerCount(SYSTEM_EVENTS.TIME_ADVANCED)).toBe(1);
		});

		it('should disable listener and unsubscribe from events', () => {
			listener.enable();
			expect(eventBus.getListenerCount(SYSTEM_EVENTS.TIME_ADVANCED)).toBe(1);

			listener.disable();

			expect(listener.isEnabled()).toBe(false);
			expect(eventBus.getListenerCount(SYSTEM_EVENTS.TIME_ADVANCED)).toBe(0);
		});

		it('should not subscribe twice if already enabled', () => {
			listener.enable();
			listener.enable();

			expect(eventBus.getListenerCount(SYSTEM_EVENTS.TIME_ADVANCED)).toBe(1);
		});

		it('should not unsubscribe if already disabled', () => {
			listener.disable();

			expect(listener.isEnabled()).toBe(false);
		});
	});

	describe('processing projects with automatic success', () => {
		it('should process active projects when time advances', async () => {
			// Create a mock project
			const mockProject: ProjectInstance = {
				id: 'proj_1',
				templateId: 'template_1',
				name: 'Test Project',
				assignedTo: ['Player1'],
				status: 'in_progress',
				totalDays: 10,
				remainingDays: 10,
				daysWorkedByPlayer: { 'Player1': 0 },
				fundsCost: { cp: 0, sp: 0, gp: 100, pp: 0 },
				outcome: {
					type: 'item',
					itemName: 'Magic Sword',
					itemQuantity: 1
				},
				createdDate: 100,
				startDay: 100
			};

			mockAdapter.addInstance(mockProject);
			await instanceService.loadInstances();

			listener.enable();

			// Emit TimeAdvanced event
			const event: TimeAdvancedEvent = {
				previousDay: 100,
				newDay: 103,
				daysPassed: 3
			};

			eventBus.emit(SYSTEM_EVENTS.TIME_ADVANCED, event);

			// Wait for async processing
			await new Promise(resolve => setTimeout(resolve, 10));

			// Verify project was updated
			const updated = instanceService.getInstance('proj_1');
			expect(updated?.remainingDays).toBe(7);  // 10 - 3 = 7
			expect(updated?.lastWorkedDay).toBe(103);
			expect(updated?.daysWorkedByPlayer['Player1']).toBe(3);
		});

		it('should complete project when remaining days reach zero', async () => {
			const mockProject: ProjectInstance = {
				id: 'proj_1',
				templateId: 'template_1',
				name: 'Test Project',
				assignedTo: ['Player1'],
				status: 'in_progress',
				totalDays: 5,
				remainingDays: 3,
				daysWorkedByPlayer: { 'Player1': 2 },
				fundsCost: { cp: 0, sp: 0, gp: 50, pp: 0 },
				outcome: {
					type: 'currency',
					currencyAmount: { cp: 0, sp: 0, gp: 100, pp: 0 }
				},
				createdDate: 100,
				startDay: 100
			};

			mockAdapter.addInstance(mockProject);
			await instanceService.loadInstances();

			listener.enable();

			const event: TimeAdvancedEvent = {
				previousDay: 102,
				newDay: 105,
				daysPassed: 3
			};

			eventBus.emit(SYSTEM_EVENTS.TIME_ADVANCED, event);

			await new Promise(resolve => setTimeout(resolve, 10));

			// Project should be deleted (auto-delete on completion)
			const updated = instanceService.getInstance('proj_1');
			expect(updated).toBeNull();

			// Summary should show completion
			const summary = listener.getLastSummary();
			expect(summary).toBeDefined();
			expect(summary!.completedProjects).toHaveLength(1);
			expect(summary!.completedProjects[0].instance.id).toBe('proj_1');
		});

		it('should not process if no active projects', async () => {
			listener.enable();

			const event: TimeAdvancedEvent = {
				previousDay: 100,
				newDay: 107,
				daysPassed: 7
			};

			eventBus.emit(SYSTEM_EVENTS.TIME_ADVANCED, event);

			await new Promise(resolve => setTimeout(resolve, 10));

			// No summary should be generated
			const summary = listener.getLastSummary();
			expect(summary).toBeUndefined();
		});
	});

	describe('processing with success checks', () => {
		it('should use provided success results when processing', async () => {
			const mockProject: ProjectInstance = {
				id: 'proj_1',
				templateId: 'template_1',
				name: 'Test Project',
				assignedTo: ['Player1'],
				status: 'in_progress',
				totalDays: 10,
				remainingDays: 10,
				daysWorkedByPlayer: { 'Player1': 0 },
				fundsCost: { cp: 0, sp: 0, gp: 100, pp: 0 },
				successCriteria: 'Roll DC 15 persuasion check',
				successfulDays: 0,
				failedDays: 0,
				outcome: {
					type: 'information',
					informationTitle: 'Secret Knowledge'
				},
				createdDate: 100,
				startDay: 100
			};

			mockAdapter.addInstance(mockProject);
			await instanceService.loadInstances();

			listener.enable();

			// Set input with success results
			const input: ProjectProgressInput = {
				allocations: new Map([['proj_1', 3]]),
				successResults: new Map([['proj_1', false]])  // Failed check
			};

			listener.setProgressInput(input);

			const event: TimeAdvancedEvent = {
				previousDay: 100,
				newDay: 103,
				daysPassed: 3
			};

			eventBus.emit(SYSTEM_EVENTS.TIME_ADVANCED, event);

			await new Promise(resolve => setTimeout(resolve, 10));

			// Project should have no progress (failed check)
			const updated = instanceService.getInstance('proj_1');
			expect(updated?.remainingDays).toBe(10);  // No progress
			expect(updated?.failedDays).toBe(3);  // 3 failed days
			expect(updated?.successfulDays).toBe(0);
		});

		it('should make progress on successful check', async () => {
			const mockProject: ProjectInstance = {
				id: 'proj_1',
				templateId: 'template_1',
				name: 'Test Project',
				assignedTo: ['Player1'],
				status: 'in_progress',
				totalDays: 10,
				remainingDays: 10,
				daysWorkedByPlayer: { 'Player1': 0 },
				fundsCost: { cp: 0, sp: 0, gp: 100, pp: 0 },
				successCriteria: 'Roll DC 15 persuasion check',
				successfulDays: 0,
				failedDays: 0,
				outcome: {
					type: 'other',
					customOutcome: 'Test outcome'
				},
				createdDate: 100,
				startDay: 100
			};

			mockAdapter.addInstance(mockProject);
			await instanceService.loadInstances();

			listener.enable();

			const input: ProjectProgressInput = {
				allocations: new Map([['proj_1', 3]]),
				successResults: new Map([['proj_1', true]])  // Passed check
			};

			listener.setProgressInput(input);

			const event: TimeAdvancedEvent = {
				previousDay: 100,
				newDay: 103,
				daysPassed: 3
			};

			eventBus.emit(SYSTEM_EVENTS.TIME_ADVANCED, event);

			await new Promise(resolve => setTimeout(resolve, 10));

			// Project should have progress
			const updated = instanceService.getInstance('proj_1');
			expect(updated?.remainingDays).toBe(7);  // 10 - 3 = 7
			expect(updated?.successfulDays).toBe(3);  // 3 successful days
			expect(updated?.failedDays).toBe(0);
		});
	});

	describe('time budgeting for multiple projects', () => {
		it('should allocate days according to input allocations', async () => {
			const project1: ProjectInstance = {
				id: 'proj_1',
				templateId: 'template_1',
				name: 'Project 1',
				assignedTo: ['Player1'],
				status: 'in_progress',
				totalDays: 10,
				remainingDays: 10,
				daysWorkedByPlayer: { 'Player1': 0 },
				fundsCost: { cp: 0, sp: 0, gp: 50, pp: 0 },
				outcome: { type: 'other' },
				createdDate: 100,
				startDay: 100
			};

			const project2: ProjectInstance = {
				id: 'proj_2',
				templateId: 'template_2',
				name: 'Project 2',
				assignedTo: ['Player1'],
				status: 'in_progress',
				totalDays: 8,
				remainingDays: 8,
				daysWorkedByPlayer: { 'Player1': 0 },
				fundsCost: { cp: 0, sp: 0, gp: 30, pp: 0 },
				outcome: { type: 'other' },
				createdDate: 100,
				startDay: 100
			};

			mockAdapter.addInstance(project1);
			mockAdapter.addInstance(project2);
			await instanceService.loadInstances();

			listener.enable();

			// Allocate 5 days to project1, 2 days to project2 (out of 7 total)
			const input: ProjectProgressInput = {
				allocations: new Map([
					['proj_1', 5],
					['proj_2', 2]
				])
			};

			listener.setProgressInput(input);

			const event: TimeAdvancedEvent = {
				previousDay: 100,
				newDay: 107,
				daysPassed: 7
			};

			eventBus.emit(SYSTEM_EVENTS.TIME_ADVANCED, event);

			await new Promise(resolve => setTimeout(resolve, 10));

			// Verify allocations
			const updated1 = instanceService.getInstance('proj_1');
			const updated2 = instanceService.getInstance('proj_2');

			expect(updated1?.remainingDays).toBe(5);  // 10 - 5 = 5
			expect(updated2?.remainingDays).toBe(6);  // 8 - 2 = 6
		});
	});

	describe('progress input management', () => {
		it('should set and clear progress input', () => {
			const input: ProjectProgressInput = {
				allocations: new Map([['proj_1', 3]]),
				successResults: new Map([['proj_1', true]])
			};

			listener.setProgressInput(input);
			listener.clearProgressInput();

			// Input should be cleared (no way to directly verify, but won't throw)
			expect(() => listener.clearProgressInput()).not.toThrow();
		});

		it('should clear input after processing', async () => {
			const mockProject: ProjectInstance = {
				id: 'proj_1',
				templateId: 'template_1',
				name: 'Test Project',
				assignedTo: ['Player1'],
				status: 'in_progress',
				totalDays: 10,
				remainingDays: 10,
				daysWorkedByPlayer: { 'Player1': 0 },
				fundsCost: { cp: 0, sp: 0, gp: 100, pp: 0 },
				outcome: { type: 'other' },
				createdDate: 100,
				startDay: 100
			};

			mockAdapter.addInstance(mockProject);
			await instanceService.loadInstances();

			listener.enable();

			const input: ProjectProgressInput = {
				allocations: new Map([['proj_1', 3]]),
				successResults: new Map([['proj_1', true]])
			};

			listener.setProgressInput(input);

			const event: TimeAdvancedEvent = {
				previousDay: 100,
				newDay: 103,
				daysPassed: 3
			};

			eventBus.emit(SYSTEM_EVENTS.TIME_ADVANCED, event);

			await new Promise(resolve => setTimeout(resolve, 10));

			// Emit again without setting new input - should use automatic input
			const event2: TimeAdvancedEvent = {
				previousDay: 103,
				newDay: 106,
				daysPassed: 3
			};

			eventBus.emit(SYSTEM_EVENTS.TIME_ADVANCED, event2);

			await new Promise(resolve => setTimeout(resolve, 10));

			// Should still work (automatic success)
			const updated = instanceService.getInstance('proj_1');
			expect(updated?.remainingDays).toBe(4);  // 10 - 3 - 3 = 4
		});
	});

	describe('notifications and summaries', () => {
		it('should notify when projects complete', async () => {
			const mockProject: ProjectInstance = {
				id: 'proj_1',
				templateId: 'template_1',
				name: 'Completed Project',
				assignedTo: ['Player1'],
				status: 'in_progress',
				totalDays: 3,
				remainingDays: 3,
				daysWorkedByPlayer: { 'Player1': 0 },
				fundsCost: { cp: 0, sp: 0, gp: 50, pp: 0 },
				outcome: {
					type: 'item',
					itemName: 'Magic Shield',
					itemQuantity: 1
				},
				createdDate: 100,
				startDay: 100
			};

			mockAdapter.addInstance(mockProject);
			await instanceService.loadInstances();

			listener.enable();

			const event: TimeAdvancedEvent = {
				previousDay: 100,
				newDay: 103,
				daysPassed: 3
			};

			eventBus.emit(SYSTEM_EVENTS.TIME_ADVANCED, event);

			await new Promise(resolve => setTimeout(resolve, 50));

			// Verify notification was called
			expect(notifySpy).toHaveBeenCalledWith(
				expect.stringContaining('Completed Project'),
				'Projects Complete'
			);
		});

		it('should provide summary with completion details', async () => {
			const mockProject: ProjectInstance = {
				id: 'proj_1',
				templateId: 'template_1',
				name: 'Test Project',
				assignedTo: ['Player1'],
				status: 'in_progress',
				totalDays: 5,
				remainingDays: 5,
				daysWorkedByPlayer: { 'Player1': 0 },
				fundsCost: { cp: 0, sp: 0, gp: 100, pp: 0 },
				outcome: {
					type: 'currency',
					currencyAmount: { cp: 50, sp: 10, gp: 20, pp: 1 }
				},
				createdDate: 100,
				startDay: 100
			};

			mockAdapter.addInstance(mockProject);
			await instanceService.loadInstances();

			listener.enable();

			const event: TimeAdvancedEvent = {
				previousDay: 100,
				newDay: 105,
				daysPassed: 5
			};

			eventBus.emit(SYSTEM_EVENTS.TIME_ADVANCED, event);

			await new Promise(resolve => setTimeout(resolve, 10));

			const summary = listener.getLastSummary();
			expect(summary).toBeDefined();
			expect(summary!.completedProjects).toHaveLength(1);
			expect(summary!.completedProjects[0].outcome).toContain('pp');
			expect(summary!.completedProjects[0].outcome).toContain('gp');
		});
	});
});
