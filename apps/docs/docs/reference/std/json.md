---
title: JSON
description: Non-throwing wrappers around JSON.parse and JSON.stringify.
sidebar_position: 2
---

# `JSON`

Package: `@antithrow/std`

Non-throwing wrappers around `globalThis.JSON.parse` and `globalThis.JSON.stringify`. Exported as a namespace object so imports can shadow the global without surprise.

## `JSON.parse(text, reviver?)`

```ts
JSON.parse<T = unknown>(
	text: string,
	reviver?: (this: unknown, key: string, value: unknown) => unknown,
): Settled<T, SyntaxError>;
```

| Argument | Type | Description |
| --- | --- | --- |
| `text` | `string` | JSON text to parse. |
| `reviver` | `(key, value) => unknown` | Optional reviver forwarded to the native implementation. |

Returns `Ok(value)` on success, `Err(SyntaxError)` on parse failure.

## `JSON.stringify(value, replacer?, space?)`

```ts
JSON.stringify(
	value: NonSerializableTopLevel,
	replacer?: JsonStringifyReplacer,
	space?: string | number,
): Ok<undefined, never>;

JSON.stringify(
	value: unknown,
	replacer?: JsonStringifyReplacer,
	space?: string | number,
): Settled<string | undefined, TypeError>;
```

| Argument | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Value to serialise. |
| `replacer` | `((key, value) => unknown) \| (string \| number)[] \| null` | Optional replacer function or allowlist. |
| `space` | `string \| number` | Optional indent. |

Returns `Ok(string)` on success, `Err(TypeError)` on circular references or other serialisation failures. `undefined`, symbols, and functions at the top level produce `Ok(undefined)`.

## Throws

Never.

## Example

```ts
import { JSON } from "@antithrow/std";

const parsed = JSON.parse<{ name: string }>('{"name":"Alice"}');
const serialised = JSON.stringify({ name: "Alice" });
```
