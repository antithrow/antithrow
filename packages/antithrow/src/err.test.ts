import { describe, expect, expectTypeOf, it } from "bun:test";
import { Err } from "./err.js";
import { UnwrapError } from "./errors.js";
import { Ok } from "./ok.js";
import { Pending } from "./pending.js";

describe("Err", () => {
	describe("state", () => {
		it("reports the correct state and narrows to Err", () => {
			const result = new Err<number, string>("failed");

			expect(result.isOk()).toBeFalse();
			expect(result.isErr()).toBeTrue();
			expect(result.isPending()).toBeFalse();
			expectTypeOf(result).toEqualTypeOf<Err<number, string>>();
			expectTypeOf(result.error).toEqualTypeOf<string>();
		});
	});

	describe("map", () => {
		it("returns Err with a sync mapper", () => {
			const result = new Err<number, string>("failed");

			const mapped = result.map((v) => v.toString());

			expect(mapped.isErr()).toBeTrue();
			expect(mapped.unwrapErr()).toBe("failed");
			expectTypeOf(mapped).toEqualTypeOf<Err<string, string>>();
		});

		it("returns Err with an async mapper", () => {
			const result = new Err<number, string>("failed");

			const mapped = result.map(async (v) => v.toString());

			expect(mapped.isErr()).toBeTrue();
			expect(mapped.unwrapErr()).toBe("failed");
			expectTypeOf(mapped).toEqualTypeOf<Err<string, string>>();
		});
	});

	describe("mapErr", () => {
		it("returns Err with a sync mapper", () => {
			const result = new Err<number, string>("failed");

			const mapped = result.mapErr((e) => e.length);

			expect(mapped.isErr()).toBeTrue();
			expect(mapped.unwrapErr()).toBe("failed".length);
			expectTypeOf(mapped).toEqualTypeOf<Err<number, number>>();
		});

		it("returns Pending with an async mapper", () => {
			const result = new Err<number, string>("failed");

			const mapped = result.mapErr(async (e) => e.length);

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrapErr()).resolves.toBe("failed".length);
			expectTypeOf(mapped).toEqualTypeOf<Pending<number, number>>();
		});

		it("returns Err | Pending with a union-returning mapper", () => {
			const result = new Err<number, string>("failed");
			const mapper = (e: string): number | Promise<number> => e.length;

			const mapped = result.mapErr(mapper);

			expect(mapped.isErr()).toBeTrue();
			expectTypeOf(mapped).toEqualTypeOf<Err<number, number> | Pending<number, number>>();
		});
	});

	describe("mapOr", () => {
		it("returns default with a sync mapper", () => {
			const result = new Err<number, string>("failed");

			const mapped = result.mapOr("0", (v) => v.toString());

			expect(mapped).toBe("0");
			expectTypeOf(mapped).toEqualTypeOf<string>();
		});

		it("returns default with an async mapper", () => {
			const result = new Err<number, string>("failed");

			const mapped = result.mapOr("0", async (v) => v.toString());

			expect(mapped).toBe("0");
			expectTypeOf(mapped).toEqualTypeOf<string>();
		});

		it("returns default with a union-returning mapper", () => {
			const result = new Err<number, string>("failed");
			const mapper = (v: number): string | Promise<string> => v.toString();

			const mapped = result.mapOr("0", mapper);

			expect(mapped).toBe("0");
			expectTypeOf(mapped).toEqualTypeOf<string>();
		});
	});

	describe("mapOrElse", () => {
		it("returns default value with sync functions", () => {
			const result = new Err<number, string>("failed");

			const mapped = result.mapOrElse(
				(e) => e.length.toString(),
				(v) => v.toString(),
			);

			expect(mapped).toBe("6");
			expectTypeOf(mapped).toEqualTypeOf<string>();
		});

		it("returns PromiseLike with an async default function", () => {
			const result = new Err<number, string>("failed");

			const mapped = result.mapOrElse(
				async (e) => e.length.toString(),
				(v) => v.toString(),
			);

			expect(mapped).resolves.toBe("6");
			expectTypeOf(mapped).toEqualTypeOf<PromiseLike<string>>();
		});

		it("returns sync value when only the Ok mapper is async", () => {
			const result = new Err<number, string>("failed");

			const mapped = result.mapOrElse(
				(e) => e.length.toString(),
				async (v) => v.toString(),
			);

			expect(mapped).toBe("6");
			expectTypeOf(mapped).toEqualTypeOf<string>();
		});

		it("returns sync value with union-returning Ok mapper", () => {
			const result = new Err<number, string>("failed");
			const mapper = (v: number): string | Promise<string> => v.toString();

			const mapped = result.mapOrElse((e) => e.length.toString(), mapper);

			expect(mapped).toBe("6");
			expectTypeOf(mapped).toEqualTypeOf<string | PromiseLike<string>>();
		});

		it("enforces matching callback output types", () => {
			const result = new Err<number, string>("failed");

			// @ts-expect-error mapOrElse callbacks must share the same resolved type
			result.mapOrElse(
				(_e: string) => 0,
				(_v: number) => "42",
			);
		});
	});

	describe("andThen", () => {
		it("returns Err", () => {
			const result = new Err<number, string>("failed");

			const mapped = result.andThen((v) => new Ok(v.toString()));

			expect(mapped.isErr()).toBeTrue();
			expect(mapped.unwrapErr()).toBe("failed");
			expectTypeOf(mapped).toEqualTypeOf<Err<string, string>>();
		});

		it("returns Err with a union-returning callback", () => {
			const result = new Err<number, string>("failed");
			const mapper = (v: number): Ok<string, number> | Err<string, number> => new Ok(v.toString());

			const mapped = result.andThen(mapper);

			expect(mapped.isErr()).toBeTrue();
			expect(mapped.unwrapErr()).toBe("failed");
			expectTypeOf(mapped).toEqualTypeOf<Err<string, string>>();
		});
	});

	describe("and", () => {
		it("returns source Err", () => {
			const result = new Err<number, string>("failed");

			const mapped = result.and(new Ok("done"));

			expect(mapped.isErr()).toBeTrue();
			expect(mapped.unwrapErr()).toBe("failed");
			expectTypeOf(mapped).toEqualTypeOf<Err<string, string>>();
		});
	});

	describe("or", () => {
		it("returns Ok with explicit Ok fallback", () => {
			const result = new Err<number, string>("failed");

			const mapped = result.or(new Ok<number, boolean>(42));

			expect(mapped.isOk()).toBeTrue();
			expect(mapped.unwrap()).toBe(42);
			expectTypeOf(mapped).toEqualTypeOf<Ok<number, boolean>>();
		});

		it("returns Err with explicit Err fallback", () => {
			const result = new Err<number, string>("failed");

			const mapped = result.or(new Err<number, boolean>(false));

			expect(mapped.isErr()).toBeTrue();
			expect(mapped.unwrapErr()).toBeFalse();
			expectTypeOf(mapped).toEqualTypeOf<Err<number, boolean>>();
		});

		it("returns Pending with explicit Pending fallback", () => {
			const result = new Err<number, string>("failed");

			const mapped = result.or(new Pending<number, boolean>(Promise.resolve(new Ok(42))));

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe(42);
			expectTypeOf(mapped).toEqualTypeOf<Pending<number, boolean>>();
		});

		it("preserves correlated union members across Ok | Err | Pending fallbacks", () => {
			const result = new Err<number, string>("failed");
			const fallback:
				| Ok<number, "ok-error">
				| Err<number, "err-error">
				| Pending<number, "pending-error"> = new Ok(42);

			const mapped = result.or(fallback);

			expect(mapped.isOk()).toBeTrue();
			expectTypeOf(mapped).toEqualTypeOf<typeof fallback>();
		});
	});

	describe("orElse", () => {
		it("returns Ok when callback returns Ok", () => {
			const result = new Err<number, string>("failed");

			const mapped = result.orElse((e) => new Ok<number, number>(e.length));

			expect(mapped.isOk()).toBeTrue();
			expect(mapped.unwrap()).toBe("failed".length);
			expectTypeOf(mapped).toEqualTypeOf<Ok<number, number>>();
		});

		it("returns Err when callback returns Err", () => {
			const result = new Err<number, string>("failed");

			const mapped = result.orElse((e) => new Err<number, number>(e.length));

			expect(mapped.isErr()).toBeTrue();
			expect(mapped.unwrapErr()).toBe("failed".length);
			expectTypeOf(mapped).toEqualTypeOf<Err<number, number>>();
		});

		it("returns Pending when callback returns Pending", () => {
			const result = new Err<number, string>("failed");

			const mapped = result.orElse((e) => new Pending(Promise.resolve(new Ok(e.length))));

			expect(mapped.isPending()).toBeTrue();
			expect(mapped.unwrap()).resolves.toBe("failed".length);
			expectTypeOf(mapped).toEqualTypeOf<Pending<number, never>>();
		});

		it("returns Result union with union-returning callback", () => {
			const result = new Err<number, string>("failed");
			const mapper = (e: string): Ok<number, number> | Err<number, number> => new Ok(e.length);

			const mapped = result.orElse(mapper);

			expect(mapped.isOk()).toBeTrue();
			expect(mapped.unwrap()).toBe("failed".length);
			expectTypeOf(mapped).toEqualTypeOf<Ok<number, number> | Err<number, number>>();
		});

		it("preserves correlated union members across Ok | Err | Pending callback returns", () => {
			const result = new Err<number, string>("failed");
			const mapper = (
				e: string,
			): Ok<number, "ok-error"> | Err<number, "err-error"> | Pending<number, "pending-error"> =>
				new Ok(e.length);

			const mapped = result.orElse(mapper);

			expect(mapped.isOk()).toBeTrue();
			expectTypeOf(mapped).toEqualTypeOf<ReturnType<typeof mapper>>();
		});
	});

	describe("flatten", () => {
		it("returns explicit Err", () => {
			const result = new Err<Ok<number, boolean> | Err<number, boolean>, string>("failed");

			const flattened = result.flatten();

			expect(flattened.isErr()).toBeTrue();
			expect(flattened.unwrapErr()).toBe("failed");
			expectTypeOf(flattened).toEqualTypeOf<Err<number, string | boolean>>();
		});
	});

	describe("unwrap", () => {
		it("unwrap throws UnwrapError", () => {
			const result = new Err<number, string>("failed");

			expect(() => result.unwrap()).toThrow("Called unwrap() on an Err value");
			expect(() => result.unwrap()).toThrow(UnwrapError);
		});
	});

	describe("unwrapErr", () => {
		it("unwrapErr returns error", () => {
			const result = new Err<number, string>("failed");

			const unwrapped = result.unwrapErr();

			expect(unwrapped).toBe("failed");
			expectTypeOf(unwrapped).toEqualTypeOf<string>();
		});
	});

	describe("unwrapOr", () => {
		it("returns default", () => {
			const result = new Err<number, string>("failed");

			const unwrapped = result.unwrapOr(0);

			expect(unwrapped).toBe(0);
			expectTypeOf(unwrapped).toEqualTypeOf<number>();
		});
	});

	describe("unwrapOrElse", () => {
		it("returns fallback with sync mapper", () => {
			const result = new Err<number, string>("failed");

			const unwrapped = result.unwrapOrElse((e) => e.length);

			expect(unwrapped).toBe("failed".length);
			expectTypeOf(unwrapped).toEqualTypeOf<number>();
		});

		it("returns PromiseLike with async mapper", () => {
			const result = new Err<number, string>("failed");

			const unwrapped = result.unwrapOrElse(async (e) => e.length);

			expect(unwrapped).resolves.toBe("failed".length);
			expectTypeOf(unwrapped).toEqualTypeOf<PromiseLike<number>>();
		});

		it("returns PromiseLike with PromiseLike mapper", () => {
			const result = new Err<number, string>("failed");

			const unwrapped = result.unwrapOrElse((e) => Promise.resolve(e.length));

			expect(unwrapped).resolves.toBe("failed".length);
			expectTypeOf(unwrapped).toEqualTypeOf<PromiseLike<number>>();
		});

		it("returns SyncOrAsync with union-returning mapper", () => {
			const result = new Err<number, string>("failed");
			const mapper = (e: string): number | Promise<number> => e.length;

			const unwrapped = result.unwrapOrElse(mapper);

			expect(unwrapped).toBe("failed".length);
			expectTypeOf(unwrapped).toEqualTypeOf<number | PromiseLike<number>>();
		});
	});

	describe("settle", () => {
		it("returns PromiseLike<Err>", () => {
			const result = new Err<number, string>("failed");

			const settled = result.settle();

			expect(settled).resolves.toBe(result);
			expectTypeOf(settled).toEqualTypeOf<PromiseLike<Err<number, string>>>();
		});
	});

	describe("iterators", () => {
		it("yields itself first", () => {
			const result = new Err<number, string>("failed");
			const iterator = result[Symbol.iterator]();
			const first = iterator.next();

			expect(first.done).toBeFalse();
			expect(first.value).toBe(result);
		});

		it("throws when resumed", () => {
			const iterator = new Err<number, string>("failed")[Symbol.iterator]();
			iterator.next();

			expect(() => iterator.next()).toThrow("Unreachable: generator should have been halted");
		});
	});
});
