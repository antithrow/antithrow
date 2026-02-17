import { describe, expect, test } from "bun:test";
import { base64url } from "./base64url.js";

describe("base64url", () => {
	test("decodes a valid base64url string", () => {
		const result = base64url.decode("SGVsbG8");
		expect(result.isOk()).toBe(true);
		expect(new TextDecoder().decode(result.unwrap())).toBe("Hello");
	});

	test("encode/decode roundtrip", () => {
		const original = new TextEncoder().encode("Hello, World!");
		const encoded = base64url.encode(original);
		const result = base64url.decode(encoded);
		expect(result.isOk()).toBe(true);
		expect(new TextDecoder().decode(result.unwrap())).toBe("Hello, World!");
	});
});
