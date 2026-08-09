# Performance & bundle-size audit: `antithrow` (core package)

Companion to [`REVIEW.md`](./REVIEW.md). Scope: `packages/antithrow`'s modern tri-state API, measured as consumers experience it — the built `dist/` output.

**Methodology.** Every claim below is backed by a benchmark in [`review-benchmarks/`](./review-benchmarks/) (mitata 1.x), run on **both Node 22.22 (V8)** and **Bun 1.3.11 (JSC)** on the same machine. Candidate optimizations were prototyped as patched copies of `dist/` and validated for behavioral parity (`verify-variants.mjs` — including `Result.do` fail-fast + `finally` cleanup semantics) before being measured. Microbenchmarks with fixed inputs are vulnerable to constant folding (V8 collapsed one try/catch baseline to 0.4 ns); every conclusion below is cross-checked against varied-input suites, and numbers known to be affected are flagged. Numbers are averages; treat anything within ±20% as a tie — JIT variance at the nanosecond scale is real, and several results flip between engines.

---

## 1. Bundle size

Measured with `bun build --minify --format=esm` against `dist/`, gzip via `gzip -c | wc -c`.

| Import shape | Minified | Gzipped |
|---|---|---|
| Full modern API (`Ok`, `Err`, `Pending`, `Result`, `UnwrapError`) | 3,109 B | **901 B** |
| `import { Ok }` only | 2,622 B | 729 B |
| `import { Result }` only | 3,062 B | 886 B |
| Legacy API (`antithrow/legacy`, full) | 4,346 B | 1,156 B |
| *neverthrow 8.x (full), for context* | *6,905 B* | *2,087 B* |

Package artifact: tarball **15.48 KB** packed / 90.64 KB unpacked (mostly `.d.ts`; the runtime JS for the modern API is 8.7 KB unminified *with* its retained JSDoc comments). `publint` clean, `sideEffects: false` present, legacy is a separate entrypoint that a root import never pulls in.

**Findings:**

1. **Size is a genuine strength — 2.3× smaller than neverthrow gzipped.** Nothing needs fixing. Worth stating on the README/docs since the number is marketable.
2. **Tree-shaking is mostly ineffective within the package** — importing only `Ok` still ships 84% of the full bundle, because `ok.js` value-imports `Err` and `Pending` (for `map`'s Pending path and `flatten`'s `instanceof` checks), which import `base.js`/`errors.js` in turn. At 901 B total this is *not worth restructuring*; noted so nobody spends effort "fixing" it for a ≤172 B best-case saving.
3. **JSDoc comments are retained in `dist/*.js`** (~13 blocks/file). Consumer bundlers strip them, so this only affects unpacked npm size (~a few KB). Adding `"removeComments": true` to `tsconfig.build.json` is optional; `.d.ts` files (where editors read docs from) keep theirs either way.

---

## 2. Cost of the core primitives

Per-operation averages (smaller = better):

| Operation | Node 22 | Bun | Notes |
|---|---|---|---|
| `new Ok(i)` | 17.0 ns | 9.9 ns | see §4.1 for why it's slower than legacy |
| legacy `ok(i)` | 7.8 ns | 8.8 ns | |
| plain `{ok: true, value}` literal | 8.2 ns | 7.0 ns | |
| `Ok.map(fn)` (allocates) | 15.6 ns | 9.4 ns | |
| `Err.map(fn)` (returns `this`) | **0.6 ns** | **0.6 ns** | the reuse-`this` design pays off: propagating an existing `Err` through a chain step is free |
| `unwrapOr` / `isOk()+.value` / `mapOrElse` | ~0.5 ns | 5–11 ns | fully inlined by V8 |
| `Ok.settle()` | 9.9 ns | 8.7 ns | identical to bare `Promise.resolve(x)` (9.8 ns / 9.5 ns) — **no caching optimization is warranted**; the cost *is* the promise allocation |

Takeaway: settled-result plumbing costs single-digit nanoseconds per step. A 3-step `andThen` chain with varied inputs (10% failures) runs at **~50 ns/op on Node, ~54 ns/op on Bun** end to end.

---

## 3. Results-vs-exceptions, quantified (the library's core bet)

**Throwing is the expensive thing.** A single `throw` through 2 frames costs ~170 ns (Node) to ~3.3 µs (Bun) — versus ~10 ns to propagate an `Err` through the same chain. Varied-input suites:

**3-step parse/validate chain, 10% bad inputs** (`ab.mjs`):

| Approach | Node | Bun |
|---|---|---|
| `andThen` chain | **50.6 ns** | **53.5 ns** |
| try/catch equivalent | 189.4 ns | 103.6 ns |

**10k-record batch validation** (`batch.mjs`):

| Error rate | Result chain | try/catch | hand-rolled if/continue |
|---|---|---|---|
| 10% (Node) | 572 µs | 507 µs | 335 µs |
| 10% (Bun) | 799 µs | 1.23 ms | 616 µs |
| 50% (Node) | 439 µs | **1.10 ms** | 260 µs |
| 50% (Bun) | 485 µs | **3.04 ms** | 400 µs |

Reading: against try/catch, Results win everywhere on Bun and win increasingly with error rate on Node (break-even ≈ low-single-digit % error rate; 2.5× faster at 50%). The fully hand-rolled imperative version is always fastest (Results cost 1.3–1.7× over it) — that's the price of the abstraction, and it's modest. These are honest, quotable numbers for the docs.

`Result.try` overhead over a bare try/catch statement: ~1.2× on the success path of a `JSON.parse` call (242 vs 197 ns on Node — mostly `JSON.parse` itself), and **zero** on the throwing path (1.9 µs vs 1.9 µs Bun, 7.97 vs 7.90 µs Node — exception machinery dwarfs the wrapper).

---

## 4. A/B-tested optimization candidates

Each was hypothesized, prototyped as a patched `dist` (`make-variants.py`), parity-verified, then measured. Three of four are **negative results** — documented so future effort isn't wasted re-deriving them.

### 4.1 Construction is ~1.5× slower than legacy — cause found, fix **not** recommended ❌

The emitted modern constructor is:

```js
export class Ok extends ResultBase {
    value;              // field pre-init (from the constructor parameter property
    constructor(value) { //  under useDefineForClassFields)
        super();         // ResultBase is runtime-empty
        this.value = value;
    }
```

The legacy class emits neither line. A `lean` variant matching the legacy shape (no `extends`/`super`, no field pre-init) closes the gap exactly in isolation — 10.5 ns vs 17.0 ns stock on Node (1.65×), 7.5 vs 9.5 ns on Bun (1.26×), indistinguishable from the legacy class.

**But it does not survive end-to-end benchmarks** (`lean-e2e.mjs`): on Node the lean build is 1.42× *slower* on the 3-step varied-input chain (55 vs 39 ns) and 1.28× slower on the 10k batch (793 vs 619 µs); on Bun it's ±10% either way depending on workload. An intermediate variant (`noext`: remove `extends` only) was also neutral-to-slower. Whatever the JIT-level mechanism, the "obvious" source change (dropping `ResultBase`/parameter properties) does **not** reliably help real workloads and is sometimes a regression. **Recommendation: leave the class structure alone**; revisit only with profile evidence from a real application.

### 4.2 Hand-written iterators instead of generator methods ❌

Hypothesis: `yield*` allocating a generator per delegation (`Ok`/`Err` `[Symbol.iterator]`, `Pending` `[Symbol.asyncIterator]`) is a meaningful share of `Result.do` cost; hand-written iterator objects should be cheaper.

Measured (`ab.mjs`, `Result.do` sync 3-step, varied inputs): stock 3.35 µs → fastiter 3.42 µs on Node (no change); 1.73 → 1.52 µs on Bun (~12%, within variance across runs). Async request-handler shape: ≤10% either engine. The user's own generator function and the driver dominate; our iterator allocations are noise. **Not worth the code-clarity cost.**

### 4.3 Hoisting `fromPromise`'s per-call closures ✅ (small, free)

`src/result.ts:23-30` allocates two arrow closures on every `fromPromise` call. Hoisting them to module scope (`wrapOk`/`wrapErr`) measured **1.2× faster on Node** (304 vs 364 ns for wrap + settle + await), neutral on Bun. Two-line, zero-risk change; worth taking, with the caveat that it's ~60 ns on an operation that inherently involves promise machinery.

### 4.4 Caching `Ok.settle()`/`Err.settle()` promises ❌ (not needed)

Measured: `settle()` is already indistinguishable from bare `Promise.resolve(x)` (§2). Caching would only help code that settles the *same instance* repeatedly — not a pattern worth optimizing for. Skip.

---

## 5. `Result.do` — the one genuinely expensive primitive

`Result.do` is **20–100× slower than the equivalent `andThen` chain or imperative early-return code**, consistently across engines (`do-generator.mjs`, `ab.mjs`):

| 3-step composition (same logic) | Node | Bun |
|---|---|---|
| imperative `isOk()` early-return | 14.5 ns | ~11 ns |
| `andThen` chain | 15.1 ns | ~12 ns |
| legacy `chain()` | 1.11 µs | ~1.2 µs |
| `Result.do` + `yield*` (fixed input) | 1.26 µs | ~1.1 µs |
| `Result.do` + `yield*` (varied inputs, 10% err) | 3.35 µs | 1.73 µs |
| 10× `yield*` loop vs 10× plain calls | 206× slower | 166× slower |

The cost is inherent: each invocation allocates and drives a generator (plus one iterator per `yield*` delegation), and §4.2 shows the library-side share is negligible — this is the price of generator-based do-notation in JS, not an implementation defect. The async form adds async-generator machinery on top: the 3-async-step request handler costs **~4 µs via async `Result.do`** vs ~850 ns as a `Pending`/`andThen` chain vs ~280 ns as native async/await + try/catch (Node).

**Recommendations (docs, not code):**
- Position `Result.do` as an *orchestration-level* tool (request handlers, workflows) where 1–4 µs vanishes next to any I/O — and steer hot loops (per-record parsing/validation, tight sync pipelines) toward `andThen`/`map` chains or `isOk()` early-returns, which are within 1.3–1.7× of hand-rolled code.
- The batch suite makes the threshold concrete: at 10k records, a `Result.do`-per-record design would add ~30 ms (Node) where the `andThen` design adds ~0.2 ms.

## 6. Async plumbing overhead

From `async.mjs` (Node / Bun):

| Operation | antithrow | native baseline | Overhead |
|---|---|---|---|
| wrap + await one async value | 384 / 642 ns (`fromPromise`) | 148 / 225 ns (bare `await`) | ~2.7× (≈240–420 ns absolute) |
| 3-step async transform | 707 ns / 1.04 µs (`Pending` map×3) | 144 / 223 ns (async/await) | ~4.7× |
| 3-step request handler | 843 ns / 1.42 µs (`andThen` chain) | 277 / 401 ns (async/await + try/catch) | ~3× happy path; **~parity on the failure path** (548 vs 476 ns Node — throwing erases the gap) |

Modern `Pending` chains are ~2× faster than legacy `ResultAsync` chains (707 ns vs 1.39 µs on Node) — the rewrite improved this. Absolute overhead is hundreds of nanoseconds per wrapped operation: irrelevant next to any real I/O (a 1 ms fetch is 2,500× larger), only visible when wrapping already-resolved promises in tight loops.

**One user-actionable finding: `await pending` is 1.6–1.75× slower than `await pending.settle()`** (402 vs 257 ns Node; 610 vs 349 ns Bun). Awaiting the `Pending` directly goes through its `then()` → inner `promise.then` (an extra thenable-assimilation hop), while `settle()` hands the engine the underlying promise. The README's examples already use `.settle()` at the boundary — good; worth making the recommendation explicit in the `Pending` docs.

---

## 7. Summary of recommended actions

| # | Action | Kind | Evidence |
|---|---|---|---|
| 1 | Hoist `fromPromise` callbacks to module scope | code (2 lines) | §4.3, 1.2× on Node |
| 2 | Document `Result.do`'s cost model and steer hot loops to `andThen`/`isOk` | docs | §5, 20–100× |
| 3 | Document `await pending.settle()` > `await pending` for hot paths | docs | §6, 1.6–1.75× |
| 4 | Publish the size/perf numbers (901 B gz; 2.5× faster than try/catch at 50% errors; failure propagation ~free) | docs/marketing | §1, §3 |
| 5 | Do **not** restructure classes, iterators, or `settle()` for speed | negative results, recorded | §4.1, §4.2, §4.4 |
| 6 | Optional: `removeComments` in `tsconfig.build.json` | packaging | §1.3 |

The overall picture is healthy: the library's core claim — failure paths that cost nanoseconds instead of microseconds — is true and now quantified; the settled-path abstraction costs ~1.3–1.7× over hand-rolled imperative code; the one expensive construct (`Result.do`) is expensive for reasons inherent to JS generators, at an absolute cost that's fine at its intended altitude.
