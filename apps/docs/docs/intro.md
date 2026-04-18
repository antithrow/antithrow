---
title: antithrow
description: Rust-style Result types for type-safe error handling in TypeScript.
slug: /
sidebar_position: 0
---

# antithrow

Rust-style `Result<T, E>` types for type-safe error handling in TypeScript, without throwing exceptions.

## Where to start

The documentation is organised into four sections, each with a different purpose.

- **[Tutorial](./tutorial/)** — a single end-to-end lesson. Start here if you have never used antithrow before.
- **[How-to guides](./how-to/)** — short, goal-oriented recipes. Go here when you know what you want to achieve.
- **[Reference](./reference/)** — the complete API surface for every package. Go here to look up a specific export.
- **[Explanation](./explanation/)** — the reasoning behind antithrow's design. Go here to understand why things are the way they are.

## Packages

| Package | Purpose |
| --- | --- |
| [`antithrow`](./reference/antithrow/) | The core `Result`, `Ok`, `Err`, `Pending`, and composition utilities. |
| [`@antithrow/std`](./reference/std/) | Non-throwing wrappers around standard globals (`fetch`, `JSON`, base64, URI helpers). |
| [`@antithrow/node`](./reference/node/) | Non-throwing wrappers around Node.js APIs (`fs/promises`, `os`). |
| [`@antithrow/jose`](./reference/jose/) | Non-throwing wrappers around the `jose` JWT library. |
| [`@antithrow/standard-schema`](./reference/standard-schema/) | Bridge Standard Schema validators (Zod, Valibot, ArkType) to antithrow results. |
| [`@antithrow/eslint-plugin`](./reference/eslint-plugin/) | ESLint rules that enforce correct Result usage. |

## Install

```bash npm2yarn
npm install antithrow
```
