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

| Function     | Signature                                                    | Error Type |
| ------------ | ------------------------------------------------------------ | ---------- |
| `readFile`   | `(path, encoding?) → ResultAsync<string \| Buffer, FsError>` | `FsError`  |
| `writeFile`  | `(path, data) → ResultAsync<void, FsError>`                  | `FsError`  |
| `appendFile` | `(path, data) → ResultAsync<void, FsError>`                  | `FsError`  |
| `open`       | `(path, flags?, mode?) → ResultAsync<FileHandle, FsError>`   | `FsError`  |
| `truncate`   | `(path, len?) → ResultAsync<void, FsError>`                  | `FsError`  |

#### Directory Operations

| Function  | Signature                                                       | Error Type |
| --------- | --------------------------------------------------------------- | ---------- |
| `readdir` | `(path, options?) → ResultAsync<string[] \| Dirent[], FsError>` | `FsError`  |
| `mkdir`   | `(path, options?) → ResultAsync<void, FsError>`                 | `FsError`  |
| `rmdir`   | `(path) → ResultAsync<void, FsError>`                           | `FsError`  |
| `rm`      | `(path, options?) → ResultAsync<void, FsError>`                 | `FsError`  |
| `mkdtemp` | `(prefix) → ResultAsync<string, FsError>`                       | `FsError`  |
| `opendir` | `(path, options?) → ResultAsync<Dir, FsError>`                  | `FsError`  |

#### Metadata Operations

| Function | Signature                                    | Error Type |
| -------- | -------------------------------------------- | ---------- |
| `stat`   | `(path) → ResultAsync<Stats, FsError>`       | `FsError`  |
| `lstat`  | `(path) → ResultAsync<Stats, FsError>`       | `FsError`  |
| `access` | `(path, mode?) → ResultAsync<void, FsError>` | `FsError`  |
| `statfs` | `(path) → ResultAsync<StatsFs, FsError>`     | `FsError`  |

#### Permissions & Ownership

| Function | Signature                                       | Error Type |
| -------- | ----------------------------------------------- | ---------- |
| `chmod`  | `(path, mode) → ResultAsync<void, FsError>`     | `FsError`  |
| `chown`  | `(path, uid, gid) → ResultAsync<void, FsError>` | `FsError`  |
| `lchown` | `(path, uid, gid) → ResultAsync<void, FsError>` | `FsError`  |

#### Links & Paths

| Function   | Signature                                                    | Error Type |
| ---------- | ------------------------------------------------------------ | ---------- |
| `link`     | `(existing, newPath) → ResultAsync<void, FsError>`           | `FsError`  |
| `unlink`   | `(path) → ResultAsync<void, FsError>`                        | `FsError`  |
| `symlink`  | `(target, path, type?) → ResultAsync<void, FsError>`         | `FsError`  |
| `readlink` | `(path, encoding?) → ResultAsync<string \| Buffer, FsError>` | `FsError`  |
| `realpath` | `(path, encoding?) → ResultAsync<string \| Buffer, FsError>` | `FsError`  |

#### File Copy & Rename

| Function   | Signature                                            | Error Type |
| ---------- | ---------------------------------------------------- | ---------- |
| `copyFile` | `(src, dest, mode?) → ResultAsync<void, FsError>`    | `FsError`  |
| `cp`       | `(src, dest, options?) → ResultAsync<void, FsError>` | `FsError`  |
| `rename`   | `(oldPath, newPath) → ResultAsync<void, FsError>`    | `FsError`  |

#### Time Operations

| Function  | Signature                                           | Error Type |
| --------- | --------------------------------------------------- | ---------- |
| `utimes`  | `(path, atime, mtime) → ResultAsync<void, FsError>` | `FsError`  |
| `lutimes` | `(path, atime, mtime) → ResultAsync<void, FsError>` | `FsError`  |
