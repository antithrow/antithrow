---
title: Enforce no-throwing-call
description: Catch and replace calls to built-in APIs that have a safer @antithrow wrapper.
---

# Enforce `no-throwing-call`

`@antithrow/no-throwing-call` flags every call to a global or `node:fs/promises` function that `@antithrow/std` or `@antithrow/node/fs/promises` re-implements safely. The fix is always the same shape: replace the import.

## Upgrade severity to error

In a codebase already using antithrow, treat a fresh throwing call as a failure rather than a warning:

```ts
{
	rules: {
		"@antithrow/no-throwing-call": "error",
	},
}
```

## Swap imports

| Was | Becomes |
| --- | --- |
| `fetch`, `atob`, `btoa`, `structuredClone`, `encodeURI`, `decodeURI`, `encodeURIComponent`, `decodeURIComponent`, `JSON.parse`, `JSON.stringify` | import from `@antithrow/std` |
| `.json()`, `.text()`, `.arrayBuffer()`, `.blob()`, `.formData()` on a `Response` | `Response.json(res)` / `Response.text(res)` / … from `@antithrow/std` |
| `readFile`, `writeFile`, `mkdir`, … from `node:fs/promises` | import from `@antithrow/node/fs/promises` |

## Suppressing intentional usage

If you genuinely want the throwing API — for example, inside a test that is asserting a throw — use an inline disable:

```ts
// eslint-disable-next-line @antithrow/no-throwing-call
expect(() => JSON.parse("nope")).toThrow();
```

Prefer the inline form over project-wide overrides so intent is readable at the call site.

## See also

- Reference: [`no-throwing-call`](../../reference/eslint-plugin/no-throwing-call.md)
