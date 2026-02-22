# Circular DevDependency Workaround

## When This Applies

**Only use this pattern when Turbo blocks a legitimate dev-time dependency due to cycle detection.**

Turbo treats all dependencies equally (prod + dev) when building its task graph. It rejects cycles even when they only exist via devDependencies - which aren't real cycles since devDeps don't ship.

See [turborepo#9253](https://github.com/vercel/turborepo/issues/9253) for the open feature request.

## The Pattern: `#kitz/<package>`

When package A needs package B for testing, but B depends on A (creating a Turbo-detected "cycle"):

### 1. Use `#kitz/<package>` subpath import (NOT the real package name)

```typescript
// ✅ CORRECT - Use #kitz/ prefix for circular devDep workaround
import { Assert } from '#kitz/assert'
import { Test } from '#kitz/test'

// ❌ WRONG - Would require actual devDep, blocked by Turbo
import { Test } from '@kitz/test'
```

### 2. Add tsconfig.json paths (IDE/dev-time resolution)

**Manually add** relative source paths to tsconfig.json:

```json
// packages/<your-pkg>/tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "#kitz/test": ["../test/src/_.ts"],
      "#kitz/test/test": ["../test/src/__.ts"],
      "#kitz/test/*": ["../test/src/*.ts"],
      "#kitz/assert": ["../assert/src/_.ts"],
      "#kitz/assert/assert": ["../assert/src/__.ts"],
      "#kitz/assert/*": ["../assert/src/*.ts"]
    }
  }
}
```

Note: Specific subpaths like `#kitz/test/test` must be listed **before** the wildcard patterns.

**IMPORTANT:** Do NOT add `#kitz/*` entries to package.json `imports`. The sync script preserves `#kitz/*` patterns in tsconfig but doesn't manage them - they must be manually maintained with relative source paths.

### 3. Root vitest.config.ts already has aliases (test runtime)

```typescript
// vitest.config.ts - these are shared across all packages
resolve: {
  alias: {
    '#kitz/test': path.resolve(__dirname, 'packages/test/src/_.ts'),
    '#kitz/assert': path.resolve(__dirname, 'packages/assert/src/_.ts'),
  },
},
```

### 4. Exclude test files from build (so runtime resolution is never needed)

```json
// packages/<your-pkg>/tsconfig.build.json
{
  "exclude": ["**/*.test.ts", "**/*.test-d.ts", "**/*.bench-d.ts"]
}
```

## Current Usages

| Package      | Needs                        | Creates Cycle?  | Uses Workaround              |
| ------------ | ---------------------------- | --------------- | ---------------------------- |
| `@kitz/core` | `@kitz/test`, `@kitz/assert` | ✅ Yes          | `#kitz/test`, `#kitz/assert` |
| `@kitz/sch`  | `@kitz/test`                 | ❌ No (diamond) | Real devDep works            |

## CRITICAL: When NOT to Use

**Do NOT use `#kitz/<pkg>` when a real devDep would work.** Most packages can use normal `@kitz/test` devDependencies because they create diamond patterns, not cycles:

```
@kitz/sch → @kitz/test → @kitz/core   ← Diamond (OK)
@kitz/sch → @kitz/core                ← Two paths, no cycle

@kitz/core → @kitz/test → @kitz/core  ← Cycle (needs workaround)
```

**Rule: Try adding the real devDep first. Only use `#kitz/<pkg>` if Turbo rejects it.**

## References

See [circular-devdep-workaround.refs.md](./circular-devdep-workaround.refs.md)
