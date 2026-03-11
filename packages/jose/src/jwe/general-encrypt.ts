import { ResultAsync } from "antithrow/legacy";
import type { errors, GeneralEncrypt, GeneralJWE } from "jose";

/**
 * Encrypts a {@link GeneralEncrypt} instance, returning a `ResultAsync` instead of throwing.
 *
 * @example
 * ```ts
 * import { GeneralEncrypt, generalEncrypt } from "@antithrow/jose/jwe";
 *
 * const encryptor = new GeneralEncrypt(plaintext)
 *   .setProtectedHeader({ enc: "A256GCM" })
 *   .addRecipient(publicKey)
 *   .setUnprotectedHeader({ alg: "RSA-OAEP" })
 *   .done();
 *
 * const result = await generalEncrypt(encryptor);
 * ```
 *
 * @param encryptor - A configured {@link GeneralEncrypt} instance.
 *
 * @returns A `ResultAsync` containing the General JWE object or a JWE/JOSE error.
 */
export function generalEncrypt(
	encryptor: GeneralEncrypt,
): ResultAsync<GeneralJWE, errors.JWEInvalid | errors.JOSENotSupported | TypeError> {
	return ResultAsync.try(() => encryptor.encrypt());
}
