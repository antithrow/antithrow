---
title: Combine results
description: Compose multiple Results with and, or, andThen, and flatten.
---

# Combine results

## Short-circuit on first failure — `andThen`

Chain operations where each step depends on the previous success.

```ts
const response = await readConfig(path)
	.andThen(parseConfig)
	.andThen(validateConfig);
```

Each callback receives the predecessor's `T` and must return a `Result`. The first `Err` short-circuits the chain.

## Take the first — `and`, `or`

`and(other)` returns `other` if `this` is `Ok`, otherwise returns `this`. Useful when you only care that both succeed but want to discard the first value.

```ts
const pair = authenticate().and(loadProfile);
```

`or(other)` is the inverse: returns `this` if `Ok`, otherwise `other`.

```ts
const source = readPrimary().or(readSecondary);
```

## Flatten a nested Result — `flatten`

When a transformation produces `Result<Result<T, E2>, E1>`, call `.flatten()` to collapse one level.

```ts
const doubled: Result<Result<number, E2>, E1> = /* ... */;
const single: Result<number, E1 | E2> = doubled.flatten();
```

`andThen(identity)` is equivalent to `.flatten()`.

## See also

- Reference: [chainable methods](../../reference/antithrow/methods.md)
- How-to: [Use `Result.do`](./use-result-do.md)
