# Review benchmarks

Reproduces every measurement in [`../PERF_REVIEW.md`](../PERF_REVIEW.md). All suites
benchmark the **built `dist/` output** (what consumers run), via [mitata](https://github.com/evanwashere/mitata).

```sh
# from the repo root
bun run build

# from this directory
bun add mitata@1        # not part of the workspace on purpose
python3 make-variants.py  # generates ./variants/* for ab/construct2/lean-e2e
node verify-variants.mjs  # behavioral parity check for the patched variants

# suites (run each with both runtimes)
node sync-core.mjs && bun sync-core.mjs
node do-generator.mjs && bun do-generator.mjs
node async.mjs && bun async.mjs
node batch.mjs && bun batch.mjs
node ab.mjs && bun ab.mjs
node construct.mjs && node construct2.mjs
node lean-e2e.mjs && bun lean-e2e.mjs
```

Suites:

- `sync-core.mjs` — construction, single map, 3-step chains vs try/catch and the legacy API, `Result.try`, consumption, `settle()`.
- `do-generator.mjs` — `Result.do` vs `andThen` chains vs imperative early-return; 10-step chains.
- `async.mjs` — `fromPromise`, `Pending` chains, async `Result.do` request-handler shapes vs native async/await; `await pending` vs `await pending.settle()`.
- `batch.mjs` — 10k-record validation pipelines at 10% / 50% error rates (varied inputs; the most trustworthy suite).
- `ab.mjs`, `construct.mjs`, `construct2.mjs`, `lean-e2e.mjs` — A/B tests of candidate optimizations against patched `dist` copies (see `make-variants.py`).

Caveat: in `sync-core.mjs`/`do-generator.mjs` some fixed-input baselines get constant-folded
by V8 (sub-nanosecond timings are the tell). Cross-check any conclusion against the
varied-input suites (`batch.mjs`, `ab.mjs`, `lean-e2e.mjs`) before acting on it.
