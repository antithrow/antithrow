# antithrow core API audit — critical findings

> Part of the [API audit](../API_AUDIT.md). Soundness breaks: the type system or documentation asserts something empirically false, with silent misbehavior.
> Findings are grouped by audit dimension. Repro scripts referenced in evidence lived in the session scratchpad (ephemeral); all key observed output is quoted inline. The full untruncated register is in [findings.json](./findings.json).

### `ok-runtime/ok-1` — `Ok.map` silently returns a `Pending` for any value that has a `then` method — the compiler still says `Ok<U, E>`

**Severity:** critical · **Category:** correctness · **Verifier verdict:** confirmed

**Claim.** `Ok.map` dispatches on the runtime predicate `isThenable()` (`typeof value.then === "function"`), but its type-level overload dispatches on `U extends PromiseLike<infer A>`. These two tests disagree for any object that has a `then` *method* with a non-PromiseLike signature — a domain class, a branching config object, a Proxy-based mock/stub, an ORM chainable. For such a value the declared return type is `Ok<U, E>` (a settled success) while the runtime object is a `Pending` whose `.promise` is whatever the foreign `then` happened to return. `isOk()` returns `false` on a value the compiler has proven is an `Ok`, `.value` is `undefined`, and `.unwrap()` returns garbage instead of the mapped value.

<details><summary><strong>Empirical evidence</strong></summary>

Runtime: `bun /tmp/claude-0/-home-user-antithrow/6fa15e49-ae6b-5bd4-b03a-8a3385b537f3/scratchpad/ok-runtime/h-then-hijack.ts`
```
runtime constructor => Pending
mapped.isOk() => false
mapped.isPending() => true
(mapped as any).value => undefined
mapped.unwrap() => Transition {
  state: [Function],
  then: [Function: then],
}
(mapped as Pending).promise => Transition { state: [Function], then: [Function: then] }
plain object with a `then` function -> ctor => Pending
plain object with a `then` function -> isOk() => false
```
(`Transition` is `class Transition { constructor(readonly state: string) {} then(next: string): Transition { return new Transition(next); } }`; the second case is the plain object `{ then: () => "branch-a", else: () => "branch-b" }`.)

Type level: `cd /home/user/antithrow && bun x tsc --ignoreConfig --noEmit --strict --exactOptionalPropertyTypes --noUncheckedIndexedAccess --allowImportingTsExtensions --moduleResolution bundler --module preserve --target es2022 --lib es2022 /tmp/.../ok-runtime/typecheck3.ts` → `tsc exit=0`, asserting `Equal<typeof mapped, Ok<Transition, string>>`, `Extract<typeof mapped, Pending<unknown, unknown>> === never`, and that `const t: Transition = mapped.unwrap()` compiles. Note `mapped.unwrap()` at runtime evaluated `this.promise.then(r => r.unwrap())` i.e. `Transition.then(fn)`, producing `Transition { state: [Function] }` — a fabricated object, not the mapped value.

</details>

**Recommendation.** Stop treating structural thenability as the async signal in `map`/`mapErr`/`Result.try`. Either (a) narrow `isThenable` to `value instanceof Promise || value instanceof Pending || Promise.resolve(value) === value`-style checks plus an explicit opt-in for foreign thenables, or (b) keep structural detection but make the type-level test match it exactly — e.g. dispatch on `"then" extends keyof U ? U["then"] extends (...args: never[]) => unknown ? Pending<...> : Ok<U, E> : Ok<U, E>` — so the compiler predicts the same branch the runtime takes. At minimum, normalise with `Promise.resolve(result)` before `.then()` so the object is adopted by the promise machinery instead of being called directly (this also fixes ok-2).

**Verifier note.** Reproduced exactly. `bun h-then-hijack.ts` → `runtime constructor => Pending`, `mapped.isOk() => false`, `.value => undefined`, `mapped.unwrap() => Transition { state: [Function], then: [Function] }`. Type side: typecheck3.ts passes at exit 0 (with --ignoreConfig, otherwise TS5112) asserting `Equal<typeof mapped, Ok<Transition,string>>` and `Extract<typeof mapped, Pending<...>> === never`. Root cause matches source: ok.ts:48 dispatches on `isThenable` (utils.ts:5, `typeof value.then === "function"`) while ok.ts:43 dispatches on `U extends PromiseLike<infer A>`; the two predicates genuinely disagree for any object carrying a non-PromiseLike `then` method. Compiler-proven `Ok` that is a `Pending` at runtime is unsound; critical is calibrated.

---

### `err-runtime/err-1` — Err.mapErr duck-types any object with a `then` method into a Pending, while the static type still says Err

**Severity:** critical · **Category:** correctness · **Verifier verdict:** confirmed

**Claim.** `Err.mapErr` decides sync-vs-async with `isThenable()`, which only checks `typeof value.then === "function"`. Any error payload that merely *has* a `then` method (a builder/DSL object, a mock, a chainable domain type) is assimilated: the method returns a `Pending` at runtime, but the overload that TypeScript selects returns `Err<T, F>` because the payload is not assignable to `PromiseLike`. The resulting object statically claims to be an `Err` while `isErr()` is `false`, `.error` is `undefined`, the library's internal callbacks get passed into the user's `then` method as ordinary arguments, and awaiting the value never settles.

<details><summary><strong>Empirical evidence</strong></summary>

Static type, via `bun x tsc --ignoreConfig --declaration --emitDeclarationOnly ... ./08-thenable-lie-types.ts` (exit 0 — both `@ts-expect-error` markers were consumed), emitted .d.ts:
```
declare class Step { readonly name: string; constructor(name: string); then(next: string): Step; }
export declare const wrapped: Err<number, Step>;
export declare const theError: Step;
export declare const stillErr: boolean;
```
Runtime, `bun /…/err-runtime/07-thenable-lie.ts`:
```
N1 static type says Err; actual constructor is: Pending
N2 is it really an Err? false
N3 unwrapErr() returned: Step { name: "retry->(error) => new Err(error)->(result) => result.unwrapErr()", then: [Function: then] }
N4 wrapped.error = undefined
N5 wrapped.isErr() = false  <- type-level guarantee violated
N6 wrapped.isPending() = true
N7 awaiting the (supposedly Err) value: TIMEOUT - never settles
```
A degenerate thenable whose `then` returns `undefined` is worse still — `bun /…/01-ctor-identity.ts`:
```
C7 mapErr custom thenable -> Pending | .promise = undefined
C7b settle() on that Pending THREW: undefined is not an object (evaluating 'p2.settle().then')
C7c unwrapErr() on that Pending THREW: undefined is not an object (evaluating 'this.promise.then')
```
(`{ then: 42 }` is correctly *not* assimilated: `C11 {then:42} ->  Err`.)

</details>

**Recommendation.** Stop trusting the duck-type on a value the user handed you as *data*. Two complementary fixes: (a) never call the foreign `then` directly — use `Promise.resolve(result).then(...)` so a malformed thenable can never produce a `Pending` with an `undefined`/never-settling inner promise; (b) far better, drop implicit thenable assimilation from `mapErr`/`map` entirely and make the async path explicit (`mapErrAsync`, or require the callback to return a `Pending`/`Result`). Implicit assimilation makes the return type depend on a *runtime* property of user data, which the type system cannot see. If assimilation is kept, the overload set must be `fn: (error: E) => F` ⇒ `Err<T, F> | Pending<T, Awaited<F>>` for every non-`PromiseLike` `F` that could structurally carry `then`, so the type stops lying.

**Verifier note.** Reproduced exactly. `bun 07-thenable-lie.ts` prints `N1 ... actual constructor is: Pending`, `N2 is it really an Err? false`, `N4 wrapped.error = undefined`, `N5 wrapped.isErr() = false`, `N7 ... TIMEOUT - never settles`. Emitted .d.ts (tsc --declaration, exit 0 with both @ts-expect-error markers consumed) says `export declare const wrapped: Err<number, Step>` and `export declare const theName: string` — so `wrapped.unwrapErr().name` type-checks against a value that is a Pending. Source confirms the mechanism: err.ts:44-49 branches on `isThenable()` (utils.ts:1-7, a bare `typeof value.then === "function"` duck-type) while overload err.ts:41 returns `Err<T, F>` for any F not assignable to PromiseLike. Degenerate-thenable case also reproduces (`C7 mapErr custom thenable -> Pending | .promise = undefined`, `C7b/C7c` throw `undefined is not an object`), and `C11 {then:42} ->  Err` as stated. Genuinely unsound (static type contradicted by runtime class), so critical is calibrated.

---

### `constructors/ok-2` — E is an unchecked assertion: contextual inference fabricates a rich error type with no cast, no annotation and no runtime evidence

**Severity:** critical · **Category:** type-safety · **Verifier verdict:** confirmed

**Claim.** `resultTry` implements the catch clause as `return new Err(e as E)` and `fromPromise` as `(err) => new Err(err)`. Neither factory has any way to learn what was actually thrown, so `E` is pure assertion. Worse, because `E` is only reachable through the return type, TypeScript's contextual typing silently fills it in from the declaring function's return annotation — the user writes no type argument and no cast, yet gets a fully-typed custom error class back. The library's own reference docs teach this exact pattern (`Result.try<number, SyntaxError>(() => JSON.parse("42"))`), and the docs describe it as `E` being "narrowed at the call site", which is not narrowing — it is an unchecked downcast. With `E = never` the type even claims the operation is infallible while it demonstrably fails, and `unwrapErr(): never` is then assignable to any type at all.

<details><summary><strong>Empirical evidence</strong></summary>

/tmp/.../factories/silent-lie.ts contains `function parseConfig(json: string): Settled<{ port: number }, ParseError> { return Result.try(() => JSON.parse(json)); }` — zero type arguments, zero casts. `bun x tsc --noEmit --ignoreConfig --strict --exactOptionalPropertyTypes --noUncheckedIndexedAccess --allowImportingTsExtensions --moduleResolution bundler --module preserve --target es2022 --lib es2022,dom .../silent-lie.ts` → `TSC EXIT=0` (no diagnostics). `bun .../silent-lie.ts` printed:
```
1a static type says Settled<{port:number}, ParseError>; runtime ctor = Err
1b e.kind (typed 'parse') = undefined
1c e.offset (typed number) = undefined
1d actual class = SyntaxError
1e fell through to default despite E being a single-member union
1f ok.value.port typed number, actual = undefined undefined
```
`bun .../runtime2.ts`: `E2 using it as MyError at runtime => THREW TypeError: undefined is not an object (evaluating 'err.message.toUpperCase')`; `E3 same lie via fromPromise => typeof=string, err.code=undefined`. typecheck.ts (exit 0) also compiles `const lie2 = Result.fromPromise<number, never>(Promise.reject(new Error("boom")))` and then `const impossible: { totally: "bogus" } = settled.unwrapErr();`.

</details>

**Recommendation.** Stop letting `E` be inferred from nothing. Follow neverthrow's `fromThrowable(fn, errorFn)` shape: require a mapper that produces `E` from the caught `unknown`, so `E` is *derived* rather than asserted — `Result.try<T, E>(fn: () => T, mapErr: (cause: unknown) => E): Settled<T, E>`, and the same second parameter on `fromPromise`. Keep a mapper-less form but hard-pin its error type to `unknown` (e.g. a non-generic `E = unknown` signature, or an `ErrorOf<unknown>` brand) so `Result.try(...)` can never be contextually widened into `SyntaxError` / `never`. At minimum, fix the reference docs to stop demonstrating `Result.try<number, SyntaxError>(...)` as the recommended way to type errors, and prefer the `.mapErr` + `instanceof` narrowing pattern the how-to already shows.

**Verifier note.** Verified against source: `resultTry` catch is `return new Err(e as E)` and `fromPromise` is `(err) => new Err(err)` — neither has any inference site for E, so E is resolved purely from contextual return type. silent-lie.ts recompiles at exit 0 with zero type arguments and zero casts (`function parseConfig(json: string): Settled<{port:number}, ParseError> { return Result.try(() => JSON.parse(json)); }`), and running it printed exactly the claimed output: runtime ctor Err, `e.kind` undefined, `e.offset` undefined, actual class SyntaxError, exhaustive switch falls to default. typecheck.ts exit 0 confirms `Result.fromPromise<number, never>(Promise.reject(...))` compiles and `const impossible: { totally: "bogus" } = settled.unwrapErr()` is accepted. Docs claim verified verbatim in apps/docs/docs/reference/antithrow/result.md: `const sync = Result.try<number, SyntaxError>(() => JSON.parse("42"));` plus 'The error type `E` defaults to `unknown` and is narrowed at the call site' — both halves of that sentence are wrong (E has no default, and this is an unchecked downcast, not narrowing). Critical is right: this is a zero-cast, zero-diagnostic soundness hole in the library's primary entry point, actively taught by the reference docs.

---

### `constructors/ok-3` — isThenable's duck-test silently upgrades ordinary values to Pending, so the sync overload's Settled<T,E> is unsound — both isOk() and isErr() return false, and awaiting can hang forever

**Severity:** critical · **Category:** correctness · **Verifier verdict:** confirmed

**Claim.** `isThenable` accepts any non-null object *or function* with a callable `then` property. The `NonThenable<T>` overload guard, by contrast, is a purely structural TS check (`Extract<T, PromiseLike<unknown>>`) that requires `then` to have a promise-compatible *signature*. The two disagree, so a value that TypeScript classifies as non-thenable is classified as thenable at runtime. Result: `Result.try` is statically typed `Settled<T, E>` (documented as "Ok | Err", never Pending) yet returns a `Pending`, so the canonical exhaustive `if (r.isOk()) … else …` takes the *else* branch and reads `undefined`. Affected real-world values: a callable API client with a `.then` helper; any class with a domain method named `then` (fluent DSLs — `pipeline.then(step)`); a `Proxy` (RPC clients) whose get-trap returns a function for every key; and — most commonly — any value the caller only knows as `unknown`/`object` that happens to hold a promise. When the impostor `then` never invokes its callback (the fluent-DSL case) the resulting `Pending` never settles and `await` hangs forever.

<details><summary><strong>Empirical evidence</strong></summary>

`bun .../runtime3.ts` printed:
```
C3 fluent workflow object with then() -> HANG check (300ms) => ctor=Pending; await -> <<TIMED OUT / HUNG>>
C4 callable client w/ .then -> HANG check (300ms) => THREW TypeError: this.promise.then is not a function.
C5 class instance with a domain method named then => ctor=Pending (expected Ok<Pipeline>)
G7 Proxy (e.g. rpc client) treated as thenable => ctor=Pending
```
`bun .../runtime2.ts`: `D4 Object.create(null) with then => ctor=Pending`.
Type-level proof of the disagreement — typecheck.ts (tsc exit 0) asserts `Expect<Equal<typeof c1, Settled<Chainable, unknown>>>` for `Result.try(() => client)` where `type Chainable = { (x: number): number; then(cb: (v: number) => void): string }`; `bun .../silent-lie.ts` then printed for that same expression:
```
2a static Settled<Chainable, unknown>; runtime ctor = Pending
2b c.isOk() = false  c.isErr() = false   <- BOTH false
2c err branch reached; c.error typed unknown, actual = undefined
2d c.unwrap() THREW TypeError: this.promise.then is not a function.
```
The `unknown` variant, unknown-thenable.ts, typechecks clean (`TSC EXIT=0`, asserting `Equal<typeof r, Settled<unknown, unknown>>`) and prints:
```
plain value cached -> Ok
promise cached     -> Pending (static type said Ok|Err)
  isOk() false  isErr() false -> neither branch of the exhaustive check fires
  exhaustive if/else produced: undefined
```

</details>

**Recommendation.** Two changes. (1) Make the runtime test stricter than "has a callable then" is impossible in general, so instead make the *type* side honest: drop the `NonThenable<T>` sync overload's promise that the result is `Settled` for any `T` that TypeScript cannot prove non-thenable (`unknown`, `object`, `any`, and interfaces carrying an incompatible `then`), returning `Result<T,E>` for those. (2) Restrict `isThenable` to `typeof value === "object"` (dropping `"function"`), which removes the callable-client false positive at no cost — real thenables are objects — and document that a value with a non-promise `then` method must be wrapped (e.g. `Result.try(() => ({ value: dsl }))`). Also consider exporting an explicit escape hatch such as `Result.okOf(value)` that never inspects the value.

**Verifier note.** Source confirms the disagreement precisely: utils.ts `isThenable` = non-null && (object||function) && typeof .then === 'function'; types.ts `NonThenable<T> = Extract<T, PromiseLike<unknown>> extends never ? T : never` (a structural signature check). Both repro files still behave as claimed — unknown-thenable.ts typechecks at exit 0 asserting `Equal<typeof r, Settled<unknown, unknown>>` and prints `promise cached -> Pending (static type said Ok|Err) / isOk() false isErr() false / exhaustive if/else produced: undefined`; silent-lie.ts case 2 prints `runtime ctor = Pending`, `c.isOk() = false c.isErr() = false`, `c.unwrap() THREW TypeError: this.promise.then is not a function` — and that call site (`Result.try(() => client)` with `client: Chainable`) carries no cast, with typecheck.ts asserting `Equal<typeof c1, Settled<Chainable, unknown>>` at exit 0. Hang confirmed (C3 timed out at 300ms), Proxy confirmed (G7), Object.create(null) confirmed (D4). The `unknown` cache case is the damning one and is entirely ordinary code. Critical is correctly calibrated: the declared Settled<T,E> is violated with no cast, both discriminants return false so neither branch of the canonical exhaustive check fires, and the value is silently undefined.

---

### `types-overloads/ok-1` — Ok.map / Ok.mapErr type-lie: a callback whose declared return type is a supertype of Promise (object, unknown, {}) yields a value statically typed Ok/Err that is actually a Pending at runtime

**Severity:** critical · **Category:** correctness · **Verifier verdict:** confirmed

**Claim.** `Ok.map`'s overload `map<U>(fn: (value: T) => U): U extends PromiseLike<infer A> ? Pending<A, E> : Ok<U, E>` decides Ok-vs-Pending from the callback's *declared* type, while the implementation decides from a runtime `isThenable()` check. When `U` is a supertype of `PromiseLike` but does not itself extend it — `object`, `unknown`, `{}`, an interface, a `Map` value type — the conditional takes the false branch and the expression is typed `Ok<U,E>` even though the implementation returns a `Pending`. `.value` is then statically available and is `undefined`; `isOk()` is `false`; `unwrap()` returns a `Promise` while typed `object`. The identical hole exists in `Err.mapErr` (`F extends PromiseLike<infer A> ? Pending<T,A> : Err<T,F>`) and in `Result.try`'s `NonThenable<T>` overload. The worst form: on `Settled<T,E>` (which has no `Pending` member) a statically *exhaustive* `if (isOk()) {...} else {...}` silently takes the `else` branch and reads `.error` as `undefined`.

<details><summary><strong>Empirical evidence</strong></summary>

unsound.ts type-checks CLEAN and diverges at runtime.
$ cd /tmp/claude-0/-home-user-antithrow/6fa15e49-ae6b-5bd4-b03a-8a3385b537f3/scratchpad/type-overloads && ./run-tsc.sh unsound.ts; echo exit=$?
  exit=0        # `const v: object = r.value;` compiles with no narrowing under --strict
$ bun unsound.ts
  declared: Ok<object,string>   runtime: Pending
  r.value    -> undefined
  r.isOk()   -> false
  r.unwrap() -> Promise { <pending> }
  unknown callback -> runtime: Pending value: undefined
  settled to Ok

The exhaustive-narrowing form (unsound2.ts, `Result.try(() => 5).map((x): object => Promise.resolve({x}))`):
$ ./run-tsc.sh unsound2.ts; echo exit=$?
  exit=0
$ bun unsound2.ts
  [1] took the Err branch, error = undefined
  [1] actual runtime class: Pending
  [2] declared Err<number,object>; runtime: Pending error = undefined

</details>

**Recommendation.** The conditional must be "could a PromiseLike inhabit U?", not "does U extend PromiseLike?". Add a third arm that keeps the `Pending` possibility whenever `[PromiseLike<unknown>] extends [U]`. Prototyped and type-checked in fixproto2.ts:

  type MaybeThenable<U> = [PromiseLike<unknown>] extends [U] ? true : false;
  type MapOk<U, E> =
    | (Exclude<U, PromiseLike<unknown>> extends never ? never : Ok<Exclude<U, PromiseLike<unknown>>, E>)
    | (Extract<U, PromiseLike<unknown>> extends never ? never : Pending<Awaited<Extract<U, PromiseLike<unknown>>>, E>)
    | (MaybeThenable<U> extends true ? Pending<Awaited<U>, E> : never);

With this, `map((x): object => ...)` is no longer assignable to `Ok<object,string>` (verified by a firing `@ts-expect-error` in fixproto2.ts, tsc exit 0), while `map(x => x*2)` stays exactly `Ok<number,string>` and `map(async ...)` stays exactly `Pending<number,string>`. Apply the same shape to `Err.mapErr` and `Result.try`. If that is judged too clever, the honest fallback is to drop the conditional overload entirely and always return `Ok<U,E> | Pending<Awaited<U>, E>` for a non-`PromiseLike`-annotated callback — which is what overload 3 already says.

**Verifier note.** Reproduced exactly. run-tsc.sh unsound.ts => exit=0 (clean under --strict), bun unsound.ts => 'declared: Ok<object,string> runtime: Pending / r.value -> undefined / r.isOk() -> false / r.unwrap() -> Promise { <pending> }'. unsound2.ts likewise: exit=0 and '[1] took the Err branch, error = undefined; [1] actual runtime class: Pending' plus '[2] declared Err<number,object>; runtime: Pending error = undefined'. Source matches the claim: ok.ts:43 `map<U>(fn:(value:T)=>U): U extends PromiseLike<infer A> ? Pending<A,E> : Ok<U,E>` and err.ts:41 the mirror, while ok.ts:48/err.ts:45 branch on the runtime isThenable(). I independently confirmed the Result.try arm too (result.ts:33 NonThenable overload): `Result.try<object,string>(() => Promise.resolve({a:1}) as object)` type-checks as Settled<object,string> yet at runtime is a Pending with isOk()===false AND isErr()===false — a statically exhaustive if/else falls through entirely. Severity critical is right: silently wrong values with no diagnostic. One minor overstatement in the claim: 'an interface' is generally NOT a hole — a Promise is not assignable to an ordinary named interface (verified: `const bad = (): Cfg => Promise.resolve({id:1})` errors). The reachable inhabitants are object/unknown/{}/any and unions containing them, which is enough. fixproto2.ts compiles clean (exit=0), so the proposed fix is viable.

---

### `types-guards-variance/gv-1` — Covariant `out T` + `flatten()`'s conditional return type is unsound: `Ok<object|unknown, E>.flatten()` is statically an `Ok` but returns an `Err`/`Pending` at runtime

**Severity:** critical · **Category:** type-safety · **Verifier verdict:** adjusted

**Claim.** `FlattenOk<T, E>` decides its result by pattern-matching `T` against `Ok`/`Err`/`Pending`. Because `T` is declared covariant (`out T`) and TypeScript relates two instantiations of `Ok` through the variance fast path rather than by comparing members, `Ok<Err<never,string>, never>` is assignable to `Ok<object, never>` / `Ok<unknown, never>` — but `FlattenOk<object, E>` collapses to `Ok<object, E>` while `Ok#flatten()` still returns `this.value` (the inner `Err`) at runtime. The result is a value statically typed `Ok<...>` whose `.isOk()` returns `false` and whose `.value` is `undefined`. Via `Pending` the lie escalates to a value of static type `never` holding a string. No `ts(2636)` is emitted for the `out T` annotation, so tsc's variance verification never sees the violation — its structural variance measurement is blind to conditional return types.

<details><summary><strong>Empirical evidence</strong></summary>

Command: `cd /home/user/antithrow && bun x tsc --ignoreConfig --noEmit --strict --allowImportingTsExtensions --moduleResolution bundler --module preserve --target es2022 --lib es2022 <file>` then `bun <file>`.

05-flatten-variance-exploit.ts — tsc exit 0 (zero errors), runtime:
```
static type of f says: Ok<object, never>
f instanceof Ok  = false
f instanceof Err = true
f.isOk()         = false
f.value          = undefined
(f as any).error = boom
--- via Result union ---
g isOk = false instanceof Err = true
--- via unknown ---
h.isOk() = false h.value = undefined
```

07-flatten-direct.ts shows the same hole with NO variance widening at all (`new Ok<object, never>(new Err(...))`) — tsc exit 0, runtime:
```
[direct object] isOk = false | instanceof Err = true | .value = undefined
[direct unknown] isOk = false | .value = undefined
[pending] settled.isErr() = true
[pending] settled.error typed as never, actual = boom3
```
That last line is `const e: never = settled.error;` — a binding statically typed `never` that holds `"boom3"` at runtime.

18-fastpath-proof.ts (tsc exit 0) proves the assignment is granted by variance, not by member comparison: the extracted return types are mutually incompatible (`// @ts-expect-error Err<never, string> is not assignable to Ok<object, never>` fires) while `const tgt: Ok<object, never> = src;` is accepted.

17-variance-verified.ts (tsc exit 2) confirms tsc *does* verify `out` in general — `error TS2636: Type 'Sink<sub-T>' is not assignable to type 'Sink<super-T>' as implied by variance annotation.` — yet 06-annotation-is-the-cause.ts (tsc exit 0) shows no TS2636 for a class whose only T-dependent member is a conditional-typed `flatten()`, with or without the annotation.

</details>

**Recommendation.** `flatten()` cannot keep a precise conditional return type while `T` is covariant. Either (a) drop the conditional and give `flatten()` an honest widened return — `Result<InferOk<T & Result<unknown,unknown>> | Exclude<T, Result<unknown,unknown>>, E | ...>` reduced to `Result<unknown, unknown>` at worst — so the static type can never claim `Ok` for a value that may be `Err`; or (b) constrain `flatten()` to only exist when `T` is statically known to be a `Result` (`flatten(this: Ok<Result<infer U, infer F>, E>): ...`), making `Ok<unknown, E>.flatten()` a compile error instead of a lie; or (c) make the `FlattenOk` fallback branch return `Result<T, E>` rather than `Ok<T, E>` whenever `T` is not provably non-Result (i.e. treat `unknown`/`object`/any supertype-of-Result as the union case). (a) or (b) are breaking but restore soundness on a core path.

**Verifier note.** The defect is real and reproduces byte-for-byte (I re-ran 05 and 07 under tsc --ignoreConfig --strict: exit 0, and bun printed exactly the claimed output, including `const e: never = settled.error` holding "boom3"). Severity critical is right: `Ok#flatten()` returns `this.value` whenever it is `instanceof Ok/Err/Pending` (ok.ts:100-107), while `FlattenOk<T,E>` (types.ts:74-83) falls back to `Ok<T,E>` for any `T` that is not *statically* a Result. What is imprecise is the causal story in the title/claim. `out T` is NOT the cause: I re-ran the auditor's 06 and wrote my own minimal variant (only `flatten()` mentions T, `out` removed) — tsc accepts `OkB<Err<never,string>,never>` -> `OkB<object,never>` with exit 0 either way, so deleting the variance annotation would not close the hole. And the auditor's own 07 shows the lie with zero widening (`new Ok<object, never>(new Err(...))`). The correct statement: any `T` that is a non-Result supertype of a Result (`unknown`, `object`, `{}`) makes `FlattenOk` pick the `Ok<T,E>` branch while the runtime returns the inner `Err`/`Pending`. Recommendation (c) is the accurate fix; the variance framing in (a)/(b) is a distraction.

---

### `flatten/ok-1` — All three Flatten* types collapse to `never` when T is `never` — which is the default T of `new Err(x)` — erasing the Err branch from flattened unions

**Severity:** critical · **Category:** correctness · **Verifier verdict:** confirmed

**Claim.** `FlattenOk`, `FlattenErr` and `FlattenPending` (types.ts:75-97) are distributive conditional types over a naked `T`. Distribution over `never` yields `never`. Because `Err` is declared `class Err<out T = never, out E = unknown>` (err.ts:18), the extremely common `new Err("boom")` has type `Err<never, string>`, so `new Err("boom").flatten()` is statically `never` while returning an `Err` instance at runtime. Two consequences: (1) `never` is assignable to every type, so the return value launders into any annotation; (2) in a union — the normal shape of a function that returns nested results — the entire failure branch disappears from the flattened type, leaving a value statically typed `Ok<number, never>` that is an `Err` at runtime. `Ok<never,E>` and `Pending<never,E>` are affected identically. Confirmed against both src and the published dist .d.ts.

<details><summary><strong>Empirical evidence</strong></summary>

tsc probe (reveal3.ts): `const b2: "FLATTEN_OF_NEW_ERR" = reveal(new Err("boom").flatten())` produced NO error — i.e. the type is `never`. Same for `Ok<never,string>.flatten()` and `Pending<never,string>.flatten()` (lines 21/22, no errors), and for `const anything: { totallyUnrelated: symbol } = new Err("boom").flatten()` and `const anything2: number = new Err("boom").flatten()` (lines 25/26, no errors). The union case did error, revealing the erasure:
  reveal3.ts(14,7): error TS2322: Type 'Err<never, string> | Ok<Ok<number, never>, never>' is not assignable to type '"UNION_BEFORE"'.
  reveal3.ts(15,7): error TS2322: Type 'Ok<number, never>' is not assignable to type '"UNION_AFTER_FLATTEN"'.
Identical results against the published dist .d.ts (reveal5_dist.ts): only lines 11 and 21 errored; the `new Err("boom").flatten()`, `Ok<never,…>`, `Pending<never,…>` and `{ totallyUnrelated: symbol }` lines all compiled silently.
Runtime (`bun runtime2.ts`, which itself typechecks clean under --strict):
  A ctor: Err
  A .value (typed `number`): undefined
  A .unwrap() THREW: UnwrapError: Called unwrap() on an Err value
  A arithmetic on typed-number value: NaN
  A2 `const n: number = new Err('boom').flatten()` -> Err
  A2 asNumber.toFixed exists? undefined
The source of `A` is cast-free: `const step = (n: number) => (n > 0 ? new Ok(new Ok(n)) : new Err("negative")); const flat = step(-1).flatten();` — `flat` is inferred `Ok<number, never>`.
Why the suite missed it: every existing flatten test explicitly annotates T (e.g. err.test.ts:300 `new Err<Ok<number, boolean> | Err<number, boolean>, string>("failed")`), so `T = never` is never exercised.

</details>

**Recommendation.** Defeat distribution and handle the empty case explicitly in all three types, e.g. `export type FlattenErr<T, E> = [T] extends [never] ? Err<never, E> : T extends Result<infer U, infer F> ? Err<U, E | F> : Err<T, E>;` and the analogous `[T] extends [never] ? Ok<never, E> : …` / `? Pending<never, E> : …` guards for `FlattenOk`/`FlattenPending`. Better still, adopt the legacy design (see ok-6): a `this`-constrained `flatten<U, F>(this: Result<Result<U, F>, E>): Result<U, E | F>` cannot produce `never` at all, and additionally makes `flatten()` on a non-nested result a compile error. Add regression tests that call `.flatten()` on an unannotated `new Err("x")` and on `cond ? new Ok(new Ok(1)) : new Err("e")`.

**Verifier note.** Reproduced exactly. reveal3.ts lines 9/20/21/24/25 produce NO tsc diagnostic (so the types are `never`), while line 15 errors with `Ok<number, never>` — the Err branch of `cond ? new Ok(new Ok(1)) : new Err("boom")` is erased. Same against dist (reveal5_dist.ts: only lines 11 and 21 error). Root cause verified in source: types.ts:75/89/96 are naked distributive conditionals and err.ts:18 declares `class Err<out T = never, out E = unknown>`. Runtime confirms the unsoundness with a cast-free source: `bun runtime2.ts` → `A ctor: Err`, `A .value (typed number): undefined`, `A .unwrap() THREW: UnwrapError`, `A arithmetic: NaN`, and `const asNumber: number = new Err('boom').flatten()` yields an Err whose `.toFixed` is undefined; runtime2.ts typechecks clean under the strict flag set. Also confirmed why the suite misses it: every flatten test annotates T explicitly (result.test.ts:560 `ok<Result<number, boolean>, string>(...)`, err.test.ts:300, ok.test.ts:320ff). critical is correct — silently wrong static types plus `never` laundering into any annotation.

---

### `flatten/ok-2` — Ok.flatten() dispatches nominally (instanceof) but FlattenOk decides structurally on the static T — for wide T (`unknown`, `object`) the type says `Ok` while runtime returns the inner `Err`/`Pending`

**Severity:** critical · **Category:** correctness · **Verifier verdict:** confirmed

**Claim.** `Ok.flatten()` (ok.ts:102-109) unwraps whenever `this.value instanceof Ok | Err | Pending`, i.e. based on the *runtime* value. `FlattenOk<T, E>` (types.ts:75-82) decides based on the *static* `T`. When `T` is a supertype that does not match any of the three `extends` clauses — `unknown`, `object`, `{}` — the type falls through to `Ok<T, E>` while the runtime still unwraps. The result is a value statically typed `Ok<…>` whose runtime class is `Err` or `Pending`: `isOk()` returns `false` on something the checker asserts is an `Ok`, `.value` is `undefined`, and `.unwrap()` — declared `unwrap(): T` on `Ok` and documented in base.ts:186-193 as returning the value — throws `UnwrapError`. This is reachable with zero casts through the ordinary `Result<unknown, E>` + `isOk()` narrowing pattern.

<details><summary><strong>Empirical evidence</strong></summary>

tsc probe (reveal2.ts, TS 6.0.3): `reveal2.ts(20,7): error TS2322: Type 'Ok<unknown, string>' is not assignable to type '"R2"'.` — i.e. `Ok<unknown,string>.flatten()` is typed `Ok<unknown, string>`. Same against the published dist types: `reveal5_dist.ts(21,7): error TS2322: Type 'Ok<unknown, string>' is not assignable to type '"OK_UNKNOWN_DIST"'.`
Cast-free runtime repro (`bun runtime3.ts`; the whole file typechecks clean under --strict --exactOptionalPropertyTypes --noUncheckedIndexedAccess):
```ts
function readCache(key: string, cache: Map<string, unknown>): Result<unknown, "miss"> {
  const v = cache.get(key);
  return v === undefined ? new Err("miss") : new Ok(v);
}
cache.set("a", new Err<never, "inner-failure">("inner-failure"));
const r = readCache("a", cache);
if (r.isOk()) { const flat = r.flatten(); /* static: Ok<unknown, "miss"> */ }
```
Observed output:
  1 static Ok<unknown,'miss'> -> runtime ctor: Err
  1 flat.isOk(): false
  1 flat.value: undefined
  1 flat.unwrap() THREW: UnwrapError: Called unwrap() on an Err value
And with a Pending inside an `Ok<object, string>` (`bun runtime1.ts`, case 9b):
  9b static Ok<object,string>; runtime ctor => Pending
  9b isOk() => false
  9b unwrap() => Promise { <pending> }
— `.unwrap()` is statically `object` (synchronous) but returns a Promise.

</details>

**Recommendation.** Make the runtime agree with the static decision instead of second-guessing it. Either (a) constrain the method so it is only callable when `T` is statically known to be a `Result` (`flatten<U, F>(this: Ok<Result<U, F>, E>): Result<U, E | F>`, as legacy does — then the body is just `return this.value` with no instanceof at all), or (b) keep the current shape but add a catch-all so wide `T` is honest: make `FlattenOk<T, E>` return `Result<unknown, E | unknown>` (or `Ok<T,E> | Err<unknown, E|unknown> | Pending<unknown, E|unknown>`) whenever `unknown extends T`, so `unknown`/`object`/`{}` payloads produce a union the caller must narrow. Option (a) is strictly better and also fixes ok-1 and ok-9.

**Verifier note.** Reproduced. tsc: `reveal2.ts(20,7): Type 'Ok<unknown, string>' …` and `reveal5_dist.ts(21,7): Type 'Ok<unknown, string>' …` — wide T falls through FlattenOk's three `extends` arms to `Ok<T,E>` while ok.ts:103 dispatches on `this.value instanceof Ok|Err|Pending`. runtime3.ts (typechecks clean, no casts on the path: `Result<unknown,"miss">` + `isOk()` narrowing) prints `1 runtime ctor: Err`, `1 flat.isOk(): false`, `1 flat.value: undefined`, `1 flat.unwrap() THREW: UnwrapError`. runtime1.ts case 9b prints `9b runtime ctor => Pending`, `9b isOk() => false`, `9b unwrap() => Promise { <pending> }` where `unwrap()` is statically synchronous `object`. base.ts:186-193 does document unwrap as returning the value on Ok. critical is correct.

---

### `api-completeness/ok-1` — `Result.try` / `Result.fromPromise` have no error-mapper parameter, so the declared error type is a free variable that silently lies

**Severity:** critical · **Category:** correctness · **Verifier verdict:** confirmed

**Claim.** Every prior-art library requires an error-mapping function at the throw/reject boundary precisely because the caught value is untyped: neverthrow's `Result.fromThrowable(fn, errorFn)` and `ResultAsync.fromPromise(p, errorFn)` (mapper mandatory), Effect's `Effect.tryPromise({ try, catch })`, ts-results-es's `Result.wrap` returning `Result<T, unknown>`. antithrow provides no mapper overload anywhere. `resultTry` does `new Err(e as E)` and `fromPromise` does `(err) => new Err(err)`, with `E` a free type parameter. A caller can therefore claim any error type — explicitly OR by contextual annotation, which is the common real-world form — with zero friction from the compiler, and downstream discriminated-union handling then crashes at runtime.

<details><summary><strong>Empirical evidence</strong></summary>

Ran `bun x tsc --noEmit --ignoreConfig --strict --exactOptionalPropertyTypes --noUncheckedIndexedAccess --allowImportingTsExtensions --moduleResolution bundler --module preserve --target es2022 --lib es2022,dom 13-error-mapper.ts` → `TSC EXIT=0` (all three forms typecheck with no cast and no error). Then `bun 13-error-mapper.ts`:
```
[1] declared ParseError, actually: SyntaxError | instanceof ParseError: false | ._tag: undefined
[2] contextual ParseError, actually: SyntaxError | instanceof ParseError: false
[3] fromPromise declared ParseError, actually: TypeError
[!] downstream `error._tag.toUpperCase()` -> undefined is not an object (evaluating 'e1._tag.toUpperCase')
```
The three call sites were `Result.try<unknown, ParseError>(() => JSON.parse("nope"))`, `const r2: Settled<unknown, ParseError> = Result.try(() => JSON.parse("nope"))` (contextual — no type arguments written at all), and `Result.fromPromise<number, ParseError>(Promise.reject(new TypeError("network")))`. Note the unannotated default is safe (`Result.try(() => JSON.parse("{}") as {a:number})` reveals as `Settled<{ a: number; }, unknown>`, per 14b.ts) — the hole is only reachable through annotation, but annotation is exactly what users do to get a typed error channel, which is the library's entire selling point.

</details>

**Recommendation.** Add mandatory-mapper overloads following neverthrow: `Result.try<T, E>(fn: () => T, mapErr: (e: unknown) => E): Settled<T, E>` and `Result.fromPromise<T, E>(p: PromiseLike<T>, mapErr: (e: unknown) => E): Pending<T, E>`. Then make the no-mapper overloads hard-pin the error channel to `unknown` so `E` can never be supplied positionally or contextually — e.g. by declaring them as `try<T>(fn: () => T): Settled<T, unknown>` with no `E` type parameter at all. Users who want a narrower type must go through `.mapErr()`, which is checked. This is a breaking change and worth it: today the type parameter is an unchecked assertion wearing the costume of a type annotation.

**Verifier note.** Reproduced exactly. `bun 13-error-mapper.ts` prints `[1] declared ParseError, actually: SyntaxError | instanceof ParseError: false`, `[3] ... actually: TypeError`, and the downstream `_tag.toUpperCase()` crash; tsc EXIT=0 with no cast at any of the three call sites. Source confirms the hole: result.ts `resultTry` does `return new Err(e as E)` and `fromPromise` does `(err) => new Err(err)`, with `E` appearing in no inference position in any of the three `resultTry` overloads or in `fromPromise<T,E>(promise: PromiseLike<T>)`. Severity critical is correct and if anything understated: apps/docs/docs/how-to/core/wrap-a-throwing-function.md actively teaches the unsound form — "`parsed` is `Result<unknown, unknown>`. Supply a type argument to narrow: `Result.try<unknown, SyntaxError>(() => JSON.parse(input))`" — and then contradicts itself two sections later with "`Result.try` catches anything, so `E` defaults to `unknown`. Use `.mapErr` when you know the shape." So the recommended path in the docs is an unchecked assertion wearing a type annotation. Not by-design-and-safe; unsound.

---

### `consumers/rc-1` — Two copies of `antithrow` in a dep tree silently break `flatten()`, corrupting values while types say otherwise

**Severity:** critical · **Category:** correctness · **Verifier verdict:** confirmed

**Claim.** `Ok.flatten()` (packages/antithrow/src/ok.ts:103) is the only nominal-identity-dependent operation in the core: it tests `this.value instanceof Ok || instanceof Err || instanceof Pending`. There is no brand/tag on the classes (grep for `Symbol.for`/`__brand`/`_tag` across packages/antithrow/src/*.ts returns nothing). Because `@antithrow/std`, `@antithrow/node` and `@antithrow/standard-schema` all declare `antithrow` as a *peerDependency* (`workspace:^` -> `^3.0.0` on publish), a nested/duplicated install is a realistic outcome. When it happens, `flatten()` silently returns the OUTER Ok instead of the inner result. No throw, no warning, and the declared type (`FlattenOk<T,E>` -> `Ok<{a:number}, SyntaxError>`) is a lie: `.value.a` is `undefined` at runtime while statically `number`.

<details><summary><strong>Empirical evidence</strong></summary>

Ran `bun /tmp/claude-0/-home-user-antithrow/6fa15e49-ae6b-5bd4-b03a-8a3385b537f3/scratchpad/real-consumer/01-cross-realm.ts` (source realm vs dist realm):
```
distinct constructors: true
okB instanceof OkA: false
flatten ctor name: Ok
flatten returned INNER (correct)? false
flatten .value is still an Ok? (double-wrapped bug): Ok
control same-realm flatten returned INNER? true
Result.do over cross-realm Ok: Ok 7      <- yield* protocol IS cross-realm safe
Result.do over cross-realm Err: Err boom
b.isOk(): true                            <- duck-typed methods ARE cross-realm safe
```
Realistic nested-peer simulation (`node_modules/antithrow` + `node_modules/@antithrow/std/node_modules/antithrow`), `bun /tmp/.../real-consumer/dual/app.ts`:
```
inner is app-realm Ok? false
flatten ctor: Ok
flatten gave the INNER result? false
flat.value: Ok { value: { a: 1 }, ... }   <- should have been { a: 1 }
flat.isOk(): true  flat.unwrap(): {"value":{"a":1}}
```
And it compiles clean: `tsc -p tsconfig.json` in `/tmp/.../real-consumer/dual` -> `TSC EXIT=0` for `typed.ts` where `export_a = flat.value.a` is typed `number`; `bun typed-run.ts` prints `flat.value.a = undefined (typed number)`.

</details>

**Recommendation.** Stop relying on `instanceof` for identity. Add a non-enumerable brand — e.g. `static readonly [Symbol.for("antithrow.result")]` plus an instance `readonly #kind`/`Symbol.toStringTag` — and replace the `instanceof` checks in `Ok.flatten` with a `Result.isResult(v)` predicate that reads the branded symbol. Export that predicate publicly (see rc-4: the eslint plugin is sniffing file paths for exactly the same reason). Also consider making the flatten path defensive: if the payload is result-shaped but not `instanceof`, still flatten rather than silently double-wrap.

**Verifier note.** Reproduced exactly. `grep -rn 'Symbol.for|__brand|_tag' packages/antithrow/src/*.ts` returns nothing (exit 1); `Ok.flatten` (ok.ts:103) is indeed the only nominal-identity check in the core (Err.flatten/Pending.flatten and Result.do use casts/structural Symbol.iterator; Result.try uses structural isThenable). 01-cross-realm.ts: `flatten returned INNER (correct)? false` / `flatten .value is still an Ok? Ok`. The realistic nested-peer fixture (node_modules/antithrow + node_modules/@antithrow/std/node_modules/antithrow) reproduces: `inner is app-realm Ok? false`, `flatten gave the INNER result? false`, `flat.value: Ok { value: { a: 1 } }`. All three sibling packages do declare `antithrow` as a peerDependency (std:48, node:54, standard-schema:50). Silently wrong value under a lying declared type = critical is calibrated.

---

### `probe-ts-compat-floor/ok-1` — SILENT: on TypeScript 4.7-5.3 with skipLibCheck (the default everywhere), Ok.mapOr loses its NoInfer guard, infers a wrong type, and writes that lie into the consumer's own .d.ts

**Severity:** critical · **Category:** correctness · **Verifier verdict:** unverified

**Claim.** dist/ok.d.ts uses the `NoInfer<T>` intrinsic, which only exists in lib.es5.d.ts from TypeScript 5.4. On 4.7-5.3 `NoInfer` is an unresolved name; with skipLibCheck:true the TS2304 that would report this is suppressed and `NoInfer<U>` silently degrades to the error type. The result is not just a missing error — the compiler infers a type that contradicts the runtime value, and then propagates that wrong type into the consumer's emitted declarations. `Result.try<number,string>(...).mapOr(0, v => String(v))` is inferred as `string` on TS 5.3 and emitted as `export declare const s: string;`, while at runtime the Err branch returns the number `0`. On TS 5.4+ the same call is correctly rejected. This is the only assertion in a 17-case negative suite that breaks below 5.4, so the failure is narrow but it is a genuine type-system lie, and the triggering config (skipLibCheck:true) is what `tsc --init` emits on 5.3/5.9/6.0.3, what @tsconfig/strictest and @tsconfig/node22 set, and what antithrow's own tutorial prescribes.

<details><summary><strong>Empirical evidence</strong></summary>

cd .../ts-compat-floor/consumer && ../compilers/node_modules/ts53/bin/tsc -p tsconfig.silent.json   (skipLibCheck:true, strict, bundler; file = cases/mapor.ts containing `new Ok<number,string>(1).mapOr("wrong-string", (v) => v)`)
  -> no output, exit 0
Same file, ts54:
  -> cases/mapor.ts(4,44): error TS2769: No overload matches this call.
       Overload 2 of 3, '(defaultValue: number, fn: (value: number) => number): number', gave the following error.
         Argument of type 'string' is not assignable to parameter of type 'number'.

Declaration-emit proof of the lie (cases/unsound-union.ts):
  ../compilers/node_modules/ts53/bin/tsc --declaration --emitDeclarationOnly --strict --skipLibCheck --target es2022 --module esnext --moduleResolution node --outDir <out> consumer/cases/unsound-union.ts
  -> exit 0, emitted:
       export declare function make(flag: boolean): import("antithrow").Settled<number, string>;
       export declare const s: string;
       export declare const okBranch: string;
  Same command on ts59/ts60 -> TS2769 on both lines, and (with the errors) s: 0 | PromiseLike<0>.

Runtime cross-check (.../ts-compat-floor/runtime-check.ts, `bun runtime-check.ts`):
  const r = Result.try<number,string>(() => { throw "boom"; });
  r.mapOr(0, v => String(v))
  -> value: 0 typeof: number      // declared `string` by TS 5.3

Negative-suite bisect (cases/negative.ts, 17 @ts-expect-error assertions):
  ts47 exit=2 :: cases/negative.ts(10,2): error TS2578: Unused '@ts-expect-error' directive.
  ts49 exit=2 :: same    ts50 exit=2 :: same    ts52 exit=2 :: same    ts53 exit=2 :: same
  ts54 exit=0    ts55 exit=0    ts56 exit=0    ts57 exit=0    ts58 exit=0    ts59 exit=0    ts60 exit=0
  (line 10 is exactly the Ok.mapOr assertion; all 16 other assertions hold on every compiler from 4.7 up.)

Why skipLibCheck:true is the realistic default:
  ts53/ts59/ts60 `tsc --init` all emit `"skipLibCheck": true`
  node_modules/@tsconfig/strictest/tsconfig.json:18:    "skipLibCheck": true
  node_modules/@tsconfig/node22/tsconfig.json:12:    "skipLibCheck": true,
  /home/user/antithrow/apps/docs/docs/tutorial/01-setup.md prescribes "skipLibCheck": true

</details>

**Recommendation.** Stop depending on the 5.4 intrinsic. Replace `NoInfer<U>` in packages/antithrow/src/ok.ts (lines 60-62) with a locally-defined, version-portable equivalent: `type NoInferCompat<T> = [T][T extends unknown ? 0 : never];`. I verified this preserves the exact behaviour (rejects the mismatched default, accepts all three good forms) identically on 4.7, 5.0, 5.3, 5.4 and 6.0.3 — see finding ok-8. That single change drops the semantic floor from 5.4 to 4.7 and eliminates the entire silent class. If you prefer to keep the intrinsic, then you must additionally declare the floor (ok-3) and gate it (ok-3 recommendation), because skipLibCheck:true turns the guard-rail off without telling anyone. Separately, add a CI job that type-checks a fixture consumer against the oldest supported compiler with skipLibCheck BOTH true and false — the repo's own tsconfig.json sets skipLibCheck:true and pins typescript 6.0.3, so nothing in CI can currently observe this class of regression.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-concurrency-cancellation/cc-1` — A poisoned Pending in an eager fan-out crashes the Node process; three of four realistic fan-out shapes exit 1

**Severity:** critical · **Category:** correctness · **Verifier verdict:** confirmed

**Claim.** Pendings start work eagerly on construction, and a callback that throws turns a Pending into a rejected promise with no handler attached. In the ordinary fan-out shapes — build the array of jobs, then bail early on a validation failure or `break` out of a fail-fast loop — the abandoned jobs' rejections become unhandled and, under Node's default `--unhandled-rejections=throw`, kill the process with exit code 1. The library's own `.map()` is the poison source: the throw happens inside `Pending.then`'s callback (pending.ts:53), so nothing at the call site can catch it. Adding `.settle()` does not help: `settle()` returns `this.promise` by identity (pending.ts:127) and subscribes nothing.

<details><summary><strong>Empirical evidence</strong></summary>

`cd /tmp/.../concurrency-cancellation && node 10-realistic-crash.mjs guard-before-await` (no handler installed, dist build):
```
  validation failed, returning early
  [exit 1]
TypeError: Cannot read properties of null (reading 'toUpperCase')
    at .../10-realistic-crash.mjs:12:26
    at Ok.map (file:///home/user/antithrow/packages/antithrow/dist/ok.js:31:24)
    at file:///home/user/antithrow/packages/antithrow/dist/pending.js:35:48
Node.js v22.22.2
  >> node exit: 1
```
Same exit 1 for `fail-fast-loop` and `fail-fast-loop-guarded` (the latter prints `early return on Err(auth) — the other 4 jobs are abandoned` and then dies). Only `promise-all-ok` survives (exit 0), because `Promise.all` happens to subscribe to every element. Confirmed identical for `node 03-unhandled.mjs created-never-awaited` (exit 1) and `orphan-branch` (exit 1) and `andthen-poison-dropped` (exit 1). With `INSTALL_HANDLER=1` those become `[unhandledRejection] POISON-X` + exit 0 — i.e. the crash is entirely at the mercy of whether the host installed a handler. `bun 11-retry-settle.ts` prints `p.settle() === p.promise : true`, confirming settle() adds no protection.

</details>

**Recommendation.** Stop letting a throw escape into the promise channel. Either (a) make `Pending`'s internal `.then` callbacks capture throws into `Err` (breaking, but it is the only way the three states behave consistently — see cc-5), or (b) attach a no-op rejection sink inside the `Pending` constructor (`promise.then(undefined, () => {})`) so an unobserved poison can never kill the process, while the observed path still rejects. Whichever is chosen, ship a `Result.all`/`Result.allSettled` that never lets a sibling's throw escape, since aggregation is where orphaning happens. At minimum, document that constructing a Result is eager and that abandoning one can terminate the process.

**Verifier note.** Reproduced exactly. `node 10-realistic-crash.mjs guard-before-await` -> `validation failed, returning early` then `TypeError: Cannot read properties of null (reading 'toUpperCase')` at `Ok.map` inside `pending.js:35` and `[exit 1]`; `fail-fast-loop` and `fail-fast-loop-guarded` also exit 1 (the latter after printing `early return on Err(auth) - the other 4 jobs are abandoned`); `promise-all-ok` exits 0. `03-unhandled.mjs` exits 1 for created-never-awaited, orphan-branch, andthen-poison-dropped and 0 for all-one-poison. Source confirms the mechanism: pending.ts:52-55 `map` is `new Pending(this.promise.then((settled) => settled.map(fn)))`, so a throw from `fn` becomes a rejection of an internally-created promise the caller never sees; settle() (pending.ts:126-128) is `return this.promise`, adding no sink. Severity critical is defensible: a Result *value* that is merely dropped terminates the process, and nothing in the docs warns of it (eager-vs-lazy.md:49 only says the transformation runs 'regardless of whether anything is listening'). One imprecision worth recording: of the four shapes, `fail-fast-loop` crashes because the *awaited* element rejects at `await j` under top-level await, which is the documented 'throws are not caught' contract rather than orphaning; the genuine orphan-poison cases are guard-before-await, fail-fast-loop-guarded, and the three 03-unhandled.mjs modes. That does not change the claim or severity.

---

### `probe-test-interop/ti-1` — Err[Symbol.iterator] throws on its 2nd next(), so expect(...).toEqual(...) involving ANY Err crashes under jest and vitest

**Severity:** critical · **Category:** correctness · **Verifier verdict:** unverified

**Claim.** `Err.prototype[Symbol.iterator]` is a generator that `yield`s `this` and then unconditionally `throw new Error("Unreachable: generator should have been halted")` (packages/antithrow/src/err.ts:120-123). That contract only holds for `yield*` delegation inside `Result.do`, which halts the generator after the first yield. Every jest-family deep-equality algorithm (`iterableEquality` in `@jest/expect-utils`, reused verbatim by `@vitest/expect`) probes `Symbol.iterator` on both operands and iterates them. Because `Err` advertises itself as iterable, the equality tester calls `next()` a second time and the library throws its own internal "unreachable" error. Result: the single most common assertion a consumer of a Result library writes — `expect(result).toEqual(new Err(...))` — does not compare, does not diff, and does not fail cleanly; it aborts with a nonsense internal error. It is broken for toEqual, toStrictEqual, toMatchObject, not.toEqual, expect.objectContaining, expect.arrayContaining, Map values, arrays of results, objects holding results, and spy-argument matching (toHaveBeenCalledWith). bun:test is the only runner unaffected, because bun's equality does not run iterableEquality on non-array iterables — which is exactly why the repo's own 534 bun:test tests never surfaced this.

<details><summary><strong>Empirical evidence</strong></summary>

MECHANISM — `bun /tmp/.../scratchpad/test-interop/mechanism.ts`:
```
Err iterator 1st next(): {"done":false}
Err iterator 2nd next(): THREW -> Unreachable: generator should have been halted
Symbol.iterator in Err.prototype: true
[...new Err('x')] THREW -> Unreachable: generator should have been halted
Array.from(Err) THREW -> Unreachable: generator should have been halted
[...new Ok(1)] -> []
```
VITEST — `bun x vitest run vt/blast.test.ts --reporter=verbose` (vitest 4.1.10):
```
 × R1: array of Results toEqual        → Unreachable: generator should have been halted
 × R2: object holding an Err toEqual    → Unreachable: generator should have been halted
 × R3: expect.objectContaining with an Err → Unreachable: generator should have been halted
 × R4: expect.arrayContaining with an Err  → Unreachable: generator should have been halted
 × R5: Map keyed results                → Unreachable: generator should have been halted
 × R6: awaited settled Err from Result.try → Unreachable: generator should have been halted
 × R7: toHaveBeenCalledWith an Err      → Unreachable: generator should have been halted
 ✓ R8: toHaveBeenCalledWith an Ok (control)
 ✓ R10: Pending holding Err is fine
 ✓ R11/R12: workarounds (compare .error payload / spread to POJO)
 Tests  7 failed | 5 passed (12)
```
`bun x vitest run vt/iterable.test.ts --reporter=verbose`:
```
 × I1: toEqual on two IDENTICAL Errs      → Unreachable: generator should have been halted
 × I2: toStrictEqual on two identical Errs → Unreachable: ...
 × I3: toEqual on Errs with different payloads (should just fail cleanly) → Unreachable: ...
 × I6: nested — Ok holding an Err          → Unreachable: ...
 × I7: not.toEqual on two identical Errs   → Unreachable: ...
 × I8: toMatchObject on Errs               → Unreachable: ...
```
JEST-FAMILY (proving it is not vitest-specific) — `node jest-expect-probe.mjs`, using jest's own `expect` package v30.4.1 imported directly against `dist/index.js`:
```
expect package version: 30.4.1
[FAIL] jest-expect: Err('boom') toEqual Err('boom') -> Error: Unreachable: generator should have been halted
[FAIL] jest-expect: Err('a') toEqual Err('b') -> Error: Unreachable: generator should have been halted
[FAIL] jest-expect: Err('boom') toStrictEqual Err('boom') -> Error: Unreachable: generator should have been halted
[PASS] jest-expect: Ok(1) toEqual Ok(1)
```
CONTROL (bun:test unaffected) — `bun test bt/iterable.test.ts` gives a clean diff for I3 and 7 pass / 2 fail (the 2 fails are the deliberately-inverted I3/I7).

</details>

**Recommendation.** Make `Err`'s iterator terminate instead of throwing: replace `throw new Error("Unreachable...")` with `return undefined as never` (verified safe — `mechanism.ts` shows the `return` variant yields `{done:true}` on the 2nd next()). `Result.do` still short-circuits on the first yield, so behaviour is unchanged for the intended consumer. Better still, stop advertising `Symbol.iterator` on the public classes at all: move the do-notation channel to a private symbol (e.g. `const RESULT_YIELD = Symbol.for("antithrow.yield")`) that `Result.do` reads directly, so no generic structural-equality or spread consumer ever iterates a Result. Either way this needs a regression test run under a jest-family `expect`, not only bun:test — the current suite structurally cannot catch it.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-test-interop/ti-2` — Every Pending is structurally equal to every other Pending — asserting an async success passes when it actually failed

**Severity:** critical · **Category:** correctness · **Verifier verdict:** unverified

**Claim.** `Pending`'s only own property is `promise`. Promises have no own enumerable properties, so structural equality treats all Promise instances as identical. Consequently `expect(a).toEqual(b)` and even `expect(a).toStrictEqual(b)` are TRUE for any two Pendings regardless of what they settle to — including `Pending(Ok(1))` vs `Pending(Err('boom'))` — in BOTH bun:test and vitest. A `Pending` also equals a hand-written `{ promise: <any unrelated promise> }` under `toEqual`. Snapshot testing has the same hole: `toMatchInlineSnapshot()` records `Pending { "promise": Promise {} }` for a Pending that resolves to Ok and for one that resolves to Err — the snapshot captures zero information about the outcome, so no behavioural regression on any async code path can ever fail a snapshot. Since `Result.try(async …)`, `Result.fromPromise`, `Result.do(async function*)`, and every `.map`/`.andThen` with an async callback return a `Pending`, this covers the library's entire async surface.

<details><summary><strong>Empirical evidence</strong></summary>

BUN — `bun test bt/equality.test.ts` → `11 pass, 0 fail`. Passing tests include:
```
FALSE PASS #5: any Pending toEqual any other Pending          (Pending(Ok(1)) vs Pending(Ok(999)))
FALSE PASS #6: Pending(Ok) toStrictEqual Pending(Err)         (toEqual AND toStrictEqual both pass)
FALSE PASS #7: Pending toEqual {promise: unrelated}
FALSE PASS #8: async Result.try that THREW toEqual one that succeeded
```
VITEST — `bun x vitest run vt/equality.test.ts --reporter=verbose`:
```
 ✓ FALSE PASS: any Pending equals any other Pending (different resolved values) 0ms
 ✓ FALSE PASS: Pending(Ok) equals Pending(Err) even under toStrictEqual 0ms
 ✓ FALSE PASS: Pending equals a hand-made object with any promise 0ms
 ✓ FALSE PASS: Result.try async result equals a bare {promise} object 0ms
```
SNAPSHOTS — `bun x vitest run vt/snapshot.test.ts` → `Snapshots 8 written`; the file vitest wrote back contains, for S5 (settles to Ok), S6 (settles to Err) and S8 (`Result.try(async () => 1)`), the byte-identical snapshot:
```
			Pending {
			  "promise": Promise {},
			}
```
DIFFS — `bun test bt/diffs.test.ts` D2 prints only `Pending { "promise": Promise {} }`; vitest prints the same.

</details>

**Recommendation.** Two complementary fixes. (1) Give `Pending` observable state so structural equality can distinguish instances: track `"pending" | "fulfilled" | "rejected"` plus the settled value in an own property updated when the underlying promise settles, and/or expose a `peek(): Settled<T,E> | undefined`. (2) More importantly, make the *wrong* spelling impossible rather than merely wrong: ship a `[Symbol.for('nodejs.util.inspect.custom')]`/pretty-format serializer that renders `Pending <unsettled>` and document that a `Pending` must be `await`ed or `.settle()`d before assertion. Best of all, ship the `toSettleToOk`/`toSettleToErr` matchers (see ti-7) so consumers never compare Pendings structurally.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-test-interop/ti-3` — Under bun:test, Ok(undefined) and Err(undefined) are toEqual-equal — a failed void operation passes a success assertion

**Severity:** critical · **Category:** correctness · **Verifier verdict:** unverified

**Claim.** `Ok` stores its payload in `value`, `Err` in `error`, and there is no discriminant property, no `Symbol.toStringTag`, and no shared tag field. Jest-style `toEqual` strips `undefined`-valued own properties, so `Ok(undefined)` and `Err(undefined)` both reduce to `{}` and compare equal. Under bun:test this false-pass is live for `toEqual` and `toContainEqual`, including nested (`Ok(Ok(undefined))` vs `Ok(Err(undefined))`). This is not exotic: `Result<void, E>` is the natural return type for every save/delete/publish/side-effect function, and `new Err(undefined)` / `Result<T, void>` is equally reachable. bun:test is the runner this monorepo itself standardises on (CLAUDE.md: `bun test`), so this is the default experience for the library's own audience. vitest 4 and jest 30 happen to distinguish the two (their `toEqual` compares constructors), but vitest's `toContainEqual` and `toHaveReturnedWith` still false-pass on the same pair — so the hole is inconsistent even within a single runner.

<details><summary><strong>Empirical evidence</strong></summary>

BUN — `bun test bt/equality.test.ts`:
```
bun test v1.3.11 (af24e281)
 11 pass
 0 fail
 12 expect() calls
```
That file contains eight deliberately-wrong assertions, all green, among them:
```
FALSE PASS #1: toEqual accepts a FAILED save where SUCCESS was asserted
    function saveUser(fail: boolean): Result<void, void> { return fail ? new Err(undefined) : new Ok(undefined); }
    expect(saveUser(true)).toEqual(new Ok(undefined));   // GREEN, but the save failed
FALSE PASS #2: Ok(undefined) toEqual Err(undefined)
FALSE PASS #3: toContainEqual finds Ok(undefined) when Err(undefined) sought
FALSE PASS #4: nested Ok(Ok(undefined)) toEqual Ok(Err(undefined))
```
VITEST (partial hole) — `bun x vitest run vt/equality.test.ts --reporter=verbose`:
```
 ✓ FALSE PASS: toContainEqual finds Ok(undefined) when Err(undefined) sought 0ms   <-- still wrong
 × FALSE PASS: toEqual accepts Ok(undefined) where Err(undefined) expected → expected Ok{ value: undefined } to deeply equal Err{ error: undefined }   <-- caught
```
`bun x vitest run vt/timers.test.ts --reporter=verbose`:
```
 ✓ M4: toHaveReturnedWith on Ok(undefined) vs Err(undefined) -- cross variant 0ms
```
(the mock actually returned `new Err(undefined)`; `toHaveReturnedWith(new Ok(undefined))` passed.)
MECHANISM — `bun inspect.ts`:
```
JSON.stringify Ok(undefined): {}
JSON.stringify Err(undefined): {}
Object.getOwnPropertyNames(Ok(1)) = [ "value" ]
Symbol.toStringTag on Ok: undefined
Object.prototype.toString.call(Ok(1)) = [object Object]
Object.prototype.toString.call(Err('x')) = [object Object]
```

</details>

**Recommendation.** Add a cheap, always-present discriminant that survives `undefined`-stripping in every equality implementation. The minimum viable fix is a readonly own/prototype tag — e.g. `readonly kind = "ok" | "err" | "pending"` (also usable as a real discriminated union for `switch`, which the library currently lacks) — plus `static get [Symbol.toStringTag]`. A tag string is never `undefined`, so `toEqual` can never collapse the two variants. This is a breaking change to structural shape and worth making before more consumers ship green-but-wrong tests.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-suite-efficacy/ok-1` — No gate anywhere validates the published entrypoint or exports map: shipping the legacy v2 API to every consumer leaves all five gates green

**Severity:** critical · **Category:** packaging · **Verifier verdict:** unverified

**Claim.** Every test imports source modules directly (`./ok.js`, `./err.js`, ...); not one test imports the package by name, the `exports` map, `dist/index.js`, or `src/index.ts`. Consequently the public surface of `antithrow` is guarded by nothing: deleting every export from `src/index.ts`, or repointing `exports["."].import` at the legacy build so consumers receive the deprecated v2 API instead of v3, keeps `bun test` at 534 pass, `tsc --noEmit` at exit 0, and publint reporting "All good!".

<details><summary><strong>Empirical evidence</strong></summary>

`bash /tmp/claude-0/-home-user-antithrow/6fa15e49-ae6b-5bd4-b03a-8a3385b537f3/scratchpad/suite-efficacy/repro-entrypoint.sh` (operates on the scratch copy):
=========== A. gut src/index.ts (delete every public export) ===========
 534 pass
 0 fail
  tsc --noEmit exit=0
=========== B. repoint exports['.'] at the legacy (v2) build ===========
 534 pass
 0 fail
  tsc --noEmit exit=0
All good!
  what a consumer now imports: Err, Ok, Result, ResultAsync, chain, err, errAsync, ok, okAsync

The consumer now gets `ResultAsync`/`okAsync`/`errAsync` and has lost `Pending` and `UnwrapError` entirely. `grep -hn '^import' packages/antithrow/src/*.test.ts | sort -u` shows every import is `./ok.js`, `./err.js`, `./pending.js`, `./result.js`, `./errors.js`, `./types.js` or `bun:test` — `antithrow`, `index.js` and `dist` appear zero times. knip.json declares `entry: ["src/index.ts", "src/legacy/index.ts"]`, i.e. it also only sees source, never the exports map.

</details>

**Recommendation.** Add a consumer smoke test that runs against the built artefact, not the source: a tiny fixture package whose `node_modules/antithrow` symlinks the workspace package, with (a) a runtime script asserting `Object.keys(await import("antithrow"))` equals the expected export set plus a few behavioural calls, and (b) a `tsc --noEmit` pass over a consumer file importing `antithrow` and `antithrow/legacy` so `dist/*.d.ts` is exercised. Wire it into the `test` CI job after `bun run build`. A working template is left at /tmp/claude-0/-home-user-antithrow/6fa15e49-ae6b-5bd4-b03a-8a3385b537f3/scratchpad/suite-efficacy/consumer/ (it compiles and runs green against the current dist under both bun and node).

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-runtime-matrix/rt-1` — Cross-realm Ok.flatten() silently turns an Err into an Ok — reproduced in real browser iframes and node:vm

**Severity:** critical · **Category:** correctness · **Verifier verdict:** unverified

**Claim.** Ok.flatten() is the only method in the public API that branches on `instanceof`. When the inner Result was constructed in a different JS realm (browser iframe, node:vm sandbox, Electron preload vs renderer, worker with its own module graph) the three-way `this.value instanceof Ok || instanceof Err || instanceof Pending` check is false for all three, so flatten() returns the OUTER Ok unchanged. The declared type says the result may be Err; at runtime `Ok(foreignErr).flatten().isErr()` is `false` and `.unwrap()` hands back the Err *object* as a success value. An error state is silently laundered into a success state, with no diagnostic. This is distinct from the already-reported dual-install case: it happens with a single, perfectly-deduplicated copy of the library, purely because two realms evaluated the same file. Everything else in the library is realm-safe (isOk/isErr/isPending are duck-typed methods, isThenable duck-types `.then`, `await` of a foreign Pending works, Result.do accepts a foreign Err) — flatten() is the lone outlier.

<details><summary><strong>Empirical evidence</strong></summary>

REAL BROWSER (two same-origin realms, each importing dist/index.js as a native ES module; parent page + iframe):
  cmd: cd /tmp/.../runtime-matrix/domtest && PROBE=probe2 /opt/node22/bin/node chromium-test.mjs
  observed (Chromium 151.0.7922.34 headless):
    "iframe realm loaded; Ok === iframe.Ok ? false"
    "foreign Ok instanceof local Ok = false"
    "foreign Ok.isOk() = true (duck-typing works)"
    "Ok(foreignOk).flatten() -> Ok; unwrap() = {\"value\":7}; flattened correctly = false"
    "Ok(foreignErr).flatten().isErr() = false  <-- SHOULD BE true; false means an Err was silently turned into an Ok"

NODE + BUN (node:vm fresh realm):
  cmd: /opt/node22/bin/node /tmp/.../runtime-matrix/vm-realm.mjs   (and `bun` — byte-identical output)
  observed:
    same-realm  Ok(Ok(7)).flatten() -> Ok unwrap = 7
    cross-realm Ok(foreignOk).flatten() -> Ok
      did it flatten? unwrap() = {"value":7}
      flat === outer (NOT flattened)? true
    cross-realm Ok(foreignErr).flatten().isErr() = false (should be true)
    cross-realm Ok(foreignPending).flatten().isPending() = false (should be true)
  and the realm-safe parts, same run:
    foreignOk.isOk() = true ; foreignErr.isErr() = true ; foreignPending.isPending() = true
    local Ok.map(-> foreign Promise) isPending = true ; awaited -> 99
    await foreignPending -> Ok 2
    Result.do(yield* foreignErr) -> Err isErr = true

Source: /home/user/antithrow/packages/antithrow/dist/ok.js:64 — `if (this.value instanceof Ok || this.value instanceof Err || this.value instanceof Pending)`

</details>

**Recommendation.** Stop using `instanceof` for Result detection. Brand the base class with a cross-realm-stable key and test that instead, e.g. `static [Symbol.for("antithrow.result")] = true` on ResultBase plus a module-level `isResult(v)` helper that checks `v?.[Symbol.for("antithrow.result")] === true` (a registered symbol is shared across realms by construction). Duck-typing on the presence of `isOk`/`isErr`/`isPending` would also work and is consistent with how `isThenable` already behaves in this same codebase. Failing that, flatten() must at minimum not silently return the un-flattened outer value — the current fallback comment ("When T is a union that includes non-Result values, flatten should preserve this Ok") is exactly what makes the cross-realm failure invisible. This is a breaking-change-worthy fix.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.
