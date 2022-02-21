import { DPLError, SyntaxError } from "./errors";
import {
	BinaryOpNode,
	CallNode,
	FnDefNode,
	ForNode,
	IfNode,
	Node,
	StatementsNode,
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

	constructor(public tokens: Token[]) {}

	parse() {
		const res = this.statements();

		if (
			!res.error &&
			this.current().type !== "EOF" &&
			this.current().type !== "SEMICOLON"
		) {
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

	current() {
		return this.tokens[this.i];
	}

	next() {
		this.i++;
		return this.current();
	}

	peek() {
		return this.tokens[this.i + 1];
	}

	statements(): ParseResult {
		const res = new ParseResult();
		const statements: Node[] = [];

		while (true) {
			if (
				this.current().type === "EOF" ||
				this.current().type === "RBRACE"
			) {
				break;
			}

			const expr = this.expr();
			if (expr.error) return expr;

			statements.push(expr.node);

			if (this.current().type === "SEMICOLON") {
				res.register(this.next());
			} else {
				break;
			}
		}

		return res.success(
			new StatementsNode(
				statements[0]?.posStart ?? this.current().posStart,
				statements[statements.length - 1]?.posEnd ??
					this.current().posEnd,
				statements
			)
		);
	}

	expr(): ParseResult {
		const res = new ParseResult();

		if (
			this.current().type === "IDENTIFIER" &&
			this.peek().type === "ASSIGN"
		) {
			const identifier = this.current();

			res.register(this.next());

			if (this.current().type !== "ASSIGN") {
				return res.failure(
					new SyntaxError(
						this.current().posStart,
						this.current().posEnd,
						"Expected ':='"
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
			this.fnCall.bind(this),
			["POW"],
			this.factor.bind(this)
		);
	}

	fnCall(): ParseResult {
		const res = new ParseResult();

		const atom = res.register(this.atom());
		if (res.error) return res;

		if (this.current().type !== "LPAREN") {
			return res.success(atom);
		}

		res.register(this.next());

		const args: Node[] = [];

		while (this.current().type !== "RPAREN") {
			const arg = res.register(this.expr());
			if (res.error) return res;

			args.push(arg);

			if (this.current().type === "COMMA") {
				res.register(this.next());
			} else if (this.current().type !== "RPAREN") {
				return res.failure(
					new SyntaxError(
						this.current().posStart,
						this.current().posEnd,
						"Expected ',' or ')'"
					)
				);
			}
		}

		res.register(this.next());

		return res.success(new CallNode(atom, args));
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

		if (token.matches("KEYWORD", "fn")) {
			const fnExpr = res.register(this.fnExpr());
			if (res.error) return res;

			return res.success(fnExpr);
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

		if (this.current().type !== "LBRACE") {
			return res.failure(
				new SyntaxError(
					this.current().posStart,
					this.current().posEnd,
					"Expected '{'"
				)
			);
		}

		res.register(this.next());

		const thenBranch = res.register(this.statements());
		if (res.error) return res;

		if (this.current().type !== "RBRACE") {
			return res.failure(
				new SyntaxError(
					this.current().posStart,
					this.current().posEnd,
					"Expected '}'"
				)
			);
		}

		res.register(this.next());

		if (!this.current().matches("KEYWORD", "else")) {
			return res.success(new IfNode(condition, thenBranch));
		}

		res.register(this.next());

		if (this.current().type !== "LBRACE") {
			return res.failure(
				new SyntaxError(
					this.current().posStart,
					this.current().posEnd,
					"Expected '{'"
				)
			);
		}

		res.register(this.next());

		const elseBranch = res.register(this.statements());
		if (res.error) return res;

		if (this.current().type !== "RBRACE") {
			return res.failure(
				new SyntaxError(
					this.current().posStart,
					this.current().posEnd,
					"Expected '}'"
				)
			);
		}

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

		if (this.current().type !== "LBRACE") {
			return res.failure(
				new SyntaxError(
					this.current().posStart,
					this.current().posEnd,
					"Expected '{'"
				)
			);
		}

		res.register(this.next());

		const body = res.register(this.statements());
		if (res.error) return res;

		if (this.current().type !== "RBRACE") {
			return res.failure(
				new SyntaxError(
					this.current().posStart,
					this.current().posEnd,
					"Expected '}'"
				)
			);
		}

		res.register(this.next());

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

		if (this.current().type !== "LBRACE") {
			return res.failure(
				new SyntaxError(
					this.current().posStart,
					this.current().posEnd,
					"Expected '{'"
				)
			);
		}

		res.register(this.next());

		const body = res.register(this.statements());
		if (res.error) return res;

		if (this.current().type !== "RBRACE") {
			return res.failure(
				new SyntaxError(
					this.current().posStart,
					this.current().posEnd,
					"Expected '}'"
				)
			);
		}

		return res.success(new WhileNode(condition, body));
	}

	fnExpr() {
		const res = new ParseResult();

		if (!this.current().matches("KEYWORD", "fn")) {
			return res.failure(
				new SyntaxError(
					this.current().posStart,
					this.current().posEnd,
					"Expected 'fn'"
				)
			);
		}

		res.register(this.next());

		let name: Token | null = null;

		if (this.current().type === "IDENTIFIER") {
			name = this.current();
			res.register(this.next());
		}

		if (this.current().type !== "LPAREN") {
			return res.failure(
				new SyntaxError(
					this.current().posStart,
					this.current().posEnd,
					"Expected '('" + (name ? "" : " or IDENTIFIER")
				)
			);
		}

		res.register(this.next());

		const parameters: Token[] = [];

		while (this.current().type !== "RPAREN") {
			if (this.current().type !== "IDENTIFIER") {
				return res.failure(
					new SyntaxError(
						this.current().posStart,
						this.current().posEnd,
						"Expected IDENTIFIER"
					)
				);
			}

			const param = this.current();
			parameters.push(param);

			res.register(this.next());

			if (this.current().type === "COMMA") {
				res.register(this.next());
			} else if (this.current().type !== "RPAREN") {
				return res.failure(
					new SyntaxError(
						this.current().posStart,
						this.current().posEnd,
						"Expected ',' or ')'"
					)
				);
			}
		}

		if (this.current().type !== "RPAREN") {
			return res.failure(
				new SyntaxError(
					this.current().posStart,
					this.current().posEnd,
					"Expected ')'"
				)
			);
		}

		res.register(this.next());

		// if (!this.current().matches("KEYWORD", "do")) {
		if (this.current().type !== "LBRACE") {
			return res.failure(
				new SyntaxError(
					this.current().posStart,
					this.current().posEnd,
					"Expected '{'"
				)
			);
		}

		res.register(this.next());

		const body = res.register(this.statements());
		if (res.error) return res;

		if (this.current().type !== "RBRACE") {
			return res.failure(
				new SyntaxError(
					this.current().posStart,
					this.current().posEnd,
					"Expected '}'"
				)
			);
		}

		res.register(this.next());

		return res.success(new FnDefNode(name, parameters, body));
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
