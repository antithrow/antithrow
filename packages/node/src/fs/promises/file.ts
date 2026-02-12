import type { Abortable } from "node:events";
import type { Mode, ObjectEncodingOptions, OpenMode, PathLike } from "node:fs";
import type { FileHandle } from "node:fs/promises";
import {
	appendFile as nodeAppendFile,
	open as nodeOpen,
	readFile as nodeReadFile,
	truncate as nodeTruncate,
	writeFile as nodeWriteFile,
} from "node:fs/promises";
import type { Stream } from "node:stream";

import { ResultAsync } from "antithrow";
import type { FsError } from "./errors.js";

/** Errno codes thrown by `readFile`. */
export type ReadFileCode =
	| "ENOENT"
	| "EACCES"
	| "EISDIR"
	| "EMFILE"
	| "ENFILE"
	| "EIO"
	| "EBADF"
	| "EPERM"
	| "ENOTDIR"
	| "ELOOP"
	| "ENAMETOOLONG";

/**
 * Non-throwing wrapper around `fs.promises.readFile`.
 *
 * Returns the file contents as a `Buffer` when no encoding is specified.
 *
 * @example
 * ```ts
 * import { readFile } from "@antithrow/node";
 *
 * const result = await readFile("/tmp/data.bin");
 * // ok(Buffer) or err(FsError<ReadFileCode>)
 * ```
 *
 * @param path - The path to the file.
 * @param options - Optional read options.
 *
 * @returns A `ResultAsync` containing the file contents as a `Buffer`, or an `FsError`.
 */
export function readFile(
	path: PathLike | FileHandle,
	options?:
		| ({
				encoding?: null | undefined;
				flag?: OpenMode | undefined;
		  } & Abortable)
		| null,
): ResultAsync<Buffer, FsError<ReadFileCode>>;
/**
 * Non-throwing wrapper around `fs.promises.readFile`.
 *
 * Returns the file contents as a `string` when an encoding is specified.
 *
 * @example
 * ```ts
 * import { readFile } from "@antithrow/node";
 *
 * const result = await readFile("/tmp/hello.txt", "utf-8");
 * // ok("Hello, world!") or err(FsError<ReadFileCode>)
 * ```
 *
 * @param path - The path to the file.
 * @param options - The encoding or options object with an encoding.
 *
 * @returns A `ResultAsync` containing the file contents as a `string`, or an `FsError`.
 */
export function readFile(
	path: PathLike | FileHandle,
	options:
		| ({
				encoding: BufferEncoding;
				flag?: OpenMode | undefined;
		  } & Abortable)
		| BufferEncoding,
): ResultAsync<string, FsError<ReadFileCode>>;
/**
 * Non-throwing wrapper around `fs.promises.readFile`.
 *
 * Returns `string | Buffer` depending on the encoding option.
 *
 * @example
 * ```ts
 * import { readFile } from "@antithrow/node";
 *
 * const result = await readFile("/tmp/hello.txt", { encoding: "utf-8" });
 * // ok(string | Buffer) or err(FsError<ReadFileCode>)
 * ```
 *
 * @param path - The path to the file.
 * @param options - Optional encoding or options object.
 *
 * @returns A `ResultAsync` containing the file contents, or an `FsError`.
 */
export function readFile(
	path: PathLike | FileHandle,
	options?:
		| (ObjectEncodingOptions &
				Abortable & {
					flag?: OpenMode | undefined;
				})
		| BufferEncoding
		| null,
): ResultAsync<string | Buffer, FsError<ReadFileCode>>;
export function readFile(
	path: PathLike | FileHandle,
	options?:
		| (ObjectEncodingOptions &
				Abortable & {
					flag?: OpenMode | undefined;
				})
		| BufferEncoding
		| null,
): ResultAsync<string | Buffer, FsError<ReadFileCode>> {
	return ResultAsync.try(() => nodeReadFile(path, options as BufferEncoding));
}

/** Errno codes thrown by `writeFile`. */
export type WriteFileCode =
	| "ENOENT"
	| "EACCES"
	| "EISDIR"
	| "EMFILE"
	| "ENFILE"
	| "ENOSPC"
	| "EIO"
	| "EPERM"
	| "EROFS"
	| "ENOTDIR"
	| "ELOOP"
	| "ENAMETOOLONG";

/**
 * Non-throwing wrapper around `fs.promises.writeFile`.
 *
 * @example
 * ```ts
 * import { writeFile } from "@antithrow/node";
 *
 * const result = await writeFile("/tmp/hello.txt", "Hello, world!");
 * // ok(undefined) or err(FsError<WriteFileCode>)
 * ```
 *
 * @param file - The path or `FileHandle` to write to.
 * @param data - The data to write.
 * @param options - Optional write options.
 *
 * @returns A `ResultAsync` containing `undefined` on success, or an `FsError`.
 */
export function writeFile(
	file: PathLike | FileHandle,
	data:
		| string
		| NodeJS.ArrayBufferView
		| Iterable<string | NodeJS.ArrayBufferView>
		| AsyncIterable<string | NodeJS.ArrayBufferView>
		| Stream,
	options?:
		| (ObjectEncodingOptions & {
				mode?: Mode | undefined;
				flag?: OpenMode | undefined;
				flush?: boolean | undefined;
		  } & Abortable)
		| BufferEncoding
		| null,
): ResultAsync<void, FsError<WriteFileCode>> {
	return ResultAsync.try(() => nodeWriteFile(file, data, options));
}

/** Errno codes thrown by `appendFile`. */
export type AppendFileCode = WriteFileCode;

/**
 * Non-throwing wrapper around `fs.promises.appendFile`.
 *
 * @example
 * ```ts
 * import { appendFile } from "@antithrow/node";
 *
 * const result = await appendFile("/tmp/log.txt", "new line\n");
 * // ok(undefined) or err(FsError<AppendFileCode>)
 * ```
 *
 * @param path - The path or `FileHandle` to append to.
 * @param data - The data to append.
 * @param options - Optional append options.
 *
 * @returns A `ResultAsync` containing `undefined` on success, or an `FsError`.
 */
export function appendFile(
	path: PathLike | FileHandle,
	data: string | Uint8Array,
	options?:
		| (ObjectEncodingOptions & { flag?: OpenMode | undefined; flush?: boolean | undefined })
		| BufferEncoding
		| null,
): ResultAsync<void, FsError<AppendFileCode>> {
	return ResultAsync.try(() => nodeAppendFile(path, data, options));
}

/** Errno codes thrown by `truncate`. */
export type TruncateCode =
	| "ENOENT"
	| "EACCES"
	| "EISDIR"
	| "EPERM"
	| "EROFS"
	| "EIO"
	| "ENOTDIR"
	| "ELOOP"
	| "ENAMETOOLONG";

/**
 * Non-throwing wrapper around `fs.promises.truncate`.
 *
 * @example
 * ```ts
 * import { truncate } from "@antithrow/node";
 *
 * const result = await truncate("/tmp/data.bin", 100);
 * // ok(undefined) or err(FsError<TruncateCode>)
 * ```
 *
 * @param path - The path to the file.
 * @param len - The desired length in bytes. Defaults to `0`.
 *
 * @returns A `ResultAsync` containing `undefined` on success, or an `FsError`.
 */
export function truncate(path: PathLike, len?: number): ResultAsync<void, FsError<TruncateCode>> {
	return ResultAsync.try(() => nodeTruncate(path, len));
}

/** Errno codes thrown by `open`. */
export type OpenCode =
	| "ENOENT"
	| "EACCES"
	| "EISDIR"
	| "EMFILE"
	| "ENFILE"
	| "ENOSPC"
	| "EEXIST"
	| "EPERM"
	| "EROFS"
	| "EINVAL"
	| "EIO"
	| "ENOTDIR"
	| "ELOOP"
	| "ENAMETOOLONG";

/**
 * Non-throwing wrapper around `fs.promises.open`.
 *
 * @example
 * ```ts
 * import { open } from "@antithrow/node";
 *
 * const result = await open("/tmp/data.bin", "r");
 * // ok(FileHandle) or err(FsError<OpenCode>)
 * ```
 *
 * @param path - The path to the file.
 * @param flags - File system flags. Defaults to `'r'`.
 * @param mode - The file mode. Defaults to `0o666`.
 *
 * @returns A `ResultAsync` containing the `FileHandle`, or an `FsError`.
 */
export function open(
	path: PathLike,
	flags?: string | number,
	mode?: Mode,
): ResultAsync<FileHandle, FsError<OpenCode>> {
	return ResultAsync.try(() => nodeOpen(path, flags, mode));
}
