import { Position } from "./Position";

export const Keywords = [
	"set",
	"if",
	"do",
	"else",
	"for",
	"to",
	"step",
	"while",
	"fn"
] as const;
export type KeywordType = typeof Keywords[number];

export const Tokens = [
	// Special Tokens and Symbols
	"EOF",
	"KEYWORD",
	"IDENTIFIER",
	"ASSIGN",
	"LPAREN",
	"RPAREN",
	"COMMA",
	"ARROW",
	// Types
	"NONE",
	"NUMBER",
	"BOOL",
	"STRING",
	// Unary/Binary Operators
	"PLUS",
	"MINUS",
	"MUL",
	"DIV",
	"MOD",
	"POW",
	// Boolean Operators
	"AND",
	"OR",
	"XOR",
	"NOT",
	// Comparison Operators
	"EQ",
	"NEQ",
	"LT",
	"LE",
	"GT",
	"GE"
] as const;
export type TokenType = typeof Tokens[number];

export interface TokenOptions {
	type: TokenType;
	value: string;
	posStart: Position;
	posEnd?: Position;
}

export class Token {
	type: TokenType;
	value: string;
	posStart: Position;
	posEnd: Position;

	constructor({ type, value, posStart, posEnd }: TokenOptions) {
		this.type = type;
		this.value = value;
		this.posStart = posStart.copy();
		this.posEnd = posEnd?.copy() ?? posStart.copy().advance();
	}

	matches(type: TokenType, value: string) {
		return this.type === type && this.value === value;
	}

	toString() {
		if (this.value) return `${this.type}(${this.value})`;
		return this.type;
	}
}
