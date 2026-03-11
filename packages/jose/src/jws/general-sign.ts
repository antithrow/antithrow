import { ResultAsync } from "antithrow/legacy";
import type { errors, GeneralJWS, GeneralSign } from "jose";

/**
 * Non-throwing wrapper around {@link GeneralSign.sign}.
 *
 * Signs and resolves the value of a General JWS object, returning a
 * `ResultAsync` instead of throwing.
 *
 * Note: Signatures are added via {@link GeneralSign.addSignature} before
 * calling this function.
 *
 * @example
 * ```ts
 * import { generalSign, GeneralSign } from "@antithrow/jose/jws";
 *
 * const signer = new GeneralSign(
 *   new TextEncoder().encode(JSON.stringify({ hello: "world" })),
 * );
 * signer
 *   .addSignature(privateKey)
 *   .setProtectedHeader({ alg: "ES256" });
 *
 * const result = await generalSign(signer);
 * if (result.isOk()) {
 *   console.log(result.value); // GeneralJWS object
 * }
 * ```
 *
 * @param signer - A configured {@link GeneralSign} instance with at least one signature added.
 *
 * @returns A `ResultAsync` containing the general JWS object or a JWS error.
 */
export function generalSign(
	signer: GeneralSign,
): ResultAsync<GeneralJWS, errors.JWSInvalid | TypeError> {
	return ResultAsync.try(() => signer.sign());
}
