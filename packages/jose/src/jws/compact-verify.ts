import { ResultAsync } from "antithrow/legacy";
import type {
	CompactVerifyGetKey,
	CompactVerifyResult,
	CryptoKey,
	errors,
	JWK,
	KeyObject,
	ResolvedKey,
	VerifyOptions,
} from "jose";
import { compactVerify as joseCompactVerify } from "jose";

type CompactVerifyError =
	| errors.JWSInvalid
	| errors.JOSEAlgNotAllowed
	| errors.JWSSignatureVerificationFailed;

/**
 * Non-throwing wrapper around jose's
 * {@link https://github.com/panva/jose/blob/main/docs/functions/jws_compact_verify.compactVerify.md compactVerify}.
 *
 * Verifies the signature and format of a Compact JWS and decodes it.
 *
 * @example
 * ```ts
 * import { compactVerify } from "@antithrow/jose/jws";
 *
 * const result = await compactVerify(jws, publicKey);
 * if (result.isOk()) {
 *   console.log(result.value.payload);
 * }
 * ```
 *
 * @param jws - Compact JWS string or bytes.
 * @param key - Key to verify the JWS with.
 * @param options - JWS Verify options.
 *
 * @returns A `ResultAsync` containing the verified payload or a JWS error.
 */
export function compactVerify(
	jws: string | Uint8Array,
	key: CryptoKey | KeyObject | JWK | Uint8Array,
	options?: VerifyOptions,
): ResultAsync<CompactVerifyResult, CompactVerifyError>;
/**
 * Non-throwing wrapper around jose's
 * {@link https://github.com/panva/jose/blob/main/docs/functions/jws_compact_verify.compactVerify.md compactVerify}
 * with dynamic key resolution.
 *
 * @example
 * ```ts
 * import { compactVerify } from "@antithrow/jose/jws";
 * import { createRemoteJWKSet } from "jose";
 *
 * const JWKS = createRemoteJWKSet(new URL("https://example.com/.well-known/jwks.json"));
 * const result = await compactVerify(jws, JWKS);
 * if (result.isOk()) {
 *   console.log(result.value.key);
 * }
 * ```
 *
 * @param jws - Compact JWS string or bytes.
 * @param getKey - Function resolving a key to verify the JWS with.
 * @param options - JWS Verify options.
 *
 * @returns A `ResultAsync` containing the verified payload and resolved key, or a JWS error.
 */
export function compactVerify(
	jws: string | Uint8Array,
	getKey: CompactVerifyGetKey,
	options?: VerifyOptions,
): ResultAsync<CompactVerifyResult & ResolvedKey, CompactVerifyError>;
export function compactVerify(
	jws: string | Uint8Array,
	keyOrGetKey: CryptoKey | KeyObject | JWK | Uint8Array | CompactVerifyGetKey,
	options?: VerifyOptions,
): ResultAsync<CompactVerifyResult & Partial<ResolvedKey>, CompactVerifyError> {
	return ResultAsync.try(() => joseCompactVerify(jws, keyOrGetKey as CryptoKey, options));
}
