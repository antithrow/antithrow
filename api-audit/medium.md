# antithrow core API audit — medium-severity findings

> Part of the [API audit](../API_AUDIT.md). Inconsistencies and real ergonomic gaps.
> Findings are grouped by audit dimension. Repro scripts referenced in evidence lived in the session scratchpad (ephemeral); all key observed output is quoted inline. The full untruncated register is in [findings.json](./findings.json).

### `ok-runtime/ok-10` — `UnwrapError` message omits the value, and its enumerable `result` field leaks the whole payload into logs and breaks `JSON.stringify` on cyclic values

**Severity:** medium · **Category:** ergonomics · **Verifier verdict:** confirmed

**Claim.** `new UnwrapError("Called unwrapErr() on an Ok value", this)` produces a message with no information about what was actually held — you cannot tell two failures apart from a log line. The value is reachable only through `error.result`, which is typed `Settled<unknown, unknown>` and therefore requires a cast (or a `.isOk()` guard plus an `unknown` value) to be useful. Meanwhile `result` and `name` are *own enumerable* properties, so `JSON.stringify(error)` serialises the entire wrapped payload — a log-redaction hazard for results carrying credentials or PII — and throws `TypeError` outright when the payload is cyclic. `name` is also writable at runtime despite `override readonly name`.

<details><summary><strong>Empirical evidence</strong></summary>

`bun /tmp/.../ok-runtime/e-unwrap-iter-serialize.ts`
```
name => UnwrapError
name is own prop => true
name enumerable => true
name writable (readonly is type-only) => true
message => Called unwrapErr() on an Ok value
message mentions the value? => false
result === ok => true
cause => undefined
String(err) => UnwrapError: Called unwrapErr() on an Ok value
JSON.stringify(err) => {"result":{"value":42},"name":"UnwrapError"}
own keys => [ "result", "name" ]
JSON.stringify circular UnwrapError THREW => TypeError
recovered value via e.result.value => 42   // only after an isOk() guard, typed `unknown`
```

</details>

**Recommendation.** Include a truncated, safely-stringified preview of the payload in the message (`Called unwrapErr() on an Ok value: 42`), define `name` and `result` as non-enumerable via `Object.defineProperty` so error serialisation stays log-safe, and set `cause` to the wrapped value so standard tooling picks it up. Consider making `UnwrapError` generic (`UnwrapError<T, E>`) so `error.result` narrows without a cast.

**Verifier note.** Reproduced line for line: `name => UnwrapError` as an own *enumerable* writable property (class field at errors.ts:22, so it is not on the prototype and `override readonly` is type-only), `message => Called unwrapErr() on an Ok value` with no payload, `cause => undefined`, `own keys => ["result","na […truncated, full text in findings.json]

---

### `ok-runtime/ok-11` — No serialization or display story: `JSON.stringify(new Ok(undefined))` is `{}`, round-tripping is impossible, `structuredClone` loses the class, `${ok}` is `[object Object]`

**Severity:** medium · **Category:** packaging · **Verifier verdict:** confirmed

**Claim.** `Ok` has no `toJSON`, no `Symbol.toStringTag`, no `Symbol.for("nodejs.util.inspect.custom")`, and no static revive/parse. `JSON.stringify` falls back to own enumerable properties, so `Ok(42)` → `{"value":42}` and `Ok(undefined)` → `{}` — indistinguishable from an empty object and from `Pending`'s `{"promise":{}}` in the `undefined` case. Parsing back gives a plain object, not an `Ok`. `structuredClone` (worker/`postMessage` boundaries) also strips the prototype. Template interpolation gives `[object Object]`. For a library whose values are meant to cross API and process boundaries, there is no supported way to move a `Result` across one.

<details><summary><strong>Empirical evidence</strong></summary>

`bun /tmp/.../ok-runtime/e-unwrap-iter-serialize.ts`
```
String(ok) => [object Object]
`${ok}` => [object Object]
Symbol.toStringTag => [object Object]
util.inspect => Ok { value: 42 }              // this one is fine (class name)
JSON.stringify(Ok(42)) => {"value":42}
JSON.stringify(Ok(undefined)) => {}
JSON.stringify(Err(42)) => {"error":42}
JSON.stringify(Pending) => {"promise":{}}
JSON round-trip is an Ok? => false
structuredClone(ok) instanceof Ok => false
structuredClone(ok) => { value: 42 }
Object.keys(ok) => [ "value" ]
new Ok() JSON => {}
```

</details>

**Recommendation.** Add `toJSON()` emitting a discriminated envelope (`{ "@antithrow": "ok", value }` / `{ "@antithrow": "err", error }`) plus a `Result.reviver` / `Result.fromJSON` pair, and a `toString()` returning `Ok(42)` / `Err("boom")`. Add `[Symbol.toStringTag]` so `Object.prototype.toString.call` is informative. If serialization is deliberately out of scope, say so in the README — silence here reads as an oversight rather than a decision.

**Verifier note.** Reproduced: no `toJSON`, no `Symbol.toStringTag`, no revive/parse anywhere in ok.ts/err.ts/pending.ts; `String(ok) => [object Object]`, `JSON.stringify(Ok(42)) => {"value":42}`, `JSON.stringify(Ok(undefined)) => {}`, `JSON round-trip is an Ok? => false`, `structuredClone(ok) instanceof Ok => false`. […truncated, full text in findings.json]

---

### `ok-runtime/ok-12` — `mapOrElse` returns a bare value from `Ok` but a promise from `Err` for the identical call, forcing defensive `await` on any union

**Severity:** medium · **Category:** ergonomics · **Verifier verdict:** confirmed

**Claim.** `Ok.mapOrElse` returns `fn(value)` raw and `Err.mapOrElse` returns `defaultFn(error)` raw. `SameResolved<UDefault, UMap>` only requires the two callbacks to agree after `Awaited`, so an async `defaultFn` paired with a sync `fn` type-checks — and then the sync/async character of the return value depends on which branch was taken at runtime. On a narrowed `Ok` this is statically known, but on a `Result` union the caller gets `number | PromiseLike<number>` and must `await` defensively. The `base.ts` JSDoc says only "Both functions should return the same resolved type `U`", which understates the consequence.

<details><summary><strong>Empirical evidence</strong></summary>

`bun /tmp/.../ok-runtime/g-misc.ts`
```
Ok.mapOrElse(asyncDefault, syncFn) -> => 4 undefined            // bare number, no .then
Err.mapOrElse(asyncDefault, syncFn) -> => Promise { <resolved> } function
```
Matching type assertions in `typecheck.ts` (tsc exit 0): `Equal<typeof mo1, number>` for the `Ok` receiver and `Equal<typeof mo2, PromiseLike<number>>` for the `Err` receiver, from the same `mapOrElse(async () => 0, (v) => v * 2)` call. Relatedly, `mapOr`/`mapOrElse` pass the callback's return value through completely unnormalised — `bun .../g-misc.ts` shows `mapOr returns the same thenable object => true` and `mapOr result has .catch? => undefined`, i.e. the caller can receive a non-`Promise` thenable with no `.catch`.

</details>

**Recommendation.** Constrain `SameResolved` to require the same *sync-ness*, not just the same awaited type (reject sync-vs-async mixes), or normalise both branches through `Promise.resolve` when either callback is async so `mapOrElse` returns a single predictable shape. Also normalise the value `mapOr`/`mapOrElse` hand back to a real `Promise` when it is thenable, so `.catch`/`.finally` are always available.

**Verifier note.** Reproduced: `bun g-misc.ts` → `Ok.mapOrElse(asyncDefault, syncFn) => 4` (bare number, no `.then`) vs `Err.mapOrElse(asyncDefault, syncFn) => Promise { <resolved> }` for the identical call, and typecheck.ts (exit 0) asserts `Equal<typeof mo1, number>` / `Equal<typeof mo2, PromiseLike<number>>`. Sourc […truncated, full text in findings.json]

---

### `ok-runtime/ok-13` — `Ok<Promise<T>>` is inhabitable by the constructor but unreachable through `map` — a sync identity map silently converts it to `Pending`

**Severity:** medium · **Category:** correctness · **Verifier verdict:** adjusted

**Claim.** Because `map` dispatches on the *returned* value's thenability, an `Ok` whose value is already a promise cannot survive a `map`. Even `okPromise.map(v => v)` — a pure identity — converts `Ok<Promise<number>, never>` into `Pending<number, never>` and unwraps the promise. So `new Ok(promise)` is constructible and `unwrap()` returns the promise, but no combinator can preserve that shape; `Result<Promise<T>, E>` is a type the library lets you write and then cannot manipulate.

<details><summary><strong>Empirical evidence</strong></summary>

`bun /tmp/.../ok-runtime/b-map.ts`
```
Ok<Promise>.map(v=>v) ctor => Pending
Ok<Promise>.map(v=>v) settled unwrap => 3
original Ok<Promise>.unwrap() is a Promise => 3
```
Type level, `typecheck.ts` (tsc exit 0): `declare const okPromise: Ok<Promise<number>, never>; const identityMapped = okPromise.map((v) => v);` asserted `Equal<typeof identityMapped, Pending<number, never>>`.

</details>

**Recommendation.** Either forbid `Ok<PromiseLike<...>>` at the type level (constrain the `Ok` constructor to `T extends PromiseLike<unknown> ? never : T`, pushing users to `Result.fromPromise`), or add an explicit non-absorbing escape (`mapSync`) so a promise-valued `Ok` can be transformed without collapsing. Silently deleting a constructible state is worse than rejecting it.

**Verifier note.** The `map` half is confirmed: `Ok<Promise>.map(v=>v) ctor => Pending` at runtime and typecheck.ts (exit 0) asserts `Equal<typeof identityMapped, Pending<number, never>>`, so a pure identity map does collapse `Ok<Promise<number>, never>`. But the generalisation is factually wrong — I tested the other  […truncated, full text in findings.json]

---

### `ok-runtime/ok-7` — `map` returning a `Result` nests instead of chaining — `Ok.map(() => new Err(...))` is a success containing an error, with no guard

**Severity:** medium · **Category:** ergonomics · **Verifier verdict:** adjusted

**Claim.** `map` has no special case for a callback that returns a `Result`. `ok.map(() => new Err("boom"))` produces `Ok<Err<never, "boom">, string>`: `isOk()` is `true`, `isErr()` is `false`, and `unwrap()` hands back an `Err` instance. The `Pending` case is stranger still: because `Pending` is thenable it is *absorbed* rather than nested, so `ok.map(() => pendingErr)` yields `Pending<Settled<number, "inner">, string>` — an eventual **`Ok` wrapping an `Err`**. So the same mistake produces two structurally different shapes depending on whether the inner result is settled or pending. The types are honest (they really do say `Ok<Err<...>>`), so this is not unsound — but `map` vs `andThen` is the single most common confusion in Result libraries and nothing here pushes back.

<details><summary><strong>Empirical evidence</strong></summary>

`bun /tmp/.../ok-runtime/b-map.ts`
```
map(->Ok) outer ctor => Ok
map(->Ok) unwrap() is an Ok? => true
map(->Err) isOk => true
map(->Err) isErr => false
map(->Err) unwrap() instanceof Err => true
map(->Pending) ctor => Pending
map(->Pending<Err>) settled ctor => Ok
map(->Pending<Err>) settled.isOk() => true
map(->Pending<Err>) settled.unwrap() instanceof Err => true
map(->Pending<Err>).flatten() settled ctor => Err   // flatten does recover it
```
Type assertions confirmed in `typecheck.ts` (tsc exit 0): `Equal<typeof mErr, Ok<Err<never, "boom">, string>>` and `Equal<typeof mPending, Pending<Settled<number, "inner">, string>>`.

</details>

**Recommendation.** Add a `no-result-returning-map` rule to `@antithrow/eslint-plugin` (the package already exists and is the right place), and/or make `map`'s overload set reject `Result`-returning callbacks outright with a `@deprecated`-style branded error type that points at `andThen`. At minimum, document the nesting in the `map` JSDoc in `base.ts` with a "did you mean `andThen`?" note — the current JSDoc says only "Transforms the value inside an Ok" and never mentions nesting.

**Verifier note.** All observations reproduce (`map(->Err) isOk => true`, `isErr => false`, `unwrap() instanceof Err => true`; `map(->Pending<Err>) settled ctor => Ok` whose `unwrap() instanceof Err`; `flatten()` recovers it), and typecheck.ts (exit 0) confirms `Ok<Err<never,"boom">, string>` and `Pending<Settled<numb […truncated, full text in findings.json]

---

### `ok-runtime/ok-8` — `Ok` is iterable, but `for..of` / spread / `Array.from` silently produce nothing

**Severity:** medium · **Category:** ergonomics · **Verifier verdict:** adjusted

**Claim.** `Ok[Symbol.iterator]` is a generator that `return`s the value rather than yielding it (`Generator<never, T, void>`), which is exactly right for `yield*` in `Result.do`. But it also makes every `Ok` a legal — and completely silent — iterable everywhere else. `[...ok]` is `[]`, `Array.from(ok)` is `[]`, `for (const x of ok)` runs zero times. Nothing warns; the value simply vanishes. `Ok` is also not async-iterable while `Pending` is (`Symbol.asyncIterator in ok === false`), so `for await` over a `Result` union works only on some branches.

<details><summary><strong>Empirical evidence</strong></summary>

`bun /tmp/.../ok-runtime/e-unwrap-iter-serialize.ts`
```
for..of over Ok collected => []
[...ok] => []
Array.from(ok) => []
const [first] = ok -> first (typed `never`!) => undefined
iterator.next() => {"value":42,"done":true}
yield* Ok inside generator returns => {"value":42,"done":true}
Symbol.asyncIterator in Ok => false
```
Types are consistent, not unsound: `typecheck.ts` (tsc exit 0) asserts `Equal<typeof spread, never[]>` and, for destructuring, `Equal<typeof first, undefined>` — TS correctly adds `undefined`, and `const asString: string = first` is rejected (`@ts-expect-error` fires).

</details>

**Recommendation.** Keep the generator (it is the mechanism `Result.do` needs) but stop advertising it as general iteration: move it behind a dedicated symbol, or add `Symbol.asyncIterator` to `Ok`/`Err` so both directions of `Result.do` work uniformly, and document in `base.ts` that `Symbol.iterator` exists solely for `yield*` and yields nothing under `for..of`/spread. An ESLint rule banning spread/`for..of` over a `Result` would close the remaining gap.

**Verifier note.** Core claim reproduces: ok.ts:132 is `*[Symbol.iterator](): Generator<never, T, void> { return this.value; }`, so `for..of over Ok collected => []`, `[...ok] => []`, `Array.from(ok) => []`, `iterator.next() => {value:42,done:true}`, and typecheck.ts asserts `Equal<typeof spread, never[]>` (exit 0). O […truncated, full text in findings.json]

---

### `ok-runtime/ok-9` — Four combinators, three different policies for the error channel: `map` keeps `E`, `and`/`andThen` drop it, `or` keeps it, `orElse` replaces it

**Severity:** medium · **Category:** consistency · **Verifier verdict:** adjusted

**Claim.** `Ok`'s signatures each treat `E` differently, and the divergence is observable on a real `Result` union. `map` returns `Ok<U, E>` (keeps). `and`/`andThen` return `R` verbatim (drop `E`, contradicting `base.ts`'s abstract declarations `and<U,F>(...): Result<U, E|F>` and `andThen<U,F>(...): Result<U, E|F>`). `or` returns `Ok<T, E>` (keeps `E`, ignores the argument's). `orElse` returns `Ok<T, InferErr<R>>` (replaces). The practical consequence: `orElse` can discharge the error channel but `or` cannot, so the two recovery combinators — which are the same operation in Rust — are not interchangeable.

<details><summary><strong>Empirical evidence</strong></summary>

`cd /home/user/antithrow && bun x tsc --ignoreConfig --noEmit --strict --exactOptionalPropertyTypes --noUncheckedIndexedAccess --allowImportingTsExtensions --moduleResolution bundler --module preserve --target es2022 --lib es2022 /tmp/.../ok-runtime/typecheck2.ts` → `exit=0`, asserting for `declare const ok: Ok<number, "bad">`:
```
ok.map(v => v + 1)                    :: Ok<number, "bad">      // keeps E
ok.and(new Ok<string, "other">("x"))  :: Ok<string, "other">    // drops E
ok.andThen(() => new Ok<string,"other">("x")) :: Ok<string, "other">  // drops E
ok.or(new Ok<number, never>(0))       :: Ok<number, "bad">      // keeps E
ok.orElse(() => new Ok<number, never>(0)) :: Ok<number, never>  // replaces E
```
and on the union `declare const r: Result<number, "bad">`:
```
r.or(new Ok<number, never>(0))       :: Ok<number,"bad"> | Ok<number,never> | Pending<number,"bad">  // "bad" survi […truncated, full text in findings.json]

</details>

**Recommendation.** Pick one policy per axis and apply it uniformly. `and`/`andThen` should widen to `Result<U, E | F>` as `base.ts` already declares (matching `Pending.andThen`, which correctly produces `Pending<InferOk<R>, E | InferErr<R>>`). `or` should mirror `orElse` and return `Ok<T, InferErr<R>>` so the error channel is dischargeable by both. Until then, the divergence between `base.ts`'s abstract signatures and `ok.ts`'s concrete ones should be treated as a doc bug — the abstract class is the published contract.

**Verifier note.** Every type assertion holds: typecheck2.ts exits 0 with `map` keeping E, `and`/`andThen` returning R verbatim, `or` keeping E, `orElse` replacing E, and on a `Result<number,"bad">` union `or` keeping "bad" while `orElse` discharges it. Imprecision in the claim: `and`/`andThen` returning `R` does not  […truncated, full text in findings.json]

---

### `err-runtime/err-10` — Async callbacks are accepted by map/mapErr but rejected by andThen/orElse — the async story is inconsistent across Err's own surface

**Severity:** medium · **Category:** consistency · **Verifier verdict:** confirmed

**Claim.** On the same `Err` instance, `map(async …)` and `mapErr(async …)` type-check and upgrade the chain to `Pending`, but `andThen(async …)` and `orElse(async …)` are hard compile errors because their callbacks are constrained to `R extends Result<unknown, unknown>` with no `PromiseLike` arm. Users must know to write `orElse(() => Result.try(async () => …))` — which does work correctly — but nothing in the signature or the error message says so; the diagnostic just reports a missing `promise` property and "15 more".

<details><summary><strong>Empirical evidence</strong></summary>

`bun x tsc --ignoreConfig --noEmit --strict … ./14-async-consistency.ts` — lines 3-4 (`map(async …)`, `mapErr(async …)`) produce no diagnostics; lines 5-6 do:
```
14-async-consistency.ts(5,50): error TS2322: Type 'Promise<Ok<number, never>>' is not assignable to type 'Result<unknown, unknown>'.
  Type 'Promise<Ok<number, never>>' is missing the following properties from type 'Pending<unknown, unknown>': promise, isOk, isErr, isPending, and 15 more.
14-async-consistency.ts(6,48): error TS2322: Type 'Promise<Ok<number, never>>' is not assignable to type 'Result<number, unknown>'.
```
The supported form does work — `bun /…/err-runtime/13b.ts`:
```
orElse(Pending) -> Pending
settles to: Ok 0
```

</details>

**Recommendation.** Add `PromiseLike<R>` overloads to `andThen`/`orElse` (`fn: (error: E) => PromiseLike<R>` ⇒ `Pending<…>`, flattening the promised Result) so all four combinators accept `async` callbacks uniformly. If that is deliberately out of scope, add an `@example` to the `orElse`/`andThen` JSDoc in base.ts showing `Result.try(async …)`/`Result.fromPromise(...)` as the async escape hatch, so the compiler error has a discoverable answer.

**Verifier note.** Reproduced exactly: lines 3-4 of 14-async-consistency.ts (`map(async …)`, `mapErr(async …)`) emit no diagnostics; lines 5-6 emit the quoted TS2322s including the 'missing the following properties from type Pending<…>: promise, isOk, isErr, isPending, and 15 more' wording. Source matches: err.ts:73/8 […truncated, full text in findings.json]

---

### `err-runtime/err-5` — UnwrapError discards the underlying error: no `cause`, and the message never mentions what failed

**Severity:** medium · **Category:** ergonomics · **Verifier verdict:** adjusted

**Claim.** `Err.unwrap()` throws `new UnwrapError("Called unwrap() on an Err value", this)`. `UnwrapError` never sets `cause` and never interpolates the error into the message, so the default rendering of the thrown error in every logger, test reporter, crash reporter and terminal shows only a constant string. The information the developer needs is reachable only by manually inspecting the non-standard `.result` property — and error-reporting tooling looks at `message`/`stack`/`cause`, not `.result`.

<details><summary><strong>Empirical evidence</strong></summary>

`bun /…/err-runtime/01-ctor-identity.ts`, unwrapping `new Err(new Error("db down"))`:
```
F1 name: UnwrapError | instanceof UnwrapError: true | instanceof Error: true
F2 message: "Called unwrap() on an Err value"
F3 'cause' in err: false | ue.cause: undefined
F4 ue.result is the Err instance: true | its error: db down
F5 String(ue): UnwrapError: Called unwrap() on an Err value
F6 stack first 2 lines:
UnwrapError: Called unwrap() on an Err value
    at unwrap (/home/user/antithrow/packages/antithrow/src/err.ts:99:13)
```
The underlying "db down" appears nowhere in `message`, `stack`, or `cause`.

</details>

**Recommendation.** In `errors.ts`, forward the payload through the standard channel: `super(message, { cause: result instanceof Err ? result.error : undefined })` — Node/browsers already print `[cause]` in stack renderings. Additionally include a short rendering of the error in the message (e.g. `Called unwrap() on an Err value: db down`, guarding against non-string payloads). Both are backwards compatible with the existing `.result` property.

**Verifier note.** Facts fully reproduce: errors.ts:24-29 calls `super(message)` only — no `cause`, no interpolation. Runtime F1-F6 match the quoted output exactly, including `F3 'cause' in err: false` and `F5 String(ue): UnwrapError: Called unwrap() on an Err value`. The underlying 'db down' appears in none of messag […truncated, full text in findings.json]

---

### `err-runtime/err-6` — UnwrapError.result is typed Settled<unknown, unknown> (error type is unrecoverable) and is enumerable, so JSON serialization leaks the result and drops the message

**Severity:** medium · **Category:** type-safety · **Verifier verdict:** confirmed

**Claim.** `UnwrapError` is non-generic: `readonly result: Settled<unknown, unknown>`. A `catch` block therefore cannot recover the error type that `Err<T, E>` was so careful to track — the best available is `unknown`, forcing a cast at exactly the point where typed errors were supposed to pay off. Separately, `result` is an ordinary enumerable own property while `Error.prototype.message` is not, so `JSON.stringify(unwrapError)` emits the whole nested result and omits the message.

<details><summary><strong>Empirical evidence</strong></summary>

Emitted .d.ts from `11-emit3.ts` (function body is `if (caught instanceof UnwrapError) { const res = caught.result; if (res.isErr()) return res.unwrapErr(); }`):
```
export declare function handle(caught: unknown): unknown;
```
`bun /…/err-runtime/01-ctor-identity.ts`:
```
F8 JSON.stringify(ue) = {"result":{"error":{}},"name":"UnwrapError"}
F7 name is own & non-writable? {"value":"UnwrapError","writable":true,"enumerable":true,"configurable":true}
```

</details>

**Recommendation.** Make the class generic — `class UnwrapError<T = unknown, E = unknown> extends Error { readonly result: Settled<T, E> }` — and have `Err<T, E>.unwrap()` throw `UnwrapError<T, E>` and `Ok<T, E>.unwrapErr()` throw the same, so `caught.result.unwrapErr()` recovers `E` after a single `instanceof` check. Define `result` (and `name`) as non-enumerable via `Object.defineProperty`, or add a `toJSON()` that emits `{ name, message, result }`, so serialized errors keep their message.

**Verifier note.** Both halves reproduce. (a) errors.ts:21-29 declares a non-generic `UnwrapError` with `readonly result: Settled<unknown, unknown>`; my own emit of 11-emit3.ts gives `export declare function handle(caught: unknown): unknown` for a body that does `instanceof UnwrapError` -> `res.isErr()` -> `res.unwrap […truncated, full text in findings.json]

---

### `err-runtime/err-7` — Subclasses of Err survive map/andThen/and/flatten/settle but are silently destroyed by mapErr — and Ok has the mirror-image inconsistency

**Severity:** medium · **Category:** consistency · **Verifier verdict:** confirmed

**Claim.** `Err.map/andThen/and/flatten` return `this` and `settle()` returns `Promise.resolve(this)`, so a subclass instance flows through unchanged; but `mapErr` constructs `new Err(result)` (never `new this.constructor(...)` and never via `Symbol.species`), so subclass identity, extra constructor fields and getters vanish. `Ok` is inconsistent in exactly the opposite direction: `mapErr`/`or`/`orElse` return `this` (subclass preserved) while `map` builds a fresh `new Ok`. So whether an ergonomic `class NotFound extends Err` survives a chain depends on which arm of the chain runs — and none of it is visible in the types.

<details><summary><strong>Empirical evidence</strong></summary>

`bun /…/err-runtime/03-subclass.ts` with `class HttpErr extends Err<T,string> { constructor(readonly status: number, msg: string) }`:
```
M3 subclass preserved by: { map: true, andThen: true, and: true, flatten: true, mapErr: false, settle: false }
M3b settle preserves subclass: true
M4 after mapErr: ctor = Err | .status = undefined | isRetryable = undefined
M5 Ok subclass preserved by: map: false | mapErr: true | orElse: true | or: true
```
The types say nothing about it — emitted .d.ts from `11-emit3.ts`:
```
export declare const afterMapErr: Err<never, string>;   // from `new HttpErr(503, "x").mapErr(m => m.toUpperCase())`
```

</details>

**Recommendation.** Pick one policy and state it in the docs. The cheapest consistent policy is "combinators always return the library's own `Ok`/`Err`/`Pending`; subclassing is unsupported" — enforce it by making the constructors non-extensible or at least documenting it, and change `Err.map/andThen/and/flatten` to stop leaking `this` if that policy is chosen. The alternative (support subclassing) requires routing every construction through `new (this.constructor as …)` or a `static [Symbol.species]`, which conflicts with `mapErr` legitimately changing `E`. Given `Err<out T, out E>` is variance-annotated and the identity casts are already load-bearing, documenting subclassing as unsupported is the honest option — but it must actually be documented, because `class NotFound extends Err<never, "not_found">` is the obvious ergonomic pattern for a typed-error library.

**Verifier note.** Reproduced: `M3 subclass preserved by: { map: true, andThen: true, and: true, flatten: true, mapErr: false, settle: false }`, `M3b settle preserves subclass: true`, `M4 after mapErr: ctor = Err | .status = undefined | isRetryable = undefined`, `M5 Ok subclass preserved by: map: false | mapErr: true  […truncated, full text in findings.json]

---

### `err-runtime/err-8` — mapErr returning a Result nests instead of flattening — and a returned Pending is assimilated into Err<T, Ok<…>>

**Severity:** medium · **Category:** correctness · **Verifier verdict:** confirmed

**Claim.** `mapErr` performs no Result-flattening, so returning an `Ok`/`Err` from the callback nests it inside the error channel (`Err<T, Err<never, number>>`), and `flatten()` cannot rescue it because `FlattenErr<T, E>` only flattens the phantom `T`, never `E`. Worse, returning a `Pending` — which *is* a `Result` — trips `isThenable` (Pending implements `then`), so the whole chain becomes `Pending<T, Settled<…>>`: an `Err` whose `.error` is an `Ok` instance. Nothing in the signature warns that the Result-returning form of `mapErr` behaves this way while the analogous `orElse` handles it correctly.

<details><summary><strong>Empirical evidence</strong></summary>

Emitted .d.ts from `05-emit.ts`:
```
declare const nest: Err<number, Err<never, number>>;                                   // e.mapErr(() => new Err<never, number>(1))
declare const pn: Pending<number, Settled<number, never>>;                             // e.mapErr(() => Result.try(async () => 1))
```
Runtime, `bun /…/err-runtime/01-ctor-identity.ts`:
```
C2 mapErr returning Err nests: Err error is Err? true
C3 mapErr returning Ok nests: true
C4 mapErr returning Pending -> Pending
C5 settled: Err | inner error: Ok { value: 1, … }
C6 inner error is Ok instance? true
```

</details>

**Recommendation.** At minimum, reject Result-returning callbacks in `mapErr`'s overloads (`fn: (error: E) => F extends Result<any, any> ? never : F`) and point users at `orElse`, which already does the right thing including the async case (verified: `orElse(() => Result.try(async …))` yields a well-formed `Pending`). This also removes the `Pending`-assimilation nonsense, since a `Pending` is a `Result`. If nesting must remain legal, extend `flatten()` to flatten the error channel too, or add `flattenErr()`.

**Verifier note.** Reproduced at both levels. Runtime C2/C3/C4/C5/C6 match the quoted output (mapErr returning Err/Ok nests; returning a Pending yields a Pending whose settled error is an `Ok` instance). My own emit reproduces `declare const nest: Err<number, Err<never, number>>` and `declare const pn: Pending<number, […truncated, full text in findings.json]

---

### `err-runtime/err-9` — unwrapOr/unwrapOrElse are unusable on a concrete Err because T defaults to never

**Severity:** medium · **Category:** ergonomics · **Verifier verdict:** confirmed

**Claim.** `Err<out T = never, out E = unknown>` means the idiomatic `new Err("boom")` infers `Err<never, string>`, so `unwrapOr(value: T)` demands an argument of type `never` and `unwrapOrElse` demands a callback returning `never`. Supplying a real fallback is a compile error, and `unwrapOrElse`'s failure surfaces as an unreadable three-overload wall. Providing a fallback for a failed result is the single most common thing a user does with an `Err`, and it only works if the value is first widened to a `Result<T, E>` union.

<details><summary><strong>Empirical evidence</strong></summary>

`bun x tsc --ignoreConfig --noEmit --strict … ./12-errors.ts`:
```
12-errors.ts(4,36): error TS2345: Argument of type '0' is not assignable to parameter of type 'never'.
12-errors.ts(5,46): error TS2769: No overload matches this call.
  Overload 1 of 3, '(fn: (error: "not_found") => PromiseLike<never>): PromiseLike<never>', gave the following error.
    Type 'number' is not assignable to type 'PromiseLike<never>'.
  Overload 2 of 3, '(fn: (error: "not_found") => never): never', gave the following error.
    Type 'number' is not assignable to type 'never'.
  Overload 3 of 3, …
```
(line 4 = `notFound.unwrapOr(0)`, line 5 = `notFound.unwrapOrElse(() => 0)`, where `notFound: Err<never, "not_found">`.) The same call on the union `Result<number, "not_found">` compiles cleanly — emitted .d.ts from `06-emit2.ts` also records `export declare const uo: never;`.

</details>

**Recommendation.** Widen the value-supplying methods on `Err` so they are usable at `T = never`: `unwrapOr<U>(value: U): T | U` and `unwrapOrElse<U>(fn: (error: E) => SyncOrAsync<U>): SyncOrAsync<T | U>` (and mirror on `Ok`/`Pending`, where the extra `U` collapses harmlessly). This also fixes the analogous friction on the union, where today the fallback must be assignable to `T` exactly rather than merely widening the result.

**Verifier note.** Reproduced exactly. `tsc --ignoreConfig --noEmit --strict ... 12-errors.ts` emits `12-errors.ts(4,36): error TS2345: Argument of type '0' is not assignable to parameter of type 'never'.` and the three-overload TS2769 wall for `unwrapOrElse(() => 0)`, matching the quoted text overload-for-overload. C […truncated, full text in findings.json]

---

### `pending-runtime/pend-4` — `for await (const x of pending)` throws an internal invariant error, and Array.fromAsync silently returns []

**Severity:** medium · **Category:** ergonomics · **Verifier verdict:** confirmed

**Claim.** `Pending` publicly implements `[Symbol.asyncIterator]`, and TypeScript types the yielded element as `Err<T, E>`, so `for await (const x of pending)` compiles and looks like a supported way to consume a Pending. It is not: on `Ok` the loop body never runs (the value is the generator's *return* value, which for-await discards) and on `Err` the loop yields the Err once and then throws `Error("Unreachable: generator should have been halted")` from err.ts:123 — an internal invariant message leaking to users. `Array.fromAsync` has the same split: `[]` for Ok, throw for Err. The iterator is only meaningful under `yield*` inside `Result.do`, but nothing in the type system or the docs restricts it to that.

<details><summary><strong>Empirical evidence</strong></summary>

`bun 06-asynciter.ts`:
```
A. for-await over Pending<Ok>: completed, iterations = 0 (the 42 is unreachable)
B. for-await over Pending<Err> THREW: Error "Unreachable: generator should have been halted" after 1 iteration(s)
B2. yielded: Err {"error":"failed"}
B2. break exits cleanly
C. poisoned for-await THREW: boom
D. Array.fromAsync(Pending<Ok>) = []
D. Array.fromAsync(Pending<Err>) THREW: Unreachable: generator should have been halted
```
And the type is fully permissive — `07-typecheck.ts` compiles clean (`tsc ... 07-typecheck.ts` -> `=== EXIT 0 ===`) including:
```ts
for await (const x of p) { type _x = Expect<Equal<typeof x, Err<number, string>>>; }
```

</details>

**Recommendation.** Either make the escape safe or make it unavailable. Safest: have `Err[Symbol.iterator]` end with `return` semantics instead of `throw new Error("Unreachable...")` so a resumed iterator terminates cleanly (the `Result.do` driver already calls `iter.return()` on fail-fast and never resumes, so it is unaffected — verified in 06 case F, `finally ran: true`). Alternatively, if the throw is a deliberate tripwire, replace the message with a user-facing one that names the mistake ('A Result iterator may only be consumed via `yield*` inside `Result.do`') and mention in pending.md:67 that `for await` over a `Pending` is not a supported consumption form.

**Verifier note.** `bun 06-asynciter.ts` reproduces every line: `A. for-await over Pending<Ok>: completed, iterations = 0`, `B. ... THREW: Error "Unreachable: generator should have been halted" after 1 iteration(s)`, `D. Array.fromAsync(Pending<Ok>) = []`, `D. Array.fromAsync(Pending<Err>) THREW: Unreachable...`, and  […truncated, full text in findings.json]

---

### `pending-runtime/pend-5` — Pending exposes no catch/finally and every async method returns PromiseLike, so a rejected Pending cannot be handled with ordinary Promise vocabulary

**Severity:** medium · **Category:** ergonomics · **Verifier verdict:** confirmed

**Claim.** `Pending` implements `PromiseLike`, not `Promise`. It has no `catch` or `finally`, `then(...)` returns `PromiseLike<A|B>` (so no `.catch` on the result either), and `settle()`/`unwrap()`/`unwrapOr()` are all declared `PromiseLike`. Given findings pend-1/pend-2 — that a Pending can be rejected — the library gives its users no idiomatic handler for that state. The only in-type option is the awkward `pending.then(null, onrejected)`. Notably `settle()` returns the *identical* inner object, which at runtime IS a real Promise with `.catch`, but the declared type hides it, so the escape hatch requires a cast.

<details><summary><strong>Empirical evidence</strong></summary>

`bun 01-basics.ts`:
```
4. p instanceof Promise: false
4. typeof p.catch: undefined
4. typeof p.finally: undefined
```
`bun 10-misc.ts`:
```
4. settle() === settle() === .promise: true true
4. is that object a real Promise (so .catch/.finally exist at runtime)? true
```
Type level — `tsc ... 07-typecheck.ts` -> `=== EXIT 0 ===` with every one of these `@ts-expect-error` markers *consumed* (i.e. each really is an error):
```ts
// @ts-expect-error Pending has no `catch`
p.catch(() => {});
// @ts-expect-error Pending has no `finally`
p.finally(() => {});
// @ts-expect-error the PromiseLike returned by .then has no `catch`
p.then((s) => s).catch(() => {});
// @ts-expect-error unwrap() returns PromiseLike, not Promise - no `.catch` to guard the UnwrapError
p.unwrap().catch(() => {});
// @ts-expect-error PromiseLike is not a Promise
const asPromise: Promise<Settled<number, string>> = p;
```
Th […truncated, full text in findings.json]

</details>

**Recommendation.** Widen the async return types from `PromiseLike` to `Promise` (`settle()` can be `Promise.resolve(this.promise)`; `unwrap()` etc. already build real promises when the inner one is a Promise). That alone restores `.catch`/`.finally` for free and costs nothing for consumers who only `await`. Additionally add `Pending.catch(fn)` or `Pending.rescue(fn: (reason: unknown) => Result<T, F>): Pending<T, E | F>` as the in-library recovery path, and document the `Result.fromPromise(pending).flatten()` idiom (with its `unknown`-widening caveat) in pending.md until then.

**Verifier note.** Runtime verified: `bun 01-basics.ts` -> `4. p instanceof Promise: false`, `typeof p.catch: undefined`, `typeof p.finally: undefined`; `bun 10-misc.ts` -> `4. settle() === settle() === .promise: true true` and `is that object a real Promise ... ? true`. My own `v789.ts` independently confirms `settle […truncated, full text in findings.json]

---

### `pending-runtime/pend-6` — Any value with a `then` method is silently assimilated by map, and a spec-noncompliant thenable produces a TypeError from inside pending.ts

**Severity:** medium · **Category:** correctness · **Verifier verdict:** confirmed

**Claim.** `Ok.map` (reached through `Pending.map`) uses `isThenable` (utils.ts) — 'object or function with a callable `then`'. A domain object that happens to expose `then` (query builders, lazy handles, some ORM/RPC clients) is therefore not stored in the `Ok`; it is subscribed to and replaced by whatever it resolves. Worse, `isThenable` only checks that `then` is callable, while `Pending`'s combinators require it to return a chainable thenable. A `then` that returns `undefined` — common in the wild and undetectable by `isThenable` — produces `TypeError: undefined is not an object (evaluating 'this.promise.then')` pointing at pending.ts:35, with no hint about the real cause. The same TypeError occurs for a `Pending` constructed directly over such a thenable, even though `await` of that very Pending works fine — so the constructor accepts inputs its own methods cannot handle.

<details><summary><strong>Empirical evidence</strong></summary>

`bun 02-thenable-values.ts`:
```
(a) map(()=>GoodQuery) -> settled ctor: Ok
(a) inner value: "assimilated!" instanceof GoodQuery: false
(b) THREW: TypeError undefined is not an object (evaluating 'this.promise.then')
(c) await of Pending over a non-compliant thenable: {"value":5}
(c) .map THREW: TypeError undefined is not an object (evaluating 'this.promise.then')
```
Case (c) is the sharpest: the same object is awaitable but not mappable. The type system is at least honest about (a) — `tsc --noErrorTruncation ... 08-reveal.ts` reveals `p.map(() => new Query())` is `Pending<string, string>`, i.e. the `Query` type is erased along with the value.

</details>

**Recommendation.** Two changes. (1) Harden the boundary: in `Pending`'s constructor (or lazily in `then`) reject/normalize a non-conforming thenable with a library error that names the problem, e.g. `Promise.resolve(promise)` internally so any awaitable input becomes chainable — this makes constructor-accepted inputs uniformly workable and costs one microtask. (2) Document the assimilation rule in `map`'s JSDoc: 'a returned value that is itself thenable is awaited, not stored — a `Result` cannot hold a thenable value.' Consider offering an explicit non-assimilating variant (e.g. `mapValue`) for callers who genuinely need to carry a thenable payload.

**Verifier note.** Both halves reproduce. `bun 02-thenable-values.ts` -> `(a) inner value: "assimilated!" instanceof GoodQuery: false`, `(b) THREW: TypeError undefined is not an object (evaluating 'this.promise.then')`, `(c) await of Pending over a non-compliant thenable: {"value":5}` then `(c) .map THREW: TypeError . […truncated, full text in findings.json]

---

### `constructors/ok-10` — wrap-a-throwing-function.md states the wrong inferred type: it is Settled<any, unknown>, not Result<unknown, unknown>

**Severity:** medium · **Category:** docs · **Verifier verdict:** confirmed

**Claim.** The how-to says of `const parsed = Result.try(() => JSON.parse(input))`: "`parsed` is `Result<unknown, unknown>`". It is actually `Settled<any, unknown>`. Two independent errors, and the `any` one matters: readers are told the success value is `unknown` (forcing a narrowing step) when it is in fact `any` and will silently accept `parsed.value.anything.at.all`. The same paragraph then says "Supply a type argument to narrow" (singular) while both type parameters must be supplied — partial application is a compile error because `E` has no default on the signature.

<details><summary><strong>Empirical evidence</strong></summary>

`bun x tsc ... .../doc-claims.ts` (reveal-to-never trick) →
```
factories/doc-claims.ts(9,7): error TS2322: Type 'Settled<any, unknown>' is not assignable to type 'never'.
```
and for the doc's suggested fix `Result.try<unknown, SyntaxError>(...)`:
```
factories/doc-claims.ts(13,7): error TS2322: Type 'Settled<unknown, SyntaxError>' is not assignable to type 'never'.
```
typecheck.ts (tsc exit 0) carries a live `// @ts-expect-error - Expected 2 type arguments, but got 1` on `Result.try<number>(() => 42)`. silent-lie.ts demonstrates the `any` consequence at runtime: `1f ok.value.port typed number, actual = undefined undefined` for input `'{"prot": 8080}'`.

</details>

**Recommendation.** Correct the sentence to `Settled<any, unknown>`, explicitly warn that `JSON.parse` returns `any` so the success type is unchecked (recommend `Result.try(() => JSON.parse(input) as unknown)`), and change "a type argument" to "both type arguments" — or give `E` a default of `unknown` on `resultTry`/`fromPromise` so `Result.try<MyType>(...)` actually works as the docs imply.

**Verifier note.** Doc text verified verbatim in wrap-a-throwing-function.md: '`parsed` is `Result<unknown, unknown>`. Supply a type argument to narrow:'. Re-ran tsc on doc-claims.ts: `error TS2322: Type 'Settled<any, unknown>' is not assignable to type 'never'` — so the real type is `Settled<any, unknown>`, wrong on  […truncated, full text in findings.json]

---

### `constructors/ok-6` — Result.try's PromiseLike overload declares Pending<T,E> but can return an Err at runtime, so .promise is undefined and .isPending() is false

**Severity:** medium · **Category:** correctness · **Verifier verdict:** adjusted

**Claim.** Overload 1 (`fn: () => PromiseLike<T>` → `Pending<T, E>`) is a total promise, but the implementation's `try` block encloses the `isThenable`/`fromPromise` call. If the thenable's `then` throws synchronously the catch fires and an `Err` is returned while the static type still says `Pending`. Code that legitimately relies on the declared type — reading `.promise`, calling `.isPending()`, passing it where a `Pending` is required — silently misbehaves. This is a *separate* soundness hole from ok-3 (which is about the sync overload), and it exists even for a value TypeScript correctly classifies as a `PromiseLike`.

<details><summary><strong>Empirical evidence</strong></summary>

`bun .../runtime3.ts` printed:
```
B4 Result.try typed Pending<> but runtime Err => declared Pending; runtime ctor=Err; isPending()=false; .promise=undefined
```
The declaration in that repro is `const p: Pending<number, unknown> = Result.try<number, unknown>(() => bad);` with `bad` annotated `PromiseLike<number>` — an explicit type annotation, accepted by tsc with no diagnostic.

</details>

**Recommendation.** After the `Promise.resolve` fix from ok-1, `fromPromise` can no longer throw, so hoist the thenable branch out of the `try` (or simply let `fromPromise` do the assimilation) and the overload becomes honest again. Add a test that `Result.try(() => hostileThenable).isPending()` is `true` and that it settles to `Err`.

**Verifier note.** Factually confirmed, including the part I expected to refute: the hostile value reaches overload 1 with no cast at the call site. My own probe `const q2: Pending<number, unknown> = Result.try<number, unknown>(() => ({ then(): never { throw new Error('then-threw') } }))` typechecks clean, because a ` […truncated, full text in findings.json]

---

### `constructors/ok-7` — No fromThrowable/wrap: Result.try cannot lift a throwing function into a reusable Result-returning function

**Severity:** medium · **Category:** ergonomics · **Verifier verdict:** adjusted

**Claim.** `Result.try` takes a zero-argument thunk only (arity 1, single parameter). There is no combinator that converts `(...args: A) => T` into `(...args: A) => Settled<T, E>`, so every call site must re-create a closure and re-assert `E`. neverthrow's `fromThrowable(fn, errorFn)` solves both problems at once: the wrapper is created once and `E` is *inferred* from `errorFn`'s return type rather than asserted. The absence of this is the structural reason ok-2 exists — there is no place to put an error mapper.

<details><summary><strong>Empirical evidence</strong></summary>

`bun .../runtime3.ts` → `G4 Result.try arity => Result.try.length=1, Result.do.length=1`. typecheck.ts (tsc exit 0) confirms nothing of the sort is exported: the markers `// @ts-expect-error - no fromThrowable / wrap helper` on `Result.fromThrowable(() => 1)` and `// @ts-expect-error - no fromSafePromise` on `Result.fromSafePromise(Promise.resolve(1))` are both *consumed* (an unused @ts-expect-error would have failed the file with TS2578 — as it did in an earlier revision of typecheck2.ts, proving the check is live). typecheck2.ts additionally shows the alternative infers cleanly: `declare function fromThrowableIdeal<A extends unknown[], T, E>(fn: (...a: A) => T, errorFn: (e: unknown) => E): (...a: A) => Settled<T, E>` with `const ideal = fromThrowableIdeal(JSON.parse, (e) => new SyntaxError(String(e)))` satisfies `Expect<Equal<ReturnType<typeof ideal>, Settled<any, SyntaxError>>>` — E d […truncated, full text in findings.json]

</details>

**Recommendation.** Add `Result.fromThrowable(fn, mapErr)` (sync) and `Result.fromAsyncThrowable(fn, mapErr)` (returns Pending), typed to infer `E` from `mapErr`. Recommend them in wrap-a-throwing-function.md as the primary API and demote bare `Result.try` to the one-off case.

**Verifier note.** Facts all check out. Source shows `resultTry(fn)` takes a single thunk parameter and the `Result` object is `{ try, fromPromise, do }`; runtime2 G1/G2 and runtime3 G4 confirm at runtime; typecheck.ts still exits 0 with live `// @ts-expect-error` markers on `Result.fromThrowable(() => 1)` and `Result […truncated, full text in findings.json]

---

### `constructors/ok-8` — The Result namespace exposes only try/fromPromise/do — no ok/err, fromNullable, fromSafePromise, or all/combine

**Severity:** medium · **Category:** api-surface · **Verifier verdict:** confirmed

**Claim.** `Result` is the documented home of the "static factory functions", yet the two most basic constructions are not there: users must reach for the `Ok`/`Err` classes and `new`. That forces two import styles in one file and produces inconsistent defaults (`new Ok(v)` is `Ok<T, never>`, `new Err(e)` is `Err<never, unknown>`, `Result.try(...)` is `Settled<T, unknown>`). Also absent: `fromNullable` (the null/undefined case currently just becomes `Ok(null)` / `Ok(undefined)`), `fromSafePromise` (a promise known not to reject — expressible today only as `Result.fromPromise<T, never>(p)`, which is the unsound lie from ok-2), and any `all`/`combine` for arrays of Results.

<details><summary><strong>Empirical evidence</strong></summary>

`bun .../runtime2.ts` printed:
```
G1 Result namespace keys => try,fromPromise,do
G2 Result.ok / Result.err exist? => ok=undefined err=undefined fromThrowable=undefined fromNullable=undefined all=undefined
D1 Result.try(() => null) => Ok(null)
D2 Result.try(() => undefined) => Ok(undefined)
```
typecheck.ts (tsc exit 0) has live `@ts-expect-error` markers on `Result.ok(1)`, `Result.err("e")`, `Result.fromNullable(null)`, `Result.fromSafePromise(...)` and `Result.all([])`. typecheck2.ts asserts the default divergence: `Expect<Equal<typeof new_ok, Ok<number, never>>>`, `Expect<Equal<typeof new_err, Err<never, string>>>`, `Expect<Equal<typeof try_ok, Settled<number, unknown>>>`.

</details>

**Recommendation.** Add `Result.ok` / `Result.err` as thin aliases so the namespace is self-sufficient and one import (`import { Result } from "antithrow"`) covers the whole surface. Add `Result.fromNullable(value, onNull)` and `Result.fromSafePromise(promise): Pending<T, never>` (the only sound way to express an infallible promise). `Result.all` is a bigger design question but its absence is conspicuous for a Result library at 3.0.

**Verifier note.** All sub-claims verified. runtime probe of my own: `Object.keys(Result)` => `["try", "fromPromise", "do"]`. runtime2 G2 confirms ok/err/fromThrowable/fromNullable/all are all undefined, and D1/D2 confirm `Result.try(() => null)` => `Ok(null)`. typecheck.ts exits 0 with live @ts-expect-error markers o […truncated, full text in findings.json]

---

### `constructors/ok-9` — A callback returning a union of two promise types is rejected outright, with a 25-line unreadable overload error

**Severity:** medium · **Category:** ergonomics · **Verifier verdict:** confirmed

**Claim.** The three-overload set handles `T | PromiseLike<T>` (one T) but not `PromiseLike<A> | PromiseLike<B>`. The everyday `Result.try(() => flag ? getNumber() : getText())` fails to compile with `TS2769: No overload matches this call`, and the diagnostic includes the line `Overload 2 of 3, '(fn: () => never)'` — an artifact of `NonThenable<T>` collapsing when T cannot be inferred — plus a full structural expansion of `Promise.then`. Explicit type arguments do rescue it, but nothing in the error hints at that.

<details><summary><strong>Empirical evidence</strong></summary>

`bun x tsc --noEmit --ignoreConfig --strict --allowImportingTsExtensions --moduleResolution bundler --module preserve --target es2022 --lib es2022,dom .../reveal3.ts` on `const t1 = Result.try(() => (flag ? getNumber() : getText()));`:
```
factories/reveal3.ts(9,29): error TS2769: No overload matches this call.
  Overload 1 of 3, '(fn: () => PromiseLike<string>): Pending<string, unknown>', gave the following error.
    Type 'Promise<string> | Promise<number>' is not assignable to type 'PromiseLike<string>'.
      ... (7 more lines of Promise.then structural expansion) ...
  Overload 2 of 3, '(fn: () => never): Settled<Promise<string> | Promise<number>, unknown>', gave the following error.
    Type 'Promise<string> | Promise<number>' is not assignable to type 'never'.
```
The same file shows the workarounds compile clean: `Result.try<number | string, Error>(() => flag ? getNumber() : getT […truncated, full text in findings.json]

</details>

**Recommendation.** Widen overload 1 to `fn: () => PromiseLike<T> | PromiseLike<T>` is a no-op; instead accept `fn: () => SyncOrAsync<T>` earlier and discriminate on `Awaited<ReturnType>` — e.g. reorder so a `[Extract<R, PromiseLike<unknown>>] extends [never]` / `[Exclude<R, PromiseLike<unknown>>] extends [never]` conditional on a single inferred `R` picks the return shape, rather than three separate call signatures. That yields one signature, correct results for unions of promise types, and a comprehensible error when it genuinely fails.

**Verifier note.** Reproduced independently in both files. reveal3.ts line 9 gives `error TS2769: No overload matches this call.` with the quoted overload lines, including the `Overload 2 of 3, '(fn: () => never): Settled<Promise<string> | Promise<number>, unknown>'` artifact from `NonThenable<T>` collapsing, and the  […truncated, full text in findings.json]

---

### `do-notation/od-10` — The documented remedy for throwing bodies — "use `Result.try`" — does not compose with `Result.do`: it nests, and flattening erases the error union

**Severity:** medium · **Category:** ergonomics · **Verifier verdict:** confirmed

**Claim.** `resultDo`'s JSDoc and `result.md` both say "Thrown exceptions are not converted to `Err`; use `Result.try` for throw-capturing behavior." Actually doing that yields `Settled<Settled<T,E>, unknown>` — a nested Result the user must remember to `.flatten()`. And `.flatten()` then unions the inner error type with `Result.try`'s `unknown`, collapsing the carefully-inferred `"missing"` union to `unknown` — the typed-error guarantee that is the library's entire premise is destroyed by following its own advice. For the async form it is worse: `Result.try(async () => Result.do(async function* () {...}))` gives `Pending<Settled<number, "missing">, unknown>`, a Pending of a Settled.

<details><summary><strong>Empirical evidence</strong></summary>

`bun x tsc --ignoreConfig --noEmit --strict … /tmp/.../result-do/05-compose.ts` →
```
05-compose.ts(31,7): error TS2322: Type 'Settled<Settled<number, "missing">, unknown>' is not assignable to type '0'.
05-compose.ts(40,7): error TS2322: Type 'Ok<number, unknown> | Err<number, unknown>' is not assignable to type '0'.
05-compose.ts(49,7): error TS2322: Type 'Pending<Settled<number, "missing">, unknown>' is not assignable to type '0'.
```
Line 31 = `Result.try(() => Result.do(...))`; line 40 = the same `.flatten()`ed, where `"missing"` has become `unknown`; line 49 = the async form.

</details>

**Recommendation.** Add a first-class throw-capturing variant rather than telling users to compose two combinators that do not compose — e.g. `Result.doTry(generator)` (or a `Result.do(generator, { catch: (e) => myError })` option) that wraps the `iter.next()`/`iter.return()` calls in try/catch and unions the mapped throw type into `E`. Failing that, the docs must show the full `Result.try(() => Result.do(...)).flatten()` incantation *and* warn that it widens `E` to `unknown`.

**Verifier note.** Reproduced exactly. 05-compose.ts:31 `Settled<Settled<number, "missing">, unknown>` for `Result.try(() => Result.do(...))`; :40 after `.flatten()` → `Ok<number, unknown> | Err<number, unknown>`, i.e. the inferred `"missing"` union is widened to `unknown`; :49 the async form → `Pending<Settled<number […truncated, full text in findings.json]

---

### `do-notation/od-4` — A `finally` block containing a `yield*` is silently truncated on fail-fast: cleanup after the yield never runs and the generator is abandoned mid-`finally`

**Severity:** medium · **Category:** correctness · **Verifier verdict:** confirmed

**Claim.** The documented guarantee is "On fail-fast exit, `resultDo` calls `iter.return()` to ensure `finally` blocks run" (result.ts:56). It only holds for `finally` blocks that contain no yield. If the cleanup path itself does `yield* someResult()` — a natural way to write "close the handle, and fail if closing failed" — `iter.return()` returns `{done: false, value: Err}`; `resultDo` discards that object entirely, so (a) the cleanup Err is silently swallowed, (b) statements after the yield in the `finally` never execute, and (c) the generator object is left permanently suspended inside its own `finally` (not closed), which defeats the whole point of the `iter.return()` call. Identical behaviour on the sync and async paths.

<details><summary><strong>Empirical evidence</strong></summary>

`bun /tmp/.../result-do/10-findings-repro.ts` →
```
F-2 result: Err("outer") trace: ["finally-enter"]
```
(`"finally-exit"`, the statement after the `yield*` in the `finally`, is absent). Generator-state proof, `bun /tmp/.../result-do/02-runtime2.ts` →
```
X first: Err("outer") done: false
X return(): done: false value: Err("in-finally")
X next() after return() THREW: Unreachable: generator should have been halted
```
`done: false` from `.return()` shows the generator was not closed. Async path, same file: `U Err("outer") ["finally-enter"]`.

</details>

**Recommendation.** Drain the return completion instead of firing and forgetting: loop `let r = iter.return?.(undefined as T); while (r && !r.done) r = iter.return?.(undefined as T);` (and the awaited equivalent on the async path). Better still, decide on a semantic — either an Err yielded from a `finally` overrides the original short-circuit (consistent with the success path, where a `finally`-yielded Err *does* become the result, see 06-runtime3 `AG -> Err("in-finally")`), or it is explicitly documented as ignored. The current behaviour is neither.

**Verifier note.** Reproduced on both paths. Sync: `F-2 result: Err("outer") trace: ["finally-enter"]` — the `finally-exit` push after the `yield*` never runs and the cleanup Err("cleanup") is discarded. Async: `U Err("outer") ["finally-enter"]`. Generator-state proof: `X return(): done: false value: Err("in-finally") […truncated, full text in findings.json]

---

### `do-notation/od-5` — A throwing `finally` during fail-fast destroys the short-circuit `Err` — the real error is replaced by the cleanup error

**Severity:** medium · **Category:** correctness · **Verifier verdict:** adjusted

**Claim.** `resultDo` calls `iter.return?.(undefined as T)` unguarded after it has already captured `next.value`. If the generator's `finally` throws (a failing `close()`, a `Symbol.dispose` that throws, an assertion in cleanup), that throw propagates out of `iter.return()` and the already-computed `Err` is discarded — the caller sees the cleanup error and loses the original failure entirely. Sync `Result.do` throws it; async `Result.do` rejects with it. Because `resultDo` deliberately does not convert throws to `Err`, this is a silent replacement of a typed, handled failure with an untyped, unhandled one.

<details><summary><strong>Empirical evidence</strong></summary>

`bun /tmp/.../result-do/10-findings-repro.ts` →
```
F-3 sync THREW: cleanup-failed -> Err('real-error') lost
F-3 async REJECTED: cleanup-failed -> Err('real-error') lost
```

</details>

**Recommendation.** Wrap the cleanup call so the short-circuit result always wins: `try { iter.return?.(undefined as T); } catch { /* cleanup failure must not mask the Err */ }` (and `await iter.return?.(...).catch(() => {})` on the async path). If losing the cleanup error is unacceptable, attach it to the returned `Err` (e.g. as `cause`) rather than replacing it. At minimum document that a throwing `finally` overrides the short-circuit.

**Verifier note.** Facts confirmed: result.ts:96/108 call `iter.return?.(undefined as T)` unguarded after `next.value` is already in hand, so a throwing finally preempts the return. `F-3 sync THREW: cleanup-failed`, `F-3 async REJECTED: cleanup-failed`, and independently `D3 THREW cleanup-failed` / `T REJECTED with as […truncated, full text in findings.json]

---

### `do-notation/od-6` — `return <a Result>` from a `do` body double-wraps into `Ok<Ok<…>>` — the exact shape neverthrow's `safeTry` requires

**Severity:** medium · **Category:** ergonomics · **Verifier verdict:** confirmed

**Claim.** `Result.do` unconditionally wraps the generator's return value in `new Ok(...)`, with no flattening. neverthrow's `safeTry` — which uses the *same* `yield*` protocol and is the obvious reference point for anyone adopting this API — requires the body to `return ok(x)`. Porting that habit here compiles and produces `Ok<Ok<number, "z">, never>` at both type and runtime level. It is only caught if the call site has an explicit annotation; with inference (the common case, e.g. returning it from a helper whose return type is also inferred) the nested `Ok` propagates silently until something far away fails or, worse, `.unwrap()` returns an `Ok` where a value was expected.

<details><summary><strong>Empirical evidence</strong></summary>

Runtime, `bun /tmp/.../result-do/10-findings-repro.ts` →
```
F-4: Ok({"value":1}) -> inner Ok(1)
```
Type level, `03-reveal.ts` via tsc → `error TS2322: Type 'Ok<Ok<number, "z">, never>' is not assignable to type '0'.` The mistake surfaces only with an annotation (`04-negative.ts` N8): `Type 'Ok<Ok<number, "z">, never>' is not assignable to type 'Result<number, "z">'. … Type 'Ok<number, "z">' is not assignable to type 'number'.`

</details>

**Recommendation.** Either flatten on return (wrap only when the returned value is not already a `Result`, mirroring `Ok.flatten()`), or — cheaper and fully type-safe — add a fifth overload that rejects a `Result` as `TReturn`: `function resultDo<T extends Result<unknown, unknown>>(g: () => Generator<never, T, void>): never` with a `@deprecated`-style error message, so `return new Ok(x)` fails fast with "do not return a Result from a `Result.do` body; return the value". Document the divergence from `safeTry` prominently in the migration/comparison page.

**Verifier note.** Reproduced at both levels. Runtime `F-4: Ok({"value":1}) -> inner Ok(1)` (and `E1`/`E2` in 01-runtime show the same for Ok and Err). Type level: 03-reveal.ts:52 `Ok<Ok<number, "z">, never>`; with an annotation 04-negative.ts:53 gives the readable `Type 'Ok<number, "z">' is not assignable to type 'nu […truncated, full text in findings.json]

---

### `do-notation/od-7` — A sync `do` body returning a promise is not upgraded to `Pending` — you get `Ok<Promise<T>>`, breaking the library's own "promises upgrade to Pending" rule

**Severity:** medium · **Category:** consistency · **Verifier verdict:** confirmed

**Claim.** Everywhere else in the API, a callback that returns a promise upgrades the result to `Pending`: `Ok.map`, `Err.mapErr`, and `Result.try` all check `isThenable` and wrap. `Result.do` does not — a sync generator whose body returns a promise produces `Ok<Promise<T>, never>` holding a raw, un-awaited promise. This is a one-character mistake away from correct code (forgetting `async` on `function*`), it type-checks, and the promise silently escapes the Result world; if it later rejects, that is an unhandled rejection with no connection to the `do` block.

<details><summary><strong>Empirical evidence</strong></summary>

Runtime, `bun /tmp/.../result-do/10-findings-repro.ts` →
```
F-5: Ok({}) value instanceof Promise: true
```
Type level, `04-negative.ts` N6 via tsc → `error TS2322: Type 'Ok<Promise<number>, never>' is not assignable to type '0'.` Compare N7 (`async function*` returning a promise) → `Pending<number, never>`, i.e. correctly awaited.

</details>

**Recommendation.** Apply the same `isThenable(next.value)` check the rest of the library uses on the sync path's return value and upgrade to `Pending` — that makes `Result.do` obey the documented library-wide rule. If auto-upgrade is undesirable for a fail-fast primitive, constrain the sync overloads' `T` with `NonThenable<T>` so `return somePromise()` from a plain generator is a compile error pointing at `async function*`.

**Verifier note.** Reproduced. Runtime `F-5: Ok({}) value instanceof Promise: true` (also `AJ -> Ok({}) value is a Promise? true`); type level 04-negative.ts:44 `Ok<Promise<number>, never>` vs :50 `Pending<number, never>` for the async form. The consistency premise checks out: ok.ts:48, err.ts:45 and result.ts:38 all  […truncated, full text in findings.json]

---

### `do-notation/od-8` — `yield* err` is not a control-flow terminator for TypeScript, so guard-then-fail bodies lose narrowing — and the docs teach the non-terminating form

**Severity:** medium · **Category:** ergonomics · **Verifier verdict:** adjusted

**Claim.** `Err[Symbol.iterator]` is typed `Generator<Err<T,E>, never, void>`, so `yield* err` has type `never` — but TypeScript only treats `never` as unreachable for *call* expressions, not for `yield*`. The idiomatic guard `if (x === null) { yield* new Err("not-found"); }` therefore compiles but leaves `x` un-narrowed afterwards, producing errors like TS18047 that push users toward `!` or `as`. A control test with an identical `never`-returning function call *does* narrow, confirming the asymmetry is specific to `yield*`. The idiom that works (`return yield* new Err(...)`) appears nowhere in the JSDoc or the docs site; `apps/docs/docs/how-to/std/fetch-json-safely.md` in fact ships the non-terminating form (`if (!res.ok) { yield* new Err({...}) }`), which happens to compile there only because nothing after it needs narrowing.

<details><summary><strong>Empirical evidence</strong></summary>

`bun x tsc --ignoreConfig --noEmit --strict … /tmp/.../result-do/09-narrowing.ts` →
```
09-narrowing.ts(12,9): error TS18047: 'user' is possibly 'null'.
09-narrowing.ts(23,7): error TS2322: Type 'Settled<string, "db-down" | "not-found">' is not assignable to type '0'.
```
Line 12 is the bare `yield* new Err(...)` guard; line 23 is the `return yield* new Err(...)` version, which type-checks cleanly and infers the correct error union. The control (H3, `fail()` returning `never`, line 31) produces **no** error — narrowing works there.

</details>

**Recommendation.** Document `return yield* new Err(...)` as the canonical failure statement everywhere (JSDoc `@example`, `use-result-do.md`, `fetch-json-safely.md`), and add an `@antithrow/eslint-plugin` rule (the package already has `no-unsafe-unwrap`, `no-unused-result`, `no-throwing-call` but nothing for do-notation) that flags a `yield*`-on-an-`Err` expression statement that is not in return position.

**Verifier note.** Core claim confirmed: 09-narrowing.ts:12 `error TS18047: 'user' is possibly 'null'` for the bare `yield* new Err(...)` guard; the `return yield*` form at line 19 type-checks and infers `Settled<string, "db-down" | "not-found">` (line 23); the control `fail(): never` at line 30 emits no error, so the […truncated, full text in findings.json]

---

### `do-notation/od-9` — Anything typed as the full `Result<T, E>` union — including `Result.try`'s general overload and `@antithrow/std`'s `fetch` — is unusable in a sync `Result.do`

**Severity:** medium · **Category:** ergonomics · **Verifier verdict:** confirmed

**Claim.** `Symbol.iterator` lives only on `Ok` and `Err`, not on `ResultBase`/`Pending`, so `yield*` over a `Result<T,E>` union is a hard type error in a plain generator. That means any helper whose declared return type is `Result<T,E>` — which is exactly what `Result.try(fn: () => SyncOrAsync<T>)` produces and what shipped helpers like `@antithrow/std`'s `fetch` return (`Result<Response, DOMException | TypeError>`) — forces the caller into `async function*`, which forces the whole block to become `Pending` and the caller to `await` it, even when every step is synchronous. The diagnostic the user gets ("Type 'Result<…>' must have a '[Symbol.iterator]()' method") gives no hint that `async function*` is the fix.

<details><summary><strong>Empirical evidence</strong></summary>

`bun x tsc --ignoreConfig --noEmit --strict … /tmp/.../result-do/05-compose.ts` →
```
05-compose.ts(12,19): error TS2488: Type 'Result<{ id: number; }, "bad-json">' must have a '[Symbol.iterator]()' method that returns an iterator.
05-compose.ts(22,7): error TS2322: Type 'Pending<number, "missing">' is not assignable to type '0'.
```
Line 22 is a do-block whose only step is a synchronous `Settled`-returning helper — writing it as `async function*` (the only way to accept `Result`-typed helpers) makes it `Pending`. `packages/std/src/fetch.ts:20` returns `Result<Response, DOMException | TypeError>`; `packages/std/src/uri.ts:74` returns `Settled<string, URIError>`, so which std helpers work in a sync `do` is effectively arbitrary from the caller's point of view.

</details>

**Recommendation.** Give `Pending` a `[Symbol.iterator]` that throws a directed error ("cannot `yield*` a Pending from a synchronous generator — use `async function*`") and declare it on `ResultBase`, so the union becomes yieldable at the type level and the failure mode is a readable runtime message instead of TS2488 on a union. Alternatively, document in `use-result-do.md` that a `Result`-typed value requires an async `do` block, and prefer `Settled` return types in `@antithrow/std` wherever the wrapped global is synchronous.

**Verifier note.** Reproduced: 05-compose.ts:12 `error TS2488: Type 'Result<{ id: number; }, "bad-json">' must have a '[Symbol.iterator]()' method`, and 04-negative.ts:18 the same for a `Result<number,"r">` union. Source confirms Symbol.iterator exists only on Ok (ok.ts:132) and Err (err.ts:121); Pending has only Symb […truncated, full text in findings.json]

---

### `types-overloads/ok-11` — settle() and Pending return PromiseLike, so there is no .catch or .finally — yet the docs say callback throws are not caught

**Severity:** medium · **Category:** ergonomics · **Verifier verdict:** confirmed

**Claim.** Every JSDoc block on the mapping methods carries `@throws Errors thrown by \`fn\` are not caught.` For a `Pending` receiver those throws surface as a *rejected promise* inside `settle()`/`then()`. But `settle()` is declared `PromiseLike<Settled<T,E>>` and `Pending` implements only `PromiseLike`, so `.catch()` and `.finally()` do not exist on either. The only way to handle the documented failure mode without `try/await` is `Promise.resolve(r.settle()).catch(...)` or a two-argument `.then(onOk, onRejected)` — neither is mentioned anywhere.

<details><summary><strong>Empirical evidence</strong></summary>

From negative.ts (all three markers fire, tsc exit=0):
  // @ts-expect-error
  res.settle().catch(() => {});
  // @ts-expect-error
  pen.catch(() => {});
  // @ts-expect-error
  res.settle().finally(() => {});
Declared types confirmed in assertions.ts:
  type F1 = Expect<Equal<typeof s1, PromiseLike<Ok<number, string>>>>;      // ok.settle()
  type F2 = Expect<Equal<typeof s2, PromiseLike<Settled<number, string>>>>; // res.settle()

</details>

**Recommendation.** Change `settle()` to return `Promise<Settled<T,E>>` (the implementations already return real promises — `Ok.settle` returns `Promise.resolve(this)`, `Pending.settle` returns `this.promise` which is whatever was constructed). If `PromiseLike` must stay for the constructor's input type, at minimum declare `settle(): Promise<...>` on the classes and add a `catch`/`finally` passthrough on `Pending`. Failing that, the `@throws` JSDoc on `map`/`mapErr`/`andThen`/`orElse`/`mapOr`/`mapOrElse`/`unwrapOrElse` should say explicitly how to catch on the async path.

**Verifier note.** Reproduced. negative.ts exit=0 so all three markers fire — `res.settle().catch`, `pen.catch`, `res.settle().finally` are all type errors; assertions.ts F1/F2 pin settle() to PromiseLike<Ok<...>> / PromiseLike<Settled<...>> (base.ts:246, ok.ts:127, err.ts:117, pending.ts:126) and Pending only impleme […truncated, full text in findings.json]

---

### `types-overloads/ok-2` — map/mapErr cannot round-trip through Result<T,E> in a generic function — writing your own combinator requires a cast

**Severity:** medium · **Category:** type-safety · **Verifier verdict:** adjusted

**Claim.** Inside any generic helper `function f<T,E>(r: Result<T,E>): Result<T,E>`, `r.map(v => v)` does not type-check. `Ok.map`'s conditional `U extends PromiseLike<infer A> ? Pending<A,E> : Ok<U,E>` stays deferred when `U` is an unresolved type parameter, and TypeScript's constraint for that deferred conditional is `Ok<T,E> | Pending<unknown,E>` — the spurious `Pending<unknown,E>` member is not assignable to `Pending<T,E>`. `mapErr` fails identically with `Pending<T,unknown>`. Neither an explicit type argument (`r.map<T>(...)`) nor constraining `T` (`T extends string`) works around it; only a concrete `T` (e.g. `Result<number,E>`) compiles. This blocks the ordinary library-author patterns — `tap`, `retry`, `withLogging`, middleware, generic pipe helpers — without an `as` cast.

<details><summary><strong>Empirical evidence</strong></summary>

$ cd /tmp/claude-0/-home-user-antithrow/6fa15e49-ae6b-5bd4-b03a-8a3385b537f3/scratchpad/type-overloads && ./run-tsc.sh reveal6.ts
reveal6.ts(9,8): error TS2322: Type 'Ok<T, E> | Pending<unknown, E>' is not assignable to type 'never'.
reveal6.ts(12,8): error TS2322: Type 'Ok<T, E> | Err<T, E> | Pending<T, E> | Pending<unknown, E>' is not assignable to type 'never'.
reveal6.ts(18,2): error TS2322: Type 'Err<T, E> | Pending<T, E> | (T extends PromiseLike<infer A> ? Pending<A, E> : Ok<T, E>)' is not assignable to type 'Result<T, E>'.
  ...
      Type 'Pending<unknown, E>' is not assignable to type 'Result<T, E>'.
        Type 'Pending<unknown, E>' is not assignable to type 'Pending<T, E>'.
          Type 'unknown' is not assignable to type 'T'.
reveal6.ts(28,2): error TS2322: ... 'E extends PromiseLike<infer A> ? Pending<T, A> : Err<T, E>' is not assignable to type 'Result<T, E>' ... Type 'P […truncated, full text in findings.json]

</details>

**Recommendation.** Replace the bare conditional with an `Exclude`/`Extract` split, which resolves cleanly for a naked type parameter. Prototyped in fixproto.ts (tsc exit 0):

  type MapOk<U, E> =
    | (Exclude<U, PromiseLike<unknown>> extends never ? never : Ok<Exclude<U, PromiseLike<unknown>>, E>)
    | (Extract<U, PromiseLike<unknown>> extends never ? never : Pending<Awaited<Extract<U, PromiseLike<unknown>>>, E>);

fixproto.ts shows this keeps `Ok<number,string>` for a sync callback, `Pending<number,string>` for an async one, `Ok<string,string> | Pending<string,string>` for a `string | Promise<string>` callback, AND makes the generic `tap<T,E>` round-trip compile. Whatever fix is chosen, add a regression test of the shape `function id<T,E>(r: Result<T,E>): Result<T,E> { return r.map(v => v); }` — the existing type tests only exercise concrete `T`.

**Verifier note.** Facts fully reproduce. reveal6.ts gives verbatim: line 9 'Ok<T, E> | Pending<unknown, E>', line 18 '...Type Pending<unknown,E> is not assignable to Pending<T,E>', line 28 the mapErr mirror 'Pending<T, unknown>'; reveal6 line 22-24 (`helper<E>(r: Result<number,E>)`) produces no error, confirming conc […truncated, full text in findings.json]

---

### `types-overloads/ok-3` — `or` keeps the receiver's error type while `orElse` discards it — `.or()` is unusable for error recovery on a Result union

**Severity:** medium · **Category:** consistency · **Verifier verdict:** adjusted

**Claim.** `Ok.or` returns `Ok<T,E>` and `Pending.or` returns `Pending<T, E | InferErr<R>>`, i.e. the receiver's error type `E` survives. But `Ok.orElse` returns `Ok<T, InferErr<R>>` and `Pending.orElse` returns `Pending<T, InferErr<R>>` — `E` is dropped. The runtime semantics of the two are identical (on `Err`, the receiver's error is thrown away and the replacement is returned), so `or`'s retained `E` arm is unreachable. The consequence is asymmetric and user-visible: `res.orElse(recover)` narrows a `Result<number,string>` cleanly to `Result<number,boolean>`, while `res.or(fallback)` produces `Ok<number, string> | Result<number, boolean> | Pending<number, string | boolean>`, which is NOT assignable to `Result<number, boolean>`. The abstract base has the same split baked in (`or<F>(result): Result<T, E|F>` vs `orElse<F>(fn): Result<T, F>`).

<details><summary><strong>Empirical evidence</strong></summary>

$ ./run-tsc.sh reveal3.ts   (lines 60-79)
reveal3.ts(60,7): Type 'Ok<number, string>' ...            <- ok.or(fallback)      : E kept
reveal3.ts(62,7): Type 'Pending<number, string | boolean>' <- pen.or(fallback)    : E kept
reveal3.ts(63,7): Type 'Ok<number, string> | Result<number, boolean> | Pending<number, string | boolean>'  <- res.or(fallback)
reveal3.ts(74,7): Type 'Ok<number, boolean>' ...           <- ok.orElse(recover)  : E dropped
reveal3.ts(76,7): Type 'Pending<number, boolean>' ...      <- pen.orElse(recover) : E dropped
reveal3.ts(77,7): Type 'Result<number, boolean>' ...       <- res.orElse(recover) : clean

negative.ts pins the assignability difference (both markers behave as declared, exit=0):
  export const viaOrElse: Result<number, boolean> = res.orElse(recover);   // OK
  // @ts-expect-error
  export const viaOr: Result<number, boolean> = res.or(fallback);          // […truncated, full text in findings.json]

</details>

**Recommendation.** Make `or` mirror `orElse`: `Ok.or<R extends Result<T, unknown>>(result: R): Ok<T, InferErr<R>>` and `Pending.or<R extends Result<T, unknown>>(result: R): Pending<T, InferErr<R>>`, and change the abstract signature to `or<F>(result: Result<T, F>): Result<T, F>`. This is a breaking type change but it is the type that matches the implementation, and it makes `.or()` usable as an error-recovery combinator on a union. (While there, note `Ok.or`'s generic `R` is inferred and then never used in the return type — after this change it becomes load-bearing.)

**Verifier note.** Every stated type reproduces. reveal3.ts: line 60 `ok.or(fallback)` => Ok<number,string>; line 62 `pen.or(fallback)` => Pending<number,string|boolean>; line 63 `res.or(fallback)` => 'Ok<number,string> | Result<number,boolean> | Pending<number,string|boolean>'; line 74 `ok.orElse(recover)` => Ok<numb […truncated, full text in findings.json]

---

### `types-overloads/ok-4` — On the Result union, `.map()` with a `T | Promise<T>` callback produces a 4-member union that is not a Result<T,E> — Err.map leaks Promise into its phantom ok-type

**Severity:** medium · **Category:** type-safety · **Verifier verdict:** confirmed

**Claim.** `Err.map<U>(_fn: (value: T) => U | PromiseLike<U>): Err<U, E>` has no way to strip a promise out of a union return. Called directly on an `Err<number,string>` with `(x: number) => string | Promise<string>`, inference picks `U = string` and yields the correct `Err<string,string>`. But when the same call is made on the `Result<number,string>` union, the members' signatures are combined and the `Err` branch resolves with `U = string | Promise<string>`, producing `Err<string | Promise<string>, string>` and `Pending<string | Promise<string>, string>` alongside the correct `Ok<string,string> | Pending<string,string>`. The four-member result is not assignable to `Result<string,string>`, so any function returning `Result<string,string>` breaks the moment its callback's return type widens to include a promise.

<details><summary><strong>Empirical evidence</strong></summary>

Locked in assertions.ts (compiles clean, tsc exit=0):
  const m9 = res.map(maybeAsync);   // maybeAsync: (x:number) => string | Promise<string>
  type A9 = Expect<Equal<typeof m9,
      | Ok<string, string>
      | Pending<string, string>
      | Err<string | Promise<string>, string>
      | Pending<string | Promise<string>, string>>>;
$ ./run-tsc.sh assertions.ts; echo exit=$?  ->  exit=0

And the non-assignability, from negative.ts (marker fires, exit=0):
  // @ts-expect-error Err branch keeps `Promise<string>` in its phantom ok-type
  export const leak: Result<string, string> = res.map(maybeAsync);

Original reveal (reveal1.ts line 38):
  Type 'Ok<string, string> | Pending<string, string> | Err<string | Promise<string>, string> | Pending<string | Promise<string>, string>' is not assignable to type 'never'.

Runtime is correct in both branches ($ bun runtime1.ts):
  ok(2).map(un) -> Ok […truncated, full text in findings.json]

</details>

**Recommendation.** Give `Err.map` the same overload ladder as `Ok.map` so the promise arm is peeled off explicitly, e.g. `map<U>(fn: (value: T) => PromiseLike<U>): Err<U, E>; map<U>(fn: (value: T) => U): Err<Awaited<U>, E>;` — or simply declare the return as `Err<Awaited<U>, E>`, since `Err`'s `T` is phantom and can never legitimately hold a promise produced by a mapper. The `Exclude`/`Extract` split from ok-2 applied uniformly across all three classes also fixes this.

**Verifier note.** Reproduced. assertions.ts compiles clean (exit=0) with A9 pinning `res.map(maybeAsync)` to exactly 'Ok<string,string> | Pending<string,string> | Err<string|Promise<string>,string> | Pending<string|Promise<string>,string>'; reveal1.ts line 38 shows the same 4-member union. negative.ts exit=0 so the ` […truncated, full text in findings.json]

---

### `types-overloads/ok-5` — `NoInfer` on mapOr's defaultValue exists only on Ok — Err and Pending accept widening defaults that Ok rejects

**Severity:** medium · **Category:** consistency · **Verifier verdict:** confirmed

**Claim.** `Ok.mapOr` declares `defaultValue: NoInfer<U>` on all three of its overloads; `Err.mapOr` and `Pending.mapOr` declare a plain `defaultValue: U`. This is not just a diagnostic-message difference — it changes acceptance. `ok.mapOr(null, _x => "s")` is rejected (U is pinned to `string` by the callback, `null` is not assignable). The identical call on an `Err` or `Pending` is accepted, inferring `U = string | null`. So the same source line compiles or fails depending on which concrete class the receiver is narrowed to, and on the `Result` union it fails only because of the `Ok` member. The mismatched-types case also produces two completely different errors depending on the receiver: on `Ok` the diagnostic blames `defaultValue`, on `Err`/`Pending` it blames the callback.

<details><summary><strong>Empirical evidence</strong></summary>

From assertions.ts (compiles clean, exit=0):
  const o3 = err.mapOr(null, (_x) => "s");
  type B3 = Expect<Equal<typeof o3, string | null>>;   // Err ACCEPTS the widening default
From negative.ts (marker fires, exit=0):
  // @ts-expect-error Ok rejects a default that widens U
  ok.mapOr(null, (_x) => "s");
  err.mapOr(null, (_x) => "s");   // no error
  pen.mapOr(null, (_x) => "s");   // no error

Divergent diagnostics for the same mismatch ($ ./run-tsc.sh reveal2.ts):
  reveal2.ts(29,15): TS2769 No overload matches this call.  [ok.mapOr(0, _x => "str")]
      Overload 2 of 3, '(defaultValue: string, fn: (value: number) => string): string' ...
        Argument of type 'number' is not assignable to parameter of type 'string'.
  reveal2.ts(30,33): TS2322: Type 'string' is not assignable to type 'SyncOrAsync<0>'.   [err.mapOr]
  reveal2.ts(31,33): TS2322: Type 'string' is not assignable to  […truncated, full text in findings.json]

</details>

**Recommendation.** Pick one policy and apply it to all three classes plus the abstract signature in base.ts (which also lacks `NoInfer`). Recommended: keep `NoInfer` (it gives the better "your default doesn't match your mapper" error) and add it to `Err.mapOr`, `Pending.mapOr`, and `ResultBase.mapOr`. Then document in the `mapOr` JSDoc that `defaultValue` must match the mapper's return type exactly and that a widening default requires an explicit type argument — `ok.mapOr<string | null>(null, _x => "s")` works and is currently undiscoverable (verified: yields `string | null`, assertions in reveal8.ts line 39).

**Verifier note.** Reproduced and source-checked. ok.ts:60-62 carries NoInfer<U> on all three mapOr overloads; err.ts:52 and pending.ts:64 declare a plain `defaultValue: U`; base.ts:96 also lacks it. The acceptance difference is real, not cosmetic: negative.ts exit=0 (so `ok.mapOr(null, _x => "s")` errors while the id […truncated, full text in findings.json]

---

### `types-overloads/ok-6` — unwrapOr's parameter is exactly `T` — no widening default and, unlike unwrapOrElse, no async default

**Severity:** medium · **Category:** ergonomics · **Verifier verdict:** adjusted

**Claim.** `unwrapOr(value: T)` on all three classes takes exactly `T`, with no `NoInfer`, no widening, and no `SyncOrAsync`. Two consequences: (1) `res.unwrapOr(null)` on a `Result<number,string>` is rejected, forcing the caller to widen the whole Result to `Result<number|null, string>` or annotate at the call site, where every comparable library returns `T | U`; (2) `res.unwrapOr(Promise.resolve(1))` is rejected even though `unwrapOrElse` explicitly accepts an async fallback (`Err.unwrapOrElse(fn: (error: E) => PromiseLike<T>): PromiseLike<T>`) and every other method in the API is `SyncOrAsync`-tolerant. `unwrapOr` is the single sync-only hole in an otherwise uniformly sync-or-async surface.

<details><summary><strong>Empirical evidence</strong></summary>

From negative.ts (all markers fire, exit=0):
  // @ts-expect-error
  res.unwrapOr(null);
  // @ts-expect-error
  res.unwrapOr(Promise.resolve(1));
  res.unwrapOrElse(async () => 1);   // accepted

Raw diagnostics ($ ./run-tsc.sh reveal4.ts):
  reveal4.ts(39,25): error TS2345: Argument of type 'null' is not assignable to parameter of type 'number'.
  reveal4.ts(41,25): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.
  reveal4.ts(44,25): error TS2345: Argument of type 'Promise<number>' is not assignable to parameter of type 'number'.

And from assertions.ts: `res.unwrapOr(0)` => `number | PromiseLike<number>`; `err.unwrapOrElse(async () => 0)` => `PromiseLike<number>`; `ok.unwrapOrElse(async () => 0)` => `number` (correct — Ok never calls the fn; confirmed at runtime by `bun runtime1.ts`: "=== unwrapOrElse async on Ok (static: number) === runtime: n […truncated, full text in findings.json]

</details>

**Recommendation.** Widen to `unwrapOr<U = T>(value: U): SyncOrAsync<T | U>` with per-class precision (`Ok.unwrapOr<U>(_value: U): T`, `Err.unwrapOr<U>(value: U): U`, `Pending.unwrapOr<U>(value: SyncOrAsync<U>): PromiseLike<T | U>`), matching what `unwrapOrElse` already permits. At minimum accept `SyncOrAsync<T>` so the async story is consistent; if the strict-`T` behaviour is intentional (Rust parity), say so in the JSDoc, because nothing currently signals it.

**Verifier note.** The mechanics reproduce exactly: unwrapOr is `(_value: T): T` on Ok (ok.ts:119), `(value: T): T` on Err (err.ts:106), `(value: T): PromiseLike<T>` on Pending (pending.ts:118) and `(value: T): SyncOrAsync<T>` on base (base.ts:219) — no NoInfer, no widening, no SyncOrAsync. reveal4.ts(39,25)/(41,25)/( […truncated, full text in findings.json]

---

### `types-overloads/ok-7` — base.ts @example blocks state the wrong result types for andThen, or, and orElse

**Severity:** medium · **Category:** docs · **Verifier verdict:** confirmed

**Claim.** Three of the `@example` blocks in base.ts assert result types that TypeScript does not produce, and one of them (`or`) documents behaviour opposite to what the implementation does. Transcribing the examples verbatim: base.ts:129-130 `result.andThen((value) => new Ok(value * 2))` is documented as `Ok<number, string>` but infers `Ok<number, never>`; base.ts:152 `result.or(fallback)` is documented as `Ok<number, string | boolean>` but infers `Ok<number, boolean>` — i.e. the doc claims the receiver's `string` survives, which is exactly the arm the implementation drops (and yet, per ok-3, `Ok.or`/`Pending.or` DO wrongly keep it, so the doc is wrong in both directions); base.ts:167-168 `result.orElse((error) => new Ok(0))` is documented as `Ok<number, string>` but infers `Ok<number, never>`. Separately, base.ts:83 writes "the result becomes {@link PromiseLike}" — `PromiseLike` is a lib global, not a project symbol, so the link cannot resolve in generated docs.

<details><summary><strong>Empirical evidence</strong></summary>

docs.ts transcribes each @example verbatim and reveals the real type.
$ cd /tmp/claude-0/-home-user-antithrow/6fa15e49-ae6b-5bd4-b03a-8a3385b537f3/scratchpad/type-overloads && ./run-tsc.sh docs.ts
  docs.ts(7,7):  Type 'Ok<number, string>' ...                 map      -> matches doc
  docs.ts(12,7): Type 'Err<number, Error>' ...                 mapErr   -> matches doc
  docs.ts(17,7): Type 'Ok<number, never>' ...                  andThen  -> doc says Ok<number, string>   MISMATCH
  docs.ts(23,7): Type 'Ok<string, string>' ...                 and      -> matches doc
  docs.ts(29,7): Type 'Ok<number, boolean>' ...                or       -> doc says Ok<number, string|boolean>   MISMATCH
  docs.ts(34,7): Type 'Ok<number, never>' ...                  orElse   -> doc says Ok<number, string>   MISMATCH
  docs.ts(39,7): Type 'Ok<number, string | boolean> | Err<...> | Pending<...>'  flatten -> m […truncated, full text in findings.json]

</details>

**Recommendation.** Correct the three comments to `Ok<number, never>`, `Ok<number, boolean>`, and `Ok<number, never>` respectively — or, better, annotate the example callbacks (`(value) => new Ok<number, string>(value * 2)`) so the documented type is actually produced. Change `{@link PromiseLike}` to plain `` `PromiseLike` `` or `{@link Pending}`. Consider adding docs.ts-style transcriptions of the `@example` blocks to the type-test suite so doc drift is caught by `bun lint:types`.

**Verifier note.** All three mismatches reproduce, and I checked docs.ts transcribes the @example blocks faithfully against base.ts. base.ts:129-130 documents `Ok<number, string>` for `result.andThen(value => new Ok(value*2))`; actual is Ok<number, never> (docs.ts(17,7)). base.ts:152 documents `Ok<number, string | boo […truncated, full text in findings.json]

---

### `types-guards-variance/gv-3` — `Err<T = never, E = unknown>`: `new Err<string>("boom")` compiles and silently types `.error` as `unknown`

**Severity:** medium · **Category:** ergonomics · **Verifier verdict:** adjusted

**Claim.** `Ok`'s first type parameter is the value and `Err`'s first type parameter is also the value (phantom, defaulted to `never`), so the one-argument forms `Ok<string>` and `Err<string>` mean structurally opposite things to a reader. Because `Err`'s *second* parameter defaults to `unknown` (not `never`, unlike `Ok`'s `E = never`), the very natural `new Err<string>("boom")` type-checks — `unknown` swallows the argument — and yields `Err<string, unknown>` whose `.error` is `unknown`. The user has silently lost their error type and gained a phantom ok-type. `const e2: Err<string> = new Err(42)` also compiles.

<details><summary><strong>Empirical evidence</strong></summary>

08-defaults.ts — `bun x tsc --ignoreConfig --noEmit --strict ... 08-defaults.ts` → exit 0, i.e. every assertion below holds:
```ts
type _2 = Expect<Equal<Err<string>, Err<string, unknown>>>;
const e = new Err<string>("boom");
type _3 = Expect<Equal<typeof e, Err<string, unknown>>>;
type _4 = Expect<Equal<typeof e.error, unknown>>;
// @ts-expect-error `unknown` is not assignable to string -- silently lost the error type
const lost: string = e.error;
const e2: Err<string> = new Err(42);   // accepted
type _5 = Expect<Equal<typeof e2, Err<string, unknown>>>;
```
(The `@ts-expect-error` fired, confirming `.error` really is `unknown`.)

</details>

**Recommendation.** Two independent fixes, both breaking but cheap: (1) change `Err`'s default to `Err<out T = never, out E = never>` so `new Err<string>("boom")` becomes a compile error instead of a silent `unknown` — `never` is the correct "unspecified" default and matches `Ok<T, E = never>`; (2) better, reorder to `Err<out E = unknown, out T = never>` so the first type argument of every class names the payload that class actually carries, making `Err<string>` mean what every user reads it as. If reordering is too disruptive, at minimum document the ordering prominently and add an `Err`-only alias (e.g. `type Fail<E> = Err<never, E>`).

**Verifier note.** Every factual assertion holds — 08-defaults.ts compiles at exit 0, so `Err<string>` really is `Err<string, unknown>`, `new Err<string>("boom")` really compiles with `.error: unknown` (the `@ts-expect-error` on `const lost: string = e.error` fires), and `const e2: Err<string> = new Err(42)` is accept […truncated, full text in findings.json]

---

### `types-guards-variance/gv-4` — Impossible guard branches narrow to uninhabitable intersections instead of `never`, so dead code type-checks silently (no discriminant property)

**Severity:** medium · **Category:** correctness · **Verifier verdict:** confirmed

**Claim.** `Ok`/`Err`/`Pending` carry no literal discriminant field, so TypeScript relates them only structurally. When a `this is X` predicate names a class that is not in the declared union, TS produces an intersection rather than `never`. Consequently `settled.isPending()` on a `Settled<T, E>` (the type you get from `await result.settle()`) narrows to `(Ok<T,E> & Pending<T,E>) | (Err<T,E> & Pending<T,E>)`, and the branch body type-checks as if inhabited — you can even assign it to `PromiseLike<Settled<T,E>>`. Same for `okValue.isErr()` → `Ok<T,E> & Err<T,E>` and `pending.isOk()` → `Pending<T,E> & Ok<T,E>`. A statically-impossible branch is never flagged.

<details><summary><strong>Empirical evidence</strong></summary>

02b-reveal.ts (types revealed by assigning to `0`), `bun x tsc --ignoreConfig --noEmit --strict ... 02b-reveal.ts`:
```
02b-reveal.ts(6,8): error TS2322: Type 'Settled<number, string> & Pending<number, string>' is not assignable to type '0'.
  Type 'Ok<number, string> & Pending<number, string>' is not assignable to type '0'.
02b-reveal.ts(11,8): error TS2322: Type 'Ok<number, string> & Err<number, string>' is not assignable to type '0'.
02b-reveal.ts(16,8): error TS2322: Type 'Err<number, string> & Ok<number, string>' is not assignable to type '0'.
02b-reveal.ts(21,8): error TS2322: Type 'Pending<number, string> & Ok<number, string>' is not assignable to type '0'.
```
01-narrowing.ts additionally shows `Expect<Equal<typeof s, never>>` failing for the `Settled.isPending()` branch: `01-narrowing.ts(70,20): error TS2344: Type 'false' does not satisfy the constraint 'true'.`

</details>

**Recommendation.** Add a public readonly literal discriminant to each class — e.g. `readonly type: "ok"` / `"err"` / `"pending"` (or `_tag`). It costs one field, makes `Result` a proper discriminated union, gives `switch (r.type)` exhaustiveness, makes impossible branches narrow to `never`, and (see gv-5) makes negated filters narrow. The `is*()` methods can stay as the ergonomic front door.

**Verifier note.** Reproduced exactly. 02b-reveal.ts gives the four claimed TS2322s verbatim, including `Settled<number,string> & Pending<number,string>` and `Ok<number,string> & Err<number,string>`. 01-narrowing.ts(70,20) fails the `Equal<typeof s, never>` assertion as stated. I also confirmed the 'impossible things' […truncated, full text in findings.json]

---

### `types-guards-variance/gv-5` — Inferred type predicates work for `filter(r => r.isOk())` but not for the negated form `filter(r => !r.isPending())`, which silently returns an unnarrowed array

**Severity:** medium · **Category:** ergonomics · **Verifier verdict:** confirmed

**Claim.** TypeScript 5.5+ inferred type predicates propagate the `this is X` guards through a bare arrow, so `results.filter(r => r.isOk())` correctly yields `Ok<number, string>[]`. But the single most idiomatic filter for this library — "drop the in-flight ones" — is a *negated* guard, and TS does not infer a predicate for it: `results.filter(r => !r.isPending())` returns `Result<number, string>[]`, not `Settled<number, string>[]`. The failure is silent: no error, just a stubbornly wide type. The same happens for any compound condition (`r.isOk() && r.value > 1`). Users must hand-write `(r): r is Settled<number, string> => !r.isPending()` and re-state the type arguments.

<details><summary><strong>Empirical evidence</strong></summary>

03-filter.ts — tsc exit 0 with `type _A = Expect<Equal<typeof results.filter((r) => r.isOk()), Ok<number, string>[]>>` and equivalents for `.find` and `.every`, so the positive guards DO narrow.
03c.ts — types revealed via assignment to `0`:
```
03c.ts(5,7): error TS2322: Type 'Ok<number, string>[]' is not assignable to type '0'.       // filter(r => { return r.isOk(); })  -> narrowed
03c.ts(8,7): error TS2322: Type 'Result<number, string>[]' is not assignable to type '0'.   // filter(r => !r.isPending()) -> NOT narrowed
03c.ts(11,7): error TS2322: Type 'Result<number, string>[]' is not assignable to type '0'.  // filter(r => r.isOk() && r.value > 1) -> NOT narrowed
```
11-generic-and-in.ts confirms the workaround compiles: `Expect<Equal<typeof results.filter((x): x is Settled<number,string> => !x.isPending()), Settled<number,string>[]>>` passes.

</details>

**Recommendation.** Ship an explicit positive guard for the settled case — `isSettled(): this is Settled<T, E>` on `ResultBase` — so `filter(r => r.isSettled())` narrows without a hand-written predicate. (A literal discriminant per gv-4 would additionally make `filter(r => r.type !== "pending")` narrow.) Also worth documenting that negated guards do not survive `.filter`.

**Verifier note.** Reproduced exactly. 03-filter.ts is exit 0, so the positive guards do narrow through `.filter`/`.find`/`.every` via TS 5.5 inferred predicates. 03c.ts gives precisely the three claimed reveals: `Ok<number,string>[]` for the block-bodied positive guard, and `Result<number,string>[]` (unnarrowed) for  […truncated, full text in findings.json]

---

### `types-guards-variance/gv-6` — No standalone/static guards (`Result.isOk`), so point-free narrowing is impossible

**Severity:** medium · **Category:** ergonomics · **Verifier verdict:** confirmed

**Claim.** The guards exist only as instance methods. The `Result` value namespace exports `try`, `fromPromise`, `do` and nothing else, so `results.filter(Result.isOk)` — the shape every user of a Result library reaches for first — does not compile. Every call site must spell out an arrow, and every call site that needs the negated or compound form must additionally re-declare the type arguments in a hand-written predicate.

<details><summary><strong>Empirical evidence</strong></summary>

11-generic-and-in.ts, tsc exit 2 with only the intended reveal errors — the marker below fired, confirming the member is absent:
```ts
// @ts-expect-error there is no `Result.isOk`
const bad = results.filter(Result.isOk);
```
Cross-checked against /home/user/antithrow/packages/antithrow/src/result.ts:115 — `export const Result = { try: resultTry, fromPromise, do: resultDo };`

</details>

**Recommendation.** Add `Result.isOk`, `Result.isErr`, `Result.isPending`, `Result.isSettled` as standalone predicate functions (`function isOk<T, E>(r: Result<T, E>): r is Ok<T, E>`). They compose with `filter`/`find`/`every`/`partition` point-free, they work on values whose static type is only structurally a Result, and they are trivially implemented by delegating to the methods.

**Verifier note.** Verified directly in source: /home/user/antithrow/packages/antithrow/src/result.ts:115 is `export const Result = { try: resultTry, fromPromise, do: resultDo };` — no guards. 11-generic-and-in.ts is exit 2 with only the intended reveal errors, so the `// @ts-expect-error there is no Result.isOk` mark […truncated, full text in findings.json]

---

### `types-guards-variance/gv-7` — Seven types that appear in the published public signatures are not exported and cannot be named by consumers (`FlattenOk`, `FlattenErr`, `FlattenPending`, `SyncOrAsync`, `NonThenable`, `SameResolved`, `FlattenThenable`, plus `ResultBase`)

**Severity:** medium · **Category:** packaging · **Verifier verdict:** confirmed

**Claim.** `dist/index.d.ts` re-exports only `InferErr`, `InferOk`, `Settled`. Yet `dist/ok.d.ts` declares `flatten(): FlattenOk<T, E>`, `mapOr<U>(defaultValue: NoInfer<U>, fn: (value: T) => NonThenable<U>): U`, `mapOrElse<UDefault, UMap>(..., fn: (value: T) => UMap & SameResolved<UDefault, UMap>): FlattenThenable<UMap>`; `dist/base.d.ts` declares `abstract flatten(): FlattenOk<T, E> | FlattenErr<T, E> | FlattenPending<T, E>` and uses `SyncOrAsync` in nine signatures; `dist/result.d.ts` uses `NonThenable`. The classes are declared `extends ResultBase<T, E>`, which is likewise unexported. The package `exports` map only exposes `"."` and `"./legacy"`, so `antithrow/dist/types.js` is unreachable too. A consumer who wants to annotate a variable holding `someResult.flatten()`, or write a helper generic over "any result", has no name to write and must fall back to `typeof`/`ReturnType` gymnastics.

<details><summary><strong>Empirical evidence</strong></summary>

Consumer-perspective project at .../guards-variance/consumer (node_modules/antithrow symlinked to the real package, so resolution goes through the published `exports` map). `cd consumer && bun x tsc --ignoreConfig --noEmit --strict --moduleResolution bundler --module preserve --target es2022 --lib es2022 a.ts` → exit 0, meaning every one of these `@ts-expect-error` markers fired:
```ts
// @ts-expect-error `FlattenOk` is used in the PUBLIC signature of Ok#flatten but is not exported
import type { FlattenOk } from "antithrow";
// @ts-expect-error `SyncOrAsync` appears in every base-class signature but is not exported
import type { SyncOrAsync } from "antithrow";
// @ts-expect-error `NonThenable` ...   // @ts-expect-error `SameResolved` ...
// @ts-expect-error `FlattenThenable` ...
// @ts-expect-error the internal module is not reachable through the package's `exports` map
import type { Fla […truncated, full text in findings.json]

</details>

**Recommendation.** Export every type that appears in a public signature. `SyncOrAsync` and the three `Flatten*` helpers are genuinely useful to consumers writing annotations; `NonThenable`, `SameResolved` and `FlattenThenable` are overload-plumbing and would be better hidden by *removing them from the public signatures* (e.g. by replacing the `SameResolved` intersection trick with a plainer constraint) rather than left dangling. Export `ResultBase` as a type-only export so users can write `<R extends ResultBase<unknown, unknown>>`. Adding a `"./types"` subpath export would be a stopgap but is worse than fixing `index.ts`.

**Verifier note.** Reproduced. The consumer project typechecks at exit 0 (node_modules/antithrow is a symlink to the real package, so resolution goes through the published exports map), meaning every `@ts-expect-error` marker fired: FlattenOk, SyncOrAsync, NonThenable, SameResolved, FlattenThenable and ResultBase are  […truncated, full text in findings.json]

---

### `flatten/ok-4` — Ok<any, E>.flatten() destroys the error type E, replacing it with `unknown` on three of four union members

**Severity:** medium · **Category:** type-safety · **Verifier verdict:** confirmed

**Claim.** When `T` is `any`, a distributive conditional produces both branches, and `infer F` against `any` resolves to `unknown`, so `E | F` collapses to `unknown`. `Ok<any, string>.flatten()` therefore yields `Ok<unknown, unknown> | Err<unknown, unknown> | Pending<unknown, unknown> | Ok<any, string>` — the caller's declared error type `string` is gone from three of the four members, so `unwrapErr()`/`orElse` see `unknown`. `Ok<any, E>` is not exotic: `Result.try(() => JSON.parse(s))` produces exactly that, since `JSON.parse` returns `any`.

<details><summary><strong>Empirical evidence</strong></summary>

tsc probe (reveal3.ts / reveal2.ts):
  reveal3.ts(33,7): error TS2322: Type 'Ok<unknown, unknown> | Err<unknown, unknown> | Pending<unknown, unknown> | Ok<any, string>' is not assignable to type '"OK_ANY"'.
  reveal2.ts(25,7): error TS2322: Type 'Ok<unknown, unknown> | Err<unknown, unknown> | Pending<unknown, unknown> | Ok<any, string>' is not assignable to type '"R7"'.
Compare the well-behaved concrete case on the same line of code shape: `Ok<Result<number,string>, boolean>.flatten()` gives `Ok<number, string|boolean> | Err<number, string|boolean> | Pending<number, string|boolean>` (reveal6_andthen.ts(11,7)) — `boolean` survives there but not under `any`.

</details>

**Recommendation.** Add an `IsAny` guard at the top of `FlattenOk` (and `FlattenErr`/`FlattenPending`) so `any` payloads take the identity branch: `type IsAny<T> = 0 extends 1 & T ? true : false;` then `export type FlattenOk<T, E> = IsAny<T> extends true ? Ok<any, E> : …`. That at least preserves `E`. This composes with the `[T] extends [never]` guard recommended in ok-1.

**Verifier note.** Reproduced verbatim: `reveal3.ts(33,7)`/`reveal2.ts(25,7)` both give `Ok<unknown, unknown> | Err<unknown, unknown> | Pending<unknown, unknown> | Ok<any, string>`, and I independently confirmed the consequence — `Ok<any,string>.flatten().unwrapErr()` is `unknown`, and `Result<any,"parse-failed">.flat […truncated, full text in findings.json]

---

### `flatten/ok-5` — Docs claim `andThen(identity)` is equivalent to `.flatten()` — it is not, for either Ok or Err

**Severity:** medium · **Category:** docs · **Verifier verdict:** confirmed

**Claim.** apps/docs/docs/how-to/core/combine-results.md:43 states verbatim: "`andThen(identity)` is equivalent to `.flatten()`." This is false in three ways: on `Ok` the two differ in the resulting error type (`andThen` drops the outer `E`), on `Err` they differ in the opposite direction (`andThen` is narrower and more accurate — see ok-3), and `andThen(identity)` does not compile at all on a non-nested result whereas `flatten()` does. Only the `Pending` case actually agrees. A reader following this advice silently changes their error union.

<details><summary><strong>Empirical evidence</strong></summary>

tsc (reveal6_andthen.ts), all with `const identity = <T>(x: T): T => x`:
  Ok<Result<number,string>, boolean>:
    (11,7): flatten()          => 'Ok<number, string | boolean> | Err<number, string | boolean> | Pending<number, string | boolean>'
    (12,7): andThen(identity)  => 'Result<number, string>'                      <- outer `boolean` LOST
  Err<Result<number,string>, boolean>:
    (15,7): flatten()          => 'Err<number, string | boolean>'
    (16,7): andThen(identity)  => 'Err<number, boolean>'                        <- differs
  Pending<Result<number,string>, boolean>:
    (19,7): flatten()          => 'Pending<number, string | boolean>'
    (20,7): andThen(identity)  => 'Pending<number, string | boolean>'           <- only this one matches
  Ok<number,string> (non-nested):
    (24,7): flatten()          => 'Ok<number, string>'  (compiles)
    line 26 `// @ts-expect-error` on  […truncated, full text in findings.json]

</details>

**Recommendation.** Delete or correct the sentence at combine-results.md:43, e.g. "`andThen(identity)` is similar but not identical: it drops the outer error type on `Ok`, and it does not compile on a result that is not already nested. Prefer `flatten()`." Also revisit reference/antithrow/methods.md:26, whose table row `| flatten | unwraps nested | no-op | Pending |` describes `Err` as a "no-op" — true at runtime, but the *type* changes (payload `Result<U,F>` -> `U`, error `E` -> `E|F`), which is the surprising part worth documenting.

**Verifier note.** Doc line verified verbatim: apps/docs/docs/how-to/core/combine-results.md:43 `\`andThen(identity)\` is equivalent to \`.flatten()\`.` reveal6_andthen.ts reproduces all four rows exactly as quoted (Ok: `Ok|Err|Pending<number, string|boolean>` vs `Result<number, string>`; Err: `Err<number, string|bool […truncated, full text in findings.json]

---

### `flatten/ok-6` — v3 dropped the legacy `this`-constrained flatten signature, losing the compile-time guard against flattening a non-nested Result

**Severity:** medium · **Category:** api-design · **Verifier verdict:** confirmed

**Claim.** The legacy subpath still ships the correct design — `flatten<U, F>(this: Result<Result<U, F>, E>): Result<U, E | F>` (src/legacy/result.ts:339, 482, 619), whose `Ok` implementation is simply `return this.value` with no `instanceof` and no cast. v3 replaced it with an unconstrained `flatten(): FlattenOk<T,E> | FlattenErr<T,E> | FlattenPending<T,E>` (base.ts:183) that is callable on *any* Result and silently no-ops when nothing is nested. That single change is the root cause of ok-1 (a distributive conditional can hit `never`), ok-2 (a static conditional must be reconciled with a nominal runtime check), and ok-4 (`any` poisoning) — none of which the `this`-constrained form can express.

<details><summary><strong>Empirical evidence</strong></summary>

Legacy source (src/legacy/result.ts:482): `flatten<U, F>(this: Ok<Result<U, F>, E>): Result<U, E | F> { return this.value; }` vs v3 (ok.ts:102-109) which needs a triple `instanceof` test plus two `as unknown as` casts.
v3 flatten on a non-nested result compiles as a silent identity: tsc `reveal4.ts(24,7): error TS2322: Type 'Ok<number, string>' is not assignable to type '"PLAIN_FLATTEN"'.` (i.e. `Ok<number,string>.flatten()` is accepted and typed `Ok<number,string>`); at runtime `bun runtime1.ts` shows `4 Ok(42).flatten() === this? => true`. Legacy's signature would reject that call outright.
The legacy docs even document the exact three-case contract this dimension is about (apps/docs/docs/legacy/result.md:422, result-async.md:423).

</details>

**Recommendation.** Restore the `this`-constrained overload as the primary signature in v3 — `flatten<U, F>(this: Ok<Result<U, F>, E>): FlattenOk<Result<U,F>, E>` on Ok, and the analogues on Err/Pending. It eliminates the `never` collapse, removes the need for `instanceof` dispatch entirely (so it survives duplicate package instances, ok-9), keeps FlattenOk's per-variant precision (see praise), and turns `x.flatten()` on a non-nested value into a compile error instead of a no-op. This is a breaking change, which is in scope; the migration is mechanical (delete the no-op call).

**Verifier note.** Source facts verified: legacy/result.ts:339 declares `flatten<U, F>(this: Result<Result<U, F>, E>): Result<U, E | F>`, with implementations at 482 (`Ok`, body is exactly `return this.value;`) and 619 (`Err`); legacy/result-async.ts:335/631 mirror it. v3 base.ts:183 is the unconstrained `abstract fla […truncated, full text in findings.json]

---

### `api-completeness/ok-10` — No `Result.isResult` and the shared base class is not exported, so "is this a Result?" requires a three-way `instanceof`

**Severity:** medium · **Category:** missing-capability · **Verifier verdict:** confirmed

**Claim.** `Result` is a merged type alias + plain `const` object, so it has no `[Symbol.hasInstance]` and `v instanceof Result` is a type error. There is no `Result.isResult` predicate (neverthrow doesn't ship one either, but ts-results-es and Effect both do — `Either.isEither`). Users writing framework glue, middleware, or serializers must hand-roll `v instanceof Ok || v instanceof Err || v instanceof Pending`, importing all three classes purely as runtime values. The frustrating part: a suitable base class `ResultBase` already exists and all three shapes extend it — it is simply not exported from `index.ts`, so the one-line check `v instanceof ResultBase` is unavailable.

<details><summary><strong>Empirical evidence</strong></summary>

`bun 09-constructors.ts`:
```
typeof Result = object | keys: [ "try", "fromPromise", "do" ]
hand-rolled isResult(new Ok(1)) = true | isResult(1) = false
ResultBase exported from index? false
Ok's superclass name (unexported): ResultBase
new Ok(1) instanceof <superclass> = true | new Err('x') instanceof <superclass> = true
```
`bun x tsc ... 14-factories.ts` → `TSC EXIT=0` with firing markers on `import { ResultBase } from ".../index.ts"` (not exported) and on `v instanceof Result` (`Result` is not a constructor). `bun x tsc ... 03-combine-types.ts` confirms `Result.isResult(1)` is a type error.

</details>

**Recommendation.** Add `Result.isResult(v: unknown): v is Result<unknown, unknown>` implemented as `v instanceof ResultBase`, and export `ResultBase` as a type (at minimum) so users can write generic constraints. Also consider `Result.isSettled` / `Result.isPending` free-function forms for narrowing values of type `unknown`, which the instance-method guards cannot do.

**Verifier note.** Reproduced. index.ts exports exactly `Err, UnwrapError, Ok, Pending, Result` plus types `InferErr, InferOk, Settled` — `ResultBase` is not exported (base.ts defines `export abstract class ResultBase<T,E>` but index.ts never re-exports it). `Result` is `export const Result = { try, fromPromise, do }` […truncated, full text in findings.json]

---

### `api-completeness/ok-11` — No `expect`/`expectErr`, and `UnwrapError.message` omits the underlying error, making failed unwraps undebuggable from logs

**Severity:** medium · **Category:** ergonomics · **Verifier verdict:** confirmed

**Claim.** Rust's `expect(msg)` and `expect_err(msg)` exist so a panic carries call-site context; ts-results-es has `expect`, neverthrow has `_unsafeUnwrap`. antithrow has neither, so a failed `unwrap()` produces a fixed, contextless message. Worse, that message does not include the error value — Rust prints `called \`Result::unwrap()\` on an \`Err\` value: "boom"`, but antithrow prints only `Called unwrap() on an Err value`. In a production log or a stack trace, that tells you nothing about what actually failed. The error *is* reachable via `UnwrapError.result`, but only by a catcher who knows to look — it never reaches a plain `console.error(err)` or an error-reporting SDK's message field.

<details><summary><strong>Empirical evidence</strong></summary>

`bun 12-serialization.ts`:
```
message: "Called unwrap() on an Err value" | name: UnwrapError | .result present: true | error value surfaced in message? false
message: "Called unwrapErr() on an Ok value"
```
The `error value surfaced in message?` check is `u.message.includes("boom")` where the result was `new Err<number, string>("boom")` → `false`. Absence of `expect`/`expectErr` confirmed by firing `@ts-expect-error` markers in 10-missing-combinators.ts (`TSC EXIT=0`) and by prototype enumeration in 01-surface.ts (`MISSING: expect`, `MISSING: expectErr`).

</details>

**Recommendation.** Add `expect(message: string): SyncOrAsync<T>` and `expectErr(message: string): SyncOrAsync<E>` mirroring `unwrap`/`unwrapErr`. Independently, include the payload in the default message — `Called unwrap() on an Err value: ${String(this.error)}` — and set `cause` to the error when it is an `Error`, so standard tooling surfaces it. Both are cheap and both pay off at 3am.

**Verifier note.** Reproduced. No `expect`/`expectErr` on any prototype (markers fire in 10-missing-combinators.ts at EXIT=0); errors.ts confirms `UnwrapError` takes a caller-supplied `message` but ok.ts/err.ts hard-code `"Called unwrapErr() on an Ok value"` / `"Called unwrap() on an Err value"` with no payload interp […truncated, full text in findings.json]

---

### `api-completeness/ok-13` — No `ok()`/`err()` factory functions; classes cannot be called without `new`, so point-free usage fails at both type and runtime

**Severity:** medium · **Category:** ergonomics · **Verifier verdict:** confirmed

**Claim.** Construction is `new Ok(v)` / `new Err(e)` only. Every comparable library ships lowercase factories — neverthrow `ok`/`err`/`okAsync`/`errAsync`, ts-results-es `Ok`/`Err` callable, oxide.ts `Ok`/`Err` — and antithrow's own legacy v2 API exported `ok`/`err` (`src/legacy/result.ts:667,691`), including a zero-argument `ok(): Ok<void, E>` for the unit case. In v3, ES class semantics make `Ok` non-callable, so point-free `arr.map(Ok)` is both a type error and a runtime `TypeError`, and the unit `Ok` requires writing `new Ok<void, string>(undefined as void)`.

<details><summary><strong>Empirical evidence</strong></summary>

`bun 09-constructors.ts`:
```
Ok(1) without new -> TypeError: Cannot call a class constructor Ok without |new|
Err('x') without new -> TypeError: Cannot call a class constructor Err without |new|
[1,2,3].map(Ok) -> TypeError: Cannot call a class constructor Ok without |new|
workaround: [ 1, 2, 3 ]
unit Ok requires explicit undefined: true undefined
```
`bun x tsc ... 14-factories.ts` → `TSC EXIT=0` with markers firing on `import { ok }`, `import { err }` (neither is exported) and on `[1, 2, 3].map(Ok)` ("class is not callable"). The same file asserts inference is otherwise good: `new Ok(1)` is `Ok<number, never>` and `new Err("x")` is `Err<never, string>`.

</details>

**Recommendation.** Export `ok`, `err`, and `pending` factory functions alongside the classes (keeping the classes for `instanceof`), with `ok(): Ok<void, never>` overloaded for the unit case as legacy v2 had. This restores point-free usage (`xs.map(ok)`, `promise.then(ok, err)`), removes 4 characters of noise from every construction site, and matches what every reader coming from neverthrow expects to import.

**Verifier note.** Reproduced. Runtime: `Ok(1) without new -> TypeError: Cannot call a class constructor Ok without |new|`, same for `Err`, and `[1,2,3].map(Ok)` throws; type side confirmed by firing markers on `import { ok }` / `import { err }` (index.ts exports neither) and on `[1,2,3].map(Ok)`. Legacy factories ver […truncated, full text in findings.json]

---

### `api-completeness/ok-14` — No `toString`/`toJSON`/`Symbol.toStringTag`; JSON output carries no discriminant and `structuredClone` silently degrades a Result to a plain object

**Severity:** medium · **Category:** missing-capability · **Verifier verdict:** confirmed

**Claim.** None of the three shapes defines `toString`, `toJSON`, or `Symbol.toStringTag`. Consequences: a Result in a template literal or a plain `console.log` line renders `[object Object]`; `JSON.stringify` emits the raw private field with no tag, so an `Ok` is byte-identical to an arbitrary `{value: ...}` object and an `Err` to any `{error: ...}`; there is no `Result.fromJSON` to revive one; `Err` wrapping an `Error` serializes to `{"error":{}}`, losing the failure entirely; `Pending` serializes to the meaningless `{"promise":{}}`; and `structuredClone` (the postMessage/worker path) silently yields a plain object that is no longer a Result but still passes a naive `"value" in x` check. Effect ships `toJSON`/`toString`/`NodeInspectSymbol` on every data type precisely for this.

<details><summary><strong>Empirical evidence</strong></summary>

`bun 12b-serialization.ts`:
```
JSON.stringify(new Ok(42))        = {"value":42}
JSON.stringify({ value: 42 })     = {"value":42}
indistinguishable?                  true
JSON.stringify(new Err('boom'))   = {"error":"boom"}
JSON.stringify({ error: 'boom' }) = {"error":"boom"}
`${new Err('boom')}`              = [object Object]
```
`bun 12-serialization.ts`:
```
Symbol.toStringTag on Ok: undefined
Object.prototype.toString: [object Object] [object Object] [object Object]
Pending -> {"promise":{}}
revived is a Result? false | has .unwrap? undefined
no Result.fromJSON: undefined
JSON.stringify(Err(new TypeError('x'))) = {"error":{}}
clone: { value: 42, } | instanceof Ok: false
structuredClone(Pending) threw: DataCloneError
```

</details>

**Recommendation.** Add `toString()` (`Ok(42)` / `Err("boom")` / `Pending`), `[Symbol.toStringTag]`, and `toJSON()` emitting a tagged envelope such as `{ _tag: "Ok", value }` / `{ _tag: "Err", error }`, with a matching `Result.fromJSON` reviver. For `Err` holding an `Error`, serialize `name`/`message`/`stack` rather than an empty object. Make `Pending.toJSON` throw or emit `{ _tag: "Pending" }` explicitly rather than leaking the internal `promise` field — right now the shape of a private implementation detail is part of the observable JSON contract.

**Verifier note.** Reproduced verbatim on both scripts: `JSON.stringify(new Ok(42))` = `{"value":42}` and `JSON.stringify({value:42})` = `{"value":42}`, indistinguishable; `Err` likewise; `${new Err('boom')}` = `[object Object]`; `Symbol.toStringTag` undefined; `Pending` serializes to `{"promise":{}}` (leaking the pri […truncated, full text in findings.json]

---

### `api-completeness/ok-15` — All three code examples on the "Combine results" how-to page fail to compile

**Severity:** medium · **Category:** docs · **Verifier verdict:** adjusted

**Claim.** `apps/docs/docs/how-to/core/combine-results.md` is the page a user reaches when looking for the collection combinators that do not exist (ok-4), and its own examples are wrong. `authenticate().and(loadProfile)` and `readPrimary().or(readSecondary)` pass *functions* to `and`/`or`, which take a `Result` value — the doc even says "No function, no lazy evaluation" on the neighbouring reference page, so this is a straight authoring error. The page also claims "`andThen(identity)` is equivalent to `.flatten()`", which is false: on a non-nested `Ok<number, E>`, `flatten()` returns `Ok<number, E>` while `andThen(v => v)` is a type error because the identity does not return a `Result`.

<details><summary><strong>Empirical evidence</strong></summary>

`bun x tsc ... 17-doc-examples.ts` → `TSC EXIT=0`, meaning all three `@ts-expect-error` markers fire:
```
// @ts-expect-error `and` takes a Result, not a function
const pair = authenticate().and(loadProfile);
// @ts-expect-error `or` takes a Result, not a function
const source = readPrimary().or(readSecondary);
// @ts-expect-error andThen(identity) is NOT equivalent: identity does not return a Result here
const viaAndThen = plain.andThen((v) => v);   // plain: Ok<number, "E1">; plain.flatten() is fine
```
The declarations mirror the doc verbatim (`authenticate(): Result<string, "AuthErr">`, `loadProfile(): Result<{id:number}, "ProfileErr">`, etc.).

</details>

**Recommendation.** Fix to `authenticate().and(loadProfile())` and `readPrimary().or(readSecondary())`, and restate the flatten claim as "`andThen(identity)` is equivalent to `.flatten()` *when the Ok value is itself a Result*". Then gate the docs in CI by extracting fenced `ts` blocks into a typechecked fixture — this finding plus ok-2 means 5 broken examples across 2 core pages, which is a systemic gap, not a typo.

**Verifier note.** The two real defects reproduce: combine-results.md contains `const pair = authenticate().and(loadProfile);` and `const source = readPrimary().or(readSecondary);`, and `and`/`or` are typed `(result: Result<U,F>)` in base.ts — 17-doc-examples.ts EXIT=0, both markers fire. But the title's count is wron […truncated, full text in findings.json]

---

### `api-completeness/ok-5` — `mapOrElse` and `unwrapOrElse` leak `PromiseLike` on a `Settled` receiver, so there is no way to exit the Result world with a plain value

**Severity:** medium · **Category:** type-safety · **Verifier verdict:** adjusted

**Claim.** `await result` correctly narrows to `Settled<T, E>` — the documented, recommended async exit. But on that `Settled` union, `mapOrElse` and `unwrapOrElse` still return `SyncOrAsync<U>` (= `U | PromiseLike<U>`), even though `Pending` has been provably eliminated and neither method can possibly return a promise there. `mapOr`, `unwrapOr`, and `unwrap` do return the plain type, so this is an inconsistency within antithrow itself, not a deliberate policy. The practical consequence: the two combinators you would use to *finish* a computation (fold to a value, recover to a value) are the two you cannot use without a cast.

<details><summary><strong>Empirical evidence</strong></summary>

`bun x tsc ... 08-settled-leak.ts` with `const s = await anyResult` (`anyResult: Result<number, string>`), probing each method by assigning to `{ __reveal: true }`:
```
08-settled-leak.ts(8,9): error TS2322: Type 'SyncOrAsync<number>' is not assignable ...   <- s.mapOrElse((e) => 0, (v) => v)   LEAKS
08-settled-leak.ts(10,9): error TS2322: Type 'number' is not assignable ...              <- s.mapOr(0, (v) => v)              ok
08-settled-leak.ts(12,9): error TS2322: Type 'number' is not assignable ...              <- s.unwrapOr(0)                     ok
08-settled-leak.ts(14,9): error TS2322: Type 'SyncOrAsync<number>' is not assignable ... <- s.unwrapOrElse(() => 0)          LEAKS
08-settled-leak.ts(16,9): error TS2322: Type 'number' is not assignable ...              <- s.unwrap()                       ok
08-settled-leak.ts(20,7): error TS2322: Type 'number' is not assignable ...       […truncated, full text in findings.json]

</details>

**Recommendation.** Give `Ok` and `Err` matching `mapOrElse`/`unwrapOrElse` overload sets so union-call resolution can produce the plain `U`, the way `mapOr`/`unwrapOr` already do (`Err.unwrapOrElse` has three overloads while `Ok.unwrapOrElse` has one non-overloaded `T`-returning signature — that mismatch is the likely cause). A `match(handlers): U` on `Settled` (ok-3) would also give users a leak-free exit. Add a type test asserting `Settled<T,E>` never widens a synchronous combinator to `SyncOrAsync`.

**Verifier note.** The type behaviour reproduces exactly as reported — 08-settled-leak.ts shows `s.mapOrElse((e)=>0,(v)=>v)` and `s.unwrapOrElse(()=>0)` as `SyncOrAsync<number>` on `Settled<number,string>` while `mapOr`, `unwrapOr`, `unwrap` are plain `number`, and a concrete `Ok` is fine. Root-cause claim also checks […truncated, full text in findings.json]

---

### `api-completeness/ok-6` — No `inspect`/`inspectErr`/`tap`; the `map`-as-tap workaround silently voids the value or silently upgrades `Ok` to `Pending`

**Severity:** medium · **Category:** missing-capability · **Verifier verdict:** adjusted

**Claim.** Rust has `inspect`/`inspect_err`, neverthrow has `andTee`/`orTee`, Effect has `tap`/`tapError`, and antithrow's own legacy v2 API had `inspect`/`inspectErr` (`src/legacy/result.ts:311,325`). v3 has none, so logging/metrics/audit side effects must go through `map(v => { sideEffect(v); return v; })`. That workaround has two silent failure modes: (a) forgetting `return v` produces `Ok<void, E>` rather than a type error, and (b) an *async* side effect — a logger flush, a metrics push, an audit write, all extremely common — makes `map` upgrade the chain from `Ok<T,E>` to `Pending<T,E>`, so every downstream `unwrap()` becomes a `PromiseLike`. A real `inspect` cannot do either, because it discards the callback's return value and (for the async case) should either await-and-preserve or reject the signature.

<details><summary><strong>Empirical evidence</strong></summary>

`bun x tsc ... 06-inspect.ts` → `TSC EXIT=0`, asserting all of:
- `okr.map((v) => { console.log("saw", v); return v; })` is `Ok<number, string>` (the workaround)
- `okr.map(async (v) => { await asyncLog(v); return v; })` is `Pending<number, string>` — silent upgrade
- its `.unwrap()` is `PromiseLike<number>`, not `number`
- `okr.map((v) => { console.log(v); })` is `Ok<void, string>` — silently voided
- `errr.mapErr((e) => { console.log(e); })` is `Err<number, void>` — silently voided error channel
Runtime (`bun 06-inspect.ts`) confirms the void case: `runtime: 5 undefined undefined` — the `Ok`'s value and the `Err`'s error are both `undefined` after the forgotten `return`. Absence confirmed by prototype enumeration in 01-surface.ts (`MISSING: inspect / inspectErr / tap / tapErr / andTee / orTee`) and by firing `@ts-expect-error` markers in 11b-tee.ts (`TSC EXIT=0`).

</details>

**Recommendation.** Add `inspect(fn: (value: T) => unknown): this` and `inspectErr(fn: (error: E) => unknown): this` to `ResultBase`, following Rust naming (the library is Rust-derived elsewhere) and restoring the legacy v2 methods. Return type must be the *same* shape, discarding the callback result; decide explicitly whether an async callback is awaited (upgrading to `Pending`, like `map`) or fire-and-forget, and document it — either is defensible, silence is not.

**Verifier note.** Facts all reproduce: no `inspect/inspectErr/tap/tapErr/andTee/orTee` on any prototype; 06-inspect.ts EXIT=0 asserting `map(v=>{log(v);return v})` is `Ok<number,string>`, `map(async v=>{await log(v);return v})` is `Pending<number,string>` with `.unwrap()` as `PromiseLike<number>`, `map(v=>{log(v)})`  […truncated, full text in findings.json]

---

### `api-completeness/ok-7` — `map`/`mapErr` accept async callbacks but `andThen`/`orElse` reject them — an undocumented asymmetry on the most-used chaining method

**Severity:** medium · **Category:** consistency · **Verifier verdict:** adjusted

**Claim.** `map` and `mapErr` are explicitly documented as "If the function returns a promise, the result becomes `Pending`" — the library's headline feature. `andThen` and `orElse` are typed `(value: T) => Result<U, F>` with no `SyncOrAsync`, so the overwhelmingly common `chain a step that is itself async and returns a Result` does not compile. In neverthrow this works directly (`ResultAsync.andThen` accepts `Result | ResultAsync`), and in Effect `flatMap` is uniformly effectful. The workaround is `.map(asyncFn).flatten()`, which is correct but non-obvious and appears nowhere in the docs — `combine-results.md`, the page about chaining, documents only the sync `andThen`.

<details><summary><strong>Empirical evidence</strong></summary>

`bun x tsc ... 16-async-andthen.ts` and `16b-async-andthen.ts`, both `TSC EXIT=0`, meaning these markers all fire:
```
const m = o.map(async (v) => v * 2);                                  // OK: Pending<number, string>  (asserted)
// @ts-expect-error andThen requires a synchronous Result return
const bad = o.andThen(async (v) => new Ok<number, "x">(v));
// @ts-expect-error orElse requires a synchronous Result return
const bad2 = new Err<number, string>("e").orElse(async (e) => new Ok<number, "x">(1));
// @ts-expect-error andThen cannot take an async Result-returning function
const direct = o.andThen((v) => saveUser(v));   // saveUser: (id: number) => Promise<Result<string, "DbError">>
```
16b also asserts the workaround's type is right: `o.map((v) => saveUser(v)).flatten()` is exactly `Pending<string, "E1" | "DbError">`. Runtime (`bun 16c-run.ts`) confirms it behaves: `map+flatten ok :  […truncated, full text in findings.json]

</details>

**Recommendation.** Widen `andThen`/`orElse` to `(value: T) => SyncOrAsync<Result<U, F>>` with the same Pending-upgrade behaviour `map` already has, so the three-state model is uniform across the method surface. That is the single change that makes the library's central claim — "`Pending` is a first-class member of `Result`, not a parallel type" — actually hold for chaining. Until then, document `map(fn).flatten()` as the async-`andThen` idiom on the combine-results page.

**Verifier note.** The asymmetry is real and reproduces: base.ts types `andThen<U,F>(fn: (value:T)=>Result<U,F>)` and `orElse<F>(fn:(error:E)=>Result<T,F>)` with no `SyncOrAsync`, while `map`/`mapErr` take `(value:T)=>SyncOrAsync<U>`; 16b EXIT=0 with the `@ts-expect-error` over `o.andThen((v)=>saveUser(v))` firing and […truncated, full text in findings.json]

---

### `api-completeness/ok-8` — No `fromThrowable` wrap-and-reuse factory; `Result.try` invokes immediately and forwards no arguments

**Severity:** medium · **Category:** missing-capability · **Verifier verdict:** confirmed

**Claim.** `Result.try(fn)` takes a zero-argument thunk and runs it on the spot. There is no way to convert a throwing function into a reusable Result-returning function — neverthrow's `Result.fromThrowable(fn, errFn)` and `ResultAsync.fromAsyncThrowable`, Effect's `Effect.try`-based lifting. Every call site therefore re-wraps in an inline closure, and a user who factors that out must hand-write the generic wrapper. The hand-written version cannot recover the `Settled` guarantee without an unsafe cast, because with an unresolved generic return type `R` the `NonThenable<T>` overload of `resultTry` cannot match, so it falls through to the `Result` overload that includes `Pending`.

<details><summary><strong>Empirical evidence</strong></summary>

`bun x tsc ... 10-missing-combinators.ts` → `TSC EXIT=0`, with `@ts-expect-error` firing on both `Result.fromThrowable(() => 1)` (does not exist) and `Result.try((x: string) => JSON.parse(x), "{}")` (no argument forwarding). The cast requirement is shown in 11-fromthrowable.ts, where the cast-free wrapper `(...args: A) => Result.try<R, E>(() => fn(...args))` applied to a *purely synchronous* `(x: string) => unknown` reveals as:
```
11-fromthrowable.ts(13,7): error TS2322: Type 'Result<unknown, unknown>' is not assignable to type '{ __reveal: true; }'.
  Property '__reveal' is missing in type 'Ok<unknown, unknown>' ...
```
i.e. `Result<unknown, unknown>` including the impossible `Pending` branch. Only with `as Settled<R, E>` (10-missing-combinators.ts) does the wrapper type correctly. Runtime absence confirmed in 01-surface.ts: `fromThrowable => undefined`.

</details>

**Recommendation.** Add `Result.fromThrowable<A extends unknown[], T, E>(fn: (...args: A) => T, mapErr: (e: unknown) => E): (...args: A) => Settled<T, E>` and an async sibling, both preserving argument types and both carrying the mandatory error mapper from ok-1. Following neverthrow, this is the natural home for the mapper and would fix both findings with one API.

**Verifier note.** Reproduced. `Result.fromThrowable` is `undefined` at runtime; 10-missing-combinators.ts EXIT=0 with markers firing on `Result.fromThrowable(() => 1)` and on `Result.try((x: string) => JSON.parse(x), "{}")`. The subtle claim also checks out: 11-fromthrowable.ts reveals the cast-free wrapper as `Resul […truncated, full text in findings.json]

---

### `api-completeness/ok-9` — The public `Pending` constructor is unguarded, so the combinators users are forced to hand-write can produce a Result that throws on `unwrapOr`

**Severity:** medium · **Category:** correctness · **Verifier verdict:** confirmed

**Claim.** `new Pending(promise)` accepts any `PromiseLike<Settled<T, E>>` with no rejection guard. Because there is no `Result.all` (ok-4), every user who needs to combine Results must construct a `Pending` by hand — and the moment the inner promise rejects, the resulting object violates the library's central contract: `await`ing it throws, and even `unwrapOr(default)`, the method whose entire purpose is to never fail, throws. `Result.fromPromise` does guard, but it takes a `PromiseLike<T>` and wraps the value in a fresh `Ok`, so it cannot be used to build a `Pending` from a promise that already resolves to a `Settled` without double-wrapping and a `.flatten()`.

<details><summary><strong>Empirical evidence</strong></summary>

`bun 15-pending-ctor.ts`:
```
await Pending(rejecting promise) THREW: infra
unwrapOr on rejecting Pending THREW: infra2
Result.fromPromise catches: true
fromPromise(Promise<Result>) -> Ok containing Ok -- must .flatten()
after flatten: Ok
```
The second line is `await new Pending<number, string>(Promise.reject(new Error("infra2"))).unwrapOr(0)` — `unwrapOr` with a default of `0` propagates the rejection instead of returning `0`. The last two lines show the double-wrap: `Result.fromPromise(Promise.resolve(new Ok(1)))` yields `Ok` containing `Ok`, requiring `.flatten()`.

</details>

**Recommendation.** Either add a guarded factory — `Result.fromSettledPromise<T, E>(p: PromiseLike<Settled<T, E>>, mapErr: (e: unknown) => E): Pending<T, E>` that attaches a rejection handler — or have the `Pending` constructor itself install one. Once `Result.all` and friends exist (ok-4), also consider marking the raw constructor `@internal`, since users would no longer need it. neverthrow's `ResultAsync` constructor has the same hazard, but neverthrow ships the combinators so users rarely touch it; antithrow forces them to.

**Verifier note.** Reproduced, and stronger than the repro shows: the repro used a gratuitous `as any`, but I verified a cast-free `new Pending<number,string>(Promise.reject(new Error("infra")))` typechecks at EXIT=0 (Promise<never> is assignable to PromiseLike<Settled<T,E>>) and its `unwrapOr(0)` rejects rather than  […truncated, full text in findings.json]

---

### `docs-accuracy/ok-10` — "UnwrapError is the only class antithrow ever throws" — `for...of` over an `Err` throws a plain Error

**Severity:** medium · **Category:** docs · **Verifier verdict:** confirmed

**Claim.** Three pages assert this: unwrap-error.md L11 ("The only class antithrow ever throws"), L38 ("No other antithrow function throws"), err.md L60 and ok.md L60 ("No other method throws"), plus explanation/error-typing-philosophy.md L9 ("the one kind of exception antithrow does throw"). But `Err[Symbol.iterator]` (err.ts:121-124) throws a bare `new Error("Unreachable: generator should have been halted")` on its second `next()`. That path is reachable from ordinary user code: a plain `for...of` over an `Err` hits it, and `Err` advertises `[Symbol.iterator]` publicly (err.md L56 documents it).

<details><summary><strong>Empirical evidence</strong></summary>

`bun 16-only-class-thrown.ts`:
```
Err iterator .next() #1 -> {"done":false}
Err iterator .next() #2 THREW: Error | instanceof UnwrapError: false | Unreachable: generator should have been halted
for..of over Err THREW: Error | Unreachable: generator should have been halted
```

</details>

**Recommendation.** Two options. Preferred: make the unreachable branch throw an `UnwrapError` (or a new named error) so the docs become true and the failure is diagnosable; the current message tells a user nothing about what they did. Otherwise, amend the three pages to "`UnwrapError` is the only error antithrow throws through its documented API; iterating an `Err` outside `Result.do` is unsupported and throws."

**Verifier note.** Reproduced. err.ts:121-124 (`*[Symbol.iterator]`) yields `this` then `throw new Error("Unreachable: generator should have been halted")`. 16-only-class-thrown: second `.next()` and a plain `for..of` both throw a bare Error, `instanceof UnwrapError: false`. I additionally verified `for (const x of er […truncated, full text in findings.json]

---

### `docs-accuracy/ok-12` — `Result.try(() => JSON.parse(x))` is documented as `Result<unknown, unknown>` but is actually `Settled<any, unknown>`

**Severity:** medium · **Category:** docs · **Verifier verdict:** confirmed

**Claim.** apps/docs/docs/how-to/core/wrap-a-throwing-function.md L22 says "`parsed` is `Result<unknown, unknown>`. Supply a type argument to narrow". The real inferred type is `Settled<any, unknown>`. The `unknown` -> `any` difference matters most: the doc promises a type that forces the reader to narrow before use, when in fact `parsed.value` is `any` and flows unchecked through the rest of their program. This is the page whose entire purpose is teaching safe interop with throwing code, so the discrepancy undercuts its own thesis. (`Settled` vs `Result` is the harmless half — the sync overload correctly excludes `Pending`.)

<details><summary><strong>Empirical evidence</strong></summary>

07-docs-site-types.ts L93 encodes the doc's claim and fails; 08-docs-site-reveal.ts reveals the truth:
```
08-docs-site-reveal.ts(17,8): error TS2322: Type 'Settled<any, unknown>' is not assignable to type '"REVEAL_Result.try_JSONparse"'.
  Type 'Ok<any, unknown>' is not assignable to type '"REVEAL_Result.try_JSONparse"'.
```

</details>

**Recommendation.** Correct the sentence to "`parsed` is `Settled<any, unknown>` — `JSON.parse` returns `any`, so the success value is unchecked. Always supply the type argument" and promote the `Result.try<unknown, SyntaxError>(...)` line from an aside to the primary example. Consider constraining `resultTry`'s `T` so `any` callbacks widen to `unknown` instead — the library's whole premise is that the compiler should see what you have.

**Verifier note.** Reproduced. 07-docs-site-types L93 (`Equal<typeof parsed, Result<unknown, unknown>>`) fails and 08-docs-site-reveal prints `Settled<any, unknown>`. The `any` is the substantive half and the claim identifies it correctly — resultTry has no constraint pushing `JSON.parse`'s `any` to `unknown`, so `par […truncated, full text in findings.json]

---

### `docs-accuracy/ok-14` — combine-results.md `and` / `or` examples pass functions where a Result is required

**Severity:** medium · **Category:** docs · **Verifier verdict:** confirmed

**Claim.** apps/docs/docs/how-to/core/combine-results.md L25 (`authenticate().and(loadProfile)`) and L31 (`readPrimary().or(readSecondary)`) pass bare function references. `and` and `or` take a `Result` value, not a thunk — the same page's reference sibling (methods.md L98) explicitly says "No function, no lazy evaluation; `result` is always constructed up front". Written as shown, both examples fail to compile, and worse, they read as lazy evaluation to anyone skimming — which is precisely the misconception the reference page is trying to prevent. The `orElse` example on the recovery page (recover-from-errors.md L33) correctly uses a thunk, so the two pages teach opposite call shapes for adjacent methods.

<details><summary><strong>Empirical evidence</strong></summary>

07-docs-site-types.ts L45-54 transcribes both verbatim with plausibly-typed helpers; tsc:
```
07-docs-site-types.ts(51,34): error TS2345: Argument of type '() => Result<number, "profile">' is not assignable to parameter of type 'Result<unknown, unknown>'.
07-docs-site-types.ts(53,34): error TS2345: Argument of type '() => Result<string, "f">' is not assignable to parameter of type 'Result<string, unknown>'.
```

</details>

**Recommendation.** Change to `authenticate().and(loadProfile())` and `readPrimary().or(readSecondary())`, and add the eagerness warning inline: "both arguments are evaluated before `and`/`or` runs — use `andThen`/`orElse` if the second operation should only happen conditionally." As written the examples actively teach the wrong mental model on the page most likely to be read by someone choosing between the four.

**Verifier note.** Reproduced: TS2345 on both, `'() => Result<number, "profile">' is not assignable to parameter of type 'Result<unknown, unknown>'` and the same for `or`. combine-results.md L25/L31 do pass bare function references; methods.md L98 does say 'No function, no lazy evaluation; result is always constructed […truncated, full text in findings.json]

---

### `docs-accuracy/ok-15` — The `yield*` iterator protocol is undocumented in source, and its sync/async asymmetry is undocumented everywhere

**Severity:** medium · **Category:** docs · **Verifier verdict:** confirmed

**Claim.** Doc-coverage gap. `Ok[Symbol.iterator]` (ok.ts:132), `Err[Symbol.iterator]` (err.ts:121), and `Pending[Symbol.asyncIterator]` (pending.ts:130) — the entire mechanism behind `Result.do` — carry zero JSDoc; the only comment on them is a biome-ignore pragma. The docs site does mention them one line each (ok.md L56, err.md L56, pending.md L67), but nothing anywhere states the load-bearing consequence: because `Pending` implements only the *async* iterator, a `Result<T,E>` union can be `yield*`-ed in an `async function*` but never in a `function*`. A user reading only the JSDoc (the hover surface) cannot discover `yield*` semantics at all; a user reading only the docs site discovers the protocol but not its restriction. This is the root cause of ok-3.

<details><summary><strong>Empirical evidence</strong></summary>

Grep of the three source files shows no `/** */` preceding any of the three symbol methods. Empirically, 12-yield-union.ts demonstrates the asymmetry with identical helper shapes:
```
12-yield-union.ts(11,26): error TS2488: Type 'Result<string, "io">' must have a '[Symbol.iterator]()' method that returns an iterator.   [sync gen + Result]
12-yield-union.ts(20,7): error TS2322: Type 'Settled<string, "io">' is not assignable to type '"REVEAL_sync_settled"'.               [sync gen + Settled: OK]
12-yield-union.ts(27,7): error TS2322: Type 'Pending<string, "io">' is not assignable to type '"REVEAL_async_union"'.                 [async gen + Result: OK]
```
And the `Result.do` hover that would have explained it is empty (see ok-5).

</details>

**Recommendation.** Add JSDoc to all three symbol methods explaining their role in `Result.do`, and add an explicit compatibility note to the `Result.do` documentation (once it is reachable per ok-5): "`function*` accepts only `Settled` values (`Ok`/`Err`); `async function*` additionally accepts `Pending`, and therefore the full `Result` union. If any step may be async, use `async function*`." A short table of yieldable-type x generator-kind would make this discoverable at a glance.

**Verifier note.** Confirmed. ok.ts:132 carries only a biome-ignore pragma, err.ts:121 and pending.ts:130 carry no comment at all; the docs site mentions each in one line (ok.md L56, err.md L56, pending.md L67) without stating the consequence. I grepped the whole docs tree: use-result-do.md L37 ('Use an `async functio […truncated, full text in findings.json]

---

### `docs-accuracy/ok-4` — base.ts `orElse` example claims the wrong type and contradicts its own signature

**Severity:** medium · **Category:** docs · **Verifier verdict:** adjusted

**Claim.** packages/antithrow/src/base.ts L164-169 documents `const recovered = result.orElse((error) => new Ok(0)); // recovered is Ok<number, string> with value 0`. The actual type is `Ok<number, never>`. The whole point of `orElse` is that it *replaces* `E` with `F` — the abstract signature one line below (L171) says `Result<T, F>`, so the example contradicts the declaration it annotates. Keeping `string` in the claimed type tells a reader the original error survives recovery, which is the opposite of what `orElse` does.

<details><summary><strong>Empirical evidence</strong></summary>

02-base-types.ts L47-52 asserts the doc's claim; tsc:
```
02-base-types.ts(51,24): error TS2344: Type 'false' does not satisfy the constraint 'true'.
```
03-reveal.ts L16-20 reveals the truth:
```
03-reveal.ts(19,8): error TS2322: Type 'Ok<number, never>' is not assignable to type '"REVEAL_orElse"'.
```
Without const-initializer narrowing (function parameter, 03-reveal.ts L37-38) it is `Ok<number, never> | Pending<number, never>` — still no `string`. Runtime value is correct: `bun 01-base-runtime.ts` prints `orElse: recovered => Ok(0)`.

</details>

**Recommendation.** Change the comment to `// recovered is Ok<number, never> with value 0` and add a sentence to the prose: "`orElse` replaces the error type `E` with the fallback's `F`; the original error type does not survive." That distinction is the single most important thing about `orElse` versus `or` and it is currently mis-taught.

**Verifier note.** Factually confirmed: 02-base-types L51 fails (`Type 'false' does not satisfy the constraint 'true'`) and 03-reveal shows `Ok<number, never>`, not `Ok<number, string>`; base.ts L171's own abstract signature returns `Result<T, F>`, and runtime value is Ok(0) as documented. Severity adjusted down to me […truncated, full text in findings.json]

---

### `docs-accuracy/ok-5` — `Result.try`, `Result.fromPromise`, and `Result.do` have no hover documentation at all

**Severity:** medium · **Category:** docs · **Verifier verdict:** adjusted

**Claim.** The three static entry points users touch first show an empty documentation panel on hover. `resultTry` (result.ts:32-34) and `fromPromise` (result.ts:23) carry no JSDoc whatsoever. `resultDo` has a detailed 25-line JSDoc block (result.ts:48-73), but it is attached to the *private* function declaration; the public name is a property of the object literal `export const Result = { try: resultTry, fromPromise, do: resultDo }` (result.ts:115-119), and TypeScript does not propagate the declaration's JSDoc through that property. So the carefully-written `Result.do` documentation reaches nobody in an editor.

<details><summary><strong>Empirical evidence</strong></summary>

`node 15-hover-coverage.mjs` (TypeScript 6.0.3 language service, getQuickInfoAtPosition):
```
Result.try           | hover doc: <<< NONE >>> | tags: []
Result.fromPromise   | hover doc: <<< NONE >>> | tags: []
Result.do            | hover doc: <<< NONE >>> | tags: []
p.promise            | hover doc: <<< NONE >>> | tags: []
p.then               | hover doc: "Attaches callbacks for the resolution and/or rejection of the Promise." | tags: [param,param,returns]
o.map                | hover doc: "Transforms the value inside an {@link Ok} using the provided function," | tags: [throws,example]
```
The emitted `dist/result.d.ts` confirms it structurally: lines 20-23 declare `fromPromise` and the three `resultTry` overloads with no preceding comment, while the resultDo block survives on the private declaration only. Note `p.then` is not undocumented but shows lib.es5's `PromiseLike` text ("the P […truncated, full text in findings.json]

</details>

**Recommendation.** Move the JSDoc onto the object-literal properties: `export const Result = { /** ... */ try: resultTry, /** ... */ fromPromise, /** ... */ do: resultDo }`. Write a real block for `try` (it is the most-used function in the package and currently has zero prose anywhere in source) covering the sync/async overload split and the fact that `E` is never inferred from the throw. Add a short block to `Pending.then` and `Pending.promise` so they stop borrowing lib.es5 wording.

**Verifier note.** Every fact confirmed: 15-hover-coverage prints `<<< NONE >>>` for Result.try, Result.fromPromise, Result.do and p.promise; source shows no JSDoc on resultTry (result.ts:32) or fromPromise (result.ts:23); the 25-line resultDo block sits on the private declaration and dist/result.d.ts shows it survivi […truncated, full text in findings.json]

---

### `docs-accuracy/ok-7` — base.ts `or` and `andThen` examples claim error types that are not produced

**Severity:** medium · **Category:** docs · **Verifier verdict:** confirmed

**Claim.** Two more base.ts example comments state types the compiler does not produce. (a) L150-154 `or`: `result.or(fallback); // Ok<number, string | boolean> with value 42` — actual is `Ok<number, boolean>`; the receiver's `string` is discarded because `Err.or` returns the argument unchanged. (b) L126-131 `andThen`: `const chained = result.andThen((value) => new Ok(value * 2)); // chained is Ok<number, string> with value 10` — actual is `Ok<number, never>`, because `Ok.andThen` returns exactly the callback's `R`. In both cases the comment matches base.ts's *abstract* signature (`Result<T, E|F>`) rather than the concrete class behaviour a user actually gets.

<details><summary><strong>Empirical evidence</strong></summary>

02-base-types.ts L24-30 and L40-46 encode both claims; tsc:
```
02-base-types.ts(28,25): error TS2344: Type 'false' does not satisfy the constraint 'true'.   [andThen]
02-base-types.ts(44,20): error TS2344: Type 'false' does not satisfy the constraint 'true'.   [or]
```
03-reveal.ts:
```
03-reveal.ts(8,8): error TS2322: Type 'Ok<number, never>' is not assignable to type '"REVEAL_andThen"'.
03-reveal.ts(14,8): error TS2322: Type 'Ok<number, boolean>' is not assignable to type '"REVEAL_or"'.
```
Runtime values are correct (`bun 01-base-runtime.ts`: `or => Ok(42)`, `andThen: chained => Ok(10)`).

</details>

**Recommendation.** Correct both comments. More usefully, note that base.ts's abstract signatures are a widened description of the concrete overloads, so any example annotated from the abstract signature will be wrong. Consider writing the examples against the concrete receiver (`new Ok(5).andThen(...)`) rather than a `Result<number,string>`-annotated const whose type only matches because of const-initializer narrowing — that narrowing is what makes the `map` and `mapErr` examples in the same file accidentally correct.

**Verifier note.** Both reproduced. 03-reveal: `Ok<number, never>` for the andThen example (base.ts L126-131 claims `Ok<number, string>`) and `Ok<number, boolean>` for the or example (base.ts L150-154 claims `Ok<number, string | boolean>`). Cause is as described — `Ok.andThen` returns the callback's `R` verbatim (ok.t […truncated, full text in findings.json]

---

### `consumers/rc-10` — Awaiting a `Settled` — the shape most `@antithrow/std` functions return — is flagged by `@typescript-eslint/await-thenable`

**Severity:** medium · **Category:** ergonomics · **Verifier verdict:** confirmed

**Claim.** The three-state model's selling point is "one type, one API — just `await` it". But `@antithrow/std` returns `Settled` for its sync wrappers (`JSON.parse`, `atob`, `decodeURI`, `structuredClone`) and `Result` for its async ones (`fetch`, `Response.*`), and `@antithrow/node` mixes both. A consumer who uniformly `await`s gets lint errors on exactly the sync half, so uniform handling is not actually available; they must statically track which package function returns which shape.

<details><summary><strong>Empirical evidence</strong></summary>

`eslint -c eslint.await.mjs src/awaiting.ts` in `/tmp/.../real-consumer/lintlab`:
```
12:13  error  Unexpected `await` of a non-Promise (non-"Thenable") value  @typescript-eslint/await-thenable   (await SafeJSON.parse("{}"))
16:13  error  Unexpected `await` of a non-Promise (non-"Thenable") value  @typescript-eslint/await-thenable   (await new Ok(1))
```
`await readFile(...)` (declared `Result`, i.e. the union containing `Pending`) is *not* flagged — so the diagnostic depends entirely on which sibling function you called.

</details>

**Recommendation.** Either (a) make `Ok`/`Err` trivially `PromiseLike` too (a `then` that resolves to `this`), so `await anyResult` is always legitimate and the ecosystem agrees — this also makes `Result` genuinely uniform; or (b) commit to `await result.settle()` as the single documented way to collapse, and stop showing bare `await result` in the tutorial and how-tos. Today the docs teach (b) in `explanation/three-state-model.md:39` but the tutorial demonstrates bare `await` at `tutorial/04-go-async.md:29`.

**Verifier note.** Reproduced exactly: `eslint -c eslint.await.mjs src/awaiting.ts` -> two `@typescript-eslint/await-thenable` errors at 12:13 (`await SafeJSON.parse('{}')`) and 16:13 (`await new Ok(1)`), while `await readFile(...)` (declared `Result`, union containing Pending) is not flagged. So the diagnostic does d […truncated, full text in findings.json]

---

### `consumers/rc-11` — 49 near-identical `Result.try(() => nodeFn(...args))` wrappers with no factory to collapse them, and a hand-rolled one loses all precision

**Severity:** medium · **Category:** ergonomics · **Verifier verdict:** adjusted

**Claim.** Of ~71 exported functions in `@antithrow/std` + `@antithrow/node`, 49 have a body that is literally `return Result.try(() => <underlying>(...args));`. There is no `Result.fromThrowable`/`wrap` combinator to express this point-free. A user-land one compiles, but because of rc-5 it cannot preserve the `Settled`-for-sync / `Pending`-for-async distinction and needs an internal cast — so the sibling packages correctly did not write one.

<details><summary><strong>Empirical evidence</strong></summary>

`grep -rn 'return Result.try(' packages/{std,node}/src | grep -v .test.ts | wc -l` -> `49`.
`bun x tsc --ignoreConfig --noEmit --strict ... /tmp/.../real-consumer/11-fromthrowable.ts` -> `EXIT=0`, with both `@ts-expect-error` markers satisfied:
```ts
const atob = fromThrowable<[string], string, DOMException>(nodeAtob);
// @ts-expect-error atob should ideally be Settled<string, DOMException>
export const s: Settled<string, DOMException> = atob("x");
// @ts-expect-error readFile should ideally be Pending<Buffer, ErrnoException>
export const p: Pending<Buffer, NodeJS.ErrnoException> = readFile("x");
```
i.e. the best a consumer can write today collapses everything to `Result<Awaited<T>, E>`.

</details>

**Recommendation.** Ship `Result.fromThrowable(fn, mapErr?)` in the core, with the same conditional return type proposed in rc-5 so it yields `Settled` for sync functions and `Pending` for promise-returning ones. That collapses `@antithrow/node`'s `fs/promises` module to a table of `export const readFile = Result.fromThrowable(nodeReadFile)` and removes the arrow-wrapping noise from 49 sites — and it composes with rc-3's catch-mapper to make `E` earned rather than asserted.

**Verifier note.** The counts and the API gap are correct: `grep -rn 'return Result.try(' packages/{std,node}/src | grep -v test | wc -l` -> 49, out of ~68 exported functions, and there is no `Result.fromThrowable`/`wrap` in the public surface. But the key supporting claim is wrong: 'because of rc-5 it cannot preserve […truncated, full text in findings.json]

---

### `consumers/rc-13` — Consumer-facing how-to docs contain three type errors on core composition APIs

**Severity:** medium · **Category:** docs · **Verifier verdict:** confirmed

**Claim.** `apps/docs/docs/how-to/core/combine-results.md` demonstrates `.and()` and `.or()` by passing the *function* rather than calling it (`authenticate().and(loadProfile)`, `readPrimary().or(readSecondary)`) — both are type errors, since `and`/`or` take a `Result`. The same file claims "`andThen(identity)` is equivalent to `.flatten()`", which is false for a non-Result payload (`andThen` requires the callback to return a `Result`, so `plain.andThen(x => x)` does not typecheck, while `plain.flatten()` is fine). Separately, `how-to/core/wrap-a-throwing-function.md:14` states "`parsed` is `Result<unknown, unknown>`" for `Result.try(() => JSON.parse(input))`; the real type is `Settled<any, unknown>` — wrong on the state axis *and* silently leaking `any` in the doc's own example.

<details><summary><strong>Empirical evidence</strong></summary>

`bun x tsc --ignoreConfig --noEmit --strict ... /tmp/.../real-consumer/13-doc-claims.ts` -> `EXIT=0`, meaning every `@ts-expect-error` below was genuinely needed:
```ts
export type D1 = Expect<Equal<typeof parsed, Settled<any, unknown>>>;   // ACTUAL, holds
// @ts-expect-error doc's stated type is wrong
export type D1bad = Expect<Equal<typeof parsed, Result<unknown, unknown>>>;
if (parsed.isOk()) { const v = parsed.value; v.literally.anything.goes(); }  // compiles: `any` leak
// @ts-expect-error doc example passes the function itself
export const pair = authenticate().and(loadProfile);
// @ts-expect-error doc example passes the function itself
export const source = readPrimary().or(readSecondary);
// @ts-expect-error andThen(identity) on a non-Result payload is not even well-typed
export const viaAndThen = plain.andThen((x) => x);
```

</details>

**Recommendation.** Fix the three snippets (`and(loadProfile())`, `or(readSecondary())`, and qualify the `andThen(identity)` claim to "when `T` is itself a `Result`"). Correct the stated type to `Settled<any, unknown>` and use the opportunity to warn that `JSON.parse` returns `any`, which defeats the library's purpose — that example should show `Result.try(() => JSON.parse(input) as unknown)`. Better: run the docs' TypeScript code fences through `tsc` in CI (a docusaurus + `eslint-plugin-mdx`/`typescript-docs-verifier` pass) so this class of drift cannot recur.

**Verifier note.** All three doc defects verified against apps/docs/docs/how-to/core/combine-results.md, which literally contains `authenticate().and(loadProfile)` and `readPrimary().or(readSecondary)` (functions, not Results) and the sentence '`andThen(identity)` is equivalent to `.flatten()`'. 13-doc-claims.ts compi […truncated, full text in findings.json]

---

### `consumers/rc-15` — No `Result.all`/`combine`: parallel composition must be hand-rolled through `Promise.all`

**Severity:** medium · **Category:** ergonomics · **Verifier verdict:** confirmed

**Claim.** The public API has no way to fold `Result<T,E>[]` into `Result<T[], E>`. `Result.do` is strictly sequential — with `@antithrow/node`'s `readFile`, `yield*`-ing N files serialises them. The only parallel route is `Promise.all` (which works, since `Pending` is `PromiseLike`), but it hands back `Settled<T,E>[]` and the caller must hand-write the short-circuit fold. There is also no accumulating variant, which validation consumers (`@antithrow/standard-schema` users collecting all field errors) would want.

<details><summary><strong>Empirical evidence</strong></summary>

`bun x tsc --ignoreConfig --noEmit --strict ... /tmp/.../real-consumer/16-parallel.ts` -> `EXIT=0`, with all three `@ts-expect-error` markers satisfied (`import { all } from "antithrow"`, `Result.combine`, `Result.all` all absent), and the `Equal` assertion holding that `await Promise.all(paths.map(p => readFile(p)))` is `Settled<Buffer, NodeJS.ErrnoException>[]` — requiring the hand-written loop in that file.
Runtime confirmation `bun -e '... Promise.all([readFile("/etc/hosts"), readFile("/nope")])'` -> `[ "Ok", "Err" ]`.
The docs' `how-to/core/combine-results.md` covers only `and`/`or`/`andThen`/`flatten` — nothing about N-ary combination.

</details>

**Recommendation.** Add `Result.all(results)` (fail-fast, returns `Settled`/`Pending` depending on inputs, tuple-preserving via variadic tuple types) and `Result.allSettled`/`Result.partition` (accumulating, returns `Result<T[], E[]>`). Tuple-preserving inference matters: `Result.all([Result<string,A>, Result<number,B>])` should give `Result<[string, number], A|B>`. This is the single most commonly requested combinator in Result libraries and its absence is the most likely reason a consumer reaches back for raw promises.

**Verifier note.** 16-parallel.ts compiles at EXIT=0 with all three @ts-expect-error markers live, so `import { all }`, `Result.combine` and `Result.all` are genuinely absent, and the Equal assertion holds that `await Promise.all(paths.map(readFile))` is `Settled<Buffer, NodeJS.ErrnoException>[]` requiring the hand-wr […truncated, full text in findings.json]

---

### `consumers/rc-5` — `Result.try` cannot produce `Settled` when the value type is an unresolved generic — this is why `@antithrow/std`'s `structuredClone` hand-rolls try/catch

**Severity:** medium · **Category:** type-safety · **Verifier verdict:** adjusted

**Claim.** `NonThenable<T> = Extract<T, PromiseLike<unknown>> extends never ? T : never` (packages/antithrow/src/types.ts) does not reduce for a naked type parameter, so the `Settled`-returning overload of `resultTry` (packages/antithrow/src/result.ts:34) never matches inside a generic function. Overload resolution falls through to the widest `Result<T,E>` signature. The result is visible in the shipped code: `packages/std/src/structured-clone.ts:29-33` is the *only* wrapper in `@antithrow/std`/`@antithrow/node` that hand-rolls `try { return new Ok(...) } catch { return new Err(error as DOMException) }` instead of using `Result.try`, and it is also the only generic-payload wrapper in either package. Explicit type arguments do not help.

<details><summary><strong>Empirical evidence</strong></summary>

`bun x tsc --ignoreConfig --noEmit --strict --exactOptionalPropertyTypes --noUncheckedIndexedAccess ... /tmp/.../real-consumer/02-try-generic.ts`:
```
02-try-generic.ts(10,2): error TS2322: Type 'Result<T, DOMException>' is not assignable to type 'Settled<T, DOMException>'.
  Type 'Pending<T, DOMException>' is not assignable to type 'Settled<T, DOMException>'.
    Type 'Pending<T, DOMException>' is missing the following properties from type 'Err<T, DOMException>': error, [Symbol.iterator]
```
The non-generic control (`atobTry(data: string)`, i.e. what `packages/std/src/base64.ts:17` does) compiles clean in the same file.
Workarounds also fail — `/tmp/.../real-consumer/03-try-generic-workarounds.ts` gives the identical TS2322 for both `Result.try<T, DOMException>(...)` (explicit type args) and `<T extends { then?: never }>` (constrained T); only the fully-monomorphic `w3(v: string)` compi […truncated, full text in findings.json]

</details>

**Recommendation.** Replace the `NonThenable`-guarded overload with a conditional return type computed from the callback's return type, e.g. `function try<F extends () => unknown, E = unknown>(fn: F): [Awaited<ReturnType<F>>] extends [ReturnType<F>] ? Settled<ReturnType<F>, E> : Pending<Awaited<ReturnType<F>>, E>` — or, simpler and more predictable, split the API into `Result.trySync` (always `Settled`) and `Result.tryAsync` (always `Pending`) and keep `Result.try` as the union-returning convenience. Either fix lets `structuredClone` join the other 49 wrappers instead of hand-rolling.

**Verifier note.** Every fact reproduces. 02-try-generic.ts gives exactly the quoted TS2322 ('Type Result<T, DOMException> is not assignable to Settled<T, DOMException>'), the non-generic `atobTry` control compiles, and 03-try-generic-workarounds.ts gives the identical error for both the explicit-type-arg and constrai […truncated, full text in findings.json]

---

### `consumers/rc-7` — No narrowing-assertion helper: the sibling packages' 124 `unwrap()` calls exist because `isOk()` cannot be used through an assertion, and the rule's own advice does not compile

**Severity:** medium · **Category:** ergonomics · **Verifier verdict:** confirmed

**Claim.** `no-unsafe-unwrap` tells users "`unwrap` on `Ok` is unnecessary. Use `.value` instead", but the dominant real-world shape — `expect(result.isOk()).toBe(true)` followed by reading the payload — cannot use `.value`, because `isOk()` is a `this`-predicate that only narrows inside a control-flow branch. There is no `Result.assertOk` / `expectOk` / `unwrapOr`-style bridge in the public API (`Object.keys(import("antithrow"))` = `["Err","Ok","Pending","Result","UnwrapError"]`). So all three sibling packages reach for `unwrap()`/`unwrapErr()` — 52 and 72 occurrences respectively across std/node/standard-schema tests — and `.value`/`.error` appear zero times in those same files.

<details><summary><strong>Empirical evidence</strong></summary>

`bun x tsc --ignoreConfig --noEmit --strict ... /tmp/.../real-consumer/10-narrowing-gap.ts` -> `EXIT=0`, where both `@ts-expect-error` markers are satisfied:
```ts
const r = safeDecodeURI("x");
expect(r.isOk()).toBe(true);
// @ts-expect-error Property 'value' does not exist on type 'Settled<string, URIError>'
const v: string = r.value;
// @ts-expect-error no Result.assertOk / expectOk / Ok.assert in the public API
import { assertOk } from ".../dist/index.js";
```
Usage counts across the sibling packages' tests: `.unwrap()` 52, `.unwrapErr()` 72, `isOk()` 72, `isErr()` 65, `.value` 0, `.error` 0 (grep over `packages/{std,node,standard-schema}/src/**/*.test.ts`). The 124 `no-unsafe-unwrap` violations in rc-6 are precisely these.

</details>

**Recommendation.** Add an asserting narrower to the core — `assertOk(r): asserts r is Ok<T,E>` / `assertErr` (or `Ok.assert(r)`), throwing `UnwrapError` on mismatch — so the type flows past a test assertion and `.value` becomes usable. Alternatively add `Result.expect(message)` in Rust's spirit. Then either the sibling tests migrate off `unwrap()`, or `no-unsafe-unwrap` gains an option to permit `unwrap` in files matching a test glob. As written, a rule whose recommended replacement does not typecheck at the majority of real call sites will just be disabled.

**Verifier note.** 10-narrowing-gap.ts compiles clean under the stated flags (EXIT=0) with both @ts-expect-error markers live — I sanity-checked the harness by deleting one marker, which then produced `TS2339: Property 'value' does not exist on type 'Settled<string, URIError>'`, so the expect-errors are genuinely need […truncated, full text in findings.json]

---

### `consumers/rc-9` — A floating `Pending` is invisible to `@typescript-eslint/no-floating-promises` by default, and the plugin's own rule has large coverage gaps

**Severity:** medium · **Category:** ergonomics · **Verifier verdict:** adjusted

**Claim.** `Pending` is `PromiseLike` but not a `Promise`, so the ecosystem's standard safety net does not fire on a dropped async Result under its default settings — a user of `@antithrow/node` who does not install `@antithrow/eslint-plugin` gets *less* protection than they had with raw `fs/promises`. `checkThenables: true` does catch it, but that option is off by default and the resulting message advises `.catch(...)`/`.then(onRejected)`, neither of which exists on `Pending`. Meanwhile `no-unused-result` only visits `ExpressionStatement`, so the most common real drop — assigning a `Pending` to a variable and never awaiting it — is missed, as are array pushes and object properties.

<details><summary><strong>Empirical evidence</strong></summary>

`/tmp/.../real-consumer/lintlab`, default config:
```
 6:1 error This Result must be used... @antithrow/no-unused-result   (readFile)
 7:1 error This Result must be used... @antithrow/no-unused-result   (fetch)
14:1 error Promises must be awaited... @typescript-eslint/no-floating-promises   (Promise.resolve(1))
15:1 error Promises must be awaited... @typescript-eslint/no-floating-promises
```
-> no-floating-promises is silent on lines 6-7. With `checkThenables: true` it fires on 6 and 7. `Pending` surface check: `catch: undefined finally: undefined then: function instanceof Promise: false`.
Coverage gaps, `eslint src/gaps.ts` reports only 3 of 7:
```
12:24 error ... (forEach body)
21:1  error ... (Result.do dropped)
24:1  error ... (new Ok(1))
```
Not reported: `const dropped = readFile(...)` (G1), `jobs.push(readFile(...))` (G2), `const holder = { r: readFile(...) }` (G4), arrow implici […truncated, full text in findings.json]

</details>

**Recommendation.** (1) Have the plugin's `recommended` config document (or, if it takes a `typescript-eslint` peer, enable) `@typescript-eslint/no-floating-promises` with `checkThenables: true` as a companion. (2) Extend `no-unused-result` beyond `ExpressionStatement` to at least `VariableDeclarator` whose binding is never read, mirroring `no-floating-promises`' `ignoreVoid` semantics. (3) Consider adding no-op `catch`/`finally` to `Pending` that map into the `Err` channel, so third-party lint advice and muscle memory are not actively wrong.

**Verifier note.** First half confirmed: with default settings `@typescript-eslint/no-floating-promises` is silent on floating `readFile(...)`/`fetch(...)` (lines 6-7) while firing on lines 14-15; with `checkThenables: true` it fires on 6 and 7; Pending has no `.catch`/`.finally` so the message's advice is inapplicabl […truncated, full text in findings.json]

---

### `errors-exceptions/ep-11` — No toJSON and no variant tag: Pending silently serializes to {"promise":{}}, Ok(undefined) and Err(undefined) are byte-identical, and structuredClone drops the class and UnwrapError.result

**Severity:** medium · **Category:** ergonomics · **Verifier verdict:** confirmed

**Claim.** Ok/Err/Pending are plain classes with one public field and no `toJSON`. Logging or IPC-transferring a Result therefore (a) loses the variant when the payload is undefined — `Ok(undefined)` and `Err(undefined)` both stringify to `{}`; (b) reduces a Pending to `{"promise":{}}`, which discards the entire state with no marker that anything was lost, and throws DataCloneError under structuredClone; (c) loses the prototype under both JSON round-trip and structuredClone, so `instanceof Ok` is false on the other side. For UnwrapError the damage is inverted: `name` and `result` are own enumerable class fields, so `JSON.stringify` emits them while dropping `message` and `stack` (the reverse of normal Error behavior), and structuredClone downgrades it to a plain `Error` losing both `name` and `.result`.

<details><summary><strong>Empirical evidence</strong></summary>

`bun /tmp/.../exception-posture/05-hazards-serialization.ts` sections AA/AB and `node /tmp/.../08-final.mjs` sections AE/AF:
```
  Ok:      {"value":42}
  Err:     {"error":"bad"}
  Pending: {"promise":{}}
  parsed Ok: { value: 42 } instanceof Ok: false
  Ok: cloned -> { value: 42 } instanceof: false
  Pending: THREW DataCloneError: The object can not be cloned.
  JSON.stringify(ue): {"result":{"error":{"code":500}},"name":"UnwrapError"} <- own enumerable fields leak; message/stack lost
  Object.keys(ue): ["result","name"]
  structuredClone -> instanceof UnwrapError: false | name: Error | .result preserved: false
  Ok(undefined) -> {}  Err(undefined) -> {} <- IDENTICAL
  no toJSON / no tag field on any variant: false false false
```

</details>

**Recommendation.** Add `toJSON()` to all three classes emitting an explicit discriminant, e.g. `{ status: "ok", value }`, `{ status: "err", error }`, `{ status: "pending" }` — this fixes the undefined collision and makes a logged Pending self-describing. Pair it with a `Result.fromJSON` for the round trip. On UnwrapError, declare `name` via a prototype getter or `Object.defineProperty(this, "name", { value: "UnwrapError", enumerable: false })` instead of a class field, so it stops appearing in JSON.stringify output, and add a `toJSON` that emits `{ name, message, result }`.

**Verifier note.** Every quoted line reproduced. `bun 05-hazards-serialization.ts`: `Ok: {"value":42}`, `Err: {"error":"bad"}`, `Pending: {"promise":{}}`, `parsed Ok: {value: 42} instanceof Ok: false`, `Ok: cloned -> {value:42} instanceof: false`, `Pending: THREW DataCloneError: The object can not be cloned.` `node 08 […truncated, full text in findings.json]

---

### `errors-exceptions/ep-12` — Pending has no catch/finally, so the only recovery from a poisoned Pending is the try/catch the library exists to eliminate

**Severity:** medium · **Category:** ergonomics · **Verifier verdict:** confirmed

**Claim.** Pending implements only `then` (pending.ts:31). There is no `.catch()`, no `.finally()`, and no method that converts a faulted Pending back into a `Result`. Once a callback has poisoned a chain (ep-1), the user's options are `await` inside a `try`/`catch`, the two-argument `then(onFulfilled, onRejected)` (which is untyped w.r.t. the Result API and returns a bare `PromiseLike`, dropping out of the Result world), or `Result.fromPromise(pending)` — which does recover the fault as an Err but double-wraps a healthy Pending into `Ok<Ok<T>>`, so it is not a usable general-purpose repair.

<details><summary><strong>Empirical evidence</strong></summary>

`node /tmp/.../exception-posture/08-final.mjs` section AG:
```
  'catch' in Pending.prototype: false | 'finally': false
  only recovery: await inside try/catch -> poison (i.e. the try/catch this library exists to remove)
```
`bun /tmp/.../05-hazards-serialization.ts` section Z shows why fromPromise is not the answer:
```
  Result.fromPromise(poisoned) settles to: Err error: BOOM
  ...but on a HEALTHY pending, fromPromise gives: Ok value: Ok <- double-wrapped Ok<Ok<...>>
```

</details>

**Recommendation.** Add `Pending.prototype.catchRejection<F>(fn: (reason: unknown) => F): Pending<T, E | F>` that maps an inner rejection into an `Err`, giving users a first-class, in-Result way to seal a chain before it escapes. Also special-case `Result.fromPromise` to detect a `Pending` argument and return it (or its settled form) rather than wrapping it, removing the `Ok<Ok<T>>` trap.

**Verifier note.** Reproduced. `node 08-final.mjs` section AG printed `'catch' in Pending.prototype: false | 'finally': false` and showed `await` inside try/catch as the only recovery. Source confirms pending.ts declares only `then` (line 31) among promise methods; there is no method converting a faulted Pending back  […truncated, full text in findings.json]

---

### `errors-exceptions/ep-4` — "UnwrapError is the only class antithrow ever throws" / "No other antithrow function throws" is false — three counterexamples, one thrown from library code

**Severity:** medium · **Category:** docs · **Verifier verdict:** confirmed

**Claim.** apps/docs/docs/reference/antithrow/unwrap-error.md asserts twice that UnwrapError is "The only class antithrow ever throws" and "No other antithrow function throws." Three public-API paths falsify this: (1) `Err[Symbol.iterator]` throws a plain `Error("Unreachable: generator should have been halted")` when resumed (err.ts:123, reachable through the public iterator protocol and already exercised by pending.test.ts:769); (2) `Ok.map` throws from inside ok.ts when the callback returns a thenable whose `.then()` throws, i.e. the library itself calls `.then` and lets it escape; (3) every `@throws`-tagged method propagates arbitrary user exceptions, which the same doc page's blanket claim ignores.

<details><summary><strong>Empirical evidence</strong></summary>

`node /tmp/.../exception-posture/09-other-throws.mjs` printed:
```
  Err[Symbol.iterator] resumed -> Error: "Unreachable: generator should have been halted" | instanceof UnwrapError: false
  Ok.map(-> broken thenable) -> TypeError: bad thenable (thrown from ok.js, not from the user callback's body)
  Ok.mapOr -> RangeError: cb
```
Case (2) is the library's own code path: `Ok.map` runs `isThenable(result)` (utils.ts, a duck-type check for a callable `.then`), then calls `result.then(...)` at ok.ts:49 — that call throws before any Pending is constructed.

</details>

**Recommendation.** Soften the claim to "UnwrapError is the only error type antithrow constructs as part of its normal API contract" and add the exceptions list. Separately, replace the `throw new Error("Unreachable...")` in err.ts:123 with a `TypeError` subclass exported from errors.ts (or make it an UnwrapError variant) so consumers can discriminate it, and wrap the `result.then(...)` call in ok.ts:49 / err.ts:46 so a hostile thenable cannot make a documented-non-throwing construction path throw.

**Verifier note.** Both doc assertions are verbatim: unwrap-error.md:11 "The only class antithrow ever throws." and :38 "No other antithrow function throws." All three counterexamples reproduced by `node 09-other-throws.mjs`: `Err[Symbol.iterator]` resumed → `Error: "Unreachable: generator should have been halted" | i […truncated, full text in findings.json]

---

### `errors-exceptions/ep-5` — Result.do with an async generator returns Pending<T, never> — an error channel typed `never` that still rejects at runtime

**Severity:** medium · **Category:** type-safety · **Verifier verdict:** adjusted

**Claim.** result.ts:75 declares `resultDo<T>(generator: () => AsyncGenerator<never, T, void>): Pending<T, never>`. `E = never` is the strongest possible claim the type system can make: this operation cannot fail. Yet if anything inside the generator body throws — including a poisoned Pending flowing in via `yield*` — the returned `Pending<T, never>` rejects. Awaiting it produces a raw exception, not an `Err`, on a value whose type says no error exists. The async generator never even resumes; the exception bypasses the Result channel entirely.

<details><summary><strong>Empirical evidence</strong></summary>

tsc (EXIT=0) confirms the type in 06-typecheck.ts: `type _9 = Expect<Equal<typeof d, Pending<number, never>>>` for `Result.do(async function* () { return yield* new Ok<number, never>(1); })`.
Runtime, `node /tmp/.../08-final.mjs`:
```
=== AD. Result.do async gives Pending<T, never> — E is `never` yet it can fail ===
  *** Pending<T, never>.settle() REJECTED with: no-err-channel -> a `never` error channel that still fails
```
And `bun /tmp/.../02-do-and-unhandled.ts` shows the poisoned Pending never becomes an Err:
```
=== G. Poisoned Pending flowing into Result.do via yield* ===
  before yield*
  Result.do returned: Pending
  *** awaiting Result.do REJECTED (not an Err!): BOOM-async
```
Note "after yield*" never printed — the generator is abandoned mid-flight. The sync generator form is at least honest, throwing at the call site (section I: `sync Result.do THREW: BOOM-sync-do`).

</details>

**Recommendation.** `Result.do`'s async overload should wrap the driver in try/catch and produce `Pending<T, E | unknown>`, converting a thrown/rejected body into `Err`. If the no-catch stance is preserved, the `Pending<T, never>` overload should be removed — returning `Pending<T, unknown>` at minimum stops the type from asserting infallibility. Note this also means the fail-fast `iter.return?.()` cleanup at result.ts:96 is skipped on the throw path, so `finally` blocks in the generator do not run when a yielded Pending is poisoned.

**Verifier note.** The headline claim is true and reproduced: result.ts:75 is `function resultDo<T>(generator: () => AsyncGenerator<never, T, void>): Pending<T, never>;`, tsc (EXIT=0) confirms `Result.do(async function* () { return yield* new Ok<number, never>(1); })` has type `Pending<number, never>`, and `node 08-fi […truncated, full text in findings.json]

---

### `errors-exceptions/ep-6` — UnwrapError message omits the payload, making every unwrap failure in a log indistinguishable

**Severity:** medium · **Category:** ergonomics · **Verifier verdict:** confirmed

**Claim.** err.ts:99 and ok.ts:116 use fixed strings: "Called unwrap() on an Err value" / "Called unwrapErr() on an Ok value". The error value itself never reaches the message. Rust's panic reads `called \`Result::unwrap()\` on an \`Err\` value: "db connection refused"`, and neverthrow surfaces the payload too. Here, a production log line or an uncaught-exception dump shows only the constant string — two unrelated failures in the same service produce byte-identical output, and the payload is only recoverable if the reader happens to have the live object and knows to look at `.result`.

<details><summary><strong>Empirical evidence</strong></summary>

`bun /tmp/.../exception-posture/03-unwraperror.ts` section L, unwrapping `new Err<number,string>("db connection refused")`:
```
  message: "Called unwrap() on an Err value"
  String(e): UnwrapError: Called unwrap() on an Err value
  payload visible in message? false
```

</details>

**Recommendation.** Build the message from the payload, e.g. `Called unwrap() on an Err value: ${inspect(this.error)}` with a length cap and a safe stringifier (String() for primitives, `err.message` for Errors, a truncated JSON for objects, a plain type name if stringification itself throws). Keep the constant prefix so existing `.toThrow("Called unwrap() on an Err value")` assertions in the suite still match as substrings.

**Verifier note.** Reproduced. `bun 03-unwraperror.ts` section L on `new Err<number,string>("db connection refused").unwrap()` printed `message: "Called unwrap() on an Err value"`, `String(e): UnwrapError: Called unwrap() on an Err value`, `payload visible in message? false`. Source confirms the fixed strings at err.t […truncated, full text in findings.json]

---

### `errors-exceptions/ep-7` — UnwrapError does not set `cause`, so an Err wrapping a real Error loses its stack trace entirely

**Severity:** medium · **Category:** ergonomics · **Verifier verdict:** confirmed

**Claim.** errors.ts:24-29 calls `super(message)` with no `ErrorOptions`. The overwhelmingly common shape is `Err<T, Error>` — the E payload is an Error with its own stack pointing at the true origin. When `unwrap()` throws, that stack is dropped: the UnwrapError's stack starts at err.ts:99 (the unwrap call), and the originating error's stack appears nowhere in any standard error printer, since Node/browser console error rendering walks `cause` and nothing else.

<details><summary><strong>Empirical evidence</strong></summary>

`bun /tmp/.../exception-posture/03-unwraperror.ts` section M, with `new Err<number, Error>(new Error("inner failure")).unwrap()`:
```
  cause set? false (cause = undefined )
  --- printed stack (what a logger/uncaught handler shows) ---
UnwrapError: Called unwrap() on an Err value
    at unwrap (/home/user/antithrow/packages/antithrow/src/err.ts:99:13)
    at .../03-unwraperror.ts:20:37
  --- inner error's stack is NOT in the output above; inner.message = inner failure
```
Section L confirms `"cause" in u` is `false` on the plain-string case as well.

</details>

**Recommendation.** In the UnwrapError constructor, set `cause` when the payload is an Error: `super(message, result.isErr() && result.error instanceof Error ? { cause: result.error } : undefined)`. This is a one-line change that restores the full chain in every standard printer, and combines well with ep-6.

**Verifier note.** Reproduced exactly. `bun 03-unwraperror.ts` section M with `new Err<number, Error>(inner).unwrap()` printed `cause set? false (cause = undefined )` and a stack whose frames are only `err.ts:99` plus the caller — the inner error's stack appears nowhere. Section L confirms `"cause" in u` is false on t […truncated, full text in findings.json]

---

### `errors-exceptions/ep-8` — UnwrapError.result is Settled<unknown, unknown> and UnwrapError is not generic, forcing a cast in every catch block

**Severity:** medium · **Category:** type-safety · **Verifier verdict:** confirmed

**Claim.** errors.ts:26 types the field as `Settled<unknown, unknown>`. After `error instanceof UnwrapError` and `error.result.isErr()`, the payload is `unknown`, so any structured recovery requires an unchecked cast — reintroducing exactly the untyped-error problem the library's own why-antithrow.md page argues against. There is no `UnwrapError<E>` generic to opt into, so the cast cannot be avoided even when the throw site knows E precisely.

<details><summary><strong>Empirical evidence</strong></summary>

tsc EXIT=0 on 06-typecheck.ts confirms both halves: `type _5 = Expect<Equal<typeof ue.result, Settled<unknown, unknown>>>` passes, the `@ts-expect-error` on `e.code` (where `e` is the narrowed `ue.result.error`) is *used* (i.e. the access really is an error), and `type _6 = UnwrapError<string>` is also a used `@ts-expect-error`, proving the class takes no type parameter.
Runtime call-site ergonomics, `bun /tmp/.../03-unwraperror.ts` section N:
```
  r.isErr(): true
  r.error runtime value: { code: 500 }  typeof: object
  after cast .code: 500
```
The `(err as { code: number }).code` cast is the only way to reach the payload.

</details>

**Recommendation.** Make it `class UnwrapError<T = unknown, E = unknown> extends Error { readonly result: Settled<T, E> }` and have `Err<T,E>.unwrap()` throw `UnwrapError<T, E>` / `Ok<T,E>.unwrapErr()` throw `UnwrapError<T, E>`. Existing `error instanceof UnwrapError` narrowing still works (it narrows to `UnwrapError<unknown, unknown>`), so this is source-compatible for consumers who do not name the type, while giving the throw site's own type information back to anyone who does.

**Verifier note.** Reproduced. tsc EXIT=0 on 06-typecheck.ts, which means every assertion held: `Equal<typeof ue.result, Settled<unknown, unknown>>` passes, the narrowed `ue.result.error` is `unknown`, and both `@ts-expect-error` directives (on `e.code` and on `UnwrapError<string>`) are USED — i.e. the property access […truncated, full text in findings.json]

---

### `errors-exceptions/ep-9` — Thenable payloads: a pure identity mapErr executes the payload's .then(), and an Err holding a rejected promise converts the Err channel into the throw channel

**Severity:** medium · **Category:** correctness · **Verifier verdict:** confirmed

**Claim.** err.ts:45 and ok.ts:48 branch on `isThenable(result)` — a duck-type check for a callable `.then` (utils.ts). This is applied to the callback's *return value*, so a pure identity callback over a thenable payload is not identity: it executes the thenable and awaits it away. Real-world payloads are thenable more often than expected (Knex/Prisma/TypeORM query builders, jQuery-style deferreds), so `new Err(queryBuilder).mapErr(q => q)` fires the query. Worse, an Err whose payload is a *rejected* promise both (a) produces a process-level unhandledRejection while sitting untouched in a supposedly-handled Err, and (b) turns into a rejecting Pending the moment anyone touches it with mapErr — the Err channel becoming the throw channel.

<details><summary><strong>Empirical evidence</strong></summary>

`bun /tmp/.../exception-posture/05-hazards-serialization.ts` section W, with a fake query builder `{ sql: "DELETE FROM x", then(res) { executed++; res("EXECUTED"); } }`:
```
  identity mapErr executed the thenable? 1 times; returned Pending
```
`bun /tmp/.../04-thenable-payloads.ts` sections Q and R:
```
=== Q ... ===
  identity mapErr returned: Pending (expected Err, got Pending => identity is NOT identity)
  settled: Err error = "payload-string" <- promise was AWAITED away
=== R. Err whose error value is a REJECTED promise (double-fault) ===
  constructed Err holding a rejected promise; nothing observed it yet
  !! unhandledRejection: inner-rejected
  now mapErr identity on it:
  *** settle() REJECTED: inner-rejected — the Err channel became the throw channel
```

</details>

**Recommendation.** Tighten `isThenable` to require a *native* promise or at least a two-argument `.then` (`typeof v.then === "function" && v.then.length >= 2`), which excludes most side-effecting builder objects. Better: stop inferring async-ness from the return value at all and provide explicit `mapAsync`/`mapErrAsync`/`andThenAsync` methods, so `map` is never able to execute a payload. At minimum, document that any thenable value flowing through map/mapErr will be assimilated, and that Ok/Err payloads must not be thenable.

**Verifier note.** Reproduced. `bun 05-hazards-serialization.ts` section W printed `identity mapErr executed the thenable? 1 times; returned Pending` for the fake query-builder. `bun 04-thenable-payloads.ts` section Q printed `identity mapErr returned: Pending` then `settled: Err error = "payload-string" <- promise wa […truncated, full text in findings.json]

---

### `packaging/pkg-2` — Jest (and any resolver that does not supply the "import" condition) cannot resolve `antithrow` at all — not "needs a transform", literally module-not-found

**Severity:** medium · **Category:** packaging · **Verifier verdict:** adjusted

**Claim.** `jest-environment-node` resolves with `customExportConditions: ["node", "node-addons"]` and `require`. Since the exports map has no `require`, no `node`, and no `default`, resolution fails outright — the user gets "Cannot find module 'antithrow'", a message that points them at their own config rather than at the package. Jest remains one of the most-deployed JS test runners, so this is a large silent slice of the addressable audience. The `default` condition alone moves Jest past resolution.

<details><summary><strong>Empirical evidence</strong></summary>

cd /tmp/.../scratchpad/packaging/jesttest && npx jest   (jest 30, default node env, package.json type=commonjs, node_modules/antithrow symlinked to the real package)
  FAIL __tests__/a.test.js
    ● resolve antithrow under jest (require)
      Cannot find module 'antithrow' from '__tests__/a.test.js'
        at Resolver._throwModNotFoundError (node_modules/jest-resolve/build/index.js:895:11)
SAME test, symlink repointed at the `default`-patched copy:
  FAIL ... Jest encountered an unexpected token / "If you are trying to use ECMAScript Modules..."
  → resolution now SUCCEEDS; the remaining error is the ordinary ESM-syntax question, proving the module-not-found was caused specifically by the missing condition.
Condition-matrix simulation (resolve.exports, scratchpad/tools/resolve-conditions.mjs):
  Node ESM                          .        -> ./dist/index.js
  Node CJS require            […truncated, full text in findings.json]

</details>

**Recommendation.** Same one-line fix as pkg-1: append `"default": "./dist/index.js"`. Additionally document the ESM-only stance explicitly in README (there is currently no mention of ESM or CommonJS anywhere in packages/antithrow/README.md — verified by grep), so users who hit this know it is intentional rather than broken.

**Verifier note.** Resolution failure reproduces exactly: `npx jest` in the fixture gives "Cannot find module 'antithrow' from '__tests__/a.test.js'", and resolve.exports fails for [node,require]. But two things pull the severity down. (1) The title's "Jest ... cannot resolve `antithrow` at all" is too broad — I built […truncated, full text in findings.json]

---

### `packaging/pkg-4` — `antithrow/legacy` is unreachable under `moduleResolution: node10` — the migration path is closed to exactly the projects that need it

**Severity:** medium · **Category:** packaging · **Verifier verdict:** confirmed

**Claim.** The `./legacy` subpath exists only in the `exports` map. There is no `typesVersions` fallback and no `legacy/` stub directory, so classic node10 resolution (still the default for many older `module: commonjs` tsconfigs) cannot find it, while the root entry resolves fine via the top-level `main`/`types`. The subpath whose entire purpose is easing migration from v2 is the one broken for old toolchains; attw independently flags it 💀.

<details><summary><strong>Empirical evidence</strong></summary>

cd /tmp/.../scratchpad/packaging/node10 && tsc -p tsconfig.json   (module commonjs, moduleResolution node10, ignoreDeprecations 6.0)
  root.ts   (import { Ok } from "antithrow")        → no error
  legacy.ts (import { ok } from "antithrow/legacy") → legacy.ts(1,20): error TS2307: Cannot find module 'antithrow/legacy' or its corresponding type declarations.
    There are types at '.../node_modules/antithrow/dist/legacy/index.d.ts', but this result could not be resolved under your current 'moduleResolution' setting. Consider updating to 'node16', 'nodenext', or 'bundler'.
  tsc exit=2
attw table on antithrow-3.0.0.tgz:
  node10            | "antithrow": 🟢 | "antithrow/legacy": 💀 Resolution failed
Runtime confirmation: node require('antithrow/legacy') → ERR_PACKAGE_PATH_NOT_EXPORTED: Package subpath './legacy' is not defined by "exports".

</details>

**Recommendation.** Add `"typesVersions": { "*": { "legacy": ["./dist/legacy/index.d.ts"] } }`, or ship a `legacy/package.json` stub (`{"main":"../dist/legacy/index.js","types":"../dist/legacy/index.d.ts"}`) added to `files`. Combined with the `default` condition from pkg-1 this makes the migration entrypoint reachable from every resolver generation.

**Verifier note.** Reproduced: under module commonjs + moduleResolution node10, root.ts is clean and legacy.ts gives TS2307 with TS's own hint that types exist at dist/legacy/index.d.ts but are unreachable under this setting (tsc exit 2). attw on the tarball independently shows node10 | "antithrow" 🟢 | "antithrow/leg […truncated, full text in findings.json]

---

### `packaging/pkg-6` — CHANGELOG 3.0.0 does not disclose that `Result.all` was removed — and its own patch entry advertises a function absent from the shipped root API

**Severity:** medium · **Category:** docs · **Verifier verdict:** confirmed

**Claim.** `Result.all` was introduced as a headline minor feature in 2.0.0 and the 3.0.0 release notes even contain "perf: reduce unnecessary array overhead in `Result.all`" — but the 3.0.0 root `Result` namespace has only `try`, `fromPromise` and `do`. The 3.0.0 Major Changes block enumerates what was removed (`ok`, `err`, `okAsync`, `errAsync`, `ResultAsync`, `chain`) and does not mention `Result.all`. A reader of the changelog upgrading from 2.x has no warning that a combinator they use disappeared, and the surviving patch note points them at a function that exists only in the deprecated subpath.

<details><summary><strong>Empirical evidence</strong></summary>

node /tmp/.../scratchpad/packaging/legacy-identity.mjs →
  typeof main.Result : object ["try","fromPromise","do"]
  main.Result.all exists?   false
  legacy.Result.all exists? function
grep -rn "\ball\b" packages/antithrow/dist/*.d.ts packages/antithrow/dist/*.js → (no matches at all)
grep -n "all" packages/antithrow/dist/legacy/result.d.ts → line 531: `all<const T extends readonly Result<unknown, unknown>[]>(results: T): Result<OkTuple<T>, ErrUnion<T>>;`
CHANGELOG.md line 25 (under 3.0.0 → Patch Changes): "perf: reduce unnecessary array overhead in `Result.all`"
CHANGELOG.md lines 16-19 (3.0.0 breaking list) mentions only ok/err/okAsync/errAsync/ResultAsync/chain.
The docs site is consistent with the code (grep for "Result.all" under apps/docs hits only docs/legacy/*), so the CHANGELOG is the sole stale artifact.

</details>

**Recommendation.** Add an explicit breaking-change bullet for the removal of `Result.all` to the 3.0.0 entry, with the recommended v3 replacement (or note that none exists yet). Longer term, a combinator over a tuple of Results is the single most commonly reached-for helper in this family of libraries — shipping v3 without one is a capability regression worth reversing.

**Verifier note.** All facts check out. CHANGELOG line 69 shows Result.all landing as a 2.0.0 Minor Change ('feat: implement new Result.all static function'), line 25 is the 3.0.0 Patch entry 'perf: reduce unnecessary array overhead in Result.all', and the 3.0.0 Major block enumerates removals (ok, err, okAsync, errAs […truncated, full text in findings.json]

---

### `packaging/pkg-7` — Published tarball contains no LICENSE file despite `"license": "MIT"`

**Severity:** medium · **Category:** packaging · **Verifier verdict:** confirmed

**Claim.** packages/antithrow/ has no LICENSE file (the only LICENSE lives at the monorepo root, which is not part of the package). npm/bun auto-include README and package.json but never a LICENSE that is not physically present in the package directory, so the published artifact asserts MIT in metadata while shipping none of the actual license text or copyright notice. Corporate license-scanning tooling and vendored-dependency audits routinely flag this.

<details><summary><strong>Empirical evidence</strong></summary>

tar -tzf /tmp/.../scratchpad/packaging/antithrow-3.0.0.tgz | grep -iE "licen|changelog"  →  (no output)
Full tarball inventory (30 files): package/README.md, package/package.json, package/dist/** only.
ls /home/user/antithrow/packages/antithrow → CHANGELOG.md  README.md  dist  package.json  src  tsconfig.build.json  tsconfig.json   (no LICENSE)
bun pm pack --dry-run agrees: "packed 1.12KB package.json / packed 4.52KB README.md / packed dist/... " — 30 files, no LICENSE, no CHANGELOG.
(The monorepo root does have /home/user/antithrow/LICENSE.)

</details>

**Recommendation.** Copy (or symlink-and-dereference at publish time) LICENSE into each publishable package directory, and add `"CHANGELOG.md"` to `files` so npm's release page and offline consumers can see the history. This applies to all five workspace packages, not just antithrow.

**Verifier note.** Verified independently: full tarball listing is 30 entries — package/README.md, package/package.json, package/dist/** — and `grep -iE 'licen|changelog'` over it returns nothing. packages/antithrow/ contains no LICENSE (only /home/user/antithrow/LICENSE at the monorepo root, outside the package), whi […truncated, full text in findings.json]

---

### `packaging/pkg-8` — `Result.try` and `Result.fromPromise` ship with zero IntelliSense documentation

**Severity:** medium · **Category:** docs · **Verifier verdict:** confirmed

**Claim.** The `Result` value is an object literal typed as `{ try: typeof resultTry; fromPromise: typeof fromPromise; do: typeof resultDo }`. `resultDo` carries a JSDoc block in src/result.ts, but `resultTry` and `fromPromise` do not — so hovering the two primary entrypoints into the library in an editor shows no description, no @example, and they present as `(property)` rather than as functions. Every instance method by contrast inherits rich docs from the abstract base, which makes the gap on the statics conspicuous.

<details><summary><strong>Empirical evidence</strong></summary>

node /tmp/.../scratchpad/packaging/tools/quickinfo.mjs   (TypeScript LanguageService getQuickInfoAtPosition against the real .d.ts via node_modules)
  o.map              docs="Transforms the value inside an {@link Ok} using the provided function,"...
  o.unwrapOr         docs="Returns the value if this result is {@link Ok}, otherwise returns the "...
  o.flatten          docs="Flattens one level of nested result from `Result<Result<T, E>, F>` int"...
  Result.try         docs=(NONE)
                     sig=(property) try: <number, unknown>(fn: () => number) => Settled<number, unknown> (+2 overloads)
  Result.fromPromise docs=(NONE)
                     sig=(property) fromPromise: <number, unknown>(promise: PromiseLike<number>) => Pending<number, unknown>
  Result.do          docs="Runs a generator in fail-fast mode by delegating over yielded {@link R"...
Source confirms: dist/result.d.t […truncated, full text in findings.json]

</details>

**Recommendation.** Add JSDoc with @example to `resultTry` and `fromPromise` in src/result.ts, matching `resultDo`. Per CLAUDE.md's own rule ("Use JSDoc with @example blocks for public API") this is an in-house standard violation on the two most-used functions in the package.

**Verifier note.** Confirmed in source, not just via the language service: src/result.ts has a full JSDoc block with @example on resultDo, and none on fromPromise (line 23) or the resultTry overloads (lines 31-34). The quickinfo probe reproduces — Result.try and Result.fromPromise show docs=(NONE) and render as `(prop […truncated, full text in findings.json]

---

### `legacy-migration/lm-10` — On the `Settled` union, `mapOrElse` and `unwrapOrElse` leak `PromiseLike` even with fully synchronous callbacks

**Severity:** medium · **Category:** type-safety · **Verifier verdict:** confirmed

**Claim.** `Settled<T,E>` is documented as "a settled result state with no pending branch", and it is the type a migrating user should reach for. But calling `mapOrElse` or `unwrapOrElse` on it returns `SyncOrAsync<U>` rather than `U`, even when the receiver and both callbacks are synchronous — a strict regression from legacy `match`/`unwrapOrElse`, which returned exactly `U`. The cause is union-receiver overload resolution: TypeScript synthesizes the call from the LAST overload of each constituent, and `Err.unwrapOrElse`'s last overload is the `SyncOrAsync<T>` one (err.ts:112) while `Err.mapOrElse`'s last is the `SyncOrAsync<U>` one (err.ts:65-68). Calling the same methods on a concrete `Ok`/`Err` gives the precise type, so the imprecision only appears at the type people actually annotate with.

<details><summary><strong>Empirical evidence</strong></summary>

`bun x tsc ... 17-settled-vs-legacy.ts` (reveal via `const _: never = expr`):
```
(13,7) legacy Result.mapOrElse      -> Type 'number'
(11,7) legacy Result.unwrapOrElse   -> Type 'number'
(20,7) core Settled.mapOrElse       -> Type 'SyncOrAsync<number>'
(18,7) core Settled.unwrapOrElse    -> Type 'SyncOrAsync<number>'
(23,7) core Ok.mapOrElse            -> Type 'number'
(24,7) core Err.mapOrElse           -> Type 'number'
```
Runtime proof the type is over-broad (`bun /tmp/.../legacy-migration/18-misc.ts`):
```
  mapOrElse -> 4 | is a promise? false | typeof: number
  unwrapOrElse -> 4 | is a promise? false | typeof: number
```
Also confirmed in 19-cookbook.ts: `Expect<Equal<typeof cs.mapOrElse(...), string | PromiseLike<string>>>` passes.

</details>

**Recommendation.** Replace the overload sets on `Err.unwrapOrElse` and `Err.mapOrElse` (and mirror on `Ok`) with a single conditional-return signature so union receivers resolve precisely, e.g. `unwrapOrElse<R extends SyncOrAsync<T>>(fn: (error: E) => R): R extends PromiseLike<infer A> ? PromiseLike<A> : R`. Add a type test that asserts `Settled<number,string>` returns exactly `number` from all five accessor methods — the current types.test.ts does not cover the union receiver.

**Verifier note.** Re-ran the never-reveal on 17-settled-vs-legacy.ts and got exactly the claimed split: line 18 `cs.unwrapOrElse((e) => e.length)` → `SyncOrAsync<number>` and line 20 `cs.mapOrElse((e) => e.length, (v) => v * 2)` → `SyncOrAsync<number>` on `Settled<number,string>`, while the same calls on concrete `Ok […truncated, full text in findings.json]

---

### `legacy-migration/lm-12` — Accidentally mixing generations produces a misleading diagnostic about `[Symbol.asyncIterator]`

**Severity:** medium · **Category:** ergonomics · **Verifier verdict:** confirmed

**Claim.** The two generations are correctly isolated at the type level — no legacy value can flow into a core combinator or `Result.do`, and vice versa (verified in both directions). But the diagnostic a half-migrated file gets is actively misleading: because `Result.do` is overloaded and the sync overloads fail on the yield type, TypeScript reports only the LAST overload's failure, which complains that a sync generator is missing `[Symbol.asyncIterator]`. The real problem — the yielded `Err` is the legacy class, which lacks `isPending`/`settle` — is never surfaced. Both classes are printed as `Err`, so even the correct message would read `Err is not assignable to Err`.

<details><summary><strong>Empirical evidence</strong></summary>

`bun x tsc ... 05-interop-types.ts` → EXIT=0, i.e. all 12 `@ts-expect-error` markers fired (legacy↛core `Result`/`Settled` assignment both ways, legacy into `Ok.andThen`/`Ok.and`, legacy `Ok`/`Err`/`ResultAsync` into `Result.do`, core `Err` into legacy `chain`, `Result.all` absent, and all eight dropped methods). The unhelpful message, `bun x tsc ... 06-error-messages.ts`:
```
06-error-messages.ts(5,22): error TS2769: No overload matches this call.
  The last overload gave the following error.
    Argument of type '() => Generator<Err<never, never>, number, void>' is not assignable to parameter of type '() => AsyncGenerator<Err<unknown, unknown>, unknown, void>'.
      Property '[Symbol.asyncIterator]' is missing in type 'Generator<...>' but required in type 'AsyncGenerator<...>'.
```
(the direct-method case is clearer: `Type 'Ok<number, never>' is missing the following properties from t […truncated, full text in findings.json]

</details>

**Recommendation.** Add a branded/nominal marker to the core classes (e.g. `declare readonly [ResultBrand]: true`) so cross-generation misuse fails on the brand with a clear name, and reorder/guard the `Result.do` overloads (or add a final catch-all overload with a `@ts-expect` style error message via a `never`-typed parameter) so the reported failure names the yielded type rather than `[Symbol.asyncIterator]`.

**Verifier note.** Both halves reproduce exactly. 05-interop-types.ts compiles at EXIT=0 (all 12 `@ts-expect-error` markers fire), and 06-error-messages.ts produces verbatim the claimed diagnostic: `TS2769: No overload matches this call. The last overload gave the following error. Argument of type '() => Generator<Err […truncated, full text in findings.json]

---

### `legacy-migration/lm-13` — `isOkAnd`/`isErrAnd` type-predicate narrowing has no equivalent in the new API

**Severity:** medium · **Category:** missing-capability · **Verifier verdict:** confirmed

**Claim.** Legacy `isOkAnd<S extends T>(fn: (value: T) => value is S): this is Ok<S, E>` narrowed the receiver through a user-supplied predicate; `isErrAnd` did the same for the error. The core API has neither method, and the documented-shaped replacement (`mapOr(false, p)`) returns a plain `boolean` that cannot narrow anything, so the receiver must be re-tested. This is a real capability loss, not just a rename, and it is not mentioned anywhere.

<details><summary><strong>Empirical evidence</strong></summary>

`bun x tsc ... 22-narrowing-loss.ts` → EXIT=0. It asserts that legacy `lr.isOkAnd((v): v is number => typeof v === "number")` narrows `lr.value` to `number` (`Expect<Equal<typeof lr.value, number>>` inside the guard) and that legacy `isErrAnd` narrows `lr2.error` to `Error`; then that `cs.mapOr(false, (v): v is number => ...)` is exactly `boolean` and that reading `cs.value` inside `if (isNum)` is an error (the `@ts-expect-error` fired), requiring the redundant `if (cs.isOk() && typeof cs.value === "number")`. Runtime parity of the value-level behaviour is shown in 02-dropped-runtime.ts (`legacy isOkAnd: true false` / `new isOkAnd via mapOr: true false`).

</details>

**Recommendation.** Add `isOkAnd`/`isErrAnd` to `ResultBase` with the legacy predicate-narrowing overloads (they compose naturally with the tri-state model: on `Pending` they can return `PromiseLike<boolean>` without a narrowing overload). If they stay out, document the `mapOr(false, p)` substitute and its narrowing loss in the migration guide.

**Verifier note.** 22-narrowing-loss.ts compiles at EXIT=0, so every assertion in it holds: legacy `isOkAnd((v): v is number => ...)` narrows the receiver to `Ok<number, Error>` and `isErrAnd` narrows the error, while `cs.mapOr(false, (v): v is number => ...)` is exactly `boolean` and the `@ts-expect-error` on reading […truncated, full text in findings.json]

---

### `legacy-migration/lm-3` — CHANGELOG claims the legacy API "is marked as deprecated" — `ok()` and `okAsync()` are not

**Severity:** medium · **Category:** docs · **Verifier verdict:** adjusted

**Claim.** The 3.0.0 note says "the previous API is still available from the new `antithrow/legacy` subpath and is marked as deprecated". Seven of the nine legacy exports do surface a deprecation in editors; `ok` and `okAsync` — by far the most-used legacy factories — do not. The `@deprecated` JSDoc sits only on each function's FIRST overload (`ok<E>(): Ok<void,E>` / `okAsync<E>(): ResultAsync<void,E>`); TypeScript only reports a symbol as deprecated when every declaration carries the tag, so `ok(1)` and `okAsync(1)` (which resolve to the untagged second overload) get no strikethrough and no suggestion — not even on the import specifier.

<details><summary><strong>Empirical evidence</strong></summary>

TS compiler-API suggestion diagnostics over a file using all nine legacy exports against the SHIPPED `dist/legacy` d.ts (`bun /tmp/.../legacy-migration/13-suggest.mjs`): 14 deprecation suggestions, covering `chain, Err, err, Ok, Result, ResultAsync, errAsync` — and `"ok"`/`"okAsync"` appear in none of them (`bun 13-suggest.mjs | grep -E '"(ok|okAsync)"'` prints nothing). Copying the d.ts to `patched/` and adding `/** @deprecated ... */` to only the second overload of each raises the count to 18 and produces:
```
deprecated @ line 1: "ok"
deprecated @ line 1: "okAsync"
deprecated @ line 4: "ok"
deprecated @ line 8: "okAsync"
total deprecation suggestions: 18
```
Source confirmation: dist/legacy/result.d.ts has the tagged block before `export declare function ok<E = never>(): Ok<void, E>;` and then a bare `export declare function ok<T, E = never>(value: T): Ok<T, E>;`; same shape at dist/l […truncated, full text in findings.json]

</details>

**Recommendation.** Duplicate the `@deprecated` tag onto every overload signature of `ok` and `okAsync` in packages/antithrow/src/legacy/{result,result-async}.ts (and audit any future multi-overload legacy export the same way). Add a build-time or test-time assertion that every symbol re-exported from `src/legacy/index.ts` produces a `reportsDeprecated` suggestion at its call site — the check in 13-suggest.mjs is ~20 lines and could live in the repo.

**Verifier note.** Reproduced precisely. `bun 13-suggest.mjs` against the shipped dist/legacy d.ts yields 14 `reportsDeprecated` suggestions covering chain/Err/err/Ok/Result/ResultAsync/errAsync, with zero for `ok` or `okAsync` — not even on the import specifier. Source confirms the cause: the tagged JSDoc block sits  […truncated, full text in findings.json]

---

### `legacy-migration/lm-4` — Every code sample in the docs' "Legacy (v2) API" section imports from the root entrypoint and does not compile

**Severity:** medium · **Category:** docs · **Verifier verdict:** adjusted

**Claim.** The docs ship a whole `docs/legacy/` section (result.md, result-async.md, chain.md, std.md, node.md, standard-schema.md, eslint-plugin/*), but not one of those pages mentions the `antithrow/legacy` subpath and not one mentions deprecation. The samples that do show imports import the removed names from the ROOT package, which 3.0.0 no longer exports. Anyone following the legacy reference gets a compile error immediately; anyone reading `docs/legacy/result.md` ("Complete API reference for the core `antithrow` package's synchronous types and functions") is not told they are reading about a deprecated API at all.

<details><summary><strong>Empirical evidence</strong></summary>

`grep -c 'antithrow/legacy'` over `docs/legacy/{result,result-async,chain,std,node,standard-schema}.md` = 0 for every file; `grep -ci 'deprecat'` = 0 for every file. Reproduced against the real exports map (symlinked `node_modules/antithrow` → packages/antithrow, `bun x tsc -p tsconfig.json` in docsrepro/) with docs/legacy/chain.md lines 22 and 41 copied verbatim:
```
from-legacy-docs.ts(2,10): error TS2305: Module '"antithrow"' has no exported member 'chain'.
from-legacy-docs.ts(2,17): error TS2724: '"antithrow"' has no exported member named 'ok'. Did you mean 'Ok'?
from-legacy-docs.ts(2,21): error TS2724: '"antithrow"' has no exported member named 'err'. Did you mean 'Err'?
from-legacy-docs.ts(3,10): error TS2305: Module '"antithrow"' has no exported member 'chain'.
from-legacy-docs.ts(3,27): error TS2305: Module '"antithrow"' has no exported member 'okAsync'.
```
The corrected `import […truncated, full text in findings.json]

</details>

**Recommendation.** Rewrite every import in `apps/docs/docs/legacy/**` to `antithrow/legacy`, add a deprecation admonition at the top of each page linking to a migration guide, and fix `docs/legacy/_category_.json` whose `description` is currently the wrong text ("Complete API documentation for all antithrow packages."). Add a docs CI step that type-checks fenced `ts` blocks so this class of rot is caught.

**Verifier note.** The verifiable core holds: no page under apps/docs/docs/legacy/ mentions `antithrow/legacy` or 'deprecat' (grep counts 0/0 for chain.md, node.md, result.md, result-async.md, standard-schema.md, std.md), _category_.json is labeled 'Legacy (v2) API' with the generic description 'Complete API documenta […truncated, full text in findings.json]

---

### `probe-ts-compat-floor/ok-4` — antithrow/legacy has a different and higher hard floor (TS 5.0) than the main entry (TS 4.7), and the failure is a parse error skipLibCheck cannot suppress

**Severity:** medium · **Category:** packaging · **Verifier verdict:** unverified

**Claim.** dist/legacy/result-async.d.ts:356 and dist/legacy/result.d.ts:531 use `const` type parameters (`static all<const T extends readonly AnyResult[]>(...)`), a TypeScript 5.0 syntax. Because it is a syntax error rather than a semantic one, `skipLibCheck: true` does not suppress it — importing `antithrow/legacy` is a hard compile failure on 4.7 and 4.9 under every configuration, while the main entry parses fine on those versions. So one package has two different hard floors depending on which subpath you import, and neither is documented. This is the reverse of the usual expectation that a 'legacy' entry point is the more conservative one.

<details><summary><strong>Empirical evidence</strong></summary>

grep -rn "<const " /home/user/antithrow/packages/antithrow/dist/legacy/*.d.ts
  -> dist/legacy/result-async.d.ts:356:    static all<const T extends readonly AnyResult[]>(results: T): ResultAsync<OkTuple<T>, ErrUnion<T>>;
     dist/legacy/result.d.ts:531:    all<const T extends readonly Result<unknown, unknown>[]>(results: T): Result<OkTuple<T>, ErrUnion<T>>;
(no `<const ` occurrences in the non-legacy dist/*.d.ts)

cases/legacy-import.ts = `import * as legacy from "antithrow/legacy";`
  ts47 --skipLibCheck TRUE --module node16 --moduleResolution node16:
    -> dist/legacy/result-async.d.ts(356,16): error TS1139: Type parameter declaration expected.
       dist/legacy/result-async.d.ts(356,22): error TS1434: Unexpected keyword or identifier.
       dist/legacy/result-async.d.ts(356,24): error TS1068: Unexpected token. A constructor, method, accessor, or property was expected.
       dist/ […truncated, full text in findings.json]

</details>

**Recommendation.** Pick one floor for the whole package and enforce it. Either (a) drop `const` from those two `all` signatures if 4.7 support is the goal, or (b) accept 5.0 as the package-wide floor and say so in package.json peerDependencies and the docs. Whichever you choose, add a per-entrypoint compile fixture to CI (import `antithrow` and `antithrow/legacy` separately) run against the declared minimum compiler, so the two subpaths cannot drift apart again.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-ts-compat-floor/ok-5` — Undeclared `lib` floor: es2018 is required just to type-check the import with skipLibCheck:false, and Result.do needs es2015 (sync) / es2018 (async)

**Severity:** medium · **Category:** packaging · **Verifier verdict:** unverified

**Claim.** The published .d.ts references `Symbol.iterator`, `Symbol.asyncIterator`, `Generator` and `AsyncGenerator` in three public classes and in the `Result.do` overload set. With `skipLibCheck:false`, a consumer whose `lib` is es5 gets 10 errors inside dist/ and one whose `lib` is es2015 gets 4 — merely from importing. With skipLibCheck:true the import survives, but `Result.do` still hard-fails: sync generators need lib es2015+, async generators need lib es2018+. `lib: es5` is what `target: es5` implies, which is still common in older React/webpack/Angular projects and in libraries that ship down-levelled output. None of this is documented; the tutorial tsconfig specifies `target: ES2022` but never says it is a requirement.

<details><summary><strong>Empirical evidence</strong></summary>

All with typescript 5.9.2, --strict --target es2022 --module esnext --moduleResolution bundler.

skipLibCheck:false, cases/lib-import.ts (`import { Ok, Err, Pending, Result } from "antithrow"`):
  --lib es5   -> 10 errors, e.g.
     dist/err.d.ts(41,6): error TS2585: 'Symbol' only refers to a type, but is being used as a value here. Do you need to change your target library? Try changing the 'lib' compiler option to es2015 or later.
     dist/err.d.ts(41,26): error TS2304: Cannot find name 'Generator'.
     dist/pending.d.ts(40,31): error TS2583: Cannot find name 'AsyncGenerator'. ... 'es2018' or later.
     dist/result.d.ts(50,47), (51,47), (52,87), (53,87): same Generator/AsyncGenerator errors
  --lib es2015 -> 4 errors:
     dist/pending.d.ts(40,13): error TS2339: Property 'asyncIterator' does not exist on type 'SymbolConstructor'.
     dist/pending.d.ts(40,31), dist/result.d.ts(51,47 […truncated, full text in findings.json]

</details>

**Recommendation.** Document the lib floor next to the TypeScript floor: `lib` must include es2018 (or `target: es2018`+) to consume the package at all with skipLibCheck:false, and es2018 is required for `Result.do` with async generators. Add es5/es2015/es2018 lib fixtures to the CI compile matrix. If broader reach matters, consider whether `[Symbol.asyncIterator]` on Pending and the AsyncGenerator overloads of `Result.do` can be moved behind a separate subpath so the core Ok/Err/Result surface stays consumable at lib es5, since those four references are the only thing forcing the floor.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-ts-compat-floor/ok-6` — Misleading IntelliSense on sub-floor compilers: hover shows an unresolved `NoInfer<U>` with an unsubstituted type parameter and a confidently wrong result type, with zero diagnostics

**Severity:** medium · **Category:** docs · **Verifier verdict:** unverified

**Claim.** Measured through the TypeScript language service (createLanguageService + getQuickInfoAtPosition), a developer on 5.3.3 hovering `mapOr` sees the signature rendered as `mapOr<number>(defaultValue: NoInfer<U>, fn: (value: number) => number): number` — note `NoInfer<U>` printed verbatim with an *unbound* `U`, the tell-tale rendering of an unresolved type reference. getSemanticDiagnostics returns nothing. Hovering the wrongly-typed variable reports `const PROBE1: number` even though a string was passed as the default. So the editor actively affirms the wrong type rather than degrading visibly, which is what makes ok-1 hard to notice in practice.

<details><summary><strong>Empirical evidence</strong></summary>

bun .../ts-compat-floor/ls-probe.mjs ts53   (language service built on compilers/node_modules/ts53/lib/typescript.js, file cases/probe-ls.ts)
  --- 5.3.3 ---
  QUICKINFO @mapOr(pos 88): (method) Ok<number, string>.mapOr<number>(defaultValue: NoInfer<U>, fn: (value: number) => number): number (+2 overloads)
  QUICKINFO @mapOr(pos 139): (method) Ok<number, string>.mapOr<string>(defaultValue: NoInfer<U>, fn: (value: number) => string): string (+2 overloads)
  QUICKINFO @PROBE1(pos 76): const PROBE1: number
  QUICKINFO @PROBE2(pos 127): const PROBE2: string
  (no DIAG lines at all)
bun .../ls-probe.mjs ts54
  --- 5.4.5 ---
  DIAG: No overload matches this call. ... Overload 2 of 3, '(defaultValue: number, fn: (value: number) => number): number' ... Argument of type 'string' is not assignable to parameter of type 'number'.
  QUICKINFO @mapOr(pos 88): (method) Ok<number, string>.mapOr<unknown> […truncated, full text in findings.json]

</details>

**Recommendation.** Same fix as ok-1 — the portable NoInfer keeps hover output correct on every compiler I tested. As a secondary point worth noting for the API design: even on TS 5.4+ the hover for `mapOr` leads with `(defaultValue: unknown, fn: (value: number) => PromiseLike<unknown>)`, i.e. the async overload is listed first and shows `unknown` for both, which is the least informative of the three. Reordering the overloads so the sync `NonThenable` form is first would make the common case's tooltip and error message read correctly.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-concurrency-cancellation/cc-10` — The "Combine results" docs page covers only sequential composition and contains two snippets that do not compile

**Severity:** medium · **Category:** docs · **Verifier verdict:** confirmed

**Claim.** apps/docs/docs/how-to/core/combine-results.md is the page a user lands on when they want to combine N results. It documents only `andThen`, `and`, `or`, and `flatten` — all strictly sequential, two-at-a-time operators. There is no mention of fan-out, `Promise.all`, concurrency, timeouts, unhandled rejections, or the fact that `Promise.any`/`race`/`allSettled` are semantically broken over Results. A grep across all of apps/docs/docs finds no occurrence of Promise.all/Promise.race/Promise.any/allSettled/concurrent/parallel/AbortSignal/unhandled outside the legacy pages and one comparison-table sentence. Additionally, two of the page's four code examples pass a *function* where a `Result` is required and are type errors.

<details><summary><strong>Empirical evidence</strong></summary>

`cd /home/user/antithrow/apps/docs/docs && grep -rn "Promise.all|Promise.race|Promise.any|allSettled|concurren|parallel|AbortSignal|unhandled"` returns only legacy/*.md and explanation/comparison.md:37 (an Effect comparison) — nothing in how-to or reference for the v3 core.
The two broken snippets, verbatim from the page:
```ts
const pair = authenticate().and(loadProfile);
const source = readPrimary().or(readSecondary);
```
`bun x tsc --ignoreConfig --noEmit --strict ... 15-doc-snippets.ts` -> `EXIT=0` with both lines carrying `@ts-expect-error`, i.e. both are confirmed compile errors (`and`/`or` take a `Result`, not a `() => Result`).

</details>

**Recommendation.** Rewrite the page around the two axes users actually have: sequential (`andThen`/`and`/`or`/`Result.do`) and concurrent (fan-out). Add a "Combine many results" section with the working spellings, an explicit warning table for `Promise.any`/`race`/`allSettled`, and a note that abandoning a Pending can crash the process. Fix the two snippets to `authenticate().and(loadProfile())` / `readPrimary().or(readSecondary())` and add the docs snippets to the type-test pipeline so they cannot rot.

**Verifier note.** Read apps/docs/docs/how-to/core/combine-results.md in full: 48 lines covering only andThen, and/or, and flatten, with no fan-out, concurrency, timeout or native-combinator content. The two snippets are verbatim as quoted - line 25 `const pair = authenticate().and(loadProfile);` and line 31 `const so […truncated, full text in findings.json]

---

### `probe-concurrency-cancellation/cc-11` — `Promise.allSettled` reports Ok and Err identically as "fulfilled"; its only discriminating power is to isolate poison, and that channel is typed `any`

**Severity:** medium · **Category:** correctness · **Verifier verdict:** confirmed

**Claim.** Reproducing and extending the confirmed starting evidence: over Results, `allSettled`'s fulfilled/rejected axis measures the wrong dimension entirely. Every well-behaved Result — Ok or Err — is "fulfilled", so allSettled is useless for its one purpose (partitioning successes from failures). The only thing it does discriminate is the poison channel, and that arrives as `PromiseRejectedResult.reason`, typed `any` — so the sole place in the whole aggregation story where allSettled is informative is also the place where all type information is lost. This makes allSettled a trap: it *looks* like the partitioning primitive, produces a plausible-looking result, and silently classifies every failure as a success.

<details><summary><strong>Empirical evidence</strong></summary>

`bun 01-combinator-matrix.ts`:
```
=== Promise.allSettled over [Ok, Err, Pending(Ok), Pending(Err)] ===
  statuses: fulfilled, fulfilled, fulfilled, fulfilled
  values: Ok(1), Err("boom"), Ok(10), Err("netfail")
=== Promise.allSettled with a poisoned Pending ===
  statuses: fulfilled, rejected
  entries: Ok(10) | REJ Error: POISON
```
Type level, `08-typecheck2.ts` (tsc exit 0, assertions `_5`,`_6`):
```ts
const d = await Promise.allSettled([rNum]);
type _5 = Expect<Equal<typeof d, [PromiseSettledResult<Settled<number, "db">>]>>;
if (first.status === "rejected") { const reason = first.reason; type _6 = Expect<Equal<typeof reason, any>>; }
```

</details>

**Recommendation.** Ship `Result.partition(results): Pending<{ ok: T[]; err: E[] }, never>` (implementation in 05-handrolled.ts) and name the allSettled trap explicitly in the docs. If a poison channel is retained, type it `unknown` rather than letting users inherit `PromiseRejectedResult.reason: any` — e.g. by exposing `Pending.settleOrPoison(): PromiseLike<Settled<T,E> | { poison: unknown }>`.

**Verifier note.** Reproduced. `bun 01-combinator-matrix.ts` prints `statuses: fulfilled, fulfilled, fulfilled, fulfilled` over [Ok, Err, Pending(Ok), Pending(Err)] with `values: Ok(1), Err("boom"), Ok(10), Err("netfail")`, and with a poisoned sibling `statuses: fulfilled, rejected`. Type level: 08-typecheck2.ts passe […truncated, full text in findings.json]

---

### `probe-concurrency-cancellation/cc-4` — `Promise.all` over a fan-out silently discards every poison error after the first — no return value, no throw, no unhandledRejection

**Severity:** medium · **Category:** correctness · **Verifier verdict:** adjusted

**Claim.** When several Pendings in an aggregate are poisoned, `Promise.all` rejects with the first one and permanently swallows the rest: they are neither returned, nor thrown, nor reported as unhandled rejections (Promise.all has subscribed to them, so Node considers them handled). For a library whose entire premise is that errors are tracked and cannot be lost, this is the worst possible failure mode — 2 of 3 errors vanish with no diagnostic. Notably the loss is specific to the throw/reject channel the library refuses to catch: ordinary `Err` siblings are all preserved.

<details><summary><strong>Empirical evidence</strong></summary>

`bun 09-poison-recovery.ts`:
```
=== Error accounting: N poisoned siblings under Promise.all ===
  Promise.all rejected with: POISON-A
  errors surfaced to the caller: 1 of 3.  unhandledRejection events: 0
  ==> POISON-B and POISON-C are SILENTLY DISCARDED: not returned, not thrown, not reported.

=== Same accounting for ordinary Err siblings (no loss) ===
  all three Errs preserved: a,b,c
```
Cross-checked under plain node with a handler installed (`INSTALL_HANDLER=1 node 03-unhandled.mjs all-one-poison`): `Promise.all rejected with: POISON-A` / `[exit] code=0 unhandledSeen=0` — POISON-B is never reported.

</details>

**Recommendation.** Provide `Result.allSettled` / `Result.combineWithAllErrors` returning `Pending<T[], E[]>` so every error is retained, and make the built-in `Result.all` capture sibling throws into the same `E[]`/aggregate channel rather than dropping them. If `Result.all` stays fail-fast, still surface the discarded siblings (e.g. an `errors` array on the returned Err, or an opt-in reporter hook).

**Verifier note.** Facts reproduce verbatim: `bun 09-poison-recovery.ts` prints `Promise.all rejected with: POISON-A` / `errors surfaced to the caller: 1 of 3.  unhandledRejection events: 0`, and the ordinary-Err control preserves all three (`a,b,c`). Severity is overcalibrated at high for two reasons. First, discardi […truncated, full text in findings.json]

---

### `probe-concurrency-cancellation/cc-7` — Hand-rolling `all` forces `new Pending(...)` plus three unsound casts and a re-introduced try/catch; `Result.fromPromise` cannot lift an aggregate

**Severity:** medium · **Category:** ergonomics · **Verifier verdict:** confirmed

**Claim.** I wrote the five combinators a user actually needs (all, partition, combineWithAllErrors, firstSuccess, withTimeout) using only the public API. All five work and all five typecheck under the repo's strict settings, but each one pays a fixed toll. (1) `new Pending(promise)` is load-bearing public API: there is no other way to lift a `Promise<Settled<T,E>>` back into a Result — `Result.fromPromise` re-wraps the resolved value in `Ok`, so it produces `Pending<Settled<...>>`, not `Pending<...>`. (2) A `try`/`catch` must be reintroduced around the aggregate to survive a poisoned sibling, and the caught `unknown` has to be cast into `E` — a genuinely unsound cast, since a thrown TypeError is not a member of the declared error union. (3) `firstSuccess` has to hand-roll a rejection handler per element because `Promise.any` is unusable. The net effect is that the library's central selling point (typed errors, no try/catch) is unavailable in exactly the place users need it most.

<details><summary><strong>Empirical evidence</strong></summary>

`bun 05-handrolled.ts` (works) plus `bun x tsc --ignoreConfig --noEmit --strict ... 05-handrolled.ts` -> `EXIT=0`. Runtime output:
```
== all ==
  all ok  -> Ok([1,"two",true])
  one err -> Err("E1")
  poisoned-> Err({})  <-- try/catch converted the throw into Err(Error) which is NOT in the declared E union
== firstSuccess (what Promise.any SHOULD have done) ==
  -> Ok(99) after 41ms  (Promise.any gave Err('fast-fail') at 5ms)
  all fail -> Err(["a","b"])
== withTimeout ==
  slow   -> Err("TIMEOUT")
```
The `Err({})` line is the unsound cast made visible: the declared type is `Pending<..., "string">` but the runtime error is an `Error` instance.
That `new Pending` is the only lift is proven at the type level in `08-typecheck2.ts` (tsc exit 0):
```ts
const lifted: Pending<number[], "db"> = new Pending(settledPromise);
// @ts-expect-error - fromPromise cannot do it (it re-wraps the value i […truncated, full text in findings.json]

</details>

**Recommendation.** Ship the combinators (`Result.all`, `Result.allSettled`/`partition`, `Result.any`, `Result.combineWithAllErrors`, `Result.timeout`) in core — the implementations in 05-handrolled.ts are ~90 lines total and the type signatures (`OksOf`/`ErrOf` built from the already-exported `InferOk`/`InferErr`) work. If they are deliberately out of scope, then at minimum export a documented `Result.fromSettledPromise(p: PromiseLike<Settled<T,E>>): Pending<T,E>` so `new Pending` is not the sanctioned extension point, and export the `OksOf`/`ErrOf` tuple helpers so third-party combinators can be typed without re-deriving them.

**Verifier note.** Verified on both axes. `bun 05-handrolled.ts` runs clean and produces exactly the quoted output including the tell-tale `poisoned-> Err({})` (a runtime `Error` surfacing where the declared E is a string literal union - the unsound cast made visible). 08-typecheck2.ts typechecks at EXIT=0 under the r […truncated, full text in findings.json]

---

### `probe-concurrency-cancellation/cc-8` — Eager construction makes concurrency limiting and retry impossible over Result values — every user-written combinator must take thunks, but the whole API produces values

**Severity:** medium · **Category:** ergonomics · **Verifier verdict:** adjusted

**Claim.** A `Pending` starts its work at construction and memoizes the outcome. That is good for sharing (see praise) but it means a `Result` value cannot be pooled or retried: by the time you hold N Results they are all already in flight, and re-awaiting one never re-runs it. So every combinator a user needs for real concurrency work — pool(limit), retry(backoff), a cancellable timeout — must be shaped `() => Result<T,E>`, while every function the library encourages you to write returns `Result<T,E>` directly. Users must maintain two parallel vocabularies. Separately, `Result.do`'s async generator serializes by construction; parallelism is only recoverable by constructing the Pendings *before* the generator, which is undiscoverable from the API and depends entirely on the undocumented eagerness guarantee.

<details><summary><strong>Empirical evidence</strong></summary>

`bun 02-eagerness-sharing.ts`:
```
=== 1. Eagerness: does constructing a Pending start work? ===
  work body ran at +0ms
  immediately after Result.try, started=1 (1 => EAGER)
=== 4. Wall-clock: natural spellings for fan-out ===
  A) build array of Pendings then Promise.all : 50ms  (parallel)
  B) for..of + await work(i)                  : 152ms  (serial)
  C) Result.do async generator                : 161ms  (SERIAL - no way to parallelize)
  D) Result.do over PRE-STARTED Pendings      : 54ms  (parallel, but requires knowing eagerness)
  E) .andThen chain                           : 151ms  (serial by design)
```
`bun 05-handrolled.ts`:
```
  pool(limit=3) peak concurrency=3 results=0,1,2,3,4,5,6,7
  pool over ALREADY-CONSTRUCTED Results: peak concurrency=8 (limit ignored — eager construction defeats pooling)
```
`bun 11-retry-settle.ts`:
```
  retry over a Result value: attempts=1 final […truncated, full text in findings.json]

</details>

**Recommendation.** Introduce a thunk-shaped sibling for the operations that need it — `Result.all`/`Result.pool`/`Result.retry` accepting `readonly (() => Result<T,E>)[]` (or overloads accepting both values and thunks, as legacy `ResultAsync.all` accepts mixed inputs). Document eagerness explicitly on `Pending` and in the `Result.do` how-to, with the "construct before the generator to get parallelism" idiom spelled out — right now `apps/docs/docs/explanation/eager-vs-lazy.md` exists but nothing connects it to fan-out.

**Verifier note.** All runtime measurements reproduce: `bun 02-eagerness-sharing.ts` -> `work body ran at +1ms`, `started=1 (1 => EAGER)`, wall clocks A) 51ms parallel, B) 151ms serial, C) Result.do 153ms serial, D) pre-started 51ms, E) 151ms; `bun 05-handrolled.ts` -> `pool over ALREADY-CONSTRUCTED Results: peak conc […truncated, full text in findings.json]

---

### `probe-concurrency-cancellation/cc-9` — Capability regression: `antithrow/legacy` ships `Result.all`/`ResultAsync.all` and handles poison safely; core v3 ships neither

**Severity:** medium · **Category:** consistency · **Verifier verdict:** confirmed

**Claim.** The `antithrow/legacy` subpath, which the same package publishes and documents as the migration source, has `Result.all` and `ResultAsync.all` ("Analogous to Promise.all, but for Result / ResultAsync values. All inputs are evaluated concurrently." — apps/docs/docs/legacy/result-async.md:93-95). Its implementation (legacy/result-async.ts:384-398) routes through `ResultAsync.try`, so a poisoned input is absorbed into the Err channel rather than escaping as a rejection. The v3 core `Result` namespace has exactly three members and nothing equivalent, so anyone migrating off legacy loses a working, poison-safe aggregation primitive and must hand-roll a strictly less safe replacement.

<details><summary><strong>Empirical evidence</strong></summary>

`bun 12-legacy-regression.ts`:
```
=== core v3 public surface ===
  Object.keys(Result) = try, fromPromise, do
  has 'all'/'combine'/'any'/'partition'?  NONE
=== legacy subpath still ships aggregation ===
  ResultAsync.all exists: true
  Result.all exists     : true
=== legacy ResultAsync.all semantics (incl. poison) ===
  all ok  -> Ok([1,2])
  with poison -> Err(Error: POISON)
  ==> LEGACY absorbs the throw into the Err channel.
=== core v3 equivalent, hand-written, same inputs ===
  Promise.all REJECTED: POISON  (typed-error story lost)
```

</details>

**Recommendation.** Port `ResultAsync.all` forward as `Result.all` with the three-state signature (`Result.all(results): Pending<OksOf<T>, ErrOf<T>>`, resolving to `Settled` when every input is already settled). Keep legacy's poison-absorbing behaviour. Until then, the migration guide must explicitly tell readers what to write instead of `ResultAsync.all` — currently it says nothing.

**Verifier note.** Verified against source and docs, not just the script. `bun 12-legacy-regression.ts` reproduces `Object.keys(Result) = try, fromPromise, do`, `ResultAsync.all exists: true`, `Result.all exists: true`, and `with poison -> Err(Error: POISON)`. result.ts confirms the core namespace has exactly `{ try:  […truncated, full text in findings.json]

---

### `probe-test-interop/ti-7` — No test utilities, no static guards, no assertion helpers — consumers must hand-roll ~105 lines of matchers, and no matcher can narrow the type

**Severity:** medium · **Category:** ergonomics · **Verifier verdict:** unverified

**Claim.** `index.ts` exports only `Ok`, `Err`, `Pending`, `Result`, `UnwrapError` and three types. There is no `antithrow/testing` subpath, no `Result.isOk(r)` / `Result.assertOk(r)` static, no `asserts` helper, and no runner matchers. `isOk()`/`isErr()`/`isPending()` are `this`-predicates, which narrow inside an `if` but carry nothing across an external assertion — so the idiomatic test line `expect(r.isOk()).toBe(true)` leaves `r` as the full union and the next line cannot touch `r.value`. That is the structural reason consumers reach for `unwrap()` instead (whose failure output is content-free, ti-6). A consumer CAN write `function assertOk<T,E>(r: Result<T,E>): asserts r is Ok<T,E>` and it compiles and narrows correctly — the capability is simply not shipped. Building a usable matcher set costs ~105 lines plus `declare module "vitest"` declaration merging, and the matcher still cannot narrow `received` for subsequent statements. The matchers must also deliberately avoid `this.equals(errA, errB)` and compare `.error` payloads instead, to dodge ti-1.

<details><summary><strong>Empirical evidence</strong></summary>

TYPE-LEVEL — `cd /home/user/antithrow && bun x tsc --noEmit --strict --exactOptionalPropertyTypes --noUncheckedIndexedAccess --allowImportingTsExtensions --moduleResolution bundler --module preserve --target es2022 --skipLibCheck --ignoreConfig …/tc/narrowing.ts` → `TSC_EXIT=0`, i.e. every `@ts-expect-error` below is a real error and every non-marked line compiles:
```ts
// expect(r.isOk()).toBe(true);
// @ts-expect-error `value` does not exist on Result (no narrowing from an external assertion)
r.value;
// @ts-expect-error unwrap() on Result returns number | PromiseLike<number>
const _n: number = r.unwrap();
// @ts-expect-error Result has no isOk
const _noStatic = Result.isOk;
// @ts-expect-error Result has no assertOk
const _noAssert = Result.assertOk;
// @ts-expect-error Result has no ok/err constructor helpers either
const _noOkCtor = Result.ok;
// hand-rolled version DOES work:
func […truncated, full text in findings.json]

</details>

**Recommendation.** Ship an `antithrow/testing` subpath export containing: (a) plain assertion functions `assertOk<T,E>(r): asserts r is Ok<T,E>`, `assertErr`, and `assertSettled` (these are runner-agnostic and DO narrow — verified compiling above); (b) an `expect.extend`-compatible matcher bundle with vitest/jest `Matchers` declaration merging pre-written, covering `toBeOk/toBeErr/toBeOkWith/toBeErrWith/toSettleToOk/toSettleToErr`, all of which compare payloads rather than Result objects; (c) a pretty-format serializer for the three variants. Also add `Result.isOk(r)`/`Result.isErr(r)`/`Result.isPending(r)` free-function guards to the `Result` namespace, so guards compose in `.filter()`/`.every()` without a method call on a possibly-Pending receiver. Finally add a `Testing your Results` docs page — currently the docs site has zero words on the single most common thing a consumer does after calling the API.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-test-interop/ti-8` — isPending() stays true forever and a Pending is neither introspectable nor cancellable — fake-timer tests strand with no diagnostic

**Severity:** medium · **Category:** ergonomics · **Verifier verdict:** unverified

**Claim.** `Pending#isPending()` returns the literal `true` (pending.ts) and never changes, even after the wrapped promise has resolved. There is no `peek()`, no `isSettled()`, no way to observe a Pending's state without awaiting it, and no cancellation. In a fake-timer test this is a concrete hazard: the standard `afterEach(() => vi.useRealTimers())` cleanup discards the fake clock, permanently stranding any Pending whose backing `setTimeout` had not yet fired; a later `await` on it hangs to the full test timeout and the only diagnostic is `Test timed out in 5000ms` — the runner cannot tell you the Result is still pending, and neither can the API. The good news, verified: fake timers do work with Pendings when driven correctly via `advanceTimersByTimeAsync`/`runAllTimersAsync` plus `.settle()`.

<details><summary><strong>Empirical evidence</strong></summary>

`bun x vitest run vt/timers2.test.ts --reporter=verbose`:
```
 ✓ T4: a Pending is not introspectable -- isPending() is true forever, no way to peek 8ms
 ✓ T5: useRealTimers() strands an unsettled Pending forever (5s timeout, no diagnostic) 201ms
 Tests  2 passed (2)
```
T4's body asserts `expect(p.isPending()).toBe(true)` BOTH before `advanceTimersByTimeAsync(1000)` and after `await p.settle()` — both hold, i.e. the flag never flips. T5 races `p.settle()` against a 200ms real timer and observes `"STRANDED"`.
The timeout-with-no-diagnostic case, from an earlier run of `vt/timers.test.ts`:
```
 × T2: `await pending` without advancing timers DEADLOCKS 5005ms
   → Test timed out in 5000ms.
     If this is a long-running test, pass a timeout value as the last argument …
```
CONTROL (fake timers DO work when driven) — same file:
```
 ✓ T1: advanceTimersByTimeAsync can drive a Pending to settle […truncated, full text in findings.json]

</details>

**Recommendation.** Add non-blocking state introspection to `Pending`: `peek(): Settled<T,E> | undefined` and a `state: "pending" | "settled"` accessor updated when the wrapped promise resolves. That makes `expect(p.peek()).toBeUndefined()` / `expect(p.peek()).toBeOk()` a deterministic, non-await assertion, gives ti-2's equality problem a real discriminator, and lets a runner's timeout message be replaced by an explicit `expect(p.peek(), "result never settled").toBeDefined()`. Consider also a `Pending#timeout(ms, onTimeout)` combinator so a test can bound an unsettleable Result rather than hanging.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-test-interop/ti-9` — Jest cannot resolve the package at all, and even bypassing that, ti-1 makes jest unusable — no runner is fully supported end-to-end

**Severity:** medium · **Category:** packaging · **Verifier verdict:** unverified

**Claim.** A packaging auditor separately found the `exports` map omits `require`/`default`; confirmed here — jest 30 cannot resolve `antithrow` at all. That alone blocks the largest JS test runner. But the more important point for this dimension is that fixing resolution would not make jest usable: jest's own `expect` v30.4.1, pointed directly at `dist/index.js`, still cannot compare two `Err` values (ti-1). Combined with the per-runner matrix measured here, the honest status is: bun:test works but silently accepts cross-variant `undefined` equality (ti-3) and rejects the documented `.resolves` idiom (ti-5); vitest works for equality but false-passes on every Pending (ti-2) and crashes on every Err comparison (ti-1); jest cannot even load. There is no runner on which a consumer can write the obvious assertions and get correct results.

<details><summary><strong>Empirical evidence</strong></summary>

RESOLUTION — `bun x jest --config jest.config.cjs`:
```
FAIL jt/basic.test.js
  ● Test suite failed to run
    Cannot find module 'antithrow' from 'jt/basic.test.js'
    > 1 | const { Ok, Err } = require("antithrow");
```
`packages/antithrow/package.json` exports block:
```json
"exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }, "./legacy": { … } }
```
BYPASSING RESOLUTION — `node jest-expect-probe.mjs` (jest `expect` 30.4.1 vs `dist/index.js` by absolute path):
```
[FAIL] jest-expect: Err('boom') toEqual Err('boom') -> Error: Unreachable: generator should have been halted
[FAIL] jest-expect: Err('a') toEqual Err('b') -> Error: Unreachable: generator should have been halted
[FAIL] jest-expect: Err('boom') toStrictEqual Err('boom') -> Error: Unreachable: generator should have been halted
[PASS] jest-expect: Ok(1) toEqual Ok(1)
```

</details>

**Recommendation.** Add `"default": "./dist/index.js"` (and, if CJS consumers matter, a real `require` build) to both export conditions so jest/ts-jest resolve. Then add a CI matrix that runs a small conformance suite — `expect(ok).toEqual(ok)`, `expect(err).toEqual(err)`, `expect(await pending).toEqual(...)`, poisoned-Pending leak detection — under bun:test, vitest AND jest. The current suite runs only under bun:test, which is precisely why ti-1 (jest+vitest) and ti-2 (all runners) went unnoticed across 534 tests.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-suite-efficacy/ok-10` — The 241 type-level assertions are invisible to `bun test` and are enforced only by the `lint` job — so type regressions never fail the `test` job, and never fail pre-commit at all

**Severity:** medium · **Category:** tooling · **Verifier verdict:** unverified

**Claim.** `expectTypeOf` is a compile-time-only construct: a deliberately wrong assertion produces 3 pass / 0 fail under `bun test` and is caught solely by `tsc --noEmit`. That check lives in the package's `lint:types` script, reached only via the CI `lint` job and the lefthook `pre-push` hook. The `pre-commit` hook runs `bun test` (plus biome and knip) but not `tsc`, and the CI `test` job runs no typecheck. So a change that breaks 100 type assertions still shows a fully green test run, and the failure surfaces in a job labelled "lint". Additionally, 8 of the 237 core tests contain no runtime assertion at all (4 `@ts-expect-error`-only tests named "enforces matching callback output types", plus all 4 tests in types.test.ts), and 1 more (result.test.ts:1039) has only `expectTypeOf` — those 9 tests report as passing under `bun test` while asserting literally nothing at runtime.

<details><summary><strong>Empirical evidence</strong></summary>

Probe file with three deliberately wrong assertions dropped into the package copy:
### bun test (runtime) ###
 3 pass
 0 fail
Ran 3 tests across 1 file.
### tsc --noEmit ###
src/probe-types.test.ts(6,50): error TS2344: Type 'string' does not satisfy the constraint '"Expected: string, Actual: number"'.
src/probe-types.test.ts(10,40): error TS2344: Type 'number' does not satisfy the constraint 'never'.
src/probe-types.test.ts(13,50): error TS2344: Type 'any' does not satisfy the constraint 'never'.

`cat lefthook.yml`: pre-commit jobs = biome check --write, knip, `bun test`. pre-push jobs = `bun audit`, `bun lint`.
`cat .github/workflows/check.yml`: the `test` job runs only `bun test --coverage`; `tsc --noEmit` is reached only through the separate `lint` job's `bun lint` -> `bun run --workspaces --if-present lint` -> `publint && tsc --noEmit`.
`bun /tmp/.../suite-efficacy/analyze-tests.ts` […truncated, full text in findings.json]

</details>

**Recommendation.** Add `bun run lint:types` (or a dedicated `test:types`) to the CI `test` job and to the lefthook `pre-commit` hook so type regressions fail alongside behavioural ones and are visible pre-commit. Consider a `expectTypeOf`-free `Equal`/`Expect` harness in a `*.types.ts` file so that type assertions are not disguised as `it()` blocks that report "pass" while asserting nothing at runtime.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-suite-efficacy/ok-11` — publint is a metadata linter only — it reports "All good!" for a package whose entrypoint is an empty file

**Severity:** medium · **Category:** packaging · **Verifier verdict:** unverified

**Claim.** `lint:publint` is the only gate that touches the published artefact, and it validates only that the `exports`/`main`/`types` fields resolve to files that exist with plausible formats. It does not check that those files export anything. Emptying `dist/index.js` — the exact file `exports["."].import` points at — still yields "All good!". Combined with ok-1, this means the repo has no gate at all on published behaviour.

<details><summary><strong>Empirical evidence</strong></summary>

In the scratch copy: `cp dist/index.js /tmp/dist.bak; echo '' > dist/index.js; bun x publint`
  Running publint v0.3.21 for antithrow...
  Packing files with `npm pack`...
  Linting...
  All good!
Also `echo 'throw new Error("dist is broken");' > dist/index.js; bun test src` -> 534 pass / 0 fail; and `bun test` (whole package) -> 534 pass / 0 fail.

</details>

**Recommendation.** Keep publint for metadata, but do not count it as artefact validation. Pair it with the consumer smoke test from ok-1, and additionally assert the export set explicitly (`expect(Object.keys(mod).sort()).toEqual(["Err","Ok","Pending","Result","UnwrapError"])`) so that an accidental export removal or rename is a hard failure rather than a silent breaking change.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-suite-efficacy/ok-7` — 56% of the headline "534 tests" guard the deprecated `antithrow/legacy` v2 API, not the v3 surface under audit

**Severity:** medium · **Category:** reporting · **Verifier verdict:** unverified

**Claim.** The 534/818 numbers conflate two APIs. The v3 public surface (Ok, Err, Pending, Result, UnwrapError) is guarded by 237 tests and 555 expect() calls across ok/err/pending/result/types.test.ts; the remaining 297 tests and 263 expect() calls exercise `src/legacy/` (`ResultAsync`, `okAsync`, `chain`, ...), a separate subpath export. Anyone reading "534 tests, 100% coverage" as a confidence signal for the v3 API is over-counting by more than 2x, and the legacy tests contribute nothing to the mutation score of ok/err/pending/result/utils/errors.ts.

<details><summary><strong>Empirical evidence</strong></summary>

Per-file `bun test <file>`:
  ok.test.ts        38 pass  63 expect()
  err.test.ts       37 pass  55 expect()
  pending.test.ts   65 pass  177 expect()
  result.test.ts    93 pass  260 expect()
  types.test.ts      4 pass  (0 expect())
  legacy/chain.test.ts          29 pass  19 expect()
  legacy/result-async.test.ts  147 pass  139 expect()
  legacy/result.test.ts        121 pass  105 expect()
237 + 297 = 534; 555 + 263 = 818.

</details>

**Recommendation.** Report the two suites separately (e.g. a `test:core` script scoping to the non-legacy files, and separate codecov components — `component_management` already supports path-scoped components, so add a `antithrow-legacy` component with `paths: packages/antithrow/src/legacy`). It makes the v3 figure honest and makes a future legacy removal a no-op on the headline number.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-suite-efficacy/ok-8` — Async `Result.do` cleanup ordering is unguarded: dropping the `await` on `iter.return?.()` survives, so `finally` blocks can outlive the settled Pending

**Severity:** medium · **Category:** correctness · **Verifier verdict:** unverified

**Claim.** result.ts:96 is `await iter.return?.(undefined as T);`, documented at result.ts line 189 as "On fail-fast exit, `resultDo` calls `iter.return()` to ensure `finally` blocks run." Removing the call entirely is killed by the suite, but removing only the `await` survives — meaning the tests assert that cleanup is *invoked* but never that it *completes before the Pending settles*. Under the mutant, an async `finally` block with any await in it has not finished when the consumer's `await Result.do(...)` returns.

<details><summary><strong>Empirical evidence</strong></summary>

`bun /tmp/.../suite-efficacy/verify-survivors.ts`:
### G03 Result.do async cleanup no longer awaited (result.ts:96)
    suite result: 534 pass / 0 fail   <-- MUTANT SURVIVES
      Result.do async cleanup order
         pristine: ["finally-done","pending-settled"]
         mutant  : ["pending-settled"]
(The probe generator's `finally` does `await setTimeout(10)` then pushes "finally-done"; under the mutant it has not run at all by the time the Pending has settled and been observed.)
The same mutation is also produced by the generic `rm-await` rule and recorded twice in results2.json as result.ts:96.

</details>

**Recommendation.** Add an ordering test: an async generator whose `finally` awaits a tick and records into a shared array, fail-fast via `yield* new Err(...)`, then `await` the returned Pending and assert `expect(order).toEqual(["cleanup", "settled"])`. One test, ~10 lines, and it also documents the guarantee the JSDoc already promises.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-suite-efficacy/ok-9` — `NoInfer` on two of the three `Ok.mapOr` overloads is guarded by neither the tests nor `tsc --noEmit`

**Severity:** medium · **Category:** type-safety · **Verifier verdict:** unverified

**Claim.** Stripping `NoInfer<U>` from ok.ts:60 (the `PromiseLike` overload) and ok.ts:62 (the `SyncOrAsync` overload) leaves both `bun test src` (534 pass) and the package's own `bun x tsc --noEmit` gate (exit 0) completely green, yet it silently widens the accepted default-value type: `o.mapOr(null, async (v) => v * 2)` goes from a compile error to a legal call returning `PromiseLike<number | null>`. The reason is that all 19 `mapOr(` call sites in the tests pass a *matching* default (`"0"` with a `.toString()` mapper), so no assertion ever exercises the rejection that `NoInfer` exists to produce. Only the middle overload (ok.ts:61) has an incidental tsc-level guard.

<details><summary><strong>Empirical evidence</strong></summary>

Type probe /tmp/.../suite-efficacy/types/noinfer3.ts run under `bun x tsc --noEmit --ignoreConfig --strict --skipLibCheck --allowImportingTsExtensions --moduleResolution bundler --module preserve --target es2022`:
### PRISTINE ###
_n3.ts(3,19): error TS2769: No overload matches this call.
  Overload 1 of 3, '(defaultValue: number, fn: (value: number) => PromiseLike<number>): PromiseLike<number>' ... Argument of type 'null' is not assignable to parameter of type 'number'.
_n3.ts(6,19): error TS2769: No overload matches this call. ...
### MUTANT (NoInfer stripped from ok.ts:60,62) ###
_n3.ts(4,7): error TS2322: Type 'PromiseLike<number | null>' is not assignable to type '0'.
_n3.ts(7,7): error TS2322: Type 'SyncOrAsync<number | null>' is not assignable to type '0'.
(The TS2769 rejections vanish; the calls now compile.)
### package gates under the mutant ###
 534 pass
 0 fail
  package tsc  […truncated, full text in findings.json]

</details>

**Recommendation.** Add `@ts-expect-error` negative type tests for each `NoInfer`-carrying overload — `// @ts-expect-error default must match the async callback's resolved type` above `result.mapOr("wrong", async (v) => v * 2)` and the SyncOrAsync variant. The codebase already uses this idiom (4 sites, e.g. ok.test.ts:165), so no new tooling is needed; it just was not applied to `mapOr`. Do the same sweep for every other `NoInfer` in the package.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-runtime-matrix/rt-5` — node halts on the spot, bun runs the rest of the script first — same source, opposite side effects

**Severity:** medium · **Category:** consistency · **Verifier verdict:** unverified

**Claim.** For every never-awaited-poison scenario, node and deno terminate immediately at the point the rejection is detected, while bun prints the error, continues executing to the end of the script, and only then exits 1. Statements after the dropped Pending — writes, commits, cleanup, further network calls — execute on bun and do not execute on node. A consumer developing on bun and deploying on node (an explicitly supported combination for this repo, which is itself a bun workspace) gets different observable side effects from identical source on the failure path. The exit code agrees, so CI cannot distinguish the two.

<details><summary><strong>Empirical evidence</strong></summary>

cmd: <runtime> /tmp/.../runtime-matrix/battery.mjs poison-never-awaited
node v22.22.2 (identical on 18.20.8 / 20.20.2 / 24.19.0 / deno 2.9.5): exit=1, last line printed is
    [info] created Pending: Pending isPending: true
  then the stack trace; "[end] reached end of script" and "[done] script completed normally" NEVER print.
bun 1.3.11: exit=1, but the tail of stdout is
    error: BOOM-never-awaited
          at <anonymous> (.../battery.mjs:17:14)
          at map (/home/user/antithrow/packages/antithrow/dist/ok.js:31:24)
    [end] reached end of script
    [done] script completed normally
Consolidated (matrix.txt, reachedDone column):
  poison-never-awaited            node18/20/22/24=0, deno2=0, bun=1
  maperr-reject-never-awaited     node18/20/22/24=0, deno2=0, bun=1
  do-async-throw-never-awaited    node18/20/22/24=0, deno2=0, bun=1
  poison-fanout                   node18/20/22/24 […truncated, full text in findings.json]

</details>

**Recommendation.** This is a host difference the library cannot change, but it can stop depending on it. Once Pending owns its own diagnostic (rt-2/rt-3), the observable behaviour on the dropped-error path becomes identical everywhere and this divergence disappears as a consequence. Until then, document it in the Pending reference alongside the unhandled-rejection note — the current docs describe Pending purely in terms of "can be awaited" and say nothing about what happens if it is not.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-runtime-matrix/rt-6` — In node:worker_threads a dropped antithrow error kills the worker (not the process); bun reports that same dead worker with exit code 0

**Severity:** medium · **Category:** correctness · **Verifier verdict:** unverified

**Claim.** A poisoned Pending inside a `node:worker_threads` worker terminates the worker thread while the host process survives. The host learns about it only through the Worker's 'error' event; a host that registered a listener continues running happily with a silently dead worker (host exit 0), and a host that did not register one is itself killed by the re-thrown error. Worse, the two runtimes disagree on the worker exit code for the identical failure: node reports 1, bun reports 0. Host-side pool supervisors that decide "did this worker fail?" from the exit code — the conventional check — see success on bun for a worker that died mid-task. In a worker pool this means work silently disappears.

<details><summary><strong>Empirical evidence</strong></summary>

cmd: <runtime> /tmp/.../runtime-matrix/worker-host.mjs   (host WITH an 'error' listener)
  node v18.20.8 / v20.20.2 / v22.22.2 / v24.19.0 — all four identical:
    [host] message: worker-started
    [host] worker 'error' event: WORKER-BOOM
    [host] worker exited, code = 1
    [host] host still alive at 400ms; exiting normally
  bun 1.3.11:
    [host] message: worker-started
    [host] worker 'error' event: WORKER-BOOM
    [host] worker exited, code = 0            <-- differs from node
    [host] host still alive at 400ms; exiting normally
  In every case "worker-still-alive-after-150ms" is NEVER posted -> the worker is dead.
  Host process exit code is 0 on both.

cmd: <runtime> /tmp/.../runtime-matrix/worker-host-nolistener.mjs   (host WITHOUT an 'error' listener)
  node 18/20/22/24: host crashes — "node:internal/event_target:1118  process.nextTick(() => { throw err; });" / "Error: WO […truncated, full text in findings.json]

</details>

**Recommendation.** Same root cause and same fix as rt-2/rt-3 — a Pending that owns its rejection never reaches the host's worker-error path, so the node/bun exit-code disagreement stops mattering. Independently worth a docs note: the library's failure mode inside a worker is "the worker dies" on node:worker_threads and "the worker lives and logs" in a browser Web Worker, which are opposite ends of the spectrum for what is nominally the same abstraction.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-runtime-matrix/rt-7` — Pending.unwrap() converts a catchable UnwrapError into a runtime-policy-dependent unhandled rejection

**Severity:** medium · **Category:** consistency · **Verifier verdict:** unverified

**Claim.** On a settled Result, `unwrap()` throws synchronously: the throw is loud, catchable with try/catch, and `instanceof UnwrapError` — the behaviour the docs describe. On a Pending, `unwrap()` returns a `Promise` instead, so the very same UnwrapError becomes a promise rejection. Discarding the returned promise (easy to do — `unwrap()` reads as a statement, and on Ok/Err it *is* one) routes the UnwrapError through the host's unhandled-rejection policy: process death on default node/deno, deferred death on bun, a console line in the browser, and complete silence under a global handler or `--unhandled-rejections=none`. The same call, on the same union type, has two entirely different error-delivery contracts depending on which member of the union it lands on.

<details><summary><strong>Empirical evidence</strong></summary>

cmd: /opt/node22/bin/node /tmp/.../runtime-matrix/battery.mjs pending-unwrap-err-never-awaited
  (script body: `const p = Result.fromPromise(Promise.reject(new Error("rejected"))); p.unwrap();`)
  node v22.22.2 -> exit=1, halted:
    [info] discarded unwrap() promise
    file:///home/user/antithrow/packages/antithrow/dist/err.js:65
            throw new UnwrapError("Called unwrap() on an Err value", this);
    UnwrapError: Called unwrap() on an Err value
        at Err.unwrap (file:///home/user/antithrow/packages/antithrow/dist/err.js:65:15)
        at file:///home/user/antithrow/packages/antithrow/dist/pending.js:64:53 { result: Err { error: Error: rejected ... } }
  node 18.20.8 / 20.20.2 / 24.19.0 / deno 2.9.5: exit=1, halted (matrix.txt)
  bun 1.3.11: exit=1 but reachedDone=1 (ran to completion first)
  Combine with global-handler.mjs (finding rt-3): with any process.on("unhandledRej […truncated, full text in findings.json]

</details>

**Recommendation.** Make the asynchronous unwrap path visibly different from the synchronous one so it cannot be dropped by accident. Options, in increasing strength: (i) rename the Pending variants (`unwrapAsync`, or require `await p.settle()` first) so `unwrap()` on a Pending is a compile error rather than a silently-async statement; (ii) have `Pending.unwrap()` attach an internal rejection sentinel and surface the UnwrapError through the library's own dropped-error hook; (iii) drop `unwrap`/`unwrapErr` from Pending entirely, forcing `(await p).unwrap()`, which restores the synchronous throw-and-catch contract at the one place the docs actually describe. (iii) is a breaking change but is the only one that makes the two contracts identical.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-runtime-matrix/rt-8` — structuredClone / postMessage silently produces a method-less object that TypeScript still types as a Result; Pending cannot cross at all

**Severity:** medium · **Category:** correctness · **Verifier verdict:** unverified

**Claim.** Sending a Result across a worker boundary succeeds without complaint and delivers a plain object — `{value: 42}` for Ok, `{error: ...}` for Err — with no prototype and therefore no `isOk`, `isErr`, `unwrap`, or any other method. The receiver's static type is still `Result<T,E>` if the channel was typed, so the first method call is a raw `TypeError`, not a Result error, at a call site TypeScript believed was safe. A `Pending` cannot cross at all: `DataCloneError` (it holds a Promise). The Ok/Err case is the dangerous one precisely because it is the one that *succeeds*. Confirmed in the browser too, so this is not a node-only quirk.

<details><summary><strong>Empirical evidence</strong></summary>

cmd: /opt/node22/bin/node /tmp/.../runtime-matrix/pm-host.mjs   (and `bun`)
  node v22.22.2:
    [host] received "Ok":
      constructor      = Object
      instanceof Ok    = false | Err = false | Pending = false
      typeof .isOk     = undefined | typeof .unwrap = undefined
      own keys         = ["value"]
      raw              = {"value":42}
      .unwrap() THREW TypeError: v.unwrap is not a function
    [host] received "Err":  own keys = ["error"], .unwrap() THREW TypeError: v.unwrap is not a function
    [worker-side] ["postMessage(Ok) OK", "postMessage(Err) OK",
                   "postMessage(Pending) THREW DataCloneError: #<Promise> could not be cloned."]
  bun 1.3.11: identical, DataCloneError message "The object can not be cloned."
  Host exit code 0 in both — nothing signals the loss.

REAL CHROMIUM (same realm, structuredClone directly):
  cmd: cd /tmp/.../runtime-matrix/ […truncated, full text in findings.json]

</details>

**Recommendation.** Ship a documented serialization contract rather than leaving consumers to discover this via TypeError. Concretely: export `Result.toJSON(result)` / `Result.fromJSON(data)` (or make Ok/Err implement `toJSON` and provide a rehydrate helper) with an explicit discriminant field, document that Pending is not transferable and must be settled before crossing a boundary, and note in the reference that a raw `postMessage(result)` silently strips behaviour. If the branding change from rt-1 lands, `fromJSON` can restore a genuine Result on the far side and the whole boundary becomes safe rather than merely documented.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-runtime-matrix/rt-9` — No `engines` field: the runtime floor is undeclared, and the library's actual failure behaviour changes across the versions it silently accepts

**Severity:** medium · **Category:** packaging · **Verifier verdict:** unverified

**Claim.** packages/antithrow/package.json declares no `engines` key, so npm/pnpm/yarn perform no runtime check on install and nothing communicates a supported floor. Empirically the package loads and computes correctly as far back as node 14.21.3 — but the behaviour of its central failure mode changes underneath that range: on node 14 a dropped error is a warning and the process exits 0, on node >=16 it is fatal. Version-sensitive primitives that a consumer's *natural usage* touches also split across the same undeclared range: `structuredClone` is absent on node 16, `Array.fromAsync` is absent on node <=20, `Promise.withResolvers` is absent on node <=20. The result is that two consumers can both be "supported" and get opposite outcomes from the same code, with nothing in the manifest to warn either of them.

<details><summary><strong>Empirical evidence</strong></summary>

cmd: python3 -c "import json;p=json.load(open('/home/user/antithrow/packages/antithrow/package.json'));print('engines key present:', 'engines' in p);print(sorted(p.keys()))"
  engines key present: False
  top-level keys: ['author','bugs','description','exports','files','homepage','keywords','license','main','name','repository','scripts','sideEffects','type','types','version']
  dependencies: None | peerDependencies: None
  (the only `engines` in the whole monorepo is apps/docs/package.json:40, which is not published)

cmd: npx --yes node@14 -e "import('/home/user/antithrow/packages/antithrow/dist/index.js').then(m=>{const o=new m.Ok(1);console.log(process.version,'loaded OK, unwrap=',o.map(x=>x+1).unwrap())})"
  -> v14.21.3 loaded OK, unwrap= 2
  -> v16.20.2 loaded OK, unwrap= 2

cmd: <runtime> /tmp/.../runtime-matrix/battery.mjs poison-never-awaited
  node 14.21.3 -> exit=0 (UnhandledPr […truncated, full text in findings.json]

</details>

**Recommendation.** Add an explicit `"engines": { "node": ">=18" }` (18 is the lowest version where structuredClone exists and unhandled rejections are fatal by default, which is what the library's error story implicitly assumes) and state the browser/edge floor in the README alongside it. If the intent really is to support node 14/16, then the docs must say that on those versions a dropped Result error is a warning rather than a crash — that is a materially different safety story and consumers cannot currently find it out. Note also that FinalizationRegistry is available on every runtime measured including node 14, so the drop-detection hook proposed in rt-2 has no compatibility cost.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.
