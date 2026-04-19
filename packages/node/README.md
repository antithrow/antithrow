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

### os

Wraps `node:os` functions that can throw with `Result` for type-safe system info access.

```ts
import { homedir, hostname, userInfo } from "@antithrow/node/os";

// Get home directory
const home = homedir();

// Get hostname
const host = hostname();

// Get user info
const user = userInfo();
```

## Reference

- [`@antithrow/node/fs/promises`](https://antithrow.dev/docs/reference/node/fs-promises)
- [`@antithrow/node/os`](https://antithrow.dev/docs/reference/node/os)
