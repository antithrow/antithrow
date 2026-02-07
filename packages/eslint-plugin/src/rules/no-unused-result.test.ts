import { afterAll, describe, test } from "bun:test";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { noUnusedResult } from "./no-unused-result.js";

RuleTester.describe = describe;
RuleTester.describeSkip = describe.skip;
RuleTester.it = test;
RuleTester.itSkip = test.skip;
RuleTester.afterAll = afterAll;

const ruleTester = new RuleTester({
	languageOptions: {
		parserOptions: {
			projectService: {
				allowDefaultProject: ["*.ts"],
			},
			tsconfigRootDir: import.meta.dirname,
		},
	},
});

const preamble = `import { ok, err, okAsync, errAsync, Result, ResultAsync } from "antithrow";\n`;

ruleTester.run("no-unused-result", noUnusedResult, {
	valid: [
		{
			name: "assigned to variable",
			code: `${preamble}const x = ok(1);`,
		},
		{
			name: "assigned to underscore",
			code: `${preamble}let _ = ok(1);`,
		},
		{
			name: "returned from function",
			code: `${preamble}function f() { return ok(1); }`,
		},
		{
			name: "passed as argument",
			code: `${preamble}function foo(r: Result<number, never>) {} foo(ok(1));`,
		},
		{
			name: "explicit void discard",
			code: `${preamble}void ok(1);`,
		},
		{
			name: "chain ending in unwrap (non-Result)",
			code: `${preamble}ok(1).unwrap();`,
		},
		{
			name: "non-Result expression statement",
			code: `${preamble}42;`,
		},
		{
			name: "expression typed as any",
			code: `${preamble}JSON.parse("1");`,
		},
		{
			name: "void-returning function",
			code: `${preamble}console.log("hi");`,
		},
		{
			name: "ResultAsync assigned in async function",
			code: `${preamble}async function f() { const x = await okAsync(1); }`,
		},
		{
			name: "match returns non-Result",
			code: `${preamble}ok(1).match({ ok: (v) => v, err: (e) => 0 });`,
		},
		{
			name: "ternary with both branches voided",
			code: `${preamble}declare const cond: boolean;\ncond ? void ok(1) : void ok(2);`,
		},
		{
			name: "logical AND with voided Result",
			code: `${preamble}true && void ok(1);`,
		},
		{
			name: "entire ternary voided",
			code: `${preamble}declare const cond: boolean;\nvoid (cond ? ok(1) : ok(2));`,
		},
	],
	invalid: [
		{
			name: "bare ok() expression",
			code: `${preamble}ok(1);`,
			errors: [{ messageId: "unusedResult" }],
		},
		{
			name: "bare err() expression",
			code: `${preamble}err("x");`,
			errors: [{ messageId: "unusedResult" }],
		},
		{
			name: "chain still produces Result (map), unused",
			code: `${preamble}ok(1).map(x => x + 1);`,
			errors: [{ messageId: "unusedResult" }],
		},
		{
			name: "bare okAsync() expression",
			code: `${preamble}okAsync(1);`,
			errors: [{ messageId: "unusedResult" }],
		},
		{
			name: "function returning Result, unused",
			code: `${preamble}function getResult(): Result<number, string> { return ok(1); } getResult();`,
			errors: [{ messageId: "unusedResult" }],
		},
		{
			name: "awaited okAsync produces Result, unused",
			code: `${preamble}async function f() { await okAsync(1); }`,
			errors: [{ messageId: "unusedResult" }],
		},
		{
			name: "chain producing Result (mapErr), unused",
			code: `${preamble}ok(1).mapErr(e => e);`,
			errors: [{ messageId: "unusedResult" }],
		},
		{
			name: "bare errAsync() expression",
			code: `${preamble}errAsync("x");`,
			errors: [{ messageId: "unusedResult" }],
		},
		{
			name: "Result with ts as-cast, unused",
			code: `${preamble}ok(1) as Result<number, never>;`,
			errors: [{ messageId: "unusedResult" }],
		},
		{
			name: "Result with non-null assertion, unused",
			code: `${preamble}declare const r: Result<number, string> | undefined;\nr!;`,
			errors: [{ messageId: "unusedResult" }],
		},
		{
			name: "optional chain producing Result, unused",
			code: `${preamble}declare const o: { f(): Result<number, string> } | undefined;\no?.f();`,
			errors: [{ messageId: "unusedResult" }],
		},
		{
			name: "ternary with both branches producing Result",
			code: `${preamble}declare const cond: boolean;\ncond ? ok(1) : ok(2);`,
			errors: [{ messageId: "unusedResult" }, { messageId: "unusedResult" }],
		},
		{
			name: "logical AND producing Result",
			code: `${preamble}true && ok(1);`,
			errors: [{ messageId: "unusedResult" }],
		},
		{
			name: "comma operator with non-final Result discarded",
			code: `${preamble}ok(1), console.log("hi");`,
			errors: [{ messageId: "unusedResult" }],
		},
		{
			name: "logical OR producing Result",
			code: `${preamble}false || ok(1);`,
			errors: [{ messageId: "unusedResult" }],
		},
		{
			name: "nullish coalescing producing Result",
			code: `${preamble}declare const cond: null | number;\ncond ?? ok(1);`,
			errors: [{ messageId: "unusedResult" }],
		},
		{
			name: "unary operator + on Result",
			code: `${preamble}+ ok(1);`,
			errors: [{ messageId: "unusedResult" }],
		},
		{
			name: "unary operator - on Result",
			code: `${preamble}- ok(1);`,
			errors: [{ messageId: "unusedResult" }],
		},
		{
			name: "unary operator ! on Result",
			code: `${preamble}! ok(1);`,
			errors: [{ messageId: "unusedResult" }],
		},
		{
			name: "unary operator ~ on Result",
			code: `${preamble}~ ok(1);`,
			errors: [{ messageId: "unusedResult" }],
		},
		{
			name: "unary operator typeof on Result",
			code: `${preamble}typeof ok(1);`,
			errors: [{ messageId: "unusedResult" }],
		},
		{
			name: "unary operator delete on Result",
			code: `${preamble}delete ok(1);`,
			errors: [{ messageId: "unusedResult" }],
		},
	],
});
