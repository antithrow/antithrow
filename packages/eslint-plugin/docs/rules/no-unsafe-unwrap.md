# `@antithrow/no-unsafe-unwrap`

Disallow unsafe `Result` extraction APIs that can throw at runtime.

## Rule Details

This rule reports usage of the following methods on `Result` and `ResultAsync` values from `antithrow`:

- `unwrap`
- `unwrapErr`
- `expect`
- `expectErr`

These methods can throw (or reject for `ResultAsync`) when called on the wrong variant. This bypasses explicit error handling and undermines typed error flows.

The rule is **type-aware** and only reports when the receiver is a `Result`/`ResultAsync` from `antithrow`.

It also reports extracting these members as properties, for example `const fn = result.unwrap` and `const { unwrap } = result`.

**Default severity:** `warn` in the recommended config.

### Invalid

```ts
import { ok, err, okAsync, errAsync } from "antithrow";

ok(1).unwrap();
err("x").unwrapErr();
ok(1).expect("value should exist");
err("x").expectErr("error should exist");

okAsync(1).unwrap();
errAsync("x").expectErr("error should exist");

const result = ok(1);
const fn = result.unwrap;
const { unwrap } = result;
```

### Valid

```ts
import { ok } from "antithrow";

// Use explicit branch handling
ok(1).match({ ok: (v) => v, err: (_e) => 0 });

// Safe fallback APIs are allowed
ok(1).unwrapOr(0);

// Non-antithrow objects are ignored
const box = {
	unwrap() {
		return 1;
	},
};
box.unwrap();

// Local helper names are ignored
function expect(value: number): number {
	return value;
}
expect(1);
```

## When Not To Use It

If your codebase intentionally allows `unwrap`/`expect`-style APIs and you accept runtime throws as a control-flow mechanism.

## Options

This rule has no options.

## Type Checking

This rule requires [type information](https://typescript-eslint.io/getting-started/typed-linting/) to run. You must configure your ESLint setup with `parserOptions.projectService` or `parserOptions.project`.
