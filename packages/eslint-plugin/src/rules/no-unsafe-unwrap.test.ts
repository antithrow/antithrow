import { MessageId, noUnsafeUnwrap } from "./no-unsafe-unwrap.js";
import { createCodeHelper, ruleTester } from "./utils/test-utils.js";

const preamble = `import { ok, err, okAsync, errAsync, Result } from "antithrow";\n`;
const code = createCodeHelper(preamble);

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
			code: code`ok(1).match({ ok: (value) => value, err: (_error) => 0 });`,
		},
		{
			name: "safe result api unwrapOr",
			code: code`ok(1).unwrapOr(0);`,
		},
		{
			name: "dynamic bracket access is ignored",
			code: code`const result = ok(1);\nconst method = "unwrap";\nresult[method]();`,
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
			code: code`const method = "unwrap" as const;\nfunction take({ [method]: fn }: Result<number, string>) { return fn; }`,
		},
		{
			name: "computed identifier key destructuring is ignored",
			code: code`const result = ok(1);\nconst method = "unwrap" as const;\nconst { [method]: fn } = result;`,
		},
		{
			name: "destructuring non-banned property from Result is allowed",
			code: code`const result = ok(1);\nconst { map } = result;`,
		},
		{
			name: "numeric literal key destructuring is ignored",
			code: `const values = { 1: "one" };\nconst { 1: one } = values;\nvoid one;`,
		},
	],
	invalid: [
		{
			name: "unwrap call on Result",
			code: code`ok(1).unwrap();`,
			output: code`ok(1).value;`,
			errors: [{ messageId: MessageId.UNWRAP_OK_VALUE }],
		},
		{
			name: "escaped unwrap identifier on Ok is reported without autofix",
			code: code`ok(1).unw\\u0072ap();`,
			output: null,
			errors: [{ messageId: MessageId.UNWRAP_OK_VALUE }],
		},
		{
			name: "unwrapErr call on Result",
			code: code`err("x").unwrapErr();`,
			output: code`err("x").error;`,
			errors: [{ messageId: MessageId.UNWRAP_ERR_ERROR }],
		},
		{
			name: "escaped unwrapErr identifier on Err is reported without autofix",
			code: code`err("x").unwrap\\u0045rr();`,
			output: null,
			errors: [{ messageId: MessageId.UNWRAP_ERR_ERROR }],
		},
		{
			name: "expect call on Result",
			code: code`ok(1).expect("expected value");`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "expectErr call on Result",
			code: code`err("x").expectErr("expected error");`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "unwrap call on ResultAsync",
			code: code`okAsync(1).unwrap();`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "expectErr call on ResultAsync",
			code: code`errAsync("x").expectErr("expected error");`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "optional unwrap call",
			code: code`declare const result: Result<number, string> | undefined;\nresult?.unwrap();`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "optional unwrap call on optional Ok",
			code: code`declare const result: ReturnType<typeof ok> | undefined;\nresult?.unwrap();`,
			output: code`declare const result: ReturnType<typeof ok> | undefined;\nresult?.value;`,
			errors: [{ messageId: MessageId.UNWRAP_OK_VALUE }],
		},
		{
			name: "optional computed unwrap call on optional Ok",
			code: code`declare const result: ReturnType<typeof ok> | undefined;\nresult?.["unwrap"]();`,
			output: code`declare const result: ReturnType<typeof ok> | undefined;\nresult?.value;`,
			errors: [{ messageId: MessageId.UNWRAP_OK_VALUE }],
		},
		{
			name: "unwrap call on unresolved Result union",
			code: code`declare const result: Result<number, string>;\nresult.unwrap();`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "unwrap call on mixed Ok and non-Result union",
			code: code`type Box = { unwrap(): number };\ndeclare const result: ReturnType<typeof ok> | Box;\nresult.unwrap();`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "static bracket unwrap",
			code: code`const result = ok(1);\nresult["unwrap"]();`,
			output: code`const result = ok(1);\nresult.value;`,
			errors: [{ messageId: MessageId.UNWRAP_OK_VALUE }],
		},
		{
			name: "static template bracket expect",
			code: code`const result = err("x");\nresult[\`expectErr\`]("expected error");`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "property extraction from Result",
			code: code`const result = ok(1);\nconst fn = result.unwrap;`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "destructuring extraction from Result",
			code: code`const result = ok(1);\nconst { unwrap } = result;`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "destructuring extraction alias from Result",
			code: code`const result = err("x");\nconst { expectErr: unwrapError } = result;`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "assignment destructuring extraction from Result",
			code: code`const result = ok(1);\nlet unwrap: (() => number) | undefined;\n({ unwrap } = result);`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "computed literal key destructuring extraction from Result",
			code: code`const result = ok(1);\nconst { ["unwrap"]: fn } = result;`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "computed template key destructuring extraction from Result",
			code: code`const result = err("x");\nconst { [\`expectErr\`]: fn } = result;`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "string literal key destructuring extraction from Result",
			code: code`const result = ok(1);\nconst { "unwrap": fn } = result;`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "destructured function parameter from Result",
			code: code`function take({ unwrap }: Result<number, string>) { return unwrap; }`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "destructured for-of loop from Result",
			code: code`declare const results: Result<number, string>[];\nfor (const { unwrap } of results) { void unwrap; }`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
	],
});
