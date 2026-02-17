import { describe, expect, test } from "bun:test";
import { errors, UnsecuredJWT } from "jose";
import { decodeUnsecuredJwt } from "./unsecured.js";

describe("decodeUnsecuredJwt", () => {
	test("decodes a valid unsecured JWT", () => {
		const token = new UnsecuredJWT({ sub: "user-123" }).encode();

		const result = decodeUnsecuredJwt(token);

		expect(result.isOk()).toBe(true);
		expect(result.unwrap().payload.sub).toBe("user-123");
	});

	test("returns Err for invalid input string", () => {
		const result = decodeUnsecuredJwt("not-a-jwt");

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr()).toBeInstanceOf(errors.JWTInvalid);
	});
});
