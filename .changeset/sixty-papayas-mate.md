---
"antithrow": major
---

feat!: replace 6 sync-to-async bridge methods with `toAsync()`

Removed `mapAsync`, `mapErrAsync`, `andThenAsync`, `orElseAsync`, `inspectAsync`, and `inspectErrAsync` from `Result`. Use `toAsync()` to convert to `ResultAsync`, then chain normally:

```ts
// Before
ok(2).mapAsync(async (x) => x * 2);
ok(2).andThenAsync(async (x) => ok(x * 2));
err("oops").orElseAsync(async (e) => ok(0));

// After
ok(2).toAsync().map(async (x) => x * 2);
ok(2).toAsync().andThen(async (x) => ok(x * 2));
err("oops").toAsync().orElse(async (e) => ok(0));
```
