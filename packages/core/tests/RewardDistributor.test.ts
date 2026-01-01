import { describe, it, expect, beforeEach } from 'vitest';
import { RewardDistributor } from '../services/RewardDistributor';
import { Job, JobStatus, ReputationCondition, ReputationTargetType, createNewJob } from '../models/Job';

describe('RewardDistributor', () => {
	let distributor: RewardDistributor;

	beforeEach(() => {
		distributor = new RewardDistributor();
	});

	describe('calculateRewards', () => {
		it('should return rewards for completed job', () => {
			const job = createNewJob('Test Job', 100, {
				status: JobStatus.Completed,
				rewardGold: 100,
				rewardXP: 500,
				rewardItems: [
					{ item: 'Potion of Healing', quantity: 3 },
					{ item: 'Ring of Protection', quantity: 1 }
				]
			});

			const result = distributor.calculateRewards(job);

			expect(result.goldReward).toBe(100);
			expect(result.xpReward).toBe(500);
			expect(result.itemRewards).toHaveLength(2);
			expect(result.warnings).toHaveLength(0);
		});

		it('should warn about non-terminal status', () => {
			const job = createNewJob('Posted Job', 100, {
				status: JobStatus.Posted,
				rewardGold: 50
			});

			const result = distributor.calculateRewards(job);

			expect(result.warnings).toContain(
				'Job status is Posted. Rewards should only be distributed for terminal states (Completed, Failed, Expired).'
			);
		});

		it('should warn about negative gold reward', () => {
			const job = createNewJob('Bad Job', 100, {
				status: JobStatus.Completed,
				rewardGold: -50
			});

			const result = distributor.calculateRewards(job);

			expect(result.warnings.some(w => w.includes('Gold reward is negative'))).toBe(true);
		});

		it('should warn about negative XP reward', () => {
			const job = createNewJob('Bad Job', 100, {
				status: JobStatus.Completed,
				rewardXP: -100
			});

			const result = distributor.calculateRewards(job);

			expect(result.warnings.some(w => w.includes('XP reward is negative'))).toBe(true);
		});

		it('should warn about invalid item quantities', () => {
			const job = createNewJob('Bad Job', 100, {
				status: JobStatus.Completed,
				rewardItems: [
					{ item: 'Test Item', quantity: 0 },
					{ item: 'Test Item 2', quantity: -5 },
					{ item: 'Test Item 3', quantity: 2.5 }
				]
			});

			const result = distributor.calculateRewards(job);

			expect(result.warnings.length).toBeGreaterThan(0);
			expect(result.warnings.some(w => w.includes('invalid quantity (0)'))).toBe(true);
			expect(result.warnings.some(w => w.includes('invalid quantity (-5)'))).toBe(true);
			expect(result.warnings.some(w => w.includes('non-integer quantity (2.5)'))).toBe(true);
		});

		it('should clone reward items array to prevent mutations', () => {
			const items = [{ item: 'Potion', quantity: 1 }];
			const job = createNewJob('Test Job', 100, {
				status: JobStatus.Completed,
				rewardItems: items
			});

			const result = distributor.calculateRewards(job);

			expect(result.itemRewards).not.toBe(items);
			expect(result.itemRewards).toEqual(items);
		});
	});

	describe('filterReputationImpacts', () => {
		it('should filter OnSuccess impacts for Completed job', () => {
			const job = createNewJob('Completed Job', 100, {
				status: JobStatus.Completed,
				reputationImpacts: [
					{
						targetType: ReputationTargetType.Location,
						targetEntity: 'Waterdeep',
						value: 2,
						condition: ReputationCondition.OnSuccess
					},
					{
						targetType: ReputationTargetType.Faction,
						targetEntity: 'Harpers',
						value: -1,
						condition: ReputationCondition.OnFailure
					},
					{
						targetType: ReputationTargetType.NPC,
						targetEntity: 'Mayor',
						value: 3,
						condition: ReputationCondition.OnSuccess
					}
				]
			});

			const result = distributor.filterReputationImpacts(job);

			expect(result).toHaveLength(2);
			expect(result.every(r => r.condition === ReputationCondition.OnSuccess)).toBe(true);
		});

		it('should filter OnFailure impacts for Failed job', () => {
			const job = createNewJob('Failed Job', 100, {
				status: JobStatus.Failed,
				reputationImpacts: [
					{
						targetType: ReputationTargetType.Location,
						targetEntity: 'Waterdeep',
						value: 2,
						condition: ReputationCondition.OnSuccess
					},
					{
						targetType: ReputationTargetType.Faction,
						targetEntity: 'Zhentarim',
						value: -2,
						condition: ReputationCondition.OnFailure
					}
				]
			});

			const result = distributor.filterReputationImpacts(job);

			expect(result).toHaveLength(1);
			expect(result[0].condition).toBe(ReputationCondition.OnFailure);
			expect(result[0].targetEntity).toBe('Zhentarim');
		});

		it('should filter OnExpiration impacts for Expired job', () => {
			const job = createNewJob('Expired Job', 100, {
				status: JobStatus.Expired,
				reputationImpacts: [
					{
						targetType: ReputationTargetType.Location,
						targetEntity: 'Village',
						value: -3,
						condition: ReputationCondition.OnExpiration
					},
					{
						targetType: ReputationTargetType.Faction,
						targetEntity: 'Guild',
						value: 1,
						condition: ReputationCondition.OnSuccess
					}
				]
			});

			const result = distributor.filterReputationImpacts(job);

			expect(result).toHaveLength(1);
			expect(result[0].condition).toBe(ReputationCondition.OnExpiration);
		});

		it('should return empty array for non-terminal states', () => {
			const job = createNewJob('Posted Job', 100, {
				status: JobStatus.Posted,
				reputationImpacts: [
					{
						targetType: ReputationTargetType.Location,
						targetEntity: 'Test',
						value: 1,
						condition: ReputationCondition.OnSuccess
					}
				]
			});

			const result = distributor.filterReputationImpacts(job);

			expect(result).toEqual([]);
		});
	});

	describe('validateReputationImpacts', () => {
		it('should warn about empty target entity', () => {
			const impacts = [
				{
					targetType: ReputationTargetType.Location,
					targetEntity: '',
					value: 1,
					condition: ReputationCondition.OnSuccess
				}
			];

			const warnings = distributor.validateReputationImpacts(impacts);

			expect(warnings.some(w => w.includes('empty target entity'))).toBe(true);
		});

		it('should warn about non-integer renown values', () => {
			const impacts = [
				{
					targetType: ReputationTargetType.Location,
					targetEntity: 'Waterdeep',
					value: 2.5,
					condition: ReputationCondition.OnSuccess
				}
			];

			const warnings = distributor.validateReputationImpacts(impacts);

			expect(warnings.some(w => w.includes('non-integer value'))).toBe(true);
		});

		it('should warn about very large impact values', () => {
			const impacts = [
				{
					targetType: ReputationTargetType.Location,
					targetEntity: 'Waterdeep',
					value: 150,
					condition: ReputationCondition.OnSuccess
				},
				{
					targetType: ReputationTargetType.Faction,
					targetEntity: 'Guild',
					value: -200,
					condition: ReputationCondition.OnFailure
				}
			];

			const warnings = distributor.validateReputationImpacts(impacts);

			expect(warnings.length).toBe(2);
			expect(warnings.some(w => w.includes('very large value'))).toBe(true);
		});

		it('should return empty warnings for valid impacts', () => {
			const impacts = [
				{
					targetType: ReputationTargetType.Location,
					targetEntity: 'Waterdeep',
					value: 2,
					condition: ReputationCondition.OnSuccess
				},
				{
					targetType: ReputationTargetType.Faction,
					targetEntity: 'Harpers',
					value: -3,
					condition: ReputationCondition.OnFailure
				}
			];

			const warnings = distributor.validateReputationImpacts(impacts);

			expect(warnings).toEqual([]);
		});
	});

	describe('formatRewardSummary', () => {
		it('should format all reward types', () => {
			const result = {
				goldReward: 100,
				xpReward: 500,
				itemRewards: [
					{ item: 'Potion of Healing', quantity: 3 },
					{ item: 'Ring of Protection', quantity: 1 }
				],
				reputationImpacts: [
					{
						targetType: ReputationTargetType.Location,
						targetEntity: 'Waterdeep',
						value: 2,
						condition: ReputationCondition.OnSuccess
					},
					{
						targetType: ReputationTargetType.Faction,
						targetEntity: 'Zhentarim',
						value: -1,
						condition: ReputationCondition.OnFailure
					}
				],
				warnings: []
			};

			const summary = distributor.formatRewardSummary(result);

			expect(summary).toContain('Gold: 100 gp');
			expect(summary).toContain('XP: 500');
			expect(summary).toContain('Potion of Healing (3)');
			expect(summary).toContain('Ring of Protection (1)');
			expect(summary).toContain('Waterdeep +2');
			expect(summary).toContain('Zhentarim -1');
		});

		it('should omit zero gold', () => {
			const result = {
				goldReward: 0,
				xpReward: 100,
				itemRewards: [],
				reputationImpacts: [],
				warnings: []
			};

			const summary = distributor.formatRewardSummary(result);

			expect(summary).not.toContain('Gold:');
			expect(summary).toContain('XP: 100');
		});

		it('should omit zero XP', () => {
			const result = {
				goldReward: 50,
				xpReward: 0,
				itemRewards: [],
				reputationImpacts: [],
				warnings: []
			};

			const summary = distributor.formatRewardSummary(result);

			expect(summary).toContain('Gold: 50 gp');
			expect(summary).not.toContain('XP:');
		});

		it('should show "No rewards to distribute" when all empty', () => {
			const result = {
				goldReward: 0,
				xpReward: 0,
				itemRewards: [],
				reputationImpacts: [],
				warnings: []
			};

			const summary = distributor.formatRewardSummary(result);

			expect(summary).toBe('No rewards to distribute');
		});

		it('should extract item names from wikilinks', () => {
			const result = {
				goldReward: 0,
				xpReward: 0,
				itemRewards: [
					{ item: '[[Items/Magic Items/Ring of Protection]]', quantity: 1 },
					{ item: '[[Items/Potion|Healing Potion]]', quantity: 2 }
				],
				reputationImpacts: [],
				warnings: []
			};

			const summary = distributor.formatRewardSummary(result);

			expect(summary).toContain('Ring of Protection (1)');
			expect(summary).toContain('Healing Potion (2)');
		});

		it('should extract entity names from wikilinks in reputation impacts', () => {
			const result = {
				goldReward: 0,
				xpReward: 0,
				itemRewards: [],
				reputationImpacts: [
					{
						targetType: ReputationTargetType.Faction,
						targetEntity: '[[Factions/Harpers]]',
						value: 3,
						condition: ReputationCondition.OnSuccess
					}
				],
				warnings: []
			};

			const summary = distributor.formatRewardSummary(result);

			expect(summary).toContain('Harpers +3');
		});
	});

	describe('shouldPromptGMReview', () => {
		it('should prompt review when there are warnings', () => {
			const job = createNewJob('Test Job', 100, {
				status: JobStatus.Completed,
				rewardGold: -50
			});

			const result = distributor.calculateRewards(job);
			const shouldReview = distributor.shouldPromptGMReview(job, result);

			expect(shouldReview).toBe(true);
		});

		it('should prompt review for failed job with reputation impacts', () => {
			const job = createNewJob('Failed Job', 100, {
				status: JobStatus.Failed,
				reputationImpacts: [
					{
						targetType: ReputationTargetType.Location,
						targetEntity: 'Village',
						value: -2,
						condition: ReputationCondition.OnFailure
					}
				]
			});

			const result = distributor.calculateRewards(job);
			const shouldReview = distributor.shouldPromptGMReview(job, result);

			expect(shouldReview).toBe(true);
		});

		it('should prompt review for expired job with reputation impacts', () => {
			const job = createNewJob('Expired Job', 100, {
				status: JobStatus.Expired,
				reputationImpacts: [
					{
						targetType: ReputationTargetType.Location,
						targetEntity: 'Town',
						value: -1,
						condition: ReputationCondition.OnExpiration
					}
				]
			});

			const result = distributor.calculateRewards(job);
			const shouldReview = distributor.shouldPromptGMReview(job, result);

			expect(shouldReview).toBe(true);
		});

		it('should prompt review for job with narrative consequence', () => {
			const job = createNewJob('Job with Consequence', 100, {
				status: JobStatus.Completed,
				narrativeConsequence: 'The village burns down.'
			});

			const result = distributor.calculateRewards(job);
			const shouldReview = distributor.shouldPromptGMReview(job, result);

			expect(shouldReview).toBe(true);
		});

		it('should not prompt review for simple completed job', () => {
			const job = createNewJob('Simple Job', 100, {
				status: JobStatus.Completed,
				rewardGold: 50,
				rewardXP: 100
			});

			const result = distributor.calculateRewards(job);
			const shouldReview = distributor.shouldPromptGMReview(job, result);

			expect(shouldReview).toBe(false);
		});

		it('should not prompt review for completed job with success reputation impacts', () => {
			const job = createNewJob('Completed Job', 100, {
				status: JobStatus.Completed,
				reputationImpacts: [
					{
						targetType: ReputationTargetType.Location,
						targetEntity: 'Waterdeep',
						value: 2,
						condition: ReputationCondition.OnSuccess
					}
				]
			});

			const result = distributor.calculateRewards(job);
			const shouldReview = distributor.shouldPromptGMReview(job, result);

			expect(shouldReview).toBe(false);
		});
	});
});
