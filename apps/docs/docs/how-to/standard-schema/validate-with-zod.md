---
title: Validate with Zod
description: Validate unknown input against a Zod schema and get a Result back.
---

# Validate with Zod

Zod v3.24+ implements the Standard Schema spec directly, so `@antithrow/standard-schema` works with Zod schemas without any adapter.

## The recipe

```ts
import { z } from "zod";
import { validate } from "@antithrow/standard-schema";

const UserSchema = z.object({
	id: z.string().uuid(),
	email: z.string().email(),
	age: z.number().int().min(0),
});

const result = await validate(UserSchema, input);

if (result.isOk()) {
	use(result.value); // z.infer<typeof UserSchema>
} else {
	for (const issue of result.error.issues) {
		console.error(issue.message, issue.path);
	}
}
```

## Works the same with Valibot, ArkType, etc.

Any validator implementing Standard Schema slots in unchanged:

```ts
import * as v from "valibot";

const UserSchema = v.object({ id: v.pipe(v.string(), v.uuid()) });
const result = await validate(UserSchema, input);
```

## Sync vs async

Zod supports `async` refinements (e.g. `.refine(async (v) => ...)`). `validate` handles both: sync schemas settle immediately, async schemas return `Pending` until awaited. If you know your schema has no async pieces, `validateSync` returns a settled result without the `await`.

## See also

- Reference: [`@antithrow/standard-schema`](../../reference/standard-schema/api.md)
- How-to: [Choose sync vs async](./choose-sync-vs-async.md)
