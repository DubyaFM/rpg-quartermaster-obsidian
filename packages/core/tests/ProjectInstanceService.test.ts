import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectInstanceService } from '../services/ProjectInstanceService';
import { ProjectInstance, ProjectTemplate } from '../models/types';

// Mock adapter
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
}

describe('ProjectInstanceService', () => {
	let service: ProjectInstanceService;
	let adapter: MockProjectStateAdapter;

	const mockTemplate: ProjectTemplate = {
		id: 'template_1',
		name: 'Test Template',
		outcomeType: 'item',
		fundsCostStrategy: { type: 'fixed', fixedCost: { cp: 0, sp: 0, gp: 100, pp: 0 } },
		consumesMaterials: false,
		durationStrategy: { type: 'fixed', fixedDays: 5 },
		automaticSuccess: true,
		createdDate: Date.now()
	};

	beforeEach(() => {
		adapter = new MockProjectStateAdapter();
		service = new ProjectInstanceService(adapter);
	});

	describe('instance loading', () => {
		it('should load instances from adapter', async () => {
			const mockInstance: ProjectInstance = {
				id: 'instance_1',
				templateId: 'template_1',
				name: 'Test Project',
				assignedTo: ['Player1'],
				status: 'in_progress',
				totalDays: 5,
				remainingDays: 5,
				daysWorkedByPlayer: { 'Player1': 0 },
				fundsCost: { cp: 0, sp: 0, gp: 100, pp: 0 },
				outcome: { type: 'item', itemName: 'Test Item', itemQuantity: 1 },
				createdDate: Date.now()
			};

			await adapter.saveInstance(mockInstance);
			await service.loadInstances();

			const instance = service.getInstance('instance_1');
			expect(instance).toBeDefined();
			expect(instance?.name).toBe('Test Project');
		});
	});

	describe('instance creation', () => {
		it('should create new instance from template', async () => {
			await service.loadInstances();

			const instance = await service.createInstance(
				mockTemplate,
				{
					name: 'My Project',
					assignedTo: ['Player1', 'Player2'],
					resolvedCost: { cp: 0, sp: 0, gp: 100, pp: 0 },
					resolvedDuration: 5,
					outcome: { type: 'item', itemName: 'Magic Sword', itemQuantity: 1 }
				},
				100  // currentDay
			);

			expect(instance.name).toBe('My Project');
			expect(instance.assignedTo).toEqual(['Player1', 'Player2']);
			expect(instance.totalDays).toBe(5);
			expect(instance.remainingDays).toBe(5);
			expect(instance.status).toBe('pending');
			expect(instance.startDay).toBeUndefined();
		});

		it('should initialize daysWorkedByPlayer for all assigned players', async () => {
			await service.loadInstances();

			const instance = await service.createInstance(
				mockTemplate,
				{
					assignedTo: ['Player1', 'Player2', 'Player3'],
					resolvedCost: { cp: 0, sp: 0, gp: 100, pp: 0 },
					resolvedDuration: 5,
					outcome: { type: 'item', itemName: 'Test Item', itemQuantity: 1 }
				},
				100
			);

			expect(instance.daysWorkedByPlayer).toHaveProperty('Player1');
			expect(instance.daysWorkedByPlayer).toHaveProperty('Player2');
			expect(instance.daysWorkedByPlayer).toHaveProperty('Player3');
			expect(instance.daysWorkedByPlayer['Player1']).toBe(0);
		});
	});

	describe('instance lifecycle', () => {
		it('should start pending instance', async () => {
			await service.loadInstances();

			const instance = await service.createInstance(
				mockTemplate,
				{
					assignedTo: ['Player1'],
					resolvedCost: { cp: 0, sp: 0, gp: 100, pp: 0 },
					resolvedDuration: 5,
					outcome: { type: 'item', itemName: 'Test Item', itemQuantity: 1 }
				},
				100
			);

			await service.startInstance(instance.id, 105);

			const started = service.getInstance(instance.id);
			expect(started?.status).toBe('in_progress');
			expect(started?.startDay).toBe(105);
		});

		it('should complete instance and delete it', async () => {
			await service.loadInstances();

			const instance = await service.createInstance(
				mockTemplate,
				{
					assignedTo: ['Player1'],
					resolvedCost: { cp: 0, sp: 0, gp: 100, pp: 0 },
					resolvedDuration: 5,
					outcome: { type: 'item', itemName: 'Test Item', itemQuantity: 1 }
				},
				100
			);

			await service.startInstance(instance.id, 100);
			await service.completeInstance(instance.id, 105);

			const completed = service.getInstance(instance.id);
			expect(completed).toBeNull();  // Auto-deleted
		});

		it('should fail instance and delete it', async () => {
			await service.loadInstances();

			const instance = await service.createInstance(
				mockTemplate,
				{
					assignedTo: ['Player1'],
					resolvedCost: { cp: 0, sp: 0, gp: 100, pp: 0 },
					resolvedDuration: 5,
					outcome: { type: 'item', itemName: 'Test Item', itemQuantity: 1 }
				},
				100
			);

			await service.startInstance(instance.id, 100);
			await service.failInstance(instance.id, 103, 'Failed checks');

			const failed = service.getInstance(instance.id);
			expect(failed).toBeNull();  // Auto-deleted
		});

		it('should cancel instance and delete it', async () => {
			await service.loadInstances();

			const instance = await service.createInstance(
				mockTemplate,
				{
					assignedTo: ['Player1'],
					resolvedCost: { cp: 0, sp: 0, gp: 100, pp: 0 },
					resolvedDuration: 5,
					outcome: { type: 'item', itemName: 'Test Item', itemQuantity: 1 }
				},
				100
			);

			await service.cancelInstance(instance.id);

			const cancelled = service.getInstance(instance.id);
			expect(cancelled).toBeNull();  // Auto-deleted
		});
	});

	describe('instance progress updates', () => {
		it('should update instance progress', async () => {
			await service.loadInstances();

			const instance = await service.createInstance(
				mockTemplate,
				{
					assignedTo: ['Player1'],
					resolvedCost: { cp: 0, sp: 0, gp: 100, pp: 0 },
					resolvedDuration: 5,
					outcome: { type: 'item', itemName: 'Test Item', itemQuantity: 1 }
				},
				100
			);

			await service.startInstance(instance.id, 100);
			await service.updateProgress(instance.id, {
				remainingDays: 3,
				lastWorkedDay: 102,
				daysWorkedByPlayer: { 'Player1': 2 }
			});

			const updated = service.getInstance(instance.id);
			expect(updated?.remainingDays).toBe(3);
			expect(updated?.lastWorkedDay).toBe(102);
			expect(updated?.daysWorkedByPlayer['Player1']).toBe(2);
		});
	});

	describe('querying instances', () => {
		it('should get all instances', async () => {
			await service.loadInstances();

			await service.createInstance(mockTemplate, {
				assignedTo: ['Player1'],
				resolvedCost: { cp: 0, sp: 0, gp: 100, pp: 0 },
				resolvedDuration: 5,
				outcome: { type: 'item', itemName: 'Test Item', itemQuantity: 1 }
			}, 100);

			await service.createInstance(mockTemplate, {
				assignedTo: ['Player2'],
				resolvedCost: { cp: 0, sp: 0, gp: 50, pp: 0 },
				resolvedDuration: 3,
				outcome: { type: 'currency', currencyAmount: { cp: 0, sp: 0, gp: 200, pp: 0 } }
			}, 100);

			const all = service.getAllInstances();
			expect(all).toHaveLength(2);
		});

		it('should get active instances only', async () => {
			await service.loadInstances();

			const instance1 = await service.createInstance(mockTemplate, {
				assignedTo: ['Player1'],
				resolvedCost: { cp: 0, sp: 0, gp: 100, pp: 0 },
				resolvedDuration: 5,
				outcome: { type: 'item', itemName: 'Test Item', itemQuantity: 1 }
			}, 100);

			const instance2 = await service.createInstance(mockTemplate, {
				assignedTo: ['Player2'],
				resolvedCost: { cp: 0, sp: 0, gp: 50, pp: 0 },
				resolvedDuration: 3,
				outcome: { type: 'currency', currencyAmount: { cp: 0, sp: 0, gp: 200, pp: 0 } }
			}, 100);

			await service.startInstance(instance1.id, 100);
			// instance2 remains pending

			const active = service.getActiveInstances();
			expect(active).toHaveLength(1);
			expect(active[0].id).toBe(instance1.id);
		});

		it('should get instances by player', async () => {
			await service.loadInstances();

			await service.createInstance(mockTemplate, {
				assignedTo: ['Player1'],
				resolvedCost: { cp: 0, sp: 0, gp: 100, pp: 0 },
				resolvedDuration: 5,
				outcome: { type: 'item', itemName: 'Test Item', itemQuantity: 1 }
			}, 100);

			await service.createInstance(mockTemplate, {
				assignedTo: ['Player2'],
				resolvedCost: { cp: 0, sp: 0, gp: 50, pp: 0 },
				resolvedDuration: 3,
				outcome: { type: 'currency', currencyAmount: { cp: 0, sp: 0, gp: 200, pp: 0 } }
			}, 100);

			await service.createInstance(mockTemplate, {
				assignedTo: ['Player1', 'Player2'],
				resolvedCost: { cp: 0, sp: 0, gp: 75, pp: 0 },
				resolvedDuration: 4,
				outcome: { type: 'item', itemName: 'Shared Item', itemQuantity: 1 }
			}, 100);

			const player1Projects = service.getInstancesByPlayer('Player1');
			expect(player1Projects).toHaveLength(2);

			const player2Projects = service.getInstancesByPlayer('Player2');
			expect(player2Projects).toHaveLength(2);
		});
	});

	describe('instance summaries', () => {
		it('should generate instance summaries', async () => {
			await service.loadInstances();

			const instance = await service.createInstance(
				mockTemplate,
				{
					name: 'My Project',
					assignedTo: ['Player1'],
					resolvedCost: { cp: 0, sp: 0, gp: 100, pp: 0 },
					resolvedDuration: 5,
					outcome: { type: 'item', itemName: 'Magic Sword', itemQuantity: 1 }
				},
				100
			);

			await service.startInstance(instance.id, 100);

			const summaries = service.getInstanceSummaries();
			expect(summaries).toHaveLength(1);
			expect(summaries[0].id).toBe(instance.id);
			expect(summaries[0].name).toBe('My Project');
			expect(summaries[0].status).toBe('in_progress');
			expect(summaries[0].assignedTo).toEqual(['Player1']);
		});
	});
});
