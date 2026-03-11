import { Err } from "./err.js";
import { Ok } from "./ok.js";
import { Pending } from "./pending.js";
import type { Settled, SyncOrAsync } from "./types.js";
import { isThenable } from "./utils.js";

/**
 * Represents the full result state of an operation.
 *
 * A {@link Result} is either:
 * - {@link Ok} when the operation succeeded
 * - {@link Err} when the operation failed
 * - {@link Pending} when the operation is still in-flight
 *
 * @example
 * ```ts
 * const immediate: Result<number, string> = new Ok(42);
 * const delayed: Result<number, string> = Result.try(async () => 42);
 * ```
 */
export type Result<T, E> = Ok<T, E> | Err<T, E> | Pending<T, E>;

function fromPromise<T, E>(promise: PromiseLike<T>): Pending<T, E> {
	return new Pending(
		promise.then(
			(ok) => new Ok(ok),
			(err) => new Err(err),
		),
	);
}

function resultTry<T, E>(fn: () => PromiseLike<T>): Pending<T, E>;
function resultTry<T, E>(fn: () => T): Settled<T, E>;
function resultTry<T, E>(fn: () => SyncOrAsync<T>): Result<T, E> {
	try {
		const value = fn();
		if (isThenable(value)) {
			return fromPromise(value);
		}

		return new Ok(value);
	} catch (e) {
		return new Err(e as E);
	}
}

export const Result = {
	try: resultTry,
	fromPromise,
};
