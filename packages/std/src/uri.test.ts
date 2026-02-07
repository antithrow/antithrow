import { describe, expect, test } from "bun:test";
// biome-ignore lint/suspicious/noShadowRestrictedNames: testing the wrappers
import { decodeURI, decodeURIComponent, encodeURI, encodeURIComponent } from "./uri.js";

describe("decodeURI", () => {
	test("decodes a valid encoded URI", () => {
		const result = decodeURI("https://example.com/hello%20world");

		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toBe("https://example.com/hello world");
	});

	test("returns Err for a malformed URI", () => {
		const result = decodeURI("%E0%A4%A");

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr()).toBeInstanceOf(URIError);
	});
});

describe("decodeURIComponent", () => {
	test("decodes a valid encoded component", () => {
		const result = decodeURIComponent("hello%20world");

		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toBe("hello world");
	});

	test("returns Err for a malformed component", () => {
		const result = decodeURIComponent("%");

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr()).toBeInstanceOf(URIError);
	});
});

describe("encodeURI", () => {
	test("encodes a URI", () => {
		const result = encodeURI("https://example.com/hello world");

		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toBe("https://example.com/hello%20world");
	});

	test("returns Err for a lone surrogate", () => {
		const result = encodeURI("https://example.com/\uD800");

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr()).toBeInstanceOf(URIError);
	});
});

describe("encodeURIComponent", () => {
	test("encodes a component string", () => {
		const result = encodeURIComponent("hello world");

		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toBe("hello%20world");
	});

	test("encodes a number", () => {
		const result = encodeURIComponent(42);

		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toBe("42");
	});

	test("encodes a boolean", () => {
		const result = encodeURIComponent(true);

		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toBe("true");
	});

	test("returns Err for a lone surrogate", () => {
		const result = encodeURIComponent("\uDC00");

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr()).toBeInstanceOf(URIError);
	});
});
