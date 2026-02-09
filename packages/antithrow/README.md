<div align="center">
	<h1>antithrow</h1>
	<p>
		type-safe and composable failure paths, available anywhere you write JavaScript
	</p>

![NPM Version](https://img.shields.io/npm/v/antithrow)
![NPM License](https://img.shields.io/npm/l/antithrow)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/jack-weilage/antithrow/check.yml)

</div>

## Features

- **Explicit failures** - return types show exactly which functions can fail and how.
- **Compiler-enforced** - TypeScript ensures you handle both `Ok` and `Err`.
- **Type-safe errors** - error types are known at compile time.
- **Sync + async support** - compose workflows with both `Result<T, E>` and `ResultAsync<T, E>`.
- **Ergonomic chaining** - use `chain(...)` + `yield*` for readable happy-path flow with early exits on failure.
- **Familiar API** - based heavily on Rust's battle-tested [`std::result`](https://doc.rust-lang.org/stable/std/result/).

## Installation

```bash
bun add antithrow
```

## Usage

> Check out [our examples](./examples/) for a list of working demos!

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
> If logic can throw, wrap it explicitly with `Result.try(...)` or `ResultAsync.try(...)` before feeding it into pipelines.
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
import { chain, okAsync, ResultAsync } from "antithrow";

// Wrap async throwing functions
const fetched = ResultAsync.try(async () => {
  const response = await fetch("/api/data");
  return response.json();
});

// Chain async operations
const result = await chain(async function* () {
  const a = yield* okAsync(1);
  const b = yield* okAsync(2);
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

  return result.match({
    ok: (user) => Response.json(user, { status: 201 }),
    err: ({ status, message }) => Response.json({ error: message }, { status }),
  });
}
```

## API

### Constructors

| Function                           | Description                                       |
| ---------------------------------- | ------------------------------------------------- |
| `ok(value?)`                       | Creates a successful result                       |
| `err(error)`                       | Creates a failed result                           |
| `okAsync(value?)`                  | Creates an async successful result                |
| `errAsync(error)`                  | Creates an async failed result                    |
| `Result.try(fn)`                   | Wraps a throwing function in a Result             |
| `ResultAsync.try(fn)`              | Wraps an async throwing function in a ResultAsync |
| `ResultAsync.fromResult(result)`   | Wraps an existing Result in a ResultAsync         |
| `ResultAsync.fromPromise(promise)` | Wraps a Promise\<Result\> in a ResultAsync        |
| `chain(generator)`                 | Chains results using generator syntax             |

### Methods

Both `Result` and `ResultAsync` support:

| Method                     | Description                                                      |
| -------------------------- | ---------------------------------------------------------------- |
| `isOk()`                   | Type predicate for success                                       |
| `isErr()`                  | Type predicate for failure                                       |
| `isOkAnd(fn)`              | Returns `true` if `Ok` and predicate passes                      |
| `isErrAnd(fn)`             | Returns `true` if `Err` and predicate passes                     |
| `unwrap()`                 | Returns value or throws                                          |
| `unwrapErr()`              | Returns error or throws                                          |
| `expect(message)`          | Returns value or throws with message                             |
| `expectErr(message)`       | Returns error or throws with message                             |
| `unwrapOr(default)`        | Returns value or default                                         |
| `unwrapOrElse(fn)`         | Returns value or computes from error                             |
| `map(fn)`                  | Transforms the success value                                     |
| `mapErr(fn)`               | Transforms the error value                                       |
| `mapOr(default, fn)`       | Transforms or returns default                                    |
| `mapOrElse(defaultFn, fn)` | Transforms or computes default                                   |
| `andThen(fn)`              | Chains with another Result-returning function                    |
| `and(result)`              | Returns the provided result if `Ok`                              |
| `or(result)`               | Returns this result if `Ok`, otherwise the provided result       |
| `orElse(fn)`               | Recovers from error with another Result                          |
| `match({ ok, err })`       | Pattern matches on the result                                    |
| `inspect(fn)`              | Side effects on success value                                    |
| `inspectErr(fn)`           | Side effects on error value                                      |
| `flatten()`                | Flattens nested `Result<Result<U, F>, E>` to `Result<U, E \| F>` |

#### Sync-to-Async Methods (`Result` only)

These methods transition from `Result` to `ResultAsync`:

| Method                | Description                                              |
| --------------------- | -------------------------------------------------------- |
| `mapAsync(fn)`        | Transforms `Ok` value with async function                |
| `mapErrAsync(fn)`     | Transforms `Err` value with async function               |
| `andThenAsync(fn)`    | Chains with async Result-returning function              |
| `orElseAsync(fn)`     | Recovers from error with async Result-returning function |
| `inspectAsync(fn)`    | Async side effects on success value                      |
| `inspectErrAsync(fn)` | Async side effects on error value                        |
