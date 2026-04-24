import { describe, expect, expectTypeOf, test } from "bun:test";
import type { Settled } from "antithrow";
import { structuredClone } from "./structured-clone.js";

describe("structuredClone", () => {
	test("clones a plain object", () => {
		const original = { a: 1, b: [2, 3] };
		const result = structuredClone(original);

		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toEqual(original);
		expect(result.unwrap()).not.toBe(original);
	});

	test("returns Err for a non-cloneable value", () => {
		const result = structuredClone(() => {});

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr()).toBeInstanceOf(DOMException);
	});

	test("returns settled Err for Promise values", () => {
		const result = structuredClone(Promise.resolve(1));

		expect(result.isErr()).toBe(true);
		expect(result.isPending()).toBe(false);
		expect(result.unwrapErr()).toBeInstanceOf(DOMException);
		expectTypeOf(result).toEqualTypeOf<Settled<Promise<number>, DOMException>>();
	});
});
