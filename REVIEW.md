# Comprehensive code review: `antithrow` (core package)

Scope: `packages/antithrow` — the modern tri-state API (`src/`, excluding `src/legacy/` except where it informs migration parity). Every type-level claim below was verified empirically with `tsc --noEmit` probes and `bun test` runs against the current source (534 existing tests pass; `tsc`, `build`, and `publint` are clean).

Findings are grouped by theme and roughly ordered by severity within each group. Each includes a file/line reference and a suggested direction.

---

## 1. Type soundness & correctness

### 1.1 `Pending` inside `T` produces types that lie (thenable assimilation) — **high**

Because `Pending` implements `PromiseLike` (`src/pending.ts:25`), any code path that puts a `Pending` *inside* a promise silently collapses it, while the type system says otherwise.

Verified reproduction:

```ts
const inner = new Pending<number, string>(Promise.resolve(new Ok(42)));
const r = new Ok<number, never>(1).map(async () => inner);
// Type:    Pending<Pending<number, string>, never>
// Runtime: the outer promise assimilates `inner`, so the settled value is
//          Ok<number> — `settled.value instanceof Pending` is false.
```

`Ok.map`'s async overload (`src/ok.ts:42`) infers `U = Pending<…>` from `PromiseLike<U>`, but `result.then((v) => new Ok(v))` at `src/ok.ts:49` receives the *assimilated* settled value. The same applies anywhere a callback returns `Promise<Pending<…>>`.

Suggested direction: at minimum document that `Pending` must never appear as a `T`/`E` payload; ideally add a type-level guard (e.g. `map<U>(fn: (value: T) => PromiseLike<Exclude<U, Pending<any, any>>>)`-style constraint or an `Awaited`-based normalization of `U` in the async overloads so the declared type matches the runtime value).

### 1.2 `settle()` can reject — **high**

`settle()`'s contract ("returns a settled result", `src/base.ts:237-246`) is violated whenever the underlying promise rejects, which happens through documented-but-easy paths:

- a callback passed to `Pending.map`/`mapErr`/`andThen`/… throws or rejects (`src/pending.ts:50-104` — the `.then` chain has no rejection handling);
- a `Result.do` async generator body throws (`src/result.ts:92-102`);
- a user-constructed `new Pending(rejectedPromise)`.

`await result.settle()` then throws — exactly the failure mode the library exists to eliminate, from the method whose name promises the opposite. The README warning covers callbacks in general, but `settle()` specifically deserves an explicit `@throws` JSDoc, and it's worth considering whether `settle()` (or a variant, e.g. `settle({ trap: true })` / `Result.try(() => pending)` support) should convert rejections into `Err<unknown>` at the boundary, since "the app boundary" is precisely where the README tells users to call it.

Related hazard: a dropped rejected `Pending` (never awaited) triggers unhandled-rejection warnings/crashes (Node exits by default). `Result.fromPromise` attaches handlers, so plain wrapped promises are safe, but the paths above are not.

### 1.3 `Result.do` sync body throws escape synchronously — **medium (documented, but worth restating)**

Verified: `Result.do(function* () { throw new Error("boom"); })` throws out of `Result.do` itself (`src/result.ts:105`), while the return type says `Ok`/`Settled`. This is the documented design ("thrown exceptions are not converted"), but combined with 1.2 it means the same programming error surfaces three different ways depending on context (sync throw, rejected `Pending`, rejected `settle()`). A short "error-escape semantics" section in the README/docs enumerating all three would prevent a lot of confusion.

### 1.4 `Ok.flatten` relies on `instanceof` — breaks silently with duplicated package copies — **medium**

`src/ok.ts:103` checks `this.value instanceof Ok || … instanceof Err || … instanceof Pending`. If a project ends up with two copies of `antithrow` (version skew in a monorepo, npm dedup failure, bundler duplication) — or mixes `antithrow` and `antithrow/legacy` values — `flatten()` returns the outer `Ok` still wrapping the inner result while the *type* says it flattened. That's a silent wrong-value bug, not an error.

Suggested direction: brand-based detection (a `Symbol.for("antithrow.result")`-keyed property or a protected brand field on `ResultBase`) used by `flatten` and exposed as a public `Result.isResult(value)` guard (see 2.6).

### 1.5 `Result.do` trusts that anything yielded is an `Err` — **low/medium**

`src/result.ts:93-98` and `:106-109` treat any not-done `next.value` as the fail-fast result. TypeScript prevents misuse, but for plain-JS consumers, `yield someValue` (instead of `yield*`) makes `Result.do` silently return that value as if it were the short-circuit `Err`. A cheap dev-time assertion (`next.value instanceof Err`, or the brand from 1.4) with a descriptive error would convert a silent wrong-value bug into an immediate, explainable one.

### 1.6 Spreading/iterating results throws a confusing internal error — **low**

`[...new Err("x")]` yields the `Err` once, then throws `Error("Unreachable: generator should have been halted")` (`src/err.ts:121-124`) — verified. `[...new Ok(1)]` produces `[]`. The iterator protocol is an implementation detail for `yield*`, but it's publicly reachable; the "Unreachable" message will read as a library bug. Consider a clearer message ("Result iterators are only for use with yield* inside Result.do") and a docs note that results are not general-purpose iterables.

---

## 2. Public API usability

### 2.1 Freshly-constructed `Err` values can't use half the API (`T = never`) — **high**

Because `Err<out T = never, …>` defaults `T` to `never` and several methods constrain their inputs by `T`, all of the following are **type errors** (each verified):

```ts
const e = new Err("boom");
e.unwrapOr(0);            // ✗ 0 is not assignable to never
e.unwrapOrElse(() => 0);  // ✗
e.or(new Ok(1));          // ✗ Ok<number> is not Result<never, unknown>
e.orElse(() => new Ok(1)); // ✗
// (andThen / and / map / mapErr are fine — their generics are unconstrained)
```

This bites in realistic code: any helper that returns `new Err(...)` early and is then composed point-free, tests, and REPL exploration. The fix that preserves Rust semantics while fitting TS is to let these methods introduce their own value-type generic and widen:

```ts
unwrapOr<U>(value: U): T | U;
unwrapOrElse<U>(fn: (error: E) => SyncOrAsync<U>): SyncOrAsync<T | U>;
or<U, F>(result: Result<U, F>): Result<T | U, F>;
orElse<U, F>(fn: (error: E) => Result<U, F>): Result<T | U, F>;
```

### 2.2 `unwrapOr` / `unwrapOrElse` can't widen even on healthy results — **high**

Verified: `(result as Result<number, string>).unwrapOr(null)` is a type error — the default must be exactly `T` (`src/base.ts:219`). `result.unwrapOr(undefined)` / `unwrapOr(null)` is one of the most common result-consumption patterns in JS (neverthrow allows it via `unwrapOr<A>(v: A): T | A`). Same generic-widening fix as 2.1 solves both.

### 2.3 No `ok()` / `err()` factory helpers — **high (ergonomics)**

The modern API requires `new Ok(...)` / `new Err(...)` everywhere. Consequences:

- Chained/inline code is noisier: `andThen((x) => new Ok(x + 1))` vs `andThen((x) => ok(x + 1))`.
- Classes aren't callable, so point-free style is impossible: `values.map(Ok)` doesn't work, `values.map((v) => new Ok(v))` is required.
- Specifying the error type reads awkwardly: `new Ok<number, ConfigError>(42)` vs `ok<number, ConfigError>(42)`.
- The legacy API and every comparable library (neverthrow, ts-results, effect) provide factories; the migration note in the changelog says "migrate to the new constructors," and this is the single biggest friction point in doing so.

Two-line addition, fully backward compatible: `export const ok = <T, E = never>(value: T): Ok<T, E> => new Ok(value);` (plus a zero-arg overload, see 2.4) and the same for `err`.

### 2.4 No void/empty success value — **medium**

`new Ok()` is a type error (constructor requires an argument, `src/ok.ts:26`); the legacy API deliberately supported `ok()` → `Ok<void>` (added in 1.1.0, `src/legacy/result.ts:667`). Operations that succeed with nothing to return (deletes, writes, validations) now need `new Ok(undefined)` with an explicit `Ok<void, E>` annotation. Restore the zero-arg form (on the factory from 2.3, or via `constructor(value?: T)` overloads).

### 2.5 `Result.all` and friends are gone — no way to combine results — **high**

The legacy API has `Result.all` (`src/legacy/result.ts:715`); the modern namespace has only `try`, `fromPromise`, and `do` (`src/result.ts:115-119`). Combining N results — the second-most-common operation after chaining — now requires a hand-rolled loop, and combining N `Pending`s requires dropping down to `Promise.all` and manually rewrapping, losing typed errors along the way. `Result.do` covers sequential composition but not concurrent composition.

Confusingly, the 3.0.0 changelog even carries a patch note "perf: reduce unnecessary array overhead in `Result.all`" (that's the legacy one), which reads as if the modern API has it.

Suggested minimum: tuple-aware `Result.all` that accepts `readonly (Ok|Err|Pending)[]`, returns `Settled` when all inputs are settled and `Pending` otherwise, and short-circuits on the first `Err`. Natural follow-ons: `Result.allSettled`-analogue (collect all errors) and `Result.any`.

### 2.6 No way to test "is this a Result?" — **medium**

`ResultBase` is not exported, so consumers can't `instanceof`-check a single base; they must write `v instanceof Ok || v instanceof Err || v instanceof Pending`, which also inherits the multi-copy fragility from 1.4. Export a `Result.isResult(value): value is Result<unknown, unknown>` guard (brand-based per 1.4).

### 2.7 Legacy → modern migration is lossy with no documented equivalents — **medium**

Methods present in legacy with no modern counterpart or documented replacement:

| Legacy | Modern equivalent | Notes |
|---|---|---|
| `match({ ok, err })` | `mapOrElse(errFn, okFn)` | exists, but reversed arg order and no named-handler form; `match` is the friendlier API for app code |
| `inspect` / `inspectErr` | — | no tap; mid-chain logging now requires `map((v) => { log(v); return v; })` |
| `expect(msg)` / `expectErr(msg)` | — | no way to unwrap with a custom message |
| `isOkAnd` / `isErrAnd` | — | including their type-predicate narrowing forms |
| `Result.all` | — | see 2.5 |
| `ok()` (void) | — | see 2.4 |

Each omission may be deliberate scope-trimming, but the changelog/README should say what replaces what (a migration table), and `inspect`/`inspectErr` at least are cheap, side-effect-free wins that every result library ships (Rust included).

### 2.8 Types used in public signatures aren't all exported — **low**

`SyncOrAsync` appears in exported method signatures (`src/base.ts` throughout) but isn't exported from `src/index.ts:6`, so users can't name it when writing their own wrappers (`fn: (v: T) => SyncOrAsync<U>`). Same for `NonThenable`/`FlattenThenable` if they're considered part of the contract. Export `SyncOrAsync` at minimum.

### 2.9 Union-receiver method calls produce noisy inferred types — **low (DX)**

Calling methods on `Result<T, E>` (the union) unions the three classes' signatures, producing hovers like `Err<string, string> | Pending<string, string | number> | Result<string, number>` — visible in the package's own tests (`src/result.test.ts:498-500`, which need `toExtend` plus a hand-written mess to assert). Users see this in editor hovers and error messages. Hard to fully fix while keeping per-class narrowing, but the `or` cleanup in 3.1 removes one source of noise, and normalizing the per-class return types toward the base signatures where possible would help.

### 2.10 `Pending` is `PromiseLike`, not `Promise` — **low (document it)**

`pending.catch(...)` / `pending.finally(...)` fail at runtime (verified: `TypeError: … .catch is not a function`) and at type level. That's a defensible design, but worth one sentence in the `Pending` JSDoc since every JS developer's muscle memory expects them.

Related positive worth documenting: `await result` works uniformly on all three states (`await` passes non-thenables through), so `const settled = await anyResult` is equivalent to `await anyResult.settle()` — a genuinely nice property that the docs never mention.

### 2.11 `UnwrapError` drops the payload from the message — **low**

Legacy: `` `Called unwrap on an Err value: ${String(this.error)}` `` (`src/legacy/result.ts:545`). Modern: static message + structured `.result` (`src/errors.ts:21-30`). The structured field is better, but uncaught-error logs (the main place `UnwrapError` is ever seen) now show no hint of what failed. Append a best-effort `String(...)` of the contained value/error to the message, and consider making the class generic (`UnwrapError<R extends Settled<unknown, unknown>>`) so `catch`-side code narrowing on `instanceof` keeps type info.

---

## 3. API consistency

### 3.1 `or` disagrees with `orElse` (and with Rust) about the resulting error type

Verified: `new Ok<number, string>(5).or(fallbackWithBooleanError)` keeps `E = string` (`src/ok.ts:91-94`), while `.orElse(...)` replaces it with the callback's error type (`src/ok.ts:96`). `Pending.or` widens to `E | InferErr<R>` (`src/pending.ts:96`), `Err.or` returns exactly `R`. Rust's `or` produces error type `F` in all cases — after `or`, the original `E` can no longer occur. The phantom `E` isn't unsound, but it pollutes downstream error unions forever and is the main contributor to the noisy unions in 2.9. Align all three classes (and the `ResultBase` contract at `src/base.ts:156`) on `F`-only.

### 3.2 `NoInfer` applied inconsistently across `mapOr` implementations

`Ok.mapOr` pins inference with `NoInfer<U>` on the default (`src/ok.ts:60-62`); `Err.mapOr` (`src/err.ts:52`) and `Pending.mapOr` (`src/pending.ts:64`) don't. Inference for the same call therefore differs depending on how the receiver is narrowed. Apply `NoInfer` uniformly.

### 3.3 Redundant overload on `Err.mapOr`

`src/err.ts:52-53`: the single overload and the implementation signature are identical — the overload adds nothing and can be deleted.

### 3.4 Two different strategies for the same sync/async overload problem

`Ok.mapOr` and `Result.try` use the `NonThenable<T>` trick; `Err.mapErr`/`Err.unwrapOrElse`/`Ok.map` rely on overload ordering with a conditional-type second overload (`src/err.ts:40-42`, `src/ok.ts:42-44`). Both work, but maintaining two idioms for one problem invites drift; pick one (the `NonThenable` approach is the more explicit) and use it everywhere.

### 3.5 Asymmetric generic defaults between `Ok` and `Err`

`Ok<out T, out E = never>` vs `Err<out T = never, out E = unknown>` (`src/ok.ts:25`, `src/err.ts:18`). Why does a bare `Err` annotation default its error to `unknown` while a bare `Ok` forbids… nothing (E defaults to the correct `never`)? `E = unknown` means `function f(): Err { … }` type-checks with a uselessly-wide error. Consider requiring `E` (no default) or defaulting it symmetrically.

### 3.6 Stale/incorrect SAFETY comment

`src/ok.ts:98` (`orElse`): "Casts uninhabited E type to F" — there is no `F` in scope; the signature uses `InferErr<R>`. Copy-paste from `mapErr`.

### 3.7 Unreachable overload on `Pending.mapOrElse`

The third overload (`src/pending.ts:76-79`) declares `SyncOrAsync<U>` but `Pending` can only ever return `PromiseLike`. If it exists for union-receiver compatibility, a comment saying so would stop future readers from "fixing" it; otherwise drop it.

### 3.8 Impl-signature nit in `resultDo`

`src/result.ts:84`: the implementation union types the sync generator as `Generator<Err<T, unknown>, T, void>` — using `T` (the *return* type) as the yielded `Err`'s **value** type. Harmless (implementation signature only), but `Err<unknown, unknown>` is what's meant.

### 3.9 `Ok.settle()` / `Err.settle()` allocate per call

`Promise.resolve(this)` on every call (`src/ok.ts:127-129`, `src/err.ts:117-119`). Micro, but a settled result could lazily cache its resolved promise if `settle()` shows up in hot paths.

---

## 4. Documentation

- **`src/base.ts:83`** — "the result becomes {@link PromiseLike}" is both awkward and inconsistent with `map`/`mapErr`'s "becomes {@link Pending}". Should read "the return value becomes a `PromiseLike`".
- **`src/base.ts:146-154`** — the `or` example's comment claims the result is `Ok<number, string | boolean>`; the actual current return (per `Err.or`) is the fallback `Ok<number, boolean>`. (Resolving 3.1 settles what the comment *should* say.)
- **`src/base.ts:238`** — "otherwise returns itself" — it returns a *promise of* itself.
- **`src/base.ts:39` and `:242`** — examples annotate `Result.try(async () => 42)` as `Result<number, string>`; the inferred type is `Pending<number, unknown>`. Fine as illustration, but `Pending<number, string>` with an explicit type argument would be honest.
- **`README.md:79-80`** — comments in the modern-API example use the *legacy* lowercase style: `// ok(4)`, `// ok(5)`. Should be `// Ok(4)` or `// Ok<number> with value 4`.
- **`README.md:164`** — "The modern root package is the **v2** class-based API" — the tri-state API shipped in **v3.0.0**; "v2" here will confuse anyone cross-referencing the changelog.
- **`CHANGELOG.md` (3.0.0 → Patch Changes)** — the `Result.all` perf note refers to the legacy `Result.all` but sits directly under the release that removed it from the main entrypoint; a "(legacy)" qualifier would help.
- **README warning block** — good, but per 1.1–1.3 it should also cover: `settle()` can reject; a dropped rejected `Pending` is an unhandled rejection; `Pending` must not be stored inside a `Result`'s value.
- No documentation anywhere for `Pending.promise` being public API, nor for the constructor invariant that the supplied promise must resolve to a `Settled` (violating it breaks every method downstream).

---

## 5. Test coverage gaps

The suite is strong on per-method matrices (534 tests, consistent sync/async/union coverage — genuinely well done). Missing:

1. **`Result.do` + `yield* somePending`** — the flagship async flow from the README is never exercised end-to-end; `Pending`'s async iterator is only unit-tested in isolation (`src/pending.test.ts:749-789`). Add: async `Result.do` delegating a `Pending` that settles Ok, settles Err (short-circuit + cleanup), and rejects.
2. **Throw-escape policy** — the documented "throws are not caught" behavior has no tests: sync `Result.do` body throwing, async body rejecting, `map`/`andThen` callbacks throwing on each receiver class.
3. **`UnwrapError.result`** — the structured payload (the class's whole reason to exist over plain `Error`) is never asserted.
4. **Multiple consumption of one `Pending`** — two `await`s / two `.map` chains off the same instance (the promise is shared; worth locking in).
5. **Type-level regression tests for the traps in §2** — once 2.1/2.2 are fixed, `expectTypeOf` tests should pin `unwrapOr(null)`, fresh-`Err` method calls, etc.

---

## 6. Packaging & tooling

- `publint` passes; `sideEffects: false`, ESM-only exports are all fine. Two notes:
- **No source maps / declaration maps**: `tsconfig.build.json` emits neither, and `files: ["dist"]` excludes `src`, so consumers get no go-to-definition into real source and stack traces point at compiled JS. Add `"declarationMap": true, "sourceMap": true` and ship `src` (it's a tiny package).
- `exports` has no `"./package.json"` subpath — some tooling (bundler plugins, license scanners) reads it; cheap to add.

---

## 7. Suggested priority order

1. **2.1 + 2.2** — widen `unwrapOr`/`unwrapOrElse`/`or`/`orElse` generics (unblocks fresh-`Err` usage and the ubiquitous `unwrapOr(null)`; non-breaking).
2. **2.3 + 2.4** — add `ok()`/`err()` factories with a void overload (non-breaking, biggest ergonomic win).
3. **2.5** — modern `Result.all` (feature-parity regression with real user impact).
4. **3.1** — settle the `or` error-type semantics before more code depends on the current inconsistency (technically breaking, so best done soon).
5. **1.1 + 1.2** — document (and where feasible, type-guard) the Pending-in-T and rejecting-`settle()` hazards.
6. **1.4 + 2.6** — brand-based result detection + `Result.isResult`.
7. Everything in §4 (docs) and §5 (tests) — low-risk, steady wins.
