---
title: os
description: Non-throwing wrappers around selected node:os APIs.
sidebar_position: 2
---

# `@antithrow/node/os`

Subpath: `@antithrow/node/os`

Non-throwing wrappers around `node:os`. Most functions return `Result<T, SystemError>`, where `SystemError` is Node's `ERR_SYSTEM_ERROR` shape.

## `SystemError`

```ts
interface SystemError extends Error {
	code: "ERR_SYSTEM_ERROR";
	errno: number;
	syscall: string;
	info: {
		code: string;
		errno: number;
		message: string;
		syscall: string;
	};
	path?: string;
	dest?: string;
	address?: string;
	port?: number;
}
```

## Exports

| Export | Signature |
| --- | --- |
| `homedir` | `() => Result<string, SystemError>` |
| `hostname` | `() => Result<string, SystemError>` |
| `uptime` | `() => Result<number, SystemError>` |
| `networkInterfaces` | `() => Result<NodeJS.Dict<NetworkInterfaceInfo[]>, SystemError>` |
| `userInfo` | `(options?) => Result<UserInfo<string \| Buffer>, SystemError>` |
| `getPriority` | `(pid?) => Result<number, SystemError>` |
| `setPriority` | `(pid?, priority?) => Result<void, SystemError \| RangeError>` |

`userInfo` has overloads returning `UserInfo<string>` (default), `UserInfo<Buffer>` (`encoding: "buffer"`), or the union.

`setPriority` has overloads for `(priority)` and `(pid, priority)`. Returns `Err(RangeError)` when `priority` is outside `[-20, 19]`.

## Throws

Never.

## Example

```ts
import { homedir, userInfo } from "@antithrow/node/os";

const home = homedir();
const user = userInfo();

if (home.isOk()) {
	console.log(home.value);
}
```
