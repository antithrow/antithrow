import { describe, expect, test } from "bun:test";
import { createCodeHelper } from "./test-utils.js";

describe("createCodeHelper", () => {
	test("prepends the preamble to static template content", () => {
		const code = createCodeHelper('import { ok } from "antithrow";\n');

		expect(code`ok(1);`).toBe('import { ok } from "antithrow";\nok(1);');
	});

	test("interpolates values in order and stringifies non-string values", () => {
		const code = createCodeHelper("const preamble = true;\n");
		const identifier = "value";
		const numericLiteral = 123;

		expect(code`const ${identifier} = ${numericLiteral};`).toBe(
			"const preamble = true;\nconst value = 123;",
		);
	});

	test("returns independent results across multiple calls", () => {
		const code = createCodeHelper("/* preamble */\n");

		expect(code`const a = 1;`).toBe("/* preamble */\nconst a = 1;");
		expect(code`const b = 2;`).toBe("/* preamble */\nconst b = 2;");
	});
});
