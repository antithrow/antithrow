---
title: Why antithrow
description: The problem with thrown exceptions and what typed results buy you.
sidebar_position: 1
---

# Why antithrow

TypeScript's type system is, by design, silent on failure. A function may advertise `(input: string) => number`, quietly throw on bad input, and the compiler never forces a caller to reckon with that. Exceptions travel sideways through the type system.

That silence is what antithrow is built against.

## The cost of hidden failures

Three consequences follow from exceptions being untyped.

First, **callers cannot know what can go wrong without reading the implementation.** `JSON.parse` throws a `SyntaxError`. `fetch` rejects with `TypeError` on DNS failures, `AbortError` on cancellation, `DOMException` on CORS rejections. Nothing in the signature tells you so. You either remember, re-read the MDN page, or find out in production.

Second, **you end up wrapping call sites in reflexive `try/catch`.** The block quickly accretes — catch an error for `JSON.parse`, log it, maybe rethrow, maybe not. A few of these later, your happy path is buried under failure handling that was written defensively, not purposefully.

Third, **refactors silently change the set of throwable errors.** Adding a new code path inside a called function can introduce new failure modes its callers have no idea about. The compiler does not warn. The tests might not cover it.

These costs are not hypothetical. Most runtime incidents in a typed codebase trace back to one of them.

## What a Result buys you

A function that returns `Result<T, E>` instead of throwing flips every one of those properties.

The signature becomes honest. `parsePort(raw: string) => Result<number, "invalid-port">` tells the caller *everything* that can go wrong, by name, without reading the body.

Error handling becomes an ordinary expression. `result.map(...)`, `result.unwrapOr(...)`, `result.orElse(...)` are just method calls. There is no out-of-band control flow to catch. Code that does not care about a failure path can ignore it only by explicitly saying so (`.unwrapOr(fallback)`), not by writing nothing.

Refactors surface in the type checker. Adding a new failure variant changes the `E` in the return type, and every caller that still branches on the old shape stops compiling. The compiler becomes your audit tool.

## What this costs

Honesty is not free.

- Every failable function has a slightly longer return type.
- Using a third-party library that throws means wrapping its entry points with `Result.try(...)`.
- Async code flows through `Pending<T, E>` instead of raw `Promise<T>`. Most of the time that is invisible, but you will occasionally need to `await result.settle()` to force a boundary.

These are real costs. antithrow's position is that they are worth paying, because the alternative — production surprises that only appear at the end of a stack trace — is more expensive.

## Related reading

- [The three-state model](./three-state-model) — why `Pending` is a result, not a `Promise<Result>`.
- [Comparison with other libraries](./comparison) — what antithrow shares with and differs from `neverthrow`, `Effect`, and `fp-ts`.
- [When not to use antithrow](./when-not-to-use) — honest cases where exceptions are the right tool.
