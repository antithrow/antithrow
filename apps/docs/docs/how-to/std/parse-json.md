---
title: Parse and stringify JSON
description: Use json.parse and json.stringify without catching SyntaxError by hand.
---

# Parse and stringify JSON

`@antithrow/std`'s `json` mirrors `globalThis.JSON` but returns `Result`. No `try/catch` needed.

## Parse

```ts
import { json } from "@antithrow/std";

const parsed = json.parse<Config>(raw);

if (parsed.isOk()) {
	use(parsed.value);
} else {
	report(parsed.error); // SyntaxError
}
```

The generic parameter is a type assertion — it does not validate. For validation, pipe the result through a schema (see below).

## Stringify

```ts
const text = json.stringify({ id: 1 });
```

`json.stringify` returns `Result<string, TypeError>` because `JSON.stringify` throws `TypeError` on circular references and on `BigInt`.

## Parse + validate

Chain with a Standard Schema validator to get both parse-time and shape-time errors in a single pipeline:

```ts
import { json } from "@antithrow/std";
import { validateSync } from "@antithrow/standard-schema";

const result = json.parse(raw).andThen((value) => validateSync(schema, value));
```

## See also

- Reference: [`json`](../../reference/std/json.md)
- How-to: [Validate with Zod](../standard-schema/validate-with-zod.md)
