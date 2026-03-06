import { ResultBase } from "./base.js";
import { Err } from "./err.js";
import { UnwrapError } from "./errors.js";
import { Pending } from "./pending.js";
import type { Result } from "./result.js";
import type { FlattenOk, SyncOrAsync } from "./types.js";
import { isThenable } from "./utils.js";

/**
 * A successful {@link Result} containing a value of type `T`.
 *
 * @example
 * ```ts
 * const result = new Ok<number, string>(42);
 * result.unwrap(); // 42
 * ```
 */
export class Ok<out T, out E = never> extends ResultBase<T, E> {
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

	settle(): PromiseLike<Ok<T, E>> {
		return Promise.resolve(this);
	}

	// biome-ignore lint/correctness/useYield: Only Err should ever yield a value (used for early exits of chains).
	*[Symbol.iterator](): Generator<never, T, void> {
		return this.value;
	}
}
