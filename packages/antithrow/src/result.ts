import { Err } from "./err.js";
import { Ok } from "./ok.js";
import { Pending } from "./pending.js";
import type { InferErr, Settled, SyncOrAsync } from "./types.js";
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

/**
 * Runs a generator in fail-fast mode by delegating over yielded {@link Result} values.
 *
 * The generator should `yield*` {@link Ok}, {@link Err}, or {@link Pending} values.
 * - `yield* Ok(...)` continues execution with the unwrapped value.
 * - `yield* Err(...)` short-circuits immediately and returns that `Err`.
 * - In async generators, `yield* Pending(...)` awaits and either continues or short-circuits.
 *
 * On fail-fast exit, `resultDo` calls `iter.return()` to ensure `finally` blocks run.
 * Thrown exceptions are not converted to `Err`; use {@link Result.try} for throw-capturing behavior.
 *
 * @example
 * ```ts
 * const total = Result.do(function* () {
 * 	const a = yield* new Ok<number, "invalid">(20);
 * 	const b = yield* new Ok<number, "invalid">(22);
 * 	return a + b;
 * });
 *
 * const failed = Result.do(function* () {
 * 	yield* new Ok<number, "invalid">(1);
 * 	yield* new Err<never, "invalid">("invalid");
 * 	return 42; // unreachable
 * });
 * ```
 */
function resultDo<T>(generator: () => Generator<never, T, void>): Ok<T, never>;
function resultDo<T>(generator: () => AsyncGenerator<never, T, void>): Pending<T, never>;
function resultDo<T, YieldErr extends Err<unknown, unknown>>(
	generator: () => Generator<YieldErr, T, void>,
): Settled<T, InferErr<YieldErr>>;
function resultDo<T, YieldErr extends Err<unknown, unknown>>(
	generator: () => AsyncGenerator<YieldErr, T, void>,
): Pending<T, InferErr<YieldErr>>;
function resultDo<T>(
	generator:
		| (() => Generator<Err<T, unknown>, T, void>)
		| (() => AsyncGenerator<Err<T, unknown>, T, void>)
		| (() => Generator<never, T, void>)
		| (() => AsyncGenerator<never, T, void>),
): Result<T, unknown> {
	const iter = generator();

	if (Symbol.asyncIterator in iter) {
		return new Pending(
			iter.next().then(async (next) => {
				if (!next.done) {
					// Ensure generator cleanup runs when fail-fast exits early.
					await iter.return?.(undefined as T);
					return next.value;
				}

				return new Ok(next.value);
			}),
		);
	}

	const next = iter.next();
	if (!next.done) {
		// Ensure generator cleanup runs when fail-fast exits early.
		iter.return?.(undefined as T);
		return next.value;
	}

	return new Ok(next.value);
}

export const Result = {
	try: resultTry,
	fromPromise,
	do: resultDo,
};
