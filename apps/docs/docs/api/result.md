---
sidebar_position: 1
title: "Result"
description: "Complete API reference for Result, Ok, Err, ok(), err(), and Result.try()"
---

# Result

Complete API reference for the core `antithrow` package's synchronous types and functions.

## Types

### Result\<T, E\>

```ts
type Result<T, E> = Ok<T, E> | Err<T, E>;
```

A discriminated union representing either success (`Ok`) or failure (`Err`).

### Ok\<T, E\>

```ts
class Ok<T, E> {
  readonly value: T;
}
```

The success variant. Access the value via the `value` property.

### Err\<T, E\>

```ts
class Err<T, E> {
  readonly error: E;
}
```

The failure variant. Access the error via the `error` property.

## Constructor functions

### ok()

```ts
function ok<E = never>(): Ok<void, E>;
function ok<T, E = never>(value: T): Ok<T, E>;
```

Creates an `Ok` result containing the given value. Call with no arguments for `Ok<void>`.

```ts
const result = ok(42); // Ok<number, never>
const empty = ok(); // Ok<void, never>
```

### err()

```ts
function err<T = never, E = unknown>(error: E): Err<T, E>;
```

Creates an `Err` result containing the given error.

```ts
const result = err("something went wrong"); // Err<never, string>
```

## Static methods

### Result.try()

```ts
Result.try<T, E = unknown>(fn: () => T): Result<T, E>
```

Executes a function and wraps the result. If the function throws, the error is caught and wrapped in an `Err`.

```ts
Result.try(() => JSON.parse('{"a": 1}')); // ok({ a: 1 })
Result.try(() => JSON.parse("invalid")); // err(SyntaxError)
```

### Result.all()

```ts
Result.all<const T extends readonly Result<unknown, unknown>[]>(results: T): Result<OkTuple<T>, ErrUnion<T>>;
Result.all<T, E>(results: readonly Result<T, E>[]): Result<T[], E>;
```

Combines multiple `Result` values into a single `Result`. If all results are `Ok`, returns an `Ok` containing a tuple of all values. If any result is `Err`, returns the first `Err` encountered.

Analogous to `Promise.all`, but for `Result` values.

```ts
Result.all([ok(1), ok("hello")]); // ok([1, "hello"])
Result.all([ok(1), err("bad"), ok(3)]); // err("bad")
Result.all([]); // ok([])
```

When called with a tuple of `Result` values, the `Ok` type is inferred as a tuple and the `Err` type is a union of all error types:

```ts
const results = Result.all([ok(1), ok("hello")]);
// Result<[number, string], never>
```

## Instance methods

### Type checking

#### isOk()

```ts
isOk(): this is Ok<T, E>
```

Type predicate — returns `true` if `Ok`, narrowing the type for property access.

```ts
if (result.isOk()) {
  console.log(result.value); // T
}
```

#### isErr()

```ts
isErr(): this is Err<T, E>
```

Type predicate — returns `true` if `Err`, narrowing the type for property access.

```ts
if (result.isErr()) {
  console.error(result.error); // E
}
```

#### isOkAnd()

```ts
isOkAnd<S extends T>(fn: (value: T) => value is S): this is Ok<S, E>;
isOkAnd(fn: (value: T) => boolean): boolean;
```

Returns `true` if `Ok` and the predicate passes. When a type predicate is passed, narrows the `Ok` value type.

```ts
ok(42).isOkAnd((x) => x > 10); // true
ok(5).isOkAnd((x) => x > 10); // false
err("e").isOkAnd(() => true); // false

// Type narrowing
const result: Result<string | number, Error> = ok(42);
if (result.isOkAnd((v): v is number => typeof v === "number")) {
  result.value; // number
}
```

#### isErrAnd()

```ts
isErrAnd<F extends E>(fn: (error: E) => error is F): this is Err<T, F>;
isErrAnd(fn: (error: E) => boolean): boolean;
```

Returns `true` if `Err` and the predicate passes. When a type predicate is passed, narrows the `Err` error type.

```ts
err("error").isErrAnd((e) => e.length > 3); // true
err("e").isErrAnd((e) => e.length > 3); // false
ok(42).isErrAnd(() => true); // false
```

### Extracting values

#### unwrap()

```ts
unwrap(): T
```

Returns the `Ok` value. **Throws** if `Err`.

```ts
ok(42).unwrap(); // 42
err("oops").unwrap(); // throws
```

#### unwrapErr()

```ts
unwrapErr(): E
```

Returns the `Err` value. **Throws** if `Ok`.

```ts
err("oops").unwrapErr(); // "oops"
ok(42).unwrapErr(); // throws
```

#### expect()

```ts
expect(message: string): T
```

Returns the `Ok` value. **Throws** with the provided message if `Err`.

```ts
ok(42).expect("value should exist"); // 42
err("oops").expect("value should exist"); // throws "value should exist"
```

#### expectErr()

```ts
expectErr(message: string): E
```

Returns the `Err` value. **Throws** with the provided message if `Ok`.

```ts
err("oops").expectErr("should be error"); // "oops"
ok(42).expectErr("should be error"); // throws "should be error"
```

#### unwrapOr()

```ts
unwrapOr(defaultValue: T): T
```

Returns the `Ok` value, or the provided default if `Err`.

```ts
ok(42).unwrapOr(0); // 42
err("oops").unwrapOr(0); // 0
```

#### unwrapOrElse()

```ts
unwrapOrElse(fn: (error: E) => T): T
```

Returns the `Ok` value, or computes it from the error.

```ts
ok(42).unwrapOrElse(() => 0); // 42
err("oops").unwrapOrElse((e) => e.length); // 4
```

### Transforming

#### map()

```ts
map<U>(fn: (value: T) => U): Result<U, E>
```

Transforms the `Ok` value, leaving `Err` unchanged.

```ts
ok(2).map((x) => x * 2); // ok(4)
err("oops").map((x) => x * 2); // err("oops")
```

#### mapErr()

```ts
mapErr<F>(fn: (error: E) => F): Result<T, F>
```

Transforms the `Err` value, leaving `Ok` unchanged.

```ts
ok(2).mapErr((e) => e.toUpperCase()); // ok(2)
err("oops").mapErr((e) => e.toUpperCase()); // err("OOPS")
```

#### mapOr()

```ts
mapOr<U>(defaultValue: U, fn: (value: T) => U): U
```

Transforms the `Ok` value, or returns the default if `Err`.

```ts
ok(2).mapOr(0, (x) => x * 2); // 4
err("oops").mapOr(0, (x) => x * 2); // 0
```

#### mapOrElse()

```ts
mapOrElse<U>(defaultFn: (error: E) => U, fn: (value: T) => U): U
```

Transforms the `Ok` value, or computes a default from the error.

```ts
ok(2).mapOrElse(
  (e) => e.length,
  (x) => x * 2,
); // 4
err("oops").mapOrElse(
  (e) => e.length,
  (x) => x * 2,
); // 4
```

### Chaining

#### andThen()

```ts
andThen<U, F>(fn: (value: T) => Result<U, F>): Result<U, E | F>
```

Calls the function with the `Ok` value and returns its `Result`, or propagates the `Err`. The error types are automatically unioned.

```ts
ok(2).andThen((x) => ok(x * 2)); // ok(4)
ok(2).andThen((x) => err("fail")); // err("fail")
err("oops").andThen((x) => ok(x * 2)); // err("oops")
```

#### and()

```ts
and<U, F>(result: Result<U, F>): Result<U, E | F>
```

Returns the provided `Result` if this is `Ok`, otherwise propagates the `Err`.

```ts
ok(2).and(ok("next")); // ok("next")
err("oops").and(ok("a")); // err("oops")
```

#### or()

```ts
or<F>(result: Result<T, F>): Result<T, F>
```

Returns this if `Ok`, otherwise returns the provided `Result`.

```ts
ok(2).or(ok(99)); // ok(2)
err("oops").or(ok(99)); // ok(99)
```

#### orElse()

```ts
orElse<F>(fn: (error: E) => Result<T, F>): Result<T, F>
```

Calls the function with the `Err` value and returns its `Result`, or propagates the `Ok`.

```ts
ok(2).orElse((e) => ok(0)); // ok(2)
err("oops").orElse((e) => ok(0)); // ok(0)
err("oops").orElse((e) => err(1)); // err(1)
```

### Matching

#### match()

```ts
match<U>(handlers: { ok: (value: T) => U; err: (error: E) => U }): U
```

Pattern matches on the result, calling the appropriate handler.

```ts
ok(42).match({
  ok: (v) => `value: ${v}`,
  err: (e) => `error: ${e}`,
}); // "value: 42"
```

### Side effects

#### inspect()

```ts
inspect(fn: (value: T) => void): Result<T, E>
```

Calls the function with the `Ok` value for side effects, returning the original result unchanged.

```ts
ok(42).inspect((x) => console.log(x)); // logs 42, returns ok(42)
err("oops").inspect((x) => console.log(x)); // does nothing, returns err("oops")
```

#### inspectErr()

```ts
inspectErr(fn: (error: E) => void): Result<T, E>
```

Calls the function with the `Err` value for side effects, returning the original result unchanged.

```ts
ok(42).inspectErr((e) => console.error(e)); // does nothing, returns ok(42)
err("oops").inspectErr((e) => console.error(e)); // logs "oops", returns err("oops")
```

### Flattening

#### flatten()

```ts
flatten<U, F>(this: Result<Result<U, F>, E>): Result<U, E | F>
```

Flattens a nested `Result<Result<U, F>, E>` into `Result<U, E | F>`.

```ts
ok(ok(42)).flatten(); // ok(42)
ok(err("inner")).flatten(); // err("inner")
err("outer").flatten(); // err("outer")
```

### Async transitions

These methods convert a `Result` into a [`ResultAsync`](./result-async) when you need to introduce async operations mid-chain.

#### mapAsync()

```ts
mapAsync<U>(fn: (value: T) => PromiseLike<U>): ResultAsync<U, E>
```

```ts
ok(2).mapAsync(async (x) => x * 2); // ResultAsync containing ok(4)
```

#### mapErrAsync()

```ts
mapErrAsync<F>(fn: (error: E) => PromiseLike<F>): ResultAsync<T, F>
```

```ts
err("oops").mapErrAsync(async (e) => e.toUpperCase()); // ResultAsync containing err("OOPS")
```

#### andThenAsync()

```ts
andThenAsync<U, F>(
	fn: (value: T) => PromiseLike<Result<U, F>> | ResultAsync<U, F>,
): ResultAsync<U, E | F>
```

```ts
ok(2).andThenAsync(async (x) => ok(x * 2)); // ResultAsync containing ok(4)
```

#### orElseAsync()

```ts
orElseAsync<F>(
	fn: (error: E) => PromiseLike<Result<T, F>> | ResultAsync<T, F>,
): ResultAsync<T, F>
```

```ts
err("oops").orElseAsync(async (e) => ok(0)); // ResultAsync containing ok(0)
```

#### inspectAsync()

```ts
inspectAsync(fn: (value: T) => PromiseLike<void>): ResultAsync<T, E>
```

```ts
ok(42).inspectAsync(async (x) => {
  await log(x);
}); // ResultAsync containing ok(42)
```

#### inspectErrAsync()

```ts
inspectErrAsync(fn: (error: E) => PromiseLike<void>): ResultAsync<T, E>
```

```ts
err("oops").inspectErrAsync(async (e) => {
  await logError(e);
}); // ResultAsync containing err("oops")
```
