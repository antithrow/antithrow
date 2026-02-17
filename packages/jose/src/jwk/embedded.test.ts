import { describe, expect, test } from "bun:test";
import { embeddedJWK } from "./embedded.js";

describe("embeddedJWK", () => {
	test("returns Err when header has no jwk member", async () => {
		const result = await embeddedJWK({ alg: "RS256" });
		expect(result.isErr()).toBe(true);
	});

	test("returns Err when called with no arguments", async () => {
		const result = await embeddedJWK();
		expect(result.isErr()).toBe(true);
	});
});
