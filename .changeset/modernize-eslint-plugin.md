---
"@antithrow/eslint-plugin": major
---

deps!: target modern `Result`/`Settled` APIs instead of `Result`/`ResultAsync`

Rules now analyze values typed against the modern `antithrow` entrypoint (`Ok`, `Err`, `Pending`). Values from `antithrow/legacy` are no longer flagged.

`no-unsafe-unwrap` no longer reports `.expect()` and `.expectErr()`, since the modern API does not expose those methods. It now also reports `.unwrap()` / `.unwrapErr()` on `Pending`, where they return a promise that may reject rather than a value.
