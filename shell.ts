import chalk from "chalk";
import { createInterface } from "node:readline";

import { execute } from "./src/execute";

const readline = createInterface({
	input: process.stdin,
	output: process.stdout
});

function input(query: string) {
	return new Promise<string>(resolve => {
		readline.question(query, resolve);
	});
}

async function start() {
	while (true) {
		console.log();
		const code = await input(chalk.dim(`dpl> `));

		if (code === "exit") process.exit();
		if (code === "clear") {
			console.clear();
			continue;
		}

		const { value, error } = execute("<stdin>", code);

		if (error) console.log(error.toString());
		else console.log(chalk.green(value?.render()));
	}
}

start();
