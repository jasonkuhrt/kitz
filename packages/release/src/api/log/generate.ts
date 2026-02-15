/**
 * Log generation - orchestrates commit fetching, impact extraction, and changelog formatting.
 */

import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Effect, Option } from 'effect'
import { ReleaseCommit } from '../analyzer/models/commit.js'
import { aggregateByPackage, extractImpacts, findLatestTagVersion } from '../analyzer/version.js'
import type { Package } from '../analyzer/workspace.js'
import { calculateNextVersion } from '../version/calculate.js'
import { type CommitEntry, format, type FormattedChangelog } from './format.js'

/**
 * Log entry for a single package.
 */
export interface PackageLog {
  /** The package this log is for */
  readonly package: Package
  /** Commits affecting this package */
  readonly commits: readonly ReleaseCommit[]
  /** Calculated bump type from commits */
  readonly bump: Semver.BumpType
  /** Current version (if any releases exist) */
  readonly currentVersion: Option.Option<Semver.Semver>
  /** Calculated next version */
  readonly nextVersion: Semver.Semver
  /** Formatted changelog */
  readonly changelog: FormattedChangelog
}

/**
 * Options for generating package logs.
 */
export interface GenerateOptions {
  /** Packages to generate logs for */
  readonly packages: readonly Package[]
  /** All git tags (for finding last release) */
  readonly tags: readonly string[]
  /** Start of commit range - tag or SHA (default: last release tag) */
  readonly since?: string | undefined
  /** End of commit range (default: HEAD) */
  readonly until?: string | undefined
  /** Filter to specific packages by name */
  readonly filter?: readonly string[] | undefined
}

/**
 * Result of log generation.
 */
export interface GenerateResult {
  /** Package logs (only packages with changes) */
  readonly logs: readonly PackageLog[]
  /** Packages with no changes since last release */
  readonly unchanged: readonly Package[]
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
 * Generate logs for packages with changes.
 *
 * Fetches commits since last release, extracts impacts per package,
 * calculates next versions, and formats changelogs.
 *
 * @example
 * ```ts
 * const result = yield* Log.generate({
 *   packages: await scanPackages(),
 *   tags: await git.getTags(),
 * })
 *
 * for (const log of result.logs) {
 *   console.log(log.changelog.markdown)
 * }
 * ```
 */
export const generate = (
  options: GenerateOptions,
): Effect.Effect<GenerateResult, Git.GitError | Git.GitParseError, Git.Git> =>
  Effect.gen(function*() {
    const git = yield* Git.Git
    const { packages, tags, filter } = options

    // Determine commit range
    const since = options.since ?? findLastReleaseTag(packages, tags)
    const commits = yield* git.getCommitsSince(since)

    // Extract impacts from all commits
    const allImpacts = yield* Effect.all(
      commits.map((c) => extractImpacts(c)),
      { concurrency: 'unbounded' },
    )
    const impacts = allImpacts.flat()

    // Aggregate by package
    const aggregated = aggregateByPackage(impacts)

    // Build scope-to-package map
    const scopeToPackage = new Map(packages.map((p) => [p.scope, p]))

    // Generate logs for packages with changes
    const logs: PackageLog[] = []
    const changedScopes = new Set<string>()

    for (const [scope, { bump, commits: packageCommits }] of aggregated) {
      const pkg = scopeToPackage.get(scope)
      if (!pkg) continue

      // Apply filter if specified
      if (filter && !filter.includes(pkg.name.moniker) && !filter.includes(pkg.scope)) {
        continue
      }

      changedScopes.add(scope)

      // Find current version
      const currentVersion = findLatestTagVersion(pkg.name, tags as string[])

      // Calculate next version
      const nextVersion = calculateNextVersion(currentVersion, bump)

      // Convert commits to changelog entries
      const commitEntries: CommitEntry[] = packageCommits.map((c) => {
        const info = c.forScope(scope)
        return {
          type: info.type,
          message: info.description,
          hash: info.hash,
          breaking: info.breaking,
        }
      })

      // Format changelog
      const changelog = yield* format({
        scope: pkg.name.moniker,
        commits: commitEntries,
        previousVersion: Option.isSome(currentVersion)
          ? currentVersion.value.toString()
          : undefined,
        newVersion: nextVersion.toString(),
      })

      logs.push({
        package: pkg,
        commits: packageCommits,
        bump,
        currentVersion,
        nextVersion,
        changelog,
      })
    }

    // Find unchanged packages
    const unchanged = packages.filter((p) => {
      if (filter && !filter.includes(p.name.moniker) && !filter.includes(p.scope)) {
        return false
      }
      return !changedScopes.has(p.scope)
    })

    return { logs, unchanged }
  })
