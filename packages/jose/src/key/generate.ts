import { ResultAsync } from "antithrow";
import type {
	CryptoKey,
	errors,
	GenerateKeyPairOptions,
	GenerateKeyPairResult,
	GenerateSecretOptions,
} from "jose";
import { generateKeyPair as joseGenerateKeyPair, generateSecret as joseGenerateSecret } from "jose";

/**
 * Non-throwing wrapper around `jose.generateKeyPair`.
 *
 * Generates a key pair for the specified algorithm.
 *
 * @example
 * ```ts
 * import { generateKeyPair } from "@antithrow/jose/key";
 *
 * const result = await generateKeyPair("RS256");
 * ```
 *
 * @param alg - The JWS/JWE algorithm identifier.
 * @param options - Optional key pair generation options.
 *
 * @returns A `ResultAsync` containing the generated key pair, or an error.
 */
export function generateKeyPair(
	alg: string,
	options?: GenerateKeyPairOptions,
): ResultAsync<GenerateKeyPairResult, errors.JOSENotSupported> {
	return ResultAsync.try(() => joseGenerateKeyPair(alg, options));
}

/**
 * Non-throwing wrapper around `jose.generateSecret`.
 *
 * Generates a symmetric secret key for the specified algorithm.
 *
 * @example
 * ```ts
 * import { generateSecret } from "@antithrow/jose/key";
 *
 * const result = await generateSecret("HS256");
 * ```
 *
 * @param alg - The JWS/JWE algorithm identifier.
 * @param options - Optional secret generation options.
 *
 * @returns A `ResultAsync` containing the generated secret key, or an error.
 */
export function generateSecret(
	alg: string,
	options?: GenerateSecretOptions,
): ResultAsync<CryptoKey | Uint8Array, errors.JOSENotSupported> {
	return ResultAsync.try(() => joseGenerateSecret(alg, options));
}
