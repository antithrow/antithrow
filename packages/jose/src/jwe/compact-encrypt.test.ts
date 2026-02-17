import { describe, expect, test } from "bun:test";
import { CompactEncrypt, generateSecret } from "jose";
import { compactEncrypt } from "./compact-encrypt.js";

describe("compactEncrypt", () => {
	test("encrypts with valid key and returns compact JWE string", async () => {
		const secret = await generateSecret("A256GCM");
		const plaintext = new TextEncoder().encode("Hello");

		const encryptor = new CompactEncrypt(plaintext).setProtectedHeader({
			alg: "dir",
			enc: "A256GCM",
		});

		const result = await compactEncrypt(encryptor, secret);

		expect(result.isOk()).toBe(true);
		expect(typeof result.unwrap()).toBe("string");
		expect(result.unwrap().split(".")).toHaveLength(5);
	});

	test("returns err when no protected header is set", async () => {
		const secret = await generateSecret("A256GCM");
		const plaintext = new TextEncoder().encode("Hello");

		const encryptor = new CompactEncrypt(plaintext);

		const result = await compactEncrypt(encryptor, secret);

		expect(result.isErr()).toBe(true);
	});
});
