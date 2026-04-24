import type { Settled } from "antithrow";
import { Err, Ok } from "antithrow";

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
 * @returns A `Settled` result containing the cloned value or the thrown error.
 */
export function structuredClone<T>(
	value: T,
	options?: StructuredSerializeOptions,
): Settled<T, DOMException> {
	try {
		return new Ok(globalThis.structuredClone(value, options));
	} catch (error) {
		return new Err(error as DOMException);
	}
}
