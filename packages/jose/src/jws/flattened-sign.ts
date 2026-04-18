import { ResultAsync } from "antithrow/legacy";
import type {
	CryptoKey,
	errors,
	FlattenedJWS,
	FlattenedSign,
	JWK,
	KeyObject,
	SignOptions,
} from "jose";

/**
 * Non-throwing wrapper around {@link FlattenedSign.sign}.
 *
 * Signs and resolves the value of a Flattened JWS object, returning a
 * `ResultAsync` instead of throwing.
 *
 * @example
 * ```ts
 * import { flattenedSign, FlattenedSign } from "@antithrow/jose/jws";
 *
 * const signer = new FlattenedSign(
 *   new TextEncoder().encode(JSON.stringify({ hello: "world" })),
 * ).setProtectedHeader({ alg: "ES256" });
 *
 * const result = await flattenedSign(signer, privateKey);
 * if (result.isOk()) {
 *   console.log(result.value); // FlattenedJWS object
 * }
 * ```
 *
 * @param signer - A configured {@link FlattenedSign} instance.
 * @param key - Private Key or Secret to sign the JWS with.
 * @param options - JWS Sign options.
 *
 * @returns A `ResultAsync` containing the flattened JWS object or a JWS error.
 */
export function flattenedSign(
	signer: FlattenedSign,
	key: CryptoKey | KeyObject | JWK | Uint8Array,
	options?: SignOptions,
): ResultAsync<FlattenedJWS, errors.JWSInvalid | TypeError> {
	return ResultAsync.try(() => signer.sign(key, options));
}
