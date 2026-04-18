---
title: Read and write files
description: Use @antithrow/node/fs/promises for filesystem access without try/catch.
---

# Read and write files

Swap `node:fs/promises` for `@antithrow/node/fs/promises` — same shape, same arguments, `Result` return.

## Read

```ts
import { readFile } from "@antithrow/node/fs/promises";

const contents = await readFile("/etc/hostname", "utf-8");

if (contents.isOk()) {
	use(contents.value);
} else if (contents.error.code === "ENOENT") {
	createDefault();
}
```

The error is typed as `NodeJS.ErrnoException`, so branching on `.code` (`"ENOENT"`, `"EACCES"`, `"EISDIR"`, …) is fully typed.

## Write

```ts
import { writeFile } from "@antithrow/node/fs/promises";

const wrote = await writeFile("/tmp/out.txt", "hello", "utf-8");
if (wrote.isErr() && wrote.error.code === "EACCES") {
	fallbackToTempDir();
}
```

`writeFile` returns `ResultAsync<void, NodeJS.ErrnoException>`.

## Compose read + write

```ts
import { readFile, writeFile } from "@antithrow/node/fs/promises";

const copied = await readFile(source)
	.andThen((buf) => writeFile(target, buf));
```

`andThen` short-circuits if the read fails.

## Create a directory if missing

```ts
import { mkdir, writeFile } from "@antithrow/node/fs/promises";

await mkdir(dir, { recursive: true }).andThen(() => writeFile(path, data));
```

With `{ recursive: true }`, `mkdir` no longer errors on `EEXIST`, so the `andThen` always reaches `writeFile`.

## See also

- Reference: [`@antithrow/node/fs/promises`](../../reference/node/fs-promises.md)
