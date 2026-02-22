# Conventional Commits Type System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace plain string `type` field with discriminated Standard/Custom union for type safety and semantic version impact lookup.

**Architecture:** Create a new `type.ts` module with Impact enum, StandardValue enum, Standard/Custom tagged classes, and a type-level smart constructor. Update SingleTargetCommit, Target, and parser to use the new Type.

**Tech Stack:** Effect Schema, TypeScript conditional types

---

## Task 1: Create Type Module with Impact and StandardValue

**Files:**

- Create: `packages/conventional-commits/src/type.ts`
- Test: `packages/conventional-commits/src/type.test.ts`

**Step 1: Write the failing test for Impact enum**

```typescript
// packages/conventional-commits/src/type.test.ts
import { describe, expect, test } from 'vitest'
import { Impact, ImpactValues } from './type.js'

describe('Impact', () => {
  test('has runtime enum values', () => {
    expect(ImpactValues.none).toBe('none')
    expect(ImpactValues.patch).toBe('patch')
    expect(ImpactValues.minor).toBe('minor')
  })

  test('schema exposes enums', () => {
    expect(Impact.enums.none).toBe('none')
    expect(Impact.enums.patch).toBe('patch')
    expect(Impact.enums.minor).toBe('minor')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test packages/conventional-commits/src/type.test.ts --run`
Expected: FAIL with "Cannot find module './type.js'"

**Step 3: Write minimal implementation for Impact**

```typescript
// packages/conventional-commits/src/type.ts
import { Schema } from 'effect'

// ─── Impact ─────────────────────────────────────────────────────

/**
 * Semantic version impact levels.
 * Note: `major` comes from breaking change flags, not from the type itself.
 */
export const ImpactValues = {
  none: 'none',
  patch: 'patch',
  minor: 'minor',
} as const

export const Impact = Schema.Enums(ImpactValues)
export type Impact = typeof Impact.Type
```

**Step 4: Run test to verify it passes**

Run: `pnpm test packages/conventional-commits/src/type.test.ts --run`
Expected: PASS

**Step 5: Add test for StandardValue enum**

```typescript
// Add to type.test.ts
import { StandardValue, StandardValues } from './type.js'

describe('StandardValue', () => {
  test('has all 11 standard types', () => {
    expect(Object.keys(StandardValues)).toHaveLength(11)
    expect(StandardValues.feat).toBe('feat')
    expect(StandardValues.fix).toBe('fix')
    expect(StandardValues.docs).toBe('docs')
    expect(StandardValues.style).toBe('style')
    expect(StandardValues.refactor).toBe('refactor')
    expect(StandardValues.perf).toBe('perf')
    expect(StandardValues.test).toBe('test')
    expect(StandardValues.build).toBe('build')
    expect(StandardValues.ci).toBe('ci')
    expect(StandardValues.chore).toBe('chore')
    expect(StandardValues.revert).toBe('revert')
  })

  test('schema exposes enums', () => {
    expect(StandardValue.enums.feat).toBe('feat')
  })
})
```

**Step 6: Implement StandardValue**

```typescript
// Add to type.ts

// ─── Standard Value ─────────────────────────────────────────────

/**
 * The 11 standard conventional commit types (Angular convention).
 */
export const StandardValues = {
  feat: 'feat',
  fix: 'fix',
  docs: 'docs',
  style: 'style',
  refactor: 'refactor',
  perf: 'perf',
  test: 'test',
  build: 'build',
  ci: 'ci',
  chore: 'chore',
  revert: 'revert',
} as const

export const StandardValue = Schema.Enums(StandardValues)
export type StandardValue = typeof StandardValue.Type
```

**Step 7: Run tests**

Run: `pnpm test packages/conventional-commits/src/type.test.ts --run`
Expected: PASS

**Step 8: Commit**

```bash
git add packages/conventional-commits/src/type.ts packages/conventional-commits/src/type.test.ts
git commit -m "feat(conventional-commits): add Impact and StandardValue enums"
```

---

## Task 2: Add StandardImpact Mapping

**Files:**

- Modify: `packages/conventional-commits/src/type.ts`
- Test: `packages/conventional-commits/src/type.test.ts`

**Step 1: Write failing test**

```typescript
// Add to type.test.ts
import { StandardImpact } from './type.js'

describe('StandardImpact', () => {
  test('feat is minor', () => {
    expect(StandardImpact.feat).toBe('minor')
  })

  test('fix is patch', () => {
    expect(StandardImpact.fix).toBe('patch')
  })

  test('docs is patch', () => {
    expect(StandardImpact.docs).toBe('patch')
  })

  test('perf is patch', () => {
    expect(StandardImpact.perf).toBe('patch')
  })

  test('chore is none', () => {
    expect(StandardImpact.chore).toBe('none')
  })

  test('all standard types have impact mappings', () => {
    for (const key of Object.keys(StandardValues)) {
      expect(StandardImpact[key as StandardValue]).toBeDefined()
    }
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test packages/conventional-commits/src/type.test.ts --run`
Expected: FAIL

**Step 3: Implement StandardImpact**

```typescript
// Add to type.ts

// ─── Standard Impact Mapping ────────────────────────────────────

/**
 * Static impact mapping for standard types.
 */
export const StandardImpact: Record<StandardValue, Impact> = {
  feat: 'minor',
  fix: 'patch',
  docs: 'patch',
  perf: 'patch',
  style: 'none',
  refactor: 'none',
  test: 'none',
  build: 'none',
  ci: 'none',
  chore: 'none',
  revert: 'none',
}
```

**Step 4: Run tests**

Run: `pnpm test packages/conventional-commits/src/type.test.ts --run`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/conventional-commits/src/type.ts packages/conventional-commits/src/type.test.ts
git commit -m "feat(conventional-commits): add StandardImpact mapping"
```

---

## Task 3: Add Standard and Custom Tagged Classes

**Files:**

- Modify: `packages/conventional-commits/src/type.ts`
- Test: `packages/conventional-commits/src/type.test.ts`

**Step 1: Write failing test**

```typescript
// Add to type.test.ts
import { Schema } from 'effect'
import { Custom, Standard, Type } from './type.js'

describe('Standard', () => {
  test('creates with valid value', () => {
    const s = new Standard({ value: 'feat' })
    expect(s._tag).toBe('Standard')
    expect(s.value).toBe('feat')
  })

  test('decodes from object', () => {
    const result = Schema.decodeUnknownSync(Standard)({
      _tag: 'Standard',
      value: 'fix',
    })
    expect(result.value).toBe('fix')
  })
})

describe('Custom', () => {
  test('creates with any string value', () => {
    const c = new Custom({ value: 'wip' })
    expect(c._tag).toBe('Custom')
    expect(c.value).toBe('wip')
  })

  test('decodes from object', () => {
    const result = Schema.decodeUnknownSync(Custom)({
      _tag: 'Custom',
      value: 'experimental',
    })
    expect(result.value).toBe('experimental')
  })
})

describe('Type', () => {
  test('is union of Standard and Custom', () => {
    const standard = Schema.decodeUnknownSync(Type)({
      _tag: 'Standard',
      value: 'feat',
    })
    const custom = Schema.decodeUnknownSync(Type)({
      _tag: 'Custom',
      value: 'wip',
    })
    expect(standard._tag).toBe('Standard')
    expect(custom._tag).toBe('Custom')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test packages/conventional-commits/src/type.test.ts --run`
Expected: FAIL

**Step 3: Implement Standard, Custom, Type**

```typescript
// Add to type.ts

// ─── Standard Type ──────────────────────────────────────────────

/**
 * A known conventional commit type.
 */
export class Standard extends Schema.TaggedClass<Standard>()('Standard', {
  value: StandardValue,
}) {}

// ─── Custom Type ────────────────────────────────────────────────

/**
 * A custom/unknown commit type.
 */
export class Custom extends Schema.TaggedClass<Custom>()('Custom', {
  value: Schema.String,
}) {}

// ─── Type Union ─────────────────────────────────────────────────

/**
 * Commit type: either a standard type or a custom extension.
 */
export const Type = Schema.Union(Standard, Custom)
export type Type = typeof Type.Type
```

**Step 4: Run tests**

Run: `pnpm test packages/conventional-commits/src/type.test.ts --run`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/conventional-commits/src/type.ts packages/conventional-commits/src/type.test.ts
git commit -m "feat(conventional-commits): add Standard, Custom, and Type union"
```

---

## Task 4: Add Type Guards and Accessors

**Files:**

- Modify: `packages/conventional-commits/src/type.ts`
- Test: `packages/conventional-commits/src/type.test.ts`

**Step 1: Write failing test**

```typescript
// Add to type.test.ts
import { impact, isCustom, isStandard, value } from './type.js'

describe('isStandard', () => {
  test('returns true for Standard', () => {
    expect(isStandard(new Standard({ value: 'feat' }))).toBe(true)
  })

  test('returns false for Custom', () => {
    expect(isStandard(new Custom({ value: 'wip' }))).toBe(false)
  })
})

describe('isCustom', () => {
  test('returns true for Custom', () => {
    expect(isCustom(new Custom({ value: 'wip' }))).toBe(true)
  })

  test('returns false for Standard', () => {
    expect(isCustom(new Standard({ value: 'feat' }))).toBe(false)
  })
})

describe('value', () => {
  test('extracts value from Standard', () => {
    expect(value(new Standard({ value: 'feat' }))).toBe('feat')
  })

  test('extracts value from Custom', () => {
    expect(value(new Custom({ value: 'wip' }))).toBe('wip')
  })
})

describe('impact', () => {
  test('returns impact for Standard', () => {
    expect(impact(new Standard({ value: 'feat' }))).toBe('minor')
    expect(impact(new Standard({ value: 'fix' }))).toBe('patch')
    expect(impact(new Standard({ value: 'chore' }))).toBe('none')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test packages/conventional-commits/src/type.test.ts --run`
Expected: FAIL

**Step 3: Implement type guards and accessors**

```typescript
// Add to type.ts

// ─── Type Guards ────────────────────────────────────────────────

/**
 * Check if a Type is a standard type.
 */
export const isStandard = (type: Type): type is Standard =>
  type._tag === 'Standard'

/**
 * Check if a Type is a custom type.
 */
export const isCustom = (type: Type): type is Custom => type._tag === 'Custom'

// ─── Accessors ──────────────────────────────────────────────────

/**
 * Extract the raw string value from any Type.
 */
export const value = (type: Type): string => type.value

/**
 * Get impact for a Standard type.
 * For Custom types, use release config lookup instead.
 */
export const impact = (type: Standard): Impact => StandardImpact[type.value]
```

**Step 4: Run tests**

Run: `pnpm test packages/conventional-commits/src/type.test.ts --run`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/conventional-commits/src/type.ts packages/conventional-commits/src/type.test.ts
git commit -m "feat(conventional-commits): add type guards and accessors"
```

---

## Task 5: Add Type-Level Smart Constructor

**Files:**

- Modify: `packages/conventional-commits/src/type.ts`
- Test: `packages/conventional-commits/src/type.test.ts`

**Step 1: Write failing test**

```typescript
// Add to type.test.ts
import { from } from './type.js'

describe('from', () => {
  test('creates Standard for known types', () => {
    const t = from('feat')
    expect(t._tag).toBe('Standard')
    expect(t.value).toBe('feat')
  })

  test('creates Custom for unknown types', () => {
    const t = from('wip')
    expect(t._tag).toBe('Custom')
    expect(t.value).toBe('wip')
  })

  test('works with all standard types', () => {
    for (const key of Object.keys(StandardValues)) {
      const t = from(key)
      expect(t._tag).toBe('Standard')
    }
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test packages/conventional-commits/src/type.test.ts --run`
Expected: FAIL

**Step 3: Implement smart constructor**

```typescript
// Add to type.ts

// ─── Smart Constructor ──────────────────────────────────────────

/**
 * Type-level narrowing: returns Standard for known types, Custom otherwise.
 */
type From<$value extends string> = $value extends StandardValue ? Standard
  : Custom

/**
 * Create a Type from a raw string.
 * Known types become Standard, unknown become Custom.
 * Return type narrows based on input literal.
 */
export const from = <$value extends string>(value: $value): From<$value> => {
  if (value in StandardValues) {
    return new Standard({ value: value as StandardValue }) as From<$value>
  }
  return new Custom({ value }) as From<$value>
}
```

**Step 4: Run tests**

Run: `pnpm test packages/conventional-commits/src/type.test.ts --run`
Expected: PASS

**Step 5: Add type-level test**

```typescript
// Add to type.test.ts (at bottom, outside describe blocks)
import { Ts } from '@kitz/core'

// Type-level tests for from()
Ts.Assert.exact.ofAs<Standard>().on(from('feat'))
Ts.Assert.exact.ofAs<Standard>().on(from('fix'))
Ts.Assert.exact.ofAs<Custom>().on(from('wip'))
Ts.Assert.exact.ofAs<Custom>().on(from('experimental'))

// Dynamic string returns union
const dynamic: string = 'unknown'
Ts.Assert.exact.ofAs<Type>().on(from(dynamic))
```

**Step 6: Run type check**

Run: `pnpm check:types --filter=@kitz/conventional-commits`
Expected: PASS

**Step 7: Commit**

```bash
git add packages/conventional-commits/src/type.ts packages/conventional-commits/src/type.test.ts
git commit -m "feat(conventional-commits): add type-level smart constructor from()"
```

---

## Task 6: Update SingleTargetCommit to Use Type

**Files:**

- Modify: `packages/conventional-commits/src/single-target-commit.ts`
- Test: `packages/conventional-commits/src/single-target-commit.test.ts`

**Step 1: Read existing test to understand current usage**

Run: `cat packages/conventional-commits/src/single-target-commit.test.ts`

**Step 2: Update import and schema**

```typescript
// packages/conventional-commits/src/single-target-commit.ts
import { Schema } from 'effect'
import { Footer } from './footer.js'
import { Type } from './type.js'

export class SingleTargetCommit
  extends Schema.TaggedClass<SingleTargetCommit>()('SingleTarget', {
    /** Commit type */
    type: Type, // Changed from Schema.String
    /** Package scopes (can be empty, one, or multiple—all get same treatment) */
    scopes: Schema.Array(Schema.String),
    /** Whether this is a breaking change (applies to ALL scopes) */
    breaking: Schema.Boolean,
    /** Commit message (first line after type/scope) */
    message: Schema.String,
    /** Optional commit body */
    body: Schema.OptionFromNullOr(Schema.String),
    /** Commit footers */
    footers: Schema.Array(Footer),
  })
{}
```

**Step 3: Update existing tests to use Type**

Update test file to create commits with `Type.from()` or `new Standard()`/`new Custom()` instead of plain strings.

**Step 4: Run tests**

Run: `pnpm test packages/conventional-commits/src/single-target-commit.test.ts --run`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/conventional-commits/src/single-target-commit.ts packages/conventional-commits/src/single-target-commit.test.ts
git commit -m "refactor(conventional-commits)!: SingleTargetCommit uses Type union"
```

---

## Task 7: Update Target to Use Type

**Files:**

- Modify: `packages/conventional-commits/src/target.ts`
- Test: `packages/conventional-commits/src/target.test.ts`

**Step 1: Update schema**

```typescript
// packages/conventional-commits/src/target.ts
import { Schema } from 'effect'
import { Type } from './type.js'

export class Target extends Schema.TaggedClass<Target>()('Target', {
  /** Commit type */
  type: Type, // Changed from Schema.String
  /** Package scope (e.g., "core", "cli") */
  scope: Schema.String,
  /** Whether this target represents a breaking change */
  breaking: Schema.Boolean,
}) {}
```

**Step 2: Update existing tests**

**Step 3: Run tests**

Run: `pnpm test packages/conventional-commits/src/target.test.ts --run`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/conventional-commits/src/target.ts packages/conventional-commits/src/target.test.ts
git commit -m "refactor(conventional-commits)!: Target uses Type union"
```

---

## Task 8: Update Parser to Use Type.from()

**Files:**

- Modify: `packages/conventional-commits/src/parse/title.ts`
- Test: `packages/conventional-commits/src/parse/title.test.ts`

**Step 1: Update parser imports and usage**

```typescript
// packages/conventional-commits/src/parse/title.ts
import * as Type from '../type.js'

// In parseTitle, change:
// type,  →  type: Type.from(type),
```

Key changes:

- Line 84-85: `type: Type.from(type),` instead of `type,`
- Line 119-121: `type: Type.from(type),` instead of `type,`

**Step 2: Update tests**

Update assertions that check `type` to use `Type.value()` or check `_tag`.

**Step 3: Run tests**

Run: `pnpm test packages/conventional-commits/src/parse/title.test.ts --run`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/conventional-commits/src/parse/title.ts packages/conventional-commits/src/parse/title.test.ts
git commit -m "refactor(conventional-commits): parser uses Type.from()"
```

---

## Task 9: Export Type Module

**Files:**

- Modify: `packages/conventional-commits/src/__.ts`

**Step 1: Add Type export**

```typescript
// packages/conventional-commits/src/__.ts
export * as Type from './type.js'
// ... existing exports
```

**Step 2: Run all package tests**

Run: `pnpm test --filter=@kitz/conventional-commits --run`
Expected: PASS

**Step 3: Run type check**

Run: `pnpm check:types --filter=@kitz/conventional-commits`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/conventional-commits/src/__.ts
git commit -m "feat(conventional-commits): export Type module"
```

---

## Task 10: Final Verification

**Step 1: Run all tests**

Run: `pnpm test --filter=@kitz/conventional-commits --run`
Expected: All PASS

**Step 2: Run type check**

Run: `pnpm check:types --filter=@kitz/conventional-commits`
Expected: No errors

**Step 3: Build**

Run: `pnpm turbo run build --filter=@kitz/conventional-commits`
Expected: Success

**Step 4: Verify downstream consumers (if any)**

Check if other packages import from `@kitz/conventional-commits` and update if needed.
