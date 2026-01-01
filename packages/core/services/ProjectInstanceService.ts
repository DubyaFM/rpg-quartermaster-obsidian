import {
	ProjectInstance,
	ProjectInstanceSummary,
	ProjectTemplate,
	ItemCost,
	ProjectOutcome,
	ConsumedMaterial
} from '../models/types';
import { IProjectStateAdapter } from '../interfaces/IProjectStateAdapter';

/**
 * Service for managing project instances
 * Platform-agnostic business logic
 */
export class ProjectInstanceService {
	private instances: Map<string, ProjectInstance>;
	private stateAdapter: IProjectStateAdapter;
	private loaded: boolean = false;
	private generateUUID?: () => string;
	private activityLogService?: any;

	constructor(
		stateAdapter: IProjectStateAdapter,
		generateUUID?: () => string,
		activityLogService?: any
	) {
		this.stateAdapter = stateAdapter;
		this.instances = new Map();
		this.generateUUID = generateUUID;
		this.activityLogService = activityLogService;
	}

	/**
	 * Load all project instances from storage
	 */
	async loadInstances(): Promise<void> {
		const instanceList = await this.stateAdapter.loadInstances();
		this.instances.clear();

		for (const instance of instanceList) {
			this.instances.set(instance.id, instance);
		}

		this.loaded = true;
		console.log(`[ProjectInstanceService] Loaded ${this.instances.size} project instances`);
	}

	/**
	 * Get all instances
	 */
	getAllInstances(): ProjectInstance[] {
		return Array.from(this.instances.values());
	}

	/**
	 * Get instance by ID
	 */
	getInstance(id: string): ProjectInstance | null {
		return this.instances.get(id) || null;
	}

	/**
	 * Get instances by status
	 */
	getInstancesByStatus(status: ProjectInstance['status']): ProjectInstance[] {
		return this.getAllInstances().filter(i => i.status === status);
	}

	/**
	 * Get instances assigned to party member
	 */
	getInstancesByAssignee(memberName: string): ProjectInstance[] {
		return this.getAllInstances().filter(i =>
			i.assignedTo.includes(memberName)
		);
	}

	/**
	 * Get active (in_progress) instances
	 */
	getActiveInstances(): ProjectInstance[] {
		return this.getInstancesByStatus('in_progress');
	}

	/**
	 * Get instances assigned to a specific player
	 */
	getInstancesByPlayer(playerName: string): ProjectInstance[] {
		return this.getAllInstances().filter(instance =>
			instance.assignedTo.includes(playerName)
		);
	}

	/**
	 * Get instance summaries (for browsing)
	 */
	getInstanceSummaries(filters?: {
		assignedTo?: string;
		status?: ProjectInstance['status'];
	}): ProjectInstanceSummary[] {
		let instances = this.getAllInstances();

		// Apply filters
		if (filters) {
			if (filters.assignedTo) {
				instances = instances.filter(i => i.assignedTo.includes(filters.assignedTo!));
			}
			if (filters.status) {
				instances = instances.filter(i => i.status === filters.status);
			}
		}

		return instances.map(instance => this.generateSummary(instance));
	}

	/**
	 * Create new project instance from template
	 */
	async createInstance(
		template: ProjectTemplate,
		instanceData: {
			name?: string;
			assignedTo: string[];  // Multiple players supported
			resolvedCost: ItemCost;
			resolvedDuration: number;
			resolvedCriteria?: string;
			outcome: ProjectOutcome;
			materials?: ConsumedMaterial[];
			totalSuccessesRequired?: number;  // Optional auto-completion threshold
			timeLimit?: number;  // Optional time limit in days
		},
		currentDay: number
	): Promise<ProjectInstance> {
		// Generate unique ID
		const id = this.generateInstanceId();

		// Initialize days worked tracking
		const daysWorkedByPlayer: { [playerName: string]: number } = {};
		for (const playerName of instanceData.assignedTo) {
			daysWorkedByPlayer[playerName] = 0;
		}

		// Create instance
		const instance: ProjectInstance = {
			id,
			templateId: template.id,
			name: instanceData.name || template.name,
			assignedTo: instanceData.assignedTo,
			status: 'pending',
			totalDays: instanceData.resolvedDuration,
			remainingDays: instanceData.resolvedDuration,
			daysWorkedByPlayer,
			currencyCost: instanceData.resolvedCost,
			materialsCost: instanceData.materials,
			successCriteria: instanceData.resolvedCriteria,
			successfulDays: 0,
			failedDays: 0,
			totalSuccessesRequired: instanceData.totalSuccessesRequired,
			timeLimit: instanceData.timeLimit,
			outcome: instanceData.outcome,
			createdDate: currentDay
		};

		// Save via adapter
		await this.stateAdapter.saveInstance(instance);

		// Update in-memory cache
		this.instances.set(instance.id, instance);

		console.log(`[ProjectInstanceService] Created instance: ${instance.id} (${instance.name})`);

		return instance;
	}

	/**
	 * Start a project (change status to in_progress)
	 */
	async startInstance(id: string, startDay: number): Promise<void> {
		const instance = this.instances.get(id);
		if (!instance) {
			throw new Error(`Instance not found: ${id}`);
		}

		if (instance.status !== 'pending') {
			throw new Error(`Cannot start instance ${id}: current status is ${instance.status}`);
		}

		instance.status = 'in_progress';
		instance.startDay = startDay;

		await this.stateAdapter.saveInstance(instance);
		console.log(`[ProjectInstanceService] Started instance: ${id}`);

		// Log to activity log
		if (this.activityLogService) {
			await this.activityLogService.logProjectStarted({
				projectName: instance.name,
				projectId: instance.id,
				templateName: instance.templateId,
				assignedPlayers: instance.assignedTo,
				estimatedDuration: instance.totalDays,
				cost: instance.currencyCost
			});
		}
	}

	/**
	 * Update instance progress (called by ProjectProgressService)
	 */
	async updateProgress(id: string, update: {
		remainingDays: number;
		lastWorkedDay: number;
		successfulDays?: number;
		failedDays?: number;
		daysWorkedByPlayer?: { [playerName: string]: number };
	}): Promise<void> {
		const instance = this.instances.get(id);
		if (!instance) {
			throw new Error(`Instance not found: ${id}`);
		}

		instance.remainingDays = update.remainingDays;
		instance.lastWorkedDay = update.lastWorkedDay;

		if (update.successfulDays !== undefined) {
			instance.successfulDays = update.successfulDays;
		}
		if (update.failedDays !== undefined) {
			instance.failedDays = update.failedDays;
		}
		if (update.daysWorkedByPlayer) {
			instance.daysWorkedByPlayer = update.daysWorkedByPlayer;
		}

		await this.stateAdapter.saveInstance(instance);
	}

	/**
	 * Complete a project
	 */
	async completeInstance(id: string, completedDay: number): Promise<void> {
		const instance = this.instances.get(id);
		if (!instance) {
			throw new Error(`Instance not found: ${id}`);
		}

		instance.status = 'completed';
		instance.completedDate = completedDay;

		// Delete from storage (projects are auto-deleted on completion)
		await this.stateAdapter.deleteInstance(id);

		// Remove from in-memory cache
		this.instances.delete(id);

		console.log(`[ProjectInstanceService] Completed and deleted instance: ${id}`);
	}

	/**
	 * Fail a project
	 */
	async failInstance(id: string, reason?: string): Promise<void> {
		const instance = this.instances.get(id);
		if (!instance) {
			throw new Error(`Instance not found: ${id}`);
		}

		// Calculate days spent before failing
		const daysSpent = (instance.successfulDays || 0) + (instance.failedDays || 0);

		instance.status = 'failed';
		if (reason) {
			instance.notes = (instance.notes || '') + `\nFailed: ${reason}`;
		}

		// Log to activity log before deletion
		if (this.activityLogService) {
			await this.activityLogService.logProjectFailed({
				projectName: instance.name,
				projectId: instance.id,
				daysSpent,
				failureReason: reason
			});
		}

		// Delete from storage (projects are auto-deleted on failure)
		await this.stateAdapter.deleteInstance(id);

		// Remove from in-memory cache
		this.instances.delete(id);

		console.log(`[ProjectInstanceService] Failed and deleted instance: ${id}`);
	}

	/**
	 * Cancel a project
	 */
	async cancelInstance(id: string): Promise<void> {
		const instance = this.instances.get(id);
		if (!instance) {
			throw new Error(`Instance not found: ${id}`);
		}

		instance.status = 'cancelled';

		// Delete from storage (projects are auto-deleted on cancellation)
		await this.stateAdapter.deleteInstance(id);

		// Remove from in-memory cache
		this.instances.delete(id);

		console.log(`[ProjectInstanceService] Cancelled and deleted instance: ${id}`);
	}

	/**
	 * Delete instance
	 */
	async deleteInstance(id: string): Promise<void> {
		await this.stateAdapter.deleteInstance(id);
		this.instances.delete(id);
		console.log(`[ProjectInstanceService] Deleted instance: ${id}`);
	}

	/**
	 * Generate instance summary for display
	 */
	generateSummary(instance: ProjectInstance): ProjectInstanceSummary {
		const progressPercentage = instance.totalDays > 0
			? ((instance.totalDays - instance.remainingDays) / instance.totalDays * 100)
			: 0;

		return {
			id: instance.id,
			name: instance.name,
			assignedTo: instance.assignedTo,
			status: instance.status,
			remainingDays: instance.remainingDays,
			totalDays: instance.totalDays,
			progressPercentage: Math.round(progressPercentage)
		};
	}

	/**
	 * Generate unique instance ID
	 * Uses provided UUID generator if available, otherwise falls back to timestamp-based ID
	 */
	private generateInstanceId(): string {
		if (this.generateUUID) {
			return this.generateUUID();
		}
		// Fallback for backward compatibility
		return `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Check if instances have been loaded
	 */
	isLoaded(): boolean {
		return this.loaded;
	}
}
