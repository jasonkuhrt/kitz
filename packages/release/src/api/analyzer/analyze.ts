/**
 * Core analysis — orchestrates commit fetching, impact extraction,
 * aggregation by package, and cascade detection.
 *
 * This is the expensive analytical core. Computed once, then consumed
 * by Planner (for version projection) and Commentator (for PR comments).
 */

import { FileSystem } from '@effect/platform'
import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { Resource } from '@kitz/resource'
import { Semver } from '@kitz/semver'
import { Effect, Option } from 'effect'
import { buildDependencyGraph } from './cascade.js'
import type { ReleaseCommit } from './commit.js'
import type { Analysis } from './models/analysis.js'
import type { CascadeImpact } from './models/cascade-impact.js'
import type { Impact } from './models/impact.js'
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

/**
 * Find the last release tag across all packages.
 */
const findLastReleaseTag = (
  packages: readonly Package[],
  tags: readonly string[],
): string | undefined => {
  let latestTag: string | undefined
  let latestVersion: Semver.Semver | undefined

  for (const pkg of packages) {
    const version = findLatestTagVersion(pkg.name, tags as string[])
    if (Option.isSome(version)) {
      if (!latestVersion || Semver.greaterThan(version.value, latestVersion)) {
        latestVersion = version.value
        latestTag = Pkg.Pin.toString(Pkg.Pin.Exact.make({ name: pkg.name, version: version.value }))
      }
    }
  }

  return latestTag
}

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
  Effect.gen(function*() {
    const git = yield* Git.Git
    const { packages, tags, filter, exclude } = options

    // ── Step 1: Fetch commits since last release ──────────────────────
    const since = options.since ?? findLastReleaseTag(packages, tags)
    const commits = yield* git.getCommitsSince(since)

    // ── Step 2: Extract impacts from all commits ──────────────────────
    const allImpacts = yield* Effect.all(
      commits.map((c) => extractImpacts(c)),
      { concurrency: 'unbounded' },
    )
    const flatImpacts = allImpacts.flat()

    // ── Step 3: Aggregate by package ──────────────────────────────────
    const aggregated = aggregateByPackage(flatImpacts)

    // Build scope-to-package map
    const scopeToPackage = new Map(packages.map((p) => [p.scope, p]))

    // Build impacts and track changed scopes
    const impacts: Impact[] = []
    const changedScopes = new Set<string>()
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
      const currentVersion = findLatestTagVersion(pkg.name, tags as string[])

      impacts.push({
        package: pkg,
        bump,
        commits: packageCommits,
        currentVersion,
      })
    }

    // ── Step 4: Detect cascade impacts ────────────────────────────────
    const dependencyGraph = yield* buildDependencyGraph([...packages])

    // BFS to find all packages that transitively depend on impacted packages
    const needsCascade = new Set<string>()
    const queue = [...impactedPackages]

    while (queue.length > 0) {
      const pkgName = queue.shift()!
      const dependents = dependencyGraph.get(pkgName) ?? []

      for (const dependent of dependents) {
        if (impactedPackages.has(dependent) || needsCascade.has(dependent)) continue
        needsCascade.add(dependent)
        queue.push(dependent)
      }
    }

    // Build cascade impact objects
    const nameToPackage = new Map(packages.map((p) => [p.name.moniker, p]))
    const cascades: CascadeImpact[] = []

    for (const name of needsCascade) {
      const pkg = nameToPackage.get(name)
      if (!pkg) continue

      // Find which impacted packages triggered this cascade
      const triggeredBy: Package[] = []
      const deps = dependencyGraph.get(name)
      if (deps) {
        for (const impact of impacts) {
          if (deps.includes(impact.package.name.moniker)) {
            triggeredBy.push(impact.package)
          }
        }
      }

      const currentVersion = findLatestTagVersion(pkg.name, tags as string[])

      cascades.push({
        package: pkg,
        triggeredBy,
        currentVersion,
      })
    }

    // ── Unchanged packages ────────────────────────────────────────────
    const unchanged = packages.filter((p) => {
      if (filter && !filter.includes(p.name.moniker) && !filter.includes(p.scope)) {
        return false
      }
      if (exclude?.includes(p.name.moniker)) return false
      return !changedScopes.has(p.scope) && !needsCascade.has(p.name.moniker)
    })

    return {
      impacts,
      cascades,
      unchanged: [...unchanged],
      tags: [...tags],
    } satisfies Analysis
  })
