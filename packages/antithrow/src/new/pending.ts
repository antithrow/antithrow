import { ResultBase } from "./base.js";
import type { Err } from "./err.js";
import type { Ok } from "./ok.js";
import type { Result } from "./result.js";
import type { FlattenPending, InferErr, InferOk, Settled, SyncOrAsync } from "./types.js";

/**
 * An asynchronous {@link Result} that will resolve to a {@link Settled} state.
 *
 * `Pending` implements `PromiseLike<Settled<T, E>>`, so it can be `await`ed.
 *
 * @example
 * ```ts
 * const pending = Result.try<number, string>(async () => 42);
 * const settled = await pending;
 * ```
 */
export class Pending<out T, out E> extends ResultBase<T, E> implements PromiseLike<Settled<T, E>> {
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
	): PromiseLike<U>;
	mapOrElse<U>(
		defaultFn: (error: E) => SyncOrAsync<U>,
		fn: (value: T) => SyncOrAsync<U>,
	): PromiseLike<U> {
		return this.promise.then((settled) => settled.mapOrElse(defaultFn, fn));
	}

	andThen<R extends Result<unknown, unknown>>(
		fn: (value: T) => R,
	): Pending<InferOk<R>, E | InferErr<R>>;
	andThen(fn: (value: T) => Result<unknown, unknown>): Pending<unknown, E | unknown> {
		return new Pending(this.promise.then((settled) => settled.andThen(fn)));
	}

	and<R extends Result<unknown, unknown>>(result: R): Pending<InferOk<R>, E | InferErr<R>>;
	and(result: Result<unknown, unknown>): Pending<unknown, E | unknown> {
		return new Pending(this.promise.then((settled) => settled.and(result)));
	}

	or<R extends Result<T, unknown>>(result: R): Pending<T, E | InferErr<R>>;
	or(result: Result<T, unknown>): Pending<T, E | unknown> {
		return new Pending(this.promise.then((settled) => settled.or(result)));
	}

	orElse<R extends Result<T, unknown>>(fn: (error: E) => R): Pending<T, InferErr<R>>;
	orElse(fn: (error: E) => Result<T, unknown>): Pending<T, unknown> {
		return new Pending(this.promise.then((settled) => settled.orElse(fn)));
	}

	flatten(): FlattenPending<T, E> {
		return new Pending(this.promise.then((settled) => settled.flatten())) as FlattenPending<T, E>;
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

	settle(): PromiseLike<Settled<T, E>> {
		return this.promise;
	}

	async *[Symbol.asyncIterator](): AsyncGenerator<Err<T, E>, T, void> {
		return yield* await this.promise;
	}
}
