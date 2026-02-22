# Conf.File - File-Based Config Loading

## Overview

Add file-based TypeScript/JSON config loading to `@kitz/conf` with deep Effect Schema integration. File optionality is inferred from schema structure.

## Motivation

The pattern of loading `*.config.ts` files (like Vite, Vitest, ESLint) is common. Currently `@kitz/release` implements this manually. Extract to reusable abstraction in `@kitz/conf`.

## API

### Defining Config

Library authors define their config once:

```typescript
import { Conf } from '@kitz/conf'
import { Schema } from 'effect'

// Schema definition
class ReleaseConfigSchema extends Schema.Class('ReleaseConfig')({
  trunk: Schema.optionalWith(Schema.String, { default: () => 'main' }),
  npmTag: Schema.optionalWith(Schema.String, { default: () => 'latest' }),
}) {}

// Config definition - single source of truth
const ReleaseConfig = Conf.File.define({
  name: 'release',
  schema: ReleaseConfigSchema,
  json: true,
  packageJson: 'release',
})
```

### Define Options

```typescript
interface DefineOptions<S extends Schema.Schema.AnyNoContext> {
  /** Config file base name. E.g. 'release' → 'release.config.*' */
  name: string

  /** Effect Schema for validation. Determines file optionality. */
  schema: S

  /** TS/JS extensions to search. @default ['ts', 'js', 'mjs', 'mts'] */
  extensions?: string[]

  /**
   * JSON file names to search.
   * - false: disabled (default)
   * - true: [`${name}.config.json`]
   * - string: [value]
   * - string[]: values
   */
  json?: boolean | string | string[]

  /**
   * package.json field names to check.
   * Must not conflict with known manifest fields.
   * - false: disabled (default)
   * - true: use `name` as field name
   * - string: use specified field name
   * - string[]: check multiple fields (first found wins, useful for deprecation)
   * @default false (disabled)
   */
  packageJson?: boolean | string | string[]

  /** Custom import function (for Vite SSR, etc). */
  importFn?: (url: string) => Promise<unknown>
}
```

### Config Definition Object

`Conf.File.define()` returns a typed definition (data only, no methods):

```typescript
interface ConfigDefinition<S extends Schema.Schema.AnyNoContext> {
  /** The config name */
  readonly name: string

  /** The schema */
  readonly schema: S

  /** All resolved options */
  readonly extensions: string[]
  readonly json: string[] // resolved file names
  readonly packageJson: string[] // resolved field names
  readonly importFn?: (url: string) => Promise<unknown>
}
```

### Loading Config

```typescript
// Pass definition to load()
const config = yield * Conf.File.load(ReleaseConfig)

// With custom cwd
const config = yield * Conf.File.load(ReleaseConfig, '/path/to/project')
```

### Creating defineConfig Helper

```typescript
// Pass definition to createDefineConfig()
export const defineConfig = Conf.File.createDefineConfig(ReleaseConfig)
```

### Search Order

1. `{name}.config.ts` / `.js` / `.mjs` / `.mts`
2. JSON files (if enabled)
3. `package.json` field (if enabled)

### Typed defineConfig Helper

Library authors export the helper for their users:

```typescript
// In @kitz/release (library)
export const defineConfig = ReleaseConfig.defineConfig

// User's release.config.ts
import { defineConfig } from '@kitz/release'

export default defineConfig({
  trunk: 'develop', // typed
  typo: 'oops', // TypeScript error
})
```

## Schema-Driven File Optionality

The schema determines whether the config file is required:

- **All fields optional** (have defaults) → file optional, decode `{}` if missing
- **Any required field** → file required, error if missing

```typescript
// File OPTIONAL - all fields have defaults
class Config extends Schema.Class('Config')({
  port: Schema.optionalWith(Schema.Number, { default: () => 3000 }),
}) {}

// File REQUIRED - has required field
class Config extends Schema.Class('Config')({
  apiKey: Schema.String, // required!
}) {}
```

### Type-Level Adaptation

```typescript
type LoadResult<S> = Sch.Struct.HasRequiredFields<S> extends true ? Effect<
    Schema.Schema.Type<S>,
    Error | NotFoundError | ParseError,
    FileSystem
  >
  : Effect<Schema.Schema.Type<S>, Error | ParseError, FileSystem>
```

## Errors

Using `@kitz/core` Err pattern with **slice pattern** for colocating error + check + hint:

```typescript
const baseTags = ['conf'] as const

// ============================================
// NotFound Slice
// ============================================

/** Config file not found when schema requires it */
export const NotFoundError = Err.TaggedContextualError(
  'KitConfFileNotFoundError',
  baseTags,
).constrain<{
  name: string
  searchedPaths: Fs.Path.AbsFile[]
  /** Resolved config definition for hint generation */
  definition: ConfigDefinition<any>
}>({
  message: (ctx) => `Config '${ctx.name}' not found`,
})
export type NotFoundError = InstanceType<typeof NotFoundError>

/** Generate hint showing valid config locations */
export const notFoundHint = (error: NotFoundError): string => {
  const { name, searchedPaths, definition } = error.context
  const lines = [`Config '${name}' not found.`, '', 'Valid locations:']

  // TS/JS files
  for (const ext of definition.extensions) {
    lines.push(`  - ${name}.config.${ext}`)
  }
  // JSON files
  for (const jsonFile of definition.json) {
    lines.push(`  - ${jsonFile}`)
  }
  // package.json fields
  for (const field of definition.packageJson) {
    lines.push(`  - package.json "${field}" field`)
  }

  lines.push('', 'Searched:')
  for (const path of searchedPaths) {
    lines.push(`  - ${Fs.Path.toString(path)}`)
  }

  return lines.join('\n')
}

// ============================================
// InvalidExport Slice
// ============================================

/** Default export missing or invalid */
export const InvalidExportError = Err.TaggedContextualError(
  'KitConfFileInvalidExportError',
  baseTags,
).constrain<{
  path: Fs.Path.AbsFile
  actualExport: unknown
}>({
  message: (ctx) => `Invalid default export: ${Fs.Path.toString(ctx.path)}`,
})
export type InvalidExportError = InstanceType<typeof InvalidExportError>

/** Generate hint for invalid export errors */
export const invalidExportHint = (error: InvalidExportError): string => {
  const { path, actualExport } = error.context
  const exportType = actualExport === undefined
    ? 'undefined (missing)'
    : typeof actualExport
  return `Expected default export to be a config object, got ${exportType}.\n\nExample:\n  export default defineConfig({ ... })`
}

// ============================================
// Error Union
// ============================================

/** Union - Mod.ImportError bubbled up directly */
export type Error = NotFoundError | Mod.ImportError | InvalidExportError
```

### Slice Pattern Benefits

Each error slice colocates:

1. **Error class** - The typed error definition
2. **Hint function** - Generates contextual help message

This pattern:

- Keeps related code together for easier reasoning
- Hint functions have access to full error context including the config definition
- No need for static methods on error classes
- Easy to extend with additional slices (e.g., validation errors)

## New Utility: Sch.Struct.hasRequiredFields

Add to `@kitz/sch`:

```typescript
// Runtime
export const hasRequiredFields = (schema: Schema.Schema.AnyNoContext): boolean

// Type-level
export type HasRequiredFields<S extends Schema.Schema.AnyNoContext> = ...
```

Must detect:

1. `PropertySignature.isOptional === false` without default
2. Fields not wrapped in `Schema.optional` / `Schema.optionalWith`
3. Fields without `{ default: ... }` option
4. Union with undefined
5. `Schema.Option<T>` wrapper

## File Structure

```
packages/conf/
├── src/
│   ├── configurator.ts      # existing (unchanged)
│   ├── file/
│   │   ├── __.ts            # barrel export
│   │   ├── load.ts          # load(), createDefineConfig()
│   │   └── errors.ts        # error classes
│   ├── __.ts                # add: export * as File from './file/__.js'
│   └── _.ts                 # public API
└── package.json
```

## Dependencies

Add to `@kitz/conf`:

- `effect`
- `@effect/platform`
- `@kitz/mod`
- `@kitz/fs`
- `@kitz/sch`

## Follow-up Items

1. **Mutation API** - Allow `configure({...})` without export, using AsyncLocalStorage scoping
2. **Tags semantic review** - Review `@kitz/core` Err tags to clarify path vs set semantic
3. **package.json field validation** - Type-level guard against known manifest fields

## Usage Example

```typescript
// packages/release/src/api/config.ts
import { Conf } from '@kitz/conf'
import { Schema } from 'effect'

// Schema
class ReleaseConfigSchema extends Schema.Class('ReleaseConfig')({
  trunk: Schema.optionalWith(Schema.String, { default: () => 'main' }),
  npmTag: Schema.optionalWith(Schema.String, { default: () => 'latest' }),
  previewTag: Schema.optionalWith(Schema.String, { default: () => 'next' }),
  skipNpm: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  packages: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.String }),
    { default: () => ({}) },
  ),
}) {}

// Config definition - single source of truth
export const ReleaseConfig = Conf.File.define({
  name: 'release',
  schema: ReleaseConfigSchema,
  json: true,
  packageJson: true,
})

// Export typed helper for users
export const defineConfig = Conf.File.createDefineConfig(ReleaseConfig)

// Type alias for the config type
export type ReleaseConfig = typeof ReleaseConfigSchema.Type
```

```typescript
// packages/release/src/cli/commands/status.ts
import { Conf } from '@kitz/conf'
import { ReleaseConfig } from '../../api/config.js'

const program = Effect.gen(function*() {
  const config = yield* Conf.File.load(ReleaseConfig)
  // config is typed as ReleaseConfig
})
```
