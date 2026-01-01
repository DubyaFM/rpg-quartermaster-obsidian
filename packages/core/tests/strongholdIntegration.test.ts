import { describe, it, expect, beforeEach } from 'vitest';
import { StrongholdService } from '../services/StrongholdService';
import { FacilityService } from '../services/FacilityService';
import { OrderService } from '../services/OrderService';
import { StrongholdHirelingService } from '../services/StrongholdHirelingService';
import { EventTableService } from '../services/EventTableService';
import { Stronghold, FacilityTemplate, CustomOrder, Hireling, CustomEventTable } from '../models/stronghold';
import { isTaskComplete } from '../calculators/strongholdCalculators';

describe('Stronghold Integration Tests', () => {
	let strongholdService: StrongholdService;
	let facilityService: FacilityService;
	let orderService: OrderService;
	let hirelingService: StrongholdHirelingService;
	let eventTableService: EventTableService;

	let stronghold: Stronghold;
	let smithyTemplate: FacilityTemplate;
	let craftWeaponOrder: CustomOrder;
	let hireling: Hireling;

	beforeEach(() => {
		strongholdService = new StrongholdService();
		facilityService = new FacilityService();
		orderService = new OrderService();
		hirelingService = new StrongholdHirelingService();
		eventTableService = new EventTableService();

		// Create a stronghold
		stronghold = strongholdService.createStronghold(
			'Mountain Keep',
			{ type: 'party' },
			'The Misty Mountains',
			{ basic: 10, special: [] }
		);

		// Create a smithy facility template
		smithyTemplate = {
			id: 'smithy_basic',
			name: 'Basic Smithy',
			tier: 1,
			type: 'basic',
			description: 'A simple smithy for crafting weapons and armor',
			prerequisites: 'Access to iron ore',
			size: { category: 'roomy', areaSquares: 4 },
			hirelingsRequired: 1,
			buildCost: { gp: 500, timeInDays: 7 },
			associatedOrderIds: ['craft_weapon'],
			passiveBenefits: '+5% to all crafted weapon quality',
			metadata: {
				createdDate: '2025-01-01',
				lastModified: '2025-01-01'
			}
		};

		// Create a craft weapon order
		craftWeaponOrder = {
			id: 'craft_weapon',
			name: 'Craft Weapon',
			description: 'Craft a weapon using the smithy',
			orderType: 'facility',
			associatedFacilityIds: ['smithy_basic'],
			timeRequired: 3,
			fundsCost: { type: 'constant', amount: 50 },
			results: [
				{
					id: 'result_1',
					type: 'item',
					config: { itemPrompt: 'Enter weapon name' }
				}
			],
			metadata: {
				createdDate: '2025-01-01',
				lastModified: '2025-01-01'
			}
		};

		// Create a hireling
		hireling = {
			id: 'hireling_1',
			identity: {
				name: 'Gorim Ironforge',
				role: 'Blacksmith',
				status: 'at_stronghold'
			},
			mechanics: {
				statBlock: 'Commoner',
				personalityNotes: 'Gruff but skilled'
			},
			morale: {
				value: 15,
				scale: { min: 0, max: 20 }
			},
			payment: {
				type: 'stronghold_staff',
				schedule: 'weekly',
				amount: { gp: 5, sp: 0, cp: 0 }
			},
			assignedStrongholdId: stronghold.id,
			metadata: {
				createdDate: '2025-01-01',
				lastModified: '2025-01-01'
			}
		};
	});

	describe('Complete Stronghold Workflow', () => {
		it('should create and manage a complete stronghold', () => {
			// Verify stronghold creation
			expect(stronghold.name).toBe('Mountain Keep');
			expect(stronghold.defenders.basic.current).toBe(10);

			// Add a facility
			const facilityInstance = facilityService.createFacilityInstance(
				smithyTemplate,
				{ type: 'party' }
			);
			strongholdService.addFacility(stronghold, facilityInstance);

			expect(stronghold.facilities.length).toBe(1);
			expect(stronghold.facilities[0].templateId).toBe('smithy_basic');

			// Assign hireling to facility
			hirelingService.assignToFacility(hireling, stronghold.id, facilityInstance.id);
			facilityInstance.assignedHirelings.push(hireling.id);

			expect(facilityInstance.assignedHirelings.length).toBe(1);
			expect(hireling.assignedFacilityId).toBe(facilityInstance.id);

			// Validate order execution
			const validation = orderService.validateExecution(
				craftWeaponOrder,
				facilityInstance,
				stronghold,
				50
			);

			expect(validation.valid).toBe(true);
		});

		it('should handle facility operational status', () => {
			// Load template into facility service
			facilityService.loadTemplates([smithyTemplate]);

			const facilityInstance = facilityService.createFacilityInstance(
				smithyTemplate,
				{ type: 'party' }
			);

			// Facility should not be operational without hirelings
			expect(facilityService.isOperational(facilityInstance)).toBe(false);

			// Assign required hirelings
			facilityInstance.assignedHirelings.push(hireling.id);

			// Facility should now be operational
			expect(facilityService.isOperational(facilityInstance)).toBe(true);
		});

		it('should handle order execution lifecycle', async () => {
			const facilityInstance = facilityService.createFacilityInstance(
				smithyTemplate,
				{ type: 'party' }
			);
			facilityInstance.assignedHirelings.push(hireling.id);
			strongholdService.addFacility(stronghold, facilityInstance);

			// Execute order
			const result = await orderService.executeOrder(
				craftWeaponOrder,
				facilityInstance,
				stronghold,
				1
			);

			expect(result.success).toBe(true);
			expect(facilityInstance.status).toBe('busy');
			expect(facilityInstance.busyUntilDay).toBe(4); // Day 1 + 3 days

			// Order should not be complete on day 2
			expect(isTaskComplete(2, facilityInstance.busyUntilDay!)).toBe(false);

			// Order should be complete on day 4
			expect(isTaskComplete(4, facilityInstance.busyUntilDay!)).toBe(true);

			// Complete order
			orderService.completeFacilityOrder(facilityInstance);

			expect(facilityInstance.status).toBe('idle');
			expect(facilityInstance.currentOrder).toBeUndefined();
		});

		it('should handle neglect tracking', () => {
			stronghold.lastTurnDay = 1;
			stronghold.metadata.calendarDay = 1;

			// Fast forward 21 days (3 turns at 7-day interval)
			const pcLevel = 1; // Level 1-4 has grace period of 1 turn
			const turnsPassed = 3; // 21 days / 7 = 3 turns
			strongholdService.updateNeglect(stronghold, pcLevel, turnsPassed);

			// With PC level 1-4, grace period is 1 turn, so 3 turns - 1 grace = 2 neglect
			expect(stronghold.neglectCounter).toBe(2);
		});

		it('should handle morale system', () => {
			// Initial morale
			expect(hireling.morale.value).toBe(15);

			// Increase morale
			hirelingService.updateMorale(hireling, 3);
			expect(hireling.morale.value).toBe(18);

			// Decrease morale
			hirelingService.updateMorale(hireling, -5);
			expect(hireling.morale.value).toBe(13);

			// Should not exceed max
			hirelingService.updateMorale(hireling, 20);
			expect(hireling.morale.value).toBe(20);

			// Should not go below min
			hirelingService.updateMorale(hireling, -30);
			expect(hireling.morale.value).toBe(0);
		});

		it('should handle facility upgrades', () => {
			const basicFacility = facilityService.createFacilityInstance(
				smithyTemplate,
				{ type: 'party' }
			);
			strongholdService.addFacility(stronghold, basicFacility);

			// Create advanced smithy template
			const advancedSmithyTemplate: FacilityTemplate = {
				...smithyTemplate,
				id: 'smithy_advanced',
				name: 'Advanced Smithy',
				tier: 2,
				baseFacilityId: 'smithy_basic',
				hirelingsRequired: 2,
				upgradeCost: { gp: 300, timeInDays: 5 }
			};

			// Validate upgrade
			const validation = facilityService.validateConstruction(
				advancedSmithyTemplate,
				stronghold,
				{ level: 5, gp: 500 }
			);

			expect(validation.valid).toBe(true);
		});

		it('should handle event table rolling', () => {
			const eventTable: CustomEventTable = {
				id: 'stronghold_events',
				name: 'Stronghold Random Events',
				diceType: 'd100',
				events: [
					{
						id: 'event_1',
						rollRange: { min: 1, max: 30 },
						eventName: 'Merchant Arrives',
						description: 'A traveling merchant visits',
						resultType: 'narrative'
					},
					{
						id: 'event_2',
						rollRange: { min: 31, max: 70 },
						eventName: 'All Quiet',
						description: 'Nothing happens',
						resultType: 'narrative'
					},
					{
						id: 'event_3',
						rollRange: { min: 71, max: 100 },
						eventName: 'Bandit Attack',
						description: 'Bandits attack the stronghold',
						resultType: 'narrative'
					}
				],
				metadata: {
					createdDate: '2025-01-01',
					lastModified: '2025-01-01'
				}
			};

			// Validate event table
			const validation = eventTableService.validateTable(eventTable);
			expect(validation.valid).toBe(true);
		});
	});

	describe('Error Handling', () => {
		it('should prevent order execution on inoperable facility', () => {
			// Load template
			facilityService.loadTemplates([smithyTemplate]);

			const facilityInstance = facilityService.createFacilityInstance(
				smithyTemplate,
				{ type: 'party' }
			);
			// Don't assign hirelings - facility is inoperable

			// Check operational status separately (OrderService doesn't validate this)
			expect(facilityService.isOperational(facilityInstance)).toBe(false);
			expect(facilityService.canExecuteOrder(facilityInstance)).toBe(false);
		});

		it('should prevent order execution on busy facility', () => {
			const facilityInstance = facilityService.createFacilityInstance(
				smithyTemplate,
				{ type: 'party' }
			);
			facilityInstance.assignedHirelings.push(hireling.id);
			facilityInstance.status = 'busy';
			facilityInstance.busyUntilDay = 10;

			const validation = orderService.validateExecution(
				craftWeaponOrder,
				facilityInstance,
				stronghold,
				50
			);

			expect(validation.valid).toBe(false);
			expect(validation.errors.some(e => e.includes('idle'))).toBe(true);
		});

		it('should validate stronghold data integrity', () => {
			// Create invalid stronghold
			const invalidStronghold = strongholdService.createStronghold(
				'',
				{ type: 'party' }
			);

			const validation = strongholdService.validateStronghold(invalidStronghold);

			expect(validation.valid).toBe(false);
			expect(validation.errors.length).toBeGreaterThan(0);
		});
	});
});
