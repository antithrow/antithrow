import { describe, expect, test } from "bun:test";
import { errors, FlattenedEncrypt, generateSecret } from "jose";
import { flattenedDecrypt } from "./flattened-decrypt.js";

describe("flattenedDecrypt", () => {
	test("decrypts a valid flattened JWE", async () => {
		const secret = await generateSecret("A256GCM");
		const plaintext = new TextEncoder().encode("Hello");

		const jwe = await new FlattenedEncrypt(plaintext)
			.setProtectedHeader({ alg: "dir", enc: "A256GCM" })
			.encrypt(secret);

		const result = await flattenedDecrypt(jwe, secret);

		expect(result.isOk()).toBe(true);
		expect(result.unwrap().plaintext).toEqual(plaintext);
	});

	test("returns err with JWEDecryptionFailed for wrong key", async () => {
		const secret = await generateSecret("A256GCM");
		const wrongSecret = await generateSecret("A256GCM");
		const plaintext = new TextEncoder().encode("Hello");

		const jwe = await new FlattenedEncrypt(plaintext)
			.setProtectedHeader({ alg: "dir", enc: "A256GCM" })
			.encrypt(secret);

		const result = await flattenedDecrypt(jwe, wrongSecret);

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr()).toBeInstanceOf(errors.JWEDecryptionFailed);
	});
});
