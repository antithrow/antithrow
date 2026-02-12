import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	mkdtemp as nodeMkdtemp,
	rm as nodeRm,
	stat as nodeStat,
	symlink as nodeSymlink,
	writeFile as nodeWriteFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chmod, chown, lchown } from "./perms-owner.js";

let tmpDir: string;

beforeAll(async () => {
	tmpDir = await nodeMkdtemp(join(tmpdir(), "antithrow-perms-test-"));
});

afterAll(async () => {
	await nodeRm(tmpDir, { recursive: true, force: true });
});

describe("chmod", () => {
	test("returns Ok when changing mode", async () => {
		const filePath = join(tmpDir, "chmod-file.txt");
		await nodeWriteFile(filePath, "chmod me");

		const result = await chmod(filePath, 0o755);

		expect(result.isOk()).toBe(true);

		const stats = await nodeStat(filePath);
		// Check the permission bits (masking off file type bits)
		expect(stats.mode & 0o777).toBe(0o755);
	});

	test("returns Ok when changing mode to read-only", async () => {
		const filePath = join(tmpDir, "chmod-readonly.txt");
		await nodeWriteFile(filePath, "read only");

		const result = await chmod(filePath, 0o444);

		expect(result.isOk()).toBe(true);

		const stats = await nodeStat(filePath);
		expect(stats.mode & 0o777).toBe(0o444);
	});

	test("returns Err with ENOENT for missing file", async () => {
		const result = await chmod(join(tmpDir, "chmod-missing.txt"), 0o644);

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().code).toBe("ENOENT");
	});

	test("returns Err with ENOTDIR when path traverses a file", async () => {
		const filePath = join(tmpDir, "chmod-notdir.txt");
		await nodeWriteFile(filePath, "not a dir");

		const result = await chmod(join(filePath, "child.txt"), 0o644);

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().code).toBe("ENOTDIR");
	});
});

describe("chown", () => {
	test("returns Ok when setting ownership to current user", async () => {
		const filePath = join(tmpDir, "chown-file.txt");
		await nodeWriteFile(filePath, "chown me");

		const stats = await nodeStat(filePath);
		const result = await chown(filePath, stats.uid, stats.gid);

		expect(result.isOk()).toBe(true);
	});

	test("returns Err with ENOENT for missing file", async () => {
		const result = await chown(join(tmpDir, "chown-missing.txt"), 1000, 1000);

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().code).toBe("ENOENT");
	});

	test("returns Err with ENOTDIR when path traverses a file", async () => {
		const filePath = join(tmpDir, "chown-notdir.txt");
		await nodeWriteFile(filePath, "not a dir");

		const result = await chown(join(filePath, "child.txt"), 1000, 1000);

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().code).toBe("ENOTDIR");
	});
});

describe("lchown", () => {
	test("returns Ok when setting ownership on a symlink", async () => {
		const targetPath = join(tmpDir, "lchown-target.txt");
		const linkPath = join(tmpDir, "lchown-link");
		await nodeWriteFile(targetPath, "target");
		await nodeSymlink(targetPath, linkPath);

		const stats = await nodeStat(targetPath);
		const result = await lchown(linkPath, stats.uid, stats.gid);

		expect(result.isOk()).toBe(true);
	});

	test("returns Ok when setting ownership on a regular file", async () => {
		const filePath = join(tmpDir, "lchown-file.txt");
		await nodeWriteFile(filePath, "lchown me");

		const stats = await nodeStat(filePath);
		const result = await lchown(filePath, stats.uid, stats.gid);

		expect(result.isOk()).toBe(true);
	});

	test("returns Err with ENOENT for missing file", async () => {
		const result = await lchown(join(tmpDir, "lchown-missing.txt"), 1000, 1000);

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().code).toBe("ENOENT");
	});

	test("returns Err with ENOTDIR when path traverses a file", async () => {
		const filePath = join(tmpDir, "lchown-notdir.txt");
		await nodeWriteFile(filePath, "not a dir");

		const result = await lchown(join(filePath, "child.txt"), 1000, 1000);

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().code).toBe("ENOTDIR");
	});
});
