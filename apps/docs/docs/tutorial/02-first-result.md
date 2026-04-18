---
title: Your first Result
description: Construct an Ok and an Err, and branch on the result with a type-safe guard.
sidebar_position: 2
---

# Your first Result

Every operation that might fail in antithrow returns a `Result`. A `Result` is always one of three shapes:

- `Ok<T>` — the operation succeeded; `.value` holds the value.
- `Err<E>` — the operation failed; `.error` holds the error.
- `Pending<T, E>` — the operation is in flight; `await` it to get an `Ok` or `Err`.

We will build up to `Pending` later. For now, let's construct the two settled shapes by hand.

## Construct an Ok and an Err

Replace the contents of `src/index.ts` with the following:

```ts title="src/index.ts"
import { Err, Ok, type Result } from "antithrow";

function parsePort(raw: string): Result<number, "invalid-port"> {
	const port = Number(raw);

	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		return new Err("invalid-port");
	}

	return new Ok(port);
}

const good = parsePort("8080");
const bad = parsePort("twelve");
```

`parsePort` returns `Result<number, "invalid-port">`. TypeScript now knows both the success type (`number`) and every possible error (`"invalid-port"`).

## Branch on the result

Use `isOk()` and `isErr()` to narrow to the concrete shape. Add this to the bottom of the file:

```ts title="src/index.ts"
for (const result of [good, bad]) {
	if (result.isOk()) {
		console.log(`port: ${result.value}`);
	} else if (result.isErr()) {
		console.log(`error: ${result.error}`);
	}
}
```

Run the program.

```bash
npx tsx src/index.ts
```

You should see:

```
port: 8080
error: invalid-port
```

Inside the `isOk()` branch TypeScript narrows `result` to `Ok<number, "invalid-port">`, so `.value` is `number`. Inside the `isErr()` branch it narrows to `Err<number, "invalid-port">`, so `.error` is `"invalid-port"`. Accessing the wrong property would be a type error.

## Recap

You have:

1. Used `new Ok(...)` and `new Err(...)` to return success and failure.
2. Encoded the failure type in the function signature.
3. Used `isOk()` and `isErr()` as type guards.

Next, you will stop writing branching code by hand and let antithrow transform the value for you.

## API details

- [`Ok`](../reference/antithrow/ok) — the success constructor.
- [`Err`](../reference/antithrow/err) — the failure constructor.
- [`Result`](../reference/antithrow/result) — the union type.
