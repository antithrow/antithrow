import { ResultAsync } from "antithrow/legacy";
import type {
	CryptoKey,
	EncryptOptions,
	errors,
	FlattenedEncrypt,
	FlattenedJWE,
	JWK,
	KeyObject,
} from "jose";

/**
 * Encrypts a {@link FlattenedEncrypt} instance, returning a `ResultAsync` instead of throwing.
 *
 * @example
 * ```ts
 * import { FlattenedEncrypt, flattenedEncrypt } from "@antithrow/jose/jwe";
 *
 * const encryptor = new FlattenedEncrypt(plaintext)
 *   .setProtectedHeader({ alg: "RSA-OAEP", enc: "A256GCM" });
 *
 * const result = await flattenedEncrypt(encryptor, publicKey);
 * ```
 *
 * @param encryptor - A configured {@link FlattenedEncrypt} instance.
 * @param key - Public Key or Secret to encrypt the JWE with.
 * @param options - JWE Encryption options.
 *
 * @returns A `ResultAsync` containing the Flattened JWE object or a JWE/JOSE error.
 */
export function flattenedEncrypt(
	encryptor: FlattenedEncrypt,
	key: CryptoKey | KeyObject | JWK | Uint8Array,
	options?: EncryptOptions,
): ResultAsync<FlattenedJWE, errors.JWEInvalid | errors.JOSENotSupported | TypeError> {
	return ResultAsync.try(() => encryptor.encrypt(key, options));
}
