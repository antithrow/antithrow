import { ResultAsync } from "antithrow/legacy";
import type {
	CryptoKey,
	errors,
	FlattenedJWSInput,
	JWSHeaderParameters,
	RemoteJWKSetOptions,
} from "jose";
import { createRemoteJWKSet as joseCreateRemoteJWKSet } from "jose";

type RemoteJWKSetError =
	| TypeError
	| errors.JWKSTimeout
	| errors.JOSEError
	| errors.JWKSInvalid
	| errors.JOSENotSupported
	| errors.JWKSNoMatchingKey
	| errors.JWKSMultipleMatchingKeys;

/**
 * Non-throwing wrapper around `jose.createRemoteJWKSet`.
 *
 * Creates a function that resolves a JWS JOSE Header to a public key from a remote JWKS endpoint.
 * The returned function wraps its result in a `ResultAsync`.
 *
 * @example
 * ```ts
 * import { createRemoteJWKSet } from "@antithrow/jose/jwks";
 *
 * const getKey = createRemoteJWKSet(new URL("https://example.com/.well-known/jwks.json"));
 * const result = await getKey(protectedHeader, token);
 * ```
 *
 * @param url - The URL of the remote JWKS endpoint.
 * @param options - Optional configuration for the remote JWKS.
 *
 * @returns A function that resolves a `CryptoKey` wrapped in a `ResultAsync`.
 */
export function createRemoteJWKSet(
	url: URL,
	options?: RemoteJWKSetOptions,
): (
	protectedHeader?: JWSHeaderParameters,
	token?: FlattenedJWSInput,
) => ResultAsync<CryptoKey, RemoteJWKSetError> {
	const getKey = joseCreateRemoteJWKSet(url, options);
	return (protectedHeader?, token?) => ResultAsync.try(() => getKey(protectedHeader, token));
}
