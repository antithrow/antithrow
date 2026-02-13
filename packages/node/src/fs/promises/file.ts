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
 * // ok(Buffer) or err(NodeJS.ErrnoException)
 * ```
 *
 * @param path - The path to the file.
 * @param options - Optional read options.
 *
 * @returns A `ResultAsync` containing the file contents as a `Buffer`, or a `NodeJS.ErrnoException`.
 */
export function readFile(
	path: PathLike | FileHandle,
	options?:
		| ({
				encoding?: null | undefined;
				flag?: OpenMode | undefined;
		  } & Abortable)
		| null,
): ResultAsync<Buffer, NodeJS.ErrnoException>;
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
 * // ok("Hello, world!") or err(NodeJS.ErrnoException)
 * ```
 *
 * @param path - The path to the file.
 * @param options - The encoding or options object with an encoding.
 *
 * @returns A `ResultAsync` containing the file contents as a `string`, or a `NodeJS.ErrnoException`.
 */
export function readFile(
	path: PathLike | FileHandle,
	options:
		| ({
				encoding: BufferEncoding;
				flag?: OpenMode | undefined;
		  } & Abortable)
		| BufferEncoding,
): ResultAsync<string, NodeJS.ErrnoException>;
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
 * // ok(string | Buffer) or err(NodeJS.ErrnoException)
 * ```
 *
 * @param path - The path to the file.
 * @param options - Optional encoding or options object.
 *
 * @returns A `ResultAsync` containing the file contents, or a `NodeJS.ErrnoException`.
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
): ResultAsync<string | Buffer, NodeJS.ErrnoException>;
export function readFile(
	path: PathLike | FileHandle,
	options?:
		| (ObjectEncodingOptions &
				Abortable & {
					flag?: OpenMode | undefined;
				})
		| BufferEncoding
		| null,
): ResultAsync<string | Buffer, NodeJS.ErrnoException> {
	return ResultAsync.try(() => nodeReadFile(path, options as BufferEncoding));
}

/**
 * Non-throwing wrapper around `fs.promises.writeFile`.
 *
 * @example
 * ```ts
 * import { writeFile } from "@antithrow/node";
 *
 * const result = await writeFile("/tmp/hello.txt", "Hello, world!");
 * // ok(undefined) or err(NodeJS.ErrnoException)
 * ```
 *
 * @param file - The path or `FileHandle` to write to.
 * @param data - The data to write.
 * @param options - Optional write options.
 *
 * @returns A `ResultAsync` containing `undefined` on success, or a `NodeJS.ErrnoException`.
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
): ResultAsync<void, NodeJS.ErrnoException> {
	return ResultAsync.try(() => nodeWriteFile(file, data, options));
}

/**
 * Non-throwing wrapper around `fs.promises.appendFile`.
 *
 * @example
 * ```ts
 * import { appendFile } from "@antithrow/node";
 *
 * const result = await appendFile("/tmp/log.txt", "new line\n");
 * // ok(undefined) or err(NodeJS.ErrnoException)
 * ```
 *
 * @param path - The path or `FileHandle` to append to.
 * @param data - The data to append.
 * @param options - Optional append options.
 *
 * @returns A `ResultAsync` containing `undefined` on success, or a `NodeJS.ErrnoException`.
 */
export function appendFile(
	path: PathLike | FileHandle,
	data: string | Uint8Array,
	options?:
		| (ObjectEncodingOptions & { flag?: OpenMode | undefined; flush?: boolean | undefined })
		| BufferEncoding
		| null,
): ResultAsync<void, NodeJS.ErrnoException> {
	return ResultAsync.try(() => nodeAppendFile(path, data, options));
}

/**
 * Non-throwing wrapper around `fs.promises.truncate`.
 *
 * @example
 * ```ts
 * import { truncate } from "@antithrow/node";
 *
 * const result = await truncate("/tmp/data.bin", 100);
 * // ok(undefined) or err(NodeJS.ErrnoException)
 * ```
 *
 * @param path - The path to the file.
 * @param len - The desired length in bytes. Defaults to `0`.
 *
 * @returns A `ResultAsync` containing `undefined` on success, or a `NodeJS.ErrnoException`.
 */
export function truncate(path: PathLike, len?: number): ResultAsync<void, NodeJS.ErrnoException> {
	return ResultAsync.try(() => nodeTruncate(path, len));
}

/**
 * Non-throwing wrapper around `fs.promises.open`.
 *
 * @example
 * ```ts
 * import { open } from "@antithrow/node";
 *
 * const result = await open("/tmp/data.bin", "r");
 * // ok(FileHandle) or err(NodeJS.ErrnoException)
 * ```
 *
 * @param path - The path to the file.
 * @param flags - File system flags. Defaults to `'r'`.
 * @param mode - The file mode. Defaults to `0o666`.
 *
 * @returns A `ResultAsync` containing the `FileHandle`, or a `NodeJS.ErrnoException`.
 */
export function open(
	path: PathLike,
	flags?: string | number,
	mode?: Mode,
): ResultAsync<FileHandle, NodeJS.ErrnoException> {
	return ResultAsync.try(() => nodeOpen(path, flags, mode));
}
