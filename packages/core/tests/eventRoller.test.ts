import { describe, it, expect } from 'vitest';
import {
	rollDice,
	selectEventByRoll,
	DiceType
} from '../generators/eventRoller';
import { CustomEventTable, EventTableEntry } from '../models/stronghold';

// Mock randomizer for predictable tests
class MockRandomizer {
	private value: number;

	constructor(value: number) {
		this.value = value;
	}

	randomInt(min: number, max: number): number {
		return this.value;
	}
}

describe('Event Roller', () => {

	describe('rollDice', () => {
		it('should roll d100 within range', () => {
			const mockRand = new MockRandomizer(50);
			const result = rollDice('d100', mockRand);
			expect(result).toBe(50);
		});

		it('should roll d20 within range', () => {
			const mockRand = new MockRandomizer(15);
			const result = rollDice('d20', mockRand);
			expect(result).toBe(15);
		});

		it('should roll d12 within range', () => {
			const mockRand = new MockRandomizer(8);
			const result = rollDice('d12', mockRand);
			expect(result).toBe(8);
		});

		it('should roll d10 within range', () => {
			const mockRand = new MockRandomizer(7);
			const result = rollDice('d10', mockRand);
			expect(result).toBe(7);
		});

		it('should roll d8 within range', () => {
			const mockRand = new MockRandomizer(5);
			const result = rollDice('d8', mockRand);
			expect(result).toBe(5);
		});

		it('should roll d6 within range', () => {
			const mockRand = new MockRandomizer(4);
			const result = rollDice('d6', mockRand);
			expect(result).toBe(4);
		});

		it('should roll d4 within range', () => {
			const mockRand = new MockRandomizer(3);
			const result = rollDice('d4', mockRand);
			expect(result).toBe(3);
		});
	});

	describe('selectEventByRoll', () => {
		const mockEvents: EventTableEntry[] = [
			{
				id: 'event1',
				rollRange: { min: 1, max: 10 },
				eventName: 'Event 1',
				description: 'First event',
				resultType: 'narrative'
			},
			{
				id: 'event2',
				rollRange: { min: 11, max: 50 },
				eventName: 'Event 2',
				description: 'Second event',
				resultType: 'narrative'
			},
			{
				id: 'event3',
				rollRange: { min: 51, max: 100 },
				eventName: 'Event 3',
				description: 'Third event',
				resultType: 'narrative'
			}
		];

		const mockTable: CustomEventTable = {
			id: 'test_table',
			name: 'Test Table',
			diceType: 'd100',
			events: mockEvents,
			metadata: { createdDate: '', lastModified: '' }
		};

		it('should select event in first range', () => {
			const event = selectEventByRoll(mockTable, 5);
			expect(event).toBeDefined();
			expect(event?.id).toBe('event1');
		});

		it('should select event in second range', () => {
			const event = selectEventByRoll(mockTable, 30);
			expect(event).toBeDefined();
			expect(event?.id).toBe('event2');
		});

		it('should select event in third range', () => {
			const event = selectEventByRoll(mockTable, 75);
			expect(event).toBeDefined();
			expect(event?.id).toBe('event3');
		});

		it('should handle edge of ranges', () => {
			expect(selectEventByRoll(mockTable, 1)?.id).toBe('event1');
			expect(selectEventByRoll(mockTable, 10)?.id).toBe('event1');
			expect(selectEventByRoll(mockTable, 11)?.id).toBe('event2');
			expect(selectEventByRoll(mockTable, 50)?.id).toBe('event2');
			expect(selectEventByRoll(mockTable, 51)?.id).toBe('event3');
			expect(selectEventByRoll(mockTable, 100)?.id).toBe('event3');
		});

		it('should return undefined for roll outside any range', () => {
			const sparseTable: CustomEventTable = {
				id: 'sparse_table',
				name: 'Sparse Table',
				diceType: 'd100',
				events: [
					{
						id: 'event1',
						rollRange: { min: 1, max: 10 },
						eventName: 'Event 1',
						description: 'First event',
						resultType: 'narrative'
					},
					{
						id: 'event2',
						rollRange: { min: 50, max: 60 },
						eventName: 'Event 2',
						description: 'Second event',
						resultType: 'narrative'
					}
				],
				metadata: { createdDate: '', lastModified: '' }
			};

			expect(selectEventByRoll(sparseTable, 25)).toBeUndefined();
		});

		it('should handle single-value ranges', () => {
			const singleValueTable: CustomEventTable = {
				id: 'single_table',
				name: 'Single Value Table',
				diceType: 'd20',
				events: [
					{
						id: 'event1',
						rollRange: { min: 1, max: 1 },
						eventName: 'Natural 1',
						description: 'Critical failure',
						resultType: 'narrative'
					},
					{
						id: 'event2',
						rollRange: { min: 20, max: 20 },
						eventName: 'Natural 20',
						description: 'Critical success',
						resultType: 'narrative'
					}
				],
				metadata: { createdDate: '', lastModified: '' }
			};

			expect(selectEventByRoll(singleValueTable, 1)?.id).toBe('event1');
			expect(selectEventByRoll(singleValueTable, 20)?.id).toBe('event2');
		});

		it('should handle trigger_event result type', () => {
			const triggerTable: CustomEventTable = {
				id: 'trigger_table',
				name: 'Trigger Table',
				diceType: 'd20',
				events: [
					{
						id: 'event1',
						rollRange: { min: 1, max: 10 },
						eventName: 'Roll on subtable',
						description: 'Something happens',
						resultType: 'trigger_event',
						nestedTableId: 'subtable_1'
					}
				],
				metadata: { createdDate: '', lastModified: '' }
			};

			const event = selectEventByRoll(triggerTable, 5);
			expect(event).toBeDefined();
			expect(event?.resultType).toBe('trigger_event');
			expect(event?.nestedTableId).toBe('subtable_1');
		});
	});
});
