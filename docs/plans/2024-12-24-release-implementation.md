# @kitz/release Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a commit-driven release tool for monorepos with independent versioning, extended conventional commit syntax, and plan/apply workflow.

**Architecture:** Five packages built bottom-up: `@kitz/git` → `@kitz/conventional-commits` → `@kitz/changelog` → `@kitz/npm-registry` → `@kitz/release`. Each package is Effect-native with Schema classes for data types.

**Tech Stack:** Effect (Schema, TaggedClass), simple-git, @vltpkg/registry-client, @kitz/oak (CLI)

**Design Doc:** `docs/plans/2024-12-24-release-design.md`

---

## Phase 1: @kitz/conventional-commits

The parser for conventional commits with extended monorepo syntax. This is the foundation—everything else depends on parsing commits correctly.

### Task 1.1: Create Package Scaffold

**Files:**

- Create: `packages/conventional-commits/` (via script)

**Step 1: Run package creation script**

```bash
cd /Users/jasonkuhrt/projects/jasonkuhrt/kitz/.worktrees/release
pnpm tsx .claude/skills/creating-packages/scripts/create-package.ts conventional-commits
```

**Step 2: Install dependencies**

```bash
pnpm install
```

**Step 3: Verify package exists**

```bash
ls packages/conventional-commits/src/
```

Expected: `_.ts`, `__.ts`, `conventional-commits.ts`

**Step 4: Commit**

```bash
git add packages/conventional-commits/
git commit -m "feat(conventional-commits): scaffold package"
```

---

### Task 1.2: Define Footer Schema Class

**Files:**

- Modify: `packages/conventional-commits/src/conventional-commits.ts`
- Create: `packages/conventional-commits/src/footer.ts`
- Test: `packages/conventional-commits/src/footer.test.ts`

**Step 1: Write the failing test**

Create `packages/conventional-commits/src/footer.test.ts`:

```typescript
import { describe, expect, test } from 'vitest'
import { Footer } from './footer.js'

describe('Footer', () => {
  test('make creates valid footer', () => {
    const footer = Footer.make({
      token: 'BREAKING CHANGE',
      value: 'removed deprecated API',
    })
    expect(footer.token).toBe('BREAKING CHANGE')
    expect(footer.value).toBe('removed deprecated API')
  })

  test('_tag is Footer', () => {
    const footer = Footer.make({ token: 'Fixes', value: '#123' })
    expect(footer._tag).toBe('Footer')
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm vitest run packages/conventional-commits/src/footer.test.ts
```

Expected: FAIL - cannot find module './footer.js'

**Step 3: Write implementation**

Create `packages/conventional-commits/src/footer.ts`:

```typescript
import { Schema } from 'effect'

/**
 * A conventional commit footer (e.g., "BREAKING CHANGE: description" or "Fixes: #123")
 */
export class Footer extends Schema.TaggedClass<Footer>()('Footer', {
  /** Footer token (e.g., "BREAKING CHANGE", "Fixes", "Closes") */
  token: Schema.String,
  /** Footer value */
  value: Schema.String,
}) {}
```

**Step 4: Run test to verify it passes**

```bash
pnpm vitest run packages/conventional-commits/src/footer.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/conventional-commits/src/footer.ts packages/conventional-commits/src/footer.test.ts
git commit -m "feat(conventional-commits): add Footer schema class"
```

---

### Task 1.3: Define Target Schema Class

**Files:**

- Create: `packages/conventional-commits/src/target.ts`
- Test: `packages/conventional-commits/src/target.test.ts`

**Step 1: Write the failing test**

Create `packages/conventional-commits/src/target.test.ts`:

```typescript
import { describe, expect, test } from 'vitest'
import { Target } from './target.js'

describe('Target', () => {
  test('make creates valid target', () => {
    const target = Target.make({
      type: 'feat',
      scope: 'core',
      breaking: true,
    })
    expect(target.type).toBe('feat')
    expect(target.scope).toBe('core')
    expect(target.breaking).toBe(true)
  })

  test('_tag is Target', () => {
    const target = Target.make({ type: 'fix', scope: 'cli', breaking: false })
    expect(target._tag).toBe('Target')
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm vitest run packages/conventional-commits/src/target.test.ts
```

Expected: FAIL

**Step 3: Write implementation**

Create `packages/conventional-commits/src/target.ts`:

```typescript
import { Schema } from 'effect'

/**
 * A release target representing a type-scope-breaking tuple for one package.
 * Used in MultiTargetCommit where each scope can have its own type and breaking indicator.
 */
export class Target extends Schema.TaggedClass<Target>()('Target', {
  /** Commit type (e.g., "feat", "fix", "chore") */
  type: Schema.String,
  /** Package scope (e.g., "core", "cli") */
  scope: Schema.String,
  /** Whether this target represents a breaking change */
  breaking: Schema.Boolean,
}) {}
```

**Step 4: Run test to verify it passes**

```bash
pnpm vitest run packages/conventional-commits/src/target.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/conventional-commits/src/target.ts packages/conventional-commits/src/target.test.ts
git commit -m "feat(conventional-commits): add Target schema class"
```

---

### Task 1.4: Define TargetSection Schema Class

**Files:**

- Create: `packages/conventional-commits/src/target-section.ts`
- Test: `packages/conventional-commits/src/target-section.test.ts`

**Step 1: Write the failing test**

Create `packages/conventional-commits/src/target-section.test.ts`:

```typescript
import { describe, expect, test } from 'vitest'
import { Footer } from './footer.js'
import { TargetSection } from './target-section.js'

describe('TargetSection', () => {
  test('make creates valid section with footers', () => {
    const section = TargetSection.make({
      body: 'Detailed description of changes.',
      footers: [Footer.make({ token: 'BREAKING CHANGE', value: 'removed X' })],
    })
    expect(section.body).toBe('Detailed description of changes.')
    expect(section.footers).toHaveLength(1)
    expect(section.footers[0].token).toBe('BREAKING CHANGE')
  })

  test('make creates section with empty footers', () => {
    const section = TargetSection.make({
      body: 'Simple change.',
      footers: [],
    })
    expect(section.footers).toHaveLength(0)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm vitest run packages/conventional-commits/src/target-section.test.ts
```

Expected: FAIL

**Step 3: Write implementation**

Create `packages/conventional-commits/src/target-section.ts`:

```typescript
import { Schema } from 'effect'
import { Footer } from './footer.js'

/**
 * A per-package section in a MultiTargetCommit body.
 * Contains the body text and any footers (like BREAKING CHANGE) for that package.
 */
export class TargetSection
  extends Schema.TaggedClass<TargetSection>()('TargetSection', {
    /** Section body text */
    body: Schema.String,
    /** Footers within this section (including BREAKING CHANGE) */
    footers: Schema.Array(Footer),
  })
{}
```

**Step 4: Run test to verify it passes**

```bash
pnpm vitest run packages/conventional-commits/src/target-section.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/conventional-commits/src/target-section.ts packages/conventional-commits/src/target-section.test.ts
git commit -m "feat(conventional-commits): add TargetSection schema class"
```

---

### Task 1.5: Define SingleTargetCommit Schema Class

**Files:**

- Create: `packages/conventional-commits/src/single-target-commit.ts`
- Test: `packages/conventional-commits/src/single-target-commit.test.ts`

**Step 1: Write the failing test**

Create `packages/conventional-commits/src/single-target-commit.test.ts`:

```typescript
import { Option } from 'effect'
import { describe, expect, test } from 'vitest'
import { Footer } from './footer.js'
import { SingleTargetCommit } from './single-target-commit.js'

describe('SingleTargetCommit', () => {
  test('make creates valid commit with scope', () => {
    const commit = SingleTargetCommit.make({
      type: 'feat',
      scopes: ['core'],
      breaking: false,
      message: 'add new feature',
      body: Option.none(),
      footers: [],
    })
    expect(commit._tag).toBe('SingleTarget')
    expect(commit.type).toBe('feat')
    expect(commit.scopes).toEqual(['core'])
    expect(commit.breaking).toBe(false)
    expect(commit.message).toBe('add new feature')
  })

  test('make creates commit with multiple scopes (uniform treatment)', () => {
    const commit = SingleTargetCommit.make({
      type: 'feat',
      scopes: ['core', 'cli'],
      breaking: true,
      message: 'breaking change across packages',
      body: Option.some('Detailed body'),
      footers: [
        Footer.make({ token: 'BREAKING CHANGE', value: 'removed API' }),
      ],
    })
    expect(commit.scopes).toEqual(['core', 'cli'])
    expect(commit.breaking).toBe(true)
    expect(Option.isSome(commit.body)).toBe(true)
  })

  test('make creates commit without scope', () => {
    const commit = SingleTargetCommit.make({
      type: 'chore',
      scopes: [],
      breaking: false,
      message: 'update deps',
      body: Option.none(),
      footers: [],
    })
    expect(commit.scopes).toEqual([])
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm vitest run packages/conventional-commits/src/single-target-commit.test.ts
```

Expected: FAIL

**Step 3: Write implementation**

Create `packages/conventional-commits/src/single-target-commit.ts`:

```typescript
import { Option, Schema } from 'effect'
import { Footer } from './footer.js'

/**
 * A standard conventional commit where all scopes receive uniform treatment.
 *
 * Examples:
 * - `feat: add feature` (no scope)
 * - `feat(core): add feature` (one scope)
 * - `feat(core, cli): add feature` (multiple scopes, same type/breaking for all)
 * - `feat(core)!: breaking change` (breaking applies to all scopes)
 */
export class SingleTargetCommit
  extends Schema.TaggedClass<SingleTargetCommit>()('SingleTarget', {
    /** Commit type (e.g., "feat", "fix", "chore") */
    type: Schema.String,
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

**Step 4: Run test to verify it passes**

```bash
pnpm vitest run packages/conventional-commits/src/single-target-commit.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/conventional-commits/src/single-target-commit.ts packages/conventional-commits/src/single-target-commit.test.ts
git commit -m "feat(conventional-commits): add SingleTargetCommit schema class"
```

---

### Task 1.6: Define MultiTargetCommit Schema Class

**Files:**

- Create: `packages/conventional-commits/src/multi-target-commit.ts`
- Test: `packages/conventional-commits/src/multi-target-commit.test.ts`

**Step 1: Write the failing test**

Create `packages/conventional-commits/src/multi-target-commit.test.ts`:

```typescript
import { Option } from 'effect'
import { describe, expect, test } from 'vitest'
import { Footer } from './footer.js'
import { MultiTargetCommit } from './multi-target-commit.js'
import { TargetSection } from './target-section.js'
import { Target } from './target.js'

describe('MultiTargetCommit', () => {
  test('make creates valid multi-target commit', () => {
    const commit = MultiTargetCommit.make({
      targets: [
        Target.make({ type: 'feat', scope: 'core', breaking: true }),
        Target.make({ type: 'fix', scope: 'cli', breaking: false }),
      ],
      message: 'breaking core change with cli fix',
      summary: Option.none(),
      sections: {},
    })
    expect(commit._tag).toBe('MultiTarget')
    expect(commit.targets).toHaveLength(2)
    expect(commit.targets[0].type).toBe('feat')
    expect(commit.targets[0].breaking).toBe(true)
    expect(commit.targets[1].type).toBe('fix')
    expect(commit.targets[1].breaking).toBe(false)
  })

  test('make creates commit with summary and sections', () => {
    const commit = MultiTargetCommit.make({
      targets: [
        Target.make({ type: 'feat', scope: 'core', breaking: true }),
        Target.make({ type: 'fix', scope: 'arr', breaking: false }),
      ],
      message: 'major refactor',
      summary: Option.some('This affects multiple packages.'),
      sections: {
        core: TargetSection.make({
          body: 'Core changes here.',
          footers: [
            Footer.make({ token: 'BREAKING CHANGE', value: 'removed X' }),
          ],
        }),
        arr: TargetSection.make({
          body: 'Arr changes here.',
          footers: [],
        }),
      },
    })
    expect(Option.isSome(commit.summary)).toBe(true)
    expect(commit.sections['core'].body).toBe('Core changes here.')
    expect(commit.sections['arr'].footers).toHaveLength(0)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm vitest run packages/conventional-commits/src/multi-target-commit.test.ts
```

Expected: FAIL

**Step 3: Write implementation**

Create `packages/conventional-commits/src/multi-target-commit.ts`:

````typescript
import { Schema } from 'effect'
import { TargetSection } from './target-section.js'
import { Target } from './target.js'

/**
 * An extended conventional commit for monorepos where each target can have
 * its own type and breaking indicator.
 *
 * Examples:
 * - `feat(core!), fix(cli): msg` - core is breaking feat, cli is non-breaking fix
 * - `feat(core), feat(arr)!: msg` - both are breaking feats (! before : applies to all)
 *
 * Body structure:
 * ```
 * feat(core!), fix(arr): short description
 *
 * Optional summary before any ## heading.
 *
 * ## core
 * Per-package body for core.
 *
 * BREAKING CHANGE: details
 *
 * ## arr
 * Per-package body for arr.
 * ```
 */
export class MultiTargetCommit
  extends Schema.TaggedClass<MultiTargetCommit>()('MultiTarget', {
    /** Targets with independent type/scope/breaking */
    targets: Schema.NonEmptyArray(Target),
    /** Commit message (first line after type-scope groups) */
    message: Schema.String,
    /** Optional summary text (before any ## heading) */
    summary: Schema.OptionFromNullOr(Schema.String),
    /** Per-package sections keyed by scope name */
    sections: Schema.Record({ key: Schema.String, value: TargetSection }),
  })
{}
````

**Step 4: Run test to verify it passes**

```bash
pnpm vitest run packages/conventional-commits/src/multi-target-commit.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/conventional-commits/src/multi-target-commit.ts packages/conventional-commits/src/multi-target-commit.test.ts
git commit -m "feat(conventional-commits): add MultiTargetCommit schema class"
```

---

### Task 1.7: Define ConventionalCommit Union Type

**Files:**

- Create: `packages/conventional-commits/src/commit.ts`
- Test: `packages/conventional-commits/src/commit.test.ts`

**Step 1: Write the failing test**

Create `packages/conventional-commits/src/commit.test.ts`:

```typescript
import { Option, Schema } from 'effect'
import { describe, expect, test } from 'vitest'
import { ConventionalCommit, isMultiTarget, isSingleTarget } from './commit.js'
import { MultiTargetCommit } from './multi-target-commit.js'
import { SingleTargetCommit } from './single-target-commit.js'
import { Target } from './target.js'

describe('ConventionalCommit', () => {
  test('union accepts SingleTargetCommit', () => {
    const single = SingleTargetCommit.make({
      type: 'feat',
      scopes: ['core'],
      breaking: false,
      message: 'add feature',
      body: Option.none(),
      footers: [],
    })
    expect(Schema.is(ConventionalCommit)(single)).toBe(true)
  })

  test('union accepts MultiTargetCommit', () => {
    const multi = MultiTargetCommit.make({
      targets: [Target.make({ type: 'feat', scope: 'core', breaking: true })],
      message: 'breaking change',
      summary: Option.none(),
      sections: {},
    })
    expect(Schema.is(ConventionalCommit)(multi)).toBe(true)
  })

  test('isSingleTarget type guard works', () => {
    const single = SingleTargetCommit.make({
      type: 'feat',
      scopes: [],
      breaking: false,
      message: 'msg',
      body: Option.none(),
      footers: [],
    })
    expect(isSingleTarget(single)).toBe(true)
    expect(isMultiTarget(single)).toBe(false)
  })

  test('isMultiTarget type guard works', () => {
    const multi = MultiTargetCommit.make({
      targets: [Target.make({ type: 'fix', scope: 'cli', breaking: false })],
      message: 'msg',
      summary: Option.none(),
      sections: {},
    })
    expect(isMultiTarget(multi)).toBe(true)
    expect(isSingleTarget(multi)).toBe(false)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm vitest run packages/conventional-commits/src/commit.test.ts
```

Expected: FAIL

**Step 3: Write implementation**

Create `packages/conventional-commits/src/commit.ts`:

```typescript
import { Schema } from 'effect'
import { MultiTargetCommit } from './multi-target-commit.js'
import { SingleTargetCommit } from './single-target-commit.js'

/**
 * A conventional commit—either single-target (standard CC) or multi-target (extended for monorepos).
 */
export const ConventionalCommit = Schema.Union(
  SingleTargetCommit,
  MultiTargetCommit,
)

/**
 * Type alias for the ConventionalCommit union.
 */
export type ConventionalCommit = Schema.Schema.Type<typeof ConventionalCommit>

/**
 * Type guard for SingleTargetCommit.
 */
export const isSingleTarget = (
  commit: ConventionalCommit,
): commit is SingleTargetCommit => commit._tag === 'SingleTarget'

/**
 * Type guard for MultiTargetCommit.
 */
export const isMultiTarget = (
  commit: ConventionalCommit,
): commit is MultiTargetCommit => commit._tag === 'MultiTarget'
```

**Step 4: Run test to verify it passes**

```bash
pnpm vitest run packages/conventional-commits/src/commit.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/conventional-commits/src/commit.ts packages/conventional-commits/src/commit.test.ts
git commit -m "feat(conventional-commits): add ConventionalCommit union type"
```

---

### Task 1.8: Implement Title Parser for SingleTarget

**Files:**

- Create: `packages/conventional-commits/src/parse/title.ts`
- Test: `packages/conventional-commits/src/parse/title.test.ts`

**Step 1: Write the failing test**

Create `packages/conventional-commits/src/parse/title.test.ts`:

```typescript
import { Effect, Exit } from 'effect'
import { describe, expect, test } from 'vitest'
import { parseTitle } from './title.js'

describe('parseTitle', () => {
  describe('SingleTarget parsing', () => {
    test('parses type only: "feat: message"', async () => {
      const result = await Effect.runPromiseExit(
        parseTitle('feat: add feature'),
      )
      expect(Exit.isSuccess(result)).toBe(true)
      if (Exit.isSuccess(result)) {
        expect(result.value._tag).toBe('SingleTarget')
        expect(result.value.type).toBe('feat')
        expect(result.value.message).toBe('add feature')
        if (result.value._tag === 'SingleTarget') {
          expect(result.value.scopes).toEqual([])
          expect(result.value.breaking).toBe(false)
        }
      }
    })

    test('parses type with scope: "feat(core): message"', async () => {
      const result = await Effect.runPromiseExit(
        parseTitle('feat(core): add feature'),
      )
      expect(Exit.isSuccess(result)).toBe(true)
      if (Exit.isSuccess(result) && result.value._tag === 'SingleTarget') {
        expect(result.value.scopes).toEqual(['core'])
      }
    })

    test('parses multiple scopes: "feat(core, cli): message"', async () => {
      const result = await Effect.runPromiseExit(
        parseTitle('feat(core, cli): add feature'),
      )
      expect(Exit.isSuccess(result)).toBe(true)
      if (Exit.isSuccess(result) && result.value._tag === 'SingleTarget') {
        expect(result.value.scopes).toEqual(['core', 'cli'])
      }
    })

    test('parses breaking with !: "feat(core)!: message"', async () => {
      const result = await Effect.runPromiseExit(
        parseTitle('feat(core)!: breaking change'),
      )
      expect(Exit.isSuccess(result)).toBe(true)
      if (Exit.isSuccess(result) && result.value._tag === 'SingleTarget') {
        expect(result.value.breaking).toBe(true)
      }
    })

    test('parses breaking inside scope: "feat(core!): message"', async () => {
      const result = await Effect.runPromiseExit(
        parseTitle('feat(core!): breaking change'),
      )
      expect(Exit.isSuccess(result)).toBe(true)
      if (Exit.isSuccess(result) && result.value._tag === 'SingleTarget') {
        expect(result.value.breaking).toBe(true)
      }
    })
  })

  describe('MultiTarget parsing', () => {
    test('parses different types: "feat(core), fix(cli): message"', async () => {
      const result = await Effect.runPromiseExit(
        parseTitle('feat(core), fix(cli): multi change'),
      )
      expect(Exit.isSuccess(result)).toBe(true)
      if (Exit.isSuccess(result)) {
        expect(result.value._tag).toBe('MultiTarget')
        if (result.value._tag === 'MultiTarget') {
          expect(result.value.targets).toHaveLength(2)
          expect(result.value.targets[0].type).toBe('feat')
          expect(result.value.targets[0].scope).toBe('core')
          expect(result.value.targets[1].type).toBe('fix')
          expect(result.value.targets[1].scope).toBe('cli')
        }
      }
    })

    test('parses per-scope breaking: "feat(core!), fix(cli): message"', async () => {
      const result = await Effect.runPromiseExit(
        parseTitle('feat(core!), fix(cli): change'),
      )
      expect(Exit.isSuccess(result)).toBe(true)
      if (Exit.isSuccess(result) && result.value._tag === 'MultiTarget') {
        expect(result.value.targets[0].breaking).toBe(true)
        expect(result.value.targets[1].breaking).toBe(false)
      }
    })

    test('parses global breaking: "feat(core), fix(cli)!: message"', async () => {
      const result = await Effect.runPromiseExit(
        parseTitle('feat(core), fix(cli)!: change'),
      )
      expect(Exit.isSuccess(result)).toBe(true)
      if (Exit.isSuccess(result) && result.value._tag === 'MultiTarget') {
        expect(result.value.targets[0].breaking).toBe(true)
        expect(result.value.targets[1].breaking).toBe(true)
      }
    })
  })

  describe('error cases', () => {
    test('rejects invalid format', async () => {
      const result = await Effect.runPromiseExit(
        parseTitle('not a valid commit'),
      )
      expect(Exit.isFailure(result)).toBe(true)
    })

    test('rejects empty message', async () => {
      const result = await Effect.runPromiseExit(parseTitle('feat:'))
      expect(Exit.isFailure(result)).toBe(true)
    })
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm vitest run packages/conventional-commits/src/parse/title.test.ts
```

Expected: FAIL

**Step 3: Write implementation**

Create `packages/conventional-commits/src/parse/title.ts`:

```typescript
import { Data, Effect, Option } from 'effect'
import { MultiTargetCommit } from '../multi-target-commit.js'
import { SingleTargetCommit } from '../single-target-commit.js'
import { Target } from '../target.js'

/**
 * Error parsing a conventional commit title.
 */
export class ParseTitleError extends Data.TaggedError('ParseTitleError')<{
  readonly message: string
  readonly input: string
}> {}

/**
 * Parsed title result—either SingleTarget or MultiTarget (without body/footers yet).
 */
export type ParsedTitle = SingleTargetCommit | MultiTargetCommit

// Regex for a single type-scope group: type(scope!, scope2)?!?
const TYPE_SCOPE_PATTERN = /^([a-z]+)(?:\(([^)]+)\))?(!)?$/

/**
 * Parse a conventional commit title line.
 *
 * SingleTarget when:
 * - Single type with zero or more scopes
 * - All scopes get same type and breaking
 *
 * MultiTarget when:
 * - Multiple comma-separated type(scope) groups
 * - OR same type but different breaking per scope
 */
export const parseTitle = (
  title: string,
): Effect.Effect<ParsedTitle, ParseTitleError> =>
  Effect.gen(function*() {
    const trimmed = title.trim()

    // Split on `: ` to get header and message
    const colonIndex = trimmed.indexOf(':')
    if (colonIndex === -1) {
      return yield* Effect.fail(
        new ParseTitleError({
          message: 'Missing colon separator',
          input: title,
        }),
      )
    }

    const header = trimmed.slice(0, colonIndex).trim()
    const message = trimmed.slice(colonIndex + 1).trim()

    if (!message) {
      return yield* Effect.fail(
        new ParseTitleError({ message: 'Empty message', input: title }),
      )
    }

    // Check for global breaking indicator (! before :)
    const globalBreaking = header.endsWith('!')
    const headerWithoutGlobalBreaking = globalBreaking
      ? header.slice(0, -1)
      : header

    // Split by `, ` to detect multiple type-scope groups
    const groups = headerWithoutGlobalBreaking.split(/,\s*/)

    if (groups.length === 1) {
      // Potentially SingleTarget
      const parsed = parseTypeScopeGroup(groups[0])
      if (!parsed) {
        return yield* Effect.fail(
          new ParseTitleError({
            message: 'Invalid type-scope format',
            input: title,
          }),
        )
      }

      const { type, scopes, perScopeBreaking } = parsed
      const breaking = globalBreaking || perScopeBreaking.some(Boolean)

      // If we have per-scope breaking markers on individual scopes, it's still SingleTarget
      // because they all share the same type
      return SingleTargetCommit.make({
        type,
        scopes,
        breaking,
        message,
        body: Option.none(),
        footers: [],
      })
    }

    // Multiple groups = MultiTarget
    const targets: Target[] = []
    for (const group of groups) {
      const parsed = parseTypeScopeGroup(group)
      if (!parsed) {
        return yield* Effect.fail(
          new ParseTitleError({
            message: `Invalid type-scope group: ${group}`,
            input: title,
          }),
        )
      }

      const { type, scopes, perScopeBreaking } = parsed

      // Each scope in the group becomes a Target
      if (scopes.length === 0) {
        return yield* Effect.fail(
          new ParseTitleError({
            message: 'MultiTarget commits require scopes',
            input: title,
          }),
        )
      }

      for (let i = 0; i < scopes.length; i++) {
        targets.push(
          Target.make({
            type,
            scope: scopes[i],
            breaking: globalBreaking || perScopeBreaking[i] || false,
          }),
        )
      }
    }

    if (targets.length === 0) {
      return yield* Effect.fail(
        new ParseTitleError({ message: 'No targets found', input: title }),
      )
    }

    return MultiTargetCommit.make({
      targets: targets as [Target, ...Target[]],
      message,
      summary: Option.none(),
      sections: {},
    })
  })

interface ParsedGroup {
  type: string
  scopes: string[]
  perScopeBreaking: boolean[]
}

const parseTypeScopeGroup = (group: string): ParsedGroup | null => {
  const match = group.match(TYPE_SCOPE_PATTERN)
  if (!match) return null

  const [, type, scopesPart, groupBreaking] = match

  if (!scopesPart) {
    // No scopes: "feat" or "feat!"
    return {
      type,
      scopes: [],
      perScopeBreaking: [],
    }
  }

  // Parse scopes, checking for per-scope ! markers
  const scopes: string[] = []
  const perScopeBreaking: boolean[] = []

  for (const scope of scopesPart.split(/,\s*/)) {
    const scopeTrimmed = scope.trim()
    if (scopeTrimmed.endsWith('!')) {
      scopes.push(scopeTrimmed.slice(0, -1))
      perScopeBreaking.push(true)
    } else {
      scopes.push(scopeTrimmed)
      perScopeBreaking.push(groupBreaking === '!')
    }
  }

  return { type, scopes, perScopeBreaking }
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm vitest run packages/conventional-commits/src/parse/title.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/conventional-commits/src/parse/
git commit -m "feat(conventional-commits): add title parser"
```

---

### Task 1.9: Update Package Exports

**Files:**

- Modify: `packages/conventional-commits/src/__.ts`
- Modify: `packages/conventional-commits/src/_.ts`

**Step 1: Update namespace file**

Replace `packages/conventional-commits/src/__.ts`:

```typescript
export {
  ConventionalCommit,
  type ConventionalCommit as ConventionalCommitType,
  isMultiTarget,
  isSingleTarget,
} from './commit.js'
export { Footer } from './footer.js'
export { MultiTargetCommit } from './multi-target-commit.js'
export { parseTitle, ParseTitleError } from './parse/title.js'
export { SingleTargetCommit } from './single-target-commit.js'
export { TargetSection } from './target-section.js'
export { Target } from './target.js'
```

**Step 2: Update barrel file**

Replace `packages/conventional-commits/src/_.ts`:

```typescript
export * as CC from './__.js'
```

**Step 3: Run all package tests**

```bash
pnpm vitest run packages/conventional-commits/
```

Expected: All tests pass

**Step 4: Build package**

```bash
pnpm turbo run build --filter=@kitz/conventional-commits
```

Expected: Build succeeds

**Step 5: Commit**

```bash
git add packages/conventional-commits/src/
git commit -m "feat(conventional-commits): export all types and parser"
```

---

## Phase 2: @kitz/git

Effect-wrapped git operations. Built on simple-git.

### Task 2.1: Create Package Scaffold

**Step 1: Run package creation script**

```bash
pnpm tsx .claude/skills/creating-packages/scripts/create-package.ts git
```

**Step 2: Add simple-git dependency**

```bash
cd packages/git && pnpm add simple-git
```

**Step 3: Install and commit**

```bash
pnpm install
git add packages/git/
git commit -m "feat(git): scaffold package with simple-git"
```

---

### Task 2.2: Implement Git Service with Tag Operations

**Files:**

- Create: `packages/git/src/git.ts`
- Test: `packages/git/src/git.test.ts`

**Step 1: Write the failing test**

Create `packages/git/src/git.test.ts`:

```typescript
import { Effect, Layer } from 'effect'
import { describe, expect, test } from 'vitest'
import { Git, GitLive } from './git.js'

describe('Git', () => {
  // These tests require a real git repo, so we test in the current repo
  const runWithGit = <A, E>(effect: Effect.Effect<A, E, Git>) =>
    Effect.runPromise(Effect.provide(effect, GitLive))

  test('getTags returns array of tags', async () => {
    const tags = await runWithGit(
      Effect.gen(function*() {
        const git = yield* Git
        return yield* git.getTags()
      }),
    )
    expect(Array.isArray(tags)).toBe(true)
  })

  test('getCurrentBranch returns branch name', async () => {
    const branch = await runWithGit(
      Effect.gen(function*() {
        const git = yield* Git
        return yield* git.getCurrentBranch()
      }),
    )
    expect(typeof branch).toBe('string')
    expect(branch.length).toBeGreaterThan(0)
  })

  test('getCommitsSince returns commits', async () => {
    const commits = await runWithGit(
      Effect.gen(function*() {
        const git = yield* Git
        // Get commits since beginning (no tag)
        return yield* git.getCommitsSince(undefined)
      }),
    )
    expect(Array.isArray(commits)).toBe(true)
    if (commits.length > 0) {
      expect(commits[0]).toHaveProperty('hash')
      expect(commits[0]).toHaveProperty('message')
    }
  })

  test('isClean returns boolean', async () => {
    const clean = await runWithGit(
      Effect.gen(function*() {
        const git = yield* Git
        return yield* git.isClean()
      }),
    )
    expect(typeof clean).toBe('boolean')
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm vitest run packages/git/src/git.test.ts
```

Expected: FAIL

**Step 3: Write implementation**

Create `packages/git/src/git.ts`:

```typescript
import { Context, Data, Effect, Layer } from 'effect'
import simpleGit, { type SimpleGit } from 'simple-git'

/**
 * Git operation error.
 */
export class GitError extends Data.TaggedError('GitError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

/**
 * A commit from git log.
 */
export interface Commit {
  readonly hash: string
  readonly message: string
  readonly body: string
  readonly author: string
  readonly date: string
}

/**
 * Git service interface.
 */
export interface GitService {
  /** Get all tags in the repository */
  readonly getTags: () => Effect.Effect<string[], GitError>

  /** Get the current branch name */
  readonly getCurrentBranch: () => Effect.Effect<string, GitError>

  /** Get commits since a tag (or all commits if tag is undefined) */
  readonly getCommitsSince: (
    tag: string | undefined,
  ) => Effect.Effect<Commit[], GitError>

  /** Check if the working tree is clean */
  readonly isClean: () => Effect.Effect<boolean, GitError>

  /** Create a new tag */
  readonly createTag: (
    tag: string,
    message?: string,
  ) => Effect.Effect<void, GitError>

  /** Get the repository root path */
  readonly getRoot: () => Effect.Effect<string, GitError>
}

/**
 * Git service tag.
 */
export class Git extends Context.Tag('Git')<Git, GitService>() {}

const makeGitService = (git: SimpleGit): GitService => ({
  getTags: () =>
    Effect.tryPromise({
      try: async () => {
        const result = await git.tags()
        return result.all
      },
      catch: (error) =>
        new GitError({ message: 'Failed to get tags', cause: error }),
    }),

  getCurrentBranch: () =>
    Effect.tryPromise({
      try: async () => {
        const result = await git.branch()
        return result.current
      },
      catch: (error) =>
        new GitError({ message: 'Failed to get current branch', cause: error }),
    }),

  getCommitsSince: (tag) =>
    Effect.tryPromise({
      try: async () => {
        const range = tag ? `${tag}..HEAD` : undefined
        const log = await git.log(range ? { from: tag, to: 'HEAD' } : undefined)
        return log.all.map((entry) => ({
          hash: entry.hash,
          message: entry.message,
          body: entry.body,
          author: entry.author_name,
          date: entry.date,
        }))
      },
      catch: (error) =>
        new GitError({ message: 'Failed to get commits', cause: error }),
    }),

  isClean: () =>
    Effect.tryPromise({
      try: async () => {
        const status = await git.status()
        return status.isClean()
      },
      catch: (error) =>
        new GitError({ message: 'Failed to check status', cause: error }),
    }),

  createTag: (tag, message) =>
    Effect.tryPromise({
      try: async () => {
        if (message) {
          await git.tag(['-a', tag, '-m', message])
        } else {
          await git.tag([tag])
        }
      },
      catch: (error) =>
        new GitError({ message: `Failed to create tag ${tag}`, cause: error }),
    }),

  getRoot: () =>
    Effect.tryPromise({
      try: async () => {
        const root = await git.revparse(['--show-toplevel'])
        return root.trim()
      },
      catch: (error) =>
        new GitError({
          message: 'Failed to get repository root',
          cause: error,
        }),
    }),
})

/**
 * Live implementation of Git service using simple-git.
 */
export const GitLive = Layer.sync(Git, () => makeGitService(simpleGit()))

/**
 * Create a Git service for a specific directory.
 */
export const makeGitLive = (cwd: string) =>
  Layer.sync(Git, () => makeGitService(simpleGit(cwd)))
```

**Step 4: Run test to verify it passes**

```bash
pnpm vitest run packages/git/src/git.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/git/src/
git commit -m "feat(git): add Git service with tag and commit operations"
```

---

### Task 2.3: Update Git Package Exports

**Files:**

- Modify: `packages/git/src/__.ts`
- Modify: `packages/git/src/_.ts`

**Step 1: Update namespace file**

Replace `packages/git/src/__.ts`:

```typescript
export {
  type Commit,
  Git,
  GitError,
  GitLive,
  type GitService,
  makeGitLive,
} from './git.js'
```

**Step 2: Update barrel file**

Replace `packages/git/src/_.ts`:

```typescript
export * as Git from './__.js'
```

**Step 3: Build and commit**

```bash
pnpm turbo run build --filter=@kitz/git
git add packages/git/src/
git commit -m "feat(git): export Git service"
```

---

## Phase 3: @kitz/changelog (Stub)

For now, create a minimal changelog package. Full implementation can come later.

### Task 3.1: Create Changelog Package Stub

**Step 1: Create package**

```bash
pnpm tsx .claude/skills/creating-packages/scripts/create-package.ts changelog
```

**Step 2: Add dependencies**

```bash
cd packages/changelog && pnpm add @kitz/conventional-commits @kitz/semver
pnpm install
```

**Step 3: Create minimal implementation**

Create `packages/changelog/src/changelog.ts`:

```typescript
import type { CC } from '@kitz/conventional-commits'

/**
 * A changelog entry for a single version.
 */
export interface ChangelogEntry {
  readonly version: string
  readonly date: string
  readonly commits: CC.ConventionalCommitType[]
}

/**
 * A changelog containing entries for multiple versions.
 */
export interface Changelog {
  readonly entries: ChangelogEntry[]
}

/**
 * Create a changelog from commits.
 */
export const fromCommits = (
  commits: CC.ConventionalCommitType[],
  version: string,
): Changelog => ({
  entries: [
    {
      version,
      date: new Date().toISOString().split('T')[0],
      commits,
    },
  ],
})

/**
 * Render changelog to markdown.
 */
export const toMarkdown = (changelog: Changelog): string => {
  const lines: string[] = []

  for (const entry of changelog.entries) {
    lines.push(`## ${entry.version}`)
    lines.push('')

    const features = entry.commits.filter(
      (c) =>
        (c._tag === 'SingleTarget' && c.type === 'feat')
        || (c._tag === 'MultiTarget'
          && c.targets.some((t) => t.type === 'feat')),
    )

    const fixes = entry.commits.filter(
      (c) =>
        (c._tag === 'SingleTarget' && c.type === 'fix')
        || (c._tag === 'MultiTarget'
          && c.targets.some((t) => t.type === 'fix')),
    )

    if (features.length > 0) {
      lines.push('### Features')
      lines.push('')
      for (const commit of features) {
        lines.push(`- ${commit.message}`)
      }
      lines.push('')
    }

    if (fixes.length > 0) {
      lines.push('### Fixes')
      lines.push('')
      for (const commit of fixes) {
        lines.push(`- ${commit.message}`)
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}
```

**Step 4: Update exports**

Replace `packages/changelog/src/__.ts`:

```typescript
export {
  type Changelog,
  type ChangelogEntry,
  fromCommits,
  toMarkdown,
} from './changelog.js'
```

Replace `packages/changelog/src/_.ts`:

```typescript
export * as Changelog from './__.js'
```

**Step 5: Build and commit**

```bash
pnpm turbo run build --filter=@kitz/changelog
git add packages/changelog/
git commit -m "feat(changelog): add minimal changelog package"
```

---

## Phase 4: @kitz/npm-registry (Stub)

Minimal npm registry package for reading package info.

### Task 4.1: Create npm-registry Package Stub

**Step 1: Create package**

```bash
pnpm tsx .claude/skills/creating-packages/scripts/create-package.ts npm-registry
```

**Step 2: Add dependencies**

```bash
cd packages/npm-registry && pnpm add @vltpkg/registry-client
pnpm install
```

**Step 3: Create minimal implementation**

Create `packages/npm-registry/src/npm-registry.ts`:

```typescript
import { Context, Data, Effect, Layer } from 'effect'

/**
 * npm registry operation error.
 */
export class NpmRegistryError extends Data.TaggedError('NpmRegistryError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

/**
 * npm registry service interface.
 */
export interface NpmRegistryService {
  /** Get all versions of a package */
  readonly getVersions: (
    name: string,
  ) => Effect.Effect<string[], NpmRegistryError>

  /** Get the latest version of a package */
  readonly getLatestVersion: (
    name: string,
  ) => Effect.Effect<string | undefined, NpmRegistryError>

  /** Get dist-tags for a package */
  readonly getDistTags: (
    name: string,
  ) => Effect.Effect<Record<string, string>, NpmRegistryError>
}

/**
 * npm registry service tag.
 */
export class NpmRegistry
  extends Context.Tag('NpmRegistry')<NpmRegistry, NpmRegistryService>()
{}

/**
 * Live implementation using @vltpkg/registry-client.
 */
export const NpmRegistryLive = Layer.sync(NpmRegistry, () => ({
  getVersions: (name) =>
    Effect.tryPromise({
      try: async () => {
        const response = await fetch(`https://registry.npmjs.org/${name}`)
        if (!response.ok) {
          if (response.status === 404) return []
          throw new Error(`HTTP ${response.status}`)
        }
        const data = await response.json() as {
          versions?: Record<string, unknown>
        }
        return Object.keys(data.versions ?? {})
      },
      catch: (error) =>
        new NpmRegistryError({
          message: `Failed to get versions for ${name}`,
          cause: error,
        }),
    }),

  getLatestVersion: (name) =>
    Effect.tryPromise({
      try: async () => {
        const response = await fetch(`https://registry.npmjs.org/${name}`)
        if (!response.ok) {
          if (response.status === 404) return undefined
          throw new Error(`HTTP ${response.status}`)
        }
        const data = await response.json() as {
          'dist-tags'?: { latest?: string }
        }
        return data['dist-tags']?.latest
      },
      catch: (error) =>
        new NpmRegistryError({
          message: `Failed to get latest version for ${name}`,
          cause: error,
        }),
    }),

  getDistTags: (name) =>
    Effect.tryPromise({
      try: async () => {
        const response = await fetch(`https://registry.npmjs.org/${name}`)
        if (!response.ok) {
          if (response.status === 404) return {}
          throw new Error(`HTTP ${response.status}`)
        }
        const data = await response.json() as {
          'dist-tags'?: Record<string, string>
        }
        return data['dist-tags'] ?? {}
      },
      catch: (error) =>
        new NpmRegistryError({
          message: `Failed to get dist-tags for ${name}`,
          cause: error,
        }),
    }),
}))
```

**Step 4: Update exports and build**

Replace `packages/npm-registry/src/__.ts`:

```typescript
export {
  NpmRegistry,
  NpmRegistryError,
  NpmRegistryLive,
  type NpmRegistryService,
} from './npm-registry.js'
```

Replace `packages/npm-registry/src/_.ts`:

```typescript
export * as NpmRegistry from './__.js'
```

**Step 5: Build and commit**

```bash
pnpm turbo run build --filter=@kitz/npm-registry
git add packages/npm-registry/
git commit -m "feat(npm-registry): add minimal npm registry package"
```

---

## Phase 5: @kitz/release (Core)

The main release orchestration package.

### Task 5.1: Create Release Package

**Step 1: Create package**

```bash
pnpm tsx .claude/skills/creating-packages/scripts/create-package.ts release
```

**Step 2: Add dependencies**

```bash
cd packages/release && pnpm add @kitz/git @kitz/conventional-commits @kitz/changelog @kitz/npm-registry @kitz/semver @kitz/pkg @kitz/conf @kitz/oak
pnpm install
```

**Step 3: Commit scaffold**

```bash
git add packages/release/
git commit -m "feat(release): scaffold package with dependencies"
```

---

### Task 5.2: Define Release Config Schema

**Files:**

- Create: `packages/release/src/config.ts`
- Test: `packages/release/src/config.test.ts`

**Step 1: Write the failing test**

Create `packages/release/src/config.test.ts`:

```typescript
import { Effect, Schema } from 'effect'
import { describe, expect, test } from 'vitest'
import { defineConfig, ReleaseConfig } from './config.js'

describe('ReleaseConfig', () => {
  test('decodes valid config', async () => {
    const config = {
      trunk: 'main',
      npmTag: 'latest',
      previewTag: 'next',
    }
    const result = Schema.decodeUnknownSync(ReleaseConfig)(config)
    expect(result.trunk).toBe('main')
  })

  test('applies defaults', async () => {
    const result = Schema.decodeUnknownSync(ReleaseConfig)({})
    expect(result.trunk).toBe('main')
    expect(result.npmTag).toBe('latest')
    expect(result.previewTag).toBe('next')
    expect(result.skipNpm).toBe(false)
  })

  test('defineConfig returns typed config', () => {
    const config = defineConfig({
      trunk: 'master',
      packages: {
        core: '@myorg/core',
      },
    })
    expect(config.trunk).toBe('master')
    expect(config.packages?.core).toBe('@myorg/core')
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm vitest run packages/release/src/config.test.ts
```

Expected: FAIL

**Step 3: Write implementation**

Create `packages/release/src/config.ts`:

```typescript
import { Schema } from 'effect'

/**
 * Release configuration schema.
 */
export class ReleaseConfig
  extends Schema.Class<ReleaseConfig>('ReleaseConfig')({
    /** Trunk branch name */
    trunk: Schema.optionalWith(Schema.String, { default: () => 'main' }),
    /** Default npm dist-tag for stable releases */
    npmTag: Schema.optionalWith(Schema.String, { default: () => 'latest' }),
    /** npm dist-tag for preview releases */
    previewTag: Schema.optionalWith(Schema.String, { default: () => 'next' }),
    /** Skip npm publish */
    skipNpm: Schema.optionalWith(Schema.Boolean, { default: () => false }),
    /** Scope to package name mapping (overrides auto-discovery) */
    packages: Schema.optional(
      Schema.Record({ key: Schema.String, value: Schema.String }),
    ),
  })
{}

/**
 * Input type for defineConfig helper.
 */
export type ReleaseConfigInput = Schema.Schema.Encoded<typeof ReleaseConfig>

/**
 * Helper to define release configuration with type safety.
 */
export const defineConfig = (config: ReleaseConfigInput): ReleaseConfigInput =>
  config
```

**Step 4: Run test to verify it passes**

```bash
pnpm vitest run packages/release/src/config.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/release/src/config.ts packages/release/src/config.test.ts
git commit -m "feat(release): add ReleaseConfig schema"
```

---

### Task 5.3: Implement Package Discovery

**Files:**

- Create: `packages/release/src/discover.ts`
- Test: `packages/release/src/discover.test.ts`

**Step 1: Write the failing test**

Create `packages/release/src/discover.test.ts`:

```typescript
import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import { discoverPackages, type PackageInfo } from './discover.js'

describe('discoverPackages', () => {
  test('discovers packages in monorepo', async () => {
    // Test against the actual kitz monorepo
    const packages = await Effect.runPromise(
      discoverPackages(process.cwd()),
    )

    expect(Array.isArray(packages)).toBe(true)
    expect(packages.length).toBeGreaterThan(0)

    // Should find at least the release package we're building
    const releasePackage = packages.find((p) => p.name === '@kitz/release')
    expect(releasePackage).toBeDefined()
    expect(releasePackage?.scope).toBe('release')
  })

  test('package info has required fields', async () => {
    const packages = await Effect.runPromise(
      discoverPackages(process.cwd()),
    )

    for (const pkg of packages) {
      expect(pkg).toHaveProperty('name')
      expect(pkg).toHaveProperty('scope')
      expect(pkg).toHaveProperty('path')
      expect(pkg).toHaveProperty('version')
    }
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm vitest run packages/release/src/discover.test.ts
```

Expected: FAIL

**Step 3: Write implementation**

Create `packages/release/src/discover.ts`:

```typescript
import { Data, Effect } from 'effect'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'

/**
 * Error discovering packages.
 */
export class DiscoverError extends Data.TaggedError('DiscoverError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

/**
 * Information about a discovered package.
 */
export interface PackageInfo {
  /** Package name from package.json */
  readonly name: string
  /** Scope (directory name) for commit matching */
  readonly scope: string
  /** Absolute path to package directory */
  readonly path: string
  /** Current version from package.json */
  readonly version: string
  /** Workspace dependencies (packages depending on this one) */
  readonly workspaceDeps: string[]
}

/**
 * Discover all packages in a monorepo.
 *
 * Default algorithm:
 * 1. Scan `packages/∗/package.json`
 * 2. Directory name = scope
 * 3. package.json name = package name
 */
export const discoverPackages = (
  root: string,
): Effect.Effect<PackageInfo[], DiscoverError> =>
  Effect.gen(function*() {
    const packagesDir = Path.join(root, 'packages')

    const entries = yield* Effect.tryPromise({
      try: () => Fs.readdir(packagesDir, { withFileTypes: true }),
      catch: (error) =>
        new DiscoverError({
          message: `Failed to read packages directory`,
          cause: error,
        }),
    })

    const packages: PackageInfo[] = []

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const pkgJsonPath = Path.join(packagesDir, entry.name, 'package.json')

      const pkgJson = yield* Effect.tryPromise({
        try: async () => {
          const content = await Fs.readFile(pkgJsonPath, 'utf-8')
          return JSON.parse(content) as {
            name: string
            version: string
            dependencies?: Record<string, string>
            devDependencies?: Record<string, string>
            peerDependencies?: Record<string, string>
          }
        },
        catch: () => null as never,
      }).pipe(Effect.catchAll(() => Effect.succeed(null)))

      if (!pkgJson) continue

      // Find workspace dependencies
      const allDeps = {
        ...pkgJson.dependencies,
        ...pkgJson.devDependencies,
        ...pkgJson.peerDependencies,
      }

      const workspaceDeps = Object.entries(allDeps)
        .filter(([, version]) => version.startsWith('workspace:'))
        .map(([name]) => name)

      packages.push({
        name: pkgJson.name,
        scope: entry.name,
        path: Path.join(packagesDir, entry.name),
        version: pkgJson.version,
        workspaceDeps,
      })
    }

    return packages
  })

/**
 * Build a scope-to-package-name mapping from discovered packages.
 */
export const buildScopeMap = (
  packages: PackageInfo[],
): Record<string, string> => {
  const map: Record<string, string> = {}
  for (const pkg of packages) {
    map[pkg.scope] = pkg.name
  }
  return map
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm vitest run packages/release/src/discover.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/release/src/discover.ts packages/release/src/discover.test.ts
git commit -m "feat(release): add package discovery"
```

---

### Task 5.4: Update Release Package Exports

**Files:**

- Modify: `packages/release/src/__.ts`
- Modify: `packages/release/src/_.ts`

**Step 1: Update exports**

Replace `packages/release/src/__.ts`:

```typescript
export {
  defineConfig,
  ReleaseConfig,
  type ReleaseConfigInput,
} from './config.js'
export {
  buildScopeMap,
  DiscoverError,
  discoverPackages,
  type PackageInfo,
} from './discover.js'
```

Replace `packages/release/src/_.ts`:

```typescript
export * as Release from './__.js'
```

**Step 2: Build all packages**

```bash
pnpm turbo run build
```

**Step 3: Run all tests**

```bash
pnpm vitest run
```

**Step 4: Commit**

```bash
git add packages/release/src/
git commit -m "feat(release): export config and discovery APIs"
```

---

## Next Steps (Future Tasks)

The following tasks are documented but not detailed here. They can be planned in subsequent iterations:

1. **Phase 6: Release Plan Generation** - `release plan stable|preview|pr`
2. **Phase 7: Release Plan Execution** - `release apply`
3. **Phase 8: Status Command** - `release status [pkg]`
4. **Phase 9: CLI Integration** - Wire up commands with @kitz/oak
5. **Phase 10: GitHub Releases** - Create/update GitHub releases
6. **Phase 11: pkg.pr.new Integration** - PR previews

---

## Summary

This plan covers the foundational packages:

| Package                    | Tasks   | Status                        |
| -------------------------- | ------- | ----------------------------- |
| @kitz/conventional-commits | 1.1-1.9 | Schema classes + title parser |
| @kitz/git                  | 2.1-2.3 | Git service with Effect       |
| @kitz/changelog            | 3.1     | Minimal stub                  |
| @kitz/npm-registry         | 4.1     | Minimal stub                  |
| @kitz/release              | 5.1-5.4 | Config + discovery            |

Total: ~25 bite-sized tasks for the foundation. Full CLI and release execution will follow.
