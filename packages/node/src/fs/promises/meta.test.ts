import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	mkdtemp as nodeMkdtemp,
	rm as nodeRm,
	symlink as nodeSymlink,
	writeFile as nodeWriteFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { access, lstat, stat, statfs } from "./meta.js";

let tmpDir: string;

beforeAll(async () => {
	tmpDir = await nodeMkdtemp(join(tmpdir(), "antithrow-meta-test-"));
});

afterAll(async () => {
	await nodeRm(tmpDir, { recursive: true, force: true });
});

describe("stat", () => {
	test("returns Ok with Stats for existing file", async () => {
		const filePath = join(tmpDir, "stat-file.txt");
		await nodeWriteFile(filePath, "stat me");

		const result = await stat(filePath);

		expect(result.isOk()).toBe(true);

		const stats = result.unwrap();
		expect(stats.isFile()).toBe(true);
		expect(stats.isDirectory()).toBe(false);
	});

	test("returns Err with ENOENT for missing path", async () => {
		const result = await stat(join(tmpDir, "stat-missing.txt"));

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().code).toBe("ENOENT");
	});
});

describe("lstat", () => {
	test("returns Ok with Stats for symlink (without following)", async () => {
		const targetPath = join(tmpDir, "lstat-target.txt");
		const linkPath = join(tmpDir, "lstat-link");
		await nodeWriteFile(targetPath, "target");
		await nodeSymlink(targetPath, linkPath);

		const result = await lstat(linkPath);

		expect(result.isOk()).toBe(true);

		const stats = result.unwrap();
		expect(stats.isSymbolicLink()).toBe(true);
	});
});

describe("access", () => {
	test("returns Ok for accessible file", async () => {
		const filePath = join(tmpDir, "access-file.txt");
		await nodeWriteFile(filePath, "accessible");

		const result = await access(filePath);

		expect(result.isOk()).toBe(true);
	});

	test("returns Err with ENOENT for missing file", async () => {
		const result = await access(join(tmpDir, "access-missing.txt"));

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().code).toBe("ENOENT");
	});
});

describe("statfs", () => {
	test("returns Ok with filesystem stats", async () => {
		const result = await statfs(tmpDir);

		expect(result.isOk()).toBe(true);

		const stats = result.unwrap();
		expect(stats).toBeDefined();
		expect(typeof stats.type).toBe("number");
	});
});
