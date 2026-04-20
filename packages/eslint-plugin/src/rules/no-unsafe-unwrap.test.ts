import { MessageId, noUnsafeUnwrap } from "./no-unsafe-unwrap.js";
import { createCodeHelper, ruleTester } from "./utils/test-utils.js";

const preamble = `import { Ok, Err, Pending, Result, type Settled } from "antithrow";\n`;
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
			name: "safe result api mapOr",
			code: code`new Ok(1).mapOr(0, (value) => value);`,
		},
		{
			name: "safe result api unwrapOr",
			code: code`new Ok(1).unwrapOr(0);`,
		},
		{
			name: "dynamic bracket access is ignored",
			code: code`const result = new Ok(1);\nconst method = "unwrap";\nresult[method]();`,
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
			code: code`const method = "unwrap" as const;\nfunction take({ [method]: fn }: Settled<number, string>) { return fn; }`,
		},
		{
			name: "computed identifier key destructuring is ignored",
			code: code`const result = new Ok(1);\nconst method = "unwrap" as const;\nconst { [method]: fn } = result;`,
		},
		{
			name: "destructuring non-banned property from Result is allowed",
			code: code`const result = new Ok(1);\nconst { map } = result;`,
		},
		{
			name: "numeric literal key destructuring is ignored",
			code: `const values = { 1: "one" };\nconst { 1: one } = values;\nvoid one;`,
		},
		{
			name: "legacy antithrow unwrap is ignored",
			code: `import { ok } from "antithrow/legacy";\nok(1).unwrap();`,
		},
	],
	invalid: [
		{
			name: "unwrap call on Ok",
			code: code`new Ok(1).unwrap();`,
			output: code`new Ok(1).value;`,
			errors: [{ messageId: MessageId.UNWRAP_OK_VALUE }],
		},
		{
			name: "escaped unwrap identifier on Ok is reported without autofix",
			code: code`new Ok(1).unw\\u0072ap();`,
			output: null,
			errors: [{ messageId: MessageId.UNWRAP_OK_VALUE }],
		},
		{
			name: "unwrapErr call on Err",
			code: code`new Err("x").unwrapErr();`,
			output: code`new Err("x").error;`,
			errors: [{ messageId: MessageId.UNWRAP_ERR_ERROR }],
		},
		{
			name: "escaped unwrapErr identifier on Err is reported without autofix",
			code: code`new Err("x").unwrap\\u0045rr();`,
			output: null,
			errors: [{ messageId: MessageId.UNWRAP_ERR_ERROR }],
		},
		{
			name: "unwrap call on Err",
			code: code`new Err("x").unwrap();`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "unwrapErr call on Ok",
			code: code`new Ok(1).unwrapErr();`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "unwrap call on Pending",
			code: code`declare const pending: Pending<number, string>;\npending.unwrap();`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "unwrapErr call on Pending",
			code: code`declare const pending: Pending<number, string>;\npending.unwrapErr();`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "optional unwrap call on Settled",
			code: code`declare const result: Settled<number, string> | undefined;\nresult?.unwrap();`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "optional unwrap call on optional Ok",
			code: code`declare const result: Ok<number, never> | undefined;\nresult?.unwrap();`,
			output: code`declare const result: Ok<number, never> | undefined;\nresult?.value;`,
			errors: [{ messageId: MessageId.UNWRAP_OK_VALUE }],
		},
		{
			name: "optional computed unwrap call on optional Ok",
			code: code`declare const result: Ok<number, never> | undefined;\nresult?.["unwrap"]();`,
			output: code`declare const result: Ok<number, never> | undefined;\nresult?.value;`,
			errors: [{ messageId: MessageId.UNWRAP_OK_VALUE }],
		},
		{
			name: "unwrap call on Result union (includes Pending)",
			code: code`declare const result: Result<number, string>;\nresult.unwrap();`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "unwrap call on Settled union",
			code: code`declare const result: Settled<number, string>;\nresult.unwrap();`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "unwrap call on mixed Ok and non-Result union",
			code: code`type Box = { unwrap(): number };\ndeclare const result: Ok<number, never> | Box;\nresult.unwrap();`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "static bracket unwrap",
			code: code`const result = new Ok(1);\nresult["unwrap"]();`,
			output: code`const result = new Ok(1);\nresult.value;`,
			errors: [{ messageId: MessageId.UNWRAP_OK_VALUE }],
		},
		{
			name: "static template bracket unwrap on Pending",
			code: code`declare const pending: Pending<number, string>;\npending[\`unwrap\`]();`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "property extraction from Result",
			code: code`const result = new Ok(1);\nconst fn = result.unwrap;`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "destructuring extraction from Result",
			code: code`const result = new Ok(1);\nconst { unwrap } = result;`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "destructuring extraction alias from Result",
			code: code`const result = new Err("x");\nconst { unwrapErr: unwrapError } = result;`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "assignment destructuring extraction from Result",
			code: code`const result = new Ok(1);\nlet unwrap: (() => number) | undefined;\n({ unwrap } = result);`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "computed literal key destructuring extraction from Result",
			code: code`const result = new Ok(1);\nconst { ["unwrap"]: fn } = result;`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "computed template key destructuring extraction from Result",
			code: code`const result = new Err("x");\nconst { [\`unwrapErr\`]: fn } = result;`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "string literal key destructuring extraction from Result",
			code: code`const result = new Ok(1);\nconst { "unwrap": fn } = result;`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "destructured function parameter from Settled",
			code: code`function take({ unwrap }: Settled<number, string>) { return unwrap; }`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
		{
			name: "destructured for-of loop from Settled",
			code: code`declare const results: Settled<number, string>[];\nfor (const { unwrap } of results) { void unwrap; }`,
			errors: [{ messageId: MessageId.UNSAFE_UNWRAP }],
		},
	],
});
