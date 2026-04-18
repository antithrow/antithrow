---
title: Encrypt and decrypt a JWT
description: Produce a JWE-encrypted JWT and decrypt it back.
---

# Encrypt and decrypt a JWT

## Encrypt

Build with `jose.EncryptJWT`, then hand to `encryptJwt`.

```ts
import { EncryptJWT } from "jose";
import { encryptJwt } from "@antithrow/jose/jwt";

const builder = new EncryptJWT({ sub: "user-123" })
	.setProtectedHeader({ alg: "dir", enc: "A256GCM" })
	.setIssuedAt()
	.setExpirationTime("1h");

const jwe = await encryptJwt(builder, key);
```

## Decrypt

```ts
import { jwtDecrypt } from "@antithrow/jose/jwt";

const decrypted = await jwtDecrypt(jwe.value, key);
if (decrypted.isOk()) {
	use(decrypted.value.payload);
}
```

## Picking `alg` / `enc`

- `alg: "dir"` + a symmetric 256-bit key → direct encryption with `enc: "A256GCM"`. Simplest.
- `alg: "RSA-OAEP-256"` + RSA public key → wrap a random CEK; recipient decrypts with the RSA private key.
- `alg: "ECDH-ES+A256KW"` + EC public key → ECDH key agreement + key wrap.

Mismatches surface as `errors.JOSEAlgNotAllowed` or `errors.JOSENotSupported`.

## See also

- Reference: [`@antithrow/jose/jwt`](../../reference/jose/jwt.md)
- Reference: [`@antithrow/jose/jwe`](../../reference/jose/jwe.md)
- How-to: [Import and export keys](./import-and-export-keys.md)
