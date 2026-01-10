/**
 * Condition Parser for Type D Conditional Events
 *
 * Parses and evaluates condition expressions for conditional events.
 * Uses a secure hand-written parser - NO eval() for security.
 *
 * Supported syntax:
 * - Event references: events['eventId'].active, events['eventId'].state
 * - Comparisons: ==, !=, <, >, <=, >=
 * - Logical operators: &&, ||, !
 * - Parentheses for grouping
 * - String literals: 'value'
 * - Boolean literals: true, false
 *
 * Examples:
 *   events['moon'].state == 'Full'
 *   events['weather'].active && events['moon'].state == 'Full'
 *   !events['rain'].active || events['temperature'].state != 'Cold'
 *   (events['a'].active && events['b'].active) || events['c'].active
 */

/**
 * Event state information available for condition evaluation
 */
export interface EventStateInfo {
	/** Whether the event is currently active */
	active: boolean;
	/** Current state name (for chain events) or event name (for others) */
	state: string;
	/** Event effects (optional, for advanced conditions) */
	effects?: Record<string, unknown>;
}

/**
 * Map of event IDs to their current state information
 */
export type EventStateMap = Record<string, EventStateInfo>;

/**
 * Result of parsing a condition
 */
export interface ParseResult {
	/** Whether parsing was successful */
	success: boolean;
	/** Error message if parsing failed */
	error?: string;
	/** Parsed AST node (if successful) */
	ast?: ASTNode;
}

/**
 * Result of evaluating a condition
 */
export interface EvaluationResult {
	/** Whether evaluation was successful */
	success: boolean;
	/** The evaluated boolean value (if successful) */
	value: boolean;
	/** Error message if evaluation failed */
	error?: string;
	/** Missing event IDs referenced in the condition */
	missingEventIds?: string[];
}

// =============================================================================
// AST Node Types
// =============================================================================

type ASTNodeType =
	| 'BooleanLiteral'
	| 'StringLiteral'
	| 'NumberLiteral'
	| 'EventReference'
	| 'BinaryOp'
	| 'UnaryOp'
	| 'Comparison';

interface BaseNode {
	type: ASTNodeType;
}

interface BooleanLiteralNode extends BaseNode {
	type: 'BooleanLiteral';
	value: boolean;
}

interface StringLiteralNode extends BaseNode {
	type: 'StringLiteral';
	value: string;
}

interface NumberLiteralNode extends BaseNode {
	type: 'NumberLiteral';
	value: number;
}

interface EventReferenceNode extends BaseNode {
	type: 'EventReference';
	eventId: string;
	property: 'active' | 'state' | 'effects';
	effectKey?: string; // For effects['key'] access
}

interface BinaryOpNode extends BaseNode {
	type: 'BinaryOp';
	operator: '&&' | '||';
	left: ASTNode;
	right: ASTNode;
}

interface UnaryOpNode extends BaseNode {
	type: 'UnaryOp';
	operator: '!';
	operand: ASTNode;
}

interface ComparisonNode extends BaseNode {
	type: 'Comparison';
	operator: '==' | '!=' | '<' | '>' | '<=' | '>=';
	left: ASTNode;
	right: ASTNode;
}

type ASTNode =
	| BooleanLiteralNode
	| StringLiteralNode
	| NumberLiteralNode
	| EventReferenceNode
	| BinaryOpNode
	| UnaryOpNode
	| ComparisonNode;

// =============================================================================
// Tokenizer
// =============================================================================

type TokenType =
	| 'EVENTS'
	| 'LBRACKET'
	| 'RBRACKET'
	| 'STRING'
	| 'DOT'
	| 'IDENTIFIER'
	| 'AND'
	| 'OR'
	| 'NOT'
	| 'EQ'
	| 'NEQ'
	| 'LT'
	| 'GT'
	| 'LTE'
	| 'GTE'
	| 'LPAREN'
	| 'RPAREN'
	| 'TRUE'
	| 'FALSE'
	| 'NUMBER'
	| 'EOF';

interface Token {
	type: TokenType;
	value: string;
	position: number;
}

/**
 * Tokenizes a condition string into tokens
 */
function tokenize(input: string): Token[] {
	const tokens: Token[] = [];
	let pos = 0;

	while (pos < input.length) {
		// Skip whitespace
		if (/\s/.test(input[pos])) {
			pos++;
			continue;
		}

		// Check for 'events' keyword
		if (input.slice(pos, pos + 6) === 'events') {
			tokens.push({ type: 'EVENTS', value: 'events', position: pos });
			pos += 6;
			continue;
		}

		// Check for 'true' keyword
		if (input.slice(pos, pos + 4) === 'true') {
			tokens.push({ type: 'TRUE', value: 'true', position: pos });
			pos += 4;
			continue;
		}

		// Check for 'false' keyword
		if (input.slice(pos, pos + 5) === 'false') {
			tokens.push({ type: 'FALSE', value: 'false', position: pos });
			pos += 5;
			continue;
		}

		// Check for operators (two-character first)
		if (input.slice(pos, pos + 2) === '&&') {
			tokens.push({ type: 'AND', value: '&&', position: pos });
			pos += 2;
			continue;
		}

		if (input.slice(pos, pos + 2) === '||') {
			tokens.push({ type: 'OR', value: '||', position: pos });
			pos += 2;
			continue;
		}

		if (input.slice(pos, pos + 2) === '==') {
			tokens.push({ type: 'EQ', value: '==', position: pos });
			pos += 2;
			continue;
		}

		if (input.slice(pos, pos + 2) === '!=') {
			tokens.push({ type: 'NEQ', value: '!=', position: pos });
			pos += 2;
			continue;
		}

		if (input.slice(pos, pos + 2) === '<=') {
			tokens.push({ type: 'LTE', value: '<=', position: pos });
			pos += 2;
			continue;
		}

		if (input.slice(pos, pos + 2) === '>=') {
			tokens.push({ type: 'GTE', value: '>=', position: pos });
			pos += 2;
			continue;
		}

		// Single-character operators
		if (input[pos] === '<') {
			tokens.push({ type: 'LT', value: '<', position: pos });
			pos++;
			continue;
		}

		if (input[pos] === '>') {
			tokens.push({ type: 'GT', value: '>', position: pos });
			pos++;
			continue;
		}

		if (input[pos] === '!') {
			tokens.push({ type: 'NOT', value: '!', position: pos });
			pos++;
			continue;
		}

		if (input[pos] === '[') {
			tokens.push({ type: 'LBRACKET', value: '[', position: pos });
			pos++;
			continue;
		}

		if (input[pos] === ']') {
			tokens.push({ type: 'RBRACKET', value: ']', position: pos });
			pos++;
			continue;
		}

		if (input[pos] === '.') {
			tokens.push({ type: 'DOT', value: '.', position: pos });
			pos++;
			continue;
		}

		if (input[pos] === '(') {
			tokens.push({ type: 'LPAREN', value: '(', position: pos });
			pos++;
			continue;
		}

		if (input[pos] === ')') {
			tokens.push({ type: 'RPAREN', value: ')', position: pos });
			pos++;
			continue;
		}

		// String literal (single quotes)
		if (input[pos] === "'") {
			const start = pos;
			pos++; // Skip opening quote
			let value = '';
			while (pos < input.length && input[pos] !== "'") {
				// Handle escape sequences
				if (input[pos] === '\\' && pos + 1 < input.length) {
					pos++;
					if (input[pos] === "'") {
						value += "'";
					} else if (input[pos] === '\\') {
						value += '\\';
					} else {
						value += '\\' + input[pos];
					}
				} else {
					value += input[pos];
				}
				pos++;
			}
			if (pos >= input.length) {
				throw new Error(`Unterminated string literal at position ${start}`);
			}
			pos++; // Skip closing quote
			tokens.push({ type: 'STRING', value, position: start });
			continue;
		}

		// Number literal
		if (/\d/.test(input[pos]) || (input[pos] === '-' && /\d/.test(input[pos + 1]))) {
			const start = pos;
			let value = '';
			if (input[pos] === '-') {
				value += '-';
				pos++;
			}
			while (pos < input.length && /[\d.]/.test(input[pos])) {
				value += input[pos];
				pos++;
			}
			tokens.push({ type: 'NUMBER', value, position: start });
			continue;
		}

		// Identifier (property names like 'active', 'state', 'effects')
		if (/[a-zA-Z_]/.test(input[pos])) {
			const start = pos;
			let value = '';
			while (pos < input.length && /[a-zA-Z0-9_]/.test(input[pos])) {
				value += input[pos];
				pos++;
			}
			tokens.push({ type: 'IDENTIFIER', value, position: start });
			continue;
		}

		throw new Error(`Unexpected character '${input[pos]}' at position ${pos}`);
	}

	tokens.push({ type: 'EOF', value: '', position: pos });
	return tokens;
}

// =============================================================================
// Parser
// =============================================================================

/**
 * Parser class for condition expressions
 * Uses recursive descent parsing
 */
class Parser {
	private tokens: Token[];
	private pos: number = 0;

	constructor(tokens: Token[]) {
		this.tokens = tokens;
	}

	/**
	 * Parse the token stream into an AST
	 */
	parse(): ASTNode {
		const result = this.parseOrExpression();
		if (this.current().type !== 'EOF') {
			throw new Error(
				`Unexpected token '${this.current().value}' at position ${this.current().position}`
			);
		}
		return result;
	}

	private current(): Token {
		return this.tokens[this.pos];
	}

	private advance(): Token {
		const token = this.current();
		this.pos++;
		return token;
	}

	private expect(type: TokenType): Token {
		const token = this.current();
		if (token.type !== type) {
			throw new Error(
				`Expected ${type} but got ${token.type} at position ${token.position}`
			);
		}
		return this.advance();
	}

	/**
	 * Parse OR expression (lowest precedence)
	 * OrExpr := AndExpr ('||' AndExpr)*
	 */
	private parseOrExpression(): ASTNode {
		let left = this.parseAndExpression();

		while (this.current().type === 'OR') {
			this.advance();
			const right = this.parseAndExpression();
			left = { type: 'BinaryOp', operator: '||', left, right };
		}

		return left;
	}

	/**
	 * Parse AND expression
	 * AndExpr := ComparisonExpr ('&&' ComparisonExpr)*
	 */
	private parseAndExpression(): ASTNode {
		let left = this.parseComparisonExpression();

		while (this.current().type === 'AND') {
			this.advance();
			const right = this.parseComparisonExpression();
			left = { type: 'BinaryOp', operator: '&&', left, right };
		}

		return left;
	}

	/**
	 * Parse comparison expression
	 * CompExpr := UnaryExpr (('==' | '!=' | '<' | '>' | '<=' | '>=') UnaryExpr)?
	 */
	private parseComparisonExpression(): ASTNode {
		const left = this.parseUnaryExpression();

		const compOps: TokenType[] = ['EQ', 'NEQ', 'LT', 'GT', 'LTE', 'GTE'];
		if (compOps.includes(this.current().type)) {
			const opToken = this.advance();
			const operator = this.tokenTypeToOperator(opToken.type);
			const right = this.parseUnaryExpression();
			return { type: 'Comparison', operator, left, right };
		}

		return left;
	}

	private tokenTypeToOperator(type: TokenType): '==' | '!=' | '<' | '>' | '<=' | '>=' {
		const map: Record<string, '==' | '!=' | '<' | '>' | '<=' | '>='> = {
			EQ: '==',
			NEQ: '!=',
			LT: '<',
			GT: '>',
			LTE: '<=',
			GTE: '>='
		};
		return map[type];
	}

	/**
	 * Parse unary expression
	 * UnaryExpr := '!' UnaryExpr | PrimaryExpr
	 */
	private parseUnaryExpression(): ASTNode {
		if (this.current().type === 'NOT') {
			this.advance();
			const operand = this.parseUnaryExpression();
			return { type: 'UnaryOp', operator: '!', operand };
		}

		return this.parsePrimaryExpression();
	}

	/**
	 * Parse primary expression
	 * PrimaryExpr := EventRef | BooleanLiteral | StringLiteral | NumberLiteral | '(' OrExpr ')'
	 */
	private parsePrimaryExpression(): ASTNode {
		const token = this.current();

		// Parenthesized expression
		if (token.type === 'LPAREN') {
			this.advance();
			const expr = this.parseOrExpression();
			this.expect('RPAREN');
			return expr;
		}

		// Boolean literal
		if (token.type === 'TRUE') {
			this.advance();
			return { type: 'BooleanLiteral', value: true };
		}

		if (token.type === 'FALSE') {
			this.advance();
			return { type: 'BooleanLiteral', value: false };
		}

		// String literal
		if (token.type === 'STRING') {
			this.advance();
			return { type: 'StringLiteral', value: token.value };
		}

		// Number literal
		if (token.type === 'NUMBER') {
			this.advance();
			return { type: 'NumberLiteral', value: parseFloat(token.value) };
		}

		// Event reference: events['id'].property
		if (token.type === 'EVENTS') {
			return this.parseEventReference();
		}

		throw new Error(
			`Unexpected token '${token.value}' at position ${token.position}. Expected expression.`
		);
	}

	/**
	 * Parse event reference
	 * EventRef := 'events' '[' STRING ']' '.' IDENTIFIER
	 */
	private parseEventReference(): EventReferenceNode {
		this.expect('EVENTS');
		this.expect('LBRACKET');
		const idToken = this.expect('STRING');
		const eventId = idToken.value;
		this.expect('RBRACKET');
		this.expect('DOT');
		const propToken = this.expect('IDENTIFIER');
		const property = propToken.value;

		if (property !== 'active' && property !== 'state' && property !== 'effects') {
			throw new Error(
				`Invalid event property '${property}' at position ${propToken.position}. Expected 'active', 'state', or 'effects'.`
			);
		}

		// Handle effects['key'] access
		if (property === 'effects' && this.current().type === 'LBRACKET') {
			this.advance();
			const keyToken = this.expect('STRING');
			this.expect('RBRACKET');
			return {
				type: 'EventReference',
				eventId,
				property: 'effects',
				effectKey: keyToken.value
			};
		}

		return { type: 'EventReference', eventId, property: property as 'active' | 'state' | 'effects' };
	}
}

// =============================================================================
// Evaluator
// =============================================================================

/**
 * Evaluation context containing event states and tracking information
 */
interface EvalContext {
	events: EventStateMap;
	missingEventIds: Set<string>;
}

/**
 * Evaluate an AST node to a value
 */
function evaluateNode(node: ASTNode, ctx: EvalContext): unknown {
	switch (node.type) {
		case 'BooleanLiteral':
			return node.value;

		case 'StringLiteral':
			return node.value;

		case 'NumberLiteral':
			return node.value;

		case 'EventReference':
			return evaluateEventReference(node, ctx);

		case 'BinaryOp':
			return evaluateBinaryOp(node, ctx);

		case 'UnaryOp':
			return evaluateUnaryOp(node, ctx);

		case 'Comparison':
			return evaluateComparison(node, ctx);

		default:
			throw new Error(`Unknown AST node type: ${(node as BaseNode).type}`);
	}
}

/**
 * Evaluate an event reference
 */
function evaluateEventReference(node: EventReferenceNode, ctx: EvalContext): unknown {
	const eventState = ctx.events[node.eventId];

	if (!eventState) {
		// Event is missing - track it and return false for active, '' for state
		ctx.missingEventIds.add(node.eventId);

		if (node.property === 'active') {
			return false;
		} else if (node.property === 'state') {
			return '';
		} else if (node.property === 'effects') {
			return undefined;
		}
	}

	if (node.property === 'active') {
		return eventState.active;
	} else if (node.property === 'state') {
		return eventState.state;
	} else if (node.property === 'effects') {
		if (node.effectKey && eventState.effects) {
			return eventState.effects[node.effectKey];
		}
		return eventState.effects;
	}

	return undefined;
}

/**
 * Evaluate a binary operation (&&, ||)
 */
function evaluateBinaryOp(node: BinaryOpNode, ctx: EvalContext): boolean {
	if (node.operator === '&&') {
		// Short-circuit AND
		const left = evaluateNode(node.left, ctx);
		if (!left) return false;
		const right = evaluateNode(node.right, ctx);
		return !!right;
	} else if (node.operator === '||') {
		// Short-circuit OR
		const left = evaluateNode(node.left, ctx);
		if (left) return true;
		const right = evaluateNode(node.right, ctx);
		return !!right;
	}

	throw new Error(`Unknown binary operator: ${node.operator}`);
}

/**
 * Evaluate a unary operation (!)
 */
function evaluateUnaryOp(node: UnaryOpNode, ctx: EvalContext): boolean {
	const operand = evaluateNode(node.operand, ctx);
	return !operand;
}

/**
 * Evaluate a comparison operation
 */
function evaluateComparison(node: ComparisonNode, ctx: EvalContext): boolean {
	const left = evaluateNode(node.left, ctx);
	const right = evaluateNode(node.right, ctx);

	switch (node.operator) {
		case '==':
			return left === right;
		case '!=':
			return left !== right;
		case '<':
			return (left as number) < (right as number);
		case '>':
			return (left as number) > (right as number);
		case '<=':
			return (left as number) <= (right as number);
		case '>=':
			return (left as number) >= (right as number);
		default:
			throw new Error(`Unknown comparison operator: ${node.operator}`);
	}
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Parse a condition string into an AST
 *
 * @param condition - The condition expression to parse
 * @returns Parse result with success status and AST or error
 */
export function parseCondition(condition: string): ParseResult {
	try {
		const tokens = tokenize(condition);
		const parser = new Parser(tokens);
		const ast = parser.parse();
		return { success: true, ast };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error)
		};
	}
}

/**
 * Evaluate a condition expression against event state
 *
 * This is the primary entry point for evaluating conditions.
 * It handles parsing and evaluation in one step.
 *
 * @param condition - The condition expression to evaluate
 * @param events - Map of event IDs to their current state
 * @returns Evaluation result with boolean value or error
 *
 * @example
 * const events = {
 *   'moon': { active: true, state: 'Full' },
 *   'weather': { active: true, state: 'Clear' }
 * };
 *
 * evaluateCondition("events['moon'].state == 'Full'", events);
 * // Returns: { success: true, value: true }
 *
 * evaluateCondition("events['moon'].active && events['weather'].state == 'Storm'", events);
 * // Returns: { success: true, value: false }
 */
export function evaluateCondition(condition: string, events: EventStateMap): EvaluationResult {
	// Parse the condition
	const parseResult = parseCondition(condition);
	if (!parseResult.success || !parseResult.ast) {
		return {
			success: false,
			value: false,
			error: parseResult.error || 'Parse failed without error message'
		};
	}

	// Evaluate the AST
	try {
		const ctx: EvalContext = {
			events,
			missingEventIds: new Set()
		};

		const value = evaluateNode(parseResult.ast, ctx);
		const result: EvaluationResult = {
			success: true,
			value: !!value
		};

		if (ctx.missingEventIds.size > 0) {
			result.missingEventIds = Array.from(ctx.missingEventIds);
		}

		return result;
	} catch (error) {
		return {
			success: false,
			value: false,
			error: error instanceof Error ? error.message : String(error)
		};
	}
}

/**
 * Extract all event IDs referenced in a condition
 *
 * Useful for validation and dependency checking.
 *
 * @param condition - The condition expression to analyze
 * @returns Array of event IDs referenced in the condition, or null if parsing fails
 */
export function extractEventReferences(condition: string): string[] | null {
	const parseResult = parseCondition(condition);
	if (!parseResult.success || !parseResult.ast) {
		return null;
	}

	const eventIds = new Set<string>();
	collectEventReferences(parseResult.ast, eventIds);
	return Array.from(eventIds);
}

/**
 * Recursively collect event references from an AST
 */
function collectEventReferences(node: ASTNode, eventIds: Set<string>): void {
	switch (node.type) {
		case 'EventReference':
			eventIds.add(node.eventId);
			break;
		case 'BinaryOp':
			collectEventReferences(node.left, eventIds);
			collectEventReferences(node.right, eventIds);
			break;
		case 'UnaryOp':
			collectEventReferences(node.operand, eventIds);
			break;
		case 'Comparison':
			collectEventReferences(node.left, eventIds);
			collectEventReferences(node.right, eventIds);
			break;
		// Literals have no references
	}
}

/**
 * Validate a condition expression
 *
 * Checks if the condition can be parsed and optionally validates
 * that all referenced events exist in a provided set.
 *
 * @param condition - The condition expression to validate
 * @param validEventIds - Optional set of valid event IDs to check against
 * @returns Object with isValid flag and any validation errors
 */
export function validateCondition(
	condition: string,
	validEventIds?: Set<string>
): { isValid: boolean; errors: string[] } {
	const errors: string[] = [];

	// Try to parse
	const parseResult = parseCondition(condition);
	if (!parseResult.success) {
		errors.push(`Parse error: ${parseResult.error}`);
		return { isValid: false, errors };
	}

	// Check event references if validEventIds provided
	if (validEventIds) {
		const refs = extractEventReferences(condition);
		if (refs) {
			for (const ref of refs) {
				if (!validEventIds.has(ref)) {
					errors.push(`Unknown event reference: '${ref}'`);
				}
			}
		}
	}

	return { isValid: errors.length === 0, errors };
}
