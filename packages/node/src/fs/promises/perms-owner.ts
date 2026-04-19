import type { Mode, PathLike } from "node:fs";
import { chmod as nodeChmod, chown as nodeChown, lchown as nodeLchown } from "node:fs/promises";

import { Result } from "antithrow";

/**
 * Non-throwing wrapper around `fs.promises.chmod`.
 *
 * @example
 * ```ts
 * import { chmod } from "@antithrow/node/fs/promises";
 *
 * const result = await chmod("/tmp/script.sh", 0o755);
 * // ok(undefined) or err(NodeJS.ErrnoException)
 * ```
 *
 * @param path - The file path.
 * @param mode - The file mode bit mask.
 *
 * @returns A `Result` containing `undefined` on success, or a `NodeJS.ErrnoException`.
 */
export function chmod(path: PathLike, mode: Mode): Result<void, NodeJS.ErrnoException> {
	return Result.try(() => nodeChmod(path, mode));
}

/**
 * Non-throwing wrapper around `fs.promises.chown`.
 *
 * @example
 * ```ts
 * import { chown } from "@antithrow/node/fs/promises";
 *
 * const result = await chown("/tmp/hello.txt", 1000, 1000);
 * // ok(undefined) or err(NodeJS.ErrnoException)
 * ```
 *
 * @param path - The file path.
 * @param uid - The new owner's user id.
 * @param gid - The new group's group id.
 *
 * @returns A `Result` containing `undefined` on success, or a `NodeJS.ErrnoException`.
 */
export function chown(
	path: PathLike,
	uid: number,
	gid: number,
): Result<void, NodeJS.ErrnoException> {
	return Result.try(() => nodeChown(path, uid, gid));
}

/**
 * Non-throwing wrapper around `fs.promises.lchown`.
 *
 * Changes ownership on a symbolic link without dereferencing it.
 *
 * @example
 * ```ts
 * import { lchown } from "@antithrow/node/fs/promises";
 *
 * const result = await lchown("/tmp/my-link", 1000, 1000);
 * // ok(undefined) or err(NodeJS.ErrnoException)
 * ```
 *
 * @param path - The symbolic link path.
 * @param uid - The new owner's user id.
 * @param gid - The new group's group id.
 *
 * @returns A `Result` containing `undefined` on success, or a `NodeJS.ErrnoException`.
 */
export function lchown(
	path: PathLike,
	uid: number,
	gid: number,
): Result<void, NodeJS.ErrnoException> {
	return Result.try(() => nodeLchown(path, uid, gid));
}
