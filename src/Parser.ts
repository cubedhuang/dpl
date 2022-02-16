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
		const res = this.expr();

		if (!res.error && this.current().type !== "EOF") {
			return res.failure(
				new SyntaxError(
					this.current().posStart!,
					this.current().posEnd!,
					`Unexpected ${this.current().type}: '${
						this.current().value
					}'`
				)
			);
		}

		return res;
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
		const res = new ParseResult();
		const token = this.current();

		if (["PLUS", "MINUS"].includes(token.type)) {
			res.register(this.next());

			const power = res.register(this.power());
			if (res.error) return res;

			return res.success(new UnaryOpNode(token, power));
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
		const res = new ParseResult();
		const token = this.current();

		if (
			token.type === "NONE" ||
			token.type === "NUMBER" ||
			token.type === "BOOL" ||
			token.type === "STRING"
		) {
			res.register(this.next());

			return res.success(new ValueNode(token));
		}

		if (token.type === "IDENTIFIER") {
			res.register(this.next());
			return res.success(new VarAccessNode(token));
		}

		if (token.type === "LPAREN") {
			res.register(this.next());

			const expr = res.register(this.expr());
			if (res.error) return res;

			if (this.current()?.type === "RPAREN") {
				res.register(this.next());
				return res.success(expr);
			} else {
				return res.failure(
					new SyntaxError(
						this.current().posStart,
						this.current().posEnd,
						"Expected ')'"
					)
				);
			}
		}

		if (token.matches("KEYWORD", "if")) {
			const ifExpr = res.register(this.ifExpr());
			if (res.error) return res;

			return res.success(ifExpr);
		}

		if (token.matches("KEYWORD", "for")) {
			const forExpr = res.register(this.forExpr());
			if (res.error) return res;

			return res.success(forExpr);
		}

		if (token.matches("KEYWORD", "while")) {
			const whileExpr = res.register(this.whileExpr());
			if (res.error) return res;

			return res.success(whileExpr);
		}

		return res.failure(
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
		const res = new ParseResult();

		let left = res.register(nodeA());
		if (res.error) return res;

		while (ops.includes(this.current()?.type)) {
			const op = this.current();
			res.register(this.next());

			const right = res.register(nodeB());
			if (res.error) return res;

			left = new BinaryOpNode(op, left, right);
		}

		return res.success(left);
	}
}
