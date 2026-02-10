---
sidebar_position: 3
title: "chain()"
description: "API reference for the chain() generator-based composition function"
---

# chain()

Generator-based composition for `Result` and `ResultAsync` operations. See the [concept guide](../concepts/chain) for a detailed tutorial.

## Signatures

### Synchronous

```ts
function chain<T, E>(generator: () => SyncChainGenerator<T, E>): Result<T, E>;
```

Takes a sync generator function. `yield*` on a `Result` unwraps the `Ok` value or short-circuits on `Err`. The return value is wrapped in `Ok`.

```ts
import { chain, ok, err } from "antithrow";

const result = chain(function* () {
  const a = yield* ok(1);
  const b = yield* ok(2);
  return a + b;
});
// ok(3)
```

### Asynchronous

```ts
function chain<T, E>(generator: () => AsyncChainGenerator<T, E>): ResultAsync<T, E>;
```

Takes an async generator function. `yield*` on a `ResultAsync` awaits and unwraps the `Ok` value or short-circuits on `Err`.

```ts
import { chain, okAsync } from "antithrow";

const result = await chain(async function* () {
  const a = yield* okAsync(1);
  const b = yield* okAsync(2);
  return a + b;
});
// ok(3)
```

## Types

### SyncChainGenerator

```ts
type SyncChainGenerator<T, E> = Generator<Err<never, E>, T, void>;
```

The generator type produced by sync `chain()` callbacks.

### AsyncChainGenerator

```ts
type AsyncChainGenerator<T, E> = AsyncGenerator<Err<never, E>, T, void>;
```

The generator type produced by async `chain()` callbacks.

## Behavior

| Inside the generator | What happens                                       |
| -------------------- | -------------------------------------------------- |
| `yield* ok(value)`   | Returns `value`, execution continues               |
| `yield* err(error)`  | Generator exits, `chain()` returns `err(error)`    |
| `yield* someResult`  | Unwraps if `Ok`, exits if `Err`                    |
| `return value`       | Generator completes, `chain()` returns `ok(value)` |
| `throw error`        | **Not caught** — propagates as a regular exception |

:::warning
Thrown exceptions from the generator body are **not** converted into `Err`. Wrap throwable logic with `Result.try()` or `ResultAsync.try()` before yielding.
:::

## Examples

### Sync: multi-step validation

```ts
function validateOrder(order: Order): Result<Order, string> {
  return chain(function* () {
    if (order.items.length === 0) {
      return yield* err("Order has no items");
    }

    const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    if (order.discount < 0 || order.discount > 1) {
      return yield* err("Invalid discount");
    }

    return { ...order, total: subtotal * (1 - order.discount) };
  });
}
```

### Async: combining sync validation with async operations

```ts
import { chain, errAsync, type ResultAsync } from "antithrow";

function createUser(input: CreateUserInput): ResultAsync<User, ApiError> {
  return chain(async function* () {
    const validatedInput = yield* validateInput(input);
    const emailExists = yield* checkEmailExists(validatedInput.email);

    if (emailExists) {
      return yield* errAsync<User, ApiError>({
        type: "validation",
        message: "Email already exists",
      });
    }

    return yield* saveUser(validatedInput);
  });
}
```

### Mixing yield\* and await

In an async chain, use `yield*` for `Result`/`ResultAsync` values and regular `await` for non-Result promises:

```ts
const result = await chain(async function* () {
  const user = yield* fetchUser(1); // ResultAsync → yield*
  const orders = yield* fetchOrders(user.id); // ResultAsync → yield*

  const processed = await Promise.all(
    // Promise → await
    orders.map(async (order) => ({
      orderId: order.id,
      status: "processed",
    })),
  );

  return { user: user.name, processed };
});
```
