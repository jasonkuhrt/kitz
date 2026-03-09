# Conf.File Implementation Plan

Implementation plan for the Conf.File design at `docs/plans/2026-01-02-conf-file-design.md`.

## Phase 1: Sch.Struct.hasRequiredFields

Add utility to `@kitz/sch` for detecting if a struct schema has required fields.

### 1.1 Add to `packages/sch/src/struct.ts`

```typescript
/**
 * Check if a struct schema has any required fields.
 *
 * A field is required if:
 * 1. Not a PropertySignature (plain Schema.String, etc.)
 * 2. PropertySignatureDeclaration with isOptional=false and no default
 * 3. PropertySignatureTransformation without default on the "from" side
 *
 * A field is optional if:
 * - PropertySignature with isOptional=true
 * - Has a default value (optionalWith with default)
 * - Wrapped in Schema.Option
 */
export const hasRequiredFields = (schema: S.Schema.AnyNoContext): boolean
```

### 1.2 Add type-level utility

```typescript
/**
 * Type-level check if struct schema has required fields.
 */
export type HasRequiredFields<S extends Schema.Schema.AnyNoContext> = ...
```

### 1.3 Detection logic

Iterate `ast.propertySignatures` from TypeLiteral AST:

- Check each property signature's `isOptional` flag
- Check for default via PropertySignatureTransformation decode function

## Phase 2: Conf.File Module Structure

### 2.1 Create file structure

```
packages/conf/src/
├── file/
│   ├── __.ts           # barrel: export * from './define.js'; export * from './load.js'; ...
│   ├── define.ts       # define() function, ConfigDefinition type
│   ├── load.ts         # load() function
│   ├── define-config.ts # createDefineConfig() function
│   └── errors.ts       # Error slices (NotFoundError, InvalidExportError + hints)
├── __.ts               # add: export * as File from './file/__.js'
└── _.ts                # public API (unchanged)
```

### 2.2 Update dependencies in package.json

```json
{
  "dependencies": {
    "@kitz/core": "workspace:*",
    "@kitz/fs": "workspace:*",
    "@kitz/mod": "workspace:*",
    "@kitz/sch": "workspace:*",
    "@effect/platform": "*",
    "effect": "*",
    "type-fest": "*"
  }
}
```

## Phase 3: Implement Conf.File.define

### 3.1 DefineOptions interface

```typescript
interface DefineOptions<S extends Schema.Schema.AnyNoContext> {
  name: string
  schema: S
  extensions?: string[]
  json?: boolean | string | string[]
  packageJson?: boolean | string | string[]
  importFn?: (url: string) => Promise<unknown>
}
```

### 3.2 ConfigDefinition type

```typescript
interface ConfigDefinition<S extends Schema.Schema.AnyNoContext> {
  readonly name: string
  readonly schema: S
  readonly extensions: string[]
  readonly json: string[]
  readonly packageJson: string[]
  readonly importFn?: (url: string) => Promise<unknown>
  /** Whether file is required (schema has required fields) */
  readonly required: boolean
}
```

### 3.3 define() function

Resolves shorthand options:

- `json: true` → `[`${name}.config.json`]`
- `packageJson: true` → `[name]`
- Computes `required` from schema via `Sch.Struct.hasRequiredFields`

## Phase 4: Implement Conf.File.load

### 4.1 Search order

1. TS/JS files: `{name}.config.{ts,js,mjs,mts}` in order
2. JSON files (if enabled)
3. package.json field (if enabled)

### 4.2 Loading logic

```typescript
export const load = <S extends Schema.Schema.AnyNoContext>(
  definition: ConfigDefinition<S>,
  cwd?: string
): Effect<Schema.Schema.Type<S>, Error, FileSystem.FileSystem>
```

- Use `Mod.importDefault` for TS/JS files
- Use `Fs.readJson` for JSON files
- Use `Fs.readJson` + field access for package.json
- Validate with `Schema.decode(definition.schema)`
- If file not found and `definition.required`, fail with NotFoundError
- If file not found and not required, decode `{}`

### 4.3 Conditional error type

Use overloads or conditional return type to exclude NotFoundError when schema has no required fields:

```typescript
// When required=true in definition
load(def) → Effect<Type, NotFoundError | ParseError | ImportError, FileSystem>

// When required=false in definition
load(def) → Effect<Type, ParseError | ImportError, FileSystem>
```

## Phase 5: Implement Errors

### 5.1 NotFound slice

```typescript
// Error
export const NotFoundError = Err.TaggedContextualError(...)

// Hint generator
export const notFoundHint = (error: NotFoundError): string => { ... }
```

### 5.2 InvalidExport slice

```typescript
// Error
export const InvalidExportError = Err.TaggedContextualError(...)

// Hint generator
export const invalidExportHint = (error: InvalidExportError): string => { ... }
```

## Phase 6: Implement createDefineConfig

### 6.1 Function signature

```typescript
export const createDefineConfig = <S extends Schema.Schema.AnyNoContext>(
  definition: ConfigDefinition<S>
): (config: Partial<Schema.Schema.Type<S>>) => Schema.Schema.Type<S>
```

### 6.2 Implementation

Simply wraps `Schema.decode` or `Schema.make` depending on schema type.

## Phase 7: Update @kitz/release

### 7.1 Update packages/release/src/api/config.ts

```typescript
import { Conf } from '@kitz/conf'

// Schema (unchanged)
export class ReleaseConfigSchema extends Schema.Class...

// Use Conf.File.define
export const ReleaseConfig = Conf.File.define({
  name: 'release',
  schema: ReleaseConfigSchema,
  json: true,
  packageJson: true,
})

// Export typed helper
export const defineConfig = Conf.File.createDefineConfig(ReleaseConfig)

// Update load to use Conf.File.load
export const load = Conf.File.load(ReleaseConfig)
```

### 7.2 Update CLI commands

Replace manual config loading with `Conf.File.load(ReleaseConfig)`.

## Testing Strategy

### Unit tests

1. `Sch.Struct.hasRequiredFields`
   - Schema with all optional fields → false
   - Schema with required field → true
   - Schema with optionalWith default → false
   - Schema.Class variants

2. `Conf.File.define`
   - Boolean shorthands resolve correctly
   - Array options preserved
   - Required computed from schema

3. `Conf.File.load`
   - Loads TS config
   - Loads JSON config
   - Loads package.json field
   - Falls back to defaults when optional
   - Errors when required file missing
   - Validates schema

## Implementation Order

1. `Sch.Struct.hasRequiredFields` (runtime + type)
2. `Conf.File.define` + types
3. `Conf.File.errors` (NotFoundError, InvalidExportError + hints)
4. `Conf.File.load`
5. `Conf.File.createDefineConfig`
6. Tests
7. Update `@kitz/release`
