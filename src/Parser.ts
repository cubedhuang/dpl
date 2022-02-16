import { DPLError, SyntaxError } from "./errors";
import {
	BinaryOpNode,
	ForNode,
	IfNode,
	Node,
	UnaryOpNode,
	ValueNode,
	VarAccessNode,
	VarAssignNode,
	WhileNode
} from "./nodes";
import { Token, TokenType } from "./Token";

export class ParseResult {
	error: DPLError | null = null;
	node!: Node;

	register(result: ParseResult): Node;
	register<T extends Node | Token>(result: T): T;
	register(result: ParseResult | Node | Token) {
		if (result instanceof ParseResult) {
			if (result.error) this.error = result.error;
			return result.node;
		}
		return result;
	}

	success(node: Node) {
		this.node = node;
		return this;
	}

	failure(error: DPLError) {
		this.error = error;
		return this;
	}
}

export class Parser {
	i = 0;

	current() {
		return this.tokens[this.i];
	}

	constructor(public tokens: Token[]) {}

	parse() {
		const result = this.expr();

		if (!result.error && this.current().type !== "EOF") {
			return result.failure(
				new SyntaxError(
					this.current().posStart!,
					this.current().posEnd!,
					`Unexpected ${this.current().type}: '${
						this.current().value
					}'`
				)
			);
		}

		return result;
	}

	next() {
		this.i++;
		return this.current();
	}

	expr(): ParseResult {
		const res = new ParseResult();

		if (this.current().matches("KEYWORD", "set")) {
			res.register(this.next());

			if (this.current().type !== "IDENTIFIER") {
				return res.failure(
					new SyntaxError(
						this.current().posStart,
						this.current().posEnd,
						"Expected IDENTIFIER"
					)
				);
			}

			const identifier = this.current();

			res.register(this.next());

			if (this.current().type !== "ASSIGN") {
				return res.failure(
					new SyntaxError(
						this.current().posStart,
						this.current().posEnd,
						"Expected ':'"
					)
				);
			}

			res.register(this.next());

			const expr = res.register(this.expr());
			if (res.error) return res;

			return res.success(new VarAssignNode(identifier, expr));
		}

		return this.binOp(this.compExpr.bind(this), ["AND", "OR", "XOR"]);
	}

	compExpr(): ParseResult {
		const res = new ParseResult();

		if (this.current().type === "NOT") {
			const op = this.current();
			res.register(this.next());

			const expr = res.register(this.compExpr());
			if (res.error) return res;

			return res.success(new UnaryOpNode(op, expr));
		}

		return this.binOp(this.arithExpr.bind(this), [
			"EQ",
			"NEQ",
			"LT",
			"LE",
			"GT",
			"GE"
		]);
	}

	arithExpr(): ParseResult {
		return this.binOp(this.term.bind(this), ["PLUS", "MINUS"]);
	}

	term() {
		return this.binOp(this.factor.bind(this), ["MUL", "DIV", "MOD"]);
	}

	factor(): ParseResult {
		const result = new ParseResult();
		const token = this.current();

		if (["PLUS", "MINUS"].includes(token.type)) {
			result.register(this.next());

			const power = result.register(this.power());
			if (result.error) return result;

			return result.success(new UnaryOpNode(token, power));
		}

		return this.power();
	}

	power(): ParseResult {
		return this.binOp(
			this.atom.bind(this),
			["POW"],
			this.factor.bind(this)
		);
	}

	atom() {
		const result = new ParseResult();
		const token = this.current();

		if (
			token.type === "NONE" ||
			token.type === "NUMBER" ||
			token.type === "BOOL" ||
			token.type === "STRING"
		) {
			result.register(this.next());

			return result.success(new ValueNode(token));
		}

		if (token.type === "IDENTIFIER") {
			result.register(this.next());
			return result.success(new VarAccessNode(token));
		}

		if (token.type === "LPAREN") {
			result.register(this.next());

			const expr = result.register(this.expr());
			if (result.error) return result;

			if (this.current()?.type === "RPAREN") {
				result.register(this.next());
				return result.success(expr);
			} else {
				return result.failure(
					new SyntaxError(
						this.current().posStart,
						this.current().posEnd,
						"Expected ')'"
					)
				);
			}
		}

		if (token.matches("KEYWORD", "if")) {
			const ifExpr = result.register(this.ifExpr());
			if (result.error) return result;

			return result.success(ifExpr);
		}

		if (token.matches("KEYWORD", "for")) {
			const forExpr = result.register(this.forExpr());
			if (result.error) return result;

			return result.success(forExpr);
		}

		if (token.matches("KEYWORD", "while")) {
			const whileExpr = result.register(this.whileExpr());
			if (result.error) return result;

			return result.success(whileExpr);
		}

		return result.failure(
			new SyntaxError(
				token.posStart,
				token.posEnd,
				`Unexpected ${token.type}: '${token.value}'`
			)
		);
	}

	ifExpr() {
		const res = new ParseResult();

		if (!this.current().matches("KEYWORD", "if")) {
			return res.failure(
				new SyntaxError(
					this.current().posStart,
					this.current().posEnd,
					"Expected 'if'"
				)
			);
		}

		res.register(this.next());

		const condition = res.register(this.expr());
		if (res.error) return res;

		if (!this.current().matches("KEYWORD", "do")) {
			return res.failure(
				new SyntaxError(
					this.current().posStart,
					this.current().posEnd,
					"Expected 'do'"
				)
			);
		}

		res.register(this.next());

		const thenBranch = res.register(this.expr());
		if (res.error) return res;

		if (!this.current().matches("KEYWORD", "else")) {
			return res.success(new IfNode(condition, thenBranch)); // if (!this.current()Token.matches("KEYWORD", "else")) {
		}

		res.register(this.next());

		const elseBranch = res.register(this.expr());
		if (res.error) return res;

		return res.success(new IfNode(condition, thenBranch, elseBranch));
	}

	forExpr() {
		const res = new ParseResult();

		if (!this.current().matches("KEYWORD", "for")) {
			return res.failure(
				new SyntaxError(
					this.current().posStart,
					this.current().posEnd,
					"Expected 'for'"
				)
			);
		}

		res.register(this.next());

		if (this.current().type !== "IDENTIFIER") {
			return res.failure(
				new SyntaxError(
					this.current().posStart,
					this.current().posEnd,
					"Expected IDENTIFIER"
				)
			);
		}

		const varName = this.current();
		res.register(this.next());

		if (this.current().type !== "ASSIGN") {
			return res.failure(
				new SyntaxError(
					this.current().posStart,
					this.current().posEnd,
					"Expected ':'"
				)
			);
		}

		res.register(this.next());

		const startValue = res.register(this.expr());
		if (res.error) return res;

		if (!this.current().matches("KEYWORD", "to")) {
			return res.failure(
				new SyntaxError(
					this.current().posStart,
					this.current().posEnd,
					"Expected 'to'"
				)
			);
		}

		res.register(this.next());

		const endValue = res.register(this.expr());
		if (res.error) return res;

		let stepValue: Node | null = null;
		if (this.current().matches("KEYWORD", "step")) {
			res.register(this.next());

			stepValue = res.register(this.expr());
			if (res.error) return res;
		}

		if (!this.current().matches("KEYWORD", "do")) {
			return res.failure(
				new SyntaxError(
					this.current().posStart,
					this.current().posEnd,
					"Expected 'do'"
				)
			);
		}

		res.register(this.next());

		const body = res.register(this.expr());
		if (res.error) return res;

		return res.success(
			new ForNode(varName, startValue, endValue, stepValue, body)
		);
	}

	whileExpr() {
		const res = new ParseResult();

		if (!this.current().matches("KEYWORD", "while")) {
			return res.failure(
				new SyntaxError(
					this.current().posStart,
					this.current().posEnd,
					"Expected 'while'"
				)
			);
		}

		res.register(this.next());

		const condition = res.register(this.expr());
		if (res.error) return res;

		if (!this.current().matches("KEYWORD", "do")) {
			return res.failure(
				new SyntaxError(
					this.current().posStart,
					this.current().posEnd,
					"Expected 'do'"
				)
			);
		}

		res.register(this.next());

		const body = res.register(this.expr());
		if (res.error) return res;

		return res.success(new WhileNode(condition, body));
	}

	private binOp(
		nodeA: () => ParseResult,
		ops: TokenType[],
		nodeB: () => ParseResult = nodeA
	) {
		const result = new ParseResult();
		let left = result.register(nodeA());

		if (result.error) return result;

		while (ops.includes(this.current()?.type)) {
			const op = this.current();
			result.register(this.next());

			const right = result.register(nodeB());
			if (result.error) return result;

			left = new BinaryOpNode(op, left, right);
		}

		return result.success(left);
	}
}
