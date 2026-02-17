import { ResultAsync } from "antithrow";
import type { CryptoKey, errors, JWK, KeyImportOptions } from "jose";
import {
	importJWK as joseImportJWK,
	importPKCS8 as joseImportPKCS8,
	importSPKI as joseImportSPKI,
	importX509 as joseImportX509,
} from "jose";

/**
 * Non-throwing wrapper around `jose.importSPKI`.
 *
 * Imports a PEM-encoded SPKI string as a `CryptoKey`.
 *
 * @example
 * ```ts
 * import { importSPKI } from "@antithrow/jose/key";
 *
 * const result = await importSPKI(spkiPem, "RS256");
 * ```
 *
 * @param spki - The PEM-encoded SPKI string.
 * @param alg - The JWS/JWE algorithm identifier.
 * @param options - Optional key import options.
 *
 * @returns A `ResultAsync` containing the imported `CryptoKey`, or an error.
 */
export function importSPKI(
	spki: string,
	alg: string,
	options?: KeyImportOptions,
): ResultAsync<CryptoKey, TypeError | errors.JOSENotSupported> {
	return ResultAsync.try(() => joseImportSPKI(spki, alg, options));
}

/**
 * Non-throwing wrapper around `jose.importPKCS8`.
 *
 * Imports a PEM-encoded PKCS#8 string as a `CryptoKey`.
 *
 * @example
 * ```ts
 * import { importPKCS8 } from "@antithrow/jose/key";
 *
 * const result = await importPKCS8(pkcs8Pem, "RS256");
 * ```
 *
 * @param pkcs8 - The PEM-encoded PKCS#8 string.
 * @param alg - The JWS/JWE algorithm identifier.
 * @param options - Optional key import options.
 *
 * @returns A `ResultAsync` containing the imported `CryptoKey`, or an error.
 */
export function importPKCS8(
	pkcs8: string,
	alg: string,
	options?: KeyImportOptions,
): ResultAsync<CryptoKey, TypeError | errors.JOSENotSupported> {
	return ResultAsync.try(() => joseImportPKCS8(pkcs8, alg, options));
}

/**
 * Non-throwing wrapper around `jose.importX509`.
 *
 * Imports a PEM-encoded X.509 certificate string as a `CryptoKey`.
 *
 * @example
 * ```ts
 * import { importX509 } from "@antithrow/jose/key";
 *
 * const result = await importX509(x509Pem, "RS256");
 * ```
 *
 * @param x509 - The PEM-encoded X.509 certificate string.
 * @param alg - The JWS/JWE algorithm identifier.
 * @param options - Optional key import options.
 *
 * @returns A `ResultAsync` containing the imported `CryptoKey`, or an error.
 */
export function importX509(
	x509: string,
	alg: string,
	options?: KeyImportOptions,
): ResultAsync<CryptoKey, TypeError | errors.JOSENotSupported> {
	return ResultAsync.try(() => joseImportX509(x509, alg, options));
}

/**
 * Non-throwing wrapper around `jose.importJWK`.
 *
 * Imports a JWK as a `CryptoKey` or `Uint8Array`.
 *
 * @example
 * ```ts
 * import { importJWK } from "@antithrow/jose/key";
 *
 * const result = await importJWK({ kty: "RSA", ... }, "RS256");
 * ```
 *
 * @param jwk - The JSON Web Key to import.
 * @param alg - Optional JWS/JWE algorithm identifier.
 * @param options - Optional key import options.
 *
 * @returns A `ResultAsync` containing the imported key, or an error.
 */
export function importJWK(
	jwk: JWK,
	alg?: string,
	options?: KeyImportOptions,
): ResultAsync<CryptoKey | Uint8Array, TypeError | errors.JOSENotSupported> {
	return ResultAsync.try(() => joseImportJWK(jwk, alg, options));
}
