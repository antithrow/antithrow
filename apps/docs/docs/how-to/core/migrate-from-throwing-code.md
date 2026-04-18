---
title: Migrate from throwing code
description: Move an existing throwing module to Result without rewriting everything at once.
---

# Migrate from throwing code

You have a module — a client, a parser, a service — that throws on failure. You want it to return `Result` instead. Do it incrementally.

## Step 1: Enable the lint rules

Turn on the rules that flag the problem so the surface is visible:

```ts
// eslint.config.ts
import antithrow from "@antithrow/eslint-plugin";

export default [antithrow.configs.recommended];
```

`@antithrow/no-throwing-call` flags built-in throwing APIs. `@antithrow/no-unused-result` catches newly-returned `Result`s that aren't handled yet.

## Step 2: Wrap leaf calls first

Start at the bottom of the call graph — any function that touches a throwing built-in. Wrap with `Result.try`:

```ts
// before
export function parseConfig(input: string): Config {
	return JSON.parse(input);
}

// after
import { Result } from "antithrow";

export function parseConfig(input: string): Result<Config, SyntaxError> {
	return Result.try(() => JSON.parse(input));
}
```

Update call sites to branch on `isOk`/`isErr` or chain with `.andThen`.

## Step 3: Propagate upward

Each caller either handles the error (branch) or forwards it (return the `Result`). Resist the urge to `unwrap()` to keep the old signature — that just hides the throw behind another name.

## Step 4: Replace wrappers with `@antithrow/*` packages

Where you wrapped `fetch`, `JSON.parse`, `fs/promises`, or a Standard Schema validator by hand, swap to the pre-built wrappers:

```ts
// hand-wrapped → pre-built
import { fetch } from "@antithrow/std";
import { readFile } from "@antithrow/node/fs/promises";
import { validate } from "@antithrow/standard-schema";
```

## Step 5: Re-examine recoveries

Once the type system shows you every error path, you will find fallbacks that were silently swallowing failures. Replace `try/catch` → default-value patterns with `unwrapOr` / `orElse`, explicit about what you are recovering.

## See also

- How-to: [Wrap a throwing function](./wrap-a-throwing-function.md)
- How-to: [Recover from errors](./recover-from-errors.md)
- Reference: [`@antithrow/eslint-plugin`](../../reference/eslint-plugin/)
