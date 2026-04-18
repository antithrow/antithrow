---
title: UnwrapError
description: The single exception antithrow throws when unwrap is called on the wrong shape.
sidebar_position: 7
---

# `UnwrapError`

Package: `antithrow`

The exception thrown when `unwrap()` is called on an `Err` or `unwrapErr()` is called on an `Ok`. The only class antithrow ever throws.

## Signature

```ts
class UnwrapError extends Error {
	override readonly name: "UnwrapError";
	readonly result: Settled<unknown, unknown>;

	constructor(message: string, result: Settled<unknown, unknown>);
}
```

## Properties

| Name | Type | Description |
| --- | --- | --- |
| `name` | `"UnwrapError"` | Always `"UnwrapError"`. |
| `message` | `string` | A short description of which unwrap was called on which shape. |
| `result` | `Settled<unknown, unknown>` | The settled result that was being unwrapped. |

## When thrown

- `new Ok(...).unwrapErr()` throws with message `"Called unwrapErr() on an Ok value"`.
- `new Err(...).unwrap()` throws with message `"Called unwrap() on an Err value"`.
- `pending.unwrap()` or `pending.unwrapErr()` rejects the returned promise with `UnwrapError` if the settled state is on the wrong branch.

No other antithrow function throws.

## Example

```ts
import { Err, UnwrapError } from "antithrow";

const result = new Err<number, string>("failed");

try {
	result.unwrap();
} catch (error) {
	if (error instanceof UnwrapError) {
		error.result.isErr(); // true
		error.result.isErr() && error.result.error; // "failed"
	}
}
```

## See also

- [`Result` chainable methods](./methods#unwrapping) — `unwrap`, `unwrapErr`, `unwrapOr`, `unwrapOrElse`.
- [Typed errors and the role of UnwrapError](../../explanation/error-typing-philosophy) — the rationale for throwing from `unwrap`.
