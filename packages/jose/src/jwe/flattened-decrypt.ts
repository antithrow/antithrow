import { ResultAsync } from "antithrow";
import type {
	CryptoKey,
	DecryptOptions,
	errors,
	FlattenedDecryptGetKey,
	FlattenedDecryptResult,
	FlattenedJWE,
	JWK,
	KeyObject,
	ResolvedKey,
} from "jose";
import { flattenedDecrypt as joseFlattenedDecrypt } from "jose";

type FlattenedDecryptError =
	| errors.JWEInvalid
	| errors.JOSENotSupported
	| errors.JOSEAlgNotAllowed
	| errors.JWEDecryptionFailed
	| TypeError;

/**
 * Decrypts a Flattened JWE object, returning a `ResultAsync` instead of throwing.
 *
 * @example
 * ```ts
 * import { flattenedDecrypt } from "@antithrow/jose/jwe";
 *
 * const result = await flattenedDecrypt(jwe, secretKey);
 * ```
 *
 * @param jwe - Flattened JWE object.
 * @param key - Private Key or Secret to decrypt the JWE with.
 * @param options - JWE Decryption options.
 *
 * @returns A `ResultAsync` containing the decrypted result or a JWE/JOSE error.
 */
export function flattenedDecrypt(
	jwe: FlattenedJWE,
	key: CryptoKey | KeyObject | JWK | Uint8Array,
	options?: DecryptOptions,
): ResultAsync<FlattenedDecryptResult, FlattenedDecryptError>;
/**
 * Decrypts a Flattened JWE object using dynamic key resolution, returning a `ResultAsync` instead
 * of throwing.
 *
 * @example
 * ```ts
 * import { flattenedDecrypt } from "@antithrow/jose/jwe";
 *
 * const result = await flattenedDecrypt(jwe, async (header, token) => {
 *   return getKeyForHeader(header);
 * });
 * ```
 *
 * @param jwe - Flattened JWE object.
 * @param getKey - Function resolving Private Key or Secret to decrypt the JWE with.
 * @param options - JWE Decryption options.
 *
 * @returns A `ResultAsync` containing the decrypted result with the resolved key, or a JWE/JOSE error.
 */
export function flattenedDecrypt(
	jwe: FlattenedJWE,
	getKey: FlattenedDecryptGetKey,
	options?: DecryptOptions,
): ResultAsync<FlattenedDecryptResult & ResolvedKey, FlattenedDecryptError>;
export function flattenedDecrypt(
	jwe: FlattenedJWE,
	keyOrGetKey: CryptoKey | KeyObject | JWK | Uint8Array | FlattenedDecryptGetKey,
	options?: DecryptOptions,
): ResultAsync<FlattenedDecryptResult & Partial<ResolvedKey>, FlattenedDecryptError> {
	return ResultAsync.try(() =>
		joseFlattenedDecrypt(jwe, keyOrGetKey as FlattenedDecryptGetKey, options),
	);
}
