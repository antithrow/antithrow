import { Result } from "antithrow/legacy";
import type { errors, JWTPayload } from "jose";
import { decodeJwt as joseDecodeJwt } from "jose";

/**
 * Non-throwing wrapper around `jose.decodeJwt`.
 *
 * Decodes a signed JWT payload without verifying the signature.
 * For verified decoding, use {@link jwtVerify} instead.
 *
 * @example
 * ```ts
 * import { decodeJwt } from "@antithrow/jose/jwt";
 *
 * const result = decodeJwt(token);
 * ```
 *
 * @param jwt - JWT token in compact JWS serialization.
 *
 * @returns A `Result` containing the decoded JWT payload, or an error.
 */
export function decodeJwt<PayloadType = JWTPayload>(
	jwt: string,
): Result<PayloadType & JWTPayload, errors.JWTInvalid> {
	return Result.try(() => joseDecodeJwt<PayloadType>(jwt));
}
