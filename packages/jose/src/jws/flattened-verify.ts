import { ResultAsync } from "antithrow";
import type {
	CryptoKey,
	errors,
	FlattenedJWSInput,
	FlattenedVerifyGetKey,
	FlattenedVerifyResult,
	JWK,
	KeyObject,
	ResolvedKey,
	VerifyOptions,
} from "jose";
import { flattenedVerify as joseFlattenedVerify } from "jose";

type FlattenedVerifyError =
	| errors.JWSInvalid
	| errors.JOSEAlgNotAllowed
	| errors.JWSSignatureVerificationFailed
	| TypeError;

/**
 * Non-throwing wrapper around jose's
 * {@link https://github.com/panva/jose/blob/main/docs/functions/jws_flattened_verify.flattenedVerify.md flattenedVerify}.
 *
 * Verifies the signature and format of a Flattened JWS and decodes it.
 *
 * @example
 * ```ts
 * import { flattenedVerify } from "@antithrow/jose/jws";
 *
 * const result = await flattenedVerify(jws, publicKey);
 * if (result.isOk()) {
 *   console.log(result.value.payload);
 * }
 * ```
 *
 * @param jws - Flattened JWS object.
 * @param key - Key to verify the JWS with.
 * @param options - JWS Verify options.
 *
 * @returns A `ResultAsync` containing the verified payload or a JWS error.
 */
export function flattenedVerify(
	jws: FlattenedJWSInput,
	key: CryptoKey | KeyObject | JWK | Uint8Array,
	options?: VerifyOptions,
): ResultAsync<FlattenedVerifyResult, FlattenedVerifyError>;
/**
 * Non-throwing wrapper around jose's
 * {@link https://github.com/panva/jose/blob/main/docs/functions/jws_flattened_verify.flattenedVerify.md flattenedVerify}
 * with dynamic key resolution.
 *
 * @example
 * ```ts
 * import { flattenedVerify } from "@antithrow/jose/jws";
 * import { createRemoteJWKSet } from "jose";
 *
 * const JWKS = createRemoteJWKSet(new URL("https://example.com/.well-known/jwks.json"));
 * const result = await flattenedVerify(jws, JWKS);
 * if (result.isOk()) {
 *   console.log(result.value.key);
 * }
 * ```
 *
 * @param jws - Flattened JWS object.
 * @param getKey - Function resolving a key to verify the JWS with.
 * @param options - JWS Verify options.
 *
 * @returns A `ResultAsync` containing the verified payload and resolved key, or a JWS error.
 */
export function flattenedVerify(
	jws: FlattenedJWSInput,
	getKey: FlattenedVerifyGetKey,
	options?: VerifyOptions,
): ResultAsync<FlattenedVerifyResult & ResolvedKey, FlattenedVerifyError>;
export function flattenedVerify(
	jws: FlattenedJWSInput,
	keyOrGetKey: CryptoKey | KeyObject | JWK | Uint8Array | FlattenedVerifyGetKey,
	options?: VerifyOptions,
): ResultAsync<FlattenedVerifyResult & Partial<ResolvedKey>, FlattenedVerifyError> {
	return ResultAsync.try(() => joseFlattenedVerify(jws, keyOrGetKey as CryptoKey, options));
}
