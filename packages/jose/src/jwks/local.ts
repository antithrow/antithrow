import { ResultAsync } from "antithrow";
import type {
	CryptoKey,
	errors,
	FlattenedJWSInput,
	JSONWebKeySet,
	JWSHeaderParameters,
} from "jose";
import { createLocalJWKSet as joseCreateLocalJWKSet } from "jose";

type LocalJWKSetError =
	| errors.JWKSInvalid
	| errors.JOSENotSupported
	| errors.JWKSNoMatchingKey
	| errors.JWKSMultipleMatchingKeys
	| TypeError;

/**
 * Non-throwing wrapper around `jose.createLocalJWKSet`.
 *
 * Creates a function that resolves a JWS JOSE Header to a public key from a local JWKS.
 * The returned function wraps its result in a `ResultAsync`.
 *
 * @example
 * ```ts
 * import { createLocalJWKSet } from "@antithrow/jose/jwks";
 *
 * const getKey = createLocalJWKSet({ keys: [...] });
 * const result = await getKey(protectedHeader, token);
 * ```
 *
 * @param jwks - The JSON Web Key Set.
 *
 * @returns A function that resolves a `CryptoKey` wrapped in a `ResultAsync`.
 */
export function createLocalJWKSet(
	jwks: JSONWebKeySet,
): (
	protectedHeader?: JWSHeaderParameters,
	token?: FlattenedJWSInput,
) => ResultAsync<CryptoKey, LocalJWKSetError> {
	const getKey = joseCreateLocalJWKSet(jwks);
	return (protectedHeader?, token?) => ResultAsync.try(() => getKey(protectedHeader, token));
}
