---
title: Set up the project
description: Create a new TypeScript project and install the antithrow packages you will use throughout the tutorial.
sidebar_position: 1
---

# Set up the project

In this tutorial you will build a small program that fetches a remote JSON configuration file and validates it. Along the way you will meet every core part of antithrow.

Let's set up a project to work in.

## Create a project

Create a new directory and initialise a `package.json`.

```bash
mkdir config-loader
cd config-loader
npm init -y
```

Enable TypeScript in strict mode. Create a `tsconfig.json`:

```json title="tsconfig.json"
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

## Install antithrow

Install the packages you will use in this tutorial.

```bash npm2yarn
npm install antithrow @antithrow/std @antithrow/standard-schema zod
```

- `antithrow` — the core `Ok`, `Err`, `Pending`, and `Result` types.
- `@antithrow/std` — non-throwing wrappers around standard globals like `fetch`.
- `@antithrow/standard-schema` — wires any Standard Schema validator (like Zod) into a `Result`.
- `zod` — the validator we will use in the final step.

## Create the entry file

Create a single TypeScript file you will edit for the rest of the tutorial.

```ts title="src/index.ts"
console.log("ready");
```

Run it once to confirm everything is wired up.

```bash
npx tsx src/index.ts
```

You should see `ready` printed to the terminal. You are ready to write your first `Result`.
