---
title: jwk
description: Non-throwing wrappers around jose's JWK utilities.
sidebar_position: 5
---

# `@antithrow/jose/jwk`

Subpath: `@antithrow/jose/jwk`

Non-throwing wrappers for embedded-JWK key resolution and JWK thumbprint computation.

## Exports

| Export | Signature |
| --- | --- |
| `embeddedJWK` | `<T = KeyLike>(protectedHeader?, token?) => ResultAsync<T, errors.JWSInvalid \| errors.JOSENotSupported \| TypeError>` |
| `calculateJwkThumbprint` | `(jwk, digestAlgorithm?) => ResultAsync<string, errors.JWKInvalid \| errors.JOSENotSupported>` |
| `calculateJwkThumbprintUri` | `(jwk, digestAlgorithm?) => ResultAsync<string, errors.JWKInvalid \| errors.JOSENotSupported>` |

`embeddedJWK` is a `GetKeyFunction` suitable for use with `jwtVerify` / `compactVerify` / `flattenedVerify` / `generalVerify`.

## Throws

Never.

## Example

```ts
import { calculateJwkThumbprint } from "@antithrow/jose/jwk";

const thumbprint = await calculateJwkThumbprint(jwk);
if (thumbprint.isOk()) {
	console.log(thumbprint.value);
}
```
