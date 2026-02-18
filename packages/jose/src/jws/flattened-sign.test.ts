import { describe, expect, test } from "bun:test";
import { FlattenedSign, generateSecret } from "jose";
import { flattenedSign } from "./flattened-sign.js";

const encoder = new TextEncoder();
const payload = encoder.encode(JSON.stringify({ hello: "world" }));

describe("flattenedSign", () => {
	test("signs with a valid key", async () => {
		const key = await generateSecret("HS256");
		const signer = new FlattenedSign(payload).setProtectedHeader({
			alg: "HS256",
		});

		const result = await flattenedSign(signer, key);

		expect(result.isOk()).toBe(true);
		const jws = result.unwrap();
		expect(jws).toHaveProperty("payload");
		expect(jws).toHaveProperty("protected");
		expect(jws).toHaveProperty("signature");
	});

	test("returns Err when no header is set", async () => {
		const key = await generateSecret("HS256");
		const signer = new FlattenedSign(payload);

		const result = await flattenedSign(signer, key);

		expect(result.isErr()).toBe(true);
	});
});
