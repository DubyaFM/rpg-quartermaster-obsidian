/**
 * Event Definition Validator
 *
 * Validates event definitions for structural, logical, and dependency correctness.
 * Provides comprehensive error reporting with severity levels (error, warning, info).
 *
 * Validation Coverage:
 * 1. Schema Validation:
 *    - Required fields present and correct types
 *    - Valid event type enum (fixed, interval, chain, conditional)
 *    - Valid ranges for numeric fields
 *
 * 2. Type-Specific Validation:
 *    - Fixed: date specification, duration
 *    - Interval: interval > 0, valid offset
 *    - Chain: states array, weights, seed, duration notation
 *    - Conditional: condition syntax, tier (1 or 2)
 *
 * 3. Dice Notation Validation:
 *    - Chain state durations use valid dice notation
 *    - Parse test to ensure notation is valid
 *
 * 4. Dependency Validation:
 *    - Conditional events reference valid event IDs (lazy warning)
 *    - Condition syntax is parseable
 *
 * 5. Effect Key Validation:
 *    - Effect keys checked against known registry (lazy warning)
 *    - No validation errors if effect key is unknown (graceful degradation)
 */

import {
	AnyEventDefinition,
	EventDefinition,
	FixedDateEvent,
	IntervalEvent,
	ChainEvent,
	ConditionalEvent,
	ChainEventState
} from '../models/eventTypes';
import { validateCondition, extractEventReferences } from '../utils/ConditionParser';
import { parseDuration, DEFAULT_DURATION_UNITS } from '../utils/DurationParser';
import { ISeededRandomizer } from '../interfaces/ISeededRandomizer';

/**
 * Validation severity levels
 */
export type ValidationSeverity = 'error' | 'warning' | 'info';

/**
 * Validation issue
 */
export interface ValidationIssue {
	severity: ValidationSeverity;
	field: string;
	message: string;
	suggestion?: string;
}

/**
 * Validation result
 */
export interface EventValidationResult {
	valid: boolean;  // true only if no errors (warnings/info are ok)
	errors: ValidationIssue[];
	warnings: ValidationIssue[];
	info: ValidationIssue[];
}

/**
 * Event Validation Error
 * Thrown when validation fails critically
 */
export class EventValidationError extends Error {
	constructor(
		public field: string,
		message: string,
		public suggestion?: string
	) {
		super(`Event validation failed: ${field} - ${message}`);
		this.name = 'EventValidationError';
	}
}

/**
 * Known effect keys registry
 * Used for lazy validation of effect keys
 */
export type EffectKeyRegistry = Set<string>;

/**
 * Event Validator
 *
 * Validates event definitions at multiple levels:
 * - Schema validation (structure and types)
 * - Type-specific validation (based on event type)
 * - Dice notation validation (for chain events)
 * - Dependency validation (for conditional events)
 * - Effect key validation (against known registry)
 */
export class EventValidator {
	/**
	 * Validate a complete event definition
	 *
	 * @param event - Event definition to validate
	 * @param validEventIds - Optional set of valid event IDs for dependency checking
	 * @param effectKeyRegistry - Optional registry of known effect keys
	 * @param mockRng - Optional mock RNG for dice notation testing (uses default if not provided)
	 * @returns Validation result with errors, warnings, and info
	 */
	static validate(
		event: Partial<AnyEventDefinition>,
		validEventIds?: Set<string>,
		effectKeyRegistry?: EffectKeyRegistry,
		mockRng?: ISeededRandomizer
	): EventValidationResult {
		const errors: ValidationIssue[] = [];
		const warnings: ValidationIssue[] = [];
		const info: ValidationIssue[] = [];

		// Schema validation
		this.validateSchema(event, errors, warnings, info);

		// Only proceed with type-specific validation if schema is valid
		if (errors.length === 0 && event.type) {
			this.validateTypeSpecific(event as AnyEventDefinition, errors, warnings, info, mockRng);

			// Dependency validation (conditional events only)
			if (event.type === 'conditional') {
				this.validateDependencies(
					event as ConditionalEvent,
					validEventIds,
					errors,
					warnings,
					info
				);
			}

			// Effect key validation (all events)
			if (effectKeyRegistry) {
				this.validateEffectKeys(
					event as AnyEventDefinition,
					effectKeyRegistry,
					errors,
					warnings,
					info
				);
			}
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings,
			info
		};
	}

	/**
	 * Validate and throw if invalid
	 *
	 * @param event - Event definition to validate
	 * @param validEventIds - Optional set of valid event IDs for dependency checking
	 * @param effectKeyRegistry - Optional registry of known effect keys
	 * @param mockRng - Optional mock RNG for dice notation testing
	 * @throws EventValidationError if validation fails
	 */
	static validateOrThrow(
		event: Partial<AnyEventDefinition>,
		validEventIds?: Set<string>,
		effectKeyRegistry?: EffectKeyRegistry,
		mockRng?: ISeededRandomizer
	): void {
		const result = this.validate(event, validEventIds, effectKeyRegistry, mockRng);

		if (!result.valid) {
			const firstError = result.errors[0];
			throw new EventValidationError(
				firstError.field,
				firstError.message,
				firstError.suggestion
			);
		}
	}

	/**
	 * Get validation errors as formatted strings
	 *
	 * @param event - Event definition to validate
	 * @param validEventIds - Optional set of valid event IDs for dependency checking
	 * @param effectKeyRegistry - Optional registry of known effect keys
	 * @param mockRng - Optional mock RNG for dice notation testing
	 * @returns Array of error messages
	 */
	static getValidationErrors(
		event: Partial<AnyEventDefinition>,
		validEventIds?: Set<string>,
		effectKeyRegistry?: EffectKeyRegistry,
		mockRng?: ISeededRandomizer
	): string[] {
		const result = this.validate(event, validEventIds, effectKeyRegistry, mockRng);
		return result.errors.map(err => {
			const msg = `${err.field}: ${err.message}`;
			return err.suggestion ? `${msg} (Suggestion: ${err.suggestion})` : msg;
		});
	}

	// ==========================================================================
	// Schema Validation
	// ==========================================================================

	/**
	 * Validate schema (structure and types)
	 */
	private static validateSchema(
		event: Partial<AnyEventDefinition>,
		errors: ValidationIssue[],
		warnings: ValidationIssue[],
		info: ValidationIssue[]
	): void {
		// Required: id
		if (!event.id) {
			errors.push({
				severity: 'error',
				field: 'id',
				message: 'Event ID is required',
				suggestion: 'Use a unique identifier like "holiday-midwinter", "moon-cycle", etc.'
			});
		} else if (typeof event.id !== 'string' || event.id.trim().length === 0) {
			errors.push({
				severity: 'error',
				field: 'id',
				message: 'Event ID must be a non-empty string',
				suggestion: 'Use lowercase alphanumeric with hyphens (e.g., "my-event-id")'
			});
		}

		// Required: name
		if (!event.name) {
			errors.push({
				severity: 'error',
				field: 'name',
				message: 'Event name is required',
				suggestion: 'Provide a human-readable name (e.g., "Midwinter Festival")'
			});
		} else if (typeof event.name !== 'string' || event.name.trim().length === 0) {
			errors.push({
				severity: 'error',
				field: 'name',
				message: 'Event name must be a non-empty string'
			});
		}

		// Required: type
		if (!event.type) {
			errors.push({
				severity: 'error',
				field: 'type',
				message: 'Event type is required',
				suggestion: 'Use "fixed", "interval", "chain", or "conditional"'
			});
		} else if (!['fixed', 'interval', 'chain', 'conditional'].includes(event.type)) {
			errors.push({
				severity: 'error',
				field: 'type',
				message: `Invalid event type: "${event.type}"`,
				suggestion: 'Use "fixed", "interval", "chain", or "conditional"'
			});
		}

		// Required: priority
		if (event.priority === undefined || event.priority === null) {
			errors.push({
				severity: 'error',
				field: 'priority',
				message: 'Event priority is required',
				suggestion: 'Use a numeric priority (higher = takes precedence, typically 0-100)'
			});
		} else if (typeof event.priority !== 'number') {
			errors.push({
				severity: 'error',
				field: 'priority',
				message: 'Event priority must be a number',
				suggestion: 'Use a numeric priority (higher = takes precedence, typically 0-100)'
			});
		} else if (event.priority < 0) {
			warnings.push({
				severity: 'warning',
				field: 'priority',
				message: 'Event priority is negative',
				suggestion: 'Priority should typically be >= 0'
			});
		} else if (event.priority > 1000) {
			warnings.push({
				severity: 'warning',
				field: 'priority',
				message: 'Event priority is very high (> 1000)',
				suggestion: 'Typical priority range is 0-100'
			});
		}

		// Required: effects
		if (!event.effects) {
			errors.push({
				severity: 'error',
				field: 'effects',
				message: 'Event effects object is required',
				suggestion: 'Provide an effects object (use {} for no effects)'
			});
		} else if (typeof event.effects !== 'object' || Array.isArray(event.effects)) {
			errors.push({
				severity: 'error',
				field: 'effects',
				message: 'Event effects must be an object',
				suggestion: 'Use key-value pairs: { "effectKey": effectValue }'
			});
		} else if (Object.keys(event.effects).length === 0) {
			info.push({
				severity: 'info',
				field: 'effects',
				message: 'Event has no effects defined',
				suggestion: 'Events typically define at least one effect'
			});
		}

		// Optional: description
		if (event.description !== undefined && typeof event.description !== 'string') {
			errors.push({
				severity: 'error',
				field: 'description',
				message: 'Event description must be a string if provided'
			});
		}

		// Optional: locations, factions, seasons, regions, tags (must be arrays)
		for (const field of ['locations', 'factions', 'seasons', 'regions', 'tags'] as const) {
			if (event[field] !== undefined) {
				if (!Array.isArray(event[field])) {
					errors.push({
						severity: 'error',
						field,
						message: `Event ${field} must be an array if provided`
					});
				}
			}
		}
	}

	// ==========================================================================
	// Type-Specific Validation
	// ==========================================================================

	/**
	 * Validate type-specific fields based on event type
	 */
	private static validateTypeSpecific(
		event: AnyEventDefinition,
		errors: ValidationIssue[],
		warnings: ValidationIssue[],
		info: ValidationIssue[],
		mockRng?: ISeededRandomizer
	): void {
		switch (event.type) {
			case 'fixed':
				this.validateFixedDateEvent(event as FixedDateEvent, errors, warnings, info);
				break;
			case 'interval':
				this.validateIntervalEvent(event as IntervalEvent, errors, warnings, info);
				break;
			case 'chain':
				this.validateChainEvent(event as ChainEvent, errors, warnings, info, mockRng);
				break;
			case 'conditional':
				this.validateConditionalEvent(event as ConditionalEvent, errors, warnings, info);
				break;
		}
	}

	/**
	 * Validate fixed date event
	 */
	private static validateFixedDateEvent(
		event: FixedDateEvent,
		errors: ValidationIssue[],
		warnings: ValidationIssue[],
		info: ValidationIssue[]
	): void {
		// Required: date object
		if (!event.date) {
			errors.push({
				severity: 'error',
				field: 'date',
				message: 'Fixed date event requires a date specification',
				suggestion: 'Provide { month, day } or { intercalaryName }'
			});
			return;
		}

		if (typeof event.date !== 'object') {
			errors.push({
				severity: 'error',
				field: 'date',
				message: 'Date specification must be an object'
			});
			return;
		}

		// Must have either (month + day) or intercalaryName
		const hasStandardDate = event.date.month !== undefined && event.date.day !== undefined;
		const hasIntercalary = event.date.intercalaryName !== undefined;

		if (!hasStandardDate && !hasIntercalary) {
			errors.push({
				severity: 'error',
				field: 'date',
				message: 'Date must specify either (month + day) or intercalaryName',
				suggestion: 'Use { month: 0, day: 1 } for standard dates or { intercalaryName: "Midwinter" } for intercalary days'
			});
		}

		if (hasStandardDate && hasIntercalary) {
			warnings.push({
				severity: 'warning',
				field: 'date',
				message: 'Date specifies both standard date and intercalaryName',
				suggestion: 'Use only one: either (month + day) or intercalaryName'
			});
		}

		// Validate standard date fields
		if (hasStandardDate) {
			if (typeof event.date.month !== 'number' || !Number.isInteger(event.date.month) || event.date.month < 0) {
				errors.push({
					severity: 'error',
					field: 'date.month',
					message: 'Month must be a non-negative integer (0-indexed)',
					suggestion: 'Use 0 for first month, 1 for second month, etc.'
				});
			}

			if (typeof event.date.day !== 'number' || !Number.isInteger(event.date.day) || event.date.day < 1) {
				errors.push({
					severity: 'error',
					field: 'date.day',
					message: 'Day must be a positive integer (1-indexed)',
					suggestion: 'Use 1 for first day of month'
				});
			}
		}

		// Validate intercalary name
		if (hasIntercalary) {
			if (typeof event.date.intercalaryName !== 'string' || event.date.intercalaryName.trim().length === 0) {
				errors.push({
					severity: 'error',
					field: 'date.intercalaryName',
					message: 'Intercalary name must be a non-empty string',
					suggestion: 'Use the exact name of the intercalary day (e.g., "Midwinter")'
				});
			}
		}

		// Optional: year (for one-time events)
		if (event.date.year !== undefined) {
			if (typeof event.date.year !== 'number' || !Number.isInteger(event.date.year)) {
				errors.push({
					severity: 'error',
					field: 'date.year',
					message: 'Year must be an integer if provided',
					suggestion: 'Omit year for recurring annual events'
				});
			} else {
				info.push({
					severity: 'info',
					field: 'date.year',
					message: `One-time event for year ${event.date.year}`,
					suggestion: 'Event will only trigger in this specific year'
				});
			}
		}

		// Optional: duration
		if (event.duration !== undefined) {
			if (typeof event.duration !== 'number' || !Number.isInteger(event.duration) || event.duration < 1) {
				errors.push({
					severity: 'error',
					field: 'duration',
					message: 'Duration must be a positive integer if provided',
					suggestion: 'Duration in days (default: 1)'
				});
			}
		}
	}

	/**
	 * Validate interval event
	 */
	private static validateIntervalEvent(
		event: IntervalEvent,
		errors: ValidationIssue[],
		warnings: ValidationIssue[],
		info: ValidationIssue[]
	): void {
		// Required: interval
		if (event.interval === undefined || event.interval === null) {
			errors.push({
				severity: 'error',
				field: 'interval',
				message: 'Interval event requires an interval value',
				suggestion: 'Specify interval in days (or minutes if useMinutes: true)'
			});
		} else if (typeof event.interval !== 'number' || !Number.isInteger(event.interval) || event.interval < 1) {
			errors.push({
				severity: 'error',
				field: 'interval',
				message: 'Interval must be a positive integer',
				suggestion: 'Use interval like 7 for "every 7 days"'
			});
		}

		// Optional: offset
		if (event.offset !== undefined) {
			if (typeof event.offset !== 'number' || !Number.isInteger(event.offset)) {
				errors.push({
					severity: 'error',
					field: 'offset',
					message: 'Offset must be an integer if provided',
					suggestion: 'Use offset for phase alignment (can be negative)'
				});
			}
		}

		// Optional: duration
		if (event.duration !== undefined) {
			if (typeof event.duration !== 'number' || !Number.isInteger(event.duration) || event.duration < 1) {
				errors.push({
					severity: 'error',
					field: 'duration',
					message: 'Duration must be a positive integer if provided',
					suggestion: 'Duration in days (default: 1)'
				});
			}
		}

		// Optional: useMinutes
		if (event.useMinutes !== undefined && typeof event.useMinutes !== 'boolean') {
			errors.push({
				severity: 'error',
				field: 'useMinutes',
				message: 'useMinutes must be a boolean if provided',
				suggestion: 'Use true for sub-day intervals, false for day-based intervals'
			});
		}

		// Info: suggest sub-day for short intervals
		if (event.interval && event.interval < 1440 && !event.useMinutes) {
			info.push({
				severity: 'info',
				field: 'interval',
				message: 'Short interval detected - consider using useMinutes: true',
				suggestion: 'For intervals < 1 day (1440 minutes), use minute-based intervals'
			});
		}
	}

	/**
	 * Validate chain event
	 */
	private static validateChainEvent(
		event: ChainEvent,
		errors: ValidationIssue[],
		warnings: ValidationIssue[],
		info: ValidationIssue[],
		mockRng?: ISeededRandomizer
	): void {
		// Required: seed
		if (event.seed === undefined || event.seed === null) {
			errors.push({
				severity: 'error',
				field: 'seed',
				message: 'Chain event requires a seed for deterministic RNG',
				suggestion: 'Use a numeric seed (e.g., 12345)'
			});
		} else if (typeof event.seed !== 'number') {
			errors.push({
				severity: 'error',
				field: 'seed',
				message: 'Seed must be a number'
			});
		}

		// Required: states array
		if (!event.states) {
			errors.push({
				severity: 'error',
				field: 'states',
				message: 'Chain event requires a states array',
				suggestion: 'Provide at least one state definition'
			});
			return;
		}

		if (!Array.isArray(event.states)) {
			errors.push({
				severity: 'error',
				field: 'states',
				message: 'States must be an array'
			});
			return;
		}

		if (event.states.length === 0) {
			errors.push({
				severity: 'error',
				field: 'states',
				message: 'Chain event must have at least one state',
				suggestion: 'Add at least one state with name, weight, duration, and effects'
			});
			return;
		}

		// Validate each state
		const stateNames = new Set<string>();
		for (let i = 0; i < event.states.length; i++) {
			this.validateChainState(event.states[i], i, stateNames, errors, warnings, info, mockRng);
		}

		// Optional: initialState
		if (event.initialState !== undefined) {
			if (typeof event.initialState !== 'string' || event.initialState.trim().length === 0) {
				errors.push({
					severity: 'error',
					field: 'initialState',
					message: 'Initial state must be a non-empty string if provided'
				});
			} else if (!stateNames.has(event.initialState)) {
				errors.push({
					severity: 'error',
					field: 'initialState',
					message: `Initial state "${event.initialState}" does not match any defined state`,
					suggestion: `Use one of: ${Array.from(stateNames).join(', ')}`
				});
			}
		}
	}

	/**
	 * Validate a single chain event state
	 */
	private static validateChainState(
		state: any,
		index: number,
		stateNames: Set<string>,
		errors: ValidationIssue[],
		warnings: ValidationIssue[],
		info: ValidationIssue[],
		mockRng?: ISeededRandomizer
	): void {
		if (!state || typeof state !== 'object') {
			errors.push({
				severity: 'error',
				field: `states[${index}]`,
				message: 'State must be an object'
			});
			return;
		}

		// Required: name
		if (!state.name || typeof state.name !== 'string' || state.name.trim().length === 0) {
			errors.push({
				severity: 'error',
				field: `states[${index}].name`,
				message: 'State name is required and must be a non-empty string'
			});
		} else {
			// Check for duplicate state names
			if (stateNames.has(state.name)) {
				errors.push({
					severity: 'error',
					field: `states[${index}].name`,
					message: `Duplicate state name: "${state.name}"`,
					suggestion: 'Each state must have a unique name'
				});
			}
			stateNames.add(state.name);
		}

		// Required: weight
		if (state.weight === undefined || state.weight === null) {
			errors.push({
				severity: 'error',
				field: `states[${index}].weight`,
				message: 'State weight is required',
				suggestion: 'Use a positive number (higher = more likely)'
			});
		} else if (typeof state.weight !== 'number' || state.weight < 0) {
			errors.push({
				severity: 'error',
				field: `states[${index}].weight`,
				message: 'State weight must be a non-negative number',
				suggestion: 'Use weight >= 0 (0 = never selected unless only option)'
			});
		}

		// Required: duration (dice notation string)
		if (!state.duration) {
			errors.push({
				severity: 'error',
				field: `states[${index}].duration`,
				message: 'State duration is required',
				suggestion: 'Use dice notation like "2d6 days", "1 week", etc.'
			});
		} else if (typeof state.duration !== 'string') {
			errors.push({
				severity: 'error',
				field: `states[${index}].duration`,
				message: 'State duration must be a string',
				suggestion: 'Use dice notation like "2d6 days", "1 week", etc.'
			});
		} else {
			// Validate dice notation by attempting to parse
			this.validateDiceNotation(state.duration, `states[${index}].duration`, errors, warnings, mockRng);
		}

		// Required: effects
		if (!state.effects) {
			errors.push({
				severity: 'error',
				field: `states[${index}].effects`,
				message: 'State effects object is required',
				suggestion: 'Provide an effects object (use {} for no effects)'
			});
		} else if (typeof state.effects !== 'object' || Array.isArray(state.effects)) {
			errors.push({
				severity: 'error',
				field: `states[${index}].effects`,
				message: 'State effects must be an object'
			});
		}

		// Optional: description
		if (state.description !== undefined && typeof state.description !== 'string') {
			errors.push({
				severity: 'error',
				field: `states[${index}].description`,
				message: 'State description must be a string if provided'
			});
		}
	}

	/**
	 * Validate conditional event
	 */
	private static validateConditionalEvent(
		event: ConditionalEvent,
		errors: ValidationIssue[],
		warnings: ValidationIssue[],
		info: ValidationIssue[]
	): void {
		// Required: condition
		if (!event.condition) {
			errors.push({
				severity: 'error',
				field: 'condition',
				message: 'Conditional event requires a condition expression',
				suggestion: 'Use syntax like: events[\'eventId\'].active || events[\'otherId\'].state == \'Full\''
			});
		} else if (typeof event.condition !== 'string' || event.condition.trim().length === 0) {
			errors.push({
				severity: 'error',
				field: 'condition',
				message: 'Condition must be a non-empty string'
			});
		} else {
			// Validate condition syntax
			this.validateConditionSyntax(event.condition, errors, warnings, info);
		}

		// Required: tier
		if (event.tier === undefined || event.tier === null) {
			errors.push({
				severity: 'error',
				field: 'tier',
				message: 'Conditional event requires a tier (1 or 2)',
				suggestion: 'Use tier 1 for conditions referencing fixed/interval/chain events, tier 2 for conditions referencing other conditionals'
			});
		} else if (event.tier !== 1 && event.tier !== 2) {
			errors.push({
				severity: 'error',
				field: 'tier',
				message: `Invalid tier: ${event.tier}`,
				suggestion: 'Tier must be 1 or 2'
			});
		}

		// Optional: duration
		if (event.duration !== undefined) {
			if (typeof event.duration !== 'number' || !Number.isInteger(event.duration) || event.duration < 1) {
				errors.push({
					severity: 'error',
					field: 'duration',
					message: 'Duration must be a positive integer if provided',
					suggestion: 'Duration in days (default: 1)'
				});
			}
		}
	}

	// ==========================================================================
	// Dice Notation Validation
	// ==========================================================================

	/**
	 * Validate dice notation by attempting to parse
	 */
	private static validateDiceNotation(
		notation: string,
		field: string,
		errors: ValidationIssue[],
		warnings: ValidationIssue[],
		mockRng?: ISeededRandomizer
	): void {
		try {
			// Attempt to parse with a mock RNG (if not provided, use a simple mock)
			const rng = mockRng || {
				randomInt: (min: number, max: number) => Math.floor((min + max) / 2),
				randomFloat: () => 0.5,
				rollDice: (notation: string) => {
					// Simple mock dice roller for validation
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
			} as ISeededRandomizer;

			parseDuration(notation, rng, DEFAULT_DURATION_UNITS);
		} catch (error) {
			errors.push({
				severity: 'error',
				field,
				message: `Invalid dice notation: ${error instanceof Error ? error.message : String(error)}`,
				suggestion: 'Use formats like "2d6 days", "1d4 weeks", "3 days + 1d6 hours"'
			});
		}
	}

	// ==========================================================================
	// Condition Syntax Validation
	// ==========================================================================

	/**
	 * Validate condition syntax
	 */
	private static validateConditionSyntax(
		condition: string,
		errors: ValidationIssue[],
		warnings: ValidationIssue[],
		info: ValidationIssue[]
	): void {
		// Use ConditionParser to validate syntax
		const validation = validateCondition(condition);

		if (!validation.isValid) {
			for (const error of validation.errors) {
				errors.push({
					severity: 'error',
					field: 'condition',
					message: error,
					suggestion: 'Check condition syntax. Use: events[\'id\'].active, events[\'id\'].state == \'value\''
				});
			}
		}
	}

	// ==========================================================================
	// Dependency Validation
	// ==========================================================================

	/**
	 * Validate dependencies (conditional events only)
	 * Lazy validation - logs warnings for missing references but doesn't block
	 */
	private static validateDependencies(
		event: ConditionalEvent,
		validEventIds: Set<string> | undefined,
		errors: ValidationIssue[],
		warnings: ValidationIssue[],
		info: ValidationIssue[]
	): void {
		if (!validEventIds) {
			// No registry provided - skip dependency validation
			return;
		}

		// Extract event references from condition
		const refs = extractEventReferences(event.condition);
		if (!refs) {
			// Could not parse condition (already caught by syntax validation)
			return;
		}

		// Check each reference
		for (const refId of refs) {
			if (!validEventIds.has(refId)) {
				warnings.push({
					severity: 'warning',
					field: 'condition',
					message: `Condition references unknown event: "${refId}"`,
					suggestion: 'Ensure event ID exists or will be loaded before this event'
				});
			}
		}
	}

	// ==========================================================================
	// Effect Key Validation
	// ==========================================================================

	/**
	 * Validate effect keys against known registry
	 * Lazy validation - logs warnings for unknown keys but doesn't block
	 */
	private static validateEffectKeys(
		event: AnyEventDefinition,
		effectKeyRegistry: EffectKeyRegistry,
		errors: ValidationIssue[],
		warnings: ValidationIssue[],
		info: ValidationIssue[]
	): void {
		// Check main event effects
		if (event.effects && typeof event.effects === 'object') {
			for (const key of Object.keys(event.effects)) {
				if (!effectKeyRegistry.has(key)) {
					warnings.push({
						severity: 'warning',
						field: 'effects',
						message: `Unknown effect key: "${key}"`,
						suggestion: 'Effect key not found in registry - may be custom or not yet implemented'
					});
				}
			}
		}

		// Check chain state effects
		if (event.type === 'chain') {
			const chainEvent = event as ChainEvent;
			if (chainEvent.states) {
				for (let i = 0; i < chainEvent.states.length; i++) {
					const state = chainEvent.states[i];
					if (state.effects && typeof state.effects === 'object') {
						for (const key of Object.keys(state.effects)) {
							if (!effectKeyRegistry.has(key)) {
								warnings.push({
									severity: 'warning',
									field: `states[${i}].effects`,
									message: `Unknown effect key: "${key}"`,
									suggestion: 'Effect key not found in registry - may be custom or not yet implemented'
								});
							}
						}
					}
				}
			}
		}
	}
}
