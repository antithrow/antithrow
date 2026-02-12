import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendFile, open, readFile, truncate, writeFile } from "./file.js";

let tmpDir: string;

beforeAll(async () => {
	tmpDir = await mkdtemp(join(tmpdir(), "antithrow-file-test-"));
});

afterAll(async () => {
	await rm(tmpDir, { recursive: true, force: true });
});

describe("readFile", () => {
	test("returns Ok with string when encoding is specified", async () => {
		const filePath = join(tmpDir, "read-string.txt");
		await Bun.write(filePath, "hello world");

		const result = await readFile(filePath, "utf-8");

		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toBe("hello world");
	});

	test("returns Ok with Buffer when no encoding is specified", async () => {
		const filePath = join(tmpDir, "read-buffer.txt");
		await Bun.write(filePath, "buffer data");

		const result = await readFile(filePath);

		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toBeInstanceOf(Buffer);
		expect(result.unwrap().toString()).toBe("buffer data");
	});

	test("returns Err with ENOENT for missing file", async () => {
		const result = await readFile(join(tmpDir, "nonexistent.txt"), "utf-8");

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().code).toBe("ENOENT");
	});

	test("returns Err with EISDIR for directory", async () => {
		const result = await readFile(tmpDir, "utf-8");

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().code).toBe("EISDIR");
	});
});

describe("writeFile", () => {
	test("returns Ok when writing a string", async () => {
		const filePath = join(tmpDir, "write-string.txt");

		const result = await writeFile(filePath, "written content");

		expect(result.isOk()).toBe(true);

		const contents = await Bun.file(filePath).text();
		expect(contents).toBe("written content");
	});

	test("returns Ok when writing a buffer", async () => {
		const filePath = join(tmpDir, "write-buffer.txt");
		const buf = Buffer.from("buffer content");

		const result = await writeFile(filePath, buf);

		expect(result.isOk()).toBe(true);

		const contents = await Bun.file(filePath).text();
		expect(contents).toBe("buffer content");
	});

	test("returns Err with ENOENT for missing parent directory", async () => {
		const filePath = join(tmpDir, "no", "such", "dir", "file.txt");

		const result = await writeFile(filePath, "data");

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().code).toBe("ENOENT");
	});
});

describe("appendFile", () => {
	test("returns Ok when appending to existing file", async () => {
		const filePath = join(tmpDir, "append-existing.txt");
		await Bun.write(filePath, "first ");

		const result = await appendFile(filePath, "second");

		expect(result.isOk()).toBe(true);

		const contents = await Bun.file(filePath).text();
		expect(contents).toBe("first second");
	});

	test("returns Ok when creating a new file via append", async () => {
		const filePath = join(tmpDir, "append-new.txt");

		const result = await appendFile(filePath, "new content");

		expect(result.isOk()).toBe(true);

		const contents = await Bun.file(filePath).text();
		expect(contents).toBe("new content");
	});
});

describe("truncate", () => {
	test("returns Ok when truncating existing file", async () => {
		const filePath = join(tmpDir, "truncate.txt");
		await Bun.write(filePath, "long content here");

		const result = await truncate(filePath, 4);

		expect(result.isOk()).toBe(true);

		const contents = await Bun.file(filePath).text();
		expect(contents).toBe("long");
	});

	test("returns Err with ENOENT for missing file", async () => {
		const result = await truncate(join(tmpDir, "no-such-file.txt"), 0);

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().code).toBe("ENOENT");
	});
});

describe("open", () => {
	test("returns Ok with FileHandle for existing file", async () => {
		const filePath = join(tmpDir, "open.txt");
		await Bun.write(filePath, "open me");

		const result = await open(filePath, "r");

		expect(result.isOk()).toBe(true);

		const handle = result.unwrap();
		expect(handle).toBeDefined();
		await handle.close();
	});

	test("returns Err with ENOENT for missing file", async () => {
		const result = await open(join(tmpDir, "missing.txt"), "r");

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().code).toBe("ENOENT");
	});
});
