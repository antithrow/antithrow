---
sidebar_position: 2
title: "ResultAsync<T, E>"
---

# ResultAsync\<T, E\>

`ResultAsync<T, E>` wraps a `Promise<Result<T, E>>` and provides the same chainable API as `Result`, but all operations are async-aware. It implements `PromiseLike<Result<T, E>>`, so you can `await` it directly.

## Creating a ResultAsync

### Constructor functions

```ts
import { okAsync, errAsync } from "antithrow";

const success = okAsync(42); // ResultAsync<number, never>
const failure = errAsync("oops"); // ResultAsync<never, string>
const empty = okAsync(); // ResultAsync<void, never>
```

### Static methods

```ts
import { ResultAsync, err, ok } from "antithrow";

// Wrap a sync Result
ResultAsync.fromResult(ok(42));
// ResultAsync<number, never>

// Wrap a Promise<Result> (does NOT catch rejections)
ResultAsync.fromPromise(
  fetchData().then(
    (data) => ok(data),
    (e) => err(e),
  ),
);

// Wrap a throwing async function (catches rejections)
ResultAsync.try(async () => {
  const response = await fetch("/api");
  return response.json();
});
// ResultAsync<unknown, unknown>

// Combine multiple results concurrently (like Promise.all)
ResultAsync.all([okAsync(1), okAsync("hello")]);
// ResultAsync<[number, string], never>

// Accepts mixed sync and async inputs
ResultAsync.all([ok(1), okAsync("hello")]);
// ResultAsync<[number, string], never>
```

### try vs fromPromise

|                           | `ResultAsync.try(fn)`   | `ResultAsync.fromPromise(promise)`   |
| ------------------------- | ----------------------- | ------------------------------------ |
| Catches thrown exceptions | Yes                     | No                                   |
| Catches rejected promises | Yes                     | No                                   |
| Use when                  | Wrapping throwable code | You already have a `Promise<Result>` |

## Awaiting a ResultAsync

Since `ResultAsync` implements `PromiseLike`, `await` gives you a plain `Result<T, E>` that you can narrow with sync type predicates:

```ts
const asyncResult = okAsync(42);
const result = await asyncResult; // Result<number, never>

if (result.isOk()) {
  console.log(result.value); // number
}
```

This is the recommended pattern for final consumption: chain operations on `ResultAsync`, then `await` at the end and handle the sync `Result`.

## The chainable API

`ResultAsync` mirrors every `Result` method. The key difference is that callbacks accept `MaybePromise<T>` — meaning you can pass either sync or async functions:

### Transforming

```ts
okAsync(2).map((x) => x * 2); // sync callback works
okAsync(2).map(async (x) => x * 2); // async callback also works
// Both return ResultAsync<number, never>

errAsync("oops").mapErr((e) => e.toUpperCase());
// ResultAsync<never, string>
```

### Chaining

```ts
okAsync(2).andThen((x) => okAsync(x * 2));
// ResultAsync<number, never>

okAsync(2).andThen((x) => ok(x * 2)); // sync Result also works
// ResultAsync<number, never>

errAsync("oops").orElse((e) => okAsync(0));
// ResultAsync<number, never>
```

### Pattern matching

```ts
const message = await okAsync(42).match({
  ok: (v) => `value: ${v}`,
  err: (e) => `error: ${e}`,
});
// "value: 42"
```

### Side effects

```ts
okAsync(42)
  .inspect((x) => console.log("got:", x))
  .inspectErr((e) => console.error("failed:", e));
```

### Flattening

```ts
await okAsync(ok(42)).flatten(); // ok(42)
await okAsync(err("inner")).flatten(); // err("inner")
```

## Checking and extracting

`isOk()`, `isErr()`, `unwrap()`, etc. all return promises:

```ts
await okAsync(42).isOk(); // true
await errAsync("e").isErr(); // true
await okAsync(42).unwrap(); // 42
await okAsync(42).unwrapOr(0); // 42
await errAsync("e").unwrapOr(0); // 0
```

:::note
Unlike `Result`, `isOk()` and `isErr()` on `ResultAsync` return `Promise<boolean>` — they cannot narrow the type. If you need type narrowing, `await` the `ResultAsync` first to get a sync `Result`, then use `isOk()` / `isErr()` as type predicates.
:::

## Key differences from Result

| Aspect                 | Result                              | ResultAsync                              |
| ---------------------- | ----------------------------------- | ---------------------------------------- |
| `isOk()` / `isErr()`   | Type predicates (narrow in `if`)    | Return `Promise<boolean>` (no narrowing) |
| Callbacks              | Sync only                           | Accept `MaybePromise` (sync or async)    |
| `andThen` accepts      | `Result<U, F>`                      | `Result<U, F>` or `ResultAsync<U, F>`    |
| Direct property access | `.value` / `.error` after narrowing | Must `await` first                       |

The recommended pattern: build your pipeline with `ResultAsync` methods, then `await` at the end and use sync `Result` methods for final handling.
