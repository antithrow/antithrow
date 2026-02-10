---
sidebar_position: 1
title: "Introduction"
---

# antithrow

**antithrow** brings Rust-style `Result<T, E>` error handling to TypeScript. Instead of throwing exceptions that disappear from your type signatures, functions return `Result` values that make errors visible, composable, and impossible to forget.

## The problem with exceptions

Consider a typical TypeScript function:

```ts
function getUser(id: string): User {
  const raw = localStorage.getItem(id);
  if (!raw) throw new Error("User not found");
  return JSON.parse(raw);
}
```

This signature lies. It says it returns `User`, but it can also throw — and TypeScript won't remind you to handle it. The caller has no idea what errors to expect, the error is untyped (`unknown` in a `catch` block), and forgetting a `try`/`catch` means a runtime crash.

## The antithrow approach

The same function with `Result`:

```ts
import { ok, err, type Result } from "antithrow";

function getUser(id: string): Result<User, "not_found" | SyntaxError> {
  const raw = localStorage.getItem(id);
  if (!raw) return err("not_found" as const);
  return Result.try(() => JSON.parse(raw));
}
```

Now the return type tells the full story. The caller **must** handle both variants before accessing the value — TypeScript enforces it:

```ts
const result = getUser("abc");

// TypeScript won't let you access .value without checking first
if (result.isOk()) {
  console.log(result.value); // User
} else {
  console.error(result.error); // "not_found" | SyntaxError
}
```

## The ecosystem

antithrow is a family of packages that work together:

| Package                                               | Description                                                                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [`antithrow`](./api/result)                           | Core `Result<T, E>` and `ResultAsync<T, E>` types with chaining, composition, and pattern matching      |
| [`@antithrow/std`](./api/std)                         | Non-throwing wrappers for standard globals — `fetch`, `JSON.parse`, `atob`, and more                    |
| [`@antithrow/standard-schema`](./api/standard-schema) | Bridge for Standard Schema validators (Zod, Valibot, ArkType) into `Result` types                       |
| [`@antithrow/eslint-plugin`](./api/eslint-plugin)     | ESLint rules enforcing correct `Result` usage — catch unused results, unsafe unwraps, and throwing APIs |

## Quick example

```ts
import { ok, err, type Result } from "antithrow";

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) return err("division by zero");
  return ok(a / b);
}

const result = divide(10, 2)
  .map((n) => n.toFixed(2)) // Transform the Ok value
  .mapErr((e) => new Error(e)); // Transform the Err value

const message = result.match({
  ok: (value) => `Result: ${value}`,
  err: (error) => `Error: ${error.message}`,
});
// "Result: 5.00"
```

## Next steps

- [**Getting Started**](./getting-started) — Install antithrow and write your first `Result`
- [**Core Concepts**](./concepts/result) — Learn `Result`, `ResultAsync`, and `chain()` in depth
- [**API Reference**](./api/result) — Full API documentation for all packages
- [**Recipes**](./recipes/api-layer) — Real-world patterns and integration guides
