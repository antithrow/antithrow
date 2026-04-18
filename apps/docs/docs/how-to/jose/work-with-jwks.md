---
title: Work with JWKS
description: Verify JWTs issued by a third party using a remote or local JSON Web Key Set.
---

# Work with JWKS

Use `createRemoteJWKSet` when the issuer publishes a JWKS endpoint (the usual case for OIDC). Use `createLocalJWKSet` when you already have the key set in memory.

## Remote

```ts
import { createRemoteJWKSet } from "@antithrow/jose/jwks";
import { jwtVerify } from "@antithrow/jose/jwt";

const jwks = createRemoteJWKSet(
	new URL("https://issuer.example.com/.well-known/jwks.json"),
);

if (jwks.isErr()) {
	throw jwks.error; // TypeError — misconstructed URL
}

const verified = await jwtVerify(token, jwks.value, {
	issuer: "https://issuer.example.com",
	audience: "my-api",
});
```

`jwks.value` is a `GetKeyFunction` — pass it to any `jose` verify operation.

## Local (static)

```ts
import { createLocalJWKSet } from "@antithrow/jose/jwks";

const jwks = createLocalJWKSet({
	keys: [/* JWK objects */],
});

if (jwks.isErr()) {
	// errors.JWKSInvalid — the set is malformed
}
```

## Caching and rotation

`createRemoteJWKSet` caches the set and refetches on unknown-kid or cache expiry. Tune with options:

```ts
createRemoteJWKSet(url, {
	cacheMaxAge: 10 * 60_000,
	cooldownDuration: 30_000,
});
```

## See also

- Reference: [`@antithrow/jose/jwks`](../../reference/jose/jwks.md)
- Reference: [`@antithrow/jose/jwt`](../../reference/jose/jwt.md)
