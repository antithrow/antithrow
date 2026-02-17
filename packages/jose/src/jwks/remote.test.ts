import { describe, expect, test } from "bun:test";
import { createRemoteJWKSet } from "./remote.js";

describe("createRemoteJWKSet", () => {
	test("returns a function", () => {
		const getKey = createRemoteJWKSet(new URL("https://example.com/.well-known/jwks.json"));
		expect(typeof getKey).toBe("function");
	});

	test("returns Err when remote JWKS is unreachable", async () => {
		const getKey = createRemoteJWKSet(new URL("http://localhost:1/.well-known/jwks.json"));
		const result = await getKey({ alg: "RS256" });
		expect(result.isErr()).toBe(true);
	});
});
