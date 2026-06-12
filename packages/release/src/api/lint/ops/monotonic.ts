import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Effect, MutableHashMap, Option, Schema as S } from 'effect'
import type {
  AuditResult,
  AuditViolation,
  MonotonicViolation,
  TagInfo,
  ValidationResult,
} from '../models/monotonic.js'

// Re-export types for single-source imports
export type {
  AuditResult,
  AuditViolation,
  MonotonicViolation,
  TagInfo,
  ValidationResult,
} from '../models/monotonic.js'

/** Maximum number of concurrent git subprocess calls. */
const gitConcurrency = 8

/** A release tag parsed into its version, before SHA resolution. */
export interface ParsedReleaseTag {
  readonly tag: string
  readonly version: Semver.Semver
}

const decodeExactPin = S.decodeUnknownOption(Pkg.Pin.Exact.FromString)

/**
 * Parse all release tags once and group official-release tags by package moniker.
 *
 * Tags are expected in `packageName@version` format. Tags that do not parse as
 * exact pins, and prerelease versions, are ignored.
 */
export const groupReleaseTagsByPackage = (
  tags: readonly string[],
): MutableHashMap.MutableHashMap<string, ParsedReleaseTag[]> => {
  const grouped = MutableHashMap.empty<string, ParsedReleaseTag[]>()
  for (const tag of tags) {
    const pin = decodeExactPin(tag)
    if (Option.isNone(pin)) continue
    // Only consider official versions (no prerelease)
    if (pin.value.version._tag !== 'SemverOfficialRelease') continue

    const packageName = pin.value.name.moniker
    const parsed = Option.getOrUndefined(MutableHashMap.get(grouped, packageName))
    if (parsed === undefined) {
      MutableHashMap.set(grouped, packageName, [{ tag, version: pin.value.version }])
    } else {
      parsed.push({ tag, version: pin.value.version })
    }
  }
  return grouped
}

/**
 * Resolve the commit SHA for each parsed release tag.
 *
 * Returns tags sorted by version descending.
 */
export const resolveTagShas = (
  parsed: readonly ParsedReleaseTag[],
): Effect.Effect<TagInfo[], Git.GitError | Git.GitParseError, Git.Git> =>
  Effect.gen(function* () {
    const git = yield* Git.Git
    const tagInfos = yield* Effect.forEach(
      parsed,
      ({ tag, version }) => git.getTagSha(tag).pipe(Effect.map((sha) => ({ tag, version, sha }))),
      { concurrency: gitConcurrency },
    )
    // Sort by version descending
    return tagInfos.sort((a, b) => -Semver.order(a.version, b.version))
  })

/**
 * Parse release tags for a package and get their SHAs.
 *
 * Returns tags sorted by version descending.
 */
export const getPackageTagInfos = (
  packageName: string,
  tags: string[],
): Effect.Effect<TagInfo[], Git.GitError | Git.GitParseError, Git.Git> =>
  resolveTagShas(
    Option.getOrElse(MutableHashMap.get(groupReleaseTagsByPackage(tags), packageName), () => []),
  )

/**
 * Validate that a new version can be set at a given SHA without violating
 * monotonic versioning.
 *
 * Uses adjacent-only validation: checks that the new version fits between
 * the immediately preceding and following releases.
 */
export const validateAdjacent = (
  sha: Git.Sha.Sha,
  packageName: string,
  newVersion: Semver.Semver,
  tags: string[],
): Effect.Effect<ValidationResult, Git.GitError | Git.GitParseError, Git.Git> =>
  Effect.gen(function* () {
    const git = yield* Git.Git
    const tagInfos = yield* getPackageTagInfos(packageName, tags)

    const violations: MonotonicViolation[] = []

    // Resolve ancestry both ways for every tag (independent git calls).
    const ancestries = yield* Effect.forEach(
      tagInfos,
      (info) =>
        Effect.all([git.isAncestor(info.sha, sha), git.isAncestor(sha, info.sha)]).pipe(
          Effect.map(([tagIsAncestor, shaIsAncestor]) => ({ info, tagIsAncestor, shaIsAncestor })),
        ),
      { concurrency: gitConcurrency },
    )

    // Find all tags that are ancestors (came before) and descendants (came after)
    let highestAncestor: TagInfo | undefined
    let lowestDescendant: TagInfo | undefined

    for (const { info, tagIsAncestor, shaIsAncestor } of ancestries) {
      if (tagIsAncestor) {
        // This version came before - it should be < newVersion
        if (!highestAncestor || Semver.order(info.version, highestAncestor.version) > 0) {
          highestAncestor = info
        }
      }

      if (shaIsAncestor) {
        // This version came after - it should be > newVersion
        if (!lowestDescendant || Semver.order(info.version, lowestDescendant.version) < 0) {
          lowestDescendant = info
        }
      }
    }

    // Validate against highest ancestor (must be < newVersion)
    if (highestAncestor && Semver.order(highestAncestor.version, newVersion) >= 0) {
      violations.push({
        existingVersion: highestAncestor.version,
        existingSha: highestAncestor.sha,
        relationship: 'ancestor',
        message: `Version ${highestAncestor.version.toString()} at ${highestAncestor.sha.slice(
          0,
          7,
        )} is on an EARLIER commit but has version >= ${newVersion.toString()}`,
      })
    }

    // Validate against lowest descendant (must be > newVersion)
    if (lowestDescendant && Semver.order(lowestDescendant.version, newVersion) <= 0) {
      violations.push({
        existingVersion: lowestDescendant.version,
        existingSha: lowestDescendant.sha,
        relationship: 'descendant',
        message: `Version ${lowestDescendant.version.toString()} at ${lowestDescendant.sha.slice(
          0,
          7,
        )} is on a LATER commit but has version <= ${newVersion.toString()}`,
      })
    }

    return {
      valid: violations.length === 0,
      version: newVersion,
      sha,
      violations,
    }
  })

/**
 * Audit a package's release history.
 *
 * Verifies that versions are strictly monotonically increasing with commit order.
 */
export const auditPackageHistory = (
  packageName: string,
  tagInfos: readonly TagInfo[],
): Effect.Effect<AuditResult, Git.GitError, Git.Git> =>
  Effect.gen(function* () {
    const git = yield* Git.Git
    const violations: AuditViolation[] = []

    // Build all release pairs, then resolve ancestry concurrently (independent git calls).
    const pairs: [TagInfo, TagInfo][] = []
    for (let i = 0; i < tagInfos.length; i++) {
      for (let j = i + 1; j < tagInfos.length; j++) {
        pairs.push([tagInfos[i]!, tagInfos[j]!])
      }
    }

    const checkedPairs = yield* Effect.forEach(
      pairs,
      ([a, b]) =>
        Effect.all([git.isAncestor(a.sha, b.sha), git.isAncestor(b.sha, a.sha)]).pipe(
          Effect.map(([aIsAncestorOfB, bIsAncestorOfA]) => ({
            a,
            b,
            aIsAncestorOfB,
            bIsAncestorOfA,
          })),
        ),
      { concurrency: gitConcurrency },
    )

    // For each pair of releases, verify ordering
    for (const { a, b, aIsAncestorOfB, bIsAncestorOfA } of checkedPairs) {
      if (aIsAncestorOfB) {
        // a came before b, so a.version should be < b.version
        if (Semver.order(a.version, b.version) >= 0) {
          violations.push({
            earlier: a,
            later: b,
            message: `${a.version.toString()} at ${a.sha.slice(0, 7)} comes BEFORE ${b.version.toString()} at ${b.sha.slice(
              0,
              7,
            )}, but has higher/equal version`,
          })
        }
      } else if (bIsAncestorOfA) {
        // b came before a, so b.version should be < a.version
        if (Semver.order(b.version, a.version) >= 0) {
          violations.push({
            earlier: b,
            later: a,
            message: `${b.version.toString()} at ${b.sha.slice(0, 7)} comes BEFORE ${a.version.toString()} at ${a.sha.slice(
              0,
              7,
            )}, but has higher/equal version`,
          })
        }
      }
      // If neither is ancestor of the other, they're on parallel branches - no violation
    }

    return {
      packageName,
      valid: violations.length === 0,
      releases: tagInfos,
      violations,
    }
  })
