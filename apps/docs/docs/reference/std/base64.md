---
title: atob / btoa
description: Non-throwing wrappers around the base64 globals.
sidebar_position: 5
---

# `atob` / `btoa`

Package: `@antithrow/std`

Non-throwing wrappers around `globalThis.atob` and `globalThis.btoa`.

## `atob(data)`

```ts
function atob(data: string): Result<string, DOMException>;
```

Decodes a base64-encoded ASCII string. Returns `Err(DOMException)` for invalid input.

## `btoa(data)`

```ts
function btoa(data: string): Result<string, DOMException>;
```

Encodes a binary string as base64. Returns `Err(DOMException)` when `data` contains characters outside the Latin-1 range.

## Throws

Never.

## Example

```ts
import { atob, btoa } from "@antithrow/std";

const encoded = btoa("hello"); // Ok("aGVsbG8=")
const decoded = atob("aGVsbG8="); // Ok("hello")
```
