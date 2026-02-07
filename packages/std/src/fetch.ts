import { ResultAsync } from "antithrow";

/**
 * Non-throwing wrapper around `globalThis.fetch`.
 * Non-2xx responses are `Ok`; only network errors / rejections become `Err`.
 *
 * @example
 * ```ts
 * const result = await fetch("https://example.com");
 * ```
 *
 * @param input - The resource to fetch.
 * @param init - Optional request configuration.
 *
 * @returns A `ResultAsync` containing the `Response`, or an error if the fetch rejects.
 */
export function fetch(
	input: string | URL | Request,
	init?: RequestInit,
): ResultAsync<Response, DOMException | TypeError> {
	return ResultAsync.try(() => globalThis.fetch(input, init));
}
