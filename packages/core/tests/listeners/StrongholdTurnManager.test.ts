import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../../services/EventBus';
import { StrongholdTurnManager } from '../../services/listeners/StrongholdTurnManager';
import { StrongholdService } from '../../services/StrongholdService';
import { FacilityService } from '../../services/FacilityService';
import { OrderService } from '../../services/OrderService';
import { Stronghold, StrongholdFacility } from '../../models/stronghold';
import { TimeAdvancedEvent } from '../../models/types';
import { SYSTEM_EVENTS } from '../../models/events';
import { DEFAULT_CURRENCY_CONFIG } from '../../data/defaultCurrencyConfig';

describe('StrongholdTurnManager', () => {
	let eventBus: EventBus;
	let strongholdService: StrongholdService;
	let facilityService: FacilityService;
	let orderService: OrderService;
	let turnManager: StrongholdTurnManager;
	let mockGetStrongholds: () => Promise<Stronghold[]>;
	let mockSaveStronghold: (stronghold: Stronghold) => Promise<void>;
	let strongholdsStorage: Stronghold[];
	let savedStrongholds: Stronghold[];

	beforeEach(() => {
		eventBus = new EventBus();
		strongholdService = new StrongholdService(DEFAULT_CURRENCY_CONFIG);
		facilityService = new FacilityService();
		orderService = new OrderService();

		strongholdsStorage = [];
		savedStrongholds = [];

		mockGetStrongholds = vi.fn(async () => {
			return [...strongholdsStorage];
		});

		mockSaveStronghold = vi.fn(async (stronghold: Stronghold) => {
			savedStrongholds.push(stronghold);
		});

		turnManager = new StrongholdTurnManager(
			eventBus,
			strongholdService,
			facilityService,
			orderService,
			mockGetStrongholds,
			mockSaveStronghold,
			DEFAULT_CURRENCY_CONFIG,
			{ turnInterval: 7, pcLevel: 1 }
		);
	});

	describe('Lifecycle', () => {
		it('should enable and disable event listening', () => {
			expect(turnManager.isEnabled()).toBe(false);

			turnManager.enable();
			expect(turnManager.isEnabled()).toBe(true);

			turnManager.disable();
			expect(turnManager.isEnabled()).toBe(false);
		});

		it('should not double-enable', () => {
			turnManager.enable();
			const count1 = eventBus.getListenerCount(SYSTEM_EVENTS.TIME_ADVANCED);

			turnManager.enable();
			const count2 = eventBus.getListenerCount(SYSTEM_EVENTS.TIME_ADVANCED);

			expect(count1).toBe(count2);
		});
	});

	describe('Configuration', () => {
		it('should update PC level', () => {
			turnManager.setPcLevel(5);
			// Verify by checking neglect calculation behavior in integration test
		});

		it('should update turn interval', () => {
			turnManager.setTurnInterval(14);
			// Verify by checking turn calculation behavior in integration test
		});
	});

	describe('Calendar Day Tracking', () => {
		it('should update stronghold calendar day when time advances', async () => {
			const stronghold = strongholdService.createStronghold(
				'Test Keep',
				{ type: 'party' },
				undefined,
				undefined,
				1  // Starting day
			);
			strongholdsStorage.push(stronghold);

			turnManager.enable();

			// Advance time
			const event: TimeAdvancedEvent = {
				previousDay: 1,
				newDay: 8,
				daysPassed: 7,
				calendar: { id: 'simple', name: 'Simple', weekdays: [], months: [], holidays: [] },
				formattedDate: {
					dayOfWeek: '',
					dayOfMonth: 8,
					monthName: '',
					year: 0,
					formatted: 'Day 8',
					compact: 'Day 8',
					absoluteDay: 8
				},
				timestamp: Date.now()
			};

			eventBus.emit(SYSTEM_EVENTS.TIME_ADVANCED, event);

			// Wait for async processing
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(savedStrongholds.length).toBeGreaterThan(0);
			expect(savedStrongholds[0].metadata.calendarDay).toBe(8);
		});
	});

	describe('Neglect Processing', () => {
		it('should update neglect counter when turns pass', async () => {
			const stronghold = strongholdService.createStronghold(
				'Neglected Keep',
				{ type: 'party' },
				undefined,
				undefined,
				1  // Starting on day 1
			);
			stronghold.lastTurnDay = 1;  // Last gave orders on day 1
			strongholdsStorage.push(stronghold);

			turnManager.enable();

			// Advance 14 days = 2 turns
			// With PC level 1: grace period = 1 turn
			// So neglect = 2 - 1 = 1
			const event: TimeAdvancedEvent = {
				previousDay: 1,
				newDay: 15,
				daysPassed: 14,
				calendar: { id: 'simple', name: 'Simple', weekdays: [], months: [], holidays: [] },
				formattedDate: {
					dayOfWeek: '',
					dayOfMonth: 15,
					monthName: '',
					year: 0,
					formatted: 'Day 15',
					compact: 'Day 15',
					absoluteDay: 15
				},
				timestamp: Date.now()
			};

			eventBus.emit(SYSTEM_EVENTS.TIME_ADVANCED, event);

			// Wait for async processing
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(savedStrongholds.length).toBeGreaterThan(0);
			expect(savedStrongholds[0].neglectCounter).toBe(1);
		});

		it('should not update neglect if no turns have passed', async () => {
			const stronghold = strongholdService.createStronghold(
				'Well-Maintained Keep',
				{ type: 'party' },
				undefined,
				undefined,
				1
			);
			stronghold.lastTurnDay = 1;
			stronghold.neglectCounter = 0;
			strongholdsStorage.push(stronghold);

			turnManager.enable();

			// Advance only 3 days (less than 1 turn)
			const event: TimeAdvancedEvent = {
				previousDay: 1,
				newDay: 4,
				daysPassed: 3,
				calendar: { id: 'simple', name: 'Simple', weekdays: [], months: [], holidays: [] },
				formattedDate: {
					dayOfWeek: '',
					dayOfMonth: 4,
					monthName: '',
					year: 0,
					formatted: 'Day 4',
					compact: 'Day 4',
					absoluteDay: 4
				},
				timestamp: Date.now()
			};

			eventBus.emit(SYSTEM_EVENTS.TIME_ADVANCED, event);

			// Wait for async processing
			await new Promise(resolve => setTimeout(resolve, 10));

			// Should still save because calendar day changed
			expect(savedStrongholds.length).toBeGreaterThan(0);
			// But neglect should not increase
			expect(savedStrongholds[0].neglectCounter).toBe(0);
		});

		it('should respect PC level grace periods', async () => {
			const stronghold = strongholdService.createStronghold(
				'High-Level Keep',
				{ type: 'party' },
				undefined,
				undefined,
				1
			);
			stronghold.lastTurnDay = 1;
			strongholdsStorage.push(stronghold);

			// Set PC level to 11 (grace period = 3 turns)
			turnManager.setPcLevel(11);
			turnManager.enable();

			// Advance 21 days = 3 turns
			// With PC level 11: grace period = 3 turns
			// So neglect = 3 - 3 = 0
			const event: TimeAdvancedEvent = {
				previousDay: 1,
				newDay: 22,
				daysPassed: 21,
				calendar: { id: 'simple', name: 'Simple', weekdays: [], months: [], holidays: [] },
				formattedDate: {
					dayOfWeek: '',
					dayOfMonth: 22,
					monthName: '',
					year: 0,
					formatted: 'Day 22',
					compact: 'Day 22',
					absoluteDay: 22
				},
				timestamp: Date.now()
			};

			eventBus.emit(SYSTEM_EVENTS.TIME_ADVANCED, event);

			// Wait for async processing
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(savedStrongholds.length).toBeGreaterThan(0);
			expect(savedStrongholds[0].neglectCounter).toBe(0);
		});
	});

	describe('Facility Order Completion', () => {
		it('should complete facility orders that are due', async () => {
			const stronghold = strongholdService.createStronghold(
				'Building Keep',
				{ type: 'party' },
				undefined,
				undefined,
				1
			);

			const facility: StrongholdFacility = {
				id: 'smithy-1',
				templateId: 'smithy_basic',
				name: 'Smithy',
				ownership: { type: 'party' },
				status: 'busy',
				busyUntilDay: 10,
				assignedHirelings: [],
				tier: 1
			};

			strongholdService.addFacility(stronghold, facility);
			strongholdsStorage.push(stronghold);

			turnManager.enable();

			// Advance to completion day
			const event: TimeAdvancedEvent = {
				previousDay: 5,
				newDay: 10,
				daysPassed: 5,
				calendar: { id: 'simple', name: 'Simple', weekdays: [], months: [], holidays: [] },
				formattedDate: {
					dayOfWeek: '',
					dayOfMonth: 10,
					monthName: '',
					year: 0,
					formatted: 'Day 10',
					compact: 'Day 10',
					absoluteDay: 10
				},
				timestamp: Date.now()
			};

			eventBus.emit(SYSTEM_EVENTS.TIME_ADVANCED, event);

			// Wait for async processing
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(savedStrongholds.length).toBeGreaterThan(0);
			const savedFacility = savedStrongholds[0].facilities.find(f => f.id === 'smithy-1');
			expect(savedFacility?.status).toBe('idle');
			expect(savedFacility?.busyUntilDay).toBeUndefined();
		});

		it('should not complete facility orders that are not yet due', async () => {
			const stronghold = strongholdService.createStronghold(
				'Building Keep',
				{ type: 'party' },
				undefined,
				undefined,
				1
			);

			const facility: StrongholdFacility = {
				id: 'smithy-1',
				templateId: 'smithy_basic',
				name: 'Smithy',
				ownership: { type: 'party' },
				status: 'busy',
				busyUntilDay: 15,
				assignedHirelings: [],
				tier: 1
			};

			strongholdService.addFacility(stronghold, facility);
			strongholdsStorage.push(stronghold);

			turnManager.enable();

			// Advance to day 10 (before completion)
			const event: TimeAdvancedEvent = {
				previousDay: 5,
				newDay: 10,
				daysPassed: 5,
				calendar: { id: 'simple', name: 'Simple', weekdays: [], months: [], holidays: [] },
				formattedDate: {
					dayOfWeek: '',
					dayOfMonth: 10,
					monthName: '',
					year: 0,
					formatted: 'Day 10',
					compact: 'Day 10',
					absoluteDay: 10
				},
				timestamp: Date.now()
			};

			eventBus.emit(SYSTEM_EVENTS.TIME_ADVANCED, event);

			// Wait for async processing
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(savedStrongholds.length).toBeGreaterThan(0);
			const savedFacility = savedStrongholds[0].facilities.find(f => f.id === 'smithy-1');
			expect(savedFacility?.status).toBe('busy');
			expect(savedFacility?.busyUntilDay).toBe(15);
		});
	});

	describe('Buff Expiration', () => {
		it('should expire buffs that are past their expiration date', async () => {
			const stronghold = strongholdService.createStronghold(
				'Buffed Keep',
				{ type: 'party' },
				undefined,
				undefined,
				1
			);

			const buff = {
				id: 'buff-1',
				name: 'Morale Boost',
				description: 'Temporary morale increase',
				appliedOnDay: 1,
				durationInDays: 7,
				expiresOnDay: 8,
				effects: '+5 morale'
			};

			strongholdService.applyBuff(stronghold, buff);
			strongholdsStorage.push(stronghold);

			turnManager.enable();

			// Advance past expiration
			const event: TimeAdvancedEvent = {
				previousDay: 5,
				newDay: 10,
				daysPassed: 5,
				calendar: { id: 'simple', name: 'Simple', weekdays: [], months: [], holidays: [] },
				formattedDate: {
					dayOfWeek: '',
					dayOfMonth: 10,
					monthName: '',
					year: 0,
					formatted: 'Day 10',
					compact: 'Day 10',
					absoluteDay: 10
				},
				timestamp: Date.now()
			};

			eventBus.emit(SYSTEM_EVENTS.TIME_ADVANCED, event);

			// Wait for async processing
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(savedStrongholds.length).toBeGreaterThan(0);
			expect(savedStrongholds[0].activeBuffs.length).toBe(0);
		});

		it('should keep permanent buffs', async () => {
			const stronghold = strongholdService.createStronghold(
				'Blessed Keep',
				{ type: 'party' },
				undefined,
				undefined,
				1
			);

			const permanentBuff = {
				id: 'buff-1',
				name: 'Divine Blessing',
				description: 'Permanent blessing',
				appliedOnDay: 1,
				effects: '+2 defense'
				// No durationInDays or expiresOnDay = permanent
			};

			strongholdService.applyBuff(stronghold, permanentBuff);
			strongholdsStorage.push(stronghold);

			turnManager.enable();

			// Advance time significantly
			const event: TimeAdvancedEvent = {
				previousDay: 1,
				newDay: 100,
				daysPassed: 99,
				calendar: { id: 'simple', name: 'Simple', weekdays: [], months: [], holidays: [] },
				formattedDate: {
					dayOfWeek: '',
					dayOfMonth: 100,
					monthName: '',
					year: 0,
					formatted: 'Day 100',
					compact: 'Day 100',
					absoluteDay: 100
				},
				timestamp: Date.now()
			};

			eventBus.emit(SYSTEM_EVENTS.TIME_ADVANCED, event);

			// Wait for async processing
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(savedStrongholds.length).toBeGreaterThan(0);
			expect(savedStrongholds[0].activeBuffs.length).toBe(1);
			expect(savedStrongholds[0].activeBuffs[0].name).toBe('Divine Blessing');
		});
	});

	describe('Manual Processing', () => {
		it('should allow manual processing of all strongholds', async () => {
			const stronghold1 = strongholdService.createStronghold(
				'Keep 1',
				{ type: 'party' },
				undefined,
				undefined,
				1
			);
			const stronghold2 = strongholdService.createStronghold(
				'Keep 2',
				{ type: 'party' },
				undefined,
				undefined,
				1
			);

			strongholdsStorage.push(stronghold1, stronghold2);

			// Manually process without event
			await turnManager.processAllStrongholds(10);

			expect(savedStrongholds.length).toBe(2);
			expect(savedStrongholds[0].metadata.calendarDay).toBe(10);
			expect(savedStrongholds[1].metadata.calendarDay).toBe(10);
		});
	});

	describe('Error Handling', () => {
		it('should continue processing other strongholds if one fails', async () => {
			const stronghold1 = strongholdService.createStronghold(
				'Good Keep',
				{ type: 'party' },
				undefined,
				undefined,
				1
			);
			const stronghold2 = strongholdService.createStronghold(
				'Bad Keep',
				{ type: 'party' },
				undefined,
				undefined,
				1
			);

			strongholdsStorage.push(stronghold1, stronghold2);

			// Make save fail for second stronghold
			const originalSave = mockSaveStronghold;
			mockSaveStronghold = vi.fn(async (stronghold: Stronghold) => {
				if (stronghold.name === 'Bad Keep') {
					throw new Error('Save failed');
				}
				await originalSave(stronghold);
			});

			turnManager = new StrongholdTurnManager(
				eventBus,
				strongholdService,
				facilityService,
				orderService,
				mockGetStrongholds,
				mockSaveStronghold,
				DEFAULT_CURRENCY_CONFIG,
				{ turnInterval: 7, pcLevel: 1 }
			);

			turnManager.enable();

			const event: TimeAdvancedEvent = {
				previousDay: 1,
				newDay: 8,
				daysPassed: 7,
				calendar: { id: 'simple', name: 'Simple', weekdays: [], months: [], holidays: [] },
				formattedDate: {
					dayOfWeek: '',
					dayOfMonth: 8,
					monthName: '',
					year: 0,
					formatted: 'Day 8',
					compact: 'Day 8',
					absoluteDay: 8
				},
				timestamp: Date.now()
			};

			eventBus.emit(SYSTEM_EVENTS.TIME_ADVANCED, event);

			// Wait for async processing
			await new Promise(resolve => setTimeout(resolve, 10));

			// First stronghold should still be saved
			expect(savedStrongholds.length).toBe(1);
			expect(savedStrongholds[0].name).toBe('Good Keep');
		});
	});
});
