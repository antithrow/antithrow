import { describe, expect, expectTypeOf, test } from "bun:test";
import type { Result } from "./result.js";
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

		test("creates an Ok value with no arguments", async () => {
			const result = okAsync();
			expect(await result.isOk()).toBe(true);
			expect(await result.isErr()).toBe(false);
			expect(await result.unwrap()).toBeUndefined();
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
			expect(result.unwrap()).rejects.toThrow("Called unwrap on an Err value: error");
		});
	});

	describe("unwrapErr", () => {
		test("returns error for Err", async () => {
			const result = errAsync("error");
			expect(await result.unwrapErr()).toBe("error");
		});

		test("throws for Ok", async () => {
			const result = okAsync(42);
			expect(result.unwrapErr()).rejects.toThrow("Called unwrapErr on an Ok value: 42");
		});
	});

	describe("expect", () => {
		test("returns value for Ok", async () => {
			const result = okAsync(42);
			expect(await result.expect("should be ok")).toBe(42);
		});

		test("throws for Err with message", async () => {
			const result = errAsync("error");
			expect(result.expect("missing value")).rejects.toThrow("missing value");
		});
	});

	describe("expectErr", () => {
		test("returns error for Err", async () => {
			const result = errAsync("error");
			expect(await result.expectErr("should be error")).toBe("error");
		});

		test("throws for Ok with message", async () => {
			const result = okAsync(42);
			expect(result.expectErr("expected error")).rejects.toThrow("expected error");
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
			const result = errAsync<number, string>("error").mapErr((e) => e.toUpperCase());
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
			expect(await result.mapOr("default", (x) => `value: ${x}`)).toBe("value: 42");
		});

		test("returns default of different type for Err", async () => {
			const result = errAsync<number, string>("error");
			expect(await result.mapOr("default", (x) => `value: ${x}`)).toBe("default");
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
			const result = errAsync<number, string>("error").andThen((x) => ok(x * 2));
			expect(await result.isErr()).toBe(true);
			expect(await result.unwrapErr()).toBe("error");
		});

		test("can return Err from chain", async () => {
			const result = okAsync(42).andThen(() => err("new error"));
			expect(await result.isErr()).toBe(true);
			expect(await result.unwrapErr()).toBe("new error");
		});
	});

	describe("and", () => {
		test("returns next result for Ok", async () => {
			const result = okAsync(42).and(ok("next"));
			expect(await result.unwrap()).toBe("next");
		});

		test("returns next async result for Ok", async () => {
			const result = okAsync(42).and(okAsync("next"));
			expect(await result.unwrap()).toBe("next");
		});

		test("short-circuits on Err", async () => {
			const result = errAsync<number, string>("error");
			const chained = result.and(ok("next"));
			expect(await chained.isErr()).toBe(true);
			expect(await chained.unwrapErr()).toBe("error");
		});
	});

	describe("or", () => {
		test("keeps Ok result", async () => {
			const result = okAsync<number, string>(42).or(ok(0));
			expect(await result.unwrap()).toBe(42);
		});

		test("returns fallback for Err", async () => {
			const result = errAsync<number, string>("error");
			const recovered = result.or(ok(0));
			expect(await recovered.unwrap()).toBe(0);
		});

		test("returns async fallback for Err", async () => {
			const result = errAsync<number, string>("error");
			const recovered = result.or(okAsync(0));
			expect(await recovered.unwrap()).toBe(0);
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
			const result = errAsync<number, string>("error").orElse((e) => err(e.length));
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

	describe("ResultAsync.fromResult", () => {
		test("wraps Ok result", async () => {
			const syncResult = ok(42);
			const result = ResultAsync.fromResult(syncResult);
			expect(await result.isOk()).toBe(true);
			expect(await result.unwrap()).toBe(42);
		});

		test("wraps Err result", async () => {
			const syncResult = err("error");
			const result = ResultAsync.fromResult(syncResult);
			expect(await result.isErr()).toBe(true);
			expect(await result.unwrapErr()).toBe("error");
		});

		test("can be chained with map", async () => {
			const syncResult = ok(21);
			const result = ResultAsync.fromResult(syncResult).map((x) => x * 2);
			expect(await result.unwrap()).toBe(42);
		});

		test("can be chained with andThen", async () => {
			const syncResult = ok(21);
			const result = ResultAsync.fromResult(syncResult).andThen((x) => okAsync(x * 2));
			expect(await result.unwrap()).toBe(42);
		});
	});

	describe("ResultAsync.fromPromise", () => {
		test("wraps Promise<Ok>", async () => {
			const promise = Promise.resolve(ok(42));
			const result = ResultAsync.fromPromise(promise);
			expect(await result.isOk()).toBe(true);
			expect(await result.unwrap()).toBe(42);
		});

		test("wraps Promise<Err>", async () => {
			const promise = Promise.resolve(err("error"));
			const result = ResultAsync.fromPromise(promise);
			expect(await result.isErr()).toBe(true);
			expect(await result.unwrapErr()).toBe("error");
		});

		test("can be chained with map", async () => {
			const promise = Promise.resolve(ok(21));
			const result = ResultAsync.fromPromise(promise).map((x) => x * 2);
			expect(await result.unwrap()).toBe(42);
		});

		test("can be chained with andThen", async () => {
			const promise = Promise.resolve(ok(21));
			const result = ResultAsync.fromPromise(promise).andThen((x) => okAsync(x * 2));
			expect(await result.unwrap()).toBe(42);
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
			const result = ResultAsync.try(async () => 21).andThen((x) => okAsync(x * 2));
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

	describe("types", () => {
		test("okAsync returns ResultAsync<T, E>", () => {
			const result = okAsync(42);
			expectTypeOf(result).toEqualTypeOf<ResultAsync<number, never>>();
		});

		test("okAsync with no arguments returns ResultAsync<void, E>", () => {
			const result = okAsync();
			expectTypeOf(result).toEqualTypeOf<ResultAsync<void, never>>();
		});

		test("okAsync with explicit error type", () => {
			const result = okAsync<number, string>(42);
			expectTypeOf(result).toEqualTypeOf<ResultAsync<number, string>>();
		});

		test("errAsync returns ResultAsync<T, E>", () => {
			const result = errAsync("error");
			expectTypeOf(result).toEqualTypeOf<ResultAsync<never, string>>();
		});

		test("errAsync with explicit value type", () => {
			const result = errAsync<number, string>("error");
			expectTypeOf(result).toEqualTypeOf<ResultAsync<number, string>>();
		});

		test("awaited ResultAsync is Result<T, E>", async () => {
			const resultAsync = okAsync<number, string>(42);
			const result = await resultAsync;
			expectTypeOf(result).toEqualTypeOf<Result<number, string>>();
		});

		test("isOk returns Promise<boolean>", () => {
			const result = okAsync(42);
			expectTypeOf(result.isOk()).toEqualTypeOf<Promise<boolean>>();
		});

		test("isErr returns Promise<boolean>", () => {
			const result = errAsync("error");
			expectTypeOf(result.isErr()).toEqualTypeOf<Promise<boolean>>();
		});

		test("unwrap returns Promise<T>", () => {
			const result = okAsync(42);
			expectTypeOf(result.unwrap()).toEqualTypeOf<Promise<number>>();
		});

		test("unwrapErr returns Promise<E>", () => {
			const result = errAsync("error");
			expectTypeOf(result.unwrapErr()).toEqualTypeOf<Promise<string>>();
		});

		test("expect returns Promise<T>", () => {
			const result = okAsync(42);
			expectTypeOf(result.expect("expected")).toEqualTypeOf<Promise<number>>();
		});

		test("expectErr returns Promise<E>", () => {
			const result = errAsync("error");
			expectTypeOf(result.expectErr("expected")).toEqualTypeOf<Promise<string>>();
		});

		test("unwrapOr returns Promise<T>", () => {
			const result = okAsync<number, string>(42);
			expectTypeOf(result.unwrapOr(0)).toEqualTypeOf<Promise<number>>();
		});

		test("unwrapOrElse returns Promise<T>", () => {
			const result = okAsync<number, string>(42);
			expectTypeOf(result.unwrapOrElse(() => 0)).toEqualTypeOf<Promise<number>>();
		});

		test("map transforms value type", () => {
			const result = okAsync(42);
			const mapped = result.map((x) => x.toString());
			expectTypeOf(mapped).toEqualTypeOf<ResultAsync<string, never>>();
		});

		test("map preserves error type", () => {
			const result = okAsync<number, string>(42);
			const mapped = result.map((x) => x * 2);
			expectTypeOf(mapped).toEqualTypeOf<ResultAsync<number, string>>();
		});

		test("mapErr transforms error type", () => {
			const result = errAsync<number, string>("error");
			const mapped = result.mapErr((e) => e.length);
			expectTypeOf(mapped).toEqualTypeOf<ResultAsync<number, number>>();
		});

		test("mapErr preserves value type", () => {
			const result = okAsync<number, string>(42);
			const mapped = result.mapErr((e) => e.length);
			expectTypeOf(mapped).toEqualTypeOf<ResultAsync<number, number>>();
		});

		test("mapOr returns Promise<U>", () => {
			const result = okAsync<number, string>(42);
			const mapped = result.mapOr("default", (x) => x.toString());
			expectTypeOf(mapped).toEqualTypeOf<Promise<string>>();
		});

		test("mapOrElse returns Promise<U>", () => {
			const result = okAsync<number, string>(42);
			const mapped = result.mapOrElse(
				(e) => e.toUpperCase(),
				(x) => x.toString(),
			);
			expectTypeOf(mapped).toEqualTypeOf<Promise<string>>();
		});

		test("andThen with Result transforms types", () => {
			const result = okAsync<number, "e1">(42);
			const chained = result.andThen((x) => ok<string, "e2">(x.toString()));
			expectTypeOf(chained).toEqualTypeOf<ResultAsync<string, "e1" | "e2">>();
		});

		test("andThen with ResultAsync transforms types", () => {
			const result = okAsync<number, "e1">(42);
			const chained = result.andThen((x) => okAsync<string, "e2">(x.toString()));
			expectTypeOf(chained).toEqualTypeOf<ResultAsync<string, "e1" | "e2">>();
		});

		test("andThen can return Err", () => {
			const result = okAsync(42);
			const chained = result.andThen(() => err<string, "newErr">("newErr"));
			expectTypeOf(chained).toEqualTypeOf<ResultAsync<string, never | "newErr">>();
		});

		test("and transforms value type and unions error types", () => {
			const result = okAsync<number, "e1">(42);
			const chained = result.and(ok<string, "e2">("next"));
			expectTypeOf(chained).toEqualTypeOf<ResultAsync<string, "e1" | "e2">>();
		});

		test("or can return Ok", () => {
			const result = errAsync<number, string>("error");
			const recovered = result.or(ok<number, never>(0));
			expectTypeOf(recovered).toEqualTypeOf<ResultAsync<number, never>>();
		});

		test("orElse with Result transforms error type", () => {
			const result = errAsync<number, string>("error");
			const recovered = result.orElse((e) => err<number, number>(e.length));
			expectTypeOf(recovered).toEqualTypeOf<ResultAsync<number, number>>();
		});

		test("orElse with ResultAsync transforms error type", () => {
			const result = errAsync<number, string>("error");
			const recovered = result.orElse((e) => errAsync<number, number>(e.length));
			expectTypeOf(recovered).toEqualTypeOf<ResultAsync<number, number>>();
		});

		test("orElse can return Ok", () => {
			const result = errAsync<number, string>("error");
			const recovered = result.orElse(() => ok<number, never>(0));
			expectTypeOf(recovered).toEqualTypeOf<ResultAsync<number, never>>();
		});

		test("match returns Promise<U>", () => {
			const result = okAsync<number, string>(42);
			const matched = result.match({
				ok: (x) => `value: ${x}`,
				err: (e) => `error: ${e}`,
			});
			expectTypeOf(matched).toEqualTypeOf<Promise<string>>();
		});

		test("inspect returns same ResultAsync type", () => {
			const result = okAsync<number, string>(42);
			const inspected = result.inspect(() => {});
			expectTypeOf(inspected).toEqualTypeOf<ResultAsync<number, string>>();
		});

		test("inspectErr returns same ResultAsync type", () => {
			const result = errAsync<number, string>("error");
			const inspected = result.inspectErr(() => {});
			expectTypeOf(inspected).toEqualTypeOf<ResultAsync<number, string>>();
		});

		test("ResultAsync.try returns ResultAsync<T, unknown>", () => {
			const result = ResultAsync.try(async () => 42);
			expectTypeOf(result).toEqualTypeOf<ResultAsync<number, unknown>>();
		});

		test("ResultAsync.try with explicit error type", () => {
			const result = ResultAsync.try<number, Error>(async () => 42);
			expectTypeOf(result).toEqualTypeOf<ResultAsync<number, Error>>();
		});

		test("ResultAsync.fromResult preserves types", () => {
			const syncResult = ok<number, string>(42);
			const result = ResultAsync.fromResult(syncResult);
			expectTypeOf(result).toEqualTypeOf<ResultAsync<number, string>>();
		});

		test("ResultAsync.fromPromise preserves types", () => {
			const promise = Promise.resolve(ok<number, string>(42));
			const result = ResultAsync.fromPromise(promise);
			expectTypeOf(result).toEqualTypeOf<ResultAsync<number, string>>();
		});

		test("chained operations preserve types", () => {
			const result = okAsync<number, "initial">(42)
				.map((x) => x.toString())
				.mapErr((e) => `wrapped: ${e}` as const)
				.andThen((s) => okAsync<number, "parse">(s.length));
			expectTypeOf(result).toEqualTypeOf<ResultAsync<number, "wrapped: initial" | "parse">>();
		});

		test("ResultAsync is PromiseLike<Result<T, E>>", () => {
			const result = okAsync<number, string>(42);
			expectTypeOf(result).toExtend<PromiseLike<Result<number, string>>>();
		});

		test("can use with Promise.all and get Result array", async () => {
			const results = await Promise.all([okAsync<number, string>(1), okAsync<number, string>(2)]);
			expectTypeOf(results).toEqualTypeOf<[Result<number, string>, Result<number, string>]>();
		});
	});
});
