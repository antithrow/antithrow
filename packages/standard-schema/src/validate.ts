import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { Settled } from "antithrow";
import { Err, Ok, Result } from "antithrow";

function toFailureResult(error: unknown): StandardSchemaV1.FailureResult {
	const message = error instanceof Error ? error.message : String(error);
	return { issues: [{ message }] };
}

function isThenable<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
	return (
		value !== null &&
		(typeof value === "object" || typeof value === "function") &&
		typeof (value as { then?: unknown }).then === "function"
	);
}

function convertResult<Output>(
	result: StandardSchemaV1.Result<Output>,
): Settled<Output, StandardSchemaV1.FailureResult> {
	if (result.issues) {
		return new Err(result);
	}

	return new Ok(result.value);
}

/**
 * Validates a value against a Standard Schema, returning a `Result`.
 *
 * Synchronous validators return a settled `Ok` or `Err` immediately. Async
 * validators return `Pending`. Exceptions thrown or rejected by the validator are caught and
 * wrapped in a synthetic `FailureResult`.
 *
 * @example
 * ```ts
 * import { validate } from "@antithrow/standard-schema";
 *
 * const result = await validate(mySchema, input);
 * if (result.isOk()) {
 * 	console.log("valid:", result.value);
 * } else {
 * 	console.error("invalid:", result.error.issues);
 * }
 * ```
 *
 * @template S - The Standard Schema type.
 *
 * @param schema - A Standard Schema–conforming validator.
 * @param value - The value to validate.
 * @param options - Optional validation options forwarded to the schema.
 *
 * @returns A `Result` containing the validated output or a `FailureResult`.
 */
export function validate<S extends StandardSchemaV1>(
	schema: S,
	value: unknown,
	options?: StandardSchemaV1.Options,
): Result<StandardSchemaV1.InferOutput<S>, StandardSchemaV1.FailureResult> {
	let result: StandardSchemaV1.Result<unknown> | PromiseLike<StandardSchemaV1.Result<unknown>>;
	try {
		result = schema["~standard"].validate(value, options);
	} catch (error) {
		return new Err(toFailureResult(error));
	}

	if (isThenable(result)) {
		return Result.fromPromise(result).mapErr(toFailureResult).andThen(convertResult);
	}

	return convertResult(result);
}

/**
 * Validates a value against a Standard Schema synchronously, returning a `Settled` result.
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
 * if (result.isOk()) {
 * 	console.log("valid:", result.value);
 * } else {
 * 	console.error("invalid:", result.error.issues);
 * }
 * ```
 *
 * @template S - The Standard Schema type.
 *
 * @param schema - A Standard Schema–conforming validator that returns synchronously.
 * @param value - The value to validate.
 * @param options - Optional validation options forwarded to the schema.
 *
 * @returns A `Settled` result containing the validated output or a `FailureResult`.
 *
 * @throws {TypeError} If the schema's `validate` method returns a `Promise`.
 */
export function validateSync<S extends StandardSchemaV1>(
	schema: S,
	value: unknown,
	options?: StandardSchemaV1.Options,
): Settled<StandardSchemaV1.InferOutput<S>, StandardSchemaV1.FailureResult> {
	let result: StandardSchemaV1.Result<unknown> | PromiseLike<StandardSchemaV1.Result<unknown>>;
	try {
		result = schema["~standard"].validate(value, options);
	} catch (error) {
		return new Err(toFailureResult(error));
	}

	if (isThenable(result)) {
		throw new TypeError(
			"Schema returned a Promise from validate(). Use validate() instead of validateSync() for async schemas.",
		);
	}

	return convertResult(result);
}
