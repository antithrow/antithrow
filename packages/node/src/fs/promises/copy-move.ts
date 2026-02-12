import type { CopyOptions, PathLike } from "node:fs";
import { copyFile as nodeCopyFile, cp as nodeCp, rename as nodeRename } from "node:fs/promises";

import { ResultAsync } from "antithrow";
import type { FsError } from "./errors.js";

/** Errno codes thrown by `rename`. */
export type RenameCode =
	| "ENOENT"
	| "EACCES"
	| "EEXIST"
	| "EISDIR"
	| "ENOTDIR"
	| "EMFILE"
	| "ENFILE"
	| "ENOSPC"
	| "EPERM"
	| "EROFS"
	| "EBUSY"
	| "EXDEV"
	| "ELOOP"
	| "ENAMETOOLONG";

/**
 * Non-throwing wrapper around `fs.promises.rename`.
 *
 * @example
 * ```ts
 * import { rename } from "@antithrow/node";
 *
 * const result = await rename("/tmp/old.txt", "/tmp/new.txt");
 * // ok(undefined) or err(FsError<RenameCode>)
 * ```
 *
 * @param oldPath - The current path.
 * @param newPath - The new path.
 *
 * @returns A `ResultAsync` containing `undefined` on success, or an `FsError`.
 */
export function rename(
	oldPath: PathLike,
	newPath: PathLike,
): ResultAsync<void, FsError<RenameCode>> {
	return ResultAsync.try(() => nodeRename(oldPath, newPath));
}

/** Errno codes thrown by `copyFile`. */
export type CopyFileCode =
	| "ENOENT"
	| "EACCES"
	| "EISDIR"
	| "EMFILE"
	| "ENFILE"
	| "ENOSPC"
	| "EIO"
	| "EPERM"
	| "EEXIST"
	| "ENOTDIR"
	| "ELOOP"
	| "ENAMETOOLONG";

/**
 * Non-throwing wrapper around `fs.promises.copyFile`.
 *
 * @example
 * ```ts
 * import { copyFile } from "@antithrow/node";
 *
 * const result = await copyFile("/tmp/source.txt", "/tmp/dest.txt");
 * // ok(undefined) or err(FsError<CopyFileCode>)
 * ```
 *
 * @param src - The source file path.
 * @param dest - The destination file path.
 * @param mode - Optional modifiers for the copy operation.
 *
 * @returns A `ResultAsync` containing `undefined` on success, or an `FsError`.
 */
export function copyFile(
	src: PathLike,
	dest: PathLike,
	mode?: number,
): ResultAsync<void, FsError<CopyFileCode>> {
	return ResultAsync.try(() => nodeCopyFile(src, dest, mode));
}

/** Errno codes thrown by `cp`. */
export type CpCode =
	| "ENOENT"
	| "EACCES"
	| "EISDIR"
	| "EMFILE"
	| "ENFILE"
	| "ENOSPC"
	| "EIO"
	| "EPERM"
	| "EEXIST"
	| "ENOTDIR"
	| "ELOOP"
	| "ENAMETOOLONG";

/**
 * Non-throwing wrapper around `fs.promises.cp`.
 *
 * @example
 * ```ts
 * import { cp } from "@antithrow/node";
 *
 * const result = await cp("/tmp/src-dir", "/tmp/dest-dir", { recursive: true });
 * // ok(undefined) or err(FsError<CpCode>)
 * ```
 *
 * @param source - The source path.
 * @param destination - The destination path.
 * @param opts - Optional copy options.
 *
 * @returns A `ResultAsync` containing `undefined` on success, or an `FsError`.
 */
export function cp(
	source: string | URL,
	destination: string | URL,
	opts?: CopyOptions,
): ResultAsync<void, FsError<CpCode>> {
	return ResultAsync.try(() => nodeCp(source, destination, opts));
}
