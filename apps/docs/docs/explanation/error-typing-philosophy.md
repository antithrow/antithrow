---
title: Typed errors and the role of UnwrapError
description: What "errors in the type system" means, and why UnwrapError is the one exception antithrow throws.
sidebar_position: 6
---

# Typed errors and the role of UnwrapError

antithrow's central claim is that failure modes belong in the type system. This page unpacks what that actually means, and explains why `UnwrapError` — the one kind of exception antithrow does throw — is not a contradiction.

## Errors as values

In a typical TypeScript program, `E` is implicit. A function throws `SyntaxError`, the compiler shrugs, the caller guesses. In antithrow, `E` is a generic parameter: the second slot in `Result<T, E>`. It is chosen by the author of each function, and it flows through `andThen`, `map`, `mapErr`, and the rest of the combinators.

This has a practical consequence that is easy to undervalue until you feel it: **a code review can tell you whether a new failure mode is being added**, because the `E` in the signature widens. Without a typed error, "what can this throw?" is answered by running the code; with one, it is answered by reading the type.

`E` does not have to be `Error`. It can be anything — a string literal like `"invalid-port"`, a discriminated union, a branded error type, even `never` if the function cannot fail. Pick whatever distinguishes the failure modes your caller needs to react to. Use `Error` subclasses only when a stack trace genuinely helps.

## What this is not

Three common misreadings to head off.

**It is not exhaustive failure modelling.** A function that returns `Result<T, "db-error">` has not promised that the database is the only thing that can go wrong. Out-of-memory panics, bugs in the program, and third-party library misbehaviour still exist. The guarantee is "for the failure modes the author chose to model, here they are." That is a substantial improvement; it is not a guarantee of totality.

**It is not a performance story.** Thrown exceptions in JavaScript are not meaningfully slower than returned values in the cases that matter. antithrow exists for correctness, not speed.

**It is not an invitation to catch everything.** `Result.try` is a boundary tool for wrapping throwing APIs. It is not a blanket suggestion to wrap every call site in `try`. Internal code that already returns `Result` should stay that way; `Result.try` is for interop with code that doesn't.

## Why UnwrapError exists

`unwrap()` and `unwrapErr()` break the non-throwing promise. `result.unwrap()` returns the `Ok` value or *throws* `UnwrapError`. That looks like a compromise until you notice what the alternative is.

If `unwrap` returned `T | undefined`, every caller would need a nullish check, which would defeat the narrowing that `isOk()` already provides. If it returned `T | never`, the compiler would still let you call it on an `Err` and you would lose a silent runtime error. The chosen design — narrow with `isOk()`, then call `unwrap()`, or accept the panic — lines up with Rust's rationale: unwrapping a known-error is a bug, and bugs should be loud.

`UnwrapError` is loud. It carries the full settled result on `.result`, so diagnostics have enough context to attribute the failure to a specific line. It is not meant to be caught and rethrown; it is meant to crash a program whose invariants were violated.

In ordinary code, `unwrapOr`, `unwrapOrElse`, and `mapOr` are the safe cousins. Reach for `unwrap` only when you have already proved the shape with `isOk()` or when a panic is the correct response.

## Related reading

- [`UnwrapError` reference](../reference/antithrow/unwrap-error) — the class itself.
- [Why antithrow](./why-antithrow) — the broader argument for typed errors.
- [`@antithrow/eslint-plugin` rules](../reference/eslint-plugin/) — linting for unsafe `unwrap` usage.
