---
sidebar_position: 4
title: "Modeling Errors"
---

# Modeling Errors

With exceptions, errors are `unknown`. With `Result<T, E>`, you choose `E` — making errors visible, typed, and exhaustively matchable. This page covers patterns for designing error types.

## String errors

The simplest approach — good for prototyping or internal utilities:

```ts
function divide(a: number, b: number): Result<number, string> {
  if (b === 0) return err("division by zero");
  return ok(a / b);
}
```

Limitations: no structured data, no exhaustive matching, easy to typo.

## Error subclasses

Familiar to JavaScript developers. Works well for errors that carry a stack trace:

```ts
class ValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(message);
  }
}

class NotFoundError extends Error {
  constructor(public readonly resource: string) {
    super(`${resource} not found`);
  }
}

function getUser(id: string): Result<User, ValidationError | NotFoundError> {
  /* ... */
}
```

## Discriminated unions (recommended)

A discriminated union with a `type` field gives you autocompletion, exhaustive `switch` matching, and structured data per variant:

```ts
type ApiError =
  | { type: "validation"; message: string }
  | { type: "not_found"; resource: string }
  | { type: "unauthorized" }
  | { type: "network"; cause: Error };
```

Handle with an exhaustive `switch`:

```ts
function formatError(error: ApiError): { status: number; body: object } {
  switch (error.type) {
    case "validation":
      return { status: 400, body: { error: error.message } };
    case "not_found":
      return { status: 404, body: { error: `${error.resource} not found` } };
    case "unauthorized":
      return { status: 401, body: { error: "Unauthorized" } };
    case "network":
      return { status: 503, body: { error: "Service unavailable" } };
  }
}
```

TypeScript enforces that every variant is handled. If you add a new variant to `ApiError`, the `switch` will show a compile error until you add the case.

## Automatic error composition

When `andThen()` or `chain()` combine functions with different error types, TypeScript automatically unions the errors:

```ts
declare function parse(s: string): Result<Config, ParseError>;
declare function validate(c: Config): Result<Config, ValidationError>;
declare function save(c: Config): ResultAsync<Config, DatabaseError>;

// Error type is automatically: ParseError | ValidationError | DatabaseError
const result = chain(async function* () {
  const config = yield* parse(rawInput);
  const validated = yield* validate(config);
  return yield* save(validated);
});
```

No manual union types needed — the compiler tracks it for you.

## Mapping errors between layers

Use `mapErr()` to convert between error types at boundaries — for example, translating a database error into an API error:

```ts
function getUser(id: string): ResultAsync<User, ApiError> {
  return db.query("SELECT * FROM users WHERE id = ?", [id]).mapErr((dbError): ApiError => {
    if (dbError.code === "NOT_FOUND") {
      return { type: "not_found", resource: `user:${id}` };
    }
    return { type: "network", cause: dbError };
  });
}
```

This keeps your inner layers using their own error types while presenting a clean API error type to callers.

## Choosing an approach

| Approach             | Best for                            | Trade-off                                |
| -------------------- | ----------------------------------- | ---------------------------------------- |
| Strings              | Quick prototypes, internal helpers  | No structure, no exhaustive matching     |
| Error subclasses     | Stack traces, `instanceof` checks   | Verbose, doesn't play well with `switch` |
| Discriminated unions | API boundaries, exhaustive handling | Slightly more boilerplate to define      |

For most applications, **discriminated unions** give the best balance of type safety and developer experience. Define one per domain boundary (e.g., `ApiError`, `DatabaseError`, `ValidationError`) and use `mapErr()` to translate between them.
