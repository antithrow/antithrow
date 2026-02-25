import { describe, expect, expectTypeOf, it, mock } from "bun:test";
import { Err, Ok, Pending, Result, type Settled, UnwrapError } from "./new.js";

const ok = <T, E>(v: T): Result<T, E> => new Ok(v);
const err = <T, E>(e: E): Result<T, E> => new Err(e);
const pending = <T, E>(r: Result<T, E>): Result<T, E> => new Pending(Promise.resolve(r));

describe("Result", () => {
	describe("isOk", () => {
		it("reports the correct state and narrows to Ok", () => {
			const result = ok<number, string>(42);

			expect(result.isOk()).toBeTrue();
			expect(result.isErr()).toBeFalse();
			expect(result.isPending()).toBeFalse();

			if (result.isOk()) {
				expectTypeOf(result).toEqualTypeOf<Ok<number, string>>();
				expectTypeOf(result.value).toEqualTypeOf<number>();
			}
		});
	});

	describe("isErr", () => {
		it("reports the correct state and narrows to Err", () => {
			const result = err<number, string>("failed");

			expect(result.isOk()).toBeFalse();
			expect(result.isErr()).toBeTrue();
			expect(result.isPending()).toBeFalse();

			if (result.isErr()) {
				expectTypeOf(result).toEqualTypeOf<Err<number, string>>();
				expectTypeOf(result.error).toEqualTypeOf<string>();
			}
		});
	});

	describe("isPending", () => {
		it("reports the correct state and narrows to Pending", () => {
			const result = pending<number, string>(ok(42));

			expect(result.isOk()).toBeFalse();
			expect(result.isErr()).toBeFalse();
			expect(result.isPending()).toBeTrue();

			if (result.isPending()) {
				expectTypeOf(result).toEqualTypeOf<Pending<number, string>>();
				expectTypeOf(result.promise).resolves.toEqualTypeOf<Settled<number, string>>();
			}
		});
	});

	describe("map", () => {
		it("returns Ok when called on explicit Ok with a sync mapper", () => {
			const result = new Ok<number, string>(42);

			const mapped = result.map((v) => v.toString());

			expect(mapped.isOk()).toBeTrue();
			expect(mapped.unwrap()).toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<Ok<string, string>>();
		});

		it("returns Err when called on explicit Err with a sync mapper", () => {
			const result = new Err<number, string>("failed");

			const mapped = result.map((v) => v.toString());

			expect(mapped.isErr()).toBeTrue();
			expect(mapped.unwrapErr()).toBe("failed");
			expectTypeOf(mapped).toEqualTypeOf<Err<string, string>>();
		});

		it("returns Pending when called on explicit Ok with an async mapper", () => {
			const result = new Ok<number, string>(42);

			const mapped = result.map(async (v) => v.toString());

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<Pending<string, string>>();
		});

		it("returns Err when called on explicit Err with an async mapper", () => {
			const result = new Err<number, string>("failed");

			const mapped = result.map(async (v) => v.toString());

			expect(mapped.isErr()).toBeTrue();
			expect(mapped.unwrapErr()).toBe("failed");
			expectTypeOf(mapped).toEqualTypeOf<Err<string, string>>();
		});

		it("returns Ok | Pending when called on explicit Ok with a union-returning mapper", () => {
			const result = new Ok<number, string>(42);
			const mapper = (v: number): string | Promise<string> => v.toString();

			const mapped = result.map(mapper);

			expect(mapped.isOk()).toBeTrue();
			expectTypeOf(mapped).toEqualTypeOf<Ok<string, string> | Pending<string, string>>();
		});

		it("transforms the value of Ok", () => {
			const result = ok<number, string>(42);
			const mapper = mock((v: number) => v.toString());

			const mapped = result.map(mapper);

			expect(mapped.isOk()).toBeTrue();
			expect(mapped.unwrap()).toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<Result<string, string>>();

			expect(mapper).toHaveBeenCalledTimes(1);
			expect(mapper).toHaveBeenCalledWith(42);
			expect(mapper).toHaveReturnedWith("42");
		});

		it("doesn't transform the value of Err", () => {
			const result = err<number, string>("failed");
			const mapper = mock((v: number) => v.toString());

			const mapped = result.map(mapper);

			expect(mapped.isErr()).toBeTrue();
			expect(mapped.unwrapErr()).toBe("failed");
			expectTypeOf(mapped).toEqualTypeOf<Result<string, string>>();

			expect(mapper).not.toHaveBeenCalled();
		});

		it("transforms the value of Pending when it resolves to Ok", () => {
			const result = pending<number, string>(ok(42));
			const mapper = mock((v: number) => v.toString());

			const mapped = result.map(mapper);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<Result<string, string>>();

			expect(mapper).toHaveBeenCalledTimes(1);
			expect(mapper).toHaveBeenCalledWith(42);
			expect(mapper).toHaveReturnedWith("42");
		});

		it("doesn't transform the value of Pending when it resolves to Err", () => {
			const result = pending<number, string>(err("failed"));
			const mapper = mock((v: number) => v.toString());

			const mapped = result.map(mapper);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrapErr()).resolves.toBe("failed");
			expectTypeOf(mapped).toEqualTypeOf<Result<string, string>>();

			expect(mapper).not.toHaveBeenCalled();
		});

		it("asynchronously transforms the value of Ok as Pending", () => {
			const result = ok<number, string>(42);
			const mapper = mock(async (v: number) => v.toString());

			const mapped = result.map(mapper);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<Err<string, string> | Pending<string, string>>();

			expect(mapper).toHaveBeenCalledTimes(1);
			expect(mapper).toHaveBeenCalledWith(42);
			expect(mapper).toHaveReturnedWith(Promise.resolve("42"));
		});

		it("doesn't asynchronously transform the value of Err", () => {
			const result = err<number, string>("failed");
			const mapper = mock(async (v: number) => v.toString());

			const mapped = result.map(mapper);

			expect(mapped.isErr()).toBeTrue();
			expect(mapped.unwrapErr()).toBe("failed");
			expectTypeOf(mapped).toEqualTypeOf<Err<string, string> | Pending<string, string>>();

			expect(mapper).not.toHaveBeenCalled();
		});

		it("asynchronously transforms the value Pending when it resolves to Ok", () => {
			const result = pending<number, string>(ok(42));
			const mapper = mock(async (v: number) => v.toString());

			const mapped = result.map(mapper);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<Err<string, string> | Pending<string, string>>();

			expect(mapper).toHaveBeenCalledTimes(1);
			expect(mapper).toHaveBeenCalledWith(42);
			expect(mapper).toHaveReturnedWith(Promise.resolve("42"));
		});

		it("doesn't asynchronously transform the value of Pending when it resolves to Err", () => {
			const result = pending<number, string>(err("failed"));
			const mapper = mock(async (v: number) => v.toString());

			const mapped = result.map(mapper);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrapErr()).resolves.toBe("failed");
			expectTypeOf(mapped).toEqualTypeOf<Err<string, string> | Pending<string, string>>();

			expect(mapper).not.toHaveBeenCalled();
		});
	});

	describe("mapErr", () => {
		it("returns Ok when called on explicit Ok with a sync mapper", () => {
			const result = new Ok<number, string>(42);

			const mapped = result.mapErr((e) => e.length);

			expect(mapped.isOk()).toBeTrue();
			expect(mapped.unwrap()).toBe(42);
			expectTypeOf(mapped).toEqualTypeOf<Ok<number, number>>();
		});

		it("returns Err when called on explicit Err with a sync mapper", () => {
			const result = new Err<number, string>("failed");

			const mapped = result.mapErr((e) => e.length);

			expect(mapped.isErr()).toBeTrue();
			expect(mapped.unwrapErr()).toBe("failed".length);
			expectTypeOf(mapped).toEqualTypeOf<Err<number, number>>();
		});

		it("returns Ok when called on explicit Ok with an async mapper", () => {
			const result = new Ok<number, string>(42);

			const mapped = result.mapErr(async (e) => e.length);

			expect(mapped.isOk()).toBeTrue();
			expect(mapped.unwrap()).toBe(42);
			expectTypeOf(mapped).toEqualTypeOf<Ok<number, number>>();
		});

		it("returns Pending when called on explicit Err with an async mapper", () => {
			const result = new Err<number, string>("failed");

			const mapped = result.mapErr(async (e) => e.length);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrapErr()).resolves.toBe("failed".length);
			expectTypeOf(mapped).toEqualTypeOf<Pending<number, number>>();
		});

		it("returns Err | Pending when called on explicit Err with a union-returning mapper", () => {
			const result = new Err<number, string>("failed");
			const mapper = (e: string): number | Promise<number> => e.length;

			const mapped = result.mapErr(mapper);

			expect(mapped.isErr()).toBeTrue();
			expectTypeOf(mapped).toEqualTypeOf<Err<number, number> | Pending<number, number>>();
		});

		it("doesn't transform the error of Ok", () => {
			const result = ok<number, string>(42);
			const mapper = mock((e: string) => e.length);

			const mapped = result.mapErr(mapper);

			expect(mapped.isOk()).toBeTrue();
			expect(mapped.unwrap()).toBe(42);
			expectTypeOf(mapped).toEqualTypeOf<Result<number, number>>();

			expect(mapper).not.toHaveBeenCalled();
		});

		it("transforms the error of Err", () => {
			const result = err<number, string>("failed");
			const mapper = mock((e: string) => e.length);

			const mapped = result.mapErr(mapper);

			expect(mapped.isErr()).toBeTrue();
			expect(mapped.unwrapErr()).toBe("failed".length);
			expectTypeOf(mapped).toEqualTypeOf<Result<number, number>>();

			expect(mapper).toHaveBeenCalledTimes(1);
			expect(mapper).toHaveBeenCalledWith("failed");
			expect(mapper).toHaveReturnedWith("failed".length);
		});

		it("doesn't transform the error of Pending when it resolves to Ok", () => {
			const result = pending<number, string>(ok(42));
			const mapper = mock((e: string) => e.length);

			const mapped = result.mapErr(mapper);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe(42);
			expectTypeOf(mapped).toEqualTypeOf<Result<number, number>>();

			expect(mapper).not.toHaveBeenCalled();
		});

		it("transforms the error of Pending when it resolves to Err", () => {
			const result = pending<number, string>(err("failed"));
			const mapper = mock((e: string) => e.length);

			const mapped = result.mapErr(mapper);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrapErr()).resolves.toBe("failed".length);
			expectTypeOf(mapped).toEqualTypeOf<Result<number, number>>();

			expect(mapper).toHaveBeenCalledTimes(1);
			expect(mapper).toHaveBeenCalledWith("failed");
			expect(mapper).toHaveReturnedWith("failed".length);
		});

		it("doesn't asynchronously transform the error of Ok", () => {
			const result = ok<number, string>(42);
			const mapper = mock(async (e: string) => e.length);

			const mapped = result.mapErr(mapper);

			expect(mapped.isOk()).toBeTrue();
			expect(mapped.unwrap()).toBe(42);
			expectTypeOf(mapped).toEqualTypeOf<Ok<number, number> | Pending<number, number>>();

			expect(mapper).not.toHaveBeenCalled();
		});

		it("asynchronously transforms the error of Err as Pending", () => {
			const result = err<number, string>("failed");
			const mapper = mock(async (e: string) => e.length);

			const mapped = result.mapErr(mapper);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrapErr()).resolves.toBe("failed".length);
			expectTypeOf(mapped).toEqualTypeOf<Ok<number, number> | Pending<number, number>>();

			expect(mapper).toHaveBeenCalledTimes(1);
			expect(mapper).toHaveBeenCalledWith("failed");
			expect(mapper).toHaveReturnedWith(Promise.resolve("failed".length));
		});

		it("doesn't asynchronously transform the error of Pending when it resolves to Ok", () => {
			const result = pending<number, string>(ok(42));
			const mapper = mock(async (e: string) => e.length);

			const mapped = result.mapErr(mapper);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe(42);
			expectTypeOf(mapped).toEqualTypeOf<Ok<number, number> | Pending<number, number>>();

			expect(mapper).not.toHaveBeenCalled();
		});

		it("asynchronously transforms the error of Pending when it resolves to Err", () => {
			const result = pending<number, string>(err("failed"));
			const mapper = mock(async (e: string) => e.length);

			const mapped = result.mapErr(mapper);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrapErr()).resolves.toBe("failed".length);
			expectTypeOf(mapped).toEqualTypeOf<Ok<number, number> | Pending<number, number>>();

			expect(mapper).toHaveBeenCalledTimes(1);
			expect(mapper).toHaveBeenCalledWith("failed");
			expect(mapper).toHaveReturnedWith(Promise.resolve("FAILED"));
		});
	});

	describe("mapOr", () => {
		it("returns transformed value when called on explicit Ok with a sync mapper", () => {
			const result = new Ok<number, string>(42);

			const mapped = result.mapOr("0", (v) => v.toString());

			expect(mapped).toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<string>();
		});

		it("returns default when called on explicit Err with a sync mapper", () => {
			const result = new Err<number, string>("failed");

			const mapped = result.mapOr("0", (v) => v.toString());

			expect(mapped).toBe("0");
			expectTypeOf(mapped).toEqualTypeOf<string>();
		});

		it("returns PromiseLike when called on explicit Ok with an async mapper", () => {
			const result = new Ok<number, string>(42);

			const mapped = result.mapOr("0", async (v) => v.toString());

			expect(mapped).resolves.toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<PromiseLike<string>>();
		});

		it("returns default when called on explicit Err with an async mapper", () => {
			const result = new Err<number, string>("failed");

			const mapped = result.mapOr("0", async (v) => v.toString());

			expect(mapped).toBe("0");
			expectTypeOf(mapped).toEqualTypeOf<string>();
		});

		it("transforms the value of Ok", () => {
			const result = ok<number, string>(42);
			const mapper = mock((v: number) => v.toString());

			const mapped = result.mapOr("0", mapper);

			expect(mapped).toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<string | PromiseLike<string>>();

			expect(mapper).toHaveBeenCalledTimes(1);
			expect(mapper).toHaveBeenCalledWith(42);
			expect(mapper).toHaveReturnedWith("42");
		});

		it("doesn't transform the value of Err", () => {
			const result = err<number, string>("failed");
			const mapper = mock((v: number) => v.toString());

			const mapped = result.mapOr("0", mapper);

			expect(mapped).toBe("0");
			expectTypeOf(mapped).toEqualTypeOf<string | PromiseLike<string>>();

			expect(mapper).not.toHaveBeenCalled();
		});

		it("transforms the value of Pending when it resolves to Ok", () => {
			const result = pending<number, string>(ok(42));
			const mapper = mock((v: number) => v.toString());

			const mapped = result.mapOr("0", mapper);

			expect(mapped).resolves.toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<string | PromiseLike<string>>();

			expect(mapper).toHaveBeenCalledTimes(1);
			expect(mapper).toHaveBeenCalledWith(42);
			expect(mapper).toHaveReturnedWith("42");
		});

		it("doesn't transform the value of Pending when it resolves to Err", () => {
			const result = pending<number, string>(err("failed"));
			const mapper = mock((v: number) => v.toString());

			const mapped = result.mapOr("0", mapper);

			expect(mapped).resolves.toBe("0");
			expectTypeOf(mapped).toEqualTypeOf<string | PromiseLike<string>>();

			expect(mapper).not.toHaveBeenCalled();
		});

		it("asynchronously transforms the value of Ok", () => {
			const result = ok<number, string>(42);
			const mapper = mock(async (v: number) => v.toString());

			const mapped = result.mapOr("0", mapper);

			expect(mapped).resolves.toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<string | PromiseLike<string>>();

			expect(mapper).toHaveBeenCalledTimes(1);
			expect(mapper).toHaveBeenCalledWith(42);
			expect(mapper).toHaveReturnedWith(Promise.resolve("42"));
		});

		it("doesn't asynchronously transform the value of Err", () => {
			const result = err<number, string>("failed");
			const mapper = mock(async (v: number) => v.toString());

			const mapped = result.mapOr("0", mapper);

			expect(mapped).toBe("0");
			expectTypeOf(mapped).toEqualTypeOf<string | PromiseLike<string>>();

			expect(mapper).not.toHaveBeenCalled();
		});

		it("asynchronously transforms the value of Pending when it resolves to Ok", () => {
			const result = pending<number, string>(ok(42));
			const mapper = mock(async (v: number) => v.toString());

			const mapped = result.mapOr("0", mapper);

			expect(mapped).resolves.toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<string | PromiseLike<string>>();

			expect(mapper).toHaveBeenCalledTimes(1);
			expect(mapper).toHaveBeenCalledWith(42);
			expect(mapper).toHaveReturnedWith(Promise.resolve("42"));
		});

		it("doesn't asynchronously transform the value of Pending when it resolves to Err", () => {
			const result = pending<number, string>(err("failed"));
			const mapper = mock(async (v: number) => v.toString());

			const mapped = result.mapOr("0", mapper);

			expect(mapped).resolves.toBe("0");
			expectTypeOf(mapped).toEqualTypeOf<string | PromiseLike<string>>();

			expect(mapper).not.toHaveBeenCalled();
		});
	});

	describe("mapOrElse", () => {
		it("returns transformed value when called on explicit Ok with sync functions", () => {
			const result = new Ok<number, string>(42);

			const mapped = result.mapOrElse(
				(e) => e.length.toString(),
				(v) => v.toString(),
			);

			expect(mapped).toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<string>();
		});

		it("returns default value when called on explicit Err with sync functions", () => {
			const result = new Err<number, string>("failed");

			const mapped = result.mapOrElse(
				(e) => e.length.toString(),
				(v) => v.toString(),
			);

			expect(mapped).toBe("6");
			expectTypeOf(mapped).toEqualTypeOf<string>();
		});

		it("returns PromiseLike when called on explicit Ok with an async mapper", () => {
			const result = new Ok<number, string>(42);

			const mapped = result.mapOrElse(
				(e) => e.length.toString(),
				async (v) => v.toString(),
			);

			expect(mapped).resolves.toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<PromiseLike<string>>();
		});

		it("returns PromiseLike when called on explicit Err with an async default function", () => {
			const result = new Err<number, string>("failed");

			const mapped = result.mapOrElse(
				async (e) => e.length.toString(),
				(v) => v.toString(),
			);

			expect(mapped).resolves.toBe("6");
			expectTypeOf(mapped).toEqualTypeOf<PromiseLike<string>>();
		});

		it("transforms the value of Ok", () => {
			const result = ok<number, string>(42);
			const defaultFn = mock((e: string) => e.length.toString());
			const mapper = mock((v: number) => v.toString());

			const mapped = result.mapOrElse(defaultFn, mapper);

			expect(mapped).toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<string | PromiseLike<string>>();

			expect(defaultFn).not.toHaveBeenCalled();
			expect(mapper).toHaveBeenCalledTimes(1);
			expect(mapper).toHaveBeenCalledWith(42);
			expect(mapper).toHaveReturnedWith("42");
		});

		it("transforms the error of Err", () => {
			const result = err<number, string>("failed");
			const defaultFn = mock((e: string) => e.length.toString());
			const mapper = mock((v: number) => v.toString());

			const mapped = result.mapOrElse(defaultFn, mapper);

			expect(mapped).toBe("6");
			expectTypeOf(mapped).toEqualTypeOf<string | PromiseLike<string>>();

			expect(defaultFn).toHaveBeenCalledTimes(1);
			expect(defaultFn).toHaveBeenCalledWith("failed");
			expect(defaultFn).toHaveReturnedWith("6");
			expect(mapper).not.toHaveBeenCalled();
		});

		it("transforms the value of Pending when it resolves to Ok", () => {
			const result = pending<number, string>(ok(42));
			const defaultFn = mock((e: string) => e.length.toString());
			const mapper = mock((v: number) => v.toString());

			const mapped = result.mapOrElse(defaultFn, mapper);

			expect(mapped).resolves.toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<string | PromiseLike<string>>();

			expect(defaultFn).not.toHaveBeenCalled();
			expect(mapper).toHaveBeenCalledTimes(1);
			expect(mapper).toHaveBeenCalledWith(42);
			expect(mapper).toHaveReturnedWith("42");
		});

		it("transforms the error of Pending when it resolves to Err", () => {
			const result = pending<number, string>(err("failed"));
			const defaultFn = mock((e: string) => e.length.toString());
			const mapper = mock((v: number) => v.toString());

			const mapped = result.mapOrElse(defaultFn, mapper);

			expect(mapped).resolves.toBe("6");
			expectTypeOf(mapped).toEqualTypeOf<string | PromiseLike<string>>();

			expect(defaultFn).toHaveBeenCalledTimes(1);
			expect(defaultFn).toHaveBeenCalledWith("failed");
			expect(defaultFn).toHaveReturnedWith("6");
			expect(mapper).not.toHaveBeenCalled();
		});

		it("asynchronously transforms the value of Ok", () => {
			const result = ok<number, string>(42);
			const defaultFn = mock(async (e: string) => e.length.toString());
			const mapper = mock(async (v: number) => v.toString());

			const mapped = result.mapOrElse(defaultFn, mapper);

			expect(mapped).resolves.toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<PromiseLike<string>>();

			expect(defaultFn).not.toHaveBeenCalled();
			expect(mapper).toHaveBeenCalledTimes(1);
			expect(mapper).toHaveBeenCalledWith(42);
			expect(mapper).toHaveReturnedWith(Promise.resolve("42"));
		});

		it("asynchronously transforms the error of Err", () => {
			const result = err<number, string>("failed");
			const defaultFn = mock(async (e: string) => e.length.toString());
			const mapper = mock(async (v: number) => v.toString());

			const mapped = result.mapOrElse(defaultFn, mapper);

			expect(mapped).resolves.toBe("6");
			expectTypeOf(mapped).toEqualTypeOf<PromiseLike<string>>();

			expect(defaultFn).toHaveBeenCalledTimes(1);
			expect(defaultFn).toHaveBeenCalledWith("failed");
			expect(defaultFn).toHaveReturnedWith(Promise.resolve("6"));
			expect(mapper).not.toHaveBeenCalled();
		});

		it("asynchronously transforms the value of Pending when it resolves to Ok", () => {
			const result = pending<number, string>(ok(42));
			const defaultFn = mock(async (e: string) => e.length.toString());
			const mapper = mock(async (v: number) => v.toString());

			const mapped = result.mapOrElse(defaultFn, mapper);

			expect(mapped).resolves.toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<PromiseLike<string>>();

			expect(defaultFn).not.toHaveBeenCalled();
			expect(mapper).toHaveBeenCalledTimes(1);
			expect(mapper).toHaveBeenCalledWith(42);
			expect(mapper).toHaveReturnedWith(Promise.resolve("42"));
		});

		it("asynchronously transforms the error of Pending when it resolves to Err", () => {
			const result = pending<number, string>(err("failed"));
			const defaultFn = mock(async (e: string) => e.length.toString());
			const mapper = mock(async (v: number) => v.toString());

			const mapped = result.mapOrElse(defaultFn, mapper);

			expect(mapped).resolves.toBe("6");
			expectTypeOf(mapped).toEqualTypeOf<PromiseLike<string>>();

			expect(defaultFn).toHaveBeenCalledTimes(1);
			expect(defaultFn).toHaveBeenCalledWith("failed");
			expect(defaultFn).toHaveReturnedWith(Promise.resolve("6"));
			expect(mapper).not.toHaveBeenCalled();
		});
	});

	describe("andThen", () => {
		it("returns Ok when called on explicit Ok and callback returns Ok", () => {
			const result = new Ok<number, string>(42);

			const mapped = result.andThen((v) => new Ok(v.toString()));

			expect(mapped.isOk()).toBeTrue();
			expect(mapped.unwrap()).toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<Ok<string, string>>();
		});

		it("returns Err when called on explicit Ok and callback returns Err", () => {
			const result = new Ok<number, string>(42);

			const mapped = result.andThen((v) => new Err<string, number>(v));

			expect(mapped.isErr()).toBeTrue();
			expect(mapped.unwrapErr()).toBe(42);
			expectTypeOf(mapped).toEqualTypeOf<Err<string, string | number>>();
		});

		it("returns Pending when called on explicit Ok and callback returns Pending", () => {
			const result = new Ok<number, string>(42);

			const mapped = result.andThen((v) => new Pending(Promise.resolve(new Ok(v.toString()))));

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<Pending<string, string>>();
		});

		it("returns Err when called on explicit Err", () => {
			const result = new Err<number, string>("failed");

			const mapped = result.andThen((v) => new Ok(v.toString()));

			expect(mapped.isErr()).toBeTrue();
			expect(mapped.unwrapErr()).toBe("failed");
			expectTypeOf(mapped).toEqualTypeOf<Err<string, string>>();
		});

		it("transforms the value of Ok", () => {
			const result = ok<number, string>(42);
			const mapper = mock((v: number) => ok<string, number>(v.toString()));

			const mapped = result.andThen(mapper);

			expect(mapped.isOk()).toBeTrue();
			expect(mapped.unwrap()).toBe("42");
			expectTypeOf(mapped).toExtend<Result<string, string | number>>();
			expectTypeOf(mapped).toEqualTypeOf<Err<string, string> | Result<string, string | number>>();

			expect(mapper).toHaveBeenCalledTimes(1);
			expect(mapper).toHaveBeenCalledWith(42);
			expect(mapper).toHaveReturnedWith(ok<string, number>("42"));
		});

		it("doesn't transform the value of Err", () => {
			const result = err<number, string>("failed");
			const mapper = mock((v: number) => ok<string, number>(v.toString()));

			const mapped = result.andThen(mapper);

			expect(mapped.isErr()).toBeTrue();
			expect(mapped.unwrapErr()).toBe("failed");
			expectTypeOf(mapped).toExtend<Result<string, string | number>>();
			expectTypeOf(mapped).toEqualTypeOf<Err<string, string> | Result<string, string | number>>();

			expect(mapper).not.toHaveBeenCalled();
		});

		it("transforms the value of Pending when it resolves to Ok", () => {
			const result = pending<number, string>(ok(42));
			const mapper = mock((v: number) => ok<string, number>(v.toString()));

			const mapped = result.andThen(mapper);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe("42");
			expectTypeOf(mapped).toExtend<Result<string, string | number>>();
			expectTypeOf(mapped).toEqualTypeOf<Err<string, string> | Result<string, string | number>>();

			expect(mapper).toHaveBeenCalledTimes(1);
			expect(mapper).toHaveBeenCalledWith(42);
			expect(mapper).toHaveReturnedWith(ok<string, number>("42"));
		});

		it("doesn't transform the value of Pending when it resolves to Err", () => {
			const result = pending<number, string>(err("failed"));
			const mapper = mock((v: number) => ok<string, number>(v.toString()));

			const mapped = result.andThen(mapper);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrapErr()).resolves.toBe("failed");
			expectTypeOf(mapped).toExtend<Result<string, string | number>>();
			expectTypeOf(mapped).toEqualTypeOf<Err<string, string> | Result<string, string | number>>();

			expect(mapper).not.toHaveBeenCalled();
		});
	});

	describe("flatten", () => {
		it("returns explicit Ok when called on explicit Ok wrapping explicit Ok", () => {
			const result = new Ok<Ok<number, boolean>, string>(new Ok(42));

			const flattened = result.flatten();

			expect(flattened.isOk()).toBeTrue();
			expect(flattened.unwrap()).toBe(42);
			expectTypeOf(flattened).toEqualTypeOf<Ok<number, string | boolean>>();
		});

		it("returns explicit Err when called on explicit Ok wrapping explicit Err", () => {
			const result = new Ok<Err<number, boolean>, string>(new Err(false));

			const flattened = result.flatten();

			expect(flattened.isErr()).toBeTrue();
			expect(flattened.unwrapErr()).toBeFalse();
			expectTypeOf(flattened).toEqualTypeOf<Err<number, string | boolean>>();
		});

		it("returns explicit Pending when called on explicit Ok wrapping explicit Pending", () => {
			const result = new Ok<Pending<number, boolean>, string>(
				new Pending(Promise.resolve(new Ok(42))),
			);

			const flattened = result.flatten();

			expect(flattened.isPending()).toBeTrue();
			expect(flattened.unwrap()).resolves.toBe(42);
			expectTypeOf(flattened).toEqualTypeOf<Pending<number, string | boolean>>();
		});

		it("returns explicit Err when called on explicit Err", () => {
			const result = new Err<Result<number, boolean>, string>("failed");

			const flattened = result.flatten();

			expect(flattened.isErr()).toBeTrue();
			expect(flattened.unwrapErr()).toBe("failed");
			expectTypeOf(flattened).toEqualTypeOf<Err<number, string>>();
		});

		it("returns explicit Pending when called on explicit Pending", () => {
			const result = new Pending<Result<number, boolean>, string>(
				Promise.resolve(new Ok(new Ok(42))),
			);

			const flattened = result.flatten();

			expect(flattened.isPending()).toBeTrue();
			expect(flattened.unwrap()).resolves.toBe(42);
			expectTypeOf(flattened).toEqualTypeOf<Pending<number, string | boolean>>();
		});

		it("flattens nested Result when source is Ok and inner is Ok", () => {
			const result = ok<Result<number, boolean>, string>(ok(42));

			const flattened = result.flatten();

			expect(flattened.isOk()).toBeTrue();
			expect(flattened.unwrap()).toBe(42);
			expectTypeOf(flattened).toEqualTypeOf<Result<number, string | boolean>>();
		});

		it("flattens nested Result when source is Ok and inner is Err", () => {
			const result = ok<Result<number, boolean>, string>(err(false));

			const flattened = result.flatten();

			expect(flattened.isErr()).toBeTrue();
			expect(flattened.unwrapErr()).toBeFalse();
			expectTypeOf(flattened).toEqualTypeOf<Result<number, string | boolean>>();
		});

		it("flattens nested Result when source is Ok and inner is Pending", () => {
			const result = ok<Result<number, boolean>, string>(
				new Pending<number, boolean>(Promise.resolve(new Ok(42))),
			);

			const flattened = result.flatten();

			expect(flattened.isPending()).toBeTrue();
			expect(flattened.unwrap()).resolves.toBe(42);
			expectTypeOf(flattened).toEqualTypeOf<Result<number, string | boolean>>();
		});

		it("returns the outer Ok when source value is a union branch that is not a Result", () => {
			const result = ok<Result<number, boolean> | number, string>(42);

			const flattened = result.flatten();

			expect(flattened as unknown).toBe(result);
			expect(flattened.isOk()).toBeTrue();
			expect(flattened.unwrap()).toBe(42);
			expectTypeOf(flattened).toEqualTypeOf<Result<number, string | boolean>>();
		});

		it("returns outer Err when source is Err", () => {
			const result = err<Result<number, boolean>, string>("failed");

			const flattened = result.flatten();

			expect(flattened.isErr()).toBeTrue();
			expect(flattened.unwrapErr()).toBe("failed");
			expectTypeOf(flattened).toExtend<Result<number, string | boolean>>();
		});

		it("flattens nested Result when Pending resolves to outer Ok and inner Ok", () => {
			const result = pending<Result<number, boolean>, string>(ok(ok(42)));

			const flattened = result.flatten();

			expect(flattened.isPending()).toBeTrue();
			expect(flattened.unwrap()).resolves.toBe(42);
			expectTypeOf(flattened).toExtend<Result<number, string | boolean>>();
		});

		it("flattens nested Result when Pending resolves to outer Ok and inner Err", () => {
			const result = pending<Result<number, boolean>, string>(ok(err(false)));

			const flattened = result.flatten();

			expect(flattened.isPending()).toBeTrue();
			expect(flattened.unwrapErr()).resolves.toBeFalse();
			expectTypeOf(flattened).toExtend<Result<number, string | boolean>>();
		});

		it("returns outer Err when Pending resolves to outer Err", () => {
			const result = pending<Result<number, boolean>, string>(err("failed"));

			const flattened = result.flatten();

			expect(flattened.isPending()).toBeTrue();
			expect(flattened.unwrapErr()).resolves.toBe("failed");
			expectTypeOf(flattened).toExtend<Result<number, string | boolean>>();
		});
	});

	describe("and", () => {
		it("returns Ok when called on explicit Ok with explicit Ok", () => {
			const result = new Ok<number, string>(42);

			const mapped = result.and(new Ok("done"));

			expect(mapped.isOk()).toBeTrue();
			expect(mapped.unwrap()).toBe("done");
			expectTypeOf(mapped).toEqualTypeOf<Ok<string, string>>();
		});

		it("returns Err when called on explicit Ok with explicit Err", () => {
			const result = new Ok<number, string>(42);

			const mapped = result.and(new Err<string, number>(10));

			expect(mapped.isErr()).toBeTrue();
			expect(mapped.unwrapErr()).toBe(10);
			expectTypeOf(mapped).toEqualTypeOf<Err<string, string | number>>();
		});

		it("returns Pending when called on explicit Ok with explicit Pending", () => {
			const result = new Ok<number, string>(42);

			const mapped = result.and(new Pending(Promise.resolve(new Ok("done"))));

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe("done");
			expectTypeOf(mapped).toEqualTypeOf<Pending<string, string>>();
		});

		it("returns Err when called on explicit Err", () => {
			const result = new Err<number, string>("failed");

			const mapped = result.and(new Ok("done"));

			expect(mapped.isErr()).toBeTrue();
			expect(mapped.unwrapErr()).toBe("failed");
			expectTypeOf(mapped).toEqualTypeOf<Err<string, string>>();
		});

		it("returns next result when source is Ok", () => {
			const result = ok<number, string>(42);
			const next = ok<string, boolean>("done");

			const mapped = result.and(next);

			expect(mapped.isOk()).toBeTrue();
			expect(mapped.unwrap()).toBe("done");
			expectTypeOf(mapped).toExtend<Result<string, string | boolean>>();
			expectTypeOf(mapped).toEqualTypeOf<Err<string, string> | Result<string, string | boolean>>();
		});

		it("returns source Err when source is Err", () => {
			const result = err<number, string>("failed");
			const next = ok<string, boolean>("done");

			const mapped = result.and(next);

			expect(mapped.isErr()).toBeTrue();
			expect(mapped.unwrapErr()).toBe("failed");
			expectTypeOf(mapped).toExtend<Result<string, string | boolean>>();
			expectTypeOf(mapped).toEqualTypeOf<Err<string, string> | Result<string, string | boolean>>();
		});

		it("returns next result when Pending resolves to Ok", () => {
			const result = pending<number, string>(ok(42));
			const next = ok<string, boolean>("done");

			const mapped = result.and(next);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe("done");
			expectTypeOf(mapped).toExtend<Result<string, string | boolean>>();
			expectTypeOf(mapped).toEqualTypeOf<Err<string, string> | Result<string, string | boolean>>();
		});

		it("returns source Err when Pending resolves to Err", () => {
			const result = pending<number, string>(err("failed"));
			const next = ok<string, boolean>("done");

			const mapped = result.and(next);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrapErr()).resolves.toBe("failed");
			expectTypeOf(mapped).toExtend<Result<string, string | boolean>>();
			expectTypeOf(mapped).toEqualTypeOf<Err<string, string> | Result<string, string | boolean>>();
		});
	});

	describe("or", () => {
		it("returns Ok when called on explicit Ok", () => {
			const result = new Ok<number, string>(42);

			const mapped = result.or(new Ok<number, boolean>(0));

			expect(mapped.isOk()).toBeTrue();
			expect(mapped.unwrap()).toBe(42);
			expectTypeOf(mapped).toEqualTypeOf<Ok<number, string>>();
		});

		it("returns explicit Ok when called on explicit Err with explicit Ok", () => {
			const result = new Err<number, string>("failed");

			const mapped = result.or(new Ok<number, boolean>(42));

			expect(mapped.isOk()).toBeTrue();
			expect(mapped.unwrap()).toBe(42);
			expectTypeOf(mapped).toEqualTypeOf<Ok<number, boolean>>();
		});

		it("returns explicit Err when called on explicit Err with explicit Err", () => {
			const result = new Err<number, string>("failed");

			const mapped = result.or(new Err<number, boolean>(false));

			expect(mapped.isErr()).toBeTrue();
			expect(mapped.unwrapErr()).toBeFalse();
			expectTypeOf(mapped).toEqualTypeOf<Err<number, boolean>>();
		});

		it("returns explicit Pending when called on explicit Err with explicit Pending", () => {
			const result = new Err<number, string>("failed");

			const mapped = result.or(new Pending<number, boolean>(Promise.resolve(new Ok(42))));

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe(42);
			expectTypeOf(mapped).toEqualTypeOf<Pending<number, boolean>>();
		});

		it("returns source Ok when source is Ok", () => {
			const result = ok<number, string>(42);
			const fallback = ok<number, boolean>(0);

			const mapped = result.or(fallback);

			expect(mapped.isOk()).toBeTrue();
			expect(mapped.unwrap()).toBe(42);
			expectTypeOf(mapped).toExtend<Result<number, string | boolean>>();
			expectTypeOf(mapped).toEqualTypeOf<
				Ok<number, string> | Pending<number, string | boolean> | Result<number, boolean>
			>();
		});

		it("returns fallback when source is Err", () => {
			const result = err<number, string>("failed");
			const fallback = ok<number, boolean>(42);

			const mapped = result.or(fallback);

			expect(mapped.isOk()).toBeTrue();
			expect(mapped.unwrap()).toBe(42);
			expectTypeOf(mapped).toExtend<Result<number, string | boolean>>();
			expectTypeOf(mapped).toEqualTypeOf<
				Ok<number, string> | Pending<number, string | boolean> | Result<number, boolean>
			>();
		});

		it("returns source Ok when Pending resolves to Ok", () => {
			const result = pending<number, string>(ok(42));
			const fallback = ok<number, boolean>(0);

			const mapped = result.or(fallback);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe(42);
			expectTypeOf(mapped).toExtend<Result<number, string | boolean>>();
			expectTypeOf(mapped).toEqualTypeOf<
				Ok<number, string> | Pending<number, string | boolean> | Result<number, boolean>
			>();
		});

		it("returns fallback when Pending resolves to Err", () => {
			const result = pending<number, string>(err("failed"));
			const fallback = ok<number, boolean>(42);

			const mapped = result.or(fallback);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe(42);
			expectTypeOf(mapped).toExtend<Result<number, string | boolean>>();
			expectTypeOf(mapped).toEqualTypeOf<
				Ok<number, string> | Pending<number, string | boolean> | Result<number, boolean>
			>();
		});
	});

	describe("orElse", () => {
		it("returns Ok when called on explicit Ok", () => {
			const result = new Ok<number, string>(42);

			const mapped = result.orElse((e) => new Err(e.length));

			expect(mapped.isOk()).toBeTrue();
			expect(mapped.unwrap()).toBe(42);
			expectTypeOf(mapped).toEqualTypeOf<Ok<number, number>>();
		});

		it("returns Ok when called on explicit Err and callback returns Ok", () => {
			const result = new Err<number, string>("failed");

			const mapped = result.orElse((e) => new Ok<number, number>(e.length));

			expect(mapped.isOk()).toBeTrue();
			expect(mapped.unwrap()).toBe("failed".length);
			expectTypeOf(mapped).toEqualTypeOf<Ok<number, number>>();
		});

		it("returns Err when called on explicit Err and callback returns Err", () => {
			const result = new Err<number, string>("failed");

			const mapped = result.orElse((e) => new Err<number, number>(e.length));

			expect(mapped.isErr()).toBeTrue();
			expect(mapped.unwrapErr()).toBe("failed".length);
			expectTypeOf(mapped).toEqualTypeOf<Err<number, number>>();
		});

		it("returns Pending when called on explicit Err and callback returns Pending", () => {
			const result = new Err<number, string>("failed");

			const mapped = result.orElse((e) => new Pending(Promise.resolve(new Ok(e.length))));

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe("failed".length);
			expectTypeOf(mapped).toEqualTypeOf<Pending<number, never>>();
		});

		it("doesn't transform Ok", () => {
			const result = ok<number, string>(42);
			const mapper = mock((e: string) => ok<number, boolean>(e.length));

			const mapped = result.orElse(mapper);

			expect(mapped.isOk()).toBeTrue();
			expect(mapped.unwrap()).toBe(42);
			expectTypeOf(mapped).toEqualTypeOf<Result<number, boolean>>();

			expect(mapper).not.toHaveBeenCalled();
		});

		it("transforms Err", () => {
			const result = err<number, string>("failed");
			const mapper = mock((e: string) => ok<number, boolean>(e.length));

			const mapped = result.orElse(mapper);

			expect(mapped.isOk()).toBeTrue();
			expect(mapped.unwrap()).toBe("failed".length);
			expectTypeOf(mapped).toEqualTypeOf<Result<number, boolean>>();

			expect(mapper).toHaveBeenCalledTimes(1);
			expect(mapper).toHaveBeenCalledWith("failed");
			expect(mapper).toHaveReturnedWith(ok<number, boolean>("failed".length));
		});

		it("doesn't transform Pending when it resolves to Ok", () => {
			const result = pending<number, string>(ok(42));
			const mapper = mock((e: string) => ok<number, boolean>(e.length));

			const mapped = result.orElse(mapper);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe(42);
			expectTypeOf(mapped).toEqualTypeOf<Result<number, boolean>>();

			expect(mapper).not.toHaveBeenCalled();
		});

		it("transforms Pending when it resolves to Err", () => {
			const result = pending<number, string>(err("failed"));
			const mapper = mock((e: string) => ok<number, boolean>(e.length));

			const mapped = result.orElse(mapper);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe("failed".length);
			expectTypeOf(mapped).toEqualTypeOf<Result<number, boolean>>();

			expect(mapper).toHaveBeenCalledTimes(1);
			expect(mapper).toHaveBeenCalledWith("failed");
			expect(mapper).toHaveReturnedWith(ok<number, boolean>("failed".length));
		});
	});

	describe("settle", () => {
		it("returns PromiseLike<Ok> when called on explicit Ok", () => {
			const result = new Ok<number, string>(42);

			const settled = result.settle();

			expect(settled).resolves.toBe(result);
			expectTypeOf(settled).toEqualTypeOf<PromiseLike<Ok<number, string>>>();
		});

		it("returns PromiseLike<Err> when called on explicit Err", () => {
			const result = new Err<number, string>("failed");

			const settled = result.settle();

			expect(settled).resolves.toBe(result);
			expectTypeOf(settled).toEqualTypeOf<PromiseLike<Err<number, string>>>();
		});

		it("returns PromiseLike<Settled> when called on explicit Pending", () => {
			const result = new Pending<number, string>(Promise.resolve(new Ok(42)));

			const settled = result.settle();

			expect(settled).resolves.toEqual(new Ok(42));
			expectTypeOf(settled).toEqualTypeOf<PromiseLike<Settled<number, string>>>();
		});

		it("settles Result when source is Ok", () => {
			const result = ok<number, string>(42);

			const settled = result.settle();

			expect(settled).resolves.toEqual(new Ok(42));
			expectTypeOf(settled).toEqualTypeOf<PromiseLike<Settled<number, string>>>();
		});

		it("settles Result when source is Err", () => {
			const result = err<number, string>("failed");

			const settled = result.settle();

			expect(settled).resolves.toEqual(new Err("failed"));
			expectTypeOf(settled).toEqualTypeOf<PromiseLike<Settled<number, string>>>();
		});

		it("settles Result when source is Pending", () => {
			const result = pending<number, string>(ok(42));

			const settled = result.settle();

			expect(settled).resolves.toEqual(new Ok(42));
			expectTypeOf(settled).toEqualTypeOf<PromiseLike<Settled<number, string>>>();
		});
	});

	describe("unwrap", () => {
		it("returns value when called on explicit Ok", () => {
			const result = new Ok<number, string>(42);

			const unwrapped = result.unwrap();

			expect(unwrapped).toBe(42);
			expectTypeOf(unwrapped).toEqualTypeOf<number>();
		});

		it("throws UnwrapError when called on explicit Err", () => {
			const result = new Err<number, string>("failed");

			expect(() => result.unwrap()).toThrow("Called unwrap() on an Err value");
			expect(() => result.unwrap()).toThrow(UnwrapError);
		});

		it("returns PromiseLike when called on explicit Pending", () => {
			const result = new Pending<number, string>(Promise.resolve(new Ok(42)));

			const unwrapped = result.unwrap();

			expect(unwrapped).resolves.toBe(42);
			expectTypeOf(unwrapped).toEqualTypeOf<PromiseLike<number>>();
		});

		it("unwraps Result when source is Ok", () => {
			const result = ok<number, string>(42);

			const unwrapped = result.unwrap();

			expect(unwrapped).toBe(42);
			expectTypeOf(unwrapped).toEqualTypeOf<number | PromiseLike<number>>();
		});

		it("throws UnwrapError when source is Err", () => {
			const result = err<number, string>("failed");

			expect(() => result.unwrap()).toThrow("Called unwrap() on an Err value");
			expect(() => result.unwrap()).toThrow(UnwrapError);
		});

		it("unwraps Result when source is Pending", () => {
			const result = pending<number, string>(ok(42));

			const unwrapped = result.unwrap();

			expect(unwrapped).resolves.toBe(42);
			expectTypeOf(unwrapped).toEqualTypeOf<number | PromiseLike<number>>();
		});

		it("rejects when Pending resolves to Err", () => {
			const result = pending<number, string>(err("failed"));

			expect(result.unwrap()).rejects.toBeInstanceOf(UnwrapError);
			expect(result.unwrap()).rejects.toThrow("Called unwrap() on an Err value");
		});
	});

	describe("unwrapErr", () => {
		it("throws UnwrapError when called on explicit Ok", () => {
			const result = new Ok<number, string>(42);

			expect(() => result.unwrapErr()).toThrow("Called unwrapErr() on an Ok value");
			expect(() => result.unwrapErr()).toThrow(UnwrapError);
		});

		it("returns error when called on explicit Err", () => {
			const result = new Err<number, string>("failed");

			const unwrapped = result.unwrapErr();

			expect(unwrapped).toBe("failed");
			expectTypeOf(unwrapped).toEqualTypeOf<string>();
		});

		it("returns PromiseLike when called on explicit Pending", () => {
			const result = new Pending<number, string>(Promise.resolve(new Err("failed")));

			const unwrapped = result.unwrapErr();

			expect(unwrapped).resolves.toBe("failed");
			expectTypeOf(unwrapped).toEqualTypeOf<PromiseLike<string>>();
		});

		it("throws UnwrapError when source is Ok", () => {
			const result = ok<number, string>(42);

			expect(() => result.unwrapErr()).toThrow("Called unwrapErr() on an Ok value");
			expect(() => result.unwrapErr()).toThrow(UnwrapError);
		});

		it("unwraps Result when source is Err", () => {
			const result = err<number, string>("failed");

			const unwrapped = result.unwrapErr();

			expect(unwrapped).toBe("failed");
			expectTypeOf(unwrapped).toEqualTypeOf<string | PromiseLike<string>>();
		});

		it("unwraps Result when source is Pending", () => {
			const result = pending<number, string>(err("failed"));

			const unwrapped = result.unwrapErr();

			expect(unwrapped).resolves.toBe("failed");
			expectTypeOf(unwrapped).toEqualTypeOf<string | PromiseLike<string>>();
		});

		it("rejects when Pending resolves to Ok", () => {
			const result = pending<number, string>(ok(42));

			expect(result.unwrapErr()).rejects.toBeInstanceOf(UnwrapError);
			expect(result.unwrapErr()).rejects.toThrow("Called unwrapErr() on an Ok value");
		});
	});

	describe("unwrapOr", () => {
		it("returns value when called on explicit Ok", () => {
			const result = new Ok<number, string>(42);

			const unwrapped = result.unwrapOr(0);

			expect(unwrapped).toBe(42);
			expectTypeOf(unwrapped).toEqualTypeOf<number>();
		});

		it("returns default when called on explicit Err", () => {
			const result = new Err<number, string>("failed");

			const unwrapped = result.unwrapOr(0);

			expect(unwrapped).toBe(0);
			expectTypeOf(unwrapped).toEqualTypeOf<number>();
		});

		it("returns PromiseLike when called on explicit Pending", () => {
			const result = new Pending<number, string>(Promise.resolve(new Ok(42)));

			const unwrapped = result.unwrapOr(0);

			expect(unwrapped).resolves.toBe(42);
			expectTypeOf(unwrapped).toEqualTypeOf<PromiseLike<number>>();
		});

		it("unwraps Result when source is Ok", () => {
			const result = ok<number, string>(42);

			const unwrapped = result.unwrapOr(0);

			expect(unwrapped).toBe(42);
			expectTypeOf(unwrapped).toEqualTypeOf<number | PromiseLike<number>>();
		});

		it("returns default when source is Err", () => {
			const result = err<number, string>("failed");

			const unwrapped = result.unwrapOr(0);

			expect(unwrapped).toBe(0);
			expectTypeOf(unwrapped).toEqualTypeOf<number | PromiseLike<number>>();
		});

		it("unwraps Result when source is Pending and resolves to Ok", () => {
			const result = pending<number, string>(ok(42));

			const unwrapped = result.unwrapOr(0);

			expect(unwrapped).resolves.toBe(42);
			expectTypeOf(unwrapped).toEqualTypeOf<number | PromiseLike<number>>();
		});

		it("returns default when source is Pending and resolves to Err", () => {
			const result = pending<number, string>(err("failed"));

			const unwrapped = result.unwrapOr(0);

			expect(unwrapped).resolves.toBe(0);
			expectTypeOf(unwrapped).toEqualTypeOf<number | PromiseLike<number>>();
		});
	});

	describe("unwrapOrElse", () => {
		it("returns value when called on explicit Ok", () => {
			const result = new Ok<number, string>(42);
			const fallback = mock((e: string) => e.length);

			const unwrapped = result.unwrapOrElse(fallback);

			expect(unwrapped).toBe(42);
			expectTypeOf(unwrapped).toEqualTypeOf<number>();
			expect(fallback).not.toHaveBeenCalled();
		});

		it("returns fallback when called on explicit Err with sync fallback", () => {
			const result = new Err<number, string>("failed");
			const fallback = mock((e: string) => e.length);

			const unwrapped = result.unwrapOrElse(fallback);

			expect(unwrapped).toBe("failed".length);
			expectTypeOf(unwrapped).toEqualTypeOf<number>();
			expect(fallback).toHaveBeenCalledTimes(1);
			expect(fallback).toHaveBeenCalledWith("failed");
			expect(fallback).toHaveReturnedWith("failed".length);
		});

		it("returns PromiseLike when called on explicit Err with async fallback", () => {
			const result = new Err<number, string>("failed");
			const fallback = mock(async (e: string) => e.length);

			const unwrapped = result.unwrapOrElse(fallback);

			expect(unwrapped).resolves.toBe("failed".length);
			expectTypeOf(unwrapped).toEqualTypeOf<PromiseLike<number>>();
			expect(fallback).toHaveBeenCalledTimes(1);
			expect(fallback).toHaveBeenCalledWith("failed");
			expect(fallback).toHaveReturnedWith(Promise.resolve("failed".length));
		});

		it("returns PromiseLike when called on explicit Pending", () => {
			const result = new Pending<number, string>(Promise.resolve(new Ok(42)));
			const fallback = mock((e: string) => e.length);

			const unwrapped = result.unwrapOrElse(fallback);

			expect(unwrapped).resolves.toBe(42);
			expectTypeOf(unwrapped).toEqualTypeOf<PromiseLike<number>>();
			expect(fallback).not.toHaveBeenCalled();
		});

		it("unwraps Result when source is Ok", () => {
			const result = ok<number, string>(42);
			const fallback = mock((e: string) => e.length);

			const unwrapped = result.unwrapOrElse(fallback);

			expect(unwrapped).toBe(42);
			expectTypeOf(unwrapped).toEqualTypeOf<number | PromiseLike<number>>();
			expect(fallback).not.toHaveBeenCalled();
		});

		it("unwraps Result when source is Err", () => {
			const result = err<number, string>("failed");
			const fallback = mock((e: string) => e.length);

			const unwrapped = result.unwrapOrElse(fallback);

			expect(unwrapped).toBe("failed".length);
			expectTypeOf(unwrapped).toEqualTypeOf<number | PromiseLike<number>>();
			expect(fallback).toHaveBeenCalledTimes(1);
			expect(fallback).toHaveBeenCalledWith("failed");
			expect(fallback).toHaveReturnedWith("failed".length);
		});

		it("unwraps Result when source is Pending and resolves to Ok", () => {
			const result = pending<number, string>(ok(42));
			const fallback = mock((e: string) => e.length);

			const unwrapped = result.unwrapOrElse(fallback);

			expect(unwrapped).resolves.toBe(42);
			expectTypeOf(unwrapped).toEqualTypeOf<number | PromiseLike<number>>();
			expect(fallback).not.toHaveBeenCalled();
		});

		it("unwraps Result when source is Pending and resolves to Err", () => {
			const result = pending<number, string>(err("failed"));
			const fallback = mock((e: string) => e.length);

			const unwrapped = result.unwrapOrElse(fallback);

			expect(unwrapped).resolves.toBe("failed".length);
			expectTypeOf(unwrapped).toEqualTypeOf<number | PromiseLike<number>>();
			expect(fallback).toHaveBeenCalledTimes(1);
			expect(fallback).toHaveBeenCalledWith("failed");
			expect(fallback).toHaveReturnedWith("failed".length);
		});

		it("unwraps Result with async fallback when source is Err", () => {
			const result = err<number, string>("failed");
			const fallback = mock(async (e: string) => e.length);

			const unwrapped = result.unwrapOrElse(fallback);

			expect(unwrapped).resolves.toBe("failed".length);
			expectTypeOf(unwrapped).toEqualTypeOf<number | PromiseLike<number>>();
			expect(fallback).toHaveBeenCalledTimes(1);
			expect(fallback).toHaveBeenCalledWith("failed");
			expect(fallback).toHaveReturnedWith(Promise.resolve("failed".length));
		});
	});

	describe("Result.try", () => {
		it("returns Ok when callback returns a sync value", () => {
			const result = Result.try<number, string>(() => 42);

			expect(result.isOk()).toBeTrue();
			expect(result.unwrap()).toBe(42);
			expectTypeOf(result).toEqualTypeOf<Settled<number, string>>();
		});

		it("returns Err when callback throws synchronously", () => {
			const result = Result.try<number, string>((): number => {
				throw "failed";
			});

			expect(result.isErr()).toBeTrue();
			expect(result.unwrapErr()).toBe("failed");
			expectTypeOf(result).toEqualTypeOf<Settled<number, string>>();
		});

		it("returns Pending when callback returns a PromiseLike", () => {
			const result = Result.try<number, string>(async () => 42);

			expect(result.isPending()).toBeTrue();
			expect(result.unwrap()).resolves.toBe(42);
			expectTypeOf(result).toEqualTypeOf<Pending<number, string>>();
		});

		it("returns Pending wrapping Err when callback returns a rejected PromiseLike", () => {
			const result = Result.try<number, string>(async () => {
				throw "failed";
			});

			expect(result.isPending()).toBeTrue();
			expect(result.unwrapErr()).resolves.toBe("failed");
			expectTypeOf(result).toEqualTypeOf<Pending<number, string>>();
		});

		it("calls callback exactly once", () => {
			const callback = mock(() => 42);

			const result = Result.try<number, string>(callback);

			expect(result.isOk()).toBeTrue();
			expect(callback).toHaveBeenCalledTimes(1);
			expect(callback).toHaveReturnedWith(42);
		});
	});

	describe("Result.fromPromise", () => {
		it("returns Pending", () => {
			const result = Result.fromPromise<number, string>(Promise.resolve(42));

			expect(result.isPending()).toBeTrue();
			expectTypeOf(result).toEqualTypeOf<Pending<number, string>>();
		});

		it("resolves to Ok when promise fulfills", () => {
			const result = Result.fromPromise<number, string>(Promise.resolve(42));

			expect(result.unwrap()).resolves.toBe(42);
			expect(result.settle()).resolves.toEqual(new Ok(42));
		});

		it("resolves to Err when promise rejects", () => {
			const result = Result.fromPromise<number, string>(Promise.reject("failed"));

			expect(result.unwrapErr()).resolves.toBe("failed");
			expect(result.settle()).resolves.toEqual(new Err("failed"));
		});

		it("accepts PromiseLike values", () => {
			const promiseLike: PromiseLike<number> = Promise.resolve(42);

			const result = Result.fromPromise<number, string>(promiseLike);

			expect(result.isPending()).toBeTrue();
			expect(result.unwrap()).resolves.toBe(42);
			expectTypeOf(result).toEqualTypeOf<Pending<number, string>>();
		});
	});
});
