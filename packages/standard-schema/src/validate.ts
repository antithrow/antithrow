import type { StandardSchemaV1 } from "@standard-schema/spec";
import { err, ok, Result, ResultAsync } from "antithrow";

function toFailureResult(error: unknown): StandardSchemaV1.FailureResult {
	const message = error instanceof Error ? error.message : String(error);
	return { issues: [{ message }] };
}

function convertResult<Output>(
	result: StandardSchemaV1.Result<Output>,
): Result<Output, StandardSchemaV1.FailureResult> {
	if (result.issues) {
		return err(result);
	}

	return ok(result.value);
}

/**
 * Validates a value against a Standard Schema, returning a `ResultAsync`.
 *
 * Always returns `ResultAsync` because Standard Schema validators may return
 * either a synchronous result or a `Promise`. Exceptions thrown or rejected
 * by the validator are caught and wrapped in a synthetic `FailureResult`.
 *
 * @example
 * ```ts
 * import { validate } from "@antithrow/standard-schema";
 *
 * const result = await validate(mySchema, input);
 * result.match({
 *   ok: (value) => console.log("valid:", value),
 *   err: ({ issues }) => console.error("invalid:", issues),
 * });
 * ```
 *
 * @template S - The Standard Schema type.
 *
 * @param schema - A Standard Schema–conforming validator.
 * @param value - The value to validate.
 * @param options - Optional validation options forwarded to the schema.
 *
 * @returns A `ResultAsync` containing the validated output or a `FailureResult`.
 */
export function validate<S extends StandardSchemaV1>(
	schema: S,
	value: unknown,
	options?: StandardSchemaV1.Options,
): ResultAsync<StandardSchemaV1.InferOutput<S>, StandardSchemaV1.FailureResult> {
	type Output = StandardSchemaV1.InferOutput<S>;

	return ResultAsync.try(() => schema["~standard"].validate(value, options))
		.mapErr(toFailureResult)
		.andThen((result) => convertResult<Output>(result));
}

/**
 * Validates a value against a Standard Schema synchronously, returning a `Result`.
 *
 * Throws `TypeError` if the schema returns a `Promise`, since that indicates
 * an asynchronous validator was passed to a synchronous call site. Use
 * {@link validate} instead for schemas that may be asynchronous.
 *
 * Exceptions thrown by the validator are caught and wrapped in a synthetic
 * `FailureResult` with a single issue containing the error message.
 *
 * @example
 * ```ts
 * import { validateSync } from "@antithrow/standard-schema";
 *
 * const result = validateSync(mySchema, input);
 * result.match({
 *   ok: (value) => console.log("valid:", value),
 *   err: ({ issues }) => console.error("invalid:", issues),
 * });
 * ```
 *
 * @template S - The Standard Schema type.
 *
 * @param schema - A Standard Schema–conforming validator that returns synchronously.
 * @param value - The value to validate.
 * @param options - Optional validation options forwarded to the schema.
 *
 * @returns A `Result` containing the validated output or a `FailureResult`.
 *
 * @throws {TypeError} If the schema's `validate` method returns a `Promise`.
 */
export function validateSync<S extends StandardSchemaV1>(
	schema: S,
	value: unknown,
	options?: StandardSchemaV1.Options,
): Result<StandardSchemaV1.InferOutput<S>, StandardSchemaV1.FailureResult> {
	type Output = StandardSchemaV1.InferOutput<S>;

	return Result.try(() => schema["~standard"].validate(value, options))
		.mapErr(toFailureResult)
		.andThen((result) => {
			if (result instanceof Promise) {
				throw new TypeError(
					"Schema returned a Promise from validate(). Use validate() instead of validateSync() for async schemas.",
				);
			}

			return convertResult<Output>(result);
		});
}
