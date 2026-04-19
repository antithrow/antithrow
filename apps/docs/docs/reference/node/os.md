---
title: os
description: Non-throwing wrappers around selected node:os APIs.
sidebar_position: 2
---

# `@antithrow/node/os`

Subpath: `@antithrow/node/os`

Non-throwing wrappers around `node:os`. These functions are synchronous, so they return `Settled<T, SystemError>` rather than a pending-capable `Result<T, E>`. `SystemError` is Node's `ERR_SYSTEM_ERROR` shape.

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
| `homedir` | `() => Settled<string, SystemError>` |
| `hostname` | `() => Settled<string, SystemError>` |
| `uptime` | `() => Settled<number, SystemError>` |
| `networkInterfaces` | `() => Settled<NodeJS.Dict<NetworkInterfaceInfo[]>, SystemError>` |
| `userInfo` | `(options?) => Settled<UserInfo<string \| Buffer>, SystemError>` |
| `getPriority` | `(pid?) => Settled<number, SystemError>` |
| `setPriority` | `(pid?, priority?) => Settled<void, SystemError \| RangeError>` |

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
