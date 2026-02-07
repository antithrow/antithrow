import { Result } from "antithrow";

/**
 * Non-throwing wrapper around `globalThis.atob(...)`.
 *
 * @example
 * ```ts
 * const result = atob("aGVsbG8=");
 * // ok("hello")
 * ```
 *
 * @param data - The base64-encoded string to decode.
 *
 * @returns A `Result` containing the decoded string or the thrown error.
 */
export function atob(data: string): Result<string, DOMException> {
	return Result.try(() => globalThis.atob(data));
}

/**
 * Non-throwing wrapper around `globalThis.btoa(...)`.
 *
 * @example
 * ```ts
 * const result = btoa("hello");
 * // ok("aGVsbG8=")
 * ```
 *
 * @param data - The string to encode as base64.
 *
 * @returns A `Result` containing the base64-encoded string or the thrown error.
 */
export function btoa(data: string): Result<string, DOMException> {
	return Result.try(() => globalThis.btoa(data));
}
