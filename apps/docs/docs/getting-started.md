---
sidebar_position: 2
title: "Getting Started"
---

# Getting Started

## Prerequisites

- TypeScript 5.0+
- Node.js 20+
- Any package manager (npm, pnpm, yarn, or bun)

## Installation

Install the core package:

```bash npm2yarn
npm install antithrow
```

Optionally install ecosystem packages as needed:

```bash npm2yarn
npm install @antithrow/std @antithrow/standard-schema @antithrow/eslint-plugin
```

## TypeScript configuration

antithrow works with any TypeScript configuration, but `strict` mode is recommended. These additional options pair well with Result-based error handling:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

## Your first Result

Import `ok` and `err` to create Result values, and the `Result` type for annotations:

```ts
import { ok, err, type Result } from "antithrow";

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) return err("division by zero");
  return ok(a / b);
}
```

Check the variant with `isOk()` / `isErr()` — these are type predicates that narrow the type:

```ts
const result = divide(10, 3);

if (result.isOk()) {
  console.log(result.value); // number
} else {
  console.error(result.error); // string
}
```

Or use `match()` for exhaustive handling in one expression:

```ts
const message = divide(10, 3).match({
  ok: (value) => `Result: ${value}`,
  err: (error) => `Error: ${error}`,
});
```

## Wrapping existing code

Use `Result.try()` to wrap functions that throw:

```ts
import { Result } from "antithrow";

const parsed = Result.try(() => JSON.parse('{"name": "Alice"}'));
// Result<any, unknown>
```

For standard globals like `JSON.parse`, `fetch`, `atob`, and others, [`@antithrow/std`](./api/std) provides pre-built wrappers with precise error types:

```ts
import { JSON } from "@antithrow/std";

const parsed = JSON.parse<{ name: string }>('{"name": "Alice"}');
// Result<{ name: string }, SyntaxError>
```

## Setting up the ESLint plugin

[`@antithrow/eslint-plugin`](./api/eslint-plugin) provides type-aware rules to catch common mistakes. Add the recommended config to your ESLint flat config:

```ts
// eslint.config.ts
import antithrow from "@antithrow/eslint-plugin";

export default [
  antithrow.configs.recommended,
  // ... your other configs
];
```

This enables three rules:

| Rule                          | Severity | Description                                                |
| ----------------------------- | -------- | ---------------------------------------------------------- |
| `@antithrow/no-unused-result` | error    | Require `Result` values to be used                         |
| `@antithrow/no-unsafe-unwrap` | warn     | Disallow `unwrap()` / `expect()` on unhandled Results      |
| `@antithrow/no-throwing-call` | warn     | Flag throwing APIs that have `@antithrow/std` replacements |

:::note
The ESLint plugin requires type-aware linting via `typescript-eslint`. See [the full setup guide](./api/eslint-plugin) for details.
:::

## Next steps

- [**Result\<T, E\>**](./concepts/result) — Deep dive into the core type
- [**ResultAsync\<T, E\>**](./concepts/result-async) — Async error handling
- [**Composing with chain()**](./concepts/chain) — Generator-based composition
- [**API Reference**](./api/result) — Complete API documentation
