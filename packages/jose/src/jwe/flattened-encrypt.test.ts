import { describe, expect, test } from "bun:test";
import { FlattenedEncrypt, generateSecret } from "jose";
import { flattenedEncrypt } from "./flattened-encrypt.js";

describe("flattenedEncrypt", () => {
	test("encrypts and returns flattened JWE object", async () => {
		const secret = await generateSecret("A256GCM");
		const plaintext = new TextEncoder().encode("Hello");

		const encryptor = new FlattenedEncrypt(plaintext).setProtectedHeader({
			alg: "dir",
			enc: "A256GCM",
		});

		const result = await flattenedEncrypt(encryptor, secret);

		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toHaveProperty("ciphertext");
		expect(result.unwrap()).toHaveProperty("protected");
		expect(result.unwrap()).toHaveProperty("iv");
		expect(result.unwrap()).toHaveProperty("tag");
	});

	test("returns err when no protected header is set", async () => {
		const secret = await generateSecret("A256GCM");
		const plaintext = new TextEncoder().encode("Hello");

		const encryptor = new FlattenedEncrypt(plaintext);

		const result = await flattenedEncrypt(encryptor, secret);

		expect(result.isErr()).toBe(true);
	});
});
