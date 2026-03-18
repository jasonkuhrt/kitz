/**
 * Core analysis — orchestrates commit fetching, impact extraction,
 * aggregation by package, and cascade detection.
 *
 * This is the expensive analytical core. Computed once, then consumed
 * by Planner (for version projection) and Commentator (for PR comments).
 */

import { FileSystem } from 'effect'
import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { Resource } from '@kitz/resource'
import { Effect, HashMap, HashSet, MutableHashSet, Option } from 'effect'
import { buildDependencyGraph } from './cascade.js'
import { Analysis } from './models/analysis.js'
import { CascadeImpact } from './models/cascade-impact.js'
import type { ReleaseCommit } from './models/commit.js'
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
}

const findLatestReleaseTag = (pkg: Package, tags: readonly string[]): string | undefined => {
  const version = findLatestTagVersion(pkg.name, tags as string[])
  return Option.isSome(version)
    ? Pkg.Pin.toString(Pkg.Pin.Exact.make({ name: pkg.name, version: version.value }))
    : undefined
}

const trimCommitsUntilBoundary = (
  commits: readonly Git.Commit[],
  until: string | undefined,
  tags: readonly string[],
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

    if (!tags.includes(until)) {
      return commits
    }

    const git = yield* Git.Git
    const newerCommits = yield* git.getCommitsSince(until)
    const newerHashes = HashSet.fromIterable(
      newerCommits.map((commit: { hash: string }) => commit.hash),
    )

    return commits.filter((commit) => !HashSet.has(newerHashes, commit.hash))
  })

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
    const git = yield* Git.Git
    const cache: Array<{ since: string | undefined; commits: readonly Git.Commit[] }> = []
    const allowedHashesByScopeEntries: Array<[string, HashSet.HashSet<string>]> = []
    const uniqueCommits: Git.Commit[] = []
    const seenHashes = MutableHashSet.empty<string>()

    for (const pkg of options.packages) {
      const since = options.since ?? findLatestReleaseTag(pkg, options.tags)
      let cached = cache.find((entry) => entry.since === since)

      if (!cached) {
        const commits = yield* git.getCommitsSince(since)
        const trimmedCommits = yield* trimCommitsUntilBoundary(commits, options.until, options.tags)
        cached = { since, commits: trimmedCommits }
        cache.push(cached)
      }

      allowedHashesByScopeEntries.push([
        pkg.scope,
        HashSet.fromIterable(cached.commits.map((commit) => commit.hash)),
      ])

      for (const commit of cached.commits) {
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
      commits.map((c) => extractImpacts(c)),
      { concurrency: 'unbounded' },
    )
    const flatImpacts = allImpacts.flat().filter((impact) => {
      const allowedHashes = Option.getOrUndefined(HashMap.get(allowedHashesByScope, impact.scope))
      return allowedHashes ? HashSet.has(allowedHashes, impact.commit.hash) : false
    })

    // ── Step 3: Aggregate by package ──────────────────────────────────
    const aggregated = aggregateByPackage(flatImpacts)

    // Pre-compute lookup maps (used for both impact extraction and cascade detection)
    const scopeToPackage = HashMap.fromIterable(
      packages.map((p): [string, Package] => [p.scope, p]),
    )
    const nameToPackage = HashMap.fromIterable(
      packages.map((p): [string, Package] => [p.name.moniker, p]),
    )

    // Build impacts and track changed scopes
    const impacts: Impact[] = []
    const changedScopes = MutableHashSet.empty<string>()
    const impactedPackages = MutableHashSet.empty<string>()

    for (const [scope, { bump, commits: packageCommits }] of aggregated) {
      const pkg = Option.getOrUndefined(HashMap.get(scopeToPackage, scope))
      if (!pkg) continue

      // Apply filter if specified
      if (filter && !filter.includes(pkg.name.moniker) && !filter.includes(pkg.scope)) {
        continue
      }

      // Apply exclude if specified
      if (exclude?.includes(pkg.name.moniker)) continue

      MutableHashSet.add(changedScopes, scope)
      MutableHashSet.add(impactedPackages, pkg.name.moniker)

      // Find current version from tags
      const currentVersion = findLatestTagVersion(pkg.name, tags as string[])

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
    const dependencyGraph = yield* buildDependencyGraph([...packages])

    // BFS to find all packages that transitively depend on impacted packages.
    // Visited guard prevents infinite loops from circular dependencies.
    const needsCascade = MutableHashSet.empty<string>()
    const visited = MutableHashSet.fromIterable(impactedPackages)
    const queue = Array.from(impactedPackages)

    while (queue.length > 0) {
      const pkgName = queue.shift()!
      const dependents = Option.getOrElse(
        HashMap.get(dependencyGraph, pkgName),
        (): readonly string[] => [],
      )

      for (const dependent of dependents) {
        if (MutableHashSet.has(visited, dependent)) continue
        MutableHashSet.add(visited, dependent)
        MutableHashSet.add(needsCascade, dependent)
        queue.push(dependent)
      }
    }

    // Build cascade impact objects
    const cascades: CascadeImpact[] = []

    for (const name of needsCascade) {
      const pkg = Option.getOrUndefined(HashMap.get(nameToPackage, name))
      if (!pkg) continue

      // Find which impacted packages triggered this cascade
      const triggeredBy: Package[] = []
      for (const impact of impacts) {
        const impactDependents = Option.getOrElse(
          HashMap.get(dependencyGraph, impact.package.name.moniker),
          (): readonly string[] => [],
        )
        if (impactDependents.includes(name)) {
          triggeredBy.push(impact.package)
        }
      }

      const currentVersion = findLatestTagVersion(pkg.name, tags as string[])

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
      return (
        !MutableHashSet.has(changedScopes, p.scope) &&
        !MutableHashSet.has(needsCascade, p.name.moniker)
      )
    })

    return Analysis.make({
      impacts,
      cascades,
      unchanged: [...unchanged],
      tags: [...tags],
    })
  })
