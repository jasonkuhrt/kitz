import { ConventionalCommits } from '@kitz/conventional-commits'
import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Effect, Either, Option, Schema as S } from 'effect'
import {
  makePreviewPrerelease,
  makePrPrerelease,
  PreviewPrereleaseSchema,
  PrPrereleaseSchema,
} from './prerelease.js'
import { ReleaseCommit } from './release-commit.js'

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
const getBump = (type: ConventionalCommits.Type.Type, breaking: boolean): Semver.BumpType | null => {
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
export const extractImpacts = (
  gitCommit: Git.Commit,
): Effect.Effect<CommitImpact[], never> =>
  Effect.gen(function*() {
    // Parse the commit title (first line)
    const title = gitCommit.message.split('\n')[0] ?? gitCommit.message
    const parseResult = yield* Effect.either(ConventionalCommits.Title.parse(title))

    if (Either.isLeft(parseResult)) {
      // Not a conventional commit - no impacts
      return []
    }

    const parsedCC = parseResult.right
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
): Map<string, { bump: Semver.BumpType; commits: ReleaseCommit[] }> => {
  const result = new Map<string, { bump: Semver.BumpType; commits: ReleaseCommit[] }>()

  for (const impact of impacts) {
    const existing = result.get(impact.scope)
    if (existing) {
      result.set(impact.scope, {
        bump: Semver.maxBump(existing.bump, impact.bump),
        commits: [...existing.commits, impact.commit],
      })
    } else {
      result.set(impact.scope, {
        bump: impact.bump,
        commits: [impact.commit],
      })
    }
  }

  return result
}

/**
 * Calculate the next version given a current version and bump type.
 *
 * Applies phase-aware bump mapping:
 * - Initial phase (0.x.x): major/minor → minor, patch → patch
 * - Public phase (1.x.x+): standard semver semantics
 */
export const calculateNextVersion = (
  current: Option.Option<Semver.Semver>,
  bump: Semver.BumpType,
): Semver.Semver =>
  Option.match(current, {
    onNone: () => {
      // First release - ALWAYS start in initial phase (0.x.x)
      switch (bump) {
        case 'major':
        case 'minor':
          return Semver.make(0, 1, 0)
        case 'patch':
          return Semver.make(0, 0, 1)
      }
    },
    onSome: (version) => {
      // Apply phase-aware bump mapping
      const effectiveBump = Semver.mapBumpForPhase(version, bump)
      return Semver.increment(version, effectiveBump)
    },
  })

/**
 * Graduate from initial phase to public phase (1.0.0).
 *
 * This is a one-way operation that declares "the API is now stable".
 * Should only be called explicitly, never automatically from commits.
 *
 * @deprecated Use {@link Semver.one} directly instead.
 */
export const graduatePhase = (): Semver.Semver => Semver.one

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
    versions.push(parsed.value.version)
  }

  if (versions.length === 0) return Option.none()

  // Sort and get the highest version
  versions.sort((a, b) => -Semver.order(a, b)) // Descending
  return Option.some(versions[0]!)
}

/**
 * Find the highest preview release number for a package.
 *
 * Preview versions follow the pattern: `${base}-next.${n}`
 * Returns the highest `n` found, or 0 if no preview releases exist.
 */
export const findLatestPreviewNumber = (
  packageName: Pkg.Moniker.Moniker,
  baseVersion: Semver.Semver,
  tags: string[],
): number => {
  let highest = 0

  for (const tag of tags) {
    const parsed = decodeExactPin(tag)
    if (Option.isNone(parsed)) continue
    if (parsed.value.name.moniker !== packageName.moniker) continue
    if (!Semver.equivalence(Semver.stripPre(parsed.value.version), Semver.stripPre(baseVersion))) continue

    const prerelease = Semver.getPrerelease(parsed.value.version)
    if (!prerelease) continue

    const decoded = S.decodeUnknownOption(PreviewPrereleaseSchema)(prerelease.join('.'))
    if (Option.isSome(decoded) && decoded.value.iteration > highest) {
      highest = decoded.value.iteration
    }
  }

  return highest
}

/**
 * Calculate the next preview version.
 *
 * Format: `${nextStableVersion}-next.${n}`
 */
export const calculatePreviewVersion = (
  nextStableVersion: Semver.Semver,
  existingPreviewNumber: number,
): Semver.Semver => {
  const prerelease = makePreviewPrerelease(existingPreviewNumber + 1)
  return Semver.withPre(nextStableVersion, ['next', prerelease.iteration])
}

/**
 * Find the highest PR release number for a package and PR.
 *
 * PR versions follow the pattern: `0.0.0-pr.${prNum}.${n}.${sha}`
 * Returns the highest `n` found, or 0 if no PR releases exist.
 */
export const findLatestPrNumber = (
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

    const decoded = S.decodeUnknownOption(PrPrereleaseSchema)(prerelease.join('.'))
    if (Option.isSome(decoded) && decoded.value.prNumber === prNumber && decoded.value.iteration > highest) {
      highest = decoded.value.iteration
    }
  }

  return highest
}

/**
 * Calculate the next PR version.
 *
 * Format: `0.0.0-pr.${prNumber}.${n}.${sha}`
 */
export const calculatePrVersion = (
  prNumber: number,
  existingPrNumber: number,
  sha: Git.Sha.Sha,
): Semver.Semver => {
  const prerelease = makePrPrerelease(prNumber, existingPrNumber + 1, sha)
  return Semver.withPre(Semver.zero, ['pr', prerelease.prNumber, prerelease.iteration, prerelease.sha])
}
