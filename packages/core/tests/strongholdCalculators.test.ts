import { describe, it, expect } from 'vitest';
import {
	calculateFacilityBuildCost,
	calculateFacilityUpgradeCost,
	calculateOrderCost,
	calculateDefenderCapacity,
	calculateCompletionDay,
	calculateDaysRemaining,
	isTaskComplete
} from '../calculators/strongholdCalculators';
import { FacilityTemplate, CustomOrder } from '../models/stronghold';
import { ItemCost } from '../models/types';
import { getDefaultCurrencyConfig } from '../data/defaultCurrencyConfig';

describe('Stronghold Calculators', () => {
	const config = getDefaultCurrencyConfig();

	describe('calculateFacilityBuildCost', () => {
		it('should return base cost without wealth modifier', () => {
			const buildCost: ItemCost & { timeInDays: number } = {
				cp: 0,
				sp: 0,
				gp: 500,
				pp: 0,
				timeInDays: 7
			};

			const template: FacilityTemplate = {
				id: 'smithy_basic',
				name: 'Basic Smithy',
				tier: 1,
				type: 'basic',
				description: 'A simple smithy',
				prerequisites: '',
				size: { category: 'roomy', areaSquares: 4 },
				hirelingsRequired: 1,
				buildCost,
				associatedOrderIds: [],
				passiveBenefits: '',
				metadata: { createdDate: '', lastModified: '' }
			};

			const result = calculateFacilityBuildCost(template, config);
			// 500 gp = 50,000 cp = 50 pp (consolidated)
			expect(result).toEqual({ cp: 0, sp: 0, gp: 0, pp: 50 });
		});

		it('should apply wealth modifier correctly', () => {
			const buildCost: ItemCost & { timeInDays: number } = {
				cp: 0,
				sp: 0,
				gp: 400,
				pp: 0,
				timeInDays: 7
			};

			const template: FacilityTemplate = {
				id: 'smithy_basic',
				name: 'Basic Smithy',
				tier: 1,
				type: 'basic',
				description: 'A simple smithy',
				prerequisites: '',
				size: { category: 'roomy', areaSquares: 4 },
				hirelingsRequired: 1,
				buildCost,
				associatedOrderIds: [],
				passiveBenefits: '',
				metadata: { createdDate: '', lastModified: '' }
			};

			const result1 = calculateFacilityBuildCost(template, config, 1.5);
			// 400 gp * 1.5 = 600 gp (in base units: 60,000 cp = 60 pp consolidated)
			expect(result1).toEqual({ cp: 0, sp: 0, gp: 0, pp: 60 });

			const result2 = calculateFacilityBuildCost(template, config, 0.5);
			// 400 gp * 0.5 = 200 gp (in base units: 20,000 cp = 20 pp consolidated)
			expect(result2).toEqual({ cp: 0, sp: 0, gp: 0, pp: 20 });
		});

		it('should handle zero cost', () => {
			const buildCost: ItemCost & { timeInDays: number } = {
				cp: 0,
				sp: 0,
				gp: 0,
				pp: 0,
				timeInDays: 1
			};

			const template: FacilityTemplate = {
				id: 'test',
				name: 'Test',
				tier: 1,
				type: 'basic',
				description: '',
				prerequisites: '',
				size: { category: 'roomy', areaSquares: 4 },
				hirelingsRequired: 0,
				buildCost,
				associatedOrderIds: [],
				passiveBenefits: '',
				metadata: { createdDate: '', lastModified: '' }
			};

			const result = calculateFacilityBuildCost(template, config);
			expect(result).toEqual({ cp: 0, sp: 0, gp: 0, pp: 0 });
		});
	});

	describe('calculateFacilityUpgradeCost', () => {
		it('should return upgrade cost when defined', () => {
			const buildCost: ItemCost & { timeInDays: number } = {
				cp: 0,
				sp: 0,
				gp: 1000,
				pp: 0,
				timeInDays: 14
			};

			const upgradeCost: ItemCost & { timeInDays: number } = {
				cp: 0,
				sp: 0,
				gp: 200,
				pp: 0,
				timeInDays: 5
			};

			const template: FacilityTemplate = {
				id: 'smithy_advanced',
				name: 'Advanced Smithy',
				tier: 2,
				baseFacilityId: 'smithy_basic',
				type: 'basic',
				description: '',
				prerequisites: '',
				size: { category: 'roomy', areaSquares: 4 },
				hirelingsRequired: 2,
				buildCost,
				upgradeCost,
				associatedOrderIds: [],
				passiveBenefits: '',
				metadata: { createdDate: '', lastModified: '' }
			};

			const result = calculateFacilityUpgradeCost(template, config);
			// 200 gp = 20,000 cp = 20 pp (consolidated)
			expect(result).toEqual({ cp: 0, sp: 0, gp: 0, pp: 20 });
		});

		it('should handle multi-denomination costs correctly', () => {
			const buildCost: ItemCost & { timeInDays: number } = {
				cp: 0,
				sp: 5,
				gp: 50,
				pp: 1,
				timeInDays: 14
			};

			const upgradeCost: ItemCost & { timeInDays: number } = {
				cp: 50,
				sp: 5,
				gp: 25,
				pp: 0,
				timeInDays: 5
			};

			const template: FacilityTemplate = {
				id: 'smithy_advanced',
				name: 'Advanced Smithy',
				tier: 2,
				baseFacilityId: 'smithy_basic',
				type: 'basic',
				description: '',
				prerequisites: '',
				size: { category: 'roomy', areaSquares: 4 },
				hirelingsRequired: 2,
				buildCost,
				upgradeCost,
				associatedOrderIds: [],
				passiveBenefits: '',
				metadata: { createdDate: '', lastModified: '' }
			};

			// upgradeCost = 0 pp + 25 gp + 5 sp + 50 cp = 2550 cp = 2pp + 6gp (consolidated)
			// Should convert back to normalized form with consolidation
			const result = calculateFacilityUpgradeCost(template, config);
			// 2550 cp = 2 pp, 6 gp (since 2000 cp = 2 pp, remaining 550 cp = 5 gp + 50 cp, but consolidated)
			// Actually: 2550 / 1000 = 2 pp (2000 cp), remainder 550 cp
			// 550 / 100 = 5 gp (500 cp), remainder 50 cp
			// But let's verify: 2*1000 + 5*100 + 5*10 + 50 = 2000 + 500 + 50 + 50 = 2600 (that's wrong)
			// Let me recalculate: 25 gp (2500 cp) + 5 sp (50 cp) + 50 cp = 2600 cp
			// 2600 cp = 2 pp (2000 cp) + 600 cp remainder = 2 pp + 6 gp
			expect(result).toEqual({ cp: 0, sp: 0, gp: 6, pp: 2 });
		});

		it('should apply wealth modifier to upgrade cost', () => {
			const buildCost: ItemCost & { timeInDays: number } = {
				cp: 0,
				sp: 0,
				gp: 1000,
				pp: 0,
				timeInDays: 14
			};

			const upgradeCost: ItemCost & { timeInDays: number } = {
				cp: 0,
				sp: 0,
				gp: 100,
				pp: 0,
				timeInDays: 5
			};

			const template: FacilityTemplate = {
				id: 'smithy_advanced',
				name: 'Advanced Smithy',
				tier: 2,
				baseFacilityId: 'smithy_basic',
				type: 'basic',
				description: '',
				prerequisites: '',
				size: { category: 'roomy', areaSquares: 4 },
				hirelingsRequired: 2,
				buildCost,
				upgradeCost,
				associatedOrderIds: [],
				passiveBenefits: '',
				metadata: { createdDate: '', lastModified: '' }
			};

			const result = calculateFacilityUpgradeCost(template, config, 2.0);
			// 100 gp * 2.0 = 200 gp (in base units: 20,000 cp, consolidated to 20 pp)
			expect(result).toEqual({ cp: 0, sp: 0, gp: 0, pp: 20 });
		});

		it('should return 0 when upgrade cost not defined', () => {
			const buildCost: ItemCost & { timeInDays: number } = {
				cp: 0,
				sp: 0,
				gp: 500,
				pp: 0,
				timeInDays: 7
			};

			const template: FacilityTemplate = {
				id: 'smithy_basic',
				name: 'Basic Smithy',
				tier: 1,
				type: 'basic',
				description: '',
				prerequisites: '',
				size: { category: 'roomy', areaSquares: 4 },
				hirelingsRequired: 1,
				buildCost,
				associatedOrderIds: [],
				passiveBenefits: '',
				metadata: { createdDate: '', lastModified: '' }
			};

			const result = calculateFacilityUpgradeCost(template, config);
			expect(result).toEqual({ cp: 0, sp: 0, gp: 0, pp: 0 });
		});
	});

	describe('calculateOrderCost', () => {
		it('should return 0 for "none" cost type', () => {
			const order: CustomOrder = {
				id: 'train_guards',
				name: 'Train Guards',
				description: '',
				orderType: 'facility',
				timeRequired: 7,
				fundsCost: { type: 'none' },
				results: [],
				metadata: { createdDate: '', lastModified: '' }
			};

			expect(calculateOrderCost(order, config)).toBe(0);
		});

		it('should return constant amount for "constant" cost type', () => {
			const order: CustomOrder = {
				id: 'craft_weapon',
				name: 'Craft Weapon',
				description: '',
				orderType: 'facility',
				timeRequired: 3,
				fundsCost: { type: 'constant', amount: 50 },
				results: [],
				metadata: { createdDate: '', lastModified: '' }
			};

			expect(calculateOrderCost(order, config)).toBe(50);
		});

		it('should return variable amount for "variable" cost type', () => {
			const order: CustomOrder = {
				id: 'custom_craft',
				name: 'Custom Craft',
				description: '',
				orderType: 'facility',
				timeRequired: 5,
				fundsCost: { type: 'variable', prompt: 'Enter material cost' },
				results: [],
				metadata: { createdDate: '', lastModified: '' }
			};

			expect(calculateOrderCost(order, config, 75)).toBe(75);
		});

		it('should return 0 for variable cost without amount', () => {
			const order: CustomOrder = {
				id: 'custom_craft',
				name: 'Custom Craft',
				description: '',
				orderType: 'facility',
				timeRequired: 5,
				fundsCost: { type: 'variable', prompt: 'Enter material cost' },
				results: [],
				metadata: { createdDate: '', lastModified: '' }
			};

			expect(calculateOrderCost(order, config)).toBe(0);
		});
	});

	describe('calculateDefenderCapacity', () => {
		it('should return base capacity with no facilities', () => {
			expect(calculateDefenderCapacity([], config)).toBe(10);
		});

		it('should scale with facility count', () => {
			// Create 5 mock facilities
			const facilities: any[] = new Array(5).fill({ id: 'test', status: 'idle' });
			expect(calculateDefenderCapacity(facilities, config)).toBe(20); // 10 base + 5*2
		});

		it('should handle large facility counts', () => {
			// Create 20 mock facilities
			const facilities: any[] = new Array(20).fill({ id: 'test', status: 'idle' });
			expect(calculateDefenderCapacity(facilities, config)).toBe(50); // 10 base + 20*2
		});
	});

	describe('calculateCompletionDay', () => {
		it('should calculate simple completion day', () => {
			expect(calculateCompletionDay(1, 7, config)).toBe(8);
		});

		it('should handle day 0 start', () => {
			expect(calculateCompletionDay(0, 7, config)).toBe(7);
		});

		it('should handle single day duration', () => {
			expect(calculateCompletionDay(10, 1, config)).toBe(11);
		});
	});

	describe('calculateDaysRemaining', () => {
		it('should calculate days remaining', () => {
			expect(calculateDaysRemaining(5, 15, config)).toBe(10); // Current day 5, completes day 15 = 10 days left
		});

		it('should return 0 when complete', () => {
			expect(calculateDaysRemaining(15, 15, config)).toBe(0);
		});

		it('should return 0 when past completion', () => {
			expect(calculateDaysRemaining(20, 15, config)).toBe(0);
		});
	});

	describe('isTaskComplete', () => {
		it('should return true when current day >= completion day', () => {
			expect(isTaskComplete(10, 10, config)).toBe(true);
			expect(isTaskComplete(11, 10, config)).toBe(true);
		});

		it('should return false when current day < completion day', () => {
			expect(isTaskComplete(9, 10, config)).toBe(false);
			expect(isTaskComplete(1, 10, config)).toBe(false);
		});
	});
});
