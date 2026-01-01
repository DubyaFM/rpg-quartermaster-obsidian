/**
 * Event types for job board system
 *
 * @module JobEvents
 * @packageDocumentation
 */

import { Job, JobStatus } from '../Job';

/**
 * System event names for job board
 */
export const JOB_EVENTS = {
	STATUS_CHANGED: 'JobStatusChanged',
	CREATED: 'JobCreated',
	UPDATED: 'JobUpdated',
	DELETED: 'JobDeleted',
	REWARDS_DISTRIBUTED: 'JobRewardsDistributed'
} as const;

export type JobEventName = typeof JOB_EVENTS[keyof typeof JOB_EVENTS];

/**
 * Reason for job status change
 */
export enum JobStatusChangeReason {
	/** GM manually changed status */
	Manual = 'Manual',

	/** Auto-expired due to availability duration */
	AutoExpiredAvailability = 'AutoExpiredAvailability',

	/** Auto-flagged for GM review due to completion deadline */
	DeadlineReached = 'DeadlineReached',

	/** Job completed with reward distribution */
	Completed = 'Completed'
}

/**
 * Event: Job status changed
 */
export interface JobStatusChangedEvent {
	/** Job file path (serves as identifier) */
	jobPath: string;

	/** Previous status */
	previousStatus: JobStatus;

	/** New status */
	newStatus: JobStatus;

	/** Complete job object after status change */
	job: Job;

	/** When this event was emitted (timestamp) */
	timestamp: number;

	/** Reason for status change */
	reason: JobStatusChangeReason;
}

/**
 * Event: Job created
 */
export interface JobCreatedEvent {
	/** Newly created job */
	job: Job;

	/** When this event was emitted (timestamp) */
	timestamp: number;
}

/**
 * Event: Job updated
 */
export interface JobUpdatedEvent {
	/** Job file path (identifier) */
	jobPath: string;

	/** Updated job object */
	job: Job;

	/** List of field names that changed */
	changedFields: string[];

	/** When this event was emitted (timestamp) */
	timestamp: number;
}

/**
 * Event: Job deleted/archived
 */
export interface JobDeletedEvent {
	/** Job file path (identifier) */
	jobPath: string;

	/** true = soft delete (archived), false = hard delete */
	archived: boolean;

	/** When this event was emitted (timestamp) */
	timestamp: number;
}

/**
 * Event: Rewards distributed
 */
export interface JobRewardsDistributedEvent {
	/** Job file path (identifier) */
	jobPath: string;

	/** Job that was completed */
	job: Job;

	/** Amount of gold distributed */
	goldDistributed: number;

	/** Items distributed to party */
	itemsDistributed: Array<{ item: string; quantity: number }>;

	/** Reputation impacts applied (Phase 1: just logged) */
	reputationImpactsApplied: Array<{ targetEntity: string; value: number }>;

	/** When this event was emitted (timestamp) */
	timestamp: number;
}
