---
title: jwt
description: Non-throwing wrappers around jose's JWT APIs.
sidebar_position: 1
---

# `@antithrow/jose/jwt`

Subpath: `@antithrow/jose/jwt`

Non-throwing wrappers around `jose`'s JWT primitives. Errors are typed as unions of `jose.errors.*` classes so callers can narrow with `instanceof`.

## Exports

| Export | Signature |
| --- | --- |
| `decodeJwt` | `<P = JWTPayload>(jwt: string) => Result<P & JWTPayload, errors.JWTInvalid>` |
| `decodeUnsecuredJwt` | `<P = JWTPayload>(jwt: string) => Result<{ payload: P & JWTPayload; header: JWTHeaderParameters }, errors.JWTInvalid>` |
| `signJwt` | `(jwt, key, options?) => ResultAsync<string, errors.JWTInvalid \| errors.JWSInvalid \| TypeError>` |
| `jwtVerify` | `<P>(jwt, key \| getKey, options?) => ResultAsync<JWTVerifyResult<P> [& ResolvedKey], JwtVerifyError>` |
| `encryptJwt` | `(jwt, key) => ResultAsync<string, errors.JWEInvalid \| errors.JOSENotSupported \| TypeError>` |
| `jwtDecrypt` | `<P>(jwt, key \| getKey, options?) => ResultAsync<JWTDecryptResult<P> [& ResolvedKey], JwtDecryptError>` |

### `JwtVerifyError`

```ts
type JwtVerifyError =
	| errors.JWTInvalid
	| errors.JWSInvalid
	| errors.JOSEAlgNotAllowed
	| errors.JWSSignatureVerificationFailed
	| errors.JWTClaimValidationFailed
	| errors.JWTExpired
	| TypeError;
```

### `JwtDecryptError`

```ts
type JwtDecryptError =
	| errors.JWTInvalid
	| errors.JWEInvalid
	| errors.JOSEAlgNotAllowed
	| errors.JWEDecryptionFailed
	| errors.JWTClaimValidationFailed
	| errors.JWTExpired
	| TypeError;
```

## Notes

`signJwt` takes a configured `SignJWT` instance (from `jose`) — build the claims with its builder methods, then pass it here.

`encryptJwt` takes a configured `EncryptJWT` instance.

`jwtVerify` and `jwtDecrypt` have overloads accepting either a static key or a `GetKey`/`GetKeyFunction` resolver (use the resolver overload with `createRemoteJWKSet`).

## Throws

Never.

## Example

```ts
import { SignJWT } from "jose";
import { signJwt, jwtVerify } from "@antithrow/jose/jwt";

const token = new SignJWT({ sub: "user-123" })
	.setProtectedHeader({ alg: "HS256" })
	.setExpirationTime("2h");

const signed = await signJwt(token, secret);

if (signed.isOk()) {
	const verified = await jwtVerify(signed.value, secret);
	if (verified.isOk()) {
		console.log(verified.value.payload);
	}
}
```
