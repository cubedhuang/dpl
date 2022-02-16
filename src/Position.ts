export interface PositionOptions {
	i: number;
	line: number;
	column: number;
	file: string;
	input: string;
}

export class Position {
	i: number;
	line: number;
	col: number;
	file: string;
	input: string;

	constructor({ i, line, column, file, input }: PositionOptions) {
		this.i = i;
		this.line = line;
		this.col = column;
		this.file = file;
		this.input = input;
	}

	advance(currentChar = "") {
		this.i++;

		if (currentChar === "\n") {
			this.line++;
			this.col = 0;
		} else {
			this.col++;
		}

		return this;
	}

	copy() {
		return new Position({
			i: this.i,
			line: this.line,
			column: this.col,
			file: this.file,
			input: this.input
		});
	}
}
