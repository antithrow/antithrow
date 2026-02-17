<div align="center">
	<h1>@antithrow/jose</h1>
	<p>
		non-throwing wrappers around <a href="https://github.com/panva/jose">jose</a> APIs, powered by <a href="https://github.com/antithrow/antithrow">antithrow</a>
	</p>

![NPM Version](https://img.shields.io/npm/v/@antithrow/jose)
![NPM License](https://img.shields.io/npm/l/@antithrow/jose)

</div>

## Why

The [jose](https://github.com/panva/jose) library communicates failure by throwing — invalid tokens, expired JWTs, decryption failures, and key errors all surface as exceptions.
`@antithrow/jose` re-exports them as thin wrappers that return `Result` or `ResultAsync` instead,
so error handling is type-safe and composable out of the box.

```ts
import { jwtVerify } from "@antithrow/jose/jwt";
import { generateSecret } from "@antithrow/jose/key";

const secret = await generateSecret("HS256");

const result = await jwtVerify(token, secret.unwrapOrThrow());
result.match({
  ok: ({ payload }) => console.log("verified:", payload.sub),
  err: (error) => console.error("invalid token:", error.message),
});
```

## Installation

```bash
bun add @antithrow/jose
```

`antithrow` is a required peer/runtime dependency and will be installed automatically.

## Usage

The package mirrors the structure of `jose` with subpath exports. Standalone async functions (like `jwtVerify`, `compactDecrypt`) are wrapped with `ResultAsync.try()`. Sync functions (like `decodeJwt`) are wrapped with `Result.try()`. For class-based builders (like `SignJWT`, `CompactSign`), use the corresponding wrapper function for the terminal `.sign()` / `.encrypt()` call.

```ts
import { SignJWT } from "jose";
import { signJwt } from "@antithrow/jose/jwt";

const jwt = new SignJWT({ sub: "user-123" })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("2h");

const result = await signJwt(jwt, secretKey);
// Ok<string> or Err<JWTInvalid | JWSInvalid | TypeError>
```

### Subpath exports

| Import path            | Description                                         |
| ---------------------- | --------------------------------------------------- |
| `@antithrow/jose`      | Re-exports everything from all subpaths             |
| `@antithrow/jose/jwt`  | JWT sign, verify, encrypt, decrypt, decode          |
| `@antithrow/jose/jws`  | JWS compact, flattened, and general sign/verify     |
| `@antithrow/jose/jwe`  | JWE compact, flattened, and general encrypt/decrypt |
| `@antithrow/jose/key`  | Key import, export, and generation                  |
| `@antithrow/jose/jwk`  | JWK thumbprint and embedded JWK                     |
| `@antithrow/jose/jwks` | Local and remote JWKS key resolution                |
| `@antithrow/jose/util` | Base64url and protected header decoding             |

## API Reference

### JWT (`@antithrow/jose/jwt`)

| Export               | Returns       | Error Type                                                                                                                                        |
| -------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jwtVerify`          | `ResultAsync` | `JWTInvalid \| JWSInvalid \| JOSEAlgNotAllowed \| JWSSignatureVerificationFailed \| JWTClaimValidationFailed \| JWTExpired \| TypeError`          |
| `jwtDecrypt`         | `ResultAsync` | `JWEInvalid \| JOSEAlgNotAllowed \| JOSENotSupported \| JWEDecryptionFailed \| JWTClaimValidationFailed \| JWTExpired \| JWTInvalid \| TypeError` |
| `signJwt`            | `ResultAsync` | `JWTInvalid \| JWSInvalid \| TypeError`                                                                                                           |
| `encryptJwt`         | `ResultAsync` | `JWEInvalid \| JOSENotSupported \| TypeError`                                                                                                     |
| `decodeJwt`          | `Result`      | `JWTInvalid`                                                                                                                                      |
| `decodeUnsecuredJwt` | `Result`      | `JWTInvalid \| JWTClaimValidationFailed \| JWTExpired`                                                                                            |

Also re-exports `SignJWT`, `EncryptJWT`, and `UnsecuredJWT` classes from `jose`.

### JWS (`@antithrow/jose/jws`)

| Export            | Returns       | Error Type                                                                       |
| ----------------- | ------------- | -------------------------------------------------------------------------------- |
| `compactSign`     | `ResultAsync` | `JWSInvalid \| TypeError`                                                        |
| `compactVerify`   | `ResultAsync` | `JWSInvalid \| JOSEAlgNotAllowed \| JWSSignatureVerificationFailed`              |
| `flattenedSign`   | `ResultAsync` | `JWSInvalid \| TypeError`                                                        |
| `flattenedVerify` | `ResultAsync` | `JWSInvalid \| JOSEAlgNotAllowed \| JWSSignatureVerificationFailed \| TypeError` |
| `generalSign`     | `ResultAsync` | `JWSInvalid \| TypeError`                                                        |
| `generalVerify`   | `ResultAsync` | `JWSInvalid \| JOSEAlgNotAllowed \| JWSSignatureVerificationFailed \| TypeError` |

Also re-exports `CompactSign`, `FlattenedSign`, and `GeneralSign` classes from `jose`.

### JWE (`@antithrow/jose/jwe`)

| Export             | Returns       | Error Type                                                                                |
| ------------------ | ------------- | ----------------------------------------------------------------------------------------- |
| `compactDecrypt`   | `ResultAsync` | `JWEInvalid \| JOSEAlgNotAllowed \| JOSENotSupported \| JWEDecryptionFailed \| TypeError` |
| `compactEncrypt`   | `ResultAsync` | `JWEInvalid \| JOSENotSupported \| TypeError`                                             |
| `flattenedDecrypt` | `ResultAsync` | `JWEInvalid \| JOSENotSupported \| JOSEAlgNotAllowed \| JWEDecryptionFailed \| TypeError` |
| `flattenedEncrypt` | `ResultAsync` | `JWEInvalid \| JOSENotSupported \| TypeError`                                             |
| `generalDecrypt`   | `ResultAsync` | `JWEInvalid \| JWEDecryptionFailed \| JOSENotSupported \| JOSEAlgNotAllowed \| TypeError` |
| `generalEncrypt`   | `ResultAsync` | `JWEInvalid \| JOSENotSupported \| TypeError`                                             |

Also re-exports `CompactEncrypt`, `FlattenedEncrypt`, and `GeneralEncrypt` classes from `jose`.

### Key (`@antithrow/jose/key`)

| Export            | Returns       | Error Type                      |
| ----------------- | ------------- | ------------------------------- |
| `importSPKI`      | `ResultAsync` | `TypeError \| JOSENotSupported` |
| `importPKCS8`     | `ResultAsync` | `TypeError \| JOSENotSupported` |
| `importX509`      | `ResultAsync` | `TypeError \| JOSENotSupported` |
| `importJWK`       | `ResultAsync` | `TypeError \| JOSENotSupported` |
| `exportSPKI`      | `ResultAsync` | `TypeError`                     |
| `exportPKCS8`     | `ResultAsync` | `TypeError`                     |
| `exportJWK`       | `ResultAsync` | `TypeError`                     |
| `generateKeyPair` | `ResultAsync` | `JOSENotSupported`              |
| `generateSecret`  | `ResultAsync` | `JOSENotSupported`              |

### JWK (`@antithrow/jose/jwk`)

| Export                      | Returns       | Error Type                                    |
| --------------------------- | ------------- | --------------------------------------------- |
| `calculateJwkThumbprint`    | `ResultAsync` | `TypeError \| JWKInvalid \| JOSENotSupported` |
| `calculateJwkThumbprintUri` | `ResultAsync` | `TypeError \| JWKInvalid \| JOSENotSupported` |
| `embeddedJWK`               | `ResultAsync` | `JWSInvalid \| TypeError \| JOSENotSupported` |

### JWKS (`@antithrow/jose/jwks`)

| Export               | Returns             | Error Type                                                                                                                  |
| -------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `createLocalJWKSet`  | `() => ResultAsync` | `JWKSInvalid \| JOSENotSupported \| JWKSNoMatchingKey \| JWKSMultipleMatchingKeys \| TypeError`                             |
| `createRemoteJWKSet` | `() => ResultAsync` | `JWKSTimeout \| JOSEError \| JWKSInvalid \| JOSENotSupported \| JWKSNoMatchingKey \| JWKSMultipleMatchingKeys \| TypeError` |

### Utilities (`@antithrow/jose/util`)

| Export                  | Returns  | Error Type       |
| ----------------------- | -------- | ---------------- |
| `decodeProtectedHeader` | `Result` | `TypeError`      |
| `base64url.decode`      | `Result` | `TypeError`      |
| `base64url.encode`      | `string` | (does not throw) |
