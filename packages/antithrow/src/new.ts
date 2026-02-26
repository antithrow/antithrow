type SyncOrAsync<T> = T | PromiseLike<T>;

type MatchState<This, OkT, ErrT, PendingT> = [This] extends [Ok<unknown, unknown>]
	? OkT
	: [This] extends [Err<unknown, unknown>]
		? ErrT
		: [This] extends [Pending<unknown, unknown>]
			? PendingT
			: [This] extends [Settled<unknown, unknown>]
				? OkT | ErrT
				: OkT | ErrT | PendingT;

/**
 * Flattens Ok<Result<U, F>, E> into Result<U, E | F> while preserving inner explicit state.
 *
 * If T is not a Result, the Ok<T, E> is preserved.
 */
type FlattenOk<T, E> =
	T extends Ok<infer U, infer F>
		? Ok<U, E | F>
		: T extends Err<infer U, infer F>
			? Err<U, E | F>
			: T extends Pending<infer U, infer F>
				? Pending<U, E | F>
				: Ok<T, E>;

/**
 * Flattens Err<Result<U, unknown>, E> into Err<U, E>
 *
 * If T is not a Result, the Err<T, E> is preserved.
 */
type FlattenErr<T, E> = T extends Result<infer U, unknown> ? Err<U, E> : Err<T, E>;

/**
 * Flattens Pending<Result<U, F>, E> into Pending<U, E | F>
 *
 * If T is not a Result, the Pending<T, E> is preserved.
 */
type FlattenPending<T, E> = T extends Result<infer U, infer F> ? Pending<U, E | F> : Pending<T, E>;

abstract class ResultBase<T, E, This = Result<T, E>> {
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
	abstract map<U>(
		fn: (value: T) => SyncOrAsync<U>,
	): MatchState<This, Ok<U, E> | Pending<U, E>, Err<U, E>, Pending<U, E>>;

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
	abstract mapErr<F>(
		fn: (error: E) => SyncOrAsync<F>,
	): MatchState<This, Ok<T, F>, Err<T, F> | Pending<T, F>, Pending<T, F>>;

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
	abstract mapOr<U>(
		defaultValue: U,
		fn: (value: T) => SyncOrAsync<U>,
	): MatchState<This, SyncOrAsync<U>, U, PromiseLike<U>>;

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
	): MatchState<This, SyncOrAsync<U>, SyncOrAsync<U>, PromiseLike<U>>;

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
	abstract andThen<U, F>(
		fn: (value: T) => Result<U, F>,
	): MatchState<This, Result<U, F>, Err<U, E>, Pending<U, E | F>>;

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
	abstract and<U, F>(
		result: Result<U, F>,
	): MatchState<This, Result<U, F>, Err<U, E>, Pending<U, E | F>>;

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
	abstract or<F>(result: Result<T, F>): MatchState<This, Ok<T, E>, Result<T, F>, Pending<T, E | F>>;

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
	abstract orElse<F>(
		fn: (error: E) => Result<T, F>,
	): MatchState<This, Ok<T, F>, Result<T, F>, Pending<T, F>>;

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
	abstract flatten(): MatchState<This, FlattenOk<T, E>, FlattenErr<T, E>, FlattenPending<T, E>>;

	/**
	 * Returns the value if this result is {@link Ok}, otherwise throws an {@link UnwrapError}.
	 *
	 * @example
	 * ```ts
	 * const result: Result<number, string> = new Ok(5);
	 * const value = result.unwrap(); // 5
	 * ```
	 */
	abstract unwrap(): MatchState<This, T, never, PromiseLike<T>>;

	/**
	 * Returns the error if this result is {@link Err}, otherwise throws an {@link UnwrapError}.
	 *
	 * @example
	 * ```ts
	 * const result: Result<number, string> = new Err("failed");
	 * const error = result.unwrapErr(); // "failed"
	 * ```
	 */
	abstract unwrapErr(): MatchState<This, never, E, PromiseLike<E>>;

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
	abstract unwrapOr(value: T): MatchState<This, T, T, PromiseLike<T>>;

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
	abstract unwrapOrElse(
		fn: (error: E) => SyncOrAsync<T>,
	): MatchState<This, T, SyncOrAsync<T>, PromiseLike<T>>;

	/**
	 * Returns a settled result if this result is {@link Pending}, otherwise returns itself.
	 *
	 * @example
	 * ```ts
	 * const pending: Result<number, string> = Result.try(async () => 5);
	 * const settled = await pending.settle(); // Ok<number, string> with value 5
	 * ```
	 */
	abstract settle(): MatchState<
		This,
		PromiseLike<Ok<T, E>>,
		PromiseLike<Err<T, E>>,
		PromiseLike<Settled<T, E>>
	>;
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
	return (
		value !== null &&
		(typeof value === "object" || typeof value === "function") &&
		typeof (value as { then?: unknown }).then === "function"
	);
}

export class UnwrapError extends Error {
	override readonly name = "UnwrapError";
	constructor(
		message: string,
		readonly result: Result<unknown, unknown>,
	) {
		super(message);
	}
}

export class Ok<out T, out E = never> extends ResultBase<T, E, Ok<T, E>> {
	constructor(readonly value: T) {
		super();
	}

	isOk(): this is Ok<T, E> {
		return true;
	}

	isErr(): this is Err<T, E> {
		return false;
	}

	isPending(): this is Pending<T, E> {
		return false;
	}

	map<U>(fn: (value: T) => PromiseLike<U>): Pending<U, E>;
	map<U>(fn: (value: T) => U): U extends PromiseLike<infer A> ? Pending<A, E> : Ok<U, E>;
	map<U>(fn: (value: T) => SyncOrAsync<U>): Ok<U, E> | Pending<U, E>;
	map<U>(fn: (value: T) => SyncOrAsync<U>): Ok<U, E> | Pending<U, E> {
		const result = fn(this.value);

		if (isThenable(result)) {
			return new Pending(result.then((v) => new Ok(v)));
		}

		return new Ok(result);
	}

	mapErr<F>(_fn: (error: E) => SyncOrAsync<F>): Ok<T, F> {
		// SAFETY: Casts uninhabited E type to F.
		return this as unknown as Ok<T, F>;
	}

	mapOr<U>(defaultValue: U, fn: (value: T) => PromiseLike<U>): PromiseLike<U>;
	mapOr<U>(defaultValue: U, fn: (value: T) => U): U;
	mapOr<U>(defaultValue: U, fn: (value: T) => SyncOrAsync<U>): SyncOrAsync<U>;
	mapOr<U>(_defaultValue: U, fn: (value: T) => SyncOrAsync<U>): SyncOrAsync<U> {
		return fn(this.value);
	}

	mapOrElse<U>(
		defaultFn: (error: E) => PromiseLike<U>,
		fn: (value: T) => PromiseLike<U>,
	): PromiseLike<U>;
	mapOrElse<U>(defaultFn: (error: E) => PromiseLike<U>, fn: (value: T) => U): U;
	mapOrElse<U>(defaultFn: (error: E) => U, fn: (value: T) => PromiseLike<U>): PromiseLike<U>;
	mapOrElse<U>(defaultFn: (error: E) => U, fn: (value: T) => U): U;
	mapOrElse<U>(
		defaultFn: (error: E) => SyncOrAsync<U>,
		fn: (value: T) => SyncOrAsync<U>,
	): SyncOrAsync<U>;
	mapOrElse<U>(
		_defaultFn: (error: E) => SyncOrAsync<U>,
		fn: (value: T) => SyncOrAsync<U>,
	): SyncOrAsync<U> {
		return fn(this.value);
	}

	andThen<U, F>(fn: (value: T) => Ok<U, F>): Ok<U, F>;
	andThen<U, F>(fn: (value: T) => Err<U, F>): Err<U, F>;
	andThen<U, F>(fn: (value: T) => Pending<U, F>): Pending<U, F>;
	andThen<U, F>(fn: (value: T) => Result<U, F>): Result<U, F>;
	andThen<U, F>(fn: (value: T) => Result<U, F>): Result<U, F> {
		return fn(this.value);
	}

	and<U, F>(result: Ok<U, F>): Ok<U, F>;
	and<U, F>(result: Err<U, F>): Err<U, F>;
	and<U, F>(result: Pending<U, F>): Pending<U, F>;
	and<U, F>(result: Result<U, F>): Result<U, F>;
	and<U, F>(result: Result<U, F>): Result<U, F> {
		return result;
	}

	or<F>(_result: Result<T, F>): Ok<T, E> {
		return this;
	}

	orElse<F>(_fn: (error: E) => Result<T, F>): Ok<T, F> {
		// SAFETY: Casts uninhabited E type to F.
		return this as unknown as Ok<T, F>;
	}

	flatten(): FlattenOk<T, E> {
		if (this.value instanceof Ok || this.value instanceof Err || this.value instanceof Pending) {
			return this.value as FlattenOk<T, E>;
		}

		// SAFETY: When T is a union that includes non-Result values, flatten should preserve this Ok at runtime.
		return this as unknown as FlattenOk<T, E>;
	}

	settle(): PromiseLike<Ok<T, E>> {
		return Promise.resolve(this);
	}

	unwrap(): T {
		return this.value;
	}

	unwrapErr(): never {
		throw new UnwrapError("Called unwrapErr() on an Ok value", this);
	}

	unwrapOr(_value: T): T {
		return this.value;
	}

	unwrapOrElse(_fn: (error: E) => SyncOrAsync<T>): T {
		return this.value;
	}
}

export class Err<out T = never, out E = unknown> extends ResultBase<T, E, Err<T, E>> {
	constructor(readonly error: E) {
		super();
	}

	isOk(): this is Ok<T, E> {
		return false;
	}

	isErr(): this is Err<T, E> {
		return true;
	}

	isPending(): this is Pending<T, E> {
		return false;
	}

	map<U>(_fn: (value: T) => U | PromiseLike<U>): Err<U, E> {
		// SAFETY: Casts uninhabited T type to U.
		return this as unknown as Err<U, E>;
	}

	mapErr<F>(fn: (error: E) => PromiseLike<F>): Pending<T, F>;
	mapErr<F>(fn: (error: E) => F): F extends PromiseLike<infer A> ? Pending<T, A> : Err<T, F>;
	mapErr<F>(fn: (error: E) => SyncOrAsync<F>): Err<T, F> | Pending<T, F>;
	mapErr<F>(fn: (error: E) => F | PromiseLike<F>): Err<T, F> | Pending<T, F> {
		const result = fn(this.error);
		if (isThenable(result)) {
			return new Pending(result.then((error) => new Err(error)));
		}

		return new Err(result);
	}

	mapOr<U>(defaultValue: U, fn: (value: T) => SyncOrAsync<U>): U;
	mapOr<U>(defaultValue: U, _fn: (value: T) => SyncOrAsync<U>): U {
		return defaultValue;
	}

	mapOrElse<U>(
		defaultFn: (error: E) => PromiseLike<U>,
		fn: (value: T) => PromiseLike<U>,
	): PromiseLike<U>;
	mapOrElse<U>(defaultFn: (error: E) => PromiseLike<U>, fn: (value: T) => U): PromiseLike<U>;
	mapOrElse<U>(defaultFn: (error: E) => U, fn: (value: T) => PromiseLike<U>): U;
	mapOrElse<U>(defaultFn: (error: E) => U, fn: (value: T) => U): U;
	mapOrElse<U>(
		defaultFn: (error: E) => SyncOrAsync<U>,
		fn: (value: T) => SyncOrAsync<U>,
	): SyncOrAsync<U>;
	mapOrElse<U>(
		defaultFn: (error: E) => SyncOrAsync<U>,
		_fn: (value: T) => SyncOrAsync<U>,
	): SyncOrAsync<U> {
		return defaultFn(this.error);
	}

	andThen<U, F>(fn: (value: T) => Result<U, F>): Err<U, E>;
	andThen<U, F>(_fn: (value: T) => Result<U, F>): Err<U, E> {
		// SAFETY: Casts uninhabited T type to U.
		return this as unknown as Err<U, E>;
	}

	and<U, F>(result: Result<U, F>): Err<U, E>;
	and<U, F>(_result: Result<U, F>): Err<U, E> {
		// SAFETY: Casts uninhabited T type to U.
		return this as unknown as Err<U, E>;
	}

	or<F>(result: Ok<T, F>): Ok<T, F>;
	or<F>(result: Err<T, F>): Err<T, F>;
	or<F>(result: Pending<T, F>): Pending<T, F>;
	or<F>(result: Result<T, F>): Result<T, F>;
	or<F>(result: Result<T, F>): Result<T, F> {
		return result;
	}

	orElse<F>(fn: (error: E) => Ok<T, F>): Ok<T, F>;
	orElse<F>(fn: (error: E) => Err<T, F>): Err<T, F>;
	orElse<F>(fn: (error: E) => Pending<T, F>): Pending<T, F>;
	orElse<F>(fn: (error: E) => Result<T, F>): Result<T, F>;
	orElse<F>(fn: (error: E) => Result<T, F>): Result<T, F> {
		return fn(this.error);
	}

	flatten(): FlattenErr<T, E> {
		// SAFETY: Casts uninhabited T type while preserving outer error type E.
		return this as unknown as FlattenErr<T, E>;
	}

	settle(): PromiseLike<Err<T, E>> {
		return Promise.resolve(this);
	}

	unwrap(): never {
		throw new UnwrapError("Called unwrap() on an Err value", this);
	}

	unwrapErr(): E {
		return this.error;
	}

	unwrapOr(value: T): T {
		return value;
	}

	unwrapOrElse(fn: (error: E) => PromiseLike<T>): PromiseLike<T>;
	unwrapOrElse(fn: (error: E) => T): T;
	unwrapOrElse(fn: (error: E) => SyncOrAsync<T>): SyncOrAsync<T>;
	unwrapOrElse(fn: (error: E) => SyncOrAsync<T>): SyncOrAsync<T> {
		return fn(this.error);
	}
}

export class Pending<out T, out E>
	extends ResultBase<T, E, Pending<T, E>>
	implements PromiseLike<Settled<T, E>>
{
	constructor(readonly promise: PromiseLike<Settled<T, E>>) {
		super();
	}

	// biome-ignore lint/suspicious/noThenProperty: Pending explicitly implements PromiseLike
	then<A = Settled<T, E>, B = never>(
		onfulfilled?: ((value: Settled<T, E>) => A | PromiseLike<A>) | null,
		onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
	): PromiseLike<A | B> {
		return this.promise.then(onfulfilled, onrejected);
	}

	isOk(): this is Ok<T, E> {
		return false;
	}

	isErr(): this is Err<T, E> {
		return false;
	}

	isPending(): this is Pending<T, E> {
		return true;
	}

	map<U>(fn: (value: T) => SyncOrAsync<U>): Pending<U, E> {
		return new Pending(
			// SAFETY: Ok.map may return Pending (PromiseLike), which .then() flattens to Settled at runtime.
			this.promise.then((settled) => settled.map(fn)) as PromiseLike<Settled<U, E>>,
		);
	}

	mapErr<F>(fn: (error: E) => SyncOrAsync<F>): Pending<T, F> {
		return new Pending(
			// SAFETY: Err.mapErr may return Pending (PromiseLike), which .then() flattens to Settled at runtime.
			this.promise.then((settled) => settled.mapErr(fn)) as PromiseLike<Settled<T, F>>,
		);
	}

	mapOr<U>(defaultValue: U, fn: (value: T) => SyncOrAsync<U>): PromiseLike<U> {
		return this.promise.then((settled) => settled.mapOr(defaultValue, fn));
	}

	mapOrElse<U>(
		defaultFn: (error: E) => PromiseLike<U>,
		fn: (value: T) => PromiseLike<U>,
	): PromiseLike<U>;
	mapOrElse<U>(defaultFn: (error: E) => PromiseLike<U>, fn: (value: T) => U): PromiseLike<U>;
	mapOrElse<U>(defaultFn: (error: E) => U, fn: (value: T) => PromiseLike<U>): PromiseLike<U>;
	mapOrElse<U>(defaultFn: (error: E) => U, fn: (value: T) => U): PromiseLike<U>;
	mapOrElse<U>(
		defaultFn: (error: E) => SyncOrAsync<U>,
		fn: (value: T) => SyncOrAsync<U>,
	): SyncOrAsync<U>;
	mapOrElse<U>(
		defaultFn: (error: E) => SyncOrAsync<U>,
		fn: (value: T) => SyncOrAsync<U>,
	): PromiseLike<U> {
		return this.promise.then((settled) => settled.mapOrElse(defaultFn, fn));
	}

	andThen<U, F>(fn: (value: T) => Result<U, F>): Pending<U, E | F> {
		return new Pending(this.promise.then((settled) => settled.andThen(fn)));
	}

	and<U, F>(result: Result<U, F>): Pending<U, E | F> {
		return new Pending(this.promise.then((settled) => settled.and(result)));
	}

	or<F>(result: Result<T, F>): Pending<T, E | F> {
		return new Pending(this.promise.then((settled) => settled.or(result)));
	}

	orElse<F>(fn: (error: E) => Result<T, F>): Pending<T, F> {
		return new Pending(this.promise.then((settled) => settled.orElse(fn)));
	}

	flatten(): FlattenPending<T, E> {
		return new Pending(this.promise.then((settled) => settled.flatten())) as FlattenPending<T, E>;
	}

	settle(): PromiseLike<Settled<T, E>> {
		return this.promise;
	}

	unwrap(): PromiseLike<T> {
		return this.promise.then((result) => result.unwrap());
	}

	unwrapErr(): PromiseLike<E> {
		return this.promise.then((result) => result.unwrapErr());
	}

	unwrapOr(value: T): PromiseLike<T> {
		return this.promise.then((result) => result.unwrapOr(value));
	}

	unwrapOrElse(fn: (error: E) => SyncOrAsync<T>): PromiseLike<T> {
		return this.promise.then((settled) => settled.unwrapOrElse(fn));
	}
}

export type Result<T, E> = Ok<T, E> | Err<T, E> | Pending<T, E>;
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
function resultTry<T, E>(fn: () => T | PromiseLike<T>): Result<T, E> {
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
