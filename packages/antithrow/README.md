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
- **Compiler-visible** - success and failure are part of the type signature.
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
import { Err, Ok } from "antithrow";
import type { Result } from "antithrow";

type ConfigError =
  | { type: "missing-env"; key: string }
  | { type: "invalid-port"; value: string };

const readEnv = (key: string): Result<string, ConfigError> => {
  const value = process.env[key];
  return value
    ? new Ok(value)
    : new Err({ type: "missing-env", key });
};

const parsePort = (value: string): Result<number, ConfigError> => {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65535
    ? new Ok(port)
    : new Err({ type: "invalid-port", value });
};

const port = readEnv("PORT").andThen(parsePort).unwrapOr(3000);
```

> [!WARNING]
> `antithrow` preserves the `Result<T, E>` error kind. Because of that, it does **not** implicitly convert thrown values from callbacks or generator bodies into `Err<E>`.
>
> - Callbacks passed to methods like `map`, `mapErr`, `andThen`, and `orElse` can still throw/reject.
> - `Result.do(...)` generator bodies can still throw/reject.
>
> If logic can throw, wrap it explicitly with `Result.try(...)` before feeding it into pipelines.
> Or use [`@antithrow/std`](../std) which provides pre-wrapped versions of common globals.
>
> ```ts
> const safeJsonParse = (input: string): Result<unknown, SyntaxError> =>
>   Result.try(() => JSON.parse(input));
>
> const result = new Ok('{"a":1}').andThen(safeJsonParse);
> ```

## Getting Started

### Transformations

```ts
import { Ok } from "antithrow";

const result = new Ok(2)
  .map((x) => x * 2)         // ok(4)
  .andThen((x) => new Ok(x + 1)) // ok(5)
  .unwrapOr(0);              // 5
```

### Async Results

```ts
import { Ok, Result } from "antithrow";

// Wrap async throwing functions
const fetched = Result.try(async () => {
  const response = await fetch("/api/data");
  return response.json();
});

// `Pending` stays inside the same Result model
const result = Result.do(async function* () {
  const a = yield* new Ok(1);
  const b = yield* new Ok(2);
  return a + b;
});
// Pending<number, never>
```

### Settle at the App Boundary

```ts
interface RequestError {
  status: number;
  message: string;
}

async function handler(request: Request): Promise<Response> {
  const result = await Result.do(async function* () {
    const { email, name } = yield* parseBody(request);
    const validEmail = yield* validateEmail(email);
    yield* checkEmailAvailable(validEmail);

    return yield* saveUser(validEmail, name);
  }).settle();

  return result.mapOrElse(
    ({ status, message }) => Response.json({ error: message }, { status }),
    (user) => Response.json(user, { status: 201 }),
  );
}
```

## Static Constructors

### `Result.try(...)`

Wraps synchronous throws and async rejections:

```ts
const parsed = Result.try<unknown, SyntaxError>(() => JSON.parse(input));
const loaded = Result.try(async () => {
  const response = await fetch("/api");
  return response.json();
});
```

### `Result.fromPromise(...)`

Wraps an existing promise as `Pending<T, E>`:

```ts
const request = Result.fromPromise<Response, TypeError>(fetch("/api"));
```

### `Result.do(...)`

Runs a sync or async generator in fail-fast mode with `yield*`:

```ts
const total = Result.do(function* () {
  const a = yield* new Ok(20);
  const b = yield* new Ok(22);
  return a + b;
});
```

## Legacy API

If you want the older helper-based API with `ok`, `err`, `chain`, and `ResultAsync`, use the `antithrow/legacy` entrypoint. The modern root package is the v2 class-based API documented above.
