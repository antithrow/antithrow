---
title: util
description: Non-throwing wrappers around jose's base64url and header-decoding utilities.
sidebar_position: 7
---

# `@antithrow/jose/util`

Subpath: `@antithrow/jose/util`

Low-level utilities re-exported from `jose` with non-throwing semantics.

## `base64url`

```ts
namespace base64url {
	function encode(input: Uint8Array | string): Result<string, TypeError>;
	function decode(input: string): Result<Uint8Array, TypeError>;
}
```

`encode` produces URL-safe base64 (no padding). `decode` is the inverse and fails on non-base64url input.

## `decodeProtectedHeader`

```ts
function decodeProtectedHeader(
	token: string | object,
): Result<ProtectedHeaderParameters, errors.JWSInvalid>;
```

Decodes the protected header from a compact, flattened, or general JWS/JWE without verifying signatures or decrypting.

## Throws

Never.

## Example

```ts
import { base64url, decodeProtectedHeader } from "@antithrow/jose/util";

const encoded = base64url.encode("hello");
const header = decodeProtectedHeader(token);
```
