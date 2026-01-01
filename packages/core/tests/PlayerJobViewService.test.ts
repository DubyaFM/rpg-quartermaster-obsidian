/**
 * Tests for PlayerJobViewService
 *
 * Verifies job filtering and formatting for player views
 */

import { describe, it, expect } from 'vitest';
import { PlayerJobViewService } from '../services/PlayerJobViewService';
import type { Job } from '../models/Job';
import { JobStatus } from '../models/Job';

// Test fixtures
const createTestJob = (overrides: Partial<Job> = {}): Job => ({
	title: 'Test Job',
	status: JobStatus.Posted,
	postDate: 1,
	takenDate: null,
	durationAvailability: 10,
	durationCompletion: 5,
	rewardGold: 100,
	rewardXP: 200,
	rewardItems: [],
	reputationImpacts: [],
	hideFromPlayers: false,
	archived: false,
	...overrides
});

describe('PlayerJobViewService', () => {
	describe('filterPlayerVisibleJobs', () => {
		it('should exclude jobs with hideFromPlayers = true', () => {
			const service = new PlayerJobViewService();
			const jobs: Job[] = [
				createTestJob({ title: 'Public Job', hideFromPlayers: false }),
				createTestJob({ title: 'Secret Job', hideFromPlayers: true })
			];

			const result = service.filterPlayerVisibleJobs(jobs);

			expect(result).toHaveLength(1);
			expect(result[0].title).toBe('Public Job');
		});

		it('should exclude archived jobs', () => {
			const service = new PlayerJobViewService();
			const jobs: Job[] = [
				createTestJob({ title: 'Active Job', archived: false }),
				createTestJob({ title: 'Archived Job', archived: true })
			];

			const result = service.filterPlayerVisibleJobs(jobs);

			expect(result).toHaveLength(1);
			expect(result[0].title).toBe('Active Job');
		});

		it('should filter by status when includeStatuses is specified', () => {
			const service = new PlayerJobViewService();
			const jobs: Job[] = [
				createTestJob({ title: 'Posted Job', status: JobStatus.Posted }),
				createTestJob({ title: 'Taken Job', status: JobStatus.Taken }),
				createTestJob({ title: 'Completed Job', status: JobStatus.Completed })
			];

			const result = service.filterPlayerVisibleJobs(jobs, {
				includeStatuses: [JobStatus.Posted, JobStatus.Taken]
			});

			expect(result).toHaveLength(2);
			expect(result.map(j => j.title)).toEqual(['Posted Job', 'Taken Job']);
		});

		it('should use default status filter [Posted, Taken] when no options provided', () => {
			const service = new PlayerJobViewService();
			const jobs: Job[] = [
				createTestJob({ title: 'Posted Job', status: JobStatus.Posted }),
				createTestJob({ title: 'Taken Job', status: JobStatus.Taken }),
				createTestJob({ title: 'Completed Job', status: JobStatus.Completed }),
				createTestJob({ title: 'Failed Job', status: JobStatus.Failed })
			];

			const result = service.filterPlayerVisibleJobs(jobs);

			expect(result).toHaveLength(2);
			expect(result.map(j => j.title).sort()).toEqual(['Posted Job', 'Taken Job']);
		});

		it('should filter by location (exact match)', () => {
			const service = new PlayerJobViewService();
			const jobs: Job[] = [
				createTestJob({ title: 'Waterdeep Job', location: 'Waterdeep' }),
				createTestJob({ title: 'Baldurs Gate Job', location: 'Baldurs Gate' })
			];

			const result = service.filterPlayerVisibleJobs(jobs, {
				location: 'Waterdeep'
			});

			expect(result).toHaveLength(1);
			expect(result[0].title).toBe('Waterdeep Job');
		});

		it('should filter by location (partial match)', () => {
			const service = new PlayerJobViewService();
			const jobs: Job[] = [
				createTestJob({ title: 'Market District Job', location: 'Waterdeep Market District' }),
				createTestJob({ title: 'Dock Ward Job', location: 'Waterdeep Dock Ward' }),
				createTestJob({ title: 'Other City Job', location: 'Baldurs Gate' })
			];

			const result = service.filterPlayerVisibleJobs(jobs, {
				location: 'Waterdeep'
			});

			expect(result).toHaveLength(2);
			expect(result.map(j => j.title).sort()).toEqual(['Dock Ward Job', 'Market District Job']);
		});

		it('should filter by location with wikilink extraction', () => {
			const service = new PlayerJobViewService();
			const jobs: Job[] = [
				createTestJob({ title: 'Job 1', location: '[[Waterdeep]]' }),
				createTestJob({ title: 'Job 2', location: '[[Waterdeep|The City of Splendors]]' }),
				createTestJob({ title: 'Job 3', location: '[[Baldurs Gate]]' })
			];

			const result = service.filterPlayerVisibleJobs(jobs, {
				location: 'Waterdeep'
			});

			expect(result).toHaveLength(2);
			expect(result.map(j => j.title).sort()).toEqual(['Job 1', 'Job 2']);
		});

		it('should filter by search query (title, location, questgiver)', () => {
			const service = new PlayerJobViewService();
			const jobs: Job[] = [
				createTestJob({ title: 'Find the Lost Dragon', location: 'Waterdeep', questgiver: 'Lord Neverember' }),
				createTestJob({ title: 'Rescue the Princess', location: 'Castle', questgiver: 'King Arthur' }),
				createTestJob({ title: 'Slay the Dragon', location: 'Mountain', questgiver: 'Village Elder' })
			];

			const result = service.filterPlayerVisibleJobs(jobs, {
				searchQuery: 'dragon'
			});

			expect(result).toHaveLength(2);
			expect(result.map(j => j.title).sort()).toEqual(['Find the Lost Dragon', 'Slay the Dragon']);
		});

		it('should filter by search query with case insensitivity', () => {
			const service = new PlayerJobViewService();
			const jobs: Job[] = [
				createTestJob({ title: 'URGENT: Dragon Attack', location: 'Waterdeep' }),
				createTestJob({ title: 'Find the Treasure', location: 'Cave' })
			];

			const result = service.filterPlayerVisibleJobs(jobs, {
				searchQuery: 'dragon'
			});

			expect(result).toHaveLength(1);
			expect(result[0].title).toBe('URGENT: Dragon Attack');
		});

		it('should filter by includeTakenJobs option', () => {
			const service = new PlayerJobViewService();
			const jobs: Job[] = [
				createTestJob({ title: 'Posted Job', status: JobStatus.Posted }),
				createTestJob({ title: 'Taken Job', status: JobStatus.Taken })
			];

			const result = service.filterPlayerVisibleJobs(jobs, {
				includeTakenJobs: false
			});

			expect(result).toHaveLength(1);
			expect(result[0].title).toBe('Posted Job');
		});

		it('should filter by includePostedJobs option', () => {
			const service = new PlayerJobViewService();
			const jobs: Job[] = [
				createTestJob({ title: 'Posted Job', status: JobStatus.Posted }),
				createTestJob({ title: 'Taken Job', status: JobStatus.Taken })
			];

			const result = service.filterPlayerVisibleJobs(jobs, {
				includePostedJobs: false
			});

			expect(result).toHaveLength(1);
			expect(result[0].title).toBe('Taken Job');
		});

		it('should apply multiple filters simultaneously', () => {
			const service = new PlayerJobViewService();
			const jobs: Job[] = [
				createTestJob({ title: 'Waterdeep Posted Job', status: JobStatus.Posted, location: 'Waterdeep', hideFromPlayers: false }),
				createTestJob({ title: 'Waterdeep Taken Job', status: JobStatus.Taken, location: 'Waterdeep', hideFromPlayers: false }),
				createTestJob({ title: 'Waterdeep Secret Job', status: JobStatus.Posted, location: 'Waterdeep', hideFromPlayers: true }),
				createTestJob({ title: 'Baldurs Gate Job', status: JobStatus.Posted, location: 'Baldurs Gate', hideFromPlayers: false })
			];

			const result = service.filterPlayerVisibleJobs(jobs, {
				location: 'Waterdeep',
				includeStatuses: [JobStatus.Posted, JobStatus.Taken]
			});

			expect(result).toHaveLength(2);
			expect(result.map(j => j.title).sort()).toEqual(['Waterdeep Posted Job', 'Waterdeep Taken Job']);
		});
	});

	describe('toPlayerJob', () => {
		it('should convert Job to PlayerJob', () => {
			const service = new PlayerJobViewService();
			const job = createTestJob({
				title: 'Test Job',
				location: 'Waterdeep',
				questgiver: 'Lord Neverember',
				prerequisites: 'Level 5+',
				status: JobStatus.Posted,
				postDate: 1,
				takenDate: null,
				durationAvailability: 10,
				durationCompletion: 5,
				rewardGold: 100,
				rewardXP: 200,
				rewardItems: [{ item: 'Sword', quantity: 1 }],
				reputationImpacts: [{ targetEntity: 'City Watch', targetType: 'Faction', condition: 'On Success', value: 10 }]
			});

			const playerJob = service.toPlayerJob(job);

			expect(playerJob.title).toBe('Test Job');
			expect(playerJob.location).toBe('Waterdeep');
			expect(playerJob.questgiver).toBe('Lord Neverember');
			expect(playerJob.prerequisites).toBe('Level 5+');
			expect(playerJob.status).toBe(JobStatus.Posted);
			expect(playerJob.rewardGold).toBe(100);
			expect(playerJob.rewardXP).toBe(200);
			expect(playerJob.rewardItems).toHaveLength(1);
			expect(playerJob.reputationImpacts).toHaveLength(1);

			// Should not have GM-only fields
			expect('hideFromPlayers' in playerJob).toBe(false);
			expect('archived' in playerJob).toBe(false);
			expect('narrativeConsequence' in playerJob).toBe(false);
			expect('filePath' in playerJob).toBe(false);
		});

		it('should hide prerequisites when config.showPrerequisites = false', () => {
			const service = new PlayerJobViewService({
				showPrerequisites: false
			});
			const job = createTestJob({
				prerequisites: 'Level 5+'
			});

			const playerJob = service.toPlayerJob(job);

			expect(playerJob.prerequisites).toBeUndefined();
		});

		it('should hide reputation impacts when config.showReputationImpacts = false', () => {
			const service = new PlayerJobViewService({
				showReputationImpacts: false
			});
			const job = createTestJob({
				reputationImpacts: [{ targetEntity: 'City Watch', targetType: 'Faction', condition: 'On Success', value: 10 }]
			});

			const playerJob = service.toPlayerJob(job);

			expect(playerJob.reputationImpacts).toHaveLength(0);
		});

		it('should apply all config settings', () => {
			const service = new PlayerJobViewService({
				showPrerequisites: false,
				showReputationImpacts: false,
				showExactTimeRemaining: false
			});
			const job = createTestJob({
				prerequisites: 'Level 5+',
				reputationImpacts: [{ targetEntity: 'City Watch', targetType: 'Faction', condition: 'On Success', value: 10 }]
			});

			const playerJob = service.toPlayerJob(job);

			expect(playerJob.prerequisites).toBeUndefined();
			expect(playerJob.reputationImpacts).toHaveLength(0);
		});
	});

	describe('getPlayerJobs', () => {
		it('should combine filtering and conversion', () => {
			const service = new PlayerJobViewService();
			const jobs: Job[] = [
				createTestJob({ title: 'Public Job', hideFromPlayers: false, status: JobStatus.Posted }),
				createTestJob({ title: 'Secret Job', hideFromPlayers: true, status: JobStatus.Posted }),
				createTestJob({ title: 'Completed Job', hideFromPlayers: false, status: JobStatus.Completed })
			];

			const result = service.getPlayerJobs(jobs);

			expect(result).toHaveLength(1);
			expect(result[0].title).toBe('Public Job');
			expect('hideFromPlayers' in result[0]).toBe(false);
		});

		it('should apply filter options and config settings', () => {
			const service = new PlayerJobViewService({
				showReputationImpacts: false
			});
			const jobs: Job[] = [
				createTestJob({
					title: 'Waterdeep Job',
					location: 'Waterdeep',
					status: JobStatus.Posted,
					reputationImpacts: [{ targetEntity: 'City Watch', targetType: 'Faction', condition: 'On Success', value: 10 }]
				}),
				createTestJob({ title: 'Baldurs Gate Job', location: 'Baldurs Gate', status: JobStatus.Posted })
			];

			const result = service.getPlayerJobs(jobs, {
				location: 'Waterdeep'
			});

			expect(result).toHaveLength(1);
			expect(result[0].title).toBe('Waterdeep Job');
			expect(result[0].reputationImpacts).toHaveLength(0);
		});
	});

	describe('getAvailableLocations', () => {
		it('should return unique locations from player-visible jobs', () => {
			const service = new PlayerJobViewService();
			const jobs: Job[] = [
				createTestJob({ location: 'Waterdeep', hideFromPlayers: false }),
				createTestJob({ location: 'Waterdeep', hideFromPlayers: false }),
				createTestJob({ location: 'Baldurs Gate', hideFromPlayers: false }),
				createTestJob({ location: 'Neverwinter', hideFromPlayers: true }) // Hidden
			];

			const result = service.getAvailableLocations(jobs);

			expect(result).toHaveLength(2);
			expect(result.sort()).toEqual(['Baldurs Gate', 'Waterdeep']);
		});

		it('should extract text from wikilinks', () => {
			const service = new PlayerJobViewService();
			const jobs: Job[] = [
				createTestJob({ location: '[[Waterdeep]]' }),
				createTestJob({ location: '[[Waterdeep|The City of Splendors]]' }),
				createTestJob({ location: '[[Baldurs Gate]]' })
			];

			const result = service.getAvailableLocations(jobs);

			expect(result).toHaveLength(2);
			expect(result.sort()).toEqual(['Baldurs Gate', 'Waterdeep']);
		});

		it('should exclude jobs with no location', () => {
			const service = new PlayerJobViewService();
			const jobs: Job[] = [
				createTestJob({ location: 'Waterdeep' }),
				createTestJob({ location: undefined })
			];

			const result = service.getAvailableLocations(jobs);

			expect(result).toHaveLength(1);
			expect(result).toEqual(['Waterdeep']);
		});

		it('should return empty array when no locations available', () => {
			const service = new PlayerJobViewService();
			const jobs: Job[] = [
				createTestJob({ location: undefined }),
				createTestJob({ location: undefined })
			];

			const result = service.getAvailableLocations(jobs);

			expect(result).toHaveLength(0);
		});
	});

	describe('getJobCountsByStatus', () => {
		it('should count jobs by status (player-visible only)', () => {
			const service = new PlayerJobViewService();
			const jobs: Job[] = [
				createTestJob({ status: JobStatus.Posted, hideFromPlayers: false }),
				createTestJob({ status: JobStatus.Posted, hideFromPlayers: false }),
				createTestJob({ status: JobStatus.Taken, hideFromPlayers: false }),
				createTestJob({ status: JobStatus.Completed, hideFromPlayers: false }),
				createTestJob({ status: JobStatus.Posted, hideFromPlayers: true }) // Hidden
			];

			const result = service.getJobCountsByStatus(jobs);

			expect(result[JobStatus.Posted]).toBe(2);
			expect(result[JobStatus.Taken]).toBe(1);
			expect(result[JobStatus.Completed]).toBe(1);
			expect(result[JobStatus.Failed]).toBe(0);
			expect(result[JobStatus.Expired]).toBe(0);
			expect(result[JobStatus.Cancelled]).toBe(0);
		});

		it('should exclude archived jobs from counts', () => {
			const service = new PlayerJobViewService();
			const jobs: Job[] = [
				createTestJob({ status: JobStatus.Posted, archived: false }),
				createTestJob({ status: JobStatus.Posted, archived: true }) // Archived
			];

			const result = service.getJobCountsByStatus(jobs);

			expect(result[JobStatus.Posted]).toBe(1);
		});

		it('should return zero counts when no visible jobs', () => {
			const service = new PlayerJobViewService();
			const jobs: Job[] = [
				createTestJob({ hideFromPlayers: true }),
				createTestJob({ archived: true })
			];

			const result = service.getJobCountsByStatus(jobs);

			expect(result[JobStatus.Posted]).toBe(0);
			expect(result[JobStatus.Taken]).toBe(0);
			expect(result[JobStatus.Completed]).toBe(0);
			expect(result[JobStatus.Failed]).toBe(0);
			expect(result[JobStatus.Expired]).toBe(0);
			expect(result[JobStatus.Cancelled]).toBe(0);
		});
	});

	describe('updateConfig', () => {
		it('should update configuration', () => {
			const service = new PlayerJobViewService();
			const job = createTestJob({
				prerequisites: 'Level 5+',
				reputationImpacts: [{ targetEntity: 'City Watch', targetType: 'Faction', condition: 'On Success', value: 10 }]
			});

			// Initial config (defaults)
			let playerJob = service.toPlayerJob(job);
			expect(playerJob.prerequisites).toBe('Level 5+');
			expect(playerJob.reputationImpacts).toHaveLength(1);

			// Update config
			service.updateConfig({
				showPrerequisites: false,
				showReputationImpacts: false
			});

			// Test updated config
			playerJob = service.toPlayerJob(job);
			expect(playerJob.prerequisites).toBeUndefined();
			expect(playerJob.reputationImpacts).toHaveLength(0);
		});

		it('should merge partial config updates', () => {
			const service = new PlayerJobViewService({
				showPrerequisites: false,
				showReputationImpacts: false
			});

			// Update only one setting
			service.updateConfig({
				showPrerequisites: true
			});

			const job = createTestJob({
				prerequisites: 'Level 5+',
				reputationImpacts: [{ targetEntity: 'City Watch', targetType: 'Faction', condition: 'On Success', value: 10 }]
			});

			const playerJob = service.toPlayerJob(job);
			expect(playerJob.prerequisites).toBe('Level 5+');
			expect(playerJob.reputationImpacts).toHaveLength(0); // Still hidden
		});
	});

	describe('wikilink extraction', () => {
		it('should handle various wikilink formats and extract page names', () => {
			const service = new PlayerJobViewService();
			const jobs: Job[] = [
				createTestJob({ location: '[[Waterdeep]]' }),
				createTestJob({ location: '[[Waterdeep|The City of Splendors]]' }), // Should extract "Waterdeep", not display text
				createTestJob({ location: 'Plain Text' })
			];

			const result = service.getAvailableLocations(jobs);

			// Should deduplicate "Waterdeep" from both wikilink formats
			expect(result.sort()).toEqual(['Plain Text', 'Waterdeep']);
		});

		it('should handle search with wikilinks', () => {
			const service = new PlayerJobViewService();
			const jobs: Job[] = [
				createTestJob({ title: 'Job 1', questgiver: '[[Lord Neverember]]' }),
				createTestJob({ title: 'Job 2', questgiver: '[[King Arthur|The Once and Future King]]' }),
				createTestJob({ title: 'Job 3', questgiver: 'Plain Text Neverember' })
			];

			const result = service.filterPlayerVisibleJobs(jobs, {
				searchQuery: 'neverember'
			});

			expect(result).toHaveLength(2);
			expect(result.map(j => j.title).sort()).toEqual(['Job 1', 'Job 3']);
		});
	});
});
