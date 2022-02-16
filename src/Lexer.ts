import { IllegalCharacterError } from "./errors";
import { Position } from "./Position";
import { Keywords, Token, TokenType } from "./Token";

const escapes: Record<string, string> = {
	b: "\b",
	f: "\f",
	n: "\n",
	r: "\r",
	t: "\t"
};

interface TokenMatcher {
	regex: RegExp;
	type: TokenType | null;
	map?: (match: RegExpMatchArray) => string;
}

const tokenMap: TokenMatcher[] = [
	{ regex: /^\s+/, type: null },
	{ regex: /^\/\/.*/, type: null },
	{ regex: /^\/\*[\s\S]*\*\//, type: null },

	{ regex: new RegExp(`^(?:${Keywords.join("|")})\\b`), type: "KEYWORD" },

	{ regex: /^:/, type: "ASSIGN" },
	{ regex: /^\(/, type: "LPAREN" },
	{ regex: /^\)/, type: "RPAREN" },
	{ regex: /^,/, type: "COMMA" },
	{ regex: /^->/, type: "ARROW" },

	{ regex: /^none\b/, type: "NONE" },
	{ regex: /^\d+\.?\d*\b/, type: "NUMBER" },
	{ regex: /^(?:true|false)\b/, type: "BOOL" },
	{
		regex: /^"((?:\\.|.)*?)"/,
		type: "STRING",
		// Interpret escape sequences
		// Thanks https://github.com/jneen/parsimmon/blob/master/examples/json.js
		map: match =>
			match[1].replace(
				/\\(u[0-9a-fA-F]{4}|[^u])/,
				(_, escape: string) => {
					let type = escape[0];
					let hex = escape.slice(1);
					if (type === "u")
						return String.fromCharCode(parseInt(hex, 16));
					return escapes[type] ?? type;
				}
			)
	},

	{ regex: /^\+/, type: "PLUS" },
	{ regex: /^-/, type: "MINUS" },
	{ regex: /^\*/, type: "MUL" },
	{ regex: /^\//, type: "DIV" },
	{ regex: /^%/, type: "MOD" },
	{ regex: /^\^/, type: "POW" },

	{ regex: /^and\b/, type: "AND" },
	{ regex: /^or\b/, type: "OR" },
	{ regex: /^xor\b/, type: "XOR" },
	{ regex: /^not\b/, type: "NOT" },

	{ regex: /^<=/, type: "LE" },
	{ regex: /^</, type: "LT" },
	{ regex: /^>=/, type: "GE" },
	{ regex: /^>/, type: "GT" },
	{ regex: /^=/, type: "EQ" },
	{ regex: /^!=/, type: "NEQ" },

	{ regex: /^[a-zA-Z_][a-zA-Z0-9_]*/, type: "IDENTIFIER" }
];

export class Lexer {
	pos: Position;

	get currentChar() {
		return this.input[this.pos.i] ?? null;
	}

	constructor(public file: string, public input: string) {
		this.pos = new Position({
			i: -1,
			line: 0,
			column: -1,
			file,
			input
		});
		this.advance();
	}

	advance(count = 1) {
		for (let i = 0; i < count; i++) {
			this.pos.advance(this.currentChar);
		}
	}

	getTokens() {
		const tokens: Token[] = [];

		while (this.currentChar) {
			const sliced = this.input.slice(this.pos.i);
			const posStart = this.pos.copy();

			let matched = false;

			for (const { regex, type, map } of tokenMap) {
				const match = sliced.match(regex);

				if (match) {
					matched = true;

					const value = map ? map(match) : match[0];

					this.advance(match[0].length);

					if (type === null) break;

					const token = new Token({
						type,
						value,
						posStart,
						posEnd: this.pos
					});
					tokens.push(token);

					break;
				}
			}

			if (!matched) {
				const char = this.currentChar;
				this.advance();
				return {
					tokens: [],
					error: new IllegalCharacterError(
						posStart,
						this.pos,
						`'${char}'`
					)
				};
			}
		}

		tokens.push(
			new Token({ type: "EOF", value: "EOF", posStart: this.pos })
		);

		return { tokens, error: null };
	}
}
