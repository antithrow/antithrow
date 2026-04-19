import { Result } from "antithrow";

/**
 * Non-throwing wrappers around `globalThis.Response` body-reading methods.
 *
 * Each method accepts a `Response` and returns a `Result` that captures
 * any rejection (e.g. invalid JSON, already-consumed body) as an `Err`.
 *
 * @example
 * ```ts
 * const body = await Response.json(response);
 * ```
 */
export const Response = {
	/**
	 * Parses the response body as JSON.
	 *
	 * @example
	 * ```ts
	 * const result = await Response.json<{ id: number }>(response);
	 * ```
	 *
	 * @param response - The `Response` to read from.
	 *
	 * @returns A `Result` containing the parsed value, or an error if parsing fails.
	 */
	json<T = unknown>(response: Response): Result<T, DOMException | TypeError | SyntaxError> {
		return Result.try(() => response.json() as Promise<T>);
	},

	/**
	 * Reads the response body as text.
	 *
	 * @example
	 * ```ts
	 * const result = await Response.text(response);
	 * ```
	 *
	 * @param response - The `Response` to read from.
	 *
	 * @returns A `Result` containing the text content, or an error if reading fails.
	 */
	text(response: Response): Result<string, DOMException | TypeError> {
		return Result.try(() => response.text());
	},

	/**
	 * Reads the response body as an `ArrayBuffer`.
	 *
	 * @example
	 * ```ts
	 * const result = await Response.arrayBuffer(response);
	 * ```
	 *
	 * @param response - The `Response` to read from.
	 *
	 * @returns A `Result` containing the `ArrayBuffer`, or an error if reading fails.
	 */
	arrayBuffer(response: Response): Result<ArrayBuffer, DOMException | TypeError | RangeError> {
		return Result.try(() => response.arrayBuffer());
	},

	/**
	 * Reads the response body as a `Blob`.
	 *
	 * @example
	 * ```ts
	 * const result = await Response.blob(response);
	 * ```
	 *
	 * @param response - The `Response` to read from.
	 *
	 * @returns A `Result` containing the `Blob`, or an error if reading fails.
	 */
	blob(response: Response): Result<Blob, DOMException | TypeError> {
		return Result.try(() => response.blob());
	},

	/**
	 * Reads the response body as `FormData`.
	 *
	 * @example
	 * ```ts
	 * const result = await Response.formData(response);
	 * ```
	 *
	 * @param response - The `Response` to read from.
	 *
	 * @returns A `Result` containing the `FormData`, or an error if reading fails.
	 */
	formData(response: Response): Result<FormData, DOMException | TypeError> {
		return Result.try(() => response.formData());
	},
} as const;
