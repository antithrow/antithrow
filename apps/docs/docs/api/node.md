---
sidebar_position: 5
title: "@antithrow/node"
description: "Non-throwing wrappers around Node.js APIs"
---

# @antithrow/node

Non-throwing wrappers around Node.js APIs. Each function mirrors its built-in counterpart but returns a `ResultAsync` instead of throwing or rejecting.

Errors are returned as `NodeJS.ErrnoException` from Node.js.

## Installation

```bash npm2yarn
npm install @antithrow/node
```

## fs/promises

Import from `@antithrow/node/fs/promises` for non-throwing wrappers around `node:fs/promises`.

### File operations

#### readFile()

```ts
readFile(path: PathLike | FileHandle, options?: Options | null): ResultAsync<Buffer, NodeJS.ErrnoException>
readFile(path: PathLike | FileHandle, options: Options | BufferEncoding): ResultAsync<string, NodeJS.ErrnoException>
```

Reads the contents of a file. Returns a `Buffer` by default, or a `string` when an encoding is specified.

```ts
import { readFile } from "@antithrow/node/fs/promises";

const buf = await readFile("/tmp/data.bin");
// ok(Buffer) or err(NodeJS.ErrnoException)

const text = await readFile("/tmp/hello.txt", "utf-8");
// ok("Hello, world!") or err(NodeJS.ErrnoException)
```

#### writeFile()

```ts
writeFile(file: PathLike | FileHandle, data: string | ..., options?: Options | null): ResultAsync<void, NodeJS.ErrnoException>
```

Writes data to a file, replacing it if it already exists.

```ts
import { writeFile } from "@antithrow/node/fs/promises";

const result = await writeFile("/tmp/hello.txt", "Hello, world!");
// ok(undefined) or err(NodeJS.ErrnoException)
```

#### appendFile()

```ts
appendFile(path: PathLike | FileHandle, data: string | Uint8Array, options?: Options | null): ResultAsync<void, NodeJS.ErrnoException>
```

Appends data to a file.

```ts
import { appendFile } from "@antithrow/node/fs/promises";

const result = await appendFile("/tmp/log.txt", "new line\n");
// ok(undefined) or err(NodeJS.ErrnoException)
```

#### truncate()

```ts
truncate(path: PathLike, len?: number): ResultAsync<void, NodeJS.ErrnoException>
```

Truncates a file to a specified length.

```ts
import { truncate } from "@antithrow/node/fs/promises";

const result = await truncate("/tmp/data.bin", 100);
// ok(undefined) or err(NodeJS.ErrnoException)
```

#### open()

```ts
open(path: PathLike, flags?: string | number, mode?: Mode): ResultAsync<FileHandle, NodeJS.ErrnoException>
```

Opens a file and returns a `FileHandle`.

```ts
import { open } from "@antithrow/node/fs/promises";

const result = await open("/tmp/data.bin", "r");
// ok(FileHandle) or err(NodeJS.ErrnoException)
```

### Directory operations

#### readdir()

```ts
readdir(path: PathLike, options?: Options | null): ResultAsync<string[], NodeJS.ErrnoException>
readdir(path: PathLike, options: { withFileTypes: true }): ResultAsync<Dirent[], NodeJS.ErrnoException>
```

Reads the contents of a directory.

```ts
import { readdir } from "@antithrow/node/fs/promises";

const result = await readdir("/tmp");
// ok(["file1.txt", "file2.txt"]) or err(NodeJS.ErrnoException)

const entries = await readdir("/tmp", { withFileTypes: true });
// ok(Dirent[]) or err(NodeJS.ErrnoException)
```

#### mkdir()

```ts
mkdir(path: PathLike, options: { recursive: true }): ResultAsync<string | undefined, NodeJS.ErrnoException>
mkdir(path: PathLike, options?: Mode | Options | null): ResultAsync<undefined, NodeJS.ErrnoException>
```

Creates a directory. When `recursive` is `true`, returns the first directory path created.

```ts
import { mkdir } from "@antithrow/node/fs/promises";

const result = await mkdir("/tmp/a/b/c", { recursive: true });
// ok("/tmp/a") or err(NodeJS.ErrnoException)
```

#### rmdir()

```ts
rmdir(path: PathLike): ResultAsync<void, NodeJS.ErrnoException>
```

Removes an empty directory.

```ts
import { rmdir } from "@antithrow/node/fs/promises";

const result = await rmdir("/tmp/mydir");
// ok(undefined) or err(NodeJS.ErrnoException)
```

#### rm()

```ts
rm(path: PathLike, options?: RmOptions): ResultAsync<void, NodeJS.ErrnoException>
```

Removes files and directories.

```ts
import { rm } from "@antithrow/node/fs/promises";

const result = await rm("/tmp/mydir", { recursive: true, force: true });
// ok(undefined) or err(NodeJS.ErrnoException)
```

#### mkdtemp()

```ts
mkdtemp(prefix: string, options?: Options | null): ResultAsync<string, NodeJS.ErrnoException>
```

Creates a unique temporary directory.

```ts
import { mkdtemp } from "@antithrow/node/fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const result = await mkdtemp(join(tmpdir(), "myapp-"));
// ok("/tmp/myapp-aBcDeF") or err(NodeJS.ErrnoException)
```

#### opendir()

```ts
opendir(path: PathLike, options?: OpenDirOptions): ResultAsync<Dir, NodeJS.ErrnoException>
```

Opens a directory for iterative reading.

```ts
import { opendir } from "@antithrow/node/fs/promises";

const result = await opendir("/tmp");
if (result.isOk()) {
  for await (const dirent of result.value) {
    console.log(dirent.name);
  }
}
```

### Copy & move

#### copyFile()

```ts
copyFile(src: PathLike, dest: PathLike, mode?: number): ResultAsync<void, NodeJS.ErrnoException>
```

Copies a file.

```ts
import { copyFile } from "@antithrow/node/fs/promises";

const result = await copyFile("/tmp/source.txt", "/tmp/dest.txt");
// ok(undefined) or err(NodeJS.ErrnoException)
```

#### cp()

```ts
cp(source: string | URL, destination: string | URL, opts?: CopyOptions): ResultAsync<void, NodeJS.ErrnoException>
```

Copies files and directories (supports recursive copy).

```ts
import { cp } from "@antithrow/node/fs/promises";

const result = await cp("/tmp/src-dir", "/tmp/dest-dir", { recursive: true });
// ok(undefined) or err(NodeJS.ErrnoException)
```

#### rename()

```ts
rename(oldPath: PathLike, newPath: PathLike): ResultAsync<void, NodeJS.ErrnoException>
```

Renames a file or directory.

```ts
import { rename } from "@antithrow/node/fs/promises";

const result = await rename("/tmp/old.txt", "/tmp/new.txt");
// ok(undefined) or err(NodeJS.ErrnoException)
```

### Links

#### link()

```ts
link(existingPath: PathLike, newPath: PathLike): ResultAsync<void, NodeJS.ErrnoException>
```

Creates a hard link.

```ts
import { link } from "@antithrow/node/fs/promises";

const result = await link("/tmp/existing.txt", "/tmp/new-link.txt");
// ok(undefined) or err(NodeJS.ErrnoException)
```

#### symlink()

```ts
symlink(target: PathLike, path: PathLike, type?: string | null): ResultAsync<void, NodeJS.ErrnoException>
```

Creates a symbolic link.

```ts
import { symlink } from "@antithrow/node/fs/promises";

const result = await symlink("/tmp/target", "/tmp/my-link");
// ok(undefined) or err(NodeJS.ErrnoException)
```

#### readlink()

```ts
readlink(path: PathLike, options?: Options | null): ResultAsync<string, NodeJS.ErrnoException>
```

Reads the target of a symbolic link.

```ts
import { readlink } from "@antithrow/node/fs/promises";

const result = await readlink("/tmp/my-link");
// ok("/tmp/target") or err(NodeJS.ErrnoException)
```

#### unlink()

```ts
unlink(path: PathLike): ResultAsync<void, NodeJS.ErrnoException>
```

Removes a file or symbolic link.

```ts
import { unlink } from "@antithrow/node/fs/promises";

const result = await unlink("/tmp/old-file.txt");
// ok(undefined) or err(NodeJS.ErrnoException)
```

#### realpath()

```ts
realpath(path: PathLike, options?: Options | null): ResultAsync<string, NodeJS.ErrnoException>
```

Resolves a path to its canonical absolute path.

```ts
import { realpath } from "@antithrow/node/fs/promises";

const result = await realpath("/tmp/../tmp/hello.txt");
// ok("/tmp/hello.txt") or err(NodeJS.ErrnoException)
```

### Metadata

#### stat()

```ts
stat(path: PathLike, opts?: StatOptions): ResultAsync<Stats, NodeJS.ErrnoException>
stat(path: PathLike, opts: { bigint: true }): ResultAsync<BigIntStats, NodeJS.ErrnoException>
```

Returns file metadata.

```ts
import { stat } from "@antithrow/node/fs/promises";

const result = await stat("/tmp/hello.txt");
// ok(Stats) or err(NodeJS.ErrnoException)
```

#### lstat()

```ts
lstat(path: PathLike, opts?: StatOptions): ResultAsync<Stats, NodeJS.ErrnoException>
```

Like `stat`, but does not follow symbolic links.

```ts
import { lstat } from "@antithrow/node/fs/promises";

const result = await lstat("/tmp/my-link");
// ok(Stats) or err(NodeJS.ErrnoException)
```

#### statfs()

```ts
statfs(path: PathLike, opts?: StatFsOptions): ResultAsync<StatsFs, NodeJS.ErrnoException>
```

Returns filesystem statistics.

```ts
import { statfs } from "@antithrow/node/fs/promises";

const result = await statfs("/");
// ok(StatsFs) or err(NodeJS.ErrnoException)
```

#### access()

```ts
access(path: PathLike, mode?: number): ResultAsync<void, NodeJS.ErrnoException>
```

Tests whether a file is accessible.

```ts
import { access } from "@antithrow/node/fs/promises";
import { constants } from "node:fs";

const result = await access("/tmp/hello.txt", constants.R_OK);
// ok(undefined) or err(NodeJS.ErrnoException)
```

### Permissions & ownership

#### chmod()

```ts
chmod(path: PathLike, mode: Mode): ResultAsync<void, NodeJS.ErrnoException>
```

Changes file permissions.

```ts
import { chmod } from "@antithrow/node/fs/promises";

const result = await chmod("/tmp/script.sh", 0o755);
// ok(undefined) or err(NodeJS.ErrnoException)
```

#### chown()

```ts
chown(path: PathLike, uid: number, gid: number): ResultAsync<void, NodeJS.ErrnoException>
```

Changes file ownership.

```ts
import { chown } from "@antithrow/node/fs/promises";

const result = await chown("/tmp/hello.txt", 1000, 1000);
// ok(undefined) or err(NodeJS.ErrnoException)
```

#### lchown()

```ts
lchown(path: PathLike, uid: number, gid: number): ResultAsync<void, NodeJS.ErrnoException>
```

Changes ownership on a symbolic link without dereferencing it.

```ts
import { lchown } from "@antithrow/node/fs/promises";

const result = await lchown("/tmp/my-link", 1000, 1000);
// ok(undefined) or err(NodeJS.ErrnoException)
```

### Timestamps

#### utimes()

```ts
utimes(path: PathLike, atime: TimeLike, mtime: TimeLike): ResultAsync<void, NodeJS.ErrnoException>
```

Changes file access and modification times.

```ts
import { utimes } from "@antithrow/node/fs/promises";

const now = new Date();
const result = await utimes("/tmp/hello.txt", now, now);
// ok(undefined) or err(NodeJS.ErrnoException)
```

#### lutimes()

```ts
lutimes(path: PathLike, atime: TimeLike, mtime: TimeLike): ResultAsync<void, NodeJS.ErrnoException>
```

Like `utimes`, but does not follow symbolic links.

```ts
import { lutimes } from "@antithrow/node/fs/promises";

const now = new Date();
const result = await lutimes("/tmp/my-link", now, now);
// ok(undefined) or err(NodeJS.ErrnoException)
```
