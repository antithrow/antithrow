---
title: Chainable methods
description: Map, transform, compose, and unwrap methods available on every Result shape.
sidebar_position: 6
---

# Chainable methods

Package: `antithrow`

Every `Result` shape (`Ok`, `Err`, `Pending`) defines the same set of instance methods. This page is the consolidated reference.

## Availability matrix

| Method | `Ok` | `Err` | `Pending` |
| --- | --- | --- | --- |
| `isOk` / `isErr` / `isPending` | yes | yes | yes |
| `map` | transforms | no-op | `Pending` (transforms on settle) |
| `mapErr` | no-op | transforms | `Pending` (transforms on settle) |
| `mapOr` | transforms | returns default | `PromiseLike` |
| `mapOrElse` | transforms | runs `defaultFn` | `PromiseLike` |
| `andThen` | runs fn | short-circuits | `Pending` |
| `and` | returns other | short-circuits | `Pending` |
| `or` | short-circuits | returns other | `Pending` |
| `orElse` | short-circuits | runs fn | `Pending` |
| `flatten` | unwraps nested | no-op | `Pending` |
| `unwrap` | returns value | throws `UnwrapError` | `PromiseLike<T>` |
| `unwrapErr` | throws `UnwrapError` | returns error | `PromiseLike<E>` |
| `unwrapOr` | returns value | returns default | `PromiseLike<T>` |
| `unwrapOrElse` | returns value | runs fn | `PromiseLike<T>` |
| `settle` | resolves `this` | resolves `this` | resolves inner |

## Guards

### `isOk()` / `isErr()` / `isPending()`

```ts
isOk(): this is Ok<T, E>;
isErr(): this is Err<T, E>;
isPending(): this is Pending<T, E>;
```

Type guards. Each returns `true` only for its own shape and narrows `this` in the branch. Safe to call on any result.

## Value transformations

### `map(fn)`

```ts
map<U>(fn: (value: T) => U | PromiseLike<U>): Result<U, E>;
```

Transforms the `Ok` value. Leaves `Err` untouched. If `fn` returns a promise, the result becomes `Pending`. Exceptions thrown by `fn` are *not* caught.

### `mapErr(fn)`

```ts
mapErr<F>(fn: (error: E) => F | PromiseLike<F>): Result<T, F>;
```

Transforms the `Err` value. Leaves `Ok` untouched. If `fn` returns a promise, the result becomes `Pending`. Exceptions thrown by `fn` are *not* caught.

### `mapOr(defaultValue, fn)`

```ts
mapOr<U>(defaultValue: U, fn: (value: T) => U | PromiseLike<U>): U | PromiseLike<U>;
```

Returns `fn(value)` on `Ok`, `defaultValue` on `Err`. Returns `PromiseLike<U>` when called on `Pending` or when `fn` is async.

### `mapOrElse(defaultFn, fn)`

```ts
mapOrElse<U>(
	defaultFn: (error: E) => U | PromiseLike<U>,
	fn: (value: T) => U | PromiseLike<U>,
): U | PromiseLike<U>;
```

Like `mapOr`, but computes the default from the error.

## Composition

### `andThen(fn)`

```ts
andThen<U, F>(fn: (value: T) => Result<U, F>): Result<U, E | F>;
```

Runs `fn` on `Ok`, short-circuits on `Err`. The returned result inherits both error types. This is the monadic bind.

### `and(result)`

```ts
and<U, F>(result: Result<U, F>): Result<U, E | F>;
```

Returns `result` when `this` is `Ok`, short-circuits on `Err`. No function, no lazy evaluation; `result` is always constructed up front.

### `or(result)`

```ts
or<F>(result: Result<T, F>): Result<T, E | F>;
```

Returns `this` on `Ok`, `result` on `Err`. Use for unconditional fallback.

### `orElse(fn)`

```ts
orElse<F>(fn: (error: E) => Result<T, F>): Result<T, F>;
```

Returns `this` on `Ok`, runs `fn` on `Err`. Use for recovery logic that should only execute on failure.

### `flatten()`

```ts
flatten(): FlattenOk<T, E> | FlattenErr<T, E> | FlattenPending<T, E>;
```

Unwraps one level of nested `Result`. `Ok(Ok(x))` becomes `Ok(x)`, `Ok(Err(e))` becomes `Err(e)`. On `Err` or `Pending`, flatten preserves the outer shape.

## Unwrapping

### `unwrap()`

```ts
unwrap(): T | PromiseLike<T>;
```

Returns the value on `Ok`. Throws [`UnwrapError`](./unwrap-error) on `Err`. Returns a promise when called on `Pending`.

### `unwrapErr()`

```ts
unwrapErr(): E | PromiseLike<E>;
```

Returns the error on `Err`. Throws [`UnwrapError`](./unwrap-error) on `Ok`. Returns a promise when called on `Pending`.

### `unwrapOr(value)`

```ts
unwrapOr(value: T): T | PromiseLike<T>;
```

Returns the value on `Ok`, the provided default on `Err`. Returns a promise when called on `Pending`.

### `unwrapOrElse(fn)`

```ts
unwrapOrElse(fn: (error: E) => T | PromiseLike<T>): T | PromiseLike<T>;
```

Returns the value on `Ok`, `fn(error)` on `Err`. Returns a promise when called on `Pending` or when `fn` is async.

## Async boundary

### `settle()`

```ts
settle(): PromiseLike<Settled<T, E>>;
```

Returns a promise that resolves to `Ok` or `Err`. On `Ok` and `Err` this resolves to `this`; on `Pending` it returns the inner promise.

## See also

- [`Ok`](./ok), [`Err`](./err), [`Pending`](./pending) — per-shape behavior.
- [`Result.do`](./result#resultdogenerator) — fail-fast generator flow over these methods.
- [`UnwrapError`](./unwrap-error) — thrown by `unwrap` / `unwrapErr` on the wrong shape.
