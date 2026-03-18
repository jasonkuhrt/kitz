# @kitz/release

Releasing a monorepo package is a pipeline of decisions: which packages changed, by how much, and what version should each get? Most release tools compress this into a single opaque step. `@kitz/release` makes the pipeline explicit. It separates _understanding what happened_ from _deciding what to do_ from _doing it_, so each phase can be inspected, tested, and overridden independently.

The pipeline has four phases: **explore**, **analyze**, **plan**, **execute**. Each phase produces a data structure consumed by the next. No phase has side effects except the last.

## The Pipeline

<!-- @doc pipeline/overview -->

```
Explorer  -->  Analyzer  -->  Planner  -->  Executor
  |              |              |              |
  | Recon        | Analysis     | Plan         | publish, tag, GH release
  v              v              v              v
Forecaster   Commentator    Renderer       (side effects)
  |              |              |
  | Forecast     | PR comment   | CLI output
```

Every arrow is a function boundary. The data structures between phases are plain schemas — you can serialize a Plan to disk, review it, modify it, and feed it to the Executor later. The pipeline is not a black box you invoke; it is four composable steps you assemble.

<!-- /@doc -->

## Explorer

<!-- @doc explorer/overview -->

The Explorer gathers **environmental reconnaissance** — a snapshot of every fact about the release environment that downstream phases will need. It answers: _where are we running, and what do we have access to?_

The result is a `Recon` object containing:

- **CI context**: whether a CI provider is detected, which one, and the PR number (if any)
- **GitHub identity**: repository owner and name, resolved from `GITHUB_REPOSITORY` or the git remote
- **Credentials**: GitHub token and npm authentication state
- **Git state**: current branch, HEAD SHA, working directory cleanliness

The Explorer exists as a separate phase because environmental facts are needed by multiple downstream consumers. The Analyzer needs the git state to fetch commits. The Planner needs the PR number for ephemeral versions. The Executor needs credentials to publish. Rather than scatter environment detection across the pipeline, the Explorer gathers it once and passes it forward.

<!-- /@doc -->

### Explorer Errors

<!-- @doc explorer/errors/explorer-error -->

#### `ExplorerError`

Raised when environmental reconnaissance fails — the Explorer cannot determine a fact it needs.

**When it occurs**: during `explore()`, when resolving the GitHub repository identity or reading git state.

**Common causes**:

- `GITHUB_REPOSITORY` is set but malformed (not `"owner/repo"` format)
- No `origin` remote is configured, and `GITHUB_REPOSITORY` is not set
- The `origin` remote URL does not point to GitHub

**What to do**: set `GITHUB_REPOSITORY="owner/repo"` explicitly, or configure a GitHub-pointing `origin` remote. The error's `detail` field explains exactly which resolution path failed and why.

<!-- /@doc -->

## Analyzer

<!-- @doc analyzer/overview -->

The Analyzer turns raw git history into structured impact data. It answers: _which packages changed, and by how much?_

Given a set of workspace packages and git tags, the Analyzer:

1. **Fetches commits** since the last release tag (or all history if no prior release exists)
2. **Extracts impacts** by parsing conventional commit messages and mapping scopes to packages — `feat(core): ...` becomes a minor bump for `@kitz/core`
3. **Aggregates by package** — multiple commits touching the same package collapse to the highest bump (a `feat` and a `fix` in the same package yields `minor`, not both)
4. **Detects cascades** — if package A depends on package B, and B is getting a bump, then A needs a patch bump too, even if A had no direct commits

The result is an `Analysis` containing direct impacts, cascade impacts, and unchanged packages. This structure is consumed by both the Planner (for version calculation) and the Forecaster (for release forecasts).

Impact extraction is pure computation — no I/O after the initial commit fetch. A malformed commit message produces zero impacts rather than aborting the pipeline, so one unconventional commit never blocks an entire release.

<!-- /@doc -->

## Planner

<!-- @doc planner/overview -->

The Planner applies version arithmetic to an Analysis to produce a **Plan** — a concrete list of packages, their next versions, and the commits that justify each version. It answers: _what versions should we publish?_

The Planner does not fetch commits or inspect the environment. It receives an Analysis (from the Analyzer) and produces a Plan. This separation means you can plan the same Analysis under different lifecycle strategies without re-running the expensive analytical work.

### Lifecycles

Version arithmetic depends on the **lifecycle** — the kind of release being produced:

<!-- @doc planner/lifecycles -->

- **Official** — standard semver. The bump type (major/minor/patch) comes from the Analysis. A package with no prior release gets its first version; a package with a prior release gets an increment. Version format: `<major>.<minor>.<patch>`.

- **Candidate** — pre-release for validation before an official release. Uses the _projected_ official version as a base, with a `-next.<N>` suffix that increments across successive candidate releases for the same base version. Published to the `next` dist-tag. Version format: `<base>-next.<iteration>`.

- **Ephemeral** — PR-scoped release for integration testing. Uses a zero base version (`0.0.0`) with PR metadata embedded in the prerelease segment, so every PR gets its own isolated version namespace. Published to a per-PR dist-tag. Version format: `0.0.0-pr.<prNumber>.<iteration>.<sha>`.

<!-- /@doc -->

Each lifecycle produces the same Plan schema — the Executor does not need to know which lifecycle was used. The difference is entirely in the version arithmetic.

### Cascade Planning

When the Analyzer detects that package A depends on a directly-impacted package B, the Planner generates a **cascade release** for A. Cascade releases inherit the lifecycle of the primary releases (an official release cascade produces official versions; a candidate release cascade produces candidate versions). This ensures that consumers who pin to A's version will pick up the transitive changes from B.

<!-- /@doc -->

### Planner Errors

<!-- @doc planner/errors/release-error -->

#### `ReleaseError`

Raised when the Planner cannot construct a valid plan.

**When it occurs**: during `plan()` or `apply()` operations.

**Common causes**:

- **Ephemeral lifecycle without a PR number**: ephemeral versions require a PR number to construct the `0.0.0-pr.<N>` version. If no PR number can be detected from environment variables (`GITHUB_PR_NUMBER`, `PR_NUMBER`, `CI_PULL_REQUEST`) and none is passed explicitly, planning fails.

**What to do**: set `PR_NUMBER` or `GITHUB_PR_NUMBER` in your environment, or pass `prNumber` directly to the ephemeral planner options.

<!-- /@doc -->

## Executor

<!-- @doc executor/overview -->

The Executor is the only phase with side effects. It takes a Plan and makes it real: publishing packages to npm, creating git tags, pushing tags, and creating GitHub releases.

Execution is structured as a **declarative DAG** (directed acyclic graph) using `@kitz/flo`. The graph encodes the natural dependencies between release activities:

```
Prepare:A ---+--> Publish:A --> CreateTag:A --> PushTag:A --> CreateGHRelease:A
Prepare:B ---+--> Publish:B --> CreateTag:B --> PushTag:B --> CreateGHRelease:B
Prepare:C ---+--> Publish:C --> CreateTag:C --> PushTag:C --> CreateGHRelease:C
```

Fresh-run **preflight** runs before the durable workflow starts. Once preflight passes, the workflow prepares publishable tarballs for every planned package, then publishes those tarballs in dependency order. This front-loads build and manifest-rewrite failures before any network publish begins.

The release DAG is executed **single-flight within each layer**. That means release still respects the full dependency graph, but it only runs one activity at a time so a failed prepare or publish can suspend cleanly and be resumed without interrupting sibling work. Publish still starts only after every package has been prepared successfully, and local package dependency edges are respected during publish. A dependent package will not publish until the package it consumes has already published.

The Executor supports two modes:

- **`execute`** — runs the workflow and returns a summary of what was published, tagged, and released.
- **`executeObservable`** — returns a stream of lifecycle events (activity started, completed, failed) alongside the execution effect. Use this for real-time CLI progress display.

Both modes support **dry-run**, which logs what would happen without performing any side effects.

<!-- /@doc -->

### Preflight

<!-- @doc executor/preflight -->

Before any durable workflow begins, the Executor runs **preflight checks** using the doctor rule engine for fresh executions. Preflight validates that the environment is actually ready to release:

- **publish channel readiness** — does the active lifecycle's declared publish path match the runtime?
- **npm authentication** — for manual/token-based paths, can we publish to the registry?
- **git cleanliness** — is the working directory clean?
- **git remote** — is the remote reachable?
- **version availability** — do any planned package versions already exist on npm?
- **tag uniqueness** — do any of the planned tags already exist?
- **package manifest blockers** — are planned packages accidentally marked private?

Preflight failures abort the release before any side effects occur. This is deliberate: a failed npm auth check caught before artifact preparation costs nothing, but a failed auth check discovered after packages have already published leaves the repository in an inconsistent state.

<!-- /@doc -->

### Executor Errors

<!-- @doc executor/errors/preflight-error -->

#### `ExecutorPreflightError`

Raised when a preflight check fails before any publishing begins.

**When it occurs**: at the start of execution, before any packages are published.

**Common causes**: npm authentication is not configured, the git working directory has uncommitted changes, the git remote is unreachable, a planned package version already exists on npm, or a planned tag already exists.

**What to do**: the error's `check` field names the specific preflight rule that failed (e.g., `env.npm-authenticated`). Run `release doctor --onlyRule "<check>"` to investigate in isolation.

<!-- /@doc -->

<!-- @doc executor/errors/publish-error -->

#### `ExecutorPublishError`

Raised when `npm publish` fails for a specific package.

**When it occurs**: during artifact preparation or tarball publish for a single package. Other packages may prepare or publish successfully even if one fails.

**Common causes**: `npm pack` or a pack hook failed during artifact preparation, the package version already exists on the registry, the npm token lacks publish permissions for this scope, or a network error interrupted tarball publish.

**What to do**: check the error's `packageName` and `detail` fields. If the detail mentions manifest cleanup or pack hooks, inspect `package.json` before retrying and run `release doctor --onlyRule "plan.packages-runtime-targets-source-oriented"`. If the version already exists, verify that the planned version does not collide with an existing published version. Fix the cause, then rerun release with the same plan so the durable workflow can resume from the failed activity.

<!-- /@doc -->

<!-- @doc executor/errors/tag-error -->

#### `ExecutorTagError`

Raised when git tag creation or tag pushing fails.

**When it occurs**: after a package has been successfully published, during the CreateTag or PushTag activity.

**Common causes**: the tag already exists locally or on the remote, or the git push is rejected (e.g., branch protection rules, insufficient permissions).

**What to do**: check the error's `tag` field to identify which tag failed. If the tag exists, delete it locally (`git tag -d <tag>`) and remotely (`git push origin :refs/tags/<tag>`) before retrying. Fix the cause, then rerun release with the same plan so the durable workflow can resume from the failed tag step.

<!-- /@doc -->

<!-- @doc executor/errors/gh-release-error -->

#### `ExecutorGHReleaseError`

Raised when creating a GitHub release fails.

**When it occurs**: after a tag has been successfully pushed, during the CreateGHRelease activity. The package is already published and tagged at this point.

**Common causes**: the GitHub token lacks permission to create releases, or the GitHub API is unavailable.

**What to do**: verify that `GITHUB_TOKEN` has `contents: write` permission. Fix the cause, then rerun release with the same plan so the durable workflow can resume from the failed GitHub release step. If needed, you can also create the release manually from the tag because the package is already published.

<!-- /@doc -->

## Projection Modules

Three modules run parallel to the main pipeline, projecting the same data into different formats:

<!-- @doc projections/overview -->

### Forecaster

The Forecaster computes **lifecycle-agnostic version projections** from an Analysis. Unlike the Planner, which commits to a specific lifecycle (official, candidate, ephemeral), the Forecaster always projects official versions. The Forecast is consumed by both the Commentator and Renderer for read-only review surfaces.

### Commentator

The Commentator renders a Forecast into **GitHub PR comment markdown**. It produces a structured summary of what would be released if the PR merged: which packages, which versions, which commits justify each bump. The comment includes metadata that allows updating (rather than duplicating) the comment on subsequent pushes.

### Renderer

The Renderer produces **CLI-facing output** from Forecasts and Plans: forecast tables and trees for inspection, plus plan summaries for execution review.

<!-- /@doc -->

## Doctor Checks

<!-- @doc lint/overview -->

The doctor rule engine validates release-related invariants across four domains:

- **Environment rules** (`env.*`): publish-channel readiness, npm authentication, git cleanliness, git remote reachability
- **PR rules** (`pr.*`): commit message format, scope requirements, type validation, monorepo scope matching
- **Plan rules** (`plan.*`): version availability, tag uniqueness, publish-safe package manifests
- **Git rules** (`git.*`): history monotonicity (no version regressions)

Rules are composable and configurable. Each rule can be enabled, disabled, or have its severity adjusted. `release doctor` automatically loads `.release/plan.json` when present, so plan-aware rules can be run before `release apply`. Error-severity violations fail the command; warn-severity violations are reported but do not block release execution.

<!-- /@doc -->

## Configuration

<!-- @doc configuration/overview -->

Configuration is loaded from `release.config.ts` using `@kitz/conf`. All fields have sensible defaults — an empty config is valid.

```ts
import { defineConfig } from '@kitz/release'

export default defineConfig({
  // Main branch name (default: 'main')
  trunk: 'main',
  // Dist-tag for official releases (default: 'latest')
  npmTag: 'latest',
  // Dist-tag for candidate releases (default: 'next')
  candidateTag: 'next',
  // Scope-to-package-name mapping (auto-scanned if omitted)
  packages: {
    core: '@myorg/core',
    utils: '@myorg/utils',
  },
  // Declare how each lifecycle is actually published
  publishing: {
    official: { mode: 'manual' },
    candidate: { mode: 'manual' },
    ephemeral: { mode: 'manual' },
  },
  // Operator-facing command surface used in guidance and runbooks
  operator: {
    releaseScript: 'release',
    prepareScripts: [],
  },
  // Doctor rule configuration
  lint: {
    rules: {
      'pr.scope.require': 'warn',
      'plan.packages-license-present': 'warn',
      'plan.packages-repository-present': 'warn',
    },
  },
})
```

Programmatic callers can override file config per-field via `Config.load(options)` without modifying `release.config.ts`.

Use `release apply --dry-run` when you want to preview a release without publishing packages or mutating git and GitHub state.

The `operator` block declares script names, not hardcoded package-manager commands. `@kitz/release`
detects the active package manager from the current environment and renders guidance accordingly
(`bun run ...`, `pnpm ...`, `npm run ...`, etc).

`publishing` is lifecycle-aware:

- `manual` — releases are run by a human from a shell
- `github-token` — GitHub Actions publishes using an injected npm token
- `github-trusted` — GitHub Actions publishes through npm trusted publishing (OIDC)

<!-- /@doc -->

## CLI

The `release` binary dispatches through file-based command routing:

| Command                             | Purpose                                       |
| ----------------------------------- | --------------------------------------------- | ----------- | ----------------------- |
| `release forecast`                  | Show the current release forecast             |
| `release plan --lifecycle <official | candidate                                     | ephemeral>` | Generate a release plan |
| `release apply`                     | Execute the release plan                      |
| `release explain <pkg>`             | Explain why a package is primary, cascade, or unchanged |
| `release graph`                     | Render the release execution DAG for the active plan |
| `release resume`                    | Resume an interrupted release workflow        |
| `release status`                    | Inspect durable workflow state for the active plan |
| `release notes [pkg]`               | Output unreleased release notes               |
| `release doctor`                    | Run release doctor checks                     |
| `release init`                      | Initialize `release.config.ts` in the project |

## Architecture

```
packages/release/src/
├── _.ts                    # Namespace entry (Release)
├── __.ts                   # Barrel re-export
├── api/
│   ├── __.ts               # Public API surface
│   ├── config.ts           # Configuration loading and resolution
│   ├── explorer/           # Phase 1: environmental reconnaissance
│   │   ├── explore.ts      #   Recon gathering
│   │   ├── errors.ts       #   ExplorerError
│   │   └── models/         #   Recon, CiContext, GitIdentity, Credentials
│   ├── analyzer/           # Phase 2: commit analysis
│   │   ├── analyze.ts      #   Impact extraction and cascade detection
│   │   ├── cascade.ts      #   Dependency graph construction
│   │   ├── version.ts      #   Tag parsing and version extraction
│   │   ├── workspace.ts    #   Package discovery
│   │   └── models/         #   Analysis, Impact, CascadeImpact, Commit
│   ├── planner/            # Phase 3: version arithmetic
│   │   ├── official.ts     #   Official lifecycle planner
│   │   ├── candidate.ts    #   Candidate lifecycle planner
│   │   ├── ephemeral.ts    #   Ephemeral lifecycle planner
│   │   ├── cascade.ts      #   Cascade release detection
│   │   ├── errors.ts       #   ReleaseError
│   │   └── models/         #   Plan, Item, Official, Candidate, Ephemeral
│   ├── executor/           # Phase 4: side effects
│   │   ├── execute.ts      #   Execution API (sync + observable)
│   │   ├── workflow.ts     #   Declarative DAG definition (@kitz/flo)
│   │   ├── preflight.ts    #   Pre-execution validation
│   │   ├── publish.ts      #   npm publish with version injection
│   │   ├── runtime.ts      #   Runtime layer construction
│   │   └── errors.ts       #   ExecutorPublishError, ExecutorTagError, etc.
│   ├── forecaster/         # Projection: lifecycle-agnostic release forecast
│   ├── commentator/        # Projection: PR comment rendering
│   ├── renderer/           # Projection: CLI output formatting
│   ├── lint/               # Rule-based validation
│   │   ├── rules/          #   Individual lint rules
│   │   ├── models/         #   Rule, Violation, Report, Severity, Config
│   │   ├── ops/            #   Check, relay, monotonic operations
│   │   └── services/       #   Preconditions, PR, diff, monorepo contexts
│   ├── notes/              # Release notes generation
│   └── version/            # Version calculation and lifecycle models
└── cli/                    # CLI entry point and command modules
    ├── cli.ts
    └── commands/           # File-based command routing
```
