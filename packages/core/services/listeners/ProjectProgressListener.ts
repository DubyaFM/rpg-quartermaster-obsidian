/**
 * ProjectProgressListener - Processes project progress when time advances
 *
 * Listens to TimeAdvanced events from EventBus and:
 * - Advances progress on active project instances
 * - Handles success/failure checks for projects requiring them
 * - Processes outcomes when projects complete
 * - Supports time budgeting for multi-project allocation
 *
 * Event Listener: Subscribes to TimeAdvanced events via EventBus
 */

import { EventBus } from '../EventBus';
import { ProjectInstanceService } from '../ProjectInstanceService';
import { ProjectProgressService } from '../ProjectProgressService';
import { ProjectOutcomeProcessor } from '../ProjectOutcomeProcessor';
import type { CurrencyConfig } from '../../models/currency-config.js';
import {
	TimeAdvancedEvent,
	ProjectProgressInput,
	ProjectProgressUpdate,
	ProjectInstance
} from '../../models/types';
import { SYSTEM_EVENTS } from '../../models/events';

/**
 * Project progress summary - Result shown to user after time advances
 */
export interface ProjectProgressSummary {
	updates: ProjectProgressUpdate[];
	completedProjects: Array<{
		instance: ProjectInstance;
		outcome: string;  // Human-readable outcome description
	}>;
	failedProjects: Array<{
		instanceId: string;
		name: string;
		reason: string;
	}>;
	warnings: string[];  // Time limit warnings, missing materials, etc.
}

export class ProjectProgressListener {
	private enabled: boolean = false;
	private unsubscribe?: () => void;
	private pendingInput?: ProjectProgressInput;
	private lastSummary?: ProjectProgressSummary;
	private config: CurrencyConfig;

	/**
	 * Initialize ProjectProgressListener with event bus and services
	 * @param eventBus Event bus for subscribing to time advancement
	 * @param instanceService Service for managing project instances
	 * @param progressService Service for calculating project progress
	 * @param outcomeProcessor Service for handling project outcomes (receives config)
	 * @param config Currency configuration defining denominations and conversion rates
	 * @param activityLogService Optional service for logging project completions
	 * @param notifyCallback Optional callback for user notifications
	 */
	constructor(
		private eventBus: EventBus,
		private instanceService: ProjectInstanceService,
		private progressService: ProjectProgressService,
		private outcomeProcessor: ProjectOutcomeProcessor,
		config: CurrencyConfig,
		private activityLogService?: any,
		private notifyCallback?: (message: string, title?: string) => void
	) {
		this.config = config;
	}

	/**
	 * Enable event listener (subscribe to TimeAdvanced)
	 */
	enable(): void {
		if (this.enabled) {
			return;
		}

		this.unsubscribe = this.eventBus.subscribe<TimeAdvancedEvent>(
			SYSTEM_EVENTS.TIME_ADVANCED,
			this.handleTimeAdvanced.bind(this)
		);

		this.enabled = true;
		console.log('[ProjectProgressListener] Enabled');
	}

	/**
	 * Disable event listener (unsubscribe from TimeAdvanced)
	 */
	disable(): void {
		if (!this.enabled) {
			return;
		}

		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = undefined;
		}

		this.enabled = false;
		console.log('[ProjectProgressListener] Disabled');
	}

	/**
	 * Set progress input data before time advances
	 * Called by UI layer after collecting user input for success checks and time allocation
	 *
	 * @param input Progress input data (allocations, success results)
	 */
	setProgressInput(input: ProjectProgressInput): void {
		this.pendingInput = input;
		console.log('[ProjectProgressListener] Progress input set for next time advance');
	}

	/**
	 * Clear pending input data
	 */
	clearProgressInput(): void {
		this.pendingInput = undefined;
	}

	/**
	 * Get the last progress summary
	 * Can be used by UI to display results after time advances
	 */
	getLastSummary(): ProjectProgressSummary | undefined {
		return this.lastSummary;
	}

	/**
	 * Handle TimeAdvanced event
	 * Processes active projects using pending input or automatic success
	 *
	 * @param event TimeAdvanced event payload
	 */
	private async handleTimeAdvanced(event: TimeAdvancedEvent): Promise<void> {
		try {
			console.log(`[ProjectProgressListener] Processing time advance: ${event.daysPassed} days (day ${event.previousDay} → ${event.newDay})`);

			// Get active projects
			const activeProjects = this.instanceService.getActiveInstances();

			if (activeProjects.length === 0) {
				console.log('[ProjectProgressListener] No active projects to process');
				return;
			}

			console.log(`[ProjectProgressListener] Processing ${activeProjects.length} active project(s)`);

			// Generate input if not provided (automatic success for all)
			const input = this.pendingInput || this.generateAutomaticInput(activeProjects, event.daysPassed);

			// Process projects
			const summary = await this.processProjects(activeProjects, event, input);

			// Store summary
			this.lastSummary = summary;

			// Notify if enabled
			if (this.notifyCallback && summary.completedProjects.length > 0) {
				const completedNames = summary.completedProjects.map(p => p.instance.name).join(', ');
				this.notifyCallback(
					`${summary.completedProjects.length} project(s) completed: ${completedNames}`,
					'Projects Complete'
				);
			}

			// Clear pending input
			this.pendingInput = undefined;

			console.log('[ProjectProgressListener] Processing complete');
		} catch (error) {
			console.error('[ProjectProgressListener] Error processing time advance:', error);
			if (this.notifyCallback) {
				this.notifyCallback('Error processing project progress. Check console for details.', 'Project Error');
			}
		}
	}

	/**
	 * Process project progress for all active projects
	 *
	 * @param activeProjects List of active project instances
	 * @param event TimeAdvanced event
	 * @param input Progress input data
	 * @returns Progress summary
	 */
	private async processProjects(
		activeProjects: ProjectInstance[],
		event: TimeAdvancedEvent,
		input: ProjectProgressInput
	): Promise<ProjectProgressSummary> {
		const summary: ProjectProgressSummary = {
			updates: [],
			completedProjects: [],
			failedProjects: [],
			warnings: []
		};

		// Process each project
		for (const instance of activeProjects) {
			try {
				const daysAllocated = input.allocations.get(instance.id) || event.daysPassed;
				const wasSuccessful = input.successResults?.get(instance.id) ?? true;

				// Calculate progress
				const update = this.progressService.processProgress(
					instance,
					daysAllocated,
					wasSuccessful
				);

				summary.updates.push(update);

				// Update success/failure tracking
				const newSuccessfulDays = (instance.successfulDays || 0) + (wasSuccessful ? daysAllocated : 0);
				const newFailedDays = (instance.failedDays || 0) + (wasSuccessful ? 0 : daysAllocated);

				// Update days worked by player (simplified - splits equally among assigned players)
				const daysWorkedByPlayer = { ...instance.daysWorkedByPlayer };
				const daysPerPlayer = update.daysWorked / instance.assignedTo.length;
				for (const playerName of instance.assignedTo) {
					daysWorkedByPlayer[playerName] = (daysWorkedByPlayer[playerName] || 0) + daysPerPlayer;
				}

				// Update instance progress
				await this.instanceService.updateProgress(instance.id, {
					remainingDays: update.newRemainingDays,
					lastWorkedDay: event.newDay,
					successfulDays: newSuccessfulDays,
					failedDays: newFailedDays,
					daysWorkedByPlayer
				});

				// Handle completion
				if (update.completed) {
					console.log(`[ProjectProgressListener] Project completed: ${instance.name}`);

					// Process outcome
					let outcomeDescription = '';
					if (instance.outcome) {
						await this.outcomeProcessor.processOutcome(instance, instance.outcome);

						outcomeDescription = this.formatOutcome(instance.outcome);
						summary.completedProjects.push({
							instance,
							outcome: outcomeDescription
						});
					}

					// Log to activity log
					if (this.activityLogService) {
						await this.activityLogService.logProjectCompleted({
							projectName: instance.name,
							projectId: instance.id,
							totalDaysSpent: (instance.successfulDays || 0) + (instance.failedDays || 0),
							outcome: instance.outcome ? {
								type: instance.outcome.type,
								itemName: instance.outcome.itemName,
								currencyAmount: instance.outcome.currencyAmount,
								notes: outcomeDescription
							} : undefined,
							gameDate: event.formattedDate
						});
					}

					// Complete instance (auto-deletes)
					await this.instanceService.completeInstance(instance.id, event.newDay);
				}

				// Check for time limit warnings (only for in-progress projects)
				if (!update.completed && instance.timeLimit && instance.startDay) {
					const daysElapsed = event.newDay - instance.startDay;
					const daysRemaining = instance.timeLimit - daysElapsed;

					if (daysRemaining <= 2 && daysRemaining > 0) {
						summary.warnings.push(
							`Project "${instance.name}" has ${daysRemaining} day(s) until time limit`
						);
					} else if (daysRemaining <= 0) {
						summary.warnings.push(
							`Project "${instance.name}" has exceeded time limit!`
						);
					}
				}

				// Check for success threshold completion
				if (!update.completed && instance.totalSuccessesRequired) {
					if (newSuccessfulDays >= instance.totalSuccessesRequired) {
						summary.warnings.push(
							`Project "${instance.name}" has met success threshold (${newSuccessfulDays}/${instance.totalSuccessesRequired})`
						);
					}
				}
			} catch (error) {
				console.error(`[ProjectProgressListener] Error processing project ${instance.id}:`, error);
				summary.failedProjects.push({
					instanceId: instance.id,
					name: instance.name,
					reason: error instanceof Error ? error.message : 'Unknown error'
				});
			}
		}

		return summary;
	}

	/**
	 * Generate automatic input for projects (assumes all succeed, equal time allocation)
	 *
	 * @param projects Active projects
	 * @param daysPassed Total days that passed
	 * @returns Automatic progress input
	 */
	private generateAutomaticInput(
		projects: ProjectInstance[],
		daysPassed: number
	): ProjectProgressInput {
		const allocations = new Map<string, number>();
		const successResults = new Map<string, boolean>();

		for (const project of projects) {
			allocations.set(project.id, daysPassed);
			successResults.set(project.id, true);  // Automatic success
		}

		return {
			allocations,
			successResults
		};
	}

	/**
	 * Format outcome for display
	 *
	 * @param outcome Project outcome
	 * @returns Human-readable description
	 */
	private formatOutcome(outcome: any): string {
		switch (outcome.type) {
			case 'item':
				return `Gained ${outcome.itemQuantity || 1}x ${outcome.itemName}`;
			case 'gold':
				return `Gained ${this.formatCurrency(outcome.currencyAmount)}`;
			case 'information':
				return `Discovered: ${outcome.informationTitle}`;
			case 'other':
				return outcome.customOutcome || 'Project completed';
			default:
				return 'Project completed';
		}
	}

	/**
	 * Format currency for display
	 */
	private formatCurrency(cost: { copper: number; silver: number; gold: number; platinum: number }): string {
		const parts: string[] = [];

		if (cost.platinum > 0) parts.push(`${cost.platinum} pp`);
		if (cost.gold > 0) parts.push(`${cost.gold} gp`);
		if (cost.silver > 0) parts.push(`${cost.silver} sp`);
		if (cost.copper > 0) parts.push(`${cost.copper} cp`);

		return parts.length > 0 ? parts.join(', ') : '0 cp';
	}

	/**
	 * Check if listener is enabled
	 */
	isEnabled(): boolean {
		return this.enabled;
	}
}
