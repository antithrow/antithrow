---
title: The design of settle
description: What Settled represents, and why settle exists alongside Pending.
sidebar_position: 5
---

# The design of settle

`Settled<T, E>` is antithrow's name for a `Result` that has finished — either `Ok` or `Err`, never `Pending`. The `settle()` method is the only way to cross from the async side of the union to the synchronous side, and that boundary is worth looking at directly.

## What Settled is

Formally, `Settled<T, E>` is `Ok<T, E> | Err<T, E>`. It is a strict subtype of `Result<T, E>`.

Two operations inhabit the boundary:

- `Pending<T, E>` implements `PromiseLike<Settled<T, E>>`, so `await pending` produces a `Settled`.
- `settle()` returns a `PromiseLike<Settled<T, E>>` from any result. On `Ok` and `Err` it resolves to `this`; on `Pending` it unwraps the inner promise.

You can always ask "is this result done?" by narrowing through `isPending()`, but once you need to proceed in ordinary sync code, `settle()` is the tool.

## Why not just await?

`await pending` works and is often what you want. `settle()` exists for three cases where `await` does not.

**You want a value of type `Settled` at a specific callsite.** TypeScript narrows `Pending | Settled` poorly in conditional branches. Calling `.settle()` gives you a single promise whose resolved type is `Settled<T, E>` without further narrowing.

**You want uniform handling regardless of synchrony.** If a function sometimes returns an `Ok` directly and sometimes returns a `Pending`, `await result.settle()` collapses both cases in one line. A bare `await` would also work on a `Pending`, but asking TypeScript to prove that is more work than calling the method.

**You are inside a generator.** `Result.do` lets you `yield*` a `Pending`, and the generator awaits the settled state before deciding whether to short-circuit. `settle()` is how the runtime implements that.

## Why Settled is a name at all

The simpler choice would be to spell `Settled<T, E>` inline as `Ok<T, E> | Err<T, E>` everywhere it appears. antithrow names it for one reason: it shows up in signatures enough that a name helps readability.

You will see `Settled` in three places:

1. The return type of `settle()`.
2. The resolved type of `Pending` (`PromiseLike<Settled<T, E>>`).
3. The payload of `UnwrapError.result`, which captures the settled state that failed to unwrap.

Everywhere else, prefer the full `Result<T, E>` union.

## The Promise.allSettled analogy

`Settled` takes its cue from `Promise.allSettled`, which yields `{ status: "fulfilled" | "rejected", … }`. That method exists because "did this promise complete?" and "did it succeed?" are different questions, and answering them separately is often what you want.

antithrow applies the same separation to `Result`. `Pending` asks the first question. `Ok` / `Err` — collectively `Settled` — answers the second.

## Related reading

- [The three-state model](./three-state-model) — why `Pending` exists alongside `Ok` and `Err`.
- [Eager vs lazy evaluation](./eager-vs-lazy) — how `Pending` relates to promise resolution.
