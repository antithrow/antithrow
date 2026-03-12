---
sidebar_position: 5
title: "@antithrow/standard-schema"
description: "Bridge Standard Schema validators to antithrow Result types"
---

# @antithrow/standard-schema

Bridges [Standard Schema](https://github.com/standard-schema/standard-schema)–conforming validators (Zod, Valibot, ArkType, etc.) to antithrow `Result` and `ResultAsync` types.

## Installation

```bash npm2yarn
npm install @antithrow/standard-schema
```

You'll also need a Standard Schema–compatible validator:

```bash npm2yarn
npm install zod
```

## validate()

```ts
function validate<S extends StandardSchemaV1>(
  schema: S,
  value: unknown,
  options?: StandardSchemaV1.Options,
): ResultAsync<StandardSchemaV1.InferOutput<S>, StandardSchemaV1.FailureResult>;
```

Validates a value against a Standard Schema. Always returns `ResultAsync` because Standard Schema validators may be async.

Exceptions thrown by the validator are caught and wrapped in a synthetic `FailureResult` with a single issue containing the error message.

```ts
import { validate } from "@antithrow/standard-schema";
import { z } from "zod";

const UserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
});

const result = await validate(UserSchema, {
  name: "Alice",
  email: "alice@example.com",
});

result.match({
  ok: (user) => console.log("Valid:", user),
  // user is { name: string; email: string }
  err: ({ issues }) => console.error("Invalid:", issues),
});
```

## validateSync()

```ts
function validateSync<S extends StandardSchemaV1>(
  schema: S,
  value: unknown,
  options?: StandardSchemaV1.Options,
): Result<StandardSchemaV1.InferOutput<S>, StandardSchemaV1.FailureResult>;
```

Synchronous variant. Returns a plain `Result` instead of `ResultAsync`.

**Throws `TypeError`** if the schema's `validate` method returns a `Promise` — use `validate()` instead for schemas that may be async.

```ts
import { validateSync } from "@antithrow/standard-schema";
import { z } from "zod";

const NumberSchema = z.number().min(0);

const result = validateSync(NumberSchema, 42);
// ok(42)

const invalid = validateSync(NumberSchema, -1);
// err({ issues: [{ message: "Number must be greater than or equal to 0" }] })
```

## Error type: FailureResult

Both `validate()` and `validateSync()` use `StandardSchemaV1.FailureResult` as the error type:

```ts
interface FailureResult {
  issues: Array<{
    message: string;
    path?: Array<PropertyKey | StandardSchemaV1.PathSegment>;
  }>;
}
```

This is the standard error shape defined by the [Standard Schema specification](https://github.com/standard-schema/standard-schema). Each issue contains a `message` and an optional `path` indicating which field failed.

## Composing with chain()

Combine schema validation with other `Result` operations:

```ts
import { chain, errAsync, type ResultAsync } from "antithrow";
import { validate } from "@antithrow/standard-schema";
import { z } from "zod";

const EmailSchema = z.string().email();

type AppError = { type: "validation"; message: string } | { type: "duplicate" };

function createAccount(input: unknown): ResultAsync<Account, AppError> {
  return chain(async function* () {
    const email = yield* validate(EmailSchema, input).mapErr(
      ({ issues }): AppError => ({
        type: "validation",
        message: issues[0]?.message ?? "Invalid input",
      }),
    );

    const exists = yield* checkEmailExists(email);
    if (exists) {
      return yield* errAsync<Account, AppError>({ type: "duplicate" });
    }

    return yield* saveAccount(email);
  });
}
```

## Supported validators

Any validator implementing the [Standard Schema spec](https://github.com/standard-schema/standard-schema) works out of the box:

- [Zod](https://zod.dev)
- [Valibot](https://valibot.dev)
- [ArkType](https://arktype.io)
- And others — see the full list at [standard-schema.dev](https://github.com/standard-schema/standard-schema#what-validators-are-supported)
