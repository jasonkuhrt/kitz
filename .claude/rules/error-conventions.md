---
paths: "packages/**/*"
---

# Error Conventions

## Defining Errors

All kitz packages MUST use `Err.TaggedContextualError` from `@kitz/core` for error definitions.

### Structure

```typescript
// In errors.ts
import { Err } from '@kitz/core'
import { Schema as S } from 'effect'

const baseTags = ['kit', 'mypackage'] as const

/**
 * JSDoc description of the error.
 */
export const MyError = Err.TaggedContextualError('MyPackageMyError', baseTags, {
  context: S.Struct({
    /** Field documentation */
    path: S.String,
    /** Field documentation */
    detail: S.String,
  }),
  message: (ctx) => `Failed at ${ctx.path}: ${ctx.detail}`,
})

export type MyError = InstanceType<typeof MyError>

/** Union of all errors from this package */
export type All = MyError | OtherError
```

### Construction

```typescript
// ✅ CORRECT - use context object
new MyError({
  context: {
    path: '/some/path',
    detail: 'something went wrong',
  },
})

// ❌ WRONG - don't use plain Error
throw new Error('something went wrong')

// ❌ WRONG - don't construct without context
new MyError({ message: 'something went wrong' })
```

## Exporting Errors

Every kitz package that exposes error types MUST export an `Errors` namespace.

### Structure

```typescript
// In package entry (_.ts or __.ts)
export * as Errors from './errors.js'

// In errors.ts
export { BazError } from './another-module.js'
export { BarError, FooError } from './some-module.js'

/** Union of all errors from this package */
export type All = FooError | BarError | BazError
```

### Usage

Consumers access errors consistently:

```typescript
import { Pkg } from '@kitz/pkg'

// Access individual errors
type E = Pkg.Errors.FooError

// Access all errors union
type AllErrors = Pkg.Errors.All
```

### Why This Pattern

1. **Discoverability**: `<Pkg>.Errors.` triggers autocomplete showing all available errors
2. **Consistency**: Same pattern across all packages - no guessing
3. **Structured context**: Schema-validated context enables programmatic error handling
4. **Aggregation**: `Errors.All` provides convenient union of all package errors

## Implementation Checklist

When adding errors to a package:

1. Create `src/errors.ts` (or add to existing)
2. Import `Err` from `@kitz/core`
3. Define errors with `Err.TaggedContextualError`
4. Export individual error classes and types
5. Export `type All = ...` union of all errors
6. Add `export * as Errors from './errors.js'` to package entry
