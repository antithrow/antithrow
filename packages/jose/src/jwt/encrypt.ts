import { ResultAsync } from "antithrow/legacy";
import type { CryptoKey, EncryptJWT, EncryptOptions, errors, JWK, KeyObject } from "jose";

/**
 * Non-throwing wrapper around `EncryptJWT.prototype.encrypt`.
 *
 * Build a JWT with `new EncryptJWT(payload)` and its builder methods, then pass
 * the instance to this function to encrypt it safely.
 *
 * @example
 * ```ts
 * import { EncryptJWT } from "jose";
 * import { encryptJwt } from "@antithrow/jose/jwt";
 *
 * const jwt = new EncryptJWT({ sub: "user-123" })
 *   .setProtectedHeader({ alg: "RSA-OAEP", enc: "A256GCM" })
 *   .setExpirationTime("2h");
 *
 * const result = await encryptJwt(jwt, publicKey);
 * ```
 *
 * @param jwt - A configured `EncryptJWT` instance ready to be encrypted.
 * @param key - Public Key or Secret to encrypt the JWT with.
 * @param options - JWE Encryption options.
 *
 * @returns A `ResultAsync` containing the encrypted JWT string, or an error.
 */
export function encryptJwt(
	jwt: EncryptJWT,
	key: CryptoKey | KeyObject | JWK | Uint8Array,
	options?: EncryptOptions,
): ResultAsync<string, errors.JWEInvalid | errors.JOSENotSupported | TypeError> {
	return ResultAsync.try(() => jwt.encrypt(key, options));
}
