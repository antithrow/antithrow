---
title: structuredClone
description: Non-throwing wrapper around globalThis.structuredClone.
sidebar_position: 4
---

# `structuredClone`

Package: `@antithrow/std`

Non-throwing wrapper around `globalThis.structuredClone`.

## Signature

```ts
function structuredClone<T>(
	value: T,
	options?: StructuredSerializeOptions,
): Result<T, DOMException>;
```

| Argument | Type | Description |
| --- | --- | --- |
| `value` | `T` | Value to clone. |
| `options` | `StructuredSerializeOptions` | Optional transfer options. |

Returns `Ok(cloned)` on success, `Err(DOMException)` when `value` contains non-cloneable data (functions, symbols, DOM nodes without transfer).

## Throws

Never.

## Example

```ts
import { structuredClone } from "@antithrow/std";

const clone = structuredClone({ nested: { value: 1 } });
const bad = structuredClone(() => {}); // Err(DOMException)
```
