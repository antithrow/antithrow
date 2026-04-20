---
title: no-unsafe-unwrap
description: Disallow unsafe unwrap APIs on Result values.
sidebar_position: 2
---

# `@antithrow/no-unsafe-unwrap`

Rule id: `@antithrow/no-unsafe-unwrap`

Reports calls to methods that will throw if the `Result` is in the wrong variant: `unwrap` and `unwrapErr`.

## Metadata

| Field | Value |
| --- | --- |
| Type | `problem` |
| Recommended | `warn` |
| Requires type information | yes |
| Fixable | `code` |
| Has suggestions | no |

## Options

None.

```json
{ "@antithrow/no-unsafe-unwrap": "warn" }
```

## Message IDs

| ID | Template |
| --- | --- |
| `unsafeUnwrap` | `` Avoid `{{ method }}` on Result values. Handle both branches explicitly instead. `` |
| `unwrapOkValue` | `` `{{ method }}` on `Ok` is unnecessary. Use `.value` instead. `` |
| `unwrapErrError` | `` `{{ method }}` on `Err` is unnecessary. Use `.error` instead. `` |

## Auto-fix behavior

When the static type is known to be `Ok<...>`, calls to `.unwrap()` are rewritten to `.value`.

When the static type is known to be `Err<...>`, calls to `.unwrapErr()` are rewritten to `.error`.

All other cases — including any type that includes `Pending<...>`, where `.unwrap()` returns a promise instead of a value — are reported without a fix, since removing the throw requires the author to decide how to handle every branch.

## Example

```ts
const result = computeResult();

// reports (unsafeUnwrap): handle both branches
result.unwrap();

// ok:
if (result.isOk()) {
	console.log(result.value);
}

// Destructuring also reports:
const { unwrap } = result; // unsafeUnwrap
```
