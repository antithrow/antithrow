import { ResultAsync } from "antithrow/legacy";
import type { CryptoKey, errors, JWK, KeyObject } from "jose";
import {
	calculateJwkThumbprint as joseCalculateJwkThumbprint,
	calculateJwkThumbprintUri as joseCalculateJwkThumbprintUri,
} from "jose";

/**
 * Non-throwing wrapper around `jose.calculateJwkThumbprint`.
 *
 * Calculates a base64url-encoded JWK Thumbprint (RFC 7638).
 *
 * @example
 * ```ts
 * import { calculateJwkThumbprint } from "@antithrow/jose/jwk";
 *
 * const result = await calculateJwkThumbprint(jwk, "sha256");
 * ```
 *
 * @param jwk - The JSON Web Key.
 * @param digestAlgorithm - Optional digest algorithm (defaults to `"sha256"`).
 *
 * @returns A `ResultAsync` containing the thumbprint string, or an error.
 */
export function calculateJwkThumbprint(
	key: JWK | CryptoKey | KeyObject,
	digestAlgorithm?: "sha256" | "sha384" | "sha512",
): ResultAsync<string, TypeError | errors.JWKInvalid | errors.JOSENotSupported> {
	return ResultAsync.try(() => joseCalculateJwkThumbprint(key, digestAlgorithm));
}

/**
 * Non-throwing wrapper around `jose.calculateJwkThumbprintUri`.
 *
 * Calculates a JWK Thumbprint URI (RFC 9278).
 *
 * @example
 * ```ts
 * import { calculateJwkThumbprintUri } from "@antithrow/jose/jwk";
 *
 * const result = await calculateJwkThumbprintUri(jwk, "sha256");
 * ```
 *
 * @param jwk - The JSON Web Key.
 * @param digestAlgorithm - Optional digest algorithm (defaults to `"sha256"`).
 *
 * @returns A `ResultAsync` containing the thumbprint URI string, or an error.
 */
export function calculateJwkThumbprintUri(
	key: CryptoKey | KeyObject | JWK,
	digestAlgorithm?: "sha256" | "sha384" | "sha512",
): ResultAsync<string, TypeError | errors.JWKInvalid | errors.JOSENotSupported> {
	return ResultAsync.try(() => joseCalculateJwkThumbprintUri(key, digestAlgorithm));
}
