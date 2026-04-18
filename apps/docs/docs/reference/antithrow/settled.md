---
title: Settled
description: The narrow type for a Result that has already finished.
sidebar_position: 5
---

# `Settled<T, E>`

Package: `antithrow`

A narrowing of `Result<T, E>` that excludes `Pending`. Used wherever an API expects a result that has already finished.

## Type

```ts
type Settled<T, E> = Ok<T, E> | Err<T, E>;
```

| Parameter | Description |
| --- | --- |
| `T` | The success value type. |
| `E` | The error value type. |

## Where it appears

- The resolved type of `Pending<T, E>`: `PromiseLike<Settled<T, E>>`.
- The return type of [`settle()`](./methods#settle): `PromiseLike<Settled<T, E>>`.
- The `.result` property on [`UnwrapError`](./unwrap-error): `Settled<unknown, unknown>`.

## Related types

- [`InferOk`](#inferok) — extracts `T` from a result type.
- [`InferErr`](#infererr) — extracts `E` from a result type.

### `InferOk`

```ts
type InferOk<R> = R extends Result<infer T, unknown> ? T : never;
```

### `InferErr`

```ts
type InferErr<R> = R extends Result<unknown, infer E> ? E : never;
```

## Example

```ts
import { Result, type Settled } from "antithrow";

async function resolveConfig(
	pending: Result<string, Error>,
): Promise<Settled<string, Error>> {
	return await pending.settle();
}
```

## See also

- [`Result`](./result) — the full union.
- [`Pending`](./pending) — the shape that settles to `Settled<T, E>`.
