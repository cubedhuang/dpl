import { Position } from "./Position";
import { SymbolTable } from "./SymbolTable";

export class Context {
	symbolTable = new SymbolTable();

	constructor(
		public name: string,
		public parent: Context | null = null,
		public parentEntryPos: Position | null = null
	) {}
}
