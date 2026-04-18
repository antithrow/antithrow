---
title: Ok
description: The successful result shape.
sidebar_position: 2
---

# `Ok<T, E>`

Package: `antithrow`

A `Result` that succeeded. Carries the successful value on `.value`.

## Signature

```ts
class Ok<out T, out E = never> extends ResultBase<T, E> {
	constructor(value: T);
	readonly value: T;
}
```

| Parameter | Description |
| --- | --- |
| `T` | The success value type. |
| `E` | The error type (defaults to `never`). |

## Constructor

```ts
new Ok<T, E>(value: T): Ok<T, E>;
```

| Argument | Type | Description |
| --- | --- | --- |
| `value` | `T` | The success value. |

## Properties

| Name | Type | Description |
| --- | --- | --- |
| `value` | `T` | Readonly success value. |

## Instance methods

- `isOk(): true` — always `true`; narrows `this` to `Ok<T, E>`.
- `isErr(): false` — always `false`.
- `isPending(): false` — always `false`.
- `unwrap(): T` — returns `value`.
- `unwrapErr(): never` — throws [`UnwrapError`](./unwrap-error).
- `unwrapOr(_: T): T` — returns `value`.
- `unwrapOrElse(_: (error: E) => T): T` — returns `value`.
- `settle(): PromiseLike<Ok<T, E>>` — resolves to `this`.

All chainable methods (`map`, `mapErr`, `andThen`, `and`, `or`, `orElse`, `flatten`, `mapOr`, `mapOrElse`) behave as expected for `Ok`: transforms on the value branch run, transforms on the error branch are no-ops. See [methods](./methods).

`Ok` also implements `[Symbol.iterator]` so `Result.do` can `yield*` it and continue with the value.

## Throws

`unwrapErr()` throws [`UnwrapError`](./unwrap-error). No other method throws.

## Example

```ts
import { Ok } from "antithrow";

const success = new Ok<number, "missing">(42);
success.value; // 42
success.isOk(); // true
success.unwrap(); // 42
```

## See also

- [`Err`](./err) — the failure shape.
- [`Pending`](./pending) — the in-flight shape.
- [Chainable methods](./methods).
