import { MessageId, noUnusedResult } from "./no-unused-result.js";
import { createCodeHelper, ruleTester } from "./utils/test-utils.js";

const preamble = `import { ok, err, okAsync, errAsync, Result, ResultAsync } from "antithrow";\n`;
const code = createCodeHelper(preamble);

ruleTester.run("no-unused-result", noUnusedResult, {
	valid: [
		{
			name: "assigned to variable",
			code: code`const x = ok(1);`,
		},
		{
			name: "assigned to underscore",
			code: code`let _ = ok(1);`,
		},
		{
			name: "returned from function",
			code: code`function f() { return ok(1); }`,
		},
		{
			name: "passed as argument",
			code: code`function foo(r: Result<number, never>) {} foo(ok(1));`,
		},
		{
			name: "explicit void discard",
			code: code`void ok(1);`,
		},
		{
			name: "chain ending in unwrap (non-Result)",
			code: code`ok(1).unwrap();`,
		},
		{
			name: "non-Result expression statement",
			code: code`42;`,
		},
		{
			name: "expression typed as any",
			code: code`JSON.parse("1");`,
		},
		{
			name: "void-returning function",
			code: code`console.log("hi");`,
		},
		{
			name: "ResultAsync assigned in async function",
			code: code`async function f() { const x = await okAsync(1); }`,
		},
		{
			name: "match returns non-Result",
			code: code`ok(1).match({ ok: (v) => v, err: (e) => 0 });`,
		},
		{
			name: "ternary with both branches voided",
			code: code`declare const cond: boolean;\ncond ? void ok(1) : void ok(2);`,
		},
		{
			name: "logical AND with voided Result",
			code: code`true && void ok(1);`,
		},
		{
			name: "entire ternary voided",
			code: code`declare const cond: boolean;\nvoid (cond ? ok(1) : ok(2));`,
		},
	],
	invalid: [
		{
			name: "bare ok() expression",
			code: code`ok(1);`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [{ messageId: MessageId.ADD_VOID, output: code`void ok(1);` }],
				},
			],
		},
		{
			name: "bare err() expression",
			code: code`err("x");`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [{ messageId: MessageId.ADD_VOID, output: code`void err("x");` }],
				},
			],
		},
		{
			name: "chain still produces Result (map), unused",
			code: code`ok(1).map(x => x + 1);`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [
						{ messageId: MessageId.ADD_VOID, output: code`void ok(1).map(x => x + 1);` },
					],
				},
			],
		},
		{
			name: "bare okAsync() expression",
			code: code`okAsync(1);`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [{ messageId: MessageId.ADD_VOID, output: code`void okAsync(1);` }],
				},
			],
		},
		{
			name: "function returning Result, unused",
			code: code`function getResult(): Result<number, string> { return ok(1); } getResult();`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [
						{
							messageId: MessageId.ADD_VOID,
							output: code`function getResult(): Result<number, string> { return ok(1); } void getResult();`,
						},
					],
				},
			],
		},
		{
			name: "awaited okAsync produces Result, unused",
			code: code`async function f() { await okAsync(1); }`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [
						{
							messageId: MessageId.ADD_VOID,
							output: code`async function f() { void await okAsync(1); }`,
						},
					],
				},
			],
		},
		{
			name: "chain producing Result (mapErr), unused",
			code: code`ok(1).mapErr(e => e);`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [
						{ messageId: MessageId.ADD_VOID, output: code`void ok(1).mapErr(e => e);` },
					],
				},
			],
		},
		{
			name: "bare errAsync() expression",
			code: code`errAsync("x");`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [{ messageId: MessageId.ADD_VOID, output: code`void errAsync("x");` }],
				},
			],
		},
		{
			name: "Result with ts as-cast, unused",
			code: code`ok(1) as Result<number, never>;`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [
						{
							messageId: MessageId.ADD_VOID,
							output: code`void (ok(1) as Result<number, never>);`,
						},
					],
				},
			],
		},
		{
			name: "Result with non-null assertion, unused",
			code: code`declare const r: Result<number, string> | undefined;\nr!;`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [
						{
							messageId: MessageId.ADD_VOID,
							output: code`declare const r: Result<number, string> | undefined;\nvoid r!;`,
						},
					],
				},
			],
		},
		{
			name: "optional chain producing Result, unused",
			code: code`declare const o: { f(): Result<number, string> } | undefined;\no?.f();`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [
						{
							messageId: MessageId.ADD_VOID,
							output: code`declare const o: { f(): Result<number, string> } | undefined;\nvoid o?.f();`,
						},
					],
				},
			],
		},
		{
			name: "ternary with both branches producing Result",
			code: code`declare const cond: boolean;\ncond ? ok(1) : ok(2);`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [
						{
							messageId: MessageId.ADD_VOID,
							output: code`declare const cond: boolean;\nvoid (cond ? ok(1) : ok(2));`,
						},
					],
				},
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [
						{
							messageId: MessageId.ADD_VOID,
							output: code`declare const cond: boolean;\nvoid (cond ? ok(1) : ok(2));`,
						},
					],
				},
			],
		},
		{
			name: "logical AND producing Result",
			code: code`true && ok(1);`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [{ messageId: MessageId.ADD_VOID, output: code`void (true && ok(1));` }],
				},
			],
		},
		{
			name: "comma operator with non-final Result discarded",
			code: code`ok(1), console.log("hi");`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [
						{
							messageId: MessageId.ADD_VOID,
							output: code`void (ok(1), console.log("hi"));`,
						},
					],
				},
			],
		},
		{
			name: "logical OR producing Result",
			code: code`false || ok(1);`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [{ messageId: MessageId.ADD_VOID, output: code`void (false || ok(1));` }],
				},
			],
		},
		{
			name: "nullish coalescing producing Result",
			code: code`declare const cond: null | number;\ncond ?? ok(1);`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [
						{
							messageId: MessageId.ADD_VOID,
							output: code`declare const cond: null | number;\nvoid (cond ?? ok(1));`,
						},
					],
				},
			],
		},
		{
			name: "unary operator + on Result",
			code: code`+ ok(1);`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [{ messageId: MessageId.ADD_VOID, output: code`void + ok(1);` }],
				},
			],
		},
		{
			name: "unary operator - on Result",
			code: code`- ok(1);`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [{ messageId: MessageId.ADD_VOID, output: code`void - ok(1);` }],
				},
			],
		},
		{
			name: "unary operator ! on Result",
			code: code`! ok(1);`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [{ messageId: MessageId.ADD_VOID, output: code`void ! ok(1);` }],
				},
			],
		},
		{
			name: "unary operator ~ on Result",
			code: code`~ ok(1);`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [
						{
							messageId: MessageId.ADD_VOID,
							output: code`void ~ ok(1);`,
						},
					],
				},
			],
		},
		{
			name: "unary operator typeof on Result",
			code: code`typeof ok(1);`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [{ messageId: MessageId.ADD_VOID, output: code`void typeof ok(1);` }],
				},
			],
		},
		{
			name: "unary operator delete on Result",
			code: code`delete ok(1);`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [{ messageId: MessageId.ADD_VOID, output: code`void delete ok(1);` }],
				},
			],
		},
	],
});
