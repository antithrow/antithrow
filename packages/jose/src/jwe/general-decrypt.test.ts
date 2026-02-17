import { describe, expect, test } from "bun:test";
import { errors, GeneralEncrypt, generateSecret } from "jose";
import { generalDecrypt } from "./general-decrypt.js";

describe("generalDecrypt", () => {
	test("decrypts a valid general JWE", async () => {
		const secret = await generateSecret("A256GCM");
		const plaintext = new TextEncoder().encode("Hello");

		const jwe = await new GeneralEncrypt(plaintext)
			.setProtectedHeader({ alg: "dir", enc: "A256GCM" })
			.addRecipient(secret)
			.done()
			.encrypt();

		const result = await generalDecrypt(jwe, secret);

		expect(result.isOk()).toBe(true);
		expect(result.unwrap().plaintext).toEqual(plaintext);
	});

	test("returns err with JWEDecryptionFailed for wrong key", async () => {
		const secret = await generateSecret("A256GCM");
		const wrongSecret = await generateSecret("A256GCM");
		const plaintext = new TextEncoder().encode("Hello");

		const jwe = await new GeneralEncrypt(plaintext)
			.setProtectedHeader({ alg: "dir", enc: "A256GCM" })
			.addRecipient(secret)
			.done()
			.encrypt();

		const result = await generalDecrypt(jwe, wrongSecret);

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr()).toBeInstanceOf(errors.JWEDecryptionFailed);
	});
});
