---
title: Import and export keys
description: Read PEM, PKCS#8, SPKI, and JWK key material into CryptoKey objects and back.
---

# Import and export keys

## Import

| You have… | Use |
| --- | --- |
| JWK object | `importJWK(jwk, alg?)` |
| PKCS#8 PEM (private key) | `importPKCS8(pem, alg)` |
| SPKI PEM (public key) | `importSPKI(pem, alg)` |
| X.509 certificate PEM | `importX509(pem, alg)` |

```ts
import { importPKCS8 } from "@antithrow/jose/key";

const privateKey = await importPKCS8(pem, "RS256");
```

## Export

```ts
import { exportJWK, exportPKCS8 } from "@antithrow/jose/key";

const jwk = await exportJWK(cryptoKey);
const pem = await exportPKCS8(cryptoKey);
```

`exportPKCS8` serializes private keys; `exportSPKI` serializes public keys; `exportJWK` works for both.

## Generate fresh key material

```ts
import { generateKeyPair, generateSecret } from "@antithrow/jose/key";

const pair = await generateKeyPair("RS256");
const secret = await generateSecret("HS256");
```

Both accept an `options` object with `extractable` and `crv` where applicable.

## See also

- Reference: [`@antithrow/jose/key`](../../reference/jose/key.md)
