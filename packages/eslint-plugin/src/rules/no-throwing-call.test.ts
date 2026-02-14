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
			name: "shadowed window is not detected",
			code: `const window = { fetch: () => Promise.resolve(new Response()) };\nwindow.fetch("https://example.com");`,
		},
		{
			name: "shadowed self is not detected for JSON.parse",
			code: `const self = { JSON: { parse: (value: string) => value } };\nself.JSON.parse("{}");`,
		},
		{
			name: "any-typed receiver is ignored",
			code: `declare const r: any;\nr.json();`,
		},
		{
			name: "bare reference to fetch without calling",
			code: `const f = fetch;\nvoid f;`,
		},
		{
			name: "member call on call-expression object is ignored",
			code: `declare function makeClient(): { fetch(url: string): Promise<Response> };\nmakeClient().fetch("https://example.com");`,
		},
		{
			name: "nested member call with call-expression base is ignored",
			code: `declare function makeClient(): { nested: { fetch(url: string): Promise<Response> } };\nmakeClient().nested.fetch("https://example.com");`,
		},
		{
			name: "super constructor call is ignored",
			code: `class Base {\n\tconstructor() {}\n}\nclass Child extends Base {\n\tconstructor() {\n\t\tsuper();\n\t}\n}`,
		},
		{
			name: "readFile imported from @antithrow/node/fs/promises",
			code: `import { readFile } from "@antithrow/node/fs/promises";\nreadFile("/tmp/test.txt");`,
		},
		{
			name: "user-defined readFile function is ignored",
			code: `function readFile(path: string) { return path; }\nreadFile("/tmp/test.txt");`,
		},
		{
			name: "callback-style readFile from node:fs is ignored",
			code: `import { readFile } from "node:fs";\nreadFile("/tmp/test.txt", () => {});`,
		},
	],
	invalid: [
		{
			name: "global fetch call",
			code: `fetch("https://example.com");`,
			errors: [
				{
					messageId: MessageId.THROWING_CALL,
					data: { api: "fetch", replacement: "@antithrow/std" },
				},
			],
		},
		{
			name: "global atob call",
			code: `atob("aGVsbG8=");`,
			errors: [
				{
					messageId: MessageId.THROWING_CALL,
					data: { api: "atob", replacement: "@antithrow/std" },
				},
			],
		},
		{
			name: "global btoa call",
			code: `btoa("hello");`,
			errors: [
				{
					messageId: MessageId.THROWING_CALL,
					data: { api: "btoa", replacement: "@antithrow/std" },
				},
			],
		},
		{
			name: "global structuredClone call",
			code: `structuredClone({ a: 1 });`,
			errors: [
				{
					messageId: MessageId.THROWING_CALL,
					data: { api: "structuredClone", replacement: "@antithrow/std" },
				},
			],
		},
		{
			name: "global decodeURI call",
			code: `decodeURI("%E0%A4%A");`,
			errors: [
				{
					messageId: MessageId.THROWING_CALL,
					data: { api: "decodeURI", replacement: "@antithrow/std" },
				},
			],
		},
		{
			name: "global decodeURIComponent call",
			code: `decodeURIComponent("%E0%A4%A");`,
			errors: [
				{
					messageId: MessageId.THROWING_CALL,
					data: { api: "decodeURIComponent", replacement: "@antithrow/std" },
				},
			],
		},
		{
			name: "global encodeURI call",
			code: `encodeURI("https://example.com");`,
			errors: [
				{
					messageId: MessageId.THROWING_CALL,
					data: { api: "encodeURI", replacement: "@antithrow/std" },
				},
			],
		},
		{
			name: "global encodeURIComponent call",
			code: `encodeURIComponent("hello world");`,
			errors: [
				{
					messageId: MessageId.THROWING_CALL,
					data: { api: "encodeURIComponent", replacement: "@antithrow/std" },
				},
			],
		},
		{
			name: "JSON.parse call",
			code: `JSON.parse("{}");`,
			errors: [
				{
					messageId: MessageId.THROWING_CALL,
					data: { api: "JSON.parse", replacement: "@antithrow/std" },
				},
			],
		},
		{
			name: "JSON.stringify call",
			code: `JSON.stringify({ a: 1 });`,
			errors: [
				{
					messageId: MessageId.THROWING_CALL,
					data: { api: "JSON.stringify", replacement: "@antithrow/std" },
				},
			],
		},
		{
			name: "JSON.parse with bracket notation",
			code: `JSON["parse"]("{}");`,
			errors: [
				{
					messageId: MessageId.THROWING_CALL,
					data: { api: "JSON.parse", replacement: "@antithrow/std" },
				},
			],
		},
		{
			name: "JSON.parse with template literal notation",
			code: "JSON[`parse`](`{}`);",
			errors: [
				{
					messageId: MessageId.THROWING_CALL,
					data: { api: "JSON.parse", replacement: "@antithrow/std" },
				},
			],
		},
		{
			name: "response.json() on global Response",
			code: `const r = new Response();\nr.json();`,
			errors: [
				{
					messageId: MessageId.THROWING_CALL,
					data: { api: "response.json", replacement: "@antithrow/std" },
				},
			],
		},
		{
			name: "response.text() on global Response",
			code: `declare const r: Response;\nr.text();`,
			errors: [
				{
					messageId: MessageId.THROWING_CALL,
					data: { api: "response.text", replacement: "@antithrow/std" },
				},
			],
		},
		{
			name: "response.arrayBuffer() on global Response",
			code: `declare const r: Response;\nr.arrayBuffer();`,
			errors: [
				{
					messageId: MessageId.THROWING_CALL,
					data: { api: "response.arrayBuffer", replacement: "@antithrow/std" },
				},
			],
		},
		{
			name: "response.blob() on global Response",
			code: `declare const r: Response;\nr.blob();`,
			errors: [
				{
					messageId: MessageId.THROWING_CALL,
					data: { api: "response.blob", replacement: "@antithrow/std" },
				},
			],
		},
		{
			name: "response.formData() on global Response",
			code: `declare const r: Response;\nr.formData();`,
			errors: [
				{
					messageId: MessageId.THROWING_CALL,
					data: { api: "response.formData", replacement: "@antithrow/std" },
				},
			],
		},
		{
			name: "response.json() on optional Response",
			code: `declare const r: Response | undefined;\nr?.json();`,
			errors: [
				{
					messageId: MessageId.THROWING_CALL,
					data: { api: "response.json", replacement: "@antithrow/std" },
				},
			],
		},
		{
			name: "response.json() on intersection with Response",
			code: `declare const r: Response & { extra: string };\nr.json();`,
			errors: [
				{
					messageId: MessageId.THROWING_CALL,
					data: { api: "response.json", replacement: "@antithrow/std" },
				},
			],
		},
		{
			name: "response.json() on Response subclass",
			code: `class MyResponse extends Response {}\nconst r = new MyResponse();\nr.json();`,
			errors: [
				{
					messageId: MessageId.THROWING_CALL,
					data: { api: "response.json", replacement: "@antithrow/std" },
				},
			],
		},
		{
			name: "fetch in nested scope",
			code: `function inner() { fetch("https://example.com"); }`,
			errors: [
				{
					messageId: MessageId.THROWING_CALL,
					data: { api: "fetch", replacement: "@antithrow/std" },
				},
			],
		},
		{
			name: "globalThis.fetch call",
			code: `globalThis.fetch("https://example.com");`,
			errors: [
				{
					messageId: MessageId.THROWING_CALL,
					data: { api: "fetch", replacement: "@antithrow/std" },
				},
			],
		},
		{
			name: "window.fetch call",
			code: `window.fetch("https://example.com");`,
			errors: [
				{
					messageId: MessageId.THROWING_CALL,
					data: { api: "fetch", replacement: "@antithrow/std" },
				},
			],
		},
		{
			name: "window fetch call with bracket notation",
			code: `window["fetch"]("https://example.com");`,
			errors: [
				{
					messageId: MessageId.THROWING_CALL,
					data: { api: "fetch", replacement: "@antithrow/std" },
				},
			],
		},
		{
			name: "self.atob call",
			code: `self.atob("aGVsbG8=");`,
			errors: [
				{
					messageId: MessageId.THROWING_CALL,
					data: { api: "atob", replacement: "@antithrow/std" },
				},
			],
		},
		{
			name: "globalThis.JSON.parse call",
			code: `globalThis.JSON.parse("{}");`,
			errors: [
				{
					messageId: MessageId.THROWING_CALL,
					data: { api: "JSON.parse", replacement: "@antithrow/std" },
				},
			],
		},
		{
			name: "window.JSON.stringify call",
			code: `window.JSON.stringify({ a: 1 });`,
			errors: [
				{
					messageId: MessageId.THROWING_CALL,
					data: { api: "JSON.stringify", replacement: "@antithrow/std" },
				},
			],
		},
		{
			name: "self JSON.parse call with bracket notation",
			code: `self["JSON"]["parse"]("{}");`,
			errors: [
				{
					messageId: MessageId.THROWING_CALL,
					data: { api: "JSON.parse", replacement: "@antithrow/std" },
				},
			],
		},
		{
			name: "response.json() on generic type parameter extending Response",
			code: `function foo<T extends Response>(resp: T) { resp.json(); }`,
			errors: [
				{
					messageId: MessageId.THROWING_CALL,
					data: { api: "response.json", replacement: "@antithrow/std" },
				},
			],
		},
		// fs/promises tests
		{
			name: "named import readFile from node:fs/promises",
			code: `import { readFile } from "node:fs/promises";\nreadFile("/tmp/test.txt");`,
			errors: [
				{
					messageId: MessageId.THROWING_CALL,
					data: { api: "readFile", replacement: "@antithrow/node/fs/promises" },
				},
			],
		},
		{
			name: "named import readFile from fs/promises",
			code: `import { readFile } from "fs/promises";\nreadFile("/tmp/test.txt");`,
			errors: [
				{
					messageId: MessageId.THROWING_CALL,
					data: { api: "readFile", replacement: "@antithrow/node/fs/promises" },
				},
			],
		},
		{
			name: "aliased import from node:fs/promises",
			code: `import { readFile as rf } from "node:fs/promises";\nrf("/tmp/test.txt");`,
			errors: [
				{
					messageId: MessageId.THROWING_CALL,
					data: { api: "readFile", replacement: "@antithrow/node/fs/promises" },
				},
			],
		},
		{
			name: "namespace import from node:fs/promises",
			code: `import * as fsp from "node:fs/promises";\nfsp.writeFile("/tmp/test.txt", "hello");`,
			errors: [
				{
					messageId: MessageId.THROWING_CALL,
					data: { api: "writeFile", replacement: "@antithrow/node/fs/promises" },
				},
			],
		},
		{
			name: "fs.promises.readFile via node:fs",
			code: `import * as fs from "node:fs";\nfs.promises.readFile("/tmp/test.txt");`,
			errors: [
				{
					messageId: MessageId.THROWING_CALL,
					data: { api: "readFile", replacement: "@antithrow/node/fs/promises" },
				},
			],
		},
		{
			name: "indirect reference to readFile from node:fs/promises",
			code: `import { readFile } from "node:fs/promises";\nconst fn = readFile;\nfn("/tmp/test.txt");`,
			errors: [
				{
					messageId: MessageId.THROWING_CALL,
					data: { api: "readFile", replacement: "@antithrow/node/fs/promises" },
				},
			],
		},
	],
});
