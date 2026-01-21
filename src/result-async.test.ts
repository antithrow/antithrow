import { describe, expect, test } from "bun:test";
import { err, ok } from "./result.js";
import { errAsync, okAsync, ResultAsync } from "./result-async.js";

describe("ResultAsync", () => {
	describe("okAsync", () => {
		test("creates an Ok value", async () => {
			const result = okAsync(42);
			expect(await result.isOk()).toBe(true);
			expect(await result.isErr()).toBe(false);
			expect(await result.unwrap()).toBe(42);
		});
	});

	describe("errAsync", () => {
		test("creates an Err value", async () => {
			const result = errAsync("error message");
			expect(await result.isOk()).toBe(false);
			expect(await result.isErr()).toBe(true);
			expect(await result.unwrapErr()).toBe("error message");
		});
	});

	describe("unwrap", () => {
		test("returns value for Ok", async () => {
			const result = okAsync(42);
			expect(await result.unwrap()).toBe(42);
		});

		test("throws for Err", async () => {
			const result = errAsync("error");
			expect(result.unwrap()).rejects.toThrow(
				"Called unwrap on an Err value: error",
			);
		});
	});

	describe("unwrapErr", () => {
		test("returns error for Err", async () => {
			const result = errAsync("error");
			expect(await result.unwrapErr()).toBe("error");
		});

		test("throws for Ok", async () => {
			const result = okAsync(42);
			expect(result.unwrapErr()).rejects.toThrow(
				"Called unwrapErr on an Ok value: 42",
			);
		});
	});

	describe("unwrapOr", () => {
		test("returns value for Ok", async () => {
			const result = okAsync(42);
			expect(await result.unwrapOr(0)).toBe(42);
		});

		test("returns default for Err", async () => {
			const result = errAsync<number, string>("error");
			expect(await result.unwrapOr(0)).toBe(0);
		});
	});

	describe("unwrapOrElse", () => {
		test("returns value for Ok", async () => {
			const result = okAsync(42);
			expect(await result.unwrapOrElse(() => 0)).toBe(42);
		});

		test("calls fn with error for Err", async () => {
			const result = errAsync<number, string>("error");
			expect(await result.unwrapOrElse((e) => e.length)).toBe(5);
		});
	});

	describe("map", () => {
		test("transforms Ok value", async () => {
			const result = okAsync(42).map((x) => x * 2);
			expect(await result.unwrap()).toBe(84);
		});

		test("does not transform Err", async () => {
			const result = errAsync<number, string>("error").map((x) => x * 2);
			expect(await result.isErr()).toBe(true);
			expect(await result.unwrapErr()).toBe("error");
		});
	});

	describe("mapErr", () => {
		test("does not transform Ok", async () => {
			const result = okAsync<number, string>(42).mapErr((e) => e.toUpperCase());
			expect(await result.isOk()).toBe(true);
			expect(await result.unwrap()).toBe(42);
		});

		test("transforms Err value", async () => {
			const result = errAsync<number, string>("error").mapErr((e) =>
				e.toUpperCase(),
			);
			expect(await result.unwrapErr()).toBe("ERROR");
		});
	});

	describe("mapOr", () => {
		test("transforms Ok value", async () => {
			const result = okAsync(2);
			expect(await result.mapOr(0, (x) => x * 2)).toBe(4);
		});

		test("returns default for Err", async () => {
			const result = errAsync<number, string>("error");
			expect(await result.mapOr(0, (x) => x * 2)).toBe(0);
		});

		test("can transform to different type", async () => {
			const result = okAsync(42);
			expect(await result.mapOr("default", (x) => `value: ${x}`)).toBe(
				"value: 42",
			);
		});

		test("returns default of different type for Err", async () => {
			const result = errAsync<number, string>("error");
			expect(await result.mapOr("default", (x) => `value: ${x}`)).toBe(
				"default",
			);
		});
	});

	describe("mapOrElse", () => {
		test("transforms Ok value", async () => {
			const result = okAsync<number, string>(2);
			expect(
				await result.mapOrElse(
					(e) => e.length,
					(x) => x * 2,
				),
			).toBe(4);
		});

		test("computes default from error for Err", async () => {
			const result = errAsync<number, string>("error");
			expect(
				await result.mapOrElse(
					(e) => e.length,
					(x) => x * 2,
				),
			).toBe(5);
		});

		test("can transform to different type", async () => {
			const result = okAsync<number, string>(42);
			expect(
				await result.mapOrElse(
					(e) => `error: ${e}`,
					(x) => `value: ${x}`,
				),
			).toBe("value: 42");
		});

		test("computes default of different type for Err", async () => {
			const result = errAsync<number, string>("oops");
			expect(
				await result.mapOrElse(
					(e) => `error: ${e}`,
					(x) => `value: ${x}`,
				),
			).toBe("error: oops");
		});
	});

	describe("andThen", () => {
		test("chains Ok values with sync Result", async () => {
			const result = okAsync(42).andThen((x) => ok(x * 2));
			expect(await result.unwrap()).toBe(84);
		});

		test("chains Ok values with ResultAsync", async () => {
			const result = okAsync(42).andThen((x) => okAsync(x * 2));
			expect(await result.unwrap()).toBe(84);
		});

		test("short-circuits on Err", async () => {
			const result = errAsync<number, string>("error").andThen((x) =>
				ok(x * 2),
			);
			expect(await result.isErr()).toBe(true);
			expect(await result.unwrapErr()).toBe("error");
		});

		test("can return Err from chain", async () => {
			const result = okAsync(42).andThen(() => err("new error"));
			expect(await result.isErr()).toBe(true);
			expect(await result.unwrapErr()).toBe("new error");
		});
	});

	describe("orElse", () => {
		test("does not call fn for Ok", async () => {
			const result = okAsync<number, string>(42).orElse(() => ok(0));
			expect(await result.unwrap()).toBe(42);
		});

		test("recovers from Err with sync Result", async () => {
			const result = errAsync<number, string>("error").orElse(() => ok(0));
			expect(await result.unwrap()).toBe(0);
		});

		test("recovers from Err with ResultAsync", async () => {
			const result = errAsync<number, string>("error").orElse(() => okAsync(0));
			expect(await result.unwrap()).toBe(0);
		});

		test("can return new Err from recovery", async () => {
			const result = errAsync<number, string>("error").orElse((e) =>
				err(e.length),
			);
			expect(await result.unwrapErr()).toBe(5);
		});
	});

	describe("match", () => {
		test("calls ok handler for Ok", async () => {
			const result = okAsync(42);
			const value = await result.match({
				ok: (x) => `value: ${x}`,
				err: (e) => `error: ${e}`,
			});
			expect(value).toBe("value: 42");
		});

		test("calls err handler for Err", async () => {
			const result = errAsync("oops");
			const value = await result.match({
				ok: (x) => `value: ${x}`,
				err: (e) => `error: ${e}`,
			});
			expect(value).toBe("error: oops");
		});
	});

	describe("inspect", () => {
		test("calls fn with value for Ok", async () => {
			let inspected: number | undefined;
			const result = okAsync(42).inspect((x) => {
				inspected = x;
			});
			expect(await result.unwrap()).toBe(42);
			expect(inspected).toBe(42);
		});

		test("does not call fn for Err", async () => {
			let called = false;
			const result = errAsync<number, string>("error").inspect(() => {
				called = true;
			});
			await result;
			expect(called).toBe(false);
		});

		test("can be chained", async () => {
			const values: number[] = [];
			const result = okAsync(1)
				.map((x) => x + 1)
				.inspect((x) => values.push(x))
				.map((x) => x * 2)
				.inspect((x) => values.push(x));
			expect(await result.unwrap()).toBe(4);
			expect(values).toEqual([2, 4]);
		});
	});

	describe("inspectErr", () => {
		test("does not call fn for Ok", async () => {
			let called = false;
			const result = okAsync(42).inspectErr(() => {
				called = true;
			});
			await result;
			expect(called).toBe(false);
		});

		test("calls fn with error for Err", async () => {
			let inspected: string | undefined;
			const result = errAsync("oops").inspectErr((e) => {
				inspected = e;
			});
			expect(await result.unwrapErr()).toBe("oops");
			expect(inspected).toBe("oops");
		});

		test("can be chained", async () => {
			const errors: string[] = [];
			const result = errAsync<number, string>("error")
				.mapErr((e) => e.toUpperCase())
				.inspectErr((e) => errors.push(e))
				.mapErr((e) => `wrapped: ${e}`)
				.inspectErr((e) => errors.push(e));
			await result;
			expect(errors).toEqual(["ERROR", "wrapped: ERROR"]);
		});
	});

	describe("PromiseLike", () => {
		test("can be awaited directly", async () => {
			const result = await okAsync(42);
			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toBe(42);
		});

		test("works with Promise.all", async () => {
			const results = await Promise.all([okAsync(1), okAsync(2), okAsync(3)]);
			expect(results.map((r) => r.unwrap())).toEqual([1, 2, 3]);
		});
	});

	describe("ResultAsync.try", () => {
		test("returns Ok when async function resolves", async () => {
			const result = ResultAsync.try(async () => 42);
			expect(await result.isOk()).toBe(true);
			expect(await result.unwrap()).toBe(42);
		});

		test("returns Err when async function throws", async () => {
			const error = new Error("test error");
			const result = ResultAsync.try(async () => {
				throw error;
			});
			expect(await result.isErr()).toBe(true);
			expect(await result.unwrapErr()).toBe(error);
		});

		test("returns Err when promise rejects", async () => {
			const error = new Error("rejected");
			const result = ResultAsync.try(() => Promise.reject(error));
			expect(await result.isErr()).toBe(true);
			expect(await result.unwrapErr()).toBe(error);
		});

		test("catches non-Error thrown values", async () => {
			const result = ResultAsync.try(async () => {
				throw "string error";
			});
			expect(await result.isErr()).toBe(true);
			expect(await result.unwrapErr()).toBe("string error");
		});

		test("works with async fetch-like operations", async () => {
			const result = ResultAsync.try(async () => {
				return { data: "fetched" };
			});
			expect(await result.isOk()).toBe(true);
			expect(await result.unwrap()).toEqual({ data: "fetched" });
		});

		test("can be chained with map", async () => {
			const result = ResultAsync.try(async () => 21).map((x) => x * 2);
			expect(await result.unwrap()).toBe(42);
		});

		test("can be chained with andThen", async () => {
			const result = ResultAsync.try(async () => 21).andThen((x) =>
				okAsync(x * 2),
			);
			expect(await result.unwrap()).toBe(42);
		});

		test("preserves error type through chain when function throws", async () => {
			const result = ResultAsync.try(async () => {
				throw new Error("initial error");
			}).map((x) => x);
			expect(await result.isErr()).toBe(true);
			expect((await result.unwrapErr()) as Error).toBeInstanceOf(Error);
		});
	});
});
