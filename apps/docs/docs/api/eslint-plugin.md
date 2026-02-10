---
sidebar_position: 6
title: "@antithrow/eslint-plugin"
description: "ESLint rules for enforcing correct Result usage"
---

# @antithrow/eslint-plugin

ESLint plugin with type-aware rules for enforcing correct `Result` and `ResultAsync` usage.

## Installation

```bash npm2yarn
npm install -D @antithrow/eslint-plugin
```

## Setup

Add the recommended config to your ESLint flat config. The plugin requires type-aware linting via `typescript-eslint`:

```ts
// eslint.config.ts
import antithrow from "@antithrow/eslint-plugin";
import tseslint from "typescript-eslint";

export default tseslint.config(...tseslint.configs.recommended, antithrow.configs.recommended);
```

:::note
All three rules require type information. Make sure your ESLint config includes `typescript-eslint`'s parser with `project` or `projectService` options configured. See [typescript-eslint's docs](https://typescript-eslint.io/getting-started/typed-linting/) for setup instructions.
:::

## Recommended config

The recommended config enables all rules with these severities:

| Rule                          | Severity |
| ----------------------------- | -------- |
| `@antithrow/no-unused-result` | `error`  |
| `@antithrow/no-unsafe-unwrap` | `warn`   |
| `@antithrow/no-throwing-call` | `warn`   |

## Rules

### no-unused-result

**Severity:** `error` | **Fixable:** suggestion

Requires `Result` and `ResultAsync` values to be used — like Rust's `#[must_use]`. Catches cases where a Result is computed but discarded, which usually means an error is being silently ignored.

**Triggers on:**

```ts
// Result value is discarded
getUser(id); // error: This Result must be used

someResult.map((x) => x * 2); // error: chained Result is discarded
```

**Passes when the Result is:**

```ts
// Assigned to a variable
const result = getUser(id);

// Returned from a function
return getUser(id);

// Passed as an argument
handleResult(getUser(id));

// Explicitly discarded with void
void getUser(id);
```

**Suggestion fix:** The rule suggests prefixing with `void` to explicitly discard the Result.

### no-unsafe-unwrap

**Severity:** `warn` | **Fixable:** code

Disallows `unwrap()`, `unwrapErr()`, `expect()`, and `expectErr()` on `Result` and `ResultAsync` values. These methods throw when called on the wrong variant, defeating the purpose of typed error handling.

**Triggers on:**

```ts
const result: Result<number, string> = getNumber();

// Unsafe — may throw at runtime
result.unwrap();
result.expect("should be a number");

// Destructuring the method is also caught
const { unwrap } = result;
const fn = result.unwrap;
```

**Auto-fix:** When the type is narrowed to a specific variant, the rule auto-fixes:

```ts
const result = ok(42);
result.unwrap();
// Auto-fixed to: result.value

const result = err("oops");
result.unwrapErr();
// Auto-fixed to: result.error
```

### no-throwing-call

**Severity:** `warn` | **Fixable:** none

Flags calls to built-in APIs that can throw when a non-throwing wrapper is available from `@antithrow/std`.

**Detected APIs:**

| Category         | APIs                                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| Global functions | `fetch`, `atob`, `btoa`, `structuredClone`, `decodeURI`, `decodeURIComponent`, `encodeURI`, `encodeURIComponent` |
| JSON methods     | `JSON.parse`, `JSON.stringify`                                                                                   |
| Response body    | `response.json()`, `response.text()`, `response.arrayBuffer()`, `response.blob()`, `response.formData()`         |

Also detects calls through `globalThis`, `window`, and `self` (e.g., `globalThis.fetch(...)`).

**Triggers on:**

```ts
// These can throw — use @antithrow/std instead
JSON.parse(input);
fetch("/api");
response.json();
globalThis.atob(encoded);
```

**Passes when:**

```ts
// Using @antithrow/std wrappers
import { JSON, fetch, Response } from "@antithrow/std";

JSON.parse(input); // Returns Result<T, SyntaxError>
fetch("/api"); // Returns ResultAsync<Response, ...>
Response.json(response); // Returns ResultAsync<T, ...>
```

**Message:** `` `{api}` can throw. A non-throwing wrapper is available from `@antithrow/std`. ``

:::tip
The rule uses scope analysis to avoid false positives — if you've shadowed a global (e.g., `const fetch = myCustomFetch`), the rule won't flag it.
:::
