---
sidebar_position: 5
title: "Migrating from try-catch"
---

# Migrating from try-catch

You don't need to convert everything at once. antithrow is designed for incremental adoption — start at the edges and work inward.

## Step 1: Wrap throwing functions

Use `Result.try()` and `ResultAsync.try()` to wrap existing code that throws. This is the quickest way to start getting type-safe errors:

```ts
import { Result, ResultAsync } from "antithrow";

// Before
function parseConfig(raw: string): Config {
  return JSON.parse(raw); // Can throw SyntaxError
}

// After — minimal change, immediate safety
function parseConfig(raw: string): Result<Config, unknown> {
  return Result.try(() => JSON.parse(raw));
}

// Async version
function fetchData(url: string): ResultAsync<Data, unknown> {
  return ResultAsync.try(async () => {
    const response = await fetch(url);
    return response.json();
  });
}
```

## Step 2: Replace standard globals and Node.js APIs

Install `@antithrow/std` and swap throwing globals for their non-throwing wrappers. This gives you precise error types instead of `unknown`:

```ts
// Before
const data = JSON.parse(input); // throws SyntaxError
const response = await fetch(url); // throws TypeError/DOMException
const decoded = atob(encoded); // throws DOMException

// After
import { JSON, fetch, atob } from "@antithrow/std";

const data = JSON.parse<MyType>(input); // Result<MyType, SyntaxError>
const response = await fetch(url); // Result<Response, DOMException | TypeError>
const decoded = atob(encoded); // Result<string, DOMException>
```

For Node.js APIs, install `@antithrow/node`:

```ts
// Before
import { readFile, writeFile } from "node:fs/promises";

const content = await readFile("config.json", "utf-8"); // throws ErrnoException
await writeFile("output.json", data); // throws ErrnoException

// After
import { readFile, writeFile } from "@antithrow/node/fs/promises";

const content = await readFile("config.json", "utf-8"); // ResultAsync<string, FsError<ReadFileCode>>
await writeFile("output.json", data); // ResultAsync<void, FsError<WriteFileCode>>
```

Enable the `no-throwing-call` lint rule to find remaining usages:

```ts
// eslint.config.ts
import antithrow from "@antithrow/eslint-plugin";

export default [antithrow.configs.recommended];
// @antithrow/no-throwing-call: warn — flags JSON.parse, fetch, etc.
```

## Step 3: Convert function signatures

Change functions from throwing to returning `Result`. Start with leaf functions (ones that don't call other functions you plan to convert):

```ts
// Before
function getUser(id: string): User {
  const data = db.get(id);
  if (!data) throw new NotFoundError(id);
  return data;
}

// After
import { ok, err, type Result } from "antithrow";

function getUser(id: string): Result<User, { type: "not_found"; id: string }> {
  const data = db.get(id);
  if (!data) return err({ type: "not_found", id });
  return ok(data);
}
```

## Step 4: Replace try-catch with chain()

Multi-step try-catch blocks map directly to `chain()`:

```ts
// Before
async function createOrder(input: OrderInput): Promise<Order> {
  try {
    const user = await getUser(input.userId);
    const validated = validateOrder(input);
    const order = await saveOrder(user, validated);
    await sendConfirmation(order);
    return order;
  } catch (error) {
    // What type is error? Who knows!
    throw error;
  }
}

// After
import { chain, type ResultAsync } from "antithrow";

function createOrder(input: OrderInput): ResultAsync<Order, OrderError> {
  return chain(async function* () {
    const user = yield* getUser(input.userId);
    const validated = yield* validateOrder(input);
    const order = yield* saveOrder(user, validated);
    yield* sendConfirmation(order);

    return order;
  });
}
// Error type is automatically: GetUserError | ValidationError | SaveError | SendError
```

## Step 5: Enable lint rules

Once you've converted a meaningful portion of your code, turn up the lint rules:

```ts
// eslint.config.ts
import antithrow from "@antithrow/eslint-plugin";

export default [
  antithrow.configs.recommended,
  {
    rules: {
      // Error on discarded Results (catches forgotten error handling)
      "@antithrow/no-unused-result": "error",
      // Warn on unsafe unwrap (encourages proper narrowing)
      "@antithrow/no-unsafe-unwrap": "warn",
      // Warn on throwing APIs (guides migration to @antithrow/std)
      "@antithrow/no-throwing-call": "warn",
    },
  },
];
```

## Common pitfalls

### chain() does not catch thrown exceptions

```ts
// This will throw, NOT return Err
const result = chain(function* () {
  const data = JSON.parse(invalid); // Throws!
  return data;
});

// Wrap with Result.try() first
const result = chain(function* () {
  const data = yield* Result.try(() => JSON.parse(invalid));
  return data;
});
```

### fromPromise vs try

`ResultAsync.fromPromise()` does **not** catch rejections — it assumes the promise resolves to a well-formed `Result`. Use `ResultAsync.try()` when wrapping code that might reject:

```ts
// Wrong — if fetchData rejects, this crashes
ResultAsync.fromPromise(fetchData());

// Right — catches rejections and wraps them as Err
ResultAsync.try(() => fetchData());
```

### Mixing Result and exceptions

Avoid returning `Result` from a function that might also throw. Pick one pattern per function:

```ts
// Bad — callers don't know which errors are Results and which are thrown
function process(input: string): Result<Output, ValidationError> {
  if (!input) throw new Error("empty"); // Inconsistent!
  return validate(input);
}

// Good — all errors go through Result
function process(input: string): Result<Output, ValidationError | "empty"> {
  if (!input) return err("empty" as const);
  return validate(input);
}
```
