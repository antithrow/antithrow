# `@antithrow/no-throwing-call`

Disallow calls to known throwing built-in APIs that have `@antithrow/std` replacements.

## Rule Details

This rule reports calls to built-in JavaScript/Web APIs that can throw and have non-throwing replacements in [`@antithrow/std`](https://www.npmjs.com/package/@antithrow/std).

The rule detects three categories of APIs:

### Global functions

`fetch`, `atob`, `btoa`, `structuredClone`, `decodeURI`, `decodeURIComponent`, `encodeURI`, `encodeURIComponent`

**Replacement:** Import the function directly from `@antithrow/std`.

### JSON methods

`JSON.parse`, `JSON.stringify`

**Replacement:** `import { JSON } from "@antithrow/std"`

### Response body methods

`response.json()`, `response.text()`, `response.arrayBuffer()`, `response.blob()`, `response.formData()`

**Replacement:** `import { Response } from "@antithrow/std"` (note: the API shape changes from `response.json()` to `Response.json(response)`).

Calls through `globalThis`, `window`, or `self` (e.g. `globalThis.fetch(...)`, `window.JSON.parse(...)`) are also detected.

The rule is **type-aware**. Global functions and JSON methods use ESLint scope analysis to check whether the identifier has been overridden by an import or local declaration. Response body methods use TypeScript's type checker to verify the receiver is the built-in `Response` type.

**Default severity:** `warn` in the recommended config.

### Invalid

```ts
fetch("https://example.com");
globalThis.fetch("https://example.com");
window.fetch("https://example.com");

JSON.parse("{}");
JSON.stringify(value);
globalThis.JSON.parse("{}");

atob("aGVsbG8=");
btoa("hello");
structuredClone({ a: 1 });
decodeURI(encoded);
encodeURIComponent(value);

declare const response: Response;
response.json();
response.text();
response.arrayBuffer();
response.blob();
response.formData();
```

### Valid

```ts
import {
  fetch,
  JSON,
  Response,
  atob,
  structuredClone,
} from "@antithrow/std";

// Imported from @antithrow/std — no warning
fetch("https://example.com");
JSON.parse("{}");
atob("aGVsbG8=");
structuredClone({ a: 1 });

// Response methods use a static call pattern
declare const response: globalThis.Response;
Response.json(response);
Response.text(response);

// Locally defined — no warning
function myFetch(url: string) { /* ... */ }
myFetch("https://example.com");

// Non-Response objects are ignored
const obj = { json: () => "test" };
obj.json();
```

## When Not To Use It

If your codebase does not use `@antithrow/std` and you do not plan to migrate to non-throwing APIs.

## Options

This rule has no options.

## Type Checking

This rule requires [type information](https://typescript-eslint.io/getting-started/typed-linting/) to run. You must configure your ESLint setup with `parserOptions.projectService` or `parserOptions.project`.
