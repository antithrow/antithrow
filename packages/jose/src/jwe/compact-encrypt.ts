import { ResultAsync } from "antithrow";
import type { CompactEncrypt, CryptoKey, EncryptOptions, errors, JWK, KeyObject } from "jose";

/**
 * Encrypts a {@link CompactEncrypt} instance, returning a `ResultAsync` instead of throwing.
 *
 * @example
 * ```ts
 * import { CompactEncrypt, compactEncrypt } from "@antithrow/jose/jwe";
 *
 * const encryptor = new CompactEncrypt(plaintext)
 *   .setProtectedHeader({ alg: "RSA-OAEP", enc: "A256GCM" });
 *
 * const result = await compactEncrypt(encryptor, publicKey);
 * ```
 *
 * @param encryptor - A configured {@link CompactEncrypt} instance.
 * @param key - Public Key or Secret to encrypt the JWE with.
 * @param options - JWE Encryption options.
 *
 * @returns A `ResultAsync` containing the Compact JWE string or a JWE/JOSE error.
 */
export function compactEncrypt(
	encryptor: CompactEncrypt,
	key: CryptoKey | KeyObject | JWK | Uint8Array,
	options?: EncryptOptions,
): ResultAsync<string, errors.JWEInvalid | errors.JOSENotSupported | TypeError> {
	return ResultAsync.try(() => encryptor.encrypt(key, options));
}
