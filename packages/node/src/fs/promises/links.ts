import type { BufferEncodingOption, ObjectEncodingOptions, PathLike } from "node:fs";
import {
	link as nodeLink,
	readlink as nodeReadlink,
	realpath as nodeRealpath,
	symlink as nodeSymlink,
	unlink as nodeUnlink,
} from "node:fs/promises";

import { ResultAsync } from "antithrow";

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
 * // ok("/tmp/target") or err(NodeJS.ErrnoException)
 * ```
 *
 * @param path - The path to the symbolic link.
 * @param options - Optional encoding or options object.
 *
 * @returns A `ResultAsync` containing the link target as a `string`, or a `NodeJS.ErrnoException`.
 */
export function readlink(
	path: PathLike,
	options?: ObjectEncodingOptions | BufferEncoding | null,
): ResultAsync<string, NodeJS.ErrnoException>;
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
 * // ok(Buffer) or err(NodeJS.ErrnoException)
 * ```
 *
 * @param path - The path to the symbolic link.
 * @param options - Options with `encoding: "buffer"`.
 *
 * @returns A `ResultAsync` containing the link target as a `Buffer`, or a `NodeJS.ErrnoException`.
 */
export function readlink(
	path: PathLike,
	options: BufferEncodingOption,
): ResultAsync<Buffer<ArrayBuffer>, NodeJS.ErrnoException>;
export function readlink(
	path: PathLike,
	options?: ObjectEncodingOptions | BufferEncoding | BufferEncodingOption | null,
): ResultAsync<string | Buffer<ArrayBuffer>, NodeJS.ErrnoException> {
	return ResultAsync.try(() => nodeReadlink(path, options as BufferEncoding));
}

/**
 * Non-throwing wrapper around `fs.promises.link`.
 *
 * @example
 * ```ts
 * import { link } from "@antithrow/node";
 *
 * const result = await link("/tmp/existing.txt", "/tmp/new-link.txt");
 * // ok(undefined) or err(NodeJS.ErrnoException)
 * ```
 *
 * @param existingPath - The existing file path.
 * @param newPath - The new link path.
 *
 * @returns A `ResultAsync` containing `undefined` on success, or a `NodeJS.ErrnoException`.
 */
export function link(
	existingPath: PathLike,
	newPath: PathLike,
): ResultAsync<void, NodeJS.ErrnoException> {
	return ResultAsync.try(() => nodeLink(existingPath, newPath));
}

/**
 * Non-throwing wrapper around `fs.promises.symlink`.
 *
 * @example
 * ```ts
 * import { symlink } from "@antithrow/node";
 *
 * const result = await symlink("/tmp/target", "/tmp/my-link");
 * // ok(undefined) or err(NodeJS.ErrnoException)
 * ```
 *
 * @param target - The target of the symbolic link.
 * @param path - The path of the symbolic link.
 * @param type - Optional type hint for Windows (`"dir"`, `"file"`, or `"junction"`).
 *
 * @returns A `ResultAsync` containing `undefined` on success, or a `NodeJS.ErrnoException`.
 */
export function symlink(
	target: PathLike,
	path: PathLike,
	type?: string | null,
): ResultAsync<void, NodeJS.ErrnoException> {
	return ResultAsync.try(() => nodeSymlink(target, path, type));
}

/**
 * Non-throwing wrapper around `fs.promises.unlink`.
 *
 * @example
 * ```ts
 * import { unlink } from "@antithrow/node";
 *
 * const result = await unlink("/tmp/old-file.txt");
 * // ok(undefined) or err(NodeJS.ErrnoException)
 * ```
 *
 * @param path - The path to the file or symbolic link to remove.
 *
 * @returns A `ResultAsync` containing `undefined` on success, or a `NodeJS.ErrnoException`.
 */
export function unlink(path: PathLike): ResultAsync<void, NodeJS.ErrnoException> {
	return ResultAsync.try(() => nodeUnlink(path));
}

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
 * // ok("/tmp/hello.txt") or err(NodeJS.ErrnoException)
 * ```
 *
 * @param path - The path to resolve.
 * @param options - Optional encoding or options object.
 *
 * @returns A `ResultAsync` containing the resolved path as a `string`, or a `NodeJS.ErrnoException`.
 */
export function realpath(
	path: PathLike,
	options?: ObjectEncodingOptions | BufferEncoding | null,
): ResultAsync<string, NodeJS.ErrnoException>;
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
 * // ok(Buffer) or err(NodeJS.ErrnoException)
 * ```
 *
 * @param path - The path to resolve.
 * @param options - Options with `encoding: "buffer"`.
 *
 * @returns A `ResultAsync` containing the resolved path as a `Buffer`, or a `NodeJS.ErrnoException`.
 */
export function realpath(
	path: PathLike,
	options: BufferEncodingOption,
): ResultAsync<Buffer, NodeJS.ErrnoException>;
export function realpath(
	path: PathLike,
	options?: ObjectEncodingOptions | BufferEncoding | BufferEncodingOption | null,
): ResultAsync<string | Buffer, NodeJS.ErrnoException> {
	return ResultAsync.try(() => nodeRealpath(path, options as BufferEncoding));
}
