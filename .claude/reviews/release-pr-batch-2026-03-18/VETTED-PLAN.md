# Vetted Plan For Release PR Review Batch

This is the single-PR burn-down plan for the remaining validated value in the retrospective Claude reviews.

It intentionally excludes stale, disproven, and style-noise findings and turns the rest into one implementation pass on `packages/release`.

## One PR Scope

1. Harden `history` integer parsing with a typed numeric domain and colocated Effect schema.
   Goal:
   Replace the ad hoc `Number.parseInt(...)` path in `packages/release/src/cli/commands/history-lib.ts` with a local schema-backed decoder that rejects junk like `3abc`, decimals, exponent notation, zero, negatives, and empty input.
   Implementation shape:
   Use `@kitz/num`'s `SafeInt` module as the numeric domain anchor, then colocate a release-local Effect schema for a positive safe integer string/option decoder.
   Notes:
   `Natural` has useful exact-string behavior, but the requested repo primitive is the typed safe-int module, so the local schema should layer positivity and canonical string parsing on top of `SafeInt`.
   Acceptance:
   `--pr` and `--limit` share the same decoder; direct tests cover valid whitespace-trimmed input and invalid junk/trailing characters/decimals/zero/negative cases.
   Source reviews:
   `#200`

2. Remove duplicate payload work in `executeObservable()`.
   Goal:
   Stop recomputing `toPayload(plan, options)` just to derive graph metadata after the payload already exists.
   Evidence:
   `packages/release/src/api/executor/execute.ts` still computes the payload and then asks `graph(plan, options)` to derive it again.
   Acceptance:
   Observable execution computes the payload once and graph generation reuses it; existing graph/execution coverage still passes.
   Source reviews:
   `#192`

3. Unify resume CLI behavior with one typed executor resume path.
   Goal:
   Remove duplicated resumability checks from `packages/release/src/cli/commands/resume.ts` and make the CLI call one executor-owned resume entrypoint.
   Acceptance:
   The executor owns suspended/not-started/completed/failed workflow semantics; the CLI becomes thin orchestration plus prompting/output; targeted tests cover the resume state transitions.
   Source reviews:
   `#190`

4. Surface configured-package scan failures instead of silently falling back.
   Goal:
   Make `packages/release/src/api/analyzer/workspace.ts` truthful when configured packages are present but workspace scanning fails.
   Implementation shape:
   Keep explicit package-path support, but stop silently converting scan failure into inferred packages with no signal. Fold the explicit-package-path cleanup into this change so config/runtime behavior is easier to reason about and test.
   Acceptance:
   Scan failures are surfaced as errors or explicitly logged/annotated in a deterministic way; tests cover configured package entries with and without explicit paths.
   Source reviews:
   `#170`, `#195`

5. Make `notes --until` boundary failure explicit.
   Goal:
   Prevent silently widened release notes windows in `packages/release/src/api/notes/generate.ts`.
   Acceptance:
   Invalid or unresolvable `until` boundaries fail clearly instead of quietly returning the untrimmed commit set; tests cover tag, sha, and invalid-boundary behavior.
   Source reviews:
   `#172`

6. Stop swallowing git remote errors in explorer.
   Goal:
   Make `packages/release/src/api/explorer/explore.ts` report remote lookup failures instead of pretending remotes are simply absent.
   Evidence:
   `resolveGitRemotes()` still uses `Effect.option(git.getRemoteUrl('origin'))`.
   Acceptance:
   `exploreFromContext()` and `explore()` propagate meaningful git remote failures; error messages stay actionable for users who need to configure `origin`.
   Source reviews:
   `#173`

7. Collapse PR preview remote handling into one path and cover it end-to-end.
   Goal:
   Remove wrapper noise and duplicated normalization from `packages/release/src/cli/pr-preview.ts`, then add integration-style coverage for explicit remote overrides.
   Implementation shape:
   Delete `loadDiffRemote(...)`, normalize the remote once, pass the same value through diff loading, doctor summary/runbook rendering, and CLI wiring, and stop string-building `--remote ${value}` in ad hoc ways.
   Acceptance:
   One source of truth drives preview diffing and rendered doctor commands; an integration-style test covers `runPrPreview()` remote override wiring.
   Source reviews:
   `#198`, `#199`

8. Harden the scoped Vitest regression helper.
   Goal:
   Keep the regression test for scoped package discovery while reducing shell/environment sensitivity.
   Implementation shape:
   Use `/bin/sh -c` rather than `-lc`, and keep the helper focused on the discovery regression instead of wider shell behavior.
   Acceptance:
   The regression test remains deterministic in local and CI-style environments.
   Source reviews:
   `#167`

## Execution Order

1. `history` typed integer decoding
2. executor payload reuse
3. resume path unification
4. workspace scan truthfulness plus explicit path cleanup
5. notes boundary explicit failure
6. explorer remote error propagation
7. PR preview remote-path consolidation plus integration coverage
8. Vitest helper hardening

## Test Strategy

Every slice in this PR should start with a failing test that demonstrates the current defect or missing guardrail.

The test plan should not stop at happy-path coverage. The goal is to pin boundary behavior, error semantics, and cross-module wiring.

### 1. History integer parsing

Primary file:
`packages/release/src/cli/commands/history-lib.test.ts`

Add a decoder matrix that covers:

- accepts `undefined`
- accepts trimmed canonical positive integers like `"1"` and `" 3 "`
- accepts `Number.MAX_SAFE_INTEGER` as a string
- rejects empty string and whitespace-only input
- rejects `0`
- rejects negative values
- rejects junk suffixes like `3abc`
- rejects decimal forms like `3.0` and `3.14`
- rejects exponent notation like `1e3`
- rejects non-canonical forms like `+3` and `03`
- rejects values above `Number.MAX_SAFE_INTEGER`
- preserves the flag label in the error message so `--pr` and `--limit` failures stay actionable

### 2. Observable payload reuse

Primary file:
`packages/release/src/api/executor/_.test.ts`

Add coverage that proves the refactor actually removed duplicate payload work:

- keep the existing dry-run observable graph coverage
- add a focused test that counts manifest reads or another payload-derived side effect across `executeObservable(...)`
- if that proof is not possible cleanly from the outside, add a tiny internal seam so the test can assert payload construction happens once without broadening the public API

The key here is not just preserving behavior; it is proving the redundant payload build is gone.

### 3. Resume path unification

Primary files:
`packages/release/src/api/executor/resume.test.ts`
`packages/release/src/cli/commands/resume.ts`

Broaden resume coverage from partial workflow persistence into state semantics:

- suspended workflow resumes successfully
- not-started workflow returns the current “run release apply first” outcome
- succeeded workflow returns the current “already completed” outcome
- terminal failure remains non-resumable
- CLI-level smoke coverage confirms the command delegates to the executor-owned resume path instead of duplicating state branching locally

### 4. Workspace scan truthfulness

Primary files:
`packages/release/src/api/analyzer/workspace.test.ts`
`packages/release/src/cli/commands/command-workspace.test.ts`

Keep the existing path-resolution coverage and add failure-path coverage:

- explicit configured paths still resolve successfully
- configured name-only mappings still use discovered workspace paths when scan succeeds
- if scan fails and a package depends on discovery, resolution fails explicitly instead of silently inferring `packages/<scope>/`
- if all configured packages provide explicit paths, resolution can still succeed without discovery
- mixed config cases behave deterministically and are documented by tests
- command-workspace bootstrap reflects the same semantics as the lower-level resolver

### 5. Notes `until` boundaries

Primary file:
`packages/release/src/api/notes/generate.test.ts`

Existing coverage is a good base; extend it to pin the new failure semantics:

- valid sha boundary trims newer commits
- valid tag boundary trims newer commits
- stale caller tag snapshot still works when git can resolve the tag
- resolvable boundary with git lookup failure bubbles the git error
- unknown or unresolvable `until` boundary now fails explicitly instead of widening silently
- boundary-before-since behavior remains covered as an empty notes range

### 6. Explorer remote errors

Primary file:
`packages/release/src/api/explorer/explore.test.ts`

Add coverage for the exact behavior we want to change:

- remote lookup failure is surfaced instead of converted to `{}` remotes
- this remains true even when `GITHUB_REPOSITORY` provides the release target, because `explore()` is still gathering git facts
- successful remote lookup still populates `recon.git.remotes.origin`
- existing target-resolution tests continue to pass

### 7. PR preview remote wiring

Primary files:
`packages/release/src/cli/pr-preview-diff.test.ts`
`packages/release/src/cli/pr-preview.test.ts`

Keep the helper-level diff tests and add wiring tests at the higher layer:

- explicit `remote` override is propagated through `runPrPreview(...)`
- configured remote is used when no override is provided
- rendered doctor/runbook commands include the resolved remote exactly once and in the same normalized form used for diff loading
- blank or whitespace override normalizes back to configured/default behavior
- comment rendering and blocking-preview behavior remain intact

### 8. Scoped Vitest regression helper

Primary file:
`packages/release/src/_.test.ts`

Add or update the regression test so it proves only the intended discovery behavior:

- use `/bin/sh -c`
- confirm the package-scoped test command does not accidentally pick up mirrored worktree tests
- avoid over-asserting shell startup behavior unrelated to the regression

## Verification Commands

Before closing the PR, run at minimum:

- `bun run --cwd packages/release test`
- `bun run --cwd packages/release check:types`
- `bun run --cwd packages/release check:lint`
- `bun run release:verify`

If the implementation introduces a new focused script for a high-signal subset, run that too, but it should complement rather than replace the package test suite.

## Deliberately Excluded

1. `#200` missing Explorer API symbols.
   Status:
   disproven on `origin/main`

2. `#189` missing `ExecutorDependencyCycleError`.
   Status:
   disproven on `origin/main`

3. `#171` `notes-lib` file-specific complaints.
   Status:
   obsolete on `origin/main`

4. `static ordered = false as const` complaints.
   Status:
   style noise, not backlog
