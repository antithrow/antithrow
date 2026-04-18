import { describe, expect, expectTypeOf, test } from "bun:test";
import type { Err, Ok } from "./result.js";
import { err, ok, Result } from "./result.js";
import type { ResultAsync } from "./result-async.js";

describe("Result", () => {
	describe("ok", () => {
		test("creates an Ok value", () => {
			const result = ok(42);
			expect(result.isOk()).toBe(true);
			expect(result.isErr()).toBe(false);
			expect(result.value).toBe(42);
		});

		test("creates an Ok value with no arguments", () => {
			const result = ok();
			expect(result.isOk()).toBe(true);
			expect(result.isErr()).toBe(false);
			expect(result.value).toBeUndefined();
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

	describe("isOkAnd", () => {
		test("returns true for Ok when predicate passes", () => {
			const result = ok(42);
			expect(result.isOkAnd((x) => x > 10)).toBe(true);
		});

		test("returns false for Ok when predicate fails", () => {
			const result = ok(5);
			expect(result.isOkAnd((x) => x > 10)).toBe(false);
		});

		test("returns false for Err", () => {
			const result: Result<number, string> = err("error");
			expect(result.isOkAnd((x) => x > 10)).toBe(false);
		});
	});

	describe("isErrAnd", () => {
		test("returns true for Err when predicate passes", () => {
			const result = err("error");
			expect(result.isErrAnd((e) => e.length > 3)).toBe(true);
		});

		test("returns false for Err when predicate fails", () => {
			const result = err("e");
			expect(result.isErrAnd((e) => e.length > 3)).toBe(false);
		});

		test("returns false for Ok", () => {
			const result = ok<number, string>(42);
			expect(result.isErrAnd((e) => e.length > 3)).toBe(false);
		});
	});

	describe("unwrap", () => {
		test("returns value for Ok", () => {
			const result = ok(42);
			expect(result.unwrap()).toBe(42);
		});

		test("throws for Err", () => {
			const result = err("error");
			expect(() => result.unwrap()).toThrow("Called unwrap on an Err value: error");
		});
	});

	describe("unwrapErr", () => {
		test("returns error for Err", () => {
			const result = err("error");
			expect(result.unwrapErr()).toBe("error");
		});

		test("throws for Ok", () => {
			const result = ok(42);
			expect(() => result.unwrapErr()).toThrow("Called unwrapErr on an Ok value: 42");
		});
	});

	describe("expect", () => {
		test("returns value for Ok", () => {
			const result = ok(42);
			expect(result.expect("should be ok")).toBe(42);
		});

		test("throws for Err with message", () => {
			const result = err("error");
			expect(() => result.expect("missing value")).toThrow("missing value");
		});
	});

	describe("expectErr", () => {
		test("returns error for Err", () => {
			const result = err("error");
			expect(result.expectErr("should be error")).toBe("error");
		});

		test("throws for Ok with message", () => {
			const result = ok(42);
			expect(() => result.expectErr("expected error")).toThrow("expected error");
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

	describe("and", () => {
		test("returns next result for Ok", () => {
			const result = ok(42).and(ok("next"));
			expect(result.unwrap()).toBe("next");
		});

		test("short-circuits on Err", () => {
			const result: Result<number, string> = err("error");
			const chained = result.and(ok("next"));
			expect(chained.isErr()).toBe(true);
			expect(chained.unwrapErr()).toBe("error");
		});
	});

	describe("or", () => {
		test("keeps Ok result", () => {
			const result = ok<number, string>(42).or(ok(0));
			expect(result.unwrap()).toBe(42);
		});

		test("returns fallback for Err", () => {
			const result: Result<number, string> = err("error");
			const recovered = result.or(ok(0));
			expect(recovered.unwrap()).toBe(0);
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

	describe("flatten", () => {
		test("flattens Ok(Ok(value)) to Ok(value)", () => {
			const result = ok(ok(42)).flatten();
			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toBe(42);
		});

		test("flattens Ok(Err(error)) to Err(error)", () => {
			const result = ok(err("inner")).flatten();
			expect(result.isErr()).toBe(true);
			expect(result.unwrapErr()).toBe("inner");
		});

		test("flattens Err to Err", () => {
			const result: Result<Result<number, string>, string> = err("outer");
			const flattened = result.flatten();
			expect(flattened.isErr()).toBe(true);
			expect(flattened.unwrapErr()).toBe("outer");
		});

		test("preserves inner value types", () => {
			const inner = ok({ a: 1, b: "hello" });
			const result = ok(inner).flatten();
			expect(result.unwrap()).toEqual({ a: 1, b: "hello" });
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

	describe("toAsync", () => {
		test("converts Ok to ResultAsync", async () => {
			const result = ok(42).toAsync();
			expect(await result.isOk()).toBe(true);
			expect(await result.unwrap()).toBe(42);
		});

		test("converts Err to ResultAsync", async () => {
			const result = err("error").toAsync();
			expect(await result.isErr()).toBe(true);
			expect(await result.unwrapErr()).toBe("error");
		});

		test("can chain with async map after conversion", async () => {
			const result = ok(42)
				.toAsync()
				.map(async (x) => x * 2);
			expect(await result.unwrap()).toBe(84);
		});

		test("can chain with async andThen after conversion", async () => {
			const result = ok(42)
				.toAsync()
				.andThen(async (x) => ok(x * 2));
			expect(await result.unwrap()).toBe(84);
		});

		test("can chain with async mapErr after conversion", async () => {
			const result = err("oops")
				.toAsync()
				.mapErr(async (e) => e.toUpperCase());
			expect(await result.unwrapErr()).toBe("OOPS");
		});
	});

	describe("types", () => {
		test("ok returns Ok<T, E>", () => {
			const result = ok(42);
			expectTypeOf(result).toEqualTypeOf<Ok<number, never>>();
		});

		test("ok with no arguments returns Ok<void, E>", () => {
			const result = ok();
			expectTypeOf(result).toEqualTypeOf<Ok<void, never>>();
		});

		test("ok with explicit error type", () => {
			const result = ok<number, string>(42);
			expectTypeOf(result).toEqualTypeOf<Ok<number, string>>();
		});

		test("err returns Err<T, E>", () => {
			const result = err("error");
			expectTypeOf(result).toEqualTypeOf<Err<never, string>>();
		});

		test("err with explicit value type", () => {
			const result = err<number, string>("error");
			expectTypeOf(result).toEqualTypeOf<Err<number, string>>();
		});

		test("Result is union of Ok and Err", () => {
			const result: Result<number, string> = ok(42);
			expectTypeOf(result).toExtend<Ok<number, string> | Err<number, string>>();
		});

		test("isOk narrows to Ok", () => {
			const result: Result<number, string> = ok(42);
			if (result.isOk()) {
				expectTypeOf(result).toEqualTypeOf<Ok<number, string>>();
				expectTypeOf(result.value).toEqualTypeOf<number>();
			}
		});

		test("isErr narrows to Err", () => {
			const result: Result<number, string> = err("error");
			if (result.isErr()) {
				expectTypeOf(result).toEqualTypeOf<Err<number, string>>();
				expectTypeOf(result.error).toEqualTypeOf<string>();
			}
		});

		test("isOkAnd returns boolean", () => {
			const result: Result<number, string> = ok(42);
			expectTypeOf(result.isOkAnd((x) => x > 0)).toEqualTypeOf<boolean>();
		});

		test("isOkAnd narrows type with type predicate", () => {
			const result: Result<string | number, Error> = ok(42);
			if (result.isOkAnd((v): v is number => typeof v === "number")) {
				expectTypeOf(result).toEqualTypeOf<Ok<number, Error>>();
				expectTypeOf(result.value).toEqualTypeOf<number>();
			}
		});

		test("isErrAnd returns boolean", () => {
			const result: Result<number, string> = err("error");
			expectTypeOf(result.isErrAnd((e) => e.length > 0)).toEqualTypeOf<boolean>();
		});

		test("isErrAnd narrows type with type predicate", () => {
			const result: Result<number, Error | string> = err(new Error("fail"));
			if (result.isErrAnd((e): e is Error => e instanceof Error)) {
				expectTypeOf(result).toEqualTypeOf<Err<number, Error>>();
				expectTypeOf(result.error).toEqualTypeOf<Error>();
			}
		});

		test("unwrap returns T", () => {
			const result = ok(42);
			expectTypeOf(result.unwrap()).toEqualTypeOf<number>();
		});

		test("unwrapErr returns E", () => {
			const result = err("error");
			expectTypeOf(result.unwrapErr()).toEqualTypeOf<string>();
		});

		test("expect returns T", () => {
			const result = ok(42);
			expectTypeOf(result.expect("expected")).toEqualTypeOf<number>();
		});

		test("expectErr returns E", () => {
			const result = err("error");
			expectTypeOf(result.expectErr("expected")).toEqualTypeOf<string>();
		});

		test("unwrapOr returns T", () => {
			const result: Result<number, string> = ok(42);
			expectTypeOf(result.unwrapOr(0)).toEqualTypeOf<number>();
		});

		test("unwrapOrElse returns T", () => {
			const result: Result<number, string> = ok(42);
			expectTypeOf(result.unwrapOrElse(() => 0)).toEqualTypeOf<number>();
		});

		test("map transforms value type", () => {
			const result = ok(42);
			const mapped = result.map((x) => x.toString());
			expectTypeOf(mapped).toEqualTypeOf<Result<string, never>>();
		});

		test("map preserves error type", () => {
			const result: Result<number, string> = ok(42);
			const mapped = result.map((x) => x * 2);
			expectTypeOf(mapped).toEqualTypeOf<Result<number, string>>();
		});

		test("mapErr transforms error type", () => {
			const result: Result<number, string> = err("error");
			const mapped = result.mapErr((e) => e.length);
			expectTypeOf(mapped).toEqualTypeOf<Result<number, number>>();
		});

		test("mapErr preserves value type", () => {
			const result = ok<number, string>(42);
			const mapped = result.mapErr((e) => e.length);
			expectTypeOf(mapped).toEqualTypeOf<Result<number, number>>();
		});

		test("mapOr returns U", () => {
			const result: Result<number, string> = ok(42);
			const mapped = result.mapOr("default", (x) => x.toString());
			expectTypeOf(mapped).toEqualTypeOf<string>();
		});

		test("mapOrElse returns U", () => {
			const result: Result<number, string> = ok(42);
			const mapped = result.mapOrElse(
				(e) => e.toUpperCase(),
				(x) => x.toString(),
			);
			expectTypeOf(mapped).toEqualTypeOf<string>();
		});

		test("andThen transforms value type and unions error types", () => {
			const result = ok<number, "e1">(42);
			const chained = result.andThen((x) => ok<string, "e2">(x.toString()));
			expectTypeOf(chained).toEqualTypeOf<Result<string, "e1" | "e2">>();
		});

		test("andThen can return Err", () => {
			const result = ok(42);
			const chained = result.andThen(() => err<string, "newErr">("newErr"));
			expectTypeOf(chained).toEqualTypeOf<Result<string, never | "newErr">>();
		});

		test("and transforms value type and unions error types", () => {
			const result = ok<number, "e1">(42);
			const chained = result.and(ok<string, "e2">("next"));
			expectTypeOf(chained).toEqualTypeOf<Result<string, "e1" | "e2">>();
		});

		test("or can return Ok", () => {
			const result: Result<number, string> = err("error");
			const recovered = result.or(ok<number, never>(0));
			expectTypeOf(recovered).toEqualTypeOf<Result<number, never>>();
		});

		test("orElse transforms error type", () => {
			const result: Result<number, string> = err("error");
			const recovered = result.orElse((e) => err<number, number>(e.length));
			expectTypeOf(recovered).toEqualTypeOf<Result<number, number>>();
		});

		test("orElse can return Ok", () => {
			const result: Result<number, string> = err("error");
			const recovered = result.orElse(() => ok<number, never>(0));
			expectTypeOf(recovered).toEqualTypeOf<Result<number, never>>();
		});

		test("match returns U", () => {
			const result: Result<number, string> = ok(42);
			const matched = result.match({
				ok: (x) => `value: ${x}`,
				err: (e) => `error: ${e}`,
			});
			expectTypeOf(matched).toEqualTypeOf<string>();
		});

		test("inspect returns same Result type", () => {
			const result = ok<number, string>(42);
			const inspected = result.inspect(() => {});
			expectTypeOf(inspected).toEqualTypeOf<Result<number, string>>();
		});

		test("inspectErr returns same Result type", () => {
			const result = err<number, string>("error");
			const inspected = result.inspectErr(() => {});
			expectTypeOf(inspected).toEqualTypeOf<Result<number, string>>();
		});

		test("toAsync returns ResultAsync<T, E>", () => {
			const result: Result<number, string> = ok(42);
			const async_ = result.toAsync();
			expectTypeOf(async_).toEqualTypeOf<ResultAsync<number, string>>();
		});

		test("Result.try returns Result<T, E>", () => {
			const result = Result.try(() => 42);
			expectTypeOf(result).toEqualTypeOf<Result<number, unknown>>();
		});

		test("Result.try with explicit error type", () => {
			const result = Result.try<number, Error>(() => 42);
			expectTypeOf(result).toEqualTypeOf<Result<number, Error>>();
		});

		test("chained operations preserve types", () => {
			const result = ok<number, "initial">(42)
				.map((x) => x.toString())
				.mapErr((e) => `wrapped: ${e}` as const)
				.andThen((s) => ok<number, "parse">(s.length));
			expectTypeOf(result).toEqualTypeOf<Result<number, "wrapped: initial" | "parse">>();
		});

		test("Ok.value is T", () => {
			const result = ok({ a: 1, b: "hello" });
			expectTypeOf(result.value).toEqualTypeOf<{ a: number; b: string }>();
		});

		test("Err.error is E", () => {
			const result = err({ code: 404, message: "Not found" });
			expectTypeOf(result.error).toEqualTypeOf<{
				code: number;
				message: string;
			}>();
		});

		test("flatten returns Result<U, E | F>", () => {
			const result = ok<Result<number, "inner">, "outer">(ok(42));
			const flattened = result.flatten();
			expectTypeOf(flattened).toEqualTypeOf<Result<number, "outer" | "inner">>();
		});

		test("flatten on Err preserves outer error type", () => {
			const result: Result<Result<number, "inner">, "outer"> = err("outer");
			const flattened = result.flatten();
			expectTypeOf(flattened).toEqualTypeOf<Result<number, "outer" | "inner">>();
		});

		test("andThen infers unified Err union on inferred Ok | Err receiver", () => {
			const sync1 = (bool: boolean) => (bool ? ok(true) : err("bad" as const));
			const sync2 = (bool2: boolean) => (bool2 ? ok(100) : err("terrible" as const));

			const chained = (bool: boolean) => sync1(bool).andThen((result) => sync2(result));

			expectTypeOf(chained(true)).toEqualTypeOf<Result<number, "bad" | "terrible">>();
		});

		test("all infers tuple Ok type", () => {
			const result = Result.all([ok(1), ok("hello")]);
			if (result.isOk()) {
				expectTypeOf(result.value).toHaveProperty("length");
				expectTypeOf(result.value[0]).toBeNumber();
				expectTypeOf(result.value[1]).toBeString();
			}
		});

		test("all infers union of Err types", () => {
			const result = Result.all([ok<number, "a">(1), ok<string, "b">("hi")]);
			if (result.isErr()) {
				expectTypeOf(result.error).toEqualTypeOf<"a" | "b">();
			}
		});

		test("all infers array type for homogeneous array", () => {
			const results: Result<number, string>[] = [ok(1), ok(2)];
			const result = Result.all(results);
			expectTypeOf(result).toEqualTypeOf<Result<number[], string>>();
		});
	});

	describe("all", () => {
		test("returns Ok with tuple of values when all are Ok", () => {
			const result = Result.all([ok(1), ok("hello"), ok(true)]);
			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toEqual([1, "hello", true]);
		});

		test("returns the first Err encountered", () => {
			const e = err("bad");
			const result = Result.all([ok(1), e, ok(3)]);
			expect(result.isErr()).toBe(true);
			expect(result.unwrapErr()).toBe("bad");
		});

		test("returns the same Err instance", () => {
			const e = err("bad");
			const result = Result.all([ok(1), e, ok(3)]);
			expect(result).toBe(e);
		});

		test("short-circuits on first Err", () => {
			const e1 = err("first");
			const e2 = err("second");
			const result = Result.all([ok(1), e1, e2]);
			expect(result.unwrapErr()).toBe("first");
		});

		test("returns Ok with empty array for empty input", () => {
			const result = Result.all([]);
			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toEqual([]);
		});

		test("works with homogeneous array input", () => {
			const results: Result<number, string>[] = [ok(1), ok(2), ok(3)];
			const result = Result.all(results);
			expect(result.unwrap()).toEqual([1, 2, 3]);
		});
	});
});
