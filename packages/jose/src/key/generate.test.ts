import { describe, expect, test } from "bun:test";
import { generateKeyPair, generateSecret } from "./generate.js";

describe("generateKeyPair", () => {
	test("generates a key pair for RS256", async () => {
		const result = await generateKeyPair("RS256");
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toHaveProperty("publicKey");
		expect(result.unwrap()).toHaveProperty("privateKey");
	});

	test("returns Err for invalid algorithm", async () => {
		const result = await generateKeyPair("INVALID");
		expect(result.isErr()).toBe(true);
	});
});

describe("generateSecret", () => {
	test("generates a secret for HS256", async () => {
		const result = await generateSecret("HS256");
		expect(result.isOk()).toBe(true);
	});

	test("returns Err for invalid algorithm", async () => {
		const result = await generateSecret("INVALID");
		expect(result.isErr()).toBe(true);
	});
});
