import { describe, expect, test } from "bun:test";
import { fetch } from "./fetch.js";

describe("fetch", () => {
	test("returns Ok for successful fetch", async () => {
		using server = Bun.serve({
			port: 0,
			fetch: () => new Response("ok"),
		});

		const result = await fetch(server.url);
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toBeInstanceOf(Response);
	});

	test("returns Ok for non-2xx responses", async () => {
		using server = Bun.serve({
			port: 0,
			fetch: () => new Response("not found", { status: 404 }),
		});

		const result = await fetch(server.url);
		expect(result.isOk()).toBe(true);
		expect(result.unwrap().status).toBe(404);
	});

	test("returns Err when fetch rejects due to connection failure", async () => {
		const result = await fetch("http://localhost:1");
		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr()).toBeInstanceOf(Error);
	});

	test("returns Err with TypeError for invalid URL scheme", async () => {
		const result = await fetch("ftp://example.com");
		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr()).toBeInstanceOf(TypeError);
	});
});
