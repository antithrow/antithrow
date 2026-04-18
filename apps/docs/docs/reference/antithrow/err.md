---
title: Err
description: The failed result shape.
sidebar_position: 3
---

# `Err<T, E>`

Package: `antithrow`

A `Result` that failed. Carries the error value on `.error`.

## Signature

```ts
class Err<out T = never, out E = unknown> extends ResultBase<T, E> {
	constructor(error: E);
	readonly error: E;
}
```

| Parameter | Description |
| --- | --- |
| `T` | The success type (defaults to `never`). |
| `E` | The error type (defaults to `unknown`). |

## Constructor

```ts
new Err<T, E>(error: E): Err<T, E>;
```

| Argument | Type | Description |
| --- | --- | --- |
| `error` | `E` | The error value. |

## Properties

| Name | Type | Description |
| --- | --- | --- |
| `error` | `E` | Readonly error value. |

## Instance methods

- `isOk(): false` — always `false`.
- `isErr(): true` — always `true`; narrows `this` to `Err<T, E>`.
- `isPending(): false` — always `false`.
- `unwrap(): never` — throws [`UnwrapError`](./unwrap-error).
- `unwrapErr(): E` — returns `error`.
- `unwrapOr(value: T): T` — returns the provided default.
- `unwrapOrElse(fn: (error: E) => T): T` — returns `fn(error)`.
- `settle(): PromiseLike<Err<T, E>>` — resolves to `this`.

All chainable methods (`map`, `mapErr`, `andThen`, `and`, `or`, `orElse`, `flatten`, `mapOr`, `mapOrElse`) behave as expected for `Err`: transforms on the error branch run, transforms on the value branch are no-ops. See [methods](./methods).

`Err` also implements `[Symbol.iterator]` so `Result.do` can short-circuit when it is yielded.

## Throws

`unwrap()` throws [`UnwrapError`](./unwrap-error). No other method throws.

## Example

```ts
import { Err } from "antithrow";

const failure = new Err<number, "missing">("missing");
failure.error; // "missing"
failure.isErr(); // true
failure.unwrapErr(); // "missing"
```

## See also

- [`Ok`](./ok) — the success shape.
- [`Pending`](./pending) — the in-flight shape.
- [Chainable methods](./methods).
