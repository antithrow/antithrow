import { MessageId, noThrowingCall } from "./no-throwing-call.js";
import { ruleTester } from "./utils/test-utils.js";

ruleTester.run("no-throwing-call", noThrowingCall, {
	valid: [
		{
			name: "fetch imported from @antithrow/std",
			code: `import { fetch } from "@antithrow/std";\nfetch("https://example.com");`,
		},
		{
			name: "fetch shadowed by local variable",
			code: `const fetch = () => new Promise(() => {});\nfetch("https://example.com");`,
		},
		{
			name: "fetch shadowed by function parameter",
			code: `function wrapper(fetch: typeof globalThis.fetch) { fetch("https://example.com"); }`,
		},
		{
			name: "JSON imported from @antithrow/std",
			code: `import { JSON } from "@antithrow/std";\nJSON.parse("{}");`,
		},
		{
			name: "JSON shadowed by local variable",
			code: `const JSON = { parse: (s: string) => s };\nJSON.parse("{}");`,
		},
		{
			name: "json method on non-Response object",
			code: `const obj = { json: () => "test" };\nobj.json();`,
		},
		{
			name: "dynamic JSON method access is ignored",
			code: `const method = "parse" as string;\n(JSON as any)[method]("{}");`,
		},
		{
			name: "non-throwing global function is ignored",
			code: `setTimeout(() => {}, 100);`,
		},
		{
			name: "non-listed Response method is ignored",
			code: `declare const r: Response;\nr.clone();`,
		},
		{
			name: "json method on custom interface",
			code: `interface MyResponse { json(): Promise<unknown> }\ndeclare const r: MyResponse;\nr.json();`,
		},
		{
			name: "json method on generic with non-Response constraint",
			code: `function foo<T extends { json(): Promise<unknown> }>(obj: T) { obj.json(); }`,
		},
		{
			name: "shadowed globalThis is not detected",
			code: `const globalThis = { fetch: () => {} };\nglobalThis.fetch("https://example.com");`,
		},
		{
			name: "any-typed receiver is ignored",
			code: `declare const r: any;\nr.json();`,
		},
		{
			name: "bare reference to fetch without calling",
			code: `const f = fetch;\nvoid f;`,
		},
	],
	invalid: [
		{
			name: "global fetch call",
			code: `fetch("https://example.com");`,
			errors: [{ messageId: MessageId.THROWING_CALL, data: { api: "fetch" } }],
		},
		{
			name: "global atob call",
			code: `atob("aGVsbG8=");`,
			errors: [{ messageId: MessageId.THROWING_CALL, data: { api: "atob" } }],
		},
		{
			name: "global btoa call",
			code: `btoa("hello");`,
			errors: [{ messageId: MessageId.THROWING_CALL, data: { api: "btoa" } }],
		},
		{
			name: "global structuredClone call",
			code: `structuredClone({ a: 1 });`,
			errors: [{ messageId: MessageId.THROWING_CALL, data: { api: "structuredClone" } }],
		},
		{
			name: "global decodeURI call",
			code: `decodeURI("%E0%A4%A");`,
			errors: [{ messageId: MessageId.THROWING_CALL, data: { api: "decodeURI" } }],
		},
		{
			name: "global decodeURIComponent call",
			code: `decodeURIComponent("%E0%A4%A");`,
			errors: [{ messageId: MessageId.THROWING_CALL, data: { api: "decodeURIComponent" } }],
		},
		{
			name: "global encodeURI call",
			code: `encodeURI("https://example.com");`,
			errors: [{ messageId: MessageId.THROWING_CALL, data: { api: "encodeURI" } }],
		},
		{
			name: "global encodeURIComponent call",
			code: `encodeURIComponent("hello world");`,
			errors: [{ messageId: MessageId.THROWING_CALL, data: { api: "encodeURIComponent" } }],
		},
		{
			name: "JSON.parse call",
			code: `JSON.parse("{}");`,
			errors: [{ messageId: MessageId.THROWING_CALL, data: { api: "JSON.parse" } }],
		},
		{
			name: "JSON.stringify call",
			code: `JSON.stringify({ a: 1 });`,
			errors: [{ messageId: MessageId.THROWING_CALL, data: { api: "JSON.stringify" } }],
		},
		{
			name: "JSON.parse with bracket notation",
			code: `JSON["parse"]("{}");`,
			errors: [{ messageId: MessageId.THROWING_CALL, data: { api: "JSON.parse" } }],
		},
		{
			name: "JSON.parse with template literal notation",
			code: "JSON[`parse`](`{}`);",
			errors: [{ messageId: MessageId.THROWING_CALL, data: { api: "JSON.parse" } }],
		},
		{
			name: "response.json() on global Response",
			code: `const r = new Response();\nr.json();`,
			errors: [{ messageId: MessageId.THROWING_CALL, data: { api: "response.json" } }],
		},
		{
			name: "response.text() on global Response",
			code: `declare const r: Response;\nr.text();`,
			errors: [{ messageId: MessageId.THROWING_CALL, data: { api: "response.text" } }],
		},
		{
			name: "response.arrayBuffer() on global Response",
			code: `declare const r: Response;\nr.arrayBuffer();`,
			errors: [{ messageId: MessageId.THROWING_CALL, data: { api: "response.arrayBuffer" } }],
		},
		{
			name: "response.blob() on global Response",
			code: `declare const r: Response;\nr.blob();`,
			errors: [{ messageId: MessageId.THROWING_CALL, data: { api: "response.blob" } }],
		},
		{
			name: "response.formData() on global Response",
			code: `declare const r: Response;\nr.formData();`,
			errors: [{ messageId: MessageId.THROWING_CALL, data: { api: "response.formData" } }],
		},
		{
			name: "response.json() on optional Response",
			code: `declare const r: Response | undefined;\nr?.json();`,
			errors: [{ messageId: MessageId.THROWING_CALL, data: { api: "response.json" } }],
		},
		{
			name: "response.json() on intersection with Response",
			code: `declare const r: Response & { extra: string };\nr.json();`,
			errors: [{ messageId: MessageId.THROWING_CALL, data: { api: "response.json" } }],
		},
		{
			name: "response.json() on Response subclass",
			code: `class MyResponse extends Response {}\nconst r = new MyResponse();\nr.json();`,
			errors: [{ messageId: MessageId.THROWING_CALL, data: { api: "response.json" } }],
		},
		{
			name: "fetch in nested scope",
			code: `function inner() { fetch("https://example.com"); }`,
			errors: [{ messageId: MessageId.THROWING_CALL, data: { api: "fetch" } }],
		},
		{
			name: "globalThis.fetch call",
			code: `globalThis.fetch("https://example.com");`,
			errors: [{ messageId: MessageId.THROWING_CALL, data: { api: "fetch" } }],
		},
		{
			name: "window.fetch call",
			code: `window.fetch("https://example.com");`,
			errors: [{ messageId: MessageId.THROWING_CALL, data: { api: "fetch" } }],
		},
		{
			name: "self.atob call",
			code: `self.atob("aGVsbG8=");`,
			errors: [{ messageId: MessageId.THROWING_CALL, data: { api: "atob" } }],
		},
		{
			name: "globalThis.JSON.parse call",
			code: `globalThis.JSON.parse("{}");`,
			errors: [{ messageId: MessageId.THROWING_CALL, data: { api: "JSON.parse" } }],
		},
		{
			name: "window.JSON.stringify call",
			code: `window.JSON.stringify({ a: 1 });`,
			errors: [{ messageId: MessageId.THROWING_CALL, data: { api: "JSON.stringify" } }],
		},
		{
			name: "response.json() on generic type parameter extending Response",
			code: `function foo<T extends Response>(resp: T) { resp.json(); }`,
			errors: [{ messageId: MessageId.THROWING_CALL, data: { api: "response.json" } }],
		},
	],
});
