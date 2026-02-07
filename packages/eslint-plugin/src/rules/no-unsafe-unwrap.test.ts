import { afterAll, describe, test } from "bun:test";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { MessageId, noUnsafeUnwrap } from "./no-unsafe-unwrap.js";

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

const preamble = `import { ok, err, okAsync, errAsync, Result } from "antithrow";\n`;

ruleTester.run("no-unsafe-unwrap", noUnsafeUnwrap, {
	valid: [
		{
			name: "non-antithrow object can call unwrap",
			code: `const box = { unwrap() { return 1; } };\nbox.unwrap();`,
		},
		{
			name: "local helper named unwrap is allowed",
			code: `function unwrap(value: number) { return value; }\nunwrap(1);`,
		},
		{
			name: "safe result api match",
			code: `${preamble}ok(1).match({ ok: (value) => value, err: (_error) => 0 });`,
		},
		{
			name: "safe result api unwrapOr",
			code: `${preamble}ok(1).unwrapOr(0);`,
		},
		{
			name: "dynamic bracket access is ignored",
			code: `${preamble}const result = ok(1);\nconst method = "unwrap";\nresult[method]();`,
		},
		{
			name: "destructuring from non-result object",
			code: `const box = { unwrap() { return 1; } };\nconst { unwrap } = box;\nunwrap();`,
		},
		{
			name: "any receiver is ignored",
			code: `declare const maybe: any;\nmaybe.unwrap();`,
		},
		{
			name: "computed identifier key destructuring in function parameter is ignored",
			code: `${preamble}const method = "unwrap" as const;\nfunction take({ [method]: fn }: Result<number, string>) { return fn; }`,
		},
		{
			name: "computed identifier key destructuring is ignored",
			code: `${preamble}const result = ok(1);\nconst method = "unwrap" as const;\nconst { [method]: fn } = result;`,
		},
		{
			name: "destructuring non-banned property from Result is allowed",
			code: `${preamble}const result = ok(1);\nconst { map } = result;`,
		},
		{
			name: "numeric literal key destructuring is ignored",
			code: `const values = { 1: "one" };\nconst { 1: one } = values;\nvoid one;`,
		},
	],
	invalid: [
		{
			name: "unwrap call on Result",
			code: `${preamble}ok(1).unwrap();`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "unwrapErr call on Result",
			code: `${preamble}err("x").unwrapErr();`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "expect call on Result",
			code: `${preamble}ok(1).expect("expected value");`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "expectErr call on Result",
			code: `${preamble}err("x").expectErr("expected error");`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "unwrap call on ResultAsync",
			code: `${preamble}okAsync(1).unwrap();`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "expectErr call on ResultAsync",
			code: `${preamble}errAsync("x").expectErr("expected error");`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "optional unwrap call",
			code: `${preamble}declare const result: Result<number, string> | undefined;\nresult?.unwrap();`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "static bracket unwrap",
			code: `${preamble}const result = ok(1);\nresult["unwrap"]();`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "static template bracket expect",
			code: `${preamble}const result = err("x");\nresult[\`expectErr\`]("expected error");`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "property extraction from Result",
			code: `${preamble}const result = ok(1);\nconst fn = result.unwrap;`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "destructuring extraction from Result",
			code: `${preamble}const result = ok(1);\nconst { unwrap } = result;`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "destructuring extraction alias from Result",
			code: `${preamble}const result = err("x");\nconst { expectErr: unwrapError } = result;`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "assignment destructuring extraction from Result",
			code: `${preamble}const result = ok(1);\nlet unwrap: (() => number) | undefined;\n({ unwrap } = result);`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "computed literal key destructuring extraction from Result",
			code: `${preamble}const result = ok(1);\nconst { ["unwrap"]: fn } = result;`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "computed template key destructuring extraction from Result",
			code: `${preamble}const result = err("x");\nconst { [\`expectErr\`]: fn } = result;`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "string literal key destructuring extraction from Result",
			code: `${preamble}const result = ok(1);\nconst { "unwrap": fn } = result;`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "destructured function parameter from Result",
			code: `${preamble}function take({ unwrap }: Result<number, string>) { return unwrap; }`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "destructured for-of loop from Result",
			code: `${preamble}declare const results: Result<number, string>[];\nfor (const { unwrap } of results) { void unwrap; }`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
	],
});
