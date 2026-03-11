import { ResultAsync } from "antithrow/legacy";
import type {
	CryptoKey,
	errors,
	JWK,
	JWTDecryptGetKey,
	JWTDecryptOptions,
	JWTDecryptResult,
	JWTPayload,
	KeyObject,
	ResolvedKey,
} from "jose";
import { jwtDecrypt as joseJwtDecrypt } from "jose";

type JwtDecryptError =
	| errors.JWEInvalid
	| errors.JOSEAlgNotAllowed
	| errors.JOSENotSupported
	| errors.JWEDecryptionFailed
	| errors.JWTClaimValidationFailed
	| errors.JWTExpired
	| errors.JWTInvalid
	| TypeError;

/**
 * Non-throwing wrapper around `jose.jwtDecrypt` with a static key.
 *
 * @example
 * ```ts
 * import { jwtDecrypt } from "@antithrow/jose/jwt";
 *
 * const result = await jwtDecrypt(token, secretKey);
 * ```
 *
 * @param jwt - JSON Web Token value (encoded as JWE).
 * @param key - Private Key or Secret to decrypt and verify the JWT with.
 * @param options - JWT decryption and claims set validation options.
 *
 * @returns A `ResultAsync` containing the decrypted JWT result, or an error.
 */
export function jwtDecrypt<PayloadType = JWTPayload>(
	jwt: string | Uint8Array,
	key: CryptoKey | KeyObject | JWK | Uint8Array,
	options?: JWTDecryptOptions,
): ResultAsync<JWTDecryptResult<PayloadType>, JwtDecryptError>;
/**
 * Non-throwing wrapper around `jose.jwtDecrypt` with a dynamic key resolution function.
 *
 * @example
 * ```ts
 * import { jwtDecrypt } from "@antithrow/jose/jwt";
 *
 * const result = await jwtDecrypt(token, getKey);
 * ```
 *
 * @param jwt - JSON Web Token value (encoded as JWE).
 * @param getKey - Function resolving Private Key or Secret to decrypt and verify the JWT with.
 * @param options - JWT decryption and claims set validation options.
 *
 * @returns A `ResultAsync` containing the decrypted JWT result with resolved key, or an error.
 */
export function jwtDecrypt<PayloadType = JWTPayload>(
	jwt: string | Uint8Array,
	getKey: JWTDecryptGetKey,
	options?: JWTDecryptOptions,
): ResultAsync<JWTDecryptResult<PayloadType> & ResolvedKey, JwtDecryptError>;
export function jwtDecrypt<PayloadType = JWTPayload>(
	jwt: string | Uint8Array,
	keyOrGetKey: CryptoKey | KeyObject | JWK | Uint8Array | JWTDecryptGetKey,
	options?: JWTDecryptOptions,
): ResultAsync<JWTDecryptResult<PayloadType> & Partial<ResolvedKey>, JwtDecryptError> {
	return ResultAsync.try(() => joseJwtDecrypt<PayloadType>(jwt, keyOrGetKey as CryptoKey, options));
}
