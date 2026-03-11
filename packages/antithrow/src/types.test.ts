import { describe, expectTypeOf, it } from "bun:test";
import type { Err } from "./err.js";
import type { Ok } from "./ok.js";
import type { Pending } from "./pending.js";
import type { Result } from "./result.js";
import type { InferErr, InferOk } from "./types.js";

describe("InferOk", () => {
	it("extracts the value type", () => {
		expectTypeOf<InferOk<Result<number, string>>>().toEqualTypeOf<number>();
		expectTypeOf<InferOk<Ok<number, string>>>().toEqualTypeOf<number>();
		expectTypeOf<InferOk<Err<number, string>>>().toEqualTypeOf<number>();
		expectTypeOf<InferOk<Pending<number, string>>>().toEqualTypeOf<number>();
	});

	it("returns never for non-Result types", () => {
		expectTypeOf<InferOk<number>>().toEqualTypeOf<never>();
	});
});

describe("InferErr", () => {
	it("extracts the error type", () => {
		expectTypeOf<InferErr<Result<number, string>>>().toEqualTypeOf<string>();
		expectTypeOf<InferErr<Ok<number, string>>>().toEqualTypeOf<string>();
		expectTypeOf<InferErr<Err<number, string>>>().toEqualTypeOf<string>();
		expectTypeOf<InferErr<Pending<number, string>>>().toEqualTypeOf<string>();
	});

	it("returns never for non-Result types", () => {
		expectTypeOf<InferErr<number>>().toEqualTypeOf<never>();
	});
});
