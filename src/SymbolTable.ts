import { DPLValue } from "./values";

export class SymbolTable {
	symbols: Map<string, DPLValue> = new Map();

	constructor(public parent: SymbolTable | null = null) {}

	get(name: string): DPLValue | null {
		const value = this.symbols.get(name);
		if (value === undefined && this.parent) {
			return this.parent.get(name) ?? null;
		}
		return value ?? null;
	}

	set(name: string, value: DPLValue) {
		this.symbols.set(name, value);
	}

	remove(name: string) {
		this.symbols.delete(name);
	}
}
