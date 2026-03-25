# Release PR Batch Review Summary

- Total PRs reviewed: 31
- PRs with findings: 29
- PRs with no findings: 2
- PRs with insufficient context: 0

## Findings by Priority

- P0: 1
- P1: 5
- P2: 35
- P3: 35

## No-Finding PRs

- #169 fix(release): fail when until boundary cannot be resolved
- #183 refactor(release): share command workspace bootstrap

## Findings

### #167 fix(release): scope package test discovery

- Priority: P2
- File: packages/release/src/_.test.ts:220
- Title: Login shell flag `-lc` in spawnSync can cause vitest to not be found in CI
- Detail: The subprocess is launched with `/bin/sh -lc …`. The `-l` (login shell) flag causes the shell to source profile scripts (`.profile`, `.bash_profile`, `/etc/profile.d/*`, etc.), which may **reset or override PATH** — e.g. NVM, rbenv, and many CI setup scripts do `export PATH=…` wholesale, dropping the prepended `node_modules/.bin` entry that the test explicitly adds. If PATH is reset, `vitest` won't be found and the test will fail with a confusing `command not found` exit instead of a meaningful assertion error. Should be `-c` only: ```ts const result = spawnSync('/bin/sh', ['-c', `${testScript} --reporter=verbose`], { ``` The PATH override via `env` is sufficient without `-l`.

### #167 fix(release): scope package test discovery

- Priority: P3
- File: packages/release/src/_.test.ts:68
- Title: Effect Schema used for simple JSON.parse of package.json
- Detail: `Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown))` and `Schema.decodeUnknownSync` are used to read `package.json`. Since the file is trusted source (a repo-committed file) and any parse error would already surface as a thrown exception, this is over-engineered. Plain `JSON.parse` with a cast achieves the same thing without pulling Schema semantics into test infrastructure: ```ts const packageJson = JSON.parse(   readFileSync(new URL('../package.json', import.meta.url), 'utf8') ) as Record<string, unknown> ``` The `getOptionalStringField` / `getOptionalRecordField` helpers can stay — they're straightforward guards.

### #168 fix(release): honor per-package analysis boundaries

- Priority: P2
- File: packages/release/src/api/analyzer/analyze.ts:168
- Title: `allowedHashesByScope` silently drops unknown scopes instead of passing them through
- Detail: The new `flatImpacts` filter returns `false` when `allowedHashes` is `undefined` (scope not in `allowedHashesByScope`): ```typescript return allowedHashes ? HashSet.has(allowedHashes, impact.commit.hash) : false ``` Prior to this PR, unknown scopes passed through `flatImpacts` and were silently dropped later in the `aggregateByPackage` loop (`if (!pkg) continue`). The new behavior is functionally equivalent for today's code, but it changes the contract: any scope not in `options.packages` is now dropped at the `extractImpacts` stage rather than the `aggregateByPackage` stage. If any code path between these two stages ever needs to process unknown-scope impacts (e.g., for logging or diagnostics), this early drop would be a silent bug. Consider: `return allowedHashes === undefined || HashSet.has(allowedHashes, impact.commit.hash)` to pass through unknown scopes for the existing downstream filter to handle. Or add a comment documenting that the `false` branch is intentionally mirroring the downstream `if (!pkg) continue` behavior.

### #168 fix(release): honor per-package analysis boundaries

- Priority: P3
- File: packages/release/src/api/analyzer/analyze.ts:102
- Title: Cache in `collectScopedCommits` uses linear array scan instead of a `Map`
- Detail: The commit cache uses an `Array` with `Array.find()` for lookups: ```typescript const cache: Array<{ since: string | undefined; commits: readonly Git.Commit[] }> = [] // ... let cached = cache.find((entry) => entry.since === since) ``` This is O(n) per package lookup, making the overall loop O(packages²). For typical monorepos this is negligible, but it is inconsistent with the rest of the codebase's use of `HashMap`/`MutableHashMap` for keyed collections. A `Map<string | undefined, readonly Git.Commit[]>` would be more idiomatic and O(1): ```typescript const cache = new Map<string | undefined, readonly Git.Commit[]>() // ... const trimmedCommits = cache.get(since) ?? ...compute and set... ``` Note: `Map` handles `undefined` keys correctly, unlike most record-based approaches.

### #170 fix(release): resolve configured packages from workspace paths

- Priority: P2
- File: packages/release/src/api/analyzer/workspace.ts:113
- Title: Scan failure is silently swallowed when config packages are present
- Detail: When `Exit.isFailure(discoveredPackagesExit)` is true, the error is dropped and every configured package silently falls back to an inferred `packages/{scope}/` path. A workspace read failure (e.g. malformed root `package.json`, missing `workspaces` field) would produce incorrect package paths with no diagnostic signal. This is an asymmetric contract: when `configPackages` is empty, `ScanError` surfaces to the caller; when it's non-empty, the same error disappears. Consider at least logging the cause: ```typescript if (Exit.isFailure(discoveredPackagesExit)) {   yield* Effect.logWarning(     'Workspace scan failed; falling back to inferred package paths',     { cause: discoveredPackagesExit.cause },   )   return Object.entries(configPackages).map(([scope, name]) =>     inferConfiguredPackage(env.cwd, scope, name),   ) } ```

### #170 fix(release): resolve configured packages from workspace paths

- Priority: P3
- File: packages/release/src/api/analyzer/workspace.ts:126
- Title: Unnecessary `as Record<string, Package>` cast on `discoveredByName`
- Detail: `Object.fromEntries` with explicit tuple types already produces `Record<string, Package>` — the cast is redundant and masks potential future type mismatches. Remove the cast: ```typescript const discoveredByName = Object.fromEntries(   discoveredPackages.map((pkg): [string, Package] => [pkg.name.moniker, pkg]), ) ```

### #170 fix(release): resolve configured packages from workspace paths

- Priority: P3
- File: packages/release/src/api/analyzer/workspace.test.ts:22
- Title: Duplicated test setup across both test cases
- Detail: Both tests create the same temp directory structure (`tooling/pkg-core` with `@kitz/core`). This could be extracted into a `beforeEach`/`afterEach` pair with a shared `rootDir` variable, reducing ~25 lines of duplicate setup and making future additions cheaper.

### #171 fix: honor configured packages in release notes

- Priority: P1
- File: packages/release/src/cli/commands/notes-lib.test.ts:62
- Title: Tests 1 and 2 have incorrect path assertions — will fail at runtime
- Detail: Both `resolveNotesPackages` and `loadNotesPackagesWith` tests create workspace fixtures at `tooling/pkg-core/` and `tooling/pkg-cli/` (matching the root `workspaces: ['tooling/*']` glob), then assert: ```ts expect(Fs.Path.toString(packages[0]!.path)).toBe(`${rootDir}/tooling/pkg-core/`) ``` But `resolvePackages` with a non-empty `configPackages` does **not** consult the filesystem — it constructs synthetic paths using the hardcoded `./packages/` dir and the scope key: ```ts // workspace.ts line 100-104 const packagesDir = Fs.Path.join(env.cwd, packagesRelDir)  // cwd/packages/ const scopeRelDir = Fs.Path.RelDir.fromString(`./${scope}/`) // ./core/ const scopeDir = Fs.Path.join(packagesDir, scopeRelDir)      // cwd/packages/core/ ``` For `{ core: '@kitz/core' }` the returned path is `${rootDir}/packages/core/`, **not** `${rootDir}/tooling/pkg-core/`. The assertion will fail. Fix options: 1. **Make the fixture match the implementation**: change fixture directories to `packages/core/` and `packages/cli/`, update `workspaces: ['packages/*']`, and fix the assertions to `${rootDir}/packages/core/`. 2. **Make the implementation match the intent**: change `resolvePackages` to scan first and then filter by configured names (like `scan` already does), so it returns actual workspace paths. This is arguably the more correct behavior for "honoring" a config.

### #171 fix: honor configured packages in release notes

- Priority: P2
- File: packages/release/src/api/analyzer/workspace.ts:98
- Title: `resolvePackages` with configured packages uses a hardcoded `./packages/` path assumption
- Detail: When `configPackages` is non-empty, `resolvePackages` constructs package paths as `cwd/packages/<scope>/` regardless of where the monorepo actually stores its packages. This hard-codes a kitz-specific convention and means configured packages are located by convention rather than discovery. The `scan` fallback correctly uses `Monorepo.Workspace.read` to discover actual paths. The configured-packages branch should probably also scan and then filter, or at minimum document this convention constraint clearly. As-is, any repo where packages aren't under `./packages/<scope>/` would get wrong paths silently.

### #171 fix: honor configured packages in release notes

- Priority: P3
- File: packages/release/src/cli/commands/notes-lib.ts:6
- Title: `resolveNotesPackages` is an unnecessary `Effect.gen` wrapper with no added value
- Detail: ```ts export const resolveNotesPackages = (configPackages: Api.Analyzer.Workspace.PackageMap) =>   Effect.gen(function* () {     return yield* Api.Analyzer.Workspace.resolvePackages(configPackages)   }) ``` This is a pass-through wrapper — `Effect.gen` wrapping a single `yield*` adds no transformation, error handling, or context. It could simply be: ```ts export const resolveNotesPackages = Api.Analyzer.Workspace.resolvePackages ``` or removed in favor of calling `Api.Analyzer.Workspace.resolvePackages` directly from `loadNotesPackagesWith`.

### #172 fix(release): honor notes until boundaries

- Priority: P2
- File: packages/release/src/api/notes/generate.ts:106
- Title: Silent fallback emits no signal when `until` boundary cannot be verified
- Detail: When `getCommitsSince(until)` fails **and** none of the three knowledge checks succeed (`getTagSha`, `commitExists`, `tags.includes`), the function silently returns the full commit window — effectively ignoring `until`. A caller who passes a misspelled tag name or an invalid SHA would receive wider-than-expected release notes with no warning, log, or error. The `generate` result doesn't expose which packages had their `until` boundary honored vs. ignored, so callers have no way to detect this silently-widened state. Consider adding at least a structured `Effect.logDebug` (or a field on `GenerateResult`) for the "unknown boundary, falling back" case: ```typescript return yield* Effect.logDebug(   `notes.generate: until boundary '${until}' is unknown — falling back to full window`, ).pipe(Effect.as(commits)) ```

### #172 fix(release): honor notes until boundaries

- Priority: P2
- File: packages/release/src/api/notes/generate.ts:93
- Title: `Effect.option(git.getTagSha(until))` conflates "tag not found" with git infrastructure failures
- Detail: In the failure branch of `getCommitsSince(until)`, the code uses: ```typescript const knownTag = yield* Effect.option(git.getTagSha(until)) ``` `Effect.option` converts **any** typed failure to `None` — including `GitError`s that result from git being temporarily unavailable, not just "tag not found". In that degraded state: - `knownTag` → `None` - `commitExists` falls back similarly (live impl swallows errors via `.then(() => true, () => false)`, so this is benign) - If `until` is also absent from the caller's `tags` snapshot → falls through to silent widening This is a latent risk rather than an active bug today (because `getCommitsSince(since)` would already have failed earlier if git were truly unavailable). But the assumption is implicit and not commented. A narrow `Effect.option` for only the `GitParseError` / "not found" case, or an explicit comment, would make the intent clearer.

### #172 fix(release): honor notes until boundaries

- Priority: P3
- File: packages/release/src/api/notes/generate.test.ts:197
- Title: Test for failure case inspects `result.failure` without type narrowing the Cause
- Detail: The final test accesses `result.failure._tag` and `result.failure.context` directly: ```typescript expect(result.failure._tag).toBe('GitError') if (result.failure._tag === 'GitError') {   expect(result.failure.context.operation).toBe('getCommitsSince') } ``` This pattern is consistent with every other test in the `packages/release` suite (confirmed), so it is correct for the repo's Effect v4 `Exit` API. No change needed — just noting for reviewers unfamiliar with the convention that `result.failure` gives the typed error directly (not the `Cause`).

### #173 fix(release): make explorer recon truthful

- Priority: P2
- File: packages/release/src/api/explorer/explore.test.ts:149
- Title: toExecutorRuntimeConfig test fixture uses `registry: 'https://registry.npmjs.org'` — a value explore() can no longer produce
- Detail: The `describe('toExecutorRuntimeConfig', ...)` block constructs a static `Recon` fixture with `npm: { ..., registry: 'https://registry.npmjs.org' }`. After this PR, `explore()` always returns `registry: null` when no `NPM_CONFIG_REGISTRY` env var is set. TypeScript accepts the fixture because `string` satisfies the new `string | null` type — no compile error surfaces — but the fixture now silently tests a path that the live `explore()` function can no longer reach. The fixture should be updated to `registry: null` (the new default), or a comment should explain it deliberately tests the explicit-registry variant. As written, it could mislead a future reader into thinking `'https://registry.npmjs.org'` is still the live default.

### #173 fix(release): make explorer recon truthful

- Priority: P3
- File: packages/release/src/api/explorer/explore.ts:167
- Title: `resolveGitRemotes` swallows all GitErrors via `Effect.option` — inconsistent with the `catchTag` fix in the same PR
- Detail: ```ts const origin = yield* git.getRemoteUrl('origin').pipe(Effect.option) ``` `Effect.option` converts **any** `GitError` (CLI crash, permissions failure, not just 'no remote configured') into `Option.none()`, silently returning `{}`. This is inconsistent with the fix made in this very PR to `resolveReleaseTarget`, which changed from `Effect.catch((error: any) => ...)` to `Effect.catchTag('GitError', ...)` for precisely this reason. The leniency is arguably intentional (remotes is informational; explore would already fail earlier if git is completely broken), but it's undocumented. A brief comment like `// Informational only — missing or unreachable origin is non-fatal` would prevent future readers from wondering whether this is intentional or an oversight.

### #174 fix(release): support custom candidate dist-tags

- Priority: P2
- File: packages/github/src/service.ts:44
- Title: UpdateReleaseParams with all-optional fields allows no-op API calls
- Detail: Both `title` and `body` are now optional with no runtime guard requiring at least one. A caller can invoke `gh.updateRelease(tag, {})` which produces a real HTTP PATCH with an empty body — a wasted API call (and in memory.ts, it spreads nothing over the existing release). The `live.ts` implementation already uses conditional spreads so the HTTP body may be `{}`. This isn't exercised today, but it's a latent footgun in the interface contract. Consider a type-level constraint such as `AtLeastOne<UpdateReleaseParams>` or a runtime guard at the top of `updateRelease` that early-returns when neither field is provided.

### #174 fix(release): support custom candidate dist-tags

- Priority: P3
- File: packages/release/src/api/executor/workflow.ts:127
- Title: resolveCandidateDistTag recomputed inside every .map() iteration
- Detail: The helper reads only from `payload.options`, which is constant for all releases in the batch. It is called once inside `pushTags`'s `.map()` and once inside `createGHReleases`'s `.map()`, recomputing the same value for each release. The result could be hoisted above each loop with a single `const candidateDistTag = resolveCandidateDistTag(payload.options)`. Trivially inefficient, but also slightly obscures that the value is per-batch, not per-release.

### #174 fix(release): support custom candidate dist-tags

- Priority: P3
- File: packages/release/src/api/executor/workflow.ts:282
- Title: Silent removal of tag.endsWith('@next') fallback with no explanatory comment
- Detail: The old code had `const isCandidate = payload.options.tag === 'next' || tag.endsWith('@next')`. This PR removes the `tag.endsWith('@next')` branch entirely with no inline comment. While that branch was almost certainly dead code (a tag like `@kitz/core@1.0.0-next.1` does not end with `@next`, and neither does a normal stable tag), the rationale doc only mentions the legacy `next` case — it doesn't explicitly acknowledge the removal of this second branch. A one-line comment noting the branch was inert would prevent future readers from wondering whether it was accidentally dropped.

### #175 fix(release): remove dead skipNpm config

- Priority: P1
- File: packages/release/src/api/config.ts:54
- Title: `static ordered = false as const` is unexplained and has no consumer
- Detail: Both `Config` and `ResolvedConfig` gain `static ordered = false as const`. A codebase-wide search finds zero reads of `.ordered` on any schema class — the only occurrence of `ordered` as a name is a local variable in `execute.ts`. `ordered` is not a standard Effect `Schema.Class` property, nor is it an established convention in this repo (no other Schema.Class subclass has it). Adding an unexplained boolean marker to production schema classes is a smell: it either implies a planned catalog/ordering feature that was never wired up, or it's dead code that leaked from a draft. Should be removed or explained with a comment and a consumer.

### #175 fix(release): remove dead skipNpm config

- Priority: P2
- File: packages/release/src/api/config.ts:48
- Title: Out-of-scope static delegators applied inconsistently
- Detail: Both `Config` and `ResolvedConfig` gain six new static delegators (`is`, `decode`, `decodeSync`, `encode`, `encodeSync`, `equivalence`) that are unrelated to the `skipNpm` removal. While `static is` is an established pattern throughout the repo, the `decode/encode/equivalence` delegators are not — no other `Schema.Class` subclass in the release package (`Publishing`, `Operator`, `ResolvedOperator`, `LintConfig.Config`, etc.) has them. The PR silently introduces a new convention on only two classes, creating inconsistency. These additions should either be a separate PR that applies the pattern uniformly across all release schema classes, or they should be omitted here.

### #176 fix(release): remove preview diff layout assumptions

- Priority: P2
- File: packages/release/src/api/config.ts:54
- Title: Schema.encodeUnknownEffect / encodeUnknownSync are unverified in Effect beta.31
- Detail: The PR replaces `Schema.encode` / `Schema.encodeSync` with `Schema.encodeUnknownEffect` / `Schema.encodeUnknownSync`. The `decode`-side renames (`decodeUnknownEffect`, `decodeUnknownSync`) are confirmed throughout the codebase. However, `encodeUnknownEffect` and `encodeUnknownSync` appear in no other file in the repo — they cannot be cross-validated from local usage. The official Effect v4 docs (effect.website) only list `encode` (returns Effect) and `encodeSync` as the encode variants. If beta.31 does not export `encodeUnknownEffect` / `encodeUnknownSync`, these static methods will be `undefined` at runtime (or TypeScript will error at build time). The `bun run release:verify` step in the PR description should catch this, but worth confirming the CI gate actually ran successfully before assuming these API names are valid.

### #176 fix(release): remove preview diff layout assumptions

- Priority: P3
- File: packages/release/src/cli/pr-preview-diff.ts:8
- Title: Unused Diff type import in pr-preview-diff.ts
- Detail: Line 8 imports both `ChangedFile` and `Diff` from `'../api/lint/services/diff.js'`, but `Diff` is never referenced in the file — only `ChangedFile` is used. This is a dead import that will trigger any unused-import lint rule. ```ts // Before import type { ChangedFile, Diff } from '../api/lint/services/diff.js' // After import type { ChangedFile } from '../api/lint/services/diff.js' ```

### #176 fix(release): remove preview diff layout assumptions

- Priority: P3
- File: packages/release/src/cli/commands/doctor.ts:179
- Title: resolveDiffRemote called twice in the doctor command
- Detail: `resolveDiffRemote(config)` is computed explicitly and stored in `diffRemote` (used for the `env.git-remote` rule option), but then `loadConfiguredPullRequestDiff({ config, ... })` internally calls `resolveDiffRemote(config)` a second time from the same config. This is not a correctness bug — both reads produce the same value. But the doctor site could instead call `loadPullRequestDiff({ ..., remote: diffRemote })` directly to make the data flow explicit and avoid the redundant computation: ```ts const diffRemote = resolveDiffRemote(config) const diff = pullRequest   ? yield* loadPullRequestDiff({ pullRequest, packages, required: false, remote: diffRemote })   : null ```

### #177 refactor(release): unify lifecycle planner core

- Priority: P2
- File: packages/release/src/api/planner/models/plan.ts:83
- Title: Plan.decode and Plan.is enforce different invariants — a decoded Plan can fail Plan.is
- Detail: The new `Plan.decode = S.decodeUnknownEffect(Plan)` runs only schema validation. The new `Plan.is = (v) => S.is(Plan)(v) && hasConsistentLifecycle(v)` runs schema validation **plus** lifecycle consistency. This means a `Plan` produced via `await Plan.decode(rawJson)` (e.g., for testing or direct usage outside the resource) could satisfy the Schema shape but fail `Plan.is`, even though the caller holds a value of type `Plan`. The `resource.ts` I/O layer correctly calls `validatePlan` (which runs `assertLifecycleConsistency`) after decoding, so the resource path is safe. But direct callers of `Plan.decode` — including any future tests or integrations that bypass the resource — will silently hold inconsistent `Plan` values that fail `Plan.is`. **Fix**: Either run `assertLifecycleConsistency` inside `Plan.decode` (make decode enforce the full invariant), or document clearly on `Plan.is` that it checks consistency beyond schema membership, and on `Plan.decode` that the returned value may be inconsistent. A third option: expose a `Plan.validate(plan)` helper that callers can chain after `Plan.decode`.

### #177 refactor(release): unify lifecycle planner core

- Priority: P2
- File: packages/release/src/api/planner/models/plan.ts:113
- Title: assertLifecycleConsistency called twice in the exported make() function
- Detail: The exported `make` function wraps its result in `assertLifecycleConsistency(...)`, but `Plan.make` (called inside) **already** calls `assertLifecycleConsistency(this.makeUnsafe(input))`. So for every plan built via `planLifecycle` → `make(...)`, the consistency check fires twice. ```typescript // Outer assertLifecycleConsistency is redundant — Plan.make already calls it export const make = (...) =>   assertLifecycleConsistency(   // ← redundant     Plan.make({ ... }),          // ← Plan.make already asserts   ) as PlanOf<$lifecycle> ``` While harmless (idempotent), it creates a misleading impression that the outer call is necessary for safety, and it will confuse future maintainers tracing the invariant enforcement path. **Fix**: Remove the outer `assertLifecycleConsistency` call and rely on the cast: ```typescript export const make = <$lifecycle extends Lifecycle>(   lifecycle: $lifecycle,   releases: PlannedItem<$lifecycle>[],   cascades: PlannedItem<$lifecycle>[], ): PlanOf<$lifecycle> =>   Plan.make({     lifecycle,     timestamp: new Date().toISOString(),     releases: [...releases],     cascades: [...cascades],   }) as PlanOf<$lifecycle> ``` The invariant is enforced once inside `Plan.make`, and the `as` cast is justified because `PlannedItem<$lifecycle>[]` inputs guarantee lifecycle consistency before calling `Plan.make`.

### #177 refactor(release): unify lifecycle planner core

- Priority: P3
- File: packages/release/src/api/planner/models/plan.ts:17
- Title: PlanOf type's arrays are mutable while Plan's arrays are readonly — minor inconsistency
- Detail: The `PlanOf<$lifecycle>` type declares: ```typescript export type PlanOf<$lifecycle extends Lifecycle> = Plan & {   readonly lifecycle: $lifecycle   readonly releases: PlannedItem<$lifecycle>[]     // mutable   readonly cascades: PlannedItem<$lifecycle>[]     // mutable } ``` But `Plan` (the base Schema class) has `releases: S.Array(ItemSchema)` which Effect Schema represents as `readonly Item[]`. Making the narrowed arrays mutable in `PlanOf` is an inconsistency — assignments like `plan.releases.push(item)` would be allowed at the narrowed type level but not at the base type level, and the runtime object's array is likely immutable (coming from Effect Schema's `S.Array`). **Fix**: Use `readonly PlannedItem<$lifecycle>[]` to match the Schema-inferred type: ```typescript export type PlanOf<$lifecycle extends Lifecycle> = Plan & {   readonly lifecycle: $lifecycle   readonly releases: readonly PlannedItem<$lifecycle>[]   readonly cascades: readonly PlannedItem<$lifecycle>[] } ```

### #178 refactor(release): centralize package location resolution

- Priority: P3
- File: packages/release/src/api/analyzer/package-location.ts:40
- Title: Dead code: second TypeError guard in `fromAbsolutePath` is unreachable
- Detail: The guard `if (relativePath.length === 0)` with the message `"cannot be the repo root itself"` is unreachable. `normalizeAbsoluteDir` strips trailing slashes from both `root` and `path`, so when `path === root`, both normalize to the same string (e.g. `/repo`). Then `normalizedPath.startsWith(rootPrefix)` = `'/repo'.startsWith('/repo/')` → `false`, so the first `TypeError` fires instead with the misleading message `"is not inside repo root"`. The second guard never executes. Either the normalization should preserve a trailing slash on `rootPrefix` differently, or the error message on the first guard should cover the root-equality case explicitly.

### #178 refactor(release): centralize package location resolution

- Priority: P2
- File: packages/release/src/cli/pr-preview-diff.ts:71
- Title: Silent skip → Effect defect: behavioral change in `toAffectedPackages` is undocumented
- Detail: The old `toAffectedPackages` silently skipped packages whose absolute path wasn't inside the repo root (via a `null` filter). The new code calls `PackageLocation.fromAbsolutePath(root, pkg.path)` inside `.map()`, which throws a synchronous `TypeError` for any out-of-root package. Since `toAffectedPackages` is called as a plain function inside `Effect.gen` (not yielded), Effect's generator runner converts the uncaught throw into a defect (`Effect.die`), failing the entire `loadPullRequestDiff` effect rather than skipping the problematic package. This is arguably the correct behavior (out-of-root packages are a programmer error), but it's an observable breaking change from the prior graceful degradation. A comment on `fromAbsolutePath` or a short rationale note clarifying the fail-fast intent would make the contract explicit.

### #179 refactor(release): centralize publish channel semantics

- Priority: P2
- File: packages/release/src/api/publishing.ts:54
- Title: Unrelated static members added to `Publishing` Schema.Class, including unexplained `ordered = false`
- Detail: The diff adds `static is`, `static decode`, `static decodeSync`, `static encode`, `static encodeSync`, `static equivalence`, and `static ordered = false as const` to `Publishing`. None of these are related to the PR's stated scope of centralizing publish semantics. The `static ordered = false as const` is particularly concerning — it appears nowhere else in the release package, has no explanation in the PR description or rationale doc, and could shadow a property name used by Effect's Schema.Class machinery or a future convention in the codebase. If this was added to satisfy a type interface, that interface should be cited. If not, these should be removed.

### #179 refactor(release): centralize publish channel semantics

- Priority: P2
- File: packages/release/src/api/executor/workflow.ts:156
- Title: `resolvePublishSemantics` in `workflow.ts` silently ignores `npmTag`/`candidateTag` for programmatic callers
- Detail: The `ReleasePayload.options` schema only carries `tag` (not `npmTag` or `candidateTag`), so when `resolvePublishSemantics` is called in the graph function it can only see `lifecycle`, `publishing`, and `tag`. This is safe when the caller is `apply.ts`, which pre-resolves the distTag (including config-level `npmTag`/`candidateTag`) and stores the resolved value as `tag` in the payload. However, any direct programmatic caller of `execute()` passing `lifecycle: 'official'` without an explicit `tag` will silently receive `distTag: 'latest'` regardless of what their config specifies as `npmTag`. The function signature makes no mention of this constraint. At minimum, a comment should document that `tag` in the payload is expected to be the already-resolved distTag; ideally the public `execute` API surface should accept `npmTag`/`candidateTag` or the re-resolution in the workflow should be removed.

### #179 refactor(release): centralize publish channel semantics

- Priority: P3
- File: packages/release/src/api/executor/workflow.ts:354
- Title: Non-null assertion on `legacyCandidateDistTag!` inside an OR condition obscures intent
- Detail: Inside `if (publishSemantics?.githubReleaseStyle === 'dist-tagged' || legacyCandidateDistTag !== undefined)`, TypeScript cannot narrow `legacyCandidateDistTag` to `string` because the OR means either branch could have satisfied the condition. The resulting `publishSemantics?.distTag ?? legacyCandidateDistTag!` is pragmatically correct but communicates nothing about the expected invariant. Replacing the assertion with `?? legacyCandidateDistTag ?? 'next'` (matching the constant that was always intended here) would both satisfy the type checker and document the fallback value explicitly.

### #180 refactor(release): share command lint rule helpers

- Priority: P3
- File: packages/release/src/cli/lint-rule-config.ts:1
- Title: CommandLintRuleOptions is a manually-maintained type map with no structural link to actual rule schemas
- Detail: The `CommandLintRuleOptions` interface hardcodes option shapes for each rule ID (e.g., `surface?: 'execution' | 'preview'`, `remote?: string`). There is no compile-time coupling between these annotations and the actual Schema or option types defined inside each rule file. If a rule's options change — say `surface` gains a new variant, or `projectedHeader` becomes optional — the interface must be updated by hand and there is no compiler error to remind authors. Consider deriving this map from the rule implementations rather than maintaining it separately.

### #180 refactor(release): share command lint rule helpers

- Priority: P3
- File: packages/release/src/cli/lint-rule-config.ts:28
- Title: options is optional in CommandLintRuleSpec even for rules with required option fields
- Detail: For `'pr.projected-squash-commit-sync'`, `CommandLintRuleOptions` declares `{ readonly projectedHeader: string }` (required). However, the `options?` field in `CommandLintRuleSpec<K>` is optional for all `K`, so `commandLintRule({ id: 'pr.projected-squash-commit-sync' })` compiles without `options`. At runtime `buildEnabledRuleConfig` would merge an empty object, leaving `projectedHeader` undefined. The rule's check then compares `actualHeader !== options.projectedHeader` — `undefined` — silently failing to flag a mismatch. Both current call sites supply `projectedHeader` correctly, so there is no live bug, but a future call site can accidentally omit it and TypeScript will not warn. A conditional required-options overload or a runtime assertion would close the gap.

### #182 fix(release): restore publishing typecheck gate

- Priority: P2
- File: packages/release/src/api/publishing.ts:55
- Title: encode/encodeSync statics accept `unknown` instead of `Publishing`, weakening caller type safety
- Detail: ```typescript // Before (typed input — callers get compile-time safety) static encode = Schema.encode(Publishing)       // (a: Publishing) => Effect<I> static encodeSync = Schema.encodeSync(Publishing) // (a: Publishing) => I // After (unknown input — callers lose compile-time enforcement) static encode = Schema.encodeUnknownEffect(Publishing)  // (u: unknown) => Effect<I> static encodeSync = Schema.encodeUnknownSync(Publishing) // (u: unknown) => I ``` For the **decode** statics, `unknown` input is idiomatic and correct (you're accepting external data). For the **encode** statics, a caller who already holds a valid `Publishing` instance loses the compile-time guarantee that they're passing the right type — `Publishing.encodeSync(completelywrongvalue)` now compiles without error and only fails at runtime. This is the correct pragmatic fix for the self-reference problem, and runtime validation still catches bad inputs. But if the goal is a strict ergonomic API, a follow-up could reintroduce typed encode helpers under a different name (e.g. `encodeSyncTyped`) now that the class is defined, or leverage a post-class declaration like: ```typescript // After class body — no more self-reference problem Publishing.encode = Schema.encode(Publishing) ``` This is low-priority given the pre-1.0 stance, but worth tracking.

### #185 fix(release): round-trip commit dates in plan storage

- Priority: P2
- File: packages/git/package.json:28
- Title: test script format diverges from workspace convention
- Detail: Every other package with a `test` script uses the pattern `vitest run --root ../.. packages/<pkg>/src` (release, github, yaml, oxlint-rules). This PR introduces a different form: `cd ../.. && vitest run --dir packages/git/src`. The `cd` + `--dir` approach is shell-dependent and differs in how vitest resolves its config and root. For consistency and reliability, use the established form: ```json "test": "vitest run --root ../.. packages/git/src" ```

### #185 fix(release): round-trip commit dates in plan storage

- Priority: P2
- File: packages/git/src/commit.ts:57
- Title: `static ordered = false as const` is unexplained dead code
- Detail: No other class in the codebase declares `static ordered`, and no code reads `Commit.ordered`. There is no protocol, interface, or utility in scope that consumes it. Adding undocumented, unused properties to a shared schema class violates the project's "avoid over-engineering" rule (CLAUDE.md: *Don't add features beyond what was asked*). If this is scaffolding for a future ordering protocol, it should land with the feature that requires it — not speculatively.

### #185 fix(release): round-trip commit dates in plan storage

- Priority: P2
- File: packages/git/src/commit.ts:51
- Title: Unused static utility methods added to `Commit` (scope creep)
- Detail: The PR adds `decode`, `decodeSync`, `encode`, `encodeSync`, and `equivalence` as static methods. None of these appear anywhere in the codebase, and `static is` (the one established pattern) was not included. While `static is = Schema.is(Commit)` is a widely-used convention here, the decode/encode/equivalence cluster is novel and unused. These should be added only when a consumer needs them. As-is they're speculative API surface on a shared package.

### #185 fix(release): round-trip commit dates in plan storage

- Priority: P3
- File: packages/git/src/_.test.ts:46
- Title: Sha error assertion silently weakened
- Detail: The test was changed from `.toThrow(/Sha/)` to `.toThrow()`. The regex asserted the error message referenced the `Sha` type, giving the test some discriminating power. The change is unrelated to the date round-trip fix and comes with no explanation. If Effect v4 changed the error message format so the old regex no longer matches, the fix should update the regex to the new format rather than dropping it entirely.

### #186 refactor(release): share active plan store

- Priority: P2
- File: packages/release/src/api/planner/store.ts:31
- Title: Pre-emptive exports: readActiveRequired and readActiveOrEmpty not used
- Detail: Both `readActiveRequired` and `readActiveOrEmpty` are exported but no command or test in this PR (or elsewhere in `packages/release/src`) actually calls them. Per CONTRIBUTING.md, over-engineering should be avoided — exports should be added when needed, not speculatively. These can be added when a consumer is ready.

### #187 refactor(release): reject dependency cycles explicitly

- Priority: P3
- File: packages/release/src/api/executor/execute.ts:193
- Title: Dead code: `if (next === undefined) break` is unreachable after refactor
- Detail: After the `if (ready.length === 0)` block returns `Effect.fail(...)` early, execution can only continue when `ready.length > 0`, guaranteeing `ready[0]` is defined. The subsequent `if (next === undefined) break` guard can never trigger and is now dead code. It was load-bearing in the old implementation where `next` was `ready[0] ?? fallback`, but the fallback path was removed. This doesn't affect correctness but is a minor readability issue.

### #188 refactor(release): share PR context resolution

- Priority: P2
- File: packages/release/src/api/explorer/explore-helpers.test.ts:208
- Title: Branch-matching path of `resolvePullRequestFromContext` has no test coverage
- Detail: The new `resolvePullRequestFromContext` test only exercises the `explicitPrNumber !== null` branch (explicit PR number). The other branch — falling back to `selectConnectedPullRequest(context.branch, pullRequests)` when `explicitPrNumber` is `null` — has no focused coverage. Because this is a newly-extracted public helper, the happy path of branch matching should also have a test case, particularly since `selectConnectedPullRequest` already has its own tests and this exercises the routing logic between the two paths.

### #188 refactor(release): share PR context resolution

- Priority: P2
- File: packages/release/src/cli/pr-preview.ts:312
- Title: `pr-preview.ts` drops a targeted error message when GitHub target cannot be resolved
- Detail: Before this PR, `pr-preview` had an explicit guard after `explore()`: ```typescript if (!runtime.github.target) {   return yield* Effect.fail(     new Api.Explorer.ExplorerError({       context: { detail: 'Could not resolve the GitHub repository target for the connected pull request.' },     }),   ) } ``` That guard is removed. The safety is preserved because `resolveGitHubContext()` calls `resolveReleaseTarget()` which fails as an Effect when it can't determine the target — so the flow still fails. However, the error the user sees is now whatever `resolveReleaseTarget` produces (a generic resolution error) rather than the context-aware message scoped to the PR preview command. The PR preview error surface should ideally remain as specific as possible.

### #188 refactor(release): share PR context resolution

- Priority: P3
- File: packages/release/src/api/explorer/__.ts
- Title: `exploreFromContext` is exported publicly but is primarily an internal composition helper
- Detail: Four new symbols are added to the public barrel (`exploreFromContext`, `resolveGitHubContext`, `resolvePullRequestContext`, `resolvePullRequestFromContext`) plus two new types. `exploreFromContext` in particular is a split of the existing `explore()` for internal composition — it requires callers to already hold a `ResolvedGitHubContext` (a type that is itself now public), which creates an implicit dependency on call-site discipline that the original `explore()` did not impose. If external consumers call `exploreFromContext` with a stale or synthetic context, they can get a `Recon` snapshot where `branch`, `target`, and `token` disagree with what the git/env services would have returned. Consider whether `exploreFromContext` should stay internal (`liveGithubLayerForContext` correctly stayed private as a model for this). The `resolve*` helpers are more defensible as public API since they are the core reusable units.

### #189 release: add status command for durable workflow state

- Priority: P1
- File: packages/release/src/api/executor/execute.ts:445
- Title: `ExecutorDependencyCycleError` is referenced but does not exist
- Detail: The `status` function declares `ExecutorDependencyCycleError` as its error type parameter, but this type is never defined or imported anywhere in the codebase. `grep -r ExecutorDependencyCycleError packages/release` returns no results. Since `toPayload` has error channel `never`, `ReleaseWorkflow.executionId` has error channel `never`, and `ReleaseWorkflow.poll` has error channel `never`, the correct type is `never`. This is a TypeScript compilation error. ```typescript // Current (broken) ): Effect.Effect<   ExecutionStatus,   ExecutorDependencyCycleError,          // ← doesn't exist   FileSystem.FileSystem | WorkflowEngine.WorkflowEngine > // Correct ): Effect.Effect<   ExecutionStatus,   never,   FileSystem.FileSystem | WorkflowEngine.WorkflowEngine > ```

### #189 release: add status command for durable workflow state

- Priority: P2
- File: packages/release/src/cli/commands/status.ts:60
- Title: CLI status command always exits 0, even for failed or suspended workflows
- Detail: The `status` command calls `Console.log(...)` and returns normally for every execution state, including `'failed'` and `'suspended'`. This means `echo $?` is always `0`, making the command unusable in scripts or CI checks that gate on release health. Compare the `apply` command, which calls `env.exit(1)` on error paths. At minimum, `'failed'` should exit non-zero. `'suspended'` is arguable — it's a recoverable state — but many operators would expect a non-zero exit there too. ```typescript if (workflowStatus.state === 'failed' || workflowStatus.state === 'suspended') {   yield* Console.log(...)   return env.exit(1) } yield* Console.log(...) ```

### #189 release: add status command for durable workflow state

- Priority: P3
- File: packages/release/src/api/executor/status.test.ts:53
- Title: `'failed'` execution state is not covered by a live workflow test
- Detail: The `'failed'` state (a `Complete` exit with a failure cause) is only exercised via a direct `formatExecutionStatus` call with hand-crafted data. No live test actually drives the workflow into a `_tag === 'Complete'` failed exit. This is also a subtle semantic gap: because `make()` annotates the workflow with `SuspendOnFailure: true`, typed `ExecutorError`s become suspensions rather than failures. A `'Complete'`+failed result would only occur from an unhandled defect — a case the `'failed'` branch in `summarizeWorkflowStatus` is actually designed to catch. The test covers the formatter but not the real trigger path.

### #189 release: add status command for durable workflow state

- Priority: P3
- File: packages/flo/src/workflow/workflow.ts:320
- Title: `poll` addition to `WorkflowInstance` interface lacks JSDoc
- Detail: The PR adds `poll` to the `WorkflowInstance` interface with a single-line JSDoc comment, but all sibling methods (`execute`, `observable`, `exists`) have multi-line JSDoc that documents when the method is appropriate and what it returns. The `poll` entry should note that it returns `undefined` when the execution has not started, distinguish the `'Suspended'` vs `'Complete'` variants, and clarify its relationship to `exists`.

### #190 release: add explicit resume command

- Priority: P1
- File: packages/release/src/cli/commands/resume.ts:96
- Title: CLI `resume.ts` bypasses the typed `resume()` API, duplicating state validation
- Detail: The CLI command manually checks `workflowStatus.state !== 'suspended'` and then calls `Api.Executor.executeObservable(...)` — the same streaming `execute` path used by `release apply`. The new `resume()` API introduced in this same PR is never invoked by the CLI. This creates two problems: 1. **Logic duplication**: state validation exists independently in the CLI and in `resume()`. They can diverge. 2. **Different engine paths**: `resume()` calls `ReleaseWorkflow.execute(payload)` while `executeObservable` calls `ReleaseWorkflow.observable(payload)`. These are different paths through the workflow engine. The correct fix is to add a `resumeObservable` function in `execute.ts` that mirrors the structure of `executeObservable` but enforces the same state guards as `resume()`. The CLI should call `resumeObservable` instead of its current manual check + `executeObservable` pattern. ```typescript // In execute.ts — add alongside resume() export const resumeObservable = (   plan: Plan,   options: ... ): Effect.Effect<ObservableResult<...>, ExecutorResumeError | ..., ...> =>   Effect.gen(function* () {     const workflowStatus = yield* status(plan, options)     if (workflowStatus.state !== 'suspended') {       return yield* Effect.fail(new ExecutorResumeError({ ... }))     }     // delegate to core observable logic     ...   }) ```

### #190 release: add explicit resume command

- Priority: P2
- File: packages/release/src/api/executor/execute.ts:440
- Title: `resume()` silently falls through to execution for states not explicitly matched
- Detail: `resume()` handles three explicit states (`not-started`, `succeeded`, `failed`) with typed failures, then falls through to execution for everything else — implicitly treating any other state as `suspended`. If a `running` or unrecognised state were ever returned by `status()`, it would be treated as resumable rather than rejected with a clear error. Since the intent is clearly "only resume when suspended", the safest pattern is to guard on `state === 'suspended'` affirmatively rather than guarding against specific non-suspended states: ```typescript // Replace the three if-blocks with: if (workflowStatus.state !== 'suspended') {   return yield* Effect.fail(     new ExecutorResumeError({       context: {         executionId: workflowStatus.executionId,         state: workflowStatus.state,   // widen type to string if needed         detail: stateToDetail(workflowStatus.state),       },     }),   ) } ``` This also eliminates the parallel logic in the CLI that already uses the affirmative `!== 'suspended'` check.

### #190 release: add explicit resume command

- Priority: P3
- File: packages/release/src/api/executor/errors.ts:218
- Title: `ExecutorDependencyCycleError` is absent from `errors.ts`'s `All` type
- Detail: The `All` type is defined as `ExecutorError | ExecutorResumeError`. But `execute()` and `resume()` both surface `ExecutorDependencyCycleError` in their typed error channels, and `ExecutorDependencyCycleError` is not a member of `ExecutorError`. This means `ExecutorDependencyCycleError` can be raised through the executor but is not included in the public `All` union. This appears to be a pre-existing gap that the PR did not introduce but also did not fix while touching the `All` type. `All` should reflect every error the executor can raise: ```typescript export type All = ExecutorError | ExecutorResumeError | ExecutorDependencyCycleError ```

### #192 release: add release graph command

- Priority: P1
- File: packages/release/src/api/executor/execute.ts:608
- Title: `executeObservable` calls `toPayload` twice after the refactor
- Detail: After the refactor, `executeObservable` still calls `yield* toPayload(plan, options)` to produce `payload` (needed for `ReleaseWorkflow.observable(payload)` below), and then immediately calls `yield* graph(plan, options)` — which internally calls `toPayload(plan, options)` a second time. That means all the I/O and computation in `toPayload` runs twice for every `executeObservable` invocation. The fix is to compute the graph directly from the already-resolved `payload` instead of delegating to `graph()`: ```typescript // inside executeObservable, after `const payload = yield* toPayload(plan, options)` const { layers, nodes } = ReleaseWorkflow.toGraph(payload) const graphInfo: ExecutionGraph = {   layers,   nodes: nodes as ReadonlyMap<string, ExecutionGraphNode>, } ``` Alternatively, `graph()` could accept a pre-computed payload as an optional argument. Either way the double computation should be eliminated.

### #192 release: add release graph command

- Priority: P2
- File: packages/release/src/api/renderer/graph.test.ts:5
- Title: `makeReadonlyMap` test helper is unnecessary — `new Map()` already satisfies `ReadonlyMap`
- Detail: The 30-line `makeReadonlyMap` factory (with manual `get`, `has`, `forEach`, `entries`, `keys`, `values`, `[Symbol.iterator]`, and `size`) replicates what the built-in `Map` class already provides. `Map<K, V>` structurally satisfies `ReadonlyMap<K, V>` in TypeScript, so: ```typescript const map = new Map([   ['Prepare:@kitz/core', { dependencies: [] }],   ['Publish:@kitz/core', { dependencies: ['Prepare:@kitz/core'] }],   ['CreateTag:@kitz/core@1.1.0', { dependencies: ['Publish:@kitz/core'] }], ] as const) ``` works directly. The hand-rolled helper should be deleted; beyond the boilerplate, its `forEach` lacks a type annotation for `callbackfn` and the implementation is essentially untested infrastructure that adds maintenance surface.

### #192 release: add release graph command

- Priority: P3
- File: packages/release/src/api/renderer/graph.ts:4
- Title: `[...graph.nodes.keys()].length` should use `.size` directly
- Detail: `ReadonlyMap` exposes a `.size` property. Spreading all keys into a temporary array just to count them is unnecessary: ```typescript // current const nodeCount = [...graph.nodes.keys()].length // correct const nodeCount = graph.nodes.size ```

### #193 feat(release): add explain command

- Priority: P2
- File: packages/release/src/api/planner/explain.ts:170
- Title: explain() rebuilds the dependency graph on every cascade explanation
- Detail: `explain()` calls `buildDependencyGraph([...options.packages])` inside the cascade branch, which re-reads every package's `package.json` from the filesystem. `analyze()` already ran `buildDependencyGraph` (line 197 of `analyze.ts`) to produce the `analysis` it passes in — but that graph is not stored in `Analysis`. The result is duplicate filesystem I/O on every `explain` call. The clean fix is to include the `DependencyGraph` as a field in `Analysis` (it's already computed there) and thread it through to `explain()`. This eliminates the redundant reads and makes the explain function consistent with the graph used during analysis, even if package manifests change between the two calls.

### #193 feat(release): add explain command

- Priority: P2
- File: packages/release/src/api/planner/explain.ts:185
- Title: `triggeredBy` semantics diverge between CascadeImpact and CascadeExplanation — undocumented
- Detail: `CascadeImpact.triggeredBy` (from the analyzer, `analyze.ts` lines 240–249) stores **direct** primary-to-cascade edges only: if A→B→C and only A is a primary impact, `CascadeImpact.triggeredBy` for C is `[]` because no primary directly depends on C. `CascadeExplanation.triggeredBy` (produced here) stores **root-cause primary packages** derived via BFS from all primaries to the target — so for C it would contain A. These are semantically different despite the identical field name, and neither the type interface nor the JSDoc documents this distinction. Future maintainers who rely on `triggeredBy` in `CascadeExplanation` expecting the same semantics as `CascadeImpact.triggeredBy` will be surprised. The divergence should be documented on both types, ideally with field names like `directTriggers` vs `rootCausePrimaries`.

### #193 feat(release): add explain command

- Priority: P3
- File: packages/release/README.md:335
- Title: README table inserts `explain` after `apply` — out of workflow order
- Detail: `explain` is inserted between `apply` and `graph` in the command reference table. As a diagnostic/pre-flight tool, it is more naturally used before `apply` (to understand why a package is classified before executing the plan). The logical workflow order would be: `forecast → plan → explain → apply → graph → resume → status`. `help.ts` correctly alphabetizes commands; the README table should either match alphabetical order or be reordered to reflect the workflow sequence consistently.

### #194 feat(release): derive ephemeral dist-tags from PR numbers

- Priority: P2
- File: packages/release/src/cli/pr-preview.ts:407
- Title: Inconsistent PR number search scope: `resolvePlanPrNumber` vs runbook inline
- Detail: The inline expression in the runbook command uses `plan.releases.find(Api.Planner.Ephemeral.is)?.prerelease.prNumber` (searches only `releases`), while the newly introduced `resolvePlanPrNumber` searches `[...plan.releases, ...plan.cascades]`. They are semantically equivalent here because the inline code falls back to `params.pullRequest.number` (which equals the PR number anyway), but the inconsistency is a latent trap — a future reader or editor might not realize these two code paths are expected to return the same value by different routes. The inline could simply call `resolvePlanPrNumber(plan) ?? params.pullRequest.number` to use the canonical logic: ```ts // before plan.releases.find(Api.Planner.Ephemeral.is)?.prerelease.prNumber ?? params.pullRequest.number // after Api.Publishing.resolvePlanPrNumber(plan) ?? params.pullRequest.number ```

### #194 feat(release): derive ephemeral dist-tags from PR numbers

- Priority: P3
- File: packages/release/src/api/publishing.ts:122
- Title: Verbose conditional-spread pattern in `resolvePublishSemanticsForPlan` is unnecessary
- Detail: The function spreads optional params conditionally: ```ts ...(params.publishing !== undefined ? { publishing: params.publishing } : {}), ...(params.tag !== undefined ? { tag: params.tag } : {}), // etc. ``` All of these fields are already typed as optional in `resolvePublishSemantics`. Passing `undefined` explicitly is identical to omitting the key — every read site already uses `?? defaultValue` or explicit guards. The simpler form is: ```ts return resolvePublishSemantics({   lifecycle: params.plan.lifecycle,   publishing: params.publishing,   tag: params.tag,   npmTag: params.npmTag,   candidateTag: params.candidateTag,   prNumber, }) ``` This has identical runtime semantics and is far easier to read.

### #195 feat(release): support explicit package paths

- Priority: P2
- File: packages/release/src/api/config.ts:15
- Title: Schema and runtime type are defined in two separate places and can drift
- Detail: The PR introduces `PackageConfigEntrySchema` (in `config.ts`) and `PackageConfigEntry` interface (in `workspace.ts`) as two independent definitions of the same concept. `config.ts` imports `PackageMap` (the type) from `workspace.ts` but defines the schema locally. If the interface in `workspace.ts` ever gains a new required field, the schema in `config.ts` will not be updated automatically, leading to configs that decode successfully but fail at runtime when the missing field is accessed. The Effect Schema pattern avoids this by making the schema the single source of truth: ```typescript // In workspace.ts (or a shared location) export const PackageConfigEntrySchema = Schema.Struct({   name: Schema.String,   path: Schema.optional(Schema.String), }) export type PackageConfigEntry = Schema.Schema.Type<typeof PackageConfigEntrySchema> ``` Then `config.ts` imports and reuses `PackageConfigEntrySchema` directly instead of redefining it.

### #195 feat(release): support explicit package paths

- Priority: P3
- File: packages/release/src/api/analyzer/workspace.ts:79
- Title: `toPackageMap` return type is too wide after the `PackageMap` type change
- Detail: After the PR, `PackageMap = Record<string, string | PackageConfigEntry>`. The `toPackageMap` function builds a map from scanned `Package[]` objects and only ever assigns `pkg.name.moniker` (a `string`) to each entry. Its return type is inferred as `PackageMap`, which implies consumers might receive `PackageConfigEntry` values — they never will. This unnecessarily widens the contract. Consider narrowing the return type: ```typescript export const toPackageMap = (packages: Package[]): Record<string, string> => { ... } ``` The resulting `Record<string, string>` is still assignable to `PackageMap` at call sites that need it.

### #195 feat(release): support explicit package paths

- Priority: P3
- File: packages/release/src/api/analyzer/workspace.ts:56
- Title: `PackageLocation.inferDefault` is called unconditionally even when an explicit path is provided
- Detail: In the updated `inferConfiguredPackage`, `PackageLocation.inferDefault(cwd, scope)` is always computed, then its result is discarded when an explicit path exists (`explicitPath?.path ?? location.path`). This is wasteful and slightly obscures intent. Prefer computing the default only when needed: ```typescript const path = explicitPath?.path ?? PackageLocation.inferDefault(cwd, scope).path ``` This is a minor issue if `inferDefault` is pure/cheap, but worth fixing for clarity.

### #195 feat(release): support explicit package paths

- Priority: P3
- File: packages/release/src/api/analyzer/workspace.test.ts:152
- Title: Fallback workspace test does not write a `package.json` in the explicit path directory
- Detail: The test "resolves explicit package paths even when workspace discovery is unavailable" creates the `tooling/pkg-core/` directory but does not write a `package.json` in it. This means the test only validates that `resolvePackages` computes the correct absolute path string — it does not validate that the package is actually resolvable (e.g. readable manifest). This is probably intentional for a unit test, but the contrast with the first test (which does write `package.json`) may mislead future readers or hide a gap in integration coverage. A short comment explaining this would improve clarity.

### #196 release: add plan --out and apply --from

- Priority: P3
- File: packages/release/src/cli/commands/apply.ts:81
- Title: Double path resolution in CLI commands
- Detail: In both `apply.ts` and `plan.ts`, `resolvePlanLocation(planPath)` is called explicitly to obtain `planLocation` for display purposes, and then immediately `read(planPath)` / `write(plan, planPath)` each call `resolvePlanLocation` internally a second time with the same input. This causes two redundant Effect evaluations doing identical work. Consider threading `planLocation` through to avoid the double resolution, e.g. by accepting an already-resolved `ActivePlanLocation` in the store functions, or by deriving the display string from the same `planLocation` returned by the inner call.

### #196 release: add plan --out and apply --from

- Priority: P3
- File: packages/release/README.md:338
- Title: README table pipe characters break Markdown rendering
- Detail: The `|` characters inside `<official | candidate | ephemeral>` are not escaped within a Markdown table cell, so most parsers will interpret them as column separators and break the table layout. This was a pre-existing issue that the PR extends. Fixing it requires either escaping (`\|`) or using a code-span that wraps the whole lifecycle argument so the pipes are rendered literally.

### #197 release: add bounded notes and markdown forecast

- Priority: P3
- File: packages/release/src/api/renderer/forecast-markdown.ts:32
- Title: Publish metadata section lacks a `###` heading, breaking document hierarchy
- Detail: The `### Primary (N)` and `### Cascades (N)` sections both have headings, but the publish state/history block is emitted as plain bullet list items directly under the summary line with no heading. If a reader pastes this into an issue or PR body, the publish section is visually unanchored and inconsistent with the rest of the document structure. Consider adding a heading like `### Publish` or `### Publish Metadata` before the conditional block: ```typescript if (publishState !== 'idle' || publishHistory.length > 0) {   output``   output`### Publish`   output``   output`- Publish state: \`${publishState}\``   ... } ```

### #198 feat(release): add diff remote overrides

- Priority: P2
- File: packages/release/src/cli/pr-preview.ts:405
- Title: `loadDiffRemote` is a trivial wrapper adding no value
- Detail: The new private helper `loadDiffRemote` is a one-liner that does nothing but delegate to the already-imported `resolveDiffRemote`: ```typescript const loadDiffRemote = (config: Api.Config.ResolvedConfig, remote?: string): string =>   resolveDiffRemote(config, remote) ``` This is dead abstraction. Call `resolveDiffRemote(config, options.remote)` directly at the call site in `runPrPreview`. The indirection creates noise and a misleading name difference (`loadDiffRemote` vs `resolveDiffRemote`) that implies different behavior where there is none.

### #198 feat(release): add diff remote overrides

- Priority: P2
- File: packages/release/src/cli/pr-preview.ts:347
- Title: Dead assignment when `options.remote` is falsy
- Detail: In `runPrPreview`: ```typescript const diffRemote = loadDiffRemote(config, options.remote)  // always computed // ... ...(options.remote ? { explicitDiffRemote: diffRemote } : {}),  // only used when truthy ``` When `options.remote` is `undefined`, `diffRemote` is computed (resolving through config) but immediately discarded. This is a silent dead assignment. The guard should be moved before the computation: ```typescript const diffRemote = options.remote ? resolveDiffRemote(config, options.remote) : undefined // ... ...(diffRemote ? { explicitDiffRemote: diffRemote } : {}), ``` This also eliminates the `loadDiffRemote` wrapper naturally.

### #198 feat(release): add diff remote overrides

- Priority: P2
- File: packages/release/src/cli/commands/pr-lib.ts:18
- Title: Duplicated remote normalization logic across two files
- Detail: There are two separate implementations of remote normalization: - `normalizeRemoteArg` in `pr-lib.ts` — trims, rejects empty strings, rejects strings starting with `--` - `normalizeRemoteOverride` in `pr-preview-diff.ts` — trims, rejects empty strings only They diverge on the `--` prefix check. If the normalization logic changes (e.g., rejecting names with `/` or spaces), only one file gets updated. Extract a single `normalizeRemote` function into `pr-preview-diff.ts` (already has the concept) and import it from `pr-lib.ts`.

### #198 feat(release): add diff remote overrides

- Priority: P2
- File: packages/release/src/cli/pr-preview.ts:407
- Title: `renderDoctorCommandSuffix` silently accepts remote names with spaces, producing broken runbook commands
- Detail: ```typescript args.push(`--remote ${explicitDiffRemote}`) ``` If `explicitDiffRemote` contains a space (e.g., `"my remote"`), the rendered runbook command becomes: ``` bun run release doctor --remote my remote ``` which is shell-invalid. Neither `normalizeRemoteArg` nor `normalizeRemoteOverride` rejects whitespace-containing strings — they only trim leading/trailing spaces. While git remote names cannot contain spaces by git's own validation, the CLI layer should defensively reject such values with an explicit error rather than silently generating a broken command string. A simple `if (normalized.includes(' ')) return null` in `normalizeRemoteArg` (and its `pr-preview-diff.ts` counterpart) would close this.

### #198 feat(release): add diff remote overrides

- Priority: P3
- File: packages/release/src/cli/commands/pr.ts:120
- Title: Unnecessary conditional object spread for optional flag in `pr.ts`
- Detail: ```typescript action.checkOnly || action.remote   ? {       ...(action.checkOnly ? { checkOnly: true } : {}),       ...(action.remote ? { remote: action.remote } : {}),     }   : undefined, ``` Since `RunPrPreviewOptions` has `checkOnly?: boolean` and `remote?: string`, both optional, passing `undefined` values for optional fields is equivalent to omitting them. This simplifies to: ```typescript { checkOnly: action.checkOnly || undefined, remote: action.remote } ``` or even just: ```typescript { remote: action.remote, ...(action.checkOnly ? { checkOnly: true } : {}) } ``` The outer `|| action.remote ? ... : undefined` guard also becomes unnecessary once `RunPrPreviewOptions` accepts the `remote` field unconditionally.

### #199 feat(release): allow diff remote overrides

- Priority: P2
- File: packages/release/src/cli/pr-preview.test.ts
- Title: runPrPreview remote wiring is untested — only buildPreviewDoctorSummary is covered directly
- Detail: The PR's test for runbook remote injection passes `explicitDiffRemote: 'fork'` directly to `buildPreviewDoctorSummary`, bypassing the logic in `runPrPreview` that computes and conditionally spreads it: ```typescript // pr-preview.ts — untested wiring const diffRemote = loadDiffRemote(config, options.remote) ...(options.remote ? { remote: options.remote } : {}),        // to diff loader ...(options.remote ? { explicitDiffRemote: diffRemote } : {}), // to summary ``` If someone changed the condition (e.g. switched from `options.remote` to a different check) or broke the `loadDiffRemote → explicitDiffRemote` chain, the existing tests would still pass. An integration test calling `runPrPreview({ remote: 'fork' })` with mocked services and asserting the resulting runbook commands would close this gap.

### #199 feat(release): allow diff remote overrides

- Priority: P3
- File: packages/release/src/cli/pr-preview.ts
- Title: `loadDiffRemote` is a dead-abstraction wrapper with no added logic
- Detail: The function at the bottom of `pr-preview.ts` is a pure passthrough: ```typescript const loadDiffRemote = (config: Api.Config.ResolvedConfig, remote?: string): string =>   resolveDiffRemote(config, remote) ``` It has exactly one call site, adds no logic, and its name doesn't distinguish it from `resolveDiffRemote`. This should be removed and `resolveDiffRemote` called directly: ```typescript // before const diffRemote = loadDiffRemote(config, options.remote) // after const diffRemote = resolveDiffRemote(config, options.remote) ```

### #199 feat(release): allow diff remote overrides

- Priority: P3
- File: packages/release/src/cli/pr-preview.ts
- Title: Raw vs normalized remote: two divergent normalization paths in runPrPreview
- Detail: In `runPrPreview`, `diffRemote` is normalized via `loadDiffRemote` (trim + empty-check) and used for the runbook display. But `loadConfiguredPullRequestDiff` receives the raw `options.remote`, which normalizes independently inside `resolveDiffRemote`. They produce the same result today, but the code suggests two separate sources of truth for the effective remote: ```typescript const diffRemote = loadDiffRemote(config, options.remote)          // normalized yield* loadConfiguredPullRequestDiff({ ..., remote: options.remote }) // also normalizes ``` Passing `diffRemote` to `loadConfiguredPullRequestDiff` instead of `options.remote` would make the actual remote used for diffs and the one shown in the runbook share a single normalization point.

### #200 feat(release): add preview publish history command

- Priority: P0
- File: packages/release/src/cli/commands/history-lib.ts:66
- Title: Three Explorer API symbols referenced but not defined anywhere
- Detail: The new files reference `Api.Explorer.resolvePullRequestFromContext(...)`, `Api.Explorer.resolveGitHubContext()` (in `history.ts:56`), and the type `Api.Explorer.ResolvedGitHubContext` (in `history-lib.ts:1` and `history-lib.test.ts:16`). None of these are exported from `packages/release/src/api/explorer/__.ts`, none appear in `explore.ts`, and a codebase-wide search finds zero occurrences. The PR diff includes no additions to `explore.ts` or `__.ts`. This means the code cannot compile as submitted.

### #200 feat(release): add preview publish history command

- Priority: P2
- File: packages/release/src/cli/commands/history-lib.ts:53
- Title: `parseInt` silently accepts partial numbers like `'3abc'`
- Detail: `Number.parseInt('3abc', 10)` returns `3` — not `NaN` — because `parseInt` parses leading digits and ignores the trailing non-numeric suffix. The subsequent `Number.isSafeInteger(parsed) && parsed > 0` check passes, so `'3abc'` is silently treated as `3` with no error. The same applies to `'5.9'` (parsed as `5`). Fix by replacing `Number.parseInt` with `Number()` (which returns `NaN` for `'3abc'`), or by adding a `/^\d+$/` regex guard before parsing: ```typescript const parsed = Number(normalized) if (!Number.isSafeInteger(parsed) || parsed <= 0) { ... } ``` The existing tests don't cover this case, so a `'3abc'` test case should be added alongside the fix.

### #200 feat(release): add preview publish history command

- Priority: P3
- File: packages/release/src/cli/commands/history.ts:62
- Title: Unnecessary conditional spreads for optional parameters
- Detail: `...(prNumber !== undefined ? { prNumber } : {})` and `...(limit !== undefined ? { limit } : {})` are both redundant. `resolvePreviewPublishSurface` defaults `options.prNumber` via `??`, and `toPreviewPublishReport` guards with `=== undefined` — so passing `{ prNumber: undefined }` is behaviorally identical to omitting the key. Simplify to: ```typescript const surface = yield* resolvePreviewPublishSurface(context, { prNumber }).pipe(...) const report = toPreviewPublishReport(surface, { limit }) ```
