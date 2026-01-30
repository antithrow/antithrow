# antithrow

A TypeScript library implementing Rust-style `Result<T, E>` types for type-safe error handling without exceptions. Easily separate your business logic and error handling!

## Installation

```bash
bun add antithrow
```

## The Problem

Consider a typical route handler:

```ts
interface User {
  id: string;
  email: string;
  name: string;
}

function validateEmail(email: string): string | null {
  if (!email.includes("@")) return null;

  return email.trim();
}

function checkEmailAvailable(email: string): boolean {
  const taken = ["alice@example.com", "bob@example.com"];
  return !taken.includes(email);
}

function saveUser(email: string, name: string): User {
  return { id: crypto.randomUUID(), email, name };
}

async function handler(request: Request): Promise<Response> {
  // Error handling is interleaved with the business logic
  const body = await request.json();
  if (!body.email || !body.name) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }

  const validEmail = validateEmail(body.email);
  if (!validEmail) {
    return Response.json({ error: "Invalid email" }, { status: 400 });
  }

  if (!checkEmailAvailable(validEmail)) {
    return Response.json({ error: "Email taken" }, { status: 409 });
  }

  const user = saveUser(validEmail, body.name);
  return Response.json(user, { status: 201 });
}
```

Problems with this approach:
- **Repetitive**: Every step needs manual null/boolean checks and error responses
- **Easy to forget**: Miss a check and `null` propagates silently through your code
- **Inconsistent errors**: Each handler rolls its own error format and status codes

## The Solution

The same code rewritten with antithrow:

```ts
import type { Result, ResultAsync } from "antithrow"
import { chain, err, ok } from "antithrow";

interface User {
  id: string;
  email: string;
  name: string;
}

interface RequestError {
  status: number; 
  message: string;
}

// Return types now explicitly show these can fail
function parseBody(request: Request): ResultAsync<{ email: string; name: string }, RequestError> {
  return ResultAsync.try(() => request.json()).andThen((body) => {
    if (!body.email || !body.name) {
      return err({ status: 400, message: "Missing fields" });
    }

    return ok(body);
  });
}

function validateEmail(email: string): Result<string, RequestError> {
  if (!email.includes("@")) return err({ status: 400, message: "Invalid email" });

  return ok(email.trim());
}

function checkEmailAvailable(email: string): Result<void, RequestError> {
  const taken = ["alice@example.com", "bob@example.com"];
  if (taken.includes(email)) return err({ status: 409, message: "Email taken" });

  return ok();
}

function saveUser(email: string, name: string): Result<User, RequestError> {
  return ok({ id: crypto.randomUUID(), email, name });
}

async function handler(request: Request): Promise<Response> {
  // The happy path is easy to follow—no error handling cluttering the logic
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

Benefits:
- **Readable flow**: The `chain` block shows just the happy path—no interleaved error checks
- **Explicit failures**: Return types show exactly which functions can fail and how
- **Type-safe errors**: Error types are known at compile time—here we get proper status codes
- **Compiler-enforced**: You can't access `.value` without checking `.isOk()` first
- **Early returns**: `yield*` exits on error, like Rust's `?` operator

## More Features

### Wrapping Throwing Functions

Bridge existing exception-based APIs:

```ts
import { Result } from "antithrow";

const parsed = Result.try(() => JSON.parse('{"a": 1}')); // ok({ a: 1 })
const failed = Result.try(() => JSON.parse("invalid"));  // err(SyntaxError)
```

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

## API

### Constructors

| Function | Description |
|----------|-------------|
| `ok(value?)` | Creates a successful result |
| `err(error)` | Creates a failed result |
| `okAsync(value?)` | Creates an async successful result |
| `errAsync(error)` | Creates an async failed result |
| `Result.try(fn)` | Wraps a throwing function in a Result |
| `ResultAsync.try(fn)` | Wraps an async throwing function in a ResultAsync |
| `ResultAsync.fromResult(result)` | Wraps an existing Result in a ResultAsync |
| `ResultAsync.fromPromise(promise)` | Wraps a Promise\<Result\> in a ResultAsync |
| `chain(generator)` | Chains results using generator syntax |

### Methods

Both `Result` and `ResultAsync` support:

| Method | Description |
|--------|-------------|
| `isOk()` | Type predicate for success |
| `isErr()` | Type predicate for failure |
| `isOkAnd(fn)` | Returns `true` if `Ok` and predicate passes |
| `isErrAnd(fn)` | Returns `true` if `Err` and predicate passes |
| `unwrap()` | Returns value or throws |
| `unwrapErr()` | Returns error or throws |
| `expect(message)` | Returns value or throws with message |
| `expectErr(message)` | Returns error or throws with message |
| `unwrapOr(default)` | Returns value or default |
| `unwrapOrElse(fn)` | Returns value or computes from error |
| `map(fn)` | Transforms the success value |
| `mapErr(fn)` | Transforms the error value |
| `mapOr(default, fn)` | Transforms or returns default |
| `mapOrElse(defaultFn, fn)` | Transforms or computes default |
| `andThen(fn)` | Chains with another Result-returning function |
| `and(result)` | Returns the provided result if `Ok` |
| `or(result)` | Returns this result if `Ok`, otherwise the provided result |
| `orElse(fn)` | Recovers from error with another Result |
| `match({ ok, err })` | Pattern matches on the result |
| `inspect(fn)` | Side effects on success value |
| `inspectErr(fn)` | Side effects on error value |
| `flatten()` | Flattens nested `Result<Result<U, F>, E>` to `Result<U, E \| F>` |
