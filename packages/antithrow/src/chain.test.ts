import { describe, expect, expectTypeOf, test } from "bun:test";
import { chain } from "./chain.js";
import type { Result } from "./result.js";
import { type Err, err, type Ok, ok } from "./result.js";
import { okAsync, type ResultAsync } from "./result-async.js";

describe("chain", () => {
	describe("sync", () => {
		test("returns Ok when all yields succeed", () => {
			const result = chain(function* () {
				const a = yield* ok(1);
				const b = yield* ok(2);
				const c = yield* ok(3);
				return a + b + c;
			});
			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toBe(6);
		});

		test("short-circuits on first Err", () => {
			const result = chain(function* () {
				const a = yield* ok(1);
				yield* err("oops");
				const c = yield* ok(3);
				return a + c;
			});
			expect(result.isErr()).toBe(true);
			expect(result.unwrapErr()).toBe("oops");
		});

		test("works with different error types", () => {
			const result = chain(function* () {
				const a = yield* ok<number, string>(1);
				const b = yield* ok<number, string>(2);
				return a + b;
			});
			expect(result.unwrap()).toBe(3);
		});

		test("can use results from external functions", () => {
			const divide = (a: number, b: number): Result<number, string> =>
				b === 0 ? err("division by zero") : ok(a / b);

			const result = chain(function* () {
				const a = yield* divide(10, 2);
				const b = yield* divide(a, 5);
				return b;
			});
			expect(result.unwrap()).toBe(1);
		});

		test("returns Err from external function", () => {
			const divide = (a: number, b: number): Result<number, string> =>
				b === 0 ? err("division by zero") : ok(a / b);

			const result = chain(function* () {
				const a = yield* divide(10, 0);
				return a;
			});
			expect(result.isErr()).toBe(true);
			expect(result.unwrapErr()).toBe("division by zero");
		});
	});

	describe("async", () => {
		test("returns Ok when all yields succeed", async () => {
			const result = await chain(async function* () {
				const a = yield* ok(1);
				const b = yield* ok(2);
				const c = yield* ok(3);
				return a + b + c;
			});
			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toBe(6);
		});

		test("works with ResultAsync values", async () => {
			const result = await chain(async function* () {
				const a = yield* ok(1);
				const b = yield* ok(2);
				return a + b;
			});
			expect(result.unwrap()).toBe(3);
		});

		test("short-circuits on first Err", async () => {
			const result = await chain(async function* () {
				const a = yield* ok(1);
				yield* err("oops");
				const c = yield* ok(3);
				return a + c;
			});
			expect(result.isErr()).toBe(true);
			expect(result.unwrapErr()).toBe("oops");
		});

		test("short-circuits on ResultAsync Err", async () => {
			const result = await chain(async function* () {
				const a = yield* ok(1);
				yield* err("async oops");
				return a;
			});
			expect(result.isErr()).toBe(true);
			expect(result.unwrapErr()).toBe("async oops");
		});

		test("can mix sync and async Results", async () => {
			const fetchValue = (): ResultAsync<number, string> => okAsync(10);

			const result = await chain(async function* () {
				const a = yield* ok(1);
				const b = yield* fetchValue();
				const c = yield* ok(3);
				return a + b + c;
			});
			expect(result.unwrap()).toBe(14);
		});

		test("works with real async operations", async () => {
			const delay = (ms: number): Promise<void> =>
				new Promise((resolve) => setTimeout(resolve, ms));

			const fetchData = async (id: number): Promise<Result<string, string>> => {
				await delay(1);
				return id > 0 ? ok(`data-${id}`) : err("invalid id");
			};

			const result = await chain(async function* () {
				const a = yield* await fetchData(1);
				const b = yield* await fetchData(2);
				return `${a}, ${b}`;
			});
			expect(result.unwrap()).toBe("data-1, data-2");
		});

		test("short-circuits on async operation error", async () => {
			const fetchData = async (id: number): Promise<Result<string, string>> =>
				id > 0 ? ok(`data-${id}`) : err("invalid id");

			const result = await chain(async function* () {
				const a = yield* await fetchData(1);
				yield* await fetchData(-1);
				return a;
			});
			expect(result.isErr()).toBe(true);
			expect(result.unwrapErr()).toBe("invalid id");
		});
	});

	describe("types", () => {
		test("sync chain returns Result<T, E>", () => {
			const result = chain(function* () {
				const a = yield* ok<number, string>(1);
				return a;
			});
			expectTypeOf(result).toEqualTypeOf<Result<number, string>>();
		});

		test("sync chain return type is inferred from generator return", () => {
			const result = chain(function* () {
				const a = yield* ok(1);
				const b = yield* ok("hello");
				return { num: a, str: b };
			});
			expectTypeOf(result).toExtend<Result<{ num: number; str: string }, never>>();
		});

		test("sync chain error type is union of all yielded errors", () => {
			const result = chain(function* () {
				const a = yield* ok<number, "error1">(1);
				const b = yield* ok<string, "error2">("hello");
				return a + b.length;
			});
			expectTypeOf(result).toEqualTypeOf<Result<number, "error1" | "error2">>();
		});

		test("sync chain with mixed error types", () => {
			const divide = (a: number, b: number): Result<number, "divByZero"> =>
				b === 0 ? err("divByZero") : ok(a / b);
			const parse = (s: string): Result<number, "parseError"> =>
				Number.isNaN(Number(s)) ? err("parseError") : ok(Number(s));

			const result = chain(function* () {
				const a = yield* divide(10, 2);
				const b = yield* parse("5");
				return a + b;
			});
			expectTypeOf(result).toEqualTypeOf<Result<number, "divByZero" | "parseError">>();
		});

		test("async chain returns ResultAsync<T, E>", async () => {
			const result = chain(async function* () {
				const a = yield* ok<number, string>(1);
				return a;
			});
			expectTypeOf(result).toEqualTypeOf<ResultAsync<number, string>>();
		});

		test("async chain return type is inferred from generator return", async () => {
			const result = chain(async function* () {
				const a = yield* ok(1);
				const b = yield* ok("hello");
				return { num: a, str: b };
			});
			expectTypeOf(result).toExtend<ResultAsync<{ num: number; str: string }, never>>();
		});

		test("async chain error type is union of all yielded errors", async () => {
			const result = chain(async function* () {
				const a = yield* ok<number, "error1">(1);
				const b = yield* okAsync<string, "error2">("hello");
				return a + b.length;
			});
			expectTypeOf(result).toEqualTypeOf<ResultAsync<number, "error1" | "error2">>();
		});

		test("async chain with ResultAsync values", async () => {
			const fetchNumber = (): ResultAsync<number, "fetchError"> => okAsync(42);
			const fetchString = (): ResultAsync<string, "fetchError2"> => okAsync("hello");

			const result = chain(async function* () {
				const a = yield* fetchNumber();
				const b = yield* fetchString();
				return `${a}: ${b}`;
			});
			expectTypeOf(result).toEqualTypeOf<ResultAsync<string, "fetchError" | "fetchError2">>();
		});

		test("yielded value type is extracted from Result", () => {
			chain(function* () {
				const a = yield* ok<number, string>(1);
				expectTypeOf(a).toEqualTypeOf<number>();

				const b = yield* ok<{ x: number }, string>({ x: 1 });
				expectTypeOf(b).toEqualTypeOf<{ x: number }>();

				return a + b.x;
			});
		});

		test("yielded value type is extracted from ResultAsync", async () => {
			await chain(async function* () {
				const a = yield* okAsync<number, string>(1);
				expectTypeOf(a).toEqualTypeOf<number>();

				const b = yield* okAsync<{ x: number }, string>({ x: 1 });
				expectTypeOf(b).toEqualTypeOf<{ x: number }>();

				return a + b.x;
			});
		});

		test("Ok and Err are properly discriminated", () => {
			const result = chain(function* () {
				const a = yield* ok(1);
				return a;
			});

			if (result.isOk()) {
				expectTypeOf(result).toEqualTypeOf<Ok<number, never>>();
				expectTypeOf(result.value).toEqualTypeOf<number>();
			} else {
				expectTypeOf(result).toEqualTypeOf<Err<number, never>>();
				expectTypeOf(result.error).toEqualTypeOf<never>();
			}
		});

		test("chain with never error returns Result<T, never>", () => {
			const result = chain(function* () {
				const a = yield* ok(1);
				const b = yield* ok(2);
				return a + b;
			});
			expectTypeOf(result).toEqualTypeOf<Result<number, never>>();
		});

		test("async chain with never error returns ResultAsync<T, never>", async () => {
			const result = chain(async function* () {
				const a = yield* ok(1);
				const b = yield* ok(2);
				return a + b;
			});
			expectTypeOf(result).toEqualTypeOf<ResultAsync<number, never>>();
		});

		test("awaited async chain result is Result<T, E>", async () => {
			const resultAsync = chain(async function* () {
				const a = yield* ok<number, string>(1);
				return a;
			});
			const result = await resultAsync;
			expectTypeOf(result).toEqualTypeOf<Result<number, string>>();
		});

		test("chain preserves complex return types", () => {
			const result = chain(function* () {
				const a = yield* ok([1, 2, 3] as const);
				const b = yield* ok({ nested: { value: "test" } } as const);
				return { array: a, object: b };
			});
			expectTypeOf(result).toExtend<
				Result<
					{
						array: readonly [1, 2, 3];
						object: { readonly nested: { readonly value: "test" } };
					},
					never
				>
			>();
		});
	});
});
