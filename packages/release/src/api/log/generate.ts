/**
 * Log generation - orchestrates commit fetching, impact extraction, and changelog formatting.
 */

import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Effect, Option } from 'effect'
import type { ReleaseCommit } from '../analyzer/models/commit.js'
import type { Package } from '../analyzer/workspace.js'
import { extractImpacts, findLatestTagVersion } from '../analyzer/version.js'
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
  /** Start of commit range - tag or SHA (default: per-package last release tag) */
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
 * Build a package-specific release tag from package name and version.
 */
const toReleaseTag = (pkg: Package, version: Semver.Semver): string =>
  Pkg.Pin.toString(Pkg.Pin.Exact.make({ name: pkg.name, version }))

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

    // Generate logs package-by-package so each package uses its own release boundary.
    const logs: PackageLog[] = []
    const unchanged: Package[] = []

    for (const pkg of packages) {
      if (filter && !filter.includes(pkg.name.moniker) && !filter.includes(pkg.scope)) {
        continue
      }

      const currentVersion = findLatestTagVersion(pkg.name, tags as string[])
      const since = options.since
        ?? Option.match(currentVersion, {
          onNone: () => undefined,
          onSome: (version) => toReleaseTag(pkg, version),
        })
      const commits = yield* git.getCommitsSince(since)

      const impactsByCommit = yield* Effect.all(
        commits.map((commit) => extractImpacts(commit)),
        { concurrency: 'unbounded' },
      )
      const impacts = impactsByCommit.flat().filter((impact) => impact.scope === pkg.scope)

      if (impacts.length === 0) {
        unchanged.push(pkg)
        continue
      }

      let bump = impacts[0]!.bump
      const seenCommits = new Set<string>()
      const packageCommits: ReleaseCommit[] = []

      for (const impact of impacts) {
        bump = Semver.maxBump(bump, impact.bump)
        if (!seenCommits.has(impact.commit.hash)) {
          seenCommits.add(impact.commit.hash)
          packageCommits.push(impact.commit)
        }
      }

      const nextVersion = calculateNextVersion(currentVersion, bump)
      const commitEntries: CommitEntry[] = packageCommits.map((commit) => {
        const info = commit.forScope(pkg.scope)
        return {
          type: info.type,
          message: info.description,
          hash: info.hash,
          breaking: info.breaking,
        }
      })

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

    return { logs, unchanged }
  })
