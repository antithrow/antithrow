# AGENTS.md

## Commands

### Essentials

```sh
# Initial setup (sets up git, bun, and installs dependencies)
bun install

# Build the library (always run before linting)
bun run build

# Format code
bun run format

# Lint code (runs biome, publint, and tsc)
bun run lint
```

### Testing

```sh
# Run all tests
bun test

# Run a single test
bun test src/result.test.ts

# Run tests with a specific pattern
bun test --test-name-pattern "pattern"
```

## Architecture
A TypeScript library implementing Rust-style `Result<T, E>` types for error handling without exceptions.
- `src/result.ts` - Core `Ok`, `Err` classes and `Result` type
- `src/result-async.ts` - Async result utilities
- `src/chain.ts` - Chaining/composition utilities
- Tests use Bun's built-in test runner (`bun:test`)

## Code Style
- **Formatter**: Biome with tabs, double quotes
- **Imports**: Use `.js` extension for local imports (ESM); organize imports automatically
- **Types**: Strict TypeScript (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `strict`)
- **Naming**: `camelCase` for functions/variables, `PascalCase` for classes/types
- **Errors**: Return `Result<T, E>` instead of throwing; use `Result.try()` to wrap throwing functions
- **Unused params**: Prefix with underscore (e.g., `_defaultValue`)
- **Docs**: Use JSDoc with `@example` blocks for public API
