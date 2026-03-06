import type { Err } from "./err.js";
import type { Ok } from "./ok.js";
import type { Pending } from "./pending.js";
import type { Result } from "./result.js";
import type { FlattenErr, FlattenOk, FlattenPending, Settled, SyncOrAsync } from "./types.js";

export abstract class ResultBase<T, E> {
	/**
	 * Returns `true` when the result is an {@link Ok} value.
	 *
	 * @example
	 * ```ts
	 * const result: Result<number, string> = new Ok(42);
	 *
	 * if (result.isOk()) {
	 * 	result.value; // number
	 * }
	 * ```
	 */
	abstract isOk(): this is Ok<T, E>;
	/**
	 * Returns `true` when the result is an {@link Err} value.
	 *
	 * @example
	 * ```ts
	 * const result: Result<number, string> = new Err("failed");
	 *
	 * if (result.isErr()) {
	 * 	result.error; // string
	 * }
	 * ```
	 */
	abstract isErr(): this is Err<T, E>;
	/**
	 * Returns `true` when the result is a {@link Pending} value.
	 *
	 * @example
	 * ```ts
	 * const result: Result<number, string> = Result.try(async () => 42);
	 *
	 * if (result.isPending()) {
	 * 	await result; // Settled<number, string>
	 * }
	 * ```
	 */
	abstract isPending(): this is Pending<T, E>;

	/**
	 * Transforms the value inside an {@link Ok} using the provided function, leaving {@link Err} unchanged.
	 *
	 * If the function returns a promise, the result becomes {@link Pending}.
	 *
	 * @throws Errors thrown by `fn` are not caught.
	 *
	 * @example
	 * ```ts
	 * const result: Result<number, string> = new Ok(5);
	 * const mapped = result.map((value) => value * 2);
	 * // mapped is Ok<number, string> with value 10
	 * ```
	 */
	abstract map<U>(fn: (value: T) => SyncOrAsync<U>): Result<U, E>;

	/**
	 * Transforms the error inside an {@link Err} using the provided function, leaving {@link Ok} unchanged.
	 *
	 * If the function returns a promise, the result becomes {@link Pending}.
	 *
	 * @throws Errors thrown by `fn` are not caught.
	 *
	 * @example
	 * ```ts
	 * const result: Result<number, string> = new Err("failed");
	 * const mapped = result.mapErr((error) => new Error(error));
	 * // mapped is Err<number, Error> with error Error("failed")
	 * ```
	 */
	abstract mapErr<F>(fn: (error: E) => SyncOrAsync<F>): Result<T, F>;

	/**
	 * Transforms the value inside an {@link Ok} using the provided function, or returns the default value if {@link Err}.
	 *
	 * If the function returns a promise, the result becomes {@link PromiseLike}.
	 *
	 * @throws Errors thrown by `fn` are not caught.
	 *
	 * @example
	 * ```ts
	 * const okResult: Result<number, string> = new Ok(5);
	 * okResult.mapOr(0, (value) => value * 2); // 10
	 *
	 * const errResult: Result<number, string> = new Err("failed");
	 * errResult.mapOr(0, (value) => value * 2); // 0
	 * ```
	 */
	abstract mapOr<U>(defaultValue: U, fn: (value: T) => SyncOrAsync<U>): SyncOrAsync<U>;

	/**
	 * Transforms the value inside an {@link Ok} using `fn`, or transforms the error using `defaultFn` if {@link Err}.
	 *
	 * Both functions should return the same type `U`.
	 *
	 * @throws Errors thrown by `fn` or `defaultFn` are not caught.
	 *
	 * @example
	 * ```ts
	 * const okResult: Result<number, string> = new Ok(5);
	 * okResult.mapOrElse((error) => 0, (value) => value * 2); // 10
	 *
	 * const errResult: Result<number, string> = new Err("failed");
	 * errResult.mapOrElse((error) => 0, (value) => value * 2); // 0
	 * ```
	 */
	abstract mapOrElse<U>(
		defaultFn: (error: E) => SyncOrAsync<U>,
		fn: (value: T) => SyncOrAsync<U>,
	): SyncOrAsync<U>;

	/**
	 * Chains a function that returns a {@link Result} if this result is {@link Ok}.
	 *
	 * This is useful for operations that can fail and return their own error type.
	 *
	 * @throws Errors thrown by `fn` are not caught.
	 *
	 * @example
	 * ```ts
	 * const result: Result<number, string> = new Ok(5);
	 * const chained = result.andThen((value) => new Ok(value * 2));
	 * // chained is Ok<number, string> with value 10
	 * ```
	 */
	abstract andThen<U, F>(fn: (value: T) => Result<U, F>): Result<U, E | F>;

	/**
	 * Returns the provided result if this result is {@link Ok}, otherwise returns this {@link Err}.
	 *
	 * @example
	 * ```ts
	 * const result: Result<number, string> = new Ok(5);
	 * const next: Result<string, string> = new Ok("hello");
	 * result.and(next); // Ok<string, string> with value "hello"
	 * ```
	 */
	abstract and<U, F>(result: Result<U, F>): Result<U, E | F>;
	/**
	 * Returns the provided result if this result is {@link Err}, otherwise returns this {@link Ok}.
	 *
	 * @example
	 * ```ts
	 * const result: Result<number, string> = new Err("failed");
	 * const fallback: Result<number, boolean> = new Ok(42);
	 * result.or(fallback); // Ok<number, string | boolean> with value 42
	 * ```
	 */
	abstract or<F>(result: Result<T, F>): Result<T, E | F>;
	/**
	 * Applies a function to the error if this result is {@link Err}, returning a {@link Result}.
	 *
	 * This is useful for recovering from errors or transforming them into new results.
	 *
	 * @throws Errors thrown by `fn` are not caught.
	 *
	 * @example
	 * ```ts
	 * const result: Result<number, string> = new Err("failed");
	 * const recovered = result.orElse((error) => new Ok(0));
	 * // recovered is Ok<number, string> with value 0
	 * ```
	 */
	abstract orElse<F>(fn: (error: E) => Result<T, F>): Result<T, F>;

	/**
	 * Flattens one level of nested result from `Result<Result<T, E>, F>` into `Result<T, E | F>`.
	 *
	 * @example
	 * ```ts
	 * const nested: Result<Result<number, string>, boolean> = new Ok(new Ok(42));
	 * const flattened = nested.flatten();
	 * // flattened is Result<number, string | boolean>
	 * ```
	 */
	abstract flatten(): FlattenOk<T, E> | FlattenErr<T, E> | FlattenPending<T, E>;

	/**
	 * Returns the value if this result is {@link Ok}, otherwise throws an {@link UnwrapError}.
	 *
	 * @example
	 * ```ts
	 * const result: Result<number, string> = new Ok(5);
	 * const value = result.unwrap(); // 5
	 * ```
	 */
	abstract unwrap(): SyncOrAsync<T>;

	/**
	 * Returns the error if this result is {@link Err}, otherwise throws an {@link UnwrapError}.
	 *
	 * @example
	 * ```ts
	 * const result: Result<number, string> = new Err("failed");
	 * const error = result.unwrapErr(); // "failed"
	 * ```
	 */
	abstract unwrapErr(): SyncOrAsync<E>;

	/**
	 * Returns the value if this result is {@link Ok}, otherwise returns the provided default value.
	 *
	 * @example
	 * ```ts
	 * const okResult: Result<number, string> = new Ok(5);
	 * okResult.unwrapOr(0); // 5
	 *
	 * const errResult: Result<number, string> = new Err("failed");
	 * errResult.unwrapOr(0); // 0
	 * ```
	 */
	abstract unwrapOr(value: T): SyncOrAsync<T>;

	/**
	 * Returns the value if this result is {@link Ok}, otherwise applies a function to the error and returns its result.
	 *
	 * @throws Errors thrown by `fn` are not caught.
	 *
	 * @example
	 * ```ts
	 * const okResult: Result<number, string> = new Ok(5);
	 * okResult.unwrapOrElse(() => 0); // 5
	 *
	 * const errResult: Result<number, string> = new Err("failed");
	 * errResult.unwrapOrElse(() => 0); // 0
	 * ```
	 */
	abstract unwrapOrElse(fn: (error: E) => SyncOrAsync<T>): SyncOrAsync<T>;

	/**
	 * Returns a settled result if this result is {@link Pending}, otherwise returns itself.
	 *
	 * @example
	 * ```ts
	 * const pending: Result<number, string> = Result.try(async () => 5);
	 * const settled = await pending.settle(); // Ok<number, string> with value 5
	 * ```
	 */
	abstract settle(): PromiseLike<Settled<T, E>>;
}
