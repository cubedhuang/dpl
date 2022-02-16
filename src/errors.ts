import chalk from "chalk";

import { Context } from "./Context";
import { Position } from "./Position";

function addArrows(input: string, posStart: Position, posEnd: Position) {
	let result = "";

	// Calculate indices
	let inputStart = input.lastIndexOf("\n", posStart.i);
	if (inputStart < 0) inputStart = 0;
	let inputEnd = input.indexOf("\n", inputStart + 1);
	if (inputEnd < 0) inputEnd = input.length;

	// Generate each line
	const lineCount = posEnd.line - posStart.line + 1;
	for (let i = 0; i < lineCount; i++) {
		// Calculate line columns
		const line = input.substring(inputStart, inputEnd);
		const colStart = i === 0 ? posStart.col : 0;
		const colEnd = i === lineCount - 1 ? posEnd.col : line.length - 1;

		// Append to result
		result += line + "\n";
		result += " ".repeat(colStart) + "^".repeat(colEnd - colStart);

		// Re-calculate indices
		inputStart = inputEnd;
		inputEnd = input.indexOf("\n", inputStart + 1);
		if (inputEnd < 0) inputEnd = input.length;
	}

	return result.replace("\t", "");
}

export abstract class DPLError extends Error {
	name: string;

	constructor(
		public posStart: Position,
		public posEnd: Position,
		message: string,
		name?: string
	) {
		super(message);

		this.name = name ?? this.constructor.name;
	}

	toString() {
		let str = chalk.redBright(`${this.name}: ${this.message}`);
		str += chalk.dim(
			`\n  File ${this.posStart.file}, line ${
				this.posStart.line + 1
			}, column ${this.posStart.col + 1}`
		);
		str += `\n\n${addArrows(
			this.posStart.input,
			this.posStart,
			this.posEnd
		)}`;
		return str;
	}
}

export class IllegalCharacterError extends DPLError {
	constructor(posStart: Position, posEnd: Position, message: string) {
		super(posStart, posEnd, message);
	}
}

export class SyntaxError extends DPLError {
	constructor(posStart: Position, posEnd: Position, message: string) {
		super(posStart, posEnd, message);
	}
}

export class RuntimeError extends DPLError {
	constructor(
		posStart: Position,
		posEnd: Position,
		message: string,
		public context: Context
	) {
		super(posStart, posEnd, message);
	}

	toString() {
		let str = chalk.redBright(`${this.name}: ${this.message}`);
		str += chalk.dim(this.generateTraceback());
		str += `\n${addArrows(
			this.posStart.input,
			this.posStart,
			this.posEnd
		)}`;
		return str;
	}

	generateTraceback() {
		let str = "";
		let pos: Position | null = this.posStart;
		let ctx: Context | null = this.context;

		while (ctx) {
			str =
				`  File ${pos?.file}, line ${(pos?.line ?? 0) + 1}, column ${
					(pos?.col ?? 0) + 1
				} in ${ctx.name}\n` + str;
			pos = ctx.parentEntryPos;
			ctx = ctx.parent;
		}

		return "\nTraceback (most recent call last):\n" + str;
	}
}

export class UndefinedOpError extends RuntimeError {
	constructor(
		posStart: Position,
		posEnd: Position,
		message: string,
		context: Context
	) {
		super(posStart, posEnd, message, context);
	}
}
