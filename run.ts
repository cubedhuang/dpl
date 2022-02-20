import { readFileSync } from "node:fs";

import { execute } from "./src/execute";

const file = process.argv[2] ?? "test.dpl";

const code = readFileSync(`./${file}`, "utf8");

console.log();

const timeBefore = process.hrtime.bigint();
const { error } = execute(file, code);
const timeAfter = process.hrtime.bigint();

if (error) console.log(error.toString());

console.log(
	`\nEvaluation took ${Number(timeAfter - timeBefore) / 1_000_000}ms.`
);
