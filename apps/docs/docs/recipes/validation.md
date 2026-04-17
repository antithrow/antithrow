---
sidebar_position: 2
title: "Validation Pipelines"
---

# Validation Pipelines

Build composable validation pipelines using small, reusable validator functions that return `Result`.

## The pattern

Each validator is a function that accepts a value and returns `Result<ValidatedType, ValidationError>`:

```ts
import { ok, err, type Result } from "antithrow";

type ValidationError = { field: string; message: string };

function nonEmpty(field: string, value: string): Result<string, ValidationError> {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return err({ field, message: "cannot be empty" });
  }
  return ok(trimmed);
}

function minLength(field: string, value: string, min: number): Result<string, ValidationError> {
  if (value.length < min) {
    return err({ field, message: `must be at least ${min} characters` });
  }
  return ok(value);
}

function validEmail(value: string): Result<string, ValidationError> {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return err({ field: "email", message: "invalid format" });
  }
  return ok(value);
}
```

## Compose with chain()

Run validators in sequence — the first failure short-circuits:

```ts
import { chain } from "antithrow";

interface SignupInput {
  email: string;
  password: string;
  name: string;
}

function validateSignup(input: SignupInput): Result<SignupInput, ValidationError> {
  return chain(function* () {
    const email = yield* validEmail(input.email);
    const password = yield* minLength("password", input.password, 8);
    const name = yield* nonEmpty("name", input.name);
    return { email, password, name };
  });
}
```

## Compose with andThen()

For simple sequential validations, `andThen` gives a concise pipeline style:

```ts
function validateAge(input: string): Result<number, ValidationError> {
  return nonEmpty("age", input)
    .andThen((s) => {
      const n = Number(s);
      if (Number.isNaN(n)) {
        return err({ field: "age", message: "must be a number" });
      }
      return ok(n);
    })
    .andThen((n) => {
      if (n < 0 || n > 150) {
        return err({ field: "age", message: "must be between 0 and 150" });
      }
      return ok(n);
    });
}
```

## Using @antithrow/standard-schema

For schema-level validation, combine `@antithrow/standard-schema` with your business-logic validators:

```ts
import { chain, errAsync, type ResultAsync } from "antithrow";
import { validate } from "@antithrow/standard-schema";
import { z } from "zod";

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

type AppError = { type: "validation"; message: string } | { type: "duplicate_email" };

function processSignup(raw: unknown): ResultAsync<User, AppError> {
  return chain(async function* () {
    // Schema validation
    const input = yield* validate(SignupSchema, raw).mapErr(
      ({ issues }): AppError => ({
        type: "validation",
        message: issues.map((i) => i.message).join(", "),
      }),
    );

    // Business-logic validation
    const exists = yield* checkEmailExists(input.email);
    if (exists) {
      return yield* errAsync<User, AppError>({ type: "duplicate_email" });
    }

    return yield* createUser(input);
  });
}
```

## Transforming during validation

Validators can transform the value as they validate — the output type can differ from the input:

```ts
function parseDate(field: string, value: string): Result<Date, ValidationError> {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return err({ field, message: "invalid date" });
  }
  return ok(date);
}

function parseCurrency(field: string, value: string): Result<number, ValidationError> {
  const cleaned = value.replace(/[$,]/g, "");
  const amount = Number(cleaned);
  if (Number.isNaN(amount)) {
    return err({ field, message: "invalid currency amount" });
  }
  return ok(Math.round(amount * 100)); // Store as cents
}
```

These compose naturally with `chain()`:

```ts
function validateInvoice(raw: RawInvoice): Result<Invoice, ValidationError> {
  return chain(function* () {
    const date = yield* parseDate("date", raw.date);
    const amount = yield* parseCurrency("amount", raw.amount);
    const recipient = yield* nonEmpty("recipient", raw.recipient);

    return { date, amount, recipient };
  });
}
```
