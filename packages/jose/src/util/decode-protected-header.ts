import { Result } from "antithrow";
import type { ProtectedHeaderParameters } from "jose";
import { decodeProtectedHeader as joseDecodeProtectedHeader } from "jose";

/**
 * Non-throwing wrapper around `jose.decodeProtectedHeader`.
 *
 * Decodes a JWS/JWE/JWT Protected Header without verifying its signature.
 *
 * @example
 * ```ts
 * import { decodeProtectedHeader } from "@antithrow/jose/util";
 *
 * const result = decodeProtectedHeader(token);
 * ```
 *
 * @param token - The JWS/JWE/JWT token string or object.
 *
 * @returns A `Result` containing the decoded protected header parameters, or an error.
 */
export function decodeProtectedHeader(
	token: string | object,
): Result<ProtectedHeaderParameters, TypeError> {
	return Result.try(() => joseDecodeProtectedHeader(token));
}
