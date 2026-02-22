# String Codec Cascade Problem

## Context

Effect Schema's `Class` and `TaggedClass` create **struct-based schemas**:

- `Encoded` = struct with fields
- `Type` = class instance

The skill's "String Codecs" pattern adds a separate string codec as a static:

```typescript
class Child extends S.Class<Child>('Child')({
  value: S.String,
}) {
  static Schema = S.transform(S.String, Child, {
    decode: parseChild,
    encode: stringifyChild,
  })
}
```

This gives two schemas:

- `Child` (the class): `{ value: string } ↔ Child instance`
- `Child.Schema`: `string ↔ Child instance`

## The Cascade

When a schema has a **field** using another schema, the child's codec runs automatically during decode/encode:

```typescript
class Parent extends S.Class<Parent>('Parent')({
  child: ChildCodec,  // ← Child's decode/encode runs automatically
})
```

## The Problem

When Parent uses `Child` (the class) as a field type and ALSO has its own string codec:

```typescript
class Child extends S.Class<Child>('Child')({
  value: S.String,
}) {
  static Schema = S.transform(S.String, Child, {
    decode: parseChild,
    encode: stringifyChild,
  })
}

class Parent extends S.Class<Parent>('Parent')({
  child: Child, // ← Using the CLASS (struct encoded), not Child.Schema
}) {
  static Schema = S.transform(S.String, Parent, {
    decode: parseParent,
    encode: stringifyParent,
  })
}
```

**The tension:**

1. `Parent` (the class) has `Encoded = { child: { value: string } }` (nested struct)
2. `Parent.Schema` transforms `string ↔ Parent instance`
3. But `Parent.Schema`'s transform must **manually** handle child serialization
4. `Child.Schema` is **NOT automatically used** in `Parent.Schema`'s decode/encode

The cascade works at the **field schema level**. Since the field is `Child` (struct), the string codec (`Child.Schema`) isn't invoked when using `Parent.Schema`.

## Desired Outcome

Use `Child` as a field type (preserving struct nesting for the class schema) **while** having string codecs compose automatically when using `Parent.Schema`.

## Current Workaround

Manually call child string codecs in parent's transform:

```typescript
class Parent extends S.Class<Parent>('Parent')({
  child: Child,
}) {
  static Schema = S.transform(S.String, Parent, {
    decode: (s) => {
      const parsed = parseParentString(s)
      return Parent.make({
        child: S.decodeSync(Child.Schema)(parsed.childString), // Manual!
      })
    },
    encode: (p) => {
      const childStr = S.encodeSync(Child.Schema)(p.child) // Manual!
      return stringifyParent({ childString: childStr })
    },
  })
}
```

This is verbose and doesn't scale with deeply nested structures.

## Solution Requirements

Find a pattern that:

1. Preserves struct-based class schemas (`Child` as field type)
2. Allows string codecs on each class
3. Automatically composes string codecs when parent's string codec runs

---

## Solution: This Is Not a Problem

After researching Effect Schema's patterns, the "cascade problem" is actually a **design question**, not a limitation.

### Key Insight: Two Independent Concerns

The skill's pattern gives you TWO independent schemas per class:

| Schema         | Purpose                    | Encoded Type |
| -------------- | -------------------------- | ------------ |
| `Child`        | Struct codec (for nesting) | `{ ... }`    |
| `Child.Schema` | String codec (for I/O)     | `string`     |

These are **intentionally separate**. When you nest `Child` in `Parent`, you're using the struct codec. When you serialize with `Parent.Schema`, you're using the string codec.

### Why Automatic Cascade Doesn't Make Sense

Consider semver: `"1.0.0-alpha.1+build.123"`

This string contains prerelease identifiers (`alpha.1`) and build metadata (`build.123`), but:

1. They're NOT independent substrings you can extract and parse separately
2. The entire string is ONE parsing unit with regex/grammar rules
3. The parent's string codec parses the WHOLE thing, not "parent part" + "child parts"

So there's no "child string" to pass to `Child.Schema`. The parent's codec handles everything.

### The Correct Pattern

**Each string codec parses a COMPLETE string representation of that type:**

```typescript
// OfficialRelease: "1.0.0" or "1.0.0+build"
class OfficialRelease
  extends S.TaggedClass<OfficialRelease>()('SemverOfficialRelease', {
    major: S.Number.pipe(S.int(), S.nonNegative()),
    minor: S.Number.pipe(S.int(), S.nonNegative()),
    patch: S.Number.pipe(S.int(), S.nonNegative()),
    build: S.optional(BuildIds),
  })
{
  static Schema = S.transform(S.String, OfficialRelease, {
    decode: (s) => {
      const parsed = parseSemver(s)
      if (parsed.prerelease) throw new Error('Has prerelease')
      return OfficialRelease.make({ ...parsed })
    },
    encode: (r) => stringifySemver(r),
  })
}

// PreRelease: "1.0.0-alpha.1" or "1.0.0-alpha.1+build"
class PreRelease extends S.TaggedClass<PreRelease>()('SemverPreRelease', {
  major: S.Number.pipe(S.int(), S.nonNegative()),
  minor: S.Number.pipe(S.int(), S.nonNegative()),
  patch: S.Number.pipe(S.int(), S.nonNegative()),
  prerelease: PrereleaseIds,
  build: S.optional(BuildIds),
}) {
  static Schema = S.transform(S.String, PreRelease, {
    decode: (s) => {
      const parsed = parseSemver(s)
      if (!parsed.prerelease) throw new Error('Missing prerelease')
      return PreRelease.make({ ...parsed })
    },
    encode: (r) => stringifySemver(r),
  })
}

// Union codec for any semver
export const Schema = S.transform(S.String, Semver, {
  decode: (s) => {
    const parsed = parseSemver(s)
    if (parsed.prerelease) return PreRelease.make({ ...parsed })
    return OfficialRelease.make({ ...parsed })
  },
  encode: (v) => stringifySemver(v),
})
```

### When You DO Need Nested String Codecs

If your parent's encoded string genuinely contains a child's encoded string as a substring, you CAN compose manually:

```typescript
// Parent string format: "config:child-string-here:options"
class Parent extends S.Class<Parent>('Parent')({
  child: Child,
  options: S.String,
}) {
  static Schema = S.transform(S.String, Parent, {
    decode: (s) => {
      const [_, childStr, options] = s.split(':')
      return Parent.make({
        child: S.decodeSync(Child.Schema)(childStr),
        options,
      })
    },
    encode: (p) => {
      const childStr = S.encodeSync(Child.Schema)(p.child)
      return `config:${childStr}:${p.options}`
    },
  })
}
```

This is explicit about HOW the child string is embedded in the parent string.

### Summary

| Scenario                           | Pattern                                     |
| ---------------------------------- | ------------------------------------------- |
| Parent string embeds child strings | Manually call Child.Schema in Parent.Schema |
| Parent string is atomic            | Parent.Schema parses whole thing directly   |
| Nesting for struct codec only      | Use Child as field type, no string cascade  |

The "workaround" in the problem statement IS the correct solution when you genuinely have embedded child strings. For atomic string formats (like semver), there's nothing to cascade - the parent knows how to parse everything.
