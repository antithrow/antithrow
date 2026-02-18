import { describe, expect, test } from "bun:test";
import { CompactSign, generateSecret, compactVerify as joseCompactVerify } from "jose";
import { compactSign } from "./compact-sign.js";

const encoder = new TextEncoder();
const payload = encoder.encode(JSON.stringify({ hello: "world" }));

describe("compactSign", () => {
	test("signs with a valid key", async () => {
		const key = await generateSecret("HS256");
		const signer = new CompactSign(payload).setProtectedHeader({
			alg: "HS256",
		});

		const result = await compactSign(signer, key);

		expect(result.isOk()).toBe(true);
		expect(typeof result.unwrap()).toBe("string");

		const verified = await joseCompactVerify(result.unwrap(), key);
		expect(verified.payload).toEqual(payload);
	});

	test("returns Err when no protected header is set", async () => {
		const key = await generateSecret("HS256");
		const signer = new CompactSign(payload);

		const result = await compactSign(signer, key);

		expect(result.isErr()).toBe(true);
	});
});
