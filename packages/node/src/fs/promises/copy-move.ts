import type { CopyOptions, PathLike } from "node:fs";
import { copyFile as nodeCopyFile, cp as nodeCp, rename as nodeRename } from "node:fs/promises";

import { Result } from "antithrow";

/**
 * Non-throwing wrapper around `fs.promises.rename`.
 *
 * @example
 * ```ts
 * import { rename } from "@antithrow/node/fs/promises";
 *
 * const result = await rename("/tmp/old.txt", "/tmp/new.txt");
 * // ok(undefined) or err(NodeJS.ErrnoException)
 * ```
 *
 * @param oldPath - The current path.
 * @param newPath - The new path.
 *
 * @returns A `Result` containing `undefined` on success, or a `NodeJS.ErrnoException`.
 */
export function rename(oldPath: PathLike, newPath: PathLike): Result<void, NodeJS.ErrnoException> {
	return Result.try(() => nodeRename(oldPath, newPath));
}

/**
 * Non-throwing wrapper around `fs.promises.copyFile`.
 *
 * @example
 * ```ts
 * import { copyFile } from "@antithrow/node/fs/promises";
 *
 * const result = await copyFile("/tmp/source.txt", "/tmp/dest.txt");
 * // ok(undefined) or err(NodeJS.ErrnoException)
 * ```
 *
 * @param src - The source file path.
 * @param dest - The destination file path.
 * @param mode - Optional modifiers for the copy operation.
 *
 * @returns A `Result` containing `undefined` on success, or a `NodeJS.ErrnoException`.
 */
export function copyFile(
	src: PathLike,
	dest: PathLike,
	mode?: number,
): Result<void, NodeJS.ErrnoException> {
	return Result.try(() => nodeCopyFile(src, dest, mode));
}

/**
 * Non-throwing wrapper around `fs.promises.cp`.
 *
 * @example
 * ```ts
 * import { cp } from "@antithrow/node/fs/promises";
 *
 * const result = await cp("/tmp/src-dir", "/tmp/dest-dir", { recursive: true });
 * // ok(undefined) or err(NodeJS.ErrnoException)
 * ```
 *
 * @param source - The source path.
 * @param destination - The destination path.
 * @param opts - Optional copy options.
 *
 * @returns A `Result` containing `undefined` on success, or a `NodeJS.ErrnoException`.
 */
export function cp(
	source: string | URL,
	destination: string | URL,
	opts?: CopyOptions,
): Result<void, NodeJS.ErrnoException> {
	return Result.try(() => nodeCp(source, destination, opts));
}
