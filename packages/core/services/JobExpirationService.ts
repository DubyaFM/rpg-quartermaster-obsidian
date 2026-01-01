/**
 * Job expiration service
 *
 * Checks jobs for expiration and calculates deadlines
 * Platform-agnostic - pure business logic
 *
 * @module JobExpirationService
 * @packageDocumentation
 */

import { Job, JobStatus } from '../models/Job';

/**
 * Result of expiration check
 */
export interface ExpirationCheckResult {
	/** Jobs that should auto-expire (availability duration passed) */
	expiredJobs: Job[];

	/** Jobs that reached completion deadline (notify GM) */
	deadlineReachedJobs: Job[];
}

/**
 * Job expiration service
 *
 * Provides pure functions for checking job expirations
 * and calculating time remaining on jobs
 */
export class JobExpirationService {
	/**
	 * Check all jobs for expiration against current calendar day
	 *
	 * Checks:
	 * - Posted jobs for availability expiration (auto-expire)
	 * - Taken jobs for completion deadline (notify GM, don't auto-fail)
	 *
	 * @param jobs All jobs to check
	 * @param currentDay Current calendar day counter
	 * @returns Jobs that need status updates or GM notification
	 */
	checkExpirations(jobs: Job[], currentDay: number): ExpirationCheckResult {
		const expiredJobs: Job[] = [];
		const deadlineReachedJobs: Job[] = [];

		for (const job of jobs) {
			// Skip archived jobs
			if (job.archived) continue;

			// Check availability expiration (Posted jobs only)
			if (job.status === JobStatus.Posted && this.hasAvailabilityExpired(job, currentDay)) {
				expiredJobs.push(job);
			}

			// Check completion deadline (Taken jobs only)
			// Note: Don't auto-fail, just notify GM
			if (job.status === JobStatus.Taken && this.hasDeadlinePassed(job, currentDay)) {
				deadlineReachedJobs.push(job);
			}
		}

		return { expiredJobs, deadlineReachedJobs };
	}

	/**
	 * Check if a Posted job has expired (availability duration passed)
	 *
	 * @param job Job to check
	 * @param currentDay Current calendar day counter
	 * @returns true if job should be expired, false otherwise
	 */
	hasAvailabilityExpired(job: Job, currentDay: number): boolean {
		// Duration 0 = indefinite, never expires
		if (job.durationAvailability === 0) return false;

		// Check if current day > postDate + duration
		const expirationDay = job.postDate + job.durationAvailability;
		return currentDay > expirationDay;
	}

	/**
	 * Check if a Taken job has passed its completion deadline
	 *
	 * @param job Job to check
	 * @param currentDay Current calendar day counter
	 * @returns true if deadline has passed, false otherwise
	 */
	hasDeadlinePassed(job: Job, currentDay: number): boolean {
		// Duration 0 = indefinite, no deadline
		if (job.durationCompletion === 0) return false;

		// takenDate must be set for Taken jobs
		if (job.takenDate === null || job.takenDate === undefined) return false;

		// Check if current day > takenDate + duration
		const deadlineDay = job.takenDate + job.durationCompletion;
		return currentDay > deadlineDay;
	}

	/**
	 * Calculate expiration day for a job
	 *
	 * @param job Job to check
	 * @returns Day counter when job expires, or null if indefinite
	 */
	calculateExpirationDay(job: Job): number | null {
		if (job.durationAvailability === 0) return null;
		return job.postDate + job.durationAvailability;
	}

	/**
	 * Calculate deadline day for a job
	 *
	 * @param job Job to check
	 * @returns Day counter when deadline is reached, or null if no deadline
	 */
	calculateDeadlineDay(job: Job): number | null {
		if (job.durationCompletion === 0) return null;
		if (job.takenDate === null || job.takenDate === undefined) return null;
		return job.takenDate + job.durationCompletion;
	}

	/**
	 * Calculate days remaining until expiration/deadline
	 *
	 * For Posted jobs: days until availability expires
	 * For Taken jobs: days until completion deadline
	 *
	 * @param job Job to check
	 * @param currentDay Current calendar day counter
	 * @returns Days remaining, null if indefinite, negative if overdue
	 */
	calculateDaysRemaining(job: Job, currentDay: number): number | null {
		if (job.status === JobStatus.Posted) {
			const expirationDay = this.calculateExpirationDay(job);
			if (expirationDay === null) return null;
			return expirationDay - currentDay;
		}

		if (job.status === JobStatus.Taken) {
			const deadlineDay = this.calculateDeadlineDay(job);
			if (deadlineDay === null) return null;
			return deadlineDay - currentDay;
		}

		// Terminal states (Completed, Failed, Expired, Cancelled) have no time remaining
		return null;
	}

	/**
	 * Format days remaining for display
	 *
	 * @param daysRemaining Days remaining (from calculateDaysRemaining)
	 * @returns Human-readable string
	 *
	 * @example
	 * ```ts
	 * formatDaysRemaining(5)  // "5 days remaining"
	 * formatDaysRemaining(0)  // "Due today!"
	 * formatDaysRemaining(-2) // "Overdue by 2 days"
	 * formatDaysRemaining(null) // "No Limit"
	 * ```
	 */
	formatDaysRemaining(daysRemaining: number | null): string {
		if (daysRemaining === null) return 'No Limit';
		if (daysRemaining < 0) return `Overdue by ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? '' : 's'}`;
		if (daysRemaining === 0) return 'Due today!';
		return `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining`;
	}
}
