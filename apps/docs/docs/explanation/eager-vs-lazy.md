---
title: Eager vs lazy evaluation
description: When Pending resolves, and why antithrow chooses eager evaluation.
sidebar_position: 3
---

# Eager vs lazy evaluation

A Result library must decide when its pipeline actually runs. Two camps dominate. The lazy camp, exemplified by `Effect`, builds a description of the computation and defers execution until the consumer says "now." The eager camp, exemplified by antithrow and `neverthrow`, runs the computation as soon as it is expressed. antithrow sits firmly in the eager camp.

## What eager means

When you write

```ts
const pending = fetch("https://example.com").map((response) => response.status);
```

the network request starts immediately. `fetch` returns a `Pending<Response, …>` that is already backed by a live `Promise`. `.map` attaches a transformation to the underlying promise and returns a new `Pending`. Nothing waits for you to subscribe, await, or run a driver.

This matches the semantics of plain `Promise` and of throwing code. If you have called the function, the effect has started.

## What lazy would give you

Lazy systems delay the effect until a terminal step. That has genuine upsides:

- Composing two pipelines without running either is cheap.
- You can retry, timeout, cancel, or bracket a pipeline uniformly, because execution is under the library's control.
- Dependency injection becomes tractable — effects declare their requirements and the runtime supplies them.

These are the features `Effect` is built around. antithrow deliberately trades them away.

## Why antithrow chose eager

Three reasons.

**Mental model alignment.** JavaScript developers already have a lazy-eager split baked in: `Promise` is eager, generators are lazy, functions are eager. antithrow inherits the eager half so nothing about it surprises a TypeScript developer. `Pending` is a `Promise` you can branch on, not a description of one.

**Interop cost.** Every piece of JavaScript, including the runtime and the standard library, is eager. A lazy Result library would need to wrap and adapt everything, every time it crosses into user code. antithrow's `Result.try` and `Pending` integrate with raw promises and callbacks without ceremony, because it shares their execution model.

**Incremental adoption.** You can replace one throwing function at a time. A lazy framework wants you to run the entire application inside its runtime. antithrow works fine if one module returns `Result` and the rest still throw.

## Consequences you should know

Because `Pending` is eager, three things are true:

1. Constructing a `Pending` starts work. If you have side-effectful code that must not fire, do not wrap it in `Result.try` or `Result.fromPromise` until you are ready.
2. Retrying requires re-running the producer. `.orElse(() => fetch(url))` works because the thunk is invoked on failure; reusing the same `Pending` would yield the same settled result.
3. Chaining is attach-on-settle, not evaluate-on-demand. `.map` on a `Pending` attaches to the underlying promise; the transformation runs when the promise resolves, regardless of whether anything is listening.

If you need the lazy properties — uniform cancellation, resource brackets, retries by description — consider `Effect`. If you want Rust's `Result` fitted to JavaScript's execution model, use antithrow.

## Related reading

- [The three-state model](./three-state-model) — why `Pending` is a result, not a `Promise<Result>`.
- [Comparison with other libraries](./comparison) — where different libraries sit on the eager/lazy spectrum.
