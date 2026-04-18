import { describe, expect, expectTypeOf, it, mock } from "bun:test";
import { Err } from "./err.js";
import { UnwrapError } from "./errors.js";
import { Ok } from "./ok.js";
import { Pending } from "./pending.js";
import type { Settled } from "./types.js";

describe("Pending", () => {
	describe("state", () => {
		it("reports the correct state and narrows to Pending", () => {
			const result = new Pending<number, string>(Promise.resolve(new Ok(42)));

			expect(result.isOk()).toBeFalse();
			expect(result.isErr()).toBeFalse();
			expect(result.isPending()).toBeTrue();
			expectTypeOf(result).toEqualTypeOf<Pending<number, string>>();
			expectTypeOf(result.promise).resolves.toEqualTypeOf<Settled<number, string>>();
		});
	});

	describe("then", () => {
		it("returns PromiseLike", () => {
			const result = new Pending<number, string>(Promise.resolve(new Ok(42)));

			const chained = result.then((settled) => settled.unwrap());

			expect(chained).resolves.toBe(42);
			expectTypeOf(chained).toEqualTypeOf<PromiseLike<number>>();
		});

		it("calls onfulfilled with settled Ok", () => {
			const result = new Pending<number, string>(Promise.resolve(new Ok(42)));
			const onfulfilled = mock((settled: Settled<number, string>) => settled.unwrap().toString());

			const chained = result.then(onfulfilled);

			expect(chained).resolves.toBe("42");
			expectTypeOf(chained).toEqualTypeOf<PromiseLike<string>>();
			expect(onfulfilled).toHaveBeenCalledTimes(1);
			expect(onfulfilled).toHaveBeenCalledWith(new Ok(42));
			expect(onfulfilled).toHaveReturnedWith("42");
		});

		it("calls onfulfilled with settled Err", () => {
			const result = new Pending<number, string>(Promise.resolve(new Err("failed")));
			const onfulfilled = mock((settled: Settled<number, string>) => settled.unwrapErr().length);

			const chained = result.then(onfulfilled);

			expect(chained).resolves.toBe("failed".length);
			expectTypeOf(chained).toEqualTypeOf<PromiseLike<number>>();
			expect(onfulfilled).toHaveBeenCalledTimes(1);
			expect(onfulfilled).toHaveBeenCalledWith(new Err("failed"));
			expect(onfulfilled).toHaveReturnedWith("failed".length);
		});

		it("calls onrejected when the underlying promise rejects", () => {
			const reason = new Error("boom");
			const result = new Pending<number, string>(Promise.reject(reason));
			const onfulfilled = mock((settled: Settled<number, string>) => settled.unwrap());
			const onrejected = mock((error: unknown) => String(error));

			const chained = result.then(onfulfilled, onrejected);

			expect(chained).resolves.toBe(reason.toString());
			expectTypeOf(chained).toEqualTypeOf<PromiseLike<number | string>>();
			expect(onfulfilled).not.toHaveBeenCalled();
			expect(onrejected).toHaveBeenCalledTimes(1);
			expect(onrejected).toHaveBeenCalledWith(reason);
			expect(onrejected).toHaveReturnedWith(reason.toString());
		});

		it("returns PromiseLike with a union-returning onfulfilled", () => {
			const result = new Pending<number, string>(Promise.resolve(new Ok(42)));
			const onfulfilled = (settled: Settled<number, string>): number | Promise<number> =>
				settled.unwrap();

			const chained = result.then(onfulfilled);

			expect(chained).resolves.toBe(42);
			expectTypeOf(chained).toEqualTypeOf<PromiseLike<number>>();
		});
	});

	describe("map", () => {
		it("returns Pending with a sync mapper when settled as Ok", () => {
			const result = new Pending<number, string>(Promise.resolve(new Ok(42)));
			const mapper = mock((value: number) => value.toString());

			const mapped = result.map(mapper);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<Pending<string, string>>();
			expect(mapper).toHaveBeenCalledTimes(1);
			expect(mapper).toHaveBeenCalledWith(42);
			expect(mapper).toHaveReturnedWith("42");
		});

		it("returns Pending and skips mapper when settled as Err", () => {
			const result = new Pending<number, string>(Promise.resolve(new Err("failed")));
			const mapper = mock((value: number) => value.toString());

			const mapped = result.map(mapper);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrapErr()).resolves.toBe("failed");
			expectTypeOf(mapped).toEqualTypeOf<Pending<string, string>>();
			expect(mapper).not.toHaveBeenCalled();
		});

		it("returns Pending with an async mapper when settled as Ok", () => {
			const result = new Pending<number, string>(Promise.resolve(new Ok(42)));
			const mapper = mock(async (value: number) => value.toString());

			const mapped = result.map(mapper);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<Pending<string, string>>();
			expect(mapper).toHaveBeenCalledTimes(1);
			expect(mapper).toHaveBeenCalledWith(42);
			expect(mapper).toHaveReturnedWith(Promise.resolve("42"));
		});

		it("returns Pending and skips async mapper when settled as Err", () => {
			const result = new Pending<number, string>(Promise.resolve(new Err("failed")));
			const mapper = mock(async (value: number) => value.toString());

			const mapped = result.map(mapper);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrapErr()).resolves.toBe("failed");
			expectTypeOf(mapped).toEqualTypeOf<Pending<string, string>>();
			expect(mapper).not.toHaveBeenCalled();
		});

		it("returns Pending with a union-returning mapper", () => {
			const result = new Pending<number, string>(Promise.resolve(new Ok(42)));
			const mapper = (value: number): string | Promise<string> => value.toString();

			const mapped = result.map(mapper);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<Pending<string, string>>();
		});
	});

	describe("mapErr", () => {
		it("returns Pending with a sync mapper when settled as Err", () => {
			const result = new Pending<number, string>(Promise.resolve(new Err("failed")));
			const mapper = mock((error: string) => error.length);

			const mapped = result.mapErr(mapper);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrapErr()).resolves.toBe("failed".length);
			expectTypeOf(mapped).toEqualTypeOf<Pending<number, number>>();
			expect(mapper).toHaveBeenCalledTimes(1);
			expect(mapper).toHaveBeenCalledWith("failed");
			expect(mapper).toHaveReturnedWith("failed".length);
		});

		it("returns Pending and skips mapper when settled as Ok", () => {
			const result = new Pending<number, string>(Promise.resolve(new Ok(42)));
			const mapper = mock((error: string) => error.length);

			const mapped = result.mapErr(mapper);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe(42);
			expectTypeOf(mapped).toEqualTypeOf<Pending<number, number>>();
			expect(mapper).not.toHaveBeenCalled();
		});

		it("returns Pending with an async mapper when settled as Err", () => {
			const result = new Pending<number, string>(Promise.resolve(new Err("failed")));
			const mapper = mock(async (error: string) => error.length);

			const mapped = result.mapErr(mapper);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrapErr()).resolves.toBe("failed".length);
			expectTypeOf(mapped).toEqualTypeOf<Pending<number, number>>();
			expect(mapper).toHaveBeenCalledTimes(1);
			expect(mapper).toHaveBeenCalledWith("failed");
			expect(mapper).toHaveReturnedWith(Promise.resolve("failed".length));
		});

		it("returns Pending and skips async mapper when settled as Ok", () => {
			const result = new Pending<number, string>(Promise.resolve(new Ok(42)));
			const mapper = mock(async (error: string) => error.length);

			const mapped = result.mapErr(mapper);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe(42);
			expectTypeOf(mapped).toEqualTypeOf<Pending<number, number>>();
			expect(mapper).not.toHaveBeenCalled();
		});

		it("returns Pending with a union-returning mapper", () => {
			const result = new Pending<number, string>(Promise.resolve(new Err("failed")));
			const mapper = (error: string): number | Promise<number> => error.length;

			const mapped = result.mapErr(mapper);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrapErr()).resolves.toBe("failed".length);
			expectTypeOf(mapped).toEqualTypeOf<Pending<number, number>>();
		});
	});

	describe("mapOr", () => {
		it("returns mapped value when settled as Ok with sync mapper", () => {
			const result = new Pending<number, string>(Promise.resolve(new Ok(42)));
			const mapper = mock((value: number) => value.toString());

			const mapped = result.mapOr("0", mapper);

			expect(mapped).resolves.toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<PromiseLike<string>>();
			expect(mapper).toHaveBeenCalledTimes(1);
			expect(mapper).toHaveBeenCalledWith(42);
			expect(mapper).toHaveReturnedWith("42");
		});

		it("returns default when settled as Err with sync mapper", () => {
			const result = new Pending<number, string>(Promise.resolve(new Err("failed")));
			const mapper = mock((value: number) => value.toString());

			const mapped = result.mapOr("0", mapper);

			expect(mapped).resolves.toBe("0");
			expectTypeOf(mapped).toEqualTypeOf<PromiseLike<string>>();
			expect(mapper).not.toHaveBeenCalled();
		});

		it("returns mapped value when settled as Ok with async mapper", () => {
			const result = new Pending<number, string>(Promise.resolve(new Ok(42)));
			const mapper = mock(async (value: number) => value.toString());

			const mapped = result.mapOr("0", mapper);

			expect(mapped).resolves.toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<PromiseLike<string>>();
			expect(mapper).toHaveBeenCalledTimes(1);
			expect(mapper).toHaveBeenCalledWith(42);
			expect(mapper).toHaveReturnedWith(Promise.resolve("42"));
		});

		it("returns default when settled as Err with async mapper", () => {
			const result = new Pending<number, string>(Promise.resolve(new Err("failed")));
			const mapper = mock(async (value: number) => value.toString());

			const mapped = result.mapOr("0", mapper);

			expect(mapped).resolves.toBe("0");
			expectTypeOf(mapped).toEqualTypeOf<PromiseLike<string>>();
			expect(mapper).not.toHaveBeenCalled();
		});

		it("returns PromiseLike with a union-returning mapper", () => {
			const result = new Pending<number, string>(Promise.resolve(new Ok(42)));
			const mapper = (value: number): string | Promise<string> => value.toString();

			const mapped = result.mapOr("0", mapper);

			expect(mapped).resolves.toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<PromiseLike<string>>();
		});
	});

	describe("mapOrElse", () => {
		it("uses mapper when settled as Ok with sync functions", () => {
			const result = new Pending<number, string>(Promise.resolve(new Ok(42)));
			const defaultFn = mock((error: string) => error.length.toString());
			const mapper = mock((value: number) => value.toString());

			const mapped = result.mapOrElse(defaultFn, mapper);

			expect(mapped).resolves.toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<PromiseLike<string>>();
			expect(defaultFn).not.toHaveBeenCalled();
			expect(mapper).toHaveBeenCalledTimes(1);
			expect(mapper).toHaveBeenCalledWith(42);
			expect(mapper).toHaveReturnedWith("42");
		});

		it("uses defaultFn when settled as Err with sync functions", () => {
			const result = new Pending<number, string>(Promise.resolve(new Err("failed")));
			const defaultFn = mock((error: string) => error.length.toString());
			const mapper = mock((value: number) => value.toString());

			const mapped = result.mapOrElse(defaultFn, mapper);

			expect(mapped).resolves.toBe("6");
			expectTypeOf(mapped).toEqualTypeOf<PromiseLike<string>>();
			expect(defaultFn).toHaveBeenCalledTimes(1);
			expect(defaultFn).toHaveBeenCalledWith("failed");
			expect(defaultFn).toHaveReturnedWith("6");
			expect(mapper).not.toHaveBeenCalled();
		});

		it("uses defaultFn when settled as Err and defaultFn is async", () => {
			const result = new Pending<number, string>(Promise.resolve(new Err("failed")));
			const defaultFn = mock(async (error: string) => error.length.toString());
			const mapper = mock((value: number) => value.toString());

			const mapped = result.mapOrElse(defaultFn, mapper);

			expect(mapped).resolves.toBe("6");
			expectTypeOf(mapped).toEqualTypeOf<PromiseLike<string>>();
			expect(defaultFn).toHaveBeenCalledTimes(1);
			expect(defaultFn).toHaveBeenCalledWith("failed");
			expect(defaultFn).toHaveReturnedWith(Promise.resolve("6"));
			expect(mapper).not.toHaveBeenCalled();
		});

		it("uses mapper when settled as Ok and mapper is async", () => {
			const result = new Pending<number, string>(Promise.resolve(new Ok(42)));
			const defaultFn = mock((error: string) => error.length.toString());
			const mapper = mock(async (value: number) => value.toString());

			const mapped = result.mapOrElse(defaultFn, mapper);

			expect(mapped).resolves.toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<PromiseLike<string>>();
			expect(defaultFn).not.toHaveBeenCalled();
			expect(mapper).toHaveBeenCalledTimes(1);
			expect(mapper).toHaveBeenCalledWith(42);
			expect(mapper).toHaveReturnedWith(Promise.resolve("42"));
		});

		it("returns PromiseLike when mapper returns PromiseLike", () => {
			const result = new Pending<number, string>(Promise.resolve(new Ok(42)));

			const mapped = result.mapOrElse(
				(error) => error.length.toString(),
				(value) => Promise.resolve(value.toString()),
			);

			expect(mapped).resolves.toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<PromiseLike<string>>();
		});

		it("returns PromiseLike with union-returning callbacks", () => {
			const result = new Pending<number, string>(Promise.resolve(new Ok(42)));
			const defaultFn = (error: string): string | Promise<string> => error.length.toString();
			const mapper = (value: number): string | Promise<string> => value.toString();

			const mapped = result.mapOrElse(defaultFn, mapper);

			expect(mapped).resolves.toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<PromiseLike<string>>();
		});

		it("enforces matching callback output types", () => {
			const result = new Pending<number, string>(Promise.resolve(new Ok(42)));

			// @ts-expect-error mapOrElse callbacks must share the same resolved type
			result.mapOrElse(
				(_e: string) => 0,
				(_v: number) => "42",
			);
		});
	});

	describe("andThen", () => {
		it("returns Pending when callback returns Ok and settled as Ok", () => {
			const result = new Pending<number, string>(Promise.resolve(new Ok(42)));
			const mapper = mock((value: number) => new Ok<string, number>(value.toString()));

			const mapped = result.andThen(mapper);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<Pending<string, string | number>>();
			expect(mapper).toHaveBeenCalledTimes(1);
			expect(mapper).toHaveBeenCalledWith(42);
			expect(mapper).toHaveReturnedWith(new Ok("42"));
		});

		it("returns Pending when callback returns Err and settled as Ok", () => {
			const result = new Pending<number, string>(Promise.resolve(new Ok(42)));
			const mapper = mock((value: number) => new Err<string, number>(value));

			const mapped = result.andThen(mapper);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrapErr()).resolves.toBe(42);
			expectTypeOf(mapped).toEqualTypeOf<Pending<string, string | number>>();
			expect(mapper).toHaveBeenCalledTimes(1);
			expect(mapper).toHaveBeenCalledWith(42);
			expect(mapper).toHaveReturnedWith(new Err(42));
		});

		it("returns Pending when callback returns Pending and settled as Ok", () => {
			const result = new Pending<number, string>(Promise.resolve(new Ok(42)));
			const mapper = mock(
				(value: number) => new Pending<string, number>(Promise.resolve(new Ok(value.toString()))),
			);

			const mapped = result.andThen(mapper);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<Pending<string, string | number>>();
			expect(mapper).toHaveBeenCalledTimes(1);
			expect(mapper).toHaveBeenCalledWith(42);
			expect(mapper).toHaveReturnedWith(new Pending(Promise.resolve(new Ok("42"))));
		});

		it("returns Pending and skips callback when settled as Err", () => {
			const result = new Pending<number, string>(Promise.resolve(new Err("failed")));
			const mapper = mock((value: number) => new Ok<string, number>(value.toString()));

			const mapped = result.andThen(mapper);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrapErr()).resolves.toBe("failed");
			expectTypeOf(mapped).toEqualTypeOf<Pending<string, string | number>>();
			expect(mapper).not.toHaveBeenCalled();
		});

		it("returns Pending with a union-returning callback", () => {
			const result = new Pending<number, string>(Promise.resolve(new Ok(42)));
			const mapper = (value: number): Ok<string, number> | Err<string, number> =>
				new Ok(value.toString());

			const mapped = result.andThen(mapper);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<Pending<string, string | number>>();
		});
	});

	describe("and", () => {
		it("returns explicit Ok when settled as Ok and next is Ok", () => {
			const result = new Pending<number, string>(Promise.resolve(new Ok(42)));
			const mapped = result.and(new Ok<string, boolean>("done"));

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe("done");
			expectTypeOf(mapped).toEqualTypeOf<Pending<string, string | boolean>>();
		});

		it("returns explicit Err when settled as Ok and next is Err", () => {
			const result = new Pending<number, string>(Promise.resolve(new Ok(42)));
			const mapped = result.and(new Err<string, boolean>(false));

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrapErr()).resolves.toBeFalse();
			expectTypeOf(mapped).toEqualTypeOf<Pending<string, string | boolean>>();
		});

		it("returns explicit Pending when settled as Ok and next is Pending", () => {
			const result = new Pending<number, string>(Promise.resolve(new Ok(42)));
			const mapped = result.and(new Pending<string, boolean>(Promise.resolve(new Ok("done"))));

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe("done");
			expectTypeOf(mapped).toEqualTypeOf<Pending<string, string | boolean>>();
		});

		it("returns source Err when settled as Err", () => {
			const result = new Pending<number, string>(Promise.resolve(new Err("failed")));
			const mapped = result.and(new Ok<string, boolean>("done"));

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrapErr()).resolves.toBe("failed");
			expectTypeOf(mapped).toEqualTypeOf<Pending<string, string | boolean>>();
		});
	});

	describe("or", () => {
		it("returns source Ok when settled as Ok", () => {
			const result = new Pending<number, string>(Promise.resolve(new Ok(42)));
			const mapped = result.or(new Ok<number, boolean>(0));

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe(42);
			expectTypeOf(mapped).toEqualTypeOf<Pending<number, string | boolean>>();
		});

		it("returns explicit Ok when settled as Err and fallback is Ok", () => {
			const result = new Pending<number, string>(Promise.resolve(new Err("failed")));
			const mapped = result.or(new Ok<number, boolean>(42));

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe(42);
			expectTypeOf(mapped).toEqualTypeOf<Pending<number, string | boolean>>();
		});

		it("returns explicit Err when settled as Err and fallback is Err", () => {
			const result = new Pending<number, string>(Promise.resolve(new Err("failed")));
			const mapped = result.or(new Err<number, boolean>(false));

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrapErr()).resolves.toBeFalse();
			expectTypeOf(mapped).toEqualTypeOf<Pending<number, string | boolean>>();
		});

		it("returns explicit Pending when settled as Err and fallback is Pending", () => {
			const result = new Pending<number, string>(Promise.resolve(new Err("failed")));
			const mapped = result.or(new Pending<number, boolean>(Promise.resolve(new Ok(42))));

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe(42);
			expectTypeOf(mapped).toEqualTypeOf<Pending<number, string | boolean>>();
		});
	});

	describe("orElse", () => {
		it("returns source Ok and does not call mapper when settled as Ok", () => {
			const result = new Pending<number, string>(Promise.resolve(new Ok(42)));
			const mapper = mock((error: string) => new Err<number, number>(error.length));

			const mapped = result.orElse(mapper);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe(42);
			expectTypeOf(mapped).toEqualTypeOf<Pending<number, number>>();
			expect(mapper).not.toHaveBeenCalled();
		});

		it("returns Pending when mapper returns Ok and settled as Err", () => {
			const result = new Pending<number, string>(Promise.resolve(new Err("failed")));
			const mapper = mock((error: string) => new Ok<number, number>(error.length));

			const mapped = result.orElse(mapper);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe("failed".length);
			expectTypeOf(mapped).toEqualTypeOf<Pending<number, number>>();
			expect(mapper).toHaveBeenCalledTimes(1);
			expect(mapper).toHaveBeenCalledWith("failed");
			expect(mapper).toHaveReturnedWith(new Ok("failed".length));
		});

		it("returns Pending when mapper returns Err and settled as Err", () => {
			const result = new Pending<number, string>(Promise.resolve(new Err("failed")));
			const mapper = mock((error: string) => new Err<number, number>(error.length));

			const mapped = result.orElse(mapper);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrapErr()).resolves.toBe("failed".length);
			expectTypeOf(mapped).toEqualTypeOf<Pending<number, number>>();
			expect(mapper).toHaveBeenCalledTimes(1);
			expect(mapper).toHaveBeenCalledWith("failed");
			expect(mapper).toHaveReturnedWith(new Err("failed".length));
		});

		it("returns Pending when mapper returns Pending and settled as Err", () => {
			const result = new Pending<number, string>(Promise.resolve(new Err("failed")));
			const mapper = mock(
				(error: string) => new Pending<number, number>(Promise.resolve(new Ok(error.length))),
			);

			const mapped = result.orElse(mapper);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe("failed".length);
			expectTypeOf(mapped).toEqualTypeOf<Pending<number, number>>();
			expect(mapper).toHaveBeenCalledTimes(1);
			expect(mapper).toHaveBeenCalledWith("failed");
			expect(mapper).toHaveReturnedWith(new Pending(Promise.resolve(new Ok("failed".length))));
		});

		it("returns Pending with a union-returning callback", () => {
			const result = new Pending<number, string>(Promise.resolve(new Err("failed")));
			const mapper = (error: string): Ok<number, number> | Err<number, number> =>
				new Ok(error.length);

			const mapped = result.orElse(mapper);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe("failed".length);
			expectTypeOf(mapped).toEqualTypeOf<Pending<number, number>>();
		});
	});

	describe("flatten", () => {
		it("returns explicit Pending when settled as Ok wrapping Ok", () => {
			const result = new Pending<Ok<number, boolean> | Err<number, boolean>, string>(
				Promise.resolve(new Ok(new Ok(42))),
			);

			const flattened = result.flatten();

			expect(flattened.isPending()).toBeTrue();
			expect(flattened.unwrap()).resolves.toBe(42);
			expectTypeOf(flattened).toEqualTypeOf<Pending<number, string | boolean>>();
		});

		it("returns explicit Pending when settled as Ok wrapping Err", () => {
			const result = new Pending<Ok<number, boolean> | Err<number, boolean>, string>(
				Promise.resolve(new Ok(new Err(false))),
			);

			const flattened = result.flatten();

			expect(flattened.isPending()).toBeTrue();
			expect(flattened.unwrapErr()).resolves.toBeFalse();
			expectTypeOf(flattened).toEqualTypeOf<Pending<number, string | boolean>>();
		});

		it("returns outer Err when settled as Err", () => {
			const result = new Pending<Ok<number, boolean> | Err<number, boolean>, string>(
				Promise.resolve(new Err("failed")),
			);

			const flattened = result.flatten();

			expect(flattened.isPending()).toBeTrue();
			expect(flattened.unwrapErr()).resolves.toBe("failed");
			expectTypeOf(flattened).toEqualTypeOf<Pending<number, string | boolean>>();
		});
	});

	describe("unwrap", () => {
		it("returns PromiseLike when settled as Ok", () => {
			const result = new Pending<number, string>(Promise.resolve(new Ok(42)));

			const unwrapped = result.unwrap();

			expect(unwrapped).resolves.toBe(42);
			expectTypeOf(unwrapped).toEqualTypeOf<PromiseLike<number>>();
		});

		it("rejects when settled as Err", () => {
			const result = new Pending<number, string>(Promise.resolve(new Err("failed")));

			expect(result.unwrap()).rejects.toBeInstanceOf(UnwrapError);
			expect(result.unwrap()).rejects.toThrow("Called unwrap() on an Err value");
		});
	});

	describe("unwrapErr", () => {
		it("returns PromiseLike when settled as Err", () => {
			const result = new Pending<number, string>(Promise.resolve(new Err("failed")));

			const unwrapped = result.unwrapErr();

			expect(unwrapped).resolves.toBe("failed");
			expectTypeOf(unwrapped).toEqualTypeOf<PromiseLike<string>>();
		});

		it("rejects when settled as Ok", () => {
			const result = new Pending<number, string>(Promise.resolve(new Ok(42)));

			expect(result.unwrapErr()).rejects.toBeInstanceOf(UnwrapError);
			expect(result.unwrapErr()).rejects.toThrow("Called unwrapErr() on an Ok value");
		});
	});

	describe("unwrapOr", () => {
		it("returns value when settled as Ok", () => {
			const result = new Pending<number, string>(Promise.resolve(new Ok(42)));

			const unwrapped = result.unwrapOr(0);

			expect(unwrapped).resolves.toBe(42);
			expectTypeOf(unwrapped).toEqualTypeOf<PromiseLike<number>>();
		});

		it("returns default when settled as Err", () => {
			const result = new Pending<number, string>(Promise.resolve(new Err("failed")));

			const unwrapped = result.unwrapOr(0);

			expect(unwrapped).resolves.toBe(0);
			expectTypeOf(unwrapped).toEqualTypeOf<PromiseLike<number>>();
		});
	});

	describe("unwrapOrElse", () => {
		it("returns value and does not call fallback when settled as Ok", () => {
			const result = new Pending<number, string>(Promise.resolve(new Ok(42)));
			const fallback = mock((e: string) => e.length);

			const unwrapped = result.unwrapOrElse(fallback);

			expect(unwrapped).resolves.toBe(42);
			expectTypeOf(unwrapped).toEqualTypeOf<PromiseLike<number>>();
			expect(fallback).not.toHaveBeenCalled();
		});

		it("returns fallback when settled as Err with sync fallback", () => {
			const result = new Pending<number, string>(Promise.resolve(new Err("failed")));
			const fallback = mock((e: string) => e.length);

			const unwrapped = result.unwrapOrElse(fallback);

			expect(unwrapped).resolves.toBe("failed".length);
			expectTypeOf(unwrapped).toEqualTypeOf<PromiseLike<number>>();
			expect(fallback).toHaveBeenCalledTimes(1);
			expect(fallback).toHaveBeenCalledWith("failed");
			expect(fallback).toHaveReturnedWith("failed".length);
		});

		it("returns fallback when settled as Err with async fallback", () => {
			const result = new Pending<number, string>(Promise.resolve(new Err("failed")));
			const fallback = mock(async (e: string) => e.length);

			const unwrapped = result.unwrapOrElse(fallback);

			expect(unwrapped).resolves.toBe("failed".length);
			expectTypeOf(unwrapped).toEqualTypeOf<PromiseLike<number>>();
			expect(fallback).toHaveBeenCalledTimes(1);
			expect(fallback).toHaveBeenCalledWith("failed");
			expect(fallback).toHaveReturnedWith(Promise.resolve("failed".length));
		});

		it("returns PromiseLike when fallback returns PromiseLike", () => {
			const result = new Pending<number, string>(Promise.resolve(new Err("failed")));

			const unwrapped = result.unwrapOrElse((e) => Promise.resolve(e.length));

			expect(unwrapped).resolves.toBe("failed".length);
			expectTypeOf(unwrapped).toEqualTypeOf<PromiseLike<number>>();
		});

		it("returns PromiseLike with a union-returning fallback", () => {
			const result = new Pending<number, string>(Promise.resolve(new Err("failed")));
			const fallback = (error: string): number | Promise<number> => error.length;

			const unwrapped = result.unwrapOrElse(fallback);

			expect(unwrapped).resolves.toBe("failed".length);
			expectTypeOf(unwrapped).toEqualTypeOf<PromiseLike<number>>();
		});
	});

	describe("settle", () => {
		it("returns PromiseLike<Settled>", () => {
			const result = new Pending<number, string>(Promise.resolve(new Ok(42)));

			const settled = result.settle();

			expect(settled).resolves.toEqual(new Ok(42));
			expectTypeOf(settled).toEqualTypeOf<PromiseLike<Settled<number, string>>>();
		});
	});

	describe("iterators", () => {
		it("returns value when it settles to Ok", () => {
			const iterator = new Pending<number, string>(Promise.resolve(new Ok(42)))[
				Symbol.asyncIterator
			]();

			expect(iterator.next()).resolves.toEqual({ done: true, value: 42 });
		});

		it("yields Err when it settles to Err", async () => {
			const settledErr = new Err<number, string>("failed");
			const iterator = new Pending<number, string>(Promise.resolve(settledErr))[
				Symbol.asyncIterator
			]();
			const first = await iterator.next();

			expect(first.done).toBeFalse();
			expect(first.value).toBe(settledErr);
		});

		it("throws when resumed after yielding", async () => {
			const iterator = new Pending<number, string>(Promise.resolve(new Err("failed")))[
				Symbol.asyncIterator
			]();
			await iterator.next();

			await expect(iterator.next()).rejects.toThrow(
				"Unreachable: generator should have been halted",
			);
		});

		it("can be halted after first yield", async () => {
			const iterator = new Pending<number, string>(Promise.resolve(new Err("failed")))[
				Symbol.asyncIterator
			]();
			await iterator.next();
			const returned = await iterator.return(undefined as unknown as number);

			expect(returned.done).toBeTrue();
		});
	});
});
