/**
 * Job Board Manager
 *
 * Central coordinator for job board system
 * Listens to time advance events and manages job lifecycle
 *
 * @module JobBoardManager
 * @packageDocumentation
 */

import { EventBus } from './EventBus';
import { SYSTEM_EVENTS, TimeAdvancedEvent } from '../models/events';
import { JOB_EVENTS, JobStatusChangedEvent, JobStatusChangeReason } from '../models/events/JobEvents';
import { IJobDataAccess } from '../interfaces/IJobDataAccess';
import { IGMNotifier } from '../interfaces/IGMNotifier';
import { JobExpirationService } from './JobExpirationService';
import { Job, JobStatus } from '../models/Job';

/**
 * Job Board Manager configuration
 */
export interface JobBoardManagerConfig {
	/** Whether to auto-expire Posted jobs when availability duration passes */
	autoExpireJobs: boolean;

	/** Whether to show GM notifications for deadline warnings */
	notifyOnDeadlines: boolean;

	/** Whether to show GM notifications for auto-expirations */
	notifyOnExpirations: boolean;
}

/**
 * Job Board Manager
 *
 * Coordinates job board operations and integrates with calendar system
 * Responsibilities:
 * - Listen to TimeAdvanced events
 * - Check for job expirations and deadlines
 * - Update job statuses
 * - Send GM notifications
 * - Emit job lifecycle events
 */
export class JobBoardManager {
	private unsubscribe?: () => void;

	constructor(
		private eventBus: EventBus,
		private jobDataAccess: IJobDataAccess,
		private gmNotifier: IGMNotifier,
		private config: JobBoardManagerConfig
	) {}

	/**
	 * Start listening to calendar events
	 *
	 * Call this during plugin initialization
	 * Safe to call multiple times - will unsubscribe first if already initialized
	 */
	initialize(): void {
		// Unsubscribe first if already initialized (idempotent)
		if (this.unsubscribe) {
			this.shutdown();
		}

		this.unsubscribe = this.eventBus.subscribe<TimeAdvancedEvent>(
			SYSTEM_EVENTS.TIME_ADVANCED,
			(event) => this.handleTimeAdvanced(event)
		);
	}

	/**
	 * Stop listening to calendar events
	 *
	 * Call this during plugin cleanup/unload
	 */
	shutdown(): void {
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = undefined;
		}
	}

	/**
	 * Handle time advance event
	 *
	 * Checks all jobs for expirations and deadlines
	 *
	 * @param event Time advanced event payload
	 */
	private async handleTimeAdvanced(event: TimeAdvancedEvent): Promise<void> {
		try {
			const expirationService = new JobExpirationService();

			// Get all non-archived jobs
			const jobs = await this.jobDataAccess.getAllJobs(false);

			// Check for expirations
			const { expiredJobs, deadlineReachedJobs } = expirationService.checkExpirations(
				jobs,
				event.newDay
			);

			// Handle auto-expired jobs (Posted jobs that passed availability duration)
			if (this.config.autoExpireJobs && expiredJobs.length > 0) {
				await this.handleExpiredJobs(expiredJobs);
			}

			// Handle deadline warnings (Taken jobs that passed completion deadline)
			if (this.config.notifyOnDeadlines && deadlineReachedJobs.length > 0) {
				await this.handleDeadlineWarnings(deadlineReachedJobs);
			}
		} catch (error) {
			console.error('[JobBoardManager] Error handling time advanced event:', error);
			// Don't rethrow - EventBus will handle errors, but log for debugging
		}
	}

	/**
	 * Handle expired jobs
	 *
	 * Updates job statuses to Expired and notifies GM
	 *
	 * @param expiredJobs Jobs that have expired
	 */
	private async handleExpiredJobs(expiredJobs: Job[]): Promise<void> {
		for (const job of expiredJobs) {
			try {
				// Update job status to Expired
				await this.jobDataAccess.updateJobStatus(
					job.filePath!,
					JobStatus.Expired,
					JobStatusChangeReason.AutoExpiredAvailability
				);

				// Notify GM
				const message = `Job "${job.title}" has expired (availability duration ended)`;
				if (this.config.notifyOnExpirations) {
					this.gmNotifier.notifyGM(message, 'Job Expired');
				}

				// Log notification
				await this.gmNotifier.logNotification(message, job.filePath!);

				// Emit job status changed event
				const statusChangedEvent: JobStatusChangedEvent = {
					jobPath: job.filePath!,
					previousStatus: job.status,
					newStatus: JobStatus.Expired,
					job: { ...job, status: JobStatus.Expired },
					timestamp: Date.now(),
					reason: JobStatusChangeReason.AutoExpiredAvailability
				};

				this.eventBus.emit(JOB_EVENTS.STATUS_CHANGED, statusChangedEvent);
			} catch (error) {
				console.error(`[JobBoardManager] Error expiring job "${job.title}":`, error);
				// Continue with next job
			}
		}
	}

	/**
	 * Handle deadline warnings
	 *
	 * Notifies GM about jobs that have passed their completion deadline
	 * Does NOT auto-fail jobs (per user decision - GM input always wins)
	 *
	 * @param deadlineReachedJobs Jobs that have reached their deadline
	 */
	private async handleDeadlineWarnings(deadlineReachedJobs: Job[]): Promise<void> {
		for (const job of deadlineReachedJobs) {
			try {
				// Notify GM (but don't auto-fail)
				const message = `Job "${job.title}" has passed its completion deadline. Review with party to determine outcome.`;
				this.gmNotifier.notifyGM(message, 'Job Deadline Reached');

				// Log notification
				await this.gmNotifier.logNotification(message, job.filePath!);

				// Note: We do NOT emit a status change event here because
				// we're not changing the status - just warning the GM
			} catch (error) {
				console.error(`[JobBoardManager] Error logging deadline warning for job "${job.title}":`, error);
				// Continue with next job
			}
		}
	}

	/**
	 * Manually trigger expiration check
	 *
	 * Useful for:
	 * - Testing
	 * - Manual GM-triggered checks
	 * - Recovery from errors
	 *
	 * @param currentDay Current calendar day to check against
	 */
	async checkExpirations(currentDay: number): Promise<void> {
		const event: TimeAdvancedEvent = {
			previousDay: currentDay,
			newDay: currentDay,
			daysPassed: 0,
			formattedDate: undefined
		};

		await this.handleTimeAdvanced(event);
	}

	/**
	 * Get configuration
	 *
	 * @returns Current configuration
	 */
	getConfig(): JobBoardManagerConfig {
		return { ...this.config };
	}

	/**
	 * Update configuration
	 *
	 * @param config New configuration (partial updates allowed)
	 */
	updateConfig(config: Partial<JobBoardManagerConfig>): void {
		this.config = {
			...this.config,
			...config
		};
	}
}
