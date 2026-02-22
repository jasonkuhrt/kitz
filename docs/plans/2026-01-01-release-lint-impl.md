# Release Lint Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a linting framework for release validation that checks PR titles against conventional commit conventions.

**Architecture:** Domain-driven module structure under `packages/release/src/api/lint/`. Effect Schema classes for types, Effect services for external dependencies (GitHub, Git). TDD with in-memory test layers.

**Tech Stack:** Effect (Schema, Context, Layer), @kitz/conventional-commits for parsing, @kitz/github for PR operations, @kitz/git for diff detection.

---

## Phase 1: Core Types

### Task 1: Severity Schema

**Files:**

- Create: `packages/release/src/api/lint/severity.ts`
- Test: `packages/release/src/api/lint/severity.test.ts`

**Step 1: Write failing test**

```typescript
// packages/release/src/api/lint/severity.test.ts
import { describe, expect, test } from 'vitest'
import { Severity } from './severity.js'

describe('Severity', () => {
  test('error variant', () => {
    const s = Severity.Error
    expect(s._tag).toBe('Error')
  })

  test('warn variant', () => {
    const s = Severity.Warn
    expect(s._tag).toBe('Warn')
  })

  test('isError predicate', () => {
    expect(Severity.isError(Severity.Error)).toBe(true)
    expect(Severity.isError(Severity.Warn)).toBe(false)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm turbo run test --filter=@kitz/release -- --run src/api/lint/severity.test.ts`
Expected: FAIL - module not found

**Step 3: Write implementation**

```typescript
// packages/release/src/api/lint/severity.ts
import { Data } from 'effect'

const _Error = Data.TaggedClass('Error')<{}>()
const _Warn = Data.TaggedClass('Warn')<{}>()

export type Severity = Error | Warn
export type Error = InstanceType<typeof _Error>
export type Warn = InstanceType<typeof _Warn>

export const Error: Error = new _Error({})
export const Warn: Warn = new _Warn({})

export const isError = (s: Severity): s is Error => s._tag === 'Error'
export const isWarn = (s: Severity): s is Warn => s._tag === 'Warn'
```

**Step 4: Run test to verify it passes**

Run: `pnpm turbo run test --filter=@kitz/release -- --run src/api/lint/severity.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/release/src/api/lint/severity.ts packages/release/src/api/lint/severity.test.ts
git commit -m "$(cat <<'EOF'
feat(release): add Severity type for lint rules

Error causes non-zero exit, Warn allows exit 0.
EOF
)"
```

---

### Task 2: Precondition Schema

**Files:**

- Create: `packages/release/src/api/lint/precondition.ts`
- Test: `packages/release/src/api/lint/precondition.test.ts`

**Step 1: Write failing test**

```typescript
// packages/release/src/api/lint/precondition.test.ts
import { describe, expect, test } from 'vitest'
import { Precondition } from './precondition.js'

describe('Precondition', () => {
  test('HasOpenPR variant', () => {
    const p = Precondition.HasOpenPR
    expect(p._tag).toBe('HasOpenPR')
  })

  test('HasDiff variant', () => {
    const p = Precondition.HasDiff
    expect(p._tag).toBe('HasDiff')
  })

  test('IsMonorepo variant', () => {
    const p = Precondition.IsMonorepo
    expect(p._tag).toBe('IsMonorepo')
  })

  test('HasGitHubAccess variant', () => {
    const p = Precondition.HasGitHubAccess
    expect(p._tag).toBe('HasGitHubAccess')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm turbo run test --filter=@kitz/release -- --run src/api/lint/precondition.test.ts`
Expected: FAIL

**Step 3: Write implementation**

```typescript
// packages/release/src/api/lint/precondition.ts
import { Data } from 'effect'

const _HasOpenPR = Data.TaggedClass('HasOpenPR')<{}>()
const _HasDiff = Data.TaggedClass('HasDiff')<{}>()
const _IsMonorepo = Data.TaggedClass('IsMonorepo')<{}>()
const _HasGitHubAccess = Data.TaggedClass('HasGitHubAccess')<{}>()

export type Precondition = HasOpenPR | HasDiff | IsMonorepo | HasGitHubAccess

export type HasOpenPR = InstanceType<typeof _HasOpenPR>
export type HasDiff = InstanceType<typeof _HasDiff>
export type IsMonorepo = InstanceType<typeof _IsMonorepo>
export type HasGitHubAccess = InstanceType<typeof _HasGitHubAccess>

export const HasOpenPR: HasOpenPR = new _HasOpenPR({})
export const HasDiff: HasDiff = new _HasDiff({})
export const IsMonorepo: IsMonorepo = new _IsMonorepo({})
export const HasGitHubAccess: HasGitHubAccess = new _HasGitHubAccess({})
```

**Step 4: Run test to verify it passes**

Run: `pnpm turbo run test --filter=@kitz/release -- --run src/api/lint/precondition.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/release/src/api/lint/precondition.ts packages/release/src/api/lint/precondition.test.ts
git commit -m "$(cat <<'EOF'
feat(release): add Precondition types for lint rules

HasOpenPR, HasDiff, IsMonorepo, HasGitHubAccess variants.
EOF
)"
```

---

### Task 3: ViolationLocation Schema

**Files:**

- Create: `packages/release/src/api/lint/violation-location.ts`
- Test: `packages/release/src/api/lint/violation-location.test.ts`

**Step 1: Write failing test**

```typescript
// packages/release/src/api/lint/violation-location.test.ts
import { describe, expect, test } from 'vitest'
import { ViolationLocation } from './violation-location.js'

describe('ViolationLocation', () => {
  test('GitHubPullRequest variant', () => {
    const loc = ViolationLocation.GitHubPullRequest({
      owner: 'jasonkuhrt',
      repo: 'kitz',
      number: 42,
    })
    expect(loc._tag).toBe('GitHubPullRequest')
    expect(loc.owner).toBe('jasonkuhrt')
    expect(loc.repo).toBe('kitz')
    expect(loc.number).toBe(42)
  })

  test('GitHubRepository variant', () => {
    const loc = ViolationLocation.GitHubRepository({
      owner: 'jasonkuhrt',
      repo: 'kitz',
    })
    expect(loc._tag).toBe('GitHubRepository')
  })

  test('Git variant', () => {
    const loc = ViolationLocation.Git({
      sha: 'abc123',
      path: '/repo/file.ts',
    })
    expect(loc._tag).toBe('Git')
    expect(loc.sha).toBe('abc123')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm turbo run test --filter=@kitz/release -- --run src/api/lint/violation-location.test.ts`
Expected: FAIL

**Step 3: Write implementation**

```typescript
// packages/release/src/api/lint/violation-location.ts
import { Data } from 'effect'

export type ViolationLocation = GitHubPullRequest | GitHubRepository | Git

export class GitHubPullRequest extends Data.TaggedClass('GitHubPullRequest')<{
  readonly owner: string
  readonly repo: string
  readonly number: number
}> {}

export class GitHubRepository extends Data.TaggedClass('GitHubRepository')<{
  readonly owner: string
  readonly repo: string
}> {}

export class Git extends Data.TaggedClass('Git')<{
  readonly sha: string
  readonly path: string
}> {}
```

**Step 4: Run test to verify it passes**

Run: `pnpm turbo run test --filter=@kitz/release -- --run src/api/lint/violation-location.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/release/src/api/lint/violation-location.ts packages/release/src/api/lint/violation-location.test.ts
git commit -m "$(cat <<'EOF'
feat(release): add ViolationLocation types

GitHubPullRequest, GitHubRepository, Git variants.
EOF
)"
```

---

### Task 4: Violation and Hint Schemas

**Files:**

- Create: `packages/release/src/api/lint/violation.ts`
- Test: `packages/release/src/api/lint/violation.test.ts`

**Step 1: Write failing test**

```typescript
// packages/release/src/api/lint/violation.test.ts
import { describe, expect, test } from 'vitest'
import { ViolationLocation } from './violation-location.js'
import { Hint, Violation } from './violation.js'

describe('Violation', () => {
  test('create with location', () => {
    const loc = ViolationLocation.GitHubPullRequest({
      owner: 'jasonkuhrt',
      repo: 'kitz',
      number: 42,
    })
    const v = Violation.make({ location: loc })
    expect(v.location).toBe(loc)
  })
})

describe('Hint', () => {
  test('create with description', () => {
    const h = Hint.make({ description: 'Try adding a scope' })
    expect(h.description).toBe('Try adding a scope')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm turbo run test --filter=@kitz/release -- --run src/api/lint/violation.test.ts`
Expected: FAIL

**Step 3: Write implementation**

```typescript
// packages/release/src/api/lint/violation.ts
import { Data } from 'effect'
import type { ViolationLocation } from './violation-location.js'

export class Violation extends Data.Class<{
  readonly location: ViolationLocation
}> {}

export class Hint extends Data.Class<{
  readonly description: string
}> {}
```

**Step 4: Run test to verify it passes**

Run: `pnpm turbo run test --filter=@kitz/release -- --run src/api/lint/violation.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/release/src/api/lint/violation.ts packages/release/src/api/lint/violation.test.ts
git commit -m "$(cat <<'EOF'
feat(release): add Violation and Hint types
EOF
)"
```

---

### Task 5: RuleId and RuleDefaults

**Files:**

- Create: `packages/release/src/api/lint/rule.ts`
- Test: `packages/release/src/api/lint/rule.test.ts`

**Step 1: Write failing test**

```typescript
// packages/release/src/api/lint/rule.test.ts
import { describe, expect, test } from 'vitest'
import { RuleDefaults, RuleId } from './rule.js'
import * as Severity from './severity.js'

describe('RuleId', () => {
  test('dot-notation string', () => {
    const id: RuleId = 'pr.type.match-known'
    expect(id.split('.')).toHaveLength(3)
  })
})

describe('RuleDefaults', () => {
  test('create with enabled auto', () => {
    const d = RuleDefaults.make({ enabled: 'auto' })
    expect(d.enabled).toBe('auto')
    expect(d.severity).toBe(Severity.Error)
  })

  test('create with enabled false', () => {
    const d = RuleDefaults.make({ enabled: false })
    expect(d.enabled).toBe(false)
  })

  test('create with severity warn', () => {
    const d = RuleDefaults.make({ severity: Severity.Warn })
    expect(d.severity).toBe(Severity.Warn)
  })

  test('defaults to auto and error', () => {
    const d = RuleDefaults.make({})
    expect(d.enabled).toBe('auto')
    expect(d.severity).toBe(Severity.Error)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm turbo run test --filter=@kitz/release -- --run src/api/lint/rule.test.ts`
Expected: FAIL

**Step 3: Write implementation**

```typescript
// packages/release/src/api/lint/rule.ts
import { Data } from 'effect'
import type { Precondition } from './precondition.js'
import * as Severity from './severity.js'

/** Dot-notation identifier (e.g. 'pr.type.match-known'). */
export type RuleId = string

/** Dot-notation pattern for filtering (e.g. 'pr.*'). */
export type RuleTarget = string

export class RuleDefaults extends Data.Class<{
  readonly enabled: boolean | 'auto'
  readonly severity: Severity.Severity
}> {
  static make(input: Partial<RuleDefaults> = {}): RuleDefaults {
    return new RuleDefaults({
      enabled: input.enabled ?? 'auto',
      severity: input.severity ?? Severity.Error,
    })
  }
}

export interface Rule {
  readonly id: RuleId
  readonly description: string
  readonly preconditions: readonly Precondition[]
  readonly defaults?: Partial<RuleDefaults>
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm turbo run test --filter=@kitz/release -- --run src/api/lint/rule.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/release/src/api/lint/rule.ts packages/release/src/api/lint/rule.test.ts
git commit -m "$(cat <<'EOF'
feat(release): add RuleId, RuleDefaults, Rule types
EOF
)"
```

---

### Task 6: Barrel Export for lint module

**Files:**

- Create: `packages/release/src/api/lint/__.ts`

**Step 1: Create barrel export**

```typescript
// packages/release/src/api/lint/__.ts
export * as Precondition from './precondition.js'
export * as Rule from './rule.js'
export * as Severity from './severity.js'
export * as ViolationLocation from './violation-location.js'
export * as Violation from './violation.js'
```

**Step 2: Run type check**

Run: `pnpm turbo run check:types --filter=@kitz/release`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/release/src/api/lint/__.ts
git commit -m "$(cat <<'EOF'
feat(release): add lint module barrel export
EOF
)"
```

---

## Phase 2: Config Types

### Task 7: RuleConfig Schema

**Files:**

- Create: `packages/release/src/api/lint/config.ts`
- Test: `packages/release/src/api/lint/config.test.ts`

**Step 1: Write failing test**

```typescript
// packages/release/src/api/lint/config.test.ts
import { describe, expect, test } from 'vitest'
import {
  Config,
  resolveConfig,
  ResolvedConfig,
  ResolvedRuleConfig,
  RuleConfigInput,
} from './config.js'
import * as Severity from './severity.js'

describe('RuleConfigInput', () => {
  test('shorthand severity string', () => {
    const input: RuleConfigInput = 'error'
    expect(input).toBe('error')
  })

  test('tuple with options', () => {
    const input: RuleConfigInput = ['warn', { ignore: ['x'] }]
    expect(input[0]).toBe('warn')
    expect(input[1]).toEqual({ ignore: ['x'] })
  })
})

describe('resolveConfig', () => {
  test('empty config returns system defaults', () => {
    const resolved = resolveConfig({})
    expect(resolved.defaults.enabled).toBe('auto')
    expect(resolved.defaults.severity).toBe(Severity.Error)
    expect(Object.keys(resolved.rules)).toHaveLength(0)
  })

  test('global defaults override system defaults', () => {
    const resolved = resolveConfig({
      defaults: { enabled: false },
    })
    expect(resolved.defaults.enabled).toBe(false)
    expect(resolved.defaults.severity).toBe(Severity.Error)
  })

  test('shorthand severity expands to full config', () => {
    const resolved = resolveConfig({
      rules: { 'pr.type.match-known': 'warn' },
    })
    const rule = resolved.rules['pr.type.match-known']
    expect(rule).toBeDefined()
    expect(rule!.overrides.severity).toBe(Severity.Warn)
  })

  test('tuple expands with options', () => {
    const resolved = resolveConfig({
      rules: { 'pr.scope.require': ['error', { min: 1 }] },
    })
    const rule = resolved.rules['pr.scope.require']
    expect(rule).toBeDefined()
    expect(rule!.options).toEqual({ min: 1 })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm turbo run test --filter=@kitz/release -- --run src/api/lint/config.test.ts`
Expected: FAIL

**Step 3: Write implementation**

```typescript
// packages/release/src/api/lint/config.ts
import type { RuleId } from './rule.js'
import * as Severity from './severity.js'

/** Rule-specific options (varies per rule). */
export type RuleConfigOptions = Record<string, unknown>

/** User input format (supports shorthand). */
export type RuleConfigInput =
  | 'error'
  | 'warn'
  | ['error' | 'warn', RuleConfigOptions]
  | RuleConfig

export interface RuleConfig {
  readonly overrides?: {
    readonly enabled?: boolean | 'auto'
    readonly severity?: 'error' | 'warn'
  }
  readonly options?: RuleConfigOptions
}

export interface Config {
  readonly defaults?: {
    readonly enabled?: boolean | 'auto'
    readonly severity?: 'error' | 'warn'
  }
  readonly rules?: Record<RuleId, RuleConfigInput>
}

export interface ResolvedRuleDefaults {
  readonly enabled: boolean | 'auto'
  readonly severity: Severity.Severity
}

export interface ResolvedRuleConfig {
  readonly overrides: ResolvedRuleDefaults
  readonly options: RuleConfigOptions
}

export interface ResolvedConfig {
  readonly defaults: ResolvedRuleDefaults
  readonly rules: Record<RuleId, ResolvedRuleConfig>
}

const SYSTEM_DEFAULTS: ResolvedRuleDefaults = {
  enabled: 'auto',
  severity: Severity.Error,
}

const parseSeverity = (s: 'error' | 'warn'): Severity.Severity =>
  s === 'error' ? Severity.Error : Severity.Warn

const normalizeRuleConfigInput = (
  input: RuleConfigInput,
  globalDefaults: ResolvedRuleDefaults,
): ResolvedRuleConfig => {
  if (input === 'error' || input === 'warn') {
    return {
      overrides: { ...globalDefaults, severity: parseSeverity(input) },
      options: {},
    }
  }

  if (Array.isArray(input)) {
    const [severity, options] = input
    return {
      overrides: { ...globalDefaults, severity: parseSeverity(severity) },
      options: options ?? {},
    }
  }

  return {
    overrides: {
      enabled: input.overrides?.enabled ?? globalDefaults.enabled,
      severity: input.overrides?.severity
        ? parseSeverity(input.overrides.severity)
        : globalDefaults.severity,
    },
    options: input.options ?? {},
  }
}

export const resolveConfig = (config: Config = {}): ResolvedConfig => {
  const defaults: ResolvedRuleDefaults = {
    enabled: config.defaults?.enabled ?? SYSTEM_DEFAULTS.enabled,
    severity: config.defaults?.severity
      ? parseSeverity(config.defaults.severity)
      : SYSTEM_DEFAULTS.severity,
  }

  const rules: Record<RuleId, ResolvedRuleConfig> = {}
  for (const [ruleId, input] of Object.entries(config.rules ?? {})) {
    rules[ruleId] = normalizeRuleConfigInput(input, defaults)
  }

  return { defaults, rules }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm turbo run test --filter=@kitz/release -- --run src/api/lint/config.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/release/src/api/lint/config.ts packages/release/src/api/lint/config.test.ts
git commit -m "$(cat <<'EOF'
feat(release): add lint Config and resolveConfig

Supports shorthand severity, tuples with options, and full config objects.
Four-layer precedence: system → rule.defaults → config.defaults → per-rule.
EOF
)"
```

---

## Phase 3: Report Types

### Task 8: RuleCheckResult and Report

**Files:**

- Create: `packages/release/src/api/lint/report.ts`
- Test: `packages/release/src/api/lint/report.test.ts`

**Step 1: Write failing test**

```typescript
// packages/release/src/api/lint/report.test.ts
import { describe, expect, test } from 'vitest'
import * as Precondition from './precondition.js'
import { Report, RuleCheckResult } from './report.js'
import type { Rule } from './rule.js'
import { ViolationLocation } from './violation-location.js'
import { Violation } from './violation.js'

const mockRule: Rule = {
  id: 'pr.type.match-known',
  description: 'Type in allowed set',
  preconditions: [Precondition.HasOpenPR],
}

describe('RuleCheckResult', () => {
  test('Finished variant without violation', () => {
    const result = RuleCheckResult.Finished({
      rule: mockRule,
      duration: 10,
    })
    expect(result._tag).toBe('Finished')
    expect(result.violation).toBeUndefined()
  })

  test('Finished variant with violation', () => {
    const violation = Violation.make({
      location: ViolationLocation.GitHubPullRequest({
        owner: 'jasonkuhrt',
        repo: 'kitz',
        number: 42,
      }),
    })
    const result = RuleCheckResult.Finished({
      rule: mockRule,
      duration: 10,
      violation,
    })
    expect(result._tag).toBe('Finished')
    expect(result.violation).toBe(violation)
  })

  test('Failed variant', () => {
    const result = RuleCheckResult.Failed({
      rule: mockRule,
      duration: 5,
      error: new Error('oops'),
    })
    expect(result._tag).toBe('Failed')
    expect(result.error.message).toBe('oops')
  })

  test('Skipped variant', () => {
    const result = RuleCheckResult.Skipped({ rule: mockRule })
    expect(result._tag).toBe('Skipped')
  })
})

describe('Report', () => {
  test('create with results', () => {
    const result = RuleCheckResult.Finished({ rule: mockRule, duration: 10 })
    const report = Report.make({ results: [result] })
    expect(report.results).toHaveLength(1)
  })

  test('hasViolations returns true when violations exist', () => {
    const violation = Violation.make({
      location: ViolationLocation.GitHubPullRequest({
        owner: 'a',
        repo: 'b',
        number: 1,
      }),
    })
    const result = RuleCheckResult.Finished({
      rule: mockRule,
      duration: 10,
      violation,
    })
    const report = Report.make({ results: [result] })
    expect(Report.hasViolations(report)).toBe(true)
  })

  test('hasViolations returns false when no violations', () => {
    const result = RuleCheckResult.Finished({ rule: mockRule, duration: 10 })
    const report = Report.make({ results: [result] })
    expect(Report.hasViolations(report)).toBe(false)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm turbo run test --filter=@kitz/release -- --run src/api/lint/report.test.ts`
Expected: FAIL

**Step 3: Write implementation**

```typescript
// packages/release/src/api/lint/report.ts
import { Data } from 'effect'
import type { Rule } from './rule.js'
import type { Violation } from './violation.js'

export type RuleCheckResult = Finished | Failed | Skipped

export class Finished extends Data.TaggedClass('Finished')<{
  readonly rule: Rule
  readonly duration: number
  readonly violation?: Violation
}> {}

export class Failed extends Data.TaggedClass('Failed')<{
  readonly rule: Rule
  readonly duration: number
  readonly error: Error
}> {}

export class Skipped extends Data.TaggedClass('Skipped')<{
  readonly rule: Rule
}> {}

export const RuleCheckResult = {
  Finished: (props: ConstructorParameters<typeof Finished>[0]) =>
    new Finished(props),
  Failed: (props: ConstructorParameters<typeof Failed>[0]) => new Failed(props),
  Skipped: (props: ConstructorParameters<typeof Skipped>[0]) =>
    new Skipped(props),
}

export class Report extends Data.Class<{
  readonly results: readonly RuleCheckResult[]
}> {
  static make(props: { results: readonly RuleCheckResult[] }): Report {
    return new Report(props)
  }
}

export const hasViolations = (report: Report): boolean =>
  report.results.some(
    (r) => r._tag === 'Finished' && r.violation !== undefined,
  )

export const hasErrors = (report: Report): boolean =>
  report.results.some((r) => r._tag === 'Failed')
```

**Step 4: Run test to verify it passes**

Run: `pnpm turbo run test --filter=@kitz/release -- --run src/api/lint/report.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/release/src/api/lint/report.ts packages/release/src/api/lint/report.test.ts
git commit -m "$(cat <<'EOF'
feat(release): add RuleCheckResult and Report types

Finished/Failed/Skipped variants with hasViolations helper.
EOF
)"
```

---

## Phase 4: Check Operation

### Task 9: Rule Registry

**Files:**

- Create: `packages/release/src/api/lint/rules/registry.ts`

**Step 1: Create rule registry**

```typescript
// packages/release/src/api/lint/rules/registry.ts
import * as Precondition from '../precondition.js'
import type { Rule } from '../rule.js'

export const rules: readonly Rule[] = [
  {
    id: 'pr.type.match-known',
    description: 'Type in allowed set (standard or custom)',
    preconditions: [Precondition.HasOpenPR],
  },
  {
    id: 'pr.type.release-kind-match-diff',
    description: 'No-release type cannot have src changes',
    preconditions: [Precondition.HasOpenPR, Precondition.HasDiff],
  },
  {
    id: 'pr.scope.require',
    description: 'At least one scope required',
    preconditions: [Precondition.HasOpenPR],
    defaults: { enabled: false },
  },
  {
    id: 'pr.monorepo.scopes.match-known',
    description: 'Scope(s) exist in package map',
    preconditions: [Precondition.HasOpenPR, Precondition.IsMonorepo],
  },
  {
    id: 'pr.monorepo.scopes.match-affected',
    description: 'Scope(s) match affected packages',
    preconditions: [
      Precondition.HasOpenPR,
      Precondition.IsMonorepo,
      Precondition.HasDiff,
    ],
  },
]

export const findById = (id: string): Rule | undefined =>
  rules.find((r) => r.id === id)

export const filterByPattern = (pattern: string): readonly Rule[] => {
  if (pattern.endsWith('.*')) {
    const prefix = pattern.slice(0, -1) // 'pr.*' → 'pr.'
    return rules.filter((r) => r.id.startsWith(prefix))
  }
  const rule = findById(pattern)
  return rule ? [rule] : []
}
```

**Step 2: Run type check**

Run: `pnpm turbo run check:types --filter=@kitz/release`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/release/src/api/lint/rules/registry.ts
git commit -m "$(cat <<'EOF'
feat(release): add lint rule registry

Static registry of all lint rules with filtering by pattern.
EOF
)"
```

---

### Task 10: Check Operation

**Files:**

- Create: `packages/release/src/api/lint/check.ts`
- Test: `packages/release/src/api/lint/check.test.ts`

**Step 1: Write failing test**

```typescript
// packages/release/src/api/lint/check.test.ts
import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import { check, CheckParams } from './check.js'
import { resolveConfig } from './config.js'
import * as Report from './report.js'

describe('check', () => {
  test('returns empty report when no rules match', async () => {
    const config = resolveConfig({})
    const params: CheckParams = {
      config,
      rules: ['nonexistent.rule'],
    }

    const report = await Effect.runPromise(check(params))
    expect(report.results).toHaveLength(0)
  })

  test('skips rules when preconditions not met and enabled=auto', async () => {
    const config = resolveConfig({})
    const params: CheckParams = {
      config,
      rules: ['pr.type.match-known'],
    }

    // No PR context provided, so HasOpenPR precondition fails
    const report = await Effect.runPromise(check(params))
    expect(report.results).toHaveLength(1)
    expect(report.results[0]?._tag).toBe('Skipped')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm turbo run test --filter=@kitz/release -- --run src/api/lint/check.test.ts`
Expected: FAIL

**Step 3: Write implementation**

```typescript
// packages/release/src/api/lint/check.ts
import { Effect } from 'effect'
import type { ResolvedConfig } from './config.js'
import * as Report from './report.js'
import type { Rule, RuleTarget } from './rule.js'
import * as Registry from './rules/registry.js'

export interface CheckParams {
  readonly config: ResolvedConfig
  readonly rules?: readonly RuleTarget[]
}

const resolveRules = (patterns?: readonly RuleTarget[]): readonly Rule[] => {
  if (!patterns || patterns.length === 0) {
    return Registry.rules
  }
  const resolved = new Set<Rule>()
  for (const pattern of patterns) {
    for (const rule of Registry.filterByPattern(pattern)) {
      resolved.add(rule)
    }
  }
  return [...resolved]
}

const getEffectiveDefaults = (
  rule: Rule,
  config: ResolvedConfig,
): { enabled: boolean | 'auto'; severity: Report.RuleCheckResult } => {
  const ruleConfig = config.rules[rule.id]

  // Precedence: system → rule.defaults → config.defaults → per-rule config
  const enabled = ruleConfig?.overrides.enabled
    ?? rule.defaults?.enabled
    ?? config.defaults.enabled

  return {
    enabled,
    severity: ruleConfig?.overrides.severity ?? config.defaults.severity,
  } as any
}

export const check = (params: CheckParams): Effect.Effect<Report.Report> =>
  Effect.gen(function*() {
    const rules = resolveRules(params.rules)
    const results: Report.RuleCheckResult[] = []

    for (const rule of rules) {
      const { enabled } = getEffectiveDefaults(rule, params.config)

      if (enabled === false) {
        results.push(Report.RuleCheckResult.Skipped({ rule }))
        continue
      }

      // TODO: Evaluate preconditions with actual context
      // For now, assume preconditions fail if rule has any
      if (rule.preconditions.length > 0) {
        if (enabled === 'auto') {
          results.push(Report.RuleCheckResult.Skipped({ rule }))
        } else {
          // enabled === true, fail with error
          results.push(
            Report.RuleCheckResult.Failed({
              rule,
              duration: 0,
              error: new Error(
                `Precondition failed: ${
                  rule.preconditions.map((p) => p._tag).join(', ')
                }`,
              ),
            }),
          )
        }
        continue
      }

      // TODO: Run actual rule check
      results.push(Report.RuleCheckResult.Finished({ rule, duration: 0 }))
    }

    return Report.Report.make({ results })
  })
```

**Step 4: Run test to verify it passes**

Run: `pnpm turbo run test --filter=@kitz/release -- --run src/api/lint/check.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/release/src/api/lint/check.ts packages/release/src/api/lint/check.test.ts
git commit -m "$(cat <<'EOF'
feat(release): add check operation skeleton

Resolves rule patterns, respects enabled setting, skips on preconditions.
Actual rule execution to be implemented per-rule.
EOF
)"
```

---

## Phase 5: Relay Operation

### Task 11: Relay Operation

**Files:**

- Create: `packages/release/src/api/lint/relay.ts`
- Test: `packages/release/src/api/lint/relay.test.ts`

**Step 1: Write failing test**

```typescript
// packages/release/src/api/lint/relay.test.ts
import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import * as Precondition from './precondition.js'
import { relay, RelayParams } from './relay.js'
import * as Report from './report.js'
import type { Rule } from './rule.js'
import { ViolationLocation } from './violation-location.js'
import { Violation } from './violation.js'

const mockRule: Rule = {
  id: 'pr.type.match-known',
  description: 'Type in allowed set',
  preconditions: [Precondition.HasOpenPR],
}

describe('relay', () => {
  test('formats empty report as text', async () => {
    const report = Report.Report.make({ results: [] })
    const output = await Effect.runPromise(relay({ report, format: 'text' }))
    expect(output).toContain('No rules checked')
  })

  test('formats violation as text', async () => {
    const violation = Violation.make({
      location: ViolationLocation.GitHubPullRequest({
        owner: 'jasonkuhrt',
        repo: 'kitz',
        number: 42,
      }),
    })
    const result = Report.RuleCheckResult.Finished({
      rule: mockRule,
      duration: 10,
      violation,
    })
    const report = Report.Report.make({ results: [result] })
    const output = await Effect.runPromise(relay({ report, format: 'text' }))
    expect(output).toContain('pr.type.match-known')
    expect(output).toContain('FAIL')
  })

  test('formats as JSON', async () => {
    const result = Report.RuleCheckResult.Finished({
      rule: mockRule,
      duration: 10,
    })
    const report = Report.Report.make({ results: [result] })
    const output = await Effect.runPromise(relay({ report, format: 'json' }))
    const parsed = JSON.parse(output)
    expect(parsed.results).toHaveLength(1)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm turbo run test --filter=@kitz/release -- --run src/api/lint/relay.test.ts`
Expected: FAIL

**Step 3: Write implementation**

```typescript
// packages/release/src/api/lint/relay.ts
import { Effect } from 'effect'
import * as Report from './report.js'

export interface RelayParams {
  readonly report: Report.Report
  readonly format?: 'text' | 'json'
  readonly destination?: 'stdout' | 'file' | 'pr-comment'
}

const formatText = (report: Report.Report): string => {
  if (report.results.length === 0) {
    return 'No rules checked.'
  }

  const lines: string[] = []
  let passed = 0
  let failed = 0
  let skipped = 0

  for (const result of report.results) {
    switch (result._tag) {
      case 'Finished':
        if (result.violation) {
          failed++
          lines.push(`FAIL  ${result.rule.id} (${result.duration}ms)`)
          lines.push(`      ${result.rule.description}`)
        } else {
          passed++
          lines.push(`PASS  ${result.rule.id} (${result.duration}ms)`)
        }
        break
      case 'Failed':
        failed++
        lines.push(`ERROR ${result.rule.id} (${result.duration}ms)`)
        lines.push(`      ${result.error.message}`)
        break
      case 'Skipped':
        skipped++
        lines.push(`SKIP  ${result.rule.id}`)
        break
    }
  }

  lines.push('')
  lines.push(`${passed} passed, ${failed} failed, ${skipped} skipped`)

  return lines.join('\n')
}

const formatJson = (report: Report.Report): string => {
  const results = report.results.map((r) => {
    switch (r._tag) {
      case 'Finished':
        return {
          status: r.violation ? 'failed' : 'passed',
          rule: r.rule.id,
          duration: r.duration,
          violation: r.violation
            ? { location: r.violation.location }
            : undefined,
        }
      case 'Failed':
        return {
          status: 'error',
          rule: r.rule.id,
          duration: r.duration,
          error: r.error.message,
        }
      case 'Skipped':
        return {
          status: 'skipped',
          rule: r.rule.id,
        }
    }
  })

  return JSON.stringify({ results }, null, 2)
}

export const relay = (params: RelayParams): Effect.Effect<string> =>
  Effect.sync(() => {
    const format = params.format ?? 'text'
    return format === 'json'
      ? formatJson(params.report)
      : formatText(params.report)
  })
```

**Step 4: Run test to verify it passes**

Run: `pnpm turbo run test --filter=@kitz/release -- --run src/api/lint/relay.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/release/src/api/lint/relay.ts packages/release/src/api/lint/relay.test.ts
git commit -m "$(cat <<'EOF'
feat(release): add relay operation for report output

Supports text and JSON formats. Destination handling TBD.
EOF
)"
```

---

## Phase 6: CLI Command

### Task 12: Update Barrel Export

**Files:**

- Modify: `packages/release/src/api/lint/__.ts`

**Step 1: Update barrel**

```typescript
// packages/release/src/api/lint/__.ts
export * from './check.js'
export * from './config.js'
export * as Precondition from './precondition.js'
export * from './relay.js'
export * from './report.js'
export * as Rule from './rule.js'
export * as Rules from './rules/registry.js'
export * as Severity from './severity.js'
export * as ViolationLocation from './violation-location.js'
export * from './violation.js'
```

**Step 2: Run type check**

Run: `pnpm turbo run check:types --filter=@kitz/release`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/release/src/api/lint/__.ts
git commit -m "$(cat <<'EOF'
feat(release): update lint barrel export with all modules
EOF
)"
```

---

### Task 13: Add Lint to API barrel

**Files:**

- Modify: `packages/release/src/api/__.ts`

**Step 1: Update API barrel**

Add to existing exports:

```typescript
export * as Lint from './lint/__.js'
```

**Step 2: Run type check**

Run: `pnpm turbo run check:types --filter=@kitz/release`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/release/src/api/__.ts
git commit -m "$(cat <<'EOF'
feat(release): export Lint module from API barrel
EOF
)"
```

---

### Task 14: Lint CLI Command

**Files:**

- Create: `packages/release/src/cli/commands/lint.ts`

**Step 1: Create CLI command**

```typescript
// packages/release/src/cli/commands/lint.ts
import { NodeFileSystem } from '@effect/platform-node'
import { Env } from '@kitz/env'
import { Oak } from '@kitz/oak'
import { Effect, Layer, Schema } from 'effect'
import * as Api from '../../api/__.js'

/**
 * release lint
 *
 * Validate PR title and project configuration against release conventions.
 */
const args = await Oak.Command.create()
  .description('Lint release conventions')
  .option(
    'only-rule',
    Schema.UndefinedOr(Schema.String).pipe(
      Schema.annotations({
        description: 'Only run matching rules (comma-separated patterns)',
      }),
    ),
  )
  .option(
    'skip-rule',
    Schema.UndefinedOr(Schema.String).pipe(
      Schema.annotations({
        description: 'Skip matching rules (comma-separated patterns)',
      }),
    ),
  )
  .option(
    'format',
    Schema.UndefinedOr(Schema.Literal('text', 'json')).pipe(
      Schema.annotations({ description: 'Output format (text, json)' }),
    ),
  )
  .parse()

const program = Effect.gen(function*() {
  // 1. Load and resolve config
  const rawConfig = yield* Api.Config.load(process.cwd()).pipe(
    Effect.orElseSucceed(() => Api.Config.ReleaseConfig.make({})),
  )

  // For now, lint config is empty since we haven't integrated it yet
  const lintConfig: Api.Lint.Config = {}
  const config = Api.Lint.resolveConfig(lintConfig)

  // 2. Resolve rule patterns from CLI
  const patterns: string[] = []
  if (args['only-rule']) {
    patterns.push(...args['only-rule'].split(','))
  }

  // 3. Run check
  const report = yield* Api.Lint.check({
    config,
    rules: patterns.length > 0 ? patterns : undefined,
  })

  // TODO: Apply skip-rule filtering

  // 4. Relay output
  const output = yield* Api.Lint.relay({
    report,
    format: args.format ?? 'text',
  })

  console.log(output)

  // 5. Exit with appropriate code
  if (Api.Lint.hasViolations(report) || Api.Lint.hasErrors(report)) {
    process.exit(1)
  }
})

const layer = Layer.merge(Env.Live, NodeFileSystem.layer)

Effect.runPromise(Effect.provide(program, layer)).catch((error) => {
  console.error('Error:', error.message ?? error)
  process.exit(1)
})
```

**Step 2: Run type check**

Run: `pnpm turbo run check:types --filter=@kitz/release`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/release/src/cli/commands/lint.ts
git commit -m "$(cat <<'EOF'
feat(release): add lint CLI command

release lint --only-rule --skip-rule --format
EOF
)"
```

---

## Phase 7: Final Integration

### Task 15: Build and Test

**Step 1: Build the package**

Run: `pnpm turbo run build --filter=@kitz/release`
Expected: PASS

**Step 2: Run all lint tests**

Run: `pnpm turbo run test --filter=@kitz/release -- --run src/api/lint/`
Expected: All tests pass

**Step 3: Run type check**

Run: `pnpm turbo run check:types --filter=@kitz/release`
Expected: PASS

**Step 4: Test CLI manually**

Run: `node packages/release/build/cli/cli.js lint --help`
Expected: Shows lint command help

**Step 5: Final commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(release): complete lint framework skeleton

- Core types: Severity, Precondition, ViolationLocation, Violation, Hint
- Rule types: RuleId, RuleDefaults, Rule
- Config: Config, ResolvedConfig, resolveConfig with 4-layer precedence
- Report: RuleCheckResult (Finished/Failed/Skipped), Report
- Operations: check, relay
- CLI: release lint with --only-rule, --skip-rule, --format

Next: Implement actual rule checkers with GitHub/Git integration.
EOF
)"
```

---

## Future Tasks (Not in Scope)

The following are documented for future implementation:

1. **PR Context Service**: Effect service to provide PR title, number, diff
2. **Individual Rule Implementations**: Actual validation logic per rule
3. **Precondition Evaluation**: Real checks against services
4. **GitHub PR Comment Relay**: Post results as PR comment
5. **Config File Integration**: Load lint config from release.config.ts
