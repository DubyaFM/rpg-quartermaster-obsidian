import { describe, it, expect, beforeEach } from 'vitest';
import { StrongholdService } from '../services/StrongholdService';
import { Stronghold, StrongholdBuff, SpecialDefender } from '../models/stronghold';

describe('StrongholdService', () => {
	let service: StrongholdService;
	let mockStronghold: Stronghold;

	beforeEach(() => {
		service = new StrongholdService();
		mockStronghold = {
			id: 'stronghold_1',
			name: 'Test Stronghold',
			ownership: { type: 'party' },
			location: 'Test Location',
			defenders: {
				basic: { current: 10, maximum: 20 },
				special: []
			},
			stashInventoryFile: 'test_stash.md',
			facilities: [],
			activeBuffs: [],
			neglectCounter: 0,
			lastTurnDay: 1,
			metadata: {
				createdDate: '2025-01-01',
				lastModified: '2025-01-01',
				calendarDay: 1
			}
		};
	});

	describe('createStronghold', () => {
		it('should create a new stronghold with required fields', () => {
			const result = service.createStronghold(
				'New Stronghold',
				{ type: 'party' }
			);

			expect(result.id).toBeDefined();
			expect(result.name).toBe('New Stronghold');
			expect(result.ownership.type).toBe('party');
			expect(result.stashInventoryFile).toContain('New_Stronghold');
			expect(result.facilities).toEqual([]);
			expect(result.activeBuffs).toEqual([]);
			expect(result.neglectCounter).toBe(0);
		});

		it('should create stronghold with optional location', () => {
			const result = service.createStronghold(
				'Mountain Keep',
				{ type: 'individual', ownerName: 'Thorin' },
				'The Misty Mountains'
			);

			expect(result.location).toBe('The Misty Mountains');
			expect(result.ownership.ownerName).toBe('Thorin');
		});

		it('should initialize defenders', () => {
			const result = service.createStronghold(
				'Castle',
				{ type: 'party' },
				undefined,
				{ basic: 5, special: [] }
			);

			expect(result.defenders.basic.current).toBe(5);
			expect(result.defenders.basic.maximum).toBe(5); // Maximum equals initial count
			expect(result.defenders.special).toEqual([]);
		});
	});

	describe('addFacility', () => {
		it('should add a facility to stronghold', () => {
			const facility = {
				id: 'facility_1',
				templateId: 'smithy_basic',
				name: 'Smithy',
				ownership: { type: 'party' as const },
				status: 'idle' as const,
				assignedHirelings: [],
				tier: 1
			};

			service.addFacility(mockStronghold, facility);

			expect(mockStronghold.facilities.length).toBe(1);
			expect(mockStronghold.facilities[0].id).toBe('facility_1');
		});

		it('should not add duplicate facility IDs', () => {
			const facility = {
				id: 'facility_1',
				templateId: 'smithy_basic',
				name: 'Smithy',
				ownership: { type: 'party' as const },
				status: 'idle' as const,
				assignedHirelings: [],
				tier: 1
			};

			service.addFacility(mockStronghold, facility);
			service.addFacility(mockStronghold, facility);

			expect(mockStronghold.facilities.length).toBe(1);
		});
	});

	describe('applyBuff', () => {
		it('should add a buff to stronghold', () => {
			const buff: StrongholdBuff = {
				id: 'buff_1',
				name: 'Morale Boost',
				description: '+2 morale to all hirelings',
				appliedOnDay: 10,
				durationInDays: 7,
				expiresOnDay: 17,
				effects: '+2 morale'
			};

			service.applyBuff(mockStronghold, buff);

			expect(mockStronghold.activeBuffs.length).toBe(1);
			expect(mockStronghold.activeBuffs[0].name).toBe('Morale Boost');
		});

		it('should allow multiple buffs', () => {
			const buff1: StrongholdBuff = {
				id: 'buff_1',
				name: 'Buff 1',
				description: 'First buff',
				appliedOnDay: 1,
				effects: 'effect 1'
			};

			const buff2: StrongholdBuff = {
				id: 'buff_2',
				name: 'Buff 2',
				description: 'Second buff',
				appliedOnDay: 1,
				effects: 'effect 2'
			};

			service.applyBuff(mockStronghold, buff1);
			service.applyBuff(mockStronghold, buff2);

			expect(mockStronghold.activeBuffs.length).toBe(2);
		});
	});

	describe('expireBuffs', () => {
		beforeEach(() => {
			mockStronghold.activeBuffs = [
				{
					id: 'buff_1',
					name: 'Expired Buff',
					description: 'Should be removed',
					appliedOnDay: 1,
					durationInDays: 7,
					expiresOnDay: 8,
					effects: 'expired'
				},
				{
					id: 'buff_2',
					name: 'Active Buff',
					description: 'Should remain',
					appliedOnDay: 1,
					durationInDays: 14,
					expiresOnDay: 15,
					effects: 'active'
				},
				{
					id: 'buff_3',
					name: 'Permanent Buff',
					description: 'Never expires',
					appliedOnDay: 1,
					effects: 'permanent'
				}
			];
		});

		it('should remove expired buffs', () => {
			service.expireBuffs(mockStronghold, 10);

			expect(mockStronghold.activeBuffs.length).toBe(2);
			expect(mockStronghold.activeBuffs.find(b => b.id === 'buff_1')).toBeUndefined();
		});

		it('should keep active buffs', () => {
			service.expireBuffs(mockStronghold, 10);

			expect(mockStronghold.activeBuffs.find(b => b.id === 'buff_2')).toBeDefined();
		});

		it('should keep permanent buffs', () => {
			service.expireBuffs(mockStronghold, 100);

			expect(mockStronghold.activeBuffs.find(b => b.id === 'buff_3')).toBeDefined();
		});
	});

	describe('addDefenders', () => {
		it('should add basic defenders and increase maximum', () => {
			service.addDefenders(mockStronghold, 5);

			expect(mockStronghold.defenders.basic.current).toBe(15);
			expect(mockStronghold.defenders.basic.maximum).toBe(25); // Maximum also increased
		});

		it('should add defenders to both current and maximum', () => {
			service.addDefenders(mockStronghold, 15);

			expect(mockStronghold.defenders.basic.current).toBe(25);
			expect(mockStronghold.defenders.basic.maximum).toBe(35);
		});
	});

	describe('removeDefenders', () => {
		it('should remove basic defenders and decrease maximum', () => {
			service.removeDefenders(mockStronghold, 5);

			expect(mockStronghold.defenders.basic.current).toBe(5);
			expect(mockStronghold.defenders.basic.maximum).toBe(15); // Maximum also decreased
		});

		it('should not go below zero', () => {
			service.removeDefenders(mockStronghold, 20);

			expect(mockStronghold.defenders.basic.current).toBe(0);
			expect(mockStronghold.defenders.basic.maximum).toBe(0); // Maximum also clamped at 0
		});
	});

	describe('addSpecialDefender', () => {
		it('should add special defender', () => {
			const defender: SpecialDefender = {
				id: 'defender_1',
				name: 'Captain Elara',
				role: 'Guard Captain',
				status: 'active'
			};

			service.addSpecialDefender(mockStronghold, defender);

			expect(mockStronghold.defenders.special.length).toBe(1);
			expect(mockStronghold.defenders.special[0].name).toBe('Captain Elara');
		});
	});

	describe('removeSpecialDefender', () => {
		beforeEach(() => {
			mockStronghold.defenders.special = [
				{
					id: 'defender_1',
					name: 'Captain Elara',
					role: 'Guard Captain',
					status: 'active'
				}
			];
		});

		it('should remove special defender by ID', () => {
			service.removeSpecialDefender(mockStronghold, 'defender_1');

			expect(mockStronghold.defenders.special.length).toBe(0);
		});

		it('should not error on non-existent ID', () => {
			service.removeSpecialDefender(mockStronghold, 'non_existent');

			expect(mockStronghold.defenders.special.length).toBe(1);
		});
	});

	describe('updateNeglect', () => {
		it('should increment neglect counter based on turns and PC level', () => {
			// PC level 1 has grace period of 1, so 2 turns = 1 penalty
			service.updateNeglect(mockStronghold, 1, 2);

			expect(mockStronghold.neglectCounter).toBe(1);
		});

		it('should handle multiple turns with higher PC level', () => {
			// PC level 5 has grace period of 2, so 5 turns = 3 penalty
			service.updateNeglect(mockStronghold, 5, 5);

			expect(mockStronghold.neglectCounter).toBe(3);
		});

		it('should not increment if within grace period', () => {
			// PC level 1 has grace period of 1, 1 turn = 0 penalty
			service.updateNeglect(mockStronghold, 1, 1);

			expect(mockStronghold.neglectCounter).toBe(0);
		});
	});

	describe('resetNeglect', () => {
		beforeEach(() => {
			mockStronghold.neglectCounter = 10;
		});

		it('should reset neglect counter', () => {
			service.resetNeglect(mockStronghold);

			expect(mockStronghold.neglectCounter).toBe(0);
		});
	});

	describe('validateStronghold', () => {
		it('should validate a valid stronghold', () => {
			const result = service.validateStronghold(mockStronghold);

			expect(result.valid).toBe(true);
			expect(result.errors).toEqual([]);
		});

		it('should detect missing name', () => {
			mockStronghold.name = '';
			const result = service.validateStronghold(mockStronghold);

			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.includes('name'))).toBe(true);
		});

		it('should detect negative defenders', () => {
			mockStronghold.defenders.basic.current = -1;
			const result = service.validateStronghold(mockStronghold);

			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.includes('defender'))).toBe(true);
		});

		it('should detect current > maximum defenders', () => {
			mockStronghold.defenders.basic.current = 30;
			mockStronghold.defenders.basic.maximum = 20;
			const result = service.validateStronghold(mockStronghold);

			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.includes('maximum'))).toBe(true);
		});
	});
});
