import type { PathLike, TimeLike } from "node:fs";
import { lutimes as nodeLutimes, utimes as nodeUtimes } from "node:fs/promises";

import { ResultAsync } from "antithrow";
import type { FsError } from "./errors.js";

/** Errno codes thrown by `utimes`. */
export type UtimesCode =
	| "ENOENT"
	| "EACCES"
	| "EPERM"
	| "EROFS"
	| "EIO"
	| "ENOTDIR"
	| "ELOOP"
	| "ENAMETOOLONG";

/**
 * Non-throwing wrapper around `fs.promises.utimes`.
 *
 * @example
 * ```ts
 * import { utimes } from "@antithrow/node";
 *
 * const now = new Date();
 * const result = await utimes("/tmp/hello.txt", now, now);
 * // ok(undefined) or err(FsError<UtimesCode>)
 * ```
 *
 * @param path - The file path.
 * @param atime - The new access time.
 * @param mtime - The new modification time.
 *
 * @returns A `ResultAsync` containing `undefined` on success, or an `FsError`.
 */
export function utimes(
	path: PathLike,
	atime: TimeLike,
	mtime: TimeLike,
): ResultAsync<void, FsError<UtimesCode>> {
	return ResultAsync.try(() => nodeUtimes(path, atime, mtime));
}

/** Errno codes thrown by `lutimes`. */
export type LutimesCode = UtimesCode;

/**
 * Non-throwing wrapper around `fs.promises.lutimes`.
 *
 * Like `utimes`, but does not follow symbolic links.
 *
 * @example
 * ```ts
 * import { lutimes } from "@antithrow/node";
 *
 * const now = new Date();
 * const result = await lutimes("/tmp/my-link", now, now);
 * // ok(undefined) or err(FsError<LutimesCode>)
 * ```
 *
 * @param path - The symbolic link path.
 * @param atime - The new access time.
 * @param mtime - The new modification time.
 *
 * @returns A `ResultAsync` containing `undefined` on success, or an `FsError`.
 */
export function lutimes(
	path: PathLike,
	atime: TimeLike,
	mtime: TimeLike,
): ResultAsync<void, FsError<LutimesCode>> {
	return ResultAsync.try(() => nodeLutimes(path, atime, mtime));
}
