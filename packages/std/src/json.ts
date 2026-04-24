import type { Ok, Settled } from "antithrow";
import { Result } from "antithrow";

type JsonStringifyReplacer =
	| ((this: unknown, key: string, value: unknown) => unknown)
	| (string | number)[]
	| null;

type NonSerializableTopLevel = undefined | symbol | ((...args: unknown[]) => unknown);

/**
 * Converts a value to a JSON string, returning a `Settled` result instead of throwing.
 *
 * @example
 * ```ts
 * const result = JSON.stringify({ a: 1 });
 * // ok('{"a":1}')
 *
 * const circular: Record<string, unknown> = {};
 * circular.self = circular;
 * const failed = JSON.stringify(circular);
 * // err(TypeError)
 * ```
 *
 * @param value - The value to convert.
 * @param replacer - An optional function or array that alters the stringification.
 * @param space - An optional string or number for indentation.
 *
 * @returns A `Settled` result containing the JSON string (or `undefined` for non-serializable top-level values) or the thrown error.
 */
function stringify(
	value: NonSerializableTopLevel,
	replacer?: JsonStringifyReplacer,
	space?: string | number,
): Ok<undefined, never>;
function stringify(
	value: unknown,
	replacer?: JsonStringifyReplacer,
	space?: string | number,
): Settled<string | undefined, TypeError>;
function stringify(
	value: unknown,
	replacer?: JsonStringifyReplacer,
	space?: string | number,
): Settled<string | undefined, TypeError> {
	return Result.try(() =>
		globalThis.JSON.stringify(value, replacer as (key: string, value: unknown) => unknown, space),
	);
}

/**
 * Non-throwing wrappers around `globalThis.JSON` methods.
 *
 * @example
 * ```ts
 * import { JSON } from "@antithrow/std";
 *
 * const parsed = JSON.parse<{ name: string }>('{"name": "Alice"}');
 * // ok({ name: "Alice" })
 *
 * const stringified = JSON.stringify({ name: "Alice" });
 * // ok('{"name":"Alice"}')
 * ```
 */
// biome-ignore lint/suspicious/noShadowRestrictedNames: intentionally wrapping the global
export const JSON = {
	/**
	 * Parses a JSON string, returning a `Settled` result instead of throwing.
	 *
	 * @example
	 * ```ts
	 * const result = JSON.parse<{ a: number }>('{"a": 1}');
	 * // ok({ a: 1 })
	 *
	 * const failed = JSON.parse("invalid");
	 * // err(SyntaxError)
	 * ```
	 *
	 * @template T - The expected type of the parsed value.
	 *
	 * @param text - The JSON string to parse.
	 * @param reviver - An optional function that transforms the results.
	 *
	 * @returns A `Settled` result containing the parsed value or the thrown error.
	 */
	parse<T = unknown>(
		text: string,
		reviver?: (this: unknown, key: string, value: unknown) => unknown,
	): Settled<T, SyntaxError> {
		return Result.try(() => globalThis.JSON.parse(text, reviver));
	},

	stringify,
} as const;
