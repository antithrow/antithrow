import { describe, expect, expectTypeOf, it, mock } from "bun:test";
import { Err } from "./err.js";
import { UnwrapError } from "./errors.js";
import { Ok } from "./ok.js";
import { Pending } from "./pending.js";

describe("Ok", () => {
	describe("state", () => {
		it("reports the correct state and narrows to Ok", () => {
			const result = new Ok<number, string>(42);

			expect(result.isOk()).toBeTrue();
			expect(result.isErr()).toBeFalse();
			expect(result.isPending()).toBeFalse();
			expectTypeOf(result).toEqualTypeOf<Ok<number, string>>();
			expectTypeOf(result.value).toEqualTypeOf<number>();
		});
	});

	describe("map", () => {
		it("returns Ok with a sync mapper", () => {
			const result = new Ok<number, string>(42);

			const mapped = result.map((v) => v.toString());

			expect(mapped.isOk()).toBeTrue();
			expect(mapped.unwrap()).toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<Ok<string, string>>();
		});

		it("returns Pending with an async mapper", () => {
			const result = new Ok<number, string>(42);

			const mapped = result.map(async (v) => v.toString());

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<Pending<string, string>>();
		});

		it("returns Ok | Pending with a union-returning mapper", () => {
			const result = new Ok<number, string>(42);
			const mapper = (v: number): string | Promise<string> => v.toString();

			const mapped = result.map(mapper);

			expect(mapped.isOk()).toBeTrue();
			expectTypeOf(mapped).toEqualTypeOf<Ok<string, string> | Pending<string, string>>();
		});
	});

	describe("mapErr", () => {
		it("returns Ok with a sync mapper", () => {
			const result = new Ok<number, string>(42);

			const mapped = result.mapErr((e) => e.length);

			expect(mapped.isOk()).toBeTrue();
			expect(mapped.unwrap()).toBe(42);
			expectTypeOf(mapped).toEqualTypeOf<Ok<number, number>>();
		});

		it("returns Ok with an async mapper", () => {
			const result = new Ok<number, string>(42);

			const mapped = result.mapErr(async (e) => e.length);

			expect(mapped.isOk()).toBeTrue();
			expect(mapped.unwrap()).toBe(42);
			expectTypeOf(mapped).toEqualTypeOf<Ok<number, number>>();
		});

		it("returns Ok with a union-returning mapper", () => {
			const result = new Ok<number, string>(42);
			const mapper = (e: string): number | Promise<number> => e.length;

			const mapped = result.mapErr(mapper);

			expect(mapped.isOk()).toBeTrue();
			expect(mapped.unwrap()).toBe(42);
			expectTypeOf(mapped).toEqualTypeOf<Ok<number, number>>();
		});
	});

	describe("mapOr", () => {
		it("returns transformed value with a sync mapper", () => {
			const result = new Ok<number, string>(42);

			const mapped = result.mapOr("0", (v) => v.toString());

			expect(mapped).toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<string>();
		});

		it("returns PromiseLike with an async mapper", () => {
			const result = new Ok<number, string>(42);

			const mapped = result.mapOr("0", async (v) => v.toString());

			expect(mapped).resolves.toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<PromiseLike<string>>();
		});

		it("returns SyncOrAsync with a union-returning mapper", () => {
			const result = new Ok<number, string>(42);
			const mapper = (v: number): string | Promise<string> => v.toString();

			const mapped = result.mapOr("0", mapper);

			expect(mapped).toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<string | PromiseLike<string>>();
		});
	});

	describe("mapOrElse", () => {
		it("returns transformed value with sync functions", () => {
			const result = new Ok<number, string>(42);

			const mapped = result.mapOrElse(
				(e) => e.length.toString(),
				(v) => v.toString(),
			);

			expect(mapped).toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<string>();
		});

		it("returns PromiseLike with an async mapper", () => {
			const result = new Ok<number, string>(42);

			const mapped = result.mapOrElse(
				(e) => e.length.toString(),
				async (v) => v.toString(),
			);

			expect(mapped).resolves.toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<PromiseLike<string>>();
		});

		it("returns sync value when only the Err default function is async", () => {
			const result = new Ok<number, string>(42);

			const mapped = result.mapOrElse(
				async (e) => e.length.toString(),
				(v) => v.toString(),
			);

			expect(mapped).toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<string>();
		});

		it("returns sync value with union-returning Err default function", () => {
			const result = new Ok<number, string>(42);
			const defaultFn = (e: string): string | Promise<string> => e.length.toString();

			const mapped = result.mapOrElse(defaultFn, (v) => v.toString());

			expect(mapped).toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<string>();
		});

		it("enforces matching callback output types", () => {
			const result = new Ok<number, string>(42);

			// @ts-expect-error mapOrElse callbacks must share the same resolved type
			result.mapOrElse(
				(_e: string) => 0,
				(_v: number) => "42",
			);
		});
	});

	describe("andThen", () => {
		it("returns Ok when callback returns Ok", () => {
			const result = new Ok<number, string>(42);

			const mapped = result.andThen((v) => new Ok(v.toString()));

			expect(mapped.isOk()).toBeTrue();
			expect(mapped.unwrap()).toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<Ok<string, never>>();
		});

		it("returns Err when callback returns Err", () => {
			const result = new Ok<number, string>(42);

			const mapped = result.andThen((v) => new Err<string, number>(v));

			expect(mapped.isErr()).toBeTrue();
			expect(mapped.unwrapErr()).toBe(42);
			expectTypeOf(mapped).toEqualTypeOf<Err<string, number>>();
		});

		it("returns Pending when callback returns Pending", () => {
			const result = new Ok<number, string>(42);

			const mapped = result.andThen((v) => new Pending(Promise.resolve(new Ok(v.toString()))));

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<Pending<string, never>>();
		});

		it("returns Result union with a union-returning callback", () => {
			const result = new Ok<number, string>(42);
			const mapper = (v: number): Ok<string, number> | Err<string, number> => new Ok(v.toString());

			const mapped = result.andThen(mapper);

			expect(mapped.isOk()).toBeTrue();
			expect(mapped.unwrap()).toBe("42");
			expectTypeOf(mapped).toEqualTypeOf<Ok<string, number> | Err<string, number>>();
		});

		it("preserves correlated union members across Ok | Err | Pending callback returns", () => {
			const result = new Ok<number, string>(42);
			const mapper = (
				v: number,
			):
				| Ok<{ kind: "ok"; value: string }, "ok-error">
				| Err<{ kind: "err"; value: number }, "err-error">
				| Pending<{ kind: "pending"; value: boolean }, "pending-error"> =>
				new Ok({ kind: "ok", value: v.toString() });

			const mapped = result.andThen(mapper);

			expect(mapped.isOk()).toBeTrue();
			expectTypeOf(mapped).toEqualTypeOf<ReturnType<typeof mapper>>();
		});
	});

	describe("and", () => {
		it("returns Ok with explicit Ok", () => {
			const result = new Ok<number, string>(42);

			const mapped = result.and(new Ok("done"));

			expect(mapped.isOk()).toBeTrue();
			expect(mapped.unwrap()).toBe("done");
			expectTypeOf(mapped).toEqualTypeOf<Ok<string, never>>();
		});

		it("returns Err with explicit Err", () => {
			const result = new Ok<number, string>(42);

			const mapped = result.and(new Err<string, number>(10));

			expect(mapped.isErr()).toBeTrue();
			expect(mapped.unwrapErr()).toBe(10);
			expectTypeOf(mapped).toEqualTypeOf<Err<string, number>>();
		});

		it("returns Pending with explicit Pending", () => {
			const result = new Ok<number, string>(42);

			const mapped = result.and(new Pending(Promise.resolve(new Ok("done"))));

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe("done");
			expectTypeOf(mapped).toEqualTypeOf<Pending<string, never>>();
		});

		it("preserves correlated union members across Ok | Err | Pending inputs", () => {
			const result = new Ok<number, string>(42);
			const next:
				| Ok<{ kind: "ok"; value: string }, "ok-error">
				| Err<{ kind: "err"; value: number }, "err-error">
				| Pending<{ kind: "pending"; value: boolean }, "pending-error"> = new Ok({
				kind: "ok",
				value: "done",
			});

			const mapped = result.and(next);

			expect(mapped.isOk()).toBeTrue();
			expectTypeOf(mapped).toEqualTypeOf<typeof next>();
		});
	});

	describe("or", () => {
		it("returns itself", () => {
			const result = new Ok<number, string>(42);

			const mapped = result.or(new Ok<number, boolean>(0));

			expect(mapped.isOk()).toBeTrue();
			expect(mapped.unwrap()).toBe(42);
			expectTypeOf(mapped).toEqualTypeOf<Ok<number, string>>();
		});
	});

	describe("orElse", () => {
		it("returns itself and does not call mapper", () => {
			const result = new Ok<number, string>(42);
			const mapper = mock((e: string) => new Err<number, number>(e.length));

			const mapped = result.orElse(mapper);

			expect(mapped.isOk()).toBeTrue();
			expect(mapped.unwrap()).toBe(42);
			expectTypeOf(mapped).toEqualTypeOf<Ok<number, number>>();
			expect(mapper).not.toHaveBeenCalled();
		});

		it("returns Ok with a union-returning mapper", () => {
			const result = new Ok<number, string>(42);
			const mapper = mock(
				(e: string): Ok<number, number> | Err<number, number> => new Err(e.length),
			);

			const mapped = result.orElse(mapper);

			expect(mapped.isOk()).toBeTrue();
			expect(mapped.unwrap()).toBe(42);
			expectTypeOf(mapped).toEqualTypeOf<Ok<number, number>>();
			expect(mapper).not.toHaveBeenCalled();
		});
	});

	describe("flatten", () => {
		it("returns inner Ok when wrapping Ok", () => {
			const result = new Ok<Ok<number, boolean>, string>(new Ok(42));

			const flattened = result.flatten();

			expect(flattened.isOk()).toBeTrue();
			expect(flattened.unwrap()).toBe(42);
			expectTypeOf(flattened).toEqualTypeOf<Ok<number, string | boolean>>();
		});

		it("returns inner Err when wrapping Err", () => {
			const result = new Ok<Err<number, boolean>, string>(new Err(false));

			const flattened = result.flatten();

			expect(flattened.isErr()).toBeTrue();
			expect(flattened.unwrapErr()).toBeFalse();
			expectTypeOf(flattened).toEqualTypeOf<Err<number, string | boolean>>();
		});

		it("returns inner Pending when wrapping Pending", () => {
			const result = new Ok<Pending<number, boolean>, string>(
				new Pending(Promise.resolve(new Ok(42))),
			);

			const flattened = result.flatten();

			expect(flattened.isPending()).toBeTrue();
			expect(flattened.unwrap()).resolves.toBe(42);
			expectTypeOf(flattened).toEqualTypeOf<Pending<number, string | boolean>>();
		});
	});

	describe("unwrap", () => {
		it("returns value", () => {
			const result = new Ok<number, string>(42);

			const unwrapped = result.unwrap();

			expect(unwrapped).toBe(42);
			expectTypeOf(unwrapped).toEqualTypeOf<number>();
		});
	});

	describe("unwrapErr", () => {
		it("throws UnwrapError", () => {
			const result = new Ok<number, string>(42);

			expect(() => result.unwrapErr()).toThrow("Called unwrapErr() on an Ok value");
			expect(() => result.unwrapErr()).toThrow(UnwrapError);
		});
	});

	describe("unwrapOr", () => {
		it("returns value", () => {
			const result = new Ok<number, string>(42);

			const unwrapped = result.unwrapOr(0);

			expect(unwrapped).toBe(42);
			expectTypeOf(unwrapped).toEqualTypeOf<number>();
		});
	});

	describe("unwrapOrElse", () => {
		it("returns value and does not call fallback", () => {
			const result = new Ok<number, string>(42);
			const fallback = mock((e: string) => e.length);

			const unwrapped = result.unwrapOrElse(fallback);

			expect(unwrapped).toBe(42);
			expectTypeOf(unwrapped).toEqualTypeOf<number>();
			expect(fallback).not.toHaveBeenCalled();
		});

		it("returns value and stays sync even with async fallback", () => {
			const result = new Ok<number, string>(42);
			const fallback = mock(async (e: string) => e.length);

			const unwrapped = result.unwrapOrElse(fallback);

			expect(unwrapped).toBe(42);
			expectTypeOf(unwrapped).toEqualTypeOf<number>();
			expect(fallback).not.toHaveBeenCalled();
		});

		it("returns value with a union-returning fallback", () => {
			const result = new Ok<number, string>(42);
			const fallback = mock((e: string): number | Promise<number> => e.length);

			const unwrapped = result.unwrapOrElse(fallback);

			expect(unwrapped).toBe(42);
			expectTypeOf(unwrapped).toEqualTypeOf<number>();
			expect(fallback).not.toHaveBeenCalled();
		});
	});

	describe("settle", () => {
		it("returns PromiseLike<Ok>", () => {
			const result = new Ok<number, string>(42);

			const settled = result.settle();

			expect(settled).resolves.toBe(result);
			expectTypeOf(settled).toEqualTypeOf<PromiseLike<Ok<number, string>>>();
		});
	});

	describe("iterators", () => {
		it("returns the value without yielding", () => {
			const iterator = new Ok<number, string>(42)[Symbol.iterator]();
			const first = iterator.next();

			expect(first).toEqual({ done: true, value: 42 });
		});
	});
});
