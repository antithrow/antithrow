---
title: Validate the response
description: Attach a Zod schema to the pipeline and finish the configuration loader.
sidebar_position: 5
---

# Validate the response

The pipeline currently accepts any JSON the server returns. The final step plugs a Zod schema into the same chain so the shape is checked before anything else reads `config.value`.

## Define the schema

Update `src/index.ts` with the schema and the final pipeline.

```ts title="src/index.ts"
import { Err, Ok, type Result } from "antithrow";
import { fetch, Response } from "@antithrow/std";
import { validate } from "@antithrow/standard-schema";
import { z } from "zod";

const ConfigSchema = z.object({
	name: z.string(),
	port: z.number().int().min(1).max(65535),
	features: z.array(z.string()),
});

type Config = z.infer<typeof ConfigSchema>;

function parsePort(raw: string): Result<number, "invalid-port"> {
	const port = Number(raw);

	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		return new Err("invalid-port");
	}

	return new Ok(port);
}

async function loadConfig(rawPort: string): Promise<Result<Config, unknown>> {
	return await parsePort(rawPort)
		.map((port) => `http://localhost:${port}/config.json`)
		.andThen((url) => fetch(url))
		.andThen((response) => Response.json(response))
		.andThen((body) => validate(ConfigSchema, body));
}

const config = await loadConfig("8080");

if (config.isOk()) {
	console.log(`loaded config for ${config.value.name}`);
} else if (config.isErr()) {
	console.log("failed:", config.error);
}
```

`validate(ConfigSchema, body)` returns a `Result<Config, StandardSchemaV1.FailureResult>`. Because it is chained with `andThen`, a validation failure short-circuits the pipeline exactly like a network failure.

## Try a bad payload

Point the fetch URL at a JSON file that does not match the schema — for example, one missing the `features` array. You will see the validation error printed:

```
failed: { issues: [ { path: ["features"], message: "Required" } ] }
```

No exception, no mangled logging — just an `Err` the caller can branch on.

## Recap

You have built a complete loader that:

1. Parses untrusted input (`parsePort`).
2. Builds a URL and fetches over the network (`fetch`).
3. Reads the body as JSON (`Response.json`).
4. Validates the payload against a schema (`validate`).

Every step can fail, every failure is encoded in the return type, and the happy path is one fluent chain. No `try` / `catch` anywhere.

## Where to go next

- Browse the [how-to guides](../how-to/) for recipes that do one task well.
- Read [the three-state model](../explanation/three-state-model) to understand why `Pending` is a first-class result.
- Consult the [`antithrow` reference](../reference/antithrow/result) for the full API.
