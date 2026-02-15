import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp as nodeMkdtemp, rm as nodeRm, writeFile as nodeWriteFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyFile, cp, rename } from "./copy-move.js";

let tmpDir: string;

beforeAll(async () => {
	tmpDir = await nodeMkdtemp(join(tmpdir(), "antithrow-copy-move-test-"));
});

afterAll(async () => {
	await nodeRm(tmpDir, { recursive: true, force: true });
});

describe("rename", () => {
	test("returns Ok when renaming a file", async () => {
		const oldPath = join(tmpDir, "rename-old.txt");
		const newPath = join(tmpDir, "rename-new.txt");
		await nodeWriteFile(oldPath, "rename me");

		const result = await rename(oldPath, newPath);

		expect(result.isOk()).toBe(true);

		const contents = await Bun.file(newPath).text();
		expect(contents).toBe("rename me");
	});

	test("returns Err with ENOENT for missing source", async () => {
		const result = await rename(
			join(tmpDir, "rename-missing.txt"),
			join(tmpDir, "rename-dest.txt"),
		);

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().code).toBe("ENOENT");
	});
});

describe("copyFile", () => {
	test("returns Ok when copying a file", async () => {
		const srcPath = join(tmpDir, "copy-src.txt");
		const destPath = join(tmpDir, "copy-dest.txt");
		await nodeWriteFile(srcPath, "copy me");

		const result = await copyFile(srcPath, destPath);

		expect(result.isOk()).toBe(true);

		const contents = await Bun.file(destPath).text();
		expect(contents).toBe("copy me");
	});

	test("returns Err with ENOENT for missing source", async () => {
		const result = await copyFile(join(tmpDir, "copy-missing.txt"), join(tmpDir, "copy-dest2.txt"));

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().code).toBe("ENOENT");
	});
});

describe("cp", () => {
	test("returns Ok when copying a file", async () => {
		const srcPath = join(tmpDir, "cp-src.txt");
		const destPath = join(tmpDir, "cp-dest.txt");
		await nodeWriteFile(srcPath, "cp content");

		const result = await cp(srcPath, destPath);

		expect(result.isOk()).toBe(true);

		const contents = await Bun.file(destPath).text();
		expect(contents).toBe("cp content");
	});

	test("returns Err with ENOENT for missing source", async () => {
		const result = await cp(join(tmpDir, "cp-missing.txt"), join(tmpDir, "cp-dest2.txt"));

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().code).toBe("ENOENT");
	});
});
