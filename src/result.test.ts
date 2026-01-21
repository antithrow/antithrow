import { describe, expect, test } from "bun:test";
import type { Result } from "./result.js";
import { err, ok } from "./result.js";

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
});
