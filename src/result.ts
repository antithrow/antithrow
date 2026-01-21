interface ResultMethods<T, E> {
	isOk(): this is Ok<T, E>;
	isErr(): this is Err<T, E>;
	unwrap(): T;
	unwrapErr(): E;
	unwrapOr(defaultValue: T): T;
	unwrapOrElse(fn: (error: E) => T): T;
	map<U>(fn: (value: T) => U): Result<U, E>;
	mapErr<F>(fn: (error: E) => F): Result<T, F>;
	andThen<U, F>(fn: (value: T) => Result<U, F>): Result<U, E | F>;
	orElse<F>(fn: (error: E) => Result<T, F>): Result<T, F>;
	match<U>(handlers: { ok: (value: T) => U; err: (error: E) => U }): U;
}

export class Ok<T, E> implements ResultMethods<T, E> {
	readonly value: T;

	constructor(value: T) {
		this.value = value;
	}

	// biome-ignore lint/correctness/useYield: Generator returns immediately for Ok values
	*[Symbol.iterator](): Generator<Err<never, E>, T> {
		return this.value;
	}

	isOk(): this is Ok<T, E> {
		return true;
	}

	isErr(): this is Err<T, E> {
		return false;
	}

	unwrap(): T {
		return this.value;
	}

	unwrapErr(): E {
		throw new Error(`Called unwrapErr on an Ok value: ${String(this.value)}`);
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
		return new Ok(this.value);
	}

	andThen<U, F>(fn: (value: T) => Result<U, F>): Result<U, E | F> {
		return fn(this.value);
	}

	orElse<F>(_fn: (error: E) => Result<T, F>): Result<T, F> {
		return new Ok(this.value);
	}

	match<U>(handlers: { ok: (value: T) => U; err: (error: E) => U }): U {
		return handlers.ok(this.value);
	}
}

export class Err<T, E> implements ResultMethods<T, E> {
	readonly error: E;

	constructor(error: E) {
		this.error = error;
	}

	*[Symbol.iterator](): Generator<Err<never, E>, T> {
		yield new Err(this.error);
		throw new Error("Unreachable: generator should have been halted");
	}

	isOk(): this is Ok<T, E> {
		return false;
	}

	isErr(): this is Err<T, E> {
		return true;
	}

	unwrap(): T {
		throw new Error(`Called unwrap on an Err value: ${String(this.error)}`);
	}

	unwrapErr(): E {
		return this.error;
	}

	unwrapOr(defaultValue: T): T {
		return defaultValue;
	}

	unwrapOrElse(fn: (error: E) => T): T {
		return fn(this.error);
	}

	map<U>(_fn: (value: T) => U): Result<U, E> {
		return new Err(this.error);
	}

	mapErr<F>(fn: (error: E) => F): Result<T, F> {
		return new Err(fn(this.error));
	}

	andThen<U, F>(_fn: (value: T) => Result<U, F>): Result<U, E | F> {
		return new Err(this.error);
	}

	orElse<F>(fn: (error: E) => Result<T, F>): Result<T, F> {
		return fn(this.error);
	}

	match<U>(handlers: { ok: (value: T) => U; err: (error: E) => U }): U {
		return handlers.err(this.error);
	}
}

export type Result<T, E> = Ok<T, E> | Err<T, E>;

export function ok<T, E = never>(value: T): Ok<T, E> {
	return new Ok(value);
}

export function err<E, T = never>(error: E): Err<T, E> {
	return new Err(error);
}
