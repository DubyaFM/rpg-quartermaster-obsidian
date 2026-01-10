import { describe, it, expect } from 'vitest';
import {
	EventValidator,
	EventValidationError,
	type EffectKeyRegistry
} from '../../validators/EventValidator';
import {
	type FixedDateEvent,
	type IntervalEvent,
	type ChainEvent,
	type ConditionalEvent
} from '../../models/eventTypes';
import { ISeededRandomizer } from '../../interfaces/ISeededRandomizer';

// Mock RNG for testing
const mockRng: ISeededRandomizer = {
	randomInt: (min: number, max: number) => Math.floor((min + max) / 2),
	randomFloat: () => 0.5,
	rollDice: (notation: string) => {
		const match = notation.match(/^(\d+)d(\d+)([+-]\d+)?$/);
		if (!match) {
			throw new Error(`Invalid dice notation: ${notation}`);
		}
		const numDice = parseInt(match[1]);
		const numSides = parseInt(match[2]);
		const modifier = match[3] ? parseInt(match[3]) : 0;
		return {
			total: Math.floor(numDice * (numSides / 2) + numDice / 2) + modifier,
			rolls: []
		};
	},
	randomChoice: <T,>(items: T[]) => items[0],
	weightedChoice: <T,>(items: T[], _weights: number[]) => items[0],
	rollPercentile: () => 50,
	chance: (_percentage: number) => true,
	getState: () => 0,
	reseed: () => {}
};

describe('EventValidator', () => {
	// Valid test events
	const validFixedEvent: FixedDateEvent = {
		id: 'holiday-midwinter',
		name: 'Midwinter Festival',
		type: 'fixed',
		priority: 10,
		effects: { holidayBonus: 0.2 },
		date: { month: 0, day: 15 },
		duration: 3
	};

	const validIntervalEvent: IntervalEvent = {
		id: 'market-day',
		name: 'Market Day',
		type: 'interval',
		priority: 5,
		effects: { marketOpen: true },
		interval: 7,
		offset: 0,
		duration: 1
	};

	const validChainEvent: ChainEvent = {
		id: 'weather-system',
		name: 'Weather',
		type: 'chain',
		priority: 8,
		effects: {},
		seed: 12345,
		states: [
			{
				name: 'Clear',
				weight: 5,
				duration: '2d6 days',
				effects: { temperature: 'moderate' }
			},
			{
				name: 'Rainy',
				weight: 3,
				duration: '1d4 days',
				effects: { temperature: 'cool', precipitation: 'rain' }
			}
		]
	};

	const validConditionalEvent: ConditionalEvent = {
		id: 'harvest-celebration',
		name: 'Harvest Celebration',
		type: 'conditional',
		priority: 7,
		effects: { harvestBonus: 0.15 },
		condition: "events['autumn-equinox'].active",
		tier: 1,
		duration: 2
	};

	describe('Schema Validation', () => {
		it('should validate a complete fixed date event', () => {
			const result = EventValidator.validate(validFixedEvent);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should validate a complete interval event', () => {
			const result = EventValidator.validate(validIntervalEvent);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should validate a complete chain event', () => {
			const result = EventValidator.validate(validChainEvent, undefined, undefined, mockRng);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should validate a complete conditional event', () => {
			const result = EventValidator.validate(validConditionalEvent);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should reject event without id', () => {
			const event = { ...validFixedEvent, id: undefined };
			const result = EventValidator.validate(event as any);
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					severity: 'error',
					field: 'id'
				})
			);
		});

		it('should reject event with empty id', () => {
			const event = { ...validFixedEvent, id: '' };
			const result = EventValidator.validate(event);
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					severity: 'error',
					field: 'id'
				})
			);
		});

		it('should reject event without name', () => {
			const event = { ...validFixedEvent, name: undefined };
			const result = EventValidator.validate(event as any);
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					severity: 'error',
					field: 'name'
				})
			);
		});

		it('should reject event with invalid type', () => {
			const event = { ...validFixedEvent, type: 'invalid' };
			const result = EventValidator.validate(event as any);
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					severity: 'error',
					field: 'type'
				})
			);
		});

		it('should reject event without priority', () => {
			const event = { ...validFixedEvent, priority: undefined };
			const result = EventValidator.validate(event as any);
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					severity: 'error',
					field: 'priority'
				})
			);
		});

		it('should warn on negative priority', () => {
			const event = { ...validFixedEvent, priority: -5 };
			const result = EventValidator.validate(event);
			expect(result.valid).toBe(true); // Valid but with warning
			expect(result.warnings).toContainEqual(
				expect.objectContaining({
					severity: 'warning',
					field: 'priority'
				})
			);
		});

		it('should warn on very high priority', () => {
			const event = { ...validFixedEvent, priority: 1500 };
			const result = EventValidator.validate(event);
			expect(result.valid).toBe(true); // Valid but with warning
			expect(result.warnings).toContainEqual(
				expect.objectContaining({
					severity: 'warning',
					field: 'priority'
				})
			);
		});

		it('should reject event without effects', () => {
			const event = { ...validFixedEvent, effects: undefined };
			const result = EventValidator.validate(event as any);
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					severity: 'error',
					field: 'effects'
				})
			);
		});

		it('should reject event with non-object effects', () => {
			const event = { ...validFixedEvent, effects: [] };
			const result = EventValidator.validate(event as any);
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					severity: 'error',
					field: 'effects'
				})
			);
		});

		it('should info note on empty effects', () => {
			const event = { ...validFixedEvent, effects: {} };
			const result = EventValidator.validate(event);
			expect(result.valid).toBe(true); // Valid but with info
			expect(result.info).toContainEqual(
				expect.objectContaining({
					severity: 'info',
					field: 'effects'
				})
			);
		});

		it('should reject event with non-array locations', () => {
			const event = { ...validFixedEvent, locations: 'not-an-array' as any };
			const result = EventValidator.validate(event);
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					severity: 'error',
					field: 'locations'
				})
			);
		});
	});

	describe('Fixed Date Event Validation', () => {
		it('should validate standard date (month + day)', () => {
			const event: FixedDateEvent = {
				...validFixedEvent,
				date: { month: 5, day: 20 }
			};
			const result = EventValidator.validate(event);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should validate intercalary date', () => {
			const event: FixedDateEvent = {
				...validFixedEvent,
				date: { month: 0, day: 1, intercalaryName: 'Midwinter' }
			};
			const result = EventValidator.validate(event);
			// Should have warning about specifying both
			expect(result.valid).toBe(true);
			expect(result.warnings.some(w => w.field === 'date')).toBe(true);
		});

		it('should reject date without month/day or intercalaryName', () => {
			const event: FixedDateEvent = {
				...validFixedEvent,
				date: {} as any
			};
			const result = EventValidator.validate(event);
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					severity: 'error',
					field: 'date'
				})
			);
		});

		it('should reject negative month', () => {
			const event: FixedDateEvent = {
				...validFixedEvent,
				date: { month: -1, day: 1 }
			};
			const result = EventValidator.validate(event);
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					severity: 'error',
					field: 'date.month'
				})
			);
		});

		it('should reject day less than 1', () => {
			const event: FixedDateEvent = {
				...validFixedEvent,
				date: { month: 0, day: 0 }
			};
			const result = EventValidator.validate(event);
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					severity: 'error',
					field: 'date.day'
				})
			);
		});

		it('should validate one-time event with year', () => {
			const event: FixedDateEvent = {
				...validFixedEvent,
				date: { month: 0, day: 1, year: 1492 }
			};
			const result = EventValidator.validate(event);
			expect(result.valid).toBe(true);
			expect(result.info).toContainEqual(
				expect.objectContaining({
					severity: 'info',
					field: 'date.year'
				})
			);
		});

		it('should reject invalid duration', () => {
			const event: FixedDateEvent = {
				...validFixedEvent,
				duration: 0
			};
			const result = EventValidator.validate(event);
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					severity: 'error',
					field: 'duration'
				})
			);
		});
	});

	describe('Interval Event Validation', () => {
		it('should validate interval event with all fields', () => {
			const result = EventValidator.validate(validIntervalEvent);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should reject interval less than 1', () => {
			const event: IntervalEvent = {
				...validIntervalEvent,
				interval: 0
			};
			const result = EventValidator.validate(event);
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					severity: 'error',
					field: 'interval'
				})
			);
		});

		it('should reject non-integer offset', () => {
			const event: IntervalEvent = {
				...validIntervalEvent,
				offset: 3.5
			};
			const result = EventValidator.validate(event);
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					severity: 'error',
					field: 'offset'
				})
			);
		});

		it('should suggest useMinutes for short intervals', () => {
			const event: IntervalEvent = {
				...validIntervalEvent,
				interval: 120, // 120 minutes
				useMinutes: false
			};
			const result = EventValidator.validate(event);
			expect(result.valid).toBe(true);
			expect(result.info).toContainEqual(
				expect.objectContaining({
					severity: 'info',
					field: 'interval'
				})
			);
		});

		it('should validate sub-day interval', () => {
			const event: IntervalEvent = {
				...validIntervalEvent,
				interval: 60, // Every hour
				useMinutes: true
			};
			const result = EventValidator.validate(event);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});
	});

	describe('Chain Event Validation', () => {
		it('should validate chain event with multiple states', () => {
			const result = EventValidator.validate(validChainEvent, undefined, undefined, mockRng);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should reject chain event without seed', () => {
			const event: ChainEvent = {
				...validChainEvent,
				seed: undefined as any
			};
			const result = EventValidator.validate(event);
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					severity: 'error',
					field: 'seed'
				})
			);
		});

		it('should reject chain event without states', () => {
			const event: ChainEvent = {
				...validChainEvent,
				states: undefined as any
			};
			const result = EventValidator.validate(event);
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					severity: 'error',
					field: 'states'
				})
			);
		});

		it('should reject chain event with empty states', () => {
			const event: ChainEvent = {
				...validChainEvent,
				states: []
			};
			const result = EventValidator.validate(event);
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					severity: 'error',
					field: 'states'
				})
			);
		});

		it('should reject state without name', () => {
			const event: ChainEvent = {
				...validChainEvent,
				states: [
					{
						name: '',
						weight: 5,
						duration: '2d6 days',
						effects: {}
					}
				]
			};
			const result = EventValidator.validate(event, undefined, undefined, mockRng);
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					severity: 'error',
					field: 'states[0].name'
				})
			);
		});

		it('should reject duplicate state names', () => {
			const event: ChainEvent = {
				...validChainEvent,
				states: [
					{
						name: 'Clear',
						weight: 5,
						duration: '2d6 days',
						effects: {}
					},
					{
						name: 'Clear', // Duplicate
						weight: 3,
						duration: '1d4 days',
						effects: {}
					}
				]
			};
			const result = EventValidator.validate(event, undefined, undefined, mockRng);
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					severity: 'error',
					field: 'states[1].name',
					message: expect.stringContaining('Duplicate')
				})
			);
		});

		it('should reject state with negative weight', () => {
			const event: ChainEvent = {
				...validChainEvent,
				states: [
					{
						name: 'Clear',
						weight: -5,
						duration: '2d6 days',
						effects: {}
					}
				]
			};
			const result = EventValidator.validate(event, undefined, undefined, mockRng);
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					severity: 'error',
					field: 'states[0].weight'
				})
			);
		});

		it('should reject state without duration', () => {
			const event: ChainEvent = {
				...validChainEvent,
				states: [
					{
						name: 'Clear',
						weight: 5,
						duration: undefined as any,
						effects: {}
					}
				]
			};
			const result = EventValidator.validate(event, undefined, undefined, mockRng);
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					severity: 'error',
					field: 'states[0].duration'
				})
			);
		});

		it('should reject state with invalid dice notation', () => {
			const event: ChainEvent = {
				...validChainEvent,
				states: [
					{
						name: 'Clear',
						weight: 5,
						duration: 'invalid notation',
						effects: {}
					}
				]
			};
			const result = EventValidator.validate(event, undefined, undefined, mockRng);
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					severity: 'error',
					field: 'states[0].duration',
					message: expect.stringContaining('Invalid dice notation')
				})
			);
		});

		it('should validate various dice notation formats', () => {
			const event: ChainEvent = {
				...validChainEvent,
				states: [
					{
						name: 'State1',
						weight: 5,
						duration: '2d6 days',
						effects: {}
					},
					{
						name: 'State2',
						weight: 3,
						duration: '1 week + 2d4 hours',
						effects: {}
					},
					{
						name: 'State3',
						weight: 2,
						duration: '3 days',
						effects: {}
					}
				]
			};
			const result = EventValidator.validate(event, undefined, undefined, mockRng);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should reject initialState that does not match any state', () => {
			const event: ChainEvent = {
				...validChainEvent,
				initialState: 'NonExistentState'
			};
			const result = EventValidator.validate(event, undefined, undefined, mockRng);
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					severity: 'error',
					field: 'initialState'
				})
			);
		});

		it('should validate initialState that matches a state', () => {
			const event: ChainEvent = {
				...validChainEvent,
				initialState: 'Clear'
			};
			const result = EventValidator.validate(event, undefined, undefined, mockRng);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});
	});

	describe('Conditional Event Validation', () => {
		it('should validate conditional event with valid condition', () => {
			const result = EventValidator.validate(validConditionalEvent);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should reject conditional event without condition', () => {
			const event: ConditionalEvent = {
				...validConditionalEvent,
				condition: undefined as any
			};
			const result = EventValidator.validate(event);
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					severity: 'error',
					field: 'condition'
				})
			);
		});

		it('should reject empty condition', () => {
			const event: ConditionalEvent = {
				...validConditionalEvent,
				condition: ''
			};
			const result = EventValidator.validate(event);
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					severity: 'error',
					field: 'condition'
				})
			);
		});

		it('should reject invalid condition syntax', () => {
			const event: ConditionalEvent = {
				...validConditionalEvent,
				condition: 'invalid syntax %%'
			};
			const result = EventValidator.validate(event);
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					severity: 'error',
					field: 'condition'
				})
			);
		});

		it('should validate complex condition', () => {
			const event: ConditionalEvent = {
				...validConditionalEvent,
				condition: "(events['moon'].state == 'Full' && events['weather'].active) || !events['rain'].active"
			};
			const result = EventValidator.validate(event);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should reject conditional event without tier', () => {
			const event: ConditionalEvent = {
				...validConditionalEvent,
				tier: undefined as any
			};
			const result = EventValidator.validate(event);
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					severity: 'error',
					field: 'tier'
				})
			);
		});

		it('should reject invalid tier', () => {
			const event: ConditionalEvent = {
				...validConditionalEvent,
				tier: 3 as any
			};
			const result = EventValidator.validate(event);
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					severity: 'error',
					field: 'tier',
					message: expect.stringContaining('Invalid tier')
				})
			);
		});

		it('should validate tier 1', () => {
			const event: ConditionalEvent = {
				...validConditionalEvent,
				tier: 1
			};
			const result = EventValidator.validate(event);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should validate tier 2', () => {
			const event: ConditionalEvent = {
				...validConditionalEvent,
				tier: 2
			};
			const result = EventValidator.validate(event);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});
	});

	describe('Dependency Validation', () => {
		it('should warn on unknown event reference', () => {
			const event: ConditionalEvent = {
				...validConditionalEvent,
				condition: "events['unknown-event'].active"
			};
			const validEventIds = new Set(['autumn-equinox', 'spring-equinox']);
			const result = EventValidator.validate(event, validEventIds);
			expect(result.valid).toBe(true); // Lazy validation - warning only
			expect(result.warnings).toContainEqual(
				expect.objectContaining({
					severity: 'warning',
					field: 'condition',
					message: expect.stringContaining('unknown event')
				})
			);
		});

		it('should not warn when all references are valid', () => {
			const event: ConditionalEvent = {
				...validConditionalEvent,
				condition: "events['autumn-equinox'].active && events['harvest-moon'].state == 'Full'"
			};
			const validEventIds = new Set(['autumn-equinox', 'harvest-moon']);
			const result = EventValidator.validate(event, validEventIds);
			expect(result.valid).toBe(true);
			expect(result.warnings.filter(w => w.field === 'condition')).toHaveLength(0);
		});

		it('should skip dependency validation when no registry provided', () => {
			const event: ConditionalEvent = {
				...validConditionalEvent,
				condition: "events['unknown-event'].active"
			};
			const result = EventValidator.validate(event); // No validEventIds
			expect(result.valid).toBe(true);
			expect(result.warnings.filter(w => w.field === 'condition')).toHaveLength(0);
		});
	});

	describe('Effect Key Validation', () => {
		it('should warn on unknown effect key', () => {
			const event: FixedDateEvent = {
				...validFixedEvent,
				effects: { unknownEffect: 123 }
			};
			const effectKeyRegistry: EffectKeyRegistry = new Set(['holidayBonus', 'marketOpen']);
			const result = EventValidator.validate(event, undefined, effectKeyRegistry);
			expect(result.valid).toBe(true); // Lazy validation - warning only
			expect(result.warnings).toContainEqual(
				expect.objectContaining({
					severity: 'warning',
					field: 'effects',
					message: expect.stringContaining('Unknown effect key')
				})
			);
		});

		it('should not warn when all effect keys are valid', () => {
			const event: FixedDateEvent = {
				...validFixedEvent,
				effects: { holidayBonus: 0.2 }
			};
			const effectKeyRegistry: EffectKeyRegistry = new Set(['holidayBonus', 'marketOpen']);
			const result = EventValidator.validate(event, undefined, effectKeyRegistry);
			expect(result.valid).toBe(true);
			expect(result.warnings.filter(w => w.field === 'effects')).toHaveLength(0);
		});

		it('should validate effect keys in chain event states', () => {
			const event: ChainEvent = {
				...validChainEvent,
				states: [
					{
						name: 'Clear',
						weight: 5,
						duration: '2d6 days',
						effects: { unknownEffect: 'test' }
					}
				]
			};
			const effectKeyRegistry: EffectKeyRegistry = new Set(['temperature', 'precipitation']);
			const result = EventValidator.validate(event, undefined, effectKeyRegistry, mockRng);
			expect(result.valid).toBe(true); // Lazy validation - warning only
			expect(result.warnings).toContainEqual(
				expect.objectContaining({
					severity: 'warning',
					field: 'states[0].effects',
					message: expect.stringContaining('Unknown effect key')
				})
			);
		});

		it('should skip effect key validation when no registry provided', () => {
			const event: FixedDateEvent = {
				...validFixedEvent,
				effects: { unknownEffect: 123 }
			};
			const result = EventValidator.validate(event); // No effectKeyRegistry
			expect(result.valid).toBe(true);
			expect(result.warnings.filter(w => w.field === 'effects')).toHaveLength(0);
		});
	});

	describe('validateOrThrow', () => {
		it('should not throw for valid event', () => {
			expect(() => {
				EventValidator.validateOrThrow(validFixedEvent);
			}).not.toThrow();
		});

		it('should throw EventValidationError for invalid event', () => {
			const event = { ...validFixedEvent, id: '' };
			expect(() => {
				EventValidator.validateOrThrow(event);
			}).toThrow(EventValidationError);
		});

		it('should include field and message in thrown error', () => {
			const event = { ...validFixedEvent, id: '' };
			try {
				EventValidator.validateOrThrow(event);
				expect.fail('Should have thrown');
			} catch (error) {
				expect(error).toBeInstanceOf(EventValidationError);
				const valError = error as EventValidationError;
				expect(valError.field).toBe('id');
				expect(valError.message).toContain('Event validation failed');
			}
		});
	});

	describe('getValidationErrors', () => {
		it('should return empty array for valid event', () => {
			const errors = EventValidator.getValidationErrors(validFixedEvent);
			expect(errors).toHaveLength(0);
		});

		it('should return formatted error strings', () => {
			const event = { ...validFixedEvent, id: '', name: '' };
			const errors = EventValidator.getValidationErrors(event);
			expect(errors.length).toBeGreaterThan(0);
			expect(errors[0]).toContain('id:');
		});

		it('should include suggestions in formatted errors', () => {
			const event = { ...validFixedEvent, type: 'invalid' as any };
			const errors = EventValidator.getValidationErrors(event);
			const typeError = errors.find(e => e.includes('type:'));
			expect(typeError).toBeDefined();
			expect(typeError).toContain('Suggestion:');
		});
	});
});
