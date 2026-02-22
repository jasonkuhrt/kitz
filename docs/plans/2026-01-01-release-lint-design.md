# Release Lint Design

A linting framework for release validation in trunk-based development workflows.

## Anatomy

### Diagram

```
┌──────────┐ 1:n  ┌──────────────┐
│   Rule   │─────▶│ Precondition │
└──────────┘      └──────────────┘

┌────────┐ 1:n  ┌───────────┐ 1:1  ┌───────────────────┐
│ Report │─────▶│ Violation │─────▶│ ViolationLocation │
└────────┘      └───────────┘      └───────────────────┘

┌────────┐ 1:n  ┌────────────┐
│ Config │─────▶│ RuleConfig │
└────────┘      └────────────┘

┌────────────┐   ┌──────────┐   ┌──────┐
│ Correction │   │ Severity │   │ Hint │
└────────────┘   └──────────┘   └──────┘
```

### Entities

| Name                  | Description                                                   |
| --------------------- | ------------------------------------------------------------- |
| **Rule**              | Validation check with preconditions and optional fix.         |
| **Config**            | User configuration. Maps rule IDs to overrides.               |
| **ResolvedConfig**    | Normalized config. No shorthands, no optional properties.     |
| **RuleConfig**        | User overrides for a single rule.                             |
| **Violation**         | Single rule failure with location.                            |
| **Report**            | Aggregation of violations from a lint run.                    |
| **Correction**        | Deterministic fix, auto-applied in fix mode.                  |
| **Hint**              | Heuristic suggestion. Shown to user, never auto-applied.      |
| **Severity**          | Error (exit 1) or warn (exit 0).                              |
| **Precondition**      | Machine-controlled applicability check. Not user-overridable. |
| **ViolationLocation** | Where a violation occurred (GitHub PR, GitHub repo, git).     |

### Operations

| Name            | Description                       |
| --------------- | --------------------------------- |
| `resolveConfig` | Normalize config, apply defaults. |
| `check`         | Run rules, produce report.        |
| `relay`         | Output report to destination.     |

### Other Terms

| Name                | Description                                      |
| ------------------- | ------------------------------------------------ |
| **RuleId**          | Dot-notation identifier.                         |
| **RuleTarget**      | Rule ID or namespace pattern (a.b.*).            |
| **RuleCheckResult** | Union of finished/failed/skipped check outcomes. |

## Entities

### Rule

#### Schema

```ts
interface Rule {
  /** Unique identifier in dot-notation (e.g. 'pr.type.match-known'). */
  id: RuleId
  /** Human-readable description of what the rule checks. */
  description: string
  /** Runtime applicability checks. All must pass for rule to run. */
  preconditions: Precondition[]
  /** Default values for user-configurable properties. */
  defaults?: RuleDefaults
}

interface RuleDefaults {
  /**
   * false: disabled.
   * true: enabled, errors if any precondition fails.
   * 'auto': enabled if all preconditions pass, silently skipped otherwise.
   *         If no preconditions, behaves as true.
   * @default 'auto'
   */
  enabled?: boolean | 'auto'
  /**
   * Severity level when rule produces violations.
   * @default Severity.Error
   */
  severity?: Severity
}
```

#### Data

```ts
const rules: Rule[] = [
  /** Location: GitHubPullRequest */
  {
    id: 'pr.message.format',
    description: 'Custom regex message enforcement',
    preconditions: [Precondition.HasOpenPR],
  },
  /** Location: GitHubPullRequest */
  {
    id: 'pr.type.match-known',
    description: 'Type in allowed set (standard or custom)',
    preconditions: [Precondition.HasOpenPR],
  },
  /** Location: GitHubPullRequest */
  {
    id: 'pr.type.release-kind-match-diff',
    description: 'No-release type cannot have src changes',
    preconditions: [Precondition.HasOpenPR, Precondition.HasDiff],
  },
  /** Location: GitHubPullRequest */
  {
    id: 'pr.scope.require',
    description: 'At least one scope required',
    preconditions: [Precondition.HasOpenPR],
    defaults: { enabled: false },
    hint: SuggestsAddingScope,
  },
  /** Location: GitHubPullRequest */
  {
    id: 'pr.monorepo.scopes.match-known',
    description: 'Scope(s) exist in package map',
    preconditions: [Precondition.HasOpenPR, Precondition.IsMonorepo],
    hint: ListsValidScopes,
  },
  /** Location: GitHubPullRequest */
  {
    id: 'pr.monorepo.scopes.match-affected',
    description: 'Scope(s) match affected packages',
    preconditions: [
      Precondition.HasOpenPR,
      Precondition.IsMonorepo,
      Precondition.HasDiff,
    ],
    correction: AddMissingScope,
  },
  /** Location: GitHubRepository */
  {
    id: 'repo.squash-only',
    description: 'Only squash merge enabled',
    preconditions: [Precondition.HasGitHubAccess],
    defaults: { enabled: false },
  },
  /** Location: Git */
  {
    id: 'git.history.monotonic',
    description: 'Versions increase with commit order',
    preconditions: [],
  },
]
```

### Correction

#### Schema

```ts
type Correction =
  | CorrectionSetTitle
  | CorrectionAddBreaking
  | CorrectionRemoveScope
  | CorrectionAddScope
  | CorrectionSetType

/** Replace entire PR title. Error: title invalid. */
interface CorrectionSetTitle {
  title: string
}

/** Add breaking change indicator to scopes. Error: scope not found. */
interface CorrectionAddBreaking {
  scopes: string[]
}

/** Remove a scope from PR title. Error: scope not found. */
interface CorrectionRemoveScope {
  scope: string
}

/** Add a scope to PR title. Error: scope already exists. */
interface CorrectionAddScope {
  scope: string
  type: string
}

/** Change the type for a scope. Error: scope not found. */
interface CorrectionSetType {
  scope: string
  type: string
}
```

### Violation

#### Schema

```ts
interface Violation {
  /** Where the violation occurred. */
  location: ViolationLocation
}
```

### ViolationLocation

#### Schema

```ts
type ViolationLocation =
  | ViolationLocationGitHubPullRequest
  | ViolationLocationGitHubRepository
  | ViolationLocationGit

/** Location within a GitHub pull request. */
interface ViolationLocationGitHubPullRequest {
  /** Repository owner (user or org). */
  owner: string
  /** Repository name. */
  repo: string
  /** Pull request number. */
  number: number
}

/** Location at GitHub repository level. */
interface ViolationLocationGitHubRepository {
  /** Repository owner (user or org). */
  owner: string
  /** Repository name. */
  repo: string
}

/** Location in local git working tree. */
interface ViolationLocationGit {
  /** Full commit SHA. */
  sha: string
  /** Absolute file path. */
  path: string
}
```

### Config

#### Schema

```ts
interface Config {
  /** Global defaults applied to all rules before per-rule overrides. */
  defaults?: RuleDefaults
  /** Per-rule overrides keyed by rule ID. */
  rules?: Record<RuleId, RuleConfigInput>
}
```

### ResolvedConfig

#### Schema

```ts
interface ResolvedConfig {
  /** Global defaults applied to all rules. */
  defaults: ResolvedRuleDefaults
  /** Per-rule overrides keyed by rule ID. */
  rules: Record<RuleId, ResolvedRuleConfig>
}

interface ResolvedRuleConfig {
  /** Override rule defaults for enabled/severity. */
  overrides: ResolvedRuleDefaults
  /** Rule-specific options. */
  options: RuleConfigOptions
}

interface ResolvedRuleDefaults {
  enabled: boolean | 'auto'
  severity: Severity
}
```

### RuleConfig

#### Schema

```ts
/** User input format (supports shorthand). */
type RuleConfigInput =
  | Severity // 'error' or 'warn'
  | [Severity, RuleConfigOptions] // ['error', { ... }]
  | RuleConfig // Full object form

/** Normalized form. */
interface RuleConfig {
  /** Override rule defaults for enabled/severity. */
  overrides: RuleDefaults
  /** Rule-specific options. */
  options: RuleConfigOptions
}

/** Rule-specific options (varies per rule). */
type RuleConfigOptions = object
```

### Severity

#### Schema

```ts
type Severity =
  | SeverityError // Violation causes non-zero exit.
  | SeverityWarn // Violation shown but exit is zero.
```

### Precondition

#### Schema

```ts
type Precondition =
  | PreconditionHasOpenPR
  | PreconditionHasDiff
  | PreconditionIsMonorepo
  | PreconditionHasGitHubAccess

/** Current branch has an open pull request. */
interface PreconditionHasOpenPR {}

/** PR has file changes (not an empty PR or missing diff context). */
interface PreconditionHasDiff {}

/** Project is a pnpm workspace. */
interface PreconditionIsMonorepo {}

/** GitHub API token available with repo read access. */
interface PreconditionHasGitHubAccess {}
```

### Report

#### Schema

```ts
interface Report {
  /** Results for each rule that was checked. */
  results: RuleCheckResult[]
}

type RuleCheckResult =
  | RuleCheckResultFinished
  | RuleCheckResultFailed
  | RuleCheckResultSkipped

/** Rule ran and produced a result (violation or clean). */
interface RuleCheckResultFinished {
  rule: Rule
  /** Execution time in milliseconds. */
  duration: number
  /** Violation if rule failed validation, undefined if passed. */
  violation?: Violation
}

/** Rule encountered an error during execution. */
interface RuleCheckResultFailed {
  rule: Rule
  /** Execution time in milliseconds. */
  duration: number
  error: Error
}

/** Rule was skipped (preconditions not met, disabled, filtered out). */
interface RuleCheckResultSkipped {
  rule: Rule
}
```

### Hint

#### Schema

```ts
interface Hint {
  /** Human-readable suggestion. */
  description: string
}
```

## Operations

### resolveConfig

```ts
interface Params {
  config?: Config
}
```

1. Resolve global defaults from config.defaults, falling back to system defaults (enabled: 'auto', severity: 'error')
2. For each rule in config.rules, normalize RuleConfigInput to ResolvedRuleConfig:
   - If Severity, expand to `{ overrides: { severity }, options: {} }`
   - If [Severity, options], expand to `{ overrides: { severity }, options }`
   - If RuleConfig, use as-is
   - Apply precedence: system defaults → rule.defaults → config.defaults → rule config overrides
3. Return ResolvedConfig

### check

```ts
interface Params {
  config: ResolvedConfig
  /** Optional filter. Defaults to all rules. */
  rules?: RuleTarget[]
}
```

1. Resolve rule targets to rule set (apply rules filter if provided)
2. For each rule:
   - Evaluate preconditions
   - If preconditions fail and `enabled: 'auto'`, add `RuleCheckResultSkipped`
   - If preconditions fail and `enabled: true`, add `RuleCheckResultFailed` with error
   - If preconditions pass, run `rule.check()`, record timing:
     - If error, add `RuleCheckResultFailed`
     - Otherwise add `RuleCheckResultFinished` (with violation if any)
3. Return Report

### relay

```ts
interface Params {
  report: Report
  format?: 'text' | 'json'
  destination?: 'stdout' | 'file' | 'pr-comment'
}
```

1. Format report according to format option
2. Write to destination

## CLI

```bash
release lint                       # check + relay
release lint --only-rule a.*       # Run subset of rules
release lint --skip-rule a.b.*     # Exclude rules
release lint --format json         # Machine-readable output
```

### Command Flow

```
1. resolveConfig(config) → ResolvedConfig
2. check({ config, rules }) → Report
3. relay({ report })
4. exit(hasViolations(report) ? 1 : 0)
```

### Rule Filtering

**Flags:**

- `--only-rule <pattern>` - Only run matching rules (allowlist)
- `--skip-rule <pattern>` - Skip matching rules (denylist)

**Resolution order:** Skip resolves after only (skip takes precedence).

**Pattern syntax:**

| Pattern       | Matches                                       |
| ------------- | --------------------------------------------- |
| `a.b.c`       | Exact rule FQN                                |
| `a.b.*`       | All rules in namespace                        |
| `a.*`         | All rules in namespace (recursive)            |
| `a.*,b.c.*,d` | Multiple patterns (comma-delimited, no space) |

**Validation:**

| Check                              | Behavior                     |
| ---------------------------------- | ---------------------------- |
| Invalid syntax                     | Fatal                        |
| Unknown rule FQN                   | Fatal                        |
| Effect negation (skip negates all) | Warn (fatal with `--strict`) |

**Examples:**

```bash
# Run only rules in namespace a
release lint --only-rule a.*

# Run all except rules in namespace a.b
release lint --skip-rule a.b.*

# Run a.* rules but skip a.b.*
release lint --only-rule a.* --skip-rule a.b.*

# Multiple patterns
release lint --only-rule a.*,b.*

# Effect negation warning
release lint --only-rule a.* --skip-rule a.*
# → Warning: --skip-rule negates all effects of --only-rule

# Strict mode makes negation fatal
release lint --only-rule a.* --skip-rule a.* --strict
# → Error: --skip-rule negates all effects of --only-rule
```

## Configuration

Config file is optional. CLI respects config if found.

```ts
// release.config.ts or package.json "release" field
{
  lint: {
    // Global defaults (opt-in mode example)
    defaults: {
      enabled: false,  // All rules off by default
    },
    // Per-rule overrides
    rules: {
      'pr.type.match-known': 'error',           // Opt-in this rule
      'pr.scope.require': ['warn', { min: 1 }], // Opt-in with options
    },
  }
}
```

### Precedence

```
system defaults → rule.defaults → config.defaults → per-rule config
```

Each layer overrides the previous. This allows:

- Rules to define sensible defaults
- Users to globally change behavior (e.g., opt-in mode)
- Users to fine-tune individual rules
