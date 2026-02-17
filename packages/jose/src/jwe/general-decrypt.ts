import { ResultAsync } from "antithrow";
import type {
	CryptoKey,
	DecryptOptions,
	errors,
	GeneralDecryptGetKey,
	GeneralDecryptResult,
	GeneralJWE,
	JWK,
	KeyObject,
	ResolvedKey,
} from "jose";
import { generalDecrypt as joseGeneralDecrypt } from "jose";

type GeneralDecryptError =
	| errors.JWEInvalid
	| errors.JWEDecryptionFailed
	| errors.JOSENotSupported
	| errors.JOSEAlgNotAllowed
	| TypeError;

/**
 * Decrypts a General JWE object, returning a `ResultAsync` instead of throwing.
 *
 * @example
 * ```ts
 * import { generalDecrypt } from "@antithrow/jose/jwe";
 *
 * const result = await generalDecrypt(jwe, secretKey);
 * ```
 *
 * @param jwe - General JWE object.
 * @param key - Private Key or Secret to decrypt the JWE with.
 * @param options - JWE Decryption options.
 *
 * @returns A `ResultAsync` containing the decrypted result or a JWE/JOSE error.
 */
export function generalDecrypt(
	jwe: GeneralJWE,
	key: CryptoKey | KeyObject | JWK | Uint8Array,
	options?: DecryptOptions,
): ResultAsync<GeneralDecryptResult, GeneralDecryptError>;
/**
 * Decrypts a General JWE object using dynamic key resolution, returning a `ResultAsync` instead of
 * throwing.
 *
 * @example
 * ```ts
 * import { generalDecrypt } from "@antithrow/jose/jwe";
 *
 * const result = await generalDecrypt(jwe, async (header, token) => {
 *   return getKeyForHeader(header);
 * });
 * ```
 *
 * @param jwe - General JWE object.
 * @param getKey - Function resolving Private Key or Secret to decrypt the JWE with.
 * @param options - JWE Decryption options.
 *
 * @returns A `ResultAsync` containing the decrypted result with the resolved key, or a JWE/JOSE error.
 */
export function generalDecrypt(
	jwe: GeneralJWE,
	getKey: GeneralDecryptGetKey,
	options?: DecryptOptions,
): ResultAsync<GeneralDecryptResult & ResolvedKey, GeneralDecryptError>;
export function generalDecrypt(
	jwe: GeneralJWE,
	keyOrGetKey: CryptoKey | KeyObject | JWK | Uint8Array | GeneralDecryptGetKey,
	options?: DecryptOptions,
): ResultAsync<GeneralDecryptResult & Partial<ResolvedKey>, GeneralDecryptError> {
	return ResultAsync.try(() =>
		joseGeneralDecrypt(jwe, keyOrGetKey as GeneralDecryptGetKey, options),
	);
}
