---
title: Pending
description: The asynchronous result shape; implements PromiseLike.
sidebar_position: 4
---

# `Pending<T, E>`

Package: `antithrow`

A `Result` that has not settled yet. Implements `PromiseLike<Settled<T, E>>`, so it can be `await`ed.

## Signature

```ts
class Pending<out T, out E>
	extends ResultBase<T, E>
	implements PromiseLike<Settled<T, E>>
{
	constructor(promise: PromiseLike<Settled<T, E>>);
	readonly promise: PromiseLike<Settled<T, E>>;

	then<A = Settled<T, E>, B = never>(
		onfulfilled?: ((value: Settled<T, E>) => A | PromiseLike<A>) | null,
		onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
	): PromiseLike<A | B>;
}
```

| Parameter | Description |
| --- | --- |
| `T` | The success value type. |
| `E` | The error type. |

## Constructor

```ts
new Pending<T, E>(promise: PromiseLike<Settled<T, E>>): Pending<T, E>;
```

| Argument | Type | Description |
| --- | --- | --- |
| `promise` | `PromiseLike<Settled<T, E>>` | The underlying promise. Must always resolve; rejections are not caught by `Pending` itself. |

Use [`Result.fromPromise`](./result#resultfrompromisepromise) or [`Result.try`](./result#resulttryfn) to construct a `Pending` from arbitrary code instead of the raw constructor.

## Properties

| Name | Type | Description |
| --- | --- | --- |
| `promise` | `PromiseLike<Settled<T, E>>` | The underlying promise. |

## Instance methods

- `isOk(): false` — always `false`.
- `isErr(): false` — always `false`.
- `isPending(): true` — always `true`; narrows `this` to `Pending<T, E>`.
- `then(...)` — standard `PromiseLike.then`. Resolves to `Settled<T, E>`.
- `settle(): PromiseLike<Settled<T, E>>` — alias for the inner promise.
- `unwrap(): PromiseLike<T>` — settles then calls `unwrap` on the result.
- `unwrapErr(): PromiseLike<E>` — settles then calls `unwrapErr`.
- `unwrapOr(value: T): PromiseLike<T>` — settles then falls back to `value`.
- `unwrapOrElse(fn): PromiseLike<T>` — settles then calls `fn` on `Err`.

All chainable methods (`map`, `mapErr`, `andThen`, `and`, `or`, `orElse`, `flatten`, `mapOr`, `mapOrElse`) return a new `Pending` that awaits the inner promise before applying the operation. See [methods](./methods).

`Pending` also implements `[Symbol.asyncIterator]` so `Result.do` with an async generator can `yield*` it.

## Throws

Never directly. Awaiting `unwrap()` or `unwrapErr()` on the wrong branch throws [`UnwrapError`](./unwrap-error) (the thrown value is observed through the promise rejection).

## Example

```ts
import { Result } from "antithrow";

const pending = Result.try<string, Error>(async () => "hello");
const settled = await pending;

if (settled.isOk()) {
	settled.value; // "hello"
}
```

## See also

- [`Ok`](./ok) and [`Err`](./err) — the settled shapes.
- [`Settled`](./settled) — the `Ok | Err` narrowing.
- [Chainable methods](./methods).
