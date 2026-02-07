import { describe, expect, test } from "bun:test";
import { atob, btoa } from "./base64.js";

describe("atob", () => {
	test("decodes a valid base64 string", () => {
		const result = atob("aGVsbG8=");

		expect(result.isOk()).toBeTrue();
		expect(result.unwrap()).toBe("hello");
	});

	test("returns Err for invalid base64", () => {
		const result = atob("!!!");

		expect(result.isErr()).toBeTrue();
		expect(result.unwrapErr()).toBeInstanceOf(DOMException);
	});
});

describe("btoa", () => {
	test("encodes a string to base64", () => {
		const result = btoa("hello");

		expect(result.isOk()).toBeTrue();
		expect(result.unwrap()).toBe("aGVsbG8=");
	});

	test("returns Err for non-latin1 characters", () => {
		const result = btoa("こんにちは");

		expect(result.isErr()).toBeTrue();
		expect(result.unwrapErr()).toBeInstanceOf(DOMException);
	});
});
