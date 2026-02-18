import { ResultAsync } from "antithrow";
import type {
	CryptoKey,
	errors,
	JWK,
	JWTPayload,
	JWTVerifyGetKey,
	JWTVerifyOptions,
	JWTVerifyResult,
	KeyObject,
	ResolvedKey,
} from "jose";
import { jwtVerify as joseJwtVerify } from "jose";

type JwtVerifyError =
	| errors.JWTInvalid
	| errors.JWSInvalid
	| errors.JOSEAlgNotAllowed
	| errors.JWSSignatureVerificationFailed
	| errors.JWTClaimValidationFailed
	| errors.JWTExpired
	| TypeError;

/**
 * Non-throwing wrapper around `jose.jwtVerify` with a static key.
 *
 * @example
 * ```ts
 * import { jwtVerify } from "@antithrow/jose/jwt";
 *
 * const result = await jwtVerify(token, secretKey);
 * ```
 *
 * @param jwt - JSON Web Token value (encoded as JWS).
 * @param key - Key to verify the JWT with.
 * @param options - JWT verification and claims set validation options.
 *
 * @returns A `ResultAsync` containing the verified JWT result, or an error.
 */
export function jwtVerify<PayloadType = JWTPayload>(
	jwt: string | Uint8Array,
	key: CryptoKey | KeyObject | JWK | Uint8Array,
	options?: JWTVerifyOptions,
): ResultAsync<JWTVerifyResult<PayloadType>, JwtVerifyError>;
/**
 * Non-throwing wrapper around `jose.jwtVerify` with a dynamic key resolution function.
 *
 * @example
 * ```ts
 * import { jwtVerify } from "@antithrow/jose/jwt";
 * import { createRemoteJWKSet } from "jose";
 *
 * const JWKS = createRemoteJWKSet(new URL("https://example.com/.well-known/jwks.json"));
 * const result = await jwtVerify(token, JWKS);
 * ```
 *
 * @param jwt - JSON Web Token value (encoded as JWS).
 * @param getKey - Function resolving a key to verify the JWT with.
 * @param options - JWT verification and claims set validation options.
 *
 * @returns A `ResultAsync` containing the verified JWT result with resolved key, or an error.
 */
export function jwtVerify<PayloadType = JWTPayload>(
	jwt: string | Uint8Array,
	getKey: JWTVerifyGetKey,
	options?: JWTVerifyOptions,
): ResultAsync<JWTVerifyResult<PayloadType> & ResolvedKey, JwtVerifyError>;
export function jwtVerify<PayloadType = JWTPayload>(
	jwt: string | Uint8Array,
	keyOrGetKey: CryptoKey | KeyObject | JWK | Uint8Array | JWTVerifyGetKey,
	options?: JWTVerifyOptions,
): ResultAsync<JWTVerifyResult<PayloadType> & Partial<ResolvedKey>, JwtVerifyError> {
	return ResultAsync.try(() => joseJwtVerify<PayloadType>(jwt, keyOrGetKey as CryptoKey, options));
}
