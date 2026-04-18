---
title: Use Result.do
description: Use the generator syntax to write fail-fast Result pipelines that read like straight-line code.
---

# Use `Result.do`

Deep `andThen` chains get unreadable fast. `Result.do` lets you `yield*` each step and read the pipeline top-to-bottom.

## Synchronous

```ts
import { Result } from "antithrow";

const pipeline = Result.do(function* () {
	const contents = yield* readFile(path);
	const parsed = yield* parseJson(contents);
	const validated = yield* validate(parsed);
	return validated;
});
```

Each `yield*` on a `Result` unwraps an `Ok` to its value and short-circuits on `Err` — the surrounding `pipeline` is a `Result<T, E>` whose `E` is the union of every error the generator yields.

## Asynchronous

If any `yield*` is a `Pending` or `Promise`, `Result.do` returns a `Pending`:

```ts
const response = await Result.do(async function* () {
	const raw = yield* fetch("/api");
	const parsed = yield* Result.fromPromise(raw.json());
	return parsed;
});
```

Use an `async function*` generator when awaiting is required. Plain generators are fine for sync-only flows.

## When `Result.do` beats `andThen`

- More than two or three steps.
- Steps with different error types (the union is cleaner than nested `mapErr`).
- Reusing intermediate values across multiple downstream calls.

`andThen` is fine when every step flows into exactly the next one.

## See also

- Reference: [`Result.do`](../../reference/antithrow/result.md)
- How-to: [Combine results](./combine-results.md)
