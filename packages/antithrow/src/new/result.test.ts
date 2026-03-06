import { describe, expect, expectTypeOf, it, mock } from "bun:test";
import { Err } from "./err.js";
import { UnwrapError } from "./errors.js";
import { Ok } from "./ok.js";
import { Pending } from "./pending.js";
import { Result } from "./result.js";
import type { Settled } from "./types.js";

const ok = <T, E>(v: T): Result<T, E> => new Ok(v);
const err = <T, E>(e: E): Result<T, E> => new Err(e);
const pending = <T, E>(r: Result<T, E>): Result<T, E> => new Pending(Promise.resolve(r));

describe("Result", () => {
	describe("map", () => {
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
			expect(mapper).toHaveReturnedWith(Promise.resolve("failed".length));
		});
	});

	describe("mapOr", () => {
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
		it("transforms the value of Ok", () => {
			const result = ok<number, string>(42);
			const mapper = mock((v: number) => ok<string, number>(v.toString()));

			const mapped = result.andThen(mapper);

			expect(mapped.isOk()).toBeTrue();
			expect(mapped.unwrap()).toBe("42");
			expectTypeOf(mapped).toExtend<Result<string, string | number>>();
			expectTypeOf(mapped).toEqualTypeOf<
				Err<string, string> | Pending<string, string | number> | Result<string, number>
			>();

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
			expectTypeOf(mapped).toEqualTypeOf<
				Err<string, string> | Pending<string, string | number> | Result<string, number>
			>();

			expect(mapper).not.toHaveBeenCalled();
		});

		it("transforms the value of Pending when it resolves to Ok", () => {
			const result = pending<number, string>(ok(42));
			const mapper = mock((v: number) => ok<string, number>(v.toString()));

			const mapped = result.andThen(mapper);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe("42");
			expectTypeOf(mapped).toExtend<Result<string, string | number>>();
			expectTypeOf(mapped).toEqualTypeOf<
				Err<string, string> | Pending<string, string | number> | Result<string, number>
			>();

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
			expectTypeOf(mapped).toEqualTypeOf<
				Err<string, string> | Pending<string, string | number> | Result<string, number>
			>();

			expect(mapper).not.toHaveBeenCalled();
		});
	});

	describe("flatten", () => {
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
		it("returns next result when source is Ok", () => {
			const result = ok<number, string>(42);
			const next = ok<string, boolean>("done");

			const mapped = result.and(next);

			expect(mapped.isOk()).toBeTrue();
			expect(mapped.unwrap()).toBe("done");
			expectTypeOf(mapped).toExtend<Result<string, string | boolean>>();
			expectTypeOf(mapped).toEqualTypeOf<
				Err<string, string> | Pending<string, string | boolean> | Result<string, boolean>
			>();
		});

		it("returns source Err when source is Err", () => {
			const result = err<number, string>("failed");
			const next = ok<string, boolean>("done");

			const mapped = result.and(next);

			expect(mapped.isErr()).toBeTrue();
			expect(mapped.unwrapErr()).toBe("failed");
			expectTypeOf(mapped).toExtend<Result<string, string | boolean>>();
			expectTypeOf(mapped).toEqualTypeOf<
				Err<string, string> | Pending<string, string | boolean> | Result<string, boolean>
			>();
		});

		it("returns next result when Pending resolves to Ok", () => {
			const result = pending<number, string>(ok(42));
			const next = ok<string, boolean>("done");

			const mapped = result.and(next);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe("done");
			expectTypeOf(mapped).toExtend<Result<string, string | boolean>>();
			expectTypeOf(mapped).toEqualTypeOf<
				Err<string, string> | Pending<string, string | boolean> | Result<string, boolean>
			>();
		});

		it("returns source Err when Pending resolves to Err", () => {
			const result = pending<number, string>(err("failed"));
			const next = ok<string, boolean>("done");

			const mapped = result.and(next);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrapErr()).resolves.toBe("failed");
			expectTypeOf(mapped).toExtend<Result<string, string | boolean>>();
			expectTypeOf(mapped).toEqualTypeOf<
				Err<string, string> | Pending<string, string | boolean> | Result<string, boolean>
			>();
		});
	});

	describe("or", () => {
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

	describe("try", () => {
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

	describe("fromPromise", () => {
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
