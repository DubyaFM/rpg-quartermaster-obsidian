import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpkeepManager } from '../services/UpkeepManager';
import { getDefaultCurrencyConfig } from '../data/defaultCurrencyConfig.js';
import type { CurrencyConfig } from '../models/currency-config.js';
import { UpkeepConfig, UpkeepCostConfig, PartyMember, ItemCost, TransactionContext } from '../models/types';

// Mock callback functions
let mockUpdatePartyInventory: ReturnType<typeof vi.fn>;
let mockLogTransaction: ReturnType<typeof vi.fn>;

// Test data
const TEST_LIFESTYLE_COSTS: UpkeepCostConfig = {
	lifestyleLevels: {
		wretched: {
			name: 'Wretched',
			costPerDay: { cp: 0, sp: 0, gp: 0, pp: 0 },
			description: 'No cost'
		},
		squalid: {
			name: 'Squalid',
			costPerDay: { cp: 0, sp: 1, gp: 0, pp: 0 },
			description: '1 sp per day'
		},
		poor: {
			name: 'Poor',
			costPerDay: { cp: 0, sp: 2, gp: 0, pp: 0 },
			description: '2 sp per day'
		},
		modest: {
			name: 'Modest',
			costPerDay: { cp: 0, sp: 0, gp: 1, pp: 0 },
			description: '1 gp per day'
		},
		comfortable: {
			name: 'Comfortable',
			costPerDay: { cp: 0, sp: 0, gp: 2, pp: 0 },
			description: '2 gp per day'
		},
		wealthy: {
			name: 'Wealthy',
			costPerDay: { cp: 0, sp: 0, gp: 4, pp: 0 },
			description: '4 gp per day'
		},
		aristocratic: {
			name: 'Aristocratic',
			costPerDay: { cp: 0, sp: 0, gp: 10, pp: 0 },
			description: '10 gp per day'
		}
	},
	rations: {
		costPerDay: { cp: 0, sp: 5, gp: 0, pp: 0 },
		description: 'Rations: 5 sp per day'
	}
};

const TEST_PARTY_MEMBERS: PartyMember[] = [
	{ name: 'Aragorn', characterSheetPath: '' },
	{ name: 'Legolas', characterSheetPath: '' },
	{ name: 'Gimli', characterSheetPath: '' }
];

describe('UpkeepManager', () => {
	let upkeepManager: UpkeepManager;

	beforeEach(() => {
		mockUpdatePartyInventory = vi.fn();
		mockLogTransaction = vi.fn();

		const currencyConfig = getDefaultCurrencyConfig();
		upkeepManager = new UpkeepManager(
			mockUpdatePartyInventory,
			mockLogTransaction,
			currencyConfig
		);
	});

	describe('calculateUpkeepCost', () => {
		it('should calculate rations cost for party-wide settings', () => {
			const config: UpkeepConfig = {
				partyWideSettings: {
					useRations: true,
					useLifestyleExpenses: false,
					lifestyleLevel: 'modest'
				}
			};

			const cost = upkeepManager.calculateUpkeepCost(
				1,
				config,
				TEST_PARTY_MEMBERS,
				TEST_LIFESTYLE_COSTS
			);

			// 3 members * 5 sp = 15 sp = 1 gp 5 sp
			expect(cost).toEqual({ cp: 0, sp: 15, gp: 0, pp: 0 });
		});

		it('should calculate lifestyle cost for party-wide settings', () => {
			const config: UpkeepConfig = {
				partyWideSettings: {
					useRations: false,
					useLifestyleExpenses: true,
					lifestyleLevel: 'comfortable'
				}
			};

			const cost = upkeepManager.calculateUpkeepCost(
				1,
				config,
				TEST_PARTY_MEMBERS,
				TEST_LIFESTYLE_COSTS
			);

			// 3 members * 2 gp = 6 gp
			expect(cost).toEqual({ cp: 0, sp: 0, gp: 6, pp: 0 });
		});

		it('should calculate both rations and lifestyle costs', () => {
			const config: UpkeepConfig = {
				partyWideSettings: {
					useRations: true,
					useLifestyleExpenses: true,
					lifestyleLevel: 'modest'
				}
			};

			const cost = upkeepManager.calculateUpkeepCost(
				1,
				config,
				TEST_PARTY_MEMBERS,
				TEST_LIFESTYLE_COSTS
			);

			// 3 members * (5 sp + 1 gp) = 15 sp + 3 gp = 4 gp 5 sp
			expect(cost).toEqual({ cp: 0, sp: 15, gp: 3, pp: 0 });
		});

		it('should multiply costs by number of days', () => {
			const config: UpkeepConfig = {
				partyWideSettings: {
					useRations: true,
					useLifestyleExpenses: false,
					lifestyleLevel: 'modest'
				}
			};

			const cost = upkeepManager.calculateUpkeepCost(
				7,
				config,
				TEST_PARTY_MEMBERS,
				TEST_LIFESTYLE_COSTS
			);

			// 3 members * 5 sp * 7 days
			// Per member: 35 sp = convertFromCopper(350) = 3 gp 5 sp
			// Total via addCurrency: 3*3 gp + 3*5 sp = 9 gp 15 sp
			expect(cost).toEqual({ cp: 0, sp: 15, gp: 9, pp: 0 });
		});

		it('should handle individual member settings', () => {
			const config: UpkeepConfig = {
				partyWideSettings: {
					useRations: true,
					useLifestyleExpenses: true,
					lifestyleLevel: 'modest'
				},
				individualSettings: {
					'Aragorn': {
						useRations: true,
						useLifestyleExpenses: true,
						lifestyleLevel: 'wealthy'  // Aragorn lives better
					},
					'Gimli': {
						useRations: false,  // Gimli doesn't need rations
						useLifestyleExpenses: true,
						lifestyleLevel: 'comfortable'
					}
				}
			};

			const cost = upkeepManager.calculateUpkeepCost(
				1,
				config,
				TEST_PARTY_MEMBERS,
				TEST_LIFESTYLE_COSTS
			);

			// Aragorn: 5 sp + 4 gp = 4 gp 5 sp
			// Legolas: 5 sp + 1 gp = 1 gp 5 sp (party-wide defaults)
			// Gimli: 0 sp + 2 gp = 2 gp
			// Total: 7 gp 10 sp
			expect(cost).toEqual({ cp: 0, sp: 10, gp: 7, pp: 0 });
		});

		it('should handle zero cost when all options disabled', () => {
			const config: UpkeepConfig = {
				partyWideSettings: {
					useRations: false,
					useLifestyleExpenses: false,
					lifestyleLevel: 'modest'
				}
			};

			const cost = upkeepManager.calculateUpkeepCost(
				1,
				config,
				TEST_PARTY_MEMBERS,
				TEST_LIFESTYLE_COSTS
			);

			expect(cost).toEqual({ cp: 0, sp: 0, gp: 0, pp: 0 });
		});

		it('should handle wretched lifestyle (free)', () => {
			const config: UpkeepConfig = {
				partyWideSettings: {
					useRations: false,
					useLifestyleExpenses: true,
					lifestyleLevel: 'wretched'
				}
			};

			const cost = upkeepManager.calculateUpkeepCost(
				1,
				config,
				TEST_PARTY_MEMBERS,
				TEST_LIFESTYLE_COSTS
			);

			expect(cost).toEqual({ cp: 0, sp: 0, gp: 0, pp: 0 });
		});

		it('should handle aristocratic lifestyle', () => {
			const config: UpkeepConfig = {
				partyWideSettings: {
					useRations: false,
					useLifestyleExpenses: true,
					lifestyleLevel: 'aristocratic'
				}
			};

			const cost = upkeepManager.calculateUpkeepCost(
				1,
				config,
				TEST_PARTY_MEMBERS,
				TEST_LIFESTYLE_COSTS
			);

			// 3 members * 10 gp
			// Per member: 10 gp = convertFromCopper(1000) = 1 pp
			// Total via addCurrency: 3*1 pp = 3 pp
			expect(cost).toEqual({ cp: 0, sp: 0, gp: 0, pp: 3 });
		});
	});

	describe('applyUpkeep', () => {
		it('should deduct cost from party inventory', async () => {
			const cost: ItemCost = { cp: 0, sp: 0, gp: 5, pp: 0 };

			await upkeepManager.applyUpkeep(cost, 1);

			// Should deduct 5 gp = 500 cp
			expect(mockUpdatePartyInventory).toHaveBeenCalledWith([], -500);
		});

		it('should log transaction for single day', async () => {
			const cost: ItemCost = { cp: 0, sp: 0, gp: 5, pp: 0 };

			await upkeepManager.applyUpkeep(cost, 1);

			expect(mockLogTransaction).toHaveBeenCalledWith(
				[],
				cost,
				'Daily Upkeep',
				undefined
			);
		});

		it('should log transaction for multiple days', async () => {
			const cost: ItemCost = { cp: 0, sp: 0, gp: 35, pp: 0 };

			await upkeepManager.applyUpkeep(cost, 7);

			expect(mockLogTransaction).toHaveBeenCalledWith(
				[],
				cost,
				'Upkeep (7 days)',
				undefined
			);
		});

		it('should pass context to transaction log', async () => {
			const cost: ItemCost = { cp: 0, sp: 0, gp: 5, pp: 0 };
			const context: TransactionContext = {
				calendarDay: 150,
				formattedDate: 'Day 150'
			};

			await upkeepManager.applyUpkeep(cost, 1, context);

			expect(mockLogTransaction).toHaveBeenCalledWith(
				[],
				cost,
				'Daily Upkeep',
				context
			);
		});

		it('should handle complex currency amounts', async () => {
			const cost: ItemCost = { cp: 5, sp: 3, gp: 2, pp: 1 };

			await upkeepManager.applyUpkeep(cost, 1);

			// 1 pp = 1000 cp, 2 gp = 200 cp, 3 sp = 30 cp, 5 cp = 5 cp
			// Total = 1235 cp
			expect(mockUpdatePartyInventory).toHaveBeenCalledWith([], -1235);
		});
	});

	describe('getUpkeepBreakdown', () => {
		it('should return breakdown for each party member', () => {
			const config: UpkeepConfig = {
				partyWideSettings: {
					useRations: true,
					useLifestyleExpenses: true,
					lifestyleLevel: 'modest'
				}
			};

			const breakdown = upkeepManager.getUpkeepBreakdown(
				1,
				config,
				TEST_PARTY_MEMBERS,
				TEST_LIFESTYLE_COSTS
			);

			expect(breakdown.size).toBe(3);
			expect(breakdown.has('Aragorn')).toBe(true);
			expect(breakdown.has('Legolas')).toBe(true);
			expect(breakdown.has('Gimli')).toBe(true);
		});

		it('should show rations and lifestyle costs separately', () => {
			const config: UpkeepConfig = {
				partyWideSettings: {
					useRations: true,
					useLifestyleExpenses: true,
					lifestyleLevel: 'comfortable'
				}
			};

			const breakdown = upkeepManager.getUpkeepBreakdown(
				1,
				config,
				TEST_PARTY_MEMBERS,
				TEST_LIFESTYLE_COSTS
			);

			const aragornBreakdown = breakdown.get('Aragorn');
			expect(aragornBreakdown).toBeDefined();
			expect(aragornBreakdown?.rations).toEqual({ cp: 0, sp: 5, gp: 0, pp: 0 });
			expect(aragornBreakdown?.lifestyle).toEqual({ cp: 0, sp: 0, gp: 2, pp: 0 });
			expect(aragornBreakdown?.total).toEqual({ cp: 0, sp: 5, gp: 2, pp: 0 });
		});

		it('should show null for disabled cost types', () => {
			const config: UpkeepConfig = {
				partyWideSettings: {
					useRations: false,
					useLifestyleExpenses: true,
					lifestyleLevel: 'modest'
				}
			};

			const breakdown = upkeepManager.getUpkeepBreakdown(
				1,
				config,
				TEST_PARTY_MEMBERS,
				TEST_LIFESTYLE_COSTS
			);

			const aragornBreakdown = breakdown.get('Aragorn');
			expect(aragornBreakdown?.rations).toBeNull();
			expect(aragornBreakdown?.lifestyle).toEqual({ cp: 0, sp: 0, gp: 1, pp: 0 });
			expect(aragornBreakdown?.total).toEqual({ cp: 0, sp: 0, gp: 1, pp: 0 });
		});

		it('should handle individual member settings in breakdown', () => {
			const config: UpkeepConfig = {
				partyWideSettings: {
					useRations: true,
					useLifestyleExpenses: true,
					lifestyleLevel: 'modest'
				},
				individualSettings: {
					'Aragorn': {
						useRations: true,
						useLifestyleExpenses: true,
						lifestyleLevel: 'wealthy'
					}
				}
			};

			const breakdown = upkeepManager.getUpkeepBreakdown(
				1,
				config,
				TEST_PARTY_MEMBERS,
				TEST_LIFESTYLE_COSTS
			);

			// Aragorn has custom settings
			const aragornBreakdown = breakdown.get('Aragorn');
			expect(aragornBreakdown?.lifestyle).toEqual({ cp: 0, sp: 0, gp: 4, pp: 0 });

			// Legolas uses party-wide defaults
			const legolasBreakdown = breakdown.get('Legolas');
			expect(legolasBreakdown?.lifestyle).toEqual({ cp: 0, sp: 0, gp: 1, pp: 0 });
		});

		it('should multiply costs by days in breakdown', () => {
			const config: UpkeepConfig = {
				partyWideSettings: {
					useRations: true,
					useLifestyleExpenses: false,
					lifestyleLevel: 'modest'
				}
			};

			const breakdown = upkeepManager.getUpkeepBreakdown(
				7,
				config,
				TEST_PARTY_MEMBERS,
				TEST_LIFESTYLE_COSTS
			);

			const aragornBreakdown = breakdown.get('Aragorn');
			// 5 sp * 7 days = 35 sp = convertFromCopper(350) = 3 gp 5 sp
			expect(aragornBreakdown?.rations).toEqual({ cp: 0, sp: 5, gp: 3, pp: 0 });
		});

		it('should show zero total when all disabled', () => {
			const config: UpkeepConfig = {
				partyWideSettings: {
					useRations: false,
					useLifestyleExpenses: false,
					lifestyleLevel: 'modest'
				}
			};

			const breakdown = upkeepManager.getUpkeepBreakdown(
				1,
				config,
				TEST_PARTY_MEMBERS,
				TEST_LIFESTYLE_COSTS
			);

			const aragornBreakdown = breakdown.get('Aragorn');
			expect(aragornBreakdown?.rations).toBeNull();
			expect(aragornBreakdown?.lifestyle).toBeNull();
			expect(aragornBreakdown?.total).toEqual({ cp: 0, sp: 0, gp: 0, pp: 0 });
		});
	});

	describe('not an event listener', () => {
		it('should not have enable() method', () => {
			expect((upkeepManager as any).enable).toBeUndefined();
		});

		it('should not have disable() method', () => {
			expect((upkeepManager as any).disable).toBeUndefined();
		});

		it('should not have handleTimeAdvanced() method', () => {
			expect((upkeepManager as any).handleTimeAdvanced).toBeUndefined();
		});

		it('should be a passive service called by UI', () => {
			// This test verifies architectural pattern
			// UpkeepManager should only respond to direct method calls
			expect(upkeepManager.calculateUpkeepCost).toBeDefined();
			expect(upkeepManager.applyUpkeep).toBeDefined();
			expect(upkeepManager.getUpkeepBreakdown).toBeDefined();
		});
	});
});
