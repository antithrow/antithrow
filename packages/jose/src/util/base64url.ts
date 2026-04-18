import { Result } from "antithrow/legacy";
import { base64url as joseBase64url } from "jose";

/**
 * Non-throwing wrappers around `jose.base64url` utilities.
 *
 * @example
 * ```ts
 * import { base64url } from "@antithrow/jose/util";
 *
 * const decoded = base64url.decode("SGVsbG8");
 * const encoded = base64url.encode(new TextEncoder().encode("Hello"));
 * ```
 */
export const base64url = {
	/**
	 * Decodes a base64url-encoded input, returning a `Result` instead of throwing.
	 *
	 * @example
	 * ```ts
	 * const result = base64url.decode("SGVsbG8");
	 * ```
	 *
	 * @param input - The base64url-encoded string or `Uint8Array` to decode.
	 *
	 * @returns A `Result` containing the decoded `Uint8Array`, or an error.
	 */
	decode(input: Uint8Array | string): Result<Uint8Array, TypeError> {
		return Result.try(() => joseBase64url.decode(input));
	},

	/**
	 * Encodes a `Uint8Array` as a base64url string.
	 *
	 * This function does not throw, so it is re-exported directly from `jose`.
	 *
	 * @example
	 * ```ts
	 * const encoded = base64url.encode(new TextEncoder().encode("Hello"));
	 * ```
	 *
	 * @param input - The `Uint8Array` to encode.
	 *
	 * @returns The base64url-encoded string.
	 */
	encode: joseBase64url.encode,
} as const;
