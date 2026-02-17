import { describe, expect, test } from "bun:test";
import { CompactEncrypt, errors, generateSecret } from "jose";
import { compactDecrypt } from "./compact-decrypt.js";

describe("compactDecrypt", () => {
	test("decrypts a valid compact JWE", async () => {
		const secret = await generateSecret("A256GCM");
		const plaintext = new TextEncoder().encode("Hello");

		const jwe = await new CompactEncrypt(plaintext)
			.setProtectedHeader({ alg: "dir", enc: "A256GCM" })
			.encrypt(secret);

		const result = await compactDecrypt(jwe, secret);

		expect(result.isOk()).toBe(true);
		expect(result.unwrap().plaintext).toEqual(plaintext);
	});

	test("returns err with JWEDecryptionFailed for wrong key", async () => {
		const secret = await generateSecret("A256GCM");
		const wrongSecret = await generateSecret("A256GCM");
		const plaintext = new TextEncoder().encode("Hello");

		const jwe = await new CompactEncrypt(plaintext)
			.setProtectedHeader({ alg: "dir", enc: "A256GCM" })
			.encrypt(secret);

		const result = await compactDecrypt(jwe, wrongSecret);

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr()).toBeInstanceOf(errors.JWEDecryptionFailed);
	});

	test("returns err for malformed JWE", async () => {
		const secret = await generateSecret("A256GCM");

		const result = await compactDecrypt("not-a-valid-jwe", secret);

		expect(result.isErr()).toBe(true);
	});
});
