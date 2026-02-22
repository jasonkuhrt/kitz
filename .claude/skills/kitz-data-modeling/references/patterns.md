# Common Patterns

## Class Field Reuse

Use `Class.fields` to compose schemas with shared structure:

```typescript
// Base class - single source of truth for common fields
export class Commit extends Schema.TaggedClass<Commit>()('Commit', {
  hash: Sha,
  message: Schema.String,
  author: Author,
  date: Schema.Date,
}) {}

// Factory that reuses fields, replaces one field type
export const ParsedCommit =
  <Self = never>(identifier?: string) =>
  <Tag extends string, P extends Schema.Schema.Any>(
    tag: Tag,
    parsedSchema: P,
  ) =>
    Schema.TaggedClass<Self>(identifier)(tag, {
      ...Commit.fields, // Spread base fields
      message: parsedSchema, // Override with different schema
    }) as any

// Usage
class ReleaseCommit extends ParsedCommit<ReleaseCommit>()(
  'ReleaseCommit',
  ConventionalCommits.Commit.Commit,
) {}

commit.message // ← Now the parsed type, not string
```

**Key points:**

- `Class.fields` exposes field definitions as a spreadable object
- JS spread semantics: later keys override earlier ones
- Keeps base class as single source of truth
- Use `Omit<>` in types to properly type the override

## Module Architecture

Two patterns for organizing Schema types. **Pick one per module—don't mix.**

| Pattern         | Structure                                  | When to Use                                              |
| --------------- | ------------------------------------------ | -------------------------------------------------------- |
| Class-is-Module | Class IS the namespace, all API as statics | One dominant type, supporting types are internal details |
| ESM Module      | Class + module-level exports               | Multiple public types, or tree-shaking matters           |

### Trade-offs

| Dimension        | Class-is-Module       | ESM Module                   |
| ---------------- | --------------------- | ---------------------------- |
| Type/value name  | Free (class = both)   | Manual `export type X = ...` |
| Access pattern   | `Gitignore.Entry`     | `Entry` (top-level)          |
| File convention  | No `_/__.ts` needed   | Needs `_/__.ts` barrels      |
| Tree-shaking     | Statics not shakeable | Module functions shakeable   |
| Supporting types | Nest as statics       | Top-level exports            |

### Class-is-Module Example

```typescript
import { Schema as S } from 'effect'

export class Version extends S.Class<Version>()('Version', {
  major: S.Number,
  minor: S.Number,
  patch: S.Number,
}) {
  static is = S.is(Version)
  static Schema: S.Schema<Version, string> = S.transform(S.String, Version, { ... })
  static fromString = S.decodeSync(Version.Schema)
  static toString = S.encodeSync(Version.Schema)

  override toString(): string {
    return Version.toString(this)
  }
}

// Usage
import * as Version from './version.js'
const v = Version.fromString('1.2.3')
```

### ESM Module Example

```typescript
import { Schema as S } from 'effect'

export class Gitignore extends S.Class<Gitignore>()('Gitignore', {
  sections: S.Array(Section),
}) {
  override toString(): string {
    return toString(this)
  }
}

export const Schema: S.Schema<Gitignore, string> = S.transform(...)
export const fromString = S.decodeSync(Schema)
export const toString = S.encodeSync(Schema)
export const addPattern = (g: Gitignore, pattern: string) => ...

// Usage
import * as Gitignore from './gitignore.js'
const g = Gitignore.fromString(content)
```

### Why Not Mix?

Mixing creates awkward access patterns:

- `Gitignore.fromString` (module-level)
- `Gitignore.Gitignore.is` (class static) ← ugly nesting

**Decision rule:**

- If ALL API can be class statics → Class-is-Module
- If ANY API needs module-level export → ESM Module (put everything at module level)

### Supporting Types

Supporting types don't require ESM Module. If they're internal implementation details, nest as statics:

```typescript
export class Gitignore extends S.Class<Gitignore>('Gitignore')({...}) {
  static Entry = Entry      // Internal
  static Section = Section  // Internal
  static Schema = ...       // String codec
  static fromString = ...   // Convenience
}

Gitignore.fromString(content)  // Main API
Gitignore.Entry                // Available if needed
```

## Handler Syntax Rules

For Match.tagsExhaustive handlers:

1. **Arrow functions** - only for implicit returns (single expression)
2. **Method syntax** - when block is needed (void, multi-statement)
3. **Never mix styles** - if any needs method syntax, all use method syntax

```typescript
// All implicit returns - arrow syntax
Match.tagsExhaustive({
  Started: (e) => `Started: ${e.name}`,
  Completed: (e) => `Done: ${e.name}`,
})

// Void handlers - method syntax
Match.tagsExhaustive({
  Started(e) {
    doSomething(e)
  },
  Completed(e) {
    doOther(e)
  },
})
```

## JSON Parsing

Use `Schema.parseJson()` instead of raw `JSON.parse()`:

```typescript
const PackageJson = Schema.parseJson(Schema.Struct({
  name: Schema.String,
  version: Schema.String,
}))

const pkg = yield * Schema.decodeUnknown(PackageJson)(jsonString)
```

## Non-Tagged Unions

Use `Match.when` with predicates:

```typescript
Match.type<string | number>().pipe(
  Match.when(Match.number, (n) => `number: ${n}`),
  Match.when(Match.string, (s) => `string: ${s}`),
  Match.exhaustive,
)
```

## Multiple Lookup Tables

```typescript
const stateFromTag = {
  Started: 'running',
  Completed: 'completed',
  Failed: 'failed',
} as const satisfies Record<Event['_tag'], State>

const iconFromTag = {
  Started: '...',
  Completed: '...',
  Failed: '...',
} as const satisfies Record<Event['_tag'], string>
```
