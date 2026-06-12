/**
 * Core analysis — orchestrates commit fetching, impact extraction,
 * aggregation by package, and cascade detection.
 *
 * This is the expensive analytical core. Computed once, then consumed
 * by Planner (for version projection) and Commentator (for PR comments).
 */

import { FileSystem } from 'effect'
import { Git } from '@kitz/git'
import { Graph } from '@kitz/graph'
import { Pkg } from '@kitz/pkg'
import { Resource } from '@kitz/resource'
import { Effect, Exit, HashMap, HashSet, MutableHashSet, Option } from 'effect'
import { buildDependencyGraph, findDirectTriggers } from './cascade.js'
import { Analysis } from './models/analysis.js'
import { CascadeImpact } from './models/cascade-impact.js'
import { Impact } from './models/impact.js'
import { aggregateByPackage, extractImpacts, findLatestTagVersion } from './version.js'
import type { Package } from './workspace.js'

/**
 * Options for analyzing a repository.
 */
export interface AnalyzeOptions {
  /** Packages to analyze */
  readonly packages: readonly Package[]
  /** All git tags (for finding last release and cascade detection) */
  readonly tags: readonly string[]
  /** Start of commit range - tag or SHA (default: last release tag) */
  readonly since?: string | undefined
  /** End of commit range (default: HEAD) */
  readonly until?: string | undefined
  /** Filter to specific packages by name or scope */
  readonly filter?: readonly string[] | undefined
  /** Packages to exclude by name */
  readonly exclude?: readonly string[] | undefined
  /** Resolved type→bump mapping from config. Custom types with configured bumps
   *  generate impacts; unrecognized types return null (lint catches them). */
  readonly resolvedConventionalCommitTypes: import('./version.js').ResolvedConventionalCommitTypes
  /** SHA-keyed changelog-text overrides. Rewrites only rendered descriptions;
   *  never affects bump/type/scope/breaking. */
  readonly commitOverrides?: import('../config.js').CommitOverrides | undefined
}

const findLatestReleaseTag = (pkg: Package, tags: readonly string[]): string | undefined => {
  const version = findLatestTagVersion(pkg.name, tags)
  return Option.isSome(version)
    ? Pkg.Pin.toString(Pkg.Pin.Exact.make({ name: pkg.name, version: version.value }))
    : undefined
}

/**
 * How to treat an `until` boundary that cannot be located.
 *
 * - `lenient` — the analyzer's stance: an `until` that matches no commit in
 *   the window and is not a known tag silently keeps the whole window; a tag
 *   whose history cannot be loaded is treated as an empty newer-commit window
 *   (again keeping the whole window).
 * - `strict` — the notes generator's stance: an `until` that matches no commit
 *   must resolve through git (tag SHA, commit existence, or caller tag
 *   snapshot); otherwise the pipeline fails with a descriptive `GitError`
 *   rather than silently including commits beyond the boundary.
 */
export type UntilBoundaryStrictness = 'lenient' | 'strict'

const dropCommitsNewerThanBoundary = (
  commits: readonly Git.Commit[],
  newerCommits: readonly Git.Commit[],
): readonly Git.Commit[] => {
  const newerHashes = HashSet.fromIterable(newerCommits.map((commit) => commit.hash))
  return commits.filter((commit) => !HashSet.has(newerHashes, commit.hash))
}

/**
 * Trim a commit window at the `until` boundary.
 *
 * When the boundary appears in the window (by hash or hash prefix), commits
 * newer than it are dropped directly. Otherwise the boundary's own history is
 * fetched and subtracted; how an unresolvable boundary is handled depends on
 * {@link UntilBoundaryStrictness}.
 */
export const trimCommitsUntilBoundary = (
  commits: readonly Git.Commit[],
  until: string | undefined,
  tags: readonly string[],
  strictness: UntilBoundaryStrictness,
): Effect.Effect<readonly Git.Commit[], Git.GitError | Git.GitParseError, Git.Git> =>
  Effect.gen(function* () {
    if (!until) return commits

    const boundaryIndex = commits.findIndex(
      (commit) =>
        commit.hash === until || commit.hash.startsWith(until) || until.startsWith(commit.hash),
    )

    if (boundaryIndex >= 0) {
      return commits.slice(boundaryIndex)
    }

    const git = yield* Git.Git

    if (strictness === 'lenient') {
      if (!tags.includes(until)) {
        return commits
      }

      const newerCommits = yield* git
        .getCommitsSince(until)
        .pipe(Effect.catchTag('GitError', () => Effect.succeed([])))
      return dropCommitsNewerThanBoundary(commits, newerCommits)
    }

    const newerCommitsExit = yield* Effect.exit(git.getCommitsSince(until))

    if (Exit.isFailure(newerCommitsExit)) {
      const knownTag = yield* Effect.option(git.getTagSha(until))
      if (Option.isSome(knownTag)) {
        return yield* Effect.failCause(newerCommitsExit.cause)
      }

      const knownCommit = yield* Effect.option(git.commitExists(until))
      if (Option.getOrElse(knownCommit, () => false)) {
        return yield* Effect.failCause(newerCommitsExit.cause)
      }

      if (tags.includes(until)) {
        return yield* Effect.failCause(newerCommitsExit.cause)
      }

      return yield* Effect.fail(
        new Git.GitError({
          context: {
            operation: 'getCommitsSince',
            detail: `Could not resolve release notes until boundary "${until}" as a known tag or commit.`,
          },
          cause: new Error(
            `Could not resolve release notes until boundary "${until}" as a known tag or commit.`,
          ),
        }),
      )
    }

    return dropCommitsNewerThanBoundary(commits, newerCommitsExit.value)
  })

/**
 * Create a commit-range fetcher that caches windows by their `since` boundary
 * and trims each window at the shared `until` boundary.
 *
 * Several packages frequently share the same `since` (an explicit override, or
 * `undefined` for never-released packages), so caching avoids re-walking the
 * same git history per package.
 */
export const makeCommitRangeFetcher = (options: {
  readonly until: string | undefined
  readonly tags: readonly string[]
  readonly strictness: UntilBoundaryStrictness
}): ((
  since: string | undefined,
) => Effect.Effect<readonly Git.Commit[], Git.GitError | Git.GitParseError, Git.Git>) => {
  // oxlint-disable-next-line kitz/domain/no-native-map-set -- Local read-only lookup table; never escapes this scope.
  const cache = new Map<string | undefined, readonly Git.Commit[]>()

  return (since) =>
    Effect.gen(function* () {
      const cached = cache.get(since)
      if (cached !== undefined) return cached

      const git = yield* Git.Git
      const commits = yield* git.getCommitsSince(since)
      const trimmed = yield* trimCommitsUntilBoundary(
        commits,
        options.until,
        options.tags,
        options.strictness,
      )
      cache.set(since, trimmed)
      return trimmed
    })
}

const collectScopedCommits = (
  options: AnalyzeOptions,
): Effect.Effect<
  {
    readonly commits: readonly Git.Commit[]
    readonly allowedHashesByScope: HashMap.HashMap<string, HashSet.HashSet<string>>
  },
  Git.GitError | Git.GitParseError,
  Git.Git
> =>
  Effect.gen(function* () {
    const fetchRange = makeCommitRangeFetcher({
      until: options.until,
      tags: options.tags,
      strictness: 'lenient',
    })
    const allowedHashesByScopeEntries: Array<[string, HashSet.HashSet<string>]> = []
    const uniqueCommits: Git.Commit[] = []
    const seenHashes = MutableHashSet.empty<string>()

    for (const pkg of options.packages) {
      const since = options.since ?? findLatestReleaseTag(pkg, options.tags)
      const commits = yield* fetchRange(since)

      allowedHashesByScopeEntries.push([
        pkg.scope,
        HashSet.fromIterable(commits.map((commit) => commit.hash)),
      ])

      for (const commit of commits) {
        if (MutableHashSet.has(seenHashes, commit.hash)) continue
        MutableHashSet.add(seenHashes, commit.hash)
        uniqueCommits.push(commit)
      }
    }

    return {
      commits: uniqueCommits,
      allowedHashesByScope: HashMap.fromIterable(allowedHashesByScopeEntries),
    }
  })

/**
 * Analyze a repository for changes since the last release.
 *
 * Performs the full analytical pipeline:
 * 1. Fetch commits since last release
 * 2. Extract per-package impacts from conventional commits
 * 3. Aggregate impacts by package (highest bump wins)
 * 4. Detect cascade impacts (transitive dependency bumps)
 *
 * Returns an {@link Analysis} that can be consumed by Planner
 * (to project concrete versions) or Commentator (to render PR comments).
 *
 * @example
 * ```ts
 * const result = yield* analyze({
 *   packages: yield* Workspace.scan,
 *   tags: yield* git.getTags(),
 * })
 *
 * for (const impact of result.impacts) {
 *   console.log(`${impact.package.name.moniker}: ${impact.bump}`)
 * }
 * ```
 */
export const analyze = (
  options: AnalyzeOptions,
): Effect.Effect<
  Analysis,
  Git.GitError | Git.GitParseError | Resource.ResourceError,
  Git.Git | FileSystem.FileSystem
> =>
  Effect.gen(function* () {
    const { packages, tags, filter, exclude } = options

    // ── Step 1: Fetch commits since last release ──────────────────────
    const { commits, allowedHashesByScope } = yield* collectScopedCommits(options)

    // ── Step 2: Extract impacts from all commits ──────────────────────
    // Unbounded concurrency is safe here: extractImpacts is pure (CPU-only,
    // no IO) — it parses conventional-commit messages and maps scopes to
    // packages.  Individual failures surface as empty impact arrays, so
    // a single malformed commit won't abort the pipeline.
    const allImpacts = yield* Effect.all(
      commits.map((c) =>
        extractImpacts(c, options.resolvedConventionalCommitTypes, options.commitOverrides),
      ),
      { concurrency: 'unbounded' },
    )
    const flatImpacts = allImpacts.flat().filter((impact) => {
      const allowedHashes = Option.getOrUndefined(HashMap.get(allowedHashesByScope, impact.scope))
      return allowedHashes ? HashSet.has(allowedHashes, impact.commit.hash) : false
    })

    // ── Step 3: Aggregate by package ──────────────────────────────────
    const aggregated = aggregateByPackage(flatImpacts)

    // Pre-compute lookup maps (used for both impact extraction and cascade detection)
    // oxlint-disable-next-line kitz/domain/no-native-map-set -- Local read-only lookup table; never escapes this scope.
    const scopeToPackage = new Map(packages.map((p): [string, Package] => [p.scope, p]))
    // oxlint-disable-next-line kitz/domain/no-native-map-set -- Local read-only lookup table; never escapes this scope.
    const nameToPackage = new Map(packages.map((p): [string, Package] => [p.name.moniker, p]))

    // Build impacts and track changed scopes
    const impacts: Impact[] = []
    // oxlint-disable-next-line kitz/domain/no-native-map-set -- Local read-only lookup table; never escapes this scope.
    const changedScopes = new Set<string>()
    // oxlint-disable-next-line kitz/domain/no-native-map-set -- Local read-only lookup table; never escapes this scope.
    const impactedPackages = new Set<string>()

    for (const [scope, { bump, commits: packageCommits }] of aggregated) {
      const pkg = scopeToPackage.get(scope)
      if (!pkg) continue

      // Apply filter if specified
      if (filter && !filter.includes(pkg.name.moniker) && !filter.includes(pkg.scope)) {
        continue
      }

      // Apply exclude if specified
      if (exclude?.includes(pkg.name.moniker)) continue

      changedScopes.add(scope)
      impactedPackages.add(pkg.name.moniker)

      // Find current version from tags
      const currentVersion = findLatestTagVersion(pkg.name, tags)

      impacts.push(
        Impact.make({
          package: pkg,
          bump,
          commits: packageCommits,
          currentVersion,
        }),
      )
    }

    // ── Step 4: Detect cascade impacts ────────────────────────────────
    const dependencyGraph = yield* buildDependencyGraph(packages)

    // All packages transitively depending on impacted packages need cascades
    // (the closure includes its seeds, so subtract the impacted set).
    // oxlint-disable-next-line kitz/domain/no-native-map-set -- Local read-only lookup table; never escapes this scope.
    const needsCascade = new Set(
      [...Graph.transitiveClosure(dependencyGraph, impactedPackages)].filter(
        (name) => !impactedPackages.has(name),
      ),
    )

    // Build cascade impact objects
    const cascades: CascadeImpact[] = []

    for (const name of needsCascade) {
      const pkg = nameToPackage.get(name)
      if (!pkg) continue

      // Find which impacted packages triggered this cascade
      const triggeredBy = findDirectTriggers(dependencyGraph, impacts, name).map(
        (impact) => impact.package,
      )

      const currentVersion = findLatestTagVersion(pkg.name, tags)

      cascades.push(
        CascadeImpact.make({
          package: pkg,
          triggeredBy,
          currentVersion,
        }),
      )
    }

    // ── Unchanged packages ────────────────────────────────────────────
    const unchanged = packages.filter((p) => {
      if (filter && !filter.includes(p.name.moniker) && !filter.includes(p.scope)) {
        return false
      }
      if (exclude?.includes(p.name.moniker)) return false
      return !changedScopes.has(p.scope) && !needsCascade.has(p.name.moniker)
    })

    return Analysis.make({
      impacts,
      cascades,
      unchanged,
      tags,
    })
  })
