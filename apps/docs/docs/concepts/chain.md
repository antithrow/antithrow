---
sidebar_position: 3
title: "Composing with chain()"
---

# Composing with chain()

`chain()` provides generator-based composition for `Result` operations — similar to Rust's `?` operator. Inside a generator, `yield*` unwraps an `Ok` value or short-circuits on `Err`, giving you a linear, readable flow.

## The problem chain() solves

Deeply nested `andThen` chains become hard to read when you need intermediate values:

```ts
parseNumber(inputA).andThen((a) =>
  parseNumber(inputB).andThen((b) => divide(a, b).map((quotient) => quotient * 2)),
);
```

With `chain()`, this becomes flat and readable:

```ts
import { chain } from "antithrow";

const result = chain(function* () {
  const a = yield* parseNumber(inputA);
  const b = yield* parseNumber(inputB);
  const quotient = yield* divide(a, b);
  return quotient * 2;
});
```

## How it works

`chain()` takes a generator function. Inside:

- **`yield*` on an `Ok`** — returns the value and continues execution
- **`yield*` on an `Err`** — exits the generator immediately with that error
- **`return`** — wraps the final value in `Ok`

```ts
import { chain, ok, err, type Result } from "antithrow";

function parseNumber(s: string): Result<number, string> {
  const n = Number(s);
  return Number.isNaN(n) ? err(`Invalid number: ${s}`) : ok(n);
}

function divide(a: number, b: number): Result<number, string> {
  return b === 0 ? err("Division by zero") : ok(a / b);
}

const result = chain(function* () {
  const a = yield* parseNumber("10"); // a = 10
  const b = yield* parseNumber("2"); // b = 2
  const quotient = yield* divide(a, b); // quotient = 5
  return quotient * 2; // Wrapped in Ok → ok(10)
});
```

When any step fails, the generator exits immediately:

```ts
const result = chain(function* () {
  const a = yield* parseNumber("abc"); // Err — exits here
  const b = yield* parseNumber("2"); // Never reached
  return a + b;
});
result.unwrapErr(); // "Invalid number: abc"
```

## Early exit with yield\* err()

Use `yield* err(...)` to bail out with a custom error at any point:

```ts
function calculateTotal(order: Order): Result<number, string> {
  return chain(function* () {
    if (order.items.length === 0) {
      return yield* err("Order has no items");
    }

    const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    if (order.discount < 0 || order.discount > 1) {
      return yield* err("Invalid discount");
    }

    return subtotal * (1 - order.discount);
  });
}
```

## Async chain()

The same pattern works with `async function*` and `ResultAsync` values. `yield*` handles both awaiting and unwrapping in one step:

```ts
import { chain, okAsync, errAsync, type ResultAsync } from "antithrow";

function fetchUser(id: number): ResultAsync<User, string> {
  /* ... */
}
function fetchOrders(userId: number): ResultAsync<Order[], string> {
  /* ... */
}

const result = await chain(async function* () {
  const user = yield* fetchUser(1);
  const orders = yield* fetchOrders(user.id);
  return { user, orders };
});
```

### Mixing sync and async

In an async chain, you can `yield*` both sync `Result` and async `ResultAsync`. Use regular `await` for non-Result promises:

```ts
const result = await chain(async function* () {
  // yield* sync Result
  const validatedInput = yield* validateInput(input);

  // yield* async ResultAsync
  const user = yield* saveUser(validatedInput);

  // Regular await for non-Result async work
  const processed = await sendWelcomeEmail(user.email);

  return user;
});
```

## Important caveats

### Thrown exceptions are NOT caught

`chain()` does **not** catch thrown exceptions from the generator body. If code inside the generator throws, the exception propagates as-is. Wrap throwable logic with `Result.try()` or `ResultAsync.try()` before yielding:

```ts
// Bad — thrown exception escapes chain()
const result = chain(function* () {
  const data = JSON.parse(rawJson); // Can throw!
  return data;
});

// Good — wrap with Result.try()
const result = chain(function* () {
  const data = yield* Result.try(() => JSON.parse(rawJson));
  return data;
});
```

### Return type

- `chain(function* () { ... })` returns `Result<T, E>`
- `chain(async function* () { ... })` returns `ResultAsync<T, E>`

## When to use chain() vs andThen()

| Use `andThen()` when             | Use `chain()` when                     |
| -------------------------------- | -------------------------------------- |
| Simple 2-step pipelines          | 3+ steps with intermediate values      |
| Linear transformations           | Conditional logic or early exits       |
| No intermediate variables needed | You need variables from multiple steps |
| Functional style is preferred    | Imperative style is more readable      |

Both produce the same types and can be mixed freely.
