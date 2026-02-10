---
sidebar_position: 2
title: "ResultAsync"
description: "Complete API reference for ResultAsync, okAsync(), errAsync(), and static methods"
---

# ResultAsync

Complete API reference for `ResultAsync<T, E>` — the async counterpart to `Result`.

## Type

```ts
class ResultAsync<T, E> implements PromiseLike<Result<T, E>>
```

Wraps a `Promise<Result<T, E>>` with a chainable API. All callbacks accept `MaybePromise<T>` (either sync or async return values).

## Constructor functions

### okAsync()

```ts
function okAsync<E = never>(): ResultAsync<void, E>;
function okAsync<T, E = never>(value: T): ResultAsync<T, E>;
```

Creates a `ResultAsync` containing an `Ok` with the given value.

```ts
const result = okAsync(42); // ResultAsync<number, never>
const empty = okAsync(); // ResultAsync<void, never>
```

### errAsync()

```ts
function errAsync<T = never, E = unknown>(error: E): ResultAsync<T, E>;
```

Creates a `ResultAsync` containing an `Err` with the given error.

```ts
const result = errAsync("something went wrong"); // ResultAsync<never, string>
```

## Static methods

### ResultAsync.try()

```ts
static try<T, E = unknown>(fn: () => T | Promise<T>): ResultAsync<T, E>
```

Executes a function and wraps the result. Catches both thrown exceptions and rejected promises.

```ts
const result = ResultAsync.try(async () => {
  const response = await fetch("/api");
  return response.json();
});
// ResultAsync<unknown, unknown>

const failed = ResultAsync.try(async () => {
  throw new Error("oops");
});
// ResultAsync<never, unknown>
```

### ResultAsync.fromResult()

```ts
static fromResult<T, E>(result: Result<T, E>): ResultAsync<T, E>
```

Wraps an existing sync `Result` into a `ResultAsync`.

```ts
const syncResult = ok(42);
const asyncResult = ResultAsync.fromResult(syncResult);
await asyncResult.unwrap(); // 42
```

### ResultAsync.fromPromise()

```ts
static fromPromise<T, E>(promise: Promise<Result<T, E>>): ResultAsync<T, E>
```

Wraps an existing `Promise<Result>` into a `ResultAsync`. Does **not** catch rejections — use `ResultAsync.try()` if the promise may reject.

```ts
const promise = fetchData().then(
  (data) => ok(data),
  (e) => err(e),
);
const result = ResultAsync.fromPromise(promise);
```

## Instance methods

### Type checking

#### isOk()

```ts
isOk(): Promise<boolean>
```

Returns a promise resolving to `true` if `Ok`.

```ts
await okAsync(42).isOk(); // true
await errAsync("e").isOk(); // false
```

#### isErr()

```ts
isErr(): Promise<boolean>
```

Returns a promise resolving to `true` if `Err`.

```ts
await errAsync("e").isErr(); // true
await okAsync(42).isErr(); // false
```

#### isOkAnd()

```ts
isOkAnd(fn: (value: T) => MaybePromise<boolean>): Promise<boolean>
```

Returns `true` if `Ok` and the predicate passes.

```ts
await okAsync(42).isOkAnd((x) => x > 10); // true
await okAsync(5).isOkAnd((x) => x > 10); // false
await errAsync("e").isOkAnd(() => true); // false
```

#### isErrAnd()

```ts
isErrAnd(fn: (error: E) => MaybePromise<boolean>): Promise<boolean>
```

Returns `true` if `Err` and the predicate passes.

```ts
await errAsync("error").isErrAnd((e) => e.length > 3); // true
await errAsync("e").isErrAnd((e) => e.length > 3); // false
await okAsync(42).isErrAnd(() => true); // false
```

### Extracting values

#### unwrap()

```ts
unwrap(): Promise<T>
```

Returns the `Ok` value. **Throws** if `Err`.

```ts
await okAsync(42).unwrap(); // 42
await errAsync("oops").unwrap(); // throws
```

#### unwrapErr()

```ts
unwrapErr(): Promise<E>
```

Returns the `Err` value. **Throws** if `Ok`.

```ts
await errAsync("oops").unwrapErr(); // "oops"
await okAsync(42).unwrapErr(); // throws
```

#### expect()

```ts
expect(message: string): Promise<T>
```

Returns the `Ok` value. **Throws** with the provided message if `Err`.

```ts
await okAsync(42).expect("should exist"); // 42
await errAsync("oops").expect("should exist"); // throws "should exist"
```

#### expectErr()

```ts
expectErr(message: string): Promise<E>
```

Returns the `Err` value. **Throws** with the provided message if `Ok`.

```ts
await errAsync("oops").expectErr("should fail"); // "oops"
await okAsync(42).expectErr("should fail"); // throws "should fail"
```

#### unwrapOr()

```ts
unwrapOr(defaultValue: T): Promise<T>
```

Returns the `Ok` value, or the provided default if `Err`.

```ts
await okAsync(42).unwrapOr(0); // 42
await errAsync("oops").unwrapOr(0); // 0
```

#### unwrapOrElse()

```ts
unwrapOrElse(fn: (error: E) => MaybePromise<T>): Promise<T>
```

Returns the `Ok` value, or computes it from the error.

```ts
await okAsync(42).unwrapOrElse(() => 0); // 42
await errAsync("oops").unwrapOrElse((e) => e.length); // 4
```

### Transforming

#### map()

```ts
map<U>(fn: (value: T) => MaybePromise<U>): ResultAsync<U, E>
```

Transforms the `Ok` value, leaving `Err` unchanged. The callback can return a sync or async value.

```ts
okAsync(2).map((x) => x * 2); // ResultAsync containing ok(4)
okAsync(2).map(async (x) => x * 2); // also works
errAsync("oops").map((x) => x * 2); // ResultAsync containing err("oops")
```

#### mapErr()

```ts
mapErr<F>(fn: (error: E) => MaybePromise<F>): ResultAsync<T, F>
```

Transforms the `Err` value, leaving `Ok` unchanged.

```ts
okAsync(2).mapErr((e) => e.toUpperCase()); // ResultAsync containing ok(2)
errAsync("oops").mapErr((e) => e.toUpperCase()); // ResultAsync containing err("OOPS")
```

#### mapOr()

```ts
mapOr<U>(defaultValue: U, fn: (value: T) => MaybePromise<U>): Promise<U>
```

Transforms the `Ok` value, or returns the default if `Err`.

```ts
await okAsync(2).mapOr(0, (x) => x * 2); // 4
await errAsync("oops").mapOr(0, (x) => x * 2); // 0
```

#### mapOrElse()

```ts
mapOrElse<U>(
	defaultFn: (error: E) => MaybePromise<U>,
	fn: (value: T) => MaybePromise<U>,
): Promise<U>
```

Transforms the `Ok` value, or computes a default from the error.

```ts
await okAsync(2).mapOrElse(
  (e) => e.length,
  (x) => x * 2,
); // 4
await errAsync("oops").mapOrElse(
  (e) => e.length,
  (x) => x * 2,
); // 4
```

### Chaining

#### andThen()

```ts
andThen<U, F>(
	fn: (value: T) => MaybePromise<Result<U, F>> | ResultAsync<U, F>,
): ResultAsync<U, E | F>
```

Calls the function with the `Ok` value and returns its `Result`, or propagates the `Err`. Accepts callbacks that return `Result`, `ResultAsync`, or `Promise<Result>`.

```ts
okAsync(2).andThen((x) => okAsync(x * 2)); // ResultAsync containing ok(4)
okAsync(2).andThen((x) => ok(x * 2)); // sync Result also works
errAsync("oops").andThen((x) => ok(x * 2)); // ResultAsync containing err("oops")
```

#### and()

```ts
and<U, F>(result: Result<U, F> | ResultAsync<U, F>): ResultAsync<U, E | F>
```

Returns the provided `Result` if this is `Ok`, otherwise propagates the `Err`.

```ts
okAsync(2).and(ok("next")); // ResultAsync containing ok("next")
errAsync("oops").and(ok("a")); // ResultAsync containing err("oops")
```

#### or()

```ts
or<F>(result: Result<T, F> | ResultAsync<T, F>): ResultAsync<T, F>
```

Returns this if `Ok`, otherwise returns the provided `Result`.

```ts
okAsync(2).or(ok(99)); // ResultAsync containing ok(2)
errAsync("oops").or(ok(99)); // ResultAsync containing ok(99)
```

#### orElse()

```ts
orElse<F>(
	fn: (error: E) => MaybePromise<Result<T, F>> | ResultAsync<T, F>,
): ResultAsync<T, F>
```

Calls the function with the `Err` value and returns its `Result`, or propagates the `Ok`.

```ts
okAsync(2).orElse((e) => okAsync(0)); // ResultAsync containing ok(2)
errAsync("oops").orElse((e) => okAsync(0)); // ResultAsync containing ok(0)
```

### Matching

#### match()

```ts
match<U>(handlers: {
	ok: (value: T) => MaybePromise<U>;
	err: (error: E) => MaybePromise<U>;
}): Promise<U>
```

Pattern matches on the result, calling the appropriate handler.

```ts
await okAsync(42).match({
  ok: (v) => `value: ${v}`,
  err: (e) => `error: ${e}`,
}); // "value: 42"
```

### Side effects

#### inspect()

```ts
inspect(fn: (value: T) => MaybePromise<unknown>): ResultAsync<T, E>
```

Calls the function with the `Ok` value for side effects, returning the original result unchanged.

```ts
okAsync(42).inspect((x) => console.log(x)); // logs 42
errAsync("oops").inspect((x) => console.log(x)); // does nothing
```

#### inspectErr()

```ts
inspectErr(fn: (error: E) => MaybePromise<unknown>): ResultAsync<T, E>
```

Calls the function with the `Err` value for side effects, returning the original result unchanged.

```ts
okAsync(42).inspectErr((e) => console.error(e)); // does nothing
errAsync("oops").inspectErr((e) => console.error(e)); // logs "oops"
```

### Flattening

#### flatten()

```ts
flatten<U, F>(this: ResultAsync<Result<U, F>, E>): ResultAsync<U, E | F>
```

Flattens a nested `ResultAsync<Result<U, F>, E>` into `ResultAsync<U, E | F>`.

```ts
await okAsync(ok(42)).flatten(); // ok(42)
await okAsync(err("inner")).flatten(); // err("inner")
await errAsync("outer").flatten(); // err("outer")
```
