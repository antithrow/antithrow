import type { Err } from "./err.js";
import type { Ok } from "./ok.js";
import type { Pending } from "./pending.js";
import type { Result } from "./result.js";

export type SyncOrAsync<T> = T | PromiseLike<T>;

/**
 * Matches `T` only when it does not extend `PromiseLike`.
 *
 * Used in overloads to force a sync-returning callback into the synchronous
 * overload so that union return types like `string | Promise<string>` are
 * not captured by the sync-only signature.
 */
export type NonThenable<T> = Extract<T, PromiseLike<unknown>> extends never ? T : never;

/**
 * Normalizes a potentially-async type: if `T` is a `PromiseLike`, returns
 * `PromiseLike<Awaited<T>>` (flattening nested promises); otherwise returns `T` as-is.
 */
export type FlattenThenable<T> = T extends PromiseLike<unknown> ? PromiseLike<Awaited<T>> : T;

/**
 * Produces `unknown` when `A` and `B` resolve to the same `Awaited` type, otherwise `never`.
 *
 * Useful for enforcing that two callback return types match once promises are unwrapped.
 */
export type SameResolved<A, B> = [Awaited<A>] extends [Awaited<B>]
	? [Awaited<B>] extends [Awaited<A>]
		? unknown
		: never
	: never;

/**
 * Represents a settled result state with no pending branch.
 *
 * A {@link Settled} is either:
 * - {@link Ok} for success
 * - {@link Err} for failure
 *
 * @example
 * ```ts
 * const settled: Settled<number, string> = new Err("failed");
 * ```
 */
export type Settled<T, E> = Ok<T, E> | Err<T, E>;

/**
 * Infers the `Ok` value type `T` from a {@link Result}.
 *
 * @example
 * ```ts
 * type MyResult = Result<number, string>;
 * type Value = InferOk<MyResult>; // number
 * ```
 */
export type InferOk<R> = R extends Result<infer T, unknown> ? T : never;

/**
 * Infers the `Err` error type `E` from a {@link Result}.
 *
 * @example
 * ```ts
 * type MyResult = Result<number, string>;
 * type Error = InferErr<MyResult>; // string
 * ```
 */
export type InferErr<R> = R extends Result<unknown, infer E> ? E : never;

/**
 * Flattens Ok<Result<U, F>, E> into Result<U, E | F> while preserving inner explicit state.
 *
 * If T is not a Result, the Ok<T, E> is preserved.
 */
export type FlattenOk<T, E> =
	T extends Ok<infer U, infer F>
		? Ok<U, E | F>
		: T extends Err<infer U, infer F>
			? Err<U, E | F>
			: T extends Pending<infer U, infer F>
				? Pending<U, E | F>
				: Ok<T, E>;

/**
 * Flattens Err<Result<U, F>, E> into Err<U, E | F>
 *
 * If T is not a Result, the Err<T, E> is preserved.
 */
export type FlattenErr<T, E> = T extends Result<infer U, infer F> ? Err<U, E | F> : Err<T, E>;

/**
 * Flattens Pending<Result<U, F>, E> into Pending<U, E | F>
 *
 * If T is not a Result, the Pending<T, E> is preserved.
 */
export type FlattenPending<T, E> =
	T extends Result<infer U, infer F> ? Pending<U, E | F> : Pending<T, E>;
