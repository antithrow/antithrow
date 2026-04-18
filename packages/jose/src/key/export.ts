import { ResultAsync } from "antithrow/legacy";
import type { CryptoKey, JWK, KeyObject } from "jose";
import {
	exportJWK as joseExportJWK,
	exportPKCS8 as joseExportPKCS8,
	exportSPKI as joseExportSPKI,
} from "jose";

/**
 * Non-throwing wrapper around `jose.exportSPKI`.
 *
 * Exports a public `CryptoKey` as a PEM-encoded SPKI string.
 *
 * @example
 * ```ts
 * import { exportSPKI } from "@antithrow/jose/key";
 *
 * const result = await exportSPKI(publicKey);
 * ```
 *
 * @param key - The public key to export.
 *
 * @returns A `ResultAsync` containing the PEM-encoded SPKI string, or an error.
 */
export function exportSPKI(key: CryptoKey | KeyObject): ResultAsync<string, TypeError> {
	return ResultAsync.try(() => joseExportSPKI(key));
}

/**
 * Non-throwing wrapper around `jose.exportPKCS8`.
 *
 * Exports a private `CryptoKey` as a PEM-encoded PKCS#8 string.
 *
 * @example
 * ```ts
 * import { exportPKCS8 } from "@antithrow/jose/key";
 *
 * const result = await exportPKCS8(privateKey);
 * ```
 *
 * @param key - The private key to export.
 *
 * @returns A `ResultAsync` containing the PEM-encoded PKCS#8 string, or an error.
 */
export function exportPKCS8(key: CryptoKey | KeyObject): ResultAsync<string, TypeError> {
	return ResultAsync.try(() => joseExportPKCS8(key));
}

/**
 * Non-throwing wrapper around `jose.exportJWK`.
 *
 * Exports a `CryptoKey` as a JSON Web Key.
 *
 * @example
 * ```ts
 * import { exportJWK } from "@antithrow/jose/key";
 *
 * const result = await exportJWK(key);
 * ```
 *
 * @param key - The key to export.
 *
 * @returns A `ResultAsync` containing the JWK, or an error.
 */
export function exportJWK(key: CryptoKey | KeyObject | Uint8Array): ResultAsync<JWK, TypeError> {
	return ResultAsync.try(() => joseExportJWK(key));
}
