---
title: URI helpers
description: Non-throwing wrappers around encodeURI, decodeURI, encodeURIComponent, decodeURIComponent.
sidebar_position: 6
---

# URI helpers

Package: `@antithrow/std`

Non-throwing wrappers around `globalThis.encodeURI`, `encodeURIComponent`, `decodeURI`, `decodeURIComponent`.

## `encodeURI(uri)`

```ts
function encodeURI(uri: string): Settled<string, URIError>;
```

## `decodeURI(encodedURI)`

```ts
function decodeURI(encodedURI: string): Settled<string, URIError>;
```

## `encodeURIComponent(component)`

```ts
function encodeURIComponent(
	uriComponent: string | number | boolean,
): Settled<string, URIError>;
```

## `decodeURIComponent(encodedURIComponent)`

```ts
function decodeURIComponent(encodedURIComponent: string): Settled<string, URIError>;
```

Each returns `Err(URIError)` for malformed input (for example, an orphaned `%` sequence).

## Throws

Never.

## Example

```ts
import { encodeURI, decodeURIComponent } from "@antithrow/std";

encodeURI("https://example.com/hello world");
decodeURIComponent("hello%20world");
```
