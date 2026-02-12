---
sidebar_position: 1
title: "@antithrow/eslint-plugin"
description: "ESLint rules for enforcing correct Result usage"
slug: /api/eslint-plugin
---

# @antithrow/eslint-plugin

ESLint plugin with type-aware rules for enforcing correct `Result` and `ResultAsync` usage.

## Installation

```bash npm2yarn
npm install -D @antithrow/eslint-plugin
```

## Setup

Add the recommended config to your ESLint flat config. The plugin requires type-aware linting via `typescript-eslint`:

```ts
// eslint.config.ts
import antithrow from "@antithrow/eslint-plugin";
import tseslint from "typescript-eslint";

export default tseslint.config(...tseslint.configs.recommended, antithrow.configs.recommended);
```

:::note
All three rules require type information. Make sure your ESLint config includes `typescript-eslint`'s parser with `project` or `projectService` options configured. See [typescript-eslint's docs](https://typescript-eslint.io/getting-started/typed-linting/) for setup instructions.
:::

## Recommended config

The recommended config enables all rules with these severities:

| Rule                                        | Severity |
| ------------------------------------------- | -------- |
| [`no-unused-result`](./no-unused-result.md) | `error`  |
| [`no-unsafe-unwrap`](./no-unsafe-unwrap.md) | `warn`   |
| [`no-throwing-call`](./no-throwing-call.md) | `warn`   |
