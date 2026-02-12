---
sidebar_position: 5
title: "@antithrow/node"
description: "Non-throwing wrappers around Node.js APIs"
---

# @antithrow/node

Non-throwing wrappers around Node.js APIs. Each function mirrors its built-in counterpart but returns a `ResultAsync` instead of throwing or rejecting.

Errors are returned as `FsError<Code>`, a structurally typed `NodeJS.ErrnoException` with the `code` field narrowed to the specific errno codes relevant to each operation.

## Installation

```bash npm2yarn
npm install @antithrow/node
```

## fs/promises

Import from `@antithrow/node/fs/promises` for non-throwing wrappers around `node:fs/promises`.

### File operations

#### readFile()

```ts
readFile(path: PathLike | FileHandle, options?: Options | null): ResultAsync<Buffer, FsError<ReadFileCode>>
readFile(path: PathLike | FileHandle, options: Options | BufferEncoding): ResultAsync<string, FsError<ReadFileCode>>
```

Reads the contents of a file. Returns a `Buffer` by default, or a `string` when an encoding is specified.

**Errno codes:** `ENOENT`, `EACCES`, `EISDIR`, `EMFILE`, `ENFILE`, `EIO`, `EBADF`, `EPERM`, `ENOTDIR`, `ELOOP`, `ENAMETOOLONG`

```ts
import { readFile } from "@antithrow/node/fs/promises";

const buf = await readFile("/tmp/data.bin");
// ok(Buffer) or err(FsError<ReadFileCode>)

const text = await readFile("/tmp/hello.txt", "utf-8");
// ok("Hello, world!") or err(FsError<ReadFileCode>)
```

#### writeFile()

```ts
writeFile(file: PathLike | FileHandle, data: string | ..., options?: Options | null): ResultAsync<void, FsError<WriteFileCode>>
```

Writes data to a file, replacing it if it already exists.

**Errno codes:** `ENOENT`, `EACCES`, `EISDIR`, `EMFILE`, `ENFILE`, `ENOSPC`, `EIO`, `EPERM`, `EROFS`, `ENOTDIR`, `ELOOP`, `ENAMETOOLONG`

```ts
import { writeFile } from "@antithrow/node/fs/promises";

const result = await writeFile("/tmp/hello.txt", "Hello, world!");
// ok(undefined) or err(FsError<WriteFileCode>)
```

#### appendFile()

```ts
appendFile(path: PathLike | FileHandle, data: string | Uint8Array, options?: Options | null): ResultAsync<void, FsError<AppendFileCode>>
```

Appends data to a file.

```ts
import { appendFile } from "@antithrow/node/fs/promises";

const result = await appendFile("/tmp/log.txt", "new line\n");
// ok(undefined) or err(FsError<AppendFileCode>)
```

#### truncate()

```ts
truncate(path: PathLike, len?: number): ResultAsync<void, FsError<TruncateCode>>
```

Truncates a file to a specified length.

```ts
import { truncate } from "@antithrow/node/fs/promises";

const result = await truncate("/tmp/data.bin", 100);
// ok(undefined) or err(FsError<TruncateCode>)
```

#### open()

```ts
open(path: PathLike, flags?: string | number, mode?: Mode): ResultAsync<FileHandle, FsError<OpenCode>>
```

Opens a file and returns a `FileHandle`.

```ts
import { open } from "@antithrow/node/fs/promises";

const result = await open("/tmp/data.bin", "r");
// ok(FileHandle) or err(FsError<OpenCode>)
```

### Directory operations

#### readdir()

```ts
readdir(path: PathLike, options?: Options | null): ResultAsync<string[], FsError<ReaddirCode>>
readdir(path: PathLike, options: { withFileTypes: true }): ResultAsync<Dirent[], FsError<ReaddirCode>>
```

Reads the contents of a directory.

```ts
import { readdir } from "@antithrow/node/fs/promises";

const result = await readdir("/tmp");
// ok(["file1.txt", "file2.txt"]) or err(FsError<ReaddirCode>)

const entries = await readdir("/tmp", { withFileTypes: true });
// ok(Dirent[]) or err(FsError<ReaddirCode>)
```

#### mkdir()

```ts
mkdir(path: PathLike, options: { recursive: true }): ResultAsync<string | undefined, FsError<MkdirCode>>
mkdir(path: PathLike, options?: Mode | Options | null): ResultAsync<undefined, FsError<MkdirCode>>
```

Creates a directory. When `recursive` is `true`, returns the first directory path created.

```ts
import { mkdir } from "@antithrow/node/fs/promises";

const result = await mkdir("/tmp/a/b/c", { recursive: true });
// ok("/tmp/a") or err(FsError<MkdirCode>)
```

#### rmdir()

```ts
rmdir(path: PathLike): ResultAsync<void, FsError<RmdirCode>>
```

Removes an empty directory.

```ts
import { rmdir } from "@antithrow/node/fs/promises";

const result = await rmdir("/tmp/mydir");
// ok(undefined) or err(FsError<RmdirCode>)
```

#### rm()

```ts
rm(path: PathLike, options?: RmOptions): ResultAsync<void, FsError<RmCode>>
```

Removes files and directories.

```ts
import { rm } from "@antithrow/node/fs/promises";

const result = await rm("/tmp/mydir", { recursive: true, force: true });
// ok(undefined) or err(FsError<RmCode>)
```

#### mkdtemp()

```ts
mkdtemp(prefix: string, options?: Options | null): ResultAsync<string, FsError<MkdtempCode>>
```

Creates a unique temporary directory.

```ts
import { mkdtemp } from "@antithrow/node/fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const result = await mkdtemp(join(tmpdir(), "myapp-"));
// ok("/tmp/myapp-aBcDeF") or err(FsError<MkdtempCode>)
```

#### opendir()

```ts
opendir(path: PathLike, options?: OpenDirOptions): ResultAsync<Dir, FsError<OpendirCode>>
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
copyFile(src: PathLike, dest: PathLike, mode?: number): ResultAsync<void, FsError<CopyFileCode>>
```

Copies a file.

```ts
import { copyFile } from "@antithrow/node/fs/promises";

const result = await copyFile("/tmp/source.txt", "/tmp/dest.txt");
// ok(undefined) or err(FsError<CopyFileCode>)
```

#### cp()

```ts
cp(source: string | URL, destination: string | URL, opts?: CopyOptions): ResultAsync<void, FsError<CpCode>>
```

Copies files and directories (supports recursive copy).

```ts
import { cp } from "@antithrow/node/fs/promises";

const result = await cp("/tmp/src-dir", "/tmp/dest-dir", { recursive: true });
// ok(undefined) or err(FsError<CpCode>)
```

#### rename()

```ts
rename(oldPath: PathLike, newPath: PathLike): ResultAsync<void, FsError<RenameCode>>
```

Renames a file or directory.

```ts
import { rename } from "@antithrow/node/fs/promises";

const result = await rename("/tmp/old.txt", "/tmp/new.txt");
// ok(undefined) or err(FsError<RenameCode>)
```

### Links

#### link()

```ts
link(existingPath: PathLike, newPath: PathLike): ResultAsync<void, FsError<LinkCode>>
```

Creates a hard link.

```ts
import { link } from "@antithrow/node/fs/promises";

const result = await link("/tmp/existing.txt", "/tmp/new-link.txt");
// ok(undefined) or err(FsError<LinkCode>)
```

#### symlink()

```ts
symlink(target: PathLike, path: PathLike, type?: string | null): ResultAsync<void, FsError<SymlinkCode>>
```

Creates a symbolic link.

```ts
import { symlink } from "@antithrow/node/fs/promises";

const result = await symlink("/tmp/target", "/tmp/my-link");
// ok(undefined) or err(FsError<SymlinkCode>)
```

#### readlink()

```ts
readlink(path: PathLike, options?: Options | null): ResultAsync<string, FsError<ReadlinkCode>>
```

Reads the target of a symbolic link.

```ts
import { readlink } from "@antithrow/node/fs/promises";

const result = await readlink("/tmp/my-link");
// ok("/tmp/target") or err(FsError<ReadlinkCode>)
```

#### unlink()

```ts
unlink(path: PathLike): ResultAsync<void, FsError<UnlinkCode>>
```

Removes a file or symbolic link.

```ts
import { unlink } from "@antithrow/node/fs/promises";

const result = await unlink("/tmp/old-file.txt");
// ok(undefined) or err(FsError<UnlinkCode>)
```

#### realpath()

```ts
realpath(path: PathLike, options?: Options | null): ResultAsync<string, FsError<RealpathCode>>
```

Resolves a path to its canonical absolute path.

```ts
import { realpath } from "@antithrow/node/fs/promises";

const result = await realpath("/tmp/../tmp/hello.txt");
// ok("/tmp/hello.txt") or err(FsError<RealpathCode>)
```

### Metadata

#### stat()

```ts
stat(path: PathLike, opts?: StatOptions): ResultAsync<Stats, FsError<StatCode>>
stat(path: PathLike, opts: { bigint: true }): ResultAsync<BigIntStats, FsError<StatCode>>
```

Returns file metadata.

```ts
import { stat } from "@antithrow/node/fs/promises";

const result = await stat("/tmp/hello.txt");
// ok(Stats) or err(FsError<StatCode>)
```

#### lstat()

```ts
lstat(path: PathLike, opts?: StatOptions): ResultAsync<Stats, FsError<LstatCode>>
```

Like `stat`, but does not follow symbolic links.

```ts
import { lstat } from "@antithrow/node/fs/promises";

const result = await lstat("/tmp/my-link");
// ok(Stats) or err(FsError<LstatCode>)
```

#### statfs()

```ts
statfs(path: PathLike, opts?: StatFsOptions): ResultAsync<StatsFs, FsError<StatfsCode>>
```

Returns filesystem statistics.

```ts
import { statfs } from "@antithrow/node/fs/promises";

const result = await statfs("/");
// ok(StatsFs) or err(FsError<StatfsCode>)
```

#### access()

```ts
access(path: PathLike, mode?: number): ResultAsync<void, FsError<AccessCode>>
```

Tests whether a file is accessible.

```ts
import { access } from "@antithrow/node/fs/promises";
import { constants } from "node:fs";

const result = await access("/tmp/hello.txt", constants.R_OK);
// ok(undefined) or err(FsError<AccessCode>)
```

### Permissions & ownership

#### chmod()

```ts
chmod(path: PathLike, mode: Mode): ResultAsync<void, FsError<ChmodCode>>
```

Changes file permissions.

```ts
import { chmod } from "@antithrow/node/fs/promises";

const result = await chmod("/tmp/script.sh", 0o755);
// ok(undefined) or err(FsError<ChmodCode>)
```

#### chown()

```ts
chown(path: PathLike, uid: number, gid: number): ResultAsync<void, FsError<ChownCode>>
```

Changes file ownership.

```ts
import { chown } from "@antithrow/node/fs/promises";

const result = await chown("/tmp/hello.txt", 1000, 1000);
// ok(undefined) or err(FsError<ChownCode>)
```

#### lchown()

```ts
lchown(path: PathLike, uid: number, gid: number): ResultAsync<void, FsError<LchownCode>>
```

Changes ownership on a symbolic link without dereferencing it.

```ts
import { lchown } from "@antithrow/node/fs/promises";

const result = await lchown("/tmp/my-link", 1000, 1000);
// ok(undefined) or err(FsError<LchownCode>)
```

### Timestamps

#### utimes()

```ts
utimes(path: PathLike, atime: TimeLike, mtime: TimeLike): ResultAsync<void, FsError<UtimesCode>>
```

Changes file access and modification times.

```ts
import { utimes } from "@antithrow/node/fs/promises";

const now = new Date();
const result = await utimes("/tmp/hello.txt", now, now);
// ok(undefined) or err(FsError<UtimesCode>)
```

#### lutimes()

```ts
lutimes(path: PathLike, atime: TimeLike, mtime: TimeLike): ResultAsync<void, FsError<LutimesCode>>
```

Like `utimes`, but does not follow symbolic links.

```ts
import { lutimes } from "@antithrow/node/fs/promises";

const now = new Date();
const result = await lutimes("/tmp/my-link", now, now);
// ok(undefined) or err(FsError<LutimesCode>)
```

## FsError

```ts
type FsError<Code extends string = string> = Omit<NodeJS.ErrnoException, "code"> & {
  code?: Code;
};
```

A Node.js filesystem error with a typed `code` property. Structurally compatible with `NodeJS.ErrnoException` but narrows the `code` field to a specific union of errno codes relevant to the operation that produced it.

```ts
import { readFile, type FsError, type ReadFileCode } from "@antithrow/node/fs/promises";

const result = await readFile("/nonexistent", "utf-8");

if (result.isErr()) {
  const error: FsError<ReadFileCode> = result.error;
  if (error.code === "ENOENT") {
    console.log("File not found");
  }
}
```
