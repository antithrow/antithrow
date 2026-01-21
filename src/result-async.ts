import type { Result } from "./result.js";
import { Err, err, ok } from "./result.js";

interface ResultAsyncMethods<T, E> {
	/**
	 * Type predicate for `Ok`.
	 *
	 * @example
	 * ```ts
	 * if (await result.isOk()) {
	 *   console.log("success");
	 * }
	 * ```
	 *
	 * @returns A promise that resolves to `true` if the result is `Ok`.
	 */
	isOk(): Promise<boolean>;
	/**
	 * Type predicate for `Err`.
	 *
	 * @example
	 * ```ts
	 * if (await result.isErr()) {
	 *   console.error("failed");
	 * }
	 * ```
	 *
	 * @returns A promise that resolves to `true` if the result is `Err`.
	 */
	isErr(): Promise<boolean>;

	/**
	 * Returns the contained `Ok` value. Throws if the result is `Err`.
	 *
	 * @example
	 * ```ts
	 * const value = await okAsync(42).unwrap(); // 42
	 * const error = await errAsync("oops").unwrap(); // throws
	 * ```
	 *
	 * @returns A promise that resolves to the contained `Ok` value.
	 */
	unwrap(): Promise<T>;
	/**
	 * Returns the contained `Err` value. Throws if the result is `Ok`.
	 *
	 * @example
	 * ```ts
	 * const error = await errAsync("oops").unwrapErr(); // "oops"
	 * const value = await okAsync(42).unwrapErr(); // throws
	 * ```
	 *
	 * @returns A promise that resolves to the contained `Err` value.
	 */
	unwrapErr(): Promise<E>;
	/**
	 * Returns the contained `Ok` value, or the provided default if `Err`.
	 *
	 * @example
	 * ```ts
	 * await okAsync(42).unwrapOr(0); // 42
	 * await errAsync("oops").unwrapOr(0); // 0
	 * ```
	 *
	 * @param defaultValue - The default value to return if the result is `Err`.
	 *
	 * @returns A promise that resolves to the contained `Ok` value, or the provided default if `Err`.
	 */
	unwrapOr(defaultValue: T): Promise<T>;
	/**
	 * Returns the contained `Ok` value, or computes it from the error using the provided function.
	 *
	 * @example
	 * ```ts
	 * await okAsync(42).unwrapOrElse(() => 0); // 42
	 * await errAsync("oops").unwrapOrElse((e) => e.length); // 4
	 * ```
	 *
	 * @param fn - The function to compute the value from the error.
	 *
	 * @returns A promise that resolves to the contained `Ok` value, or the computed value from the error.
	 */
	unwrapOrElse(fn: (error: E) => T): Promise<T>;

	/**
	 * Transforms the `Ok` value using the provided function, leaving `Err` unchanged.
	 *
	 * @example
	 * ```ts
	 * okAsync(2).map((x) => x * 2); // okAsync(4)
	 * errAsync("oops").map((x) => x * 2); // errAsync("oops")
	 * ```
	 *
	 * @param fn - The function to transform the `Ok` value.
	 *
	 * @returns The result of the transformation.
	 */
	map<U>(fn: (value: T) => U): ResultAsync<U, E>;
	/**
	 * Transforms the `Err` value using the provided function, leaving `Ok` unchanged.
	 *
	 * @example
	 * ```ts
	 * okAsync(2).mapErr((e) => e.toUpperCase()); // okAsync(2)
	 * errAsync("oops").mapErr((e) => e.toUpperCase()); // errAsync("OOPS")
	 * ```
	 *
	 * @param fn - The function to transform the `Err` value.
	 *
	 * @returns The result of the transformation.
	 */
	mapErr<F>(fn: (error: E) => F): ResultAsync<T, F>;
	/**
	 * Transforms the `Ok` value using the provided function, or returns the default value if `Err`.
	 *
	 * @example
	 * ```ts
	 * await okAsync(2).mapOr(0, (x) => x * 2); // 4
	 * await errAsync("oops").mapOr(0, (x) => x * 2); // 0
	 * ```
	 *
	 * @param defaultValue - The value to return if the result is `Err`.
	 * @param fn - The function to transform the `Ok` value.
	 *
	 * @returns A promise that resolves to the transformed value, or the default if `Err`.
	 */
	mapOr<U>(defaultValue: U, fn: (value: T) => U): Promise<U>;
	/**
	 * Transforms the `Ok` value using the provided function, or computes a default from the error.
	 *
	 * @example
	 * ```ts
	 * await okAsync(2).mapOrElse((e) => e.length, (x) => x * 2); // 4
	 * await errAsync("oops").mapOrElse((e) => e.length, (x) => x * 2); // 4
	 * ```
	 *
	 * @param defaultFn - The function to compute the default value from the error.
	 * @param fn - The function to transform the `Ok` value.
	 *
	 * @returns A promise that resolves to the transformed value, or the computed default if `Err`.
	 */
	mapOrElse<U>(defaultFn: (error: E) => U, fn: (value: T) => U): Promise<U>;

	/**
	 * Calls the provided function with the `Ok` value and returns its result, or propagates the `Err`.
	 *
	 * @example
	 * ```ts
	 * okAsync(2).andThen((x) => okAsync(x * 2)); // okAsync(4)
	 * okAsync(2).andThen((x) => errAsync("fail")); // errAsync("fail")
	 * errAsync("oops").andThen((x) => okAsync(x * 2)); // errAsync("oops")
	 * ```
	 *
	 * @param fn - The function to call with the `Ok` value.
	 *
	 * @returns The result of the function call, or the original `Err`.
	 */
	andThen<U, F>(fn: (value: T) => Result<U, F> | ResultAsync<U, F>): ResultAsync<U, E | F>;
	/**
	 * Calls the provided function with the `Err` value and returns its result, or propagates the `Ok`.
	 *
	 * @example
	 * ```ts
	 * okAsync(2).orElse((e) => okAsync(0)); // okAsync(2)
	 * errAsync("oops").orElse((e) => okAsync(0)); // okAsync(0)
	 * errAsync("oops").orElse((e) => errAsync("fail")); // errAsync("fail")
	 * ```
	 *
	 * @param fn - The function to call with the `Err` value.
	 *
	 * @returns The result of the function call, or the original `Ok`.
	 */
	orElse<F>(fn: (error: E) => Result<T, F> | ResultAsync<T, F>): ResultAsync<T, F>;

	/**
	 * Pattern matches on the result, calling the appropriate handler and returning its value.
	 *
	 * @example
	 * ```ts
	 * await okAsync(42).match({
	 *   ok: (v) => `value: ${v}`,
	 *   err: (e) => `error: ${e}`,
	 * }); // "value: 42"
	 * ```
	 *
	 * @param handlers - The handlers to call based on the result.
	 *
	 * @returns A promise that resolves to the result of the handler call.
	 */
	match<U>(handlers: { ok: (value: T) => U; err: (error: E) => U }): Promise<U>;

	/**
	 * Calls the provided function with the `Ok` value for side effects, returning the original result.
	 *
	 * @example
	 * ```ts
	 * okAsync(42).inspect((x) => console.log(x)); // logs 42, returns okAsync(42)
	 * errAsync("oops").inspect((x) => console.log(x)); // does nothing, returns errAsync("oops")
	 * ```
	 *
	 * @param fn - The function to call with the `Ok` value.
	 *
	 * @returns The original result, unchanged.
	 */
	inspect(fn: (value: T) => void): ResultAsync<T, E>;
	/**
	 * Calls the provided function with the `Err` value for side effects, returning the original result.
	 *
	 * @example
	 * ```ts
	 * okAsync(42).inspectErr((e) => console.error(e)); // does nothing, returns okAsync(42)
	 * errAsync("oops").inspectErr((e) => console.error(e)); // logs "oops", returns errAsync("oops")
	 * ```
	 *
	 * @param fn - The function to call with the `Err` value.
	 *
	 * @returns The original result, unchanged.
	 */
	inspectErr(fn: (error: E) => void): ResultAsync<T, E>;
}

export class ResultAsync<T, E> implements PromiseLike<Result<T, E>>, ResultAsyncMethods<T, E> {
	private readonly promise: Promise<Result<T, E>>;

	constructor(promise: Promise<Result<T, E>>) {
		this.promise = promise;
	}

	/**
	 * Executes an async function and wraps the result in a `ResultAsync`. If the function
	 * throws or the promise rejects, the error is caught and wrapped in an `Err`.
	 *
	 * @example
	 * ```ts
	 * const result = ResultAsync.try(async () => await fetch('/api').then(r => r.json()));
	 * const failed = ResultAsync.try(async () => { throw new Error('oops'); });
	 * ```
	 *
	 * @template T - The resolved type of the promise.
	 * @template E - The error type (defaults to `unknown`).
	 *
	 * @param fn - The async function to execute.
	 *
	 * @returns A `ResultAsync` containing either the resolved value or the caught error.
	 */
	static try<T, E = unknown>(fn: () => Promise<T>): ResultAsync<T, E> {
		return new ResultAsync(
			fn()
				.then((value) => ok<T, E>(value))
				.catch((error) => err<T, E>(error)),
		);
	}

	// biome-ignore lint/suspicious/noThenProperty: We are implementing `PromiseLike`.
	then<TResult1 = Result<T, E>, TResult2 = never>(
		onfulfilled?: ((value: Result<T, E>) => TResult1 | PromiseLike<TResult1>) | null,
		onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
	): Promise<TResult1 | TResult2> {
		return this.promise.then(onfulfilled, onrejected);
	}

	async isOk(): Promise<boolean> {
		return (await this.promise).isOk();
	}

	async isErr(): Promise<boolean> {
		return (await this.promise).isErr();
	}

	async unwrap(): Promise<T> {
		return (await this.promise).unwrap();
	}

	async unwrapErr(): Promise<E> {
		return (await this.promise).unwrapErr();
	}

	async unwrapOr(defaultValue: T): Promise<T> {
		return (await this.promise).unwrapOr(defaultValue);
	}

	async unwrapOrElse(fn: (error: E) => T): Promise<T> {
		return (await this.promise).unwrapOrElse(fn);
	}

	map<U>(fn: (value: T) => U): ResultAsync<U, E> {
		return new ResultAsync(this.promise.then((result) => result.map(fn)));
	}

	mapErr<F>(fn: (error: E) => F): ResultAsync<T, F> {
		return new ResultAsync(this.promise.then((result) => result.mapErr(fn)));
	}

	async mapOr<U>(defaultValue: U, fn: (value: T) => U): Promise<U> {
		return (await this.promise).mapOr(defaultValue, fn);
	}

	async mapOrElse<U>(defaultFn: (error: E) => U, fn: (value: T) => U): Promise<U> {
		return (await this.promise).mapOrElse(defaultFn, fn);
	}

	andThen<U, F>(fn: (value: T) => Result<U, F> | ResultAsync<U, F>): ResultAsync<U, E | F> {
		return new ResultAsync(
			this.promise.then(async (result) => {
				if (result.isErr()) {
					return err(result.error);
				}

				return fn(result.value);
			}),
		);
	}

	orElse<F>(fn: (error: E) => Result<T, F> | ResultAsync<T, F>): ResultAsync<T, F> {
		return new ResultAsync(
			this.promise.then(async (result) => {
				if (result.isOk()) {
					return ok(result.value);
				}

				return fn(result.error);
			}),
		);
	}

	async match<U>(handlers: { ok: (value: T) => U; err: (error: E) => U }): Promise<U> {
		return (await this.promise).match(handlers);
	}

	inspect(fn: (value: T) => void): ResultAsync<T, E> {
		return new ResultAsync(this.promise.then((result) => result.inspect(fn)));
	}

	inspectErr(fn: (error: E) => void): ResultAsync<T, E> {
		return new ResultAsync(this.promise.then((result) => result.inspectErr(fn)));
	}

	async *[Symbol.asyncIterator](): AsyncGenerator<Err<never, E>, T> {
		const result = await this.promise;
		if (result.isOk()) {
			return result.value;
		}

		yield new Err(result.error);
		throw new Error("Unreachable: generator should have been halted");
	}
}

/**
 * Creates a `ResultAsync` containing an `Ok` with the given value.
 *
 * @example
 * ```ts
 * const result = okAsync(42);
 * await result.unwrap(); // 42
 * ```
 *
 * @template T - The type of the success value.
 * @template E - The type of the error value (defaults to `never`).
 *
 * @param value - The success value to wrap.
 *
 * @returns A `ResultAsync` containing an `Ok` with the value.
 */
export function okAsync<T, E = never>(value: T): ResultAsync<T, E> {
	return new ResultAsync(Promise.resolve(ok(value)));
}

/**
 * Creates a `ResultAsync` containing an `Err` with the given error.
 *
 * @example
 * ```ts
 * const result = errAsync("something went wrong");
 * await result.unwrapErr(); // "something went wrong"
 * ```
 *
 * @template T - The type of the success value (defaults to `never`).
 * @template E - The type of the error value.
 *
 * @param error - The error value to wrap.
 *
 * @returns A `ResultAsync` containing an `Err` with the error.
 */
export function errAsync<T = never, E = unknown>(error: E): ResultAsync<T, E> {
	return new ResultAsync(Promise.resolve(err(error)));
}
