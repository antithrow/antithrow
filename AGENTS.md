# antithrow

This is the monorepo repository for the `antithrow` ecosystem - a group of libraries based around bringing explicitly-typed errors to JavaScript, making it easier to ensure errors are tracked and handled.

## Commands

```sh
# Build all workspace packages (always run before linting)
bun run build

# Format code (always run to fix formatting issues)
bun run format

# Lint code (runs biome at root, then package lint pipelines)
bun run lint
```

## Testing

### Running Tests

```sh
# Run all tests across workspaces
bun test

# Run type tests
bun lint:types

# Run a single test
bun test packages/antithrow/src/result.test.ts

# Run tests with a specific pattern
bun test --test-name-pattern "pattern"
```

### Test Organization

Tests should be placed alongside their subjects where possible (e.g. `result.ts` and `result.test.ts`).

### Writing Tests

Tests are written using Bun's built-in Jest-compatible test runner (`bun:test`).

- Always use sematic matchers where possible (`expect(a).toHaveLength(2)` vs `expect(a.length).toBe(2)`)
- Use mock functions and associated matchers where useful.

## Architecture

A TypeScript monorepo centered around Rust-style `Result<T, E>` error handling utilities.

- `apps/docs` - Docusaurus-powered documentation website, hosted at `antithrow.dev`.
- `packages/antithrow` - Core `Result`, `ResultAsync`, and associated chaining/composition utilities.
- `packages/std` - Non-throwing wrappers around standard globals (`@antithrow/std`), using core `Result`/`ResultAsync` types.
- `packages/standard-schema` - Standard Schema bridge (`@antithrow/standard-schema`), wrapping validators (Zod, Valibot, ArkType, etc.) into `Result`/`ResultAsync`.
- `packages/eslint-plugin` - ESLint plugin (`@antithrow/eslint-plugin`) with rules for enforcing correct Result usage.

## Code Style
- **Formatter**: Biome with tabs, double quotes (use 2-space indentation in `.md` files)
- **Imports**: Use `.js` extension for local imports (ESM); organize imports automatically
- **Types**: Strict TypeScript (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `strict`)
- **Naming**: `camelCase` for functions/variables, `PascalCase` for classes/types
- **Errors**: Return `Result<T, E>` instead of throwing; use `Result.try()` to wrap throwing functions
- **Unused params**: Prefix with underscore (e.g., `_defaultValue`)
- **Docs**: Use JSDoc with `@example` blocks for public API

## Important Development Notes

1. **All changes must be tested** - If you haven't created tests for your changes, you're not done.
2. **Get your tests to pass** - If you didn't run the tests, your code doesn't work.
3. **Follow existing code style** - check neighboring files for patterns
4. **Use absolute paths** - Always use absolute paths in file operations
