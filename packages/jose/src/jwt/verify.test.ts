import { describe, expect, test } from "bun:test";
import { errors, generateSecret, SignJWT } from "jose";
import { jwtVerify } from "./verify.js";

describe("jwtVerify", () => {
	test("verifies a valid JWT with HS256", async () => {
		const secret = await generateSecret("HS256");
		const token = await new SignJWT({ sub: "user-123" })
			.setProtectedHeader({ alg: "HS256" })
			.setIssuedAt()
			.sign(secret);

		const result = await jwtVerify(token, secret);

		expect(result.isOk()).toBe(true);
		expect(result.unwrap().payload.sub).toBe("user-123");
	});

	test("returns Err for invalid signature (wrong key)", async () => {
		const secret1 = await generateSecret("HS256");
		const secret2 = await generateSecret("HS256");
		const token = await new SignJWT({ sub: "user-123" })
			.setProtectedHeader({ alg: "HS256" })
			.sign(secret1);

		const result = await jwtVerify(token, secret2);

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr()).toBeInstanceOf(errors.JWSSignatureVerificationFailed);
	});

	test("returns Err for malformed JWT string", async () => {
		const secret = await generateSecret("HS256");

		const result = await jwtVerify("not-a-jwt", secret);

		expect(result.isErr()).toBe(true);
	});

	test("returns Err for expired JWT", async () => {
		const secret = await generateSecret("HS256");
		const token = await new SignJWT({ sub: "user-123" })
			.setProtectedHeader({ alg: "HS256" })
			.setExpirationTime("0s")
			.sign(secret);

		await new Promise((r) => setTimeout(r, 1100));

		const result = await jwtVerify(token, secret);

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr()).toBeInstanceOf(errors.JWTExpired);
	});
});
