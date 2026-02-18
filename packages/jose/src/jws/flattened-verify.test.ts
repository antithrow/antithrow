import { describe, expect, test } from "bun:test";
import { errors, FlattenedSign, generateSecret } from "jose";
import { flattenedVerify } from "./flattened-verify.js";

const encoder = new TextEncoder();
const payload = encoder.encode(JSON.stringify({ hello: "world" }));

describe("flattenedVerify", () => {
	test("verifies a valid flattened JWS", async () => {
		const key = await generateSecret("HS256");
		const jws = await new FlattenedSign(payload).setProtectedHeader({ alg: "HS256" }).sign(key);

		const result = await flattenedVerify(jws, key);

		expect(result.isOk()).toBe(true);
		expect(result.unwrap().payload).toEqual(payload);
	});

	test("returns Err with wrong key", async () => {
		const key = await generateSecret("HS256");
		const wrongKey = await generateSecret("HS256");
		const jws = await new FlattenedSign(payload).setProtectedHeader({ alg: "HS256" }).sign(key);

		const result = await flattenedVerify(jws, wrongKey);

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr()).toBeInstanceOf(errors.JWSSignatureVerificationFailed);
	});
});
