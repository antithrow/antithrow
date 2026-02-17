import { describe, expect, test } from "bun:test";
import { generateSecret as joseGenerateSecret, SignJWT } from "jose";
import { decodeProtectedHeader } from "./decode-protected-header.js";

describe("decodeProtectedHeader", () => {
	test("decodes a valid JWT protected header", async () => {
		const secret = await joseGenerateSecret("HS256");
		const jwt = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).sign(secret);

		const result = decodeProtectedHeader(jwt);
		expect(result.isOk()).toBe(true);
		expect(result.unwrap().alg).toBe("HS256");
	});

	test("returns Err for invalid input", () => {
		const result = decodeProtectedHeader("not-a-jwt");
		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr()).toBeInstanceOf(TypeError);
	});
});
