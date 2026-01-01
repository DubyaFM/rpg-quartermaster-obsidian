/**
 * Job validation service
 *
 * Validates job data against business rules and constraints
 * Platform-agnostic - no Obsidian dependencies
 *
 * @module JobValidator
 * @packageDocumentation
 */

import { Job, JobStatus, ReputationTargetType, ReputationCondition } from '../models/Job';

/**
 * Validation result with error messages
 */
export interface JobValidationResult {
	/** true if validation passed (no errors), false if errors found */
	valid: boolean;

	/** List of validation errors and warnings */
	errors: JobValidationError[];
}

/**
 * Individual validation error or warning
 */
export interface JobValidationError {
	/** Field name that failed validation */
	field: string;

	/** Human-readable error message */
	message: string;

	/** Severity level */
	severity: 'error' | 'warning';
}

/**
 * Job validation service
 *
 * Validates job objects against defined business rules
 * Provides both full validation and single-field validation
 */
export class JobValidator {
	/**
	 * Validate complete job object
	 *
	 * Returns validation result with all errors and warnings
	 * Job is considered valid if there are no 'error' severity issues
	 *
	 * @param job Partial or complete job object
	 * @returns Validation result
	 */
	validate(job: Partial<Job>): JobValidationResult {
		const errors: JobValidationError[] = [];

		// Required field validation
		this.validateRequiredFields(job, errors);

		// Type and range validation
		this.validateTypes(job, errors);

		// Business logic validation (warnings)
		this.validateBusinessRules(job, errors);

		// Array field validation
		this.validateArrayFields(job, errors);

		return {
			valid: errors.filter(e => e.severity === 'error').length === 0,
			errors
		};
	}

	/**
	 * Validate single field (for real-time validation in UI)
	 *
	 * @param fieldName Name of field to validate
	 * @param value Field value
	 * @returns Error object if invalid, null if valid
	 */
	validateField(fieldName: keyof Job, value: any): JobValidationError | null {
		// Validate based on field name
		switch (fieldName) {
			case 'title':
				if (!value || value.trim() === '') {
					return { field: 'title', message: 'Title is required', severity: 'error' };
				}
				if (value.length > 200) {
					return { field: 'title', message: 'Title must be 200 characters or less', severity: 'error' };
				}
				break;

			case 'postDate':
				if (value === undefined || value === null) {
					return { field: 'postDate', message: 'Post date is required', severity: 'error' };
				}
				if (!Number.isInteger(value) || value < 0) {
					return { field: 'postDate', message: 'Post date must be a non-negative integer', severity: 'error' };
				}
				break;

			case 'durationAvailability':
				if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
					return { field: 'durationAvailability', message: 'Duration must be a non-negative integer (0 = No Limit)', severity: 'error' };
				}
				break;

			case 'durationCompletion':
				if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
					return { field: 'durationCompletion', message: 'Duration must be a non-negative integer (0 = No Limit)', severity: 'error' };
				}
				break;

			case 'rewardFunds':
				if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
					return { field: 'rewardFunds', message: 'Currency reward must be a non-negative integer', severity: 'error' };
				}
				break;

			case 'rewardXP':
				if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
					return { field: 'rewardXP', message: 'XP reward must be a non-negative integer', severity: 'error' };
				}
				break;

			case 'status':
				if (!value || !Object.values(JobStatus).includes(value as JobStatus)) {
					return { field: 'status', message: 'Invalid status', severity: 'error' };
				}
				break;
		}

		return null;
	}

	/**
	 * Check if a job can transition to a new status
	 *
	 * Validates status transitions against allowed state machine
	 *
	 * @param currentStatus Current job status
	 * @param newStatus Desired new status
	 * @param job Complete job object (for additional context)
	 * @returns Error if transition is invalid, null if valid
	 */
	validateStatusTransition(
		currentStatus: JobStatus,
		newStatus: JobStatus,
		job: Job
	): JobValidationError | null {
		// Status transition rules (state machine):
		// Posted → Taken, Expired, Cancelled
		// Taken → Completed, Failed, Cancelled
		// Completed → (no transitions - terminal state)
		// Failed → (no transitions - terminal state)
		// Expired → Posted (re-activation allowed)
		// Cancelled → Posted (re-activation allowed)

		const validTransitions: Record<JobStatus, JobStatus[]> = {
			[JobStatus.Posted]: [JobStatus.Taken, JobStatus.Expired, JobStatus.Cancelled],
			[JobStatus.Taken]: [JobStatus.Completed, JobStatus.Failed, JobStatus.Cancelled],
			[JobStatus.Completed]: [JobStatus.Posted],  // Allow re-activation (GM discretion)
			[JobStatus.Failed]: [JobStatus.Posted],      // Allow re-activation (GM discretion)
			[JobStatus.Expired]: [JobStatus.Posted],    // Can re-activate
			[JobStatus.Cancelled]: [JobStatus.Posted]   // Can re-activate
		};

		if (!validTransitions[currentStatus].includes(newStatus)) {
			return {
				field: 'status',
				message: `Cannot transition from ${currentStatus} to ${newStatus}`,
				severity: 'error'
			};
		}

		return null;
	}

	// ==================== PRIVATE VALIDATION METHODS ====================

	/**
	 * Validate required fields
	 */
	private validateRequiredFields(job: Partial<Job>, errors: JobValidationError[]): void {
		// Title is required
		if (!job.title || job.title.trim() === '') {
			errors.push({ field: 'title', message: 'Title is required', severity: 'error' });
		} else if (job.title.length > 200) {
			errors.push({ field: 'title', message: 'Title must be 200 characters or less', severity: 'error' });
		}

		// Status is required
		if (!job.status || !Object.values(JobStatus).includes(job.status as JobStatus)) {
			errors.push({ field: 'status', message: 'Valid status is required', severity: 'error' });
		}

		// Post date is required
		if (job.postDate === undefined || job.postDate === null) {
			errors.push({ field: 'postDate', message: 'Post date is required', severity: 'error' });
		}
	}

	/**
	 * Validate types and ranges
	 */
	private validateTypes(job: Partial<Job>, errors: JobValidationError[]): void {
		// Post date validation
		if (job.postDate !== undefined && job.postDate !== null) {
			if (!Number.isInteger(job.postDate) || job.postDate < 0) {
				errors.push({ field: 'postDate', message: 'Post date must be a non-negative integer', severity: 'error' });
			}
		}

		// Taken date validation (optional, but must be valid if set)
		if (job.takenDate !== undefined && job.takenDate !== null) {
			if (!Number.isInteger(job.takenDate) || job.takenDate < 0) {
				errors.push({ field: 'takenDate', message: 'Taken date must be a non-negative integer', severity: 'error' });
			}
		}

		// Duration availability validation
		if (job.durationAvailability !== undefined) {
			if (!Number.isInteger(job.durationAvailability) || job.durationAvailability < 0) {
				errors.push({ field: 'durationAvailability', message: 'Duration must be a non-negative integer (0 = No Limit)', severity: 'error' });
			}
		}

		// Duration completion validation
		if (job.durationCompletion !== undefined) {
			if (!Number.isInteger(job.durationCompletion) || job.durationCompletion < 0) {
				errors.push({ field: 'durationCompletion', message: 'Duration must be a non-negative integer (0 = No Limit)', severity: 'error' });
			}
		}

		// Currency reward validation (no negative values per user decision)
		if (job.rewardFunds !== undefined) {
			if (!Number.isInteger(job.rewardFunds) || job.rewardFunds < 0) {
				errors.push({ field: 'rewardFunds', message: 'Currency reward must be a non-negative integer', severity: 'error' });
			}
		}

		// XP reward validation (no negative values per user decision)
		if (job.rewardXP !== undefined) {
			if (!Number.isInteger(job.rewardXP) || job.rewardXP < 0) {
				errors.push({ field: 'rewardXP', message: 'XP reward must be a non-negative integer', severity: 'error' });
			}
		}
	}

	/**
	 * Validate business logic rules (produces warnings, not errors)
	 */
	private validateBusinessRules(job: Partial<Job>, errors: JobValidationError[]): void {
		// Warning: Taken status without takenDate
		if (job.status === JobStatus.Taken && !job.takenDate) {
			errors.push({ field: 'takenDate', message: 'Taken date should be set when status is Taken', severity: 'warning' });
		}

		// Warning: Both durations are 0 (no time limits)
		if (job.durationAvailability === 0 && job.durationCompletion === 0) {
			errors.push({ field: 'duration', message: 'Job has no time limits (both durations are 0 / No Limit)', severity: 'warning' });
		}

		// Warning: No rewards defined
		if (job.rewardFunds === 0 && job.rewardXP === 0 && (!job.rewardItems || job.rewardItems.length === 0)) {
			errors.push({ field: 'rewards', message: 'Job has no rewards defined (currency, XP, or items)', severity: 'warning' });
		}
	}

	/**
	 * Validate array fields (reward items, reputation impacts)
	 */
	private validateArrayFields(job: Partial<Job>, errors: JobValidationError[]): void {
		// Validate reward items
		if (job.rewardItems) {
			job.rewardItems.forEach((item, index) => {
				if (!item.item || item.item.trim() === '') {
					errors.push({ field: `rewardItems[${index}].item`, message: 'Item name is required', severity: 'error' });
				}
				if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 9999) {
					errors.push({ field: `rewardItems[${index}].quantity`, message: 'Quantity must be an integer between 1 and 9999', severity: 'error' });
				}
			});
		}

		// Validate reputation impacts
		if (job.reputationImpacts) {
			job.reputationImpacts.forEach((impact, index) => {
				if (!impact.targetType || !Object.values(ReputationTargetType).includes(impact.targetType as ReputationTargetType)) {
					errors.push({ field: `reputationImpacts[${index}].targetType`, message: 'Invalid target type', severity: 'error' });
				}
				if (!impact.targetEntity || impact.targetEntity.trim() === '') {
					errors.push({ field: `reputationImpacts[${index}].targetEntity`, message: 'Target entity is required', severity: 'error' });
				}
				if (!Number.isInteger(impact.value)) {
					errors.push({ field: `reputationImpacts[${index}].value`, message: 'Renown value must be a whole integer', severity: 'error' });
				}
				if (!impact.condition || !Object.values(ReputationCondition).includes(impact.condition as ReputationCondition)) {
					errors.push({ field: `reputationImpacts[${index}].condition`, message: 'Invalid condition', severity: 'error' });
				}
			});
		}
	}
}
