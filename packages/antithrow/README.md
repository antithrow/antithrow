<div align="center">
	<h1>antithrow</h1>
	<p>
		type-safe and composable failure paths, available anywhere you write JavaScript
	</p>

![NPM Version](https://img.shields.io/npm/v/antithrow)
![NPM License](https://img.shields.io/npm/l/antithrow)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/antithrow/antithrow/check.yml)

</div>

## Features

- **Explicit failures** - return types show exactly which functions can fail and how.
- **Compiler-enforced** - TypeScript ensures you handle both `Ok` and `Err`.
- **Type-safe errors** - error types are known at compile time.
- **Sync + async support** - compose fluid workflows with symmetrical methods.
- **Ergonomic chaining** - use `Result.do(...)` + `yield*` for readable happy-path flow with early exits on failure.
- **Familiar API** - based heavily on Rust's battle-tested [`std::result`](https://doc.rust-lang.org/stable/std/result/).

## Installation

```bash
bun add antithrow
```

## Usage

```ts
import type { Result } from "antithrow";
import { err, ok } from "antithrow";

type ConfigError =
  | { type: "missing_env"; key: string }
  | { type: "invalid_port"; value: string };

const readEnv = (key: string): Result<string, ConfigError> => {
  const value = process.env[key];
  return value ? ok(value) : err({ type: "missing_env", key });
};

const parsePort = (value: string): Result<number, ConfigError> => {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65535
    ? ok(port)
    : err({ type: "invalid_port", value });
};

const port = readEnv("PORT").andThen(parsePort).unwrapOr(3000);
```

> [!WARNING]
> `antithrow` preserves the `Result<T, E>` error kind. Because of that, it does **not** implicitly convert thrown values from callbacks or generator bodies into `Err<E>`.
>
> - Callbacks passed to methods like `map`, `mapErr`, `andThen`, `orElse`, `inspect` (and async variants) can still throw/reject.
> - `chain(...)` generator bodies can still throw/reject.
>
> If logic can throw, wrap it explicitly with `Result.try(...)` before feeding it into pipelines.
> Or use [`@antithrow/std`](../std) which provides pre-wrapped versions of common globals.
>
> ```ts
> const safeJsonParse = (input: string): Result<unknown, SyntaxError> =>
>   Result.try(() => JSON.parse(input));
>
> const result = ok('{"a":1}').andThen(safeJsonParse);
> ```

## Getting Started

### Transformations

```ts
import { ok } from "antithrow";

const result = ok(2)
  .map((x) => x * 2)         // ok(4)
  .andThen((x) => ok(x + 1)) // ok(5)
  .unwrapOr(0);              // 5
```

### Async Results

```ts
import { Result } from "antithrow";

// Wrap async throwing functions
const fetched = Result.try(async () => {
  const response = await fetch("/api/data");
  return response.json();
});

// Chain async operations
const result = await chain(async function* () {
  const a = yield* new Ok(1);
  const b = yield* new Ok(2);
  return a + b;
});
// ok(3)
```

### Chain Multiple Results

```ts
interface RequestError {
  status: number;
  message: string;
}

async function handler(request: Request): Promise<Response> {
  const result = await chain(async function* () {
    const { email, name } = yield* parseBody(request);
    const validEmail = yield* validateEmail(email);
    yield* checkEmailAvailable(validEmail);

    return yield* saveUser(validEmail, name);
  });

  return result.mapOrElse(
    ({ status, message }) => Response.json({ error: message }, { status }),
    (user) => Response.json(user, { status: 201 }),
  );
}
```
