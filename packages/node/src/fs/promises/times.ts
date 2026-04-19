import type { PathLike, TimeLike } from "node:fs";
import { lutimes as nodeLutimes, utimes as nodeUtimes } from "node:fs/promises";

import { Result } from "antithrow";

/**
 * Non-throwing wrapper around `fs.promises.utimes`.
 *
 * @example
 * ```ts
 * import { utimes } from "@antithrow/node/fs/promises";
 *
 * const now = new Date();
 * const result = await utimes("/tmp/hello.txt", now, now);
 * // ok(undefined) or err(NodeJS.ErrnoException)
 * ```
 *
 * @param path - The file path.
 * @param atime - The new access time.
 * @param mtime - The new modification time.
 *
 * @returns A `Result` containing `undefined` on success, or a `NodeJS.ErrnoException`.
 */
export function utimes(
	path: PathLike,
	atime: TimeLike,
	mtime: TimeLike,
): Result<void, NodeJS.ErrnoException> {
	return Result.try(() => nodeUtimes(path, atime, mtime));
}

/**
 * Non-throwing wrapper around `fs.promises.lutimes`.
 *
 * Like `utimes`, but does not follow symbolic links.
 *
 * @example
 * ```ts
 * import { lutimes } from "@antithrow/node/fs/promises";
 *
 * const now = new Date();
 * const result = await lutimes("/tmp/my-link", now, now);
 * // ok(undefined) or err(NodeJS.ErrnoException)
 * ```
 *
 * @param path - The symbolic link path.
 * @param atime - The new access time.
 * @param mtime - The new modification time.
 *
 * @returns A `Result` containing `undefined` on success, or a `NodeJS.ErrnoException`.
 */
export function lutimes(
	path: PathLike,
	atime: TimeLike,
	mtime: TimeLike,
): Result<void, NodeJS.ErrnoException> {
	return Result.try(() => nodeLutimes(path, atime, mtime));
}
