---
title: fs/promises
description: Non-throwing wrappers around Node.js fs/promises APIs.
sidebar_position: 1
---

# `@antithrow/node/fs/promises`

Subpath: `@antithrow/node/fs/promises`

Non-throwing wrappers around `node:fs/promises`. Every function returns `Result<T, NodeJS.ErrnoException>`. The error type is Node's standard errno exception, so callers can branch on `.code` (`"ENOENT"`, `"EACCES"`, etc.).

## Files

| Export | Signature |
| --- | --- |
| `readFile` | `(path, options?) => Result<string \| Buffer, NodeJS.ErrnoException>` |
| `writeFile` | `(file, data, options?) => Result<void, NodeJS.ErrnoException>` |
| `appendFile` | `(path, data, options?) => Result<void, NodeJS.ErrnoException>` |
| `truncate` | `(path, len?) => Result<void, NodeJS.ErrnoException>` |
| `open` | `(path, flags?, mode?) => Result<FileHandle, NodeJS.ErrnoException>` |

`readFile` has overloads for `Buffer` (no encoding) and `string` (encoding specified), mirroring the native API.

## Directories

| Export | Signature |
| --- | --- |
| `mkdir` | `(path, options?) => Result<string \| undefined, NodeJS.ErrnoException>` |
| `mkdtemp` | `(prefix, options?) => Result<string, NodeJS.ErrnoException>` |
| `opendir` | `(path, options?) => Result<Dir, NodeJS.ErrnoException>` |
| `readdir` | `(path, options?) => Result<string[] \| Buffer[] \| Dirent[], NodeJS.ErrnoException>` |
| `rm` | `(path, options?) => Result<void, NodeJS.ErrnoException>` |
| `rmdir` | `(path, options?) => Result<void, NodeJS.ErrnoException>` |

## Copy / move

| Export | Signature |
| --- | --- |
| `copyFile` | `(src, dest, mode?) => Result<void, NodeJS.ErrnoException>` |
| `cp` | `(src, dest, opts?) => Result<void, NodeJS.ErrnoException>` |
| `rename` | `(oldPath, newPath) => Result<void, NodeJS.ErrnoException>` |

## Links

| Export | Signature |
| --- | --- |
| `link` | `(existingPath, newPath) => Result<void, NodeJS.ErrnoException>` |
| `symlink` | `(target, path, type?) => Result<void, NodeJS.ErrnoException>` |
| `unlink` | `(path) => Result<void, NodeJS.ErrnoException>` |
| `readlink` | `(path, options?) => Result<string \| Buffer, NodeJS.ErrnoException>` |
| `realpath` | `(path, options?) => Result<string \| Buffer, NodeJS.ErrnoException>` |

## Metadata

| Export | Signature |
| --- | --- |
| `access` | `(path, mode?) => Result<void, NodeJS.ErrnoException>` |
| `stat` | `(path, options?) => Result<Stats \| BigIntStats, NodeJS.ErrnoException>` |
| `lstat` | `(path, options?) => Result<Stats \| BigIntStats, NodeJS.ErrnoException>` |
| `statfs` | `(path, options?) => Result<StatsFs \| BigIntStatsFs, NodeJS.ErrnoException>` |

## Permissions / ownership

| Export | Signature |
| --- | --- |
| `chmod` | `(path, mode) => Result<void, NodeJS.ErrnoException>` |
| `chown` | `(path, uid, gid) => Result<void, NodeJS.ErrnoException>` |
| `lchown` | `(path, uid, gid) => Result<void, NodeJS.ErrnoException>` |

## Times

| Export | Signature |
| --- | --- |
| `utimes` | `(path, atime, mtime) => Result<void, NodeJS.ErrnoException>` |
| `lutimes` | `(path, atime, mtime) => Result<void, NodeJS.ErrnoException>` |

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
