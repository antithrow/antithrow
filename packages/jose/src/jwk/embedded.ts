import { ResultAsync } from "antithrow/legacy";
import type { CryptoKey, errors, FlattenedJWSInput, JWSHeaderParameters } from "jose";
import { EmbeddedJWK as joseEmbeddedJWK } from "jose";

/**
 * Non-throwing wrapper around `jose.EmbeddedJWK`.
 *
 * Resolves a public key from the JWS Header's `jwk` member.
 *
 * @example
 * ```ts
 * import { embeddedJWK } from "@antithrow/jose/jwk";
 *
 * const result = await embeddedJWK(protectedHeader, token);
 * ```
 *
 * @param protectedHeader - The JWS Protected Header.
 * @param token - The JWS token.
 *
 * @returns A `ResultAsync` containing the resolved `CryptoKey`, or an error.
 */
export function embeddedJWK(
	protectedHeader?: JWSHeaderParameters,
	token?: FlattenedJWSInput,
): ResultAsync<CryptoKey, errors.JWSInvalid | TypeError | errors.JOSENotSupported> {
	return ResultAsync.try(() => joseEmbeddedJWK(protectedHeader, token));
}
