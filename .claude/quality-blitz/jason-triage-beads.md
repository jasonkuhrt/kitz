## B2: pr-message-format lint rule — implement or remove?

Stub rule at `lint/rules/pr-message-format.ts:10` — runs but does nothing (`Effect.succeed(undefined)`). Ship blocker.

**Decision needed**: Implement a real format check? Or remove the rule entirely and add it back later when the spec is clear?

---

## C2: Plan.make() factory naming

`planner/models/plan.ts:34` has a factory `make()`. Project convention varies — some use `make`, some `create`.

**Decision needed**: Standardize on which factory name? `make` / `create` / something else?

---

## C3: Explorer helper functions — public or private?

`explorer/explore.ts` exports `detectPrNumber`, `parseGitHubRepository`, `parseGitHubRemote`, `resolveReleaseTarget` but they're NOT re-exported in the barrel `__.ts`.

**Decision needed**: Are these public API or internal? If public, re-export in barrel. If internal, unexport them.

---

## C5: Version model API style — wrapper fns vs class methods

Files like `candidate.ts`, `ephemeral.ts` have both `Candidate.make()` (class method) AND `makeCandidate()` (standalone fn). Redundant.

**Decision needed**: Keep class methods only? Keep standalone fns only? Which style for the release package?

---

## C6: Preflight coupling to lint system

`executor/preflight.ts` creates lint config directly inside the executor module, coupling executor → lint.

**Decision needed**: Extract preflight to lint module? Create shared preflight interface? Leave as-is?

---

## C7: Analyzer does too much

`analyzer/analyze.ts` handles scope mapping, filtering, BFS traversal, AND cascade detection in one function.

**Decision needed**: How to decompose? Separate cascade step? Different module boundaries?

---

## C12: Barrel file export pattern — namespace vs flat

Some `__.ts` files use `export * as Namespace from './module.js'`, others use flat `export *`. Inconsistent across the release package.

**Decision needed**: Which pattern to standardize on? Namespace exports everywhere? Flat everywhere? Mixed by convention?

---

## C13: Version model schema pattern

`Candidate`/`Ephemeral` use `transformOrFail` schema pattern, but `OfficialFirst`/`OfficialIncrement` don't.

**Decision needed**: Standardize on `transformOrFail` for all? Or leave official ones simpler since they don't need complex parsing?

---

## C18: ItemSchema union — add discriminator field?

`planner/models/item.ts` has `ItemSchema` union of Official/Candidate/Ephemeral. Currently uses `is()` methods for runtime checks.

**Decision needed**: Add a `_type` discriminator field to the data model? This changes serialized plan.json format.

---

## C21: detectExecutionContext nullable relationship design

`explorer/explore.ts:31-40` returns `CiContext` with nullable `provider` and `prNumber`. The relationship between these fields is unclear.

**Decision needed**: Make this a discriminated union (`{ detected: false } | { detected: true; provider: ...; prNumber: ... }`)? Or keep the flat nullable approach?

---

## C25: Executor resource management

`executor/execute.ts:94-110` has implicit resource management, no explicit cleanup on error.

**Decision needed**: Add `Effect.acquireRelease` for proper cleanup? What resources need cleanup — manifest file, git tags, npm state?

---

## C27: Planner barrel export style

`planner/__.ts` mixes namespace exports (`Cascade`) with flat exports. Same decision as C12.

**Decision needed**: (see C12)

---

## C29: pr-message-format stub — same as B2

Same decision as B2. Implement or remove?

**Decision needed**: (see B2)

---

## C30: Explorer internal helpers — same as C3

Same decision as C3. Public or private?

**Decision needed**: (see C3)

---

## C32: item-official getter fragile pattern

`planner/models/item-official.ts:28-38` getters use `'to' in this.version` pattern checking instead of discriminated union.

**Decision needed**: Redesign version types to use proper discriminated union? Or just document the current approach?

---

## C34: confirm() readline extraction

`cli/commands/apply.ts:55-70` creates readline interface inside `Effect.promise()`.

**Decision needed**: Extract to an Effect service (e.g., `Terminal` or `Prompt`)? Or leave inline — it's only used in one place.

---

## C35: Commentator sub-renderers — extract?

`commentator/render.ts:108-150` has multiple private sub-renderer functions defined inline.

**Decision needed**: Extract to separate module(s)? Or leave inline — they're small and only used here.

---

## D1: README.md content and scope

No README.md exists for `packages/release/`. Needs one.

**Decision needed**: What tone, scope, and sections? Full usage docs? Or brief overview pointing to CLI --help? Include architecture diagram?

---

## D25: Explorer error recovery guidance

`explorer/errors.ts` — missing recovery/remediation guidance in error JSDoc.

**Decision needed**: What recovery actions to document? Depends on what the tool can actually recover from.

---

## D26: Executor error remediation

`executor/errors.ts` — missing docs on when each error occurs and what to do.

**Decision needed**: What remediation to suggest? Depends on rollback design (F2).

---

## D27: Planner error operation values

`planner/errors.ts` — `operation` field values not documented.

**Decision needed**: What are the valid operation values? Should they be an enum?

---

## F1: Access level — configurable?

`executor/publish.ts:77` hardcodes `access: 'public'`. No private/restricted package support.

**Decision needed**: Make it config? Per-package? What default — public or inherit from package.json?

---

## F2: Rollback/recovery for partial publish failures

Zero rollback support. If one package publishes but another fails, state is inconsistent.

**Decision needed**: What recovery strategy? Transaction log? Idempotent retry? Manual cleanup command? npm unpublish?

---

## F4: OTP/2FA support for npm

No interactive OTP prompt during publish.

**Decision needed**: Interactive stdin prompt? Env var? Skip entirely for V1?

---

## F5: Manual version override in plan

No way to override calculated versions.

**Decision needed**: Add `--version` override to plan command? Config-based overrides? Skip for V1?

---

## F6: Lock-step versioning

No option for monorepos that want all packages on same version.

**Decision needed**: Support this? How — config flag? Separate planner mode? Skip for V1?

---

## F7: Custom version constraints

No way to say "stay below 2.0.0" or "minimum bump is minor".

**Decision needed**: Worth adding? Config shape? Skip for V1?

---

## F8: Candidate → official promotion

No way to promote a prerelease candidate to the official version.

**Decision needed**: Is this a needed workflow? How would it work mechanically?

---

## F9: Changelog categories

Only Breaking/Features/Fixes. No perf, docs, refactor, chore.

**Decision needed**: Which additional categories? All standard CC types? Configurable?

---

## F10: Auto-append CHANGELOG.md

No automatic CHANGELOG.md file updates.

**Decision needed**: Auto-append? Prepend? Per-package or root? Format?

---

## F12: Custom changelog template

No support for custom changelog format/template.

**Decision needed**: Handlebars? Function? Skip for V1?

---

## F13: Platform support beyond GitHub

GitHub-only. No GitLab/Bitbucket.

**Decision needed**: Scope for V1 — GitHub only acceptable? Or abstract now?

---

## F14: GitHub Actions workflow template

No provided workflow template for users.

**Decision needed**: Provide one? What triggers? What steps? Reusable workflow?

---

## F15: Auto PR comment updates with publish status

Commentator can render comments but no auto-update after publish.

**Decision needed**: Auto-update PR comment on publish? What info to include?

---

## F16: Concurrent release conflict detection

No detection of simultaneous release attempts.

**Decision needed**: File lock? Plan versioning? Skip for V1?

---

## F17: Additional lint rules

Only 12 rules. Missing common checks.

**Decision needed**: Which rules to add? Breaking change description? Deprecation notices? Test coverage?

---

## F18: Configurable scopes validation

Scopes come from workspace package names. No custom scope config.

**Decision needed**: Allow custom scope mapping? Or always derive from workspace?

---

## F19: Tool availability pre-checks

Rules don't verify npm/git are available before running.

**Decision needed**: Add upfront tool checks? Or let them fail naturally?

---

## F20: Per-package config

All packages use same release rules. No per-package overrides.

**Decision needed**: Support per-package config? Shape? Where stored?

---

## F21: Custom tag format

Hardcoded `@name@version` tag format.

**Decision needed**: Make configurable? What template syntax? Skip for V1?

---

## F22: Custom git remote name

Assumes 'origin'.

**Decision needed**: Make configurable? Auto-detect? Skip for V1?

---

## F23: Preset configs

No preset configurations for common setups.

**Decision needed**: Worth having? What presets — monorepo, single-package, org?

---

## F24: Resume command for partial failures

No way to resume a failed apply.

**Decision needed**: Design? Checkpoint system? Idempotent retry? Skip for V1?

---

## F25: Release audit trail

No transaction log of what was published.

**Decision needed**: Log format? Where stored? What info captured?

---

## F26: Post-release hooks

No lifecycle hooks after release.

**Decision needed**: Hook system design? Just shell commands? Effect services?

---

## F27: Parallel package publishing

Sequential publishing only.

**Decision needed**: Worth parallelizing? Concurrency limit? Dependency ordering?

---

## F28: Stale plan detection

Plan can be executed even after new commits land.

**Decision needed**: Check HEAD SHA at apply time? Warn or block?

---

## F30: Single-package repo support

Tool assumes monorepo patterns.

**Decision needed**: First-class single-package support? Or "monorepo with 1 package" is fine?

---

## F31: 100+ package performance

No performance testing or pagination for large monorepos.

**Decision needed**: Worth testing now? Any known bottlenecks to address?

---

## F32: First release with 0 commits

Edge case: repo with packages but no conventional commits.

**Decision needed**: What should happen? Error? Skip? Create 0.0.1?

---

## X1: --verbose / --debug flag

No way to get detailed output for troubleshooting.

**Decision needed**: What info to surface? Effect log level? Git commands? API calls?

---

## X2: --json output for commands

Only `release log` has JSON output. Other commands don't.

**Decision needed**: Which commands need JSON? What schema?

---

## X4: Quick-start guide

No tutorial or getting-started flow.

**Decision needed**: In README? Separate doc? `release guide` command?

---

## X5: release config command

No command to view/edit configuration.

**Decision needed**: `release config show`? `release config validate`? Skip for V1?

---

## X6: Tag listing command

`--since` in `release log` requires knowing tag format. No way to list available tags.

**Decision needed**: `release tags` command? Or integrate into `release status`?

---

## X9: GitHub error differentiation

Generic GitHub errors. No distinction between auth/API/rate-limiting.

**Decision needed**: Parse GitHub API responses for specific guidance? How granular?

---

## X12: Lint report visual design

Basic numbered list format. No color or severity indicators.

**Decision needed**: What visual style? Colors? Checkmarks/crosses? Severity badges?

---

## X13: Severity display in violations

Violation list doesn't show whether each is error vs warn.

**Decision needed**: Prefix with severity? Color-code? Group by severity?

---

## X14: Dry-run visual treatment

Plain "[DRY RUN]" text prefix.

**Decision needed**: Color? Box? Banner? How prominent?

---

## X15: Progress indicators

No spinners or progress bars during long operations.

**Decision needed**: Use Effect's built-in logging? Ora spinners? Custom? Skip for V1?

---

## X16: Terminal compatibility

Box-drawing characters may not render in all terminals.

**Decision needed**: Detect terminal capabilities? Provide ASCII fallback? Always use ASCII?

---

## X17: Apply confirmation format

Doesn't clearly show version deltas.

**Decision needed**: `v1.0.0 → v1.1.0` format? Table? Color diff?

---

## X18: Plan output suggestions

`release plan` doesn't suggest next steps like `release render tree`.

**Decision needed**: Add hint lines? How prominent? Which suggestions?

---

## X19: Lifecycle explanation in CLI

Lifecycle types not explained in command output.

**Decision needed**: Add one-line explanation? Only on first use? In help text only?

---

## X20: Comment preview command

No CLI command to preview what a PR comment would look like.

**Decision needed**: `release render comment` exists but is it discoverable enough? Separate command?

---

## X21: Top-level convenience APIs

Must assemble the full pipeline programmatically. No `release.plan()`.

**Decision needed**: Provide convenience wrappers? Or keep pipeline explicit for power users?

---

## X22: Planner API unification

Three separate functions: `official()`, `candidate()`, `ephemeral()`.

**Decision needed**: Unify to `plan(lifecycle)` with type param? Or keep separate for type safety?

---

## X23: Error type aggregation

Errors scattered across modules. No `Release.Errors.All`.

**Decision needed**: Create aggregate? Or rely on per-module imports?

---

## X24: Plan resource export

`Api.Planner.resource` not exported at top level.

**Decision needed**: Export at top level? Or keep in module namespace?

---

## X25: Cleanup command

No way to clean up after interrupted applies.

**Decision needed**: `release cleanup`? What does it clean — tags? plan files? npm state?

---

## X26: Resume for partial failures

Same as F24.

**Decision needed**: (see F24)

---

## X27: Retry guidance in error messages

Network errors during npm publish don't suggest retry.

**Decision needed**: What guidance text? "Run release apply again"? More specific?

---

## X28: Plan file lifecycle

Plan deleted after successful apply. If tags fail to push, plan is lost.

**Decision needed**: Keep plan file? Archive it? Delete only on full success?
