---
sidebar_position: 1
title: "Type-Safe API Layer"
---

# Type-Safe API Layer

This recipe builds a complete API handler combining typed errors, validation, async operations, and exhaustive error formatting.

## Define your error type

Use a discriminated union so every error variant carries structured data and can be exhaustively matched:

```ts
type ApiError =
  | { type: "validation"; message: string }
  | { type: "not_found"; resource: string }
  | { type: "unauthorized" }
  | { type: "network"; cause: Error };
```

## Validation functions

Each validator returns `Result<ValidatedValue, ApiError>`, making failure paths explicit:

```ts
import { ok, err, type Result } from "antithrow";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email: string): Result<string, ApiError> {
  if (!emailRegex.test(email)) {
    return err({ type: "validation", message: "Invalid email format" });
  }
  return ok(email);
}

function validatePassword(password: string): Result<string, ApiError> {
  if (password.length < 8) {
    return err({
      type: "validation",
      message: "Password must be at least 8 characters",
    });
  }
  return ok(password);
}

function validateName(name: string): Result<string, ApiError> {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return err({ type: "validation", message: "Name cannot be empty" });
  }
  return ok(trimmed);
}
```

## Compose validators with chain()

`chain()` runs validators in sequence — the first failure short-circuits:

```ts
import { chain } from "antithrow";

interface CreateUserInput {
  email: string;
  name: string;
  password: string;
}

function validateInput(input: CreateUserInput): Result<CreateUserInput, ApiError> {
  return chain(function* () {
    const email = yield* validateEmail(input.email);
    const password = yield* validatePassword(input.password);
    const name = yield* validateName(input.name);
    return { email, password, name };
  });
}
```

## Async data layer

Database or external API calls return `ResultAsync`:

```ts
import { okAsync, errAsync, type ResultAsync } from "antithrow";

function findUserByEmail(email: string): ResultAsync<User | undefined, ApiError> {
  return okAsync(users.find((u) => u.email === email));
}

function saveUser(input: CreateUserInput): ResultAsync<User, ApiError> {
  return okAsync({
    id: crypto.randomUUID(),
    email: input.email,
    name: input.name,
  });
}
```

## Combine with async chain()

Mix sync validation with async operations in one chain:

```ts
function createUser(input: CreateUserInput): ResultAsync<User, ApiError> {
  return chain(async function* () {
    // Sync validation
    const validatedInput = yield* validateInput(input);

    // Async business logic
    const existingUser = yield* findUserByEmail(validatedInput.email);
    if (existingUser) {
      return yield* errAsync<User, ApiError>({
        type: "validation",
        message: "Email already exists",
      });
    }

    // Async persistence
    return yield* saveUser(validatedInput);
  });
}
```

## Format errors to HTTP responses

Use an exhaustive `switch` on the error's `type` discriminant. TypeScript ensures every variant is handled:

```ts
function formatApiError(error: ApiError): { status: number; body: object } {
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

## Wire it together

```ts
async function handleCreateUser(input: CreateUserInput) {
  const result = await createUser(input);

  return result.match({
    ok: (user) => ({ status: 201, body: user }),
    err: (error) => formatApiError(error),
  });
}
```

Adding a new error variant to `ApiError` will cause compile errors everywhere it's not handled — the type system enforces completeness across your entire API layer.
