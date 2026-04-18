---
title: Narrow Result states
description: Use isOk, isErr, and isPending as type guards to access value and error safely.
---

# Narrow Result states

A `Result<T, E>` is a union of `Ok<T, E>`, `Err<T, E>`, and — when awaiting is involved — `Pending<T, E>`. TypeScript cannot see `value` or `error` until you narrow.

## Branch on `isOk` / `isErr`

```ts
if (result.isOk()) {
	use(result.value);   // T
} else {
	report(result.error); // E
}
```

Both methods are type guards. Inside the `if` block, `result` is narrowed to the matching variant and `.value` / `.error` become accessible.

## Peel off `Pending` first

If you have a `Pending`, `await` it — do not try to narrow a `Pending` directly for `.value`.

```ts
const settled = await pending;
if (settled.isOk()) {
	use(settled.value);
}
```

`isPending` exists for rare cases where you hold a union that includes `Pending` but have not yet awaited — most code should await first and narrow second.

## Exhaustive switch with `.match`

When you want to handle every branch in one expression, use `.match`:

```ts
const message = result.match({
	ok: (value) => `got ${value}`,
	err: (error) => `failed: ${error.kind}`,
});
```

## See also

- Reference: [`Ok`](../../reference/antithrow/ok.md) · [`Err`](../../reference/antithrow/err.md) · [`Pending`](../../reference/antithrow/pending.md)
- Reference: [chainable methods](../../reference/antithrow/methods.md)
