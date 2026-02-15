import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	mkdir as nodeMkdir,
	mkdtemp as nodeMkdtemp,
	rm as nodeRm,
	writeFile as nodeWriteFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdir, mkdtemp, opendir, readdir, rm, rmdir } from "./dir.js";

let tmpDir: string;

beforeAll(async () => {
	tmpDir = await nodeMkdtemp(join(tmpdir(), "antithrow-dir-test-"));
});

afterAll(async () => {
	await nodeRm(tmpDir, { recursive: true, force: true });
});

describe("readdir", () => {
	test("returns Ok with directory listing", async () => {
		const dirPath = join(tmpDir, "readdir-ok");
		await nodeMkdir(dirPath);
		await nodeWriteFile(join(dirPath, "a.txt"), "a");
		await nodeWriteFile(join(dirPath, "b.txt"), "b");

		const result = await readdir(dirPath);

		expect(result.isOk()).toBe(true);
		const entries = result.unwrap();
		expect(entries).toHaveLength(2);
		expect(entries).toContain("a.txt");
		expect(entries).toContain("b.txt");
	});

	test("returns Err with ENOENT for missing directory", async () => {
		const result = await readdir(join(tmpDir, "nonexistent"));

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().code).toBe("ENOENT");
	});

	test("returns Err with ENOTDIR for file path", async () => {
		const filePath = join(tmpDir, "readdir-file.txt");
		await nodeWriteFile(filePath, "not a dir");

		const result = await readdir(filePath);

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().code).toBe("ENOTDIR");
	});
});

describe("mkdir", () => {
	test("returns Ok when creating directory", async () => {
		const dirPath = join(tmpDir, "mkdir-ok");

		const result = await mkdir(dirPath);

		expect(result.isOk()).toBe(true);
	});

	test("returns Ok with recursive option", async () => {
		const dirPath = join(tmpDir, "mkdir-recursive", "a", "b");

		const result = await mkdir(dirPath, { recursive: true });

		expect(result.isOk()).toBe(true);
	});

	test("returns Err with EEXIST for existing directory (non-recursive)", async () => {
		const dirPath = join(tmpDir, "mkdir-eexist");
		await nodeMkdir(dirPath);

		const result = await mkdir(dirPath);

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().code).toBe("EEXIST");
	});
});

describe("rmdir", () => {
	test("returns Ok when removing empty directory", async () => {
		const dirPath = join(tmpDir, "rmdir-ok");
		await nodeMkdir(dirPath);

		const result = await rmdir(dirPath);

		expect(result.isOk()).toBe(true);
	});

	test("returns Err with ENOENT for missing directory", async () => {
		const result = await rmdir(join(tmpDir, "rmdir-missing"));

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().code).toBe("ENOENT");
	});
});

describe("rm", () => {
	test("returns Ok when removing a file", async () => {
		const filePath = join(tmpDir, "rm-file.txt");
		await nodeWriteFile(filePath, "delete me");

		const result = await rm(filePath);

		expect(result.isOk()).toBe(true);
	});

	test("returns Ok with recursive + force for missing path", async () => {
		const result = await rm(join(tmpDir, "rm-missing"), {
			recursive: true,
			force: true,
		});

		expect(result.isOk()).toBe(true);
	});

	test("returns Err with ENOENT for missing path without force", async () => {
		const result = await rm(join(tmpDir, "rm-missing-no-force"));

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().code).toBe("ENOENT");
	});
});

describe("mkdtemp", () => {
	test("returns Ok with created temp directory path", async () => {
		const result = await mkdtemp(join(tmpDir, "mkdtemp-"));

		expect(result.isOk()).toBe(true);
		const createdPath = result.unwrap();
		expect(createdPath).toContain("mkdtemp-");
	});

	test("returns Err with ENOENT for invalid prefix path", async () => {
		const result = await mkdtemp(join(tmpDir, "nonexistent-dir", "mkdtemp-"));

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().code).toBe("ENOENT");
	});
});

describe("opendir", () => {
	test("returns Ok with Dir handle", async () => {
		const dirPath = join(tmpDir, "opendir-ok");
		await nodeMkdir(dirPath);

		const result = await opendir(dirPath);

		expect(result.isOk()).toBe(true);

		const dir = result.unwrap();
		expect(dir).toBeDefined();
		await dir.close();
	});

	test("returns Err when reading from missing directory", async () => {
		const result = await opendir(join(tmpDir, "opendir-missing"));

		if (result.isErr()) {
			// Node.js throws ENOENT on opendir for missing paths
			expect(result.unwrapErr().code).toBe("ENOENT");
		} else {
			// Bun defers the error to the first read call
			const dir = result.unwrap();
			try {
				await dir.read();
				// Should not reach here
				expect(true).toBe(false);
			} catch (err) {
				expect((err as NodeJS.ErrnoException).code).toBe("ENOENT");
			} finally {
				await dir.close();
			}
		}
	});
});
