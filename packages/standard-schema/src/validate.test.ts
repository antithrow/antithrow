import { describe, expect, expectTypeOf, test } from "bun:test";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { Result, ResultAsync } from "antithrow";
import { validate, validateSync } from "./validate.js";

function createSchema<Output>(
	validateFn: StandardSchemaV1.Props<unknown, Output>["validate"],
): StandardSchemaV1<unknown, Output> {
	return {
		"~standard": {
			version: 1,
			vendor: "test",
			validate: validateFn,
		},
	};
}

describe("validate", () => {
	test("returns Ok for sync success", async () => {
		const schema = createSchema<number>(() => ({ value: 42 }));
		const result = await validate(schema, "anything");

		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toBe(42);
	});

	test("returns Err for sync failure", async () => {
		const schema = createSchema(() => ({
			issues: [{ message: "bad input" }],
		}));
		const result = await validate(schema, "anything");

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().issues).toHaveLength(1);
		expect(result.unwrapErr().issues[0]?.message).toBe("bad input");
	});

	test("returns Ok for async success", async () => {
		const schema = createSchema<string>(() => Promise.resolve({ value: "hello" }));
		const result = await validate(schema, "anything");

		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toBe("hello");
	});

	test("returns Err for async failure", async () => {
		const schema = createSchema(() =>
			Promise.resolve({
				issues: [{ message: "async bad" }, { message: "also bad" }],
			}),
		);
		const result = await validate(schema, "anything");

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().issues).toHaveLength(2);
		expect(result.unwrapErr().issues[0]?.message).toBe("async bad");
		expect(result.unwrapErr().issues[1]?.message).toBe("also bad");
	});

	test("wraps thrown exceptions in synthetic FailureResult", async () => {
		const schema = createSchema(() => {
			throw new Error("validator exploded");
		});
		const result = await validate(schema, "anything");

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().issues).toHaveLength(1);
		expect(result.unwrapErr().issues[0]?.message).toBe("validator exploded");
	});

	test("wraps rejected promises in synthetic FailureResult", async () => {
		const schema = createSchema(() => Promise.reject(new Error("async explosion")));
		const result = await validate(schema, "anything");

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().issues).toHaveLength(1);
		expect(result.unwrapErr().issues[0]?.message).toBe("async explosion");
	});

	test("wraps non-Error thrown values", async () => {
		const schema = createSchema(() => {
			throw "string error";
		});
		const result = await validate(schema, "anything");

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().issues[0]?.message).toBe("string error");
	});

	test("passes options through to the schema validator", async () => {
		let capturedOptions: StandardSchemaV1.Options | undefined;
		const schema = createSchema((_value, options) => {
			capturedOptions = options;
			return { value: true };
		});
		const opts: StandardSchemaV1.Options = { libraryOptions: { strict: true } };

		await validate(schema, "anything", opts);

		expect(capturedOptions).toEqual(opts);
	});

	test("preserves issue paths", async () => {
		const schema = createSchema(() => ({
			issues: [
				{ message: "no path" },
				{ message: "empty path", path: [] },
				{ message: "property key path", path: ["foo", 0, Symbol("bar")] },
				{ message: "path segment", path: [{ key: "nested" }] },
			],
		}));
		const result = await validate(schema, "anything");

		expect(result.isErr()).toBe(true);
		const issues = result.unwrapErr().issues;
		expect(issues).toHaveLength(4);
		expect(issues[0]?.path).toBeUndefined();
		expect(issues[1]?.path).toHaveLength(0);
		expect(issues[2]?.path).toHaveLength(3);
		expect(issues[3]?.path).toEqual([{ key: "nested" }]);
	});

	test("returns ResultAsync", () => {
		const schema = createSchema<number>(() => ({ value: 1 }));
		const result = validate(schema, "anything");

		expectTypeOf(result).toEqualTypeOf<ResultAsync<number, StandardSchemaV1.FailureResult>>();
	});
});

describe("validateSync", () => {
	test("returns Ok for sync success", () => {
		const schema = createSchema<number>(() => ({ value: 42 }));
		const result = validateSync(schema, "anything");

		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toBe(42);
	});

	test("returns Err for sync failure", () => {
		const schema = createSchema(() => ({
			issues: [{ message: "bad input" }],
		}));
		const result = validateSync(schema, "anything");

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().issues).toHaveLength(1);
		expect(result.unwrapErr().issues[0]?.message).toBe("bad input");
	});

	test("throws TypeError for async schemas", () => {
		const schema = createSchema(() => Promise.resolve({ value: 1 }));

		expect(() => validateSync(schema, "anything")).toThrow(TypeError);
		expect(() => validateSync(schema, "anything")).toThrow(
			"Schema returned a Promise from validate(). Use validate() instead of validateSync() for async schemas.",
		);
	});

	test("wraps thrown exceptions in synthetic FailureResult", () => {
		const schema = createSchema(() => {
			throw new Error("sync explosion");
		});
		const result = validateSync(schema, "anything");

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().issues).toHaveLength(1);
		expect(result.unwrapErr().issues[0]?.message).toBe("sync explosion");
	});

	test("passes options through to the schema validator", () => {
		let capturedOptions: StandardSchemaV1.Options | undefined;
		const schema = createSchema((_value, options) => {
			capturedOptions = options;
			return { value: true };
		});
		const opts: StandardSchemaV1.Options = { libraryOptions: { mode: "strict" } };

		validateSync(schema, "anything", opts);

		expect(capturedOptions).toEqual(opts);
	});

	test("preserves issue paths", () => {
		const schema = createSchema(() => ({
			issues: [{ message: "with path", path: ["a", { key: "b" }] }],
		}));
		const result = validateSync(schema, "anything");

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().issues[0]?.path).toEqual(["a", { key: "b" }]);
	});

	test("returns Result", () => {
		const schema = createSchema<string>(() => ({ value: "hi" }));
		const result = validateSync(schema, "anything");

		expectTypeOf(result).toEqualTypeOf<Result<string, StandardSchemaV1.FailureResult>>();
	});
});

describe("type inference", () => {
	test("InferInput and InferOutput resolve correctly", () => {
		type TestSchema = StandardSchemaV1<string, number>;

		expectTypeOf<StandardSchemaV1.InferInput<TestSchema>>().toEqualTypeOf<string>();
		expectTypeOf<StandardSchemaV1.InferOutput<TestSchema>>().toEqualTypeOf<number>();
	});
});
