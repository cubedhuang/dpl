import { Context } from "./Context";
import { Interpreter } from "./Interpreter";
import { Lexer } from "./Lexer";
import { Parser } from "./Parser";
import { SymbolTable } from "./SymbolTable";
import { DPLBuiltInFunction, DPLNumber } from "./values";

let globalSymbolTable = new SymbolTable();
globalSymbolTable.set("pi", new DPLNumber(Math.PI));

globalSymbolTable.set("print", new DPLBuiltInFunction("print"));
globalSymbolTable.set("prompt", new DPLBuiltInFunction("prompt"));

export function execute(file: string, input: string) {
	const lexer = new Lexer(file, input);
	const { tokens, error: lexError } = lexer.getTokens();

	if (lexError) return { value: null, error: lexError };

	const parser = new Parser(tokens);
	const { node: ast, error: parseError } = parser.parse();

	if (parseError) return { value: null, error: parseError };

	const interpreter = new Interpreter();
	const context = new Context("<program>");
	context.symbolTable = globalSymbolTable;

	const result = interpreter.visit(ast, context);

	return result;
}
