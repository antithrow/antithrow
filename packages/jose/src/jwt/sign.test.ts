import { describe, expect, test } from "bun:test";
import { generateSecret, SignJWT } from "jose";
import { signJwt } from "./sign.js";

describe("signJwt", () => {
	test("signs a JWT with a valid key", async () => {
		const secret = await generateSecret("HS256");
		const jwt = new SignJWT({ sub: "user-123" }).setProtectedHeader({
			alg: "HS256",
		});

		const result = await signJwt(jwt, secret);

		expect(result.isOk()).toBe(true);
		const token = result.unwrap();
		expect(typeof token).toBe("string");
		expect(token.split(".")).toHaveLength(3);
	});

	test("returns Err when no protected header is set", async () => {
		const secret = await generateSecret("HS256");
		const jwt = new SignJWT({ sub: "user-123" });

		const result = await signJwt(jwt, secret);

		expect(result.isErr()).toBe(true);
	});
});
