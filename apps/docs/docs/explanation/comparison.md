---
title: Comparison with other libraries
description: How antithrow relates to try/catch, neverthrow, Effect, and fp-ts.
sidebar_position: 4
---

# Comparison with other libraries

No single Result library fits every codebase. This page lays out how antithrow sits relative to the alternatives so you can pick the right one honestly.

## Plain try / catch

`try` / `catch` is the baseline. It is universally understood, has no dependencies, and works with every API in the language. It is also the thing antithrow is explicitly reacting against.

The trade:

- **Exceptions are invisible in types.** The signature hides failure paths.
- **Handlers nest poorly.** A few layers of `try` in a single function and the happy path disappears.
- **Recovery is ad hoc.** There is no standard combinator for "try this, fall back to that, keep the error type."

antithrow costs you a wrapper (`Result.try`) at the boundary to any throwing code. In return you get everything the type checker can tell you about failures.

## neverthrow

`neverthrow` is the closest neighbour. It also pairs `Ok` / `Err` with a separate `ResultAsync` type for async operations.

Where they differ:

- **Three shapes versus two + async wrapper.** antithrow treats `Pending` as a first-class member of `Result<T, E>`, not a parallel type. See [the three-state model](./three-state-model) for the rationale.
- **Eager, like neverthrow.** Neither library describes an effect. Both run things as soon as you write them.
- **Slightly different method surface.** `andThen`, `map`, `mapErr`, `orElse`, `unwrapOr` exist in both. antithrow adds `settle`, `flatten`, and generator support (`Result.do`).

If you are already happy with neverthrow, antithrow is not a dramatic shift. The port is usually mechanical.

## Effect

`Effect` is a lazy, algebraic-effects-inspired runtime. It models computations — not just results — and handles cancellation, concurrency, dependency injection, and retries uniformly.

The trade:

- **Whole-application commitment.** Effect is most powerful when everything runs inside its runtime. Using it for a single module is awkward.
- **Steeper learning curve.** Tag types, layers, fibers, scopes. Worth learning if the power pays off.
- **Laziness.** See [eager vs lazy](./eager-vs-lazy). If you need retry, cancellation, and resource safety as primitives, Effect is a better choice than antithrow.

antithrow deliberately does less. If you want Rust's Result semantics without rewriting the host app, stay here. If you want a full effect system, use Effect.

## fp-ts

`fp-ts` offers `Either<E, A>`, `TaskEither<E, A>`, and the full Haskell-style typeclass hierarchy. It predates both antithrow and neverthrow by years and is the most faithful functional rendering.

The trade:

- **Idiom.** fp-ts expects pipe-first code (`pipe(value, f, g, h)`) and category-theoretic vocabulary. Lovely if you speak it, confusing if you don't.
- **Two types, not three.** `TaskEither` is separate from `Either`, with its own parallel API.
- **Heavy runtime.** More combinators, more imports, more bundle weight.

If your team already leans FP-heavy, fp-ts rewards familiarity. If they don't, antithrow's fluent API tends to land more smoothly.

## Summary

| | antithrow | neverthrow | Effect | fp-ts |
|---|---|---|---|---|
| Sync + async in one type | Yes (`Result`) | No (`ResultAsync`) | N/A (everything is an `Effect`) | No (`TaskEither`) |
| Eager execution | Yes | Yes | No | Yes |
| Cancellation primitive | No | No | Yes | No |
| Dependency injection | No | No | Yes | Partial |
| Requires whole-app adoption | No | No | Effectively yes | No |
| Method-chaining ergonomic | Yes | Yes | Yes | No (`pipe`-first) |

Pick whichever matches your constraints. antithrow is aimed at teams that want typed error handling without adopting a runtime.
