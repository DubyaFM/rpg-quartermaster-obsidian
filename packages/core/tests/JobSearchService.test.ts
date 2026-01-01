import { describe, it, expect, beforeEach } from 'vitest';
import { JobSearchService, JobSortField, SortDirection, JobGroupField } from '../services/JobSearchService';
import { Job, JobStatus, createNewJob } from '../models/Job';

describe('JobSearchService', () => {
	let service: JobSearchService;
	let testJobs: Job[];

	beforeEach(() => {
		service = new JobSearchService();

		// Create test jobs
		testJobs = [
			createNewJob('Rat Catcher', 90, {
				status: JobStatus.Posted,
				location: 'Waterdeep',
				questgiver: 'Mayor Bob',
				durationAvailability: 10,
				archived: false
			}),
			createNewJob('Save Blacksmith', 85, {
				status: JobStatus.Taken,
				location: 'Neverwinter',
				questgiver: 'Blacksmith Tom',
				takenDate: 90,
				durationCompletion: 7,
				archived: false
			}),
			createNewJob('Escort Caravan', 100, {
				status: JobStatus.Completed,
				location: 'Waterdeep',
				questgiver: 'Merchant Alice',
				archived: false
			}),
			createNewJob('Ancient Quest', 50, {
				status: JobStatus.Expired,
				location: 'Baldurs Gate',
				durationAvailability: 5,
				archived: true
			}),
			createNewJob('Hidden Quest', 95, {
				status: JobStatus.Posted,
				location: 'Neverwinter',
				hideFromPlayers: true,
				archived: false
			})
		];
	});

	describe('filterJobs', () => {
		it('should return all jobs with empty filter', () => {
			const result = service.filterJobs(testJobs, {});

			expect(result).toHaveLength(4); // Excludes archived by default
		});

		it('should filter by archived status', () => {
			const result = service.filterJobs(testJobs, { includeArchived: true });

			expect(result).toHaveLength(5);
		});

		it('should filter by status', () => {
			const result = service.filterJobs(testJobs, {
				statuses: [JobStatus.Posted]
			});

			expect(result).toHaveLength(2);
			expect(result.every(j => j.status === JobStatus.Posted)).toBe(true);
		});

		it('should filter by multiple statuses', () => {
			const result = service.filterJobs(testJobs, {
				statuses: [JobStatus.Posted, JobStatus.Taken]
			});

			expect(result).toHaveLength(3);
		});

		it('should filter by location', () => {
			const result = service.filterJobs(testJobs, {
				locations: ['Waterdeep']
			});

			expect(result).toHaveLength(2);
			expect(result.every(j => j.location === 'Waterdeep')).toBe(true);
		});

		it('should filter by multiple locations', () => {
			const result = service.filterJobs(testJobs, {
				locations: ['Waterdeep', 'Neverwinter']
			});

			expect(result).toHaveLength(4);
		});

		it('should handle case-insensitive location matching', () => {
			const result = service.filterJobs(testJobs, {
				locations: ['waterdeep']
			});

			expect(result).toHaveLength(2);
		});

		it('should filter by hideFromPlayers flag', () => {
			const result = service.filterJobs(testJobs, {
				hideFromPlayers: true
			});

			expect(result).toHaveLength(1);
			expect(result[0].title).toBe('Hidden Quest');
		});

		it('should search by title', () => {
			const result = service.filterJobs(testJobs, {
				searchText: 'Rat'
			});

			expect(result).toHaveLength(1);
			expect(result[0].title).toBe('Rat Catcher');
		});

		it('should search by questgiver', () => {
			const result = service.filterJobs(testJobs, {
				searchText: 'Alice'
			});

			expect(result).toHaveLength(1);
			expect(result[0].questgiver).toContain('Alice');
		});

		it('should search by location', () => {
			const result = service.filterJobs(testJobs, {
				searchText: 'Never'
			});

			expect(result).toHaveLength(2);
		});

		it('should perform case-insensitive search', () => {
			const result = service.filterJobs(testJobs, {
				searchText: 'RAT'
			});

			expect(result).toHaveLength(1);
			expect(result[0].title).toBe('Rat Catcher');
		});

		it('should combine multiple filters', () => {
			const result = service.filterJobs(testJobs, {
				statuses: [JobStatus.Posted, JobStatus.Taken],
				locations: ['Waterdeep']
			});

			expect(result).toHaveLength(1);
			expect(result[0].title).toBe('Rat Catcher');
		});

		it('should not mutate original jobs array', () => {
			const original = [...testJobs];
			service.filterJobs(testJobs, { statuses: [JobStatus.Posted] });

			expect(testJobs).toEqual(original);
		});
	});

	describe('sortJobs', () => {
		it('should sort by title ascending', () => {
			const result = service.sortJobs(testJobs, {
				field: JobSortField.Title,
				direction: SortDirection.Ascending
			});

			expect(result[0].title).toBe('Ancient Quest');
			expect(result[result.length - 1].title).toBe('Save Blacksmith');
		});

		it('should sort by title descending', () => {
			const result = service.sortJobs(testJobs, {
				field: JobSortField.Title,
				direction: SortDirection.Descending
			});

			expect(result[0].title).toBe('Save Blacksmith');
			expect(result[result.length - 1].title).toBe('Ancient Quest');
		});

		it('should sort by postDate ascending', () => {
			const result = service.sortJobs(testJobs, {
				field: JobSortField.PostDate,
				direction: SortDirection.Ascending
			});

			expect(result[0].postDate).toBe(50);
			expect(result[result.length - 1].postDate).toBe(100);
		});

		it('should sort by postDate descending', () => {
			const result = service.sortJobs(testJobs, {
				field: JobSortField.PostDate,
				direction: SortDirection.Descending
			});

			expect(result[0].postDate).toBe(100);
			expect(result[result.length - 1].postDate).toBe(50);
		});

		it('should sort by status with priority order', () => {
			const result = service.sortJobs(testJobs, {
				field: JobSortField.Status,
				direction: SortDirection.Ascending
			});

			// Posted > Taken > Expired > Failed > Completed > Cancelled
			expect(result[0].status).toBe(JobStatus.Posted);
			expect(result[result.length - 1].status).toBe(JobStatus.Completed);
		});

		it('should sort by location', () => {
			const result = service.sortJobs(testJobs, {
				field: JobSortField.Location,
				direction: SortDirection.Ascending
			});

			expect(result[0].location).toBe('Baldurs Gate');
		});

		it('should sort by days remaining when current day provided', () => {
			const result = service.sortJobs(testJobs, {
				field: JobSortField.DaysRemaining,
				direction: SortDirection.Ascending
			}, 95);

			// Taken job (deadline day 97) should come before Posted job (expires day 100)
			const takenJob = result.find(j => j.status === JobStatus.Taken);
			const postedJob = result.find(j => j.status === JobStatus.Posted && j.title === 'Rat Catcher');

			expect(result.indexOf(takenJob!)).toBeLessThan(result.indexOf(postedJob!));
		});

		it('should put indefinite jobs at end when sorting by days remaining', () => {
			const jobWithLimit = createNewJob('Limited', 100, {
				status: JobStatus.Posted,
				durationAvailability: 5
			});

			const jobNoLimit = createNewJob('Unlimited', 100, {
				status: JobStatus.Posted,
				durationAvailability: 0
			});

			const result = service.sortJobs([jobNoLimit, jobWithLimit], {
				field: JobSortField.DaysRemaining,
				direction: SortDirection.Ascending
			}, 105);

			expect(result[0].title).toBe('Limited');
			expect(result[1].title).toBe('Unlimited');
		});

		it('should not mutate original jobs array', () => {
			const original = [...testJobs];
			service.sortJobs(testJobs, {
				field: JobSortField.Title,
				direction: SortDirection.Ascending
			});

			expect(testJobs).toEqual(original);
		});
	});

	describe('groupJobs', () => {
		it('should return single group when groupBy is None', () => {
			const result = service.groupJobs(testJobs, JobGroupField.None);

			expect(result).toHaveLength(1);
			expect(result[0].label).toBe('All Jobs');
			expect(result[0].jobs).toHaveLength(5);
		});

		it('should group by status', () => {
			const result = service.groupJobs(testJobs, JobGroupField.Status);

			expect(result.length).toBeGreaterThan(1);

			const postedGroup = result.find(g => g.label === JobStatus.Posted);
			expect(postedGroup).toBeDefined();
			expect(postedGroup!.jobs).toHaveLength(2);

			const takenGroup = result.find(g => g.label === JobStatus.Taken);
			expect(takenGroup).toBeDefined();
			expect(takenGroup!.jobs).toHaveLength(1);
		});

		it('should group by location', () => {
			const result = service.groupJobs(testJobs, JobGroupField.Location);

			const waterdeepGroup = result.find(g => g.label === 'Waterdeep');
			expect(waterdeepGroup).toBeDefined();
			expect(waterdeepGroup!.jobs).toHaveLength(2);

			const neverwinterGroup = result.find(g => g.label === 'Neverwinter');
			expect(neverwinterGroup).toBeDefined();
			expect(neverwinterGroup!.jobs).toHaveLength(2);
		});

		it('should use "No Location" for jobs without location', () => {
			const jobNoLocation = createNewJob('Test', 100, {
				status: JobStatus.Posted
			});

			const result = service.groupJobs([jobNoLocation], JobGroupField.Location);

			expect(result[0].label).toBe('No Location');
		});

		it('should sort groups alphabetically for location grouping', () => {
			const result = service.groupJobs(testJobs, JobGroupField.Location);

			expect(result[0].label).toBe('Baldurs Gate');
		});

		it('should sort groups by status priority for status grouping', () => {
			const result = service.groupJobs(testJobs, JobGroupField.Status);

			// Posted > Taken > Expired > Completed
			expect(result[0].label).toBe(JobStatus.Posted);
		});
	});

	describe('getUniqueLocations', () => {
		it('should return sorted unique locations', () => {
			const result = service.getUniqueLocations(testJobs);

			expect(result).toContain('Waterdeep');
			expect(result).toContain('Neverwinter');
			expect(result).toContain('Baldurs Gate');
			expect(result).toHaveLength(3);
		});

		it('should handle jobs without location', () => {
			const jobNoLocation = createNewJob('Test', 100, {
				status: JobStatus.Posted
			});

			const result = service.getUniqueLocations([...testJobs, jobNoLocation]);

			expect(result).toHaveLength(3);
		});

		it('should extract location from wikilink', () => {
			const job = createNewJob('Test', 100, {
				status: JobStatus.Posted,
				location: '[[Locations/Waterdeep]]'
			});

			const result = service.getUniqueLocations([job]);

			expect(result).toContain('Waterdeep');
		});

		it('should return sorted array', () => {
			const result = service.getUniqueLocations(testJobs);

			for (let i = 1; i < result.length; i++) {
				expect(result[i] >= result[i - 1]).toBe(true);
			}
		});
	});

	describe('getUniqueQuestgivers', () => {
		it('should return sorted unique questgivers', () => {
			const result = service.getUniqueQuestgivers(testJobs);

			expect(result).toContain('Mayor Bob');
			expect(result).toContain('Blacksmith Tom');
			expect(result).toContain('Merchant Alice');
			expect(result).toHaveLength(3);
		});

		it('should handle jobs without questgiver', () => {
			const result = service.getUniqueQuestgivers(testJobs);

			// Hidden Quest and Ancient Quest don't have questgivers
			expect(result).toHaveLength(3);
		});

		it('should extract questgiver from wikilink', () => {
			const job = createNewJob('Test', 100, {
				status: JobStatus.Posted,
				questgiver: '[[NPCs/Bob the Builder]]'
			});

			const result = service.getUniqueQuestgivers([job]);

			expect(result).toContain('Bob the Builder');
		});
	});
});
