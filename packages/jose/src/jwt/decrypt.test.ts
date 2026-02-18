import { describe, expect, test } from "bun:test";
import { EncryptJWT, errors, generateSecret } from "jose";
import { jwtDecrypt } from "./decrypt.js";

describe("jwtDecrypt", () => {
	test("decrypts a valid encrypted JWT with dir/A256GCM", async () => {
		const secret = await generateSecret("A256GCM");
		const token = await new EncryptJWT({ sub: "user-123" })
			.setProtectedHeader({ alg: "dir", enc: "A256GCM" })
			.encrypt(secret);

		const result = await jwtDecrypt(token, secret);

		expect(result.isOk()).toBe(true);
		expect(result.unwrap().payload.sub).toBe("user-123");
	});

	test("returns Err when decrypting with wrong key", async () => {
		const secret1 = await generateSecret("A256GCM");
		const secret2 = await generateSecret("A256GCM");
		const token = await new EncryptJWT({ sub: "user-123" })
			.setProtectedHeader({ alg: "dir", enc: "A256GCM" })
			.encrypt(secret1);

		const result = await jwtDecrypt(token, secret2);

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr()).toBeInstanceOf(errors.JWEDecryptionFailed);
	});

	test("returns Err for malformed JWE string", async () => {
		const secret = await generateSecret("A256GCM");

		const result = await jwtDecrypt("not-a-jwe", secret);

		expect(result.isErr()).toBe(true);
	});
});
