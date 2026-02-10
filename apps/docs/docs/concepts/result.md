---
sidebar_position: 1
title: "Result<T, E>"
---

# Result\<T, E\>

`Result<T, E>` is a discriminated union of `Ok<T, E>` and `Err<T, E>`. It represents an operation that can succeed with a value of type `T` or fail with an error of type `E`. This is the same concept as Rust's `std::result::Result`.

## Creating Results

Use the `ok()` and `err()` constructor functions:

```ts
import { ok, err } from "antithrow";

const success = ok(42); // Ok<number, never>
const failure = err("oops"); // Err<never, string>
const empty = ok(); // Ok<void, never>
```

Type parameters are inferred from the value. When you need to annotate a function's return type, use the `Result` type alias:

```ts
import { ok, err, type Result } from "antithrow";

function parseNumber(s: string): Result<number, string> {
  const n = Number(s);
  if (Number.isNaN(n)) return err(`Invalid number: ${s}`);
  return ok(n);
}
```

## Checking the variant

`isOk()` and `isErr()` are type predicates — they narrow the type in `if` blocks so you can access `.value` or `.error` directly:

```ts
const result = parseNumber("42");

if (result.isOk()) {
  console.log(result.value); // number
}

if (result.isErr()) {
  console.error(result.error); // string
}
```

For combined check-and-test, use `isOkAnd()` and `isErrAnd()`:

```ts
ok(42).isOkAnd((x) => x > 10); // true
ok(5).isOkAnd((x) => x > 10); // false
err("e").isOkAnd(() => true); // false
```

These also accept type predicates for further narrowing:

```ts
const result: Result<string | number, Error> = ok(42);

if (result.isOkAnd((v): v is number => typeof v === "number")) {
  result.value; // number (narrowed from string | number)
}
```

## Extracting values

### Safe extraction

`unwrapOr()` and `unwrapOrElse()` return the `Ok` value or a fallback:

```ts
ok(42).unwrapOr(0); // 42
err("oops").unwrapOr(0); // 0
err("oops").unwrapOrElse((e) => e.length); // 4
```

### Direct property access

After narrowing with `isOk()` / `isErr()`, access `.value` or `.error` directly — this is the safest and most idiomatic approach:

```ts
if (result.isOk()) {
  result.value; // T
}
if (result.isErr()) {
  result.error; // E
}
```

### Unsafe extraction

`unwrap()` and `expect()` throw if the Result is the wrong variant. Use these sparingly — they defeat the purpose of typed errors:

```ts
ok(42).unwrap(); // 42
err("oops").unwrap(); // throws!
ok(42).expect("value should exist"); // 42
err("oops").expect("value should exist"); // throws with "value should exist"
```

## Transforming Results

### map / mapErr

`map()` transforms the `Ok` value, leaving `Err` unchanged. `mapErr()` does the reverse:

```ts
ok(2).map((x) => x * 2); // ok(4)
err("oops").map((x) => x * 2); // err("oops")

ok(2).mapErr((e) => e.toUpperCase()); // ok(2)
err("oops").mapErr((e) => e.toUpperCase()); // err("OOPS")
```

Chain them to build transformation pipelines:

```ts
parseNumber("42")
  .map((n) => n.toFixed(2))
  .mapErr((e) => new Error(e));
// Result<string, Error>
```

### mapOr / mapOrElse

Transform and extract in one step:

```ts
ok(2).mapOr(0, (x) => x * 2); // 4
err("oops").mapOr(0, (x) => x * 2); // 0

ok(2).mapOrElse(
  (e) => e.length,
  (x) => x * 2,
); // 4
err("oops").mapOrElse(
  (e) => e.length,
  (x) => x * 2,
); // 4
```

## Chaining fallible operations

### andThen

`andThen()` is the key method for sequencing operations that can fail. Unlike `map()`, the callback returns a `Result` — this lets you chain multiple fallible steps:

```ts
function parseNumber(s: string): Result<number, string> {
  /* ... */
}
function divide(a: number, b: number): Result<number, string> {
  /* ... */
}

parseNumber("10")
  .andThen((a) => parseNumber("2").map((b) => [a, b] as const))
  .andThen(([a, b]) => divide(a, b));
// Result<number, string>
```

When you chain `andThen` with functions that have different error types, TypeScript automatically unions the errors:

```ts
declare function parse(s: string): Result<Config, ParseError>;
declare function validate(c: Config): Result<Config, ValidationError>;

parse(input).andThen(validate);
// Result<Config, ParseError | ValidationError>
```

### and / or / orElse

```ts
// and: return a fixed result if this is Ok
ok(2).and(ok("next")); // ok("next")
err("a").and(ok("next")); // err("a")

// or: provide a fallback result
ok(2).or(ok(99)); // ok(2)
err("a").or(ok(99)); // ok(99)

// orElse: attempt recovery from the error
err("a").orElse((e) => ok(e.length)); // ok(1)
```

:::tip
For complex multi-step chains, consider [`chain()`](./chain) which provides a more readable generator-based syntax.
:::

## Pattern matching

`match()` calls one of two handlers and returns the result — it's exhaustive, so TypeScript ensures both branches are handled:

```ts
const message = result.match({
  ok: (value) => `Got ${value}`,
  err: (error) => `Failed: ${error}`,
});
```

## Side effects

`inspect()` and `inspectErr()` call a function for side effects without changing the Result — useful for logging mid-chain:

```ts
parseNumber("42")
  .inspect((n) => console.log("parsed:", n))
  .map((n) => n * 2)
  .inspectErr((e) => console.error("failed:", e));
```

## Flattening

`flatten()` unwraps a nested `Result<Result<U, F>, E>` into `Result<U, E | F>`:

```ts
ok(ok(42)).flatten(); // ok(42)
ok(err("inner")).flatten(); // err("inner")
err("outer").flatten(); // err("outer")
```

## Bridging to async

When you need to introduce async operations mid-chain, use the async transition methods. These convert a `Result` into a [`ResultAsync`](./result-async):

```ts
ok(2).mapAsync(async (x) => x * 2);
// ResultAsync<number, never>

ok(2).andThenAsync(async (x) => ok(x * 2));
// ResultAsync<number, never>
```

The full set of async transitions: `mapAsync`, `mapErrAsync`, `andThenAsync`, `orElseAsync`, `inspectAsync`, `inspectErrAsync`.

## Result.try()

`Result.try()` wraps a throwing function — if it throws, the error is caught and wrapped in `Err`:

```ts
import { Result } from "antithrow";

Result.try(() => JSON.parse('{"a": 1}')); // ok({ a: 1 })
Result.try(() => JSON.parse("invalid")); // err(SyntaxError)
```

:::note
For standard globals like `JSON.parse`, `fetch`, `atob`, etc., prefer the pre-built wrappers in [`@antithrow/std`](../api/std) which provide precise error types.
:::
