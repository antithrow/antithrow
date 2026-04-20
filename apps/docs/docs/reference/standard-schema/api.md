---
title: API
description: Standard Schema validation as Result.
sidebar_position: 1
---

# `@antithrow/standard-schema`

Package: `@antithrow/standard-schema`

Validates values against any [Standard Schema](https://standardschema.dev) validator (Zod, Valibot, ArkType, and others) and returns a `Result` whose error is the schema's `FailureResult`.

## `validate(schema, value, options?)`

```ts
function validate<S extends StandardSchemaV1>(
	schema: S,
	value: unknown,
	options?: StandardSchemaV1.Options,
): Result<StandardSchemaV1.InferOutput<S>, StandardSchemaV1.FailureResult>;
```

Returns a `Result`. Synchronous validators settle immediately as `Ok` or `Err`; asynchronous validators return `Pending`, and `await validate(...)` yields a `Settled`. Exceptions thrown or promise rejections from the validator are converted into a synthetic `FailureResult` with a single issue carrying the error message.

## `validateSync(schema, value, options?)`

```ts
function validateSync<S extends StandardSchemaV1>(
	schema: S,
	value: unknown,
	options?: StandardSchemaV1.Options,
): Settled<StandardSchemaV1.InferOutput<S>, StandardSchemaV1.FailureResult>;
```

Synchronous variant. Returns a settled `Ok` or `Err`. Exceptions thrown by the validator are converted into a synthetic `FailureResult`.

## `StandardSchemaV1.FailureResult`

```ts
interface FailureResult {
	issues: ReadonlyArray<Issue>;
}

interface Issue {
	message: string;
	path?: ReadonlyArray<PropertyKey | PathSegment>;
}
```

## Throws

`validate` never throws.

`validateSync` throws `TypeError` if the schema's `validate` returns a `Promise` — this signals that an asynchronous schema was handed to a synchronous call site. Use `validate` for schemas that may be asynchronous.

## Example

```ts
import { validate, validateSync } from "@antithrow/standard-schema";
import { z } from "zod";

const schema = z.object({ id: z.string() });

const result = await validate(schema, input);
if (result.isOk()) {
	console.log(result.value.id);
}

const syncResult = validateSync(schema, input);
```
