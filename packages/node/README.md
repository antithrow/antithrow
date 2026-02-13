<div align="center">
	<h1>@antithrow/node</h1>
	<p>
		non-throwing wrappers around Node.js APIs, powered by <a href="https://github.com/antithrow/antithrow">antithrow</a>
	</p>

![NPM Version](https://img.shields.io/npm/v/@antithrow/node)
![NPM License](https://img.shields.io/npm/l/@antithrow/node)

</div>

## Why

Node.js APIs like `fs/promises` communicate failure by throwing. `@antithrow/node` re-exports them as thin wrappers that return `Result` or `ResultAsync` instead, so error handling is type-safe and composable out of the box.

```ts
import { readFile, writeFile } from "@antithrow/node/fs/promises";

const data = await readFile("input.txt", "utf-8")
  .mapErr(() => new AppError("failed to read file"));

await writeFile("output.txt", data.toUpperCase())
  .mapErr(() => new AppError("failed to write file"));
```

## Installation

```bash
bun add @antithrow/node
```

`antithrow` is a required peer/runtime dependency and will be installed automatically.

## Usage

### fs/promises

Wraps `fs/promises` API with `ResultAsync` for type-safe file operations.

```ts
import { readFile, writeFile, mkdir } from "@antithrow/node/fs/promises";
import { JSON } from "@antithrow/std";

// Read a file
const content = await readFile("./config.json", "utf-8")
  .andThen((text) => JSON.parse(text));

// Write a file
await writeFile("./output.txt", "Hello, World!");

// Create directories
await mkdir("./nested/path", { recursive: true });
```

## API Reference

### fs/promises

#### File Operations

| Function     | Signature                                                                  | Error Type              |
| ------------ | -------------------------------------------------------------------------- | ----------------------- |
| `readFile`   | `(path, encoding?) → ResultAsync<string \| Buffer, NodeJS.ErrnoException>` | `NodeJS.ErrnoException` |
| `writeFile`  | `(path, data) → ResultAsync<void, NodeJS.ErrnoException>`                  | `NodeJS.ErrnoException` |
| `appendFile` | `(path, data) → ResultAsync<void, NodeJS.ErrnoException>`                  | `NodeJS.ErrnoException` |
| `open`       | `(path, flags?, mode?) → ResultAsync<FileHandle, NodeJS.ErrnoException>`   | `NodeJS.ErrnoException` |
| `truncate`   | `(path, len?) → ResultAsync<void, NodeJS.ErrnoException>`                  | `NodeJS.ErrnoException` |

#### Directory Operations

| Function  | Signature                                                                     | Error Type              |
| --------- | ----------------------------------------------------------------------------- | ----------------------- |
| `readdir` | `(path, options?) → ResultAsync<string[] \| Dirent[], NodeJS.ErrnoException>` | `NodeJS.ErrnoException` |
| `mkdir`   | `(path, options?) → ResultAsync<void, NodeJS.ErrnoException>`                 | `NodeJS.ErrnoException` |
| `rmdir`   | `(path) → ResultAsync<void, NodeJS.ErrnoException>`                           | `NodeJS.ErrnoException` |
| `rm`      | `(path, options?) → ResultAsync<void, NodeJS.ErrnoException>`                 | `NodeJS.ErrnoException` |
| `mkdtemp` | `(prefix) → ResultAsync<string, NodeJS.ErrnoException>`                       | `NodeJS.ErrnoException` |
| `opendir` | `(path, options?) → ResultAsync<Dir, NodeJS.ErrnoException>`                  | `NodeJS.ErrnoException` |

#### Metadata Operations

| Function | Signature                                                  | Error Type              |
| -------- | ---------------------------------------------------------- | ----------------------- |
| `stat`   | `(path) → ResultAsync<Stats, NodeJS.ErrnoException>`       | `NodeJS.ErrnoException` |
| `lstat`  | `(path) → ResultAsync<Stats, NodeJS.ErrnoException>`       | `NodeJS.ErrnoException` |
| `access` | `(path, mode?) → ResultAsync<void, NodeJS.ErrnoException>` | `NodeJS.ErrnoException` |
| `statfs` | `(path) → ResultAsync<StatsFs, NodeJS.ErrnoException>`     | `NodeJS.ErrnoException` |

#### Permissions & Ownership

| Function | Signature                                                     | Error Type              |
| -------- | ------------------------------------------------------------- | ----------------------- |
| `chmod`  | `(path, mode) → ResultAsync<void, NodeJS.ErrnoException>`     | `NodeJS.ErrnoException` |
| `chown`  | `(path, uid, gid) → ResultAsync<void, NodeJS.ErrnoException>` | `NodeJS.ErrnoException` |
| `lchown` | `(path, uid, gid) → ResultAsync<void, NodeJS.ErrnoException>` | `NodeJS.ErrnoException` |

#### Links & Paths

| Function   | Signature                                                                  | Error Type              |
| ---------- | -------------------------------------------------------------------------- | ----------------------- |
| `link`     | `(existing, newPath) → ResultAsync<void, NodeJS.ErrnoException>`           | `NodeJS.ErrnoException` |
| `unlink`   | `(path) → ResultAsync<void, NodeJS.ErrnoException>`                        | `NodeJS.ErrnoException` |
| `symlink`  | `(target, path, type?) → ResultAsync<void, NodeJS.ErrnoException>`         | `NodeJS.ErrnoException` |
| `readlink` | `(path, encoding?) → ResultAsync<string \| Buffer, NodeJS.ErrnoException>` | `NodeJS.ErrnoException` |
| `realpath` | `(path, encoding?) → ResultAsync<string \| Buffer, NodeJS.ErrnoException>` | `NodeJS.ErrnoException` |

#### File Copy & Rename

| Function   | Signature                                                          | Error Type              |
| ---------- | ------------------------------------------------------------------ | ----------------------- |
| `copyFile` | `(src, dest, mode?) → ResultAsync<void, NodeJS.ErrnoException>`    | `NodeJS.ErrnoException` |
| `cp`       | `(src, dest, options?) → ResultAsync<void, NodeJS.ErrnoException>` | `NodeJS.ErrnoException` |
| `rename`   | `(oldPath, newPath) → ResultAsync<void, NodeJS.ErrnoException>`    | `NodeJS.ErrnoException` |

#### Time Operations

| Function  | Signature                                                         | Error Type              |
| --------- | ----------------------------------------------------------------- | ----------------------- |
| `utimes`  | `(path, atime, mtime) → ResultAsync<void, NodeJS.ErrnoException>` | `NodeJS.ErrnoException` |
| `lutimes` | `(path, atime, mtime) → ResultAsync<void, NodeJS.ErrnoException>` | `NodeJS.ErrnoException` |
