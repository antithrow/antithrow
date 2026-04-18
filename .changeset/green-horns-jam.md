---
"antithrow": major
---

feat!: replace the main `antithrow` entrypoint with the tri-state API

The top-level `antithrow` package now exports the new tri-state `Result` model:

- `Result<T, E>` is now `Ok | Err | Pending`
- async flows are represented by `Pending` instead of `ResultAsync`
- `Result.do(...)` replaces `chain(...)` for fail-fast generator composition
- the main entrypoint exports `Ok`, `Err`, `Pending`, `Result`, `UnwrapError`, and helper types like `InferOk`, `InferErr`, and `Settled`

This is a breaking change for existing users of the previous API:

- `ok`, `err`, `okAsync`, `errAsync`, `ResultAsync`, and `chain` are no longer exported from `antithrow`
- existing code using the previous API should migrate to the new constructors and tri-state flow, or temporarily switch imports to `antithrow/legacy`

To ease migration, the previous API is still available from the new `antithrow/legacy` subpath and is marked as deprecated.
