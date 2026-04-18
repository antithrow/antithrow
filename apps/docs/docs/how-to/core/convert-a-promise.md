---
title: Convert a Promise
description: Turn a Promise<T> into a Pending<T, E> whose rejection is typed.
---

# Convert a Promise

When you hold a `Promise<T>` from an existing API, wrap it in `Result.fromPromise` to get a `Pending<T, E>` whose rejection path is captured as `Err`.

## Basic usage

```ts
import { Result } from "antithrow";

const settled = await Result.fromPromise(fetch("/api"));
if (settled.isOk()) {
	use(settled.value);
}
```

The returned `Pending` is `PromiseLike`, so `await` yields a `Settled<T, E>`.

## Typing the error

`Result.fromPromise` accepts an optional mapper to shape the rejection reason:

```ts
type FetchError = { kind: "network"; cause: unknown };

const settled = await Result.fromPromise(fetch("/api"), (cause): FetchError => ({
	kind: "network",
	cause,
}));
```

Without the mapper, `E` is `unknown` (promises can reject with anything).

## When to use this instead of `Result.try`

- Use `Result.fromPromise` when you already have a `Promise`.
- Use `Result.try` with an async function when you want to defer invocation until inside antithrow's control.

Both produce a `Pending`; `fromPromise` avoids constructing an extra closure.

## See also

- Reference: [`Result.fromPromise`](../../reference/antithrow/result.md)
- Reference: [`Pending`](../../reference/antithrow/pending.md)
- How-to: [Wrap a throwing function](./wrap-a-throwing-function.md)
