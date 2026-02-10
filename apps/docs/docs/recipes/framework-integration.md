---
sidebar_position: 4
title: "Framework Integration"
---

# Framework Integration

antithrow works with any framework. The key pattern: keep `Result` types in your internal layers and convert to framework responses at the boundary.

## The boundary pattern

```
Request → [Framework handler] → [Service layer (Result)] → [Framework response]
```

Your service functions return `Result` or `ResultAsync`. The framework handler consumes the Result and converts it into the appropriate response format.

## Express

```ts
import type { Request, Response } from "express";
import { type ResultAsync } from "antithrow";

// Service layer — returns ResultAsync
function getUser(id: string): ResultAsync<User, ApiError> {
  /* ... */
}

// Handler — converts Result to Express response
app.get("/users/:id", async (req: Request, res: Response) => {
  const result = await getUser(req.params.id);

  result.match({
    ok: (user) => {
      res.json(user);
    },
    err: (error) => {
      const { status, body } = formatApiError(error);
      res.status(status).json(body);
    },
  });
});
```

## Hono

```ts
import { Hono } from "hono";

const app = new Hono();

app.get("/users/:id", async (c) => {
  const result = await getUser(c.req.param("id"));

  return result.match({
    ok: (user) => c.json(user),
    err: (error) => {
      const { status, body } = formatApiError(error);
      return c.json(body, status);
    },
  });
});
```

## Next.js (App Router)

### API Routes

```ts
// app/api/users/[id]/route.ts
import { NextResponse } from "next/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getUser(id);

  return result.match({
    ok: (user) => NextResponse.json(user),
    err: (error) => {
      const { status, body } = formatApiError(error);
      return NextResponse.json(body, { status });
    },
  });
}
```

### Server Actions

```ts
// app/actions.ts
"use server";

import { chain, type ResultAsync } from "antithrow";
import { validate } from "@antithrow/standard-schema";

export async function createUser(formData: FormData) {
  const result = await chain(async function* () {
    const input = yield* validate(CreateUserSchema, {
      name: formData.get("name"),
      email: formData.get("email"),
    }).mapErr(({ issues }) => issues.map(({ message }) => message).join(", "));

    return yield* saveUser(input);
  });

  // Return a serializable value (not the Result itself)
  return result.match({
    ok: (user) => ({ success: true as const, user }),
    err: (error) => ({ success: false as const, error }),
  });
}
```

## General guidelines

1. **Don't leak `Result` into client code** — unless the client also uses antithrow, convert Results to plain objects at the boundary.

2. **Convert at the edge** — keep `Result` types throughout your service layer. Only call `match()` or equivalent in the handler/route.

3. **Define `formatApiError` once** — centralize your error-to-response mapping for consistency:

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
