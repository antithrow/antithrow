import { describe, expect, test } from "bun:test";
import { generateKeyPair as joseGenerateKeyPair } from "jose";
import { exportJWK, exportPKCS8, exportSPKI } from "./export.js";

describe("exportSPKI", () => {
	test("exports a public key as SPKI PEM", async () => {
		const { publicKey } = await joseGenerateKeyPair("RS256");

		const result = await exportSPKI(publicKey);
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toStartWith("-----BEGIN PUBLIC KEY-----");
	});
});

describe("exportPKCS8", () => {
	test("exports a private key as PKCS8 PEM", async () => {
		const { privateKey } = await joseGenerateKeyPair("RS256", { extractable: true });

		const result = await exportPKCS8(privateKey);
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toStartWith("-----BEGIN PRIVATE KEY-----");
	});
});

describe("exportJWK", () => {
	test("exports a key as JWK", async () => {
		const { publicKey } = await joseGenerateKeyPair("RS256");

		const result = await exportJWK(publicKey);
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toHaveProperty("kty");
	});
});
