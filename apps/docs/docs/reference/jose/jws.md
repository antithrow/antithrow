---
title: jws
description: Non-throwing wrappers around jose's JWS signing and verification APIs.
sidebar_position: 2
---

# `@antithrow/jose/jws`

Subpath: `@antithrow/jose/jws`

Non-throwing wrappers for JSON Web Signature (JWS) in all three serializations: compact, flattened, and general JSON.

## Exports

| Export | Signature |
| --- | --- |
| `compactSign` | `(sign: CompactSign, key) => ResultAsync<string, errors.JWSInvalid \| TypeError>` |
| `compactVerify` | `(jws, key \| getKey, options?) => ResultAsync<CompactVerifyResult [& ResolvedKey], JwsVerifyError>` |
| `flattenedSign` | `(sign: FlattenedSign, key) => ResultAsync<FlattenedJWS, errors.JWSInvalid \| TypeError>` |
| `flattenedVerify` | `(jws, key \| getKey, options?) => ResultAsync<FlattenedVerifyResult [& ResolvedKey], JwsVerifyError>` |
| `generalSign` | `(sign: GeneralSign, ...) => ResultAsync<GeneralJWS, errors.JWSInvalid \| TypeError>` |
| `generalVerify` | `(jws, key \| getKey, options?) => ResultAsync<GeneralVerifyResult [& ResolvedKey], JwsVerifyError>` |

### `JwsVerifyError`

```ts
type JwsVerifyError =
	| errors.JWSInvalid
	| errors.JOSEAlgNotAllowed
	| errors.JWSSignatureVerificationFailed
	| TypeError;
```

## Notes

The `*Sign` functions take a configured builder instance from `jose` (`CompactSign`, `FlattenedSign`, `GeneralSign`) that has already been set up with the payload and protected header.

The `*Verify` functions each have two overloads: static key or `GetKey` resolver.

## Throws

Never.

## Example

```ts
import { CompactSign } from "jose";
import { compactSign, compactVerify } from "@antithrow/jose/jws";

const signer = new CompactSign(new TextEncoder().encode("payload"))
	.setProtectedHeader({ alg: "HS256" });

const signed = await compactSign(signer, key);
if (signed.isOk()) {
	const verified = await compactVerify(signed.value, key);
}
```
