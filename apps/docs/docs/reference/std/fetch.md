---
title: fetch
description: Non-throwing wrapper around globalThis.fetch.
sidebar_position: 1
---

# `fetch`

Package: `@antithrow/std`

Non-throwing wrapper around `globalThis.fetch`. Non-2xx responses are `Ok`; only network errors / rejections become `Err`.

## Signature

```ts
function fetch(
	input: string | URL | Request,
	init?: RequestInit,
): ResultAsync<Response, DOMException | TypeError>;
```

| Argument | Type | Description |
| --- | --- | --- |
| `input` | `string \| URL \| Request` | Resource to fetch. |
| `init` | `RequestInit` | Optional request configuration. |

## Returns

`ResultAsync<Response, DOMException | TypeError>` — resolves to `Ok(response)` for any completed HTTP response (including 4xx and 5xx). Network failures, CORS rejections, and `AbortError`s become `Err`.

## Throws

Never.

## Example

```ts
import { fetch } from "@antithrow/std";

const result = await fetch("https://example.com");

if (result.isOk()) {
	result.value.status; // number
} else if (result.isErr()) {
	result.error; // DOMException | TypeError
}
```
