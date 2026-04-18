---
title: Transform with map and andThen
description: Build a synchronous pipeline without unwrapping in the middle.
sidebar_position: 3
---

# Transform with map and andThen

Manually checking `isOk()` after every step quickly becomes noisy. antithrow lets you transform the value inside a `Result` while preserving the error branch, so the happy path reads as a single pipeline.

## Build a pipeline

We need to turn a raw port string into a normalised `{ port, url }` record. Update `src/index.ts`:

```ts title="src/index.ts"
import { Err, Ok, type Result } from "antithrow";

function parsePort(raw: string): Result<number, "invalid-port"> {
	const port = Number(raw);

	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		return new Err("invalid-port");
	}

	return new Ok(port);
}

function buildUrl(port: number): Result<URL, "invalid-url"> {
	try {
		return new Ok(new URL(`http://localhost:${port}/config.json`));
	} catch {
		return new Err("invalid-url");
	}
}

const endpoint = parsePort("8080")
	.map((port) => ({ port }))
	.andThen((record) =>
		buildUrl(record.port).map((url) => ({ ...record, url })),
	);
```

Two methods did the heavy lifting:

- `map` transforms the value inside `Ok`, leaves `Err` unchanged. Here it wraps the number in a record.
- `andThen` chains another operation that itself returns a `Result`. If `buildUrl` fails, the whole pipeline short-circuits to its `Err`.

The type of `endpoint` is `Result<{ port: number; url: URL }, "invalid-port" | "invalid-url">`. Notice that TypeScript has accumulated every possible error across the chain.

## Observe the short-circuit

Print the outcome to confirm.

```ts title="src/index.ts"
if (endpoint.isOk()) {
	console.log(`endpoint: ${endpoint.value.url}`);
} else if (endpoint.isErr()) {
	console.log(`error: ${endpoint.error}`);
}
```

Run it:

```bash
npx tsx src/index.ts
```

You should see `endpoint: http://localhost:8080/config.json`. Change the call to `parsePort("0")` and rerun — the pipeline short-circuits and prints `error: invalid-port`, never calling `buildUrl`.

## Rename errors with mapErr

If you want a more descriptive error, transform the error branch with `mapErr`.

```ts title="src/index.ts"
const endpoint = parsePort("8080")
	.mapErr((code) => ({ code, message: "could not parse port" }))
	.map((port) => ({ port }))
	.andThen((record) =>
		buildUrl(record.port)
			.mapErr((code) => ({ code, message: "could not build url" }))
			.map((url) => ({ ...record, url })),
	);
```

The error type is now a structured object, and the happy path is untouched.

## API details

- [`map`, `mapErr`, `andThen`](../reference/antithrow/methods)
