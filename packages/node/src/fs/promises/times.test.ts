import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	mkdtemp as nodeMkdtemp,
	rm as nodeRm,
	stat as nodeStat,
	writeFile as nodeWriteFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lutimes, utimes } from "./times.js";

let tmpDir: string;

beforeAll(async () => {
	tmpDir = await nodeMkdtemp(join(tmpdir(), "antithrow-times-test-"));
});

afterAll(async () => {
	await nodeRm(tmpDir, { recursive: true, force: true });
});

describe("utimes", () => {
	test("returns Ok when setting times", async () => {
		const filePath = join(tmpDir, "utimes-file.txt");
		await nodeWriteFile(filePath, "utimes me");

		const atime = new Date("2020-01-01T00:00:00Z");
		const mtime = new Date("2021-06-15T12:00:00Z");

		const result = await utimes(filePath, atime, mtime);

		expect(result.isOk()).toBe(true);

		const stats = await nodeStat(filePath);
		expect(stats.mtime.getTime()).toBe(mtime.getTime());
	});

	test("returns Err with ENOENT for missing file", async () => {
		const now = new Date();
		const result = await utimes(join(tmpDir, "utimes-missing.txt"), now, now);

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().code).toBe("ENOENT");
	});
});

describe("lutimes", () => {
	test("returns Err with ENOENT for missing file", async () => {
		const now = new Date();
		const result = await lutimes(join(tmpDir, "lutimes-missing.txt"), now, now);

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().code).toBe("ENOENT");
	});
});
