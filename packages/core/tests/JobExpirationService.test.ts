import { describe, it, expect, beforeEach } from 'vitest';
import { JobExpirationService } from '../services/JobExpirationService';
import { Job, JobStatus, createNewJob } from '../models/Job';

describe('JobExpirationService', () => {
	let service: JobExpirationService;

	beforeEach(() => {
		service = new JobExpirationService();
	});

	describe('checkExpirations', () => {
		it('should return empty results when no jobs provided', () => {
			const result = service.checkExpirations([], 100);

			expect(result.expiredJobs).toEqual([]);
			expect(result.deadlineReachedJobs).toEqual([]);
		});

		it('should identify Posted jobs that have expired', () => {
			const job1 = createNewJob('Expired Job', 90, {
				status: JobStatus.Posted,
				durationAvailability: 5 // Expires on day 95
			});

			const job2 = createNewJob('Not Expired', 96, {
				status: JobStatus.Posted,
				durationAvailability: 5 // Expires on day 101
			});

			const result = service.checkExpirations([job1, job2], 100);

			expect(result.expiredJobs).toHaveLength(1);
			expect(result.expiredJobs[0].title).toBe('Expired Job');
			expect(result.deadlineReachedJobs).toHaveLength(0);
		});

		it('should identify Taken jobs that passed completion deadline', () => {
			const job1 = createNewJob('Overdue Job', 80, {
				status: JobStatus.Taken,
				takenDate: 85,
				durationCompletion: 10 // Deadline on day 95
			});

			const job2 = createNewJob('Not Overdue', 90, {
				status: JobStatus.Taken,
				takenDate: 95,
				durationCompletion: 10 // Deadline on day 105
			});

			const result = service.checkExpirations([job1, job2], 100);

			expect(result.expiredJobs).toHaveLength(0);
			expect(result.deadlineReachedJobs).toHaveLength(1);
			expect(result.deadlineReachedJobs[0].title).toBe('Overdue Job');
		});

		it('should skip archived jobs', () => {
			const job = createNewJob('Archived Job', 90, {
				status: JobStatus.Posted,
				durationAvailability: 5, // Would be expired
				archived: true
			});

			const result = service.checkExpirations([job], 100);

			expect(result.expiredJobs).toHaveLength(0);
			expect(result.deadlineReachedJobs).toHaveLength(0);
		});

		it('should handle both expired and deadline-reached jobs simultaneously', () => {
			const expired = createNewJob('Expired', 90, {
				status: JobStatus.Posted,
				durationAvailability: 5
			});

			const overdue = createNewJob('Overdue', 80, {
				status: JobStatus.Taken,
				takenDate: 85,
				durationCompletion: 10
			});

			const result = service.checkExpirations([expired, overdue], 100);

			expect(result.expiredJobs).toHaveLength(1);
			expect(result.deadlineReachedJobs).toHaveLength(1);
		});
	});

	describe('hasAvailabilityExpired', () => {
		it('should return true when availability duration has passed', () => {
			const job = createNewJob('Test Job', 90, {
				durationAvailability: 5 // Expires on day 95
			});

			expect(service.hasAvailabilityExpired(job, 96)).toBe(true);
			expect(service.hasAvailabilityExpired(job, 95)).toBe(false); // Exactly on expiration day
			expect(service.hasAvailabilityExpired(job, 94)).toBe(false);
		});

		it('should return false for indefinite jobs (duration 0)', () => {
			const job = createNewJob('Indefinite Job', 90, {
				durationAvailability: 0
			});

			expect(service.hasAvailabilityExpired(job, 1000)).toBe(false);
			expect(service.hasAvailabilityExpired(job, 10000)).toBe(false);
		});

		it('should handle edge case of current day exactly at expiration', () => {
			const job = createNewJob('Test Job', 100, {
				durationAvailability: 10 // Expires on day 110
			});

			expect(service.hasAvailabilityExpired(job, 110)).toBe(false);
			expect(service.hasAvailabilityExpired(job, 111)).toBe(true);
		});
	});

	describe('hasDeadlinePassed', () => {
		it('should return true when completion deadline has passed', () => {
			const job = createNewJob('Test Job', 90, {
				takenDate: 95,
				durationCompletion: 7 // Deadline on day 102
			});

			expect(service.hasDeadlinePassed(job, 103)).toBe(true);
			expect(service.hasDeadlinePassed(job, 102)).toBe(false);
			expect(service.hasDeadlinePassed(job, 101)).toBe(false);
		});

		it('should return false for indefinite completion (duration 0)', () => {
			const job = createNewJob('No Deadline Job', 90, {
				takenDate: 95,
				durationCompletion: 0
			});

			expect(service.hasDeadlinePassed(job, 1000)).toBe(false);
		});

		it('should return false if takenDate is null', () => {
			const job = createNewJob('Not Taken', 90, {
				takenDate: null,
				durationCompletion: 7
			});

			expect(service.hasDeadlinePassed(job, 100)).toBe(false);
		});

		it('should return false if takenDate is undefined', () => {
			const job = createNewJob('Not Taken', 90, {
				durationCompletion: 7
			});
			job.takenDate = undefined as any;

			expect(service.hasDeadlinePassed(job, 100)).toBe(false);
		});
	});

	describe('calculateExpirationDay', () => {
		it('should calculate expiration day correctly', () => {
			const job = createNewJob('Test Job', 100, {
				durationAvailability: 10
			});

			expect(service.calculateExpirationDay(job)).toBe(110);
		});

		it('should return null for indefinite jobs', () => {
			const job = createNewJob('Indefinite', 100, {
				durationAvailability: 0
			});

			expect(service.calculateExpirationDay(job)).toBeNull();
		});
	});

	describe('calculateDeadlineDay', () => {
		it('should calculate deadline day correctly', () => {
			const job = createNewJob('Test Job', 90, {
				takenDate: 100,
				durationCompletion: 7
			});

			expect(service.calculateDeadlineDay(job)).toBe(107);
		});

		it('should return null for indefinite completion', () => {
			const job = createNewJob('No Deadline', 90, {
				takenDate: 100,
				durationCompletion: 0
			});

			expect(service.calculateDeadlineDay(job)).toBeNull();
		});

		it('should return null if takenDate is null', () => {
			const job = createNewJob('Not Taken', 90, {
				takenDate: null,
				durationCompletion: 7
			});

			expect(service.calculateDeadlineDay(job)).toBeNull();
		});
	});

	describe('calculateDaysRemaining', () => {
		it('should calculate days remaining for Posted job', () => {
			const job = createNewJob('Posted Job', 100, {
				status: JobStatus.Posted,
				durationAvailability: 10 // Expires day 110
			});

			expect(service.calculateDaysRemaining(job, 105)).toBe(5);
			expect(service.calculateDaysRemaining(job, 110)).toBe(0);
			expect(service.calculateDaysRemaining(job, 115)).toBe(-5);
		});

		it('should calculate days remaining for Taken job', () => {
			const job = createNewJob('Taken Job', 90, {
				status: JobStatus.Taken,
				takenDate: 100,
				durationCompletion: 7 // Deadline day 107
			});

			expect(service.calculateDaysRemaining(job, 103)).toBe(4);
			expect(service.calculateDaysRemaining(job, 107)).toBe(0);
			expect(service.calculateDaysRemaining(job, 110)).toBe(-3);
		});

		it('should return null for indefinite Posted job', () => {
			const job = createNewJob('Indefinite Posted', 100, {
				status: JobStatus.Posted,
				durationAvailability: 0
			});

			expect(service.calculateDaysRemaining(job, 200)).toBeNull();
		});

		it('should return null for indefinite Taken job', () => {
			const job = createNewJob('Indefinite Taken', 90, {
				status: JobStatus.Taken,
				takenDate: 100,
				durationCompletion: 0
			});

			expect(service.calculateDaysRemaining(job, 200)).toBeNull();
		});

		it('should return null for terminal states', () => {
			const completed = createNewJob('Completed', 100, {
				status: JobStatus.Completed,
				durationAvailability: 10
			});

			const failed = createNewJob('Failed', 100, {
				status: JobStatus.Failed,
				durationCompletion: 10
			});

			const expired = createNewJob('Expired', 100, {
				status: JobStatus.Expired,
				durationAvailability: 10
			});

			const cancelled = createNewJob('Cancelled', 100, {
				status: JobStatus.Cancelled,
				durationAvailability: 10
			});

			expect(service.calculateDaysRemaining(completed, 110)).toBeNull();
			expect(service.calculateDaysRemaining(failed, 110)).toBeNull();
			expect(service.calculateDaysRemaining(expired, 110)).toBeNull();
			expect(service.calculateDaysRemaining(cancelled, 110)).toBeNull();
		});
	});

	describe('formatDaysRemaining', () => {
		it('should format positive days correctly', () => {
			expect(service.formatDaysRemaining(5)).toBe('5 days remaining');
			expect(service.formatDaysRemaining(1)).toBe('1 day remaining');
			expect(service.formatDaysRemaining(10)).toBe('10 days remaining');
		});

		it('should format due today correctly', () => {
			expect(service.formatDaysRemaining(0)).toBe('Due today!');
		});

		it('should format overdue correctly', () => {
			expect(service.formatDaysRemaining(-1)).toBe('Overdue by 1 day');
			expect(service.formatDaysRemaining(-5)).toBe('Overdue by 5 days');
			expect(service.formatDaysRemaining(-10)).toBe('Overdue by 10 days');
		});

		it('should format null as No Limit', () => {
			expect(service.formatDaysRemaining(null)).toBe('No Limit');
		});

		it('should handle singular vs plural correctly', () => {
			expect(service.formatDaysRemaining(1)).toBe('1 day remaining');
			expect(service.formatDaysRemaining(2)).toBe('2 days remaining');
			expect(service.formatDaysRemaining(-1)).toBe('Overdue by 1 day');
			expect(service.formatDaysRemaining(-2)).toBe('Overdue by 2 days');
		});
	});
});
