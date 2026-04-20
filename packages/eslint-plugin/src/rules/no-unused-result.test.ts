import { MessageId, noUnusedResult } from "./no-unused-result.js";
import { createCodeHelper, ruleTester } from "./utils/test-utils.js";

const preamble = `import { Ok, Err, Pending, Result, type Settled } from "antithrow";\n`;
const code = createCodeHelper(preamble);

ruleTester.run("no-unused-result", noUnusedResult, {
	valid: [
		{
			name: "assigned to variable",
			code: code`const x = new Ok(1);`,
		},
		{
			name: "assigned to underscore",
			code: code`let _ = new Ok(1);`,
		},
		{
			name: "returned from function",
			code: code`function f() { return new Ok(1); }`,
		},
		{
			name: "passed as argument",
			code: code`function foo(r: Settled<number, never>) {} foo(new Ok(1));`,
		},
		{
			name: "explicit void discard",
			code: code`void new Ok(1);`,
		},
		{
			name: "chain ending in unwrap (non-Result)",
			code: code`new Ok(1).unwrap();`,
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
			name: "Pending awaited in async function",
			code: code`async function f() { const x = await Result.try(async () => 1); }`,
		},
		{
			name: "mapOrElse returns non-Result",
			code: code`new Ok(1).mapOrElse((_error) => 0, (value) => value);`,
		},
		{
			name: "ternary with both branches voided",
			code: code`declare const cond: boolean;\ncond ? void new Ok(1) : void new Ok(2);`,
		},
		{
			name: "logical AND with voided Result",
			code: code`true && void new Ok(1);`,
		},
		{
			name: "entire ternary voided",
			code: code`declare const cond: boolean;\nvoid (cond ? new Ok(1) : new Ok(2));`,
		},
		{
			name: "legacy antithrow Ok is ignored",
			code: `import { ok } from "antithrow/legacy";\nok(1);`,
		},
	],
	invalid: [
		{
			name: "bare Ok expression",
			code: code`new Ok(1);`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [{ messageId: MessageId.ADD_VOID, output: code`void new Ok(1);` }],
				},
			],
		},
		{
			name: "bare Err expression",
			code: code`new Err("x");`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [{ messageId: MessageId.ADD_VOID, output: code`void new Err("x");` }],
				},
			],
		},
		{
			name: "chain still produces Result (map), unused",
			code: code`new Ok(1).map(x => x + 1);`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [
						{ messageId: MessageId.ADD_VOID, output: code`void new Ok(1).map(x => x + 1);` },
					],
				},
			],
		},
		{
			name: "bare Pending expression from Result.try",
			code: code`Result.try(async () => 1);`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [
						{
							messageId: MessageId.ADD_VOID,
							output: code`void Result.try(async () => 1);`,
						},
					],
				},
			],
		},
		{
			name: "function returning Settled, unused",
			code: code`function getResult(): Settled<number, string> { return new Ok(1); } getResult();`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [
						{
							messageId: MessageId.ADD_VOID,
							output: code`function getResult(): Settled<number, string> { return new Ok(1); } void getResult();`,
						},
					],
				},
			],
		},
		{
			name: "awaited Pending produces Settled, unused",
			code: code`async function f() { await Result.try(async () => 1); }`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [
						{
							messageId: MessageId.ADD_VOID,
							output: code`async function f() { void await Result.try(async () => 1); }`,
						},
					],
				},
			],
		},
		{
			name: "chain producing Result (mapErr), unused",
			code: code`new Ok(1).mapErr(e => e);`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [
						{ messageId: MessageId.ADD_VOID, output: code`void new Ok(1).mapErr(e => e);` },
					],
				},
			],
		},
		{
			name: "bare Pending identifier expression",
			code: code`declare const pending: Pending<number, string>;\npending;`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [
						{
							messageId: MessageId.ADD_VOID,
							output: code`declare const pending: Pending<number, string>;\nvoid pending;`,
						},
					],
				},
			],
		},
		{
			name: "Result with ts as-cast, unused",
			code: code`new Ok(1) as Settled<number, never>;`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [
						{
							messageId: MessageId.ADD_VOID,
							output: code`void (new Ok(1) as Settled<number, never>);`,
						},
					],
				},
			],
		},
		{
			name: "Result with non-null assertion, unused",
			code: code`declare const r: Settled<number, string> | undefined;\nr!;`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [
						{
							messageId: MessageId.ADD_VOID,
							output: code`declare const r: Settled<number, string> | undefined;\nvoid r!;`,
						},
					],
				},
			],
		},
		{
			name: "optional chain producing Result, unused",
			code: code`declare const o: { f(): Settled<number, string> } | undefined;\no?.f();`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [
						{
							messageId: MessageId.ADD_VOID,
							output: code`declare const o: { f(): Settled<number, string> } | undefined;\nvoid o?.f();`,
						},
					],
				},
			],
		},
		{
			name: "ternary with both branches producing Result",
			code: code`declare const cond: boolean;\ncond ? new Ok(1) : new Ok(2);`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [
						{
							messageId: MessageId.ADD_VOID,
							output: code`declare const cond: boolean;\nvoid (cond ? new Ok(1) : new Ok(2));`,
						},
					],
				},
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [
						{
							messageId: MessageId.ADD_VOID,
							output: code`declare const cond: boolean;\nvoid (cond ? new Ok(1) : new Ok(2));`,
						},
					],
				},
			],
		},
		{
			name: "logical AND producing Result",
			code: code`true && new Ok(1);`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [{ messageId: MessageId.ADD_VOID, output: code`void (true && new Ok(1));` }],
				},
			],
		},
		{
			name: "comma operator with non-final Result discarded",
			code: code`new Ok(1), console.log("hi");`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [
						{
							messageId: MessageId.ADD_VOID,
							output: code`void (new Ok(1), console.log("hi"));`,
						},
					],
				},
			],
		},
		{
			name: "logical OR producing Result",
			code: code`false || new Ok(1);`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [
						{ messageId: MessageId.ADD_VOID, output: code`void (false || new Ok(1));` },
					],
				},
			],
		},
		{
			name: "nullish coalescing producing Result",
			code: code`declare const cond: null | number;\ncond ?? new Ok(1);`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [
						{
							messageId: MessageId.ADD_VOID,
							output: code`declare const cond: null | number;\nvoid (cond ?? new Ok(1));`,
						},
					],
				},
			],
		},
		{
			name: "unary operator + on Result",
			code: code`+ new Ok(1);`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [{ messageId: MessageId.ADD_VOID, output: code`void + new Ok(1);` }],
				},
			],
		},
		{
			name: "unary operator - on Result",
			code: code`- new Ok(1);`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [{ messageId: MessageId.ADD_VOID, output: code`void - new Ok(1);` }],
				},
			],
		},
		{
			name: "unary operator ! on Result",
			code: code`! new Ok(1);`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [{ messageId: MessageId.ADD_VOID, output: code`void ! new Ok(1);` }],
				},
			],
		},
		{
			name: "unary operator ~ on Result",
			code: code`~ new Ok(1);`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [
						{
							messageId: MessageId.ADD_VOID,
							output: code`void ~ new Ok(1);`,
						},
					],
				},
			],
		},
		{
			name: "unary operator typeof on Result",
			code: code`typeof new Ok(1);`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [{ messageId: MessageId.ADD_VOID, output: code`void typeof new Ok(1);` }],
				},
			],
		},
		{
			name: "unary operator delete on Result",
			code: code`delete new Ok(1);`,
			errors: [
				{
					messageId: MessageId.UNUSED_RESULT,
					suggestions: [{ messageId: MessageId.ADD_VOID, output: code`void delete new Ok(1);` }],
				},
			],
		},
	],
});
