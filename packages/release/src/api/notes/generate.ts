/**
 * Notes generation - orchestrates commit fetching, impact extraction, and release note formatting.
 */

import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Effect, HashMap, Option } from 'effect'
import { makeCommitRangeFetcher } from '../analyzer/analyze.js'
import type { ReleaseCommit } from '../analyzer/models/commit.js'
import {
  type ResolvedConventionalCommitTypes,
  aggregateByPackage,
  extractImpacts,
  findLatestTagVersion,
} from '../analyzer/version.js'
import type { Package } from '../analyzer/workspace.js'
import { calculateNextVersion } from '../version/calculate.js'
import { type CommitEntry, format, type FormattedNotes } from './format.js'

/**
 * Release notes for a single package.
 */
export interface PackageNotes {
  /** The package these release notes are for */
  readonly package: Package
  /** Commits affecting this package */
  readonly commits: readonly ReleaseCommit[]
  /** Calculated bump type from commits */
  readonly bump: Semver.BumpType
  /** Current version (if any releases exist) */
  readonly currentVersion: Option.Option<Semver.Semver>
  /** Calculated next version */
  readonly nextVersion: Semver.Semver
  /** Formatted release notes */
  readonly notes: FormattedNotes
}

/**
 * Options for generating package release notes.
 */
export interface GenerateOptions {
  /** Packages to generate release notes for */
  readonly packages: readonly Package[]
  /** All git tags (for finding last release) */
  readonly tags: readonly string[]
  /** Start of commit range - tag or SHA (default: per-package last release tag) */
  readonly since?: string | undefined
  /** End of commit range (default: HEAD) */
  readonly until?: string | undefined
  /** Filter to specific packages by name */
  readonly filter?: readonly string[] | undefined
  /** Resolved type→bump mapping from config */
  readonly resolvedConventionalCommitTypes: ResolvedConventionalCommitTypes
  /** SHA-keyed changelog-text overrides. Rewrites only rendered descriptions;
   *  never affects bump/type/scope/breaking. */
  readonly commitOverrides?: import('../config.js').CommitOverrides | undefined
}

/**
 * Result of note generation.
 */
export interface GenerateResult {
  /** Package notes (only packages with changes) */
  readonly notes: readonly PackageNotes[]
  /** Packages with no changes since last release */
  readonly unchanged: readonly Package[]
}

/**
 * Build a package-specific release tag from package name and version.
 */
const toReleaseTag = (pkg: Package, version: Semver.Semver): string =>
  Pkg.Pin.toString(Pkg.Pin.Exact.make({ name: pkg.name, version }))

/**
 * Generate release notes for packages with changes.
 *
 * Fetches commits since last release, extracts impacts per package,
 * calculates next versions, and formats changelogs.
 *
 * Unlike the analyzer's lenient stance, an `until` boundary that cannot be
 * resolved fails the pipeline (`strictness: 'strict'`) so notes never silently
 * include commits beyond the requested boundary.
 *
 * @example
 * ```ts
 * const result = yield* Notes.generate({
 *   packages: await scanPackages(),
 *   tags: await git.getTags(),
 * })
 *
 * for (const note of result.notes) {
 *   console.log(note.notes.markdown)
 * }
 * ```
 */
export const generate = (
  options: GenerateOptions,
): Effect.Effect<GenerateResult, Git.GitError | Git.GitParseError, Git.Git> =>
  Effect.gen(function* () {
    const { packages, tags, filter } = options
    const fetchRange = makeCommitRangeFetcher({
      until: options.until,
      tags,
      strictness: 'strict',
    })

    // Generate release notes package-by-package so each package uses its own release boundary.
    const notes: PackageNotes[] = []
    const unchanged: Package[] = []

    for (const pkg of packages) {
      if (filter && !filter.includes(pkg.name.moniker) && !filter.includes(pkg.scope)) {
        continue
      }

      const currentVersion = findLatestTagVersion(pkg.name, tags)
      const since =
        options.since ??
        Option.match(currentVersion, {
          onNone: () => undefined,
          onSome: (version) => toReleaseTag(pkg, version),
        })
      const boundedCommits = yield* fetchRange(since)

      const impactsByCommit = yield* Effect.all(
        boundedCommits.map((commit) =>
          extractImpacts(commit, options.resolvedConventionalCommitTypes, options.commitOverrides),
        ),
        { concurrency: 'unbounded' },
      )
      const aggregated = Option.getOrUndefined(
        HashMap.get(aggregateByPackage(impactsByCommit.flat()), pkg.scope),
      )

      if (aggregated === undefined) {
        unchanged.push(pkg)
        continue
      }

      const { bump, commits: packageCommits } = aggregated
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

      const renderedNotes = format({
        scope: pkg.name.moniker,
        commits: commitEntries,
        previousVersion: Option.isSome(currentVersion)
          ? currentVersion.value.toString()
          : undefined,
        newVersion: nextVersion.toString(),
      })

      notes.push({
        package: pkg,
        commits: packageCommits,
        bump,
        currentVersion,
        nextVersion,
        notes: renderedNotes,
      })
    }

    return { notes, unchanged }
  })
