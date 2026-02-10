---
sidebar_position: 3
title: "Safe HTTP with @antithrow/std"
---

# Safe HTTP with @antithrow/std

`fetch()` and `response.json()` can both throw at runtime — network failures, aborted requests, malformed JSON. `@antithrow/std` wraps these into `ResultAsync` so errors are tracked in the type system.

## Basic fetch

```ts
import { fetch, Response } from "@antithrow/std";

const result = await fetch("https://api.example.com/users").andThen((response) =>
  Response.json<User[]>(response),
);

result.match({
  ok: (users) => console.log(users),
  err: (error) => console.error("Failed:", error),
});
```

## Handling non-2xx responses

`@antithrow/std`'s `fetch` treats all HTTP status codes as `Ok` — only network failures become `Err`. To convert non-2xx responses to errors, check `response.ok` in an `andThen`:

```ts
import { ok, err } from "antithrow";
import { fetch, Response } from "@antithrow/std";

type HttpError =
  | { type: "network"; cause: DOMException | TypeError }
  | { type: "http"; status: number; statusText: string }
  | { type: "parse"; cause: SyntaxError | DOMException | TypeError };

function fetchJson<T>(url: string): ResultAsync<T, HttpError> {
  return fetch(url)
    .mapErr((cause): HttpError => ({ type: "network", cause }))
    .andThen((response) => {
      if (!response.ok) {
        return err<T, HttpError>({
          type: "http",
          status: response.status,
          statusText: response.statusText,
        });
      }
      return Response.json<T>(response).mapErr((cause): HttpError => ({ type: "parse", cause }));
    });
}
```

## Reading response bodies

`@antithrow/std` provides functional wrappers for all body-reading methods. These accept a `Response` as an argument (they don't call methods on it):

```ts
import { Response } from "@antithrow/std";

// JSON
const json = await Response.json<User>(response);

// Text
const text = await Response.text(response);

// Binary
const buffer = await Response.arrayBuffer(response);
const blob = await Response.blob(response);

// Form data
const form = await Response.formData(response);
```

## Building a typed API client

Combine everything into a reusable API client:

```ts
import { ok, err, type ResultAsync } from "antithrow";
import { fetch, Response } from "@antithrow/std";

type ApiError =
  | { type: "network"; cause: Error }
  | { type: "http"; status: number; body: string }
  | { type: "parse" };

function api<T>(path: string, init?: RequestInit): ResultAsync<T, ApiError> {
  return fetch(`https://api.example.com${path}`, init)
    .mapErr((cause): ApiError => ({ type: "network", cause }))
    .andThen((response) => {
      if (!response.ok) {
        return Response.text(response)
          .mapErr((): ApiError => ({ type: "parse" }))
          .andThen((body) =>
            err<T, ApiError>({
              type: "http",
              status: response.status,
              body,
            }),
          );
      }
      return Response.json<T>(response).mapErr((): ApiError => ({ type: "parse" }));
    });
}

// Usage
const users = await api<User[]>("/users");
const created = await api<User>("/users", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "Alice" }),
});
```
