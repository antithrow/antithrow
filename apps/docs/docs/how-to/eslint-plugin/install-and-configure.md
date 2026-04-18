---
title: Install and configure
description: Add @antithrow/eslint-plugin to a flat config and enable type-aware rules.
---

# Install and configure

The plugin targets ESLint flat config (ESLint v9+). All rules require type information, so you must also configure `@typescript-eslint`.

## Install

```bash npm2yarn
npm install --save-dev @antithrow/eslint-plugin typescript-eslint
```

## Minimal flat config

```ts
// eslint.config.ts
import tseslint from "typescript-eslint";
import antithrow from "@antithrow/eslint-plugin";

export default tseslint.config(
	...tseslint.configs.recommendedTypeChecked,
	{
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
	antithrow.configs.recommended,
);
```

`antithrow.configs.recommended` enables all three rules at the defaults:

| Rule | Severity |
| --- | --- |
| `@antithrow/no-throwing-call` | `warn` |
| `@antithrow/no-unsafe-unwrap` | `warn` |
| `@antithrow/no-unused-result` | `error` |

## Tuning individual rules

```ts
{
	rules: {
		"@antithrow/no-throwing-call": "error",
		"@antithrow/no-unsafe-unwrap": "error",
	},
}
```

## See also

- Reference: [`no-throwing-call`](../../reference/eslint-plugin/no-throwing-call.md)
- Reference: [`no-unsafe-unwrap`](../../reference/eslint-plugin/no-unsafe-unwrap.md)
- Reference: [`no-unused-result`](../../reference/eslint-plugin/no-unused-result.md)
