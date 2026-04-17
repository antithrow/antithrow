---
sidebar_position: 4
title: "no-throwing-call"
description: "Disallow calls to well-known throwing/rejecting APIs that have antithrow replacements"
---

# no-throwing-call

Disallow calls to well-known throwing/rejecting APIs that have `@antithrow` bridge replacements available.

**Severity:** `warn` | **Fixable:** none

## Rule Details

This rule reports calls to well-known APIs that can throw or reject where an `@antithrow` bridge replacement exists. It currently detects four categories of APIs:

### Global functions

`fetch`, `atob`, `btoa`, `structuredClone`, `decodeURI`, `decodeURIComponent`, `encodeURI`, `encodeURIComponent`

**Replacement:** Import the function directly from `@antithrow/std`.

### JSON methods

`JSON.parse`, `JSON.stringify`

**Replacement:** `import { JSON } from "@antithrow/std"`

### Response body methods

`response.json()`, `response.text()`, `response.arrayBuffer()`, `response.blob()`, `response.formData()`

**Replacement:** `import { Response } from "@antithrow/std"` (note: the API shape changes from `response.json()` to `Response.json(response)`).

### Node.js `fs/promises` functions {#fs-promises}

`readFile`, `writeFile`, `appendFile`, `truncate`, `open`, `readdir`, `mkdir`, `rmdir`, `rm`, `mkdtemp`, `opendir`, `readlink`, `link`, `symlink`, `unlink`, `realpath`, `stat`, `lstat`, `statfs`, `access`, `chmod`, `chown`, `lchown`, `utimes`, `lutimes`, `copyFile`, `cp`, `rename`

**Replacement:** Import the function from `@antithrow/node/fs/promises`. See the [`@antithrow/node` docs](../node.md) for the full API.

The rule detects calls regardless of import style:

- Named imports: `import { readFile } from "node:fs/promises"`
- Aliased imports: `import { readFile as rf } from "node:fs/promises"`
- Namespace imports: `import * as fsp from "node:fs/promises"; fsp.readFile(...)`
- Property access via `node:fs`: `import fs from "node:fs"; fs.promises.readFile(...)`
- Indirect references: `const fn = readFile; fn(...)`

Both `"node:fs/promises"` and `"fs/promises"` module specifiers are detected.

---

Calls through `globalThis`, `window`, or `self` (e.g. `globalThis.fetch(...)`, `window.JSON.parse(...)`) are also detected for global/JSON/Response APIs.

The rule is **type-aware**. Global functions and JSON methods use ESLint scope analysis to check whether the identifier has been overridden by an import or local declaration. Response body methods use TypeScript's type checker to verify the receiver is the built-in `Response` type. Node.js `fs/promises` detection uses the type checker to resolve the declaration's originating module.

:::tip
The rule uses scope analysis to avoid false positives — if you've shadowed a global (e.g., `const fetch = myCustomFetch`), the rule won't flag it. Similarly, a user-defined function named `readFile` that doesn't originate from `node:fs/promises` will not be flagged.
:::

### Invalid

```ts
// Global / JSON / Response APIs
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

// Node.js fs/promises APIs
import { readFile, writeFile } from "node:fs/promises";
readFile("/tmp/hello.txt", "utf-8");
writeFile("/tmp/hello.txt", "data");

import * as fsp from "node:fs/promises";
fsp.readFile("/tmp/hello.txt");

import fs from "node:fs";
fs.promises.readFile("/tmp/hello.txt");
```

### Valid

```ts
import { fetch, JSON, Response, atob, structuredClone } from "@antithrow/std";

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
function myFetch(url: string) {
  /* ... */
}
myFetch("https://example.com");

// Non-Response objects are ignored
const obj = { json: () => "test" };
obj.json();

// Imported from @antithrow/node — no warning
import { readFile, writeFile } from "@antithrow/node/fs/promises";
readFile("/tmp/hello.txt", "utf-8");
writeFile("/tmp/hello.txt", "data");

// User-defined function with same name — no warning
function readFile(path: string) {
  /* custom implementation */
}
readFile("/tmp/hello.txt");

// Callback-style fs APIs (not from fs/promises) — no warning
import { readFile as readFileCb } from "node:fs";
readFileCb("/tmp/hello.txt", () => {});
```

## When Not To Use It

If your codebase does not use `@antithrow/std` or `@antithrow/node` and you do not plan to migrate to non-throwing APIs.

## Options

This rule has no options.

## Type Checking

This rule requires [type information](https://typescript-eslint.io/getting-started/typed-linting/) to run. You must configure your ESLint setup with `parserOptions.projectService` or `parserOptions.project`.
