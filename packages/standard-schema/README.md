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
results come back as `Result` / `Settled` instead of raw success/failure objects.

```ts
import { validate } from "@antithrow/standard-schema";
import { z } from "zod";

const result = await validate(z.string().email(), input);
if (result.isOk()) {
	console.log("valid:", result.value);
} else {
	console.error("invalid:", result.error.issues);
}
```

## Installation

```bash
bun add @antithrow/standard-schema
```

## Usage

### Async validation (recommended)

`validate` returns a `Result`. Sync schemas settle immediately as `Ok` or `Err`;
async schemas return `Pending`, and `await validate(...)` yields a `Settled` result.

```ts
import { validate } from "@antithrow/standard-schema";

const result = await validate(schema, input);
const value = result.unwrapOr(fallback);
```

### Synchronous validation

`validateSync` returns a `Settled` result. It throws `TypeError` if the schema's
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

## Reference

Full reference: <https://antithrow.dev/docs/reference/standard-schema>
