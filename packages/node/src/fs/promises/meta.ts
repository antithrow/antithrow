import type {
	BigIntStats,
	BigIntStatsFs,
	PathLike,
	StatFsOptions,
	StatOptions,
	Stats,
	StatsFs,
} from "node:fs";
import {
	access as nodeAccess,
	lstat as nodeLstat,
	stat as nodeStat,
	statfs as nodeStatfs,
} from "node:fs/promises";

import { ResultAsync } from "antithrow";
import type { FsError } from "./errors.js";

/** Errno codes thrown by `stat`. */
export type StatCode = "ENOENT" | "EACCES" | "ENOTDIR" | "ELOOP" | "ENAMETOOLONG" | "EIO";

/**
 * Non-throwing wrapper around `fs.promises.stat`.
 *
 * Returns `Stats` by default.
 *
 * @example
 * ```ts
 * import { stat } from "@antithrow/node";
 *
 * const result = await stat("/tmp/hello.txt");
 * // ok(Stats) or err(FsError<StatCode>)
 * ```
 *
 * @param path - The file path.
 * @param opts - Optional stat options.
 *
 * @returns A `ResultAsync` containing the `Stats` object, or an `FsError`.
 */
export function stat(
	path: PathLike,
	opts?: StatOptions & {
		bigint?: false | undefined;
	},
): ResultAsync<Stats, FsError<StatCode>>;
/**
 * Non-throwing wrapper around `fs.promises.stat`.
 *
 * Returns `BigIntStats` when `bigint` is `true`.
 *
 * @example
 * ```ts
 * import { stat } from "@antithrow/node";
 *
 * const result = await stat("/tmp/hello.txt", { bigint: true });
 * // ok(BigIntStats) or err(FsError<StatCode>)
 * ```
 *
 * @param path - The file path.
 * @param opts - Options with `bigint: true`.
 *
 * @returns A `ResultAsync` containing the `BigIntStats` object, or an `FsError`.
 */
export function stat(
	path: PathLike,
	opts: StatOptions & {
		bigint: true;
	},
): ResultAsync<BigIntStats, FsError<StatCode>>;
export function stat(
	path: PathLike,
	opts?: StatOptions,
): ResultAsync<Stats | BigIntStats, FsError<StatCode>> {
	return ResultAsync.try(() => nodeStat(path, opts));
}

/** Errno codes thrown by `lstat`. */
export type LstatCode = StatCode;

/**
 * Non-throwing wrapper around `fs.promises.lstat`.
 *
 * Like `stat`, but does not follow symbolic links.
 *
 * @example
 * ```ts
 * import { lstat } from "@antithrow/node";
 *
 * const result = await lstat("/tmp/my-link");
 * // ok(Stats) or err(FsError<LstatCode>)
 * ```
 *
 * @param path - The file path.
 * @param opts - Optional stat options.
 *
 * @returns A `ResultAsync` containing the `Stats` object, or an `FsError`.
 */
export function lstat(
	path: PathLike,
	opts?: StatOptions & {
		bigint?: false | undefined;
	},
): ResultAsync<Stats, FsError<LstatCode>>;
/**
 * Non-throwing wrapper around `fs.promises.lstat`.
 *
 * Returns `BigIntStats` when `bigint` is `true`.
 *
 * @example
 * ```ts
 * import { lstat } from "@antithrow/node";
 *
 * const result = await lstat("/tmp/my-link", { bigint: true });
 * // ok(BigIntStats) or err(FsError<LstatCode>)
 * ```
 *
 * @param path - The file path.
 * @param opts - Options with `bigint: true`.
 *
 * @returns A `ResultAsync` containing the `BigIntStats` object, or an `FsError`.
 */
export function lstat(
	path: PathLike,
	opts: StatOptions & {
		bigint: true;
	},
): ResultAsync<BigIntStats, FsError<LstatCode>>;
export function lstat(
	path: PathLike,
	opts?: StatOptions,
): ResultAsync<Stats | BigIntStats, FsError<LstatCode>> {
	return ResultAsync.try(() => nodeLstat(path, opts));
}

/** Errno codes thrown by `statfs`. */
export type StatfsCode = "ENOENT" | "EACCES" | "ENOTDIR" | "ELOOP" | "ENAMETOOLONG" | "EIO";

/**
 * Non-throwing wrapper around `fs.promises.statfs`.
 *
 * Returns filesystem statistics.
 *
 * @example
 * ```ts
 * import { statfs } from "@antithrow/node";
 *
 * const result = await statfs("/");
 * // ok(StatsFs) or err(FsError<StatfsCode>)
 * ```
 *
 * @param path - The filesystem path.
 * @param opts - Optional statfs options.
 *
 * @returns A `ResultAsync` containing the `StatsFs` object, or an `FsError`.
 */
export function statfs(
	path: PathLike,
	opts?: StatFsOptions & {
		bigint?: false | undefined;
	},
): ResultAsync<StatsFs, FsError<StatfsCode>>;
/**
 * Non-throwing wrapper around `fs.promises.statfs`.
 *
 * Returns `BigIntStatsFs` when `bigint` is `true`.
 *
 * @example
 * ```ts
 * import { statfs } from "@antithrow/node";
 *
 * const result = await statfs("/", { bigint: true });
 * // ok(BigIntStatsFs) or err(FsError<StatfsCode>)
 * ```
 *
 * @param path - The filesystem path.
 * @param opts - Options with `bigint: true`.
 *
 * @returns A `ResultAsync` containing the `BigIntStatsFs` object, or an `FsError`.
 */
export function statfs(
	path: PathLike,
	opts: StatFsOptions & {
		bigint: true;
	},
): ResultAsync<BigIntStatsFs, FsError<StatfsCode>>;
export function statfs(
	path: PathLike,
	opts?: StatFsOptions,
): ResultAsync<StatsFs | BigIntStatsFs, FsError<StatfsCode>> {
	return ResultAsync.try(() => nodeStatfs(path, opts));
}

/** Errno codes thrown by `access`. */
export type AccessCode =
	| "ENOENT"
	| "EACCES"
	| "ENOTDIR"
	| "ELOOP"
	| "ENAMETOOLONG"
	| "EIO"
	| "EROFS";

/**
 * Non-throwing wrapper around `fs.promises.access`.
 *
 * @example
 * ```ts
 * import { access } from "@antithrow/node";
 * import { constants } from "node:fs";
 *
 * const result = await access("/tmp/hello.txt", constants.R_OK);
 * // ok(undefined) or err(FsError<AccessCode>)
 * ```
 *
 * @param path - The file path.
 * @param mode - Optional accessibility check mode. Defaults to `fs.constants.F_OK`.
 *
 * @returns A `ResultAsync` containing `undefined` on success, or an `FsError`.
 */
export function access(path: PathLike, mode?: number): ResultAsync<void, FsError<AccessCode>> {
	return ResultAsync.try(() => nodeAccess(path, mode));
}
