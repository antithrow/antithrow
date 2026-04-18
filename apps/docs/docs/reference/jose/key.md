---
title: key
description: Non-throwing wrappers around jose's key import, export, and generation APIs.
sidebar_position: 4
---

# `@antithrow/jose/key`

Subpath: `@antithrow/jose/key`

Non-throwing wrappers for key material: generate, import (JWK/PKCS#8/SPKI/X.509), and export (JWK/PKCS#8/SPKI).

## Generation

| Export | Signature |
| --- | --- |
| `generateKeyPair` | `(alg, options?) => ResultAsync<GenerateKeyPairResult, errors.JOSENotSupported \| TypeError>` |
| `generateSecret` | `(alg, options?) => ResultAsync<CryptoKey \| Uint8Array, errors.JOSENotSupported \| TypeError>` |

## Import

| Export | Signature |
| --- | --- |
| `importJWK` | `(jwk, alg?, options?) => ResultAsync<CryptoKey \| Uint8Array, errors.JWKInvalid \| errors.JOSENotSupported \| TypeError>` |
| `importPKCS8` | `(pkcs8, alg, options?) => ResultAsync<CryptoKey, errors.JOSENotSupported \| TypeError>` |
| `importSPKI` | `(spki, alg, options?) => ResultAsync<CryptoKey, errors.JOSENotSupported \| TypeError>` |
| `importX509` | `(x509, alg, options?) => ResultAsync<CryptoKey, errors.JOSENotSupported \| TypeError>` |

## Export

| Export | Signature |
| --- | --- |
| `exportJWK` | `(key) => ResultAsync<JWK, TypeError>` |
| `exportPKCS8` | `(key) => ResultAsync<string, TypeError>` |
| `exportSPKI` | `(key) => ResultAsync<string, TypeError>` |

## Throws

Never.

## Example

```ts
import { generateKeyPair, exportJWK } from "@antithrow/jose/key";

const pair = await generateKeyPair("RS256");
if (pair.isOk()) {
	const jwk = await exportJWK(pair.value.publicKey);
}
```
