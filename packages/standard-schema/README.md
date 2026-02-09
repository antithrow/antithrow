<div align="center">
	<h1>@antithrow/standard-schema</h1>
	<p>
		bridge <a href="https://github.com/standard-schema/standard-schema">Standard Schema</a> validators to <a href="https://github.com/antithrow/antithrow">antithrow</a> Result types
	</p>

![NPM Version](https://img.shields.io/npm/v/@antithrow/standard-schema)
![NPM License](https://img.shields.io/npm/l/@antithrow/standard-schema)

</div>

## Why

Schema validation libraries like [Zod](https://zod.dev), [Valibot](https://valibot.dev), and
[ArkType](https://arktype.io) all implement the
[Standard Schema](https://github.com/standard-schema/standard-schema) spec.
`@antithrow/standard-schema` wraps any Standard Schema–conforming validator so validation
results come back as `Result` / `ResultAsync` instead of raw success/failure objects.

```ts
import { validate } from "@antithrow/standard-schema";
import { z } from "zod";

const result = await validate(z.string().email(), input);
result.match({
  ok: (email) => console.log("valid:", email),
  err: ({ issues }) => console.error("invalid:", issues),
});
```

## Installation

```bash
bun add @antithrow/standard-schema
```

## Usage

### Async validation (recommended)

`validate` always returns a `ResultAsync` because Standard Schema validators may be
synchronous or asynchronous — the caller doesn't need to know which.

```ts
import { validate } from "@antithrow/standard-schema";

const result = await validate(schema, input);
const value = result.unwrapOr(fallback);
```

### Synchronous validation

`validateSync` returns a plain `Result`. It throws `TypeError` if the schema's
`validate` method returns a `Promise`.

```ts
import { validateSync } from "@antithrow/standard-schema";

const result = validateSync(schema, input);
const value = result.unwrapOr(fallback);
```

### Error handling

Both functions catch exceptions thrown by the validator and wrap them in a
synthetic `FailureResult` with a single issue containing the error message.
This keeps the error type uniform — you always get `FailureResult`.

```ts
const result = await validate(throwingSchema, input);
// Err({ issues: [{ message: "..." }] })
```

## API Reference

| Export         | Signature                                                                | Returns       |
| -------------- | ------------------------------------------------------------------------ | ------------- |
| `validate`     | `(schema, value, options?) → ResultAsync<InferOutput<S>, FailureResult>` | `ResultAsync` |
| `validateSync` | `(schema, value, options?) → Result<InferOutput<S>, FailureResult>`      | `Result`      |
