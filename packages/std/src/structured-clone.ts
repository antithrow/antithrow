import { Result } from "antithrow";

/**
 * Non-throwing wrapper around `globalThis.structuredClone(...)`.
 *
 * @example
 * ```ts
 * import { structuredClone } from "@antithrow/std";
 *
 * const result = structuredClone({ a: 1 });
 * // ok({ a: 1 })
 *
 * const failed = structuredClone(() => {});
 * // err(DOMException)
 * ```
 *
 * @template T - The type of the value to clone.
 *
 * @param value - The value to clone.
 * @param options - An optional object containing transfer options.
 *
 * @returns A `Result` containing the cloned value or the thrown error.
 */
export function structuredClone<T>(
	value: T,
	options?: StructuredSerializeOptions,
): Result<T, DOMException> {
	return Result.try(() => globalThis.structuredClone(value, options));
}
