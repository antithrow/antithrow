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
 * // ok(Stats) or err(NodeJS.ErrnoException)
 * ```
 *
 * @param path - The file path.
 * @param opts - Optional stat options.
 *
 * @returns A `ResultAsync` containing the `Stats` object, or a `NodeJS.ErrnoException`.
 */
export function stat(
	path: PathLike,
	opts?: StatOptions & {
		bigint?: false | undefined;
	},
): ResultAsync<Stats, NodeJS.ErrnoException>;
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
 * // ok(BigIntStats) or err(NodeJS.ErrnoException)
 * ```
 *
 * @param path - The file path.
 * @param opts - Options with `bigint: true`.
 *
 * @returns A `ResultAsync` containing the `BigIntStats` object, or a `NodeJS.ErrnoException`.
 */
export function stat(
	path: PathLike,
	opts: StatOptions & {
		bigint: true;
	},
): ResultAsync<BigIntStats, NodeJS.ErrnoException>;
export function stat(
	path: PathLike,
	opts?: StatOptions,
): ResultAsync<Stats | BigIntStats, NodeJS.ErrnoException> {
	return ResultAsync.try(() => nodeStat(path, opts));
}

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
 * // ok(Stats) or err(NodeJS.ErrnoException)
 * ```
 *
 * @param path - The file path.
 * @param opts - Optional stat options.
 *
 * @returns A `ResultAsync` containing the `Stats` object, or a `NodeJS.ErrnoException`.
 */
export function lstat(
	path: PathLike,
	opts?: StatOptions & {
		bigint?: false | undefined;
	},
): ResultAsync<Stats, NodeJS.ErrnoException>;
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
 * // ok(BigIntStats) or err(NodeJS.ErrnoException)
 * ```
 *
 * @param path - The file path.
 * @param opts - Options with `bigint: true`.
 *
 * @returns A `ResultAsync` containing the `BigIntStats` object, or a `NodeJS.ErrnoException`.
 */
export function lstat(
	path: PathLike,
	opts: StatOptions & {
		bigint: true;
	},
): ResultAsync<BigIntStats, NodeJS.ErrnoException>;
export function lstat(
	path: PathLike,
	opts?: StatOptions,
): ResultAsync<Stats | BigIntStats, NodeJS.ErrnoException> {
	return ResultAsync.try(() => nodeLstat(path, opts));
}

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
 * // ok(StatsFs) or err(NodeJS.ErrnoException)
 * ```
 *
 * @param path - The filesystem path.
 * @param opts - Optional statfs options.
 *
 * @returns A `ResultAsync` containing the `StatsFs` object, or a `NodeJS.ErrnoException`.
 */
export function statfs(
	path: PathLike,
	opts?: StatFsOptions & {
		bigint?: false | undefined;
	},
): ResultAsync<StatsFs, NodeJS.ErrnoException>;
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
 * // ok(BigIntStatsFs) or err(NodeJS.ErrnoException)
 * ```
 *
 * @param path - The filesystem path.
 * @param opts - Options with `bigint: true`.
 *
 * @returns A `ResultAsync` containing the `BigIntStatsFs` object, or a `NodeJS.ErrnoException`.
 */
export function statfs(
	path: PathLike,
	opts: StatFsOptions & {
		bigint: true;
	},
): ResultAsync<BigIntStatsFs, NodeJS.ErrnoException>;
export function statfs(
	path: PathLike,
	opts?: StatFsOptions,
): ResultAsync<StatsFs | BigIntStatsFs, NodeJS.ErrnoException> {
	return ResultAsync.try(() => nodeStatfs(path, opts));
}

/**
 * Non-throwing wrapper around `fs.promises.access`.
 *
 * @example
 * ```ts
 * import { access } from "@antithrow/node";
 * import { constants } from "node:fs";
 *
 * const result = await access("/tmp/hello.txt", constants.R_OK);
 * // ok(undefined) or err(NodeJS.ErrnoException)
 * ```
 *
 * @param path - The file path.
 * @param mode - Optional accessibility check mode. Defaults to `fs.constants.F_OK`.
 *
 * @returns A `ResultAsync` containing `undefined` on success, or a `NodeJS.ErrnoException`.
 */
export function access(path: PathLike, mode?: number): ResultAsync<void, NodeJS.ErrnoException> {
	return ResultAsync.try(() => nodeAccess(path, mode));
}
