import { ResultAsync } from "antithrow/legacy";
import type {
	CryptoKey,
	errors,
	GeneralJWSInput,
	GeneralVerifyGetKey,
	GeneralVerifyResult,
	JWK,
	KeyObject,
	ResolvedKey,
	VerifyOptions,
} from "jose";
import { generalVerify as joseGeneralVerify } from "jose";

type GeneralVerifyError =
	| errors.JWSInvalid
	| errors.JOSEAlgNotAllowed
	| errors.JWSSignatureVerificationFailed
	| TypeError;

/**
 * Non-throwing wrapper around jose's
 * {@link https://github.com/panva/jose/blob/main/docs/functions/jws_general_verify.generalVerify.md generalVerify}.
 *
 * Verifies the signature and format of a General JWS and decodes it.
 *
 * @example
 * ```ts
 * import { generalVerify } from "@antithrow/jose/jws";
 *
 * const result = await generalVerify(jws, publicKey);
 * if (result.isOk()) {
 *   console.log(result.value.payload);
 * }
 * ```
 *
 * @param jws - General JWS object.
 * @param key - Key to verify the JWS with.
 * @param options - JWS Verify options.
 *
 * @returns A `ResultAsync` containing the verified payload or a JWS error.
 */
export function generalVerify(
	jws: GeneralJWSInput,
	key: CryptoKey | KeyObject | JWK | Uint8Array,
	options?: VerifyOptions,
): ResultAsync<GeneralVerifyResult, GeneralVerifyError>;
/**
 * Non-throwing wrapper around jose's
 * {@link https://github.com/panva/jose/blob/main/docs/functions/jws_general_verify.generalVerify.md generalVerify}
 * with dynamic key resolution.
 *
 * @example
 * ```ts
 * import { generalVerify } from "@antithrow/jose/jws";
 * import { createRemoteJWKSet } from "jose";
 *
 * const JWKS = createRemoteJWKSet(new URL("https://example.com/.well-known/jwks.json"));
 * const result = await generalVerify(jws, JWKS);
 * if (result.isOk()) {
 *   console.log(result.value.key);
 * }
 * ```
 *
 * @param jws - General JWS object.
 * @param getKey - Function resolving a key to verify the JWS with.
 * @param options - JWS Verify options.
 *
 * @returns A `ResultAsync` containing the verified payload and resolved key, or a JWS error.
 */
export function generalVerify(
	jws: GeneralJWSInput,
	getKey: GeneralVerifyGetKey,
	options?: VerifyOptions,
): ResultAsync<GeneralVerifyResult & ResolvedKey, GeneralVerifyError>;
export function generalVerify(
	jws: GeneralJWSInput,
	keyOrGetKey: CryptoKey | KeyObject | JWK | Uint8Array | GeneralVerifyGetKey,
	options?: VerifyOptions,
): ResultAsync<GeneralVerifyResult & Partial<ResolvedKey>, GeneralVerifyError> {
	return ResultAsync.try(() => joseGeneralVerify(jws, keyOrGetKey as CryptoKey, options));
}
