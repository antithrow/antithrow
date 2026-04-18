---
title: Wrap a throwing function
description: Convert a synchronous or async function that may throw into one that returns a Result.
---

# Wrap a throwing function

When you need to call a function that can throw — from a third-party library, a built-in API, or legacy code — wrap the call in `Result.try` to capture thrown errors as typed `Err` values.

## Synchronous

```ts
import { Result } from "antithrow";

const parsed = Result.try(() => JSON.parse(input));

if (parsed.isOk()) {
	use(parsed.value);
}
```

`parsed` is `Result<unknown, unknown>`. Supply a type argument to narrow:

```ts
const parsed = Result.try<unknown, SyntaxError>(() => JSON.parse(input));
```

## Asynchronous

Passing an async function (or one that returns a promise) produces a `Pending`:

```ts
const value = await Result.try(async () => expensive());
if (value.isOk()) use(value.value);
```

The `await` settles the `Pending` to `Ok` or `Err`. If you need eager failure typing, use `Result.fromPromise` instead (see: [Convert a Promise](./convert-a-promise.md)).

## Narrowing the error type

`Result.try` catches anything, so `E` defaults to `unknown`. Use `.mapErr` when you know the shape:

```ts
const parsed = Result.try(() => JSON.parse(input)).mapErr((cause) => {
	return cause instanceof SyntaxError
		? { kind: "invalid-json" as const, cause }
		: { kind: "unknown" as const, cause };
});
```

## See also

- Reference: [`Result.try`](../../reference/antithrow/result.md)
- Reference: [`Result.fromPromise`](../../reference/antithrow/result.md)
- How-to: [Migrate from throwing code](./migrate-from-throwing-code.md)
