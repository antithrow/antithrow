import type { BufferEncodingOption, ObjectEncodingOptions, PathLike } from "node:fs";
import {
	link as nodeLink,
	readlink as nodeReadlink,
	realpath as nodeRealpath,
	symlink as nodeSymlink,
	unlink as nodeUnlink,
} from "node:fs/promises";

import { ResultAsync } from "antithrow";
import type { FsError } from "./errors.js";

/** Errno codes thrown by `readlink`. */
export type ReadlinkCode =
	| "ENOENT"
	| "EACCES"
	| "ENOTDIR"
	| "EINVAL"
	| "EIO"
	| "ELOOP"
	| "ENAMETOOLONG";

/**
 * Non-throwing wrapper around `fs.promises.readlink`.
 *
 * Returns the link target as a `string`.
 *
 * @example
 * ```ts
 * import { readlink } from "@antithrow/node";
 *
 * const result = await readlink("/tmp/my-link");
 * // ok("/tmp/target") or err(FsError<ReadlinkCode>)
 * ```
 *
 * @param path - The path to the symbolic link.
 * @param options - Optional encoding or options object.
 *
 * @returns A `ResultAsync` containing the link target as a `string`, or an `FsError`.
 */
export function readlink(
	path: PathLike,
	options?: ObjectEncodingOptions | BufferEncoding | null,
): ResultAsync<string, FsError<ReadlinkCode>>;
/**
 * Non-throwing wrapper around `fs.promises.readlink`.
 *
 * Returns the link target as a `Buffer` when encoding is `"buffer"`.
 *
 * @example
 * ```ts
 * import { readlink } from "@antithrow/node";
 *
 * const result = await readlink("/tmp/my-link", { encoding: "buffer" });
 * // ok(Buffer) or err(FsError<ReadlinkCode>)
 * ```
 *
 * @param path - The path to the symbolic link.
 * @param options - Options with `encoding: "buffer"`.
 *
 * @returns A `ResultAsync` containing the link target as a `Buffer`, or an `FsError`.
 */
export function readlink(
	path: PathLike,
	options: BufferEncodingOption,
): ResultAsync<Buffer<ArrayBuffer>, FsError<ReadlinkCode>>;
export function readlink(
	path: PathLike,
	options?: ObjectEncodingOptions | BufferEncoding | BufferEncodingOption | null,
): ResultAsync<string | Buffer<ArrayBuffer>, FsError<ReadlinkCode>> {
	return ResultAsync.try(() => nodeReadlink(path, options as BufferEncoding));
}

/** Errno codes thrown by `link`. */
export type LinkCode =
	| "ENOENT"
	| "EACCES"
	| "EEXIST"
	| "ENOTDIR"
	| "EMFILE"
	| "ENFILE"
	| "ENOSPC"
	| "EPERM"
	| "EROFS"
	| "EXDEV"
	| "EIO"
	| "ELOOP"
	| "ENAMETOOLONG";

/**
 * Non-throwing wrapper around `fs.promises.link`.
 *
 * @example
 * ```ts
 * import { link } from "@antithrow/node";
 *
 * const result = await link("/tmp/existing.txt", "/tmp/new-link.txt");
 * // ok(undefined) or err(FsError<LinkCode>)
 * ```
 *
 * @param existingPath - The existing file path.
 * @param newPath - The new link path.
 *
 * @returns A `ResultAsync` containing `undefined` on success, or an `FsError`.
 */
export function link(
	existingPath: PathLike,
	newPath: PathLike,
): ResultAsync<void, FsError<LinkCode>> {
	return ResultAsync.try(() => nodeLink(existingPath, newPath));
}

/** Errno codes thrown by `symlink`. */
export type SymlinkCode =
	| "ENOENT"
	| "EACCES"
	| "EEXIST"
	| "ENOTDIR"
	| "EMFILE"
	| "ENFILE"
	| "ENOSPC"
	| "EPERM"
	| "EIO"
	| "ELOOP"
	| "ENAMETOOLONG";

/**
 * Non-throwing wrapper around `fs.promises.symlink`.
 *
 * @example
 * ```ts
 * import { symlink } from "@antithrow/node";
 *
 * const result = await symlink("/tmp/target", "/tmp/my-link");
 * // ok(undefined) or err(FsError<SymlinkCode>)
 * ```
 *
 * @param target - The target of the symbolic link.
 * @param path - The path of the symbolic link.
 * @param type - Optional type hint for Windows (`"dir"`, `"file"`, or `"junction"`).
 *
 * @returns A `ResultAsync` containing `undefined` on success, or an `FsError`.
 */
export function symlink(
	target: PathLike,
	path: PathLike,
	type?: string | null,
): ResultAsync<void, FsError<SymlinkCode>> {
	return ResultAsync.try(() => nodeSymlink(target, path, type));
}

/** Errno codes thrown by `unlink`. */
export type UnlinkCode =
	| "ENOENT"
	| "EACCES"
	| "ENOTDIR"
	| "EPERM"
	| "EROFS"
	| "EBUSY"
	| "EIO"
	| "EISDIR"
	| "ELOOP"
	| "ENAMETOOLONG";

/**
 * Non-throwing wrapper around `fs.promises.unlink`.
 *
 * @example
 * ```ts
 * import { unlink } from "@antithrow/node";
 *
 * const result = await unlink("/tmp/old-file.txt");
 * // ok(undefined) or err(FsError<UnlinkCode>)
 * ```
 *
 * @param path - The path to the file or symbolic link to remove.
 *
 * @returns A `ResultAsync` containing `undefined` on success, or an `FsError`.
 */
export function unlink(path: PathLike): ResultAsync<void, FsError<UnlinkCode>> {
	return ResultAsync.try(() => nodeUnlink(path));
}

/** Errno codes thrown by `realpath`. */
export type RealpathCode = "ENOENT" | "EACCES" | "ENOTDIR" | "ELOOP" | "ENAMETOOLONG" | "EIO";

/**
 * Non-throwing wrapper around `fs.promises.realpath`.
 *
 * Returns the resolved path as a `string`.
 *
 * @example
 * ```ts
 * import { realpath } from "@antithrow/node";
 *
 * const result = await realpath("/tmp/../tmp/hello.txt");
 * // ok("/tmp/hello.txt") or err(FsError<RealpathCode>)
 * ```
 *
 * @param path - The path to resolve.
 * @param options - Optional encoding or options object.
 *
 * @returns A `ResultAsync` containing the resolved path as a `string`, or an `FsError`.
 */
export function realpath(
	path: PathLike,
	options?: ObjectEncodingOptions | BufferEncoding | null,
): ResultAsync<string, FsError<RealpathCode>>;
/**
 * Non-throwing wrapper around `fs.promises.realpath`.
 *
 * Returns the resolved path as a `Buffer` when encoding is `"buffer"`.
 *
 * @example
 * ```ts
 * import { realpath } from "@antithrow/node";
 *
 * const result = await realpath("/tmp/hello.txt", { encoding: "buffer" });
 * // ok(Buffer) or err(FsError<RealpathCode>)
 * ```
 *
 * @param path - The path to resolve.
 * @param options - Options with `encoding: "buffer"`.
 *
 * @returns A `ResultAsync` containing the resolved path as a `Buffer`, or an `FsError`.
 */
export function realpath(
	path: PathLike,
	options: BufferEncodingOption,
): ResultAsync<Buffer, FsError<RealpathCode>>;
export function realpath(
	path: PathLike,
	options?: ObjectEncodingOptions | BufferEncoding | BufferEncodingOption | null,
): ResultAsync<string | Buffer, FsError<RealpathCode>> {
	return ResultAsync.try(() => nodeRealpath(path, options as BufferEncoding));
}
