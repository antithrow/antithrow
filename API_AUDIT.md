# antithrow core API audit

**Target:** `antithrow` v3.0.0 (`packages/antithrow`) — the tri-state `Result` model (`Ok | Err | Pending`) and its public API surface: `Ok`, `Err`, `Pending`, `Result.try` / `Result.fromPromise` / `Result.do`, `UnwrapError`, `InferOk`, `InferErr`, `Settled`, plus the `antithrow/legacy` subpath, packaging, documentation, and ecosystem interop.

**Date:** 2026-08-11 · **Method:** 39-agent empirical audit (see [Methodology](#methodology)) · **Findings register:** [`api-audit/`](api-audit/)

---

## Executive summary

The v3 tri-state design is genuinely novel and much of it is executed with care: settled paths are allocation-free and rigorously lazy, the `// SAFETY:` casts are individually sound, `Pending` unification of sync/async is ergonomically strong, and the do-notation is best-in-class among JS Result libraries when used on the happy path. The audit recorded [102 empirically-observed strengths](api-audit/praise.md).

However, the audit found **17 critical and 56 high-severity issues**, and they are not scattered — they concentrate on a small number of structural decisions:

1. **The runtime and the type system use different definitions of "async."** Runtime dispatch uses structural thenable detection (`typeof value.then === "function"`); the type-level overloads dispatch on `U extends PromiseLike`. Any value with a non-promise `then` method (fluent builders, ORM chainables, mocks) is silently converted to a `Pending` that the compiler still calls `Ok`/`Err`/`Settled` — `isOk()` returns `false` on a compiler-proven `Ok`, and `unwrap()` returns garbage. This single mismatch underlies 5 of the 17 criticals.

2. **A `Pending` can carry a rejected promise, and then every "total" method lies.** Callbacks that throw are documented as "not caught" — but on the `Pending` path the throw becomes a rejected promise inside a type that promises `PromiseLike<Settled<T, E>>`. `unwrapOr(default)` rejects instead of returning the default; a dropped poisoned `Pending` **crashes the Node process** (and is silently swallowed in browsers — the failure mode is runtime-dependent). The library's own docs state the underlying promise never rejects; empirically it does, via at least seven public methods.

3. **`flatten()` is unsound three independent ways**: nominal (`instanceof`) runtime dispatch vs. structural static types diverges for wide `T`; the `Flatten*` types collapse to `never` for `Err`'s default `T = never`, erasing branches from unions; and `instanceof` breaks under package duplication and across realms — a cross-realm `flatten()` empirically turned an `Err` into a reported success.

4. **`Result.try<T, E>` / `Result.fromPromise<T, E>`'s `E` is an unchecked assertion.** There is no error-mapper parameter; `catch (e) { new Err(e as E) }` lets contextual inference fabricate arbitrarily rich error types with no cast, no annotation, and no runtime evidence. Every shipped `@antithrow/std` error type inherits this lie.

5. **The documentation is materially wrong on core paths.** The docs site documents a `.match()` method and a `Result.fromPromise` error-mapper that do not exist; the flagship `Result.do` example does not compile; "Throws: Never" is contradicted 12 lines earlier on the same page; the README still calls the current API "v2"; there is no migration guide, while the CHANGELOG omits the removal of `Result.all` and advertises a patch to it in the same release that deleted it.

6. **Capability regressions from v2 are real and unmitigated.** No collection combinators (`all`/`combine`/`any`) — the blessed alternative serializes concurrent work; no `match`, `inspect`/`tap`, `expect`, `fromThrowable`, `ok()`/`err()` factories; and the mechanical migrations (`match` → `mapOrElse`, `ResultAsync.fromPromise` → `Result.fromPromise`) silently produce wrong behavior rather than type errors.

7. **Ecosystem interop has sharp edges**: `Err`'s iterator throws a bare internal-invariant `Error` on ordinary iteration (spread, `for..of`, and — under jest/vitest — any `toEqual` involving an `Err`); the undeclared TypeScript floor is 5.4 (`NoInfer`), failing hard below it with `skipLibCheck: false` and silently mis-inferring with it; ESM-only exports make `require()` and jest resolution impossible while `tsc` type-checks them clean; and five public methods return types no consumer can name (blocking `declaration: true` downstream, TS2883).

None of this requires abandoning the tri-state design. Most of the critical mass resolves to five changes: (a) make async dispatch agree between runtime and types (normalize with `Promise.resolve`, brand-check rather than duck-type); (b) enforce the "a `Pending` always settles" invariant — route callback throws on the async path into `Err` or rethrow consistently, never a raw rejection; (c) replace `instanceof` dispatch with a brand symbol; (d) add an error mapper to `Result.try`/`fromPromise` and default `E` to `unknown`; (e) restore collection combinators and fix the documentation. The full prioritized list is under [Recommendations](#recommendations).

---

## Methodology

The audit ran as a 39-agent workflow (~3.8M tokens, ~3.4 hours wall clock, all agents on Claude Opus):

- **14 dimension auditors** ran in parallel, one per audit dimension (runtime semantics of each class, constructors, do-notation, type-level overloads, guards/variance, `flatten`, API completeness vs. Rust/neverthrow/ts-results-es/Effect, documentation accuracy, sibling-package consumers, exception posture, packaging, legacy migration). Every behavioral claim had to be demonstrated by running code (`bun` for runtime, the repo's TypeScript 6.0.3 via `tsc --noEmit --strict ...` for type-level assertions); claims without observed output were disallowed.
- **14 adversarial verifiers** independently re-ran or re-derived every finding's repro and attempted to refute it, with instructions to default to refutation when a claim did not reproduce. None of the 266 findings was refuted outright; 57 were adjusted (corrected claim wording or recalibrated severity — the registers carry the verifier's note on each), and the rest were confirmed as claimed.
- **A completeness critic** reviewed the coverage map and spawned **5 follow-up probes**: TypeScript compatibility floor, concurrency/cancellation, test-framework interop, test-suite efficacy (mutation testing), and cross-runtime/cross-realm behavior (node/bun/browser/workers).
- Verification completed for 219 of 266 surviving findings. The 4 probe verifiers for `ts-compat-floor`, `test-interop`, `suite-efficacy`, and `runtime-matrix` hit a session limit; the 47 findings from those probes are included **marked "unverified"** — audited empirically, but not adversarially re-tested.

Severity scale: **critical** = unsound/silently wrong behavior or types that lie; **high** = likely-hit footgun, wrong docs on a core path, or missing safeguard; **medium** = inconsistency or real ergonomic gap; **low** = polish; **info** = neutral observation.

---

## Findings by the numbers

| Dimension | critical | high | medium | low | info | total |
|---|---|---|---|---|---|---|
| ok-runtime | 1 | 3 | 7 | 5 | 1 | 17 |
| err-runtime | 1 | 3 | 6 | 4 | 1 | 15 |
| pending-runtime |  | 3 | 3 | 2 | 3 | 11 |
| constructors | 2 | 3 | 5 | 2 | 1 | 13 |
| do-notation |  | 3 | 7 | 1 | 2 | 13 |
| types-overloads | 1 |  | 7 | 3 | 2 | 13 |
| types-guards-variance | 1 | 1 | 5 | 4 |  | 11 |
| flatten | 2 |  | 3 | 3 | 1 | 9 |
| api-completeness | 1 | 3 | 10 | 3 | 1 | 18 |
| docs-accuracy |  | 4 | 7 | 7 | 1 | 19 |
| consumers | 1 | 5 | 7 | 3 | 1 | 17 |
| errors-exceptions |  | 3 | 8 | 2 | 1 | 14 |
| packaging |  | 2 | 5 | 8 | 1 | 16 |
| legacy-migration |  | 7 | 5 | 5 | 2 | 19 |
| probe-ts-compat-floor | 1 | 2 | 3 | 2 | 2 | 10 |
| probe-concurrency-cancellation | 1 | 3 | 6 | 3 | 1 | 14 |
| probe-test-interop | 3 | 3 | 3 | 1 |  | 10 |
| probe-suite-efficacy | 1 | 5 | 5 | 2 | 2 | 15 |
| probe-runtime-matrix | 1 | 3 | 5 | 1 | 2 | 12 |
| **Total** | **17** | **56** | **107** | **61** | **25** | **266** |

Detailed registers, with claims, quoted empirical evidence, recommendations, and verifier verdicts:

- [Critical findings](api-audit/critical.md) — full detail
- [High-severity findings](api-audit/high.md) — full detail
- [Medium-severity findings](api-audit/medium.md)
- [Low & informational findings](api-audit/low-info.md)
- [Strengths](api-audit/praise.md) · [Coverage report](api-audit/coverage.md) · [Machine-readable register](api-audit/findings.json)

---

## Key themes

### 1. Structural thenable detection vs. type-level promise detection (unsound)

`isThenable()` (`utils.ts`) treats any object or function with a callable `then` as async; the overloads on `Ok.map`, `Err.mapErr`, and `Result.try` dispatch on `U extends PromiseLike<...>`. The two predicates disagree for every non-promise thenable, and each disagreement is a compiler-endorsed lie: statically `Ok<U, E>`, dynamically a `Pending` built by *calling the foreign object's `then`* — which for a non-promise `then` yields a broken `Pending` whose `.promise` can be `undefined` (then `await p.settle()` returns `undefined` where the type promises `Settled`, and downstream `.isOk()` is a `TypeError`). It also means a `Result` **cannot carry** a legitimate thenable-shaped domain value at all — a capability the legacy v2 API had. Key findings: `ok-runtime/ok-1`, `ok-runtime/ok-2`, `err-runtime/err-1`, `constructors/ok-3`, `types-overloads/ok-1`, `pending-runtime/pend-6`, `legacy-migration` (thenable regression).

### 2. The poisoned `Pending`: rejected promises inside a type that promises settlement

The "callbacks are not caught" contract has opposite semantics on the two paths: sync receivers throw at the call site (catchable); `Pending` receivers convert the same throw into a rejection of the inner promise. From that point every escape valve breaks: `unwrapOr`/`unwrapOrElse`/`mapOr`/`mapOrElse`/`or`/`orElse`/`settle` reject instead of applying the fallback; `Pending` exposes no `catch`/`finally`; and a dropped poisoned `Pending` crashes Node (exit 1), kills a worker thread, or dissolves into console noise in browsers depending on runtime and flags. Async `Result.do` bodies that throw produce `Pending<T, never>` — an error channel typed `never` that rejects at runtime. Key findings: `pending-runtime/pend-1..3`, `errors-exceptions/ep-1..3`, `do-notation` (async throw), `probe-concurrency-cancellation/cc-1`, `probe-runtime-matrix/rt-1`.

### 3. `flatten()` is unsound: structural types, nominal runtime, realm-fragile

Three independent breaks: (a) `FlattenOk<T, E>` decides structurally on static `T` while runtime dispatches `instanceof` — for `T = unknown | object | any` the static type says `Ok` while runtime returns the inner `Err`/`Pending`; (b) all three `Flatten*` types collapse to `never` when `T = never` — the *default* `T` of `new Err(x)` — erasing the `Err` branch from flattened unions; (c) `instanceof` dispatch silently stops flattening across duplicated installs (npm dedupe failure, monorepo version skew) and across realms (iframes, `node:vm`), where it empirically turned an `Err` into a reported success. Key findings: `flatten/ok-1`, `flatten/ok-2`, `types-guards-variance/gv-1`, `consumers/rc-1`, `probe-runtime-matrix/rt-1`.

### 4. `E` is a free variable: `Result.try` / `Result.fromPromise` have no error mapper

`Result.try<number, DatabaseConnectionError>(() => JSON.parse(x))` compiles and produces an `Err` whose `.error` is a `SyntaxError` typed as `DatabaseConnectionError` — no cast, no warning. neverthrow's `fromThrowable(fn, errorFn)` solves this with a mandatory mapper; antithrow offers no equivalent, and the sibling packages (`@antithrow/std`, `@antithrow/node`) ship dozens of error types resting on this unchecked assertion — at least one (`JSON.stringify`'s precision overload) demonstrably wrong. Key findings: `constructors/ok-2`, `api-completeness/ok-1`, `consumers` (std error typing).

### 5. Documentation that does not match the shipped API

The docs site documents `.match({ok, err})` (does not exist), a `Result.fromPromise` mapper argument (does not exist; silently ignored at runtime), "Throws: Never" (false, self-contradicted on the same page), and `yield*`-a-`Promise` upgrades (neither compiles nor runs). The flagship `Result.do` example does not compile. base.ts `@example` blocks state wrong result types for `andThen`, `or`, `orElse`. `Result.try`/`fromPromise`/`do` have no hover documentation at all, and the `yield*` protocol — the mechanism behind `Result.do` — is undocumented. The README labels the current API "v2." Key findings: `docs-accuracy/*` (19 findings), `constructors/ok-10`, `api-completeness/ok-15`.

### 6. Missing surface: collections, match, taps, factories

No `all`/`combine`/`combineWithAllErrors`/`any`/`partition` (v2 had `Result.all`; the CHANGELOG both omits its removal and advertises a perf patch to it in the same release); hand-rolling `all` over `Pending`s requires `new Pending(...)` plus unsound casts plus the very try/catch the library exists to eliminate. No `match`/`fold` — and `mapOrElse`'s Rust-ordered `(defaultFn, fn)` silently inverts behavior when `T` and `E` are compatible, which is exactly the shape a mechanical v2 `match` migration produces. No `inspect`/`tap` (the `map`-as-tap workaround silently voids the value or upgrades to `Pending`); no `expect`; no `fromThrowable`; no `ok()`/`err()` factories (classes can't be used point-free); no `Result.isResult`; no `toJSON`/`Symbol.toStringTag`. Key findings: `api-completeness/*` (18 findings), `probe-concurrency-cancellation/cc-7..9`, `legacy-migration/*`.

### 7. Iteration protocol leaks internal invariants

`Err[Symbol.iterator]` yields once then throws a bare `Error("Unreachable: generator should have been halted")`. Ordinary user actions hit it: `[...err]`, `for..of`, `Array.from`, destructuring — and under jest/vitest, **any `toEqual` involving an `Err`** (their equality walkers iterate iterables). `Ok` silently yields nothing for the same operations; `for await` over a `Pending` throws the same internal error. This also contradicts the documented "UnwrapError is the only class antithrow ever throws." Key findings: `err-runtime` (iterator), `probe-test-interop/ti-1`, `probe-runtime-matrix/rt-7`.

### 8. Undeclared compatibility floors

TypeScript: hard floor 5.4 (`NoInfer`) with `skipLibCheck: false` (TS2304 in node_modules below it); with `skipLibCheck: true` (the ecosystem default) TS 4.7–5.3 *silently loses the `NoInfer` guard, infers wrong types, and writes them into the consumer's own `.d.ts`*. `antithrow/legacy` has a different floor (TS 5.0). No `engines`, no documented floor anywhere. Packaging: ESM-only exports map (no `require`/`default` condition) makes CJS `require()` and default-config jest fail at runtime while `tsc` under `nodenext` type-checks the same code clean; no LICENSE file in the tarball; seven types appearing in public signatures are unexported (consumers writing annotations or emitting declarations are blocked, TS2883). Key findings: `probe-ts-compat-floor/*`, `packaging/*`, `types-guards-variance/gv-7`.

### 9. The test suite doesn't guard the contracts that failed

Mutation testing showed `isThenable` — the single predicate all async dispatch rests on — has a 50% mutation score; the documented `@throws` contract has zero tests; `UnwrapError`'s public surface is unasserted; 56% of the "534 tests" guard the deprecated legacy API; the dominant assertion idiom (`expect(x.unwrap()).resolves.toBe(v)`) cannot distinguish `Ok<T>` from `Ok<Promise<T>>` because promise auto-flattening swallows the difference; type-level assertions are enforced only by the lint job; coverage is line-only with no threshold. No CI gate validates the published entrypoint (an empty `dist/index.js` would ship green). Key findings: `probe-suite-efficacy/*` (unverified but reproducible from the register).

---

## Recommendations

Priority-ordered; "breaking" is noted but was explicitly in scope.

1. **Unify async dispatch** (fixes theme 1). Pick one: (a) *nominal* — only `Promise` instances and `Pending`/brand-checked values trigger the async path, letting Results carry foreign thenables again (breaking for people relying on custom thenables being awaited); or (b) *structural everywhere* — keep duck-typing but make the type-level predicate identical to the runtime one and always normalize with `Promise.resolve(value).then(...)` so foreign thenables are adopted by real promise machinery instead of having their `then` invoked raw. Either way, have the `Pending` constructor reject non-thenables.
2. **Enforce "a `Pending` always settles"** (theme 2). On the `Pending` path, route callback throws/rejections into `Err` (or, if the no-catch contract must hold, re-throw synchronously at a documented boundary) — never leave a raw rejection inside `.promise`. Add `Pending.catch`/`finally` or an equivalent recovery method. This also fixes the crash-on-drop and the `unwrapOr` totality lie.
3. **Brand, don't `instanceof`** (theme 3). Use a `Symbol.for`-based brand for `flatten`, `Result.do`, and any internal dispatch, restoring correctness across duplicated installs and realms. Fix `Flatten*` types: handle `T = never` (don't collapse to `never`) and make wide-`T` behavior match runtime (or make `flatten` only accept statically-nested receivers, as legacy did).
4. **Add an error mapper to `Result.try`/`fromPromise`** (theme 4): `Result.try(fn, mapErr)`; without a mapper, `E` defaults to `unknown` — never a free variable. Add `Result.fromThrowable(fn, mapErr)` for wrap-and-reuse.
5. **Restore collection combinators**: `Result.all` (fail-fast, concurrent over `Pending`s), `combineWithAllErrors`, `any`, `partition`. This is the single most-cited practical gap and a regression from v2.
6. **Fix the iterator protocol**: `Err`'s iterator should terminate (`done: true`) after its yield rather than throwing an internal error; consider making the protocol non-enumerable or gating it so equality walkers and spreads don't detonate. Same for `Pending`'s async iterator.
7. **Add `match`, `inspect`/`inspectErr`, `expect`/`expectErr`, `ok()`/`err()` factories, `Result.isResult`, `toJSON`** — each has precedent (Rust/neverthrow/ts-results-es) and a demonstrated workaround cost in the register.
8. **Documentation sweep**: delete `.match()` and the `fromPromise` mapper from the docs site, fix every non-compiling example (the register lists each), correct "Throws: Never," document the `yield*` protocol and the sync/async `Result.do` asymmetry, update the README's "v2" framing, write a real v2→v3 migration guide, and disclose the `Result.all` removal in the CHANGELOG.
9. **Declare floors and fix packaging**: document/enforce TS ≥ 5.4 (or drop `NoInfer` to lower the floor), add `engines`, ship LICENSE, export the seven public-position types, and either add a `require` condition or document ESM-only loudly (including the jest implication).
10. **Harden the suite**: port the audit's repro corpus into regression tests (poisoned `Pending`, foreign thenables, cross-realm `flatten`, iterator protocol), add branch coverage + mutation testing for `isThenable`/`utils`, test the `@throws` contract, and gate the published artifact (entrypoint smoke test, `publint` + `attw` in CI).

---

## Caveats

- 47 findings from four follow-up probes (`ts-compat-floor`, `test-interop`, `suite-efficacy`, `runtime-matrix`) are **unverified** — their verifier agents hit a session limit. They are marked as such in the register and index below. Their evidence is quoted and reproducible, but treat their severity labels as provisional.
- Repro scripts lived in an ephemeral session scratchpad; all decisive observed output is quoted inline in the register, and each finding's evidence names the exact commands run.
- Comparative claims about Rust/neverthrow/ts-results-es/Effect are from model knowledge (no network access); all claims about antithrow itself are empirical.

---

## Full finding index

### critical ([details](api-audit/critical.md))

- `ok-runtime/ok-1` — `Ok.map` silently returns a `Pending` for any value that has a `then` method — the compiler still says `Ok<U, E>`
- `err-runtime/err-1` — Err.mapErr duck-types any object with a `then` method into a Pending, while the static type still says Err
- `constructors/ok-2` — E is an unchecked assertion: contextual inference fabricates a rich error type with no cast, no annotation and no runtime evidence
- `constructors/ok-3` — isThenable's duck-test silently upgrades ordinary values to Pending, so the sync overload's Settled<T,E> is unsound — both isOk() and isErr() return false, and awaiting can hang forever
- `types-overloads/ok-1` — Ok.map / Ok.mapErr type-lie: a callback whose declared return type is a supertype of Promise (object, unknown, {}) yields a value statically typed Ok/Err that is actually a Pending at runtime
- `types-guards-variance/gv-1` — Covariant `out T` + `flatten()`'s conditional return type is unsound: `Ok<object|unknown, E>.flatten()` is statically an `Ok` but returns an `Err`/`Pending` at runtime
- `flatten/ok-1` — All three Flatten* types collapse to `never` when T is `never` — which is the default T of `new Err(x)` — erasing the Err branch from flattened unions
- `flatten/ok-2` — Ok.flatten() dispatches nominally (instanceof) but FlattenOk decides structurally on the static T — for wide T (`unknown`, `object`) the type says `Ok` while runtime returns the inner `Err`/`Pending`
- `api-completeness/ok-1` — `Result.try` / `Result.fromPromise` have no error-mapper parameter, so the declared error type is a free variable that silently lies
- `consumers/rc-1` — Two copies of `antithrow` in a dep tree silently break `flatten()`, corrupting values while types say otherwise
- `probe-ts-compat-floor/ok-1` — SILENT: on TypeScript 4.7-5.3 with skipLibCheck (the default everywhere), Ok.mapOr loses its NoInfer guard, infers a wrong type, and writes that lie into the consumer's own .d.ts *(unverified)*
- `probe-concurrency-cancellation/cc-1` — A poisoned Pending in an eager fan-out crashes the Node process; three of four realistic fan-out shapes exit 1
- `probe-test-interop/ti-1` — Err[Symbol.iterator] throws on its 2nd next(), so expect(...).toEqual(...) involving ANY Err crashes under jest and vitest *(unverified)*
- `probe-test-interop/ti-2` — Every Pending is structurally equal to every other Pending — asserting an async success passes when it actually failed *(unverified)*
- `probe-test-interop/ti-3` — Under bun:test, Ok(undefined) and Err(undefined) are toEqual-equal — a failed void operation passes a success assertion *(unverified)*
- `probe-suite-efficacy/ok-1` — No gate anywhere validates the published entrypoint or exports map: shipping the legacy v2 API to every consumer leaves all five gates green *(unverified)*
- `probe-runtime-matrix/rt-1` — Cross-realm Ok.flatten() silently turns an Err into an Ok — reproduced in real browser iframes and node:vm *(unverified)*

### high ([details](api-audit/high.md))

- `ok-runtime/ok-2` — `Ok.map` builds a structurally broken `Pending` when the thenable's `then` does not return a promise; `settle()` then returns `undefined`
- `ok-runtime/ok-3` — `Ok.map` with an async callback converts a documented "not caught" throw into a process-killing unhandled rejection
- `ok-runtime/ok-6` — `flatten()` is `instanceof`-based, so a duplicated package install silently does not flatten and turns a nested `Err` into a reported success
- `err-runtime/err-2` — Err.mapErr with a rejecting async callback produces a Result that rejects instead of settling, and crashes the process if never awaited
- `err-runtime/err-3` — Reference docs state "No other method throws" for Err; at least six other methods throw
- `err-runtime/err-4` — Err's iterator throws an internal-invariant Error from ordinary iteration (spread, for..of, Array.from, Promise.all, destructuring), while Ok silently yields nothing
- `pending-runtime/pend-1` — A throwing or rejecting callback on the Pending path produces an unhandled promise rejection that crashes the process — even when the caller does await the result
- `pending-runtime/pend-2` — unwrapOr / unwrapOrElse / mapOr / mapOrElse / orElse / or / mapErr are documented as total fallbacks but reject on a poisoned Pending, and the fallback is never invoked
- `pending-runtime/pend-3` — Documentation states antithrow never rejects the underlying promise; the Pending combinators do
- `constructors/ok-1` — Result.fromPromise breaks on any non-Promise thenable: TypeError, or a Pending that settles to a non-Result value
- `constructors/ok-4` — Docs document a Result.fromPromise error-mapper parameter that does not exist; the example does not compile and the argument is silently ignored at runtime
- `constructors/ok-5` — The reference page's headline invariant "Throws: Never" is false for Result.fromPromise
- `do-notation/od-1` — A throw inside an async `Result.do` body produces a `Pending<T, never>` whose promise rejects — crashes Node when the Pending isn't awaited, and defeats `unwrapOr`
- `do-notation/od-2` — Reference docs for `Result` state "Throws: Never … or a `Pending` whose promise settles" — false for `Result.do`, and self-contradictory four lines earlier
- `do-notation/od-3` — How-to guide claims you can `yield*` a `Pending` or a `Promise` to upgrade a sync `Result.do` — neither compiles nor runs
- `types-guards-variance/gv-2` — `Ok#map`'s conditional overload lies when the callback's return type is `unknown` or a bare type parameter: static `Ok<U, E>`, runtime `Pending`
- `api-completeness/ok-2` — Core how-to page documents `.match({ ok, err })`, a method that does not exist in v3
- `api-completeness/ok-3` — No `match`/`fold`; `mapOrElse(defaultFn, fn)` is Rust-ordered and silently inverts when `T` and `E` are compatible
- `api-completeness/ok-4` — No collection combinators at all (`all`/`combine`/`combineWithAllErrors`/`any`/`partition`), and the only blessed alternative serializes async work
- `docs-accuracy/ok-1` — how-to guide documents a `.match()` method that does not exist on the v3 API
- `docs-accuracy/ok-2` — how-to guide documents a second `mapper` argument to `Result.fromPromise` that does not exist
- `docs-accuracy/ok-3` — The flagship `Result.do` synchronous example does not compile, and its async prose is wrong in both directions
- `docs-accuracy/ok-6` — reference/result.md's "Throws: Never" section is contradicted by the same page 12 lines earlier
- `consumers/rc-2` — `Promise<Pending<T,E>>` is expressible but unfulfillable — `.then` hands you a `Pending`-typed `Ok`
- `consumers/rc-3` — `Result.try`'s `E` is an unchecked cast — every shipped `@antithrow/std` error type is a lie the consumer can trip over
- `consumers/rc-4` — eslint-plugin identifies Result types by *file path substring*, producing destructive autofixes on unrelated user code
- `consumers/rc-6` — The plugin's own recommended rules produce 228 violations inside the sibling packages, and the plugin is never run on this repo
- `consumers/rc-8` — `@antithrow/std`'s `JSON.stringify` precision overload is wrong in both slots — the core gives no way to check it
- `errors-exceptions/ep-1` — The documented "errors thrown by fn are not caught" contract has opposite semantics on the sync vs Pending path; unwrapOr(default) rejects instead of returning the default
- `errors-exceptions/ep-2` — A dropped poisoned Pending crashes the Node process (exit 1); the library's own methods violate Pending's documented "must always resolve" invariant
- `errors-exceptions/ep-3` — Tutorial states "antithrow never rejects the underlying promise" — directly false, and contradicted by the library's own reference docs
- `packaging/pkg-1` — exports map omits "require"/"default": require() of the package is impossible, yet TypeScript (nodenext) type-checks it clean — a silent compile-time lie
- `packaging/pkg-3` — Five public methods return types that no consumer can name — `declaration: true` library authors are hard-blocked (TS2883)
- `legacy-migration/lm-1` — Mechanical `match({ok,err})` → `mapOrElse(errFn, okFn)` migration silently produces wrong output
- `legacy-migration/lm-2` — `ResultAsync.fromPromise` → `Result.fromPromise` is a same-name/different-contract trap that silently double-wraps
- `legacy-migration/lm-5` — `antithrow/legacy` is a dead end: the ecosystem packages and the ESLint plugin no longer speak legacy
- `legacy-migration/lm-6` — `Result.all`/`ResultAsync.all` were dropped with no replacement; the suggested `Result.do` path serializes concurrent work
- `legacy-migration/lm-7` — Values that merely have a `then` method can no longer be carried in a Result; core silently converts them into a permanently broken `Pending`
- `legacy-migration/lm-8` — No migration guide exists anywhere, and eight instance methods were removed without a documented replacement
- `legacy-migration/lm-9` — The name `Result<T,E>` was reused for a different type; a verbatim signature migration silently makes `unwrap()` possibly-async
- `probe-ts-compat-floor/ok-2` — HARD: with skipLibCheck:false, merely importing the package fails on every TypeScript below 5.4, with an unactionable TS2304 pointing into node_modules *(unverified)*
- `probe-ts-compat-floor/ok-3` — The package declares no TypeScript floor anywhere — no engines, no peerDependencies, no typesVersions, no README/docs/CHANGELOG statement — so the sub-floor consumer gets zero signal at install time or compile time *(unverified)*
- `probe-concurrency-cancellation/cc-2` — `unwrapOr`, `or`, `flatten` and `settle` on a Pending can reject — the total, callback-free escape valves are not total
- `probe-concurrency-cancellation/cc-3` — `Promise.any` over Results returns an Err and is type-identical to `Promise.race`; "first success wins" and "all failed" are both unimplementable with native combinators
- `probe-concurrency-cancellation/cc-5` — The same `.map(throwingFn)` throws synchronously, is skipped, or silently poisons — depending on which of the three states you hold; a try/catch around a fan-out catches only half the errors
- `probe-test-interop/ti-4` — A poisoned Pending that rejects after the test file finishes is silently swallowed by both bun:test and vitest (exit 0) *(unverified)*
- `probe-test-interop/ti-5` — bun:test rejects `expect(pending).resolves/.rejects` — the documented PromiseLike contract does not satisfy the repo's own runner *(unverified)*
- `probe-test-interop/ti-6` — UnwrapError's message omits the payload, so a test that fails via unwrap() prints nothing about what went wrong *(unverified)*
- `probe-suite-efficacy/ok-2` — isThenable — the package's async-dispatch predicate — has a 50% mutation score; four distinct behaviours are completely unguarded *(unverified)*
- `probe-suite-efficacy/ok-3` — The documented `@throws` contract has zero tests; a throwing callback on the Pending branch crashes the process and the suite would notice — it just never tries *(unverified)*
- `probe-suite-efficacy/ok-4` — UnwrapError's entire public surface (`.result`, `.name`) is unasserted — mutants that erase both survive *(unverified)*
- `probe-suite-efficacy/ok-5` — The dominant assertion idiom (`expect(x.unwrap()).resolves.toBe(v)`) cannot distinguish Ok<T> from Ok<Promise<T>> — promise auto-flattening swallows the difference *(unverified)*
- `probe-suite-efficacy/ok-6` — Coverage is line-only with no branch metric, no enforced threshold, and the entrypoint is not even in the report — so 100% is structurally incapable of falsifying anything *(unverified)*
- `probe-runtime-matrix/rt-2` — "Crashes the process" is false in every browser and edge runtime — the error becomes console noise and the request/page succeeds *(unverified)*
- `probe-runtime-matrix/rt-3` — On node, the crash is defeated by a global unhandledRejection handler or one CLI flag — under --unhandled-rejections=none the error vanishes with zero diagnostic *(unverified)*
- `probe-runtime-matrix/rt-4` — for-of / for-await over a Result throws a bare Error("Unreachable: generator should have been halted"), contradicting the documented "UnwrapError is the one exception antithrow throws" *(unverified)*

### medium ([details](api-audit/medium.md))

- `ok-runtime/ok-10` — `UnwrapError` message omits the value, and its enumerable `result` field leaks the whole payload into logs and breaks `JSON.stringify` on cyclic values
- `ok-runtime/ok-11` — No serialization or display story: `JSON.stringify(new Ok(undefined))` is `{}`, round-tripping is impossible, `structuredClone` loses the class, `${ok}` is `[object Object]`
- `ok-runtime/ok-12` — `mapOrElse` returns a bare value from `Ok` but a promise from `Err` for the identical call, forcing defensive `await` on any union
- `ok-runtime/ok-13` — `Ok<Promise<T>>` is inhabitable by the constructor but unreachable through `map` — a sync identity map silently converts it to `Pending`
- `ok-runtime/ok-7` — `map` returning a `Result` nests instead of chaining — `Ok.map(() => new Err(...))` is a success containing an error, with no guard
- `ok-runtime/ok-8` — `Ok` is iterable, but `for..of` / spread / `Array.from` silently produce nothing
- `ok-runtime/ok-9` — Four combinators, three different policies for the error channel: `map` keeps `E`, `and`/`andThen` drop it, `or` keeps it, `orElse` replaces it
- `err-runtime/err-10` — Async callbacks are accepted by map/mapErr but rejected by andThen/orElse — the async story is inconsistent across Err's own surface
- `err-runtime/err-5` — UnwrapError discards the underlying error: no `cause`, and the message never mentions what failed
- `err-runtime/err-6` — UnwrapError.result is typed Settled<unknown, unknown> (error type is unrecoverable) and is enumerable, so JSON serialization leaks the result and drops the message
- `err-runtime/err-7` — Subclasses of Err survive map/andThen/and/flatten/settle but are silently destroyed by mapErr — and Ok has the mirror-image inconsistency
- `err-runtime/err-8` — mapErr returning a Result nests instead of flattening — and a returned Pending is assimilated into Err<T, Ok<…>>
- `err-runtime/err-9` — unwrapOr/unwrapOrElse are unusable on a concrete Err because T defaults to never
- `pending-runtime/pend-4` — `for await (const x of pending)` throws an internal invariant error, and Array.fromAsync silently returns []
- `pending-runtime/pend-5` — Pending exposes no catch/finally and every async method returns PromiseLike, so a rejected Pending cannot be handled with ordinary Promise vocabulary
- `pending-runtime/pend-6` — Any value with a `then` method is silently assimilated by map, and a spec-noncompliant thenable produces a TypeError from inside pending.ts
- `constructors/ok-10` — wrap-a-throwing-function.md states the wrong inferred type: it is Settled<any, unknown>, not Result<unknown, unknown>
- `constructors/ok-6` — Result.try's PromiseLike overload declares Pending<T,E> but can return an Err at runtime, so .promise is undefined and .isPending() is false
- `constructors/ok-7` — No fromThrowable/wrap: Result.try cannot lift a throwing function into a reusable Result-returning function
- `constructors/ok-8` — The Result namespace exposes only try/fromPromise/do — no ok/err, fromNullable, fromSafePromise, or all/combine
- `constructors/ok-9` — A callback returning a union of two promise types is rejected outright, with a 25-line unreadable overload error
- `do-notation/od-10` — The documented remedy for throwing bodies — "use `Result.try`" — does not compose with `Result.do`: it nests, and flattening erases the error union
- `do-notation/od-4` — A `finally` block containing a `yield*` is silently truncated on fail-fast: cleanup after the yield never runs and the generator is abandoned mid-`finally`
- `do-notation/od-5` — A throwing `finally` during fail-fast destroys the short-circuit `Err` — the real error is replaced by the cleanup error
- `do-notation/od-6` — `return <a Result>` from a `do` body double-wraps into `Ok<Ok<…>>` — the exact shape neverthrow's `safeTry` requires
- `do-notation/od-7` — A sync `do` body returning a promise is not upgraded to `Pending` — you get `Ok<Promise<T>>`, breaking the library's own "promises upgrade to Pending" rule
- `do-notation/od-8` — `yield* err` is not a control-flow terminator for TypeScript, so guard-then-fail bodies lose narrowing — and the docs teach the non-terminating form
- `do-notation/od-9` — Anything typed as the full `Result<T, E>` union — including `Result.try`'s general overload and `@antithrow/std`'s `fetch` — is unusable in a sync `Result.do`
- `types-overloads/ok-11` — settle() and Pending return PromiseLike, so there is no .catch or .finally — yet the docs say callback throws are not caught
- `types-overloads/ok-2` — map/mapErr cannot round-trip through Result<T,E> in a generic function — writing your own combinator requires a cast
- `types-overloads/ok-3` — `or` keeps the receiver's error type while `orElse` discards it — `.or()` is unusable for error recovery on a Result union
- `types-overloads/ok-4` — On the Result union, `.map()` with a `T | Promise<T>` callback produces a 4-member union that is not a Result<T,E> — Err.map leaks Promise into its phantom ok-type
- `types-overloads/ok-5` — `NoInfer` on mapOr's defaultValue exists only on Ok — Err and Pending accept widening defaults that Ok rejects
- `types-overloads/ok-6` — unwrapOr's parameter is exactly `T` — no widening default and, unlike unwrapOrElse, no async default
- `types-overloads/ok-7` — base.ts @example blocks state the wrong result types for andThen, or, and orElse
- `types-guards-variance/gv-3` — `Err<T = never, E = unknown>`: `new Err<string>("boom")` compiles and silently types `.error` as `unknown`
- `types-guards-variance/gv-4` — Impossible guard branches narrow to uninhabitable intersections instead of `never`, so dead code type-checks silently (no discriminant property)
- `types-guards-variance/gv-5` — Inferred type predicates work for `filter(r => r.isOk())` but not for the negated form `filter(r => !r.isPending())`, which silently returns an unnarrowed array
- `types-guards-variance/gv-6` — No standalone/static guards (`Result.isOk`), so point-free narrowing is impossible
- `types-guards-variance/gv-7` — Seven types that appear in the published public signatures are not exported and cannot be named by consumers (`FlattenOk`, `FlattenErr`, `FlattenPending`, `SyncOrAsync`, `NonThenable`, `SameResolved`, `FlattenThenable`, plus `ResultBase`)
- `flatten/ok-4` — Ok<any, E>.flatten() destroys the error type E, replacing it with `unknown` on three of four union members
- `flatten/ok-5` — Docs claim `andThen(identity)` is equivalent to `.flatten()` — it is not, for either Ok or Err
- `flatten/ok-6` — v3 dropped the legacy `this`-constrained flatten signature, losing the compile-time guard against flattening a non-nested Result
- `api-completeness/ok-10` — No `Result.isResult` and the shared base class is not exported, so "is this a Result?" requires a three-way `instanceof`
- `api-completeness/ok-11` — No `expect`/`expectErr`, and `UnwrapError.message` omits the underlying error, making failed unwraps undebuggable from logs
- `api-completeness/ok-13` — No `ok()`/`err()` factory functions; classes cannot be called without `new`, so point-free usage fails at both type and runtime
- `api-completeness/ok-14` — No `toString`/`toJSON`/`Symbol.toStringTag`; JSON output carries no discriminant and `structuredClone` silently degrades a Result to a plain object
- `api-completeness/ok-15` — All three code examples on the "Combine results" how-to page fail to compile
- `api-completeness/ok-5` — `mapOrElse` and `unwrapOrElse` leak `PromiseLike` on a `Settled` receiver, so there is no way to exit the Result world with a plain value
- `api-completeness/ok-6` — No `inspect`/`inspectErr`/`tap`; the `map`-as-tap workaround silently voids the value or silently upgrades `Ok` to `Pending`
- `api-completeness/ok-7` — `map`/`mapErr` accept async callbacks but `andThen`/`orElse` reject them — an undocumented asymmetry on the most-used chaining method
- `api-completeness/ok-8` — No `fromThrowable` wrap-and-reuse factory; `Result.try` invokes immediately and forwards no arguments
- `api-completeness/ok-9` — The public `Pending` constructor is unguarded, so the combinators users are forced to hand-write can produce a Result that throws on `unwrapOr`
- `docs-accuracy/ok-10` — "UnwrapError is the only class antithrow ever throws" — `for...of` over an `Err` throws a plain Error
- `docs-accuracy/ok-12` — `Result.try(() => JSON.parse(x))` is documented as `Result<unknown, unknown>` but is actually `Settled<any, unknown>`
- `docs-accuracy/ok-14` — combine-results.md `and` / `or` examples pass functions where a Result is required
- `docs-accuracy/ok-15` — The `yield*` iterator protocol is undocumented in source, and its sync/async asymmetry is undocumented everywhere
- `docs-accuracy/ok-4` — base.ts `orElse` example claims the wrong type and contradicts its own signature
- `docs-accuracy/ok-5` — `Result.try`, `Result.fromPromise`, and `Result.do` have no hover documentation at all
- `docs-accuracy/ok-7` — base.ts `or` and `andThen` examples claim error types that are not produced
- `consumers/rc-10` — Awaiting a `Settled` — the shape most `@antithrow/std` functions return — is flagged by `@typescript-eslint/await-thenable`
- `consumers/rc-11` — 49 near-identical `Result.try(() => nodeFn(...args))` wrappers with no factory to collapse them, and a hand-rolled one loses all precision
- `consumers/rc-13` — Consumer-facing how-to docs contain three type errors on core composition APIs
- `consumers/rc-15` — No `Result.all`/`combine`: parallel composition must be hand-rolled through `Promise.all`
- `consumers/rc-5` — `Result.try` cannot produce `Settled` when the value type is an unresolved generic — this is why `@antithrow/std`'s `structuredClone` hand-rolls try/catch
- `consumers/rc-7` — No narrowing-assertion helper: the sibling packages' 124 `unwrap()` calls exist because `isOk()` cannot be used through an assertion, and the rule's own advice does not compile
- `consumers/rc-9` — A floating `Pending` is invisible to `@typescript-eslint/no-floating-promises` by default, and the plugin's own rule has large coverage gaps
- `errors-exceptions/ep-11` — No toJSON and no variant tag: Pending silently serializes to {"promise":{}}, Ok(undefined) and Err(undefined) are byte-identical, and structuredClone drops the class and UnwrapError.result
- `errors-exceptions/ep-12` — Pending has no catch/finally, so the only recovery from a poisoned Pending is the try/catch the library exists to eliminate
- `errors-exceptions/ep-4` — "UnwrapError is the only class antithrow ever throws" / "No other antithrow function throws" is false — three counterexamples, one thrown from library code
- `errors-exceptions/ep-5` — Result.do with an async generator returns Pending<T, never> — an error channel typed `never` that still rejects at runtime
- `errors-exceptions/ep-6` — UnwrapError message omits the payload, making every unwrap failure in a log indistinguishable
- `errors-exceptions/ep-7` — UnwrapError does not set `cause`, so an Err wrapping a real Error loses its stack trace entirely
- `errors-exceptions/ep-8` — UnwrapError.result is Settled<unknown, unknown> and UnwrapError is not generic, forcing a cast in every catch block
- `errors-exceptions/ep-9` — Thenable payloads: a pure identity mapErr executes the payload's .then(), and an Err holding a rejected promise converts the Err channel into the throw channel
- `packaging/pkg-2` — Jest (and any resolver that does not supply the "import" condition) cannot resolve `antithrow` at all — not "needs a transform", literally module-not-found
- `packaging/pkg-4` — `antithrow/legacy` is unreachable under `moduleResolution: node10` — the migration path is closed to exactly the projects that need it
- `packaging/pkg-6` — CHANGELOG 3.0.0 does not disclose that `Result.all` was removed — and its own patch entry advertises a function absent from the shipped root API
- `packaging/pkg-7` — Published tarball contains no LICENSE file despite `"license": "MIT"`
- `packaging/pkg-8` — `Result.try` and `Result.fromPromise` ship with zero IntelliSense documentation
- `legacy-migration/lm-10` — On the `Settled` union, `mapOrElse` and `unwrapOrElse` leak `PromiseLike` even with fully synchronous callbacks
- `legacy-migration/lm-12` — Accidentally mixing generations produces a misleading diagnostic about `[Symbol.asyncIterator]`
- `legacy-migration/lm-13` — `isOkAnd`/`isErrAnd` type-predicate narrowing has no equivalent in the new API
- `legacy-migration/lm-3` — CHANGELOG claims the legacy API "is marked as deprecated" — `ok()` and `okAsync()` are not
- `legacy-migration/lm-4` — Every code sample in the docs' "Legacy (v2) API" section imports from the root entrypoint and does not compile
- `probe-ts-compat-floor/ok-4` — antithrow/legacy has a different and higher hard floor (TS 5.0) than the main entry (TS 4.7), and the failure is a parse error skipLibCheck cannot suppress *(unverified)*
- `probe-ts-compat-floor/ok-5` — Undeclared `lib` floor: es2018 is required just to type-check the import with skipLibCheck:false, and Result.do needs es2015 (sync) / es2018 (async) *(unverified)*
- `probe-ts-compat-floor/ok-6` — Misleading IntelliSense on sub-floor compilers: hover shows an unresolved `NoInfer<U>` with an unsubstituted type parameter and a confidently wrong result type, with zero diagnostics *(unverified)*
- `probe-concurrency-cancellation/cc-10` — The "Combine results" docs page covers only sequential composition and contains two snippets that do not compile
- `probe-concurrency-cancellation/cc-11` — `Promise.allSettled` reports Ok and Err identically as "fulfilled"; its only discriminating power is to isolate poison, and that channel is typed `any`
- `probe-concurrency-cancellation/cc-4` — `Promise.all` over a fan-out silently discards every poison error after the first — no return value, no throw, no unhandledRejection
- `probe-concurrency-cancellation/cc-7` — Hand-rolling `all` forces `new Pending(...)` plus three unsound casts and a re-introduced try/catch; `Result.fromPromise` cannot lift an aggregate
- `probe-concurrency-cancellation/cc-8` — Eager construction makes concurrency limiting and retry impossible over Result values — every user-written combinator must take thunks, but the whole API produces values
- `probe-concurrency-cancellation/cc-9` — Capability regression: `antithrow/legacy` ships `Result.all`/`ResultAsync.all` and handles poison safely; core v3 ships neither
- `probe-test-interop/ti-7` — No test utilities, no static guards, no assertion helpers — consumers must hand-roll ~105 lines of matchers, and no matcher can narrow the type *(unverified)*
- `probe-test-interop/ti-8` — isPending() stays true forever and a Pending is neither introspectable nor cancellable — fake-timer tests strand with no diagnostic *(unverified)*
- `probe-test-interop/ti-9` — Jest cannot resolve the package at all, and even bypassing that, ti-1 makes jest unusable — no runner is fully supported end-to-end *(unverified)*
- `probe-suite-efficacy/ok-10` — The 241 type-level assertions are invisible to `bun test` and are enforced only by the `lint` job — so type regressions never fail the `test` job, and never fail pre-commit at all *(unverified)*
- `probe-suite-efficacy/ok-11` — publint is a metadata linter only — it reports "All good!" for a package whose entrypoint is an empty file *(unverified)*
- `probe-suite-efficacy/ok-7` — 56% of the headline "534 tests" guard the deprecated `antithrow/legacy` v2 API, not the v3 surface under audit *(unverified)*
- `probe-suite-efficacy/ok-8` — Async `Result.do` cleanup ordering is unguarded: dropping the `await` on `iter.return?.()` survives, so `finally` blocks can outlive the settled Pending *(unverified)*
- `probe-suite-efficacy/ok-9` — `NoInfer` on two of the three `Ok.mapOr` overloads is guarded by neither the tests nor `tsc --noEmit` *(unverified)*
- `probe-runtime-matrix/rt-5` — node halts on the spot, bun runs the rest of the script first — same source, opposite side effects *(unverified)*
- `probe-runtime-matrix/rt-6` — In node:worker_threads a dropped antithrow error kills the worker (not the process); bun reports that same dead worker with exit code 0 *(unverified)*
- `probe-runtime-matrix/rt-7` — Pending.unwrap() converts a catchable UnwrapError into a runtime-policy-dependent unhandled rejection *(unverified)*
- `probe-runtime-matrix/rt-8` — structuredClone / postMessage silently produces a method-less object that TypeScript still types as a Result; Pending cannot cross at all *(unverified)*
- `probe-runtime-matrix/rt-9` — No `engines` field: the runtime floor is undeclared, and the library's actual failure behaviour changes across the versions it silently accepts *(unverified)*

### low ([details](api-audit/low-info.md))

- `ok-runtime/ok-14` — `settle()` JSDoc says "otherwise returns itself" but it returns a fresh Promise of itself on every call, always costing a microtask
- `ok-runtime/ok-15` — Subclassing is half-supported: `map`/`andThen` hard-code `new Ok` while `mapErr`/`flatten` return `this`, so subclass identity survives some combinators and not others
- `ok-runtime/ok-16` — No structural equality, no zero-arg `Ok` for `Result<void, E>`, and detached methods throw
- `ok-runtime/ok-4` — `readonly value` is enforced only by the compiler: instances are not frozen, and `Object.assign` mutates it with zero casts
- `ok-runtime/ok-5` — `mapErr`/`orElse`/`flatten`/`or` return the identical instance — an undocumented aliasing contract that only holds because immutability is not enforced
- `err-runtime/err-11` — Err.mapOr lacks the NoInfer<U> that Ok.mapOr has, so U is inferred from the default value and diagnostics blame the wrong argument
- `err-runtime/err-12` — Err instances do not survive serialization boundaries and carry no branding: structuredClone strips the prototype, no toJSON, no Symbol.toStringTag, error is mutable
- `err-runtime/err-13` — No exported runtime type guard; Err detection relies on instanceof, which breaks across duplicated copies of the package
- `err-runtime/err-14` — isOk() on a concrete Err type-checks and exposes .value in a permanently dead branch
- `pending-runtime/pend-7` — `promise` is a public field that is only readonly at the type level; it can be swapped at runtime and settle() hands out the identical internal object
- `pending-runtime/pend-8` — A Pending whose inner promise resolves to a non-Result fails with an opaque TypeError from library internals rather than a diagnosable error
- `constructors/ok-11` — Result.fromPromise silently double-wraps a Pending, turning a failed Result into an Ok
- `constructors/ok-12` — Result.try and Result.fromPromise carry no JSDoc at all, while Result.do is fully documented
- `do-notation/od-11` — `Err`'s iterator leaks an internal sentinel error ("Unreachable: generator should have been halted") to any ordinary iteration of an `Err`
- `types-overloads/ok-10` — Pending<T,E> has no default type parameters while Ok<T,E=never> and Err<T=never,E=unknown> do
- `types-overloads/ok-8` — The map/mapErr conditional is distributive, splitting boolean and union results into a union of Ok/Err instead of one Ok/Err
- `types-overloads/ok-9` — A never-returning or any-returning map callback selects the PromiseLike overload, typing the result Pending<unknown, E>
- `types-guards-variance/gv-10` — Guards discard the generic parameter: inside `<R extends Result<...>>`, `r.isOk()` narrows to `Ok<unknown, unknown>` rather than `R & Ok<...>`
- `types-guards-variance/gv-11` — Internal underscore-prefixed parameter names leak into the published declaration file and therefore into consumer IntelliSense
- `types-guards-variance/gv-8` — `Pending<out T, out E>` has no default type parameters while `Ok` and `Err` both do
- `types-guards-variance/gv-9` — `InferOk`/`InferErr` are unconstrained and fail open to `never`, and they surface the phantom type parameters on heterogeneous unions
- `flatten/ok-3` — FlattenErr (and Ok(Pending).flatten()) merge an inner error type that is provably unreachable at runtime, forcing dead error handling
- `flatten/ok-7` — Pending.flatten() allocates a new Pending and an extra microtask even when nothing is nested, unlike Ok/Err which return `this`
- `flatten/ok-8` — flatten is the only method that dispatches on `instanceof`, so it silently no-ops across duplicate package instances
- `api-completeness/ok-12` — Missing predicate and utility combinators: `isOkAnd`/`isErrAnd`, `.ok()`/`.err()` Option bridge, `swap`, `zip`/`zipWith`, `andThrough`/`orTee`
- `api-completeness/ok-16` — `comparison.md` describes the neverthrow delta as "slightly different method surface", understating a large net removal
- `api-completeness/ok-17` — `unwrapOr` has no widening overload, so a differently-typed fallback is rejected
- `docs-accuracy/ok-11` — "`andThen(identity)` is equivalent to `.flatten()`" is false at both type and runtime level
- `docs-accuracy/ok-13` — `@throws` tags are inverted: the two methods that actually throw carry no `@throws` tag
- `docs-accuracy/ok-16` — base.ts `settle` example claims `Ok<number, string>` where the type is `Settled<number, string>`
- `docs-accuracy/ok-17` — `{@link UnwrapError}` in base.ts does not resolve — base.ts never imports it
- `docs-accuracy/ok-18` — README calls the current API "v2" while the package is 3.0.0
- `docs-accuracy/ok-8` — "If the function returns a promise, the result becomes Pending/PromiseLike" is stated unconditionally but depends on the receiver
- `docs-accuracy/ok-9` — `Result.do` JSDoc prose writes `yield* Ok(...)` — constructor-call syntax that throws at runtime
- `consumers/rc-12` — `isThenable` is duplicated byte-for-byte in `@antithrow/standard-schema` because the core does not export it
- `consumers/rc-16` — `@antithrow/std` and `@antithrow/node` widen guaranteed-`Pending` returns to `Result`, creating statically-live but unreachable branches
- `consumers/rc-17` — eslint-plugin has zero version coupling to the core it lints
- `errors-exceptions/ep-10` — Result.fromPromise "captures" a rejection whose reason is itself a promise, but the process still reports an unhandled rejection
- `errors-exceptions/ep-14` — base.ts JSDoc for unwrap/unwrapErr says "throws an UnwrapError" with no mention that Pending rejects instead
- `packaging/pkg-10` — `antithrow/package.json` is not exported, breaking tools that introspect the manifest
- `packaging/pkg-11` — No `engines` field and `target: "esnext"` — the runtime floor is undeclared and can drift silently between patch releases
- `packaging/pkg-12` — The deprecated legacy build is 65% of the install payload every v3 consumer downloads
- `packaging/pkg-14` — The `lint` pipeline runs publint, which reports "All good!" on a package that fails to load under Node CJS and Jest
- `packaging/pkg-15` — No declaration maps or sources shipped — go-to-definition dead-ends in .d.ts
- `packaging/pkg-16` — README is stale on version, silent on ESM-only, and bun-only on install
- `packaging/pkg-5` — Root and /legacy export identically-named, mutually-incompatible `Ok`/`Err`/`Result` — cross-entrypoint values fail `instanceof` and silently defeat `flatten()`
- `packaging/pkg-9` — Internal unused-parameter convention leaks into the published .d.ts — consumers see `_value`, `_fn` in IntelliSense
- `legacy-migration/lm-11` — `toAsync()` has no successor; lifting a settled Result into `Pending` requires the raw `new Pending(Promise.resolve(...))` constructor
- `legacy-migration/lm-14` — Shipped legacy code has undocumented defects: `Result.all` and `ResultAsync.all` disagree on which `Err` wins, and `ResultAsync.isOk` is documented as a type predicate but returns `Promise<boolean>`
- `legacy-migration/lm-15` — README says the root package is "the v2 class-based API" while the docs label the legacy subpath "Legacy (v2) API"
- `legacy-migration/lm-16` — A 3.0.0 patch-changelog entry describes a perf fix to `Result.all`, an API the 3.0.0 root does not have
- `legacy-migration/lm-17` — Both generations export identically-named `Ok`, `Err`, and `Result`; a mixed file requires aliasing, and importing both roughly 2.5x's the bundle
- `probe-ts-compat-floor/ok-7` — The project's own documented tsconfig prescribes `skipLibCheck: true`, which is exactly the setting that converts the hard incompatibility into the silent one *(unverified)*
- `probe-ts-compat-floor/ok-9` — The library source cannot be built under `erasableSyntaxOnly` (parameter properties), closing off Node/Bun type-stripping and source-consumption paths *(unverified)*
- `probe-concurrency-cancellation/cc-12` — `settle()` is a pure getter that returns `this.promise` by identity — the name implies work or safety it does not provide
- `probe-concurrency-cancellation/cc-13` — `Result.try(() => aResult)` is the only public way to de-poison a Pending, and it is undocumented and double-wraps
- `probe-concurrency-cancellation/cc-6` — No cancellation story anywhere: Pending exposes zero cancel surface, and a raced-out timeout leaves the loser running to completion
- `probe-test-interop/ti-10` — The type system provides zero protection against a cross-variant assertion, even under a strictly-typed toEqual *(unverified)*
- `probe-suite-efficacy/ok-12` — base.ts is 247 lines of JSDoc @example code that is never compiled or executed — 24 mutants inside those examples are unkillable by construction *(unverified)*
- `probe-suite-efficacy/ok-13` — The identity contract of the `return this` fast paths is unasserted *(unverified)*
- `probe-runtime-matrix/rt-10` — Array.fromAsync over a Pending: silent empty array on node 22+, loud TypeError on node <=20 — the same code fails differently by version *(unverified)*

### info ([details](api-audit/low-info.md))

- `ok-runtime/ok-17` — `Ok`'s short-circuit methods correctly never invoke their callbacks, and `map`'s sync-throw path is exactly as documented
- `err-runtime/err-15` — new Err() with no argument is a compile error but a working runtime object with error === undefined
- `pending-runtime/pend-10` — Because Pending is thenable, a Result cannot survive a Promise boundary — async functions returning Result silently downgrade to Settled
- `pending-runtime/pend-11` — Each Pending combinator costs a microtask hop, and callbacks fire whether or not anything is listening
- `pending-runtime/pend-9` — isPending() stays true forever, so a Pending that has already settled offers no synchronous read path
- `constructors/ok-13` — Generic forwarding of Result.try collapses to the widest overload, forcing callers to handle Pending for provably-sync work
- `do-notation/od-12` — `iter.return?.(undefined as T)` — an unsound cast whose only saving grace is that its result is discarded
- `do-notation/od-13` — `yield` without `*` on an `Err` compiles and behaves identically to `yield*`, giving two spellings for one operation
- `types-overloads/ok-12` — SameResolved can be bypassed by mapOrElse's third overload when the two branch types unify by widening
- `types-overloads/ok-13` — Calling through the abstract ResultBase type silently degrades every result to the imprecise base signature
- `flatten/ok-9` — Pending.flatten() collapses an arbitrarily deep Pending chain in a single call via thenable assimilation — correct, but undocumented and asymmetric with Ok.flatten()
- `api-completeness/ok-18` — Naming: `Pending` reads as a state flag rather than an async Result; `settle` has no prior-art precedent
- `docs-accuracy/ok-19` — tutorial/03's stated pipeline type is not the inferred type, though it is a sound supertype
- `consumers/rc-14` — Two thirds of the core method surface is never used by any sibling package
- `errors-exceptions/ep-13` — Zero test coverage for throwing callbacks on the Pending path across the 534-test suite
- `packaging/pkg-13` — Tree-shaking is effectively all-or-nothing: importing only `Ok` pulls 87% of the library
- `legacy-migration/lm-18` — `new Ok()` has no no-argument form, so legacy `ok()` / `okAsync()` void results need an explicit `undefined`
- `legacy-migration/lm-19` — `Result.do` is a faithful replacement for `chain` — verified on every behavioural axis
- `probe-ts-compat-floor/ok-10` — Forward compatibility is clean: the whole public type surface behaves identically on the TypeScript 7 native preview (tsgo), and node10 resolution is the only thing TS 7 breaks *(unverified)*
- `probe-ts-compat-floor/ok-8` — A drop-in, version-portable replacement for the NoInfer intrinsic reproduces the exact same behaviour on TypeScript 4.7 through 6.0.3 *(unverified)*
- `probe-concurrency-cancellation/cc-14` — `Result.do`'s fail-fast does not protect a generator body from a poisoned Pending
- `probe-suite-efficacy/ok-14` — The 132 un-awaited `.resolves`/`.rejects` assertions DO work — but only because of a Bun-specific tracker, and the adjacent floating-`then` idiom does not *(unverified)*
- `probe-suite-efficacy/ok-15` — What the maintainer must BUILD vs what can be tested today (triage of the gap classes) *(unverified)*
- `probe-runtime-matrix/rt-11` — Negative result: microtask scheduling of Pending chains is bit-identical across node 18/20/22/24 and bun *(unverified)*
- `probe-runtime-matrix/rt-12` — Mitigating context: all four mainstream test runners do detect a dropped Pending error and exit non-zero *(unverified)*
