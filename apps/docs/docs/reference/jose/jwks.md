---
title: jwks
description: Non-throwing wrappers around jose's local and remote JWK set resolvers.
sidebar_position: 6
---

# `@antithrow/jose/jwks`

Subpath: `@antithrow/jose/jwks`

Non-throwing wrappers for JSON Web Key Sets (JWKS).

## Exports

| Export | Signature |
| --- | --- |
| `createLocalJWKSet` | `(jwks: JSONWebKeySet) => Result<GetKeyFunction, errors.JWKSInvalid>` |
| `createRemoteJWKSet` | `(url: URL, options?: RemoteJWKSetOptions) => Result<GetKeyFunction, TypeError>` |

Both return a `GetKeyFunction` compatible with `jwtVerify`, `compactVerify`, `flattenedVerify`, and `generalVerify`.

The returned `GetKeyFunction` itself returns `ResultAsync` at invocation time when invoked internally by the verify functions — callers typically do not call it directly.

## Throws

Never.

## Example

```ts
import { createRemoteJWKSet } from "@antithrow/jose/jwks";
import { jwtVerify } from "@antithrow/jose/jwt";

const jwks = createRemoteJWKSet(new URL("https://issuer.example.com/.well-known/jwks.json"));

if (jwks.isOk()) {
	const verified = await jwtVerify(token, jwks.value);
}
```
