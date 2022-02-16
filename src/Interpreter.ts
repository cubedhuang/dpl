import { Context } from "./Context";
import { RuntimeError } from "./errors";
import {
	BinaryOpNode,
	CallNode,
	FnDefNode,
	ForNode,
	IfNode,
	Node,
	UnaryOpNode,
	ValueNode,
	VarAccessNode,
	VarAssignNode,
	WhileNode
} from "./nodes";
import {
	DPLBool,
	DPLFunction,
	DPLNone,
	DPLNumber,
	DPLString,
	DPLValue
} from "./values";

class RuntimeResult<Type extends DPLValue> {
	value!: Type;
	error: RuntimeError | null = null;

	register(res: RuntimeResult<Type>) {
		if (res.error) this.error = res.error;
		return res.value;
	}

	success(value: Type) {
		this.value = value;
		return this;
	}

	failure(error: RuntimeError) {
		this.error = error;
		return this;
	}
}

export class Interpreter {
	visit(node: Node, context: Context): RuntimeResult<DPLValue> {
		switch (node.type) {
			case "ValueNode":
				return this.visitValueNode(node, context);
			case "UnaryOpNode":
				return this.visitUnaryOpNode(node, context);
			case "BinaryOpNode":
				return this.visitBinaryOpNode(node, context);
			case "VarAccessNode":
				return this.visitVarAccessNode(node, context);
			case "VarAssignNode":
				return this.visitVarAssignNode(node, context);
			case "IfNode":
				return this.visitIfNode(node, context);
			case "ForNode":
				return this.visitForNode(node, context);
			case "WhileNode":
				return this.visitWhileNode(node, context);
			case "FnDefNode":
				return this.visitFnDefNode(node, context);
			case "CallNode":
				return this.visitCallNode(node, context);
		}
		// @ts-ignore
		throw new Error(`Unknown node type ${node.type}`);
	}

	visitValueNode(node: ValueNode, context: Context) {
		const res = new RuntimeResult();
		const Class =
			node.token.type === "NONE"
				? DPLNone
				: node.token.type === "NUMBER"
				? DPLNumber
				: node.token.type === "BOOL"
				? DPLBool
				: node.token.type === "STRING"
				? DPLString
				: null;

		if (Class === null) {
			return res.failure(
				new RuntimeError(
					node.token.posStart,
					node.token.posEnd,
					`Unknown token type ${node.token.type}`,
					context
				)
			);
		}

		return res.success(
			new Class(node.token.value)
				.setPos(node.posStart, node.posEnd)
				.setContext(context)
		);
	}

	visitUnaryOpNode(node: UnaryOpNode, context: Context) {
		const res = new RuntimeResult();

		const child = res.register(this.visit(node.child, context));
		if (res.error) return res;

		const [result, error] = child.unaryOp(node.op.type);

		if (error) return res.failure(error);
		return res.success(result!.setPos(node.posStart, node.posEnd));
	}

	visitBinaryOpNode(node: BinaryOpNode, context: Context) {
		const res = new RuntimeResult();

		const left = res.register(this.visit(node.left, context));
		if (res.error) return res;
		const right = res.register(this.visit(node.right, context));
		if (res.error) return res;

		const [result, error] = left.binaryOp(node.op.type, right);

		if (error) return res.failure(error);
		return res.success(result!.setPos(node.posStart, node.posEnd));
	}

	visitVarAccessNode(node: VarAccessNode, context: Context) {
		const res = new RuntimeResult();

		const value = context.symbolTable.get(node.identifier.value);
		if (value === null) {
			return res.failure(
				new RuntimeError(
					node.posStart,
					node.posEnd,
					`Undefined variable '${node.identifier.value}'`,
					context
				)
			);
		}

		return res.success(
			value.copy().setPos(node.posStart, node.posEnd).setContext(context)
		);
	}

	visitVarAssignNode(node: VarAssignNode, context: Context) {
		const res = new RuntimeResult();

		const value = res.register(this.visit(node.value, context));
		if (res.error) return res;

		context.symbolTable.set(node.identifier.value, value);
		return res.success(value!);
	}

	visitIfNode(node: IfNode, context: Context) {
		const res = new RuntimeResult();

		const condition = res.register(this.visit(node.condition, context));
		if (res.error) return res;

		if (condition.type !== "BOOL") {
			return res.failure(
				new RuntimeError(
					condition.posStart!,
					condition.posEnd!,
					`Condition should be type BOOL, got ${condition.type}`,
					context
				)
			);
		}

		if (condition.value) {
			const value = res.register(this.visit(node.thenBranch, context));
			if (res.error) return res;

			return res.success(value);
		}

		if (node.elseBranch) {
			const value = res.register(this.visit(node.elseBranch, context));
			if (res.error) return res;

			return res.success(value);
		}

		return res.success(
			new DPLNone().setPos(node.posStart, node.posEnd).setContext(context)
		);
	}

	visitForNode(node: ForNode, context: Context) {
		const res = new RuntimeResult();

		const varName = node.varName.value;
		const startValue = res.register(this.visit(node.start, context));
		if (res.error) return res;
		const endValue = res.register(this.visit(node.end, context));
		if (res.error) return res;
		const stepValue = node.step
			? res.register(this.visit(node.step, context))
			: new DPLNumber(1)
					.setPos(endValue.posStart, endValue.posEnd)
					.setContext(context);

		if (startValue.type !== "NUMBER") {
			return res.failure(
				new RuntimeError(
					startValue.posStart!,
					startValue.posEnd!,
					`Start value should be type NUMBER, got ${startValue.type}`,
					context
				)
			);
		}

		if (endValue.type !== "NUMBER") {
			return res.failure(
				new RuntimeError(
					endValue.posStart!,
					endValue.posEnd!,
					`End value should be type NUMBER, got ${endValue.type}`,
					context
				)
			);
		}

		if (stepValue.type !== "NUMBER") {
			return res.failure(
				new RuntimeError(
					stepValue.posStart!,
					stepValue.posEnd!,
					`Step value should be type NUMBER, got ${stepValue.type}`,
					context
				)
			);
		}

		let i = startValue.value;
		const end = endValue.value;
		const step = stepValue.value;

		while (step > 0 ? i <= end : i >= end) {
			context.symbolTable.set(varName, new DPLNumber(i));
			i += step;

			res.register(this.visit(node.body, context));
			if (res.error) return res;
		}

		return res.success(
			new DPLNone().setPos(node.posStart, node.posEnd).setContext(context)
		);
	}

	visitWhileNode(node: WhileNode, context: Context) {
		const res = new RuntimeResult();

		while (true) {
			const condition = res.register(this.visit(node.condition, context));
			if (res.error) return res;

			if (condition.type !== "BOOL") {
				return res.failure(
					new RuntimeError(
						condition.posStart!,
						condition.posEnd!,
						`Condition should be type BOOL, got ${condition.type}`,
						context
					)
				);
			}

			if (!condition.value) break;

			res.register(this.visit(node.body, context));
			if (res.error) return res;
		}

		return res.success(
			new DPLNone().setPos(node.posStart, node.posEnd).setContext(context)
		);
	}

	visitFnDefNode(node: FnDefNode, context: Context) {
		const res = new RuntimeResult();

		const name = node.name?.value ?? null;

		const fn = new DPLFunction(
			name,
			node.body,
			node.params.map(param => param.value)
		)
			.setPos(node.posStart, node.posEnd)
			.setContext(context);

		if (name) context.symbolTable.set(name, fn);

		return res.success(fn);
	}

	visitCallNode(node: CallNode, context: Context) {
		const res = new RuntimeResult();

		let fn = res.register(this.visit(node.fn, context));
		if (res.error) return res;

		fn = fn.copy().setPos(node.posStart, node.posEnd);

		const args = [];

		for (const arg of node.args) {
			args.push(res.register(this.visit(arg, context)));
			if (res.error) return res;
		}

		const [result, error] = fn.call(args);
		if (error) return res.failure(error);
		return res.success(result!);
	}
}
