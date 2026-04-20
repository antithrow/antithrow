---
title: no-unused-result
description: Require Result values to be used, preventing silently ignored errors.
sidebar_position: 3
---

# `@antithrow/no-unused-result`

Rule id: `@antithrow/no-unused-result`

Reports expression statements whose value is a `Result` — the analog of `no-unused-expressions` for typed errors. A `Result` that is never inspected is a silently-dropped error.

Applies to values whose type includes `Ok<T, E>`, `Err<T, E>`, or `Pending<T, E>` from the root `antithrow` entrypoint. Values from the legacy `antithrow/legacy` entrypoint are ignored.

## Metadata

| Field | Value |
| --- | --- |
| Type | `problem` |
| Recommended | `error` |
| Requires type information | yes |
| Fixable | no |
| Has suggestions | yes |

## Options

None.

```json
{ "@antithrow/no-unused-result": "error" }
```

## Message IDs

| ID | Template |
| --- | --- |
| `unusedResult` | `This Result must be used. Handle the error case or explicitly discard it with \`void\`.` |
| `addVoid` | `Explicitly discard the Result with \`void\`.` |

## Detection

The rule walks through expression wrappers so that `Result` types embedded inside these shapes are still caught:

- `cond ? a : b` (checks both branches)
- `a && b`, `a || b`, `a ?? b` (checks both operands)
- `(a, b, c)` (checks each expression)
- `expr as T`, `expr!` (unwraps before checking)
- `obj?.prop` (unwraps `ChainExpression`)

`void expr` silences the rule — that is the explicit-discard escape hatch.

## Suggestion

A single suggestion is offered: prepend `void ` to the expression (wrapping in parentheses if the expression's precedence requires it). The suggestion is not applied automatically; the author should prefer handling the branch.

## Example

```ts
// reports:
readFile("/etc/hostname");

// ok (explicit discard):
void readFile("/etc/hostname");

// ok (handled):
const contents = await readFile("/etc/hostname");
if (contents.isOk()) {
	process.stdout.write(contents.value);
}
```
