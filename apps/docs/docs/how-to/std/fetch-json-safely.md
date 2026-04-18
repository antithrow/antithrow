---
title: Fetch JSON safely
description: Perform an HTTP request and decode the body without any throwing API in the path.
---

# Fetch JSON safely

Use `@antithrow/std`'s `fetch` and `response.json()` so every network and parsing failure is a typed error.

## The recipe

```ts
import { fetch, response } from "@antithrow/std";
import { Result } from "antithrow";

const data = await Result.do(async function* () {
	const res = yield* fetch("https://api.example.com/user");

	if (!res.ok) {
		return yield* Result.err({ kind: "http", status: res.status } as const);
	}

	const body = yield* response.json<User>(res);
	return body;
});

if (data.isOk()) {
	use(data.value);
}
```

## Why both `fetch` and `response.json`

The globals throw in two different places:

- `fetch()` rejects on DNS, TLS, CORS, aborts.
- `response.json()` throws `SyntaxError` on a non-JSON body (e.g. an HTML error page).

`@antithrow/std` wraps both so neither can blow past your handler.

## Skipping `Result.do`

If you only need the happy path and a single error, chain instead:

```ts
const data = await fetch("/api").andThen((res) => response.json<User>(res));
```

The error type becomes the union of `fetch`'s and `response.json`'s — typically `TypeError | SyntaxError`.

## See also

- Reference: [`fetch`](../../reference/std/fetch.md) · [`response`](../../reference/std/response.md)
- How-to: [Validate with Zod](../standard-schema/validate-with-zod.md)
