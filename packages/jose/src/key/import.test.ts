import { describe, expect, test } from "bun:test";
import {
	exportJWK as joseExportJWK,
	exportPKCS8 as joseExportPKCS8,
	exportSPKI as joseExportSPKI,
	generateKeyPair as joseGenerateKeyPair,
} from "jose";
import { importJWK, importPKCS8, importSPKI, importX509 } from "./import.js";

describe("importSPKI", () => {
	test("imports a valid SPKI PEM", async () => {
		const { publicKey } = await joseGenerateKeyPair("RS256");
		const spki = await joseExportSPKI(publicKey);

		const result = await importSPKI(spki, "RS256");
		expect(result.isOk()).toBe(true);
	});

	test("returns Err for invalid PEM", async () => {
		const result = await importSPKI("not-a-pem", "RS256");
		expect(result.isErr()).toBe(true);
	});
});

describe("importPKCS8", () => {
	test("imports a valid PKCS8 PEM", async () => {
		const { privateKey } = await joseGenerateKeyPair("RS256", { extractable: true });
		const pkcs8 = await joseExportPKCS8(privateKey);

		const result = await importPKCS8(pkcs8, "RS256");
		expect(result.isOk()).toBe(true);
	});

	test("returns Err for invalid PEM", async () => {
		const result = await importPKCS8("not-a-pem", "RS256");
		expect(result.isErr()).toBe(true);
	});
});

describe("importX509", () => {
	test("returns Err for invalid certificate", async () => {
		const result = await importX509("not-a-cert", "RS256");
		expect(result.isErr()).toBe(true);
	});
});

describe("importJWK", () => {
	test("imports a valid JWK", async () => {
		const { publicKey } = await joseGenerateKeyPair("RS256");
		const jwk = await joseExportJWK(publicKey);

		const result = await importJWK(jwk, "RS256");
		expect(result.isOk()).toBe(true);
	});

	test("returns Err for invalid JWK", async () => {
		const result = await importJWK({} as never, "RS256");
		expect(result.isErr()).toBe(true);
	});
});
