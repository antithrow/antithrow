---
title: Sign and verify a JWT
description: Produce a signed JWT and verify it without try/catch.
---

# Sign and verify a JWT

## Sign

Build the JWT with `jose`'s `SignJWT` builder, then hand it to `signJwt` to sign safely.

```ts
import { SignJWT } from "jose";
import { signJwt } from "@antithrow/jose/jwt";

const builder = new SignJWT({ sub: "user-123" })
	.setProtectedHeader({ alg: "HS256" })
	.setIssuedAt()
	.setExpirationTime("2h");

const signed = await signJwt(builder, secret);
if (signed.isOk()) {
	transmit(signed.value);
}
```

## Verify with a shared secret

```ts
import { jwtVerify } from "@antithrow/jose/jwt";

const verified = await jwtVerify(token, secret);
if (verified.isOk()) {
	use(verified.value.payload);
}
```

## Narrowing verification errors

`jwtVerify` returns a union of `jose.errors.*` classes. Narrow with `instanceof`:

```ts
import { errors } from "jose";

if (verified.isErr()) {
	if (verified.error instanceof errors.JWTExpired) {
		refresh();
	} else if (verified.error instanceof errors.JWSSignatureVerificationFailed) {
		reject();
	}
}
```

## See also

- Reference: [`@antithrow/jose/jwt`](../../reference/jose/jwt.md)
- How-to: [Work with JWKS](./work-with-jwks.md)
