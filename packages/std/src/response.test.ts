import { describe, expect, test } from "bun:test";
import { Response as SafeResponse } from "./response.js";

describe("Response", () => {
	describe("json", () => {
		test("returns Ok with parsed JSON", async () => {
			const response = new Response('{"key": "value"}', {
				headers: { "Content-Type": "application/json" },
			});
			const result = await SafeResponse.json(response);

			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toEqual({ key: "value" });
		});

		test("returns Ok with typed generic", async () => {
			const response = new Response('{"id": 1}');
			const result = await SafeResponse.json<{ id: number }>(response);

			expect(result.isOk()).toBe(true);
			expect(result.unwrap().id).toBe(1);
		});

		test("returns Err with SyntaxError for invalid JSON", async () => {
			const response = new Response("not json");
			const result = await SafeResponse.json(response);

			expect(result.isErr()).toBe(true);
			expect(result.unwrapErr()).toBeInstanceOf(SyntaxError);
		});

		test("returns Err with TypeError for already-consumed body", async () => {
			const response = new Response('{"key": "value"}');
			await response.json();
			const result = await SafeResponse.json(response);

			expect(result.isErr()).toBe(true);
			expect(result.unwrapErr()).toBeInstanceOf(TypeError);
		});
	});

	describe("text", () => {
		test("returns Ok with text content", async () => {
			const response = new Response("hello");
			const result = await SafeResponse.text(response);

			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toBe("hello");
		});

		test("returns Err with TypeError for already-consumed body", async () => {
			const response = new Response("hello");
			await response.text();
			const result = await SafeResponse.text(response);

			expect(result.isErr()).toBe(true);
			expect(result.unwrapErr()).toBeInstanceOf(TypeError);
		});
	});

	describe("arrayBuffer", () => {
		test("returns Ok with ArrayBuffer", async () => {
			const response = new Response("data");
			const result = await SafeResponse.arrayBuffer(response);

			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toBeInstanceOf(ArrayBuffer);
		});

		test("returns Err with TypeError for already-consumed body", async () => {
			const response = new Response("data");
			await response.arrayBuffer();
			const result = await SafeResponse.arrayBuffer(response);

			expect(result.isErr()).toBe(true);
			expect(result.unwrapErr()).toBeInstanceOf(TypeError);
		});
	});

	describe("blob", () => {
		test("returns Ok with Blob", async () => {
			const response = new Response("data");
			const result = await SafeResponse.blob(response);

			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toBeInstanceOf(Blob);
		});

		test("returns Err with TypeError for already-consumed body", async () => {
			const response = new Response("data");
			await response.blob();
			const result = await SafeResponse.blob(response);

			expect(result.isErr()).toBe(true);
			expect(result.unwrapErr()).toBeInstanceOf(TypeError);
		});
	});

	describe("formData", () => {
		test("returns Ok with FormData", async () => {
			const form = new FormData();
			form.append("key", "value");
			const response = new Response(form);
			const result = await SafeResponse.formData(response);

			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toBeInstanceOf(FormData);
		});

		test("returns Err with TypeError for invalid content type", async () => {
			const response = new Response("not form data", {
				headers: { "Content-Type": "text/plain" },
			});
			const result = await SafeResponse.formData(response);

			expect(result.isErr()).toBe(true);
			expect(result.unwrapErr()).toBeInstanceOf(TypeError);
		});

		test("returns Err with TypeError for already-consumed body", async () => {
			const form = new FormData();
			form.append("key", "value");
			const response = new Response(form);
			await response.formData();
			const result = await SafeResponse.formData(response);

			expect(result.isErr()).toBe(true);
			expect(result.unwrapErr()).toBeInstanceOf(TypeError);
		});
	});
});
