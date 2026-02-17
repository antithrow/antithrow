import { Result } from "antithrow";
import type { errors, JWTClaimVerificationOptions, JWTPayload, UnsecuredResult } from "jose";
import { UnsecuredJWT } from "jose";

/**
 * Non-throwing wrapper around `UnsecuredJWT.decode`.
 *
 * @example
 * ```ts
 * import { decodeUnsecuredJwt } from "@antithrow/jose/jwt";
 *
 * const result = decodeUnsecuredJwt(token);
 * ```
 *
 * @param jwt - Unsecured JWT to decode the payload of.
 * @param options - JWT Claims Set validation options.
 *
 * @returns A `Result` containing the decoded unsecured JWT result, or an error.
 */
export function decodeUnsecuredJwt<PayloadType = JWTPayload>(
	jwt: string,
	options?: JWTClaimVerificationOptions,
): Result<
	UnsecuredResult<PayloadType>,
	errors.JWTInvalid | errors.JWTClaimValidationFailed | errors.JWTExpired
> {
	return Result.try(() => UnsecuredJWT.decode<PayloadType>(jwt, options));
}
