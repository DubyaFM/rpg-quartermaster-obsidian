// Type compilation tests for Event System Types
import { describe, it, expect } from 'vitest';
import type {
	EventContext,
	EventDefinition,
	FixedDateEvent,
	IntervalEvent,
	ChainEvent,
	ChainEventState,
	ConditionalEvent,
	AnyEventDefinition,
	ActiveEvent,
	EffectRegistry
} from '../eventTypes';

describe('Event System Types', () => {
	describe('Type Compilation', () => {
		it('should compile EventContext', () => {
			const context: EventContext = {
				location: 'waterdeep',
				faction: 'harpers',
				season: 'summer',
				region: 'temperate',
				tags: ['festival']
			};
			expect(context.location).toBe('waterdeep');
		});

		it('should compile FixedDateEvent', () => {
			const event: FixedDateEvent = {
				id: 'midsummer',
				name: 'Midsummer Festival',
				type: 'fixed',
				priority: 0,
				effects: { ui_banner: 'Festival!' },
				date: {
					month: 5,
					day: 20
				}
			};
			expect(event.type).toBe('fixed');
		});

		it('should compile IntervalEvent', () => {
			const event: IntervalEvent = {
				id: 'shop-restock',
				name: 'Shop Restock',
				type: 'interval',
				priority: 0,
				effects: {},
				interval: 7,
				offset: 0
			};
			expect(event.type).toBe('interval');
		});

		it('should compile ChainEvent', () => {
			const weatherState: ChainEventState = {
				name: 'Clear',
				weight: 60,
				duration: '2d4 days',
				effects: { light_level: 'bright' }
			};

			const event: ChainEvent = {
				id: 'weather',
				name: 'Weather System',
				type: 'chain',
				priority: 0,
				effects: {},
				seed: 12345,
				states: [weatherState]
			};
			expect(event.type).toBe('chain');
			expect(event.states.length).toBe(1);
		});

		it('should compile ConditionalEvent', () => {
			const event: ConditionalEvent = {
				id: 'full-moon-prices',
				name: 'Full Moon Price Increase',
				type: 'conditional',
				priority: 0,
				effects: { price_mult_global: 1.2 },
				condition: "events['moon'].state == 'Full'",
				tier: 1
			};
			expect(event.type).toBe('conditional');
			expect(event.tier).toBe(1);
		});

		it('should support discriminated union via AnyEventDefinition', () => {
			const events: AnyEventDefinition[] = [
				{
					id: 'holiday',
					name: 'Holiday',
					type: 'fixed',
					priority: 0,
					effects: {},
					date: { month: 0, day: 1 }
				},
				{
					id: 'interval',
					name: 'Interval',
					type: 'interval',
					priority: 0,
					effects: {},
					interval: 7
				}
			];

			events.forEach(event => {
				if (event.type === 'fixed') {
					// TypeScript should narrow the type here
					expect(event.date).toBeDefined();
				} else if (event.type === 'interval') {
					// TypeScript should narrow the type here
					expect(event.interval).toBeDefined();
				}
			});
		});

		it('should compile ActiveEvent', () => {
			const activeEvent: ActiveEvent = {
				eventId: 'midsummer',
				name: 'Midsummer Festival',
				type: 'fixed',
				state: 'Midsummer Festival',
				priority: 0,
				effects: { ui_banner: 'Festival!' },
				startDay: 100,
				endDay: 100,
				remainingDays: 0,
				source: 'definition',
				definition: {
					id: 'midsummer',
					name: 'Midsummer Festival',
					type: 'fixed',
					priority: 0,
					effects: { ui_banner: 'Festival!' },
					date: { month: 5, day: 20 }
				}
			};
			expect(activeEvent.eventId).toBe('midsummer');
		});

		it('should compile EffectRegistry', () => {
			const registry: EffectRegistry = {
				day: 100,
				timeOfDay: 720,
				context: { location: 'waterdeep' },
				activeEvents: [],
				effects: {},
				computedAt: Date.now()
			};
			expect(registry.day).toBe(100);
		});
	});

	describe('Type Guards', () => {
		it('should discriminate event types correctly', () => {
			const fixedEvent: AnyEventDefinition = {
				id: 'test',
				name: 'Test',
				type: 'fixed',
				priority: 0,
				effects: {},
				date: { month: 0, day: 1 }
			};

			if (fixedEvent.type === 'fixed') {
				// Type narrowing should work
				expect(fixedEvent.date.month).toBe(0);
			}
		});

		it('should handle optional fields correctly', () => {
			const minimalFixed: FixedDateEvent = {
				id: 'test',
				name: 'Test',
				type: 'fixed',
				priority: 0,
				effects: {},
				date: { month: 0, day: 1 }
			};

			const fullFixed: FixedDateEvent = {
				id: 'test',
				name: 'Test',
				type: 'fixed',
				priority: 0,
				effects: {},
				date: { month: 0, day: 1, year: 1492, intercalaryName: 'Midwinter' },
				duration: 3,
				description: 'A test event',
				locations: ['waterdeep'],
				factions: ['harpers'],
				seasons: ['summer'],
				regions: ['temperate'],
				tags: ['festival']
			};

			expect(minimalFixed.date.month).toBe(0);
			expect(fullFixed.locations?.length).toBe(1);
		});
	});
});
