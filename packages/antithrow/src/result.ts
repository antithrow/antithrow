import type { SyncChainGenerator } from "./chain.js";
import { ResultAsync } from "./result-async.js";
import type { ErrUnion, InferErr, InferOk, OkTuple } from "./types.js";

interface ResultMethods<T, E> {
	/**
	 * Type predicate for `Ok`.
	 *
	 * @example
	 * ```ts
	 * if (result.isOk()) {
	 *   console.log(result.value);
	 * }
	 * ```
	 *
	 * @returns `true` if the result is `Ok`.
	 */
	isOk(): this is Ok<T, E>;
	/**
	 * Type predicate for `Err`.
	 *
	 * @example
	 * ```ts
	 * if (result.isErr()) {
	 *   console.error(result.error);
	 * }
	 * ```
	 *
	 * @returns `true` if the result is `Err`.
	 */
	isErr(): this is Err<T, E>;
	/**
	 * Returns `true` if the result is `Ok` and the contained value satisfies the predicate.
	 * When a type predicate is passed, narrows the result to `Ok<S, E>`.
	 *
	 * @example
	 * ```ts
	 * ok(42).isOkAnd((x) => x > 10); // true
	 * ok(5).isOkAnd((x) => x > 10); // false
	 * err("error").isOkAnd((x) => x > 10); // false
	 *
	 * // Type narrowing with type predicate
	 * const result: Result<string | number, Error> = ok(42);
	 * if (result.isOkAnd((v): v is number => typeof v === "number")) {
	 *   result.value; // number
	 * }
	 * ```
	 *
	 * @param fn - The predicate to apply to the `Ok` value.
	 *
	 * @returns `true` if `Ok` and the predicate returns `true`.
	 */
	isOkAnd<S extends T>(fn: (value: T) => value is S): this is Ok<S, E>;
	isOkAnd(fn: (value: T) => boolean): boolean;
	/**
	 * Returns `true` if the result is `Err` and the contained error satisfies the predicate.
	 * When a type predicate is passed, narrows the result to `Err<T, F>`.
	 *
	 * @example
	 * ```ts
	 * err("error").isErrAnd((e) => e.length > 3); // true
	 * err("e").isErrAnd((e) => e.length > 3); // false
	 * ok(42).isErrAnd((e) => e.length > 3); // false
	 *
	 * // Type narrowing with type predicate
	 * const result: Result<number, Error | string> = err(new Error("fail"));
	 * if (result.isErrAnd((e): e is Error => e instanceof Error)) {
	 *   result.error; // Error
	 * }
	 * ```
	 *
	 * @param fn - The predicate to apply to the `Err` value.
	 *
	 * @returns `true` if `Err` and the predicate returns `true`.
	 */
	isErrAnd<F extends E>(fn: (error: E) => error is F): this is Err<T, F>;
	isErrAnd(fn: (error: E) => boolean): boolean;

	/**
	 * Returns the contained `Ok` value. Throws if the result is `Err`.
	 *
	 * @example
	 * ```ts
	 * const value = ok(42).unwrap(); // 42
	 * const error = err("oops").unwrap(); // throws
	 * ```
	 *
	 * @returns The contained `Ok` value.
	 */
	unwrap(): T;
	/**
	 * Returns the contained `Err` value. Throws if the result is `Ok`.
	 *
	 * @example
	 * ```ts
	 * const error = err("oops").unwrapErr(); // "oops"
	 * const value = ok(42).unwrapErr(); // throws
	 * ```
	 *
	 * @returns The contained `Err` value.
	 */
	unwrapErr(): E;
	/**
	 * Returns the contained `Ok` value. Throws with the provided message if the result is `Err`.
	 *
	 * @example
	 * ```ts
	 * const value = ok(42).expect("value should exist"); // 42
	 * const error = err("oops").expect("value should exist"); // throws
	 * ```
	 *
	 * @param message - The message to include in the thrown error if the result is `Err`.
	 *
	 * @returns The contained `Ok` value.
	 */
	expect(message: string): T;
	/**
	 * Returns the contained `Err` value. Throws with the provided message if the result is `Ok`.
	 *
	 * @example
	 * ```ts
	 * const error = err("oops").expectErr("should be error"); // "oops"
	 * const value = ok(42).expectErr("should be error"); // throws
	 * ```
	 *
	 * @param message - The message to include in the thrown error if the result is `Ok`.
	 *
	 * @returns The contained `Err` value.
	 */
	expectErr(message: string): E;
	/**
	 * Returns the contained `Ok` value, or the provided default if `Err`.
	 *
	 * @example
	 * ```ts
	 * ok(42).unwrapOr(0); // 42
	 * err("oops").unwrapOr(0); // 0
	 * ```
	 *
	 * @param defaultValue - The default value to return if the result is `Err`.
	 *
	 * @returns The contained `Ok` value, or the provided default if `Err`.
	 */
	unwrapOr(defaultValue: T): T;
	/**
	 * Returns the contained `Ok` value, or computes it from the error using the provided function.
	 *
	 * @example
	 * ```ts
	 * ok(42).unwrapOrElse(() => 0); // 42
	 * err("oops").unwrapOrElse((e) => e.length); // 4
	 * ```
	 *
	 * @param fn - The function to compute the value from the error.
	 *
	 * @returns The contained `Ok` value, or the computed value from the error.
	 */
	unwrapOrElse(fn: (error: E) => T): T;

	/**
	 * Transforms the `Ok` value using the provided function, leaving `Err` unchanged.
	 *
	 * @example
	 * ```ts
	 * ok(2).map((x) => x * 2); // ok(4)
	 * err("oops").map((x) => x * 2); // err("oops")
	 * ```
	 *
	 * @param fn - The function to transform the `Ok` value.
	 *
	 * @returns The result of the transformation.
	 */
	map<U>(fn: (value: T) => U): Result<U, E>;
	/**
	 * Transforms the `Err` value using the provided function, leaving `Ok` unchanged.
	 *
	 * @example
	 * ```ts
	 * ok(2).mapErr((e) => e.toUpperCase()); // ok(2)
	 * err("oops").mapErr((e) => e.toUpperCase()); // err("OOPS")
	 * ```
	 *
	 * @param fn - The function to transform the `Err` value.
	 *
	 * @returns The result of the transformation.
	 */
	mapErr<F>(fn: (error: E) => F): Result<T, F>;
	/**
	 * Transforms the `Ok` value using the provided function, or returns the default value if `Err`.
	 *
	 * @example
	 * ```ts
	 * ok(2).mapOr(0, (x) => x * 2); // 4
	 * err("oops").mapOr(0, (x) => x * 2); // 0
	 * ```
	 *
	 * @param defaultValue - The value to return if the result is `Err`.
	 * @param fn - The function to transform the `Ok` value.
	 *
	 * @returns The transformed value, or the default if `Err`.
	 */
	mapOr<U>(defaultValue: U, fn: (value: T) => U): U;
	/**
	 * Transforms the `Ok` value using the provided function, or computes a default from the error.
	 *
	 * @example
	 * ```ts
	 * ok(2).mapOrElse((e) => e.length, (x) => x * 2); // 4
	 * err("oops").mapOrElse((e) => e.length, (x) => x * 2); // 4
	 * ```
	 *
	 * @param defaultFn - The function to compute the default value from the error.
	 * @param fn - The function to transform the `Ok` value.
	 *
	 * @returns The transformed value, or the computed default if `Err`.
	 */
	mapOrElse<U>(defaultFn: (error: E) => U, fn: (value: T) => U): U;

	/**
	 * Calls the provided function with the `Ok` value and returns its result, or propagates the `Err`.
	 *
	 * @example
	 * ```ts
	 * ok(2).andThen((x) => ok(x * 2)); // ok(4)
	 * ok(2).andThen((x) => err("fail")); // err("fail")
	 * err("oops").andThen((x) => ok(x * 2)); // err("oops")
	 * ```
	 *
	 * @param fn - The function to call with the `Ok` value.
	 *
	 * @returns The result of the function call, or the original `Err`.
	 */
	andThen<U, F, This extends Result<unknown, unknown>>(
		this: This,
		fn: (value: InferOk<This>) => Result<U, F>,
	): Result<U, InferErr<This> | F>;
	/**
	 * Returns the provided `Result` if this is `Ok`, otherwise propagates the `Err`.
	 *
	 * @example
	 * ```ts
	 * ok(2).and(ok("next")); // ok("next")
	 * err("oops").and(ok("next")); // err("oops")
	 * ```
	 *
	 * @param result - The result to return if this is `Ok`.
	 *
	 * @returns The provided result if `Ok`, otherwise the original `Err`.
	 */
	and<U, F>(result: Result<U, F>): Result<U, E | F>;
	/**
	 * Returns this `Ok` result, or the provided `Result` if this is `Err`.
	 *
	 * @example
	 * ```ts
	 * ok(2).or(ok(1)); // ok(2)
	 * err("oops").or(ok(1)); // ok(1)
	 * ```
	 *
	 * @param result - The result to return if this is `Err`.
	 *
	 * @returns This result if `Ok`, otherwise the provided result.
	 */
	or<F>(result: Result<T, F>): Result<T, F>;
	/**
	 * Calls the provided function with the `Err` value and returns its result, or propagates the `Ok`.
	 *
	 * @example
	 * ```ts
	 * ok(2).orElse((e) => ok(0)); // ok(2)
	 * err("oops").orElse((e) => ok(0)); // ok(0)
	 * err("oops").orElse((e) => err("fail")); // err("fail")
	 * ```
	 *
	 * @param fn - The function to call with the `Err` value.
	 *
	 * @returns The result of the function call, or the original `Ok`.
	 */
	orElse<F>(fn: (error: E) => Result<T, F>): Result<T, F>;

	/**
	 * Pattern matches on the result, calling the appropriate handler and returning its value.
	 *
	 * @example
	 * ```ts
	 * ok(42).match({
	 *   ok: (v) => `value: ${v}`,
	 *   err: (e) => `error: ${e}`,
	 * }); // "value: 42"
	 * ```
	 *
	 * @param handlers - The handlers to call based on the result.
	 *
	 * @returns The result of the handler call.
	 */
	match<U>(handlers: { ok: (value: T) => U; err: (error: E) => U }): U;

	/**
	 * Calls the provided function with the `Ok` value for side effects, returning the original result.
	 *
	 * @example
	 * ```ts
	 * ok(42).inspect((x) => console.log(x)); // logs 42, returns ok(42)
	 * err("oops").inspect((x) => console.log(x)); // does nothing, returns err("oops")
	 * ```
	 *
	 * @param fn - The function to call with the `Ok` value.
	 *
	 * @returns The original result, unchanged.
	 */
	inspect(fn: (value: T) => void): Result<T, E>;
	/**
	 * Calls the provided function with the `Err` value for side effects, returning the original result.
	 *
	 * @example
	 * ```ts
	 * ok(42).inspectErr((e) => console.error(e)); // does nothing, returns ok(42)
	 * err("oops").inspectErr((e) => console.error(e)); // logs "oops", returns err("oops")
	 * ```
	 *
	 * @param fn - The function to call with the `Err` value.
	 *
	 * @returns The original result, unchanged.
	 */
	inspectErr(fn: (error: E) => void): Result<T, E>;

	/**
	 * Flattens a nested `Result<Result<U, F>, E>` into `Result<U, E | F>`.
	 *
	 * @example
	 * ```ts
	 * ok(ok(42)).flatten(); // ok(42)
	 * ok(err("inner")).flatten(); // err("inner")
	 * err("outer").flatten(); // err("outer")
	 * ```
	 *
	 * @returns The flattened result.
	 */
	flatten<U, F>(this: Result<Result<U, F>, E>): Result<U, E | F>;

	/**
	 * Transforms the `Ok` value using the provided async function, leaving `Err` unchanged.
	 *
	 * @example
	 * ```ts
	 * ok(2).mapAsync(async (x) => x * 2); // ResultAsync containing ok(4)
	 * err("oops").mapAsync(async (x) => x * 2); // ResultAsync containing err("oops")
	 * ```
	 *
	 * @param fn - The async function to transform the `Ok` value.
	 *
	 * @returns A `ResultAsync` containing the result of the transformation.
	 */
	mapAsync<U>(fn: (value: T) => PromiseLike<U>): ResultAsync<U, E>;
	/**
	 * Transforms the `Err` value using the provided async function, leaving `Ok` unchanged.
	 *
	 * @example
	 * ```ts
	 * ok(2).mapErrAsync(async (e) => e.toUpperCase()); // ResultAsync containing ok(2)
	 * err("oops").mapErrAsync(async (e) => e.toUpperCase()); // ResultAsync containing err("OOPS")
	 * ```
	 *
	 * @param fn - The async function to transform the `Err` value.
	 *
	 * @returns A `ResultAsync` containing the result of the transformation.
	 */
	mapErrAsync<F>(fn: (error: E) => PromiseLike<F>): ResultAsync<T, F>;
	/**
	 * Calls the provided async function with the `Ok` value and returns its result, or propagates the `Err`.
	 *
	 * @example
	 * ```ts
	 * ok(2).andThenAsync(async (x) => ok(x * 2)); // ResultAsync containing ok(4)
	 * ok(2).andThenAsync(async (x) => err("fail")); // ResultAsync containing err("fail")
	 * err("oops").andThenAsync(async (x) => ok(x * 2)); // ResultAsync containing err("oops")
	 * ```
	 *
	 * @param fn - The async function to call with the `Ok` value.
	 *
	 * @returns A `ResultAsync` containing the result of the function call, or the original `Err`.
	 */
	andThenAsync<U, F, This extends Result<unknown, unknown>>(
		this: This,
		fn: (value: InferOk<This>) => PromiseLike<Result<U, F>> | ResultAsync<U, F>,
	): ResultAsync<U, InferErr<This> | F>;
	/**
	 * Calls the provided async function with the `Err` value and returns its result, or propagates the `Ok`.
	 *
	 * @example
	 * ```ts
	 * ok(2).orElseAsync(async (e) => ok(0)); // ResultAsync containing ok(2)
	 * err("oops").orElseAsync(async (e) => ok(0)); // ResultAsync containing ok(0)
	 * err("oops").orElseAsync(async (e) => err("fail")); // ResultAsync containing err("fail")
	 * ```
	 *
	 * @param fn - The async function to call with the `Err` value.
	 *
	 * @returns A `ResultAsync` containing the result of the function call, or the original `Ok`.
	 */
	orElseAsync<F>(
		fn: (error: E) => PromiseLike<Result<T, F>> | ResultAsync<T, F>,
	): ResultAsync<T, F>;
	/**
	 * Calls the provided async function with the `Ok` value for side effects, returning the original result.
	 *
	 * @example
	 * ```ts
	 * ok(42).inspectAsync(async (x) => { await log(x); }); // logs 42, returns ResultAsync containing ok(42)
	 * err("oops").inspectAsync(async (x) => { await log(x); }); // does nothing, returns ResultAsync containing err("oops")
	 * ```
	 *
	 * @param fn - The async function to call with the `Ok` value.
	 *
	 * @returns A `ResultAsync` containing the original result, unchanged.
	 */
	inspectAsync(fn: (value: T) => PromiseLike<void>): ResultAsync<T, E>;
	/**
	 * Calls the provided async function with the `Err` value for side effects, returning the original result.
	 *
	 * @example
	 * ```ts
	 * ok(42).inspectErrAsync(async (e) => { await logError(e); }); // does nothing, returns ResultAsync containing ok(42)
	 * err("oops").inspectErrAsync(async (e) => { await logError(e); }); // logs "oops", returns ResultAsync containing err("oops")
	 * ```
	 *
	 * @param fn - The async function to call with the `Err` value.
	 *
	 * @returns A `ResultAsync` containing the original result, unchanged.
	 */
	inspectErrAsync(fn: (error: E) => PromiseLike<void>): ResultAsync<T, E>;
}

/**
 * Represents a successful result containing a value.
 *
 * @example
 * ```ts
 * const result = new Ok(42);
 * console.log(result.value); // 42
 * ```
 *
 * @template T - The type of the success value.
 * @template E - The type of the error value (unused in Ok, but required for type compatibility).
 */
export class Ok<T, E> implements ResultMethods<T, E> {
	/** The contained success value. */
	readonly value: T;

	/**
	 * Creates a new Ok result.
	 *
	 * @param value - The success value to wrap.
	 */
	constructor(value: T) {
		this.value = value;
	}

	// biome-ignore lint/correctness/useYield: Generator returns immediately for Ok values
	*[Symbol.iterator](): SyncChainGenerator<T, E> {
		return this.value;
	}

	isOk(): this is Ok<T, E> {
		return true;
	}

	isErr(): this is Err<T, E> {
		return false;
	}

	isOkAnd<S extends T>(fn: (value: T) => value is S): this is Ok<S, E>;
	isOkAnd(fn: (value: T) => boolean): boolean;
	isOkAnd(fn: (value: T) => boolean): boolean {
		return fn(this.value);
	}

	isErrAnd<F extends E>(fn: (error: E) => error is F): this is Err<T, F>;
	isErrAnd(fn: (error: E) => boolean): boolean;
	isErrAnd(_fn: (error: E) => boolean): boolean {
		return false;
	}

	unwrap(): T {
		return this.value;
	}

	unwrapErr(): E {
		throw new Error(`Called unwrapErr on an Ok value: ${String(this.value)}`);
	}

	expect(_message: string): T {
		return this.value;
	}

	expectErr(message: string): E {
		throw new Error(message);
	}

	unwrapOr(_defaultValue: T): T {
		return this.value;
	}

	unwrapOrElse(_fn: (error: E) => T): T {
		return this.value;
	}

	map<U>(fn: (value: T) => U): Result<U, E> {
		return new Ok(fn(this.value));
	}

	mapErr<F>(_fn: (error: E) => F): Result<T, F> {
		// Cast avoids allocating a new Ok; the error type F is phantom here.
		return this as unknown as Ok<T, F>;
	}

	mapOr<U>(_defaultValue: U, fn: (value: T) => U): U {
		return fn(this.value);
	}

	mapOrElse<U>(_defaultFn: (error: E) => U, fn: (value: T) => U): U {
		return fn(this.value);
	}

	andThen<U, F, This extends Result<unknown, unknown>>(
		this: This,
		fn: (value: InferOk<This>) => Result<U, F>,
	): Result<U, InferErr<This> | F> {
		return fn((this as Ok<InferOk<This>, E>).value);
	}

	and<U, F>(result: Result<U, F>): Result<U, E | F> {
		return result;
	}

	or<F>(_result: Result<T, F>): Result<T, F> {
		// Cast avoids allocating a new Ok; the error type F is phantom here.
		return this as unknown as Ok<T, F>;
	}

	orElse<F>(_fn: (error: E) => Result<T, F>): Result<T, F> {
		// Cast avoids allocating a new Ok; the error type F is phantom here.
		return this as unknown as Ok<T, F>;
	}

	match<U>(handlers: { ok: (value: T) => U; err: (error: E) => U }): U {
		return handlers.ok(this.value);
	}

	inspect(fn: (value: T) => void): Result<T, E> {
		fn(this.value);
		return this;
	}

	inspectErr(_fn: (error: E) => void): Result<T, E> {
		return this;
	}

	flatten<U, F>(this: Ok<Result<U, F>, E>): Result<U, E | F> {
		return this.value;
	}

	mapAsync<U>(fn: (value: T) => PromiseLike<U>): ResultAsync<U, E> {
		return ResultAsync.fromPromise(Promise.resolve(fn(this.value)).then((v) => new Ok(v)));
	}

	mapErrAsync<F>(_fn: (error: E) => PromiseLike<F>): ResultAsync<T, F> {
		return ResultAsync.fromResult(this as unknown as Ok<T, F>);
	}

	andThenAsync<U, F, This extends Result<unknown, unknown>>(
		this: This,
		fn: (value: InferOk<This>) => PromiseLike<Result<U, F>> | ResultAsync<U, F>,
	): ResultAsync<U, InferErr<This> | F> {
		return ResultAsync.fromPromise(Promise.resolve(fn((this as Ok<InferOk<This>, E>).value)));
	}

	orElseAsync<F>(
		_fn: (error: E) => PromiseLike<Result<T, F>> | ResultAsync<T, F>,
	): ResultAsync<T, F> {
		return ResultAsync.fromResult(this as unknown as Ok<T, F>);
	}

	inspectAsync(fn: (value: T) => PromiseLike<void>): ResultAsync<T, E> {
		return ResultAsync.fromPromise(Promise.resolve(fn(this.value)).then(() => this));
	}

	inspectErrAsync(_fn: (error: E) => PromiseLike<void>): ResultAsync<T, E> {
		return ResultAsync.fromResult(this);
	}
}

/**
 * Represents a failed result containing an error.
 *
 * @example
 * ```ts
 * const result = new Err("something went wrong");
 * console.log(result.error); // "something went wrong"
 * ```
 *
 * @template T - The type of the success value (unused in Err, but required for type compatibility).
 * @template E - The type of the error value.
 */
export class Err<T, E> implements ResultMethods<T, E> {
	/** The contained error value. */
	readonly error: E;

	/**
	 * Creates a new Err result.
	 *
	 * @param error - The error value to wrap.
	 */
	constructor(error: E) {
		this.error = error;
	}

	*[Symbol.iterator](): SyncChainGenerator<T, E> {
		// `this` is always an Err, so we can cast it to Err<never, E>
		yield this as unknown as Err<never, E>;
		throw new Error("Unreachable: generator should have been halted");
	}

	isOk(): this is Ok<T, E> {
		return false;
	}

	isErr(): this is Err<T, E> {
		return true;
	}

	isOkAnd<S extends T>(fn: (value: T) => value is S): this is Ok<S, E>;
	isOkAnd(fn: (value: T) => boolean): boolean;
	isOkAnd(_fn: (value: T) => boolean): boolean {
		return false;
	}

	isErrAnd<F extends E>(fn: (error: E) => error is F): this is Err<T, F>;
	isErrAnd(fn: (error: E) => boolean): boolean;
	isErrAnd(fn: (error: E) => boolean): boolean {
		return fn(this.error);
	}

	unwrap(): T {
		throw new Error(`Called unwrap on an Err value: ${String(this.error)}`);
	}

	unwrapErr(): E {
		return this.error;
	}

	expect(message: string): T {
		throw new Error(message);
	}

	expectErr(_message: string): E {
		return this.error;
	}

	unwrapOr(defaultValue: T): T {
		return defaultValue;
	}

	unwrapOrElse(fn: (error: E) => T): T {
		return fn(this.error);
	}

	map<U>(_fn: (value: T) => U): Result<U, E> {
		// Cast avoids allocating a new Err; the value type U is phantom here.
		return this as unknown as Err<U, E>;
	}

	mapErr<F>(fn: (error: E) => F): Result<T, F> {
		return new Err(fn(this.error));
	}

	mapOr<U>(defaultValue: U, _fn: (value: T) => U): U {
		return defaultValue;
	}

	mapOrElse<U>(defaultFn: (error: E) => U, _fn: (value: T) => U): U {
		return defaultFn(this.error);
	}

	andThen<U, F, This extends Result<unknown, unknown>>(
		this: This,
		_fn: (value: InferOk<This>) => Result<U, F>,
	): Result<U, InferErr<This> | F> {
		// Cast avoids allocating a new Err; the value type U is phantom here.
		return this as Err<U, InferErr<This>>;
	}

	and<U, F>(_result: Result<U, F>): Result<U, E | F> {
		// Cast avoids allocating a new Err; the value type U is phantom here.
		return this as unknown as Err<U, E>;
	}

	or<F>(result: Result<T, F>): Result<T, F> {
		return result;
	}

	orElse<F>(fn: (error: E) => Result<T, F>): Result<T, F> {
		return fn(this.error);
	}

	match<U>(handlers: { ok: (value: T) => U; err: (error: E) => U }): U {
		return handlers.err(this.error);
	}

	inspect(_fn: (value: T) => void): Result<T, E> {
		return this;
	}

	inspectErr(fn: (error: E) => void): Result<T, E> {
		fn(this.error);
		return this;
	}

	flatten<U, F>(this: Err<Result<U, F>, E>): Result<U, E | F> {
		return this as unknown as Err<U, E>;
	}

	mapAsync<U>(_fn: (value: T) => PromiseLike<U>): ResultAsync<U, E> {
		return ResultAsync.fromResult(this as unknown as Err<U, E>);
	}

	mapErrAsync<F>(fn: (error: E) => PromiseLike<F>): ResultAsync<T, F> {
		return ResultAsync.fromPromise(Promise.resolve(fn(this.error)).then((e) => new Err(e)));
	}

	andThenAsync<U, F, This extends Result<unknown, unknown>>(
		this: This,
		_fn: (value: InferOk<This>) => PromiseLike<Result<U, F>> | ResultAsync<U, F>,
	): ResultAsync<U, InferErr<This> | F> {
		return ResultAsync.fromResult(this as Err<U, InferErr<This>>);
	}

	orElseAsync<F>(
		fn: (error: E) => PromiseLike<Result<T, F>> | ResultAsync<T, F>,
	): ResultAsync<T, F> {
		return ResultAsync.fromPromise(Promise.resolve(fn(this.error)));
	}

	inspectAsync(_fn: (value: T) => PromiseLike<void>): ResultAsync<T, E> {
		return ResultAsync.fromResult(this);
	}

	inspectErrAsync(fn: (error: E) => PromiseLike<void>): ResultAsync<T, E> {
		return ResultAsync.fromPromise(Promise.resolve(fn(this.error)).then(() => this));
	}
}

/**
 * A type that represents either success (`Ok`) or failure (`Err`).
 *
 * @example
 * ```ts
 * function divide(a: number, b: number): Result<number, string> {
 *   if (b === 0) return err("division by zero");
 *   return ok(a / b);
 * }
 * ```
 *
 * @template T - The type of the success value.
 * @template E - The type of the error value.
 */
export type Result<T, E> = Ok<T, E> | Err<T, E>;

/**
 * Creates an `Ok` result containing the given value.
 *
 * @example
 * ```ts
 * const result = ok(42);
 * result.unwrap(); // 42
 *
 * const empty = ok();
 * empty.unwrap(); // undefined
 * ```
 *
 * @template T - The type of the success value.
 * @template E - The type of the error value (defaults to `never`).
 *
 * @param value - The success value to wrap.
 *
 * @returns An `Ok` result containing the value.
 */
export function ok<E = never>(): Ok<void, E>;
export function ok<T, E = never>(value: T): Ok<T, E>;
export function ok<T, E = never>(value?: T): Ok<T, E> {
	return new Ok(value as T);
}

/**
 * Creates an `Err` result containing the given error.
 *
 * @example
 * ```ts
 * const result = err("something went wrong");
 * result.unwrapErr(); // "something went wrong"
 * ```
 *
 * @template T - The type of the success value (defaults to `never`).
 * @template E - The type of the error value.
 *
 * @param error - The error value to wrap.
 *
 * @returns An `Err` result containing the error.
 */
export function err<T = never, E = unknown>(error: E): Err<T, E> {
	return new Err(error);
}

interface ResultNamespace {
	/**
	 * Combines multiple `Result` values into a single `Result` containing a tuple of all
	 * `Ok` values, or the first `Err` encountered. Similar to `Promise.all`.
	 *
	 * @example
	 * ```ts
	 * const combined = Result.all([ok(1), ok("hello")]);
	 * combined.unwrap(); // [1, "hello"]
	 *
	 * const failed = Result.all([ok(1), err("bad"), ok(3)]);
	 * failed.unwrapErr(); // "bad"
	 * ```
	 *
	 * @template T - A readonly tuple or array of `Result` values.
	 *
	 * @param results - The `Result` values to combine.
	 *
	 * @returns A `Result` containing a tuple of all `Ok` values, or the first `Err`.
	 */
	all<const T extends readonly Result<unknown, unknown>[]>(
		results: T,
	): Result<OkTuple<T>, ErrUnion<T>>;
	all<T, E>(results: readonly Result<T, E>[]): Result<T[], E>;

	/**
	 * Executes a function and wraps the result in a `Result`. If the function throws,
	 * the error is caught and wrapped in an `Err`.
	 * Use this to wrap throwable operations before passing them into `Result`
	 * callbacks or `chain(...)` generators.
	 *
	 * @example
	 * ```ts
	 * const result = Result.try(() => JSON.parse('{"a": 1}')); // ok({ a: 1 })
	 * const failed = Result.try(() => JSON.parse('invalid')); // err(SyntaxError)
	 * ```
	 *
	 * @template T - The return type of the function.
	 * @template E - The error type (defaults to `unknown`).
	 *
	 * @param fn - The function to execute.
	 *
	 * @returns An `Ok` containing the function's return value, or an `Err` containing the thrown error.
	 */
	try<T, E = unknown>(fn: () => T): Result<T, E>;
}

export const Result: ResultNamespace = {
	all(results: readonly Result<unknown, unknown>[]): Result<unknown[], unknown> {
		const values: unknown[] = [];
		for (const result of results) {
			if (result.isErr()) {
				// Cast avoids allocating a new Err; the value type is phantom here.
				return result as Err<never, unknown>;
			}
			values.push(result.value);
		}

		return ok(values);
	},
	try<T, E = unknown>(fn: () => T): Result<T, E> {
		try {
			return ok(fn());
		} catch (error) {
			return err(error as E);
		}
	},
};
