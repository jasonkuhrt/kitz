import { ConventionalCommits } from '@kitz/conventional-commits'
import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Effect, Result, HashMap, MutableHashMap, Option, Schema as S } from 'effect'
import type { Candidate } from '../version/models/candidate.js'
import { CandidateSchema } from '../version/models/candidate.js'
import type { Ephemeral } from '../version/models/ephemeral.js'
import { EphemeralSchema } from '../version/models/ephemeral.js'
import { ReleaseCommit } from './models/commit.js'

/**
 * Information about a commit's effect on a package.
 * References the full ReleaseCommit (not flattened).
 */
export interface CommitImpact {
  readonly scope: string
  readonly bump: Semver.BumpType
  readonly commit: ReleaseCommit
}

/**
 * Get bump type from CC type, returns null for no-impact types.
 */
export const getBump = (
  type: ConventionalCommits.Type.Type,
  breaking: boolean,
): Semver.BumpType | null => {
  if (breaking) return 'major'
  if (!ConventionalCommits.Type.Standard.is(type)) return 'patch'
  return Option.getOrNull(ConventionalCommits.Type.impact(type))
}

const decodeExactPin = S.decodeUnknownOption(Pkg.Pin.Exact.FromString)

/**
 * Extract package impacts from a git commit.
 *
 * Parses the commit message as conventional commit and returns
 * which packages are affected and what bump type each needs.
 * Stores the full ReleaseCommit (not flattened per-scope).
 */
export const extractImpacts = (gitCommit: Git.Commit): Effect.Effect<CommitImpact[]> =>
  Effect.gen(function* () {
    // Parse the commit title (first line)
    const title = gitCommit.message.split('\n')[0] ?? gitCommit.message
    const parseResult = yield* Effect.result(ConventionalCommits.Title.parse(title))

    if (Result.isFailure(parseResult)) {
      // Not a conventional commit - no impacts
      return []
    }

    const parsedCC = parseResult.success
    const releaseCommit = ReleaseCommit.make({
      hash: gitCommit.hash,
      author: gitCommit.author,
      date: gitCommit.date,
      message: parsedCC,
    })
    const impacts: CommitImpact[] = []

    if (ConventionalCommits.Commit.Single.is(parsedCC)) {
      if (parsedCC.scopes.length === 0) return [] // Scopeless - handled by caller

      const bump = getBump(parsedCC.type, parsedCC.breaking)
      if (bump === null) return []

      for (const scope of parsedCC.scopes) {
        impacts.push({ scope, bump, commit: releaseCommit })
      }
    } else if (ConventionalCommits.Commit.Multi.is(parsedCC)) {
      for (const target of parsedCC.targets) {
        const bump = getBump(target.type, target.breaking)
        if (bump === null) continue
        impacts.push({ scope: target.scope, bump, commit: releaseCommit })
      }
    }

    return impacts
  })

/**
 * Aggregate impacts by package, keeping the highest bump for each.
 * Returns Map<scope, { bump, commits: ReleaseCommit[] }>.
 *
 * Note: Same commit may appear in multiple scopes if it affects multiple packages.
 */
export const aggregateByPackage = (
  impacts: CommitImpact[],
): HashMap.HashMap<string, { bump: Semver.BumpType; commits: ReleaseCommit[] }> => {
  const result = MutableHashMap.empty<string, { bump: Semver.BumpType; commits: ReleaseCommit[] }>()

  for (const impact of impacts) {
    const existing = MutableHashMap.get(result, impact.scope)
    if (Option.isSome(existing)) {
      MutableHashMap.set(result, impact.scope, {
        bump: Semver.maxBump(existing.value.bump, impact.bump),
        commits: [...existing.value.commits, impact.commit],
      })
    } else {
      MutableHashMap.set(result, impact.scope, {
        bump: impact.bump,
        commits: [impact.commit],
      })
    }
  }

  return HashMap.fromIterable(result)
}

/**
 * Find the latest version for a package from git tags.
 *
 * Tags follow the pattern: @scope/package@version or package@version
 */
export const findLatestTagVersion = (
  packageName: Pkg.Moniker.Moniker,
  tags: string[],
): Option.Option<Semver.Semver> => {
  const versions: Semver.Semver[] = []

  for (const tag of tags) {
    const parsed = decodeExactPin(tag)
    if (Option.isNone(parsed)) continue
    if (parsed.value.name.moniker !== packageName.moniker) continue
    // Current released version baseline is always an official release.
    if (Semver.getPrerelease(parsed.value.version)) continue
    versions.push(parsed.value.version)
  }

  if (versions.length === 0) return Option.none()

  // Sort and get the highest version
  versions.sort((a, b) => -Semver.order(a, b)) // Descending
  return Option.some(versions[0]!)
}

/**
 * Find the highest candidate release number for a package.
 *
 * Candidate versions follow the pattern: `${base}-next.${n}`
 * Returns the highest `n` found, or 0 if no candidate releases exist.
 */
export const findLatestCandidateNumber = (
  packageName: Pkg.Moniker.Moniker,
  baseVersion: Semver.Semver,
  tags: string[],
): number => {
  let highest = 0

  for (const tag of tags) {
    const parsed = decodeExactPin(tag)
    if (Option.isNone(parsed)) continue
    if (parsed.value.name.moniker !== packageName.moniker) continue
    if (!Semver.equivalence(Semver.stripPre(parsed.value.version), Semver.stripPre(baseVersion)))
      continue

    const prerelease = Semver.getPrerelease(parsed.value.version)
    if (!prerelease) continue

    const decoded = S.decodeUnknownOption(CandidateSchema)(prerelease.join('.'))
    if (Option.isSome(decoded) && decoded.value.iteration > highest) {
      highest = decoded.value.iteration
    }
  }

  return highest
}

/**
 * Find the highest ephemeral release number for a package and PR.
 *
 * Ephemeral versions follow the pattern: `0.0.0-pr.${prNum}.${n}.${sha}`
 * Returns the highest `n` found, or 0 if no ephemeral releases exist.
 */
export const findLatestEphemeralNumber = (
  packageName: Pkg.Moniker.Moniker,
  prNumber: number,
  tags: string[],
): number => {
  let highest = 0

  for (const tag of tags) {
    const parsed = decodeExactPin(tag)
    if (Option.isNone(parsed)) continue
    if (parsed.value.name.moniker !== packageName.moniker) continue
    if (!Semver.equivalence(Semver.stripPre(parsed.value.version), Semver.zero)) continue

    const prerelease = Semver.getPrerelease(parsed.value.version)
    if (!prerelease) continue

    const decoded = S.decodeUnknownOption(EphemeralSchema)(prerelease.join('.'))
    if (
      Option.isSome(decoded) &&
      decoded.value.prNumber === prNumber &&
      decoded.value.iteration > highest
    ) {
      highest = decoded.value.iteration
    }
  }

  return highest
}
