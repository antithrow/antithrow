import { ResultAsync } from "antithrow";
import type { CompactSign, CryptoKey, errors, JWK, KeyObject, SignOptions } from "jose";

/**
 * Non-throwing wrapper around {@link CompactSign.sign}.
 *
 * Signs and resolves the value of a Compact JWS string, returning a
 * `ResultAsync` instead of throwing.
 *
 * @example
 * ```ts
 * import { compactSign, CompactSign } from "@antithrow/jose/jws";
 *
 * const signer = new CompactSign(
 *   new TextEncoder().encode(JSON.stringify({ hello: "world" })),
 * ).setProtectedHeader({ alg: "ES256" });
 *
 * const result = await compactSign(signer, privateKey);
 * if (result.isOk()) {
 *   console.log(result.value); // compact JWS string
 * }
 * ```
 *
 * @param signer - A configured {@link CompactSign} instance.
 * @param key - Private Key or Secret to sign the JWS with.
 * @param options - JWS Sign options.
 *
 * @returns A `ResultAsync` containing the compact JWS string or a JWS error.
 */
export function compactSign(
	signer: CompactSign,
	key: CryptoKey | KeyObject | JWK | Uint8Array,
	options?: SignOptions,
): ResultAsync<string, errors.JWSInvalid | TypeError> {
	return ResultAsync.try(() => signer.sign(key, options));
}
