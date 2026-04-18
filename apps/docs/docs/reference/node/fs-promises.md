---
title: fs/promises
description: Non-throwing wrappers around Node.js fs/promises APIs.
sidebar_position: 1
---

# `@antithrow/node/fs/promises`

Subpath: `@antithrow/node/fs/promises`

Non-throwing wrappers around `node:fs/promises`. Every function returns `ResultAsync<T, NodeJS.ErrnoException>`. The error type is Node's standard errno exception, so callers can branch on `.code` (`"ENOENT"`, `"EACCES"`, etc.).

## Files

| Export | Signature |
| --- | --- |
| `readFile` | `(path, options?) => ResultAsync<string \| Buffer, NodeJS.ErrnoException>` |
| `writeFile` | `(file, data, options?) => ResultAsync<void, NodeJS.ErrnoException>` |
| `appendFile` | `(path, data, options?) => ResultAsync<void, NodeJS.ErrnoException>` |
| `truncate` | `(path, len?) => ResultAsync<void, NodeJS.ErrnoException>` |
| `open` | `(path, flags?, mode?) => ResultAsync<FileHandle, NodeJS.ErrnoException>` |

`readFile` has overloads for `Buffer` (no encoding) and `string` (encoding specified), mirroring the native API.

## Directories

| Export | Signature |
| --- | --- |
| `mkdir` | `(path, options?) => ResultAsync<string \| undefined, NodeJS.ErrnoException>` |
| `mkdtemp` | `(prefix, options?) => ResultAsync<string, NodeJS.ErrnoException>` |
| `opendir` | `(path, options?) => ResultAsync<Dir, NodeJS.ErrnoException>` |
| `readdir` | `(path, options?) => ResultAsync<string[] \| Buffer[] \| Dirent[], NodeJS.ErrnoException>` |
| `rm` | `(path, options?) => ResultAsync<void, NodeJS.ErrnoException>` |
| `rmdir` | `(path, options?) => ResultAsync<void, NodeJS.ErrnoException>` |

## Copy / move

| Export | Signature |
| --- | --- |
| `copyFile` | `(src, dest, mode?) => ResultAsync<void, NodeJS.ErrnoException>` |
| `cp` | `(src, dest, opts?) => ResultAsync<void, NodeJS.ErrnoException>` |
| `rename` | `(oldPath, newPath) => ResultAsync<void, NodeJS.ErrnoException>` |

## Links

| Export | Signature |
| --- | --- |
| `link` | `(existingPath, newPath) => ResultAsync<void, NodeJS.ErrnoException>` |
| `symlink` | `(target, path, type?) => ResultAsync<void, NodeJS.ErrnoException>` |
| `unlink` | `(path) => ResultAsync<void, NodeJS.ErrnoException>` |
| `readlink` | `(path, options?) => ResultAsync<string \| Buffer, NodeJS.ErrnoException>` |
| `realpath` | `(path, options?) => ResultAsync<string \| Buffer, NodeJS.ErrnoException>` |

## Metadata

| Export | Signature |
| --- | --- |
| `access` | `(path, mode?) => ResultAsync<void, NodeJS.ErrnoException>` |
| `stat` | `(path, options?) => ResultAsync<Stats \| BigIntStats, NodeJS.ErrnoException>` |
| `lstat` | `(path, options?) => ResultAsync<Stats \| BigIntStats, NodeJS.ErrnoException>` |
| `statfs` | `(path, options?) => ResultAsync<StatsFs \| BigIntStatsFs, NodeJS.ErrnoException>` |

## Permissions / ownership

| Export | Signature |
| --- | --- |
| `chmod` | `(path, mode) => ResultAsync<void, NodeJS.ErrnoException>` |
| `chown` | `(path, uid, gid) => ResultAsync<void, NodeJS.ErrnoException>` |
| `lchown` | `(path, uid, gid) => ResultAsync<void, NodeJS.ErrnoException>` |

## Times

| Export | Signature |
| --- | --- |
| `utimes` | `(path, atime, mtime) => ResultAsync<void, NodeJS.ErrnoException>` |
| `lutimes` | `(path, atime, mtime) => ResultAsync<void, NodeJS.ErrnoException>` |

## Throws

Never.

## Example

```ts
import { readFile } from "@antithrow/node/fs/promises";

const result = await readFile("/etc/hostname", "utf-8");

if (result.isOk()) {
	console.log(result.value);
} else if (result.isErr() && result.error.code === "ENOENT") {
	console.log("not found");
}
```
