import { ResultAsync } from "antithrow";
import type { CryptoKey, errors, JWK, KeyObject, SignJWT, SignOptions } from "jose";

/**
 * Non-throwing wrapper around `SignJWT.prototype.sign`.
 *
 * Build a JWT with `new SignJWT(payload)` and its builder methods, then pass
 * the instance to this function to sign it safely.
 *
 * @example
 * ```ts
 * import { SignJWT } from "jose";
 * import { signJwt } from "@antithrow/jose/jwt";
 *
 * const jwt = new SignJWT({ sub: "user-123" })
 *   .setProtectedHeader({ alg: "HS256" })
 *   .setExpirationTime("2h");
 *
 * const result = await signJwt(jwt, secretKey);
 * ```
 *
 * @param jwt - A configured `SignJWT` instance ready to be signed.
 * @param key - Private Key or Secret to sign the JWT with.
 * @param options - JWT Sign options.
 *
 * @returns A `ResultAsync` containing the signed JWT string, or an error.
 */
export function signJwt(
	jwt: SignJWT,
	key: CryptoKey | KeyObject | JWK | Uint8Array,
	options?: SignOptions,
): ResultAsync<string, errors.JWTInvalid | errors.JWSInvalid | TypeError> {
	return ResultAsync.try(() => jwt.sign(key, options));
}
