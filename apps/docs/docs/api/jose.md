---
sidebar_position: 6
title: "@antithrow/jose"
description: "Non-throwing wrappers around jose JOSE/JWT/JWK APIs"
---

# @antithrow/jose

Non-throwing wrappers around the [jose](https://github.com/panva/jose) library for JWTs, JWS, JWE, JWK, and JWKS operations. Each function mirrors its `jose` counterpart but returns a `Result` or `ResultAsync` instead of throwing.

## Installation

```bash npm2yarn
npm install @antithrow/jose
```

## JWT

Import from `@antithrow/jose/jwt` for JWT-level operations — signing, verifying, encrypting, decrypting, and decoding.

Builder classes (`SignJWT`, `EncryptJWT`, `UnsecuredJWT`) are re-exported directly from `jose`.

### jwtVerify()

```ts
jwtVerify<PayloadType = JWTPayload>(
  jwt: string | Uint8Array,
  key: CryptoKey | KeyObject | JWK | Uint8Array,
  options?: JWTVerifyOptions,
): ResultAsync<JWTVerifyResult<PayloadType>, JwtVerifyError>

jwtVerify<PayloadType = JWTPayload>(
  jwt: string | Uint8Array,
  getKey: JWTVerifyGetKey,
  options?: JWTVerifyOptions,
): ResultAsync<JWTVerifyResult<PayloadType> & ResolvedKey, JwtVerifyError>
```

Verifies a JWT. Accepts either a static key or a dynamic key resolution function (e.g. from a JWKS endpoint).

Error type: `JWTInvalid | JWSInvalid | JOSEAlgNotAllowed | JWSSignatureVerificationFailed | JWTClaimValidationFailed | JWTExpired | TypeError`

```ts
import { jwtVerify } from "@antithrow/jose/jwt";

const result = await jwtVerify(token, secretKey);
result.match({
  ok: ({ payload }) => console.log("sub:", payload.sub),
  err: (error) => console.error("invalid:", error.message),
});
```

### jwtDecrypt()

```ts
jwtDecrypt<PayloadType = JWTPayload>(
  jwt: string | Uint8Array,
  key: CryptoKey | KeyObject | JWK | Uint8Array,
  options?: JWTDecryptOptions,
): ResultAsync<JWTDecryptResult<PayloadType>, JwtDecryptError>

jwtDecrypt<PayloadType = JWTPayload>(
  jwt: string | Uint8Array,
  getKey: JWTDecryptGetKey,
  options?: JWTDecryptOptions,
): ResultAsync<JWTDecryptResult<PayloadType> & ResolvedKey, JwtDecryptError>
```

Decrypts a JWE-encoded JWT.

Error type: `JWEInvalid | JOSEAlgNotAllowed | JOSENotSupported | JWEDecryptionFailed | JWTClaimValidationFailed | JWTExpired | JWTInvalid | TypeError`

```ts
import { jwtDecrypt } from "@antithrow/jose/jwt";

const result = await jwtDecrypt(token, secretKey);
// Ok<JWTDecryptResult> or Err<JwtDecryptError>
```

### signJwt()

```ts
signJwt(
  jwt: SignJWT,
  key: CryptoKey | KeyObject | JWK | Uint8Array,
  options?: SignOptions,
): ResultAsync<string, JWTInvalid | JWSInvalid | TypeError>
```

Wraps `SignJWT.prototype.sign`. Build a JWT with `new SignJWT(payload)` and its builder methods, then pass the instance here.

```ts
import { SignJWT } from "jose";
import { signJwt } from "@antithrow/jose/jwt";

const jwt = new SignJWT({ sub: "user-123" })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("2h");

const result = await signJwt(jwt, secretKey);
// Ok<string> or Err<JWTInvalid | JWSInvalid | TypeError>
```

### encryptJwt()

```ts
encryptJwt(
  jwt: EncryptJWT,
  key: CryptoKey | KeyObject | JWK | Uint8Array,
  options?: EncryptOptions,
): ResultAsync<string, JWEInvalid | JOSENotSupported | TypeError>
```

Wraps `EncryptJWT.prototype.encrypt`. Build an encrypted JWT with `new EncryptJWT(payload)` and its builder methods, then pass the instance here.

```ts
import { EncryptJWT } from "jose";
import { encryptJwt } from "@antithrow/jose/jwt";

const jwt = new EncryptJWT({ sub: "user-123" })
  .setProtectedHeader({ alg: "RSA-OAEP", enc: "A256GCM" })
  .setExpirationTime("2h");

const result = await encryptJwt(jwt, publicKey);
// Ok<string> or Err<JWEInvalid | JOSENotSupported | TypeError>
```

### decodeJwt()

```ts
decodeJwt<PayloadType = JWTPayload>(
  jwt: string,
): Result<PayloadType & JWTPayload, JWTInvalid>
```

Decodes a JWT payload **without verifying the signature**. For verified decoding, use `jwtVerify`.

```ts
import { decodeJwt } from "@antithrow/jose/jwt";

const result = decodeJwt(token);
// Ok<JWTPayload> or Err<JWTInvalid>
```

### decodeUnsecuredJwt()

```ts
decodeUnsecuredJwt<PayloadType = JWTPayload>(
  jwt: string,
  options?: JWTClaimVerificationOptions,
): Result<UnsecuredResult<PayloadType>, JWTInvalid | JWTClaimValidationFailed | JWTExpired>
```

Decodes an unsecured JWT (alg: "none").

```ts
import { decodeUnsecuredJwt } from "@antithrow/jose/jwt";

const result = decodeUnsecuredJwt(token);
// Ok<UnsecuredResult> or Err<JWTInvalid | JWTClaimValidationFailed | JWTExpired>
```

## JWS

Import from `@antithrow/jose/jws` for JSON Web Signature operations in compact, flattened, and general serializations.

Builder classes (`CompactSign`, `FlattenedSign`, `GeneralSign`) are re-exported directly from `jose`.

### compactSign()

```ts
compactSign(
  signer: CompactSign,
  key: CryptoKey | KeyObject | JWK | Uint8Array,
  options?: SignOptions,
): ResultAsync<string, JWSInvalid | TypeError>
```

Wraps `CompactSign.prototype.sign`.

```ts
import { CompactSign, compactSign } from "@antithrow/jose/jws";

const signer = new CompactSign(
  new TextEncoder().encode(JSON.stringify({ hello: "world" })),
).setProtectedHeader({ alg: "ES256" });

const result = await compactSign(signer, privateKey);
// Ok<string> or Err<JWSInvalid | TypeError>
```

### compactVerify()

```ts
compactVerify(
  jws: string | Uint8Array,
  key: CryptoKey | KeyObject | JWK | Uint8Array,
  options?: VerifyOptions,
): ResultAsync<CompactVerifyResult, CompactVerifyError>

compactVerify(
  jws: string | Uint8Array,
  getKey: CompactVerifyGetKey,
  options?: VerifyOptions,
): ResultAsync<CompactVerifyResult & ResolvedKey, CompactVerifyError>
```

Verifies a Compact JWS.

Error type: `JWSInvalid | JOSEAlgNotAllowed | JWSSignatureVerificationFailed`

```ts
import { compactVerify } from "@antithrow/jose/jws";

const result = await compactVerify(jws, publicKey);
if (result.isOk()) {
  console.log(result.value.payload);
}
```

### flattenedSign()

```ts
flattenedSign(
  signer: FlattenedSign,
  key: CryptoKey | KeyObject | JWK | Uint8Array,
  options?: SignOptions,
): ResultAsync<FlattenedJWS, JWSInvalid | TypeError>
```

Wraps `FlattenedSign.prototype.sign`.

```ts
import { FlattenedSign, flattenedSign } from "@antithrow/jose/jws";

const signer = new FlattenedSign(
  new TextEncoder().encode(JSON.stringify({ hello: "world" })),
).setProtectedHeader({ alg: "ES256" });

const result = await flattenedSign(signer, privateKey);
// Ok<FlattenedJWS> or Err<JWSInvalid | TypeError>
```

### flattenedVerify()

```ts
flattenedVerify(
  jws: FlattenedJWSInput,
  key: CryptoKey | KeyObject | JWK | Uint8Array,
  options?: VerifyOptions,
): ResultAsync<FlattenedVerifyResult, FlattenedVerifyError>

flattenedVerify(
  jws: FlattenedJWSInput,
  getKey: FlattenedVerifyGetKey,
  options?: VerifyOptions,
): ResultAsync<FlattenedVerifyResult & ResolvedKey, FlattenedVerifyError>
```

Verifies a Flattened JWS.

Error type: `JWSInvalid | JOSEAlgNotAllowed | JWSSignatureVerificationFailed | TypeError`

```ts
import { flattenedVerify } from "@antithrow/jose/jws";

const result = await flattenedVerify(jws, publicKey);
if (result.isOk()) {
  console.log(result.value.payload);
}
```

### generalSign()

```ts
generalSign(
  signer: GeneralSign,
): ResultAsync<GeneralJWS, JWSInvalid | TypeError>
```

Wraps `GeneralSign.prototype.sign`. Signatures are added via `GeneralSign.addSignature` before calling this function.

```ts
import { GeneralSign, generalSign } from "@antithrow/jose/jws";

const signer = new GeneralSign(new TextEncoder().encode(JSON.stringify({ hello: "world" })));
signer.addSignature(privateKey).setProtectedHeader({ alg: "ES256" });

const result = await generalSign(signer);
// Ok<GeneralJWS> or Err<JWSInvalid | TypeError>
```

### generalVerify()

```ts
generalVerify(
  jws: GeneralJWSInput,
  key: CryptoKey | KeyObject | JWK | Uint8Array,
  options?: VerifyOptions,
): ResultAsync<GeneralVerifyResult, GeneralVerifyError>

generalVerify(
  jws: GeneralJWSInput,
  getKey: GeneralVerifyGetKey,
  options?: VerifyOptions,
): ResultAsync<GeneralVerifyResult & ResolvedKey, GeneralVerifyError>
```

Verifies a General JWS.

Error type: `JWSInvalid | JOSEAlgNotAllowed | JWSSignatureVerificationFailed | TypeError`

```ts
import { generalVerify } from "@antithrow/jose/jws";

const result = await generalVerify(jws, publicKey);
if (result.isOk()) {
  console.log(result.value.payload);
}
```

## JWE

Import from `@antithrow/jose/jwe` for JSON Web Encryption operations in compact, flattened, and general serializations.

Builder classes (`CompactEncrypt`, `FlattenedEncrypt`, `GeneralEncrypt`) are re-exported directly from `jose`.

### compactDecrypt()

```ts
compactDecrypt(
  jwe: string | Uint8Array,
  key: CryptoKey | KeyObject | JWK | Uint8Array,
  options?: DecryptOptions,
): ResultAsync<CompactDecryptResult, CompactDecryptError>

compactDecrypt(
  jwe: string | Uint8Array,
  getKey: CompactDecryptGetKey,
  options?: DecryptOptions,
): ResultAsync<CompactDecryptResult & ResolvedKey, CompactDecryptError>
```

Decrypts a Compact JWE.

Error type: `JWEInvalid | JOSEAlgNotAllowed | JOSENotSupported | JWEDecryptionFailed | TypeError`

```ts
import { compactDecrypt } from "@antithrow/jose/jwe";

const result = await compactDecrypt(jwe, secretKey);
// Ok<CompactDecryptResult> or Err<CompactDecryptError>
```

### compactEncrypt()

```ts
compactEncrypt(
  encryptor: CompactEncrypt,
  key: CryptoKey | KeyObject | JWK | Uint8Array,
  options?: EncryptOptions,
): ResultAsync<string, JWEInvalid | JOSENotSupported | TypeError>
```

Wraps `CompactEncrypt.prototype.encrypt`.

```ts
import { CompactEncrypt, compactEncrypt } from "@antithrow/jose/jwe";

const encryptor = new CompactEncrypt(plaintext).setProtectedHeader({
  alg: "RSA-OAEP",
  enc: "A256GCM",
});

const result = await compactEncrypt(encryptor, publicKey);
// Ok<string> or Err<JWEInvalid | JOSENotSupported | TypeError>
```

### flattenedDecrypt()

```ts
flattenedDecrypt(
  jwe: FlattenedJWE,
  key: CryptoKey | KeyObject | JWK | Uint8Array,
  options?: DecryptOptions,
): ResultAsync<FlattenedDecryptResult, FlattenedDecryptError>

flattenedDecrypt(
  jwe: FlattenedJWE,
  getKey: FlattenedDecryptGetKey,
  options?: DecryptOptions,
): ResultAsync<FlattenedDecryptResult & ResolvedKey, FlattenedDecryptError>
```

Decrypts a Flattened JWE.

Error type: `JWEInvalid | JOSENotSupported | JOSEAlgNotAllowed | JWEDecryptionFailed | TypeError`

```ts
import { flattenedDecrypt } from "@antithrow/jose/jwe";

const result = await flattenedDecrypt(jwe, secretKey);
// Ok<FlattenedDecryptResult> or Err<FlattenedDecryptError>
```

### flattenedEncrypt()

```ts
flattenedEncrypt(
  encryptor: FlattenedEncrypt,
  key: CryptoKey | KeyObject | JWK | Uint8Array,
  options?: EncryptOptions,
): ResultAsync<FlattenedJWE, JWEInvalid | JOSENotSupported | TypeError>
```

Wraps `FlattenedEncrypt.prototype.encrypt`.

```ts
import { FlattenedEncrypt, flattenedEncrypt } from "@antithrow/jose/jwe";

const encryptor = new FlattenedEncrypt(plaintext).setProtectedHeader({
  alg: "RSA-OAEP",
  enc: "A256GCM",
});

const result = await flattenedEncrypt(encryptor, publicKey);
// Ok<FlattenedJWE> or Err<JWEInvalid | JOSENotSupported | TypeError>
```

### generalDecrypt()

```ts
generalDecrypt(
  jwe: GeneralJWE,
  key: CryptoKey | KeyObject | JWK | Uint8Array,
  options?: DecryptOptions,
): ResultAsync<GeneralDecryptResult, GeneralDecryptError>

generalDecrypt(
  jwe: GeneralJWE,
  getKey: GeneralDecryptGetKey,
  options?: DecryptOptions,
): ResultAsync<GeneralDecryptResult & ResolvedKey, GeneralDecryptError>
```

Decrypts a General JWE.

Error type: `JWEInvalid | JWEDecryptionFailed | JOSENotSupported | JOSEAlgNotAllowed | TypeError`

```ts
import { generalDecrypt } from "@antithrow/jose/jwe";

const result = await generalDecrypt(jwe, secretKey);
// Ok<GeneralDecryptResult> or Err<GeneralDecryptError>
```

### generalEncrypt()

```ts
generalEncrypt(
  encryptor: GeneralEncrypt,
): ResultAsync<GeneralJWE, JWEInvalid | JOSENotSupported | TypeError>
```

Wraps `GeneralEncrypt.prototype.encrypt`.

```ts
import { GeneralEncrypt, generalEncrypt } from "@antithrow/jose/jwe";

const encryptor = new GeneralEncrypt(plaintext)
  .setProtectedHeader({ enc: "A256GCM" })
  .addRecipient(publicKey)
  .setUnprotectedHeader({ alg: "RSA-OAEP" })
  .done();

const result = await generalEncrypt(encryptor);
// Ok<GeneralJWE> or Err<JWEInvalid | JOSENotSupported | TypeError>
```

## Key import, export & generation

Import from `@antithrow/jose/key` for key management operations.

### importSPKI()

```ts
importSPKI(
  spki: string,
  alg: string,
  options?: KeyImportOptions,
): ResultAsync<CryptoKey, TypeError | JOSENotSupported>
```

Imports a PEM-encoded SPKI string as a `CryptoKey`.

```ts
import { importSPKI } from "@antithrow/jose/key";

const result = await importSPKI(spkiPem, "RS256");
// Ok<CryptoKey> or Err<TypeError | JOSENotSupported>
```

### importPKCS8()

```ts
importPKCS8(
  pkcs8: string,
  alg: string,
  options?: KeyImportOptions,
): ResultAsync<CryptoKey, TypeError | JOSENotSupported>
```

Imports a PEM-encoded PKCS#8 string as a `CryptoKey`.

```ts
import { importPKCS8 } from "@antithrow/jose/key";

const result = await importPKCS8(pkcs8Pem, "RS256");
// Ok<CryptoKey> or Err<TypeError | JOSENotSupported>
```

### importX509()

```ts
importX509(
  x509: string,
  alg: string,
  options?: KeyImportOptions,
): ResultAsync<CryptoKey, TypeError | JOSENotSupported>
```

Imports a PEM-encoded X.509 certificate string as a `CryptoKey`.

```ts
import { importX509 } from "@antithrow/jose/key";

const result = await importX509(x509Pem, "RS256");
// Ok<CryptoKey> or Err<TypeError | JOSENotSupported>
```

### importJWK()

```ts
importJWK(
  jwk: JWK,
  alg?: string,
  options?: KeyImportOptions,
): ResultAsync<CryptoKey | Uint8Array, TypeError | JOSENotSupported>
```

Imports a JWK as a `CryptoKey` or `Uint8Array`.

```ts
import { importJWK } from "@antithrow/jose/key";

const result = await importJWK({ kty: "RSA", ... }, "RS256");
// Ok<CryptoKey | Uint8Array> or Err<TypeError | JOSENotSupported>
```

### exportSPKI()

```ts
exportSPKI(key: CryptoKey | KeyObject): ResultAsync<string, TypeError>
```

Exports a public key as a PEM-encoded SPKI string.

```ts
import { exportSPKI } from "@antithrow/jose/key";

const result = await exportSPKI(publicKey);
// Ok<string> or Err<TypeError>
```

### exportPKCS8()

```ts
exportPKCS8(key: CryptoKey | KeyObject): ResultAsync<string, TypeError>
```

Exports a private key as a PEM-encoded PKCS#8 string.

```ts
import { exportPKCS8 } from "@antithrow/jose/key";

const result = await exportPKCS8(privateKey);
// Ok<string> or Err<TypeError>
```

### exportJWK()

```ts
exportJWK(key: CryptoKey | KeyObject | Uint8Array): ResultAsync<JWK, TypeError>
```

Exports a key as a JSON Web Key.

```ts
import { exportJWK } from "@antithrow/jose/key";

const result = await exportJWK(key);
// Ok<JWK> or Err<TypeError>
```

### generateKeyPair()

```ts
generateKeyPair(
  alg: string,
  options?: GenerateKeyPairOptions,
): ResultAsync<GenerateKeyPairResult, JOSENotSupported>
```

Generates an asymmetric key pair for the specified algorithm.

```ts
import { generateKeyPair } from "@antithrow/jose/key";

const result = await generateKeyPair("RS256");
if (result.isOk()) {
  console.log(result.value.publicKey, result.value.privateKey);
}
```

### generateSecret()

```ts
generateSecret(
  alg: string,
  options?: GenerateSecretOptions,
): ResultAsync<CryptoKey | Uint8Array, JOSENotSupported>
```

Generates a symmetric secret key for the specified algorithm.

```ts
import { generateSecret } from "@antithrow/jose/key";

const result = await generateSecret("HS256");
// Ok<CryptoKey | Uint8Array> or Err<JOSENotSupported>
```

## JWK

Import from `@antithrow/jose/jwk` for JWK Thumbprint and embedded JWK operations.

### calculateJwkThumbprint()

```ts
calculateJwkThumbprint(
  key: JWK | CryptoKey | KeyObject,
  digestAlgorithm?: "sha256" | "sha384" | "sha512",
): ResultAsync<string, TypeError | JWKInvalid | JOSENotSupported>
```

Calculates a base64url-encoded JWK Thumbprint (RFC 7638).

```ts
import { calculateJwkThumbprint } from "@antithrow/jose/jwk";

const result = await calculateJwkThumbprint(jwk, "sha256");
// Ok<string> or Err<TypeError | JWKInvalid | JOSENotSupported>
```

### calculateJwkThumbprintUri()

```ts
calculateJwkThumbprintUri(
  key: CryptoKey | KeyObject | JWK,
  digestAlgorithm?: "sha256" | "sha384" | "sha512",
): ResultAsync<string, TypeError | JWKInvalid | JOSENotSupported>
```

Calculates a JWK Thumbprint URI (RFC 9278).

```ts
import { calculateJwkThumbprintUri } from "@antithrow/jose/jwk";

const result = await calculateJwkThumbprintUri(jwk);
// Ok<string> or Err<TypeError | JWKInvalid | JOSENotSupported>
```

### embeddedJWK()

```ts
embeddedJWK(
  protectedHeader?: JWSHeaderParameters,
  token?: FlattenedJWSInput,
): ResultAsync<CryptoKey, JWSInvalid | TypeError | JOSENotSupported>
```

Resolves a public key from the JWS Header's `jwk` member.

```ts
import { embeddedJWK } from "@antithrow/jose/jwk";

const result = await embeddedJWK(protectedHeader, token);
// Ok<CryptoKey> or Err<JWSInvalid | TypeError | JOSENotSupported>
```

## JWKS

Import from `@antithrow/jose/jwks` for JSON Web Key Set operations.

### createLocalJWKSet()

```ts
createLocalJWKSet(
  jwks: JSONWebKeySet,
): (protectedHeader?, token?) => ResultAsync<CryptoKey, LocalJWKSetError>
```

Creates a function that resolves a JWS JOSE Header to a public key from a local JWKS.

Error type: `JWKSInvalid | JOSENotSupported | JWKSNoMatchingKey | JWKSMultipleMatchingKeys | TypeError`

```ts
import { createLocalJWKSet } from "@antithrow/jose/jwks";

const getKey = createLocalJWKSet({ keys: [...] });
const result = await getKey(protectedHeader, token);
// Ok<CryptoKey> or Err<LocalJWKSetError>
```

### createRemoteJWKSet()

```ts
createRemoteJWKSet(
  url: URL,
  options?: RemoteJWKSetOptions,
): (protectedHeader?, token?) => ResultAsync<CryptoKey, RemoteJWKSetError>
```

Creates a function that resolves a JWS JOSE Header to a public key from a remote JWKS endpoint.

Error type: `JWKSTimeout | JOSEError | JWKSInvalid | JOSENotSupported | JWKSNoMatchingKey | JWKSMultipleMatchingKeys | TypeError`

```ts
import { createRemoteJWKSet } from "@antithrow/jose/jwks";

const getKey = createRemoteJWKSet(new URL("https://example.com/.well-known/jwks.json"));
const result = await getKey(protectedHeader, token);
// Ok<CryptoKey> or Err<RemoteJWKSetError>
```

## Utilities

Import from `@antithrow/jose/util` for low-level utilities.

### decodeProtectedHeader()

```ts
decodeProtectedHeader(
  token: string | object,
): Result<ProtectedHeaderParameters, TypeError>
```

Decodes a JWS/JWE/JWT Protected Header without verifying its signature.

```ts
import { decodeProtectedHeader } from "@antithrow/jose/util";

const result = decodeProtectedHeader(token);
// Ok<ProtectedHeaderParameters> or Err<TypeError>
```

### base64url

```ts
base64url.decode(input: Uint8Array | string): Result<Uint8Array, TypeError>
base64url.encode(input: Uint8Array): string
```

Base64url encoding and decoding. `decode` returns a `Result`; `encode` does not throw and returns a plain string.

```ts
import { base64url } from "@antithrow/jose/util";

const decoded = base64url.decode("SGVsbG8");
// Ok<Uint8Array> or Err<TypeError>

const encoded = base64url.encode(new TextEncoder().encode("Hello"));
// "SGVsbG8"
```
