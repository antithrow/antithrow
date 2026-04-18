---
title: Result
description: The Result<T, E> union type and its static helpers.
sidebar_position: 1
---

# `Result<T, E>`

Package: `antithrow`

The union of the three result shapes. Also the name of an object that holds the static factory functions.

## Type

```ts
type Result<T, E> = Ok<T, E> | Err<T, E> | Pending<T, E>;
```

| Parameter | Description |
| --- | --- |
| `T` | The success value type. |
| `E` | The error value type. |

## Static helpers

```ts
const Result: {
	try: typeof resultTry;
	fromPromise: typeof fromPromise;
	do: typeof resultDo;
};
```

### `Result.try(fn)`

Runs `fn` and captures any thrown error as `Err`.

| Overload | Return |
| --- | --- |
| `fn: () => T` | `Settled<T, E>` |
| `fn: () => PromiseLike<T>` | `Pending<T, E>` |

The error type `E` defaults to `unknown` and is narrowed at the call site. A rejection from an async `fn` becomes `Err`.

```ts
import { Result } from "antithrow";

const sync = Result.try<number, SyntaxError>(() => JSON.parse("42"));
const async_ = Result.try<Response, TypeError>(() => fetch("/api"));
```

### `Result.fromPromise(promise)`

Wraps a `PromiseLike<T>` as `Pending<T, E>`. Resolution becomes `Ok`; rejection becomes `Err`.

```ts
import { Result } from "antithrow";

const pending = Result.fromPromise<string, Error>(readFile("/etc/hostname"));
```

### `Result.do(generator)`

Delegates over `yield*`ed results in fail-fast mode. `yield*` on `Ok` continues with the value; on `Err` short-circuits; on `Pending` awaits and either continues or short-circuits.

| Overload | Return |
| --- | --- |
| `() => Generator<never, T, void>` | `Ok<T, never>` |
| `() => Generator<YieldErr, T, void>` | `Settled<T, InferErr<YieldErr>>` |
| `() => AsyncGenerator<never, T, void>` | `Pending<T, never>` |
| `() => AsyncGenerator<YieldErr, T, void>` | `Pending<T, InferErr<YieldErr>>` |

On short-circuit, `Result.do` calls `iter.return()` so `finally` blocks execute. Thrown exceptions are *not* caught; use `Result.try` for throw-capturing behaviour.

```ts
import { Ok, Err, Result } from "antithrow";

const total = Result.do(function* () {
	const a = yield* new Ok<number, "invalid">(20);
	const b = yield* new Ok<number, "invalid">(22);
	return a + b;
});
```

## Throws

Never. Every static helper either returns `Ok`, `Err`, or a `Pending` whose promise settles to one of the two.

## See also

- [`Ok`](./ok) — the success shape.
- [`Err`](./err) — the failure shape.
- [`Pending`](./pending) — the in-flight shape.
- [`Settled`](./settled) — the `Ok | Err` narrowing.
- [Chainable methods](./methods) — `map`, `andThen`, `orElse`, etc.
