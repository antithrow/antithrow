---
title: Suppress and refactor safely
description: Use the rule's suggestions as a starting point without papering over real problems.
---

# Suppress and refactor safely

The three `@antithrow/*` rules report different problems, and their "easy suppression" is the wrong answer each time. Here is the right one.

## `no-unsafe-unwrap` — don't silence, split

When you see the rule fire on `.unwrap()`:

```ts
const config = readConfig().unwrap(); // reports unsafeUnwrap
```

Don't disable it. Branch:

```ts
const result = readConfig();
if (result.isErr()) return exitWithError(result.error);
const config = result.value;
```

The rule auto-fixes `.unwrap()` / `.unwrapErr()` to `.value` / `.error` **only** when the type is statically `Ok` / `Err`. If the fix didn't apply, the rule couldn't prove safety — handle the failure yourself.

## `no-unused-result` — don't `void`, handle

The suggestion to prepend `void` exists for the rare case where you legitimately want to fire-and-forget:

```ts
void logAsync(payload); // ok — we don't wait, we don't care about failure
```

But most hits are genuinely missing handling. Prefer:

```ts
const logged = await logAsync(payload);
if (logged.isErr()) metrics.increment("log_failure");
```

Use `void` only when you would never have read the return value even with exceptions.

## `no-throwing-call` — replace, don't disable

See [Enforce `no-throwing-call`](./enforce-no-throwing-call.md). The intended fix is a different import.

## Refactor order

When opting a legacy file in:

1. Turn the rules on at `warn`.
2. Fix `no-throwing-call` first (import swap, zero control-flow change).
3. Fix `no-unsafe-unwrap` by branching — this is the real work.
4. Fix `no-unused-result` last — often the other two surface the real handler and the unused warnings vanish naturally.
5. Upgrade the rules to `error`.

## See also

- Reference: [`no-throwing-call`](../../reference/eslint-plugin/no-throwing-call.md) · [`no-unsafe-unwrap`](../../reference/eslint-plugin/no-unsafe-unwrap.md) · [`no-unused-result`](../../reference/eslint-plugin/no-unused-result.md)
- How-to: [Migrate from throwing code](../core/migrate-from-throwing-code.md)
