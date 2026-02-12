import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	mkdtemp as nodeMkdtemp,
	rm as nodeRm,
	symlink as nodeSymlink,
	writeFile as nodeWriteFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { link, readlink, realpath, symlink, unlink } from "./links.js";

let tmpDir: string;

beforeAll(async () => {
	tmpDir = await nodeMkdtemp(join(tmpdir(), "antithrow-links-test-"));
});

afterAll(async () => {
	await nodeRm(tmpDir, { recursive: true, force: true });
});

describe("readlink", () => {
	test("returns Ok when reading a symlink", async () => {
		const targetPath = join(tmpDir, "readlink-target.txt");
		const linkPath = join(tmpDir, "readlink-link");
		await nodeWriteFile(targetPath, "target");
		await nodeSymlink(targetPath, linkPath);

		const result = await readlink(linkPath);

		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toBe(targetPath);
	});

	test("returns Err with ENOENT for missing link", async () => {
		const result = await readlink(join(tmpDir, "no-such-link"));

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().code).toBe("ENOENT");
	});

	test("returns Err with EINVAL for non-symlink", async () => {
		const filePath = join(tmpDir, "readlink-regular.txt");
		await nodeWriteFile(filePath, "not a link");

		const result = await readlink(filePath);

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().code).toBe("EINVAL");
	});
});

describe("link", () => {
	test("returns Ok when creating hard link", async () => {
		const sourcePath = join(tmpDir, "link-source.txt");
		const destPath = join(tmpDir, "link-dest.txt");
		await nodeWriteFile(sourcePath, "linked content");

		const result = await link(sourcePath, destPath);

		expect(result.isOk()).toBe(true);

		const contents = await Bun.file(destPath).text();
		expect(contents).toBe("linked content");
	});

	test("returns Err with ENOENT for missing source", async () => {
		const result = await link(join(tmpDir, "link-missing.txt"), join(tmpDir, "link-dest2.txt"));

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().code).toBe("ENOENT");
	});
});

describe("symlink", () => {
	test("returns Ok when creating symlink", async () => {
		const targetPath = join(tmpDir, "symlink-target.txt");
		const linkPath = join(tmpDir, "symlink-link");
		await nodeWriteFile(targetPath, "symlink target");

		const result = await symlink(targetPath, linkPath);

		expect(result.isOk()).toBe(true);
	});

	test("returns Err with EEXIST for existing path", async () => {
		const targetPath = join(tmpDir, "symlink-target2.txt");
		const linkPath = join(tmpDir, "symlink-existing");
		await nodeWriteFile(targetPath, "target");
		await nodeSymlink(targetPath, linkPath);

		const result = await symlink(targetPath, linkPath);

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().code).toBe("EEXIST");
	});
});

describe("unlink", () => {
	test("returns Ok when removing a file", async () => {
		const filePath = join(tmpDir, "unlink-file.txt");
		await nodeWriteFile(filePath, "remove me");

		const result = await unlink(filePath);

		expect(result.isOk()).toBe(true);
	});

	test("returns Err with ENOENT for missing file", async () => {
		const result = await unlink(join(tmpDir, "unlink-missing.txt"));

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().code).toBe("ENOENT");
	});
});

describe("realpath", () => {
	test("returns Ok with resolved path", async () => {
		const filePath = join(tmpDir, "realpath-file.txt");
		await nodeWriteFile(filePath, "real");

		const result = await realpath(filePath);

		expect(result.isOk()).toBe(true);
		expect(typeof result.unwrap()).toBe("string");
	});

	test("returns Err with ENOENT for missing path", async () => {
		const result = await realpath(join(tmpDir, "realpath-missing.txt"));

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().code).toBe("ENOENT");
	});
});
