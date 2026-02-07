import { Result } from "antithrow";

/**
 * Non-throwing wrapper around `globalThis.decodeURI(...)`.
 *
 * @example
 * ```ts
 * const result = decodeURI("https://example.com/hello%20world");
 * // ok("https://example.com/hello world")
 * ```
 *
 * @param encodedURI - The encoded URI to decode.
 *
 * @returns A `Result` containing the decoded URI or the thrown error.
 */
// biome-ignore lint/suspicious/noShadowRestrictedNames: intentionally wrapping the global
export function decodeURI(encodedURI: string): Result<string, URIError> {
	return Result.try(() => globalThis.decodeURI(encodedURI));
}

/**
 * Non-throwing wrapper around `globalThis.decodeURIComponent(...)`.
 *
 * @example
 * ```ts
 * const result = decodeURIComponent("hello%20world");
 * // ok("hello world")
 * ```
 *
 * @param encodedURIComponent - The encoded URI component to decode.
 *
 * @returns A `Result` containing the decoded URI component or the thrown error.
 */
// biome-ignore lint/suspicious/noShadowRestrictedNames: intentionally wrapping the global
export function decodeURIComponent(encodedURIComponent: string): Result<string, URIError> {
	return Result.try(() => globalThis.decodeURIComponent(encodedURIComponent));
}

/**
 * Non-throwing wrapper around `globalThis.encodeURI(...)`.
 *
 * @example
 * ```ts
 * const result = encodeURI("https://example.com/hello world");
 * // ok("https://example.com/hello%20world")
 * ```
 *
 * @param uri - The URI to encode.
 *
 * @returns A `Result` containing the encoded URI or the thrown error.
 */
// biome-ignore lint/suspicious/noShadowRestrictedNames: intentionally wrapping the global
export function encodeURI(uri: string): Result<string, URIError> {
	return Result.try(() => globalThis.encodeURI(uri));
}

/**
 * Non-throwing wrapper around `globalThis.encodeURIComponent(...)`.
 *
 * @example
 * ```ts
 * const result = encodeURIComponent("hello world");
 * // ok("hello%20world")
 * ```
 *
 * @param uriComponent - The URI component to encode.
 *
 * @returns A `Result` containing the encoded URI component or the thrown error.
 */
// biome-ignore lint/suspicious/noShadowRestrictedNames: intentionally wrapping the global
export function encodeURIComponent(
	uriComponent: string | number | boolean,
): Result<string, URIError> {
	return Result.try(() => globalThis.encodeURIComponent(uriComponent));
}
