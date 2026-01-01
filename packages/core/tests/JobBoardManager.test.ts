import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JobBoardManager, JobBoardManagerConfig } from '../services/JobBoardManager';
import { EventBus } from '../services/EventBus';
import { SYSTEM_EVENTS, TimeAdvancedEvent } from '../models/events';
import { IJobDataAccess } from '../interfaces/IJobDataAccess';
import { IGMNotifier } from '../interfaces/IGMNotifier';
import { Job, JobStatus, createNewJob } from '../models/Job';
import { JobStatusChangeReason } from '../models/events/JobEvents';

describe('JobBoardManager', () => {
	let eventBus: EventBus;
	let jobDataAccess: IJobDataAccess;
	let gmNotifier: IGMNotifier;
	let manager: JobBoardManager;
	let config: JobBoardManagerConfig;

	beforeEach(() => {
		eventBus = new EventBus();

		// Mock IJobDataAccess
		jobDataAccess = {
			getAllJobs: vi.fn(),
			getJob: vi.fn(),
			saveJob: vi.fn(),
			updateJobStatus: vi.fn(),
			deleteJob: vi.fn(),
			archiveJob: vi.fn(),
			getJobFilenames: vi.fn()
		};

		// Mock IGMNotifier
		gmNotifier = {
			notifyGM: vi.fn(),
			logNotification: vi.fn()
		};

		config = {
			autoExpireJobs: true,
			notifyOnDeadlines: true,
			notifyOnExpirations: true
		};

		manager = new JobBoardManager(eventBus, jobDataAccess, gmNotifier, config);
	});

	describe('initialize and shutdown', () => {
		it('should subscribe to TimeAdvanced event on initialize', () => {
			manager.initialize();

			expect(eventBus.getListenerCount(SYSTEM_EVENTS.TIME_ADVANCED)).toBe(1);
		});

		it('should unsubscribe on shutdown', () => {
			manager.initialize();
			manager.shutdown();

			expect(eventBus.getListenerCount(SYSTEM_EVENTS.TIME_ADVANCED)).toBe(0);
		});

		it('should handle multiple initializations gracefully', () => {
			manager.initialize();
			manager.initialize();

			// Should still have only one listener
			expect(eventBus.getListenerCount(SYSTEM_EVENTS.TIME_ADVANCED)).toBe(1);

			manager.shutdown();
		});
	});

	describe('handleTimeAdvanced', () => {
		beforeEach(() => {
			manager.initialize();
		});

		it('should expire Posted jobs that passed availability duration', async () => {
			const expiredJob = createNewJob('Expired Job', 90, {
				status: JobStatus.Posted,
				durationAvailability: 5, // Expires on day 95
				filePath: 'Jobs/expired-job.md'
			});

			vi.mocked(jobDataAccess.getAllJobs).mockResolvedValue([expiredJob]);

			const event: TimeAdvancedEvent = {
				previousDay: 95,
				newDay: 100,
				daysPassed: 5
			};

			await eventBus.emit(SYSTEM_EVENTS.TIME_ADVANCED, event);

			// Wait for async operations
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(jobDataAccess.updateJobStatus).toHaveBeenCalledWith(
				'Jobs/expired-job.md',
				JobStatus.Expired,
				JobStatusChangeReason.AutoExpiredAvailability
			);
		});

		it('should notify GM about expired jobs when configured', async () => {
			const expiredJob = createNewJob('Expired Job', 90, {
				status: JobStatus.Posted,
				durationAvailability: 5,
				filePath: 'Jobs/expired-job.md'
			});

			vi.mocked(jobDataAccess.getAllJobs).mockResolvedValue([expiredJob]);

			const event: TimeAdvancedEvent = {
				previousDay: 95,
				newDay: 100,
				daysPassed: 5
			};

			await eventBus.emit(SYSTEM_EVENTS.TIME_ADVANCED, event);
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(gmNotifier.notifyGM).toHaveBeenCalledWith(
				'Job "Expired Job" has expired (availability duration ended)',
				'Job Expired'
			);
		});

		it('should log notification for expired jobs', async () => {
			const expiredJob = createNewJob('Expired Job', 90, {
				status: JobStatus.Posted,
				durationAvailability: 5,
				filePath: 'Jobs/expired-job.md'
			});

			vi.mocked(jobDataAccess.getAllJobs).mockResolvedValue([expiredJob]);

			const event: TimeAdvancedEvent = {
				previousDay: 95,
				newDay: 100,
				daysPassed: 5
			};

			await eventBus.emit(SYSTEM_EVENTS.TIME_ADVANCED, event);
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(gmNotifier.logNotification).toHaveBeenCalledWith(
				'Job "Expired Job" has expired (availability duration ended)',
				'Jobs/expired-job.md'
			);
		});

		it('should not expire jobs when autoExpireJobs is false', async () => {
			manager.updateConfig({ autoExpireJobs: false });

			const expiredJob = createNewJob('Expired Job', 90, {
				status: JobStatus.Posted,
				durationAvailability: 5,
				filePath: 'Jobs/expired-job.md'
			});

			vi.mocked(jobDataAccess.getAllJobs).mockResolvedValue([expiredJob]);

			const event: TimeAdvancedEvent = {
				previousDay: 95,
				newDay: 100,
				daysPassed: 5
			};

			await eventBus.emit(SYSTEM_EVENTS.TIME_ADVANCED, event);
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(jobDataAccess.updateJobStatus).not.toHaveBeenCalled();
		});

		it('should warn about Taken jobs past deadline but not auto-fail', async () => {
			const overdueJob = createNewJob('Overdue Job', 80, {
				status: JobStatus.Taken,
				takenDate: 85,
				durationCompletion: 10, // Deadline on day 95
				filePath: 'Jobs/overdue-job.md'
			});

			vi.mocked(jobDataAccess.getAllJobs).mockResolvedValue([overdueJob]);

			const event: TimeAdvancedEvent = {
				previousDay: 95,
				newDay: 100,
				daysPassed: 5
			};

			await eventBus.emit(SYSTEM_EVENTS.TIME_ADVANCED, event);
			await new Promise(resolve => setTimeout(resolve, 10));

			// Should NOT update job status
			expect(jobDataAccess.updateJobStatus).not.toHaveBeenCalled();

			// Should notify GM
			expect(gmNotifier.notifyGM).toHaveBeenCalledWith(
				expect.stringContaining('passed its completion deadline'),
				'Job Deadline Reached'
			);
		});

		it('should not notify about deadlines when notifyOnDeadlines is false', async () => {
			manager.updateConfig({ notifyOnDeadlines: false });

			const overdueJob = createNewJob('Overdue Job', 80, {
				status: JobStatus.Taken,
				takenDate: 85,
				durationCompletion: 10,
				filePath: 'Jobs/overdue-job.md'
			});

			vi.mocked(jobDataAccess.getAllJobs).mockResolvedValue([overdueJob]);

			const event: TimeAdvancedEvent = {
				previousDay: 95,
				newDay: 100,
				daysPassed: 5
			};

			await eventBus.emit(SYSTEM_EVENTS.TIME_ADVANCED, event);
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(gmNotifier.notifyGM).not.toHaveBeenCalled();
		});

		it('should handle multiple expired jobs', async () => {
			const job1 = createNewJob('Expired 1', 90, {
				status: JobStatus.Posted,
				durationAvailability: 5,
				filePath: 'Jobs/expired-1.md'
			});

			const job2 = createNewJob('Expired 2', 88, {
				status: JobStatus.Posted,
				durationAvailability: 7,
				filePath: 'Jobs/expired-2.md'
			});

			vi.mocked(jobDataAccess.getAllJobs).mockResolvedValue([job1, job2]);

			const event: TimeAdvancedEvent = {
				previousDay: 95,
				newDay: 100,
				daysPassed: 5
			};

			await eventBus.emit(SYSTEM_EVENTS.TIME_ADVANCED, event);
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(jobDataAccess.updateJobStatus).toHaveBeenCalledTimes(2);
			expect(gmNotifier.notifyGM).toHaveBeenCalledTimes(2);
		});

		it('should skip archived jobs', async () => {
			const archivedJob = createNewJob('Archived', 90, {
				status: JobStatus.Posted,
				durationAvailability: 5,
				archived: true,
				filePath: 'Jobs/archived.md'
			});

			vi.mocked(jobDataAccess.getAllJobs).mockResolvedValue([archivedJob]);

			const event: TimeAdvancedEvent = {
				previousDay: 95,
				newDay: 100,
				daysPassed: 5
			};

			await eventBus.emit(SYSTEM_EVENTS.TIME_ADVANCED, event);
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(jobDataAccess.updateJobStatus).not.toHaveBeenCalled();
		});

		it('should handle errors gracefully and continue processing', async () => {
			const job1 = createNewJob('Job 1', 90, {
				status: JobStatus.Posted,
				durationAvailability: 5,
				filePath: 'Jobs/job-1.md'
			});

			const job2 = createNewJob('Job 2', 88, {
				status: JobStatus.Posted,
				durationAvailability: 7,
				filePath: 'Jobs/job-2.md'
			});

			vi.mocked(jobDataAccess.getAllJobs).mockResolvedValue([job1, job2]);
			vi.mocked(jobDataAccess.updateJobStatus)
				.mockRejectedValueOnce(new Error('Update failed'))
				.mockResolvedValueOnce(undefined);

			const event: TimeAdvancedEvent = {
				previousDay: 95,
				newDay: 100,
				daysPassed: 5
			};

			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			await eventBus.emit(SYSTEM_EVENTS.TIME_ADVANCED, event);
			await new Promise(resolve => setTimeout(resolve, 10));

			// Should still process second job despite first failing
			expect(jobDataAccess.updateJobStatus).toHaveBeenCalledTimes(2);

			consoleErrorSpy.mockRestore();
		});
	});

	describe('checkExpirations', () => {
		it('should manually trigger expiration check', async () => {
			const expiredJob = createNewJob('Expired Job', 90, {
				status: JobStatus.Posted,
				durationAvailability: 5,
				filePath: 'Jobs/expired-job.md'
			});

			vi.mocked(jobDataAccess.getAllJobs).mockResolvedValue([expiredJob]);

			await manager.checkExpirations(100);

			expect(jobDataAccess.getAllJobs).toHaveBeenCalled();
		});
	});

	describe('configuration', () => {
		it('should return current configuration', () => {
			const currentConfig = manager.getConfig();

			expect(currentConfig).toEqual(config);
		});

		it('should update configuration', () => {
			manager.updateConfig({ autoExpireJobs: false });

			const newConfig = manager.getConfig();

			expect(newConfig.autoExpireJobs).toBe(false);
			expect(newConfig.notifyOnDeadlines).toBe(true);
			expect(newConfig.notifyOnExpirations).toBe(true);
		});

		it('should allow partial configuration updates', () => {
			manager.updateConfig({
				notifyOnDeadlines: false
			});

			const newConfig = manager.getConfig();

			expect(newConfig.autoExpireJobs).toBe(true);
			expect(newConfig.notifyOnDeadlines).toBe(false);
			expect(newConfig.notifyOnExpirations).toBe(true);
		});
	});
});
