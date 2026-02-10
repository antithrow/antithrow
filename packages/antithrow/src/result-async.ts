import type { AsyncChainGenerator } from "./chain.js";
import type { Err, Ok, Result } from "./result.js";
import { err, ok } from "./result.js";
import type { AnyResult, ErrUnion, InferErr, InferOk, OkTuple } from "./types.js";

/**
 * A type that can be either a value or a promise-like containing that value.
 */
type MaybePromise<T> = T | PromiseLike<T>;

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
	 * Returns `true` if the result is `Ok` and the contained value satisfies the predicate.
	 *
	 * @example
	 * ```ts
	 * await okAsync(42).isOkAnd((x) => x > 10); // true
	 * await okAsync(5).isOkAnd((x) => x > 10); // false
	 * await errAsync("error").isOkAnd((x) => x > 10); // false
	 * ```
	 *
	 * @param fn - The predicate to apply to the `Ok` value.
	 *
	 * @returns A promise that resolves to `true` if `Ok` and the predicate returns `true`.
	 */
	isOkAnd(fn: (value: T) => MaybePromise<boolean>): Promise<boolean>;
	/**
	 * Returns `true` if the result is `Err` and the contained error satisfies the predicate.
	 *
	 * @example
	 * ```ts
	 * await errAsync("error").isErrAnd((e) => e.length > 3); // true
	 * await errAsync("e").isErrAnd((e) => e.length > 3); // false
	 * await okAsync(42).isErrAnd((e) => e.length > 3); // false
	 * ```
	 *
	 * @param fn - The predicate to apply to the `Err` value.
	 *
	 * @returns A promise that resolves to `true` if `Err` and the predicate returns `true`.
	 */
	isErrAnd(fn: (error: E) => MaybePromise<boolean>): Promise<boolean>;

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
	 * Returns the contained `Ok` value. Throws with the provided message if the result is `Err`.
	 *
	 * @example
	 * ```ts
	 * const value = await okAsync(42).expect("value should exist"); // 42
	 * const error = await errAsync("oops").expect("value should exist"); // throws
	 * ```
	 *
	 * @param message - The message to include in the thrown error if the result is `Err`.
	 *
	 * @returns A promise that resolves to the contained `Ok` value.
	 */
	expect(message: string): Promise<T>;
	/**
	 * Returns the contained `Err` value. Throws with the provided message if the result is `Ok`.
	 *
	 * @example
	 * ```ts
	 * const error = await errAsync("oops").expectErr("should be error"); // "oops"
	 * const value = await okAsync(42).expectErr("should be error"); // throws
	 * ```
	 *
	 * @param message - The message to include in the thrown error if the result is `Ok`.
	 *
	 * @returns A promise that resolves to the contained `Err` value.
	 */
	expectErr(message: string): Promise<E>;
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
	unwrapOrElse(fn: (error: E) => MaybePromise<T>): Promise<T>;

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
	map<U>(fn: (value: T) => MaybePromise<U>): ResultAsync<U, E>;
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
	mapErr<F>(fn: (error: E) => MaybePromise<F>): ResultAsync<T, F>;
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
	mapOr<U>(defaultValue: U, fn: (value: T) => MaybePromise<U>): Promise<U>;
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
	mapOrElse<U>(
		defaultFn: (error: E) => MaybePromise<U>,
		fn: (value: T) => MaybePromise<U>,
	): Promise<U>;

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
	andThen<U, F, This extends ResultAsync<unknown, unknown>>(
		this: This,
		fn: (value: InferOk<This>) => MaybePromise<Result<U, F>> | ResultAsync<U, F>,
	): ResultAsync<U, InferErr<This> | F>;
	/**
	 * Returns the provided `Result` if this is `Ok`, otherwise propagates the `Err`.
	 *
	 * @example
	 * ```ts
	 * okAsync(2).and(ok("next")); // okAsync("next")
	 * errAsync("oops").and(ok("next")); // errAsync("oops")
	 * ```
	 *
	 * @param result - The result to return if this is `Ok`.
	 *
	 * @returns The provided result if `Ok`, otherwise the original `Err`.
	 */
	and<U, F>(result: Result<U, F> | ResultAsync<U, F>): ResultAsync<U, E | F>;
	/**
	 * Returns this `Ok` result, or the provided `Result` if this is `Err`.
	 *
	 * @example
	 * ```ts
	 * okAsync(2).or(ok(1)); // okAsync(2)
	 * errAsync("oops").or(ok(1)); // okAsync(1)
	 * ```
	 *
	 * @param result - The result to return if this is `Err`.
	 *
	 * @returns This result if `Ok`, otherwise the provided result.
	 */
	or<F>(result: Result<T, F> | ResultAsync<T, F>): ResultAsync<T, F>;
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
	orElse<F>(fn: (error: E) => MaybePromise<Result<T, F>> | ResultAsync<T, F>): ResultAsync<T, F>;

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
	match<U>(handlers: {
		ok: (value: T) => MaybePromise<U>;
		err: (error: E) => MaybePromise<U>;
	}): Promise<U>;

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
	inspect(fn: (value: T) => MaybePromise<unknown>): ResultAsync<T, E>;
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
	inspectErr(fn: (error: E) => MaybePromise<unknown>): ResultAsync<T, E>;

	/**
	 * Flattens a nested `ResultAsync<Result<U, F>, E>` into `ResultAsync<U, E | F>`.
	 *
	 * @example
	 * ```ts
	 * await okAsync(ok(42)).flatten(); // ok(42)
	 * await okAsync(err("inner")).flatten(); // err("inner")
	 * await errAsync("outer").flatten(); // err("outer")
	 * ```
	 *
	 * @returns The flattened result.
	 */
	flatten<U, F>(this: ResultAsync<Result<U, F>, E>): ResultAsync<U, E | F>;
}

export class ResultAsync<T, E> implements PromiseLike<Result<T, E>>, ResultAsyncMethods<T, E> {
	private readonly promise: Promise<Result<T, E>>;

	private constructor(promise: Promise<Result<T, E>>) {
		this.promise = promise;
	}

	private wrap<U, F>(
		fn: (result: Result<T, E>) => MaybePromise<Result<U, F>> | ResultAsync<U, F>,
	): ResultAsync<U, F> {
		return ResultAsync.fromPromise(this.promise.then(async (r) => fn(r)));
	}

	/**
	 * Combines multiple `Result` or `ResultAsync` values into a single `ResultAsync` containing
	 * a tuple of all `Ok` values, or the first `Err` to resolve. Similar to `Promise.all`.
	 *
	 * All results are awaited concurrently. If any result is `Err`, the combined result
	 * resolves to that `Err` as soon as it is encountered.
	 *
	 * @example
	 * ```ts
	 * const combined = ResultAsync.all([okAsync(1), okAsync("hello")]);
	 * await combined.unwrap(); // [1, "hello"]
	 *
	 * const mixed = ResultAsync.all([ok(1), okAsync("hello")]);
	 * await mixed.unwrap(); // [1, "hello"]
	 *
	 * const failed = ResultAsync.all([okAsync(1), errAsync("bad"), okAsync(3)]);
	 * await failed.unwrapErr(); // "bad"
	 * ```
	 *
	 * @template T - A readonly tuple or array of `Result` or `ResultAsync` values.
	 *
	 * @param results - The `Result` or `ResultAsync` values to combine.
	 *
	 * @returns A `ResultAsync` containing a tuple of all `Ok` values, or the first `Err` to resolve.
	 */
	static all<const T extends readonly AnyResult[]>(
		results: T,
	): ResultAsync<OkTuple<T>, ErrUnion<T>>;
	static all<T, E>(results: readonly AnyResult<T, E>[]): ResultAsync<T[], E>;
	static all(results: readonly AnyResult[]): ResultAsync<unknown[], unknown> {
		if (results.length === 0) {
			return okAsync([]);
		}

		return ResultAsync.try(() =>
			Promise.all(
				results.map(async (r) => {
					const result = await r;
					if (result.isErr()) throw result.error;

					return result.value;
				}),
			),
		);
	}

	/**
	 * Executes a function and wraps the result in a `ResultAsync`. If the function
	 * throws or the promise rejects, the error is caught and wrapped in an `Err`.
	 * Use this to wrap throwable operations before passing them into `ResultAsync`
	 * pipelines (`map`, `andThen`, `orElse`, `inspect`, etc.).
	 *
	 * @example
	 * ```ts
	 * const result = ResultAsync.try(async () => await fetch('/api').then(r => r.json()));
	 * const failed = ResultAsync.try(async () => { throw new Error('oops'); });
	 * ```
	 *
	 * @template T - The resolved type of the promise or return value.
	 * @template E - The error type (defaults to `unknown`).
	 *
	 * @param fn - The function to execute.
	 *
	 * @returns A `ResultAsync` containing either the resolved value or the caught error.
	 */
	static try<T, E = unknown>(fn: () => T | Promise<T>): ResultAsync<T, E> {
		return ResultAsync.fromPromise(
			Promise.resolve()
				.then(fn)
				.then((value) => ok(value))
				.catch((error) => err(error)),
		);
	}

	/**
	 * Wraps an existing `Result` into a `ResultAsync`.
	 *
	 * @example
	 * ```ts
	 * const syncResult = ok(42);
	 * const asyncResult = ResultAsync.fromResult(syncResult);
	 * await asyncResult.unwrap(); // 42
	 * ```
	 *
	 * @template T - The type of the success value.
	 * @template E - The type of the error value.
	 *
	 * @param result - The `Result` to wrap.
	 *
	 * @returns A `ResultAsync` containing the same value or error as the input `Result`.
	 */
	static fromResult<T, E>(result: Result<T, E>): ResultAsync<T, E> {
		return new ResultAsync(Promise.resolve(result));
	}

	/**
	 * Wraps an existing `Promise<Result<T, E>>` into a `ResultAsync`.
	 *
	 * This method does not catch promise rejections. If the promise may reject,
	 * use {@link ResultAsync.try} instead, which catches exceptions and wraps
	 * them as `Err<unknown>`.
	 *
	 * Likewise, callbacks passed to `ResultAsync` methods are not implicit
	 * exception boundaries. Wrap throwable logic with {@link ResultAsync.try}
	 * (or {@link Result.try}) before returning from callbacks.
	 *
	 * @example
	 * ```ts
	 * const promise = fetchData().then(data => ok(data), e => err(e));
	 * const result = ResultAsync.fromPromise(promise);
	 * ```
	 *
	 * @template T - The type of the success value.
	 * @template E - The type of the error value.
	 *
	 * @param promise - The `Promise<Result<T, E>>` to wrap.
	 *
	 * @returns A `ResultAsync` containing the resolved `Result`.
	 */
	static fromPromise<T, E>(promise: Promise<Result<T, E>>): ResultAsync<T, E> {
		return new ResultAsync(promise);
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

	async isOkAnd(fn: (value: T) => MaybePromise<boolean>): Promise<boolean> {
		const result = await this.promise;
		if (result.isErr()) {
			return false;
		}
		return fn(result.value);
	}

	async isErrAnd(fn: (error: E) => MaybePromise<boolean>): Promise<boolean> {
		const result = await this.promise;
		if (result.isOk()) {
			return false;
		}
		return fn(result.error);
	}

	async unwrap(): Promise<T> {
		return (await this.promise).unwrap();
	}

	async unwrapErr(): Promise<E> {
		return (await this.promise).unwrapErr();
	}

	async expect(message: string): Promise<T> {
		return (await this.promise).expect(message);
	}

	async expectErr(message: string): Promise<E> {
		return (await this.promise).expectErr(message);
	}

	async unwrapOr(defaultValue: T): Promise<T> {
		return (await this.promise).unwrapOr(defaultValue);
	}

	async unwrapOrElse(fn: (error: E) => MaybePromise<T>): Promise<T> {
		const result = await this.promise;
		if (result.isOk()) {
			return result.value;
		}
		return fn(result.error);
	}

	map<U>(fn: (value: T) => MaybePromise<U>): ResultAsync<U, E> {
		return this.wrap(async (result) => {
			if (result.isErr()) {
				return result as unknown as Err<U, E>;
			}
			return ok(await fn(result.value));
		});
	}

	mapErr<F>(fn: (error: E) => MaybePromise<F>): ResultAsync<T, F> {
		return this.wrap(async (result) => {
			if (result.isOk()) {
				return result as unknown as Ok<T, F>;
			}
			return err(await fn(result.error));
		});
	}

	async mapOr<U>(defaultValue: U, fn: (value: T) => MaybePromise<U>): Promise<U> {
		const result = await this.promise;
		if (result.isErr()) {
			return defaultValue;
		}
		return fn(result.value);
	}

	async mapOrElse<U>(
		defaultFn: (error: E) => MaybePromise<U>,
		fn: (value: T) => MaybePromise<U>,
	): Promise<U> {
		const result = await this.promise;
		if (result.isErr()) {
			return defaultFn(result.error);
		}
		return fn(result.value);
	}

	andThen<U, F, This extends ResultAsync<unknown, unknown>>(
		this: This,
		fn: (value: InferOk<This>) => MaybePromise<Result<U, F>> | ResultAsync<U, F>,
	): ResultAsync<U, InferErr<This> | F> {
		return this.wrap((result) => {
			if (result.isErr()) {
				// Cast avoids allocating a new Err; the value type U is phantom here.
				return result as Err<U, F>;
			}

			return fn(result.value as InferOk<This>);
		});
	}

	and<U, F>(result: Result<U, F> | ResultAsync<U, F>): ResultAsync<U, E | F> {
		return this.wrap((value) => {
			if (value.isErr()) {
				// Cast avoids allocating a new Err; the value type U is phantom here.
				return value as unknown as Err<U, E | F>;
			}

			return result;
		});
	}

	or<F>(result: Result<T, F> | ResultAsync<T, F>): ResultAsync<T, F> {
		return this.wrap((value) => {
			if (value.isOk()) {
				// Cast avoids allocating a new Ok; the error type F is phantom here.
				return value as unknown as Ok<T, F>;
			}

			return result;
		});
	}

	orElse<F>(fn: (error: E) => MaybePromise<Result<T, F>> | ResultAsync<T, F>): ResultAsync<T, F> {
		return this.wrap((result) => {
			if (result.isOk()) {
				// Cast avoids allocating a new Ok; the error type F is phantom here.
				return result as unknown as Ok<T, F>;
			}

			return fn(result.error);
		});
	}

	async match<U>(handlers: {
		ok: (value: T) => MaybePromise<U>;
		err: (error: E) => MaybePromise<U>;
	}): Promise<U> {
		const result = await this.promise;
		if (result.isOk()) {
			return handlers.ok(result.value);
		}
		return handlers.err(result.error);
	}

	inspect(fn: (value: T) => MaybePromise<unknown>): ResultAsync<T, E> {
		return this.wrap(async (result) => {
			if (result.isOk()) {
				await fn(result.value);
			}
			return result;
		});
	}

	inspectErr(fn: (error: E) => MaybePromise<unknown>): ResultAsync<T, E> {
		return this.wrap(async (result) => {
			if (result.isErr()) {
				await fn(result.error);
			}
			return result;
		});
	}

	flatten<U, F>(this: ResultAsync<Result<U, F>, E>): ResultAsync<U, E | F> {
		return this.andThen((result) => result);
	}

	async *[Symbol.asyncIterator](): AsyncChainGenerator<T, E> {
		const result = await this.promise;
		if (result.isOk()) {
			return result.value;
		}

		// `result` is always an Err, so we can cast it to Err<never, E>
		yield result as unknown as Err<never, E>;
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
 *
 * const empty = okAsync();
 * await empty.unwrap(); // undefined
 * ```
 *
 * @template T - The type of the success value.
 * @template E - The type of the error value (defaults to `never`).
 *
 * @param value - The success value to wrap.
 *
 * @returns A `ResultAsync` containing an `Ok` with the value.
 */
export function okAsync<E = never>(): ResultAsync<void, E>;
export function okAsync<T, E = never>(value: T): ResultAsync<T, E>;
export function okAsync<T, E = never>(value?: T): ResultAsync<T, E> {
	return ResultAsync.fromResult(ok(value as T));
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
	return ResultAsync.fromResult(err(error));
}
