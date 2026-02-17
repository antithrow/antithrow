import { describe, expect, test } from "bun:test";
import { CompactSign, errors, generateSecret } from "jose";
import { compactVerify } from "./compact-verify.js";

const encoder = new TextEncoder();
const payload = encoder.encode(JSON.stringify({ hello: "world" }));

describe("compactVerify", () => {
	test("verifies a valid compact JWS", async () => {
		const key = await generateSecret("HS256");
		const jws = await new CompactSign(payload).setProtectedHeader({ alg: "HS256" }).sign(key);

		const result = await compactVerify(jws, key);

		expect(result.isOk()).toBe(true);
		expect(result.unwrap().payload).toEqual(payload);
	});

	test("returns Err with wrong key", async () => {
		const key = await generateSecret("HS256");
		const wrongKey = await generateSecret("HS256");
		const jws = await new CompactSign(payload).setProtectedHeader({ alg: "HS256" }).sign(key);

		const result = await compactVerify(jws, wrongKey);

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr()).toBeInstanceOf(errors.JWSSignatureVerificationFailed);
	});

	test("returns Err for invalid JWS string", async () => {
		const key = await generateSecret("HS256");

		const result = await compactVerify("not-a-valid-jws", key);

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr()).toBeInstanceOf(errors.JWSInvalid);
	});
});
