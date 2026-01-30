# antithrow

A TypeScript library implementing Rust-style `Result<T, E>` types for type-safe error handling without exceptions.

## Installation

```bash
bun add antithrow
```

## The Problem

Consider a typical user registration flow with exceptions:

```ts
interface User {
  id: string;
  email: string;
  name: string;
}

function validateEmail(email: string): string {
  if (!email.includes("@")) throw new Error("Invalid email");
  return email;
}

function checkEmailAvailable(email: string): void {
  const taken = ["alice@example.com", "bob@example.com"];
  if (taken.includes(email)) throw new Error("Email taken");
}

function saveUser(email: string, name: string): User {
  return { id: crypto.randomUUID(), email, name };
}

// The caller has no idea which exceptions might be thrown
function createUser(email: string, name: string): User {
  const validEmail = validateEmail(email);
  checkEmailAvailable(validEmail);
  return saveUser(validEmail, name);
}

// Error handling is optional and easy to forget
try {
  const user = createUser("invalid", "Test");
  console.log("Created:", user);
} catch (e) {
  // What errors can we get here? The types don't tell us
  console.error("Failed:", e);
}
```

Problems with this approach:
- **Hidden failures**: Nothing in the type signature indicates `createUser` can fail
- **Unclear errors**: Callers don't know what exceptions to catch
- **Easy to forget**: The compiler won't remind you to handle errors

## The Solution

The same code rewritten with antithrow:

```ts
import { chain, err, ok, type Result } from "antithrow";

interface User {
  id: string;
  email: string;
  name: string;
}

// Return types now explicitly show these can fail
function validateEmail(email: string): Result<string, string> {
  if (!email.includes("@")) return err("Invalid email");
  return ok(email);
}

function checkEmailAvailable(email: string): Result<void, string> {
  const taken = ["alice@example.com", "bob@example.com"];
  if (taken.includes(email)) return err("Email taken");
  return ok();
}

function saveUser(email: string, name: string): Result<User, string> {
  return ok({ id: crypto.randomUUID(), email, name });
}

// The return type makes failure explicit—callers must handle it
function createUser(email: string, name: string): Result<User, string> {
  return chain(function* () {
    const validEmail = yield* validateEmail(email);
    yield* checkEmailAvailable(validEmail);
    return yield* saveUser(validEmail, name);
  });
}

// TypeScript ensures you handle both cases
const result = createUser("alice@example.com", "Test");

if (result.isOk()) {
  console.log("Created:", result.value);
} else {
  console.error("Failed:", result.error);
}

// Or use pattern matching
result.match({
  ok: (user) => console.log("Created:", user),
  err: (error) => console.error("Failed:", error),
});
```

Benefits:
- **Explicit failures**: The `Result<User, string>` return type shows this can fail
- **Type-safe errors**: You know exactly what error type to expect
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

### Boolean Operators

```ts
import { err, ok } from "antithrow";

const next = ok(1).and(ok("next"));
console.log(next.unwrap()); // "next"

const fallback = err<number, string>("missing").or(ok(0));
console.log(fallback.unwrap()); // 0
```

Async works the same way:

```ts
import { errAsync, ok, okAsync } from "antithrow";

const nextAsync = okAsync(1).and(ok("next"));
console.log(await nextAsync.unwrap()); // "next"

const fallbackAsync = errAsync<number, string>("missing").or(okAsync(0));
console.log(await fallbackAsync.unwrap()); // 0
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
