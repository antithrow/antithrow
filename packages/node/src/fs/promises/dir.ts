import type {
	Dir,
	Dirent,
	MakeDirectoryOptions,
	Mode,
	ObjectEncodingOptions,
	OpenDirOptions,
	PathLike,
	RmOptions,
} from "node:fs";
import {
	mkdir as nodeMkdir,
	mkdtemp as nodeMkdtemp,
	opendir as nodeOpendir,
	readdir as nodeReaddir,
	rm as nodeRm,
	rmdir as nodeRmdir,
} from "node:fs/promises";

import { ResultAsync } from "antithrow";

/**
 * Non-throwing wrapper around `fs.promises.readdir`.
 *
 * Returns an array of filenames as strings.
 *
 * @example
 * ```ts
 * import { readdir } from "@antithrow/node";
 *
 * const result = await readdir("/tmp");
 * // ok(["file1.txt", "file2.txt"]) or err(NodeJS.ErrnoException)
 * ```
 *
 * @param path - The directory path.
 * @param options - Optional encoding or options object.
 *
 * @returns A `ResultAsync` containing an array of filenames, or a `NodeJS.ErrnoException`.
 */
export function readdir(
	path: PathLike,
	options?:
		| (ObjectEncodingOptions & {
				withFileTypes?: false | undefined;
				recursive?: boolean | undefined;
		  })
		| BufferEncoding
		| null,
): ResultAsync<string[], NodeJS.ErrnoException>;
/**
 * Non-throwing wrapper around `fs.promises.readdir`.
 *
 * Returns an array of `Buffer` filenames when encoding is `"buffer"`.
 *
 * @example
 * ```ts
 * import { readdir } from "@antithrow/node";
 *
 * const result = await readdir("/tmp", { encoding: "buffer" });
 * // ok(Buffer[]) or err(NodeJS.ErrnoException)
 * ```
 *
 * @param path - The directory path.
 * @param options - Options with `encoding: "buffer"`.
 *
 * @returns A `ResultAsync` containing an array of `Buffer` filenames, or a `NodeJS.ErrnoException`.
 */
export function readdir(
	path: PathLike,
	options:
		| {
				encoding: "buffer";
				withFileTypes?: false | undefined;
				recursive?: boolean | undefined;
		  }
		| "buffer",
): ResultAsync<Buffer[], NodeJS.ErrnoException>;
/**
 * Non-throwing wrapper around `fs.promises.readdir`.
 *
 * Returns an array of `Dirent` objects when `withFileTypes` is `true`.
 *
 * @example
 * ```ts
 * import { readdir } from "@antithrow/node";
 *
 * const result = await readdir("/tmp", { withFileTypes: true });
 * // ok(Dirent[]) or err(NodeJS.ErrnoException)
 * ```
 *
 * @param path - The directory path.
 * @param options - Options with `withFileTypes: true`.
 *
 * @returns A `ResultAsync` containing an array of `Dirent` objects, or a `NodeJS.ErrnoException`.
 */
export function readdir(
	path: PathLike,
	options: ObjectEncodingOptions & {
		withFileTypes: true;
		recursive?: boolean | undefined;
	},
): ResultAsync<Dirent[], NodeJS.ErrnoException>;
export function readdir(
	path: PathLike,
	options?:
		| (ObjectEncodingOptions & {
				withFileTypes?: boolean | undefined;
				recursive?: boolean | undefined;
		  })
		| {
				encoding: "buffer";
				withFileTypes?: false | undefined;
				recursive?: boolean | undefined;
		  }
		| BufferEncoding
		| "buffer"
		| null,
): ResultAsync<string[] | Buffer[] | Dirent[], NodeJS.ErrnoException> {
	return ResultAsync.try(() => nodeReaddir(path, options as BufferEncoding));
}

/**
 * Non-throwing wrapper around `fs.promises.mkdir`.
 *
 * When `recursive` is `true`, returns the first directory path created (or `undefined`).
 *
 * @example
 * ```ts
 * import { mkdir } from "@antithrow/node";
 *
 * const result = await mkdir("/tmp/a/b/c", { recursive: true });
 * // ok("/tmp/a") or err(NodeJS.ErrnoException)
 * ```
 *
 * @param path - The directory path.
 * @param options - Options with `recursive: true`.
 *
 * @returns A `ResultAsync` containing the first created path or `undefined`, or a `NodeJS.ErrnoException`.
 */
export function mkdir(
	path: PathLike,
	options: MakeDirectoryOptions & {
		recursive: true;
	},
): ResultAsync<string | undefined, NodeJS.ErrnoException>;
/**
 * Non-throwing wrapper around `fs.promises.mkdir`.
 *
 * Creates a single directory (non-recursive).
 *
 * @example
 * ```ts
 * import { mkdir } from "@antithrow/node";
 *
 * const result = await mkdir("/tmp/mydir");
 * // ok(undefined) or err(NodeJS.ErrnoException)
 * ```
 *
 * @param path - The directory path.
 * @param options - Optional mode or options object.
 *
 * @returns A `ResultAsync` containing `undefined` on success, or a `NodeJS.ErrnoException`.
 */
export function mkdir(
	path: PathLike,
	options?:
		| Mode
		| (MakeDirectoryOptions & {
				recursive?: false | undefined;
		  })
		| null,
): ResultAsync<undefined, NodeJS.ErrnoException>;
export function mkdir(
	path: PathLike,
	options?: Mode | MakeDirectoryOptions | null,
): ResultAsync<string | undefined, NodeJS.ErrnoException> {
	return ResultAsync.try(() => nodeMkdir(path, options));
}

/**
 * Non-throwing wrapper around `fs.promises.rmdir`.
 *
 * @example
 * ```ts
 * import { rmdir } from "@antithrow/node";
 *
 * const result = await rmdir("/tmp/mydir");
 * // ok(undefined) or err(NodeJS.ErrnoException)
 * ```
 *
 * @param path - The directory path.
 *
 * @returns A `ResultAsync` containing `undefined` on success, or a `NodeJS.ErrnoException`.
 */
export function rmdir(path: PathLike): ResultAsync<void, NodeJS.ErrnoException> {
	return ResultAsync.try(() => nodeRmdir(path));
}

/**
 * Non-throwing wrapper around `fs.promises.rm`.
 *
 * @example
 * ```ts
 * import { rm } from "@antithrow/node";
 *
 * const result = await rm("/tmp/mydir", { recursive: true, force: true });
 * // ok(undefined) or err(NodeJS.ErrnoException)
 * ```
 *
 * @param path - The path to remove.
 * @param options - Optional removal options.
 *
 * @returns A `ResultAsync` containing `undefined` on success, or a `NodeJS.ErrnoException`.
 */
export function rm(path: PathLike, options?: RmOptions): ResultAsync<void, NodeJS.ErrnoException> {
	return ResultAsync.try(() => nodeRm(path, options));
}

/**
 * Non-throwing wrapper around `fs.promises.mkdtemp`.
 *
 * @example
 * ```ts
 * import { mkdtemp } from "@antithrow/node";
 * import { join } from "node:path";
 * import { tmpdir } from "node:os";
 *
 * const result = await mkdtemp(join(tmpdir(), "myapp-"));
 * // ok("/tmp/myapp-aBcDeF") or err(NodeJS.ErrnoException)
 * ```
 *
 * @param prefix - The prefix for the temporary directory name.
 * @param options - Optional encoding or options object.
 *
 * @returns A `ResultAsync` containing the created directory path, or a `NodeJS.ErrnoException`.
 */
export function mkdtemp(
	prefix: string,
	options?: ObjectEncodingOptions | BufferEncoding | null,
): ResultAsync<string, NodeJS.ErrnoException> {
	return ResultAsync.try(() => nodeMkdtemp(prefix, options));
}

/**
 * Non-throwing wrapper around `fs.promises.opendir`.
 *
 * @example
 * ```ts
 * import { opendir } from "@antithrow/node";
 *
 * const result = await opendir("/tmp");
 * if (result.isOk()) {
 *   for await (const dirent of result.value) {
 *     console.log(dirent.name);
 *   }
 * }
 * ```
 *
 * @param path - The directory path.
 * @param options - Optional options for opening the directory.
 *
 * @returns A `ResultAsync` containing the `Dir` handle, or a `NodeJS.ErrnoException`.
 */
export function opendir(
	path: PathLike,
	options?: OpenDirOptions,
): ResultAsync<Dir, NodeJS.ErrnoException> {
	return ResultAsync.try(() => nodeOpendir(path, options));
}
