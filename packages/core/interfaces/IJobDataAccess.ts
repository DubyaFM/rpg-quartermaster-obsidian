/**
 * Job data access interface
 *
 * Abstracts job file operations for use by core services
 * Implemented by adapter layer (JobFileHandler)
 *
 * @module IJobDataAccess
 * @packageDocumentation
 */

import { Job, JobStatus } from '../models/Job';
import { JobStatusChangeReason } from '../models/events/JobEvents';

/**
 * Interface for job data access operations
 *
 * This interface abstracts all job file I/O operations,
 * allowing core services to remain platform-agnostic
 *
 * Implementation: ObsidianJobDataAccess (adapter layer)
 */
export interface IJobDataAccess {
	/**
	 * Get all jobs from storage
	 *
	 * @param includeArchived If true, includes jobs with archived=true
	 * @returns Array of all jobs
	 */
	getAllJobs(includeArchived?: boolean): Promise<Job[]>;

	/**
	 * Get a single job by file path
	 *
	 * File path serves as the unique identifier for jobs
	 *
	 * @param jobPath Job file path (e.g., "Jobs/rat-catcher.md")
	 * @returns Job object if found, null if not found
	 */
	getJob(jobPath: string): Promise<Job | null>;

	/**
	 * Save a job (create new file or update existing)
	 *
	 * If job.filePath exists, updates existing file
	 * If job.filePath is undefined, creates new file
	 *
	 * @param job Job object to save
	 * @returns void
	 */
	saveJob(job: Job): Promise<void>;

	/**
	 * Update job status only (optimized operation)
	 *
	 * Updates status field and sets takenDate if transitioning to Taken
	 *
	 * @param jobPath Job file path
	 * @param newStatus New status to set
	 * @param reason Reason for status change (for event emission)
	 * @returns void
	 */
	updateJobStatus(
		jobPath: string,
		newStatus: JobStatus,
		reason: JobStatusChangeReason
	): Promise<void>;

	/**
	 * Delete job file (hard delete)
	 *
	 * Permanently removes job file from storage
	 *
	 * @param jobPath Job file path
	 * @returns void
	 */
	deleteJob(jobPath: string): Promise<void>;

	/**
	 * Archive job (soft delete)
	 *
	 * Sets archived=true on job, hiding it from active views
	 *
	 * @param jobPath Job file path
	 * @returns void
	 */
	archiveJob(jobPath: string): Promise<void>;

	/**
	 * Get list of all job filenames (for slug collision detection)
	 *
	 * Used by createJob UI to warn about duplicate filenames
	 *
	 * @returns Array of filenames (e.g., ["rat-catcher.md", "escort-caravan.md"])
	 */
	getJobFilenames(): Promise<string[]>;
}
