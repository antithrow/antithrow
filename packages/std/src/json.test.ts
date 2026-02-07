import { describe, expect, expectTypeOf, test } from "bun:test";
import type { Ok } from "antithrow";
// biome-ignore lint/suspicious/noShadowRestrictedNames: testing the wrapper
import { JSON } from "./json.js";

describe("JSON", () => {
	describe("parse", () => {
		test("parses valid JSON", () => {
			const result = JSON.parse<{ a: number }>('{"a": 1}');

			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toEqual({ a: 1 });
		});

		test("parses with a reviver", () => {
			const result = JSON.parse<{ a: number }>('{"a": 1}', (_key, value) =>
				typeof value === "number" ? value * 2 : value,
			);

			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toEqual({ a: 2 });
		});

		test("returns Err for invalid JSON", () => {
			const result = JSON.parse("invalid json");

			expect(result.isErr()).toBe(true);
			expect(result.unwrapErr()).toBeInstanceOf(SyntaxError);
		});
	});

	describe("stringify", () => {
		test("stringifies a value", () => {
			const result = JSON.stringify({ a: 1 });

			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toBe('{"a":1}');
		});

		test("stringifies with space", () => {
			const result = JSON.stringify({ a: 1 }, null, 2);

			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toBe('{\n  "a": 1\n}');
		});

		test("stringifies with a replacer function", () => {
			const result = JSON.stringify({ a: 1, b: "x" }, (_key, value) =>
				typeof value === "number" ? value * 10 : value,
			);

			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toBe('{"a":10,"b":"x"}');
		});

		test("returns Ok(undefined) for non-serializable top-level values", () => {
			const result = JSON.stringify(undefined);

			expect(result.isOk()).toBe(true);
			expectTypeOf(result).toEqualTypeOf<Ok<undefined, never>>();
			expect(result.unwrap()).toBeUndefined();
		});

		test("returns Ok(undefined) for functions", () => {
			const fn = () => "value";
			const result = JSON.stringify(fn);

			expect(result.isOk()).toBe(true);
			expectTypeOf(result).toEqualTypeOf<Ok<undefined, never>>();
			expect(result.unwrap()).toBeUndefined();
		});

		test("returns Ok(undefined) for symbols", () => {
			const result = JSON.stringify(Symbol("x"));

			expect(result.isOk()).toBe(true);
			expectTypeOf(result).toEqualTypeOf<Ok<undefined, never>>();
			expect(result.unwrap()).toBeUndefined();
		});

		test("returns Err for circular references", () => {
			const circular: Record<string, unknown> = {};
			// biome-ignore lint/complexity/useLiteralKeys: The property is a literal key, so TS wants this.
			circular["self"] = circular;
			const result = JSON.stringify(circular);

			expect(result.isErr()).toBe(true);
			expect(result.unwrapErr()).toBeInstanceOf(TypeError);
		});
	});
});
