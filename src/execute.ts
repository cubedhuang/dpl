import { Context } from "./Context";
import { Interpreter } from "./Interpreter";
import { Lexer } from "./Lexer";
import { Parser } from "./Parser";
import { SymbolTable } from "./SymbolTable";
import { DPLNumber } from "./values";

let globalSymbolTable = new SymbolTable();
globalSymbolTable.set("pi", new DPLNumber(Math.PI));

export function execute(file: string, input: string) {
	const lexer = new Lexer(file, input);
	const timeLexStart = process.hrtime.bigint();
	const { tokens, error: lexError } = lexer.getTokens();
	const timeLexEnd = process.hrtime.bigint();
	console.log(
		`Lexing took ${Number(timeLexEnd - timeLexStart) / 1_000_000}ms`
	);
	if (lexError) return { value: null, error: lexError };
	// console.log(tokens.map(t => t.toString()).join(" "));

	const parser = new Parser(tokens);
	const timeParseStart = process.hrtime.bigint();
	const { node: ast, error: parseError } = parser.parse();
	const timeParseEnd = process.hrtime.bigint();
	console.log(
		`Parsing took ${Number(timeParseEnd - timeParseStart) / 1_000_000}ms`
	);

	if (parseError) return { error: parseError };
	// console.log(parseError);
	// console.log(ast.toString());

	const interpreter = new Interpreter();
	const context = new Context("<program>");
	context.symbolTable = globalSymbolTable;

	const timeEvalStart = process.hrtime.bigint();
	const result = interpreter.visit(ast, context);
	const timeEvalEnd = process.hrtime.bigint();
	console.log(
		`Evaluation took ${Number(timeEvalEnd - timeEvalStart) / 1_000_000}ms`
	);

	return result;
}
