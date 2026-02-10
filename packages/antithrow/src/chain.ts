import type { Err, Result } from "./result.js";
import { ok } from "./result.js";
import { ResultAsync } from "./result-async.js";

export type SyncChainGenerator<T, E> = Generator<Err<never, E>, T, void>;
export type AsyncChainGenerator<T, E> = AsyncGenerator<Err<never, E>, T, void>;
type InferErr<YieldErr> = YieldErr extends Err<never, infer E> ? E : never;

/**
 * Chains multiple Result operations using generator syntax for early return on errors.
 *
 * Use `yield*` with a `Result` to unwrap its value or short-circuit on error.
 * Thrown exceptions from the generator body are not converted into `Err`.
 * Wrap throwable logic with `Result.try(...)` before yielding/returning.
 *
 * @example
 * ```ts
 * const result = chain(function* () {
 *   const a = yield* ok(1);
 *   const b = yield* ok(2);
 *   return a + b;
 * });
 * ```
 *
 * @template T - The type of the success value.
 * @template E - The type of the error value.
 *
 * @param generator - A generator function that yields `Err` values and returns a success value.
 *
 * @returns A `Result` containing the final value or the first error encountered.
 */
export function chain<T, E, YieldErr extends Err<never, E>>(
	generator: () => Generator<YieldErr, T, void>,
): Result<T, InferErr<YieldErr>>;
/**
 * Chains multiple ResultAsync operations using async generator syntax for early return on errors.
 *
 * Use `yield*` with a `ResultAsync` to unwrap its value or short-circuit on error.
 * Thrown exceptions or rejected awaits from the generator body are not converted into `Err`.
 * Wrap throwable logic with `Result.try(...)` / `ResultAsync.try(...)` before yielding/returning.
 *
 * @example
 * ```ts
 * const result = chain(async function* () {
 *   const a = yield* okAsync(1);
 *   const b = yield* okAsync(2);
 *   return a + b;
 * });
 * ```
 *
 * @template T - The type of the success value.
 * @template E - The type of the error value.
 *
 * @param generator - An async generator function that yields `Err` values and returns a success value.
 *
 * @returns A `ResultAsync` containing the final value or the first error encountered.
 */
export function chain<T, E, YieldErr extends Err<never, E>>(
	generator: () => AsyncGenerator<YieldErr, T, void>,
): ResultAsync<T, InferErr<YieldErr>>;
export function chain<T, E>(
	generator: () => SyncChainGenerator<T, E> | AsyncChainGenerator<T, E>,
): Result<T, E> | ResultAsync<T, E> {
	const iter = generator();

	if (Symbol.asyncIterator in iter) {
		return ResultAsync.fromPromise(
			iter.next().then(async (next) => {
				if (!next.done) {
					// Call `asyncIter.return` to ensure any cleanup is done.
					// We pass `undefined as T` because the actual value is irrelevant.
					await iter.return?.(undefined as T);

					return next.value;
				}

				return ok(next.value);
			}),
		);
	}

	const next = iter.next();
	if (!next.done) {
		// Call `syncIter.return` to ensure any cleanup is done
		// We pass `undefined as T` because the actual value is irrelevant.
		iter.return?.(undefined as T);

		return next.value;
	}

	return ok(next.value);
}
