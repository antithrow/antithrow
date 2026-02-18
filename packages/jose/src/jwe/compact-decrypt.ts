import { ResultAsync } from "antithrow";
import type {
	CompactDecryptGetKey,
	CompactDecryptResult,
	CryptoKey,
	DecryptOptions,
	errors,
	JWK,
	KeyObject,
	ResolvedKey,
} from "jose";
import { compactDecrypt as joseCompactDecrypt } from "jose";

type CompactDecryptError =
	| errors.JWEInvalid
	| errors.JOSEAlgNotAllowed
	| errors.JOSENotSupported
	| errors.JWEDecryptionFailed
	| TypeError;

/**
 * Decrypts a Compact JWE string, returning a `ResultAsync` instead of throwing.
 *
 * @example
 * ```ts
 * import { compactDecrypt } from "@antithrow/jose/jwe";
 *
 * const result = await compactDecrypt(jwe, secretKey);
 * ```
 *
 * @param jwe - Compact JWE string or bytes.
 * @param key - Private Key or Secret to decrypt the JWE with.
 * @param options - JWE Decryption options.
 *
 * @returns A `ResultAsync` containing the decrypted result or a JWE/JOSE error.
 */
export function compactDecrypt(
	jwe: string | Uint8Array,
	key: CryptoKey | KeyObject | JWK | Uint8Array,
	options?: DecryptOptions,
): ResultAsync<CompactDecryptResult, CompactDecryptError>;
/**
 * Decrypts a Compact JWE string using dynamic key resolution, returning a `ResultAsync` instead of
 * throwing.
 *
 * @example
 * ```ts
 * import { compactDecrypt } from "@antithrow/jose/jwe";
 *
 * const result = await compactDecrypt(jwe, async (header, token) => {
 *   return getKeyForHeader(header);
 * });
 * ```
 *
 * @param jwe - Compact JWE string or bytes.
 * @param getKey - Function resolving Private Key or Secret to decrypt the JWE with.
 * @param options - JWE Decryption options.
 *
 * @returns A `ResultAsync` containing the decrypted result with the resolved key, or a JWE/JOSE error.
 */
export function compactDecrypt(
	jwe: string | Uint8Array,
	getKey: CompactDecryptGetKey,
	options?: DecryptOptions,
): ResultAsync<CompactDecryptResult & ResolvedKey, CompactDecryptError>;
export function compactDecrypt(
	jwe: string | Uint8Array,
	keyOrGetKey: CryptoKey | KeyObject | JWK | Uint8Array | CompactDecryptGetKey,
	options?: DecryptOptions,
): ResultAsync<CompactDecryptResult & Partial<ResolvedKey>, CompactDecryptError> {
	return ResultAsync.try(() =>
		joseCompactDecrypt(jwe, keyOrGetKey as CompactDecryptGetKey, options),
	);
}
