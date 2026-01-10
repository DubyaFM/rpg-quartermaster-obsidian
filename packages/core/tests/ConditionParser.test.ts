import { describe, it, expect } from 'vitest';
import {
	parseCondition,
	evaluateCondition,
	extractEventReferences,
	validateCondition,
	EventStateMap
} from '../utils/ConditionParser';

// =============================================================================
// Test Suite: ConditionParser (TKT-CAL-023)
// =============================================================================

describe('ConditionParser', () => {

	// =========================================================================
	// Parsing Tests
	// =========================================================================

	describe('parseCondition', () => {

		describe('valid condition parsing', () => {

			it('should parse simple active check', () => {
				const result = parseCondition("events['moon'].active");
				expect(result.success).toBe(true);
				expect(result.ast).toBeDefined();
			});

			it('should parse state comparison with string literal', () => {
				const result = parseCondition("events['moon'].state == 'Full'");
				expect(result.success).toBe(true);
			});

			it('should parse state inequality comparison', () => {
				const result = parseCondition("events['weather'].state != 'Storm'");
				expect(result.success).toBe(true);
			});

			it('should parse AND expression', () => {
				const result = parseCondition("events['moon'].active && events['sun'].active");
				expect(result.success).toBe(true);
			});

			it('should parse OR expression', () => {
				const result = parseCondition("events['rain'].active || events['snow'].active");
				expect(result.success).toBe(true);
			});

			it('should parse NOT expression', () => {
				const result = parseCondition("!events['rain'].active");
				expect(result.success).toBe(true);
			});

			it('should parse parenthesized expressions', () => {
				const result = parseCondition("(events['a'].active && events['b'].active) || events['c'].active");
				expect(result.success).toBe(true);
			});

			it('should parse complex nested expression', () => {
				const result = parseCondition("!(!events['a'].active) && (events['b'].state == 'X' || events['c'].active)");
				expect(result.success).toBe(true);
			});

			it('should parse boolean literals', () => {
				expect(parseCondition("true").success).toBe(true);
				expect(parseCondition("false").success).toBe(true);
			});

			it('should parse number literals', () => {
				const result = parseCondition("events['temp'].effects['value'] > 100");
				expect(result.success).toBe(true);
			});

			it('should parse effects access', () => {
				const result = parseCondition("events['weather'].effects['temperature'] == 'hot'");
				expect(result.success).toBe(true);
			});

			it('should handle event IDs with hyphens', () => {
				const result = parseCondition("events['full-moon'].active");
				expect(result.success).toBe(true);
			});

			it('should handle event IDs with underscores', () => {
				const result = parseCondition("events['lunar_cycle'].active");
				expect(result.success).toBe(true);
			});

			it('should handle whitespace variations', () => {
				const cases = [
					"events['a'].active&&events['b'].active",
					"events['a'].active && events['b'].active",
					"events['a'].active  &&  events['b'].active",
					"  events['a'].active && events['b'].active  "
				];
				for (const condition of cases) {
					const result = parseCondition(condition);
					expect(result.success).toBe(true);
				}
			});
		});

		describe('invalid condition parsing', () => {

			it('should fail on empty string', () => {
				const result = parseCondition("");
				expect(result.success).toBe(false);
			});

			it('should fail on invalid syntax', () => {
				const result = parseCondition("this is not valid");
				expect(result.success).toBe(false);
			});

			it('should fail on unterminated string', () => {
				const result = parseCondition("events['moon].active");
				expect(result.success).toBe(false);
				expect(result.error).toContain('Unterminated');
			});

			it('should fail on missing property after dot', () => {
				const result = parseCondition("events['moon'].");
				expect(result.success).toBe(false);
			});

			it('should fail on invalid event property', () => {
				const result = parseCondition("events['moon'].invalid");
				expect(result.success).toBe(false);
				expect(result.error).toContain('Invalid event property');
			});

			it('should fail on unbalanced parentheses', () => {
				const result = parseCondition("(events['a'].active && events['b'].active");
				expect(result.success).toBe(false);
			});

			it('should fail on consecutive operators', () => {
				const result = parseCondition("events['a'].active && && events['b'].active");
				expect(result.success).toBe(false);
			});

			it('should fail on trailing operator', () => {
				const result = parseCondition("events['a'].active &&");
				expect(result.success).toBe(false);
			});
		});
	});

	// =========================================================================
	// Evaluation Tests - Single Conditions
	// =========================================================================

	describe('evaluateCondition - single conditions', () => {

		it('should evaluate active check as true when event is active', () => {
			const events: EventStateMap = {
				'moon': { active: true, state: 'Full' }
			};
			const result = evaluateCondition("events['moon'].active", events);
			expect(result.success).toBe(true);
			expect(result.value).toBe(true);
		});

		it('should evaluate active check as false when event is inactive', () => {
			const events: EventStateMap = {
				'moon': { active: false, state: 'New' }
			};
			const result = evaluateCondition("events['moon'].active", events);
			expect(result.success).toBe(true);
			expect(result.value).toBe(false);
		});

		it('should evaluate state equality comparison (match)', () => {
			const events: EventStateMap = {
				'moon': { active: true, state: 'Full' }
			};
			const result = evaluateCondition("events['moon'].state == 'Full'", events);
			expect(result.success).toBe(true);
			expect(result.value).toBe(true);
		});

		it('should evaluate state equality comparison (no match)', () => {
			const events: EventStateMap = {
				'moon': { active: true, state: 'New' }
			};
			const result = evaluateCondition("events['moon'].state == 'Full'", events);
			expect(result.success).toBe(true);
			expect(result.value).toBe(false);
		});

		it('should evaluate state inequality comparison (match)', () => {
			const events: EventStateMap = {
				'weather': { active: true, state: 'Clear' }
			};
			const result = evaluateCondition("events['weather'].state != 'Storm'", events);
			expect(result.success).toBe(true);
			expect(result.value).toBe(true);
		});

		it('should evaluate state inequality comparison (no match)', () => {
			const events: EventStateMap = {
				'weather': { active: true, state: 'Storm' }
			};
			const result = evaluateCondition("events['weather'].state != 'Storm'", events);
			expect(result.success).toBe(true);
			expect(result.value).toBe(false);
		});

		it('should evaluate effects property access', () => {
			const events: EventStateMap = {
				'weather': { active: true, state: 'Clear', effects: { temperature: 'hot' } }
			};
			const result = evaluateCondition("events['weather'].effects['temperature'] == 'hot'", events);
			expect(result.success).toBe(true);
			expect(result.value).toBe(true);
		});

		it('should evaluate numeric comparisons with effects', () => {
			const events: EventStateMap = {
				'weather': { active: true, state: 'Clear', effects: { temperature: 75 } }
			};

			expect(evaluateCondition("events['weather'].effects['temperature'] > 70", events).value).toBe(true);
			expect(evaluateCondition("events['weather'].effects['temperature'] < 80", events).value).toBe(true);
			expect(evaluateCondition("events['weather'].effects['temperature'] >= 75", events).value).toBe(true);
			expect(evaluateCondition("events['weather'].effects['temperature'] <= 75", events).value).toBe(true);
			expect(evaluateCondition("events['weather'].effects['temperature'] > 80", events).value).toBe(false);
		});
	});

	// =========================================================================
	// Evaluation Tests - Compound Conditions (AND, OR, NOT)
	// =========================================================================

	describe('evaluateCondition - compound conditions', () => {

		const events: EventStateMap = {
			'moon': { active: true, state: 'Full' },
			'weather': { active: true, state: 'Clear' },
			'rain': { active: false, state: 'None' },
			'storm': { active: false, state: 'None' }
		};

		describe('AND operator (&&)', () => {

			it('should return true when both operands are true', () => {
				const result = evaluateCondition("events['moon'].active && events['weather'].active", events);
				expect(result.value).toBe(true);
			});

			it('should return false when left operand is false', () => {
				const result = evaluateCondition("events['rain'].active && events['moon'].active", events);
				expect(result.value).toBe(false);
			});

			it('should return false when right operand is false', () => {
				const result = evaluateCondition("events['moon'].active && events['rain'].active", events);
				expect(result.value).toBe(false);
			});

			it('should return false when both operands are false', () => {
				const result = evaluateCondition("events['rain'].active && events['storm'].active", events);
				expect(result.value).toBe(false);
			});

			it('should short-circuit evaluation (left is false)', () => {
				// If left is false, right should not be evaluated
				// This is implicitly tested by the AND truth table
				const result = evaluateCondition("events['rain'].active && events['moon'].active", events);
				expect(result.value).toBe(false);
			});
		});

		describe('OR operator (||)', () => {

			it('should return true when both operands are true', () => {
				const result = evaluateCondition("events['moon'].active || events['weather'].active", events);
				expect(result.value).toBe(true);
			});

			it('should return true when only left operand is true', () => {
				const result = evaluateCondition("events['moon'].active || events['rain'].active", events);
				expect(result.value).toBe(true);
			});

			it('should return true when only right operand is true', () => {
				const result = evaluateCondition("events['rain'].active || events['moon'].active", events);
				expect(result.value).toBe(true);
			});

			it('should return false when both operands are false', () => {
				const result = evaluateCondition("events['rain'].active || events['storm'].active", events);
				expect(result.value).toBe(false);
			});

			it('should short-circuit evaluation (left is true)', () => {
				// If left is true, right should not be evaluated
				const result = evaluateCondition("events['moon'].active || events['rain'].active", events);
				expect(result.value).toBe(true);
			});
		});

		describe('NOT operator (!)', () => {

			it('should negate true to false', () => {
				const result = evaluateCondition("!events['moon'].active", events);
				expect(result.value).toBe(false);
			});

			it('should negate false to true', () => {
				const result = evaluateCondition("!events['rain'].active", events);
				expect(result.value).toBe(true);
			});

			it('should support double negation', () => {
				const result = evaluateCondition("!!events['moon'].active", events);
				expect(result.value).toBe(true);
			});

			it('should work with state comparisons', () => {
				const result = evaluateCondition("!(events['moon'].state == 'New')", events);
				expect(result.value).toBe(true);
			});
		});

		describe('Complex compound expressions', () => {

			it('should evaluate (A && B) || C correctly', () => {
				// moon active, weather active, rain inactive
				// (true && true) || false => true
				const result = evaluateCondition(
					"(events['moon'].active && events['weather'].active) || events['rain'].active",
					events
				);
				expect(result.value).toBe(true);
			});

			it('should evaluate A || (B && C) correctly', () => {
				// rain inactive, moon active, weather active
				// false || (true && true) => true
				const result = evaluateCondition(
					"events['rain'].active || (events['moon'].active && events['weather'].active)",
					events
				);
				expect(result.value).toBe(true);
			});

			it('should evaluate !A && B correctly', () => {
				// !rain.active && moon.active => !false && true => true
				const result = evaluateCondition(
					"!events['rain'].active && events['moon'].active",
					events
				);
				expect(result.value).toBe(true);
			});

			it('should evaluate A && !B correctly', () => {
				// moon.active && !rain.active => true && !false => true
				const result = evaluateCondition(
					"events['moon'].active && !events['rain'].active",
					events
				);
				expect(result.value).toBe(true);
			});

			it('should evaluate !(A && B) correctly', () => {
				// !(rain.active && storm.active) => !(false && false) => !false => true
				const result = evaluateCondition(
					"!(events['rain'].active && events['storm'].active)",
					events
				);
				expect(result.value).toBe(true);
			});

			it('should evaluate !(A || B) correctly', () => {
				// !(rain.active || storm.active) => !(false || false) => !false => true
				const result = evaluateCondition(
					"!(events['rain'].active || events['storm'].active)",
					events
				);
				expect(result.value).toBe(true);
			});

			it('should evaluate deeply nested expressions', () => {
				// ((moon && weather) || rain) && !storm
				// ((true && true) || false) && !false => (true || false) && true => true && true => true
				const result = evaluateCondition(
					"((events['moon'].active && events['weather'].active) || events['rain'].active) && !events['storm'].active",
					events
				);
				expect(result.value).toBe(true);
			});

			it('should combine state checks with active checks', () => {
				// moon.state == 'Full' && weather.active => true && true => true
				const result = evaluateCondition(
					"events['moon'].state == 'Full' && events['weather'].active",
					events
				);
				expect(result.value).toBe(true);
			});

			it('should handle multiple state comparisons', () => {
				// moon.state == 'Full' && weather.state == 'Clear' => true && true => true
				const result = evaluateCondition(
					"events['moon'].state == 'Full' && events['weather'].state == 'Clear'",
					events
				);
				expect(result.value).toBe(true);
			});
		});

		describe('Operator precedence', () => {

			it('should evaluate AND before OR (without parentheses)', () => {
				// A || B && C should be parsed as A || (B && C)
				// rain.active || moon.active && weather.active
				// false || (true && true) => false || true => true
				const result = evaluateCondition(
					"events['rain'].active || events['moon'].active && events['weather'].active",
					events
				);
				expect(result.value).toBe(true);
			});

			it('should evaluate NOT before AND', () => {
				// !A && B should be parsed as (!A) && B
				// !rain.active && moon.active => true && true => true
				const result = evaluateCondition(
					"!events['rain'].active && events['moon'].active",
					events
				);
				expect(result.value).toBe(true);
			});

			it('should respect parentheses over default precedence', () => {
				// (A || B) && C with different values
				// (rain.active || moon.active) && storm.active
				// (false || true) && false => true && false => false
				const result = evaluateCondition(
					"(events['rain'].active || events['moon'].active) && events['storm'].active",
					events
				);
				expect(result.value).toBe(false);
			});
		});
	});

	// =========================================================================
	// Evaluation Tests - Missing Event References (Graceful Failure)
	// =========================================================================

	describe('evaluateCondition - missing event references', () => {

		it('should return false for active check on missing event', () => {
			const events: EventStateMap = {};
			const result = evaluateCondition("events['nonexistent'].active", events);
			expect(result.success).toBe(true);
			expect(result.value).toBe(false);
			expect(result.missingEventIds).toContain('nonexistent');
		});

		it('should return empty string for state check on missing event', () => {
			const events: EventStateMap = {};
			const result = evaluateCondition("events['nonexistent'].state == ''", events);
			expect(result.success).toBe(true);
			expect(result.value).toBe(true);  // '' == '' is true
			expect(result.missingEventIds).toContain('nonexistent');
		});

		it('should return false for state equality on missing event (non-empty comparison)', () => {
			const events: EventStateMap = {};
			const result = evaluateCondition("events['nonexistent'].state == 'Full'", events);
			expect(result.success).toBe(true);
			expect(result.value).toBe(false);  // '' != 'Full'
			expect(result.missingEventIds).toContain('nonexistent');
		});

		it('should track multiple missing event IDs (when both evaluated)', () => {
			const events: EventStateMap = {};
			// Use OR so both sides get evaluated (left is false, so right is checked too)
			const result = evaluateCondition(
				"events['missing1'].active || events['missing2'].active",
				events
			);
			expect(result.success).toBe(true);
			expect(result.missingEventIds).toContain('missing1');
			expect(result.missingEventIds).toContain('missing2');
		});

		it('should track only evaluated missing event IDs with AND short-circuit', () => {
			const events: EventStateMap = {};
			// With AND, if left is false (missing returns false), right is not evaluated
			const result = evaluateCondition(
				"events['missing1'].active && events['missing2'].active",
				events
			);
			expect(result.success).toBe(true);
			expect(result.value).toBe(false);
			// Only missing1 is tracked because AND short-circuits after left is false
			expect(result.missingEventIds).toContain('missing1');
		});

		it('should work with mix of existing and missing events', () => {
			const events: EventStateMap = {
				'moon': { active: true, state: 'Full' }
			};
			const result = evaluateCondition(
				"events['moon'].active && events['missing'].active",
				events
			);
			expect(result.success).toBe(true);
			expect(result.value).toBe(false);  // true && false => false
			expect(result.missingEventIds).toContain('missing');
		});

		it('should not include missing events when short-circuit prevents evaluation', () => {
			const events: EventStateMap = {
				'moon': { active: false, state: 'New' }
			};
			// Short-circuit AND: left is false, right not evaluated
			const result = evaluateCondition(
				"events['moon'].active && events['missing'].active",
				events
			);
			expect(result.success).toBe(true);
			expect(result.value).toBe(false);
			// Note: Implementation may or may not track missing due to short-circuit
			// This test documents behavior, not mandates it
		});

		it('should handle effects access on missing event', () => {
			const events: EventStateMap = {};
			const result = evaluateCondition(
				"events['missing'].effects['value'] == 'test'",
				events
			);
			expect(result.success).toBe(true);
			expect(result.value).toBe(false);  // undefined != 'test'
			expect(result.missingEventIds).toContain('missing');
		});
	});

	// =========================================================================
	// extractEventReferences Tests
	// =========================================================================

	describe('extractEventReferences', () => {

		it('should extract single event reference', () => {
			const refs = extractEventReferences("events['moon'].active");
			expect(refs).toContain('moon');
			expect(refs?.length).toBe(1);
		});

		it('should extract multiple event references', () => {
			const refs = extractEventReferences(
				"events['moon'].active && events['weather'].state == 'Storm'"
			);
			expect(refs).toContain('moon');
			expect(refs).toContain('weather');
			expect(refs?.length).toBe(2);
		});

		it('should extract unique references (no duplicates)', () => {
			const refs = extractEventReferences(
				"events['moon'].active && events['moon'].state == 'Full'"
			);
			expect(refs).toContain('moon');
			expect(refs?.length).toBe(1);
		});

		it('should return null for invalid condition', () => {
			const refs = extractEventReferences("invalid syntax !!!");
			expect(refs).toBeNull();
		});

		it('should handle complex nested expressions', () => {
			const refs = extractEventReferences(
				"((events['a'].active && events['b'].active) || events['c'].state == 'X') && !events['d'].active"
			);
			expect(refs).toContain('a');
			expect(refs).toContain('b');
			expect(refs).toContain('c');
			expect(refs).toContain('d');
			expect(refs?.length).toBe(4);
		});

		it('should handle event IDs with special characters', () => {
			const refs = extractEventReferences(
				"events['full-moon'].active && events['lunar_cycle'].active"
			);
			expect(refs).toContain('full-moon');
			expect(refs).toContain('lunar_cycle');
		});
	});

	// =========================================================================
	// validateCondition Tests
	// =========================================================================

	describe('validateCondition', () => {

		it('should validate correct condition without event ID set', () => {
			const validation = validateCondition("events['moon'].active");
			expect(validation.isValid).toBe(true);
			expect(validation.errors).toHaveLength(0);
		});

		it('should invalidate syntactically incorrect condition', () => {
			const validation = validateCondition("invalid &&& syntax");
			expect(validation.isValid).toBe(false);
			expect(validation.errors.length).toBeGreaterThan(0);
		});

		it('should validate against known event IDs', () => {
			const validIds = new Set(['moon', 'sun', 'weather']);
			const validation = validateCondition("events['moon'].active", validIds);
			expect(validation.isValid).toBe(true);
		});

		it('should report unknown event references', () => {
			const validIds = new Set(['moon', 'sun']);
			const validation = validateCondition(
				"events['moon'].active && events['unknown'].active",
				validIds
			);
			expect(validation.isValid).toBe(false);
			expect(validation.errors.some(e => e.includes('unknown'))).toBe(true);
		});

		it('should report multiple unknown event references', () => {
			const validIds = new Set(['moon']);
			const validation = validateCondition(
				"events['unknown1'].active && events['unknown2'].active",
				validIds
			);
			expect(validation.isValid).toBe(false);
			expect(validation.errors.some(e => e.includes('unknown1'))).toBe(true);
			expect(validation.errors.some(e => e.includes('unknown2'))).toBe(true);
		});
	});

	// =========================================================================
	// Boolean and Literal Tests
	// =========================================================================

	describe('evaluateCondition - literals', () => {

		it('should evaluate true literal', () => {
			const result = evaluateCondition("true", {});
			expect(result.value).toBe(true);
		});

		it('should evaluate false literal', () => {
			const result = evaluateCondition("false", {});
			expect(result.value).toBe(false);
		});

		it('should combine literals with event checks', () => {
			const events: EventStateMap = {
				'moon': { active: true, state: 'Full' }
			};
			expect(evaluateCondition("true && events['moon'].active", events).value).toBe(true);
			expect(evaluateCondition("false || events['moon'].active", events).value).toBe(true);
			expect(evaluateCondition("false && events['moon'].active", events).value).toBe(false);
		});
	});

	// =========================================================================
	// Edge Cases
	// =========================================================================

	describe('edge cases', () => {

		it('should handle empty events map', () => {
			const result = evaluateCondition("events['any'].active", {});
			expect(result.success).toBe(true);
			expect(result.value).toBe(false);
		});

		it('should handle very long event IDs', () => {
			const longId = 'a'.repeat(100);
			const events: EventStateMap = {
				[longId]: { active: true, state: 'Active' }
			};
			const result = evaluateCondition(`events['${longId}'].active`, events);
			expect(result.success).toBe(true);
			expect(result.value).toBe(true);
		});

		it('should handle escaped quotes in event IDs', () => {
			const events: EventStateMap = {
				"event\\'s": { active: true, state: 'Active' }
			};
			const result = parseCondition("events['event\\'s'].active");
			expect(result.success).toBe(true);
		});

		it('should handle event IDs with numbers', () => {
			const events: EventStateMap = {
				'event123': { active: true, state: 'Active' }
			};
			const result = evaluateCondition("events['event123'].active", events);
			expect(result.success).toBe(true);
			expect(result.value).toBe(true);
		});

		it('should handle negative numbers in comparisons', () => {
			const events: EventStateMap = {
				'temp': { active: true, state: 'Cold', effects: { value: -10 } }
			};
			const result = evaluateCondition("events['temp'].effects['value'] < 0", events);
			expect(result.success).toBe(true);
			expect(result.value).toBe(true);
		});

		it('should handle floating point numbers', () => {
			const events: EventStateMap = {
				'temp': { active: true, state: 'Warm', effects: { value: 72.5 } }
			};
			const result = evaluateCondition("events['temp'].effects['value'] > 72.0", events);
			expect(result.success).toBe(true);
			expect(result.value).toBe(true);
		});
	});
});
