import { describe, expect, test } from "bun:test";
import { GeneralSign, generateSecret } from "jose";
import { generalSign } from "./general-sign.js";

const encoder = new TextEncoder();
const payload = encoder.encode(JSON.stringify({ hello: "world" }));

describe("generalSign", () => {
	test("signs with one signature", async () => {
		const key = await generateSecret("HS256");
		const signer = new GeneralSign(payload);
		signer.addSignature(key).setProtectedHeader({ alg: "HS256" });

		const result = await generalSign(signer);

		expect(result.isOk()).toBe(true);
		const jws = result.unwrap();
		expect(jws).toHaveProperty("payload");
		expect(jws).toHaveProperty("signatures");
		expect(jws.signatures).toHaveLength(1);
	});

	test("returns Err when no signatures are added", async () => {
		const signer = new GeneralSign(payload);

		const result = await generalSign(signer);

		expect(result.isErr()).toBe(true);
	});
});
