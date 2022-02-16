import { Position } from "./Position";
import { Token } from "./Token";

export type Node =
	| ValueNode
	| UnaryOpNode
	| BinaryOpNode
	| VarAccessNode
	| VarAssignNode
	| IfNode
	| ForNode
	| WhileNode;
export type NodeType = Node["type"];

export abstract class BaseNode<Type extends NodeType = NodeType> {
	abstract toString(): string;

	constructor(
		public type: Type,
		public posStart: Position,
		public posEnd: Position
	) {}
}

export class ValueNode extends BaseNode<"ValueNode"> {
	constructor(public token: Token) {
		super("ValueNode", token.posStart, token.posEnd);
	}

	toString(): string {
		return this.token.toString();
	}
}

export class UnaryOpNode extends BaseNode<"UnaryOpNode"> {
	constructor(public op: Token, public child: Node) {
		super("UnaryOpNode", op.posStart, child.posEnd);
	}

	toString(): string {
		return `(${this.op.toString()} ${this.child.toString()})`;
	}
}

export class BinaryOpNode extends BaseNode<"BinaryOpNode"> {
	constructor(public op: Token, public left: Node, public right: Node) {
		super("BinaryOpNode", left.posStart, right.posEnd);
	}

	toString(): string {
		return `(${this.left.toString()} ${this.op} ${this.right.toString()})`;
	}
}

export class VarAccessNode extends BaseNode<"VarAccessNode"> {
	constructor(public identifier: Token) {
		super("VarAccessNode", identifier.posStart, identifier.posEnd);
	}

	toString() {
		return `${this.identifier}`;
	}
}

export class VarAssignNode extends BaseNode<"VarAssignNode"> {
	constructor(public identifier: Token, public value: Node) {
		super("VarAssignNode", identifier.posStart, value.posEnd);
	}

	toString() {
		return `(set ${this.identifier}: ${this.value})`;
	}
}

export class IfNode extends BaseNode<"IfNode"> {
	constructor(
		public condition: Node,
		public thenBranch: Node,
		public elseBranch: Node | null = null
	) {
		super("IfNode", condition.posStart, (elseBranch ?? thenBranch).posEnd);
	}

	toString() {
		if (this.elseBranch)
			return `(${this.condition} ? ${this.thenBranch} : ${this.elseBranch})`;
		return `(${this.condition} ? ${this.thenBranch})`;
	}
}

export class ForNode extends BaseNode<"ForNode"> {
	constructor(
		public varName: Token,
		public start: Node,
		public end: Node,
		public step: Node | null = null,
		public body: Node
	) {
		super("ForNode", varName.posStart, body.posEnd);
	}

	toString() {
		if (this.step)
			return `(for ${this.varName}: ${this.start} to ${this.end} step ${this.step} do ${this.body})`;
		return `(for ${this.varName}: ${this.start} to ${this.end} do ${this.body})`;
	}
}

export class WhileNode extends BaseNode<"WhileNode"> {
	constructor(public condition: Node, public body: Node) {
		super("WhileNode", condition.posStart, body.posEnd);
	}

	toString() {
		return `(while ${this.condition} do ${this.body})`;
	}
}
