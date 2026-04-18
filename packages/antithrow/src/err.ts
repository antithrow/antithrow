import { ResultBase } from "./base.js";
import { UnwrapError } from "./errors.js";
import type { Ok } from "./ok.js";
import { Pending } from "./pending.js";
import type { Result } from "./result.js";
import type { FlattenErr, FlattenThenable, InferOk, SameResolved, SyncOrAsync } from "./types.js";
import { isThenable } from "./utils.js";

/**
 * A failed {@link Result} containing an error of type `E`.
 *
 * @example
 * ```ts
 * const result = new Err<number, string>("failed");
 * result.unwrapErr(); // "failed"
 * ```
 */
export class Err<out T = never, out E = unknown> extends ResultBase<T, E> {
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

	mapOrElse<UDefault, UMap>(
		defaultFn: (error: E) => UDefault,
		fn: (value: T) => UMap & SameResolved<UDefault, UMap>,
	): FlattenThenable<UDefault>;
	mapOrElse<U>(
		defaultFn: (error: E) => PromiseLike<U>,
		fn: (value: T) => PromiseLike<U>,
	): PromiseLike<U>;
	mapOrElse<U>(
		defaultFn: (error: E) => SyncOrAsync<U>,
		fn: (value: T) => SyncOrAsync<U>,
	): SyncOrAsync<U>;
	mapOrElse(defaultFn: (error: E) => unknown, _fn: (value: T) => unknown): unknown {
		return defaultFn(this.error);
	}

	andThen<R extends Result<unknown, unknown>>(fn: (value: T) => R): Err<InferOk<R>, E>;
	andThen(_fn: (value: T) => Result<unknown, unknown>): Err<unknown, E> {
		// SAFETY: Casts uninhabited T type to U.
		return this as unknown as Err<unknown, E>;
	}

	and<R extends Result<unknown, unknown>>(result: R): Err<InferOk<R>, E>;
	and(_result: Result<unknown, unknown>): Err<unknown, E> {
		// SAFETY: Casts uninhabited T type to U.
		return this as unknown as Err<unknown, E>;
	}

	or<R extends Result<T, unknown>>(result: R): R {
		return result;
	}

	orElse<R extends Result<T, unknown>>(fn: (error: E) => R): R {
		return fn(this.error);
	}

	flatten(): FlattenErr<T, E> {
		// SAFETY: Casts uninhabited T type while preserving outer error type E.
		return this as unknown as FlattenErr<T, E>;
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

	settle(): PromiseLike<Err<T, E>> {
		return Promise.resolve(this);
	}

	*[Symbol.iterator](): Generator<Err<T, E>, never, void> {
		yield this;
		throw new Error("Unreachable: generator should have been halted");
	}
}
