import { describe, expect, test } from "bun:test";
import { err, ok, Result } from "./result.js";

describe("Result", () => {
	describe("ok", () => {
		test("creates an Ok value", () => {
			const result = ok(42);
			expect(result.isOk()).toBe(true);
			expect(result.isErr()).toBe(false);
			expect(result.value).toBe(42);
		});
	});

	describe("err", () => {
		test("creates an Err value", () => {
			const result = err("error message");
			expect(result.isOk()).toBe(false);
			expect(result.isErr()).toBe(true);
			expect(result.error).toBe("error message");
		});
	});

	describe("unwrap", () => {
		test("returns value for Ok", () => {
			const result = ok(42);
			expect(result.unwrap()).toBe(42);
		});

		test("throws for Err", () => {
			const result = err("error");
			expect(() => result.unwrap()).toThrow(
				"Called unwrap on an Err value: error",
			);
		});
	});

	describe("unwrapErr", () => {
		test("returns error for Err", () => {
			const result = err("error");
			expect(result.unwrapErr()).toBe("error");
		});

		test("throws for Ok", () => {
			const result = ok(42);
			expect(() => result.unwrapErr()).toThrow(
				"Called unwrapErr on an Ok value: 42",
			);
		});
	});

	describe("unwrapOr", () => {
		test("returns value for Ok", () => {
			const result = ok(42);
			expect(result.unwrapOr(0)).toBe(42);
		});

		test("returns default for Err", () => {
			const result: Result<number, string> = err("error");
			expect(result.unwrapOr(0)).toBe(0);
		});
	});

	describe("unwrapOrElse", () => {
		test("returns value for Ok", () => {
			const result = ok(42);
			expect(result.unwrapOrElse(() => 0)).toBe(42);
		});

		test("calls fn with error for Err", () => {
			const result: Result<number, string> = err("error");
			expect(result.unwrapOrElse((e) => e.length)).toBe(5);
		});
	});

	describe("map", () => {
		test("transforms Ok value", () => {
			const result = ok(42).map((x) => x * 2);
			expect(result.unwrap()).toBe(84);
		});

		test("does not transform Err", () => {
			const result: Result<number, string> = err("error");
			const mapped = result.map((x) => x * 2);
			expect(mapped.isErr()).toBe(true);
			expect(mapped.unwrapErr()).toBe("error");
		});
	});

	describe("mapErr", () => {
		test("does not transform Ok", () => {
			const result = ok<number, string>(42);
			const mapped = result.mapErr((e) => e.toUpperCase());
			expect(mapped.isOk()).toBe(true);
			expect(mapped.unwrap()).toBe(42);
		});

		test("transforms Err value", () => {
			const result: Result<number, string> = err("error");
			const mapped = result.mapErr((e) => e.toUpperCase());
			expect(mapped.unwrapErr()).toBe("ERROR");
		});
	});

	describe("mapOr", () => {
		test("transforms Ok value", () => {
			const result = ok(2);
			expect(result.mapOr(0, (x) => x * 2)).toBe(4);
		});

		test("returns default for Err", () => {
			const result: Result<number, string> = err("error");
			expect(result.mapOr(0, (x) => x * 2)).toBe(0);
		});

		test("can transform to different type", () => {
			const result = ok(42);
			expect(result.mapOr("default", (x) => `value: ${x}`)).toBe("value: 42");
		});

		test("returns default of different type for Err", () => {
			const result: Result<number, string> = err("error");
			expect(result.mapOr("default", (x) => `value: ${x}`)).toBe("default");
		});
	});

	describe("mapOrElse", () => {
		test("transforms Ok value", () => {
			const result = ok<number, string>(2);
			expect(
				result.mapOrElse(
					(e) => e.length,
					(x) => x * 2,
				),
			).toBe(4);
		});

		test("computes default from error for Err", () => {
			const result: Result<number, string> = err("error");
			expect(
				result.mapOrElse(
					(e) => e.length,
					(x) => x * 2,
				),
			).toBe(5);
		});

		test("can transform to different type", () => {
			const result = ok(42);
			expect(
				result.mapOrElse(
					(e) => `error: ${e}`,
					(x) => `value: ${x}`,
				),
			).toBe("value: 42");
		});

		test("computes default of different type for Err", () => {
			const result: Result<number, string> = err("oops");
			expect(
				result.mapOrElse(
					(e) => `error: ${e}`,
					(x) => `value: ${x}`,
				),
			).toBe("error: oops");
		});
	});

	describe("andThen", () => {
		test("chains Ok values", () => {
			const result = ok(42).andThen((x) => ok(x * 2));
			expect(result.unwrap()).toBe(84);
		});

		test("short-circuits on Err", () => {
			const result: Result<number, string> = err("error");
			const chained = result.andThen((x) => ok(x * 2));
			expect(chained.isErr()).toBe(true);
			expect(chained.unwrapErr()).toBe("error");
		});

		test("can return Err from chain", () => {
			const result = ok(42).andThen(() => err("new error"));
			expect(result.isErr()).toBe(true);
			expect(result.unwrapErr()).toBe("new error");
		});
	});

	describe("orElse", () => {
		test("does not call fn for Ok", () => {
			const result = ok<number, string>(42);
			const recovered = result.orElse(() => ok(0));
			expect(recovered.unwrap()).toBe(42);
		});

		test("recovers from Err", () => {
			const result: Result<number, string> = err("error");
			const recovered = result.orElse(() => ok(0));
			expect(recovered.unwrap()).toBe(0);
		});

		test("can return new Err from recovery", () => {
			const result: Result<number, string> = err("error");
			const recovered = result.orElse((e) => err(e.length));
			expect(recovered.unwrapErr()).toBe(5);
		});
	});

	describe("match", () => {
		test("calls ok handler for Ok", () => {
			const result = ok(42);
			const value = result.match({
				ok: (x) => `value: ${x}`,
				err: (e) => `error: ${e}`,
			});
			expect(value).toBe("value: 42");
		});

		test("calls err handler for Err", () => {
			const result = err("oops");
			const value = result.match({
				ok: (x) => `value: ${x}`,
				err: (e) => `error: ${e}`,
			});
			expect(value).toBe("error: oops");
		});
	});

	describe("inspect", () => {
		test("calls fn with value for Ok", () => {
			let inspected: number | undefined;
			const result = ok(42).inspect((x) => {
				inspected = x;
			});
			expect(inspected).toBe(42);
			expect(result.unwrap()).toBe(42);
		});

		test("does not call fn for Err", () => {
			let called = false;
			const result: Result<number, string> = err("error");
			result.inspect(() => {
				called = true;
			});
			expect(called).toBe(false);
		});

		test("returns the original result for Ok", () => {
			const original = ok(42);
			const result = original.inspect(() => {});
			expect(result).toBe(original);
		});

		test("returns the original result for Err", () => {
			const original: Result<number, string> = err("error");
			const result = original.inspect(() => {});
			expect(result).toBe(original);
		});

		test("can be chained", () => {
			const values: number[] = [];
			const result = ok(1)
				.map((x) => x + 1)
				.inspect((x) => values.push(x))
				.map((x) => x * 2)
				.inspect((x) => values.push(x));
			expect(result.unwrap()).toBe(4);
			expect(values).toEqual([2, 4]);
		});
	});

	describe("inspectErr", () => {
		test("does not call fn for Ok", () => {
			let called = false;
			ok(42).inspectErr(() => {
				called = true;
			});
			expect(called).toBe(false);
		});

		test("calls fn with error for Err", () => {
			let inspected: string | undefined;
			const result = err("oops").inspectErr((e) => {
				inspected = e;
			});
			expect(inspected).toBe("oops");
			expect(result.unwrapErr()).toBe("oops");
		});

		test("returns the original result for Ok", () => {
			const original = ok<number, string>(42);
			const result = original.inspectErr(() => {});
			expect(result).toBe(original);
		});

		test("returns the original result for Err", () => {
			const original = err("error");
			const result = original.inspectErr(() => {});
			expect(result).toBe(original);
		});

		test("can be chained", () => {
			const errors: string[] = [];
			const result: Result<number, string> = err("error");
			result
				.mapErr((e) => e.toUpperCase())
				.inspectErr((e) => errors.push(e))
				.mapErr((e) => `wrapped: ${e}`)
				.inspectErr((e) => errors.push(e));
			expect(errors).toEqual(["ERROR", "wrapped: ERROR"]);
		});
	});

	describe("Result.try", () => {
		test("returns Ok when function succeeds", () => {
			const result = Result.try(() => 42);
			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toBe(42);
		});

		test("returns Err when function throws", () => {
			const error = new Error("test error");
			const result = Result.try(() => {
				throw error;
			});
			expect(result.isErr()).toBe(true);
			expect(result.unwrapErr()).toBe(error);
		});

		test("catches non-Error thrown values", () => {
			const result = Result.try(() => {
				throw "string error";
			});
			expect(result.isErr()).toBe(true);
			expect(result.unwrapErr()).toBe("string error");
		});

		test("works with JSON.parse success", () => {
			const result = Result.try(() => JSON.parse('{"a": 1}'));
			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toEqual({ a: 1 });
		});

		test("works with JSON.parse failure", () => {
			const result = Result.try(() => JSON.parse("invalid json"));
			expect(result.isErr()).toBe(true);
			expect(result.unwrapErr()).toBeInstanceOf(SyntaxError);
		});

		test("preserves return type", () => {
			const result = Result.try(() => ({ name: "test", value: 123 }));
			expect(result.isOk()).toBe(true);
			const value = result.unwrap();
			expect(value.name).toBe("test");
			expect(value.value).toBe(123);
		});
	});
});
