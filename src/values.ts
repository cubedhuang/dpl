import { Context } from "./Context";
import { RuntimeError, UndefinedOpError } from "./errors";
import { Position } from "./Position";
import { TokenType } from "./Token";

export type DPLValue = DPLNone | DPLNumber | DPLBool | DPLString;
export type DPLType = DPLValue["type"];

type Ops<Args extends unknown[] = []> = {
	[K in TokenType]?: (
		...args: Args
	) => DPLValue | [DPLValue, null] | [null, RuntimeError];
};

export abstract class BaseDPLValue<
	Type extends DPLType,
	InternalType = unknown
> {
	posStart: Position | null = null;
	posEnd: Position | null = null;
	context: Context | null = null;

	constructor(public readonly type: Type, public value: InternalType) {}

	setPos(start: Position | null = null, end: Position | null = null) {
		this.posStart = start;
		this.posEnd = end;
		return this;
	}

	setContext(context: Context | null = null) {
		this.context = context;
		return this;
	}

	abstract readonly unaryOps: Ops;

	unaryOp(op: TokenType): [DPLValue, null] | [null, RuntimeError] {
		const func = this.unaryOps[op];

		if (!func) {
			return [
				null,
				new UndefinedOpError(
					this.posStart!,
					this.posEnd!,
					`Undefined behavior for ${op} ${this.type}`,
					this.context!
				)
			];
		}

		const result = func();
		if (Array.isArray(result)) return result;
		return [
			result.setPos(this.posStart, this.posEnd).setContext(this.context),
			null
		];
	}

	abstract binaryOp(
		op: TokenType,
		other: DPLValue
	): [DPLValue, null] | [null, RuntimeError];

	abstract copy(): DPLValue;
	abstract toString(): string;

	render() {
		return this.toString();
	}
}

function handleEquality(
	value: DPLValue,
	op: TokenType,
	other: DPLValue
): [DPLBool, null] | null {
	switch (op) {
		case "EQ":
			return [new DPLBool(value.value === other.value), null];
		case "NEQ":
			return [new DPLBool(value.value !== other.value), null];
	}

	return null;
}

export class DPLNone extends BaseDPLValue<"NONE", null> {
	constructor() {
		super("NONE", null);
	}

	unaryOps = {
		NOT: () => new DPLBool(true)
	};

	binaryOp(
		op: TokenType,
		other: DPLValue
	): [DPLValue, null] | [null, RuntimeError] {
		const equality = handleEquality(this, op, other);

		return (
			equality ?? [
				null,
				new UndefinedOpError(
					this.posStart!,
					this.posEnd!,
					`Undefined behavior for ${this.type} ${op} ${other.type}`,
					this.context!
				)
			]
		);
	}

	copy(): DPLNone {
		return new DPLNone();
	}

	toString() {
		return "none";
	}
}

export class DPLNumber extends BaseDPLValue<"NUMBER", number> {
	constructor(value: number | string) {
		super("NUMBER", typeof value === "number" ? value : parseFloat(value));
	}

	unaryOps = {
		PLUS: () => this.copy(),
		MINUS: () => new DPLNumber(-1),
		NOT: () => new DPLNumber(~this.value)
	};

	binaryNumberOps: Ops<[DPLNumber]> = {
		PLUS: (other: DPLNumber) => new DPLNumber(this.value + other.value),
		MINUS: (other: DPLNumber) => new DPLNumber(this.value - other.value),
		MUL: (other: DPLNumber) => new DPLNumber(this.value * other.value),
		DIV: (other: DPLNumber) => {
			if (other.value === 0) {
				return [
					null,
					new RuntimeError(
						other.posStart!,
						other.posEnd!,
						`Division by 0`,
						this.context!
					)
				];
			}
			return [
				new DPLNumber(this.value / other.value).setContext(
					this.context
				),
				null
			];
		},
		MOD: (other: DPLNumber) => {
			if (other.value === 0) {
				return [
					null,
					new RuntimeError(
						other.posStart!,
						other.posEnd!,
						`Modulus by 0`,
						this.context!
					)
				];
			}
			return [
				new DPLNumber(this.value % other.value).setContext(
					this.context
				),
				null
			];
		},
		POW: (other: DPLNumber) => {
			if (this.value === 0 && other.value === 0) {
				return [
					null,
					new RuntimeError(
						this.posStart!,
						other.posEnd!,
						`0 ^ 0 is undefined`,
						this.context!
					)
				];
			}
			return [
				new DPLNumber(this.value ** other.value).setContext(
					this.context
				),
				null
			];
		},

		AND: (other: DPLNumber) => new DPLNumber(this.value & other.value),
		OR: (other: DPLNumber) => new DPLNumber(this.value | other.value),
		XOR: (other: DPLNumber) => new DPLNumber(this.value ^ other.value),

		LT: (other: DPLNumber) => new DPLBool(this.value < other.value),
		LE: (other: DPLNumber) => new DPLBool(this.value <= other.value),
		GT: (other: DPLNumber) => new DPLBool(this.value > other.value),
		GE: (other: DPLNumber) => new DPLBool(this.value >= other.value)
	};

	binaryOp(
		op: TokenType,
		other: DPLValue
	): [DPLValue, null] | [null, RuntimeError] {
		const equality = handleEquality(this, op, other);
		if (equality) return equality;

		if (!(other instanceof DPLNumber)) {
			return [
				null,
				new UndefinedOpError(
					other.posStart!,
					other.posEnd!,
					`Undefined behavior for ${this.type} ${op} ${other.type}`,
					this.context!
				)
			];
		}

		const func = this.binaryNumberOps[op];

		if (!func) {
			return [
				null,
				new UndefinedOpError(
					this.posStart!,
					other.posEnd!,
					`Undefined behavior for ${this.type} ${op} ${other.type}`,
					this.context!
				)
			];
		}

		const result = func(other);
		if (Array.isArray(result)) return result;
		return [
			result.setPos(this.posStart, other.posEnd).setContext(this.context),
			null
		];
	}

	copy(): DPLNumber {
		return new DPLNumber(this.value).setPos(this.posStart, this.posEnd);
	}

	toString() {
		return this.value.toString();
	}
}

export class DPLBool extends BaseDPLValue<"BOOL", boolean> {
	constructor(value: boolean | string) {
		super(
			"BOOL",
			typeof value === "boolean" ? value : value === "true" ? true : false
		);
	}

	unaryOps = {
		NOT: (): [DPLBool, null] => [new DPLBool(!this.value), null]
	};

	binaryOp(
		op: TokenType,
		other: DPLValue
	): [DPLValue, null] | [null, RuntimeError] {
		const equality = handleEquality(this, op, other);
		if (equality) return equality;

		if (!(other instanceof DPLBool)) {
			return [
				null,
				new UndefinedOpError(
					this.posStart!,
					other.posEnd!,
					`Undefined behavior for ${this.type} ${op} ${other.type}`,
					this.context!
				)
			];
		}

		switch (op) {
			case "AND":
				return this.and(other);
			case "OR":
				return this.or(other);
			case "XOR":
				return this.xor(other);
		}

		return [
			null,
			new UndefinedOpError(
				this.posStart!,
				other.posEnd!,
				`Undefined behavior for ${this.type} ${op} ${other.type}`,
				this.context!
			)
		];
	}

	and(other: DPLBool): [DPLBool, null] {
		return [
			new DPLBool(this.value && other.value).setContext(this.context),
			null
		];
	}

	or(other: DPLBool): [DPLBool, null] {
		return [
			new DPLBool(this.value || other.value).setContext(this.context),
			null
		];
	}

	xor(other: DPLBool): [DPLBool, null] {
		return [
			new DPLBool(this.value !== other.value).setContext(this.context),
			null
		];
	}

	copy(): DPLBool {
		return new DPLBool(this.value).setPos(this.posStart, this.posEnd);
	}

	toString() {
		return this.value.toString();
	}
}

export class DPLString extends BaseDPLValue<"STRING", string> {
	constructor(value: string | DPLValue) {
		super("STRING", value.toString());
	}

	unaryOps = {};

	binaryOp(
		op: TokenType,
		other: DPLValue
	): [DPLValue, null] | [null, RuntimeError] {
		const equality = handleEquality(this, op, other);
		if (equality) return equality;

		if (op === "PLUS") return this.plus(other);

		if (other instanceof DPLString) {
			switch (op) {
				case "LT":
					return this.comp(other, (a, b) => a < b);
				case "LE":
					return this.comp(other, (a, b) => a <= b);
				case "GT":
					return this.comp(other, (a, b) => a > b);
				case "GE":
					return this.comp(other, (a, b) => a >= b);
			}
		} else if (other instanceof DPLNumber && op === "MUL") {
			return this.times(other);
		}

		return [
			null,
			new UndefinedOpError(
				this.posStart!,
				other.posEnd!,
				`Undefined behavior for ${this.type} ${op} ${other.type}`,
				this.context!
			)
		];
	}

	plus(other: DPLValue): [DPLString, null] {
		return [
			new DPLString(this.value + other.toString()).setContext(
				this.context
			),
			null
		];
	}

	times(other: DPLNumber): [DPLString, null] | [null, RuntimeError] {
		if (other.value < 0) {
			return [
				null,
				new RuntimeError(
					other.posStart!,
					other.posEnd!,
					"Cannot repeat STRING a negative number of times",
					this.context!
				)
			];
		} else if (!Number.isInteger(other.value)) {
			return [
				null,
				new RuntimeError(
					other.posStart!,
					other.posEnd!,
					"Cannot repeat STRING by a non-integer value",
					this.context!
				)
			];
		}
		return [
			new DPLString(this.value.repeat(other.value)).setContext(
				this.context
			),
			null
		];
	}

	comp(
		other: DPLString,
		fn: (a: string, b: string) => boolean
	): [DPLBool, null] {
		return [
			new DPLBool(fn(this.value, other.value))
				.setPos(this.posStart, other.posEnd)
				.setContext(this.context),
			null
		];
	}

	copy(): DPLString {
		return new DPLString(this.value).setPos(this.posStart, this.posEnd);
	}

	toString() {
		return this.value.toString();
	}

	render() {
		return JSON.stringify(this.value);
	}
}
