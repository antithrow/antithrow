---
title: jwe
description: Non-throwing wrappers around jose's JWE encryption and decryption APIs.
sidebar_position: 3
---

# `@antithrow/jose/jwe`

Subpath: `@antithrow/jose/jwe`

Non-throwing wrappers for JSON Web Encryption (JWE) in all three serializations: compact, flattened, and general JSON.

## Exports

| Export | Signature |
| --- | --- |
| `compactEncrypt` | `(encrypt: CompactEncrypt, key) => ResultAsync<string, JweEncryptError>` |
| `compactDecrypt` | `(jwe, key \| getKey, options?) => ResultAsync<CompactDecryptResult [& ResolvedKey], JweDecryptError>` |
| `flattenedEncrypt` | `(encrypt: FlattenedEncrypt, key) => ResultAsync<FlattenedJWE, JweEncryptError>` |
| `flattenedDecrypt` | `(jwe, key \| getKey, options?) => ResultAsync<FlattenedDecryptResult [& ResolvedKey], JweDecryptError>` |
| `generalEncrypt` | `(encrypt: GeneralEncrypt) => ResultAsync<GeneralJWE, JweEncryptError>` |
| `generalDecrypt` | `(jwe, key \| getKey, options?) => ResultAsync<GeneralDecryptResult [& ResolvedKey], JweDecryptError>` |

### `JweEncryptError`

```ts
type JweEncryptError =
	| errors.JWEInvalid
	| errors.JOSENotSupported
	| errors.JOSEAlgNotAllowed
	| TypeError;
```

### `JweDecryptError`

```ts
type JweDecryptError =
	| errors.JWEInvalid
	| errors.JWEDecryptionFailed
	| errors.JOSEAlgNotAllowed
	| errors.JOSENotSupported
	| TypeError;
```

## Throws

Never.

## Example

```ts
import { CompactEncrypt } from "jose";
import { compactEncrypt, compactDecrypt } from "@antithrow/jose/jwe";

const encrypter = new CompactEncrypt(new TextEncoder().encode("payload"))
	.setProtectedHeader({ alg: "dir", enc: "A256GCM" });

const jwe = await compactEncrypt(encrypter, secret);
if (jwe.isOk()) {
	const decrypted = await compactDecrypt(jwe.value, secret);
}
```
