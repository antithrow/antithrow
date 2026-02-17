import { describe, expect, test } from "bun:test";
import { errors, generateSecret, SignJWT } from "jose";
import { decodeJwt } from "./decode.js";

describe("decodeJwt", () => {
	test("decodes a valid JWT payload", async () => {
		const secret = await generateSecret("HS256");
		const token = await new SignJWT({ sub: "user-123" })
			.setProtectedHeader({ alg: "HS256" })
			.setIssuedAt()
			.sign(secret);

		const result = decodeJwt(token);

		expect(result.isOk()).toBe(true);
		expect(result.unwrap().sub).toBe("user-123");
		expect(result.unwrap().iat).toBeDefined();
	});

	test("returns Err for invalid JWT string", () => {
		const result = decodeJwt("not-a-jwt");

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr()).toBeInstanceOf(errors.JWTInvalid);
	});

	test("returns Err for empty string", () => {
		const result = decodeJwt("");

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr()).toBeInstanceOf(errors.JWTInvalid);
	});
});
