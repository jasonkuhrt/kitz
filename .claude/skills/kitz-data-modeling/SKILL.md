---
name: kitz-data-modeling
description: This skill should be used when the user asks to "create a domain type", "define a schema", "use TaggedClass", "create a discriminated union", "add pattern matching", "use Match.tagsExhaustive", "create a type guard", "add Schema.is", "map tags to values", "create a lookup table", or mentions Effect Schema, tagged classes, or union handling.
---

# Data Modeling

Patterns for domain types using Effect Schema, pattern matching, and lookup tables.

## Effect Schema

### Construction

**Always use `.make()` instead of `new`:**

```typescript
Standard.make({ value: 'feat' }) // Correct - validates
new Standard({ value: 'feat' }) // Wrong - bypasses validation
```

**`.make()` returns full class instances** with getters and methods:

```typescript
class Gitignore extends Schema.Class<Gitignore>('Gitignore')({
  sections: Schema.Array(Section),
}) {
  get patterns() { return this.sections.flatMap(...) }
}

const g = Gitignore.make({ sections: [] })
g.patterns  // Works - getter available
```

### TaggedClass Pattern

```typescript
import { Schema } from 'effect'

export class MyType extends Schema.TaggedClass<MyType>()('MyType', {
  field1: Schema.String,
  field2: Schema.Number,
}) {
  static is = Schema.is(MyType)
  static fromX = (...) => MyType.make({ ... })
}
```

### Type Guards

**Use `Schema.is()` for predicates, never check `_tag` directly:**

```typescript
if (Standard.is(value)) { ... }  // Correct
if (value._tag === 'Standard') { ... }  // Wrong
```

**For unions, export `is` at module level:**

```typescript
export const is = Schema.is(Severity)
```

### Schema.Enums

**Use `as const` for literal types:**

```typescript
export const StandardValue = Schema.Enums(
  {
    feat: 'feat',
    fix: 'fix',
    docs: 'docs',
  } as const,
)

StandardValue.enums.feat // 'feat'
```

**CRITICAL**: Without `as const`, values are `string` not literals. This breaks lookup tables.

### Union Conventions

**Tag naming - Use Base+Member:**

```typescript
class Success extends Schema.TaggedClass<Success>()('ResultSuccess', {}) {}
class Failure extends Schema.TaggedClass<Failure>()('ResultFailure', {}) {}
```

**File organization - File names match tag names:**

```
models/
├── item.ts            → Item = Stable | Preview | Pr (union type)
├── item-stable.ts     → class Stable (tagged 'Stable')
├── item-preview.ts    → class Preview (tagged 'Preview')
└── item-pr.ts         → class Pr (tagged 'Pr')
```

### String Codecs

**Pattern: `Schema` static + `fromString`/`toString` convenience wrappers.**

```typescript
import { Schema as S } from 'effect'

export class MyType extends S.Class<MyType>('MyType')({
  value: S.String,
}) {
  static Schema: S.Schema<MyType, string> = S.transform(
    S.String,
    MyType,
    { strict: true, decode: parse, encode: stringify },
  )

  static fromString = S.decodeSync(MyType.Schema)
  static override toString = S.encodeSync(MyType.Schema)

  override toString(): string {
    return this.value
  }
}
```

**Key points:**

- `Schema` = transform codec for Effect integration
- `fromString`/`toString` = convenience wrappers
- Use `import { Schema as S }` to avoid naming collision
- **Use `static override toString`** - base class has a static toString, must use override
- Instance `override toString()` is separate from static `override toString`

### Module Architecture

Two patterns for organizing Schema types. **Pick one per module—don't mix.**

| Situation                        | Pattern         | Example                        |
| -------------------------------- | --------------- | ------------------------------ |
| One dominant type, simple API    | Class-is-Module | All API as class statics       |
| Multiple public types, functions | ESM Module      | Class + module-level exports   |
| Tree-shaking needed              | ESM Module      | Module functions are shakeable |

**Decision rule:** If ALL API can be class statics → Class-is-Module. Otherwise → ESM Module.

**CRITICAL**: Never mix patterns. See `references/patterns.md` for full examples and trade-offs.

## Pattern Matching

### Match.tagsExhaustive

**For discriminated unions with `_tag`:**

```typescript
import { Match } from 'effect'

const handleEvent = (event: Event): string =>
  Match.value(event).pipe(
    Match.tagsExhaustive({
      Started: (e) => `Starting: ${e.activity}`,
      Completed: (e) => `Done: ${e.activity}`,
      Failed: (e) => `Error: ${e.error}`,
    }),
  )
```

**Handler syntax rules:**

- Arrow functions for implicit returns (single expression)
- Method syntax when block is needed (void, multi-statement)
- Never mix styles in same handler object

See `references/patterns.md` for examples and non-tagged union handling.

## Lookup Tables

### When to Use

| Approach             | Use When                              |
| -------------------- | ------------------------------------- |
| Lookup table         | Direct tag-to-value mapping, no logic |
| Match.tagsExhaustive | Need event data, complex logic        |

### Pattern

```typescript
type Event =
  | { readonly _tag: 'Started' }
  | { readonly _tag: 'Completed' }
  | { readonly _tag: 'Failed' }

type State = 'running' | 'completed' | 'failed'

const stateFromTag = {
  Started: 'running',
  Completed: 'completed',
  Failed: 'failed',
} as const satisfies Record<Event['_tag'], State>

const stateFromEvent = (event: Event): State => stateFromTag[event._tag]
```

### Key Elements

| Element                         | Purpose                        |
| ------------------------------- | ------------------------------ |
| `as const`                      | Preserves literal types        |
| `satisfies Record<Key, Value>`  | Ensures exhaustiveness         |
| `Record<Union['_tag'], Result>` | Key from union, value explicit |

## Smart Constructors

**Export at module level for unions with type narrowing:**

```typescript
type FromString<$value extends string> = $value extends StandardValue ? Standard
  : Custom

export const fromString = <$value extends string>(
  value: $value,
): FromString<$value> => {
  if (value in StandardValue.enums) {
    return Standard.make({ value: value as StandardValue }) as any
  }
  return Custom.make({ value }) as any
}

fromString('feat') // Standard (inferred)
fromString('custom') // Custom (inferred)
```

## Decision Tree

```
Need to work with discriminated union?
|
+-- Creating types? --> Schema.TaggedClass with .is static
|
+-- Handling all cases?
    |
    +-- Need event data or logic? --> Match.tagsExhaustive
    |
    +-- Simple tag-to-value map? --> Lookup table with satisfies
```

## Additional Resources

### Reference Files

For detailed patterns and advanced techniques, consult:

- **`references/patterns.md`** - Class field reuse, module architecture examples, handler syntax, JSON parsing, non-tagged unions, multiple lookup tables
- **`references/advanced.md`** - Higher-order schema factories, toString() vs codec, lint config for templates
