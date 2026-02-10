---
sidebar_position: 6
title: "Why not neverthrow?"
---

# Why not neverthrow?

[neverthrow](https://github.com/supermacro/neverthrow) pioneered `Result<T, E>` ergonomics in TypeScript and remains the most widely adopted library in this space. This page aims to be a fair, technical comparison for developers evaluating both libraries.

## At a glance

**Choose antithrow if you want:**

- Less boilerplate — auto-wrapped returns, one-step wrapping, object-form `match`
- Pre-built, type-safe wrappers for standard globals (`fetch`, `JSON.parse`, `atob`, …)
- A first-party ESLint plugin with multiple type-aware rules
- An API that closely mirrors Rust's `std::result`
- A Standard Schema bridge for Zod, Valibot, and ArkType

**Choose neverthrow if you want:**

- The largest community and the most battle-tested option
- Maximum Stack Overflow / blog coverage
- `Result.combine` / `Result.combineWithAllErrors` utilities

---

## Key differences

### 1. Less boilerplate

antithrow reduces ceremony in several places that add up in daily use.

**Generator composition — `chain()` vs `safeTry`**

```ts
// antithrow
import { chain } from "antithrow";

const result = chain(function* () {
  const a = yield* parseNumber(inputA);
  const b = yield* parseNumber(inputB);
  const quotient = yield* divide(a, b);
  return quotient * 2; // ← automatically wrapped in Ok
});

// neverthrow
import { safeTry, ok } from "neverthrow";

const result = safeTry(function* () {
  const a = yield* parseNumber(inputA);
  const b = yield* parseNumber(inputB);
  const quotient = yield* divide(a, b);
  return ok(quotient * 2); // ← must manually wrap in ok()
});
```

|                 | antithrow `chain()`                                                 | neverthrow `safeTry`                                                       |
| --------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Return wrapping | Automatic — just `return value`                                     | Manual — must `return ok(value)`                                           |
| Unwrap syntax   | `yield* result`                                                     | `yield* result` (previously required `yield* result.safeUnwrap()`)         |
| Async support   | `async function*` with `yield*` for both `Result` and `ResultAsync` | `async function*`, but `Promise<Result>` requires `yield* (await promise)` |

neverthrow has open issues around `safeTry` ergonomics ([#581](https://github.com/supermacro/neverthrow/issues/581), [#604](https://github.com/supermacro/neverthrow/issues/604)) that antithrow's `chain()` avoids by design.

**One-step wrapping — `Result.try()` vs `fromThrowable`**

antithrow's `Result.try()` and `ResultAsync.try()` execute immediately and return a result. neverthrow's `fromThrowable` is a factory that returns a _new function_ you then call separately:

```ts
// antithrow — one step
const parsed = Result.try(() => JSON.parse(input));
const data = await ResultAsync.try(() => fetchData());

// neverthrow — two steps each
const safeJsonParse = Result.fromThrowable(JSON.parse);
const parsed = safeJsonParse(input);

const safeFetchData = ResultAsync.fromThrowable(fetchData);
const data = await safeFetchData();
```

**Object-form `match()`**

antithrow uses a named-property object, which is self-documenting:

```ts
// antithrow
result.match({
  ok: (value) => `Result: ${value}`,
  err: (error) => `Error: ${error}`,
});

// neverthrow — positional arguments
result.match(
  (value) => `Result: ${value}`,
  (error) => `Error: ${error}`,
);
```

With positional arguments, swapping the callbacks is a silent bug. The object form makes intent explicit.

**Sync-to-async bridge methods**

Both libraries let you transition from a sync `Result` to a `ResultAsync`, but antithrow provides a broader set of bridge methods:

| Bridge method     | antithrow | neverthrow     |
| ----------------- | --------- | -------------- |
| `mapAsync`        | ✓         | `asyncMap`     |
| `mapErrAsync`     | ✓         | —              |
| `andThenAsync`    | ✓         | `asyncAndThen` |
| `orElseAsync`     | ✓         | —              |
| `inspectAsync`    | ✓         | —              |
| `inspectErrAsync` | ✓         | —              |

neverthrow covers the two most common cases (`asyncMap`, `asyncAndThen`). antithrow adds the error-side and side-effect variants so you can stay in the `Result` → `ResultAsync` pipeline without converting early.

**Rust-aligned naming**

antithrow's API mirrors Rust's [`std::result`](https://doc.rust-lang.org/stable/std/result/) closely — `unwrapOr`, `unwrapOrElse`, `isOkAnd`, `isErrAnd`, `inspect`, `inspectErr`, `flatten`, `expect`, `expectErr`. If you know Rust, the API is immediately familiar.

### 2. `@antithrow/std` — ready-to-use standard library wrappers

antithrow ships [`@antithrow/std`](./api/std), a companion package with non-throwing wrappers for standard globals. Each wrapper returns a `Result` or `ResultAsync` with **precise error types** — no `unknown`.

```ts
import { JSON, fetch, Response } from "@antithrow/std";

const config = JSON.parse<Config>(text);
// Result<Config, SyntaxError>

const body = await fetch("https://api.example.com/data").andThen((res) => Response.json<Data>(res));
// ResultAsync<Data, DOMException | TypeError | SyntaxError>
```

**Covered globals:** `JSON.parse`, `JSON.stringify`, `fetch`, `Response.json/text/arrayBuffer/blob/formData`, `structuredClone`, `atob`, `btoa`, `encodeURI`, `decodeURI`, `encodeURIComponent`, `decodeURIComponent`.

With neverthrow, you write these wrappers yourself using `fromThrowable`:

```ts
import { Result } from "neverthrow";

const safeJsonParse = Result.fromThrowable(JSON.parse, (e) => e as SyntaxError);
// You must create and maintain this for every throwing API you use.
```

### 3. First-party, actively maintained ESLint plugin

[`@antithrow/eslint-plugin`](./api/eslint-plugin) provides three type-aware rules:

| Rule               | Severity | What it catches                                       |
| ------------------ | -------- | ----------------------------------------------------- |
| `no-unused-result` | error    | Discarded `Result` / `ResultAsync` values             |
| `no-unsafe-unwrap` | warn     | `unwrap()` / `expect()` without prior narrowing       |
| `no-throwing-call` | warn     | Throwing APIs that have `@antithrow/std` replacements |

neverthrow's ESLint plugin ([`eslint-plugin-neverthrow`](https://github.com/mdbetancourt/eslint-plugin-neverthrow)) has a single rule (`must-use-result`), is a third-party package, and has [not been updated since November 2021](https://github.com/supermacro/neverthrow/issues/625).

### 4. Standard Schema support

[`@antithrow/standard-schema`](./api/standard-schema) wraps any [Standard Schema](https://github.com/standard-schema/standard-schema)–conforming validator (Zod, Valibot, ArkType) into `Result` types:

```ts
import { validate } from "@antithrow/standard-schema";
import { z } from "zod";

const result = await validate(z.string().email(), input);
// ResultAsync<string, FailureResult>
```

neverthrow has no equivalent.

---

## Common neverthrow issues

The neverthrow issue tracker surfaces recurring pain points. The table below summarizes each and whether antithrow is affected.

| Issue                                                                                                                                                                                                            | neverthrow | antithrow         | Notes                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `safeTry` error type inference across multiple yields ([#603](https://github.com/supermacro/neverthrow/issues/603))                                                                                              | Affected   | **Also affected** | Underlying TypeScript limitation — generators cannot infer a union of yielded error types across multiple `yield*` statements. Both libraries require an explicit type annotation on the generator when error types differ. |
| `andThen` fails on union return types ([#629](https://github.com/supermacro/neverthrow/issues/629), [#417](https://github.com/supermacro/neverthrow/issues/417))                                                 | Affected   | **Fixed**         | antithrow uses `InferOk`/`InferErr` helper types on the `this` parameter of `andThen`, so union result types are inferred correctly.                                                                                        |
| `combine()` broken for non-tuple arrays ([#434](https://github.com/supermacro/neverthrow/issues/434))                                                                                                            | Affected   | **Fixed**         | `Result.all()` / `ResultAsync.all()` provides correct type inference for both tuples and homogeneous arrays.                                                                                                                |
| Poor async/await interop ([#340](https://github.com/supermacro/neverthrow/issues/340), [#514](https://github.com/supermacro/neverthrow/issues/514), [#608](https://github.com/supermacro/neverthrow/issues/608)) | Affected   | **Improved**      | `chain(async function*() {...})` seamlessly handles both `Result` and `ResultAsync` via `yield*`. Bridge methods (`mapAsync`, `andThenAsync`, etc.) on sync `Result` transition to `ResultAsync` without manual wrapping.   |
| ESLint plugin unmaintained ([#625](https://github.com/supermacro/neverthrow/issues/625))                                                                                                                         | Affected   | **Fixed**         | antithrow ships a first-party `@antithrow/eslint-plugin` with three type-aware rules, maintained in the same monorepo.                                                                                                      |
| No `toJSON` / serialization ([#628](https://github.com/supermacro/neverthrow/issues/628))                                                                                                                        | Affected   | **Also affected** | Neither library provides built-in serialization. Results must be unwrapped before serializing.                                                                                                                              |
| No "finally" functionality ([#525](https://github.com/supermacro/neverthrow/issues/525))                                                                                                                         | Affected   | **Also affected** | Workaround: chain `.inspect()` and `.inspectErr()` to run side-effects regardless of variant.                                                                                                                               |
| Unsafe internals / `any` usage ([#648](https://github.com/supermacro/neverthrow/issues/648))                                                                                                                     | Affected   | **Fixed**         | antithrow compiles with `strict: true` throughout. Internal casts are documented phantom-type casts only — no `any`.                                                                                                        |
| Project maintenance concerns ([#670](https://github.com/supermacro/neverthrow/issues/670), [#531](https://github.com/supermacro/neverthrow/issues/531))                                                          | Affected   | **N/A**           | antithrow is actively maintained with all packages in a single monorepo.                                                                                                                                                    |
| No tree shaking ([#660](https://github.com/supermacro/neverthrow/issues/660))                                                                                                                                    | Affected   | **Fixed**         | antithrow ships ESM with no side-effects, enabling full tree shaking.                                                                                                                                                       |
| No `unwrapOrElse` ([#587](https://github.com/supermacro/neverthrow/issues/587), [#657](https://github.com/supermacro/neverthrow/issues/657))                                                                     | Affected   | **Fixed**         | antithrow provides `unwrapOrElse` on both `Result` and `ResultAsync`.                                                                                                                                                       |
| `ok()` without arguments ([#595](https://github.com/supermacro/neverthrow/issues/595), [#97](https://github.com/supermacro/neverthrow/issues/97))                                                                | Affected   | **Fixed**         | antithrow supports `ok()` with no arguments via an explicit `ok<E>(): Ok<void, E>` overload.                                                                                                                                |

---

## API comparison table

| Concept                   | antithrow                               | neverthrow                                             |
| ------------------------- | --------------------------------------- | ------------------------------------------------------ |
| Create Ok / Err           | `ok(value)`, `err(error)`               | `ok(value)`, `err(error)`                              |
| Wrap throwing fn          | `Result.try(fn)`                        | `Result.fromThrowable(fn)(args)`                       |
| Wrap async throwing fn    | `ResultAsync.try(fn)`                   | `ResultAsync.fromThrowable(fn)(args)`                  |
| Generator composition     | `chain(function* () { yield* result })` | `safeTry(function* () { yield* result.safeUnwrap() })` |
| Pattern match             | `match({ ok, err })`                    | `match(okFn, errFn)`                                   |
| Combine results           | `Result.all(list)`                      | `Result.combine(list)`                                 |
| Standard library wrappers | `@antithrow/std`                        | —                                                      |
| Schema validation bridge  | `@antithrow/standard-schema`            | —                                                      |
| ESLint rules              | 3 first-party rules                     | 1 third-party rule                                     |
| Dependencies              | 0                                       | 0                                                      |

---

## "But neverthrow has way more users"

It does — and that's a reasonable factor in any evaluation. neverthrow has 1M+ weekly npm downloads, 7k+ GitHub stars, and years of production use across many teams.

If community size and volume of existing resources are your top priorities, neverthrow is a safe choice.

antithrow prioritizes a different set of trade-offs:

- **Zero dependencies** and a small, stable API surface — less to audit, less to break.
- **Incremental adoption** — both libraries implement the same `Ok`/`Err` conceptual model, so migration is straightforward. Start at your API boundaries and work inward.
- **First-party tooling** — the ESLint plugin, standard library wrappers, and schema bridge are maintained in the same monorepo as the core, so they stay in sync.

---

## Maintenance notes

As of February 2026:

- neverthrow's last npm publish was v8.2.0, over a year ago. There are open issues about [maintenance status](https://github.com/supermacro/neverthrow/issues/670) and [modernizing the tooling](https://github.com/supermacro/neverthrow/issues/572).
- [`eslint-plugin-neverthrow`](https://github.com/mdbetancourt/eslint-plugin-neverthrow) has not been released since November 2021 and is [reported as no longer working](https://github.com/supermacro/neverthrow/issues/625).
- neverthrow has open issues around [type inference in `andThen`](https://github.com/supermacro/neverthrow/issues/629), [tree shaking support](https://github.com/supermacro/neverthrow/issues/660), and [code safety concerns](https://github.com/supermacro/neverthrow/issues/648).

antithrow is actively maintained with all packages — core, `@antithrow/std`, `@antithrow/eslint-plugin`, and `@antithrow/standard-schema` — developed and released from a single monorepo.

---

## Next steps

- [**Getting Started**](./getting-started) — install antithrow and write your first `Result`
- [**Composing with chain()**](./concepts/chain) — deep dive into generator-based composition
- [**Migrating from try-catch**](./recipes/migration) — incremental adoption guide
