# @kitz/release Design

A commit-driven release tool for monorepos with independent versioning.

## Overview

@kitz/release is a rewrite of [dripip](https://github.com/prisma-labs/dripip) with Effect, adding monorepo support.

### Philosophy

**Version in tags, not code.** Package.json contains `"version": "0.0.0-release"` as a placeholder. Real versions live in git tags (`@kitz/core@1.0.0`). This keeps commit history clean — no "bump version" commits.

**Commit-driven releases.** Conventional commits are the source of truth for what packages changed and how (major/minor/patch). No separate changeset files.

**Plan then apply.** Like Terraform, releases are a two-step process: generate a plan, review it, then apply. This enables high-confidence complex releases.

**Independent versioning.** Each package versions separately. A commit affecting multiple packages can bump each differently.

### Key Features

- Extended conventional commit syntax for multi-package commits
- Automatic workspace dependency resolution during publish
- Cascade release detection and tooling
- PR previews via pkg.pr.new
- Canary releases to npm `@next`
- Per-package GitHub Releases with mutable pre-release changelogs

## Package Architecture

```
packages/
├── git/                    # @kitz/git
├── conventional-commits/   # @kitz/conventional-commits
├── changelog/              # @kitz/changelog
├── npm-registry/           # @kitz/npm-registry
└── release/                # @kitz/release
```

### Dependency Graph

```
@kitz/release
├── @kitz/git
├── @kitz/conventional-commits
├── @kitz/changelog
├── @kitz/npm-registry
├── @kitz/semver (existing)
├── @kitz/pkg (existing)
├── @kitz/conf (existing)
└── @kitz/oak (existing, for CLI)

@kitz/changelog
├── @kitz/conventional-commits
└── @kitz/semver

@kitz/npm-registry
└── @vltpkg/registry-client (external)
```

### @kitz/git

Effect-wrapped git operations. Built on `simple-git` or `isomorphic-git`.

- Repository info (remotes, branches, tags, HEAD)
- Commit history traversal
- Tag management (create, delete, list)
- Working tree status (clean/dirty)

### @kitz/conventional-commits

Schema classes and type-level parser for the [Conventional Commits](https://www.conventionalcommits.org/) specification, extended for monorepos.

#### Schema Design

Two commit types form a tagged union:

- **SingleTargetCommit**: Standard CC — all scopes get uniform treatment (same type, same breaking)
- **MultiTargetCommit**: Extended CC — each target can have its own type and breaking indicator

```typescript
import { Schema } from 'effect'

// === Shared Types ===

class Footer extends Schema.Class<Footer>('Footer')({
  token: Schema.String, // "BREAKING CHANGE", "Fixes", etc.
  value: Schema.String,
}) {}

// === Single-Target Commit (standard CC) ===
// Example: "feat(core, utils): add helper functions"
// All scopes treated uniformly — same type, same breaking indicator

class SingleTargetCommit extends Schema.TaggedClass<SingleTargetCommit>()('SingleTarget', {
  type: Schema.String, // "feat", "fix", etc.
  scopes: Schema.Array(Schema.String), // can be multiple, but uniform treatment
  breaking: Schema.Boolean, // applies to ALL scopes
  message: Schema.String,
  body: Schema.OptionFromNullOr(Schema.String),
  footers: Schema.Array(Footer),
}) {}

// === Multi-Target Commit (extended CC for monorepos) ===
// Example: "feat(core!), fix(arr): breaking core change with arr fix"
// Each target has independent type and breaking indicator

class Target extends Schema.Class<Target>('Target')({
  type: Schema.String, // "feat", "fix", etc.
  scope: Schema.String, // "core", "arr", etc.
  breaking: Schema.Boolean, // per-target breaking indicator
}) {}

class TargetSection extends Schema.Class<TargetSection>('TargetSection')({
  body: Schema.String,
  footers: Schema.Array(Footer), // including BREAKING CHANGE
}) {}

class MultiTargetCommit extends Schema.TaggedClass<MultiTargetCommit>()('MultiTarget', {
  targets: Schema.NonEmptyArray(Target),
  message: Schema.String,
  summary: Schema.OptionFromNullOr(Schema.String), // text before any ## heading
  sections: Schema.Record({
    // keyed by scope name
    key: Schema.String,
    value: TargetSection,
  }),
}) {}

// === Union ===
const ConventionalCommit = Schema.Union(SingleTargetCommit, MultiTargetCommit)
type ConventionalCommit = Schema.Schema.Type<typeof ConventionalCommit>
```

#### API

```typescript
// Parse from string (runtime) — auto-detects single vs multi-target
const parsed = CC.parse('feat(cli): add dry-run flag')
//    ^? Effect<ConventionalCommit, ParseError>

// Construct directly
const commit = SingleTargetCommit.make({
  type: 'feat',
  scopes: ['cli'],
  breaking: false,
  message: 'add dry-run flag',
  body: Option.none(),
  footers: [],
})

// Type-level parse (compile-time)
type Parsed = CC.Parse<'feat(cli): add dry-run flag'>
//   ^? SingleTargetCommit

type ParsedMulti = CC.Parse<'feat(core!), fix(arr): description'>
//   ^? MultiTargetCommit
```

#### Parsing Rules

| Input                         | Result                                                                             |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| `feat: msg`                   | `SingleTarget` (no scope)                                                          |
| `feat(core): msg`             | `SingleTarget` (one scope)                                                         |
| `feat(core, arr): msg`        | `SingleTarget` (multiple scopes, uniform)                                          |
| `feat(core!): msg`            | `SingleTarget` (breaking)                                                          |
| `feat(core), fix(arr): msg`   | `MultiTarget` (different types)                                                    |
| `feat(core!), feat(arr): msg` | `MultiTarget` (different breaking)                                                 |
| `feat(core!, arr): msg`       | `SingleTarget` — syntactic sugar for `feat(core!), feat(arr!): msg`? Or error? TBD |

### @kitz/changelog

Generate changelogs from conventional commits, render to various formats.

```typescript
// Generate from commits
const log = Changelog.fromCommits(commits)

// Render to markdown
const md = Changelog.toMarkdown(log)

// Render to terminal (colored)
const terminal = Changelog.toTerminal(log)
```

### @kitz/npm-registry

npm registry operations with Effect wrapping.

| Operation      | Implementation              |
| -------------- | --------------------------- |
| Read versions  | `@vltpkg/registry-client`   |
| Read dist-tags | `@vltpkg/registry-client`   |
| Read packument | `@vltpkg/registry-client`   |
| Publish        | Shell out to `npm publish`  |
| Set dist-tag   | Shell out to `npm dist-tag` |

## Extended Conventional Commit Syntax

Standard conventional commits support one type and one scope. This tool extends the syntax for monorepos where a single commit affects multiple packages with different semver implications.

### Syntax Rules

**Multiple type-scope groups:**

```
feat(core), fix(arr): description
```

**Breaking indicator positions:**

- After scope inside parens: `feat(core!)` — that scope is breaking
- Before colon: `feat(core)!:` — ALL scopes are breaking (shorthand)

**Equivalences:**

```
feat(core!), fix(arr!):  ≡  feat(core), fix(arr)!:
feat(core!, arr!):       ≡  feat(core, arr)!:
```

### Examples

| Syntax                   | core  | arr   |
| ------------------------ | ----- | ----- |
| `feat(core, arr):`       | minor | minor |
| `feat(core!, arr):`      | major | minor |
| `feat(core, arr)!:`      | major | major |
| `feat(core!), fix(arr):` | major | patch |
| `fix(core), fix(arr):`   | patch | patch |

### Commit Body Structure

```
feat(core!), fix(arr): short description     ← title

Optional shared summary that applies to      ← summary (before any ##)
all packages.

## core                                       ← per-package section
Per-package body with details.

BREAKING CHANGE: description of breaking     ← CC footer (per-section)
change for this package.

## arr                                        ← per-package section
Per-package body for arr.
```

- **Title**: First line, parsed for types/scopes/breaking
- **Summary**: Text before any `##` heading, applies to all packages
- **Per-package sections**: `## <scope>` headings, each parsed independently for CC footers

## Package Resolution

### Scope to Package Mapping

Commit scopes map to package names. By default, release auto-discovers this mapping.

**Default algorithm:**

1. Scan `packages/*/package.json`
2. Directory name = scope
3. `package.json` `name` field = package name

```
packages/
  core/package.json    → { "name": "@kitz/core" }  → scope "core"
  kitz/package.json    → { "name": "kitz" }        → scope "kitz"
  fs/package.json      → { "name": "@kitz/fs" }    → scope "fs"
```

**Config override (full replacement, no merge):**

```typescript
// release.config.ts
import { defineConfig } from '@kitz/release'

export default defineConfig({
  packages: {
    core: '@kitz/core',
    kitz: 'kitz',
    fs: '@kitz/fs',
  },
})
```

If `packages` config exists, auto-discovery is skipped entirely.

### Workspace Dependency Resolution

pnpm's `workspace:*` protocol is rewritten to real versions on publish. Since source code has `"version": "0.0.0-release"`, the tool must temporarily inject real versions before publish.

**When publishing package X:**

1. Find all workspace dependencies of X
2. For each dependency:
   - If releasing: inject its new version
   - If not releasing: inject its last version from git tags
3. Inject X's new version
4. Run `pnpm publish`
5. Restore all to `0.0.0-release`

This ensures published packages have correct dependency ranges without cascade-releasing everything.

## Cascade Releases

When a package releases a version that breaks its dependents' pinned ranges, those dependents need releases too.

### When Cascade is Needed

```
@kitz/core: 1.0.0 → 2.0.0 (major)
@kitz/arr:  depends on "@kitz/core": "workspace:*" → published as "^1.0.0"
```

After core@2.0.0 publishes, arr's `^1.0.0` won't accept it. Users installing arr get the old core.

### Cascade Detection

`release status <pkg>` shows cascade requirements:

```bash
$ release status core

@kitz/core 1.0.0 → 2.0.0 (major)
├── @kitz/arr depends (workspace:* → ^1.0.0) — needs release
└── @kitz/log depends (workspace:* → ^1.0.0) — needs release
```

### Cascade Commits

Cascade packages should be included in the original commit's scope:

```
feat(core!), fix(arr, log): breaking API change

## core
Breaking API change details.

## arr
Updated to use new core API.

## log
Updated to use new core API.
```

This makes the release intent explicit and auditable.

**Automatic cascade commits:**

If `release plan` detects cascade releases without corresponding commits, `release apply` creates an empty commit:

```bash
# Created automatically by release apply
git commit --allow-empty -m "fix(arr, log): cascade for core@2.0.0"
```

This ensures every release has a corresponding commit in history.

## Release Types

### Stable Releases

Traditional semver releases to npm. Published to the default dist-tag (`latest`).

```
@kitz/core@2.0.0  →  npm install @kitz/core
```

Git tags: `@kitz/core@2.0.0`

### Preview Releases (Canary)

Pre-releases on trunk, published to `@next` dist-tag.

```
@kitz/core@2.0.0-next.1  →  npm install @kitz/core@next
```

**Version pattern:** `${next_stable}-next.${n}`

**GitHub Release:** Per-package mutable release (`@kitz/core@next`) that accumulates changes. Reset on stable release.

### PR Releases

Preview releases for pull requests via [pkg.pr.new](https://github.com/stackblitz-labs/pkg.pr.new).

```
npm install https://pkg.pr.new/jasonkuhrt/kitz/@kitz/core@abc123
```

No npm pollution. Auto-deleted after 6 months. PR comment with install links.

**Opt-in npm fallback:** `release plan pr --npm` publishes to npm instead:

```
@kitz/core@0.0.0-pr.123.1.abc123
```

## Version Formats

| Release Type | Version Pattern               | Example                | Dist-tag |
| ------------ | ----------------------------- | ---------------------- | -------- |
| PR           | `0.0.0-pr.<pr_num>.<n>.<sha>` | `0.0.0-pr.45.3.abc123` | `pr.45`  |
| Preview      | `<next>-next.<n>`             | `1.2.0-next.4`         | `next`   |
| Stable       | `<next>`                      | `1.2.0`                | `latest` |

## CLI Commands

### `release status [pkg...]`

Show unreleased changes. If packages specified, also shows cascade analysis.

```bash
$ release status

@kitz/core (1.0.0 → ?)
  3 commits since @kitz/core@1.0.0
  Bump: major

@kitz/arr (2.0.0 → ?)
  1 commit since @kitz/arr@2.0.0
  Bump: patch

$ release status core

@kitz/core 1.0.0 → 2.0.0 (major)
├── @kitz/arr depends (workspace:* → ^1.0.0) — needs release
└── @kitz/log depends (workspace:* → ^1.0.0) — needs release
```

### `release plan <type>`

Generate a release plan. Writes to `.release/plan.json`.

**Subcommands:**

- `release plan stable` — Stable release plan
- `release plan preview` — Preview/canary release plan
- `release plan pr` — PR release plan

**Flags:**

- `--pkg <name>` — Only include specific package(s)
- `--exclude <name>` — Exclude package(s)
- `--tag <name>` — Dist-tag for preview (default: `next`)
- `--npm` — Use npm for PR releases instead of pkg.pr.new

### `release apply`

Execute the release plan. Requires plan file.

```bash
$ release apply

Applying release plan...
✓ Cascade commit created
✓ Versions injected
✓ @kitz/core@2.0.0 published
✓ @kitz/arr@2.0.1 published
✓ Git tags created
✓ GitHub releases created
✓ Versions restored

Done. 2 packages released.
```

**Flags:**

- `--yes` — Skip confirmation prompt (for CI)

### `release log [pkg]`

Output changelog for package(s).

```bash
$ release log core --format md
```

**Flags:**

- `--format <md|json>` — Output format
- `--since <tag>` — Changes since specific tag

### `release init`

Initialize release in a project.

```bash
$ release init

✓ Created release.config.ts
✓ Detected 32 packages
✓ Added .release/ to .gitignore
```

## SDK Architecture

Three main functions matching release types:

```typescript
import * as Release from '@kitz/release'

// PR release: 0.0.0-pr.45.3.abc123
Release.pr({ dryRun: false })

// Preview/canary release: 1.2.0-next.4
Release.preview({ dryRun: false, skipNpm: false })

// Stable release: 1.2.0
Release.stable({ dryRun: false, skipNpm: false })
```

All return `Effect<ReleaseResult, ReleaseError, ReleaseContext>`.

### ReleaseContext

Effect service layer:

```typescript
interface ReleaseContext {
  git: Git.Git
  npm: NpmRegistry.Client
  github: GitHub.Client // octokit
  config: Release.Config
  cwd: string
}
```

### ReleaseError

Tagged union of failure modes:

```typescript
type ReleaseError =
  | Git.Error
  | NpmRegistry.PublishError
  | GitHub.ApiError
  | Config.LoadError
  | ValidationError
```

## Configuration

Optional config file with CLI flag overrides:

```typescript
// release.config.ts
import { defineConfig } from '@kitz/release'

export default defineConfig({
  trunk: 'main',
  npmTag: 'latest',
  previewTag: 'next',
  skipNpm: false,
  // Monorepo: scope → package mapping (optional, auto-discovered by default)
  packages: {
    core: '@kitz/core',
    kitz: 'kitz',
  },
})
```

## GitHub Releases

### Stable Releases

Each package gets its own GitHub Release, tagged `@kitz/core@2.0.0`.

Multiple packages releasing from one commit = multiple tags on same commit = multiple GitHub Releases. Each release body contains only that package's changelog section.

### Pre-release Changelogs

Each package has a mutable `@next` release that accumulates changes:

```
GitHub Release: @kitz/core@next
Tag: @kitz/core@next (moving tag)

Body:
## Changes since @kitz/core@1.0.0

- feat: thing one (abc123)
- feat: thing two (def456)
- fix: bug fix (ghi789)
```

On each preview release, the body is updated. On stable release, the body is cleared and the tag moves.

## Key Design Decisions

| Decision        | Choice                        | Rationale                                          |
| --------------- | ----------------------------- | -------------------------------------------------- |
| Platform        | GitHub-only                   | Avoid over-abstraction without real use cases      |
| Registry        | npm registry only             | Primary use case, cross-registry via @vltpkg later |
| Package manager | npm CLI for publish           | Works universally, handles auth                    |
| Registry reads  | @vltpkg/registry-client       | Performance, caching, potential cross-registry     |
| Config          | Optional file + CLI overrides | Zero-config by default, flexibility when needed    |
| Version storage | Git tags, not package.json    | Keeps git history clean                            |
| Versioning      | Independent per-package       | Flexibility for monorepos                          |
| Change tracking | Commit-driven                 | Single source of truth, no changeset files         |
| Release model   | Plan then apply               | High-confidence complex releases                   |

## Future Work

Out of scope for v1, potential future additions:

- **Claude Code skill** — Interactive release workflow driven by Claude
- **GitHub Actions workflows** — Reusable workflows for CI integration
- **JSR registry support** — Publish to JSR in addition to npm
- **GitHub Packages support** — Alternative registry option
- **Linked versioning** — Opt-in groups of packages that always share the same version number (e.g., `@kitz/react-*` packages always bump together)
- **Pre-release modes** — `alpha`, `beta`, `rc` in addition to `next`
