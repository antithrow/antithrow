# antithrow core API audit — low-severity and informational findings

> Part of the [API audit](../API_AUDIT.md). Polish items and neutral observations worth recording.
> Findings are grouped by audit dimension. Repro scripts referenced in evidence lived in the session scratchpad (ephemeral); all key observed output is quoted inline. The full untruncated register is in [findings.json](./findings.json).

### `ok-runtime/ok-14` — `settle()` JSDoc says "otherwise returns itself" but it returns a fresh Promise of itself on every call, always costing a microtask

**Severity:** low · **Category:** docs · **Verifier verdict:** confirmed

**Claim.** `base.ts` documents `settle()` as "Returns a settled result if this result is `Pending`, otherwise returns itself." `Ok.settle()` returns `Promise.resolve(this)` — a *new* `Promise` object on every invocation, never the receiver — so already-settled results still defer by a microtask and allocate. There is no fast path and no sync `settle`-equivalent, which makes `settle()` unusable in synchronous code even when the result is statically known to be `Ok`. `Ok.settle()` also always returns a native `Promise`, whereas `Pending.settle()` returns the stored `PromiseLike` verbatim (possibly a foreign thenable with no `.catch`) — an inconsistency callers cannot see from the `PromiseLike` return type.

**Recommendation.** Reword the JSDoc to "returns a promise that resolves to the settled result; already-settled results resolve immediately with themselves." Memoise the promise on the instance if the allocation matters. Normalise `Pending.settle()` through `Promise.resolve` so `settle()` always returns a real `Promise` regardless of branch.

---

### `ok-runtime/ok-15` — Subclassing is half-supported: `map`/`andThen` hard-code `new Ok` while `mapErr`/`flatten` return `this`, so subclass identity survives some combinators and not others

**Severity:** low · **Category:** ergonomics · **Verifier verdict:** confirmed

**Claim.** `Ok` is a normal exported class with no `final` marker, so users will extend it. But combinators construct `new Ok(...)` directly rather than `new (this.constructor as ...)(...)`, while the identity-cast paths return `this`. The result is that a subclass instance stays a subclass through `mapErr` and `flatten` but degrades to a plain `Ok` through `map` — an inconsistency that will surface as a confusing bug rather than a clean "not supported".

**Recommendation.** Decide explicitly: either document `Ok`/`Err`/`Pending` as not extensible (and consider a private brand field that makes subclassing useless), or thread the constructor through the combinators so subclass identity is preserved uniformly. The current halfway state is the worst option.

---

### `ok-runtime/ok-16` — No structural equality, no zero-arg `Ok` for `Result<void, E>`, and detached methods throw

**Severity:** low · **Category:** ergonomics · **Verifier verdict:** confirmed

**Claim.** Three small ergonomic gaps confirmed together: (1) `Ok` exposes no `equals`, so two `Ok(1)` are distinct and every comparison must go through `unwrap()`; (2) there is no unit constructor — `Result<void, E>` must be spelled `new Ok<void, E>(undefined)`, since `new Ok()` is an arity error; (3) methods are prototype methods with no binding, so any point-free use (`results.map(unwrap)`, passing `ok.unwrap` as a callback) throws a `TypeError` at runtime.

**Recommendation.** Add an optional-argument overload so `new Ok<void, E>()` is legal when `undefined extends T`, ship an `equals(other, comparator?)` (or a standalone `Result.equals`) since equality is needed constantly in tests, and consider widening `unwrapOr<U>(value: U): T | U` to match Rust's `unwrap_or_else` flexibility.

---

### `ok-runtime/ok-17` — `Ok`'s short-circuit methods correctly never invoke their callbacks, and `map`'s sync-throw path is exactly as documented

**Severity:** info · **Category:** correctness · **Verifier verdict:** confirmed

**Claim.** Verified as correct, since these are the paths most easily got wrong: `mapErr`, `orElse` and `unwrapOrElse` on an `Ok` never call their callbacks (no stray side effects, and a throwing callback is harmless); `unwrapOr`/`unwrapOrElse` fully ignore their arguments; and a synchronous throw from `map`'s callback propagates out of `map` at the call site, matching the `@throws Errors thrown by fn are not caught` JSDoc precisely. A thenable whose `then` throws synchronously also throws out of `map` rather than producing a poisoned `Pending`.

**Recommendation.** No change needed; worth keeping regression tests for the zero-invocation guarantee, which the current `ok.test.ts` does not assert directly.

---

### `ok-runtime/ok-4` — `readonly value` is enforced only by the compiler: instances are not frozen, and `Object.assign` mutates it with zero casts

**Severity:** low · **Category:** correctness · **Verifier verdict:** adjusted

**Claim.** `Ok`'s `value` is a plain writable/enumerable/configurable own property. `Object.freeze` is never applied. The public docs advertise the field as `readonly value: T`, but that guarantee is defeated by `Object.assign(ok, { value: x })` — which type-checks under `--strict` with no `any`, no cast, and no `@ts-expect-error`. `delete ok.value` produces an object that still answers `isOk() === true` while `unwrap()` returns `undefined`. This is amplified by ok-5: `mapErr`, `orElse` and `flatten` return `this`, so a mutation applied to a "derived" result silently rewrites the original.

**Recommendation.** Freeze in the constructor (`Object.freeze(this)`), or define `value` via `Object.defineProperty(this, "value", { value, writable: false, enumerable: true })`. Freezing also makes the `Object.assign` hole a runtime `TypeError` in strict mode. Do the same for `Err.error` and `Pending.promise`, and state the immutability guarantee explicitly in the class JSDoc, since the whole design (covariant `out T`, identity casts, shared instances) relies on it.

---

### `ok-runtime/ok-5` — `mapErr`/`orElse`/`flatten`/`or` return the identical instance — an undocumented aliasing contract that only holds because immutability is not enforced

**Severity:** low · **Category:** correctness · **Verifier verdict:** adjusted

**Claim.** The three `// SAFETY: Casts uninhabited E type to F` sites return `this` rather than a fresh `Ok`, and `or`/`flatten` (non-Result `T`) do the same. The re-typing itself is sound (`E` is phantom on `Ok`), but the sharing is nowhere documented, and combined with ok-4 it is observable: mutating the value of a `mapErr` result mutates the original, and every `Ok` that has flowed through a chain is the same object, so a single write corrupts all of them. `and`/`andThen` likewise return the caller-supplied instance verbatim, so an `Ok` can be aliased into several independent chains.

**Recommendation.** Freeze instances (ok-4) so aliasing is unobservable, and add a one-line note to the `mapErr`/`orElse`/`flatten` JSDoc in `base.ts` that these may return the receiver. If freezing is rejected, return `new Ok(this.value)` from the identity-cast paths instead — the allocation is cheaper than the class of bug it prevents.

---

### `err-runtime/err-11` — Err.mapOr lacks the NoInfer<U> that Ok.mapOr has, so U is inferred from the default value and diagnostics blame the wrong argument

**Severity:** low · **Category:** type-safety · **Verifier verdict:** confirmed

**Claim.** `Ok.mapOr` declares `defaultValue: NoInfer<U>`; `Err.mapOr` declares plain `defaultValue: U`. On `Err`, `U` is therefore inferred from the default value first, the return type collapses to that value's literal type, and a mismatch between the default and the mapper's return is reported against the *mapper's return type* rather than against the default — the opposite of `Ok`, where the same mistake is reported against the default value.

**Recommendation.** Change `Err.mapOr` to `mapOr<U>(defaultValue: NoInfer<U>, fn: (value: T) => SyncOrAsync<U>): U` to match `Ok`, so inference flows from the mapper in both arms and the error is reported at the offending argument. `Pending.mapOr` should get the same treatment.

---

### `err-runtime/err-12` — Err instances do not survive serialization boundaries and carry no branding: structuredClone strips the prototype, no toJSON, no Symbol.toStringTag, error is mutable

**Severity:** low · **Category:** packaging · **Verifier verdict:** confirmed

**Claim.** `Err` is a plain class with one enumerable field and no serialization contract. `structuredClone` (worker/`postMessage`/Node IPC boundary) returns a bare `{ error }` object that is no longer an `Err`; `JSON.stringify` produces `{"error":…}` with no discriminant and there is no static parse/revive; `Object.prototype.toString` reports `[object Object]` for both `Ok` and `Err`; instances are not frozen and `readonly error` is a type-only guarantee, so the payload of an `Err` shared as a singleton can be reassigned at runtime and every chain derived from it sees the change (because `map`/`andThen`/`and`/`flatten` return `this`).

**Recommendation.** Add `get [Symbol.toStringTag]() { return "Err" }` (and `"Ok"`, `"Pending"`) so instances are distinguishable in logs and `Object.prototype.toString`; add a `toJSON()` emitting a tagged shape (`{ _tag: "Err", error }`) plus a `Result.fromJSON`/`Result.revive` counterpart so results can cross process boundaries; and freeze in the constructor (or use `#error` with a getter) so `readonly` is enforced at runtime given how aggressively instances are shared by the identity-returning combinators.

---

### `err-runtime/err-13` — No exported runtime type guard; Err detection relies on instanceof, which breaks across duplicated copies of the package

**Severity:** low · **Category:** packaging · **Verifier verdict:** confirmed

**Claim.** `Result` exposes only `try`, `fromPromise`, `do` — there is no `Result.isResult` / `isErr` free function. Discriminating an unknown value therefore requires `instanceof Err | Ok | Pending` against the exact class identities of one module instance. Two copies of `antithrow` in a dependency tree (or a CJS/ESM dual-package hazard) make those checks silently false, and `Ok.flatten()` itself uses `instanceof` internally, so a foreign `Err` nested in an `Ok` is silently not flattened rather than erroring.

**Recommendation.** Brand instances with a `Symbol.for("antithrow.result")` field carrying the variant tag, switch `Ok.flatten`'s internal check to that brand, and export `Result.isResult` / `Result.isErr` / `Result.isOk` / `Result.isPending` guards built on it. Cross-realm-safe branding costs nothing and removes an entire class of "works locally, fails in the monorepo" bugs — especially relevant for a package that ships companion packages (`@antithrow/std`, `/node`, `/standard-schema`) that all construct `Err` val […truncated, full text in findings.json]

---

### `err-runtime/err-14` — isOk() on a concrete Err type-checks and exposes .value in a permanently dead branch

**Severity:** low · **Category:** type-safety · **Verifier verdict:** confirmed

**Claim.** `isOk(): this is Ok<T, E>` is declared on the base class and inherited unchanged by `Err`, so on a value statically known to be an `Err<number, string>` the compiler happily narrows into an `Err & Ok` intersection and lets you read `.value: number`. The predicate always returns `false` at runtime, so the branch is unreachable rather than unsound — but the compiler gives no signal that the code is dead, and reading `.value` there would yield `undefined`.

**Recommendation.** Override the predicates on the concrete classes with literal return types — `Err.isOk(): this is never`, `Err.isPending(): this is never`, `Err.isErr(): true` (and mirrors on `Ok`/`Pending`) — so narrowing a concrete `Err` into the `Ok` branch collapses to `never` and dead code is visible at the call site instead of type-checking as `number`.

---

### `err-runtime/err-15` — new Err() with no argument is a compile error but a working runtime object with error === undefined

**Severity:** info · **Category:** correctness · **Verifier verdict:** confirmed

**Claim.** The documented default `E = unknown` is unreachable through the constructor: `new Err()` is rejected by tsc (`Expected 1 arguments, but got 0`) because `error: E` is a required parameter, yet at runtime the call succeeds and produces a fully functional `Err` whose `error` is `undefined` and whose own-property `error` exists. JS consumers and any `as any`/`@ts-ignore` path can therefore mint an `Err` with no payload, which `unwrapErr()` returns as `undefined` and `JSON.stringify` renders as `{}`.

**Recommendation.** Either make the parameter genuinely optional for the `E = unknown` default (`constructor(error?: E)` plus a documented "payload-less error" story), or drop the `E = unknown` default from the class declaration since it can never be reached by construction and only shows up in hand-written `Err<never>` annotations. A runtime guard rejecting `arguments.length === 0` would also close the JS-consumer hole.

---

### `pending-runtime/pend-10` — Because Pending is thenable, a Result cannot survive a Promise boundary — async functions returning Result silently downgrade to Settled

**Severity:** info · **Category:** design · **Verifier verdict:** confirmed

**Claim.** `Pending` is assimilated by the promise resolution procedure, so `async function f(): Promise<Result<T, E>>` compiles but its awaited value can never be a `Pending` — TypeScript correctly computes `Awaited<Pending<T,E>> = Settled<T,E>`, which means `isPending()` on the awaited value is statically reachable but dynamically dead. It also means a `Pending` cannot be transported through any promise-shaped API (`Promise.all` element position, an async return, a promise-returning cache) without collapsing. TypeScript is honest throughout — this is a consequence of the design, not a lie — but it is a real constraint on how `Result` can appear in signatures, and it is not stated anywhere in the docs.

**Recommendation.** Document the rule explicitly: 'Never write `Promise<Result<T, E>>` — return `Result<T, E>` (a `Pending`) directly. Wrapping a Result in a promise collapses it to `Settled` and makes `isPending()` dead code.' This belongs in explanation/three-state-model.md and is a natural candidate for an eslint-plugin rule (`no-promise-of-result`) alongside the existing `no-unused-result`.

---

### `pending-runtime/pend-11` — Each Pending combinator costs a microtask hop, and callbacks fire whether or not anything is listening

**Severity:** info · **Category:** performance · **Verifier verdict:** confirmed

**Claim.** Every combinator on `Pending` allocates a new `.then` and a new `Pending`, so a chain's latency scales with its length in microtask ticks; three chained synchronous `.map` calls cost 5 ticks. Separately, subscription is eager: `.map` attaches immediately and the callback runs when the inner promise settles regardless of whether the returned `Pending` is ever awaited — and eager argument evaluation means `or(makeFallback())` builds the fallback even for an Ok source. The eagerness is deliberate and documented (explanation/eager-vs-lazy.md, consequence 3: 'the transformation runs when the promise resolves, regardless of whether anything is listening'), and it is confirmed here; recorded for completeness because it is what makes finding pend-1 fire without any explicit await.

**Recommendation.** No change required. If chain depth ever shows up in profiles, the combinators could be fused by carrying a pending operation list and applying it in a single `.then` at settle time. Optionally note in the docs that N chained operations on a `Pending` cost ~N microtask turns, and that `or(...)`/`and(...)` take eagerly-evaluated arguments (prefer `orElse`/`andThen` when constructing the alternative is expensive).

---

### `pending-runtime/pend-7` — `promise` is a public field that is only readonly at the type level; it can be swapped at runtime and settle() hands out the identical internal object

**Severity:** low · **Category:** api-surface · **Verifier verdict:** confirmed

**Claim.** `constructor(readonly promise: PromiseLike<Settled<T, E>>)` compiles to an ordinary writable, enumerable, configurable own property. `readonly` stops TypeScript assignment but nothing at runtime, so any JS consumer (or `as any`) can replace a live Pending's inner promise and every subsequent operation follows the substitute. `settle()` additionally returns that exact object rather than a copy, so external code can graft handlers directly onto library internals. Both are documented as public API (pending.md:43,51,59).

**Recommendation.** Make it a genuine private field (`#promise`) and expose it, if at all, through a getter — that also fixes `JSON.stringify(pending)` producing `{"promise":{}}` (observed in 10-misc.ts) and stops the internal promise from being an enumerable own property. If `.promise` must stay public for interop, at least return a defensive `Promise.resolve(this.#promise)` from `settle()` so callers cannot attach to, or replace, the object the instance depends on.

---

### `pending-runtime/pend-8` — A Pending whose inner promise resolves to a non-Result fails with an opaque TypeError from library internals rather than a diagnosable error

**Severity:** low · **Category:** robustness · **Verifier verdict:** confirmed

**Claim.** `Pending`'s combinators assume the resolved value has `map`/`unwrapOr`/etc. Reached from plain JavaScript, from an `as`/`any` boundary, or from a mis-typed adapter, a `Pending` over `Promise.resolve(42)` awaits fine (returning the raw `42` where the caller's types promise a `Settled`) and only fails later with `settled.map is not a function`, with no indication that the contract violated was 'the inner promise must resolve to Ok or Err'. The constructor is public and documented, so this is a reachable failure mode for JS consumers of a TS-only invariant.

**Recommendation.** Validate once at the point of use: in `then`/the shared combinator helper, if the resolved value is not an `Ok` or `Err` instance, reject with a named library error (e.g. `InvalidResultError: Pending's promise resolved to a non-Result value`) that includes the offending value. Cheap, one `instanceof` per settle, and it converts a mystery TypeError into an actionable message for the JS-consumer and adapter-author audience.

---

### `pending-runtime/pend-9` — isPending() stays true forever, so a Pending that has already settled offers no synchronous read path

**Severity:** info · **Category:** design · **Verifier verdict:** confirmed

**Claim.** `isPending()` is a hardcoded `return true`. After the inner promise has resolved, the instance still reports `isPending() === true` / `isOk() === false`, and there is no synchronous accessor for the now-known value. Every read must go back through the microtask queue. This is a defensible design (it keeps the three-state model statically honest and avoids a sync/async bifurcation in the API), but it means holding a `Pending` past its settlement is strictly lossier than holding the `Settled` it produced, and it is worth stating in the docs alongside the eager-evaluation discussion.

**Recommendation.** No behavioural change needed. Add a sentence to pending.md and/or explanation/eager-vs-lazy.md: 'A `Pending` never transitions in place — `isPending()` is always `true`. Once you have awaited it, keep the `Settled` it returned rather than the `Pending`.' If a synchronous peek is ever wanted, an opt-in `tryPeek(): Settled<T, E> | undefined` backed by a cached settlement would be a small, non-breaking addition.

---

### `constructors/ok-11` — Result.fromPromise silently double-wraps a Pending, turning a failed Result into an Ok

**Severity:** low · **Category:** correctness · **Verifier verdict:** adjusted

**Claim.** `Pending<T,E>` implements `PromiseLike<Settled<T,E>>`, so it is a legal argument to `fromPromise`, which happily wraps it: `Result.fromPromise(pending)` is `Pending<Settled<T,E>, unknown>`. The typing is technically honest, but the failure mode is nasty: an inner `Err` becomes an outer `Ok` holding an `Err`, so `settled.isErr()` is `false` for an operation that failed. This is an easy mistake in generic plumbing (`fromPromise(maybeAlreadyAResult)`) and neither factory flattens or guards against it.

**Recommendation.** Either (a) make `fromPromise` detect and pass through an argument that is already a `Result` (`if (promise instanceof Pending) return promise;` plus resolved-value flattening), or (b) reject it at the type level by constraining the parameter to `PromiseLike<T>` where `T` is not a `Result`. Option (a) matches the auto-flattening users expect from `Promise`. At minimum document the double-wrap and point at `.flatten()`.

---

### `constructors/ok-12` — Result.try and Result.fromPromise carry no JSDoc at all, while Result.do is fully documented

**Severity:** low · **Category:** docs · **Verifier verdict:** confirmed

**Claim.** In result.ts, `resultDo` has a 25-line JSDoc block with `@example`, and the `Result` type alias has one too. `fromPromise` (line 23) and `resultTry` (lines 32-35) have none. This survives into the shipped declarations, so editor hover on the two most-used members of the public API shows only a bare signature — no mention that `E` is an unchecked assertion, that thrown errors are captured, or that a promise-returning callback upgrades to `Pending`. CLAUDE.md's own code style rule says "Use JSDoc with `@example` blocks for public API".

**Recommendation.** Add JSDoc to both, on the first overload of `resultTry` so hover picks it up, including an `@example` and an explicit warning that `E` is asserted rather than validated. Also add the missing third overload row (`fn: () => T | PromiseLike<T>` → `Result<T, E>`) to the table in apps/docs/docs/reference/antithrow/result.md, which currently lists only two of the three.

---

### `constructors/ok-13` — Generic forwarding of Result.try collapses to the widest overload, forcing callers to handle Pending for provably-sync work

**Severity:** info · **Category:** ergonomics · **Verifier verdict:** confirmed

**Claim.** A library author writing a thin wrapper — `function wrap<T>(fn: () => T) { return Result.try(fn); }` — gets `Result<T, unknown>` because a bare type parameter satisfies neither `NonThenable<T>` nor `PromiseLike<T>` decisively, so overload 3 wins. Instantiating with a concrete non-promise type does not recover the `Settled` shape: `wrap<number>(() => 1)` is still `Result<number, unknown>`, so downstream code must handle a `Pending` branch that can never occur. Overload-based dispatch is not composable; users must duplicate the overload set to forward it.

**Recommendation.** Replace the three overloads with a single signature whose return type is a conditional on the inferred callback return (see ok-9). A conditional return type distributes through generic forwarding, so `wrap<number>` would keep the `Settled` shape, and it also fixes the union-of-promises rejection and the `(fn: () => never)` error text in one move.

---

### `do-notation/od-11` — `Err`'s iterator leaks an internal sentinel error ("Unreachable: generator should have been halted") to any ordinary iteration of an `Err`

**Severity:** low · **Category:** correctness · **Verifier verdict:** confirmed

**Claim.** `Err[Symbol.iterator]` yields `this` and then unconditionally `throw new Error("Unreachable: generator should have been halted")` (err.ts:121-124). That statement is only unreachable under `resultDo`'s discipline. Because `Err` is a public class implementing the public `Symbol.iterator` protocol, `for (const x of err)`, `Array.from(err)`, and `[...err]` all reach it and throw an opaque internal invariant message with no reference to the user's code. It is also reached whenever a `Result.do` short-circuit is followed by any further advancement of the generator (see od-4's `X next() after return()`).

**Recommendation.** Replace the throw with a plain `return` (or make it an infinite `while (true) yield this;`) so the protocol degrades gracefully, or keep the guard but make the message actionable: "`Err` is only iterable via `yield*` inside `Result.do`; do not iterate it directly." Either way it should not surface an internal-invariant string to end users.

---

### `do-notation/od-12` — `iter.return?.(undefined as T)` — an unsound cast whose only saving grace is that its result is discarded

**Severity:** info · **Category:** type-safety · **Verifier verdict:** confirmed

**Claim.** `resultDo` passes `undefined as T` as the return-completion value on both paths (result.ts:96, 108). The cast is a lie for every non-`undefined` `T`, and the value is forwarded by the JS generator machinery to any nested `yield*` delegate's `.return()`. Today it is benign because (a) `resultDo` discards the `IteratorResult` it gets back, and (b) neither `Ok`'s nor `Err`'s iterator has a `finally` that observes the argument. But the cast documents no invariant, and any future `Result` iterator that observes its return-completion value would silently receive `undefined` typed as `T`.

**Recommendation.** Type the local iterator as `Generator<…, T, void> & { return?: (value?: unknown) => IteratorResult<…> }` and call `iter.return?.()` with no argument — the ECMAScript default completion value is `undefined` anyway, so the cast buys nothing. Add a `// SAFETY:` comment matching the convention used elsewhere in the codebase (ok.ts:56, err.ts:36, pending.ts:52) explaining why the completion value is irrelevant.

---

### `do-notation/od-13` — `yield` without `*` on an `Err` compiles and behaves identically to `yield*`, giving two spellings for one operation

**Severity:** info · **Category:** consistency · **Verifier verdict:** confirmed

**Claim.** Because the overload's yield type is `YieldErr extends Err<unknown, unknown>`, a bare `yield someErr` type-checks and short-circuits exactly like `yield* someErr` (the generator's first yielded value is the `Err` either way, and `resultDo` reads `next.value` without caring how it got there). `yield someOk` and `yield 42` are correctly rejected. The result is a second, undocumented spelling of the failure statement whose expression type is `void` instead of `never` — so it silently opts out of even the weak signal that `yield*`'s `never` type provides, and it reads as a typo to reviewers.

**Recommendation.** Not worth a runtime change, but the ESLint plugin should flag `yield <Err>` inside a `Result.do` body and autofix it to `return yield* <Err>` — that unifies it with od-8's recommended idiom.

---

### `types-overloads/ok-10` — Pending<T,E> has no default type parameters while Ok<T,E=never> and Err<T=never,E=unknown> do

**Severity:** low · **Category:** consistency · **Verifier verdict:** confirmed

**Claim.** `Ok<out T, out E = never>` and `Err<out T = never, out E = unknown>` supply defaults, but `Pending<out T, out E>` supplies none. `Ok<number>` and `Err` are legal type annotations; `Pending<number>` is a compile error. Since all three are exported as public types and appear together in every `Result` signature, the third member behaving differently is a papercut with no stated reason.

**Recommendation.** Either give `Pending` matching defaults (`Pending<out T, out E = unknown>` to mirror `Err`, or `= never` to mirror `Ok`) or remove the defaults from `Ok`/`Err` so all three are uniform. Whichever way, document the choice — the defaults currently differ between `Ok` (`E = never`) and `Err` (`E = unknown`) too, which is defensible but undocumented.

---

### `types-overloads/ok-12` — SameResolved can be bypassed by mapOrElse's third overload when the two branch types unify by widening

**Severity:** info · **Category:** correctness · **Verifier verdict:** confirmed

**Claim.** `mapOrElse`'s first overload enforces `SameResolved<UDefault, UMap>` (mutual `Awaited` assignability) and correctly rejects genuinely mismatched branches. But when the two branch types are not identical yet unify under normal inference — e.g. `defaultFn: () => number` and `fn: () => 1` — overload 1 fails and overload 3 (`(defaultFn: (error: E) => SyncOrAsync<U>, fn: (value: T) => SyncOrAsync<U>): SyncOrAsync<U>`) accepts with `U = number`. The result is `SyncOrAsync<number>` rather than the precise `number`. This is benign (it is ordinary widening, not a lie) but it means `SameResolved` is a precision hint, not a hard gate; the JSDoc's "Both functions should return the same resolved type `U`" reads as stricter than reality.

**Recommendation.** No behavioural change needed, but note in the `mapOrElse` JSDoc that widening-compatible branches fall through to the generic overload and lose the precise sync/async return type. If precision matters, the fix is to make overload 3 also carry `SameResolved` (so widening is deliberate rather than accidental) — but that would break the useful `number`/`1` case, so documenting is probably the right call.

---

### `types-overloads/ok-13` — Calling through the abstract ResultBase type silently degrades every result to the imprecise base signature

**Severity:** info · **Category:** consistency · **Verifier verdict:** confirmed

**Claim.** `ResultBase` is exported from base.ts (though not re-exported from index.ts), and every concrete class is assignable to it. Calls made through a `ResultBase<T,E>`-typed variable use the abstract signatures, which are strictly less precise than the concrete ones: `base.map(x => x*2)` and `base.map(async x => x*2)` BOTH give `Result<number,string>` (so the async form still admits an `Ok` member that can never occur at runtime); `base.andThen(mkOk)` gives `Result<string, string | boolean>` where `ok.andThen(mkOk)` gives `Ok<string, boolean>`. This is not unsound, but it means any user code that types a parameter as `ResultBase` — or that subclasses it — loses all the overload work, with no diagnostic.

**Recommendation.** Either make `ResultBase` genuinely private (rename to `#ResultBase`-style internal, or stop exporting the symbol from base.ts and drop it from the emitted `.d.ts` surface via a `@internal` tag), or bring the abstract signatures up to the concrete ones (`abstract andThen<R extends Result<unknown, unknown>>(fn: (value: T) => R): Result<InferOk<R>, E | InferErr<R>>`). Note the abstract `or`/`orElse` split reproduces the ok-3 asymmetry at the contract level, so fixing ok-3 should update base.ts too.

---

### `types-overloads/ok-8` — The map/mapErr conditional is distributive, splitting boolean and union results into a union of Ok/Err instead of one Ok/Err

**Severity:** low · **Category:** ergonomics · **Verifier verdict:** confirmed

**Claim.** `U extends PromiseLike<infer A> ? Pending<A,E> : Ok<U,E>` has `U` in naked position, so it distributes. `ok.map(x => x > 0)` infers `Ok<false, string> | Ok<true, string>` instead of `Ok<boolean, string>`; `ok.map((x): string | number => ...)` infers `Ok<number, string> | Ok<string, string>`; `err.mapErr(e => e.length > 0)` infers `Err<number, false> | Err<number, true>`. On the union receiver this compounds: `res.map(x => x > 0)` is a 4-member union. The types remain assignable to the collapsed form (Ok/Err are `out T`), so this is noise rather than unsoundness — but it is noise in hover tooltips, error messages, and any generated `.d.ts`.

**Recommendation.** The `Exclude`/`Extract` formulation from ok-2 fixes this for free — fixproto.ts asserts `Expect<Equal<typeof d, Ok<boolean, string>>>` for `mapNew(ok, x => x > 0)` and type-checks clean. Alternatively wrap the conditional in a tuple to make it non-distributive (`[U] extends [PromiseLike<unknown>] ? Pending<Awaited<U>, E> : Ok<U, E>`), though that loses the correct split for genuinely mixed `T | Promise<T>` callbacks.

---

### `types-overloads/ok-9` — A never-returning or any-returning map callback selects the PromiseLike overload, typing the result Pending<unknown, E>

**Severity:** low · **Category:** correctness · **Verifier verdict:** confirmed

**Claim.** `Ok.map`'s first overload `map<U>(fn: (value: T) => PromiseLike<U>): Pending<U, E>` matches whenever the callback's return type is assignable to `PromiseLike<unknown>` after `U` falls back to `unknown`. For a callback that only throws (`(): never => { throw ... }`) the result is typed `Pending<unknown, string>` — vacuously safe, since the expression never yields a value, but misleading in hovers and in `--noImplicitReturns` reasoning. For an `any`-returning callback (very common at untyped boundaries: `JSON.parse`, untyped SDKs) the result is `Pending<unknown, string> | Ok<any, string>`, forcing narrowing where a plain `Ok<any, string>` was expected.

**Recommendation.** Constrain the first overload so it cannot absorb `never`/`any` — e.g. `map<U>(fn: (value: T) => PromiseLike<U> & { then: unknown }): Pending<U, E>` is fragile; cleaner is to drop the separate PromiseLike overload entirely in favour of the single computed return type from ok-2, where `Exclude<never, ...>`/`Extract<never, ...>` collapse to `never` and `any` produces the honest full union. Low priority, but it is a symptom of the overload ladder doing work a computed type would do more predictably.

---

### `types-guards-variance/gv-10` — Guards discard the generic parameter: inside `<R extends Result<...>>`, `r.isOk()` narrows to `Ok<unknown, unknown>` rather than `R & Ok<...>`

**Severity:** low · **Category:** type-safety · **Verifier verdict:** confirmed

**Claim.** For library-author code written generically over the result type — `function f<R extends Result<unknown, unknown>>(r: R)` — the `this is Ok<T, E>` predicate narrows `r` all the way to the constraint's instantiation (`Ok<unknown, unknown>`), throwing away `R`. Any extra structure carried by `R` (a branded/tagged subtype, a narrower `T`) is unrecoverable inside the branch, so such helpers cannot return `InferOk<R>` from `r.value` without a cast.

**Recommendation.** Document this, and prefer signatures written over `Result<T, E>` with inferred `T`/`E` rather than over a single `R extends Result<...>` in the library's own helpers and in examples. If generic-over-`R` helpers matter, standalone guards (gv-6) declared as `function isOk<R extends Result<unknown, unknown>>(r: R): r is R & Ok<InferOk<R>, InferErr<R>>` preserve `R`.

---

### `types-guards-variance/gv-11` — Internal underscore-prefixed parameter names leak into the published declaration file and therefore into consumer IntelliSense

**Severity:** low · **Category:** docs · **Verifier verdict:** confirmed

**Claim.** The unused-parameter convention (`_value`, `_fn`) is applied to implementation signatures that are *also* the emitted declaration signatures, so consumers hovering `unwrapOr` on an `Ok` see `unwrapOr(_value: T): T` and hovering `mapErr` see `mapErr<F>(_fn: (error: E) => SyncOrAsync<F>): Ok<T, F>`. The base class documents them as `value` and `fn`, so the same method shows two different parameter names depending on whether the receiver is narrowed.

**Recommendation.** Add a public overload signature with the clean parameter name above each such implementation (as `Err#mapOr` already does), or void the parameter in the body instead of renaming it, so the emitted `.d.ts` names match the documented ones.

---

### `types-guards-variance/gv-8` — `Pending<out T, out E>` has no default type parameters while `Ok` and `Err` both do

**Severity:** low · **Category:** consistency · **Verifier verdict:** confirmed

**Claim.** `Ok<out T, out E = never>` and `Err<out T = never, out E = unknown>` accept one type argument; `Pending<out T, out E>` requires two. There is no reason `Pending<number>` should be an error when `Ok<number>` and `Err<number>` are not, and the inconsistency is invisible until you hit it.

**Recommendation.** Give `Pending` the same defaults as whichever convention you settle on for `Ok`/`Err` (see gv-3). If `Ok<T, E = never>` is the model, `Pending<out T, out E = never>` is the matching declaration.

---

### `types-guards-variance/gv-9` — `InferOk`/`InferErr` are unconstrained and fail open to `never`, and they surface the phantom type parameters on heterogeneous unions

**Severity:** low · **Category:** ergonomics · **Verifier verdict:** confirmed

**Claim.** `InferOk<R> = R extends Result<infer T, unknown> ? T : never` places no constraint on `R`, so a typo or a wrong input (`InferOk<string>`, `InferErr<Promise<number>>`, `InferOk<Result<number,string>[]>`) silently yields `never` instead of erroring — and `never` then propagates quietly through the caller's types. `InferOk<any>` yields `unknown`, not `any`. Separately, because `Err<T, E>`'s `T` and `Ok<T, E>`'s `E` are phantom, distributing over a heterogeneous union surfaces them: `InferOk<Ok<1,2> | Err<3,4>>` is `1 | 3` and `InferErr<Ok<1,2> | Err<3,4>>` is `2 | 4`. That is defensible for a well-formed `Result<T,E>`, but it means `Result<InferOk<R>, InferErr<R>>` does not round-trip such a union.

**Recommendation.** Constrain the parameter — `type InferOk<R extends Result<unknown, unknown>> = ...` — so misuse is a compile error rather than a silent `never`. This is source-compatible for every correct use and catches the fail-open cases immediately.

---

### `flatten/ok-3` — FlattenErr (and Ok(Pending).flatten()) merge an inner error type that is provably unreachable at runtime, forcing dead error handling

**Severity:** low · **Category:** type-safety · **Verifier verdict:** adjusted

**Claim.** `Err.flatten()` (err.ts:93-96) returns `this` unmodified — it never touches the phantom `T`, so the error value is always the outer `E`. Yet `FlattenErr<T, E>` (types.ts:89) declares `Err<U, E | F>`, folding the inner error type `F` into the union. Consumers must therefore write a branch for an error that can never be produced. The same over-widening happens on `Ok(Pending).flatten()`: it returns the *identical inner Pending object*, whose promise can only ever settle to `Settled<U, F>`, yet the declared type is `Pending<U, E | F>`. The library's own `andThen` is more honest on the same input, which makes this an internal inconsistency rather than a deliberate convention.

**Recommendation.** Make `FlattenErr<T, E> = T extends Result<infer U, unknown> ? Err<U, E> : Err<T, E>` — keep the payload retype (that part is a legitimate phantom cast) but drop the `| F`, since `F` is unreachable. Likewise `FlattenOk`'s `Pending` arm can stay `Pending<U, E | F>` only if `Ok`'s `E` is genuinely inhabited; since `flatten` on an `Ok` returns the inner object verbatim, `Pending<U, F>` is the honest type. Nothing is lost for the `Result<T,E>`-union call site, because the union of the three per-varia […truncated, full text in findings.json]

---

### `flatten/ok-7` — Pending.flatten() allocates a new Pending and an extra microtask even when nothing is nested, unlike Ok/Err which return `this`

**Severity:** low · **Category:** consistency · **Verifier verdict:** confirmed

**Claim.** `Ok.flatten()` and `Err.flatten()` return `this` when there is nothing to unwrap (identity, zero cost). `Pending.flatten()` (pending.ts:106-108) unconditionally builds `new Pending(this.promise.then(...))`, so it always allocates a new Pending and inserts an extra `.then` tick, even for `Pending<number, E>` where flatten is semantically a no-op. Chained/defensive `.flatten()` calls therefore cost a microtask each on the async path only.

**Recommendation.** Cheap fix: keep the current shape but skip the wrapper when the settled result's flatten returns the same object — or, with the `this`-constrained signature from ok-6, the no-op case cannot be written at all. At minimum note in the JSDoc that `Pending.flatten()` always allocates, since `Ok`/`Err` do not.

---

### `flatten/ok-8` — flatten is the only method that dispatches on `instanceof`, so it silently no-ops across duplicate package instances

**Severity:** low · **Category:** packaging · **Verifier verdict:** confirmed

**Claim.** `ok.ts:103` is the sole `instanceof` dispatch on user data in the whole core package (`errors.ts:15` is only a JSDoc example). When two copies of `antithrow` are loaded — a transitive dep on a different version, or an ESM/CJS split — an `Ok` wrapping a foreign-instance `Err` fails all three `instanceof` checks and `flatten()` returns the outer `Ok`, while the declared type says the inner `Err`. TypeScript does block the *cast-free* form of this (the `this is` predicates make the two declarations nominally incompatible, which is a real defence), so this only bites across an `any`/`unknown`/`as` boundary — which is exactly the boundary in ok-2.

**Recommendation.** Replace the three `instanceof` tests with a brand check that survives duplicate realms — e.g. a `static readonly [Symbol.for("antithrow.result")]` tag on `ResultBase` plus an exported `isResult(v): v is Result<unknown, unknown>` predicate — or eliminate the runtime check entirely by adopting the `this`-constrained signature (ok-6), which makes `return this.value` unconditionally correct. Exporting `isResult` is also a genuinely useful missing public API for users bridging untyped boundaries.

---

### `flatten/ok-9` — Pending.flatten() collapses an arbitrarily deep Pending chain in a single call via thenable assimilation — correct, but undocumented and asymmetric with Ok.flatten()

**Severity:** info · **Category:** docs · **Verifier verdict:** confirmed

**Claim.** `Pending.flatten()` is `new Pending(this.promise.then(s => s.flatten()))`. When the settled `Ok` holds a `Pending`, `Ok.flatten()` returns that Pending, and because `Pending` is a thenable the enclosing `.then` assimilates it — recursively, until a non-thenable `Settled` is reached. So one `Pending.flatten()` can collapse many levels, whereas one `Ok.flatten()` collapses exactly one (it returns the inner Pending object without awaiting). Remarkably, `FlattenPending` tracks this correctly in every case I could construct, because a Pending-of-Ok-of-Pending is type-level indistinguishable from a Pending whose payload is a Pending. This is a genuine subtlety of the design that is nowhere documented, and it is the kind of thing that would silently break if `Pending` ever stopped being thenable.

**Recommendation.** Document on `Pending.flatten()` that (a) it awaits and therefore collapses consecutive `Pending` levels, unlike `Ok.flatten()` which unwraps exactly one level synchronously, and (b) a rejected inner `Pending` rejects the returned `Pending` rather than producing an `Err`. Add tests pinning both, so a future refactor that stops relying on thenable assimilation is caught.

---

### `api-completeness/ok-12` — Missing predicate and utility combinators: `isOkAnd`/`isErrAnd`, `.ok()`/`.err()` Option bridge, `swap`, `zip`/`zipWith`, `andThrough`/`orTee`

**Severity:** low · **Category:** missing-capability · **Verifier verdict:** adjusted

**Claim.** A cluster of small combinators with clear prior-art precedent are all absent, each forcing a narrowing dance at the call site: `isOkAnd`/`isErrAnd` (Rust `is_ok_and`/`is_err_and`, neverthrow), `.ok()`/`.err()` returning `T | undefined` / `E | undefined` (Rust's Option bridge, ts-results-es `.toOption()`), `swap` (Effect `Either.flip`), `zip`/`zipWith` (ts-results-es, Effect `Either.zipWith`), and `andThrough`/`andTee`/`orTee` (neverthrow). None can be expressed as a one-liner on the full `Result` union, because `Pending` must be settled first — so `const v: number | undefined = r.isOk() ? r.value : undefined` only works after `await`.

**Recommendation.** Add to `ResultBase`, in rough order of practical value: `isOkAnd(fn)`/`isErrAnd(fn)`; `ok()`/`err()` returning `SyncOrAsync<T | undefined>` / `SyncOrAsync<E | undefined>` (name them `toUndefined`/`errToUndefined` if `.ok()` reads too close to `isOk()` — `Result::ok` is Rust's name but Rust has `Option` to return into, and JS does not); `swap()`; and `zip`/`zipWith` as the 2-ary special case of the missing `Result.all`. `andThrough` (run a fallible side effect, keep the original value) is the hig […truncated, full text in findings.json]

---

### `api-completeness/ok-16` — `comparison.md` describes the neverthrow delta as "slightly different method surface", understating a large net removal

**Severity:** low · **Category:** docs · **Verifier verdict:** confirmed

**Claim.** `apps/docs/docs/explanation/comparison.md` tells prospective users "`andThen`, `map`, `mapErr`, `orElse`, `unwrapOr` exist in both. antithrow adds `settle`, `flatten`, and generator support (`Result.do`)" and concludes "The port is usually mechanical." It lists only additions. It does not mention that neverthrow's `match`, `combine`, `combineWithAllErrors`, `andThrough`, `andTee`, `orTee`, `safeUnwrap`, and `fromThrowable` have no antithrow equivalent — nor that `andThen` in antithrow rejects the async callbacks neverthrow accepts (ok-7). A neverthrow user porting a real codebase will hit all of these.

**Recommendation.** Replace the prose with an honest two-column table listing neverthrow methods with no antithrow equivalent, and add a short "what v3 removed from v2" note (`match`, `inspect`, `inspectErr`, `Result.all`, `ok`/`err`) with the recommended replacement for each. A comparison page that only lists additions reads as marketing and will cost trust the first time a porter hits `combine`.

---

### `api-completeness/ok-17` — `unwrapOr` has no widening overload, so a differently-typed fallback is rejected

**Severity:** low · **Category:** ergonomics · **Verifier verdict:** confirmed

**Claim.** `unwrapOr(value: T): SyncOrAsync<T>` requires the default to be exactly `T`. ts-results-es types this as `unwrapOr<T2>(val: T2): T | T2`, which lets `Result<number, E>.unwrapOr(null)` yield `number | null` — a common shape when the fallback is a sentinel rather than a real value. Rust's `unwrap_or` is `T`-only, so antithrow matches Rust here, but in TypeScript the widening form costs nothing and removes a cast.

**Recommendation.** Widen to `unwrapOr<U>(value: U): SyncOrAsync<T | U>` on all three shapes, following ts-results-es. `Ok.unwrapOr` already ignores its argument entirely, so the runtime is unaffected; only the signature changes. Leave `mapOr`'s `NoInfer` as is — that one is genuinely protecting an invariant.

---

### `api-completeness/ok-18` — Naming: `Pending` reads as a state flag rather than an async Result; `settle` has no prior-art precedent

**Severity:** info · **Category:** naming · **Verifier verdict:** confirmed

**Claim.** Neutral observation for the record. `Pending` is a reasonable name for the third state of the union but diverges from every neighbour's name for the same concept — neverthrow `ResultAsync`, fp-ts `TaskEither`, Effect `Effect`. Because `Pending` is a *value* type here rather than a status enum member, the name collides conceptually with the very common `type Status = "pending" | "success" | "error"` in UI code, where `Pending` means "no answer yet and never will be, until you re-render" rather than "a promise you can await". Similarly `settle()` borrows from `Promise.allSettled` rather than from any Result library; its meaning ("collapse `Result` to `Settled`") is coherent and internally consistent — `Settled` is the exported type name — but it is a term a reader must learn.

**Recommendation.** No change recommended — the names are internally consistent and the `Pending`/`Settled` pairing is genuinely well-chosen. If a v4 ever revisits this, the migration cost from neverthrow would be lower with `ResultAsync`, but that trade is not obviously worth breaking the `Pending`/`Settled` symmetry. Worth one sentence in `comparison.md` mapping `Pending` ↔ `ResultAsync` ↔ `TaskEither` for porters.

---

### `docs-accuracy/ok-11` — "`andThen(identity)` is equivalent to `.flatten()`" is false at both type and runtime level

**Severity:** low · **Category:** docs · **Verifier verdict:** adjusted

**Claim.** apps/docs/docs/how-to/core/combine-results.md L43 states "`andThen(identity)` is equivalent to `.flatten()`". Two independent counterexamples: (a) at type level, `andThen(identity)` drops the *outer* error type on the Ok branch — for `Result<Result<number,E2>,E1>` flatten gives `Result<number, E1|E2>` but `andThen(identity)` gives `Result<number,E2> | Pending<number,E1|E2> | Err<number,E1>`, whose Ok branch has lost `E1`; (b) at runtime, when `T` is not a `Result`, `flatten()` preserves the `Ok` wrapper while `andThen(identity)` returns the raw unwrapped value.

**Recommendation.** Delete the sentence, or replace it with the accurate narrower statement: "For a genuinely nested `Ok(Ok(x))`, `andThen((r) => r)` produces the same runtime value as `flatten()`, but `flatten()` keeps the outer error type in the result and is safe when `T` is not a `Result`."

---

### `docs-accuracy/ok-13` — `@throws` tags are inverted: the two methods that actually throw carry no `@throws` tag

**Severity:** low · **Category:** docs · **Verifier verdict:** adjusted

**Claim.** In base.ts, eight methods (`map`, `mapErr`, `mapOr`, `mapOrElse`, `andThen`, `orElse`, `unwrapOrElse`) carry `@throws Errors thrown by \`fn\` are not caught.` — the tag is used to say the method does *not* catch. Meanwhile `unwrap` (L186) and `unwrapErr` (L197), the only two members that genuinely throw, describe `UnwrapError` in prose and carry no `@throws` tag at all. Any tool that surfaces or filters on `@throws` — IDE signature help, typedoc, an LLM reading the .d.ts — gets exactly the inverted answer about which methods throw.

**Recommendation.** Add `@throws {UnwrapError} When this result is an \`Err\` (\`unwrap\`) / an \`Ok\` (\`unwrapErr\`). On \`Pending\`, the returned promise rejects instead.` to both. Move the "errors from `fn` are not caught" statements out of `@throws` and into the prose body or a `@remarks` block, so `@throws` retains its conventional meaning of "this can throw".

---

### `docs-accuracy/ok-16` — base.ts `settle` example claims `Ok<number, string>` where the type is `Settled<number, string>`

**Severity:** low · **Category:** docs · **Verifier verdict:** confirmed

**Claim.** packages/antithrow/src/base.ts L240-244: `const settled = await pending.settle(); // Ok<number, string> with value 5`. The static type is `Settled<number, string>` (i.e. `Ok<number,string> | Err<number,string>`) — the whole reason `settle()` exists is that you must still narrow afterwards. The runtime value happens to be `Ok(5)`, so the comment is defensible as a value annotation, but every other type-shaped comment in base.ts uses this same `// X is T` form, so a reader reasonably takes it as the type. The docs site gets this right (settled.md L27, design-of-settle.md L18).

**Recommendation.** Change to `// settled is Settled<number, string>; here, Ok(5)` — and extend the example one line to show the narrowing (`if (settled.isOk()) settled.value`), since the point of `settle()` is the boundary crossing, not the value.

---

### `docs-accuracy/ok-17` — `{@link UnwrapError}` in base.ts does not resolve — base.ts never imports it

**Severity:** low · **Category:** docs · **Verifier verdict:** confirmed

**Claim.** base.ts L186 and L197 reference `{@link UnwrapError}`, but base.ts's imports (L1-5) are only `Err`, `Ok`, `Pending`, `Result`, and the type helpers. With `UnwrapError` not in scope, TypeScript cannot resolve the link, so on hover and in any typedoc-style output it renders as inert plain text while the neighbouring `{@link Ok}` / `{@link Err}` render as navigable links. The two places a user most needs to jump to the error class are the two dead links.

**Recommendation.** Add `import type { UnwrapError } from "./errors.js";` to base.ts. It is type-only and erased at emit, so it costs nothing. Worth adding a lint rule or a docs build step that fails on unresolved `{@link}` targets — this class of rot is invisible in review.

---

### `docs-accuracy/ok-18` — README calls the current API "v2" while the package is 3.0.0

**Severity:** low · **Category:** docs · **Verifier verdict:** confirmed

**Claim.** packages/antithrow/README.md L164: "The modern root package is the v2 class-based API documented above." packages/antithrow/package.json reports version 3.0.0. A reader on npm sees a 3.0.0 badge above prose that calls the API v2, which reads as "this README is stale" and casts doubt on everything above it. Related npm-rendering nit on the same line-range: L62 links to `[@antithrow/std](../std)`, a monorepo-relative path that 404s on the npm and GitHub package pages.

**Recommendation.** Change to "the current class-based API" — version-free prose does not rot. Replace the relative `../std` link with the absolute npmjs.com or antithrow.dev URL so it resolves wherever the README is rendered.

---

### `docs-accuracy/ok-19` — tutorial/03's stated pipeline type is not the inferred type, though it is a sound supertype

**Severity:** info · **Category:** docs · **Verifier verdict:** confirmed

**Claim.** apps/docs/docs/tutorial/03-chain-transformations.md L48 says "The type of `endpoint` is `Result<{ port: number; url: URL }, "invalid-port" | "invalid-url">`". The inferred type is a wider five-member union whose `Ok` branch is `Ok<{url: URL; port: number}, "invalid-url">`. Recording this as info rather than a defect because the inferred type *is* assignable to the claimed type, and the narrowing the tutorial then demonstrates (L55-59) behaves exactly as promised: `endpoint.error` is `"invalid-port" | "invalid-url"` and `endpoint.value` is `{url: URL; port: number}`. So the lesson's claim — "TypeScript has accumulated every possible error across the chain" — holds for the reader. Noted only because it is another instance of the pattern behind ok-4 and ok-7: `Ok.andThen`/`Ok.orElse` return the callback's `R` verbatim, so the receiver's `E` disappears from the Ok branch of every inferred pipeline type.

**Recommendation.** Soften to "`endpoint` is assignable to `Result<{ port: number; url: URL }, "invalid-port" | "invalid-url">`", or annotate the const explicitly in the fence so the stated type is the actual one. No behavioural change needed.

---

### `docs-accuracy/ok-8` — "If the function returns a promise, the result becomes Pending/PromiseLike" is stated unconditionally but depends on the receiver

**Severity:** low · **Category:** docs · **Verifier verdict:** adjusted

**Claim.** base.ts states this rule three times without qualification — L51 (`map`, "becomes {@link Pending}"), L67 (`mapErr`, "becomes {@link Pending}"), L83 (`mapOr`, "becomes {@link PromiseLike}") — and methods.md repeats it at L53, L61, L69, L156. The callback only runs on the matching branch, so the upgrade is receiver-dependent, and it is wrong in both directions: `Err.map(asyncFn)` returns a plain `Err` (the fn never runs), `Ok.mapErr(asyncFn)` returns a plain `Ok`, `Err.mapOr(0, asyncFn)` returns `0` synchronously, and `Ok.unwrapOrElse(asyncFn)` returns the value synchronously — while `Pending.mapOr(0, syncFn)` returns a `PromiseLike` even though the fn is sync. Note the `PromiseLike` vs `Pending` wording difference flagged as a suspect is actually *correct* — `mapOr` returns a bare value, not a `Result` — so only the conditional is at fault, not the phrasing.

**Recommendation.** Qualify each sentence with the branch: "If this result is `Ok` **and** `fn` returns a promise, the result becomes `Pending`; on `Err` the callback never runs and the result is returned unchanged. Calling this on a `Pending` always produces a `Pending` regardless of `fn`." The types already model this correctly per-class — only the prose over-generalises, which is exactly the kind of gap a reader resolves by guessing.

---

### `docs-accuracy/ok-9` — `Result.do` JSDoc prose writes `yield* Ok(...)` — constructor-call syntax that throws at runtime

**Severity:** low · **Category:** docs · **Verifier verdict:** adjusted

**Claim.** packages/antithrow/src/result.ts L51-54 describes the protocol as: "The generator should `yield*` {@link Ok}, {@link Err}, or {@link Pending} values. - `yield* Ok(...)` continues execution ... - `yield* Err(...)` short-circuits ... - In async generators, `yield* Pending(...)` awaits". `Ok`, `Err`, and `Pending` are classes in v3; calling them without `new` is a TypeError. This looks like a holdover from the legacy `ok()` / `err()` factory helpers (still present under src/legacy/). The @example block immediately below correctly uses `new Ok(...)`, so the prose and the example in the same comment disagree. `Pending` in particular is never constructed directly by users at all — the docs elsewhere (pending.md L45) say to use `Result.try`/`Result.fromPromise` instead.

**Recommendation.** Rewrite the three bullets as `yield* new Ok(...)`, `yield* new Err(...)`, and for the third: "In async generators, `yield*` on a `Pending` (e.g. from `Result.try`) awaits it and either continues or short-circuits." Also fix L56, which names the internal function ("`resultDo` calls `iter.return()`") rather than the public `Result.do` that users see.

---

### `consumers/rc-12` — `isThenable` is duplicated byte-for-byte in `@antithrow/standard-schema` because the core does not export it

**Severity:** low · **Category:** packaging · **Verifier verdict:** confirmed

**Claim.** `packages/antithrow/src/utils.ts:1` defines `isThenable` but `packages/antithrow/src/index.ts` does not re-export it. `packages/standard-schema/src/validate.ts:10-16` re-implements it identically (same null check, same `object|function` check, same `then` typeof test) — the same predicate that decides whether `validate` returns `Settled` or `Pending`, i.e. the same sync/async fork the core makes internally. Any future refinement (e.g. handling a `then` getter that throws) now has to be made twice, in two packages, with no shared test.

**Recommendation.** Export `isThenable` from the core entrypoint (or a `antithrow/internal` subpath), and delete the copy in `@antithrow/standard-schema`. It is a natural companion to the `Result.isResult` brand predicate proposed in rc-1 — a small `guards` surface would cover both.

---

### `consumers/rc-14` — Two thirds of the core method surface is never used by any sibling package

**Severity:** info · **Category:** consistency · **Verifier verdict:** confirmed

**Claim.** Across ~1,000 lines of production source in the four sibling packages, the entire core-API footprint is: `Result.try` (49), `Result.fromPromise` (1), `new Err` (4), `new Ok` (2), `.mapErr` (1), `.andThen` (1), plus the `Settled`/`Result` type names. Zero production uses of `Result.do`, `new Pending`, `UnwrapError`, `InferOk`, `InferErr`, `isOk`/`isErr`/`isPending`, `map`, `mapOr`, `mapOrElse`, `and`, `or`, `orElse`, `flatten`, `unwrap`/`unwrapErr`/`unwrapOr`/`unwrapOrElse`, `settle`, or the iterator protocols. That is not automatically a problem — these packages are boundary adapters, and the combinators are for *their* consumers — but it does mean 17 of the 18 `ResultBase` methods have no first-party production exercise, and the flagship `Result.do` has no first-party usage at all.

**Recommendation.** Treat this as a prioritization signal, not a deletion list. Concretely: (a) add a first-party consumer that exercises the combinator surface — e.g. rewrite the sibling packages' *tests* to use `Result.do` and `isOk()`-narrowing instead of 124 `unwrap()` calls, which would simultaneously fix rc-6 and rc-7; (b) verify `mapOr`/`mapOrElse`/`and`/`or` earn their overload complexity, since nothing in the ecosystem has yet stressed them; (c) `Result.fromPromise` is nearly `Result.try(() => promise)` an […truncated, full text in findings.json]

---

### `consumers/rc-16` — `@antithrow/std` and `@antithrow/node` widen guaranteed-`Pending` returns to `Result`, creating statically-live but unreachable branches

**Severity:** low · **Category:** type-safety · **Verifier verdict:** confirmed

**Claim.** Every async wrapper in both packages annotates `Result<T,E>` even though `Result.try`'s own overload already returns the precise `Pending<T,E>` and the underlying call is unconditionally promise-returning. The cost is that `isOk()`/`isErr()` narrowing compiles on a value that can never be settled, so a caller can write a dead branch the compiler endorses, and the signature carries no "you must await this" signal.

**Recommendation.** Annotate the async wrappers as `Pending<T,E>` (`packages/node/src/fs/promises/*.ts`, `packages/std/src/{fetch,response}.ts`). It removes the dead branches, tells the reader at a glance that the call is async, and matches what `Result.try` already infers. If the intent was future-proofing against a sync fast path, say so in the JSDoc — right now the widening reads as accidental.

---

### `consumers/rc-17` — eslint-plugin has zero version coupling to the core it lints

**Severity:** low · **Category:** packaging · **Verifier verdict:** confirmed

**Claim.** `packages/eslint-plugin/package.json` lists `antithrow` only in `devDependencies`; its `peerDependencies` are `eslint` and `typescript` alone. Because the rules identify Result types by file-path substring (rc-4) rather than by importing anything from the core, the built plugin has no runtime reference to `antithrow` at all. Consequence: `@antithrow/eslint-plugin@2` will silently claim to lint `antithrow@1`, `@4`, or any future major whose class names or semantics changed, with no install-time warning. Contrast `@antithrow/std`/`@antithrow/node`/`@antithrow/standard-schema`, which all correctly declare `"antithrow": "workspace:^"` as a peer.

**Recommendation.** Add `"antithrow": "^3.0.0"` to the plugin's `peerDependencies` with `peerDependenciesMeta.antithrow.optional = true`, so npm/pnpm warn on a mismatched major. Once the brand from rc-1 exists, the plugin can additionally read a version marker off the core type and emit a diagnostic when it does not recognise it, rather than silently doing nothing (rc-4's false negative) or the wrong thing (rc-4's false positive).

---

### `errors-exceptions/ep-10` — Result.fromPromise "captures" a rejection whose reason is itself a promise, but the process still reports an unhandled rejection

**Severity:** low · **Category:** correctness · **Verifier verdict:** confirmed

**Claim.** result.ts:23-30 turns a rejection reason into `new Err(err)` with no inspection. When the reason is itself a rejected promise, the resulting Err holds a live rejected promise that nothing ever attaches a handler to. The user did everything the library asked — wrapped the promise, got an `Err` back — and the runtime still fires unhandledRejection (and would exit non-zero under Node's default policy). The library's core guarantee "rejection becomes Err" holds for the outer promise only.

**Recommendation.** In `fromPromise`'s rejection handler, if `isThenable(err)` attach a no-op catch before storing it: `(err) => { if (isThenable(err)) (err as Promise<unknown>).then(undefined, () => {}); return new Err(err); }`. Low severity because `Promise.reject(aPromise)` is rare in practice, but the fix is two lines and removes a case where the library's headline guarantee visibly fails.

---

### `errors-exceptions/ep-13` — Zero test coverage for throwing callbacks on the Pending path across the 534-test suite

**Severity:** info · **Category:** test-coverage · **Verifier verdict:** confirmed

**Claim.** The behavior in ep-1/ep-2/ep-5 — the single most consequential difference between the sync and async branches of this API — has no test asserting it in either direction. Searching the suite finds rejection assertions only for `Pending.then`'s onrejected plumbing, `unwrap`/`unwrapErr` on the wrong branch, and the Err-iterator resume guard. Nothing constructs a Pending via a throwing `map`/`mapErr`/`andThen`/`orElse`/`mapOrElse`/`unwrapOrElse` callback. That means the current behavior is emergent rather than chosen, and any fix has no regression net.

**Recommendation.** Add a test matrix: for each of map/mapErr/andThen/orElse/mapOrElse/unwrapOrElse, assert the settled-path behavior (throws synchronously) and the Pending-path behavior (rejects) explicitly, plus an unhandledRejection-listener test asserting that a dropped poisoned Pending does or does not register an event. Whichever semantics the maintainers choose in response to ep-1, these tests should pin it.

---

### `errors-exceptions/ep-14` — base.ts JSDoc for unwrap/unwrapErr says "throws an UnwrapError" with no mention that Pending rejects instead

**Severity:** low · **Category:** docs · **Verifier verdict:** confirmed

**Claim.** base.ts:186 and base.ts:196 document `unwrap`/`unwrapErr` as "Returns the value if this result is Ok, otherwise throws an UnwrapError", and both examples use a settled `Ok`. The return type is `SyncOrAsync<T>`, so the Pending case is in scope, but the JSDoc — which is what an editor shows on hover — never says the failure arrives as a promise rejection. The reference site does document this (unwrap-error.md:36); the hover text does not, and the hover text is what most users read.

**Recommendation.** Add to both JSDoc blocks: "On a `Pending`, the `UnwrapError` is delivered as a rejection of the returned promise, not thrown synchronously — and an unawaited `pending.unwrap()` becomes an unhandled rejection." Consider capturing the call site into the UnwrapError at construction (or using `Error.captureStackTrace`) so the async stack is not limited to err.ts.

---

### `packaging/pkg-10` — `antithrow/package.json` is not exported, breaking tools that introspect the manifest

**Severity:** low · **Category:** packaging · **Verifier verdict:** confirmed

**Claim.** The exports map has no `"./package.json"` entry, so `require.resolve('antithrow/package.json')` and `import('antithrow/package.json')` both fail. A number of common tools (bundler/framework plugins doing version sniffing, patch-package, some ESLint resolver setups, monorepo doctor scripts) resolve a dependency's manifest this way.

**Recommendation.** Add `"./package.json": "./package.json"` to the exports map — the near-universal convention for ESM packages. Apply to all five workspace packages, which share the identical exports shape.

---

### `packaging/pkg-11` — No `engines` field and `target: "esnext"` — the runtime floor is undeclared and can drift silently between patch releases

**Severity:** low · **Category:** packaging · **Verifier verdict:** confirmed

**Claim.** packages/antithrow/package.json has no `engines` key, and the build inherits `"target": "esnext"` from the root tsconfig. Today the emitted dist parses only at ecmaVersion 2022 (class fields). Because the target is `esnext`, a TypeScript upgrade that starts emitting a newer syntax form would raise the effective runtime floor with no version signal, no engines warning, and no CI failure.

**Recommendation.** Pin `"target": "es2022"` in tsconfig.build.json (decoupled from the typecheck config) and declare `"engines": { "node": ">=18" }`. That turns an implicit, drifting contract into an explicit one npm can warn on, and lets you make floor changes deliberately as semver-major.

---

### `packaging/pkg-12` — The deprecated legacy build is 65% of the install payload every v3 consumer downloads

**Severity:** low · **Category:** packaging · **Verifier verdict:** adjusted

**Claim.** `files: ["dist"]` ships dist/legacy unconditionally. dist/legacy is 55,353 bytes against 29,655 bytes for the entire v3 API — so a consumer who only ever writes `import { Ok } from "antithrow"` still downloads and stores roughly twice the deprecated v2 code as new code. It does not affect bundles (separate module graph, verified in pkg-13), but it does affect install size, CI cache size, and the perceived surface of the package.

**Recommendation.** Publish the v2 surface as its own package (e.g. `antithrow-legacy@2`) with a deprecation notice, or at minimum plan its removal for 4.0.0 and say so in the README. A deprecated compatibility shim outweighing the library it shims is a signal the shim should be split out.

---

### `packaging/pkg-13` — Tree-shaking is effectively all-or-nothing: importing only `Ok` pulls 87% of the library

**Severity:** info · **Category:** packaging · **Verifier verdict:** confirmed

**Claim.** `sideEffects: false` is correct and works (an entirely unused import shakes to zero bytes), but per-symbol granularity is nil: the three classes reference each other unavoidably (`Ok.map` constructs `Pending`, `Ok.flatten` does `instanceof Err`/`instanceof Pending`, `Err.mapErr` constructs `Pending`, all three extend `ResultBase`, all three reach `UnwrapError`). Importing only `Ok` costs 731 B gzip versus 873 B for the entire public API. This is a neutral observation, not a defect — the whole library is under 1 KB gzip, which is a genuinely strong number — but it means the 2.0.0 CHANGELOG entry "chore: mark packages as tree-shakable" buys ~16%, not the order-of-magnitude the phrase suggests.

**Recommendation.** No action required on correctness. Consider adjusting messaging: quote the real number ("<1 KB gzip, all in") rather than leaning on tree-shakability, since the honest figure is the more impressive one.

---

### `packaging/pkg-14` — The `lint` pipeline runs publint, which reports "All good!" on a package that fails to load under Node CJS and Jest

**Severity:** low · **Category:** packaging · **Verifier verdict:** confirmed

**Claim.** `"lint": "bun run lint:publint && bun run lint:types"` is the package's only packaging gate. publint passes cleanly while attw independently reports two real problems (CJSResolvesToESM on both entries, NoResolution for node10 legacy) — the very problems documented in pkg-1, pkg-2 and pkg-4. The current gate provides false assurance.

**Recommendation.** Add `"lint:attw": "attw --pack ."` to the lint pipeline (with `--ignore-rules` for anything deliberately accepted, so the accepted trade-offs are recorded in the repo rather than merely unobserved). Roll it out across all five publishable packages, which share the same exports shape and therefore the same gaps.

---

### `packaging/pkg-15` — No declaration maps or sources shipped — go-to-definition dead-ends in .d.ts

**Severity:** low · **Category:** packaging · **Verifier verdict:** confirmed

**Claim.** tsconfig.build.json enables `declaration` but not `declarationMap` or `sourceMap`, and `files: ["dist"]` excludes `src`. A consumer who cmd-clicks `Ok.flatten` lands in dist/ok.d.ts with the implementation nowhere available, and any stack trace from `UnwrapError` points at compiled output. For a library whose whole value proposition is type-level clarity, the inability to read through to the source is a meaningful DX gap.

**Recommendation.** Set `"declarationMap": true` and `"sourceMap": true` in tsconfig.build.json and add `"src"` to `files`. Cost is a few KB of tarball (small next to the 55 KB of legacy already shipped); benefit is working go-to-definition and readable stack traces.

---

### `packaging/pkg-16` — README is stale on version, silent on ESM-only, and bun-only on install

**Severity:** low · **Category:** docs · **Verifier verdict:** confirmed

**Claim.** The published README (it IS in the tarball, so this is the npm landing page) closes with "The modern root package is the v2 class-based API documented above" — but the package is 3.0.0 and, per the CHANGELOG, v2 was precisely the `ok`/`err`/`ResultAsync` API that now lives at /legacy. Separately, the README never states the package is ESM-only, which is the single most important consumption fact given pkg-1/pkg-2, and the install snippet offers only `bun add`, with no npm/pnpm/yarn line.

**Recommendation.** Fix line 164 to say v3, add an "ESM only — use dynamic `import()` from CommonJS" note near Installation (or delete the note once pkg-1 is fixed and CJS actually works), and add npm/pnpm/yarn install lines. Also consider that line 62's `[@antithrow/std](../std)` is a repo-relative link whose npm rendering depends on npm's repository-directory rewriting — an absolute https://antithrow.dev link is safer.

---

### `packaging/pkg-5` — Root and /legacy export identically-named, mutually-incompatible `Ok`/`Err`/`Result` — cross-entrypoint values fail `instanceof` and silently defeat `flatten()`

**Severity:** low · **Category:** packaging · **Verifier verdict:** adjusted

**Claim.** Both entrypoints of the SAME package export the names `Ok`, `Err`, `Result`. They are different classes/objects with no runtime brand. During the exact scenario the /legacy subpath exists for — an incremental migration where some modules still import from `antithrow/legacy` — a legacy result handed to the new API is not recognised: `Ok.flatten()` does its `instanceof` check, sees no match, and silently returns the OUTER Ok, so `unwrap()` yields the wrapper object `{value:5}` instead of `5`. No error, no type complaint at the boundary; just wrong data.

**Recommendation.** Give the tri-state classes a brand (e.g. a `Symbol.for("antithrow.result")` tag or a `#kind` field) and have `flatten()`/`Result.do` test the brand rather than `instanceof`, so foreign or duplicated copies of the library are at least detected. At minimum, rename the legacy exports (`LegacyOk`/`LegacyErr`) or document loudly that values must not cross the entrypoint boundary — the current silence turns a migration into a data-corruption bug.

---

### `packaging/pkg-9` — Internal unused-parameter convention leaks into the published .d.ts — consumers see `_value`, `_fn` in IntelliSense

**Severity:** low · **Category:** ergonomics · **Verifier verdict:** confirmed

**Claim.** CLAUDE.md mandates an underscore prefix for unused parameters. That is an implementation detail, but because the parameter names flow into the emitted declarations, downstream users see `unwrapOr(_value: T)` and `mapErr(_fn: ...)` in signature help and in generated API docs. The same method also has an inconsistent parameter name across branches of the union (`Ok.map(fn)` vs `Err.map(_fn)`), and `Err.map` spells its type as `U | PromiseLike<U>` while every sibling uses the `SyncOrAsync<U>` alias.

**Recommendation.** Suppress the lint for these specific overrides and keep the public-facing names (`value`, `fn`, `result`, `defaultValue`) — or `void fn;` in the body instead of renaming the parameter. Also change `Err.map`'s `U | PromiseLike<U>` to `SyncOrAsync<U>` for signature consistency.

---

### `legacy-migration/lm-11` — `toAsync()` has no successor; lifting a settled Result into `Pending` requires the raw `new Pending(Promise.resolve(...))` constructor

**Severity:** low · **Category:** ergonomics · **Verifier verdict:** adjusted

**Claim.** Legacy `Result.toAsync()` was the sanctioned sync→async bridge (2.0.0 removed six `*Async` methods specifically in its favour). The tri-state redesign removed it and offers nothing in its place: the `Result` namespace has only `try`/`fromPromise`/`do`. `Result.fromPromise` cannot be used (it double-wraps, lm-2). The only working lift is hand-constructing `new Pending(Promise.resolve(settled))`, which forces users into the internal-looking `Pending` constructor and requires them to know it takes a `PromiseLike<Settled<T,E>>` — a shape not shown anywhere in the README or the docs' Pending reference.

**Recommendation.** Add `Result.pending(settled: Settled<T,E>): Pending<T,E>` (or restore a `toAsync()`/`toPending()` instance method on `ResultBase`) so the lift is a first-class, discoverable operation, and document it as the `toAsync` migration target. Note the asymmetry: `settle()` exists to go Pending→Settled but nothing exists to go the other way.

---

### `legacy-migration/lm-14` — Shipped legacy code has undocumented defects: `Result.all` and `ResultAsync.all` disagree on which `Err` wins, and `ResultAsync.isOk` is documented as a type predicate but returns `Promise<boolean>`

**Severity:** low · **Category:** correctness · **Verifier verdict:** adjusted

**Claim.** `antithrow/legacy` is still published, still installed by everyone on 3.x, and is the officially-sanctioned holding pen — but it carries defects that are documented nowhere (the `@deprecated` tags say only "use the root API"). (1) The two `all` implementations pick different errors: `Result.all` returns the first `Err` in ARRAY ORDER, while `ResultAsync.all` (built on `Promise.all` + `throw`) returns the first to RESOLVE. Swapping one for the other — exactly what migrating sync→async code does — changes which error a user sees. (2) `ResultAsync.isOk`/`isErr` are documented as "Type predicate for `Ok`" but return `Promise<boolean>`, so no narrowing is possible; the JSDoc example `if (await result.isOk()) { console.log("success"); }` doesn't even use the value it claims to narrow.

**Recommendation.** If legacy is a supported holding pen, its known divergences deserve a "Known differences / caveats" section in the legacy docs (which currently has none). If it is truly frozen, say so explicitly in the README's Legacy section and in the deprecation text ("frozen, will be removed in 4.0; no fixes will be made") so users can plan. Also fix the `ResultAsync.isOk`/`isErr` JSDoc — calling them "type predicates" is simply false. When adding `Result.all` to the core API (lm-6), pick ordered-first-Err  […truncated, full text in findings.json]

---

### `legacy-migration/lm-15` — README says the root package is "the v2 class-based API" while the docs label the legacy subpath "Legacy (v2) API"

**Severity:** low · **Category:** docs · **Verifier verdict:** confirmed

**Claim.** The two pieces of prose that a user reaches for when deciding which entrypoint to import contradict each other on the version number. packages/antithrow/README.md:164 tells the reader the root is v2; apps/docs/docs/legacy/_category_.json labels the legacy subpath "Legacy (v2) API". The package is at 3.0.0. Anyone trying to work out which entrypoint corresponds to the API they have gets the opposite answer depending on which file they read.

**Recommendation.** Change the README sentence to "The root package is the v3 tri-state API documented above" and link the (new) migration guide from both places. Add a one-line version→entrypoint table: `antithrow` = v3 tri-state (`Ok`/`Err`/`Pending`), `antithrow/legacy` = v2 two-state (`ok`/`err`/`ResultAsync`/`chain`), deprecated.

---

### `legacy-migration/lm-16` — A 3.0.0 patch-changelog entry describes a perf fix to `Result.all`, an API the 3.0.0 root does not have

**Severity:** low · **Category:** docs · **Verifier verdict:** confirmed

**Claim.** packages/antithrow/CHANGELOG.md lists under 3.0.0 → Patch Changes: "perf: reduce unnecessary array overhead in `Result.all`". In 3.0.0 the root `Result` namespace has no `all`; the change actually landed in what became the legacy namespace. A reader scanning the 3.0.0 notes reasonably concludes `Result.all` exists in the new API, which compounds the undocumented removal in lm-6.

**Recommendation.** Annotate the entry as `(legacy)` when generating combined notes, or better, split changesets so legacy-only changes land in a clearly-scoped section. Going forward, prefix legacy-affecting entries with `legacy:`.

---

### `legacy-migration/lm-17` — Both generations export identically-named `Ok`, `Err`, and `Result`; a mixed file requires aliasing, and importing both roughly 2.5x's the bundle

**Severity:** low · **Category:** packaging · **Verifier verdict:** confirmed

**Claim.** Keeping legacy in the same package under a subpath means the two generations collide on all three primary identifiers. A file that imports both without aliases fails with six `TS2300: Duplicate identifier` errors, so incremental per-file migration inside a single module is impossible without renaming — and once aliased, `Ok` and `LegacyOk` sit side by side in autocomplete with no visual cue about which is which (the classes are unrelated; `instanceof` is false in both directions). Cost-wise, legacy is larger than the API that replaced it, and a build that touches both pays for both.

**Recommendation.** Move the legacy API to a separate package (`antithrow-legacy` or `@antithrow/legacy`) that peer-depends on nothing, so v3 installs stop carrying 15 KB of JS and 40 KB of declarations they will never use, and so the deprecation has a clean removal path. If it must stay in-package, at least mark a removal version in the deprecation text and consider re-exporting the legacy classes under distinct names (`LegacyOk`, `LegacyErr`, `LegacyResult`) so mixed files need no aliasing and autocomplete disamb […truncated, full text in findings.json]

---

### `legacy-migration/lm-18` — `new Ok()` has no no-argument form, so legacy `ok()` / `okAsync()` void results need an explicit `undefined`

**Severity:** info · **Category:** ergonomics · **Verifier verdict:** confirmed

**Claim.** Legacy shipped a dedicated overload `ok<E>(): Ok<void, E>` (added in 1.1.0, "allow `ok` and `okAsync` to accept a void success value") for the very common "succeeded, no payload" case. The core `Ok` constructor takes a required parameter, so every such call site must become `new Ok<void, E>(undefined)`. Small, but it touches a lot of lines in a real migration and is not mentioned anywhere.

**Recommendation.** Either give `Ok` a `constructor(value?: T)`-style overload for `T extends void`, or add `Result.unit<E>()` / export a shared `OK_VOID` constant. Mention the `ok()` → `new Ok(undefined)` rewrite in the migration guide either way.

---

### `legacy-migration/lm-19` — `Result.do` is a faithful replacement for `chain` — verified on every behavioural axis

**Severity:** info · **Category:** correctness · **Verifier verdict:** confirmed

**Claim.** The CHANGELOG's claim "`Result.do(...)` replaces `chain(...)` for fail-fast generator composition" holds up under testing: short-circuit value, `finally`-block cleanup on early exit (sync and async), non-conversion of thrown exceptions, error-union inference across multiple distinct yielded `Err` types, and mixing a sync `Ok` into an async generator all behave identically or better. Recording this because it is the one migration claim in the 3.0.0 notes that is fully accurate, and a verifier should not have to re-derive it.

**Recommendation.** No change required to the semantics. Optionally state the sync/async return-shape mapping (`chain`→`Result`/`ResultAsync` becomes `Result.do`→`Settled`/`Pending`) in the migration guide, since the async arm's static type changes from `ResultAsync<T,E>` to `Pending<T,E>` and any user-written helper signatures need updating.

---

### `probe-ts-compat-floor/ok-10` — Forward compatibility is clean: the whole public type surface behaves identically on the TypeScript 7 native preview (tsgo), and node10 resolution is the only thing TS 7 breaks

**Severity:** info · **Category:** packaging · **Verifier verdict:** unverified

**Claim.** Neutral observation worth recording alongside the backward-compat findings. The 22-assertion differential suite, the 17-case negative suite, and the async-generator `Result.do` case all pass unchanged on @typescript/native-preview 7.0.0-dev.20260707.2, and skipLibCheck:false is clean too. The only TS7-related break I found on the compiler axis is that `moduleResolution: node10` is removed outright (TS5108) and already an error in 6.0.3 (TS5107), which matters only to consumers still on classic resolution.

**Recommendation.** No action required for TS 7 itself. Worth adding tsgo to the CI compile matrix now so forward regressions are caught while the port is still moving. When you document the supported range (ok-3), state it as a range with both ends (e.g. ">=5.4", verified through 7.0-dev) rather than a bare minimum.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-ts-compat-floor/ok-7` — The project's own documented tsconfig prescribes `skipLibCheck: true`, which is exactly the setting that converts the hard incompatibility into the silent one

**Severity:** low · **Category:** docs · **Verifier verdict:** unverified

**Claim.** apps/docs/docs/tutorial/01-setup.md is the single tsconfig the project tells users to write, and it sets `"skipLibCheck": true` with no accompanying compiler-version requirement. Given that skipLibCheck:false is the only thing that surfaces the NoInfer incompatibility as an error (ok-2) and the lib floor as an error (ok-5), the documented setup is precisely the configuration under which a sub-floor consumer receives no warning at all. This is a documentation problem independent of whether ok-1 gets fixed, because the same reasoning applies to any future d.ts-level requirement the package adds.

**Recommendation.** Add one sentence to the tutorial setup page and packages/antithrow/README.md stating the minimum TypeScript and lib/target, e.g. "antithrow requires TypeScript >= X and lib es2018 or later." Keep recommending skipLibCheck:true (it is the right default for build speed) but make the requirement discoverable so it is not silently load-bearing. Independently, add a CI fixture that compiles a consumer of the built dist with skipLibCheck:false at the declared minimum version — the repo's root tsconfig […truncated, full text in findings.json]

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-ts-compat-floor/ok-8` — A drop-in, version-portable replacement for the NoInfer intrinsic reproduces the exact same behaviour on TypeScript 4.7 through 6.0.3

**Severity:** info · **Category:** correctness · **Verifier verdict:** unverified

**Claim.** The 5.4 floor is not inherent to the design — it is one type alias. Declaring `type NoInferCompat<T> = [T][T extends unknown ? 0 : never];` and substituting it for `NoInfer<U>` in the three `Ok.mapOr` overloads preserves both the negative behaviour (mismatched default rejected) and all three positive behaviours (sync same-type, sync mapped-type, async) identically on every compiler from 4.7.4 to 6.0.3. I verified this against a faithful transcription of the real overload set, so the recommendation in ok-1 is empirically grounded rather than speculative.

**Recommendation.** Apply the substitution in packages/antithrow/src/ok.ts lines 60-62 and, for consistency, consider applying the same protection to `Err.mapOr` and `Pending.mapOr`, which currently take a plain `U` and so infer the type from the default rather than from the callback (on TS 6.0.3 `err.mapOr("wrong-string", v => v)` errors, but with the blame misdirected at the callback: `error TS2322: Type 'number' is not assignable to type 'SyncOrAsync<"wrong-string">'`, and `Pending.mapOr` infers `PromiseLike<str […truncated, full text in findings.json]

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-ts-compat-floor/ok-9` — The library source cannot be built under `erasableSyntaxOnly` (parameter properties), closing off Node/Bun type-stripping and source-consumption paths

**Severity:** low · **Category:** packaging · **Verifier verdict:** unverified

**Claim.** All four public constructors use TypeScript parameter properties (`constructor(readonly value: T)` etc.), which `--erasableSyntaxOnly` (TS 5.8+) rejects. This does not affect consumers of the published package — dist ships plain JS, and I confirmed a consumer compiling with `--erasableSyntaxOnly` imports antithrow cleanly — but it does mean the library itself could never be shipped or executed as type-stripped TypeScript (Node's --experimental-strip-types, Bun/Deno direct-source consumption, or a monorepo that consumes src directly). It is a self-imposed constraint on a library whose whole value proposition is being consumable everywhere.

**Recommendation.** Rewrite the four constructors to explicit field declarations plus assignment (`readonly value: T; constructor(value: T) { super(); this.value = value; }`) and add `"erasableSyntaxOnly": true` to packages/antithrow/tsconfig.json to lock it in. This is a mechanical, non-breaking change to the emitted JS shape under the current `useDefineForClassFields` settings, and it future-proofs the package for type-stripping runtimes.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-concurrency-cancellation/cc-12` — `settle()` is a pure getter that returns `this.promise` by identity — the name implies work or safety it does not provide

**Severity:** low · **Category:** ergonomics · **Verifier verdict:** confirmed

**Claim.** `Pending.settle()` (pending.ts:126-128) is `return this.promise` — nothing more. Its return value is identical (`===`) to the raw public `.promise` field. In a concurrency context the verb is actively misleading: users reach for `.settle()` in fan-outs believing it drives the Result to a settled state or provides a safe boundary, but it subscribes nothing, adds no rejection handler, and therefore gives an abandoned poisoned Pending exactly as much protection as doing nothing (see cc-1). Since `.promise` is public and identical, `settle()` on Pending is pure surface area.

**Recommendation.** Either make `settle()` earn its name by attaching the poison sink from cc-1 (`this.promise.then(x => x, reason => new Err(reason as E))` under an explicit contract), or make `.promise` non-public/`@internal` so `settle()` is the single documented boundary. Shipping both an identical getter and a raw field invites users to reach past the API.

---

### `probe-concurrency-cancellation/cc-13` — `Result.try(() => aResult)` is the only public way to de-poison a Pending, and it is undocumented and double-wraps

**Severity:** low · **Category:** docs · **Verifier verdict:** adjusted

**Claim.** Because `Result.try` routes any thenable through `fromPromise`, which installs an `onrejected` handler (result.ts:23-30), `Result.try(() => poisonedPending)` and `Result.fromPromise(poisonedPending)` both convert a poisoned Pending back into an `Err` — the only recovery paths that exist (cc-2). Neither is documented for this purpose, and neither is clean: on the success path they produce a nested `Ok<Ok<T>>` (`Pending<Settled<T,E>, unknown>`), so the idiom is really `Result.try(() => p).flatten()`, and the recovered error type widens to `unknown`.

**Recommendation.** Add an overload `Result.try<T, E>(fn: () => Result<T, E>): Result<T, E | unknown>` that flattens automatically, or a named `Result.catchPoison(result)`. Document the de-poison idiom on the async/error-handling docs pages — right now a user whose Pending is poisoned has no documented way out.

---

### `probe-concurrency-cancellation/cc-14` — `Result.do`'s fail-fast does not protect a generator body from a poisoned Pending

**Severity:** info · **Category:** correctness · **Verifier verdict:** confirmed

**Claim.** `Result.do` is the library's own composition primitive and is documented to short-circuit on the first `Err`. It does not, however, convert a poisoned Pending into an `Err`: `yield*` on a poisoned Pending rejects the whole returned Pending, meaning the one construct that looks like a structured, safe composition boundary offers no more protection than a bare `await`. Recorded as info because it is a direct consequence of cc-5 rather than an independent defect, but it is worth stating because `Result.do` is what the docs steer users toward for multi-step async work.

**Recommendation.** Either have `resultDo`'s async branch attach an onrejected that produces `Err`, or extend the `Result.do` JSDoc and the use-result-do.md how-to to state that a poisoned yielded Pending rejects the returned Pending and how to guard against it.

---

### `probe-concurrency-cancellation/cc-6` — No cancellation story anywhere: Pending exposes zero cancel surface, and a raced-out timeout leaves the loser running to completion

**Severity:** low · **Category:** missing-capability · **Verifier verdict:** adjusted

**Claim.** There is no `AbortSignal`, timeout, or cancellation concept anywhere in the public API. Enumerating every member on `Pending`'s prototype chain yields nothing cancellation-related, and `Result.try` accepts no options object. The only timeout a user can build is `Promise.race([pending, timeoutPromise])`, which decides the winner but cannot stop the loser: the abandoned work runs to completion, holding its connection/handle, and its result is discarded. For the common shape "bound this fan-out at 200ms", the library therefore gives you a result but no back-pressure — N abandoned operations keep running. This matters more than for a plain promise library because `Pending` is eager (cc-8), so by the time you decide to give up, all N are already in flight.

**Recommendation.** Add a first-class `Result.timeout(result, ms, onTimeout)` and thread an `AbortSignal` through the operation-creating entry points: `Result.try(fn, { signal })` passing the signal to `fn`, and a `Pending` that resolves to a caller-supplied `Err` when the signal aborts. Since a `Result` value cannot be cancelled after the fact, the cancellable form must be thunk-shaped (`(signal: AbortSignal) => SyncOrAsync<T>`), which also solves cc-8. Independently, `@antithrow/std`'s `fetch` should surface `Abo […truncated, full text in findings.json]

---

### `probe-test-interop/ti-10` — The type system provides zero protection against a cross-variant assertion, even under a strictly-typed toEqual

**Severity:** low · **Category:** type-safety · **Verifier verdict:** unverified

**Claim.** One might hope TypeScript catches `expect(okResult).toEqual(new Err(...))`. It does not, and cannot, given the current design: real runners type `toEqual` loosely, and even a hypothetical strict `toEqual(expected: T)` signature accepts every variant, because when the actual is `Result<T,E>` (the normal return type of any function under test) both `Ok<T,E>` and `Err<T,E>` and `Pending<T,E>` are assignable to it. So the runtime false-passes in ti-2 and ti-3 are fully reachable from ordinary, type-clean code — none of the `as never` casts in my repros are needed in real consumer code.

**Recommendation.** Accept that types cannot police this and fix it at the value level: the `kind` discriminant from ti-3 plus the shipped matchers from ti-7. A `toBeOkWith(value)` matcher makes the variant explicit in the assertion's *name*, so a wrong assertion is a wrong word rather than a silently-equal object graph. Optionally publish `@antithrow/eslint-plugin` rules that flag `expect(x).toEqual(new Ok(...))`/`toEqual(new Err(...))`/`toEqual(new Pending(...))` and steer to the matchers.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-suite-efficacy/ok-12` — base.ts is 247 lines of JSDoc @example code that is never compiled or executed — 24 mutants inside those examples are unkillable by construction

**Severity:** low · **Category:** docs · **Verifier verdict:** unverified

**Claim.** `base.ts` contains only an abstract class: every method is a bare `abstract` signature preceded by a JSDoc block with a ```ts @example. Coverage reports base.ts at 0.00% funcs / 100.00% lines. The first mutation run generated 24 mutants inside those `@example` blocks (swapping `new Ok(` <-> `new Err(`, negating `if (result.isOk())`, removing `await result`) and every single one survived, because nothing in the repo type-checks or runs documentation examples. The examples are the primary API documentation surface (they are what appears in editor hovers and on antithrow.dev), so a wrong example ships silently.

**Recommendation.** Run the JSDoc examples as code. Either extract them with a doc-test step (e.g. a small script that pulls ```ts fences out of src/**/*.ts into a generated `examples.ts` and type-checks it under the same tsconfig as part of `lint:types`), or move the canonical examples into a checked `examples/` directory and reference them. Type-checking alone would have killed most of the 24 survivors (`new Err(42)` where an `Ok<number>` is annotated, `await result` on a non-Pending, etc.).

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-suite-efficacy/ok-13` — The identity contract of the `return this` fast paths is unasserted

**Severity:** low · **Category:** test-coverage · **Verifier verdict:** unverified

**Claim.** `Ok.mapErr` (ok.ts:57), `Ok.orElse` (ok.ts:99), `Err.map`, `Err.andThen` and `Err.and` all return `this` under a `// SAFETY:` cast, which is an observable contract (`r.mapErr(f) === r`) that users can and do rely on for cheap reference equality and for `WeakMap` keying. Replacing `return this` with a fresh equal-valued instance survives the suite at 534 pass, so the fast path could silently become an allocation on every call without any test noticing.

**Recommendation.** Either assert the identity where it is intended (`expect(result.mapErr(fn)).toBe(result)` in the existing "returns Ok unchanged" tests — five one-line additions), or, if identity is explicitly not part of the contract, say so in the JSDoc so the fast path stays a free implementation detail. Right now it is neither documented nor tested.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-suite-efficacy/ok-14` — The 132 un-awaited `.resolves`/`.rejects` assertions DO work — but only because of a Bun-specific tracker, and the adjacent floating-`then` idiom does not

**Severity:** info · **Category:** test-quality · **Verifier verdict:** unverified

**Claim.** I expected the 132 un-awaited `expect(p).resolves.toBe(x)` calls to be dead assertions (the classic Jest footgun). They are not: Bun tracks pending assertion promises per test and fails the test, including for promises that resolve tens of milliseconds later. This is a genuine non-finding worth recording so nobody 'fixes' it wrongly. The caveat is portability and a nearby real hole: an assertion created inside a floating `.then()` callback is NOT tracked and passes silently. Migrating this suite to Jest or Vitest, or refactoring any of these into `.then(v => expect(v)...)`, would silently disarm up to 132 assertions.

**Recommendation.** Add `await` to the 132 sites anyway — it costs nothing, removes the Bun dependency, and makes the intent explicit. If the suite is ever ported off `bun:test`, doing this first is mandatory. Optionally enable a lint rule for floating promise assertions so the untracked `.then(() => expect(...))` shape cannot appear.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-suite-efficacy/ok-15` — What the maintainer must BUILD vs what can be tested today (triage of the gap classes)

**Severity:** info · **Category:** tooling · **Verifier verdict:** unverified

**Claim.** Empirically, the defect classes that this suite lets through split cleanly into three tiers, and only one of them needs new infrastructure. Tier 1 (expressible today with `bun:test`, zero new tooling): the isThenable matrix (ok-2), UnwrapError `.result`/`.name` (ok-4), the `@throws` contract on Ok/Err including the Pending unhandled-rejection case (ok-3 — verified that `bun test` already fails on it), async `Result.do` cleanup ordering (ok-8), the `Ok<Promise<T>>` double-wrap (ok-5, needs only `.settle()` instead of `.unwrap()`), and the identity contract (ok-13). That is 12 of the 15 non-equivalent survivors. Tier 2 (tooling exists in-repo but is not applied): type-level rejections via `@ts-expect-error`, already used at 4 sites but never for `NoInfer`/overload-resolution (ok-9) — and it must be wired into the `test` job/pre-commit to have teeth (ok-10). Tier 3 (genuinely new infrastructure): a consumer/dist smoke test (ok-1, ok-11) and a mutation-score gate (ok-6).

**Recommendation.** Sequence the work: (1) write the ~30 lines of Tier-1 tests, which close 12/15 survivors and lift the measured mutation score from 84.8% to roughly 98%; (2) add `bun run lint:types` to the CI test job and pre-commit, then add the `@ts-expect-error` cases for `NoInfer`; (3) add the consumer smoke test (template at /tmp/.../suite-efficacy/consumer/); (4) only then consider a StrykerJS gate, using /tmp/.../suite-efficacy/mutate2.ts's rule set as the seed and its 107-mutant / ~2-minute runtime as the […truncated, full text in findings.json]

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-runtime-matrix/rt-10` — Array.fromAsync over a Pending: silent empty array on node 22+, loud TypeError on node <=20 — the same code fails differently by version

**Severity:** low · **Category:** consistency · **Verifier verdict:** unverified

**Claim.** `Array.fromAsync(pending)` — a natural thing to reach for given that Pending publicly implements `Symbol.asyncIterator` — returns `[]` on every runtime that has `Array.fromAsync` (node 22/24, bun, deno), silently discarding the successful value, and throws `TypeError: Array.fromAsync is not a function` on node 16/18/20. So the identical line of consumer code fails loudly on an older runtime and silently on a newer one. This is a version-dependent instance of the zero-iteration bug in rt-4; recorded separately because the loud/silent split is itself the portability hazard (a developer on node 20 sees an error and works around it; the same code shipped on node 22 quietly produces an empty array).

**Recommendation.** Fixed for free by rt-4 option (b): moving the chain protocol off `Symbol.asyncIterator` onto a private registered symbol makes `Array.fromAsync(pending)` a type error and a runtime TypeError everywhere, consistently, instead of a silent empty array on new runtimes. If `Symbol.asyncIterator` must stay public, at minimum document that Pending's async iterator yields nothing on success and exists solely for `yield*` inside `Result.do`.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-runtime-matrix/rt-11` — Negative result: microtask scheduling of Pending chains is bit-identical across node 18/20/22/24 and bun

**Severity:** info · **Category:** portability · **Verifier verdict:** unverified

**Claim.** I probed for observable microtask/timing divergence between engines for chained Pendings, using deterministic tick counting rather than wall-clock benchmarking, and found none. Tick costs, interleaving against a bare promise chain, and microtask-vs-macrotask ordering are identical on every runtime tested. Recording this explicitly so the question is closed: no consumer can be broken by switching runtimes on the basis of Pending scheduling order. The one substantive observation is a cost, not a divergence — a `.map()` hop whose callback is async costs ~4 microtask ticks versus ~2 for a sync callback, uniformly, because the intermediate Pending is a thenable that gets assimilated by the enclosing `.then()`.

**Recommendation.** No action required for portability. If the ~2x tick cost of async-callback chains ever matters, `Pending.map` could special-case a non-thenable return from `settled.map(fn)` to avoid the extra assimilation round-trip — but there is no correctness or portability motivation for it, so this is purely informational.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-runtime-matrix/rt-12` — Mitigating context: all four mainstream test runners do detect a dropped Pending error and exit non-zero

**Severity:** info · **Category:** portability · **Verifier verdict:** unverified

**Claim.** Balancing rt-2 and rt-3: although the production runtime may swallow a dropped Result error, CI generally will not. node --test, bun test, vitest and jest all fail the run. Worth recording because it bounds the blast radius of the crash-severity findings — the realistic exposure is production behaviour and browser/edge, not undetected-in-CI. One caveat: vitest's summary line reads "Test Files 1 passed (1) / Tests 2 passed (2)" and reports the failure only under a separate "Unhandled Errors" heading, so a human skimming the summary sees all-green even though the exit code is 1.

**Recommendation.** No library change needed, but the docs' testing guidance could point this out as a positive: dropped Result errors are caught by every mainstream runner, so a test suite is currently the most reliable place these get found. That is also an argument for the drop-detection hook in rt-2 — it would make the same failure visible in production, where today only CI sees it.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.
