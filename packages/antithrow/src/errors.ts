import type { Settled } from "./types.js";

/**
 * Error thrown when unwrapping a {@link Settled} result with the wrong unwrap method.
 *
 * The original settled result is available on {@link UnwrapError.result}.
 *
 * @example
 * ```ts
 * const result = new Err<number, string>("failed");
 *
 * try {
 * 	result.unwrap();
 * } catch (error) {
 * 	if (error instanceof UnwrapError) {
 * 		error.result; // Settled<unknown, unknown>
 * 	}
 * }
 * ```
 */
export class UnwrapError extends Error {
	override readonly name = "UnwrapError";

	constructor(
		message: string,
		readonly result: Settled<unknown, unknown>,
	) {
		super(message);
	}
}
