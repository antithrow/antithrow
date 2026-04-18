---
title: The three-state model
description: Why Ok, Err, and Pending form a single type, instead of Promise<Result<T, E>>.
sidebar_position: 2
---

# The three-state model

Most Result libraries model two states: `Ok<T>` for success and `Err<E>` for failure. Async work lives one layer up — `Promise<Result<T, E>>`. antithrow adds a third state, `Pending<T, E>`, and makes it a first-class member of the `Result` union.

This page explains why.

## Two layers are expensive

Consider a plain `Promise<Result<T, E>>`. To transform the inside, you write

```ts
const mapped = promise.then((result) => result.map(fn));
```

Every combinator needs two layers of lifting: once for the promise, once for the result. Library authors typically answer this with a second type, `ResultAsync<T, E>`, whose job is to hide the promise layer by re-implementing every Result method on top of a promise. Now the codebase has two parallel APIs, and you have to remember which one you're holding.

There is a subtler problem. `Promise<Result<T, E>>` says "this promise resolves to a Result that might be Err." But the Result itself is a promise-of-a-sum. Awaiting it gives back a `Result`, which is then branched on. That shape does not correspond to how callers think: they want to say "I have a result; it's async; pipe it through this." Two types gets in the way of that sentence.

## One union, three shapes

antithrow's `Result<T, E>` is `Ok<T, E> | Err<T, E> | Pending<T, E>`.

- `Ok<T, E>` — the operation finished successfully.
- `Err<T, E>` — the operation finished with a failure.
- `Pending<T, E>` — the operation is still in flight, and will settle to `Ok` or `Err`.

Every method is defined on all three. `.map(fn)` on an `Ok` transforms the value. `.map(fn)` on an `Err` is a no-op. `.map(fn)` on a `Pending` queues the transformation against the underlying promise and returns a new `Pending`. The caller writes one chain, and the `Pending` disappears into the surrounding `await`.

`Pending` implements `PromiseLike<Settled<T, E>>`, where `Settled<T, E>` is `Ok | Err`. So `await pending` hands back a settled result. There is no second API. There is no `ResultAsync` to thread through sync code paths. `Result` is one type.

## What you lose

The union is wider than a `Settled`. Some operations only make sense once the value is settled — for example, bare property access via `isOk()` / `isErr()` guards. Those methods correctly refuse to narrow a `Pending`, and the fix is always the same: `await result.settle()` to collapse to a `Settled<T, E>`.

The cost is one extra method for transitioning between the async boundary and sync code. The benefit is that every other method in the API works the same on all three shapes.

## What you gain

A function like

```ts
function loadUser(id: string): Result<User, "not-found" | "network-error">
```

has a single signature whether it runs synchronously or asynchronously. The caller does not need to know. The chain is identical. The boundary is explicit and type-safe — `Pending` narrows to `Settled` with one call.

That is the whole argument. The rest of antithrow's design is consequences of that choice.

## Related reading

- [Eager vs lazy evaluation](./eager-vs-lazy) — how `Pending` composes with `await`.
- [The design of `settle`](./design-of-settle) — what `Settled` represents.
- [Comparison with other libraries](./comparison) — what other libraries chose and why.
