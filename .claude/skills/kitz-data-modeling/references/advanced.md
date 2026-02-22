# Advanced Patterns

## Higher-Order Schema/Class Factories

When building factories that return custom Schema classes, cast base to `any` before extending. This is how Effect itself implements `TaggedClass` and `TaggedError` internally.

```typescript
import { Schema as S } from 'effect'

export const TaggedContextualError = <
  const $Tag extends string,
  const $Tags extends readonly string[],
  ContextSchema extends S.Schema.Any,
>(
  tag: $Tag,
  tags: $Tags,
  config: {
    context: ContextSchema
    message: (ctx: S.Schema.Type<ContextSchema>) => string
  },
): TaggedContextualErrorClass<$Tag, $Tags, ContextSchema> => {
  // Cast to any so class extension works (same pattern as Effect's makeClass)
  const Base = S.TaggedError<any>()(tag, {
    context: config.context,
  }) as any

  return class extends Base {
    static tags = tags
    readonly tags = tags

    get message(): string {
      return config.message(this['context']) // Bracket notation for index signature
    }
  } as any // Return type annotation provides type safety
}
```

### Common Issues

| Problem                                                      | Solution                                                 |
| ------------------------------------------------------------ | -------------------------------------------------------- |
| TS2509: "Base constructor return type is not an object type" | Cast factory result to `any` before extending            |
| TS4111: "Property comes from index signature"                | Use bracket notation: `this['prop']` not `this.prop`     |
| Complex generic inference                                    | Return `as any`, rely on explicit return type for safety |

**Key insight:** Effect's `makeClass()` returns `: any` internally. TypeScript can't resolve complex generic class constructors for extension. The explicit return type annotation provides all the type safety.

**Pattern summary:**

1. Call the Schema factory normally with fields
2. Cast result to `any` before `class extends`
3. Add static/instance properties in class body
4. Use bracket notation for index signature properties
5. Return with `as any` — return type annotation is the contract

## toString() Override vs Schema Codec

These serve DIFFERENT purposes—do not conflate them:

| Purpose                  | Mechanism                  | When Used                               |
| ------------------------ | -------------------------- | --------------------------------------- |
| JS string coercion sugar | `override toString()`      | Template literals, `String(x)`, logging |
| Validated serialization  | `Schema.encodeSync(codec)` | Code paths requiring type safety        |

**If a class has a string codec, always add a `toString()` override:**

```typescript
class Gitignore ... {
  // Sugar ONLY - for JS automatic coercion
  override toString(): string {
    return toString(this)  // Uses module-level toString wrapper
  }
}

// Usage contexts:
console.log(`Gitignore: ${gitignore}`)             // toString() - sugar
const validated = S.encodeSync(Schema)(gitignore)  // Explicit - validated
```

**Why add toString():**

- Prevents `[object Object]` disasters in logging/templates
- Enables `${instance}` syntax (with lint config)
- Zero downside—it's additive sugar

**CRITICAL**: `toString()` does NOT replace explicit codec usage. Always use `Schema.encodeSync`/`decodeSync` for:

- Serialization to files/network
- Data validation boundaries
- Effect pipelines

## Lint Config for Template Expressions

When adding `toString()` to a Schema class, whitelist it in lint config to allow `${instance}` without warnings:

```json
// .oxlintrc.json (or eslint equivalent)
{
  "rules": {
    "typescript/restrict-template-expressions": ["error", {
      "allow": [
        { "from": "file", "name": ["Gitignore", "AbsDir", "Version"] },
        { "from": "package", "name": "Gitignore", "package": "@kitz/git" }
      ]
    }]
  }
}
```

**Why this matters:**

- Without whitelist: `${gitignore}` triggers lint warning (even with valid `toString()`)
- Linters don't auto-detect custom `toString()` methods
- Alternative: always use explicit `.toString()` in templates

**When to add:**

- Package authors: document types for consumers to whitelist
- App developers: add types to project lint config as needed

## String Codec Composition

### The Two Schemas Per Class

The string codec pattern gives each class TWO independent schemas:

| Schema          | Encoded             | Type    | Purpose                |
| --------------- | ------------------- | ------- | ---------------------- |
| `Child` (class) | `{ field: string }` | `Child` | Struct codec (nesting) |
| `Child.Schema`  | `string`            | `Child` | String codec (I/O)     |

### The Non-Problem

When `Parent` uses `Child` as a field and both have string codecs:

```typescript
class Child extends S.TaggedClass<Child>()('Child', { value: S.String }) {
  static Schema = S.transform(S.String, Child, {
    decode: parse,
    encode: stringify,
  })
}

class Parent extends S.TaggedClass<Parent>()('Parent', { child: Child }) {
  static Schema = S.transform(S.String, Parent, {
    decode: parse,
    encode: stringify,
  })
}
```

**Q: Does `Parent.Schema` automatically use `Child.Schema`?**
**A: No, and it shouldn't.**

These are independent string representations:

- `Child.Schema`: `"child-value"` ↔ `Child`
- `Parent.Schema`: `"parent-format"` ↔ `Parent`

The parent's string format may not contain the child's string as a substring at all.

### Pattern 1: Atomic String (Most Common)

Parent's string format is ONE parsing unit—no child substrings to extract.

```typescript
// Semver: "1.0.0-alpha.1" is atomic, not "1.0.0" + "-alpha.1"
class PreRelease extends S.TaggedClass<PreRelease>()('PreRelease', {
  major: S.Number,
  minor: S.Number,
  patch: S.Number,
  prerelease: PrereleaseIds, // Stored as structured data
}) {
  static Schema = S.transform(S.String, PreRelease, {
    decode: (s) => {
      const parsed = parseSemver(s) // Parse ENTIRE string
      return PreRelease.make({ ...parsed })
    },
    encode: (r) => `${r.major}.${r.minor}.${r.patch}-${r.prerelease.join('.')}`,
  })
}
```

**No cascade needed**—parent parses everything directly.

### Pattern 2: Embedded Child Strings (Rare)

Parent's string format genuinely contains child's string as substring.

```typescript
// Format: "config:child-string:options"
class Parent
  extends S.Class<Parent>('Parent')({ child: Child, options: S.String })
{
  static Schema = S.transform(S.String, Parent, {
    decode: (s) => {
      const [_, childStr, options] = s.split(':')
      return Parent.make({
        child: S.decodeSync(Child.Schema)(childStr), // Explicit composition
        options,
      })
    },
    encode: (p) => `config:${S.encodeSync(Child.Schema)(p.child)}:${p.options}`,
  })
}
```

**Manual composition**—explicit about HOW child string is embedded.

### Decision Table

| Parent string format                  | Pattern            | Child.Schema usage     |
| ------------------------------------- | ------------------ | ---------------------- |
| Atomic (no child substrings)          | Parse whole thing  | Not used               |
| Contains child as literal substring   | Manual composition | Explicit decode/encode |
| Struct nesting only (no string codec) | No Parent.Schema   | N/A                    |
