---
title: Build and parse URIs
description: Use the non-throwing encodeURI, encodeURIComponent, decodeURI, and decodeURIComponent wrappers.
---

# Build and parse URIs

The four built-in URI helpers all throw `URIError` on malformed input. `@antithrow/std` wraps them.

## Encode a component

```ts
import { encodeURIComponent } from "@antithrow/std";

const query = encodeURIComponent("hello world?");
if (query.isOk()) {
	const url = `/search?q=${query.value}`;
}
```

## Decode safely

```ts
import { decodeURIComponent } from "@antithrow/std";

const raw = decodeURIComponent("hello%20world");
if (raw.isErr()) {
	// Err(URIError): malformed escape sequence like a stray '%'
}
```

## Building a query string

Compose multiple components with a `Result.do` block so a single bad value fails the whole build:

```ts
import { encodeURIComponent } from "@antithrow/std";
import { Result } from "antithrow";

const query = Result.do(function* () {
	const q = yield* encodeURIComponent(search);
	const tag = yield* encodeURIComponent(tagFilter);
	return `q=${q}&tag=${tag}`;
});
```

## Prefer `URL` / `URLSearchParams` where possible

For anything beyond ad-hoc string building, construct a `URL` and use `searchParams.set` — it handles encoding for you. Reach for `encodeURIComponent` only when that isn't available.

## See also

- Reference: [URI helpers](../../reference/std/uri.md)
