---
title: Fetch JSON safely
description: Perform an HTTP request and decode the body without any throwing API in the path.
---

# Fetch JSON safely

Use `@antithrow/std`'s `fetch` and `Response.json()` so every network and parsing failure is a typed error.

## The recipe

```ts
import { Err, Result } from "antithrow";
import { fetch, Response } from "@antithrow/std";

const data = await Result.do(async function* () {
	const res = yield* fetch("https://api.example.com/user");

	if (!res.ok) {
		yield* new Err({ kind: "http", status: res.status } as const);
	}

	const body = yield* Response.json<User>(res);
	return body;
});

if (data.isOk()) {
	use(data.value);
}
```

## Why both `fetch` and `Response.json`

The globals throw in two different places:

- `fetch()` rejects on DNS, TLS, CORS, aborts.
- `Response.json()` throws `SyntaxError` on a non-JSON body (e.g. an HTML error page).

`@antithrow/std` wraps both so neither can blow past your handler.

## Skipping `Result.do`

If you only need the happy path and a single error, chain instead:

```ts
const data = await fetch("/api").andThen((res) => Response.json<User>(res));
```

The error type becomes the union of `fetch`'s and `Response.json`'s — typically `TypeError | SyntaxError`.

## See also

- Reference: [`fetch`](../../reference/std/fetch.md) · [`Response`](../../reference/std/response.md)
- How-to: [Validate with Zod](../standard-schema/validate-with-zod.md)
