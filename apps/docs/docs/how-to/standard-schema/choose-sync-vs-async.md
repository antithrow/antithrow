---
title: Choose sync vs async validation
description: Decide between validate and validateSync based on whether the schema is async.
---

# Choose sync vs async validation

`@antithrow/standard-schema` exposes two entry points. Pick by what the schema can do, not by ergonomic preference.

## Use `validate` when any of these is true

- The schema has `async` refinements or transforms.
- You don't know — third-party schemas, dynamic composition, code paths that vary.
- The call site is already `async`.

```ts
const result = await validate(schema, input);
```

Returns `Result<T, FailureResult>`. If the schema is async, that `Result` will be `Pending` until it settles.

## Use `validateSync` only when you know the schema is sync

- Authored in-house, with no `.refine(async ...)` or async transforms.
- The call site needs to stay synchronous (render functions, selectors, reducers).

```ts
const result = validateSync(schema, input);
```

Returns `Settled<T, FailureResult>`.

## What goes wrong if you pick sync and the schema is async

`validateSync` throws a `TypeError` when the schema returns a `Promise`. This is intentional — it's a loud failure at the call site rather than a silent "it returned, what's this weird value?".

```
TypeError: Schema returned a Promise from validate(). Use validate() instead
of validateSync() for async schemas.
```

If you see this, switch to `validate`.

## See also

- Reference: [`@antithrow/standard-schema`](../../reference/standard-schema/api.md)
- Explanation: [Eager vs lazy](../../explanation/eager-vs-lazy.md)
