# antithrow core API audit — high-severity findings

> Part of the [API audit](../API_AUDIT.md). Likely-hit footguns, incorrect documentation on core paths, and missing safeguards.
> Findings are grouped by audit dimension. Repro scripts referenced in evidence lived in the session scratchpad (ephemeral); all key observed output is quoted inline. The full untruncated register is in [findings.json](./findings.json).

### `ok-runtime/ok-2` — `Ok.map` builds a structurally broken `Pending` when the thenable's `then` does not return a promise; `settle()` then returns `undefined`

**Severity:** high · **Category:** correctness · **Verifier verdict:** adjusted

**Claim.** `Ok.map` does `new Pending(result.then((v) => new Ok(v)))` — it stores the *raw return value* of the foreign `then` with no `Promise.resolve()` normalisation. A thenable that resolves its callback but returns nothing (or returns `this`, or any non-promise) yields `new Pending(undefined)`. The resulting object passes `isPending()`, but `await p` throws `TypeError`, and — worse — `p.settle()` does **not** throw: it returns `undefined` while its declared type is `PromiseLike<Settled<T, E>>`, so `const s = await p.settle(); s.isOk()` crashes at a call site the compiler considers total.

<details><summary><strong>Empirical evidence</strong></summary>

`bun /tmp/claude-0/-home-user-antithrow/6fa15e49-ae6b-5bd4-b03a-8a3385b537f3/scratchpad/ok-runtime/c-broken-pending.ts`
```
ctor => Pending
p.isPending() => true
(p as Pending).promise => undefined
await p.settle() => undefined
settled.isOk() THREW => TypeError: undefined is not an object (evaluating 'settled.isOk')
```
and from `bun .../b-map.ts`:
```
map(badThenable) ctor => Pending
map(badThenable) .promise value => undefined
await map(badThenable) THREW => TypeError: undefined is not an object (evaluating 'this.promise.then')
settle() on it => no throw
isPending() still true for broken Pending => true
```

</details>

**Recommendation.** Normalise in `Ok.map` (and `Err.mapErr`, `Result.fromPromise`): `new Pending(Promise.resolve(result).then((v) => new Ok(v)))`. Additionally, have the `Pending` constructor reject non-thenable arguments (`if (!isThenable(promise)) throw new TypeError(...)`) so a broken `Pending` can never be constructed and silently observed later.

**Verifier note.** Behaviour reproduces exactly as described: `bun c-broken-pending.ts` → `(p as Pending).promise => undefined`, `await p.settle() => undefined`, `settled.isOk() THREW TypeError`; `bun b-map.ts` → `await map(badThenable) THREW TypeError: undefined is not an object (evaluating 'this.promise.then')`. Source confirms the missing normalisation (ok.ts:49 `new Pending(result.then((v) => new Ok(v)))`, no `Promise.resolve`), and `Pending.settle()` returns `this.promise` verbatim (pending.ts:127). Adjusting […truncated, full text in findings.json]

---

### `ok-runtime/ok-3` — `Ok.map` with an async callback converts a documented "not caught" throw into a process-killing unhandled rejection

**Severity:** high · **Category:** correctness · **Verifier verdict:** confirmed

**Claim.** `base.ts` documents `map` with a single line: "@throws Errors thrown by `fn` are not caught." For a synchronous `fn` that is benign — `map()` rethrows at the call site and `try/catch` works. For an `async fn` (the documented way to produce a `Pending`) the same throw becomes a rejected promise stored inside the `Pending`. If the caller never awaits or settles that `Pending` — which is entirely reasonable for a value-typed API where discarding a result is legal — the rejection escapes as an unhandled rejection and terminates a Node process with exit code 1. The docs do not distinguish these two radically different outcomes anywhere on this core path.

<details><summary><strong>Empirical evidence</strong></summary>

`bun /tmp/.../ok-runtime/d-unhandled.ts`:
```
sync throw is catchable at call site => sync boom
async-throwing map returned => Pending isPending: true
UNHANDLED REJECTION OBSERVED => async boom
```
With no handler installed, on Node 22.22.2: `node /tmp/.../ok-runtime/d2-unhandled-nohandler.mjs`
```
Error: async boom
    at .../d2-unhandled-nohandler.mjs:5:8
    at Ok.map (file:///home/user/antithrow/packages/antithrow/dist/ok.js:31:24)
Node.js v22.22.2
node exit=1
```
Also confirmed for a `Pending` argument whose promise rejects (`bun .../g-misc.ts` → `rejecting map REJECTED with => inner reject`): the rejection propagates instead of becoming an `Err`.

</details>

**Recommendation.** Either (a) catch inside the async branch and surface the throw as `Err` (making `map` on the async path behave like `Result.try`, which is what most users will expect from a library whose thesis is "errors are values"), or (b) if the not-caught semantics are intentional, attach a no-op rejection sink to the internal promise so a discarded `Pending` cannot kill the process, and document the sync-vs-async divergence explicitly in the `map`/`mapErr`/`andThen` JSDoc with a worked example.

**Verifier note.** Reproduced. `bun d-unhandled.ts` → sync throw catchable at the call site; async-throwing `map` returns a `Pending` and the rejection surfaces as `UNHANDLED REJECTION OBSERVED => async boom`. `node d2-unhandled-nohandler.mjs` (no handler) prints the uncaught error and exits 1 (verified without a pipe: `node exit=1`), with the stack pointing at `Ok.map (dist/ok.js:31)`. base.ts:53 does document only `@throws Errors thrown by fn are not caught` for `map`, with no mention that the async branch conve […truncated, full text in findings.json]

---

### `ok-runtime/ok-6` — `flatten()` is `instanceof`-based, so a duplicated package install silently does not flatten and turns a nested `Err` into a reported success

**Severity:** high · **Category:** correctness · **Verifier verdict:** confirmed

**Claim.** `Ok.flatten()` decides whether `this.value` is a nested result with `value instanceof Ok || value instanceof Err || value instanceof Pending`. There is no brand (`Symbol.for(...)`, a tag field, or a `Result.isResult` guard), so two copies of `antithrow` in a dependency tree — routine with peer-dependency skew, dual ESM/CJS resolution, or a bundler realm split — make the check fail. `flatten()` then falls through to `return this as unknown as FlattenOk<T, E>`, handing back `Ok<Ok<U>>` under the declared type `Ok<U, E|F>`. When the nested value is an `Err`, the flattened result reports `isOk() === true` and `isErr() === false`: a failure is silently laundered into a success.

<details><summary><strong>Empirical evidence</strong></summary>

Two copies (real `dist` + a byte-identical copy at `.../ok-runtime/copy2`). `bun /tmp/.../ok-runtime/f-dual-package.ts`
```
OkA === OkB => false
foreign instanceof OkA => false
foreign.isOk() => true              // method dispatch still works, so nothing looks wrong
flat === nested (NOT flattened) => true
flat.unwrap() is still an Ok => true
Ok(foreign Err).flatten().isOk() => true
Ok(foreign Err).flatten().isErr() => false
...unwrap() instanceof ErrB => true
same-copy flatten unwrap => 42      // baseline works
Symbol.hasInstance own on Ok => []  // no brand / no hasInstance escape hatch
```

</details>

**Recommendation.** Brand the classes: add a non-enumerable `[Symbol.for("antithrow.result")]` tag (or a `readonly _tag: "ok" | "err" | "pending"`), define `static [Symbol.hasInstance]` in terms of it, and rewrite `flatten` to use the brand. Export a `Result.isResult(value)` guard so consumers have the same escape hatch. Same fix applies to `isThenable`'s sibling checks and to `Pending.flatten`.

**Verifier note.** Reproduced with two copies of the built package: `bun f-dual-package.ts` → `foreign instanceof OkA => false` while `foreign.isOk() => true`, `flat === nested (NOT flattened) => true`, and critically `Ok(foreign Err).flatten().isOk() => true` / `.isErr() => false` with `unwrap() instanceof ErrB => true`; same-copy baseline flattens correctly (`=> 42`). Source matches: ok.ts:103 is a bare `instanceof Ok || instanceof Err || instanceof Pending` with the `return this as unknown as FlattenOk<T,E>` fa […truncated, full text in findings.json]

---

### `err-runtime/err-2` — Err.mapErr with a rejecting async callback produces a Result that rejects instead of settling, and crashes the process if never awaited

**Severity:** high · **Category:** correctness · **Verifier verdict:** confirmed

**Claim.** `mapErr` wraps `fn(this.error)` in `new Pending(result.then(error => new Err(error)))` with no rejection handler. If the callback's promise rejects (or an `async` callback throws), the value handed back to the caller is a `Pending` — a `Result` per the type system — whose internal promise is rejected. `await`ing that `Result` throws, and if nothing ever awaits it the rejection is unhandled and terminates the process. This is exactly the failure mode the library exists to eliminate, and `Result.try`/`Result.fromPromise` do catch it, so the behaviour is inconsistent within the same API.

<details><summary><strong>Empirical evidence</strong></summary>

`bun /…/err-runtime/03-subclass.ts`:
```
M16 await on Result (Pending from mapErr) THREW: kaboom
```
`bun /…/err-runtime/01-ctor-identity.ts`:
```
C9 mapErr rejecting promise -> Pending
C10 settle() REJECTS with: rejected!
```
Unawaited, `bun /…/err-runtime/10-unhandled.ts`:
```
created: Pending
error: mapErr-async-threw
      at mapErr (/home/user/antithrow/packages/antithrow/src/err.ts:44:18)
Bun v1.3.11 (Linux x64)
```
and the same file bundled for node (`node ./10-unhandled.mjs`):
```
created: Pending
Error: mapErr-async-threw
    at Err.mapErr (…/10-unhandled.mjs:106:20)
Node.js v22.22.2
```

</details>

**Recommendation.** Either catch and re-enter the Result domain — `new Pending(result.then(e => new Err(e), rejection => new Err(rejection as F)))` — or, if "errors from `fn` are not caught" is a deliberate invariant, do not return a `Pending` at all for async callbacks: an async `mapErr` should be `Result.fromPromise`-shaped so the rejection channel is provably empty. A type named `Result` that can reject when awaited breaks the library's central guarantee; at minimum the base-class JSDoc `@throws Errors thrown by `fn` are not caught.` must be upgraded to state that an async `fn` yields a `Pending` that rejects and can crash the process.

**Verifier note.** Reproduced. err.ts:46 is `new Pending(result.then((error) => new Err(error)))` with no onrejected. `bun 03-subclass.ts` -> `M16 await on Result (Pending from mapErr) THREW: kaboom`; `bun 01-ctor-identity.ts` -> `C9 mapErr rejecting promise -> Pending`, `C10 settle() REJECTS with: rejected!`; `bun 09-rejection.ts` -> `!! unhandledRejection: mapErr-async-threw`. I additionally verified the process-termination claim myself: `bun ./10-unhandled.ts` exits 1 and `node ./10-unhandled.mjs` exits 1. The  […truncated, full text in findings.json]

---

### `err-runtime/err-3` — Reference docs state "No other method throws" for Err; at least six other methods throw

**Severity:** high · **Category:** docs · **Verifier verdict:** confirmed

**Claim.** `apps/docs/docs/reference/antithrow/err.md:60` says: "`unwrap()` throws [`UnwrapError`](./unwrap-error). No other method throws." In fact `[Symbol.iterator]` throws whenever the generator is resumed past its single yield (reachable from ordinary spread/`for..of`/`Array.from`), and `mapErr`, `orElse`, `mapOrElse`, `unwrapOrElse` all re-throw exceptions raised by their callbacks — which the base-class JSDoc explicitly documents as intended (`@throws Errors thrown by fn are not caught`). The reference page directly contradicts base.ts.

<details><summary><strong>Empirical evidence</strong></summary>

`bun /…/err-runtime/02-iterator.ts`:
```
I1 [...new Err('x')] THREW -> Error: Unreachable: generator should have been halted
I3 for..of full loop THREW -> Error: Unreachable: generator should have been halted
```
`bun /…/err-runtime/09-rejection.ts`:
```
P4 mapErr sync throw THREW -> boom-mapErr
P5 orElse sync throw THREW -> boom-orElse
P6 mapOrElse defaultFn throw THREW -> boom-mapOrElse
P7 unwrapOrElse throw THREW -> boom-uoe
```
Source of the claim, `/home/user/antithrow/apps/docs/docs/reference/antithrow/err.md` line 58-60:
```
## Throws

`unwrap()` throws [`UnwrapError`](./unwrap-error). No other method throws.
```

</details>

**Recommendation.** Rewrite the `## Throws` section of err.md to list: `unwrap()` (always, `UnwrapError`); `mapErr`/`orElse`/`mapOrElse`/`unwrapOrElse` (propagate callback exceptions verbatim); `[Symbol.iterator]` (throws if resumed past the first yield — i.e. any spread/`for..of`/`Array.from` that does not `break`). While there, fix the same page's `unwrapOrElse(fn: (error: E) => T): T` signature line, which omits the shipped `PromiseLike` overload.

**Verifier note.** apps/docs/docs/reference/antithrow/err.md:60 verbatim: '`unwrap()` throws [`UnwrapError`](./unwrap-error). No other method throws.' Contradicted by err.ts:121-124 (`[Symbol.iterator]` throws on resume — I reproduced I1/I3) and by base.ts, which carries `@throws Errors thrown by \`fn\` are not caught.` at lines 53, 69, 85, 103, 124, 162, 224. Runtime confirms P4-P7 (mapErr/orElse/mapOrElse/unwrapOrElse all propagate callback throws). The secondary note is also correct: err.md line 47 writes `unwr […truncated, full text in findings.json]

---

### `err-runtime/err-4` — Err's iterator throws an internal-invariant Error from ordinary iteration (spread, for..of, Array.from, Promise.all, destructuring), while Ok silently yields nothing

**Severity:** high · **Category:** correctness · **Verifier verdict:** confirmed

**Claim.** `Err[Symbol.iterator]` yields `this` then throws `new Error("Unreachable: generator should have been halted")`. That branch is only unreachable under `Result.do`, which calls `iter.return()`. Every other consumer of the iteration protocol resumes the generator and hits the throw. The message asserts unreachability, names no user-facing concept, is a plain `Error` rather than the library's `UnwrapError`, and is emitted from a public built-in protocol. The type system actively invites the mistake: `for (const v of x)` on an `Err<number, string>` type-checks and binds `v: Err<number, string>`. `Ok` in the identical positions produces an empty iteration instead, so the two halves of the union behave incompatibly.

<details><summary><strong>Empirical evidence</strong></summary>

`bun /…/err-runtime/02-iterator.ts`:
```
I1 [...new Err('x')] THREW -> Error: Unreachable: generator should have been halted
I2 Array.from(new Err('x')) THREW -> Error: Unreachable: generator should have been halted
I3 for..of full loop THREW -> Error: Unreachable: generator should have been halted
I6 array destructure const [a,b] = THREW -> Error: Unreachable: generator should have been halted
I7 new Map(new Err(['k','v'])) THREW -> Error: Unreachable: generator should have been halted
I8 Promise.all(new Err('x')) OK -> Promise { <rejected> }        <- unhandled rejection, crashes the process
J1 [...new Ok(1)] OK -> []
J2 for..of new Ok(1) OK -> iterations=0
J3 Array.from(new Ok(1)) OK -> []
K4 [...Result.do-style manual] Array.from(generator) THREW -> Error: Unreachable: generator should have been halted
```
Only `break`/single-element destructuring escape (`I4`, `I5` return `OK`). Type-level invitation, emitted .d.ts from `11-emit3.ts`:
```
export declare function loop(x: Err<number, string>): Err<number, string> | null;   // body is `for (const v of x) return v;`
```
The existing suite only tests the raw generator (`/home/user/antithrow/packages/antithrow/src/err.test.ts:405`), never a real iteration form.

</details>

**Recommendation.** Make the second `next()` a clean `{ done: true, value: undefined }` (drop the `throw`) so `[...err]`, `Array.from(err)` and `for..of` yield exactly one `Err` and terminate — symmetric with `Ok`'s empty iteration and harmless to `Result.do`, which reads only the first result. If the throw must stay as a `Result.do`-misuse tripwire, throw a named, documented error type (e.g. `UnwrapError`-style `ResultIterationError`) whose message explains that `Err` is only iterable via `yield*` inside `Result.do`, and note the hazard on the err.md reference page.

**Verifier note.** Reproduced verbatim: I1/I2/I3/I6/I7 all throw `Error: Unreachable: generator should have been halted`; I4/I5 (break / single-element destructure) return OK; J1-J3 show `Ok` yields an empty iteration; K2/K4 show manual generator drains hit it too. I8's unhandled rejection is real — the 02-iterator.ts run ends with an uncaught `Unreachable: ...` traced to err.ts:123. Type-level invitation confirmed by my own emit: `export declare function loop(x: Err<number, string>): Err<number, string> | null` f […truncated, full text in findings.json]

---

### `pending-runtime/pend-1` — A throwing or rejecting callback on the Pending path produces an unhandled promise rejection that crashes the process — even when the caller does await the result

**Severity:** high · **Category:** correctness · **Verifier verdict:** adjusted

**Claim.** `Pending.map/mapErr/andThen/orElse` implement themselves as `new Pending(this.promise.then(settled => settled.map(fn)))`. If `fn` throws (or returns a rejected promise), the derived promise rejects and the returned object is a `Pending` whose inner promise is rejected. Because no handler is attached at construction time, Node/Bun report an unhandled rejection at the end of the current microtask checkpoint and terminate the process with exit code 1 — before a later `await` of that same Pending can catch it. This makes the documented 'start the work now, await it later' Pending idiom unsafe: the same callback that is catchable with try/catch on the Ok path is an unrecoverable process kill on the Pending path. It is reachable entirely through blessed APIs (`Result.try(async ...).map(fn)`), not just the raw constructor.

<details><summary><strong>Empirical evidence</strong></summary>

`cd .../pending-runtime && bun 03-poisoned.ts` (control, sync vs async divergence):
```
map(() => { throw }) -> REJECTED Error "thrown in map"
map(async () => { throw }) -> REJECTED Error "thrown in async map"
map(() => Promise.reject()) -> REJECTED Error "rejected in map"
mapErr(() => { throw }) -> REJECTED Error "thrown in mapErr"
andThen(() => { throw }) -> REJECTED Error "thrown in andThen"
...
sync: throw propagates synchronously to the caller: sync throw
Result.try(async ok).map(throw) -> REJECTED Error "re-poisoned"
```
`bun 04-unhandled-counted.ts` (process-level accounting):
```
unhandledRejection count: 5
  - A: raw rejection, only isPending() called
  - B: throw inside Pending.map, result dropped
  - Called unwrap() on an Err value
  - E: Result.try(...).map(throw), result dropped
  - C: throw at head of a 3-long chain
```
`bun 05-unhandled-nohandler.ts` -> `=== BUN EXIT 1 ===`; `node 05b-node-dist.mjs` (published dist, Node 22) -> `Error: dropped-map-throw / at Ok.map (dist/ok.js:31:24) / at dist/pending.js:35:48 ... === NODE EXIT 1 ===`.
The decisive case — the result IS awaited, just one macrotask later. `node 09b-node-deferred.mjs`:
```
Error: validation blew up
    at Ok.map (file:///home/user/antithrow/packages/antithrow/dist/ok.js:31:24)
    at file:///home/user/antithrow/packages/antithrow/dist/pending.js:35:48
Node.js v22.22.2
=== NODE EXIT 1 ===
```
Neither `caught properly at the await:` nor `reached the end` printed. Same under bun: `bun 09c-bun-deferred-nohandler.ts` -> `=== BUN EXIT 1 ===`. With a handler installed (`bun 09-deferred-await.ts`) the sequence is visible: `caught properly at the await: validation blew up` followed by `process-level events observed: ["unhandledRejection: validation blew up"]` — the rejection is reported even though it was later handled, and `rejectionHandled` never fires in bun. 04 also shows a 3-long chain produces exactly one unhandled rejection (intermediates count as handled), so the leak is at the tail.

</details>

**Recommendation.** Stop letting a user callback turn a Result into a rejected promise. Concretely, in `Pending.map/mapErr/mapOr/mapOrElse/andThen/orElse`, wrap the settled-side invocation so a synchronous throw or a rejected callback promise is not silently promoted to a promise rejection. Two workable shapes: (a) breaking — catch it and settle as `Err`, widening the declared error to `E | unknown` (matches the library's own thesis that errors are values, and mirrors what `Result.try` already does); or (b) non-breaking — keep the rejection but attach a marker/no-op handler so the rejection is never *unhandled* until the terminal operation (`await`, `settle()`, `unwrap*`) observes it, and re-raise there. Either way, add a first-class rescue on `Pending` (`catch(fn)` / `rescue(fn): Pending<T, E | F>`) so a poisoned Pending has an in-library recovery path, and document the divergence from the Ok path prominently: the current `@throws Errors thrown by fn are not caught.` JSDoc in base.ts understates it — on the Pending path the throw is not merely uncaught, it is uncatchable at the call site and lethal to the process.

**Verifier note.** Every mechanical fact reproduces. `bun 05-unhandled-nohandler.ts` -> exit 1; `node 09b-node-deferred.mjs` (published dist) -> `Error: validation blew up / at Ok.map (dist/ok.js:31:24) / at dist/pending.js:35:48`, exit 1, and neither 'caught properly at the await:' nor 'reached the end' printed; `bun 09c` -> exit 1; `bun 04` -> 5 unhandled rejections including the `Result.try(async ...).map(throw)` blessed-API path, with a 3-long chain contributing exactly one. Source confirms `Pending.map/mapErr […truncated, full text in findings.json]

---

### `pending-runtime/pend-2` — unwrapOr / unwrapOrElse / mapOr / mapOrElse / orElse / or / mapErr are documented as total fallbacks but reject on a poisoned Pending, and the fallback is never invoked

**Severity:** high · **Category:** correctness · **Verifier verdict:** confirmed

**Claim.** Every recovery combinator on `Pending` is `this.promise.then(settled => settled.<op>(...))`. If the inner promise is rejected, `.then`'s fulfilment handler never runs, so the default value / fallback function / alternative Result is skipped entirely and the returned PromiseLike rejects with the raw reason. `unwrapOr(default)` is the library's totality escape hatch — docs (apps/docs/docs/reference/antithrow/pending.md:62 'settles then falls back to `value`'; base.ts:208-219 'otherwise returns the provided default value') promise it cannot fail. On the Pending path it can, and the caller is left with an untyped throw in exactly the place they wrote code to avoid one.

<details><summary><strong>Empirical evidence</strong></summary>

`bun 03-poisoned.ts`:
```
unwrapOr(0)  <-- default NOT used -> REJECTED Error "boom"
unwrapOrElse(()=>0)  <-- fallback NOT used -> REJECTED Error "boom"
mapOr(0, f)  <-- default NOT used -> REJECTED Error "boom"
mapOrElse(()=>0,(v)=>v) -> REJECTED Error "boom"
mapErr(f)  <-- error recovery skipped -> REJECTED Error "boom"
orElse(()=>Ok(0))  <-- recovery skipped -> REJECTED Error "boom"
or(Ok(0))  <-- fallback skipped -> REJECTED Error "boom"
flatten() -> REJECTED Error "boom"
unwrapOrElse fallback invocation count on poisoned Pending: 0
```
Reached from blessed APIs only — `bun 11-realistic.ts`, where `Result.try<User, Error>(async () => ({}) as User).map(u => u.profile!.name.toUpperCase())` models an ordinary bad-data TypeError:
```
A. name.isPending(): true - indistinguishable from a healthy Pending
A. unwrapOr('anonymous') REJECTED with TypeError: undefined is not an object (evaluating 'u.profile.name')
A. full recovery chain REJECTED with TypeError: undefined is not an object (evaluating 'u.profile.name')
```
where the 'full recovery chain' is `.map(...).mapErr(...).orElse(() => Ok('fallback')).unwrapOr('last resort')` — four separate recovery steps, all bypassed.

</details>

**Recommendation.** Make the total combinators actually total: give `unwrapOr`, `unwrapOrElse`, `mapOr`, `mapOrElse` a rejection handler on the inner `.then` so a rejected inner promise routes to the default/fallback rather than propagating (for `unwrapOrElse`/`mapOrElse`, the fallback takes `E` — either pass the raw reason cast as `E` with a documented caveat, or add sibling `unwrapOrDefault`-style methods that are rejection-proof). For `or`/`orElse`/`mapErr`, either apply the same treatment or document explicitly that they recover from `Err` but not from a rejected inner promise. Until then the reference table entries at pending.md:60-63 and the base.ts JSDoc for `unwrapOr`/`mapOr` should carry an explicit 'unless the inner promise rejects' warning.

**Verifier note.** Reproduced verbatim. `bun 03-poisoned.ts` prints `unwrapOr(0) <-- default NOT used -> REJECTED Error "boom"`, same for `unwrapOrElse`, `mapOr`, `mapOrElse`, `mapErr`, `orElse`, `or`, `flatten`, and `unwrapOrElse fallback invocation count on poisoned Pending: 0`. Source confirms the mechanism: every one of these is a bare `this.promise.then(settled => settled.<op>(...))` with no onrejected (pending.ts:62-121), so the fulfilment handler never runs. The blessed-API path also reproduces: `bun 11-rea […truncated, full text in findings.json]

---

### `pending-runtime/pend-3` — Documentation states antithrow never rejects the underlying promise; the Pending combinators do

**Severity:** high · **Category:** docs · **Verifier verdict:** confirmed

**Claim.** apps/docs/docs/tutorial/04-go-async.md:63 says: 'The difference is that antithrow never rejects the underlying promise. A network failure produces `Err(TypeError)` that you can branch on, not an exception that bubbles up. That is why this whole pipeline needed no `try` / `catch`.' And pending.md:69-71 says under 'Throws': 'Never directly.' Both are false the moment any callback in a Pending chain throws — which the very next section of that tutorial encourages (`.map((response) => response.status)` style transforms). The `Pending` class JSDoc in pending.ts:14-24 also says nothing about rejection, and only the constructor row of pending.md:43 carries the caveat ('Must always resolve; rejections are not caught by `Pending` itself'), which a reader will take as being about the raw constructor they were just told (pending.md:45) not to use.

<details><summary><strong>Empirical evidence</strong></summary>

Doc text quoted above from `grep -rn "not caught|unhandled|rejection|rejects" apps/docs -i`. Counter-example, `bun 03-poisoned.ts`: a `Pending` built only via `Result.try` plus one `.map` rejects — `Result.try(async ok).map(throw) -> REJECTED Error "re-poisoned"`; and `bun 11-realistic.ts` shows a plain property-access TypeError inside `.map` producing a Pending whose `unwrapOr` rejects. Also contradicting 'Throws: Never directly': `bun 06-asynciter.ts` shows `Pending`'s own async iterator throwing — `B. for-await over Pending<Err> THREW: Error "Unreachable: generator should have been halted"`.

</details>

**Recommendation.** Correct the tutorial claim to 'antithrow never rejects the promise it creates for you — but a callback you pass to `map`/`andThen`/`mapErr` that throws will reject it', and give it a worked example plus the recovery idiom. Rewrite pending.md's 'Throws' section to cover (a) a rejecting inner promise, (b) a throwing chain callback, (c) the async-iterator invariant throw. Add the same warning to the `Pending` class JSDoc so it surfaces on hover, not only on the docs site.

**Verifier note.** Doc quotes verified at the exact lines. apps/docs/docs/tutorial/04-go-async.md:63 reads verbatim 'The difference is that antithrow never rejects the underlying promise. A network failure produces `Err(TypeError)` that you can branch on, not an exception that bubbles up. That is why this whole pipeline needed no `try` / `catch`.' pending.md:71 under '## Throws' reads 'Never directly.' pending.md:43 is the constructor-row caveat 'Must always resolve; rejections are not caught by `Pending` itself', […truncated, full text in findings.json]

---

### `constructors/ok-1` — Result.fromPromise breaks on any non-Promise thenable: TypeError, or a Pending that settles to a non-Result value

**Severity:** high · **Category:** correctness · **Verifier verdict:** adjusted

**Claim.** `fromPromise` calls `promise.then(ok, err)` directly and feeds the RETURN VALUE of that call to `new Pending(...)`. The `PromiseLike` contract is honoured by real Promises but not by all thenables, and `Result.try` funnels anything with a callable `.then` here (see ok-3). Three distinct failures: (a) a thenable whose `then` returns `undefined` produces `new Pending(undefined)` — every subsequent operation throws `TypeError: undefined is not an object`; (b) a thenable whose `then` returns a promise of something else produces a `Pending` that settles to that value, so `await pending` yields a plain string where the type says `Settled<T,E>` and `.isOk()` is not even a function; (c) a thenable whose `then` throws synchronously makes `Result.fromPromise` itself throw. The existing test "accepts PromiseLike values" (result.test.ts:1188) does not cover this — it passes `Promise.resolve(42)` merely annotated as `PromiseLike<number>`, so it is a real Promise.

<details><summary><strong>Empirical evidence</strong></summary>

`bun /tmp/claude-0/-home-user-antithrow/6fa15e49-ae6b-5bd4-b03a-8a3385b537f3/scratchpad/factories/fix-check.ts` printed:
```
--- CURRENT Result.fromPromise ---
  real promise (resolve)                     -> Ok(1)
  real promise (reject)                      -> Err(r)
  minimal thenable (then returns undefined)  -> THREW undefined is not an object (evaluating 'this.promise.then')
  thenable whose then returns junk           -> NOT A RESULT: string junk
  thenable whose then throws sync            -> THREW t
--- FIXED  Promise.resolve(...) ---
  real promise (resolve)                     -> Ok(1)
  real promise (reject)                      -> Err(r)
  minimal thenable (then returns undefined)  -> Ok(7)
  thenable whose then returns junk           -> Ok(7)
  thenable whose then throws sync            -> Err(t)
```
`bun .../runtime2.ts` corroborates: `A1 Result.fromPromise(minimalThenable) construct => isPending=true .promise=undefined`, `A2 await that Pending => THREW TypeError: undefined is not an object (evaluating 'this.promise.then')`, `A4 .map on broken Pending => THREW TypeError: ...`, `B2 Result.fromPromise(badThenable) => THREW Error: then-threw`. `bun .../runtime3.ts`: `A5a settled value type => typeof settled=string, value=ignored, instanceof Ok=false, instanceof Err=false`; `A5b calling .isOk() on that 'Settled' => THREW TypeError: settled.isOk is not a function`.

</details>

**Recommendation.** Change `fromPromise` to assimilate through the platform: `return new Pending(Promise.resolve(promise).then((ok) => new Ok(ok), (err) => new Err(err as E)));`. This is a one-line change, is exactly what `await` does, and (per fix-check.ts) makes all five thenable shapes behave correctly — including turning the synchronously-throwing `then` into an `Err` instead of a thrown exception. Add tests using genuinely non-Promise thenables rather than `Promise.resolve(x) as PromiseLike<x>`.

**Verifier note.** Reproduces exactly — fix-check.ts and runtime2/3 output matches character-for-character (minimal thenable -> `new Pending(undefined)` then TypeError; junk-returning `then` -> settled value is a bare string with no .isOk; sync-throwing `then` -> Result.fromPromise itself throws). Source confirms `promise.then(ok, err)` feeds its return value straight to `new Pending`. Two corrections. (1) Reachability is narrower than the claim implies: `fromPromise`'s own signature is `PromiseLike<T>`, and TS *d […truncated, full text in findings.json]

---

### `constructors/ok-4` — Docs document a Result.fromPromise error-mapper parameter that does not exist; the example does not compile and the argument is silently ignored at runtime

**Severity:** high · **Category:** docs · **Verifier verdict:** confirmed

**Claim.** apps/docs/docs/how-to/core/convert-a-promise.md has a section titled "Typing the error" stating "`Result.fromPromise` accepts an optional mapper to shape the rejection reason" with a full code sample passing a second argument. `fromPromise` is declared `fromPromise<T, E>(promise: PromiseLike<T>): Pending<T, E>` — arity 1. The documented call is a compile error, and if forced through (JS consumers, `any`) the mapper is silently dropped and the raw rejection reason lands in `Err`. Since ok-2 shows there is no other way to derive `E`, this is the one documented escape hatch and it does not exist.

<details><summary><strong>Empirical evidence</strong></summary>

/tmp/.../factories/doc-claims.ts contains the doc's verbatim example. `bun x tsc --noEmit --ignoreConfig --strict --exactOptionalPropertyTypes --noUncheckedIndexedAccess --allowImportingTsExtensions --moduleResolution bundler --module preserve --target es2022 --lib es2022,dom .../doc-claims.ts` →
```
factories/doc-claims.ts(19,52): error TS2554: Expected 1 arguments, but got 2.
```
`bun .../runtime3.ts` → `G3 fromPromise error mapper arg ignored? => err = string raw (mapper silently ignored, arity=1)` and `G4 Result.try arity => Result.try.length=1, Result.do.length=1`.

</details>

**Recommendation.** Implement the documented signature — it is the right API and resolves ok-2 for the promise path: `fromPromise<T, E>(promise: PromiseLike<T>, mapErr?: (cause: unknown) => E): Pending<T, E>`, with the no-mapper overload pinned to `E = unknown`. If the mapper is not going to be implemented, delete the section from convert-a-promise.md; leaving it is worse than having no docs.

**Verifier note.** Doc text verified verbatim in apps/docs/docs/how-to/core/convert-a-promise.md: section '## Typing the error', '`Result.fromPromise` accepts an optional mapper to shape the rejection reason', with the two-argument example and the follow-up 'Without the mapper, `E` is `unknown`'. Source is arity 1: `function fromPromise<T, E>(promise: PromiseLike<T>): Pending<T, E>`. Re-ran tsc on doc-claims.ts: `doc-claims.ts(19,52): error TS2554: Expected 1 arguments, but got 2.` (plus TS7006 on the now-uncontex […truncated, full text in findings.json]

---

### `constructors/ok-5` — The reference page's headline invariant "Throws: Never" is false for Result.fromPromise

**Severity:** high · **Category:** docs · **Verifier verdict:** confirmed

**Claim.** apps/docs/docs/reference/antithrow/result.md ends with a `## Throws` section reading "Never. Every static helper either returns `Ok`, `Err`, or a `Pending` whose promise settles to one of the two." Both halves are falsifiable: `Result.fromPromise` throws synchronously when the argument's `then` throws, and it can return a `Pending` that settles to a value which is neither `Ok` nor `Err` (ok-1). This is the single strongest safety claim the library makes and it is untested.

<details><summary><strong>Empirical evidence</strong></summary>

`bun .../runtime2.ts` → `B2 Result.fromPromise(badThenable) => THREW Error: then-threw`. `bun .../runtime3.ts` → `A5a settled value type => typeof settled=string, value=ignored, instanceof Ok=false, instanceof Err=false`. Contrast `B3 compare: Promise.resolve(badThenable) assimilation => rejected with then-threw` — the platform converts it to a rejection rather than a synchronous throw.

</details>

**Recommendation.** Land the `Promise.resolve(...)` fix from ok-1, which actually makes the claim true (fix-check.ts confirms: `thenable whose then throws sync -> Err(t)`), then add a regression test asserting `expect(() => Result.fromPromise(hostileThenable)).not.toThrow()` and that the settled value `instanceof Ok || instanceof Err`.

**Verifier note.** The '## Throws / Never. Every static helper either returns `Ok`, `Err`, or a `Pending` whose promise settles to one of the two.' section is present verbatim at the end of apps/docs/docs/reference/antithrow/result.md. Both halves falsified as claimed: runtime2 B2 `Result.fromPromise(badThenable) => THREW Error: then-threw`, and runtime3 A5a shows a settled value that is `typeof string`, `instanceof Ok=false`, `instanceof Err=false`. Strengthening detail the finding missed and which I verified mys […truncated, full text in findings.json]

---

### `do-notation/od-1` — A throw inside an async `Result.do` body produces a `Pending<T, never>` whose promise rejects — crashes Node when the Pending isn't awaited, and defeats `unwrapOr`

**Severity:** high · **Category:** correctness · **Verifier verdict:** confirmed

**Claim.** `Result.do(async function* () { throw x })` returns a value statically typed `Pending<T, never>` (i.e. `PromiseLike<Settled<T, never>>`, an error channel that is uninhabited). At runtime that Pending wraps a *rejected* promise, so it never settles to `Ok`/`Err`. Consequences: (a) `await result` throws where the types say it cannot; (b) even `await result.unwrapOr(fallback)` throws, so the escape hatch that exists precisely to avoid throwing does not work; (c) if the caller merely stores/inspects the Pending without awaiting it (e.g. `if (r.isPending())`), the rejection is unhandled and Node 22 terminates the process with exit code 1. The synchronous overload is honest by comparison — it throws at the call site where a normal `try` can see it. Note also that `Result.try(async () => { throw x })` *does* capture the throw into an `Err`, so `try` and `do` behave in opposite ways for the exact same async body.

<details><summary><strong>Empirical evidence</strong></summary>

`bun /tmp/.../result-do/10-findings-repro.ts` →
```
F-1 returned: Pending isPending: true
F-1 await REJECTED: boom
F-1 unwrapOr(default) REJECTED: boom
```
Process-crash check with real Node (`node /tmp/.../result-do/07-node-crash.mjs; echo EXIT=$?`) →
```
returned: Pending isPending: true
file:///.../07-node-crash.mjs:4
  throw new Error("async do body threw");
        ^
Error: async do body threw
Node.js v22.22.2
EXIT=1
```
(the `setTimeout(... 100)` in that script never fires — the process dies first). Type of the value, revealed by `bun x tsc --ignoreConfig --noEmit --strict ... /tmp/.../result-do/03-reveal.ts`: `error TS2322: Type 'Pending<number, never>' is not assignable to type '0'.` (line 46). The same rejected-Pending state is reachable from ordinary chaining, not just `throw`: `bun /tmp/.../result-do/11-extra.ts` → `X-4 do REJECTED: map-threw` for `yield* pending.map(v => { throw ... })`.

</details>

**Recommendation.** Either (a) make the async path attach a handler so the returned `Pending` cannot be an unhandled rejection and surface the failure deterministically, or (b) — better and breaking — stop pretending the error channel is `never`: have `resultDo`'s async path catch and re-throw synchronously via a microtask-safe channel, or return `Pending<T, E | unknown>` and convert rejections to `Err`. At an absolute minimum, `Pending`'s constructor should install a no-op `.catch` on the stored promise so a stored-but-unawaited `Pending` can never take the process down, and the JSDoc on `resultDo` must state that the async overload returns a *rejecting* Pending rather than an `Err`.

**Verifier note.** Fully reproduced. `Result.do(async function*(){ throw })` returns a Pending; tsc reveals `Pending<number, never>` (03-reveal.ts:46). Runtime: `F-1 await REJECTED: boom`, `F-1 unwrapOr(default) REJECTED: boom`. Real Node 22 crash confirmed: `node 07-node-crash.mjs` printed the uncaught Error and `EXIT=1` (the 100ms setTimeout never fired). Bun path also shows `>>> UNHANDLED REJECTION OBSERVED: never-averted-throw` (02-runtime2 S). Rejected-Pending is also reachable without an explicit throw (`X-4 […truncated, full text in findings.json]

---

### `do-notation/od-2` — Reference docs for `Result` state "Throws: Never … or a `Pending` whose promise settles" — false for `Result.do`, and self-contradictory four lines earlier

**Severity:** high · **Category:** docs · **Verifier verdict:** confirmed

**Claim.** `apps/docs/docs/reference/antithrow/result.md` line 73 correctly says "Thrown exceptions are *not* caught", but the same page's `## Throws` section (line ~87) says: "**Never.** Every static helper either returns `Ok`, `Err`, or a `Pending` whose promise settles to one of the two." Both halves are false for `Result.do`: the sync overload throws through, and the async overload returns a `Pending` whose promise rejects (never settles). A reader who trusts the `## Throws` section will omit the `try`/`catch` that `Result.do` actually requires.

<details><summary><strong>Empirical evidence</strong></summary>

Doc text (`sed -n 60,100p apps/docs/docs/reference/antithrow/result.md`):
```
On short-circuit, `Result.do` calls `iter.return()` so `finally` blocks execute. Thrown exceptions are *not* caught; use `Result.try` for throw-capturing behaviour.
...
## Throws

Never. Every static helper either returns `Ok`, `Err`, or a `Pending` whose promise settles to one of the two.
```
Contradicted empirically by `bun /tmp/.../result-do/01-runtime.ts` → `G1 THREW sync-throw` and by od-1's `F-1 await REJECTED: boom`.

</details>

**Recommendation.** Rewrite the `## Throws` section to: "`Result.try` and `Result.fromPromise` never throw. `Result.do` propagates exceptions from the generator body: synchronous generators throw at the call site; async generators return a `Pending` that **rejects**." Add the same caveat to the `resultDo` JSDoc in `result.ts` (which currently only says exceptions "are not converted to `Err`", without saying what the async overload does with them).

**Verifier note.** Doc text verified verbatim: apps/docs/docs/reference/antithrow/result.md line 73 'Thrown exceptions are *not* caught' and the `## Throws` section 'Never. Every static helper either returns `Ok`, `Err`, or a `Pending` whose promise settles to one of the two.' Both halves empirically false for Result.do: `G1 THREW sync-throw` (sync overload throws at the call site) and `F-1 await REJECTED: boom` (async overload's Pending rejects, never settles). Self-contradiction within one page. High is calibrat […truncated, full text in findings.json]

---

### `do-notation/od-3` — How-to guide claims you can `yield*` a `Pending` or a `Promise` to upgrade a sync `Result.do` — neither compiles nor runs

**Severity:** high · **Category:** docs · **Verifier verdict:** adjusted

**Claim.** `apps/docs/docs/how-to/core/use-result-do.md` says: "If any `yield*` is a `Pending` or `Promise`, `Result.do` returns a `Pending`". Both halves are wrong. (a) A sync generator cannot `yield*` a `Pending` at all — `Pending` has no `[Symbol.iterator]`, so TS rejects it (TS2488) and the runtime throws a `TypeError`; a sync `Result.do` can *never* be upgraded to `Pending`. (b) No generator, sync or async, can `yield*` a bare `Promise` — `Promise` is neither iterable nor async-iterable. The wording mirrors the (true) rule for `map`/`andThen`/`Result.try`, so the reader is invited to expect an auto-upgrade that does not exist. The sentence two paragraphs earlier ("the surrounding `pipeline` is a `Result<T, E>`") is also imprecise: the sync overload returns `Settled<T, E>`, never a `Result` that could be `Pending`.

<details><summary><strong>Empirical evidence</strong></summary>

Type level, `bun x tsc --ignoreConfig --noEmit --strict --exactOptionalPropertyTypes --noUncheckedIndexedAccess --allowImportingTsExtensions --moduleResolution bundler --module preserve --target es2022 --lib es2022 /tmp/.../result-do/04-negative.ts` →
```
04-negative.ts(12,19): error TS2488: Type 'Pending<number, "p">' must have a '[Symbol.iterator]()' method that returns an iterator.
```
Runtime, `bun /tmp/.../result-do/10-findings-repro.ts` →
```
F-6 yield* Promise THREW: TypeError: yield* Promise.resolve is not a function.
F-7 yield* Pending in sync gen THREW: TypeError: yield* new Pending is not a function.
```
Sync overload return type, from `03-reveal.ts`: `Type 'Settled<number, "s">' is not assignable to type '0'` (i.e. `Settled`, not `Result`).

</details>

**Recommendation.** Replace the sentence with: "A `Pending` can only be `yield*`ed from an `async function*`; a plain generator can only `yield*` settled results (`Ok`/`Err`/`Settled`). Promises are not yieldable — `await` them, or wrap with `Result.fromPromise` first." Also correct "is a `Result<T, E>`" to "is a `Settled<T, E>`" for the sync form.

**Verifier note.** Every fact checks out; severity is one notch high. Confirmed: use-result-do.md:27 says 'If any `yield*` is a `Pending` or `Promise`, `Result.do` returns a `Pending`'; a sync generator cannot yield* a Pending (TS2488 at 04-negative.ts:12, runtime `F-7 ... TypeError: yield* new Pending is not a function`), and no generator can yield* a bare Promise (`F-6 ... TypeError: yield* Promise.resolve is not a function`, and AE in 06-runtime3 identically). Sync overload does return `Settled<number,"s">`, no […truncated, full text in findings.json]

---

### `types-guards-variance/gv-2` — `Ok#map`'s conditional overload lies when the callback's return type is `unknown` or a bare type parameter: static `Ok<U, E>`, runtime `Pending`

**Severity:** high · **Category:** type-safety · **Verifier verdict:** adjusted

**Claim.** The second `map` overload is `map<U>(fn: (value: T) => U): U extends PromiseLike<infer A> ? Pending<A, E> : Ok<U, E>`. When `U` resolves to `unknown` (a callback annotated `: unknown`, or `U` supplied as a type argument), `unknown extends PromiseLike<infer A>` is false, so the conditional picks the `Ok<U, E>` branch — but at runtime `Ok#map` calls `isThenable(result)` and returns a `Pending`. The caller holds a value typed `Ok` whose `.isOk()` is `false` and whose `.value` is `undefined`. This is the same class of defect as gv-1: a conditional type used as the sole gate on a runtime `instanceof`/duck check.

<details><summary><strong>Empirical evidence</strong></summary>

13-map-conditional.ts — `bun x tsc --ignoreConfig --noEmit --strict ... 13-map-conditional.ts` → exit 0 (zero errors). Runtime `bun 13-map-conditional.ts`:
```
[unknown cb] instanceof Pending = true | isOk() = false | .value = undefined
[generic cb] instanceof Pending = true | isOk() = false
```
Source lines:
```ts
const m = o.map((v): unknown => Promise.resolve(v * 2)); // static: Ok<unknown, never>
const claimedValue: unknown = m.value;                   // compiles; undefined at runtime

function mapWith<U>(ok: Ok<number, never>, fn: (v: number) => U) { return ok.map(fn); }
const m2 = mapWith<number | Promise<number>>(o, (v) => Promise.resolve(v));
```

</details>

**Recommendation.** Make the sync/async split unrepresentable-when-unknown rather than conditional-on-`U`: have the fallback overload return `Ok<U, E> | Pending<U, E>` (the third overload already does exactly this — it just never wins overload resolution before the conditional one). Reordering so the honest union overload is reachable for non-`PromiseLike`-provable `U`, or gating the conditional overload on `NonThenable<U>` the way `mapOr` already gates its sync overload, would remove the lie at the cost of forcing a narrowing check on the rare `unknown` callsite.

**Verifier note.** The primary case reproduces exactly: tsc exit 0 on 13-map-conditional.ts, and `bun` prints `[unknown cb] instanceof Pending = true | isOk() = false | .value = undefined`. I revealed the static type myself: `o.map((v): unknown => Promise.resolve(v*2))` is `Ok<unknown, never>` — a genuine lie, and it also fires for any externally-declared callback `(v: number) => unknown` (I confirmed `o.map(cb)` also reveals `Ok<unknown, never>`). High is calibrated correctly (same class as gv-1 but a much narrow […truncated, full text in findings.json]

---

### `api-completeness/ok-2` — Core how-to page documents `.match({ ok, err })`, a method that does not exist in v3

**Severity:** high · **Category:** docs · **Verifier verdict:** confirmed

**Claim.** `apps/docs/docs/how-to/core/narrow-result-states.md` has a section titled "Exhaustive switch with `.match`" instructing users to call `result.match({ ok, err })`. No `Result` shape in v3 has a `match` method — that is the *legacy* v2 API (`src/legacy/result.ts:296`). The same page's first example also does not compile, because the `else` branch of `if (result.isOk())` still includes `Pending`, which has no `.error`. Both are on the page a user lands on when looking for exhaustive handling, i.e. exactly the audience that has just discovered `match` is missing.

<details><summary><strong>Empirical evidence</strong></summary>

`bun x tsc ... 18-narrow-doc.ts` → `TSC EXIT=0`, meaning both `@ts-expect-error` markers fired: the one over `report(result.error)` in the `else` branch, and the one over `result.match({ ok, err })`. Runtime (`bun 18b.ts`):
```
runtime .match -> TypeError: r.match is not a function. (In 'r.match({ ok: (v) => v, err: () => 0 })', 'r.match' is undefined)
```
Runtime prototype enumeration (`bun 01-surface.ts`) confirms `Ok`/`Err`/`Pending` prototypes are exactly `isOk, isErr, isPending, map, mapErr, mapOr, mapOrElse, andThen, and, or, orElse, flatten, unwrap, unwrapErr, unwrapOr, unwrapOrElse, settle` (+`then` on `Pending`) — `MISSING: match` and `MISSING: fold`. Contrast `grep` on the legacy source: `src/legacy/result.ts:296: match<U>(handlers: { ok: (value: T) => U; err: (error: E) => U }): U;`.

</details>

**Recommendation.** Ship `match` (see ok-3) and keep the doc, or delete the section now and fix the `else` example to `else if (result.isErr())`. Add the docs site to CI type-checking — extract fenced `ts` blocks and compile them, the way neverthrow and Effect do; three separate doc pages in this audit contain examples that do not compile (see also ok-15).

**Verifier note.** Reproduced. narrow-result-states.md does contain a section "Exhaustive switch with `.match`" calling `result.match({ ok, err })`; no `match` exists anywhere in v3 — prototype enumeration gives exactly `isOk, isErr, isPending, map, mapErr, mapOr, mapOrElse, andThen, and, or, orElse, flatten, unwrap, unwrapErr, unwrapOr, unwrapOrElse, settle` (+`then` on Pending), and `bun 18b.ts` gives `TypeError: r.match is not a function`. grep over apps/docs/docs/reference/antithrow/ finds no `match` at all, s […truncated, full text in findings.json]

---

### `api-completeness/ok-3` — No `match`/`fold`; `mapOrElse(defaultFn, fn)` is Rust-ordered and silently inverts when `T` and `E` are compatible

**Severity:** high · **Category:** ergonomics · **Verifier verdict:** adjusted

**Claim.** `mapOrElse` is the only exhaustive two-branch handler, and its signature is `(defaultFn: (error: E) => U, fn: (value: T) => U)` — error handler first. That is Rust's `map_or_else` order, and the reverse of every JS convention: neverthrow `.match(okFn, errFn)`, ts-results-es `.mapOrElse`/oxide.ts `match({ Ok, Err })`, Effect `Either.match({ onLeft, onRight })`. When `T` and `E` are assignment-compatible — `Result<string, string>` for a parse-with-message, `Result<unknown, unknown>`, or any pair of handlers that both accept and return the same type — swapping the arguments compiles cleanly and inverts the semantics at runtime with no diagnostic.

<details><summary><strong>Empirical evidence</strong></summary>

`bun 07b-match-run.ts` on `const parsed: Result<string, string> = new Ok("hello")` and `const failed: Result<string, string> = new Err("boom")`:
```
correct  (defaultFn first): HELLO
swapped  (JS match order) : fallback
correct  on Err: fallback
swapped  on Err: BOOM
```
The swapped call is `parsed.mapOrElse((v) => v.toUpperCase(), (e) => "fallback")` — the natural JS ordering — and it returns `"fallback"` for a success and `"BOOM"` for a failure. `bun x tsc ... 07-match.ts` confirms both orderings infer the identical type `string | PromiseLike<string>`, and that the `@ts-expect-error` markers over `.match(...)` and `.fold(...)` both fire (neither method exists).

</details>

**Recommendation.** Add `match` to `ResultBase` in the JS convention and with an object form, which is swap-proof: `match<U>(handlers: { ok: (value: T) => U; err: (error: E) => U }): U` (this is exactly the legacy v2 signature at `src/legacy/result.ts:296`, so v3 is a regression here). The object form also removes the ordering question entirely and reads better at a call site than two positional lambdas. Keep `mapOrElse` for Rust parity but document the ordering hazard in its JSDoc.

**Verifier note.** Core facts reproduce: no `match`/`fold` on any shape (markers on lines 9-12 of 07-match.ts fire), `mapOrElse(defaultFn, fn)` is error-handler-first in base.ts/ok.ts/err.ts/pending.ts, and `bun 07b-match-run.ts` reproduces the silent inversion verbatim (`swapped (JS match order): fallback` on an Ok, `swapped on Err: BOOM`). Legacy `match({ok,err})` at src/legacy/result.ts:296 confirmed, so v3 is a regression. Imprecision to correct: the prior-art list cites "ts-results-es `.mapOrElse`" as a count […truncated, full text in findings.json]

---

### `api-completeness/ok-4` — No collection combinators at all (`all`/`combine`/`combineWithAllErrors`/`any`/`partition`), and the only blessed alternative serializes async work

**Severity:** high · **Category:** missing-capability · **Verifier verdict:** confirmed

**Claim.** The `Result` namespace contains exactly `try`, `fromPromise`, `do`. There is no way to combine an array or tuple of Results. This is the single largest gap versus prior art: Rust has `collect::<Result<Vec<_>,_>>()`, neverthrow has `Result.combine`/`combineWithAllErrors`/`ResultAsync.combine`, ts-results-es has `Result.all`/`Result.any`, Effect has `Effect.all`/`Either.all`. antithrow's own *legacy* v2 API had `Result.all` (`src/legacy/result.ts:747`), so v3 removed it. `Result.do` is the only composition primitive offered, and because it awaits yielded Pendings one at a time, the natural way to write "fetch all of these and fail on the first error" runs 3x slower than the hand-rolled version.

<details><summary><strong>Empirical evidence</strong></summary>

`bun 01-surface.ts`:
```
Result namespace keys: [ "do", "fromPromise", "try" ]
Result.* statics:
   all => undefined
   combine => undefined
   combineWithAllErrors => undefined
   any => undefined
   partition => undefined
```
`bun x tsc ... 03-combine-types.ts` → `TSC EXIT=0` with `@ts-expect-error` over each of `Result.all`, `Result.combine`, `Result.combineWithAllErrors`, `Result.any`, `Result.partition` — all fire.
Timing, `bun 04-concurrency.ts` (three 50 ms operations):
```
eager-then-do: [ 1, 2, 3 ] elapsed ~ 52 ms
lazy-in-do (serialized): [ 1, 2, 3 ] elapsed ~ 151 ms
hand-rolled concurrent: [ 1, 2, 3 ] elapsed ~ 52 ms
```
The 151 ms case is `Result.do(async function* () { for (const id of [1,2,3]) out.push(yield* fetchThing(id)); return out; })` — the obvious way to write it. Getting concurrency back requires leaving the Result API for `Promise.all(xs.map(x => x.settle()))`.
The tuple-preserving replacement a user must write is in 05-tuple-combine.ts: two helper mapped types (`OkTuple`, `ErrUnion`), a `const` type parameter, manual `new Pending(...)`, and two `as` casts — it typechecks (`TSC EXIT=0`, asserting `Pending<[number, string], "e1" | "e2">`) but permanently downgrades all-settled inputs to `Pending` because there is no sensible way to write the sync branch without duplicating the whole implementation behind overloads.

</details>

**Recommendation.** Add to the namespace, following neverthrow + Effect precedent: `Result.all(results)` (tuple-preserving via `const T extends readonly Result<unknown,unknown>[]`, first-`Err` short-circuit, returns `Settled` when every input is settled and `Pending` otherwise — the sync/async overload split the library already does well in `Result.try`); `Result.allSettled`/`combineWithAllErrors` accumulating `E[]`; `Result.any` (first `Ok`, else all errors); and `Result.partition(results): [T[], E[]]`. Concurrency should be the default for the Pending case, with an optional `{ concurrency }` limit. Without this, the most common real-world shape — "validate/fetch N things" — has no idiomatic expression.

**Verifier note.** Reproduced. `Result` namespace keys are exactly `["do","fromPromise","try"]` (result.ts exports `{try: resultTry, fromPromise, do: resultDo}`); 03-combine-types.ts EXIT=0 with every `@ts-expect-error` over `Result.all/combine/combineWithAllErrors/any/partition` firing. Timing reproduced on my run: eager-then-do ~52ms, lazy-in-`do` ~151ms, hand-rolled `Promise.all(xs.map(x => x.settle()))` ~52ms — so the 3x serialization of the natural in-loop form is real, and grep over apps/docs/docs (excluding […truncated, full text in findings.json]

---

### `docs-accuracy/ok-1` — how-to guide documents a `.match()` method that does not exist on the v3 API

**Severity:** high · **Category:** docs · **Verifier verdict:** confirmed

**Claim.** apps/docs/docs/how-to/core/narrow-result-states.md L35-44 has a section titled "Exhaustive switch with `.match`" showing `result.match({ ok, err })`. No `match` method exists on ResultBase, Ok, Err, or Pending in v3. `match` exists only in the legacy API (packages/antithrow/src/legacy/result.ts:296 and legacy/result-async.ts:289), which is a separate `antithrow/legacy` entrypoint. A reader following this page writes code that does not compile.

<details><summary><strong>Empirical evidence</strong></summary>

Transcribed the fence verbatim into 07-docs-site-types.ts L11-18 and ran the tsc command above. Output:
```
07-docs-site-types.ts(13,25): error TS2339: Property 'match' does not exist on type 'Result<number, { kind: string; }>'.
  Property 'match' does not exist on type 'Ok<number, { kind: string; }>'.
```
Grep confirms the only `match` implementations are under src/legacy/: `grep -rn "match<U>" /home/user/antithrow/packages/antithrow/src` -> legacy/result.ts:296,469,606 and legacy/result-async.ts:289,602 only.

</details>

**Recommendation.** Either delete the section, or add `match(handlers: { ok, err })` to ResultBase and the three concrete classes. Given that the docs already reach for it and it is the natural exhaustive-handling primitive, implementing it is the better fix — `mapOrElse(errFn, okFn)` is the current workaround but has reversed argument order versus every `match` a reader has seen, which is likely why the doc author reached for `.match` instead.

**Verifier note.** Reproduced. narrow-result-states.md L35-44 does show `result.match({ok,err})`; tsc on the verbatim transcription gives `error TS2339: Property 'match' does not exist on type 'Result<number, { kind: string; }>'`. Grep confirms `match` exists only in src/legacy/result.ts (296/469/606) and legacy/result-async.ts (289/602), i.e. the separate `antithrow/legacy` entrypoint, and every other `.match` mention in the docs tree is under docs/legacy/. A core how-to page teaching a non-existent method is cor […truncated, full text in findings.json]

---

### `docs-accuracy/ok-2` — how-to guide documents a second `mapper` argument to `Result.fromPromise` that does not exist

**Severity:** high · **Category:** docs · **Verifier verdict:** confirmed

**Claim.** apps/docs/docs/how-to/core/convert-a-promise.md L25-34 states "`Result.fromPromise` accepts an optional mapper to shape the rejection reason" and shows `Result.fromPromise(fetch("/api"), (cause): FetchError => ({...}))`. The actual signature (packages/antithrow/src/result.ts:23) is `fromPromise<T, E>(promise: PromiseLike<T>): Pending<T, E>` — one parameter. The whole "Typing the error" section of that page teaches an API that does not exist.

<details><summary><strong>Empirical evidence</strong></summary>

Transcribed verbatim into 07-docs-site-types.ts L22-28. tsc output:
```
07-docs-site-types.ts(24,58): error TS2554: Expected 1 arguments, but got 2.
```
Source confirms: `function fromPromise<T, E>(promise: PromiseLike<T>): Pending<T, E>` at result.ts:23, single parameter, and `Result = { try: resultTry, fromPromise, do: resultDo }` at result.ts:115-119.

</details>

**Recommendation.** Add the optional mapper overload — `fromPromise<T, E>(promise: PromiseLike<T>, mapErr?: (cause: unknown) => E): Pending<T, E>` — since without it there is no way to type the rejection at the construction site (the current workaround is `.mapErr(...)` after the fact, which the sibling page wrap-a-throwing-function.md L41-48 recommends). If the overload is not wanted, delete the section and point at `.mapErr`.

**Verifier note.** Reproduced. result.ts:23 is `function fromPromise<T, E>(promise: PromiseLike<T>): Pending<T, E>` — one parameter, no overloads (dist/result.d.ts line 19 confirms the emitted shape). Verbatim doc transcription gives `error TS2554: Expected 1 arguments, but got 2`. The whole 'Typing the error' section (convert-a-promise.md L23-36) documents an API that does not exist; high is right.

---

### `docs-accuracy/ok-3` — The flagship `Result.do` synchronous example does not compile, and its async prose is wrong in both directions

**Severity:** high · **Category:** docs · **Verifier verdict:** adjusted

**Claim.** apps/docs/docs/how-to/core/use-result-do.md makes two false claims. (a) The "Synchronous" fence (L12-21) `yield*`s the return values of ordinary functions, and L23 describes them as `Result`s. But `yield*` on a `Result<T, E>` union never compiles in a sync generator: `Pending` implements only `[Symbol.asyncIterator]`, not `[Symbol.iterator]`. Sync generators require `Settled<T, E>` (or a bare `Ok`/`Err`) — a requirement stated nowhere in any doc. (b) L27 claims "If any `yield*` is a `Pending` or `Promise`, `Result.do` returns a `Pending`". Both halves are false: `yield*` on a `Pending` inside a sync generator throws a TypeError at runtime, and `yield*` on a raw `Promise` throws in an async generator too. What actually makes `Result.do` return a `Pending` is writing `async function*`, not what is yielded.

<details><summary><strong>Empirical evidence</strong></summary>

(a) 11-readme-and-yield.ts L89-98 transcribes the doc's sync example with the yielded functions typed as the doc describes (`Result<string,"io">` etc.). tsc:
```
11-readme-and-yield.ts(95,26): error TS2488: Type 'Result<string, "io">' must have a '[Symbol.iterator]()' method that returns an iterator.
11-readme-and-yield.ts(96,24): error TS2488: Type 'Result<unknown, "json">' must have a '[Symbol.iterator]()' method that returns an iterator.
11-readme-and-yield.ts(97,27): error TS2488: Type 'Result<{ ok: true; }, "schema">' must have a '[Symbol.iterator]()' method that returns an iterator.
```
12-yield-union.ts isolates the asymmetry — same error for the sync/`Result` case, while sync+`Settled` yields `Settled<string,"io">` and async+`Result` yields `Pending<string,"io">`.
(b) `bun 10-docs-site-runtime.ts`:
```
sync generator yield* Pending THREW: yield* Result.fromPromise is not a function. (In 'yield* Result.fromPromise(Promise.resolve(1))', 'yield* Result.fromPromise' is undefined)
async generator yield* Promise THREW: yield* Promise.resolve is not a function. (In 'yield* Promise.resolve(1)', 'yield* Promise.resolve' is undefined)
```

</details>

**Recommendation.** Rewrite the page: (1) type the sync example's helpers as `Settled<T, E>` and state explicitly that sync `Result.do` cannot accept a `Result` union — a step that might be async forces `async function*`; (2) replace L27 with "Use `async function*` when any step may be `Pending`; the return type is then `Pending<T, E>`"; (3) drop "or `Promise`" entirely. Longer term, giving `Pending` a `[Symbol.iterator]` that throws a *named, explanatory* error would turn today's cryptic "yield* X is not a function" into a diagnosable message.

**Verifier note.** Claim (b) fully confirmed and is the load-bearing half: use-result-do.md L27 ('If any `yield*` is a `Pending` or `Promise`, `Result.do` returns a `Pending`') is false in both halves — sync-generator `yield*` on a Pending throws `yield* Result.fromPromise is not a function`, async-generator `yield*` on a raw Promise throws `yield* Promise.resolve is not a function`; the return shape is determined by `function*` vs `async function*` (result.ts:74-81 overloads). The sync/async asymmetry is also con […truncated, full text in findings.json]

---

### `docs-accuracy/ok-6` — reference/result.md's "Throws: Never" section is contradicted by the same page 12 lines earlier

**Severity:** high · **Category:** docs · **Verifier verdict:** confirmed

**Claim.** apps/docs/docs/reference/antithrow/result.md L85-87 states: "## Throws — Never. Every static helper either returns `Ok`, `Err`, or a `Pending` whose promise settles to one of the two." Both halves are false for `Result.do`, and L73 of the *same page* says so: "Thrown exceptions are *not* caught". A sync generator that throws propagates the exception out of `Result.do`; an async generator that throws returns a `Pending` whose promise **rejects** rather than settling to `Ok`/`Err` — which also means it is an unhandled rejection if the caller never awaits it.

<details><summary><strong>Empirical evidence</strong></summary>

`bun 10-docs-site-runtime.ts`:
```
--- result.md 'Throws: Never' ---
sync Result.do THREW: generator body threw
async Result.do returned: Pending
async Result.do REJECTED: async generator body threw
```
Cross-checked against 05-result-do.ts which shows the same for the JSDoc's own wording: `sync throw propagated: boom`.

</details>

**Recommendation.** Replace that section with: "`Result.try` and `Result.fromPromise` never throw. `Result.do` propagates exceptions thrown by the generator body — synchronously for `function*`, as a promise rejection on the returned `Pending` for `async function*`. Wrap fallible bodies in `Result.try`." The async-rejection case deserves an explicit callout: it is the one place in the library where a `Pending` can hold a rejected promise, and the `Pending` reference page (pending.md L43) already warns that `Pending` does not catch rejections.

**Verifier note.** Reproduced exactly. reference/antithrow/result.md L85-87 says 'Throws — Never. Every static helper either returns Ok, Err, or a Pending whose promise settles to one of the two', while L73 of the same page says thrown exceptions are not caught. Runtime: `sync Result.do THREW: generator body threw`; `async Result.do returned: Pending` then `REJECTED: async generator body threw` — so both halves of the guarantee fail, and the async case yields a Pending holding a rejected promise (pending.md L43-is […truncated, full text in findings.json]

---

### `consumers/rc-2` — `Promise<Pending<T,E>>` is expressible but unfulfillable — `.then` hands you a `Pending`-typed `Ok`

**Severity:** high · **Category:** correctness · **Verifier verdict:** adjusted

**Claim.** Because `Pending` implements `PromiseLike`, TypeScript's async-return checking assimilates it: an `async` function declared `Promise<Pending<T,E>>` accepts a `Pending` return and compiles clean, but the runtime value delivered is a settled `Ok`/`Err`. `await` accidentally papers over this (`Awaited<Pending<T,E>>` = `Settled<T,E>`), but `.then()` does not — the callback parameter is typed `Pending<T,E>` while receiving an `Ok`. Reading `p.promise` (statically `PromiseLike<Settled<T,E>>`) yields `undefined`. Any consumer of `@antithrow/node`/`@antithrow/std` who writes an async wrapper around their `Result`-returning functions can land here.

<details><summary><strong>Empirical evidence</strong></summary>

`bun x tsc --ignoreConfig --noEmit --strict ... /tmp/.../real-consumer/09-promise-pending-unsound.ts` -> `TSC EXIT=0` (the file declares `async function cannot(): Promise<Pending<Buffer,E>> { return readFile("/etc/hosts"); }` and then `cannot().then(p => ({ isP: p.isPending(), prom: p.promise }))`).
Runtime `bun /tmp/.../real-consumer/09b-runtime.ts`:
```
{ isP: false, prom: undefined, ctor: "Ok" }
```
Supporting: `bun /tmp/.../real-consumer/08b-async-runtime.ts`:
```
declared Pending<Buffer,E>, actual runtime ctor: Ok
p.isPending(): false
p.then is function? undefined
loadConfig runtime ctor: Ok isPending: false
```
Also confirmed `Pending` has no `.catch`/`.finally` and is not `instanceof Promise`: `bun -e '...' ` -> `catch: undefined finally: undefined then: function instanceof Promise: false`.

</details>

**Recommendation.** Make the hazard unrepresentable rather than documenting it. Options, in decreasing severity of change: (a) drop `then` from `Pending` and require `await pending.settle()` (kills assimilation entirely; `settle()` already exists and returns the right thing); (b) keep `then` but add a phantom `readonly __notAPromiseValue: unique symbol` on `Pending` so `Promise<Pending<..>>` is structurally unsatisfiable and errors at the declaration site; (c) at minimum, ship a lint rule (`no-promise-of-pending`) alongside `no-unused-result`, and document that `Promise<Pending<..>>`/`Promise<Result<..>>` return annotations silently downgrade to `Settled`.

**Verifier note.** The unsoundness is real and I reproduced it core-only (no @antithrow/node needed): `async function cannot(): Promise<Pending<number,string>> { return op(); }` typechecks (tsc EXIT=0) and `.then(p => ...)` yields `{ isP: false, prom: undefined, ctor: 'Ok' }`. But the claim's scope sentence — 'Any consumer who writes an async wrapper around their Result-returning functions can land here' — overstates it. I checked the two adjacent forms and both are sound: the INFERRED async return type is `Promis […truncated, full text in findings.json]

---

### `consumers/rc-3` — `Result.try`'s `E` is an unchecked cast — every shipped `@antithrow/std` error type is a lie the consumer can trip over

**Severity:** high · **Category:** correctness · **Verifier verdict:** confirmed

**Claim.** `packages/antithrow/src/result.ts:44` does `return new Err(e as E)`. `E` has no inference site and no runtime narrowing, so whatever a wrapper author writes in the return annotation becomes an unverified assertion. All 49 `Result.try` call sites in `@antithrow/std` + `@antithrow/node` do exactly this. The failure is reachable through the shipped public API: `@antithrow/std`'s `JSON.parse` is declared `Settled<T, SyntaxError>` (packages/std/src/json.ts:89) but a throwing reviver — a documented, first-class `JSON.parse` argument the wrapper forwards — puts an arbitrary value in `.error`, including a bare `string`. The docs actively teach this pattern as "narrowing": `apps/docs/docs/how-to/core/wrap-a-throwing-function.md:24` presents `Result.try<unknown, SyntaxError>(...)` under the heading "Supply a type argument to narrow".

<details><summary><strong>Empirical evidence</strong></summary>

`bun /tmp/.../real-consumer/05-e-cast-lie.ts`:
```
parse isErr: true
declared SyntaxError; actual ctor: RangeError
e instanceof SyntaxError: false
e.name: RangeError | SyntaxError-only prop access is unsound
thrown string typed as SyntaxError: string "not an error at all"
r2.error.message is: undefined
stringify declared TypeError; actual: RangeError
decodeURIComponent err ctor: URIError
```
The consuming code compiles clean: `bun x tsc --ignoreConfig --noEmit --strict ... /tmp/.../real-consumer/06-e-lie-typecheck.ts` -> `EXIT=0`, where `msg = r.error.message` is typed `string` and is `undefined` at runtime.
Also hit on the documented tutorial happy path: `bun /tmp/.../real-consumer/12-tutorial04.ts` (verbatim from apps/docs/docs/tutorial/04-go-async.md:15-51) prints `failed: Error Error: Unable to connect...` — a plain `Error`, while `packages/std/src/fetch.ts:20` declares `Result<Response, DOMException | TypeError>`.

</details>

**Recommendation.** Give wrapper authors a way to *earn* `E` instead of asserting it. Add a catch-mapper overload — `Result.try(fn, (cause: unknown) => E)` — and make the bare 2-type-arg form either deprecated or explicitly documented as an assertion (rename the doc section from "Narrowing the error type" to "Asserting the error type"). Ship a `Result.tryInto(fn, guard)` that rethrows on guard failure for authors who want the assertion checked. Separately, `@antithrow/std`/`@antithrow/node` should widen to `E = unknown` (or `Error`) wherever the runtime cannot guarantee the class — `JSON.parse` with a reviver, `fetch` across runtimes.

**Verifier note.** Every element checks out. result.ts:44 is literally `return new Err(e as E);`. std/json.ts declares `parse<T>(...): Settled<T, SyntaxError>` and forwards the reviver. Runtime: declared SyntaxError, actual ctor RangeError; `instanceof SyntaxError: false`; a thrown bare string lands in `.error` typed SyntaxError with `.message === undefined`. The consuming code compiles clean (06-e-lie-typecheck.ts, tsc EXIT=0, `msg = r.error.message` typed string). Docs confirmed: how-to/core/wrap-a-throwing-func […truncated, full text in findings.json]

---

### `consumers/rc-4` — eslint-plugin identifies Result types by *file path substring*, producing destructive autofixes on unrelated user code

**Severity:** high · **Category:** correctness · **Verifier verdict:** confirmed

**Claim.** `packages/eslint-plugin/src/rules/utils/result-type.ts:16-30` decides whether a `ts.Symbol` named `Ok`/`Err`/`Pending` is an antithrow Result by splitting the declaration's file path and looking for a segment literally equal to `"antithrow"` (with no `"legacy"` after it). This is the direct consequence of rc-1 (no nominal brand to test). Two failure modes, both demonstrated: (a) FALSE POSITIVE — any project checked out into a directory named `antithrow` has its own unrelated `class Ok` treated as a Result, and `no-unsafe-unwrap` **autofixes** `o.unwrap()` to `o.value`, turning compiling code into non-compiling code; (b) FALSE NEGATIVE — a library that ships a rolled-up `.d.ts` (api-extractor / dts-bundle-generator / `bun build --dts`) inlines the class declarations into its own `dist`, so the path no longer says `antithrow` and both rules go completely silent. The JSDoc at result-type.ts:112 explicitly promises the opposite: "unrelated types with the same names (e.g. a user-defined `Ok` class ...) are not flagged".

<details><summary><strong>Empirical evidence</strong></summary>

FALSE POSITIVE — project at `/tmp/.../real-consumer/fp/antithrow` with a hand-written `class Ok<T> { #inner; unwrap() }` (no `value` property):
```
--- BEFORE ---
export const n: number = o.unwrap();
(eslint --fix)
--- AFTER --fix ---
export const n: number = o.value;
--- does it still compile? ---
src/fixme.ts(3,28): error TS2339: Property 'value' does not exist on type 'Ok<number>'.
```
Earlier run on the same fixture: `2:1 error This Result must be used ... @antithrow/no-unused-result` and `4:1 error \`unwrap\` on \`Ok\` is unnecessary. Use \`.value\` instead @antithrow/no-unsafe-unwrap`.
FALSE NEGATIVE — `/tmp/.../real-consumer/fn/app` with `node_modules/rolled-lib/dist/index.d.ts` containing inlined `Ok`/`Err`/`Settled` declarations:
```
src/app.ts
  6:1  error  This Result must be used... @antithrow/no-unused-result
✖ 1 problem
```
Lines 4 (`loadThing();` — floating Result) and 5 (`loadThing().unwrap();`) are silently unreported; only line 6 (`new Ok(1)` imported directly from `antithrow`) fires.

</details>

**Recommendation.** Detect by brand, not by path. Once the core carries a `Symbol.for("antithrow.result")` tag (rc-1), the rules can check for that property on the type — correct under pnpm virtual stores, yarn PnP zips, vendored copies, and rolled-up `.d.ts` alike, and immune to directory names. Until then: (1) make the `--fix` on `no-unsafe-unwrap` a *suggestion* rather than an auto-applied fix, since it currently rewrites code the rule may have misidentified; (2) tighten `isAntithrowSourceFile` to also require a `node_modules` segment or an adjacent `package.json` whose `name` is `antithrow`; (3) add a rule option for extra module paths so bundled-dts consumers can opt back in.

**Verifier note.** Source matches verbatim: result-type.ts:16-30 `isAntithrowSourceFile` splits the path and returns true for any segment equal to 'antithrow' without a later 'legacy'; the JSDoc at :112 does promise 'a user-defined Ok class ... are not flagged'. FALSE POSITIVE reproduced end-to-end: in a project at .../fp/antithrow with a hand-written `class Ok<T>` having only `#inner`/`unwrap()`, eslint reports `3:26 error \`unwrap\` on \`Ok\` is unnecessary. Use \`.value\` instead`, `--fix` rewrites to `o.value` […truncated, full text in findings.json]

---

### `consumers/rc-6` — The plugin's own recommended rules produce 228 violations inside the sibling packages, and the plugin is never run on this repo

**Severity:** high · **Category:** consistency · **Verifier verdict:** confirmed

**Claim.** The repo has no `eslint.config.*` at any level and `bun run lint` is `biome check . && knip && <per-package publint + tsc>` — `@antithrow/eslint-plugin` is never executed against the code it exists to police. Running its `recommended` rules over `@antithrow/std`, `@antithrow/node` and `@antithrow/standard-schema` yields 124 `no-unsafe-unwrap` + 2 `no-unused-result` + 104 `no-throwing-call` violations. Crucially, 43 of the `no-throwing-call` hits are in *production* wrapper source, and 42 of those sit on a line inside a `Result.try(...)`/`Result.fromPromise(...)` callback — i.e. the rule fires on exactly the boundary code that is supposed to exist, telling `@antithrow/node/fs/promises/file.ts` that "`readFile` can throw. A non-throwing wrapper is available from `@antithrow/node/fs/promises`". All three rules declare `schema: []` (no-throwing-call.ts:229, no-unused-result.ts:43, no-unsafe-unwrap.ts:65), so there is no allowlist or boundary escape hatch short of `eslint-disable` comments.

<details><summary><strong>Empirical evidence</strong></summary>

`ls /home/user/antithrow/eslint.config.*` -> `No such file or directory`; root `package.json` lint script is `biome check . && bun lint:knip && bun run --workspaces --if-present lint`.
Lint run over copies at `/tmp/.../real-consumer/selfcheck`:
```
by rule: { "@antithrow/no-unsafe-unwrap": 124, "@antithrow/no-unused-result": 2 }
files: 15
non-test files with violations: []
```
```
total no-throwing-call violations: 104 | in production source: 43
node/fs/promises/file.ts
  107: `readFile` can throw. A non-throwing wrapper is available from `@antithrow/node/fs/promises`.
std/json.ts
  90: `JSON.parse` can throw. A non-throwing wrapper is available from `@antithrow/std`.
... (43 total)
prod violations on a Result.try/fromPromise line: 41
NOT on such a line: 2
  std/json.ts:47 | globalThis.JSON.stringify(...)          <- multi-line Result.try
  std/structured-clone.ts:30 | return new Ok(globalThis.structuredClone(value, options));  <- the rc-5 hand-roll
```

</details>

**Recommendation.** (1) Add an eslint config to the monorepo and wire `@antithrow/eslint-plugin` into `bun run lint` — this is the single highest-leverage change, since every finding below would have surfaced at authoring time. (2) Teach `no-throwing-call` to skip calls whose nearest enclosing function expression is the sole argument to `Result.try`/`Result.fromPromise`; that removes 42/43 production false alarms with no config. (3) Give all three rules an options schema (`allow: string[]`, `allowInResultTry: boolean`). (4) Address the 124 `no-unsafe-unwrap` hits via rc-7 rather than blanket-disabling the rule in tests.

**Verifier note.** Numbers reproduce to the digit. `ls /home/user/antithrow/eslint.config.*` -> No such file or directory; root lint script is `biome check . && bun lint:knip && bun run --workspaces --if-present lint`. Running the plugin over copies of std/node/standard-schema: `{ '@antithrow/no-unsafe-unwrap': 124, '@antithrow/no-unused-result': 2 }` across 15 files, zero non-test files; separately `no-throwing-call` total 104, 43 in production source, including the self-referential `std/json.ts` telling itself t […truncated, full text in findings.json]

---

### `consumers/rc-8` — `@antithrow/std`'s `JSON.stringify` precision overload is wrong in both slots — the core gives no way to check it

**Severity:** high · **Category:** correctness · **Verifier verdict:** confirmed

**Claim.** `packages/std/src/json.ts:31-35` declares `stringify(value: undefined|symbol|Function, replacer?, space?): Ok<undefined, never>`. Both halves are false when a `replacer` is supplied — which the same overload accepts. `JSON.stringify(undefined, () => 42)` returns the string `"42"` (typed `undefined`), and a throwing replacer produces an `Err` from a type with no `Err` arm and `E = never`. This is a shipped bug, and it is the natural consequence of the core making `Ok`/`Err`/`Settled`/`Pending` and `E` all pure *assertions* (rc-3, rc-5): wrapper authors reach for precision and the type system never checks them.

<details><summary><strong>Empirical evidence</strong></summary>

`bun /tmp/.../real-consumer/15-stringify-overload.ts`:
```
declared Ok<undefined, never> | actual ctor: Ok value: 42
declared Ok<undefined, never> | actual ctor: Err error: TypeError: replacer threw
b.isOk() says: false  but the static type has no Err arm
statically `undefined`, actually: "42"
```
And the lying access compiles: `bun x tsc --ignoreConfig --noEmit --strict ... /tmp/.../real-consumer/15-stringify-overload.ts` -> `EXIT=0` (including `const v: undefined = a.value;`). `bun x tsc --noEmit -p tsconfig.json` in `packages/std` also exits 0, so the package's own `lint:types` does not catch it.

</details>

**Recommendation.** Split the overload so the `Ok<undefined, never>` claim only applies when no `replacer` is passed: `stringify(value: NonSerializableTopLevel): Ok<undefined, never>` and `stringify(value: NonSerializableTopLevel, replacer: JsonStringifyReplacer, space?): Settled<string|undefined, TypeError>`. More generally, this is an argument for the core exposing verified constructors (rc-3's `Result.try(fn, mapErr)` and rc-5's `trySync`) so that `Settled`/`never` are derived, not asserted.

**Verifier note.** std/src/json.ts:31-35 does declare `stringify(value: NonSerializableTopLevel, replacer?: JsonStringifyReplacer, space?): Ok<undefined, never>` — the same overload accepts a replacer. Runtime: `SafeJSON.stringify(undefined, () => 42)` -> Ok with value 42 (declared `undefined`); with a throwing replacer -> Err (`b.isOk()` false) from a type whose only arm is Ok and whose E is `never`. The lying read `const v: undefined = a.value` compiles (tsc EXIT=0). Both halves of the declaration are false, exa […truncated, full text in findings.json]

---

### `errors-exceptions/ep-1` — The documented "errors thrown by fn are not caught" contract has opposite semantics on the sync vs Pending path; unwrapOr(default) rejects instead of returning the default

**Severity:** high · **Category:** correctness · **Verifier verdict:** adjusted

**Claim.** base.ts tags map/mapErr/mapOr/mapOrElse/andThen/orElse/unwrapOrElse with a single `@throws Errors thrown by `fn` are not caught.` But "not caught" means two incompatible things. On Ok/Err the exception propagates synchronously out of the call site, so a try/catch around the expression sees it. On Pending the callback runs inside `this.promise.then(...)`, so the exception becomes a REJECTION stored inside a value whose type is `PromiseLike<Settled<T,E>>`. Every downstream method then silently lies: `unwrapOr(0)` is typed `PromiseLike<number>` and is documented as "otherwise returns the provided default value", but it rejects rather than producing 0. Same for `settle(): PromiseLike<Settled<T,E>>`, `mapOr`, `mapOrElse`, `unwrapOrElse`, and `andThen`/`orElse`/`mapErr` chains. A try/catch placed around the `.map()` call catches nothing.

<details><summary><strong>Empirical evidence</strong></summary>

`bun /tmp/.../exception-posture/01-throw-divergence.ts` printed:
```
=== A. SYNC path: Ok.map(boom) ===
  THREW SYNCHRONOUSLY at call site: BOOM
=== B. SYNC path: Ok(1).map(boom).unwrapOr(0) ===
  THREW SYNCHRONOUSLY: BOOM
=== C. PENDING path: p.map(boom) ... ===
  .map(boom) returned normally: Pending
=== D. PENDING path: unwrapOr(0) ... ===
  *** REJECTED with: BOOM -- unwrapOr(default) did NOT return the default
  *** andThen->unwrapOr REJECTED: BOOM-andThen
  *** mapErr->unwrapOr REJECTED: BOOM-mapErr
  *** orElse->unwrapOr REJECTED: BOOM-orElse
  *** mapOrElse REJECTED: BOOM-mapOrElse
  *** unwrapOrElse REJECTED: BOOM-unwrapOrElse
  *** poisoned.settle() REJECTED: BOOM-async -- settle() type is PromiseLike<Settled<T,E>>
```
`node /tmp/.../08-final.mjs` confirmed the call site is uncatchable:
```
  sync path: caught at call site -> sync
  pending path: try/catch around .map() caught NOTHING; got Pending
```
tsc (EXIT=0) confirms the types make no distinction — 06-typecheck.ts asserts `Equal<typeof mapped.unwrapOr(0), PromiseLike<number>>`, `Equal<typeof mapped.settle(), PromiseLike<Settled<number,string>>>`, and that a poisoned Pending is assignment-compatible with a healthy one (`const same: typeof healthy = poisoned;` compiles).

</details>

**Recommendation.** Make the two paths agree. Preferred (breaking): catch on BOTH paths and convert a thrown callback error into `Err`, widening E to `E | unknown` (this is what a library named "antithrow" should do, and matches Result.try's own behavior). If the no-catch stance is kept for principled reasons, then Pending must not silently defer it: have Pending's derived promises catch, mark the Pending as faulted, and re-throw synchronously at every observation point (`settle`, `unwrapOr`, `then`) so the sync and async paths at least fail the same way. At minimum, split the `@throws` JSDoc into two sentences that state the Pending behavior explicitly, and add an eslint rule flagging a possibly-throwing callback passed to a Pending method.

**Verifier note.** Facts fully reproduced. `bun 01-throw-divergence.ts` gave exactly the quoted output: Ok(1).map(boom) throws at the call site; the same callback on a Pending returns normally and every downstream observation (unwrapOr(0), settle(), mapOr/mapOrElse/unwrapOrElse, andThen/mapErr/orElse chains) rejects. `node 08-final.mjs` confirms try/catch around .map() catches nothing on the Pending path. tsc (EXIT=0 with --ignoreConfig) confirms `mapped.unwrapOr(0): PromiseLike<number>`, `settle(): PromiseLike<Se […truncated, full text in findings.json]

---

### `errors-exceptions/ep-2` — A dropped poisoned Pending crashes the Node process (exit 1); the library's own methods violate Pending's documented "must always resolve" invariant

**Severity:** high · **Category:** correctness · **Verifier verdict:** confirmed

**Claim.** apps/docs/docs/reference/antithrow/pending.md:43 documents the constructor argument as "The underlying promise. Must always resolve; rejections are not caught by `Pending` itself." Yet Pending.map/mapErr/andThen/orElse/flatten and Ok.map/Err.mapErr all manufacture Pendings whose inner promise rejects, breaking that invariant from inside the library. Because Pending is a value you are encouraged to inspect synchronously (`isOk()`/`isErr()`/`isPending()`), a natural code path drops it without ever awaiting — which under Node's default unhandledRejection policy terminates the process. This is the exact failure mode the library exists to prevent.

<details><summary><strong>Empirical evidence</strong></summary>

`node /tmp/.../exception-posture/07-node-crash.mjs` (a 5-line program: `new Ok(1).map(async v => { throw ... })`, then `if (pipeline.isErr())`, then a setTimeout) printed a bare stack and died:
```
Error: validation failed
    at .../07-node-crash.mjs:3:66
    at Ok.map (file:///home/user/antithrow/packages/antithrow/dist/ok.js:31:24)
Node.js v22.22.2
NODE EXIT=1
```
"REACHED END OF PROGRAM" never printed. Under bun (`bun /tmp/.../02-do-and-unhandled.ts`) the same shapes fire the listener rather than exiting:
```
=== J. Unhandled rejection: dropped poisoned Pending ===
  !! unhandledRejection: DROPPED-map
  !! unhandledRejection: DROPPED-mapErr
```
Both `Ok.map(async fn)` and `Err.mapErr(async fn)` are affected. Note the second one is especially sharp: `Err.mapErr(async ...)` returns a Pending, so `dropped2.isErr()` is `false` and the user's Err branch never runs — the Result silently disappears and the process is left holding an unhandled rejection.

</details>

**Recommendation.** Never let a library-constructed Pending hold an unhandled rejection. Attach a no-op rejection handler to every derived promise at construction time and store the fault in a field, re-surfacing it only when the Pending is actually observed. That alone removes the process-crash class of bug without changing the "not caught" stance. Also verified harmless and worth keeping as-is: `Ok.settle()`/`Err.settle()` allocate a fresh already-resolved `Promise.resolve(this)` per call, which produces no unhandled rejections when dropped (section K of 02-do-and-unhandled.ts printed an empty event list).

**Verifier note.** Reproduced verbatim. `node 07-node-crash.mjs` printed the bare `Error: validation failed` stack with the `at Ok.map (.../dist/ok.js:31:24)` frame and exited 1; "REACHED END OF PROGRAM" never printed. Under bun, `02-do-and-unhandled.ts` fired `unhandledRejection: DROPPED-map` and `unhandledRejection: DROPPED-mapErr`, and section K confirmed dropped Ok/Err `.settle()` calls add no events (`["DROPPED-map","DROPPED-mapErr"]` only). The documented invariant is quoted exactly — apps/docs/docs/referenc […truncated, full text in findings.json]

---

### `errors-exceptions/ep-3` — Tutorial states "antithrow never rejects the underlying promise" — directly false, and contradicted by the library's own reference docs

**Severity:** high · **Category:** docs · **Verifier verdict:** confirmed

**Claim.** apps/docs/docs/tutorial/04-go-async.md:63 says: "`Pending<T, E>` looks and acts like a promise: you can `await` it. The difference is that antithrow never rejects the underlying promise. ... That is why this whole pipeline needed no `try`/`catch`." This is the central pitch of the async tutorial and it is false. The underlying promise rejects whenever a callback throws or returns a rejecting promise, and the library's own reference page (apps/docs/docs/reference/antithrow/unwrap-error.md:36) already admits `pending.unwrap()` "rejects the returned promise with UnwrapError". A reader who believes the tutorial will omit exactly the try/catch that ep-2 shows is load-bearing.

<details><summary><strong>Empirical evidence</strong></summary>

Contradiction demonstrated by `bun /tmp/.../01-throw-divergence.ts` section F:
```
=== F. Ok.map(async fn that rejects) -> Pending wrapping rejected promise ===
  got: Pending isPending: true
  *** poisoned.settle() REJECTED: BOOM-async -- settle() type is PromiseLike<Settled<T,E>>
  *** poisoned.unwrap Or(0) REJECTED: BOOM-async
```
and by `node /tmp/.../03-unwraperror.ts` section O, where `pending.unwrap()` rejects with an UnwrapError. The two doc pages disagree with each other: tutorial/04-go-async.md:63 "never rejects" vs reference/antithrow/unwrap-error.md:36 "rejects the returned promise with UnwrapError".

</details>

**Recommendation.** Rewrite that paragraph to: "antithrow never rejects the underlying promise *for failures it models* — a network failure produces Err(TypeError). It does still reject if one of your callbacks throws, or if you call unwrap() on the wrong branch." Add a dedicated docs page "When antithrow still throws" enumerating the three cases (throwing callback on the sync path, throwing callback on the Pending path, unwrap/unwrapErr) and linking it from the tutorial.

**Verifier note.** Quote is verbatim at apps/docs/docs/tutorial/04-go-async.md:63: "The difference is that antithrow never rejects the underlying promise. ... That is why this whole pipeline needed no `try` / `catch`." Falsified by section F of 01-throw-divergence.ts (`Ok.map(async () => { throw })` → `poisoned.settle() REJECTED: BOOM-async`, `poisoned.unwrapOr(0) REJECTED: BOOM-async`) and by section O of 03-unwraperror.ts (`pending.unwrap()` rejects with `instanceof UnwrapError: true`). The cited internal contra […truncated, full text in findings.json]

---

### `packaging/pkg-1` — exports map omits "require"/"default": require() of the package is impossible, yet TypeScript (nodenext) type-checks it clean — a silent compile-time lie

**Severity:** high · **Category:** packaging · **Verifier verdict:** adjusted

**Claim.** `exports` declares only `types` + `import` for both `.` and `./legacy`. Because the `types` condition matches first, tsc 6.0.3 under `module: nodenext` (and `node20`) resolves a CJS consumer's `import { Ok } from "antithrow"` with ZERO diagnostics and emits `require("antithrow")` — which Node 22 then rejects at runtime with ERR_PACKAGE_PATH_NOT_EXPORTED. This is not an inherent ESM-only limitation: Node 22 can require() this exact ESM file; the failure is purely the missing condition. Notably `module: node16` DOES catch it (TS1479), so the modern, recommended setting is the one that silently lies.

<details><summary><strong>Empirical evidence</strong></summary>

cd /tmp/.../scratchpad/packaging/cjs-ts && /home/user/antithrow/node_modules/.bin/tsc -p tsconfig.json  (module: nodenext, package type=commonjs)
  → "tsc exit code = 0", tsc output 0 bytes (verified: `wc -c < tsc-nodenext.log` = 0; tsc --version = 6.0.3)
Emitted out-nodenext/app.js:
  const antithrow_1 = require("antithrow");
  console.log(new antithrow_1.Ok(1).unwrap());
node out-nodenext/app.js →
  Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: No "exports" main defined in .../node_modules/antithrow/package.json
      at exportsNotFound (node:internal/modules/esm/resolve:314:10)
Same with module: node20 (tsc silent, node crashes). With module: node16 tsc DOES report:
  app.ts(1,20): error TS1479: The current file is a CommonJS module whose imports will produce 'require' calls; however, the referenced file is an ECMAScript module...
Direct runtime probes (node v22.22.2 / bun 1.3.11):
  node require-bare.cjs  → FAIL require('antithrow'): ERR_PACKAGE_PATH_NOT_EXPORTED | No "exports" main defined ...
  node require-legacy.cjs→ FAIL require('antithrow/legacy'): ERR_PACKAGE_PATH_NOT_EXPORTED | Package subpath './legacy' is not defined by "exports"
  bun require-bare.cjs   → FAIL: MODULE_NOT_FOUND | Cannot find package 'antithrow'
  node require-dist.cjs (absolute path, bypassing exports) → OK -> [ 'Err','Ok','Pending','Result','UnwrapError' ]   <-- Node 22 CAN require this ESM
  node dynimport.cjs     → OK dynamic import('antithrow') and ('antithrow/legacy')
ISOLATION EXPERIMENT — same dist, package.json with `"default": "./dist/index.js"` added:
  cd /tmp/.../scratchpad/packaging/patched && node t.cjs →
    require('antithrow') with default condition -> [ 'Err','Ok','Pending','Result','UnwrapError' ]
    new Ok(42).unwrap() = 42
    require('antithrow/legacy') -> [ 'Err','Ok','Result','ResultAsync','chain','err','errAsync','ok','okAsync' ]
  (identical under bun.)
attw on the packed tarball: "node16 (from CJS): ⚠️ ESM (dynamic import only)" for both entries — and even that understates it, since real `require` fails at *resolution*, not at ESM-ness.

</details>

**Recommendation.** Add a `"default"` condition (last) to every exports entry — one line per subpath, no build change, and it immediately unblocks Node 22 require(esm), Jest, and every strict resolver, as the patched experiment proves. If pre-22 Node CJS matters, ship a real dual build with a `"require": "./dist/index.cjs"` condition instead. Either way, add `arethetypeswrong` to the `lint` script — publint alone does not catch this class of bug (see pkg-14).

**Verifier note.** Every fact reproduces on my machine (node v22.22.2, tsc 6.0.3): `tsc --module nodenext` on the CJS consumer exits 0 and emits `require("antithrow")`; running it gives ERR_PACKAGE_PATH_NOT_EXPORTED 'No "exports" main defined'; `--module node16` gives TS1479 and `--module node20` exits 0; require of the absolute dist path succeeds (Node 22 really can require this ESM); the `default`-patched copy requires cleanly and `new Ok(42).unwrap()` = 42. The stated mechanism (the `types` condition satisfies  […truncated, full text in findings.json]

---

### `packaging/pkg-3` — Five public methods return types that no consumer can name — `declaration: true` library authors are hard-blocked (TS2883)

**Severity:** high · **Category:** types · **Verifier verdict:** confirmed

**Claim.** `Ok.flatten`, `Err.flatten`, `Pending.flatten`, `mapOr` and `mapOrElse` are declared in the shipped .d.ts in terms of `FlattenOk`, `FlattenErr`, `FlattenPending`, `SyncOrAsync` and `FlattenThenable` — all exported from dist/types.js but NONE re-exported from the package root (src/index.ts re-exports only `InferErr`, `InferOk`, `Settled`). The exports map also blocks the deep path. So any downstream library that wraps one of these methods generically and emits declarations gets TS2883 and has literally no legal way to write the required annotation short of copy-pasting the conditional type into their own codebase.

<details><summary><strong>Empirical evidence</strong></summary>

cd /tmp/.../scratchpad/packaging/esm-ts && tsc -p tsconfig.dts.json   (declaration:true, emitDeclarationOnly, module nodenext)
lib.ts:
  export function a<T,E>(r: Ok<T,E>)  { return r.flatten(); }
  export function b<T,E>(r: Err<T,E>) { return r.flatten(); }
  export function c<T,E>(r: Pending<T,E>) { return r.flatten(); }
  export function d<T,E,U>(r: Ok<T,E>, f:(v:T)=>U) { return r.mapOr(undefined as U, f); }
  export function e<T,E,U>(r: Ok<T,E>, f:(v:T)=>U) { return r.mapOrElse(()=>undefined as U, f); }
Output (tsc exit=1):
  lib.ts(3,17): error TS2883: The inferred type of 'a' cannot be named without a reference to 'FlattenOk' from './node_modules/antithrow/dist/types.js'. This is likely not portable. A type annotation is necessary.
  lib.ts(4,17): error TS2883: ... 'FlattenErr' ...
  lib.ts(5,17): error TS2883: ... 'FlattenPending' ...
  lib.ts(6,17): error TS2883: ... 'SyncOrAsync' ...
  lib.ts(7,17): error TS2883: ... 'FlattenThenable' ...
And the escape hatches are all closed — scratchpad/esm-ts/names.ts compiles with tsc exit=0, meaning EVERY one of these @ts-expect-error markers fired (i.e. each import is an error):
  import type { FlattenOk } from "antithrow";                 // error
  import type { FlattenOk as F2 } from "antithrow/dist/types.js"; // error (blocked by exports map)
  import type { SyncOrAsync } from "antithrow";               // error
  import type { NonThenable } from "antithrow";               // error
  import type { FlattenThenable } from "antithrow";           // error
  import type { SameResolved } from "antithrow";              // error
  import type { ResultBase } from "antithrow";                // error
(The exported three do work: InferOk / InferErr / Settled all resolve.)

</details>

**Recommendation.** Re-export the type names that appear in public signatures from src/index.ts: `FlattenOk`, `FlattenErr`, `FlattenPending`, `SyncOrAsync`, `FlattenThenable`, `NonThenable`, `SameResolved`, and `ResultBase`. A published API cannot reference names its consumers are forbidden from importing. If some of these are genuinely private, change the signatures so they do not appear in the .d.ts (e.g. inline the conditional or widen to `Result<...>`). A cheap CI guard: run `tsc --declaration` over a fixture that generically wraps every public method and require exit 0.

**Verifier note.** Reproduced verbatim: tsconfig.dts.json emits exactly five TS2883 errors for FlattenOk / FlattenErr / FlattenPending / SyncOrAsync / FlattenThenable, exit 1. Source confirms the setup — dist/types.d.ts exports all of them, src/index.ts re-exports only InferErr, InferOk, Settled, and the exports map has no ./dist/* subpath, so the deep import is blocked too. names.ts is a valid probe (it compiles at exit 0, meaning every @ts-expect-error fired, i.e. all seven internal names are unimportable while  […truncated, full text in findings.json]

---

### `legacy-migration/lm-1` — Mechanical `match({ok,err})` → `mapOrElse(errFn, okFn)` migration silently produces wrong output

**Severity:** high · **Category:** correctness · **Verifier verdict:** adjusted

**Claim.** `match` was removed in 3.0.0. Its only replacement, `mapOrElse`, takes the error handler FIRST and the value handler SECOND — the reverse of the `{ ok, err }` object literal's reading order. Because both handlers frequently accept each other's input type (formatting/logging handlers, `String(x)`, template literals, zero-arg fallbacks), a migration that keeps the source order type-checks cleanly and returns the WRONG branch's output at runtime. Nothing in the CHANGELOG, README, or docs warns about the order reversal — `match` is never mentioned as removed at all.

<details><summary><strong>Empirical evidence</strong></summary>

`bun /tmp/.../legacy-migration/21-swap-trap.ts`:
```
legacy match  -> err boom
mapOrElse with handlers in the legacy order -> ok boom   <-- WRONG, and it compiles
mapOrElse with handlers reversed            -> err boom   <-- correct
```
The swapped call has no type error. `bun x tsc ... 21b-swap-types.ts` → `SWAP TYPECHECK EXIT=0 (0 = the swapped call compiles clean)`, for both `s.mapOrElse((v) => \`ok ${v}\`, (e) => \`err ${e}\`)` and `s.mapOrElse(() => "fallback", () => "fallback")`. `match` is confirmed removed by 01-matrix.ts: `DROPPED instance methods (legacy Result -> core): ["expect","expectErr","inspect","inspectErr","isErrAnd","isOkAnd","match","toAsync"]`.

</details>

**Recommendation.** Either (a) restore `match(handlers: { ok, err })` on `ResultBase` — it is self-documenting, order-independent, and the single most-used escape from Result-land; or (b) rename the current method to `matchOrElse`/`fold` and give `mapOrElse` a `{ ok, err }` object form. At minimum, add a prominent "argument order is reversed vs legacy `match`" note to the `mapOrElse` JSDoc in base.ts, ok.ts, err.ts, and pending.ts, and add a codemod/lint rule. A migration guide entry alone is not sufficient here because the failure is silent.

**Verifier note.** Facts reproduce exactly. `bun 21-swap-trap.ts` prints `mapOrElse with handlers in the legacy order -> ok boom` for an `Err`, and `21b-swap-types.ts` type-checks at EXIT=0 for both the template-literal and zero-arg handler pairs. `match` is confirmed gone from the core protos (01-matrix.ts) and legacy/result.ts:296 still has `match<U>(handlers: {ok, err})`. Severity is over-rated as critical: critical in this rubric means the package is unsound or silently wrong, and it is not — `mapOrElse(defaul […truncated, full text in findings.json]

---

### `legacy-migration/lm-2` — `ResultAsync.fromPromise` → `Result.fromPromise` is a same-name/different-contract trap that silently double-wraps

**Severity:** high · **Category:** correctness · **Verifier verdict:** adjusted

**Claim.** Both generations export a `fromPromise` on their respective `Result`-ish namespace, but the contracts are inverted. Legacy `ResultAsync.fromPromise(p: Promise<Result<T,E>>)` takes a promise OF A RESULT and does not catch rejections. Core `Result.fromPromise(p: PromiseLike<T>)` takes a promise of a VALUE and converts rejection to `Err`. A migrating user who rewrites `ResultAsync.fromPromise(x)` → `Result.fromPromise(x)` gets `Pending<Ok<T,E>, unknown>` — a Result inside a Result — with NO type error and no cast, because `T` happily infers as `Ok<number, string>`. `.unwrap()` then hands back an `Ok` object instead of the value.

<details><summary><strong>Empirical evidence</strong></summary>

`bun /tmp/.../legacy-migration/09-frompromise-trap.ts`:
```
=== legacy ResultAsync.fromPromise: takes Promise<Result<T,E>> ===
  await unwrap() -> 1 (typeof number )
=== naive find/replace to core Result.fromPromise ===
  await unwrap() -> Ok { value: 1, ... } | constructor: Ok
  DOUBLE-WRAPPED?  true
  settle() gives: Ok containing Ok
=== rejection handling contract flipped ===
  legacy fromPromise: REJECTS -> boom
  core   fromPromise: settles to Err -> boom
```
Type-level confirmation, `bun x tsc ... 10-frompromise-types.ts` → `EXIT=0`, asserting `Equal<typeof Result.fromPromise(Promise.resolve(new Ok<number,string>(1))), Pending<Ok<number, string>, unknown>>` and `Equal<Awaited<ReturnType<typeof migrated.unwrap>>, Ok<number, string>>`.

</details>

**Recommendation.** Reject already-Result inputs at the type level: constrain the parameter, e.g. `fromPromise<T, E>(promise: PromiseLike<T extends Ok<any,any> | Err<any,any> | Pending<any,any> ? never : T>): Pending<T, E>`, with an error message pointing at `new Pending(...)` for the promise-of-Result case. Alternatively rename core's helper to `Result.fromRejectable`/`Result.wrapPromise` so the find/replace cannot collide, and export an explicit `Result.fromSettledPromise(p: PromiseLike<Settled<T,E>>)` for the legacy shape.

**Verifier note.** The contract inversion is real and reproduces: legacy `ResultAsync.fromPromise(promise: Promise<Result<T,E>>)` (legacy/result-async.ts:454, JSDoc explicitly 'does not catch promise rejections') vs core `fromPromise<T,E>(promise: PromiseLike<T>)` which maps resolve→Ok / reject→Err (result.ts:23-30). `09-frompromise-trap.ts` reproduces the double wrap (`DOUBLE-WRAPPED? true`, `settle() gives: Ok containing Ok`) and `10-frompromise-types.ts` compiles at EXIT=0 asserting `Pending<Ok<number,string>,  […truncated, full text in findings.json]

---

### `legacy-migration/lm-5` — `antithrow/legacy` is a dead end: the ecosystem packages and the ESLint plugin no longer speak legacy

**Severity:** high · **Category:** packaging · **Verifier verdict:** confirmed

**Claim.** The CHANGELOG offers "temporarily switch imports to `antithrow/legacy`" as the escape hatch, but it does not work for anyone using the rest of the ecosystem. `@antithrow/std` 2.0.0, `@antithrow/node` 1.0.0 and `@antithrow/standard-schema` 2.0.0 were all migrated to the core `Result`/`Settled` types, and core results are structurally incompatible with legacy `Result`/`chain`. Separately, `@antithrow/eslint-plugin` 2.0.0 deliberately excludes anything declared under an `antithrow/.../legacy` path, so files kept on the legacy API silently lose all `no-unused-result` / `no-unsafe-unwrap` protection — exactly the files most at risk during a migration. Neither consequence is documented, and no minimum-pinned versions of the sibling packages are given.

<details><summary><strong>Empirical evidence</strong></summary>

`bun x tsc -p tsconfig.json` in docsrepro with ecosystem.ts (imports `antithrow/legacy` + `@antithrow/std`) → `EXIT=0`, meaning all three `@ts-expect-error` markers fired: a core `Settled` cannot be `yield*`'d into legacy `chain()`, cannot be assigned to legacy `Result<unknown, SyntaxError>`, and `parsed.andThen(() => ok(1))` is rejected. Package versions from package.json: std 2.0.0, node 1.0.0, standard-schema 2.0.0; std/CHANGELOG.md 2.0.0 = "deps!: use modern `Result`/`Settled` APIs instead of `Result`/`ResultAsync`", and `grep -rn 'from "antithrow' packages/std/src` shows `import type { Settled } from "antithrow"`. ESLint exclusion at packages/eslint-plugin/src/rules/utils/result-type.ts:24 `if (!pathSegments.slice(index + 1).includes("legacy")) { return true; }`, asserted by its own passing tests (`bun test packages/eslint-plugin/src/rules/no-unused-result.test.ts packages/eslint-plugin/src/rules/no-unsafe-unwrap.test.ts` → `74 pass 0 fail`) whose valid cases are `import { ok } from "antithrow/legacy";\nok(1).unwrap();` and `import { ok } from "antithrow/legacy";\nok(1);`.

</details>

**Recommendation.** State the constraint explicitly in the 3.0.0 notes and README: legacy users must pin `@antithrow/std@1`, `@antithrow/node@0.x`, `@antithrow/standard-schema@1` and `@antithrow/eslint-plugin@1`. Better, publish a `antithrow/legacy` bridge (`toModern()` / `fromModern()` adapters, or make legacy `Ok`/`Err` structurally satisfy the core `Result` by adding `isPending()`/`settle()`) so a codebase can migrate module-by-module instead of all at once. Also consider making the ESLint plugin flag legacy imports with a dedicated `no-legacy-import` rule rather than silently ignoring them.

**Verifier note.** All three legs check out. docsrepro/ecosystem.ts compiles at EXIT=0 with all three `@ts-expect-error` markers firing, i.e. a core `Settled` from `@antithrow/std` genuinely cannot be `yield*`'d into legacy `chain()`, cannot be assigned to legacy `Result<unknown, SyntaxError>`, and cannot `andThen(() => ok(1))`. Versions confirmed: std 2.0.0, node 1.0.0, standard-schema 2.0.0, eslint-plugin 2.0.0; `packages/std/src/{uri,structured-clone}.ts` import `Settled` from "antithrow" (root). The ESLint exc […truncated, full text in findings.json]

---

### `legacy-migration/lm-6` — `Result.all`/`ResultAsync.all` were dropped with no replacement; the suggested `Result.do` path serializes concurrent work

**Severity:** high · **Category:** missing-capability · **Verifier verdict:** confirmed

**Claim.** `all` is the only static removed in the redesign and it has no successor anywhere in the new API or in `@antithrow/std`. The docs' "Combine results" how-to covers only `andThen`/`and`/`or`/`flatten` and never mentions the loss. The natural substitute — `Result.do` with successive `yield*` — is sequential, so migrating an `ResultAsync.all([...])` call site to `Result.do` turns concurrent I/O into serial I/O with no compiler or lint signal. Rebuilding concurrent combine by hand requires reaching for `Promise.all` + `.settle()` + a manual `isErr()` scan, i.e. dropping out of the Result abstraction entirely.

<details><summary><strong>Empirical evidence</strong></summary>

01-matrix.ts: `DROPPED statics: ["all"]`, `new Result namespace keys: ["try","fromPromise","do"]`, `new has 'all'? false`. Wall-clock, `bun /tmp/.../legacy-migration/03-all-migration.ts` (three 100 ms tasks):
```
legacy ResultAsync.all -> ["a","b","c"] elapsed ~ 102 ms (CONCURRENT)
new Result.do        -> ["a","b","c"] elapsed ~ 304 ms (SEQUENTIAL)
new hand-rolled      -> ["a","b","c"] elapsed ~ 101 ms (CONCURRENT, 5 LOC by hand)
hand-rolled err case -> Err(bad)
```
Type-level: `bun x tsc ... 05-interop-types.ts` → EXIT=0 with `// @ts-expect-error Property 'all' does not exist on the core Result namespace` over `Result.all([new Ok(1), new Ok(2)])`. The hand-rolled `combine` helper is type-checked in 19-cookbook.ts (EXIT=0).

</details>

**Recommendation.** Ship `Result.all(results)` in the core namespace returning `Settled<OkTuple<T>, ErrUnion<T>>` when every input is settled and `Pending<...>` when any input is `Pending` (the tri-state model makes this cleaner than legacy's two `all`s — see lm-14). Consider `Result.allSettled` too. Until then, add the concurrent-combine recipe to `docs/how-to/core/combine-results.md` with an explicit warning that `Result.do` is sequential.

**Verifier note.** 01-matrix.ts reproduces: `DROPPED statics: ["all"]`, core `Result` namespace is exactly {try, fromPromise, do} (result.ts:115-119), `new has 'all'? false`; no `all` in @antithrow/std either. 03-all-migration.ts reproduces the timing on this machine: legacy `ResultAsync.all` ~101 ms, `Result.do` ~305 ms, hand-rolled Promise.all+settle ~101 ms for three 100 ms tasks. 05-interop-types.ts compiles at EXIT=0 with the `@ts-expect-error` over `Result.all([...])` firing, and docs/how-to/core/combine-res […truncated, full text in findings.json]

---

### `legacy-migration/lm-7` — Values that merely have a `then` method can no longer be carried in a Result; core silently converts them into a permanently broken `Pending`

**Severity:** high · **Category:** correctness · **Verifier verdict:** confirmed

**Claim.** Legacy `map`/`Result.try` stored whatever the callback returned. Core's auto-upgrade uses a structural `isThenable` check (`utils.ts`), so any domain object with a `then` method — Knex/Prisma-style query builders, jQuery Deferreds, custom lazy tasks — is treated as a promise. If the object is not Promises/A+ compliant (its `then` returns `undefined` instead of a thenable), `new Pending(result.then(...))` is constructed with `promise === undefined`, and every subsequent operation throws a raw `TypeError` — not an `Err`, not a rejection. There is no way to opt out and no mention of the restriction in the docs or the 3.0.0 notes.

<details><summary><strong>Empirical evidence</strong></summary>

`bun /tmp/.../legacy-migration/11b-thenable.ts` with `class LazyTask { then(_cb) {} }`:
```
legacy ok(task).map(t=>t)      -> Ok | holds LazyTask: true
legacy Result.try(()=>task)    -> Ok
core  new Ok(1).map(()=>task)  -> Pending
  internal promise is: undefined
  isPending(): true
  settle().then() -> TypeError: undefined is not an object (evaluating 'c.settle().then')
  await result   -> TypeError: undefined is not an object (evaluating 'this.promise.then')
  unwrap()       -> TypeError: undefined is not an object (evaluating 'this.promise.then')
```

</details>

**Recommendation.** At minimum, harden `Ok.map`/`Err.mapErr`/`resultTry` so a non-conforming thenable cannot produce a `Pending` with an undefined promise — wrap with `Promise.resolve(value)` rather than calling `value.then` directly, which normalizes any thenable and makes the failure an `Err`/rejection instead of a `TypeError`. Then document the restriction ("a `Result` cannot hold a thenable value") in the `map` and `Result.try` JSDoc and in the migration guide, and consider an explicit escape hatch such as `Ok.of(value)` / `map.raw(fn)` that skips the thenable check for users porting legacy code that stored thenables.

**Verifier note.** Reproduced verbatim via 11b-thenable.ts: `new Ok(1).map(() => lazyTask)` yields a `Pending` whose `promise` is `undefined`, and `settle()`, `await`, and `unwrap()` all throw raw `TypeError: undefined is not an object (evaluating 'this.promise.then')`. Root cause confirmed in source: utils.ts `isThenable` is a purely structural `typeof value.then === 'function'` check, and ok.ts:49 / err.ts:46 / result.ts:25 call `result.then(...)` directly and hand the return value to `new Pending(...)` without  […truncated, full text in findings.json]

---

### `legacy-migration/lm-8` — No migration guide exists anywhere, and eight instance methods were removed without a documented replacement

**Severity:** high · **Category:** docs · **Verifier verdict:** confirmed

**Claim.** The entire legacy→core migration story is four bullets in packages/antithrow/CHANGELOG.md. There is no migration guide in the README, in `apps/docs/docs/` (the only page matching *migrat* is `how-to/core/migrate-from-throwing-code.md`, which is about try/catch, not about v2), or in the legacy docs section. The CHANGELOG lists only the entrypoint/`chain` changes and never mentions that eight instance methods and one static disappeared: `match`, `inspect`, `inspectErr`, `isOkAnd`, `isErrAnd`, `expect`, `expectErr`, `toAsync`, and `Result.all`. Several replacements are non-obvious, lossy, or absent, and one is actively dangerous (lm-1).

<details><summary><strong>Empirical evidence</strong></summary>

`bun /tmp/.../legacy-migration/01-matrix.ts` → `DROPPED instance methods (legacy Result -> core): ["expect","expectErr","inspect","inspectErr","isErrAnd","isOkAnd","match","toAsync"]`, `DROPPED statics: ["all"]`, `ADDED instance methods: ["isPending","settle","then"]`, `ADDED statics: ["do"]`. `find . -iname "*migrat*"` over the repo returns only `apps/docs/docs/how-to/core/migrate-from-throwing-code.md`. Working replacements, executed in 02-dropped-runtime.ts and type-checked in 19-cookbook.ts (EXIT=0): `match({ok,err})`→`mapOrElse(errFn, okFn)`; `inspect(fn)`→`map(v => (fn(v), v))` (note: allocates a new `Ok` — `new tap returns same instance? false`, whereas `legacy inspect returns same instance? true` — and an async tap silently becomes `Pending`: `async tap constructor: Pending` vs `legacy inspect with async fn returns: Ok`); `isOkAnd(p)`→`mapOr(false, p)`; `isErrAnd(p)`→`mapOrElse(p, () => false)`; `toAsync()`→`new Pending(Promise.resolve(settled))` (see lm-11). `expect`/`expectErr` have NO replacement: `new has expect? false  expectErr? false`, and `unwrap()` throws a fixed message (`UnwrapError | Called unwrap() on an Err value`) vs legacy's caller-supplied `config must load`.

</details>

**Recommendation.** Write a `docs/how-to/core/migrate-from-v2.md` containing (a) the full method matrix above, (b) a runnable snippet per dropped method, (c) explicit callouts for the `mapOrElse` argument order, the `inspect`→`map` identity/allocation change, the async-tap upgrade to `Pending`, and the loss of type-predicate narrowing (lm-13). Link it from the README's Legacy section, from `docs/intro.md` (which currently doesn't mention the legacy section at all), and from every `docs/legacy/*` page. Consider re-adding `inspect`/`inspectErr` (pure tap, no allocation, no async upgrade) since `map`-as-tap is a strictly worse substitute.

**Verifier note.** Verified end to end. `find . -iname '*migrat*'` outside node_modules returns only apps/docs/docs/how-to/core/migrate-from-throwing-code.md (plus its build artifacts), which is about try/catch. 01-matrix.ts reproduces `DROPPED instance methods: ["expect","expectErr","inspect","inspectErr","isErrAnd","isOkAnd","match","toAsync"]`, `DROPPED statics: ["all"]`. The 3.0.0 CHANGELOG entry mentions only the entrypoint swap, Pending, `Result.do` and the legacy subpath — none of the eight removals. 02-dro […truncated, full text in findings.json]

---

### `legacy-migration/lm-9` — The name `Result<T,E>` was reused for a different type; a verbatim signature migration silently makes `unwrap()` possibly-async

**Severity:** high · **Category:** type-safety · **Verifier verdict:** confirmed

**Claim.** The 1:1 successor of legacy `Result<T,E>` (= `Ok | Err`) is core `Settled<T,E>`, not core `Result<T,E>` (= `Ok | Err | Pending`). Because the name is identical, a codebase that migrates by changing only the import path silently widens every annotated signature with a `Pending` branch. The visible consequence is that `unwrap`, `unwrapOr` and friends stop returning `T` and start returning `T | PromiseLike<T>`, and every `isOk()/isErr()` exhaustiveness check silently gains an unhandled third case. The CHANGELOG announces `Result<T, E> is now Ok | Err | Pending` but never says "annotations you had should become `Settled`".

<details><summary><strong>Empirical evidence</strong></summary>

`bun x tsc ... 12-type-drift.ts` → EXIT=0, asserting: legacy `Result<number,string>.unwrap()` is `number`; core `Result<number,string>.unwrap()` is `number | PromiseLike<number>`; core `Settled<number,string>.unwrap()` is `number`; and `takesNumber(cr.unwrap())` is a `@ts-expect-error` while `takesNumber(lr.unwrap())` and `takesNumber(cs.unwrap())` compile. Same file proves the narrowing change: `legacyExhaustive` is exhaustive after `isOk()`+else, whereas in `coreExhaustive` the post-`isOk()`/`isErr()` branch has no `.error` (marked `@ts-expect-error`, which fired). Independent reveal via `const x: never = ...` (17-settled-vs-legacy.ts): legacy `Result` → `unwrap/unwrapOr/unwrapOrElse/mapOr/mapOrElse` all `number`; core `Result` counterparts widen.

</details>

**Recommendation.** Make the migration guide lead with `legacy Result<T,E> → Settled<T,E>` (not `Result<T,E>`), and consider shipping a codemod. Longer term, reconsider the naming: `Result` meaning three states while the two-state type is called `Settled` inverts the reader's expectation and is precisely what makes the silent widening possible — e.g. `Result<T,E>` for the settled pair and `AsyncResult`/`MaybePending<T,E>` for the union would have been non-colliding.

**Verifier note.** 12-type-drift.ts compiles at EXIT=0 and 17-settled-vs-legacy.ts's never-reveal reproduces the exact split I re-ran: legacy `Result<number,string>.unwrap/unwrapOr/unwrapOrElse/mapOr/mapOrElse` all reveal `number` (lines 9-13), core `Settled` reveals `number` for unwrap/unwrapOr/mapOr, core `Result` widens. Source confirms the naming: result.ts:21 `Result<T,E> = Ok | Err | Pending`, types.ts `Settled<T,E> = Ok | Err`, and base.ts declares `unwrap(): SyncOrAsync<T>`. The exhaustiveness loss is real […truncated, full text in findings.json]

---

### `probe-ts-compat-floor/ok-2` — HARD: with skipLibCheck:false, merely importing the package fails on every TypeScript below 5.4, with an unactionable TS2304 pointing into node_modules

**Severity:** high · **Category:** packaging · **Verifier verdict:** unverified

**Claim.** A consumer that does nothing but `import { Ok } from "antithrow"` fails to compile on TypeScript 4.7.4, 4.9.5, 5.0.4, 5.2.2 and 5.3.3 when skipLibCheck is false, with three TS2304 'Cannot find name NoInfer' errors located in the library's own dist/ok.d.ts. TypeScript emits no version hint for `NoInfer` (unlike, say, `AsyncGenerator`, which gets the 'Try changing the lib compiler option' suffix), so the consumer sees a bare 'Cannot find name' inside a third-party file with nothing to act on and no documented minimum version to check against. Below 4.7 the failure is worse still: the `out` variance annotations on Ok/Err/Pending are a *parse* error (TS1005), which skipLibCheck cannot suppress, so 4.6 and older cannot consume the package at all under any configuration.

<details><summary><strong>Empirical evidence</strong></summary>

cd .../ts-compat-floor/consumer && ../compilers/node_modules/ts53/bin/tsc -p tsconfig.hard.json   (skipLibCheck:false, strict, bundler, cases/import-only.ts)
  -> /home/user/antithrow/packages/antithrow/dist/ok.d.ts(25,28): error TS2304: Cannot find name 'NoInfer'.
     /home/user/antithrow/packages/antithrow/dist/ok.d.ts(26,28): error TS2304: Cannot find name 'NoInfer'.
     /home/user/antithrow/packages/antithrow/dist/ok.d.ts(27,28): error TS2304: Cannot find name 'NoInfer'.
Identical output for ts47, ts49, ts50, ts52 (exit=2). ts54/ts56/ts58/ts59 -> exit=0. ts60 with --moduleResolution bundler -> exit=0.

Absolute parse floor (skipLibCheck:true does NOT help):
  ../compilers/node_modules/ts46/bin/tsc --noEmit --strict --target es2022 --module esnext --moduleResolution node --skipLibCheck true cases/import-only.ts
  -> dist/err.d.ts(15,30): error TS1005: ',' expected.
     dist/err.d.ts(15,45): error TS1005: ',' expected.
     dist/ok.d.ts(15,29): error TS1005: ',' expected.
     dist/ok.d.ts(15,36): error TS1005: ',' expected.
     dist/pending.d.ts(17,34): error TS1005: ',' expected.
     dist/pending.d.ts(17,41): error TS1005: ',' expected.
     exit=2
  (line 15 of ok.d.ts is `export declare class Ok<out T, out E = never> extends ResultBase<T, E>` — `out` variance annotations are TS 4.7+.)
  4.4.4 and 4.5.5 reject `--target es2022` outright (TS6046), so they are out of range regardless.

</details>

**Recommendation.** Fix the root cause per ok-1 (portable NoInfer), which moves the hard floor to 4.7 for both skipLibCheck settings. Whatever floor you settle on, make the failure self-describing rather than a bare TS2304 in node_modules: add a `types@<X` condition to the exports map pointing at a stub d.ts whose only export is a descriptively-named symbol. I verified this mechanism works and fires correctly under both `bundler` and `node16` resolution (see ok-3 evidence), so a consumer on an unsupported compiler gets an error that names the requirement instead of a mystery inside your dist.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-ts-compat-floor/ok-3` — The package declares no TypeScript floor anywhere — no engines, no peerDependencies, no typesVersions, no README/docs/CHANGELOG statement — so the sub-floor consumer gets zero signal at install time or compile time

**Severity:** high · **Category:** packaging · **Verifier verdict:** unverified

**Claim.** packages/antithrow/package.json contains no `engines`, no `peerDependencies`/`peerDependenciesMeta`, and no `typesVersions`. Grepping README.md, packages/antithrow/README.md, packages/antithrow/CHANGELOG.md and all of apps/docs finds no statement of a minimum TypeScript (or Node) version. The only tsconfig the project publishes — apps/docs/docs/tutorial/01-setup.md — sets `"skipLibCheck": true` and says nothing about a compiler version, i.e. it steers readers straight onto the silent path from ok-1. A consumer on TS 5.3 therefore installs cleanly (npm/pnpm/bun print no peer warning), compiles cleanly, and gets a wrong type. Comparable libraries do better: @trpc/server declares `peerDependencies: { "typescript": ">=5.7.2" }`; neverthrow, true-myth and @badrap/result all declare `engines.node`. antithrow declares neither.

<details><summary><strong>Empirical evidence</strong></summary>

grep -nE "engines|peerDep|typesVersions" /home/user/antithrow/packages/antithrow/package.json
  -> (no matches) "NONE of engines/peerDependencies/typesVersions in packages/antithrow/package.json"
grep -rniE "typescript" apps/docs/docs packages/antithrow/README.md README.md
  -> 25 hits, all prose about the type system ("TypeScript now knows...", "Enable TypeScript in strict mode"); zero version statements.
sed -n '23,37p' /home/user/antithrow/apps/docs/docs/tutorial/01-setup.md
  -> the prescribed tsconfig is target ES2022 / module NodeNext / strict / noUncheckedIndexedAccess / exactOptionalPropertyTypes / esModuleInterop / "skipLibCheck": true — no compiler version anywhere.

npm registry comparison (curl https://registry.npmjs.org/<pkg>/latest):
  @trpc/server 11.18.0 -> peerDependencies: { "typescript": ">=5.7.2" }
  neverthrow 8.2.0     -> engines: { "node": ">=18" }
  true-myth 9.4.0      -> engines: { "node": "18.* || >= 20.*" }
  @badrap/result 0.3.1 -> engines: { "node": ">= 22" }
  antithrow 3.0.0      -> {} for all three fields

Gating mechanism verified to work on this exact package shape (.../ts-compat-floor/fakepkg, a scratch copy of dist with `"types@<5.4": "./ts-too-old.d.ts"` added to the exports map):
  ts53 --moduleResolution bundler  -> cases/gated.ts(1,10): error TS2305: Module '"antithrow-gated"' has no exported member 'Ok'.
  ts53 --module node16 --moduleResolution node16 -> same error
  ts54 / ts60 (either resolution)  -> exit 0, resolves the real types

</details>

**Recommendation.** Declare the contract three ways, and make them agree: (1) add `"peerDependencies": { "typescript": ">=5.4" }` plus `"peerDependenciesMeta": { "typescript": { "optional": true } }` to packages/antithrow/package.json so package managers warn at install (mirror @trpc/server); (2) add `"engines": { "node": ">=18" }` like every comparable library; (3) state the minimum TypeScript version and the required `lib` (see ok-6) in packages/antithrow/README.md and apps/docs/docs/tutorial/01-setup.md, and note there that `skipLibCheck: true` hides the incompatibility. If you adopt the ok-1 fix the number becomes >=4.7 for the main entry, but it still needs stating — note that antithrow/legacy would remain at >=5.0 (ok-4), so a single number is not sufficient.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-concurrency-cancellation/cc-2` — `unwrapOr`, `or`, `flatten` and `settle` on a Pending can reject — the total, callback-free escape valves are not total

**Severity:** high · **Category:** correctness · **Verifier verdict:** adjusted

**Claim.** `ResultBase.unwrapOr(value)` is documented as "Returns the value if this result is Ok, otherwise returns the provided default value" (base.ts:208-219) and, unlike `map`/`andThen`/`mapErr`/`orElse`/`unwrapOrElse`, carries NO `@throws Errors thrown by fn are not caught` note — correctly, because it takes no callback. Yet on a `Pending` it is implemented as `this.promise.then((result) => result.unwrapOr(value))` (pending.ts:118-120), so if the upstream promise is rejected the returned PromiseLike rejects instead of resolving to the default. The same holds for the other callback-free members `or(result)`, `flatten()` and `settle()`. Every single one of the 13 public members of `Pending` propagates the rejection; there is no `.catch`/`.finally` on `Pending`, and even the raw `.promise` escape hatch rejects. This means the natural "I don't care about errors, just give me defaults" fan-out — `Promise.all(results.map(r => r.unwrapOr(0)))` — blows up the whole aggregate.

<details><summary><strong>Empirical evidence</strong></summary>

`bun 09-poison-recovery.ts`:
```
=== Recovery attempts on a poisoned Pending ===
  await pending                      -> REJECTED  POISON
  .settle()                          -> REJECTED  POISON
  .unwrapOr(0)  <-- 'safe' default   -> REJECTED  POISON
  .unwrapOrElse(() => 0)             -> REJECTED  POISON
  .mapErr(e => 'x')                  -> REJECTED  POISON
  .orElse(() => new Ok(0))           -> REJECTED  POISON
  .or(new Ok(0))                     -> REJECTED  POISON
  .mapOr(0, v => v)                  -> REJECTED  POISON
  .mapOrElse(() => 0, v => v)        -> REJECTED  POISON
  .map(v => v)                       -> REJECTED  POISON
  .andThen(v => new Ok(v))           -> REJECTED  POISON
  .flatten()                         -> REJECTED  POISON
  .promise (raw escape hatch)        -> REJECTED  POISON
```
and `bun 13-reachability.ts` S5:
```
  Promise.all(rs.map(r => r.unwrapOr(0))) -> [1,0]  (works)
  same spelling with a poisoned sibling -> REJECTED POISON
```
`bun 08-typecheck2.ts` via tsc (exit 0) confirms `pNum.catch` and `pNum.finally` are both `@ts-expect-error` — Pending exposes no rejection-handling surface at all. The only recovering spellings found (`bun 09-poison-recovery.ts`) are undocumented: `Result.try(() => poisonedPending)` -> `RESOLVED Err(Error: POISON)`, `Result.fromPromise(poisonedPending)` -> `RESOLVED Err(Error: POISON)`.

</details>

**Recommendation.** Make the callback-free members honour their contracts: `Pending.unwrapOr(v)` should be `this.promise.then((r) => r.unwrapOr(v), () => v)`, and `or(other)` should fall back to `other` on rejection. Better still, give `Pending` a documented `catchPoison(fn: (reason: unknown) => E): Pending<T, E>` (or make `orElse`/`mapErr` receive the rejection reason) so the poison channel is reachable from inside the library instead of only through the accidental `Result.try(() => pending)` trick. Document that trick in the meantime.

**Verifier note.** The core factual claim reproduces: `bun 09-poison-recovery.ts` shows unwrapOr/unwrapOrElse/or/orElse/mapErr/flatten/settle/.promise all REJECT on a poisoned Pending, and pending.ts:118-120 confirms `unwrapOr` is `this.promise.then((result) => result.unwrapOr(value))` with no onrejected, while base.ts:208-219 documents it with no @throws note. 13-reachability.ts S5 reproduces the broken defaults fan-out. BUT two statements are factually wrong and must be corrected: (a) 'Pending exposes no rejecti […truncated, full text in findings.json]

---

### `probe-concurrency-cancellation/cc-3` — `Promise.any` over Results returns an Err and is type-identical to `Promise.race`; "first success wins" and "all failed" are both unimplementable with native combinators

**Severity:** high · **Category:** correctness · **Verifier verdict:** confirmed

**Claim.** Because an `Err` is a *fulfilled* promise, `Promise.any` picks the first Result to settle regardless of whether it succeeded — exactly inverting the combinator's purpose — and its `AggregateError` branch is dead code that can never fire for Results. TypeScript gives zero warning: `await Promise.any([r, r])` and `await Promise.race([r, r])` infer to the *same* type, `Settled<number, "db">`, so nothing at the type level distinguishes the broken spelling from the working one. Extending the confirmed starting evidence: I quantified the reachability of every standard aggregation semantic (13-reachability.ts). Reachable: none of them cleanly. S1 fail-fast-on-first-Err loses only its latency win (Promise.all cannot short-circuit on an Err — 61ms instead of ~6ms). S2 first-success-wins: unreachable. S3 all-failed-aggregate-error: unreachable. S4 partition: unreachable (allSettled reports Ok and Err identically). S5 defaults: breaks on poison. Hand-rolling S6 recovers the 6ms fail-fast but requires ~10 lines of raw promise plumbing.

<details><summary><strong>Empirical evidence</strong></summary>

`bun 13-reachability.ts`:
```
=== S2: 'first success wins' (Promise.any / neverthrow) ===
  Promise.any -> Err(fastfail) at 6ms
  ==> UNREACHABLE. Promise.any returns the first *settle*, i.e. an Err. Inverted semantics.
=== S3: 'all failed -> AggregateError of every error' ===
  Promise.any over all-Err -> Err(a) (single, not aggregate)
=== S1 ... ===
  Promise.all waited 61ms for ALL (no short-circuit); firstErr=early
=== S4: 'partition into oks/errs' (allSettled) ===
  statuses: fulfilled,fulfilled,rejected
=== S6 ... ===
  hand-rolled fail-fast: Err(boom) at 6ms (vs 80ms for Promise.all)
```
Type level, `08-typecheck2.ts` (tsc exit 0, assertions `_2`,`_3`,`_4`):
```ts
const b = await Promise.any([rNum, rNum]);
type _2 = Expect<Equal<typeof b, Settled<number, "db">>>;
const c = await Promise.race([rNum, rNum]);
type _4 = Expect<Equal<typeof b, typeof c>>; // any and race are INDISTINGUISHABLE by type
```
Corrected semantics via a hand-rolled `firstSuccess` (`bun 05-handrolled.ts`): `-> Ok(99) after 41ms  (Promise.any gave Err('fast-fail') at 5ms)`.

</details>

**Recommendation.** Ship `Result.any` (first Ok wins, `Err<E[]>` if all fail) and `Result.all` (fail-fast on first Err, with the latency win) in core. Until then, add a prominent "Do not use Promise.any/race/allSettled on Results" warning to the Combine results docs page with the reason (an Err is a fulfilled promise) and the correct spellings. Consider making `Pending` non-thenable (require explicit `.settle()`) so that passing Results to native combinators is a type error rather than a silently wrong result — a breaking change, but it removes an entire class of inverted semantics.

**Verifier note.** Both halves reproduce. Runtime (`bun 13-reachability.ts`, `bun 01-combinator-matrix.ts`): `Promise.any([Pending(Err) fast, Pending(Ok) slow])` -> `Err("netfail") after 5ms` (expected Ok(99)); `Promise.any` over an all-Err list -> `Err("boom")`, never an AggregateError; `Promise.all` waited 61ms with no short-circuit on Err; hand-rolled fail-fast in 05-handrolled.ts gives `Ok(99) after 40ms` / `Err(boom) at 6ms`. Type level: 08-typecheck2.ts passes under `tsc --ignoreConfig --noEmit --strict --ex […truncated, full text in findings.json]

---

### `probe-concurrency-cancellation/cc-5` — The same `.map(throwingFn)` throws synchronously, is skipped, or silently poisons — depending on which of the three states you hold; a try/catch around a fan-out catches only half the errors

**Severity:** high · **Category:** correctness · **Verifier verdict:** confirmed

**Claim.** `Result<T,E>` is a three-member union, and the documented contract "@throws Errors thrown by `fn` are not caught" (base.ts:53, 69, 86, 103, 124, 162, 232) means three different things depending on the runtime member. On `Ok` the throw propagates synchronously at the call site. On `Err` the callback never runs at all. On `Pending` the throw is deferred into the promise chain and becomes a rejection nobody can catch at the call site. Since the whole point of a union type is that callers do not know which member they hold, code that maps over a `Result<T,E>[]` in a fan-out has NO single error-handling strategy: a `try`/`catch` around the loop catches the Ok-derived throws and completely misses the Pending-derived ones, which then go on to crash the process per cc-1. This is the mechanism behind cc-1 and cc-4 and is not called out anywhere in the docs.

<details><summary><strong>Empirical evidence</strong></summary>

`bun 14-throw-asymmetry.ts`:
```
=== .map(throwingFn): identical source, three different destinations ===
  new Ok(1).map(boom)                 [Ok]             SYNC-THREW at the call site: BOOM
  new Err('e').map(boom)              [Err]            sync-returned [object Object]
  Result.try(async()=>1).map(boom)    [Pending]        async-REJECTED (POISON) BOOM

=== demonstration: try/catch around a fan-out catches only the sync half ===
  synchronously caught: 1   escaped as poisoned Pendings: 1
```
Contrast with the constructors, which DO capture (same run): `Result.try(async () => boom())` -> `async-RESOLVED Err(Error: BOOM)`; `Result.fromPromise(Promise.reject('r'))` -> `async-RESOLVED Err(r)`. So `Result.try` catches throws but `Result.try(...).map(...)` does not — an asymmetry within a single chain.

</details>

**Recommendation.** Pick one contract for the whole union and enforce it. The safe choice is to capture callback throws into `Err<unknown>` in every combinator (breaking, and it widens `E`, but it is what makes the three states substitutable and is what `antithrow/legacy`'s `ResultAsync` already does). If "throws are not caught" is kept deliberately, at least normalise it: make `Pending` re-throw synchronously-impossible errors through a first-class poison channel with `catchPoison`, and add an `@antithrow/eslint-plugin` rule that flags a throwing callback passed to any combinator.

**Verifier note.** Reproduced: `bun 14-throw-asymmetry.ts` gives `new Ok(1).map(boom)` -> SYNC-THREW at the call site; `new Err('e').map(boom)` -> callback never runs; `Result.try(async()=>1).map(boom)` -> async-REJECTED, and the try/catch-around-a-fan-out demo shows `synchronously caught: 1   escaped as poisoned Pendings: 1`. Source confirms: ok.ts calls fn inline while pending.ts:52-55 defers it into `.then`. The documented `@throws Errors thrown by fn are not caught` really does appear seven times in base.ts -  […truncated, full text in findings.json]

---

### `probe-test-interop/ti-4` — A poisoned Pending that rejects after the test file finishes is silently swallowed by both bun:test and vitest (exit 0)

**Severity:** high · **Category:** correctness · **Verifier verdict:** unverified

**Claim.** The library's dominant hazard is an unawaited `Pending` whose underlying promise rejects (a throwing async callback — explicitly documented as not caught — or a raw rejected promise). Whether CI can catch that depends entirely on timing and runner. Measured: (a) bun:test attributes a promptly-rejecting Pending to the test and FAILS it — good; (b) vitest reports it under "Unhandled Errors" and exits 1, but marks every test as PASSED with no per-test attribution (only "This error originated in <file>"), and a single config flag `dangerouslyIgnoreUnhandledErrors: true` turns the exit code back to 0 while still reporting `Errors 3`; (c) if the rejection lands after the test file's last test resolves — i.e. anything backed by a timer, a fetch, or a DB round-trip, which is what async Results are for — BOTH runners exit 0 with zero output. So the failure mode the library's design most invites is unobservable in CI in the common case.

<details><summary><strong>Empirical evidence</strong></summary>

BUN — `bun test bt/unhandled.test.ts`:
```
 2 pass
 3 fail
 EXIT=1
(fail) U1: creates a poisoned Pending and asserts something true
(fail) U3: unawaited pending.unwrap() on an Err result
(fail) U4: raw poisoned Pending
```
VITEST — `bun x vitest run vt/unhandled.test.ts`; exit code captured directly (`VITEST_EXIT=1`):
```
 ✓ U1 ✓ U2 ✓ U3 ✓ U4 ✓ U5
⎯⎯⎯ Unhandled Errors ⎯⎯⎯
Vitest caught 3 unhandled errors during the test run.
This might cause false positive tests.
 Test Files  1 passed (1)
      Tests  5 passed (5)
     Errors  3 errors
```
VITEST + flag — `bun x vitest run -c vitest.ignore.config.ts` (`dangerouslyIgnoreUnhandledErrors: true`):
```
EXIT_WITH_dangerouslyIgnoreUnhandledErrors=0
 Tests  5 passed (5)   Errors  3 errors
```
(`pool: "threads"` behaves identically: `THREADS_EXIT=1`, `Tests 5 passed`, `Errors 3`.)
DELAYED POISON — `vt/delayed-poison.test.ts` / `bt/delayed-poison.test.ts`, where the rejection fires ~60ms later via `setTimeout`:
```
VITEST_EXIT=0    Test Files 1 passed (1)   Tests 2 passed (2)     [no Errors section at all]
BUN_EXIT=0       2 pass  0 fail
```

</details>

**Recommendation.** Do not rely on the runtime's unhandled-rejection reporting — it is timing-dependent and per-runner. Attach a permanent no-op rejection handler inside the `Pending` constructor (`promise.then(undefined, () => {})` kept on a private field) so an unawaited Pending can never produce a process-level unhandled rejection, and surface the failure through an explicit, deterministic channel instead: have `Pending` capture the rejection into an `Err`-like terminal state that `settle()`/`await` re-raises, or expose a `Result.onUnhandled(handler)` hook that test setup can wire to `expect.fail`. Also ship a documented `expectNoPendingLeaks()`-style helper (a registry of created-but-never-settled Pendings, drained in `afterEach`) so leaks are caught at test granularity rather than at process exit.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-test-interop/ti-5` — bun:test rejects `expect(pending).resolves/.rejects` — the documented PromiseLike contract does not satisfy the repo's own runner

**Severity:** high · **Category:** ergonomics · **Verifier verdict:** unverified

**Claim.** `Pending` implements `PromiseLike<Settled<T,E>>` and the class JSDoc advertises `await pending`. But bun:test's `.resolves`/`.rejects` require a real `Promise`, not a thenable, and reject a `Pending` outright with `Expected promise / Received: Pending {…}` — dumping a 20-line inspect blob of the object's prototype methods as the "received" value. Vitest accepts the thenable fine. So the most natural async assertion spelling works in vitest and fails in the runner this monorepo standardises on, and neither the docs nor the JSDoc mention the `.settle()` workaround. Separately, `p.unwrap()` / `p.unwrapOr(x)` on a Pending return a `PromiseLike`, so the sync-looking spellings `expect(p.unwrap()).toBeTruthy()` and `expect(p.unwrap()).toBeDefined()` pass unconditionally — including when the Result is an `Err` — because a thenable is always truthy and defined.

<details><summary><strong>Empirical evidence</strong></summary>

BUN — `bun test bt/async.test.ts`:
```
(fail) A1: expect(pending).resolves.toEqual(Ok(1)) -- does resolves accept a thenable?
error:
Expected promise
Received: Pending {
  promise: Promise { <pending> },
  then: [Function: then],
  isOk: [Function: isOk],
  … 17 more prototype methods …
}
(fail) A2: resolves on a Pending that settles to Err   -> same "Expected promise"
(fail) A3: poisoned Pending -- new Pending(Promise.reject()) with .rejects
 4 pass  5 fail
```
BUN workarounds — `bun test bt/async2.test.ts`: `B3: expect(p.settle()).resolves` PASSES and `B5: expect(await p)` PASSES.
VITEST — `bun x vitest run vt/async.test.ts --reporter=verbose`:
```
 ✓ A1: expect(pending).resolves.toEqual(Ok(1)) 3ms
 ✓ A3: poisoned Pending … with .rejects 1ms
 ✓ A4: await expect(p.unwrap()).resolves.toBe(1) 0ms
```
SILENT-TRUTHY — `bun matrix-bun.ts`:
```
[PASS]   ok   expect(pending.unwrap()).toBeTruthy() -- ALWAYS passes (thenable is truthy)
[PASS]   ok   expect(pending.unwrap()).toBeDefined() -- ALWAYS passes
```
(both Pendings there settle to `Err`, and the run additionally emits two process-level `UnwrapError` unhandled rejections.)
UNAWAITED `.resolves` — bun catches it (`bt/async2.test.ts` B4 FAILS with a correct diff); vitest 4 only warns: `Promise returned by expect(actual).resolves.toEqual(expected) was not awaited. Vitest currently auto-awaits hanging assertions at the end of the test, but this will cause the test to fail in the next Vitest major.`

</details>

**Recommendation.** Either make `Pending` a real `Promise` subclass / return a genuine `Promise` from a `toPromise()` accessor, or — cheaper and clearer — document `await expect(result.settle()).resolves.toEqual(new Ok(x))` as THE cross-runner async assertion idiom and add a `Testing` page to the docs (currently there is none, see ti-9). Additionally, make the sync-shaped accessors unusable-by-accident on a Pending: `Pending#unwrap()` returning a `PromiseLike<T>` typed as such is correct, but an ESLint rule in `@antithrow/eslint-plugin` flagging an un-awaited `unwrap()`/`unwrapOr()` result inside `expect(...)` would close the always-truthy hole.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-test-interop/ti-6` — UnwrapError's message omits the payload, so a test that fails via unwrap() prints nothing about what went wrong

**Severity:** high · **Category:** ergonomics · **Verifier verdict:** unverified

**Claim.** `UnwrapError`'s message is the constant string `"Called unwrap() on an Err value"`; the actual error is only reachable via the non-enumerable-in-message `.result` property. Both bun:test and vitest render a thrown error as `name: message` plus a stack, so a test that fails because production code returned an `Err` prints zero information about WHICH error. A prior auditor counted 124 `unwrap()` calls across sibling packages, largely because `isOk()` cannot be used as an assertion (ti-7) — meaning `unwrap()` is the de-facto assertion spelling, and its failure output is content-free. Where a runner does serialise the `.result` property (vitest's unhandled-rejection path), it dumps the full object including all 18 prototype methods, which is worse than useless.

<details><summary><strong>Empirical evidence</strong></summary>

BUN — `bun test bt/diffs.test.ts`, test D4 where the Err payload is `{ code: 500, detail: "database is on fire" }`:
```
UnwrapError: Called unwrap() on an Err value
      at unwrap (/home/user/antithrow/packages/antithrow/dist/err.js:65:70)
      at <anonymous> (…/bt/diffs.test.ts:23:12)
(fail) D4 unhandled UnwrapError surfaced from Err.unwrap()
```
Neither `500` nor `"database is on fire"` appears anywhere in the output.
VITEST — `bun x vitest run vt/diffs.test.ts`:
```
 FAIL  vt/diffs.test.ts > D4 unhandled UnwrapError surfaced from Err.unwrap()
UnwrapError: Called unwrap() on an Err value
 ❯ vt/diffs.test.ts:23:12
```
Snapshot of the message — `bun x vitest run vt/snapshot.test.ts` wrote back:
```
expect((caught as UnwrapError).message).toMatchInlineSnapshot(`"Called unwrap() on an Err value"`);
```
When a runner DOES serialise `.result` (vitest unhandled-rejection path, `vt/unhandled.test.ts`):
```
Serialized Error: { result: { error: { stack: '…', message: 'POISON-from-U3', … }, constructor: 'Function<Err>', isOk: 'Function<isOk>', isErr: 'Function<isErr>', isPending: 'Function<isPending>', map: 'Function<map>', mapErr: 'Function<mapErr>', mapOr: …, settle: 'Function<settle>' } }
```
Relatedly, `String(new Err("x"))` is `"[object Object]"` and `bun console.log(new Ok(1))` prints 19 lines of prototype methods (`bun inspect.ts`), so ad-hoc `console.log` debugging is also poor. `node:util.inspect` is fine (`Ok { value: 1 }`).

</details>

**Recommendation.** Interpolate the payload into the message, e.g. `` `Called unwrap() on an Err value: ${inspect(error)}` `` (with a length cap), and set `cause` to the underlying error so runners that follow `Error.cause` chain it. Add `toString()` / `[Symbol.for('nodejs.util.inspect.custom')]` to `Ok`/`Err`/`Pending` rendering `Ok(1)`, `Err("x")`, `Pending(<unsettled>)` — this fixes template-literal output, bun's noisy console.log, and diff readability in one change. Define the methods as non-enumerable prototype members (they already are; the noise is bun walking the chain) and add a pretty-format serializer export so runners print the compact form.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-suite-efficacy/ok-2` — isThenable — the package's async-dispatch predicate — has a 50% mutation score; four distinct behaviours are completely unguarded

**Severity:** high · **Category:** test-coverage · **Verifier verdict:** unverified

**Claim.** `utils.ts` (7 lines, one function) scores 5/10: five mutants survive. `isThenable` decides every sync-vs-async upgrade in the library (`Ok.map`, `Err.mapErr`, `Result.try`), yet no test ever (a) returns `null` from a callback, (b) returns `undefined` from a callback, (c) returns a callable thenable, or (d) returns an object with a non-callable `then` property. Two of the surviving mutants turn `new Ok(1).map(() => null)` and `.map(() => undefined)` into hard `TypeError` crashes and the suite stays at 534 pass. Across the four core test files (1836 lines) the literals `null` and `undefined` appear exactly once, and never as a callback return value.

<details><summary><strong>Empirical evidence</strong></summary>

`bun /tmp/.../suite-efficacy/verify-survivors.ts` (each block shows the suite result under the mutant plus pristine-vs-mutant probe diffs):

### U01 isThenable drops callable thenables (utils.ts:4)
    suite result: 534 pass / 0 fail   <-- MUTANT SURVIVES
      isThenable(callable-with-then)   pristine: true   mutant: false
      Ok.map(()=>callableThenable) isPending   pristine: true   mutant: false
      Result.try(()=>callableThenable) isPending   pristine: true   mutant: false

### U03 isThenable drops the null guard (utils.ts:3)
    suite result: 534 pass / 0 fail   <-- MUTANT SURVIVES
      new Ok(1).map(()=>null).unwrap()   pristine: null   mutant: THREW TypeError: null is not an object (evaluating 'value.then')
      new Err('e').mapErr(()=>null).unwrapErr()   pristine: null   mutant: THREW TypeError
      Result.try(()=>null).unwrap()   pristine: null   mutant: THREW UnwrapError: Called unwrap() on an Err value

### U05 isThenable drops the typeof guard (utils.ts:4)
    suite result: 534 pass / 0 fail   <-- MUTANT SURVIVES
      new Ok(1).map(()=>undefined).unwrap()   pristine: undefined   mutant: THREW TypeError: undefined is not an object

### U04 isThenable uses `in` not typeof (utils.ts:5)
    suite result: 534 pass / 0 fail   <-- MUTANT SURVIVES
      isThenable({then:42})   pristine: false   mutant: true
      Ok.map(()=>({then:42})) isPending   pristine: false   mutant: THREW TypeError: result.then is not a function

And `grep -n "null\|undefined" ok.test.ts err.test.ts pending.test.ts result.test.ts types.test.ts` returns exactly one line (pending.test.ts:785, an `iterator.return(undefined as ...)` cast), while `grep -n "then:" <core test files>` returns nothing.

</details>

**Recommendation.** Add a dedicated `utils.test.ts` table-driven suite over `isThenable` covering: `null`, `undefined`, `0`, `""`, `{}`, `{then: 42}`, `{then(){}}`, `Object.assign(() => {}, {then(r){r(1)}})`, a real Promise, and `Object.create(null)` with a `then`. Then assert the same matrix end-to-end through `Ok.map`, `Err.mapErr` and `Result.try` (e.g. `expect(new Ok(1).map(() => null).unwrap()).toBeNull()` and `expect(Result.try(() => cb).isPending()).toBeTrue()` for the callable thenable). This alone lifts utils.ts from 50% to 100% and is ~20 lines.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-suite-efficacy/ok-3` — The documented `@throws` contract has zero tests; a throwing callback on the Pending branch crashes the process and the suite would notice — it just never tries

**Severity:** high · **Category:** test-coverage · **Verifier verdict:** unverified

**Claim.** `base.ts` carries 7 `@throws Errors thrown by \`fn\` are not caught.` annotations (lines 53, 69, 85, 103, 124, 162, 224), but the only two `throw` statements in the entire core test suite are inside `Result.try` callbacks (result.test.ts:1115 and :1148) — the one path that *does* catch. No test passes a throwing callback to `map`, `mapErr`, `andThen`, `orElse`, `mapOr`, `mapOrElse`, or `unwrapOrElse` on any receiver. On the `Pending` branch this is not a benign gap: the throw becomes an unhandled rejection that terminates the process with exit code 1, and `bun test` *does* surface it as a test failure — so the regression test is expressible today with zero new infrastructure.

<details><summary><strong>Empirical evidence</strong></summary>

`grep -n "throw " ok.test.ts err.test.ts pending.test.ts result.test.ts` -> only result.test.ts:1115 and result.test.ts:1148, both `throw "failed"` inside `Result.try`.

`bun /tmp/.../suite-efficacy/probe/throwpaths.ts`:
  Ok.map(throwing)            -> THREW SYNC cb-boom
  Err.mapErr(throwing)        -> THREW SYNC cb-boom
  Ok.andThen(throwing)        -> THREW SYNC cb-boom
  Ok.mapOrElse(throwing)      -> THREW SYNC cb-boom
  Result.do(gen that throws)  -> THREW SYNC cb-boom
  Pending.map(throwing) constructed  -> Pending (no sync throw)
  isPending() on it                  -> true
  ...now going idle without awaiting it
  error: cb-boom
        at map (/home/user/antithrow/packages/antithrow/src/ok.ts:46:18)
  PROCESS EXIT=1

`bun test /tmp/.../suite-efficacy/probe/unhandled.test.ts`:
  (fail) A: floating Pending whose callback throws — does bun test notice? [0.83ms]
   1 pass
   1 fail
So the harness catches it; the suite simply has no such test.

</details>

**Recommendation.** Add, for each of the 7 `@throws`-documented methods, one test per receiver: `expect(() => new Ok(1).map(boom)).toThrow(...)` for Ok/Err, and for Pending `await expect(pending.map(boom)).rejects.toThrow(...)` plus one explicitly-floating case asserting the rejection is observable. This locks the documented contract and turns the current silent process-kill into a covered, intentional behaviour.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-suite-efficacy/ok-4` — UnwrapError's entire public surface (`.result`, `.name`) is unasserted — mutants that erase both survive

**Severity:** high · **Category:** test-coverage · **Verifier verdict:** unverified

**Claim.** `UnwrapError` is a documented public export whose JSDoc @example advertises `error.result` as the way to recover the failed result. Across all 5 core test files, `.result` and `.name` are never read: the 16 UnwrapError references are all `toThrow(UnwrapError)` / `rejects.toBeInstanceOf(UnwrapError)` / `toThrow(<message>)`. Mutants replacing `this` with `undefined` in both throw sites (ok.ts:116, err.ts:99) and renaming `name` from `"UnwrapError"` to `"Error"` (errors.ts:22) all survive at 534 pass / 0 fail.

<details><summary><strong>Empirical evidence</strong></summary>

`grep -n "\.result\b\|\.name\b" packages/antithrow/src/*.test.ts` -> no output (zero matches).

`bun /tmp/.../suite-efficacy/verify-survivors.ts`:
### T04a UnwrapError.result dropped, Err.unwrap (err.ts:99)
    suite result: 534 pass / 0 fail   <-- MUTANT SURVIVES
      UnwrapError.result   pristine: [object Object]   mutant: undefined
      UnwrapError.result instanceof Err   pristine: true   mutant: false
      UnwrapError.result?.unwrapErr?.()   pristine: boom   mutant: THREW TypeError: undefined is not an object
### T04b UnwrapError.result dropped, Ok.unwrapErr (ok.ts:116)
    suite result: 534 pass / 0 fail   <-- MUTANT SURVIVES
      Ok.unwrapErr -> result instanceof Ok   pristine: true   mutant: false
### T05 UnwrapError.name renamed (errors.ts:22)
    suite result: 534 pass / 0 fail   <-- MUTANT SURVIVES
      UnwrapError.name   pristine: UnwrapError   mutant: Error

</details>

**Recommendation.** In the four existing `toThrow(UnwrapError)` tests, replace the bare matcher with a captured-error assertion: `const e = <capture>; expect(e.name).toBe("UnwrapError"); expect(e.result).toBe(result); expect(e.result.unwrapErr()).toBe("failed")` (and the Ok mirror). Same for the two `rejects.toBeInstanceOf` Pending cases. Four extra lines close all three survivors.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-suite-efficacy/ok-5` — The dominant assertion idiom (`expect(x.unwrap()).resolves.toBe(v)`) cannot distinguish Ok<T> from Ok<Promise<T>> — promise auto-flattening swallows the difference

**Severity:** high · **Category:** test-coverage · **Verifier verdict:** unverified

**Claim.** 132 of the 818 assertions are `expect(<PromiseLike>).resolves/.rejects...`, and 96 of those are on a `Pending` receiver via `.unwrap()`/`.unwrapErr()`. Because `await` recursively flattens thenables, these assertions pass identically whether the settled `Ok` holds the resolved value or the promise itself. A mutant that makes `Ok.map` wrap the *promise* rather than its resolution (`new Pending(Promise.resolve(new Ok(result)))` at ok.ts:49) survives at 534 pass, even though the settled result's `.value` changes from `number` to a thenable — i.e. the suite is blind to a whole class of async-flattening regressions on the library's single most-used method.

<details><summary><strong>Empirical evidence</strong></summary>

`bun /tmp/.../suite-efficacy/verify-survivors.ts`:
### A03 Ok.map wraps the promise itself (ok.ts:49)
    suite result: 534 pass / 0 fail   <-- MUTANT SURVIVES
      settled.value typeof            pristine: number   mutant: object
      settled.value is a thenable?    pristine: false    mutant: true
And from probe/survivors.ts under the mutant, the existing test style still yields the right answer: `(existing-test style) await .unwrap()` -> 2 in both builds.

Count of the idiom: `grep -n "expect(" packages/antithrow/src/*.test.ts | grep -E "rejects|resolves" | grep -vc "await expect"` -> 132.

</details>

**Recommendation.** For async paths, assert on the settled object, not on a flattened unwrap: `const settled = await result.settle(); expect(settled).toBeInstanceOf(Ok); expect(settled.value).toBe(42);` (or `expect(await result.settle()).toEqual(new Ok(42))`). Add at least one `expect(isThenable(settled.value)).toBeFalse()`-style guard on `Ok.map`/`Err.mapErr`/`Pending.map` so double-wrapping is caught. Note result.test.ts:823/832/841 already use the `expect(settle()).resolves.toEqual(new Ok(42))` form — that form does catch it; the 96 `.unwrap()` sites do not.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-suite-efficacy/ok-6` — Coverage is line-only with no branch metric, no enforced threshold, and the entrypoint is not even in the report — so 100% is structurally incapable of falsifying anything

**Severity:** high · **Category:** tooling · **Verifier verdict:** unverified

**Claim.** The 100% figure that makes the suite look exhaustive is line coverage from `bun test --coverage`, which emits only `% Funcs` and `% Lines` — there is no branch coverage. All five `isThenable` survivors (ok-2) are branch-level mutations inside a single multi-line `return (...)` expression that counts as covered lines. Further: `src/index.ts` and `src/types.ts` do not appear in the coverage table at all, so gutting the entrypoint (ok-1) does not even move the number; `bunfig.toml` sets only `coveragePathIgnorePatterns` with no `coverageThreshold`; and `.github/codecov.yml` contains only `comment.require_changes` and `component_management` — no `coverage.status.project/patch` target. Nothing in CI fails on a coverage drop.

<details><summary><strong>Empirical evidence</strong></summary>

`bun test --coverage packages/antithrow`:
File                                           | % Funcs | % Lines | Uncovered Line #s
All files                                      |   90.00 |  100.00 |
 packages/antithrow/src/base.ts                |    0.00 |  100.00 |
 packages/antithrow/src/utils.ts               |  100.00 |  100.00 |
(no branch column; no index.ts row; no types.ts row)

`cat bunfig.toml` -> `[test]` contains only `coveragePathIgnorePatterns = ["**/dist/**"]`.
`cat .github/codecov.yml` -> `comment: require_changes: true` + `component_management:` only; no `coverage:`/`status:` block.
`cat .github/workflows/check.yml` -> `bun test --coverage --coverage-reporter=lcov` then codecov upload with `fail_ci_if_error: true` (that flag fails on *upload* errors, not on coverage regressions).
Meanwhile the measured mutation score for the same files is 84.8%, and 50% for utils.ts.

</details>

**Recommendation.** Stop treating line coverage as the quality signal. Concretely: (1) set `coverage.status.project.target` and `patch.target` in .github/codecov.yml so a drop actually fails the PR; (2) add `coverageThreshold` to `[test]` in bunfig.toml for local/pre-commit; (3) more importantly, adopt a mutation-testing gate (StrykerJS supports a bun/vitest-style command runner) with a per-file minimum, seeded from the 15 survivors enumerated here — the campaign in /tmp/.../suite-efficacy/mutate2.ts runs the whole 107-mutant matrix in about 2 minutes, so this is affordable in CI.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-runtime-matrix/rt-2` — "Crashes the process" is false in every browser and edge runtime — the error becomes console noise and the request/page succeeds

**Severity:** high · **Category:** correctness · **Verifier verdict:** unverified

**Claim.** Other auditors' highest-severity findings are phrased as "crashes the process (exit 1)". That outcome is specific to a bare CLI script on node/deno with default flags. In the three non-server environments real consumers ship to — browser main thread, browser Web Worker, and Cloudflare-Workers-class edge — a poisoned Pending produces an `unhandledrejection` event and nothing else: the page stays fully interactive, the worker stays alive, and the edge request returns HTTP 200 with a normal body. The library-generated error is downgraded from "fatal" to "a red line in devtools that nobody reads", which is strictly worse for the library's stated goal of making errors impossible to lose. Any finding that relies on the crash as the safety net does not hold for front-end or edge consumers.

<details><summary><strong>Empirical evidence</strong></summary>

REAL CHROMIUM (dist/index.js loaded as a native ES module over HTTP):
  cmd: cd /tmp/.../runtime-matrix/domtest && /opt/node22/bin/node chromium-test.mjs
  observed:
    [pageerror] BROWSER-BOOM
    events: ["unhandledrejection: BROWSER-BOOM (cancelable=true, defaultPrevented=false)"]
    steps include: "code after poisoned Pending still executing",
                   "setTimeout(150ms) after poison still fired -> app is alive"
    evaluate 2+2 = 4   (page still responsive afterwards)
    host node process exit=0

REAL BROWSER WEB WORKER (module worker, same page):
  cmd: cd /tmp/.../runtime-matrix/domtest && PROBE=probe2 /opt/node22/bin/node chromium-test.mjs
  observed:
    "[webworker] worker started"
    "[webworker] unhandledrejection: WEBWORKER-BOOM"
    "[webworker] worker ALIVE 150ms after poisoned Pending"
  (contrast node:worker_threads, finding rt-6, where the worker is killed)

REAL workerd (Cloudflare Workers runtime, miniflare@3):
  cmd: cd /tmp/.../runtime-matrix/domtest && /opt/node22/bin/node mf-test.mjs
  observed:
    HTTP status = 200
    steps: ["registered global unhandledrejection listener",
            "globals: process=undefined Buffer=undefined window=undefined",
            "Ok(42).unwrap()=42", "Ok(Ok(7)).flatten().unwrap()=7", "Err.unwrap threw UnwrapError",
            "poisoned isPending=true",
            "request handler STILL ALIVE 100ms after poisoned Pending"]
    events: ["unhandledrejection: EDGE-BOOM"]
  The request completed successfully while an error the library manufactured was thrown away.

</details>

**Recommendation.** Two things. (1) Correct the severity language in the docs and in any finding that says "crashes the process": the actual guarantee is "surfaces as an unhandled rejection, whose consequence is environment-defined", ranging from process death to nothing at all. (2) Give the library its own safety net rather than borrowing the host's: attach a `.then(undefined, noop)` sentinel inside the `Pending` constructor so the promise is never *technically* unhandled, and track consumption explicitly — e.g. a `Pending` that is garbage-collected without ever having been awaited/settled reports through a user-installable `Result.onDroppedError(cb)` hook (FinalizationRegistry is available on every runtime measured; see rt-9). That converts a runtime-dependent lottery into one deterministic, library-owned diagnostic.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-runtime-matrix/rt-3` — On node, the crash is defeated by a global unhandledRejection handler or one CLI flag — under --unhandled-rejections=none the error vanishes with zero diagnostic

**Severity:** high · **Category:** correctness · **Verifier verdict:** unverified

**Claim.** Even on node, the "process crashes so you'll notice" backstop evaporates in the two most common production configurations. (a) Any process that has registered `process.on("unhandledRejection", ...)` — which is standard boilerplate in essentially every long-lived server and every framework that wants graceful shutdown — exits 0 and keeps running; if that handler is a no-op or a filtered logger, the antithrow error produces no output whatsoever. (b) `--unhandled-rejections=none` (also accepted by bun) produces exit 0 and literally zero bytes about the error. (c) `--unhandled-rejections=warn` produces exit 0 with a warning that runs to completion. (d) On node 14 the default was already warn-only: exit 0. So "the process crashes" is true only for a bare script, on node >=16 / deno, with default flags and no handler installed. This is the environment class where a library-generated error disappears entirely, which is the exact failure the library exists to prevent.

<details><summary><strong>Empirical evidence</strong></summary>

GLOBAL HANDLER (identical on node 18.20.8 / 20.20.2 / 22.22.2 / 24.19.0 / bun 1.3.11):
  cmd: <runtime> /tmp/.../runtime-matrix/global-handler.mjs silent
  observed: exit=0, output is only:
    [start] runtime=node v22.22.2 handler=silent
    [info] made Pending: true
    [end] process survived; no crash
  (with handler=logging the same run adds "[handler] caught: HANDLER-BOOM" and still exit=0)

CLI FLAG MODES (poison-never-awaited; identical across node 18/20/22/24):
  cmd: <node> --unhandled-rejections=<mode> /tmp/.../runtime-matrix/battery.mjs poison-never-awaited
    strict               -> exit=1 reachedDone=0
    throw                -> exit=1 reachedDone=0
    warn                 -> exit=0 reachedDone=1
    warn-with-error-code -> exit=1 reachedDone=1
    none                 -> exit=0 reachedDone=1
  Full stdout under `none` on node 22.22.2 — nothing about BOOM at all:
    [start] runtime=node v22.22.2 scenario=poison-never-awaited
    [info] created Pending: Pending isPending: true
    [end] reached end of script
    [done] script completed normally
    -- exit=0 --
  bun 1.3.11 accepts the same flag with the same silent result.

NODE 14 DEFAULT:
  cmd: npx --yes node@14 /tmp/.../runtime-matrix/battery.mjs poison-never-awaited  -> exit=0
  observed: "(node:11278) UnhandledPromiseRejectionWarning: Error: BOOM-never-awaited" ... then
            "[end] reached end of script" / "[done] script completed normally"

</details>

**Recommendation.** Do not rely on the host's unhandled-rejection policy as the library's error-loss backstop; it is a per-deployment configuration knob, not a guarantee. Same remedy as rt-2: own the diagnostic. Concretely — (i) document in the Pending reference that a Pending which is never awaited/settled is subject to the host's unhandled-rejection policy and may be silently discarded, listing the `--unhandled-rejections` matrix; (ii) ship the `no-unused-result` ESLint rule as part of the recommended install for the core package specifically because the runtime cannot be trusted to catch this; (iii) add an opt-in `Result.onDroppedError` hook so that servers which have already claimed `process.on("unhandledRejection")` still get antithrow errors routed somewhere.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.

---

### `probe-runtime-matrix/rt-4` — for-of / for-await over a Result throws a bare Error("Unreachable: generator should have been halted"), contradicting the documented "UnwrapError is the one exception antithrow throws"

**Severity:** high · **Category:** correctness · **Verifier verdict:** unverified

**Claim.** `Err[Symbol.iterator]` yields `this` and then throws `new Error("Unreachable: generator should have been halted")`. That line is only unreachable when the consumer is `Result.do`, which halts the generator. Any *other* iteration protocol reaches it — an ordinary `for (const x of someResult)` on an Err, or `for await (const x of somePending)` that resolves Err. What escapes is a plain `Error` with an internal-invariant message, not an `UnwrapError`, so `catch (e) { if (e instanceof UnwrapError) ... }` — the pattern the docs teach — does not match it, and the message is meaningless to a user. This directly contradicts the shipped documentation, whose front-matter for apps/docs/docs/explanation/error-typing-philosophy.md reads "...and why UnwrapError is the one exception antithrow throws." Separately and just as bad: `for await` over a Pending that resolves **Ok** iterates ZERO times and yields nothing, silently — the success value is unreachable through that protocol with no error at all. `Result` and `Pending` are both publicly iterable, so nothing stops a consumer from writing either loop.

<details><summary><strong>Empirical evidence</strong></summary>

cmd: <runtime> /tmp/.../runtime-matrix/primitives.mjs
Identical on node 16.20.2, 18.20.8, 20.20.2, 22.22.2, 24.19.0, bun 1.3.11, deno 2.9.5:
  [UNDOCUMENTED-BUT-NATURAL pattern: for await over a Pending]
    for await (Ok-resolving Pending)           iterated 0 time(s), values=[]
    for await (Err-resolving Pending)          THREW Error: Unreachable: generator should have been halted
  [for..of over a settled Result outside Result.do]
    for..of (Ok)                               iterated 0 time(s)
    for..of (Err)                              THREW Error: Unreachable: generator should have been halted

REAL CHROMIUM, same result plus the instanceof check:
  cmd: cd /tmp/.../runtime-matrix/domtest && PROBE=probe2 /opt/node22/bin/node chromium-test.mjs
  observed: "for..of(Err) THREW Error: \"Unreachable: generator should have been halted\" | instanceof UnwrapError = false"

Source: /home/user/antithrow/packages/antithrow/src/err.ts:121-124
  *[Symbol.iterator](): Generator<Err<T, E>, never, void> {
      yield this;
      throw new Error("Unreachable: generator should have been halted");
  }
Doc claim: apps/docs/docs/explanation/error-typing-philosophy.md:3 — "description: What \"errors in the type system\" means, and why UnwrapError is the one exception antithrow throws."

</details>

**Recommendation.** The iterator protocol here is an implementation detail of `Result.do` that has leaked into the public surface. Either (a) make the leak safe — throw an `UnwrapError` (or a dedicated exported `ResultProtocolError`) with a message that tells the user what they actually did wrong, e.g. "Result is only iterable inside Result.do(); use isErr()/unwrapOr() to consume it directly", so the documented "only UnwrapError escapes" claim becomes true again; or (b) hide it — move the protocol to a private `Symbol.for("antithrow.chain")` iterator that `Result.do` looks for, and drop `Symbol.iterator`/`Symbol.asyncIterator` from the public types entirely so `for..of` over a Result is a compile error. (b) is the stronger fix and also removes the silent zero-iteration Ok case, which (a) does not. Either way the zero-iteration behaviour for Ok must not stay as-is: silently yielding nothing for a successful Result is precisely the class of invisible data loss the library is built to eliminate.

> ⚠️ **Unverified**: the independent verification agent for this batch did not complete (session limit); the finding is reported as-audited but was not adversarially re-tested.
