/**
 * Notes generation - orchestrates commit fetching, impact extraction, and release note formatting.
 */

import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Effect, MutableHashSet, Option } from 'effect'
import type { ReleaseCommit } from '../analyzer/models/commit.js'
import { extractImpacts, findLatestTagVersion } from '../analyzer/version.js'
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
  Pkg.Pin.toString(new Pkg.Pin.Exact({ name: pkg.name, version }))

/**
 * Generate release notes for packages with changes.
 *
 * Fetches commits since last release, extracts impacts per package,
 * calculates next versions, and formats changelogs.
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
    const git = yield* Git.Git
    const { packages, tags, filter } = options

    // Generate release notes package-by-package so each package uses its own release boundary.
    const notes: PackageNotes[] = []
    const unchanged: Package[] = []

    for (const pkg of packages) {
      if (filter && !filter.includes(pkg.name.moniker) && !filter.includes(pkg.scope)) {
        continue
      }

      const currentVersion = findLatestTagVersion(pkg.name, tags as string[])
      const since =
        options.since ??
        Option.match(currentVersion, {
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
      const seenCommits = MutableHashSet.empty<string>()
      const packageCommits: ReleaseCommit[] = []

      for (const impact of impacts) {
        bump = Semver.maxBump(bump, impact.bump)
        const commitHash = impact.commit['hash'] as Git.Sha.Sha
        if (!MutableHashSet.has(seenCommits, commitHash)) {
          MutableHashSet.add(seenCommits, commitHash)
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

      const renderedNotes = yield* format({
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
