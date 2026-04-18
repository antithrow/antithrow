---
title: no-throwing-call
description: Disallow calls to known throwing built-in APIs when an @antithrow wrapper exists.
sidebar_position: 1
---

# `@antithrow/no-throwing-call`

Rule id: `@antithrow/no-throwing-call`

Reports calls to built-in APIs that are known to throw and have a non-throwing replacement published by this project.

## Metadata

| Field | Value |
| --- | --- |
| Type | `problem` |
| Recommended | `warn` |
| Requires type information | yes |
| Fixable | no |
| Has suggestions | no |

## Options

None.

```json
{ "@antithrow/no-throwing-call": "warn" }
```

## Message IDs

| ID | Template |
| --- | --- |
| `throwingCall` | `` `{{ api }}` can throw. A non-throwing wrapper is available from `{{ replacement }}`. `` |

## Detected APIs

**Global calls** (replacement: `@antithrow/std`):

`fetch`, `atob`, `btoa`, `structuredClone`, `decodeURI`, `decodeURIComponent`, `encodeURI`, `encodeURIComponent`, `JSON.parse`, `JSON.stringify`.

Also detected when accessed through `globalThis`, `window`, or `self`, provided the root is an implicit global.

**`Response` body methods** (replacement: `@antithrow/std`):

`.json()`, `.text()`, `.arrayBuffer()`, `.blob()`, `.formData()` — detected via type information on any expression whose type contains the global `Response`.

**`node:fs/promises` functions** (replacement: `@antithrow/node/fs/promises`):

`readFile`, `writeFile`, `appendFile`, `truncate`, `open`, `readdir`, `mkdir`, `rmdir`, `rm`, `mkdtemp`, `opendir`, `readlink`, `link`, `symlink`, `unlink`, `realpath`, `stat`, `lstat`, `statfs`, `access`, `chmod`, `chown`, `lchown`, `utimes`, `lutimes`, `copyFile`, `cp`, `rename` — detected via signature resolution against the `fs/promises` / `node:fs/promises` module declarations.

## Example

```ts
// reports: fetch can throw.
await fetch("/api");

// ok:
import { fetch } from "@antithrow/std";
await fetch("/api");
```
