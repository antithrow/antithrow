import type { Mode, PathLike } from "node:fs";
import { chmod as nodeChmod, chown as nodeChown, lchown as nodeLchown } from "node:fs/promises";

import { ResultAsync } from "antithrow";

/**
 * Non-throwing wrapper around `fs.promises.chmod`.
 *
 * @example
 * ```ts
 * import { chmod } from "@antithrow/node";
 *
 * const result = await chmod("/tmp/script.sh", 0o755);
 * // ok(undefined) or err(NodeJS.ErrnoException)
 * ```
 *
 * @param path - The file path.
 * @param mode - The file mode bit mask.
 *
 * @returns A `ResultAsync` containing `undefined` on success, or a `NodeJS.ErrnoException`.
 */
export function chmod(path: PathLike, mode: Mode): ResultAsync<void, NodeJS.ErrnoException> {
	return ResultAsync.try(() => nodeChmod(path, mode));
}

/**
 * Non-throwing wrapper around `fs.promises.chown`.
 *
 * @example
 * ```ts
 * import { chown } from "@antithrow/node";
 *
 * const result = await chown("/tmp/hello.txt", 1000, 1000);
 * // ok(undefined) or err(NodeJS.ErrnoException)
 * ```
 *
 * @param path - The file path.
 * @param uid - The new owner's user id.
 * @param gid - The new group's group id.
 *
 * @returns A `ResultAsync` containing `undefined` on success, or a `NodeJS.ErrnoException`.
 */
export function chown(
	path: PathLike,
	uid: number,
	gid: number,
): ResultAsync<void, NodeJS.ErrnoException> {
	return ResultAsync.try(() => nodeChown(path, uid, gid));
}

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
 * // ok(undefined) or err(NodeJS.ErrnoException)
 * ```
 *
 * @param path - The symbolic link path.
 * @param uid - The new owner's user id.
 * @param gid - The new group's group id.
 *
 * @returns A `ResultAsync` containing `undefined` on success, or a `NodeJS.ErrnoException`.
 */
export function lchown(
	path: PathLike,
	uid: number,
	gid: number,
): ResultAsync<void, NodeJS.ErrnoException> {
	return ResultAsync.try(() => nodeLchown(path, uid, gid));
}
