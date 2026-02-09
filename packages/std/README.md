<div align="center">
	<h1>@antithrow/std</h1>
	<p>
		non-throwing wrappers around standard globals, powered by <a href="https://github.com/antithrow/antithrow">antithrow</a>
	</p>

![NPM Version](https://img.shields.io/npm/v/@antithrow/std)
![NPM License](https://img.shields.io/npm/l/@antithrow/std)

</div>

## Why

Standard APIs like `JSON.parse`, `fetch`, and `atob` communicate failure by throwing.
`@antithrow/std` re-exports them as thin wrappers that return `Result` or `ResultAsync` instead,
so error handling is type-safe and composable out of the box.

```ts
import { JSON, fetch, Response } from "@antithrow/std";

const config = JSON.parse<Config>(text)
  .mapErr(() => new AppError("invalid config"));

const body = await fetch("https://api.example.com/data")
  .andThen((res) => Response.json<Data>(res));
```

## Installation

```bash
bun add @antithrow/std
```

`antithrow` is a required peer/runtime dependency and will be installed automatically.

## Usage

Every export mirrors the name of the global it wraps. If you need both versions,
rename the import:

```ts
import { JSON as SafeJSON } from "@antithrow/std";

SafeJSON.parse("...");  // Result<unknown, SyntaxError>
JSON.parse("...");      // throws on invalid input
```

### JSON

```ts
import { JSON } from "@antithrow/std";

const parsed = JSON.parse<{ id: number }>('{"id": 1}');
// ok({ id: 1 })

const str = JSON.stringify({ id: 1 });
// ok('{"id":1}')

const circular: Record<string, unknown> = {};
circular["self"] = circular;
JSON.stringify(circular);
// err(TypeError)
```

### fetch

Non-2xx responses are `Ok` — only network errors and rejections become `Err`.

```ts
import { fetch } from "@antithrow/std";

const result = await fetch("https://example.com/api");
// Ok<Response> or Err<DOMException | TypeError>
```

### Response

Wraps `Response` body-reading methods (`json`, `text`, `arrayBuffer`, `blob`, `formData`).

```ts
import { fetch, Response } from "@antithrow/std";

const user = await fetch("https://api.example.com/user")
  .andThen((res) => Response.json<User>(res));
```

### structuredClone

```ts
import { structuredClone } from "@antithrow/std";

structuredClone({ a: 1 });  // ok({ a: 1 })
structuredClone(() => {});  // err(DOMException)
```

### URI encoding / decoding

```ts
import { encodeURIComponent, decodeURIComponent } from "@antithrow/std";

encodeURIComponent("hello world"); // ok("hello%20world")
decodeURIComponent("%E0%A4%A");    // err(URIError)
```

### Base64

```ts
import { atob, btoa } from "@antithrow/std";

btoa("hello");  // ok("aGVsbG8=")
atob("!!!");    // err(DOMException)
```

## API Reference

### Sync (`Result`)

| Export               | Signature                                                             | Error Type     |
| -------------------- | --------------------------------------------------------------------- | -------------- |
| `JSON.parse`         | `<T = unknown>(text, reviver?) → Result<T, SyntaxError>`              | `SyntaxError`  |
| `JSON.stringify`     | `(value, replacer?, space?) → Result<string \| undefined, TypeError>` | `TypeError`    |
| `structuredClone`    | `<T>(value, options?) → Result<T, DOMException>`                      | `DOMException` |
| `decodeURI`          | `(encodedURI) → Result<string, URIError>`                             | `URIError`     |
| `decodeURIComponent` | `(encodedURIComponent) → Result<string, URIError>`                    | `URIError`     |
| `encodeURI`          | `(uri) → Result<string, URIError>`                                    | `URIError`     |
| `encodeURIComponent` | `(uriComponent) → Result<string, URIError>`                           | `URIError`     |
| `atob`               | `(data) → Result<string, DOMException>`                               | `DOMException` |
| `btoa`               | `(data) → Result<string, DOMException>`                               | `DOMException` |

### Async (`ResultAsync`)

| Export                 | Signature                                                                       | Error Type                                 |
| ---------------------- | ------------------------------------------------------------------------------- | ------------------------------------------ |
| `fetch`                | `(input, init?) → ResultAsync<Response, DOMException \| TypeError>`             | `DOMException \| TypeError`                |
| `Response.json`        | `<T = unknown>(res) → ResultAsync<T, DOMException \| TypeError \| SyntaxError>` | `DOMException \| TypeError \| SyntaxError` |
| `Response.text`        | `(res) → ResultAsync<string, DOMException \| TypeError>`                        | `DOMException \| TypeError`                |
| `Response.arrayBuffer` | `(res) → ResultAsync<ArrayBuffer, DOMException \| TypeError \| RangeError>`     | `DOMException \| TypeError \| RangeError`  |
| `Response.blob`        | `(res) → ResultAsync<Blob, DOMException \| TypeError>`                          | `DOMException \| TypeError`                |
| `Response.formData`    | `(res) → ResultAsync<FormData, DOMException \| TypeError>`                      | `DOMException \| TypeError`                |
