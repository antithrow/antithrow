import { describe, expect, test } from "bun:test";
import { exportJWK as joseExportJWK, generateKeyPair as joseGenerateKeyPair } from "jose";
import { calculateJwkThumbprint, calculateJwkThumbprintUri } from "./thumbprint.js";

describe("calculateJwkThumbprint", () => {
	test("calculates thumbprint for a valid JWK", async () => {
		const { publicKey } = await joseGenerateKeyPair("RS256");
		const jwk = await joseExportJWK(publicKey);

		const result = await calculateJwkThumbprint(jwk);
		expect(result.isOk()).toBe(true);
		expect(typeof result.unwrap()).toBe("string");
	});

	test("returns Err for invalid JWK", async () => {
		const result = await calculateJwkThumbprint({});
		expect(result.isErr()).toBe(true);
	});
});

describe("calculateJwkThumbprintUri", () => {
	test("calculates thumbprint URI for a valid JWK", async () => {
		const { publicKey } = await joseGenerateKeyPair("RS256");
		const jwk = await joseExportJWK(publicKey);

		const result = await calculateJwkThumbprintUri(jwk);
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toStartWith("urn:ietf:params:oauth:jwk-thumbprint:");
	});
});
