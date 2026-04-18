---
title: Parse and stringify JSON
description: Use JSON.parse and JSON.stringify without catching SyntaxError by hand.
---

# Parse and stringify JSON

`@antithrow/std`'s `JSON` mirrors `globalThis.JSON` but returns `Result`. No `try/catch` needed.

## Parse

```ts
import { JSON } from "@antithrow/std";

const parsed = JSON.parse<Config>(raw);

if (parsed.isOk()) {
	use(parsed.value);
} else {
	report(parsed.error); // SyntaxError
}
```

The generic parameter is a type assertion — it does not validate. For validation, pipe the result through a schema (see below).

## Stringify

```ts
const text = JSON.stringify({ id: 1 });
```

`JSON.stringify` returns `Result<string | undefined, TypeError>` because `JSON.stringify` throws `TypeError` on circular references and on `BigInt`, and returns `undefined` for non-serializable top-level values like `undefined` or `Symbol`.

## Parse + validate

Chain with a Standard Schema validator to get both parse-time and shape-time errors in a single pipeline:

```ts
import { JSON } from "@antithrow/std";
import { validateSync } from "@antithrow/standard-schema";

const result = JSON.parse(raw).andThen((value) => validateSync(schema, value));
```

## See also

- Reference: [`JSON`](../../reference/std/json.md)
- How-to: [Validate with Zod](../standard-schema/validate-with-zod.md)
