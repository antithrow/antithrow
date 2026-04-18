---
title: Encode and decode base64
description: Use the non-throwing atob and btoa wrappers.
---

# Encode and decode base64

```ts
import { atob, btoa } from "@antithrow/std";

const encoded = btoa("hello");         // Ok("aGVsbG8=")
const decoded = atob("aGVsbG8=");      // Ok("hello")

const bad = atob("not-base64!!");      // Err(DOMException)
```

## When the globals throw

- `btoa(data)` throws `DOMException` ("InvalidCharacterError") if `data` contains characters outside the Latin-1 range.
- `atob(data)` throws `DOMException` for any input that isn't valid base64.

Both wrappers capture these as `Err(DOMException)`.

## Binary data

Neither global works directly on raw bytes. If you have a `Uint8Array`:

```ts
import { btoa } from "@antithrow/std";

const binary = String.fromCharCode(...bytes);
const b64 = btoa(binary);
```

## See also

- Reference: [`atob` / `btoa`](../../reference/std/base64.md)
