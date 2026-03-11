import type { Result } from "./result.js";
import type { ResultAsync } from "./result-async.js";

export type AnyResult<T = unknown, E = unknown> = Result<T, E> | ResultAsync<T, E>;
export type InferOk<R> = R extends AnyResult<infer T, unknown> ? T : never;
export type InferErr<R> = R extends AnyResult<unknown, infer E> ? E : never;

export type OkTuple<T extends readonly AnyResult[]> = {
	[K in keyof T]: InferOk<T[K]>;
};

export type ErrUnion<T extends readonly AnyResult[]> = InferErr<T[number]>;
