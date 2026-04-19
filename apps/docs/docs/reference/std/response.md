---
title: Response
description: Non-throwing wrappers around Response body-reading methods.
sidebar_position: 3
---

# `Response`

Package: `@antithrow/std`

Non-throwing wrappers around `globalThis.Response` body-reading methods. Each accepts a `Response` and returns a `Result` that captures any rejection (invalid JSON, already-consumed body) as `Err`.

## `Response.json(response)`

```ts
Response.json<T = unknown>(
	response: Response,
): Result<T, DOMException | TypeError | SyntaxError>;
```

## `Response.text(response)`

```ts
Response.text(
	response: Response,
): Result<string, DOMException | TypeError>;
```

## `Response.arrayBuffer(response)`

```ts
Response.arrayBuffer(
	response: Response,
): Result<ArrayBuffer, DOMException | TypeError | RangeError>;
```

## `Response.blob(response)`

```ts
Response.blob(
	response: Response,
): Result<Blob, DOMException | TypeError>;
```

## `Response.formData(response)`

```ts
Response.formData(
	response: Response,
): Result<FormData, DOMException | TypeError>;
```

## Throws

Never.

## Example

```ts
import { fetch, Response } from "@antithrow/std";

const response = await fetch("/config.json");

if (response.isOk()) {
	const body = await Response.json<{ port: number }>(response.value);
}
```
