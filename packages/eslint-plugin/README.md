<div align="center">
	<h1>@antithrow/eslint-plugin</h1>
	<p>
		ESLint rules for <a href="https://github.com/antithrow/antithrow">antithrow</a> Result types
	</p>

![NPM Version](https://img.shields.io/npm/v/@antithrow/eslint-plugin)
![NPM License](https://img.shields.io/npm/l/@antithrow/eslint-plugin)
</div>

## Installation

```bash
bun add -d @antithrow/eslint-plugin
```

This plugin requires [typed linting](https://typescript-eslint.io/getting-started/typed-linting/) to be configured.

## Usage

Add the recommended config to your `eslint.config.ts`:

```ts
import antithrow from "@antithrow/eslint-plugin";

export default [
  // ... your other configs
  antithrow.configs.recommended,
];
```

Or configure rules individually:

```ts
import antithrow from "@antithrow/eslint-plugin";

export default [
  {
    plugins: {
      "@antithrow": antithrow,
    },
    rules: {
      "@antithrow/no-throwing-call": "warn",
      "@antithrow/no-unsafe-unwrap": "warn",
      "@antithrow/no-unused-result": "error",
    },
  },
];
```

## Rules

| Rule | Description | Recommended |
| --- | --- | --- |
| [`no-throwing-call`](./docs/rules/no-throwing-call.md) | Disallow calls to throwing built-in APIs with `@antithrow/std` replacements | `warn` |
| [`no-unsafe-unwrap`](./docs/rules/no-unsafe-unwrap.md) | Disallow `unwrap`/`expect` APIs on antithrow `Result` values | `warn` |
| [`no-unused-result`](./docs/rules/no-unused-result.md) | Require `Result` and `ResultAsync` values to be used | `error` |
