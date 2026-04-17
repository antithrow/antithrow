---
sidebar_position: 4
title: "@antithrow/std"
description: "Non-throwing wrappers around standard JavaScript globals"
---

# @antithrow/std

Non-throwing wrappers around standard JavaScript globals. Each function mirrors its built-in counterpart but returns a `Result` or `ResultAsync` instead of throwing.

## Installation

```bash npm2yarn
npm install @antithrow/std
```

## JSON

### JSON.parse()

```ts
JSON.parse<T = unknown>(
	text: string,
	reviver?: (key: string, value: unknown) => unknown,
): Result<T, SyntaxError>
```

Parses a JSON string. Returns `Err<SyntaxError>` for malformed input.

```ts
import { JSON } from "@antithrow/std";

JSON.parse<{ name: string }>('{"name": "Alice"}');
// ok({ name: "Alice" })

JSON.parse("invalid json");
// err(SyntaxError)
```

### JSON.stringify()

```ts
JSON.stringify(
	value: unknown,
	replacer?: JsonStringifyReplacer,
	space?: string | number,
): Result<string | undefined, TypeError>
```

Converts a value to a JSON string. Returns `Err<TypeError>` for circular references. Returns `Ok<undefined>` for non-serializable top-level values (e.g., `undefined`, `symbol`, functions).

```ts
import { JSON } from "@antithrow/std";

JSON.stringify({ a: 1 });
// ok('{"a":1}')

const circular: Record<string, unknown> = {};
circular.self = circular;
JSON.stringify(circular);
// err(TypeError)
```

## fetch

### fetch()

```ts
fetch(
	input: string | URL | Request,
	init?: RequestInit,
): ResultAsync<Response, DOMException | TypeError>
```

Wraps `globalThis.fetch`. Non-2xx responses are `Ok` — only network errors and aborts become `Err`.

```ts
import { fetch } from "@antithrow/std";

const result = await fetch("https://api.example.com/users");
// Ok<Response> (even for 404, 500, etc.)
// Err<DOMException | TypeError> (network failure, abort, etc.)
```

:::note
Non-2xx status codes are **not** errors. If you want to treat them as errors, use `andThen`:

```ts
fetch("https://api.example.com/users").andThen((response) => {
  if (!response.ok) {
    return err({ status: response.status, statusText: response.statusText });
  }
  return ok(response);
});
```

:::

## Response

Functional wrappers around `Response` body-reading methods. Each accepts a `Response` object and returns a `ResultAsync`.

### Response.json()

```ts
Response.json<T = unknown>(
	response: Response,
): ResultAsync<T, DOMException | TypeError | SyntaxError>
```

Parses the response body as JSON.

```ts
import { fetch, Response } from "@antithrow/std";

const result = await fetch("https://api.example.com/users").andThen((r) =>
  Response.json<User[]>(r),
);
```

### Response.text()

```ts
Response.text(
	response: Response,
): ResultAsync<string, DOMException | TypeError>
```

Reads the response body as text.

```ts
import { Response } from "@antithrow/std";

const result = await Response.text(response);
```

### Response.arrayBuffer()

```ts
Response.arrayBuffer(
	response: Response,
): ResultAsync<ArrayBuffer, DOMException | TypeError | RangeError>
```

Reads the response body as an `ArrayBuffer`.

### Response.blob()

```ts
Response.blob(
	response: Response,
): ResultAsync<Blob, DOMException | TypeError>
```

Reads the response body as a `Blob`.

### Response.formData()

```ts
Response.formData(
	response: Response,
): ResultAsync<FormData, DOMException | TypeError>
```

Reads the response body as `FormData`.

## Base64

### atob()

```ts
atob(data: string): Result<string, DOMException>
```

Decodes a base64-encoded string.

```ts
import { atob } from "@antithrow/std";

atob("SGVsbG8="); // ok("Hello")
atob("!!!!"); // err(DOMException)
```

### btoa()

```ts
btoa(data: string): Result<string, DOMException>
```

Encodes a string to base64.

```ts
import { btoa } from "@antithrow/std";

btoa("Hello"); // ok("SGVsbG8=")
btoa("🙂"); // err(DOMException) — non-Latin1 characters
```

## URI

### decodeURI()

```ts
decodeURI(encodedURI: string): Result<string, URIError>
```

Decodes a percent-encoded URI.

```ts
import { decodeURI } from "@antithrow/std";

decodeURI("https://example.com/hello%20world");
// ok("https://example.com/hello world")
```

### decodeURIComponent()

```ts
decodeURIComponent(encodedURIComponent: string): Result<string, URIError>
```

Decodes a percent-encoded URI component.

```ts
import { decodeURIComponent } from "@antithrow/std";

decodeURIComponent("hello%20world"); // ok("hello world")
decodeURIComponent("%E0%A4%A"); // err(URIError) — malformed
```

### encodeURI()

```ts
encodeURI(uri: string): Result<string, URIError>
```

Encodes a URI, preserving special URI characters.

```ts
import { encodeURI } from "@antithrow/std";

encodeURI("https://example.com/hello world");
// ok("https://example.com/hello%20world")
```

### encodeURIComponent()

```ts
encodeURIComponent(
	uriComponent: string | number | boolean,
): Result<string, URIError>
```

Encodes a URI component.

```ts
import { encodeURIComponent } from "@antithrow/std";

encodeURIComponent("hello world"); // ok("hello%20world")
```

## Structured Clone

### structuredClone()

```ts
structuredClone<T>(
	value: T,
	options?: StructuredSerializeOptions,
): Result<T, DOMException>
```

Deep clones a value using the structured clone algorithm.

```ts
import { structuredClone } from "@antithrow/std";

structuredClone({ a: 1, b: [2, 3] }); // ok({ a: 1, b: [2, 3] })
structuredClone(() => {}); // err(DOMException) — functions not cloneable
```
