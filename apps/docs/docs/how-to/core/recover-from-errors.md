---
title: Recover from errors
description: Choose between orElse, unwrapOr, and unwrapOrElse when substituting a fallback value.
---

# Recover from errors

Three recovery methods with different shapes. Pick by what you have on hand and what you want back.

## `unwrapOr(fallback)` — return T

Use when the fallback is a plain value and you're done with the `Result`.

```ts
const name = user.unwrapOr("anonymous");
```

## `unwrapOrElse(fn)` — return T, compute fallback lazily

Use when the fallback depends on the error or is expensive to compute.

```ts
const name = user.unwrapOrElse((error) => `guest-${error.requestId}`);
```

The callback receives the `E` and must return a `T`.

## `orElse(fn)` — stay in Result

Use when you want to try another `Result`-producing operation on failure and keep chaining.

```ts
const config = readConfig(primaryPath).orElse(() => readConfig(fallbackPath));
```

`orElse` produces a `Result<T, E2>`. The original `T` is preserved; the error type becomes whatever the fallback returns.

## Choosing

| You want… | Method |
| --- | --- |
| A plain `T` with a static default | `unwrapOr` |
| A plain `T` computed from the error | `unwrapOrElse` |
| Another `Result` you'll keep chaining | `orElse` |

## See also

- Reference: [chainable methods](../../reference/antithrow/methods.md)
- How-to: [Combine results](./combine-results.md)
