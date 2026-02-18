import { describe, expect, test } from "bun:test";
import {
	decodeProtectedHeader,
	exportJWK as joseExportJWK,
	generateKeyPair as joseGenerateKeyPair,
	SignJWT,
} from "jose";
import { createLocalJWKSet } from "./local.js";

describe("createLocalJWKSet", () => {
	test("resolves a matching key from the JWKS", async () => {
		const { publicKey, privateKey } = await joseGenerateKeyPair("RS256");
		const jwk = await joseExportJWK(publicKey);
		jwk.alg = "RS256";

		const getKey = createLocalJWKSet({ keys: [jwk] });

		const jwt = await new SignJWT({}).setProtectedHeader({ alg: "RS256" }).sign(privateKey);
		const header = decodeProtectedHeader(jwt);

		const result = await getKey(header);
		expect(result.isOk()).toBe(true);
	});

	test("returns Err when no key matches", async () => {
		const { publicKey } = await joseGenerateKeyPair("RS256");
		const jwk = await joseExportJWK(publicKey);
		jwk.alg = "RS256";

		const getKey = createLocalJWKSet({ keys: [jwk] });

		const result = await getKey({ alg: "ES256" });
		expect(result.isErr()).toBe(true);
	});
});
