---
"antithrow": major
---

feat!: remove redundant `ResultAsync.fromResult` method

Use `toAsync()` to convert a `Result` to a `ResultAsync`:

```ts
// Before
ResultAsync.fromResult(ok(1)).map(async (x) => x * 2);

// After
ok(1).toAsync().map(async (x) => x * 2);
```
