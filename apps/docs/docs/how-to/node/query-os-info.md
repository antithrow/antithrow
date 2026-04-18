---
title: Query OS info
description: Read user, host, and network details from node:os without throws.
---

# Query OS info

`@antithrow/node/os` wraps the `node:os` APIs that can raise `ERR_SYSTEM_ERROR`.

## Home directory and current user

```ts
import { homedir, userInfo } from "@antithrow/node/os";

const home = homedir();
const user = userInfo();

if (home.isOk() && user.isOk()) {
	console.log(`${user.value.username}'s home is ${home.value}`);
}
```

`userInfo` has overloads for `"utf8"` (default, returns `UserInfo<string>`) and `"buffer"` (returns `UserInfo<Buffer>`).

## Network interfaces

```ts
import { networkInterfaces } from "@antithrow/node/os";

const ifaces = networkInterfaces();
if (ifaces.isOk()) {
	for (const [name, infos] of Object.entries(ifaces.value)) {
		// infos may be undefined on certain platforms
	}
}
```

## Process priority

```ts
import { getPriority, setPriority } from "@antithrow/node/os";

await setPriority(0); // current process, nice=0

const current = getPriority();
```

`setPriority` returns `Err(RangeError)` when priority is outside `[-20, 19]` (rather than throwing).

## See also

- Reference: [`@antithrow/node/os`](../../reference/node/os.md)
