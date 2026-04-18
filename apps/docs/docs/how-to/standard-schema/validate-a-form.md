---
title: Validate a form
description: Turn a form submission into a typed Result, attaching issues back to fields.
---

# Validate a form

A form handler is a natural fit for `validate` — each `FailureResult.issue` already carries a `path`, which you can use to place errors next to the field.

## Shape

```ts
import { z } from "zod";
import { validate } from "@antithrow/standard-schema";

const SignupSchema = z.object({
	email: z.string().email(),
	password: z.string().min(8),
});

async function handleSignup(formData: FormData) {
	const input = Object.fromEntries(formData);
	const result = await validate(SignupSchema, input);

	if (result.isErr()) {
		return renderErrors(groupIssuesByField(result.error.issues));
	}

	await createAccount(result.value);
}
```

## Grouping issues by field

```ts
import type { StandardSchemaV1 } from "@standard-schema/spec";

function groupIssuesByField(
	issues: ReadonlyArray<StandardSchemaV1.Issue>,
): Record<string, string[]> {
	const out: Record<string, string[]> = {};
	for (const issue of issues) {
		const key = issue.path?.map(String).join(".") ?? "_form";
		(out[key] ??= []).push(issue.message);
	}
	return out;
}
```

## Flash the first error per field in a UI

If the UI wants a single message per field rather than a list, overwrite instead of push — the first issue per path usually surfaces the highest-priority validator result from the validator.

## See also

- Reference: [`@antithrow/standard-schema`](../../reference/standard-schema/api.md)
- How-to: [Validate with Zod](./validate-with-zod.md)
