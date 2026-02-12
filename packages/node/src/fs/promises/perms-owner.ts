import type { Mode, PathLike } from "node:fs";
import { chmod as nodeChmod, chown as nodeChown, lchown as nodeLchown } from "node:fs/promises";

import { ResultAsync } from "antithrow";
import type { FsError } from "./errors.js";

/** Errno codes thrown by `chmod`. */
export type ChmodCode =
	| "ENOENT"
	| "EACCES"
	| "EPERM"
	| "EROFS"
	| "EIO"
	| "ENOTDIR"
	| "ELOOP"
	| "ENAMETOOLONG";

/**
 * Non-throwing wrapper around `fs.promises.chmod`.
 *
 * @example
 * ```ts
 * import { chmod } from "@antithrow/node";
 *
 * const result = await chmod("/tmp/script.sh", 0o755);
 * // ok(undefined) or err(FsError<ChmodCode>)
 * ```
 *
 * @param path - The file path.
 * @param mode - The file mode bit mask.
 *
 * @returns A `ResultAsync` containing `undefined` on success, or an `FsError`.
 */
export function chmod(path: PathLike, mode: Mode): ResultAsync<void, FsError<ChmodCode>> {
	return ResultAsync.try(() => nodeChmod(path, mode));
}

/** Errno codes thrown by `chown`. */
export type ChownCode =
	| "ENOENT"
	| "EACCES"
	| "EPERM"
	| "EROFS"
	| "EIO"
	| "ENOTDIR"
	| "ELOOP"
	| "ENAMETOOLONG";

/**
 * Non-throwing wrapper around `fs.promises.chown`.
 *
 * @example
 * ```ts
 * import { chown } from "@antithrow/node";
 *
 * const result = await chown("/tmp/hello.txt", 1000, 1000);
 * // ok(undefined) or err(FsError<ChownCode>)
 * ```
 *
 * @param path - The file path.
 * @param uid - The new owner's user id.
 * @param gid - The new group's group id.
 *
 * @returns A `ResultAsync` containing `undefined` on success, or an `FsError`.
 */
export function chown(
	path: PathLike,
	uid: number,
	gid: number,
): ResultAsync<void, FsError<ChownCode>> {
	return ResultAsync.try(() => nodeChown(path, uid, gid));
}

/** Errno codes thrown by `lchown`. */
export type LchownCode = ChownCode;

/**
 * Non-throwing wrapper around `fs.promises.lchown`.
 *
 * Changes ownership on a symbolic link without dereferencing it.
 *
 * @example
 * ```ts
 * import { lchown } from "@antithrow/node";
 *
 * const result = await lchown("/tmp/my-link", 1000, 1000);
 * // ok(undefined) or err(FsError<LchownCode>)
 * ```
 *
 * @param path - The symbolic link path.
 * @param uid - The new owner's user id.
 * @param gid - The new group's group id.
 *
 * @returns A `ResultAsync` containing `undefined` on success, or an `FsError`.
 */
export function lchown(
	path: PathLike,
	uid: number,
	gid: number,
): ResultAsync<void, FsError<LchownCode>> {
	return ResultAsync.try(() => nodeLchown(path, uid, gid));
}
