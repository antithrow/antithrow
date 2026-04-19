---
title: Go async with Pending
description: Fetch the configuration file over the network without throwing.
sidebar_position: 4
---

# Go async with Pending

The standard `fetch` throws on network errors. `@antithrow/std` re-exports it as a function that returns a `Result` instead. Asynchronous results have a third shape: `Pending`.

## Fetch the configuration

Swap the entry file over to fetching a remote file. Update `src/index.ts`:

```ts title="src/index.ts"
import { Err, Ok, type Result } from "antithrow";
import { fetch, Response } from "@antithrow/std";

function parsePort(raw: string): Result<number, "invalid-port"> {
	const port = Number(raw);

	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		return new Err("invalid-port");
	}

	return new Ok(port);
}

const config = await parsePort("8080")
	.map((port) => `http://localhost:${port}/config.json`)
	.andThen((url) => fetch(url))
	.andThen((response) => Response.json(response));
```

Three things are new:

1. `fetch(url)` returns a result whose asynchronous branch is `Pending`. Because `Pending` is `PromiseLike`, the whole chain becomes `Pending` once a `.andThen` returns one.
2. `Response.json(response)` reads the body and returns another `Pending`. It is safe to chain them because `andThen` threads errors through.
3. `await` on a `Pending` hands back a settled `Ok` or `Err`, so `config` has the type `Settled<unknown, …>` at the end.

## Inspect the outcome

Log the settled state as usual.

```ts title="src/index.ts"
if (config.isOk()) {
	console.log("got config:", config.value);
} else if (config.isErr()) {
	console.log("failed:", config.error);
}
```

Start any local server serving a JSON file at `http://localhost:8080/config.json` and run:

```bash
npx tsx src/index.ts
```

If the server is reachable, you will see the parsed JSON printed. If it is not, you will see the network error — captured, not thrown.

## Why Pending and not Promise

`Pending<T, E>` looks and acts like a promise: you can `await` it. The difference is that antithrow never rejects the underlying promise. A network failure produces `Err(TypeError)` that you can branch on, not an exception that bubbles up. That is why this whole pipeline needed no `try` / `catch`.

## API details

- [`Pending`](../reference/antithrow/pending)
- [`fetch`](../reference/std/fetch)
- [`Response`](../reference/std/response)
