import { describe, expect, test } from "bun:test";
import { errors, GeneralSign, generateSecret } from "jose";
import { generalVerify } from "./general-verify.js";

const encoder = new TextEncoder();
const payload = encoder.encode(JSON.stringify({ hello: "world" }));

describe("generalVerify", () => {
	test("verifies a valid general JWS", async () => {
		const key = await generateSecret("HS256");
		const signer = new GeneralSign(payload);
		signer.addSignature(key).setProtectedHeader({ alg: "HS256" });
		const jws = await signer.sign();

		const result = await generalVerify(jws, key);

		expect(result.isOk()).toBe(true);
		expect(result.unwrap().payload).toEqual(payload);
	});

	test("returns Err with wrong key", async () => {
		const key = await generateSecret("HS256");
		const wrongKey = await generateSecret("HS256");
		const signer = new GeneralSign(payload);
		signer.addSignature(key).setProtectedHeader({ alg: "HS256" });
		const jws = await signer.sign();

		const result = await generalVerify(jws, wrongKey);

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr()).toBeInstanceOf(errors.JWSSignatureVerificationFailed);
	});
});
