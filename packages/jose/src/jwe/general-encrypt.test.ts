import { describe, expect, test } from "bun:test";
import { GeneralEncrypt, generateSecret } from "jose";
import { generalEncrypt } from "./general-encrypt.js";

describe("generalEncrypt", () => {
	test("encrypts and returns general JWE object", async () => {
		const secret = await generateSecret("A256GCM");
		const plaintext = new TextEncoder().encode("Hello");

		const encryptor = new GeneralEncrypt(plaintext)
			.setProtectedHeader({ alg: "dir", enc: "A256GCM" })
			.addRecipient(secret)
			.done();

		const result = await generalEncrypt(encryptor);

		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toHaveProperty("ciphertext");
		expect(result.unwrap()).toHaveProperty("recipients");
	});

	test("returns err when no recipients are added", async () => {
		const plaintext = new TextEncoder().encode("Hello");

		const encryptor = new GeneralEncrypt(plaintext).setProtectedHeader({
			alg: "dir",
			enc: "A256GCM",
		});

		const result = await generalEncrypt(encryptor);

		expect(result.isErr()).toBe(true);
	});
});
