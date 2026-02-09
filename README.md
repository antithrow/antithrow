# antithrow

A TypeScript ecosystem for Rust-style `Result<T, E>` error handling without exceptions.

`antithrow` helps you model failure paths explicitly so error handling is type-safe, composable,
and visible at compile time.

- Keep the happy path readable while still handling failures early.
- Encode all failure variants in the type system.
- Compose sync and async pipelines with the same mental model.
- Interoperate with throw-based code via `Result.try(...)` and `ResultAsync.try(...)`.

## Packages

- [`antithrow`](./packages/antithrow) - Core `Result`, `ResultAsync`, and `chain` utilities.
- [`@antithrow/std`](./packages/std) - Non-throwing wrappers around standard globals (`fetch`, `JSON`, `atob`, etc.).
- [`@antithrow/standard-schema`](./packages/standard-schema) - Bridge Standard Schema validators (Zod, Valibot, ArkType, etc.) to antithrow Results.
- [`@antithrow/eslint-plugin`](./packages/eslint-plugin) - ESLint rules for antithrow Result types.
