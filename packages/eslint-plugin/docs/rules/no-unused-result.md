# `@antithrow/no-unused-result`

Require `Result` and `ResultAsync` values to be used, preventing silently ignored errors.

Analogous to Rust's [`#[must_use]`](https://doc.rust-lang.org/reference/attributes/diagnostics.html#the-must_use-attribute) attribute and `unused_must_use` lint.

## Rule Details

This rule reports when a `Result` or `ResultAsync` value from `antithrow` is discarded as an expression statement. A discarded Result means the error case is silently ignored, which defeats the purpose of typed error handling.

The rule is **type-aware** and uses TypeScript's type checker to determine whether an expression produces a `Result`. Since `Result<T, E>` is a type alias for `Ok<T, E> | Err<T, E>`, the rule checks for the underlying `Ok`, `Err`, and `ResultAsync` class types.

**Default severity:** `error` in the recommended config.

### Invalid

```ts
import { ok, err, okAsync, errAsync, Result } from "antithrow";

// Bare Result constructors
ok(1);
err("x");
okAsync(1);
errAsync("x");

// Chains that still produce a Result
ok(1).map((x) => x + 1);
ok(1).mapErr((e) => e);

// Function returning Result, called as expression statement
function getResult(): Result<number, string> {
	return ok(1);
}
getResult();

// Awaited okAsync produces a Result
async function f() {
	await okAsync(1);
}
```

### Valid

```ts
import { ok, err, okAsync, Result, ResultAsync } from "antithrow";

// Assigned to a variable
const x = ok(1);

// Returned from a function
function f() {
	return ok(1);
}

// Passed as an argument
function foo(r: Result<number, never>) {}
foo(ok(1));

// Explicitly discarded with void
void ok(1);

// Chain ending in a non-Result method
ok(1).unwrap();
ok(1).match({ ok: (v) => v, err: (e) => 0 });

// ResultAsync assigned in async function
async function g() {
	const x = await okAsync(1);
}

// Non-Result expressions
42;
console.log("hi");
```

## When Not To Use It

If you intentionally discard `Result` values in fire-and-forget scenarios and don't want to add `void` before each one.

## Options

This rule has no options.

## Type Checking

This rule requires [type information](https://typescript-eslint.io/getting-started/typed-linting/) to run. You must configure your ESLint setup with `parserOptions.projectService` or `parserOptions.project`.
