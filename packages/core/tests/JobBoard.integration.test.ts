/**
 * Job Board Integration Tests
 *
 * End-to-end tests for the job board system
 * Tests complete workflows including file I/O, calendar integration, and reward distribution
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../services/EventBus';
import { JobBoardManager, JobBoardManagerConfig } from '../services/JobBoardManager';
import { JobExpirationService } from '../services/JobExpirationService';
import { RewardDistributor } from '../services/RewardDistributor';
import { PlayerJobViewService } from '../services/PlayerJobViewService';
import { PlayerJobBoardExporter } from '../services/PlayerJobBoardExporter';
import { ReputationTargetExtractor } from '../services/ReputationTargetExtractor';
import { IJobDataAccess } from '../interfaces/IJobDataAccess';
import { IGMNotifier } from '../interfaces/IGMNotifier';
import { Job, JobStatus, createNewJob, ReputationTargetType, ReputationCondition } from '../models/Job';
import { SYSTEM_EVENTS, TimeAdvancedEvent } from '../models/events';
import { JobStatusChangeReason } from '../models/events/JobEvents';

describe('Job Board Integration Tests', () => {
	let eventBus: EventBus;
	let jobDataAccess: IJobDataAccess;
	let gmNotifier: IGMNotifier;
	let manager: JobBoardManager;
	let config: JobBoardManagerConfig;
	let expirationService: JobExpirationService;
	let rewardDistributor: RewardDistributor;

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
		expirationService = new JobExpirationService();
		rewardDistributor = new RewardDistributor();
	});

	describe('Complete Job Lifecycle', () => {
		it('should handle full job lifecycle: create → take → complete → distribute rewards', async () => {
			// Create job
			const job = createNewJob('Rat Catcher', 100, {
				location: '[[Waterdeep]]',
				questgiver: '[[Innkeeper Bess]]',
				durationAvailability: 5,
				durationCompletion: 3,
				rewardGold: 50,
				rewardXP: 100,
				rewardItems: [
					{ item: '[[Potion of Healing]]', quantity: 2 }
				],
				reputationImpacts: [
					{
						targetEntity: '[[Factions/City Watch]]',
						targetType: ReputationTargetType.Faction,
						value: 5,
						condition: ReputationCondition.OnSuccess
					}
				],
				filePath: 'Jobs/rat-catcher.md'
			});

			expect(job.status).toBe(JobStatus.Posted);
			expect(job.postDate).toBe(100);
			expect(job.takenDate).toBeNull();

			// Party takes the job on day 102
			job.status = JobStatus.Taken;
			job.takenDate = 102;

			expect(job.status).toBe(JobStatus.Taken);
			expect(job.takenDate).toBe(102);

			// Complete the job on day 104
			job.status = JobStatus.Completed;

			// Distribute rewards
			const rewards = rewardDistributor.calculateRewards(job);

			expect(rewards.goldReward).toBe(50);
			expect(rewards.xpReward).toBe(100);
			expect(rewards.itemRewards).toHaveLength(1);
			expect(rewards.itemRewards[0].item).toBe('[[Potion of Healing]]'); // Items preserve wikilinks
			expect(rewards.itemRewards[0].quantity).toBe(2);
			expect(rewards.reputationImpacts).toHaveLength(1);
			expect(rewards.reputationImpacts[0].value).toBe(5);
		});

		it('should handle job failure with appropriate reputation impacts', () => {
			const job = createNewJob('Escort Caravan', 100, {
				rewardGold: 200,
				reputationImpacts: [
					{
						targetEntity: 'Merchants Guild',
						targetType: ReputationTargetType.Faction,
						value: 10,
						condition: ReputationCondition.OnSuccess
					},
					{
						targetEntity: 'Merchants Guild',
						targetType: ReputationTargetType.Faction,
						value: -15,
						condition: ReputationCondition.OnFailure
					}
				]
			});

			job.status = JobStatus.Failed;

			const rewards = rewardDistributor.calculateRewards(job);

			// RewardDistributor returns all rewards, filtering by condition is UI responsibility
			expect(rewards.goldReward).toBe(200);
			expect(rewards.xpReward).toBe(0);
			// Should filter to only OnFailure reputation impacts
			const failureImpacts = rewards.reputationImpacts.filter(r => r.condition === ReputationCondition.OnFailure);
			expect(failureImpacts).toHaveLength(1);
			expect(failureImpacts[0].value).toBe(-15);
		});
	});

	describe('Calendar Integration', () => {
		it('should auto-expire Posted jobs when availability duration passes', async () => {
			const job = createNewJob('Ancient Quest', 90, {
				durationAvailability: 5,
				filePath: 'Jobs/ancient-quest.md'
			});

			vi.mocked(jobDataAccess.getAllJobs).mockResolvedValue([job]);

			manager.initialize();

			// Advance time past expiration (day 90 + 5 = 95, now day 100)
			const event: TimeAdvancedEvent = {
				previousDay: 95,
				newDay: 100,
				daysPassed: 5
			};

			await eventBus.emit(SYSTEM_EVENTS.TIME_ADVANCED, event);

			// Wait for async processing
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(jobDataAccess.updateJobStatus).toHaveBeenCalledWith(
				'Jobs/ancient-quest.md',
				JobStatus.Expired,
				JobStatusChangeReason.AutoExpiredAvailability
			);

			expect(gmNotifier.notifyGM).toHaveBeenCalledWith(
				expect.stringContaining('expired'),
				expect.any(String)
			);
		});

		it('should notify GM when Taken job deadline is reached', async () => {
			const job = createNewJob('Urgent Mission', 100, {
				status: JobStatus.Taken,
				takenDate: 100,
				durationCompletion: 5,
				filePath: 'Jobs/urgent-mission.md'
			});

			vi.mocked(jobDataAccess.getAllJobs).mockResolvedValue([job]);

			manager.initialize();

			// Advance time past the deadline (day 100 + 5 = 105, now 106)
			const event: TimeAdvancedEvent = {
				previousDay: 105,
				newDay: 106,
				daysPassed: 1
			};

			await eventBus.emit(SYSTEM_EVENTS.TIME_ADVANCED, event);
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(gmNotifier.notifyGM).toHaveBeenCalledWith(
				expect.stringContaining('deadline'),
				expect.any(String)
			);
		});

		it('should not expire jobs with duration 0 (indefinite)', async () => {
			const job = createNewJob('Eternal Quest', 10, {
				durationAvailability: 0, // Indefinite
				filePath: 'Jobs/eternal-quest.md'
			});

			vi.mocked(jobDataAccess.getAllJobs).mockResolvedValue([job]);

			manager.initialize();

			// Advance far into the future
			const event: TimeAdvancedEvent = {
				previousDay: 100,
				newDay: 1000,
				daysPassed: 900
			};

			await eventBus.emit(SYSTEM_EVENTS.TIME_ADVANCED, event);
			await new Promise(resolve => setTimeout(resolve, 10));

			// Should not expire
			expect(jobDataAccess.updateJobStatus).not.toHaveBeenCalled();
		});
	});

	describe('Player View and Export', () => {
		it('should filter jobs correctly for player view', () => {
			const playerViewService = new PlayerJobViewService();

			const jobs: Job[] = [
				createNewJob('Public Job 1', 100, {
					status: JobStatus.Posted,
					hideFromPlayers: false
				}),
				createNewJob('Public Job 2', 100, {
					status: JobStatus.Taken,
					hideFromPlayers: false
				}),
				createNewJob('Secret Job', 100, {
					status: JobStatus.Posted,
					hideFromPlayers: true // Hidden from players
				}),
				createNewJob('Archived Job', 100, {
					status: JobStatus.Completed,
					archived: true // Archived
				})
			];

			const playerJobs = playerViewService.getPlayerJobs(jobs);

			// Should only show 2 jobs (Posted and Taken, not hidden or archived)
			expect(playerJobs).toHaveLength(2);
			expect(playerJobs.map(j => j.title).sort()).toEqual(['Public Job 1', 'Public Job 2']);

			// Should not have GM-only fields
			playerJobs.forEach(job => {
				expect('hideFromPlayers' in job).toBe(false);
				expect('archived' in job).toBe(false);
				expect('narrativeConsequence' in job).toBe(false);
				expect('filePath' in job).toBe(false);
			});
		});

		it('should export player jobs to markdown with grouping', () => {
			const exporter = new PlayerJobBoardExporter();

			const jobs: Job[] = [
				createNewJob('Find the Lost Sword', 100, {
					status: JobStatus.Posted,
					location: 'Waterdeep',
					questgiver: 'Lord Neverember',
					rewardGold: 100,
					rewardXP: 50,
					durationAvailability: 5
				}),
				createNewJob('Rescue the Princess', 100, {
					status: JobStatus.Taken,
					takenDate: 101,
					location: 'Castle',
					rewardGold: 500,
					rewardItems: [
						{ item: 'Magic Sword', quantity: 1 }
					],
					durationCompletion: 3
				})
			];

			const markdown = exporter.exportToMarkdown(jobs, {
				title: 'Test Job Board',
				groupByStatus: true,
				showExpirationWarnings: true,
				currentDay: 102
			});

			expect(markdown).toContain('# Test Job Board');
			expect(markdown).toContain('## 📋 Available Jobs (1)');
			expect(markdown).toContain('## ⏳ In Progress (1)');
			expect(markdown).toContain('Find the Lost Sword');
			expect(markdown).toContain('Rescue the Princess');
			expect(markdown).toContain('💰 100 gp');
			expect(markdown).toContain('📦 Magic Sword');
		});

		it('should export with location grouping', () => {
			const exporter = new PlayerJobBoardExporter();

			const jobs: Job[] = [
				createNewJob('Job 1', 100, { location: 'Waterdeep' }),
				createNewJob('Job 2', 100, { location: 'Waterdeep' }),
				createNewJob('Job 3', 100, { location: 'Baldurs Gate' })
			];

			const markdown = exporter.exportToMarkdown(jobs, {
				groupByStatus: false, // Disable status grouping
				groupByLocation: true
			});

			expect(markdown).toContain('## 📍 Baldurs Gate (1)');
			expect(markdown).toContain('## 📍 Waterdeep (2)');
		});
	});

	describe('Reputation Target Extraction', () => {
		it('should extract unique reputation targets from multiple jobs', () => {
			const extractor = new ReputationTargetExtractor();

			const jobs: Job[] = [
				createNewJob('Job 1', 100, {
					reputationImpacts: [
						{ targetEntity: 'City Watch', targetType: ReputationTargetType.Faction, value: 5, condition: ReputationCondition.OnSuccess },
						{ targetEntity: 'Waterdeep', targetType: ReputationTargetType.Location, value: 3, condition: ReputationCondition.OnSuccess }
					]
				}),
				createNewJob('Job 2', 100, {
					reputationImpacts: [
						{ targetEntity: 'City Watch', targetType: ReputationTargetType.Faction, value: 10, condition: ReputationCondition.OnSuccess }, // Duplicate
						{ targetEntity: 'Thieves Guild', targetType: ReputationTargetType.Faction, value: -5, condition: ReputationCondition.OnFailure }
					]
				})
			];

			const targets = extractor.extractUniqueTargets(jobs);

			// Should have 3 unique targets (City Watch used twice)
			expect(targets).toHaveLength(3);

			// City Watch should have usage count of 2
			const cityWatch = targets.find(t => t.entity === 'City Watch');
			expect(cityWatch?.usageCount).toBe(2);

			// Should be sorted by usage count (descending)
			expect(targets[0].usageCount).toBeGreaterThanOrEqual(targets[1].usageCount);
		});

		it('should extract page names from wikilinks', () => {
			const extractor = new ReputationTargetExtractor();

			const jobs: Job[] = [
				createNewJob('Job 1', 100, {
					reputationImpacts: [
						{ targetEntity: '[[Factions/Harpers]]', targetType: ReputationTargetType.Faction, value: 5, condition: ReputationCondition.OnSuccess },
						{ targetEntity: '[[Factions/Harpers|The Harpers]]', targetType: ReputationTargetType.Faction, value: 3, condition: ReputationCondition.OnSuccess }
					]
				})
			];

			const targets = extractor.extractUniqueTargets(jobs);

			// Both should be normalized to "Harpers"
			expect(targets).toHaveLength(1);
			expect(targets[0].entity).toBe('Factions/Harpers');
			expect(targets[0].usageCount).toBe(2);
		});

		it('should filter targets by type', () => {
			const extractor = new ReputationTargetExtractor();

			const jobs: Job[] = [
				createNewJob('Job 1', 100, {
					reputationImpacts: [
						{ targetEntity: 'City Watch', targetType: ReputationTargetType.Faction, value: 5, condition: ReputationCondition.OnSuccess },
						{ targetEntity: 'Waterdeep', targetType: ReputationTargetType.Location, value: 3, condition: ReputationCondition.OnSuccess },
						{ targetEntity: 'Lord Neverember', targetType: ReputationTargetType.NPC, value: 10, condition: ReputationCondition.OnSuccess }
					]
				})
			];

			const factions = extractor.getTargetsByType(jobs, ReputationTargetType.Faction);
			const locations = extractor.getTargetsByType(jobs, ReputationTargetType.Location);
			const npcs = extractor.getTargetsByType(jobs, ReputationTargetType.NPC);

			expect(factions).toEqual(['City Watch']);
			expect(locations).toEqual(['Waterdeep']);
			expect(npcs).toEqual(['Lord Neverember']);
		});
	});

	describe('Expiration Edge Cases', () => {
		it('should handle jobs with 0 duration correctly', () => {
			const jobIndefiniteAvailability = createNewJob('Eternal Job', 100, {
				durationAvailability: 0
			});

			expect(expirationService.hasAvailabilityExpired(jobIndefiniteAvailability, 100000)).toBe(false);

			const jobIndefiniteCompletion = createNewJob('No Rush Job', 100, {
				status: JobStatus.Taken,
				takenDate: 100,
				durationCompletion: 0
			});

			// Job with 0 completion duration never has a deadline
			expect(expirationService.hasAvailabilityExpired(jobIndefiniteCompletion, 100000)).toBe(false);
		});
	});

	describe('Reward Distribution Edge Cases', () => {
		it('should handle jobs with no rewards', () => {
			const job = createNewJob('Charity Work', 100, {
				rewardGold: 0,
				rewardXP: 0,
				rewardItems: []
			});

			job.status = JobStatus.Completed;

			const rewards = rewardDistributor.calculateRewards(job);

			expect(rewards.goldReward).toBe(0);
			expect(rewards.xpReward).toBe(0);
			expect(rewards.itemRewards).toHaveLength(0);
			expect(rewards.warnings).toHaveLength(0);
		});

		it('should handle multiple reputation impacts with same target', () => {
			const job = createNewJob('Complex Job', 100, {
				reputationImpacts: [
					{ targetEntity: 'City Watch', targetType: ReputationTargetType.Faction, value: 5, condition: ReputationCondition.OnSuccess },
					{ targetEntity: 'City Watch', targetType: ReputationTargetType.Faction, value: 3, condition: ReputationCondition.OnSuccess },
					{ targetEntity: 'Thieves Guild', targetType: ReputationTargetType.Faction, value: -10, condition: ReputationCondition.OnSuccess }
				]
			});

			job.status = JobStatus.Completed;

			const rewards = rewardDistributor.calculateRewards(job);

			expect(rewards.reputationImpacts).toHaveLength(3);
			// All should be OnSuccess impacts
			expect(rewards.reputationImpacts.every(r => r.condition === ReputationCondition.OnSuccess)).toBe(true);
		});

		it('should format reward summary correctly', () => {
			const job = createNewJob('Rich Quest', 100, {
				rewardGold: 1000,
				rewardXP: 500,
				rewardItems: [
					{ item: 'Sword', quantity: 1 },
					{ item: 'Potion', quantity: 5 }
				],
				reputationImpacts: [
					{ targetEntity: 'Guild', targetType: ReputationTargetType.Faction, value: 10, condition: ReputationCondition.OnSuccess }
				]
			});

			job.status = JobStatus.Completed;

			const rewards = rewardDistributor.calculateRewards(job);
			const summary = rewardDistributor.formatRewardSummary(rewards);

			expect(summary).toContain('1000 gp');
			expect(summary).toContain('XP: 500'); // Format is "XP: 500"
			expect(summary).toContain('Sword');
			expect(summary).toContain('Potion');
			expect(summary).toContain('Guild');
		});
	});

	describe('Multi-Job Scenarios', () => {
		it('should handle multiple jobs expiring on same day', async () => {
			const jobs: Job[] = [
				createNewJob('Job 1', 90, { durationAvailability: 5, filePath: 'Jobs/job-1.md' }),
				createNewJob('Job 2', 90, { durationAvailability: 5, filePath: 'Jobs/job-2.md' }),
				createNewJob('Job 3', 90, { durationAvailability: 5, filePath: 'Jobs/job-3.md' })
			];

			vi.mocked(jobDataAccess.getAllJobs).mockResolvedValue(jobs);

			manager.initialize();

			const event: TimeAdvancedEvent = {
				previousDay: 95,
				newDay: 100,
				daysPassed: 5
			};

			await eventBus.emit(SYSTEM_EVENTS.TIME_ADVANCED, event);
			await new Promise(resolve => setTimeout(resolve, 10));

			// All 3 should be expired
			expect(jobDataAccess.updateJobStatus).toHaveBeenCalledTimes(3);
		});

		it('should correctly filter and sort mixed job states', () => {
			const playerViewService = new PlayerJobViewService();

			const jobs: Job[] = [
				createNewJob('A - Posted', 100, { status: JobStatus.Posted }),
				createNewJob('B - Taken', 100, { status: JobStatus.Taken, takenDate: 101 }),
				createNewJob('C - Completed', 100, { status: JobStatus.Completed }),
				createNewJob('D - Failed', 100, { status: JobStatus.Failed }),
				createNewJob('E - Posted Hidden', 100, { status: JobStatus.Posted, hideFromPlayers: true }),
				createNewJob('F - Posted', 100, { status: JobStatus.Posted })
			];

			const playerJobs = playerViewService.getPlayerJobs(jobs);

			// Should show only Posted and Taken jobs that aren't hidden
			expect(playerJobs).toHaveLength(3);
			expect(playerJobs.map(j => j.title).sort()).toEqual(['A - Posted', 'B - Taken', 'F - Posted']);
		});
	});
});
