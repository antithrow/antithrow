import { describe, expect, test } from "bun:test";
import { EncryptJWT, generateSecret } from "jose";
import { encryptJwt } from "./encrypt.js";

describe("encryptJwt", () => {
	test("encrypts a JWT with a valid key", async () => {
		const secret = await generateSecret("A256GCM");
		const jwt = new EncryptJWT({ sub: "user-123" }).setProtectedHeader({
			alg: "dir",
			enc: "A256GCM",
		});

		const result = await encryptJwt(jwt, secret);

		expect(result.isOk()).toBe(true);
		const token = result.unwrap();
		expect(typeof token).toBe("string");
		expect(token.split(".")).toHaveLength(5);
	});

	test("returns Err when no protected header is set", async () => {
		const secret = await generateSecret("A256GCM");
		const jwt = new EncryptJWT({ sub: "user-123" });

		const result = await encryptJwt(jwt, secret);

		expect(result.isErr()).toBe(true);
	});
});
